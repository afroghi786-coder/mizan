const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. lib.local.nlu.ts — مغز فهم زبان
// ═══════════════════════════════════════════
const nlu = `// lib.local.nlu.ts — فهم زبان محلی (بدون AI ابری)
export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يىئ]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/\\s+/g, ' ')
    .trim();
}

export function lower(s: string): string {
  return norm(s).toLowerCase();
}

// ─── فاصله Levenshtein
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

// ─── امتیاز تطبیق اسم
export function nameScore(text: string, query: string): number {
  const t = lower(text);
  const q = lower(query);
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 75;
  if (q.includes(t)) return 65;
  const dist = lev(t, q);
  const ratio = 1 - dist / Math.max(t.length, q.length);
  if (ratio > 0.75) return Math.round(ratio * 70);
  if (ratio > 0.6) return Math.round(ratio * 50);
  return 0;
}

// ═══════════════════════════════════════════
// تشخیص ارز
// ═══════════════════════════════════════════
export function detectCurrency(text: string): string | undefined {
  const t = lower(text);
  if (/دالر|دلار|دولار|usd|dollar/.test(t)) return 'USD';
  if (/یورو|eur|euro/.test(t)) return 'EUR';
  if (/افغانی|افغان|afn/.test(t)) return 'AFN';
  if (/تومان|تومن|irt/.test(t)) return 'IRT';
  if (/ریال|irr/.test(t)) return 'IRR';
  if (/روپیه|پاکستانی|pkr/.test(t)) return 'PKR';
  if (/درهم|aed/.test(t)) return 'AED';
  if (/لیر|try/.test(t)) return 'TRY';
  if (/پوند|gbp/.test(t)) return 'GBP';
  return undefined;
}

// ═══════════════════════════════════════════
// تشخیص مبلغ
// ═══════════════════════════════════════════
const WORD_NUMS: any = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'پانزده': 15, 'بیست': 20,
  'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
  'هشتاد': 80, 'نود': 90, 'صد': 100, 'دویست': 200,
  'سیصد': 300, 'چهارصد': 400, 'پونصد': 500, 'پانصد': 500,
  'ششصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900,
};

export function extractAmount(text: string): number | null {
  const t = norm(text).replace(/,/g, '');
  
  // عدد + واحد
  const m = t.match(/(\\d+(?:\\.\\d+)?)\\s*(هزار|میلیون|میلیارد|k|K|m|M)?/);
  if (m) {
    let v = parseFloat(m[1]);
    const u = m[2];
    if (u === 'هزار' || u === 'k' || u === 'K') v *= 1000;
    else if (u === 'میلیون' || u === 'm' || u === 'M') v *= 1000000;
    else if (u === 'میلیارد') v *= 1000000000;
    return v;
  }
  
  // کلمات عددی
  const words = t.split(/\\s+/);
  let sum = 0;
  let found = false;
  for (const w of words) {
    if (WORD_NUMS[w] !== undefined) { sum += WORD_NUMS[w]; found = true; }
    if (w === 'هزار' && found) { sum *= 1000; }
    else if (w === 'میلیون' && found) { sum *= 1000000; }
  }
  return found ? sum : null;
}

// ═══════════════════════════════════════════
// استخراج اسم (بدون کلمات کلیدی)
// ═══════════════════════════════════════════
export function extractName(text: string, removeWords: string[] = []): string {
  let t = lower(text);
  
  const STOP_WORDS = [
    'صندوق', 'کارتکش', 'کاردکس', 'کارت', 'مشتری', 'طرف', 'حساب',
    'فاکتور', 'فاکتر', 'صورت', 'حواله', 'چک',
    'را', 'رو', 'بیار', 'بیاور', 'بگیر', 'بده', 'بزن', 'بساز',
    'باز', 'کن', 'بگرد', 'پیدا', 'نشون', 'نشان', 'ببین',
    'به', 'از', 'برای', 'واسه', 'با',
    'مبلغ', 'مقدار', 'قیمت', 'عدد',
    'دالر', 'دلار', 'یورو', 'افغانی', 'تومان', 'ریال', 'روپیه', 'درهم',
    'usd', 'eur', 'afn', 'irt', 'irr', 'pkr', 'aed',
    'اضافه', 'کم', 'واریز', 'برداشت', 'کسر', 'افزایش', 'کاهش',
    'مانده', 'حساب', 'موجودی',
    'سود', 'درآمد', 'گزارش', 'امروز', 'دیروز', 'ماه', 'سال', 'هفته',
    'چقدر', 'چند', 'چیه', 'کیه', 'کجا', 'کی', 'چی',
    'همه', 'تمام', 'کل', 'لیست',
    'و', 'یا',
    ...removeWords,
  ];
  
  for (const sw of STOP_WORDS) {
    t = t.replace(new RegExp('\\\\b' + sw + '\\\\b', 'g'), ' ');
  }
  
  return t.replace(/[^\\u0600-\\u06FF\\w\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
}

// ═══════════════════════════════════════════
// تشخیص قصد
// ═══════════════════════════════════════════
export type Intent =
  | 'open_box'
  | 'list_boxes'
  | 'balance'
  | 'deposit'
  | 'withdraw'
  | 'today_profit'
  | 'open_customer'
  | 'list_customers'
  | 'open_invoice'
  | 'help'
  | 'unknown';

export interface Command {
  intent: Intent;
  params: any;
  raw: string;
}

export function parseCommand(text: string): Command {
  const raw = text;
  const t = lower(text);
  const currency = detectCurrency(t);
  const amount = extractAmount(t);
  
  if (!t || t.length < 2) return { intent: 'unknown', params: {}, raw };
  
  // ─── راهنما
  if (/راهنما|کمک|چیکار|چه کاری|دستورات/.test(t)) {
    return { intent: 'help', params: {}, raw };
  }
  
  // ─── همه صندوق‌ها
  if (/(?:همه|تمام|کل|لیست)\\s*(?:ی)?\\s*صندوق/.test(t)) {
    return { intent: 'list_boxes', params: {}, raw };
  }
  
  // ─── همه مشتری‌ها
  if (/(?:همه|تمام|کل|لیست)\\s*(?:ی)?\\s*(?:مشتری|مشتریان)/.test(t)) {
    return { intent: 'list_customers', params: {}, raw };
  }
  
  // ─── سود امروز / گزارش
  if (/سود|درآمد|گزارش|فروش|خرید/.test(t) && /(امروز|دیروز|ماه|سال|هفته)/.test(t)) {
    const range = /امروز/.test(t) ? 'today' : /دیروز/.test(t) ? 'yesterday' : /هفته/.test(t) ? 'week' : /ماه/.test(t) ? 'month' : 'today';
    return { intent: 'today_profit', params: { range }, raw };
  }
  if (/^سود|^گزارش/.test(t)) {
    return { intent: 'today_profit', params: { range: 'today' }, raw };
  }
  
  // ─── واریز/اضافه
  const isDeposit = /(اضافه|واریز|افزایش|بزن|جمع|دریافت|بستانکار)/.test(t);
  const isWithdraw = /(کم|برداشت|کسر|کاهش|خرج|پرداخت|بدهکار)/.test(t);
  
  // ─── صندوق با اسم+ارز
  if (/صندوق|کارتکش|کاردکس/.test(t) && (isDeposit || isWithdraw) && amount) {
    const name = extractName(t);
    if (name) {
      return { intent: isDeposit ? 'deposit' : 'withdraw', params: { name, currency, amount }, raw };
    }
  }
  
  // ─── واریز با اسم اول: «احمد ۵۰۰ اضافه»
  if (amount && (isDeposit || isWithdraw)) {
    const name = extractName(t);
    if (name) {
      return { intent: isDeposit ? 'deposit' : 'withdraw', params: { name, currency, amount }, raw };
    }
  }
  
  // ─── مانده
  if (/مانده|موجودی|حساب/.test(t) && !/صندوق/.test(t)) {
    const name = extractName(t);
    if (name) return { intent: 'balance', params: { name }, raw };
  }
  
  // ─── فاکتور
  if (/فاکتور|فاکتر|صورت/.test(t) && !/(بزن|بساز|جدید)/.test(t)) {
    const name = extractName(t);
    const num = t.match(/(\\d{3,})/)?.[1];
    return { intent: 'open_invoice', params: { name, invoiceId: num }, raw };
  }
  
  // ─── مشتری خاص
  if (/مشتری|طرف/.test(t)) {
    const name = extractName(t);
    if (name) return { intent: 'open_customer', params: { name }, raw };
  }
  
  // ─── صندوق با اسم
  if (/صندوق|کارتکش|کاردکس/.test(t)) {
    const name = extractName(t);
    if (name) return { intent: 'open_box', params: { name, currency }, raw };
  }
  
  // ─── اسم فقط → امتحان صندوق
  if (t.length >= 2 && !/\\d/.test(t)) {
    return { intent: 'open_box', params: { name: t, currency }, raw, };
  }
  
  return { intent: 'unknown', params: {}, raw };
}

// ═══════════════════════════════════════════
// پردازش چند دستور
// ═══════════════════════════════════════════
export function parseMulti(text: string): Command[] {
  const parts = norm(text)
    .split(/\\s+و\\s+|\\s*،\\s*|\\s*;\\s*|\\s+بعد\\s+|\\s+بعدش\\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 1);
  
  if (parts.length <= 1) return [parseCommand(text)];
  
  return parts.map(p => parseCommand(p));
}
`;

fs.writeFileSync('lib.local.nlu.ts', nlu, 'utf8');
console.log('✅ lib.local.nlu.ts ساخته شد');

// ═══════════════════════════════════════════
// ۲. lib.local.exec.ts — مجری دستورات
// ═══════════════════════════════════════════
const exec = `// lib.local.exec.ts — اجرای دستورات روی داده‌های اپ
import { Command } from './lib.local.nlu';

export interface ExecResult {
  ok: boolean;
  message: string;
  panel?: any; // داده برای نمایش
}

// ─── Context حافظه
let _last: any = null;
export function setLastEntity(e: any) { _last = e; }
export function getLastEntity() { return _last; }
export function clearLastEntity() { _last = null; }

// ═══════════════════════════════════════════
// پیدا کردن صندوق
// ═══════════════════════════════════════════
async function findBox(name: string, currency?: string): Promise<any | null> {
  try {
    const { nameScore } = await import('./lib.local.nlu');
    const bx = await import('./lib.boxes');
    const boxes = await bx.getBoxes() || [];
    const bals = await bx.getAllBalances() || {};
    
    let best: any = null;
    let bestScore = 0;
    const cur = currency?.toUpperCase();
    
    for (const b of boxes) {
      // چک ارز
      if (cur && String(b.currency || '').toUpperCase() !== cur) continue;
      
      const s1 = nameScore(b.name || '', name);
      const s2 = nameScore(b.code || '', name);
      const s3 = nameScore(b.owner_name || '', name);
      const s = Math.max(s1, s2, s3);
      
      if (s > bestScore) {
        bestScore = s;
        best = { ...b, _balance: bals[b.id || b.local_id] || 0 };
      }
    }
    
    // اگه با ارز پیدا نشد، بدون ارز امتحان کن
    if (!best && cur) {
      for (const b of boxes) {
        const s = Math.max(
          nameScore(b.name || '', name),
          nameScore(b.code || '', name),
          nameScore(b.owner_name || '', name)
        );
        if (s > bestScore) { bestScore = s; best = { ...b, _balance: bals[b.id || b.local_id] || 0 }; }
      }
    }
    
    return bestScore >= 40 ? best : null;
  } catch (e) { console.log('findBox err:', e); return null; }
}

// ═══════════════════════════════════════════
// پیدا کردن مشتری
// ═══════════════════════════════════════════
async function findCustomer(name: string): Promise<any | null> {
  try {
    const { nameScore } = await import('./lib.local.nlu');
    const cc = await import('./lib.fx.cust');
    const custs = await cc.getAllCust() || [];
    
    let best: any = null;
    let bestScore = 0;
    
    for (const c of custs) {
      const s = Math.max(
        nameScore(c.name || '', name),
        nameScore(c.phone || '', name),
        nameScore(c.code || '', name)
      );
      if (s > bestScore) { bestScore = s; best = c; }
    }
    
    return bestScore >= 40 ? best : null;
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════
// اجرای دستور
// ═══════════════════════════════════════════
export async function execute(cmd: Command): Promise<ExecResult> {
  try {
    // ═══ راهنما
    if (cmd.intent === 'help') {
      return {
        ok: true,
        message: '🧠 من می‌تونم:\\n• «صندوق احمد» — باز کنم\\n• «صندوق دالر فروغی»\\n• «۵۰۰ به احمد اضافه کن»\\n• «۱۰۰ از فروغی کم کن»\\n• «مانده رضا»\\n• «سود امروز»\\n• «مشتری کریمی»\\n• «همه صندوق‌ها»',
      };
    }
    
    // ═══ لیست صندوق‌ها
    if (cmd.intent === 'list_boxes') {
      const bx = await import('./lib.boxes');
      const boxes = await bx.getBoxes() || [];
      const bals = await bx.getAllBalances() || {};
      if (!boxes.length) return { ok: true, message: '📦 صندوقی نیست' };
      
      const list = boxes.map((b: any) => {
        const bal = bals[b.id || b.local_id] || 0;
        return { kind: 'box', box: { ...b, _balance: bal } };
      });
      const msg = boxes.map((b: any) => {
        const bal = bals[b.id || b.local_id] || 0;
        return \`• \${b.name} (\${b.currency}): \${bal.toLocaleString('en-US')}\`;
      }).join('\\n');
      return { ok: true, message: '📦 صندوق‌ها:\\n' + msg, panel: { kind: 'list_boxes', list } };
    }
    
    // ═══ لیست مشتری‌ها
    if (cmd.intent === 'list_customers') {
      const cc = await import('./lib.fx.cust');
      const custs = await cc.getAllCust() || [];
      if (!custs.length) return { ok: true, message: '👥 مشتری نیست' };
      const list = custs.slice(0, 50).map((c: any) => ({ kind: 'customer', customer: c }));
      const msg = custs.slice(0, 20).map((c: any) => '• ' + c.name + (c.phone ? ' — ' + c.phone : '')).join('\\n');
      return { ok: true, message: \`👥 \${custs.length} مشتری:\\n\` + msg, panel: { kind: 'list_customers', list } };
    }
    
    // ═══ باز کردن صندوق
    if (cmd.intent === 'open_box') {
      const box = await findBox(cmd.params.name, cmd.params.currency);
      if (!box) return { ok: false, message: \`❌ صندوق «\${cmd.params.name}» پیدا نشد\` };
      
      const bx = await import('./lib.boxes');
      const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
      
      setLastEntity({ type: 'box', id: box.id || box.local_id, name: box.name, meta: box });
      
      return {
        ok: true,
        message: \`📦 \${box.name} — \${(box._balance || 0).toLocaleString('en-US')} \${box.currency}\`,
        panel: { kind: 'box', box, txs },
      };
    }
    
    // ═══ مانده مشتری
    if (cmd.intent === 'balance') {
      // اول صندوق؟
      const box = await findBox(cmd.params.name);
      if (box) {
        setLastEntity({ type: 'box', id: box.id || box.local_id, name: box.name, meta: box });
        const bx = await import('./lib.boxes');
        const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
        return {
          ok: true,
          message: \`📦 \${box.name}: \${(box._balance || 0).toLocaleString('en-US')} \${box.currency}\`,
          panel: { kind: 'box', box, txs },
        };
      }
      
      // بعد مشتری
      const cust = await findCustomer(cmd.params.name);
      if (!cust) return { ok: false, message: \`❌ «\${cmd.params.name}» پیدا نشد\` };
      
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
      const bals = raw ? JSON.parse(raw) : {};
      const bal = bals[cust.id || cust.local_id] || 0;
      const label = bal > 0 ? '🟢 طلبکار' : bal < 0 ? '🔴 بدهکار' : '⚪ تسویه';
      
      setLastEntity({ type: 'customer', id: cust.id || cust.local_id, name: cust.name, meta: cust });
      
      return {
        ok: true,
        message: \`👤 \${cust.name}: \${Math.abs(bal).toLocaleString('en-US')} — \${label}\`,
        panel: { kind: 'customer', customer: cust, balance: bal },
      };
    }
    
    // ═══ واریز/برداشت صندوق
    if (cmd.intent === 'deposit' || cmd.intent === 'withdraw') {
      const box = await findBox(cmd.params.name, cmd.params.currency);
      if (!box) return { ok: false, message: \`❌ صندوق «\${cmd.params.name}» پیدا نشد\` };
      
      const amt = Number(cmd.params.amount) || 0;
      if (amt <= 0) return { ok: false, message: '❌ مبلغ معتبر نیست' };
      
      const bx = await import('./lib.boxes');
      await bx.addBoxTransaction({
        box_id: box.id || box.local_id,
        box_code: box.code,
        type: cmd.intent === 'deposit' ? 'deposit' : 'withdraw',
        amount: amt,
        currency: box.currency || 'AFN',
        description: (cmd.intent === 'deposit' ? 'واریز' : 'برداشت') + ' از دستیار',
        date: new Date().toISOString(),
      });
      
      // refresh
      const bals = await bx.getAllBalances() || {};
      const newBal = bals[box.id || box.local_id] || 0;
      const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
      
      setLastEntity({ type: 'box', id: box.id || box.local_id, name: box.name, meta: { ...box, _balance: newBal } });
      
      return {
        ok: true,
        message: \`✅ \${cmd.intent === 'deposit' ? 'واریز' : 'برداشت'} \${amt.toLocaleString('en-US')} \${box.currency}\\n💰 موجودی: \${newBal.toLocaleString('en-US')}\`,
        panel: { kind: 'box', box: { ...box, _balance: newBal }, txs },
      };
    }
    
    // ═══ سود امروز
    if (cmd.intent === 'today_profit') {
      try {
        const lib = await import('./lib');
        const sales = await lib.getSalesGrouped() || [];
        const purchases = await lib.getPurchasesGrouped() || [];
        
        const range = cmd.params.range || 'today';
        let since = Date.now() - 24 * 3600 * 1000;
        if (range === 'week') since = Date.now() - 7 * 24 * 3600 * 1000;
        else if (range === 'month') since = Date.now() - 30 * 24 * 3600 * 1000;
        else if (range === 'yesterday') {
          const now = new Date();
          since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
        }
        
        const filterFn = (x: any) => new Date(x.date || x.created_at || 0).getTime() >= since;
        const salesInRange = sales.filter(filterFn);
        const purchasesInRange = purchases.filter(filterFn);
        
        const totalSales = salesInRange.reduce((s: number, x: any) => s + (Number(x.total) || 0), 0);
        const totalPurch = purchasesInRange.reduce((s: number, x: any) => s + (Number(x.total) || 0), 0);
        const profit = totalSales - totalPurch;
        
        const rangeLabel = { today: 'امروز', yesterday: 'دیروز', week: 'این هفته', month: 'این ماه' }[range] || 'امروز';
        
        return {
          ok: true,
          message: \`📊 \${rangeLabel}:\\n• فروش: \${salesInRange.length} (\${totalSales.toLocaleString('en-US')})\\n• خرید: \${purchasesInRange.length} (\${totalPurch.toLocaleString('en-US')})\\n• سود: \${profit.toLocaleString('en-US')}\`,
          panel: { kind: 'stats', sales: salesInRange.length, purchases: purchasesInRange.length, totalSales, totalPurchases: totalPurch, profit, rangeLabel },
        };
      } catch (e: any) {
        return { ok: false, message: '❌ خطا: ' + (e?.message || '') };
      }
    }
    
    // ═══ فاکتور
    if (cmd.intent === 'open_invoice') {
      try {
        const lib = await import('./lib');
        const sales = await lib.getSalesGrouped() || [];
        
        let found: any = null;
        if (cmd.params.invoiceId) {
          found = sales.find((s: any) => String(s.invoice || '').includes(cmd.params.invoiceId));
        } else if (cmd.params.name) {
          const { nameScore } = await import('./lib.local.nlu');
          let bestScore = 0;
          for (const s of sales) {
            const sc = nameScore(s.name || '', cmd.params.name);
            if (sc > bestScore) { bestScore = sc; found = s; }
          }
          if (bestScore < 40) found = null;
        }
        
        if (!found) return { ok: false, message: '❌ فاکتور پیدا نشد' };
        
        return {
          ok: true,
          message: \`📄 فاکتور \${found.invoice} — \${found.name}\`,
          panel: { kind: 'invoice', invoice: found },
        };
      } catch { return { ok: false, message: '❌ خطا' }; }
    }
    
    // ═══ مشتری
    if (cmd.intent === 'open_customer') {
      const cust = await findCustomer(cmd.params.name);
      if (!cust) return { ok: false, message: \`❌ «\${cmd.params.name}» پیدا نشد\` };
      
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
      const bals = raw ? JSON.parse(raw) : {};
      const bal = bals[cust.id || cust.local_id] || 0;
      
      setLastEntity({ type: 'customer', id: cust.id || cust.local_id, name: cust.name, meta: cust });
      
      return {
        ok: true,
        message: \`👤 \${cust.name}\${cust.phone ? ' — ' + cust.phone : ''}\\n💰 مانده: \${Math.abs(bal).toLocaleString('en-US')}\`,
        panel: { kind: 'customer', customer: cust, balance: bal },
      };
    }
    
    return { ok: false, message: '🤔 نفهمیدم. بگو «راهنما»' };
  } catch (e: any) {
    return { ok: false, message: '❌ ' + (e?.message || 'خطا') };
  }
}
`;

fs.writeFileSync('lib.local.exec.ts', exec, 'utf8');
console.log('✅ lib.local.exec.ts ساخته شد');

// ═══════════════════════════════════════════
// ۳. LocalBotScreen.tsx
// ═══════════════════════════════════════════
const screen = `// LocalBotScreen.tsx — ربات محلی (آفلاین)
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, NativeModules, Platform, DeviceEventEmitter
} from 'react-native';
import { parseMulti, Command } from './lib.local.nlu';
import { execute, ExecResult, getLastEntity, clearLastEntity } from './lib.local.exec';

const { Speech } = NativeModules;
const voiceAvailable = !!(Speech && Platform.OS === 'android');

export default function LocalBotScreen({ showToast, onExit }: any) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [panel, setPanel] = useState<any>(null);
  const [voiceReply, setVoiceReply] = useState(true);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    if (!voiceAvailable) return;
    const subs = [
      DeviceEventEmitter.addListener('onSpeechReady', () => setListening(true)),
      DeviceEventEmitter.addListener('onSpeechPartial', (m: any) => setPartial(m?.text || '')),
      DeviceEventEmitter.addListener('onSpeechResult', (m: any) => {
        setListening(false); setPartial('');
        const t = m?.text || '';
        if (t) { setText(t); setTimeout(() => run(t), 150); }
      }),
      DeviceEventEmitter.addListener('onSpeechError', (m: any) => {
        setListening(false); setPartial('');
        showToast?.('🎤 ' + (m?.message || ''), true);
      }),
    ];
    return () => { subs.forEach(s => s.remove()); };
  }, [showToast]);

  const startVoice = async () => {
    if (!voiceAvailable) { showToast?.('🎤 فقط اندروید', true); return; }
    try { setPartial(''); await Speech.startListening('fa-IR'); } catch {}
  };
  const stopVoice = async () => { try { await Speech.stopListening(); } catch {} setListening(false); };
  const speak = async (t: string) => { if (!voiceAvailable || !voiceReply) return; try { await Speech.speak(t, 'fa-IR'); } catch {} };

  const push = (role: 'user' | 'bot', text: string) => {
    setMessages(m => [...m, { role, text, ts: Date.now() }]);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 80);
  };

  const run = async (input?: string) => {
    const q = (input || text).trim();
    if (!q || loading) return;
    setText('');
    push('user', q);
    setLoading(true);

    try {
      const cmds = parseMulti(q);
      if (cmds.length === 0) {
        push('bot', '🤔 نفهمیدم');
        setLoading(false);
        return;
      }

      // اجرا همه
      let lastResult: ExecResult | null = null;
      for (const c of cmds) {
        const r = await execute(c);
        lastResult = r;
        if (r.message) push('bot', r.message);
        if (r.panel) setPanel(r.panel);
        if (!r.ok) break;
      }

      if (lastResult?.message) speak(lastResult.message);
    } catch (e: any) {
      push('bot', '❌ ' + (e?.message || 'خطا'));
    }
    setLoading(false);
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const examples = [
    'صندوق احمد',
    'صندوق دالر فروغی',
    '۵۰۰ به احمد اضافه کن',
    '۱۰۰ از فروغی کم کن',
    'مانده رضا',
    'سود امروز',
    'همه صندوق‌ها',
    'مشتری کریمی',
    'راهنما',
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.iconBtn}><Text style={s.iconTxt}>×</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🤖 ربات محلی</Text>
          <Text style={s.subtitle}>{voiceAvailable ? '📴 آفلاین • 🎤 صوتی فعال' : '📴 آفلاین • ⌨️ فقط متنی'}</Text>
        </View>
        <TouchableOpacity onPress={() => setVoiceReply(v => !v)} style={s.iconBtn}>
          <Text style={s.iconTxt}>{voiceReply ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        {messages.length === 0 && (
          <View>
            <View style={s.welcome}>
              <Text style={s.welcomeIcon}>🤖</Text>
              <Text style={s.welcomeTitle}>ربات محلی</Text>
              <Text style={s.welcomeSub}>کاملاً آفلاین — بدون اینترنت</Text>
            </View>

            <Text style={s.examplesTitle}>💡 نمونه دستورات:</Text>
            {examples.map((ex, i) => (
              <TouchableOpacity key={i} style={s.exBtn} onPress={() => { setText(ex); setTimeout(() => run(ex), 100); }}>
                <Text style={s.exTxt}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[s.msg, m.role === 'user' ? s.msgUser : s.msgBot]}>
            <Text style={s.msgTxt}>{m.text}</Text>
            <Text style={s.msgTime}>{fmtTime(m.ts)}</Text>
          </View>
        ))}

        {loading && (
          <View style={[s.msg, s.msgBot]}>
            <ActivityIndicator color="#10b981" />
          </View>
        )}

        {/* Panel */}
        {panel && (
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelTitle}>
                {panel.kind === 'box' ? '📦 صندوق'
                  : panel.kind === 'customer' ? '👤 مشتری'
                  : panel.kind === 'invoice' ? '📄 فاکتور'
                  : panel.kind === 'stats' ? '📊 گزارش'
                  : panel.kind === 'list_boxes' ? '📦 صندوق‌ها'
                  : panel.kind === 'list_customers' ? '👥 مشتریان'
                  : '📋'}
              </Text>
              <TouchableOpacity onPress={() => { setPanel(null); clearLastEntity(); }}>
                <Text style={{ color: '#dc2626', fontSize: 22, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>

            {panel.kind === 'box' && (
              <View>
                <Text style={s.pName}>{panel.box.name} — {panel.box.currency}</Text>
                <View style={s.balBox}>
                  <Text style={s.balLbl}>موجودی</Text>
                  <Text style={s.balNum}>{Math.abs(Number(panel.box._balance) || 0).toLocaleString('en-US')}</Text>
                </View>
                {panel.box.owner_name ? <Text style={s.pSub}>👤 صاحب: {panel.box.owner_name}</Text> : null}
                {panel.txs && panel.txs.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.pSec}>📋 تراکنش‌ها ({panel.txs.length}):</Text>
                    {panel.txs.slice(0, 15).map((t: any, i: number) => {
                      const isDep = t.type === 'deposit' || t.type === 'in' || t.type === 'transfer_in';
                      return (
                        <View key={i} style={s.txRow}>
                          <Text style={{ color: isDep ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: 13 }}>
                            {isDep ? '➕' : '➖'} {(Number(t.amount) || 0).toLocaleString('en-US')}
                          </Text>
                          <Text style={s.txDesc}>{t.description || ''}</Text>
                          <Text style={s.txDate}>{t.date ? new Date(t.date).toLocaleDateString('fa-IR') : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {panel.kind === 'customer' && (
              <View>
                <Text style={s.pName}>{panel.customer.name}</Text>
                {panel.customer.phone ? <Text style={s.pSub}>📞 {panel.customer.phone}</Text> : null}
                {panel.customer.bank ? <Text style={s.pSub}>🏦 {panel.customer.bank}</Text> : null}
                {panel.balance !== undefined && (
                  <View style={s.balBox}>
                    <Text style={s.balLbl}>مانده</Text>
                    <Text style={[s.balNum, { color: panel.balance >= 0 ? '#10b981' : '#ef4444' }]}>
                      {Math.abs(Number(panel.balance) || 0).toLocaleString('en-US')}
                    </Text>
                    <Text style={s.balSub}>
                      {panel.balance > 0 ? '🟢 طلبکار' : panel.balance < 0 ? '🔴 بدهکار' : '⚪ تسویه'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {panel.kind === 'invoice' && (
              <View>
                <Text style={s.pName}>فاکتور {panel.invoice.invoice}</Text>
                <Text style={s.pSub}>👤 {panel.invoice.name}</Text>
                <Text style={s.pSub}>📅 {panel.invoice.date ? new Date(panel.invoice.date).toLocaleDateString('fa-IR') : ''}</Text>
                <View style={s.balBox}>
                  <Text style={s.balLbl}>جمع کل</Text>
                  <Text style={s.balNum}>{(Number(panel.invoice.total) || 0).toLocaleString('en-US')}</Text>
                  <Text style={s.balSub}>پرداخت: {(Number(panel.invoice.paid) || 0).toLocaleString('en-US')}</Text>
                </View>
                {panel.invoice.items && panel.invoice.items.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.pSec}>اقلام:</Text>
                    {panel.invoice.items.slice(0, 8).map((it: any, i: number) => (
                      <Text key={i} style={s.pItem}>• {it.model_name || '—'} × {it.quantity} — {Number(it.price_unit || 0).toLocaleString('en-US')}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {panel.kind === 'stats' && (
              <View>
                <Text style={s.pSub}>📅 {panel.rangeLabel}</Text>
                <View style={s.statRow}><Text style={s.statLbl}>فروش</Text><Text style={s.statVal}>{panel.sales} ({panel.totalSales.toLocaleString('en-US')})</Text></View>
                <View style={s.statRow}><Text style={s.statLbl}>خرید</Text><Text style={s.statVal}>{panel.purchases} ({panel.totalPurchases.toLocaleString('en-US')})</Text></View>
                <View style={[s.statRow, { borderTopWidth: 1, borderTopColor: '#334155', marginTop: 6, paddingTop: 8 }]}>
                  <Text style={[s.statLbl, { fontWeight: 'bold', color: '#10b981' }]}>سود</Text>
                  <Text style={[s.statVal, { color: panel.profit >= 0 ? '#10b981' : '#ef4444', fontSize: 18 }]}>
                    {panel.profit.toLocaleString('en-US')}
                  </Text>
                </View>
              </View>
            )}

            {(panel.kind === 'list_boxes' || panel.kind === 'list_customers') && panel.list && (
              <View>
                {panel.list.slice(0, 30).map((r: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    style={s.listItem}
                    onPress={async () => {
                      if (r.kind === 'box') {
                        const bx = await import('./lib.boxes');
                        const txs = await bx.getBoxTransactions(r.box.id || r.box.local_id) || [];
                        setPanel({ kind: 'box', box: r.box, txs });
                      } else if (r.kind === 'customer') {
                        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                        const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
                        const bals = raw ? JSON.parse(raw) : {};
                        const bal = bals[r.customer.id || r.customer.local_id] || 0;
                        setPanel({ kind: 'customer', customer: r.customer, balance: bal });
                      }
                    }}
                  >
                    <Text style={s.listTxt}>
                      {r.kind === 'box' ? '📦 ' + r.box.name : '👤 ' + r.customer.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={s.bottomBar}>
        {listening && <View style={s.listen}><Text style={s.listenTxt}>🎤 {partial || 'گوش می‌دم...'}</Text></View>}
        <View style={s.inputRow}>
          <TextInput
            style={s.inp}
            value={text}
            onChangeText={setText}
            placeholder="مثلاً: صندوق احمد"
            placeholderTextColor="#64748b"
            onSubmitEditing={() => run()}
          />
          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => run()} disabled={loading || !text.trim()}>
            <Text style={s.btnTxt}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: listening ? '#dc2626' : '#0891b2' }]}
            onPress={listening ? stopVoice : startVoice}
            disabled={!voiceAvailable}
          >
            <Text style={s.btnTxt}>{listening ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  iconBtn: { padding: 8 }, iconTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  welcome: { alignItems: 'center', paddingVertical: 30 },
  welcomeIcon: { fontSize: 60 },
  welcomeTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  welcomeSub: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  examplesTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 10, marginBottom: 8 },
  exBtn: { backgroundColor: '#1a2332', padding: 12, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  exTxt: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  msg: { padding: 10, borderRadius: 10, marginTop: 8, maxWidth: '88%' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: '#7c3aed' },
  msgBot: { alignSelf: 'flex-start', backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#10b981' },
  msgTxt: { color: '#fff', fontSize: 14, lineHeight: 22, textAlign: 'right' },
  msgTime: { color: '#94a3b8', fontSize: 9, marginTop: 4, textAlign: 'left' },
  panel: { backgroundColor: '#0f2438', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 2, borderColor: '#10b981' },
  panelHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  panelTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pName: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  pSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'right' },
  pSec: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
  pItem: { color: '#cbd5e1', fontSize: 12, marginTop: 3, textAlign: 'right' },
  balBox: { backgroundColor: '#1a2332', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  balLbl: { color: '#94a3b8', fontSize: 11 },
  balNum: { color: '#10b981', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  balSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  txRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 4 },
  txDesc: { color: '#94a3b8', fontSize: 11, flex: 1, textAlign: 'right' },
  txDate: { color: '#64748b', fontSize: 10 },
  statRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  statLbl: { color: '#cbd5e1', fontSize: 13 },
  statVal: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  listItem: { backgroundColor: '#1a2332', padding: 10, borderRadius: 6, marginTop: 4 },
  listTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },
  bottomBar: { padding: 10, backgroundColor: '#0f2438', borderTopWidth: 1, borderTopColor: '#334155' },
  inputRow: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  inp: { flex: 1, backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, fontSize: 14, textAlign: 'right' },
  btn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  listen: { backgroundColor: '#7c3aed', padding: 8, borderRadius: 8, marginBottom: 6 },
  listenTxt: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
`;

fs.writeFileSync('LocalBotScreen.tsx', screen, 'utf8');
console.log('✅ LocalBotScreen.tsx ساخته شد');

// ═══════════════════════════════════════════
// ۴. اتصال به App.tsx
// ═══════════════════════════════════════════
let app = fs.readFileSync('App.tsx', 'utf8');
const orig = app;
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// حذف import های قدیمی
app = app.replace(/\nimport TrueAIScreen from '\.\/TrueAIScreen';?/g, '');
app = app.replace(/\nimport HybridAssistantScreen from '\.\/HybridAssistantScreen';?/g, '');
app = app.replace(/\nimport AIAssistantScreen from '\.\/AIAssistantScreen';?/g, '');
app = app.replace(/\nimport AssistantScreen from '\.\/AssistantScreen';?/g, '');

// حذف render های قدیمی
app = app.replace(/\n\s*\{tab === 'aiAssistant' && <TrueAIScreen[^>]+\/>\}/g, '');
app = app.replace(/\n\s*\{tab === 'aiAssistant' && <HybridAssistantScreen[^>]+\/>\}/g, '');
app = app.replace(/\n\s*\{tab === 'aiAssistant' && <AIAssistantScreen[^>]+\/>\}/g, '');
app = app.replace(/\n\s*\{tab === 'assistant' && <AssistantScreen[^>]+\/>\}/g, '');

// import جدید
if (!app.includes("from './LocalBotScreen'")) {
  const lines = app.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import LocalBotScreen from './LocalBotScreen';");
    app = lines.join('\n');
    console.log('✅ import');
  }
}

// tab
if (!app.includes("'aiAssistant'")) {
  const m = app.match(/(\{\s*key:\s*'publicMarket'[^}]*\},)/);
  if (m) {
    app = app.replace(m[0], m[0] + "\n    { key: 'aiAssistant', icon: '🤖', label: 'ربات', color: '#10b981' },");
    console.log('✅ tab');
  }
}

// hide tabs
if (app.includes("{tab !== 'exchange' && tab !== 'publicMarket'")) {
  app = app.replace(
    "{tab !== 'exchange' && tab !== 'publicMarket'",
    "{tab !== 'exchange' && tab !== 'publicMarket' && tab !== 'aiAssistant'"
  );
}

// render
const pat = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}";
if (app.includes(pat) && !app.includes('<LocalBotScreen')) {
  app = app.replace(pat, pat + "\n      {tab === 'aiAssistant' && <LocalBotScreen showToast={showToast} onExit={() => setTab('dashboard')} />}");
  console.log('✅ render');
}

if (crlf) app = app.replace(/\n/g, '\r\n');
if (app !== orig) fs.writeFileSync('App.tsx', app, 'utf8');

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');