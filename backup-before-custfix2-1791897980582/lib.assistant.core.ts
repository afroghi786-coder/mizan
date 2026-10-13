// lib.assistant.core.ts — موتور جستجو
export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

export function score(text: string, query: string): number {
  const t = norm(text);
  const q = norm(query);
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.includes(q)) return 70;
  if (q.includes(t)) return 60;
  const dist = lev(t, q);
  const ratio = 1 - dist / Math.max(t.length, q.length);
  if (ratio > 0.7) return Math.round(ratio * 60);
  return 0;
}

export interface Entity {
  type: 'box' | 'customer' | 'invoice';
  id: string;
  name: string;
  subtitle?: string;
  meta: any;
  score: number;
}

// ─── Resolve Box (با فیلتر ارز)
export async function resolveBox(name: string, currency?: string): Promise<any | null> {
  try {
    const { getBoxes, getAllBalances } = await import('./lib.boxes');
    const boxes = await getBoxes().catch(() => []) || [];
    const bals = await getAllBalances().catch(() => ({})) || {};
    if (!boxes.length) return null;
    
    let best: any = null;
    let bestScore = 0;
    const q = norm(name);
    const curr = currency ? String(currency).toUpperCase() : '';
    
    for (const b of boxes) {
      // اگه ارز مشخص شده و صندوق ارز فرق داره → skip
      if (curr && String(b.currency || '').toUpperCase() !== curr) continue;
      
      const s1 = score(b.name || '', name);
      const s2 = score(b.code || '', name);
      const s3 = score(b.owner_name || '', name);
      const s = Math.max(s1, s2, s3);
      
      if (s > bestScore) {
        bestScore = s;
        best = { ...b, _balance: bals[b.id || b.local_id] || 0 };
      }
    }
    
    // اگه چیزی پیدا نشد و ارز مشخص بود، بدون فیلتر ارز بگرد
    if (!best && curr) {
      for (const b of boxes) {
        const s1 = score(b.name || '', name);
        const s2 = score(b.code || '', name);
        const s3 = score(b.owner_name || '', name);
        const s = Math.max(s1, s2, s3);
        if (s > bestScore) {
          bestScore = s;
          best = { ...b, _balance: bals[b.id || b.local_id] || 0 };
        }
      }
    }
    
    return bestScore >= 40 ? best : null;
  } catch (e) { console.log('resolveBox err:', e); return null; }
}

export async function resolvePerson(name: string): Promise<any | null> {
  try {
    const { getFxCustomers } = await import('./lib.fx.cust');
    const custs = await getFxCustomers().catch(() => []) || [];
    let best: any = null;
    let bestScore = 0;
    for (const c of custs) {
      const s = Math.max(score(c.name || '', name), score(c.phone || '', name), score(c.code || '', name));
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return bestScore >= 40 ? best : null;
  } catch { return null; }
}

// ─── Context
let _ctx: any = {};
export function setContext(patch: any) { _ctx = { ..._ctx, ...patch }; }
export function getContext() { return _ctx; }
export function clearContext() { _ctx = {}; }

// ─── استخراج ارز از متن
export function extractCurrency(text: string): string | undefined {
  const t = norm(text);
  if (/دالر|دلار|دولار|usd/.test(t)) return 'USD';
  if (/یورو|eur/.test(t)) return 'EUR';
  if (/افغانی|افغانى|afn/.test(t)) return 'AFN';
  if (/تومان|تومن|irt/.test(t)) return 'IRT';
  if (/ریال|irr/.test(t)) return 'IRR';
  if (/روپیه|پاکستانی|pkr/.test(t)) return 'PKR';
  if (/درهم|aed/.test(t)) return 'AED';
  if (/لیر|try/.test(t)) return 'TRY';
  return undefined;
}

// ─── استخراج مبلغ
export function extractAmount(text: string): number | null {
  const t = norm(text).replace(/,/g, '');
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  // کلمات
  const words: any = { 'صد': 100, 'پنجاه': 50, 'هزار': 1000, 'پونصد': 500, 'پانصد': 500, 'دویست': 200, 'سیصد': 300 };
  for (const k of Object.keys(words)) {
    if (t.includes(k)) return words[k];
  }
  return null;
}

// ─── Deep Search کلی
export async function deepSearch(query: string, types?: string[]): Promise<Entity[]> {
  const results: Entity[] = [];
  const wantAll = !types || !types.length;

  if (wantAll || types!.includes('box')) {
    try {
      const { getBoxes, getAllBalances } = await import('./lib.boxes');
      const boxes = await getBoxes().catch(() => []) || [];
      const bals = await getAllBalances().catch(() => ({})) || {};
      for (const b of boxes) {
        const s = Math.max(score(b.name || '', query), score(b.code || '', query));
        if (s > 0) {
          const bal = bals[b.id || b.local_id] || 0;
          results.push({
            type: 'box',
            id: b.id || b.local_id || b.code,
            name: b.name || b.code || 'صندوق',
            subtitle: `${b.currency || 'AFN'} — موجودی: ${bal.toLocaleString('en-US')}`,
            meta: { ...b, _balance: bal },
            score: s,
          });
        }
      }
    } catch (e) { console.log(e); }
  }

  if (wantAll || types!.includes('customer')) {
    try {
      const { getFxCustomers } = await import('./lib.fx.cust');
      const custs = await getFxCustomers().catch(() => []) || [];
      for (const c of custs) {
        const s = Math.max(score(c.name || '', query), score(c.phone || '', query), score(c.code || '', query));
        if (s > 0) {
          results.push({ type: 'customer', id: c.id || c.local_id || c.code, name: c.name || 'مشتری', subtitle: c.phone || '', meta: c, score: s });
        }
      }
    } catch (e) { console.log(e); }
  }

  if (wantAll || types!.includes('invoice')) {
    try {
      const { getSalesGrouped } = await import('./lib');
      const sales = await getSalesGrouped().catch(() => []) || [];
      for (const s of sales) {
        const sc = Math.max(score(s.invoice || '', query), score(s.name || '', query), score(s.phone || '', query));
        if (sc > 0) {
          results.push({ type: 'invoice', id: s.invoice, name: `فاکتور ${s.invoice} — ${s.name || ''}`, subtitle: `${(Number(s.total) || 0).toLocaleString('en-US')} — ${new Date(s.date || 0).toLocaleDateString('fa-IR')}`, meta: s, score: sc });
        }
      }
    } catch (e) { console.log(e); }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 15);
}

// ─── عملیات صندوق
export async function boxDeposit(box: any, amount: number, note?: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const { addBoxTransaction } = await import('./lib.boxes');
    await addBoxTransaction({
      box_id: box.id || box.local_id,
      box_code: box.code,
      type: 'deposit',
      amount,
      currency: box.currency || 'AFN',
      description: note || 'واریز از دستیار',
      date: new Date().toISOString(),
    });
    return { ok: true, msg: `✅ واریز ${amount.toLocaleString('en-US')} ${box.currency} به ${box.name}` };
  } catch (e: any) { return { ok: false, msg: '❌ ' + (e?.message || 'خطا') }; }
}

export async function boxWithdraw(box: any, amount: number, note?: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const { addBoxTransaction } = await import('./lib.boxes');
    await addBoxTransaction({
      box_id: box.id || box.local_id,
      box_code: box.code,
      type: 'withdraw',
      amount,
      currency: box.currency || 'AFN',
      description: note || 'برداشت از دستیار',
      date: new Date().toISOString(),
    });
    return { ok: true, msg: `✅ برداشت ${amount.toLocaleString('en-US')} ${box.currency} از ${box.name}` };
  } catch (e: any) { return { ok: false, msg: '❌ ' + (e?.message || 'خطا') }; }
}
