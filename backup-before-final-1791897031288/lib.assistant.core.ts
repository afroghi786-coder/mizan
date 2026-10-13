// lib.assistant.core.ts — موتور جستجو + Context دستیار
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════
// Context — حافظه دستیار
// ═══════════════════════════════════════════
export interface AsstContext {
  lastEntity?: { type: string; id: string; name: string; meta: any };
  lastSearch?: string;
  lastTab?: string;
  lastSub?: string;
  lastAction?: string;
  updatedAt: number;
}

let _ctx: AsstContext = { updatedAt: 0 };

export function setContext(patch: Partial<AsstContext>): void {
  _ctx = { ..._ctx, ...patch, updatedAt: Date.now() };
}
export function getContext(): AsstContext { return _ctx; }
export function clearContext(): void { _ctx = { updatedAt: 0 }; }

// ═══════════════════════════════════════════
// نرمال‌سازی
// ═══════════════════════════════════════════
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

// Levenshtein فاصله
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// امتیاز تطبیق
function score(text: string, query: string): number {
  const t = norm(text);
  const q = norm(query);
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.endsWith(q)) return 75;
  if (t.includes(q)) return 60;
  if (q.includes(t)) return 55;
  // فازی
  const dist = lev(t, q);
  const ratio = 1 - dist / Math.max(t.length, q.length);
  if (ratio > 0.65) return Math.round(ratio * 55);
  // کلمات
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);
  let matched = 0;
  for (const qw of qWords) {
    for (const tw of tWords) {
      if (tw.includes(qw) || qw.includes(tw)) { matched++; break; }
    }
  }
  if (matched > 0) return Math.round(40 * (matched / qWords.length));
  return 0;
}

// ═══════════════════════════════════════════
// Entity types
// ═══════════════════════════════════════════
export type EntityType = 'box' | 'customer' | 'supplier' | 'invoice' | 'hawala' | 'check' | 'product';

export interface Entity {
  type: EntityType;
  id: string;
  name: string;
  subtitle?: string;
  meta: any;
  score: number;
}

// ═══════════════════════════════════════════
// Deep Search
// ═══════════════════════════════════════════
export async function deepSearch(query: string, types?: EntityType[]): Promise<Entity[]> {
  const results: Entity[] = [];
  const wantAll = !types || !types.length;

  // ─── صندوق‌ها ───
  if (wantAll || types!.includes('box')) {
    try {
      const { getBoxes } = await import('./lib.fx');
      const boxes = await getBoxes().catch(() => []) || [];
      for (const b of boxes) {
        const s1 = score(b.name || '', query);
        const s2 = score(b.code || '', query);
        const s3 = score(b.currency || '', query);
        const s = Math.max(s1, s2, s3);
        if (s > 0) {
          results.push({
            type: 'box',
            id: b.id || b.local_id || b.code,
            name: b.name || b.code || 'صندوق',
            subtitle: `${b.currency || 'AFN'} — موجودی: ${(Number(b.opening) || 0).toLocaleString('en-US')}`,
            meta: b,
            score: s,
          });
        }
      }
    } catch (e) { console.log('search box err:', e); }
  }

  // ─── مشتریان ───
  if (wantAll || types!.includes('customer')) {
    try {
      const { getFxCustomers } = await import('./lib.fx.cust');
      const custs = await getFxCustomers().catch(() => []) || [];
      for (const c of custs) {
        const s1 = score(c.name || '', query);
        const s2 = score(c.phone || '', query);
        const s3 = score(c.code || '', query);
        const s = Math.max(s1, s2, s3);
        if (s > 0) {
          results.push({
            type: 'customer',
            id: c.id || c.local_id || c.code || '',
            name: c.name || 'مشتری',
            subtitle: c.phone || c.bank || '',
            meta: c,
            score: s,
          });
        }
      }
    } catch (e) { console.log('search customer err:', e); }
  }

  // ─── فاکتورهای فروش ───
  if (wantAll || types!.includes('invoice')) {
    try {
      const { getSalesGrouped } = await import('./lib');
      const sales = await getSalesGrouped().catch(() => []) || [];
      for (const s of sales) {
        const s1 = score(s.invoice || '', query);
        const s2 = score(s.name || '', query);
        const s3 = score(s.phone || '', query);
        const sc = Math.max(s1, s2, s3);
        if (sc > 0) {
          results.push({
            type: 'invoice',
            id: s.invoice,
            name: `فاکتور ${s.invoice} — ${s.name || ''}`,
            subtitle: `${(Number(s.total) || 0).toLocaleString('en-US')} افغانی — ${new Date(s.date || 0).toLocaleDateString('fa-IR')}`,
            meta: s,
            score: sc,
          });
        }
      }
    } catch (e) { console.log('search invoice err:', e); }
  }

  // مرتب‌سازی بر اساس امتیاز
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10);
}

// ═══════════════════════════════════════════
// Resolve — پیدا کردن یک entity
// ═══════════════════════════════════════════
export async function resolveBox(name: string, currency?: string): Promise<any | null> {
  try {
    const { getBoxes } = await import('./lib.fx');
    const boxes = await getBoxes().catch(() => []) || [];
    let best: any = null;
    let bestScore = 0;
    for (const b of boxes) {
      let s = score(b.name || '', name);
      if (currency && b.currency === currency) s += 20;
      else if (currency && b.currency !== currency) s -= 30;
      if (s > bestScore) { bestScore = s; best = b; }
    }
    return bestScore >= 40 ? best : null;
  } catch { return null; }
}

export async function resolvePerson(name: string): Promise<any | null> {
  try {
    const { getFxCustomers } = await import('./lib.fx.cust');
    const custs = await getFxCustomers().catch(() => []) || [];
    let best: any = null;
    let bestScore = 0;
    for (const c of custs) {
      const s1 = score(c.name || '', name);
      const s2 = score(c.phone || '', name);
      const s = Math.max(s1, s2);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return bestScore >= 40 ? best : null;
  } catch { return null; }
}

// ═══════════════════════════════════════════
// Action Executor
// ═══════════════════════════════════════════
export async function addToBox(boxId: string, amount: number, type: 'in' | 'out', note?: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const { getBoxes, addBoxTransaction } = await import('./lib.boxes');
    const boxes = await getBoxes().catch(() => []) || [];
    const box = boxes.find((b: any) => (b.id || b.local_id || b.code) === boxId);
    if (!box) return { ok: false, msg: 'صندوق پیدا نشد' };

    await addBoxTransaction({
      box_id: box.id || box.local_id,
      box_code: box.code,
      type: type === 'in' ? 'in' : 'out',
      amount,
      currency: box.currency || 'AFN',
      description: note || (type === 'in' ? 'افزایش از دستیار' : 'کاهش از دستیار'),
      date: new Date().toISOString(),
    });

    return {
      ok: true,
      msg: `✅ ${type === 'in' ? 'افزایش' : 'کاهش'} ${amount.toLocaleString('en-US')} ${box.currency || ''} در صندوق ${box.name}`,
    };
  } catch (e: any) {
    return { ok: false, msg: '❌ ' + (e?.message || 'خطا') };
  }
}

// ═══════════════════════════════════════════
// Pre-fill Form
// ═══════════════════════════════════════════
export interface Prefill {
  type: string;
  fields: Record<string, any>;
}

export async function buildInvoicePrefill(personName: string): Promise<Prefill | null> {
  const p = await resolvePerson(personName);
  if (!p) return null;
  return {
    type: 'invoice',
    fields: {
      customer_name: p.name,
      customer_code: p.code || p.id || p.local_id,
      customer_phone: p.phone || '',
      customer_bank: p.bank || '',
      customer_holder: p.holder_name || '',
    },
  };
}
