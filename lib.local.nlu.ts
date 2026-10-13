// lib.local.nlu.ts — فهم زبان محلی (بدون AI ابری)
export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يىئ]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/\s+/g, ' ')
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
  const m = t.match(/(\d+(?:\.\d+)?)\s*(هزار|میلیون|میلیارد|k|K|m|M)?/);
  if (m) {
    let v = parseFloat(m[1]);
    const u = m[2];
    if (u === 'هزار' || u === 'k' || u === 'K') v *= 1000;
    else if (u === 'میلیون' || u === 'm' || u === 'M') v *= 1000000;
    else if (u === 'میلیارد') v *= 1000000000;
    return v;
  }
  
  // کلمات عددی
  const words = t.split(/\s+/);
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
    t = t.replace(new RegExp('\\b' + sw + '\\b', 'g'), ' ');
  }
  
  return t.replace(/[^\u0600-\u06FF\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
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
  if (/(?:همه|تمام|کل|لیست)\s*(?:ی)?\s*صندوق/.test(t)) {
    return { intent: 'list_boxes', params: {}, raw };
  }
  
  // ─── همه مشتری‌ها
  if (/(?:همه|تمام|کل|لیست)\s*(?:ی)?\s*(?:مشتری|مشتریان)/.test(t)) {
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
    const num = t.match(/(\d{3,})/)?.[1];
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
  if (t.length >= 2 && !/\d/.test(t)) {
    return { intent: 'open_box', params: { name: t, currency }, raw, };
  }
  
  return { intent: 'unknown', params: {}, raw };
}

// ═══════════════════════════════════════════
// پردازش چند دستور
// ═══════════════════════════════════════════
export function parseMulti(text: string): Command[] {
  const parts = norm(text)
    .split(/\s+و\s+|\s*،\s*|\s*;\s*|\s+بعد\s+|\s+بعدش\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 1);
  
  if (parts.length <= 1) return [parseCommand(text)];
  
  return parts.map(p => parseCommand(p));
}
