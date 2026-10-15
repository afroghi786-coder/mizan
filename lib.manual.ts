// lib.manual.ts — دستیار هوشمند ورود دستی (آفلاین)
import AsyncStorage from 'expo-sqlite/kv-store';

const LEARNED_KEY = '@mizan_manual_learned_v1';
const HISTORY_KEY = '@mizan_manual_history_v1';

// ─── تایپ‌ها
export interface Person {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  type: 'customer' | 'supplier' | 'partner' | 'unknown';
  balance: number;
}

export interface ParsedResult {
  ok: boolean;
  confidence: number;   // 0-100
  amount?: number;
  currency?: string;
  type?: 'sale' | 'purchase' | 'exchange' | 'transfer' | 'adjust' | 'deposit' | 'withdraw';
  from?: Person;
  to?: Person;
  person?: Person;
  adjustment?: number;
  note?: string;
  raw: string;
  candidates?: Person[];
  warnings?: string[];
}

export interface LearnedPattern {
  id: string;
  regex: string;
  action: 'purchase' | 'sale' | 'transfer' | 'adjust' | 'exchange';
  description: string;
  examples: string[];
  createdAt: number;
  usageCount: number;
}

// ─── نرمال‌سازی اعداد فارسی/عربی
export function normDigits(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── تبدیل کلمات عددی فارسی به عدد
const NUM_WORDS: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15,
  'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20,
  'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
  'هشتاد': 80, 'نود': 90, 'صد': 100, 'دویست': 200, 'سیصد': 300,
  'چهارصد': 400, 'پانصد': 500, 'ششصد': 600, 'هفتصد': 700,
  'هشتصد': 800, 'نهصد': 900, 'هزار': 1000, 'میلیون': 1000000,
  'میلیارد': 1000000000,
};

export function wordsToNumber(text: string): number | null {
  const norm = normDigits(text);
  // اگه عدد رقمیه، همون رو برگردون
  const numMatch = norm.match(/\d+(?:\.\d+)?/);
  if (numMatch) return parseFloat(numMatch[0]);
  
  // کلمات عددی
  const tokens = norm.split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;
  
  for (const t of tokens) {
    if (NUM_WORDS[t] !== undefined) {
      found = true;
      const v = NUM_WORDS[t];
      if (v >= 1000) {
        current = (current || 1) * v;
        total += current;
        current = 0;
      } else {
        current += v;
      }
    }
  }
  if (current > 0) total += current;
  return found ? total : null;
}

// ─── ذخیره و بازیابی الگوهای یادگرفته
export async function getLearned(): Promise<LearnedPattern[]> {
  try {
    const raw = await AsyncStorage.getItem(LEARNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addLearned(p: LearnedPattern): Promise<void> {
  const list = await getLearned();
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  await AsyncStorage.setItem(LEARNED_KEY, JSON.stringify(list.slice(-100)));
}

export async function removeLearned(id: string): Promise<void> {
  const list = await getLearned();
  await AsyncStorage.setItem(LEARNED_KEY, JSON.stringify(list.filter(x => x.id !== id)));
}

export async function clearLearned(): Promise<void> {
  await AsyncStorage.removeItem(LEARNED_KEY);
}

// ─── تاریخچه
export interface HistoryItem {
  id: string;
  raw: string;
  parsed: ParsedResult;
  timestamp: number;
  saved: boolean;
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addHistory(h: HistoryItem): Promise<void> {
  const list = await getHistory();
  list.unshift(h);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
}

// ─── تطبیق نام (Fuzzy)
function findPerson(query: string, pool: any[]): { person?: any; candidates: any[]; score: number } {
  if (!query || !pool?.length) return { candidates: [], score: 0 };
  const q = normDigits(query).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return { candidates: [], score: 0 };
  
  const results: Array<{ p: any; score: number }> = [];
  
  for (const p of pool) {
    const name = String(p.name || '').toLowerCase();
    const code = String(p.code || p.local_id || '').toLowerCase();
    const phone = String(p.phone || '').toLowerCase();
    let score = 0;
    
    // تطبیق دقیق
    if (name === q) score = 100;
    else if (code === q) score = 95;
    else if (phone === q) score = 95;
    // شروع با
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 70;
    else if (code.includes(q)) score = 60;
    else if (phone.includes(q)) score = 60;
    // فازی (Levenshtein ساده)
    else {
      const dist = levenshtein(name, q);
      const ratio = 1 - dist / Math.max(name.length, q.length);
      if (ratio > 0.6) score = Math.round(ratio * 60);
    }
    
    if (score > 20) results.push({ p, score });
  }
  
  results.sort((a, b) => b.score - a.score);
  return {
    person: results[0]?.p,
    candidates: results.slice(0, 5).map(r => r.p),
    score: results[0]?.score || 0,
  };
}

function levenshtein(a: string, b: string): number {
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

// ─── استخراج مبلغ
function extractAmount(text: string): { amount: number | null; rest: string } {
  const norm = normDigits(text);
  
  // ۱. عدد + واحد (هزار، میلیون)
  const unitMatch = norm.match(/(\d+(?:\.\d+)?)\s*(هزار|میلیون|میلیارد|k|K|m|M)/);
  if (unitMatch) {
    let v = parseFloat(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase();
    if (unit === 'هزار' || unit === 'k') v *= 1000;
    else if (unit === 'میلیون' || unit === 'm') v *= 1000000;
    else if (unit === 'میلیارد') v *= 1000000000;
    const rest = norm.replace(unitMatch[0], '').trim();
    return { amount: v, rest };
  }
  
  // ۲. عدد ساده
  const numMatch = norm.match(/\d+(?:\.\d+)?/);
  if (numMatch) {
    const amount = parseFloat(numMatch[0]);
    const rest = norm.replace(numMatch[0], '').trim();
    return { amount, rest };
  }
  
  // ۳. کلمات عددی
  const wordsAmount = wordsToNumber(text);
  if (wordsAmount) {
    return { amount: wordsAmount, rest: norm };
  }
  
  return { amount: null, rest: norm };
}

// ─── تشخیص نوع صریح
function detectType(text: string): 'sale' | 'purchase' | 'exchange' | 'transfer' | 'adjust' | null {
  const t = text.toLowerCase();
  if (/خرید|بخرم|خریدم/.test(t)) return 'purchase';
  if (/فروش|بفروشم|فروختم/.test(t)) return 'sale';
  if (/صرافی|تبدیل|ارز|دالر|دلار/.test(t)) return 'exchange';
  if (/انتقال|بین/.test(t)) return 'transfer';
  if (/باقی|مانده|تسویه|حساب/.test(t)) return 'adjust';
  return null;
}

// ─── پارسر اصلی
export interface ParseContext {
  customers: any[];   // مشتریان (مشتری‌های ما)
  suppliers: any[];   // تامین‌کنندگان
  partners: any[];    // شرکا
}

export async function parseCommand(text: string, ctx: ParseContext): Promise<ParsedResult> {
  const warnings: string[] = [];
  const raw = text;
  const norm = normDigits(text);
  const t = norm.toLowerCase();
  
  if (!norm || norm.length < 2) {
    return { ok: false, confidence: 0, raw, warnings: ['متن خیلی کوتاه است'] };
  }
  
  // ۱. یادگرفته‌ها رو چک کن
  const learned = await getLearned();
  for (const lp of learned) {
    try {
      const re = new RegExp(lp.regex, 'i');
      const m = norm.match(re);
      if (m) {
        // آپدیت usage
        lp.usageCount = (lp.usageCount || 0) + 1;
        await addLearned(lp);
        // ادامه با پارسر عادی
        break;
      }
    } catch {}
  }
  
  // ۲. مبلغ
  const { amount } = extractAmount(norm);
  if (!amount) {
    return { ok: false, confidence: 0, raw, warnings: ['مبلغ پیدا نشد'] };
  }
  
  // ۳. انواع تراکنش بر اساس regex
  const patterns: Array<{
    name: string;
    regex: RegExp;
    handler: (m: RegExpMatchArray) => ParsedResult | null;
  }> = [
    // «از X [مبلغ] به Y» یا «از X به Y [مبلغ]»
    {
      name: 'transfer',
      regex: /از\s+([\u0600-\u06FF\w]+)\s+(?:مبلغ\s+)?(\d+(?:\.\d+)?)\s+به\s+([\u0600-\u06FF\w]+)/i,
      handler: (m) => {
        const fromName = m[1];
        const amt = parseFloat(m[2]);
        const toName = m[3];
        const fromRes = findPerson(fromName, [...ctx.customers, ...ctx.partners]);
        const toRes = findPerson(toName, [...ctx.suppliers, ...ctx.partners]);
        let conf = 30;
        if (fromRes.person) conf += 25;
        if (toRes.person) conf += 25;
        if (amt > 0) conf += 20;
        return {
          ok: !!(fromRes.person && toRes.person),
          confidence: conf,
          amount: amt,
          type: 'transfer',
          from: fromRes.person,
          to: toRes.person,
          candidates: [...fromRes.candidates, ...toRes.candidates],
          raw,
          warnings: [
            ...(fromRes.person ? [] : ['فرستنده پیدا نشد']),
            ...(toRes.person ? [] : ['گیرنده پیدا نشد']),
          ],
        };
      },
    },
    // «[مبلغ] به X»
    {
      name: 'purchase',
      regex: /(?:مبلغ\s+)?(\d+(?:\.\d+)?)\s+به\s+([\u0600-\u06FF\w]+)/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const toName = m[2];
        const toRes = findPerson(toName, [...ctx.suppliers, ...ctx.partners, ...ctx.customers]);
        const type = detectType(norm) || 'purchase';
        let conf = 40;
        if (toRes.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!toRes.person,
          confidence: conf,
          amount: amt,
          type: type as any,
          to: toRes.person,
          candidates: toRes.candidates,
          raw,
          warnings: toRes.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «[مبلغ] از X»
    {
      name: 'sale',
      regex: /(?:مبلغ\s+)?(\d+(?:\.\d+)?)\s+از\s+([\u0600-\u06FF\w]+)/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const fromName = m[2];
        const fromRes = findPerson(fromName, [...ctx.customers, ...ctx.partners, ...ctx.suppliers]);
        const type = detectType(norm) || 'sale';
        let conf = 40;
        if (fromRes.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!fromRes.person,
          confidence: conf,
          amount: amt,
          type: type as any,
          from: fromRes.person,
          candidates: fromRes.candidates,
          raw,
          warnings: fromRes.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X [مبلغ] باقی» یا «X [مبلغ] مانده»
    {
      name: 'adjust',
      regex: /([\u0600-\u06FF\w]+)\s+(?:مبلغ\s+)?(\d+(?:\.\d+)?)\s+(?:باقی|مانده)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.customers, ...ctx.suppliers, ...ctx.partners]);
        let conf = 40;
        if (res.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: amt,
          type: 'adjust',
          person: res.person,
          adjustment: amt,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X [+/-][مبلغ]»
    {
      name: 'adjust2',
      regex: /([\u0600-\u06FF\w]+)\s+([+-]\d+(?:\.\d+)?)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.customers, ...ctx.suppliers, ...ctx.partners]);
        let conf = 40;
        if (res.person) conf += 40;
        if (!isNaN(amt)) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: Math.abs(amt),
          type: 'adjust',
          person: res.person,
          adjustment: amt,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },

    // «X تسویه» یا «تسویه X»
    {
      name: 'settle',
      regex: /(?:تسویه\s+([\u0600-\u06FF\w]+)|([\u0600-\u06FF\w]+)\s+تسویه)/i,
      handler: (m) => {
        const name = m[1] || m[2];
        const res = findPerson(name, [...ctx.customers, ...ctx.suppliers, ...ctx.partners]);
        const curBal = 0; // مانده محاسبه می‌شود در UI
        return {
          ok: !!res.person,
          confidence: res.person ? 75 : 20,
          amount: 0,
          type: 'adjust',
          person: res.person,
          adjustment: -curBal,
          candidates: res.candidates,
          raw,
          warnings: res.person ? ['مانده صفر می‌شود'] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X ۵۰۰۰ دادن» یا «X ۵۰۰۰ داد»
    {
      name: 'gave',
      regex: /([\u0600-\u06FF\w]+)\s+(?:مبلغ\s+)?(\d+(?:\.\d+)?)\s+(?:دادن|داد|پرداخت)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.suppliers, ...ctx.partners, ...ctx.customers]);
        let conf = 40;
        if (res.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: amt,
          type: 'purchase',
          to: res.person,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X ۵۰۰۰ گرفت»
    {
      name: 'received',
      regex: /([\u0600-\u06FF\w]+)\s+(?:مبلغ\s+)?(\d+(?:\.\d+)?)\s+(?:گرفت|دریافت|دریافت کرد)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.customers, ...ctx.partners, ...ctx.suppliers]);
        let conf = 40;
        if (res.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: amt,
          type: 'sale',
          from: res.person,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «۵۰۰۰ برای احمد از محمود»
    {
      name: 'for_from',
      regex: /(\d+(?:\.\d+)?)\s+برای\s+([\u0600-\u06FF\w]+)\s+از\s+([\u0600-\u06FF\w]+)/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const toName = m[2];
        const fromName = m[3];
        const toRes = findPerson(toName, [...ctx.suppliers, ...ctx.partners]);
        const fromRes = findPerson(fromName, [...ctx.customers, ...ctx.partners]);
        let conf = 30;
        if (fromRes.person) conf += 25;
        if (toRes.person) conf += 25;
        if (amt > 0) conf += 20;
        return {
          ok: !!(fromRes.person && toRes.person),
          confidence: conf,
          amount: amt,
          type: 'transfer',
          from: fromRes.person,
          to: toRes.person,
          candidates: [...fromRes.candidates, ...toRes.candidates],
          raw,
          warnings: [
            ...(fromRes.person ? [] : ['فرستنده پیدا نشد']),
            ...(toRes.person ? [] : ['گیرنده پیدا نشد']),
          ],
        };
      },
    },
    // صرافی: «۱۰۰۰ دالر به افغانی ۷۰»
    {
      name: 'exchange',
      regex: /(\d+(?:\.\d+)?)\s+(دالر|دلار|یورو|تومان|افغانی|ریال|روپیه|USD|EUR|AFN|IRR|PKR)\s+به\s+(افغانی|تومان|ریال|دالر|دلار|یورو|AFN|IRR|USD|EUR)\s+(\d+(?:\.\d+)?)?/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const fromCur = m[2];
        const toCur = m[3];
        const rate = m[4] ? parseFloat(m[4]) : null;
        return {
          ok: true,
          confidence: 85,
          amount: amt,
          currency: fromCur,
          type: 'exchange',
          note: fromCur + ' → ' + toCur + (rate ? ' @ ' + rate : ''),
          raw,
          warnings: rate ? [] : ['نرخ مشخص نشد'],
        };
      },
    },

    // «به X [مبلغ]» یا «به X -[مبلغ]»
    {
      name: 'payWithSign',
      regex: /به\s+([\u0600-\u06FF\w]+)\s+(-?\d+(?:\.\d+)?)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.suppliers, ...ctx.partners, ...ctx.customers]);
        let conf = 40;
        if (res.person) conf += 40;
        if (!isNaN(amt)) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: Math.abs(amt),
          type: 'adjust',
          person: res.person,
          adjustment: amt,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
  ];
  
  // اجرای الگوها
  for (const p of patterns) {
    const m = norm.match(p.regex);
    if (m) {
      const r = p.handler(m);
      if (r) {
        r.raw = raw;
        return r;
      }
    }
  }
  
  // ۴. اگه هیچی مطابقت نکرد
  return {
    ok: false,
    confidence: 5,
    amount,
    raw,
    warnings: [
      'نمی‌توانم الگو را تشخیص دهم',
      'نمونه‌ها: «۵۰۰۰ به احمد» یا «از محمود ۵۰۰۰ به احمد»',
    ],
  };
}

// ─── ذخیره نتیجه
export interface SaveResult {
  ok: boolean;
  message: string;
  invoiceCode?: string;
}

export async function saveManual(r: ParsedResult, deps: {
  createSale: (p: any) => Promise<any>;
  createPurchase: (p: any) => Promise<any>;
  createHawala: (p: any) => Promise<any>;
  updateBalance: (personId: string, delta: number) => Promise<void>;
}): Promise<SaveResult> {
  try {
    const now = new Date();
    const dateStr = now.toISOString();
    
    if (r.type === 'transfer' && r.from && r.to && r.amount) {
      // فروش از مشتری
      await deps.createSale({
        customer_id: r.from.id,
        customer_name: r.from.name,
        amount: r.amount,
        type: 'transfer',
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + Date.now(),
      });
      // خرید از تامین‌کننده
      await deps.createPurchase({
        supplier_id: r.to.id,
        supplier_name: r.to.name,
        amount: r.amount,
        type: 'transfer',
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + (Date.now() + 1),
      });
      await deps.updateBalance(r.from.id, +r.amount);
      await deps.updateBalance(r.to.id, -r.amount);
      return { ok: true, message: '✅ انتقال ثبت شد (فروش + خرید)', invoiceCode: 'TR-' + Date.now().toString(36).toUpperCase() };
    }
    
    if (r.type === 'purchase' && r.to && r.amount) {
      await deps.createPurchase({
        supplier_id: r.to.id,
        supplier_name: r.to.name,
        amount: r.amount,
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + Date.now(),
      });
      await deps.updateBalance(r.to.id, -r.amount);
      return { ok: true, message: '✅ خرید ثبت شد', invoiceCode: 'P-' + Date.now().toString(36).toUpperCase() };
    }
    
    if (r.type === 'sale' && r.from && r.amount) {
      await deps.createSale({
        customer_id: r.from.id,
        customer_name: r.from.name,
        amount: r.amount,
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + Date.now(),
      });
      await deps.updateBalance(r.from.id, +r.amount);
      return { ok: true, message: '✅ فروش ثبت شد', invoiceCode: 'S-' + Date.now().toString(36).toUpperCase() };
    }
    
    if (r.type === 'adjust' && r.person && r.adjustment !== undefined) {
      await deps.updateBalance(r.person.id, r.adjustment);
      return { ok: true, message: '✅ مانده تنظیم شد' };
    }
    
    return { ok: false, message: '❌ نوع تراکنش پشتیبانی نمی‌شود' };
  } catch (e: any) {
    return { ok: false, message: '❌ ' + (e?.message || 'خطا') };
  }
}

// ─── آمار یادگیری
export async function getLearningStats(): Promise<{ learned: number; history: number }> {
  const [l, h] = await Promise.all([getLearned(), getHistory()]);
  return { learned: l.length, history: h.length };
}


// ─── تنظیمات پارسر
const SETTINGS_KEY = '@mizan_manual_settings_v1';

export interface ManualSettings {
  autoConfirm: boolean;        // تأیید خودکار
  autoConfirmThreshold: number; // حداقل اطمینان (0-100)
  showConfidence: boolean;
  enableSounds: boolean;
  defaultCurrency: string;
}

export const DEFAULT_SETTINGS: ManualSettings = {
  autoConfirm: false,
  autoConfirmThreshold: 95,
  showConfidence: true,
  enableSounds: true,
  defaultCurrency: 'AFN',
};

export async function getManualSettings(): Promise<ManualSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export async function saveManualSettings(s: ManualSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── Undo/Redo
const UNDO_KEY = '@mizan_manual_undo_v1';

export interface UndoEntry {
  id: string;
  action: any;
  timestamp: number;
  undone: boolean;
}

export async function pushUndo(action: any): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_KEY);
    const list: UndoEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: 'u_' + Date.now(),
      action,
      timestamp: Date.now(),
      undone: false,
    });
    await AsyncStorage.setItem(UNDO_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export async function getLastUndo(): Promise<UndoEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_KEY);
    const list: UndoEntry[] = raw ? JSON.parse(raw) : [];
    return list.find(x => !x.undone) || null;
  } catch { return null; }
}

export async function markUndone(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_KEY);
    const list: UndoEntry[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx].undone = true;
    await AsyncStorage.setItem(UNDO_KEY, JSON.stringify(list));
  } catch {}
}

// ─── Shortcuts
const SHORTCUTS_KEY = '@mizan_manual_shortcuts_v1';

export interface Shortcut {
  id: string;
  label: string;
  text: string;
  icon: string;
  usageCount: number;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'sc1', label: 'تسویه', text: 'تسویه ', icon: '✅', usageCount: 0 },
  { id: 'sc2', label: 'پرداخت به', text: 'به ', icon: '💸', usageCount: 0 },
  { id: 'sc3', label: 'دریافت از', text: 'از ', icon: '💰', usageCount: 0 },
  { id: 'sc4', label: 'انتقال', text: 'از  به ', icon: '🔄', usageCount: 0 },
];

export async function getShortcuts(): Promise<Shortcut[]> {
  try {
    const raw = await AsyncStorage.getItem(SHORTCUTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SHORTCUTS;
  } catch { return DEFAULT_SHORTCUTS; }
}

export async function saveShortcuts(list: Shortcut[]): Promise<void> {
  await AsyncStorage.setItem(SHORTCUTS_KEY, JSON.stringify(list));
}

export async function bumpShortcut(id: string): Promise<void> {
  const list = await getShortcuts();
  const s = list.find(x => x.id === id);
  if (s) s.usageCount = (s.usageCount || 0) + 1;
  await saveShortcuts(list);
}

// ─── Excel Export
export async function exportToExcel(rows: any[]): Promise<string> {
  const header = 'تاریخ,مبلغ,نوع,طرف,توضیحات\n';
  const body = rows.map(r => {
    const d = new Date(r.timestamp || Date.now()).toLocaleString('fa-IR');
    const amt = r.parsed?.amount || 0;
    const type = r.parsed?.type || '—';
    const person = r.parsed?.from?.name || r.parsed?.to?.name || r.parsed?.person?.name || '—';
    const raw = (r.raw || '').replace(/,/g, '،');
    return `"${d}","${amt}","${type}","${person}","${raw}"`;
  }).join('\n');
  return '\uFEFF' + header + body; // BOM برای Excel فارسی
}


// ═══════════════════════════════════════════
// پارسر صرافی پیشرفته
// ═══════════════════════════════════════════

export interface ExchangeCmd {
  ok: boolean;
  side: 'buy' | 'sell';
  currency: string;
  amount: number;
  rate?: number;
  total?: number;
  peer?: any;
  confidence: number;
  raw: string;
  warnings: string[];
}

const CUR_MAP: Record<string, string> = {
  'دالر': 'USD', 'دلار': 'USD', 'دالار': 'USD', 'usd': 'USD', 'دولار': 'USD',
  'یورو': 'EUR', 'eur': 'EUR', 'یورو': 'EUR',
  'افغانی': 'AFN', 'افغانی': 'AFN', 'afn': 'AFN',
  'تومان': 'IRT', 'تومن': 'IRT', 'تومان': 'IRT',
  'ریال': 'IRR', 'irr': 'IRR',
  'روپیه': 'PKR', 'پاکستانی': 'PKR', 'pkr': 'PKR',
  'درهم': 'AED', 'aed': 'AED',
  'تومان': 'IRT',
  'لیر': 'TRY', 'لیره': 'TRY', 'try': 'TRY',
};

function detectCurrency(text: string): string | null {
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(CUR_MAP)) {
    if (t.includes(k)) return v;
  }
  return null;
}

export function parseExchangeCommand(text: string, ctx: any): ExchangeCmd {
  const raw = text;
  const norm = normDigits(text).toLowerCase();
  const warnings: string[] = [];
  
  // تشخیص نوع: خرید یا فروش
  let side: 'buy' | 'sell' | null = null;
  if (/خرید|خریدم|میخرم|گرفتم|دریافت/.test(norm)) side = 'buy';
  else if (/فروش|فروختم|میفروشم|دادم|تحویل/.test(norm)) side = 'sell';
  
  // تشخیص ارز
  const currency = detectCurrency(norm);
  
  // استخراج اعداد
  const allNums = (norm.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  
  let amount: number | undefined;
  let rate: number | undefined;
  
  // کلمات + عدد
  const wordMatch = norm.match(/(پنج|ده|بیست|پنجاه|صد|هزار|میلیون|میلیارد)[\s\d]*/);
  if (wordMatch) {
    const w = wordsToNumber(wordMatch[0]);
    if (w) amount = w;
  }
  
  if (allNums.length >= 2) {
    // بزرگتر = مقدار، کوچکتر = نرخ (معمولاً)
    const sorted = [...allNums].sort((a, b) => b - a);
    // اگه یکی خیلی بزرگتره
    if (sorted[0] / sorted[1] > 10) {
      amount = sorted[0] / sorted[1];
      rate = sorted[1];
    } else {
      amount = sorted[0];
      rate = sorted[1];
    }
  } else if (allNums.length === 1) {
    amount = allNums[0];
  }
  
  // اگه amount از کلمه آمد، اولین عدد رو rate بگیر
  if (amount && !rate && allNums.length >= 1) {
    rate = allNums[0];
  }
  
  // تشخیص طرف معامله
  let peer: any;
  const peerMatch = norm.match(/(?:از|به|با)\s+([\u0600-\u06FF\w]+)/);
  if (peerMatch) {
    const findRes = findPerson(peerMatch[1], [
      ...(ctx.customers || []),
      ...(ctx.suppliers || []),
      ...(ctx.partners || []),
    ]);
    peer = findRes.person;
    if (!peer) warnings.push('طرف پیدا نشد: ' + peerMatch[1]);
  }
  
  if (!side) warnings.push('نوع معامله مشخص نیست (خرید/فروش)');
  if (!currency) warnings.push('ارز مشخص نیست');
  if (!amount) warnings.push('مقدار مشخص نیست');
  
  const total = amount && rate ? amount * rate : undefined;
  let confidence = 0;
  if (side) confidence += 25;
  if (currency) confidence += 20;
  if (amount) confidence += 25;
  if (rate) confidence += 15;
  if (peer) confidence += 15;
  
  return {
    ok: confidence >= 60,
    side: side || 'buy',
    currency: currency || 'USD',
    amount: amount || 0,
    rate,
    total,
    peer,
    confidence,
    raw,
    warnings,
  };
}

// ═══════════════════════════════════════════
// Query Engine — سؤال و جواب حسابداری
// ═══════════════════════════════════════════

export interface QueryResult {
  ok: boolean;
  kind: 'balance' | 'fund' | 'rate' | 'profit' | 'list' | 'today' | 'unknown';
  answer: string;
  data?: any;
  raw: string;
}

export function parseQuery(text: string): { kind: string; target?: string } {
  const t = normDigits(text).toLowerCase();
  
  if (/مانده|چقدر.*بدهکار|چقدر.*طلبکار/.test(t)) {
    return { kind: 'balance' };
  }
  if (/صندوق|دالر.*چند|افغانی.*چند/.test(t)) {
    return { kind: 'fund' };
  }
  if (/نرخ|قیمت/.test(t)) {
    return { kind: 'rate' };
  }
  if (/سود|درآمد/.test(t)) {
    return { kind: 'profit' };
  }
  if (/کی|کدوم|لیست/.test(t) && /طلبکار|بدهکار/.test(t)) {
    return { kind: 'list' };
  }
  if (/گزارش|امروز|خلاصه/.test(t)) {
    return { kind: 'today' };
  }
  
  // تلاش برای پیدا کردن نام
  const nameMatch = t.match(/([\u0600-\u06FF]{3,})/);
  return { kind: 'balance', target: nameMatch ? nameMatch[1] : undefined };
}

export async function answerQuery(
  text: string,
  ctx: any,
  deps: {
    getBalance: (personId: string) => number;
    getBoxes: () => Promise<any[]>;
    getRates: () => Promise<any[]>;
    getTodayStats: () => Promise<any>;
  }
): Promise<QueryResult> {
  const raw = text;
  const q = parseQuery(text);
  
  if (q.kind === 'balance') {
    const nameMatch = normDigits(text).match(/([\u0600-\u06FF]{2,})/g);
    if (!nameMatch) return { ok: false, kind: 'balance', answer: 'اسم طرف را بگو', raw };
    
    // جستجو بین همه نام‌ها
    for (const n of nameMatch) {
      if (/مانده|چقدر|چقد|بدهکار|طلبکار|حساب/.test(n)) continue;
      const res = findPerson(n, [
        ...(ctx.customers || []),
        ...(ctx.suppliers || []),
        ...(ctx.partners || []),
      ]);
      if (res.person) {
        const bal = deps.getBalance(res.person.id);
        const label = bal > 0 ? 'طلبکار' : bal < 0 ? 'بدهکار' : 'تسویه';
        return {
          ok: true,
          kind: 'balance',
          answer: `${res.person.name}: ${Math.abs(bal).toLocaleString('en-US')} — ${label}`,
          data: { person: res.person, balance: bal },
          raw,
        };
      }
    }
    return { ok: false, kind: 'balance', answer: 'طرف پیدا نشد', raw };
  }
  
  if (q.kind === 'fund') {
    const boxes = await deps.getBoxes();
    if (!boxes || !boxes.length) return { ok: true, kind: 'fund', answer: 'صندوقی وجود ندارد', raw };
    const lines = boxes.map(b => `• ${b.name || b.code}: ${Number(b.balance || 0).toLocaleString('en-US')} ${b.currency || ''}`);
    return {
      ok: true,
      kind: 'fund',
      answer: 'صندوق‌ها:\n' + lines.join('\n'),
      data: boxes,
      raw,
    };
  }
  
  if (q.kind === 'rate') {
    const rates = await deps.getRates();
    if (!rates || !rates.length) return { ok: true, kind: 'rate', answer: 'نرخی ثبت نشده', raw };
    const lines = rates.slice(0, 8).map(r => `• ${r.currency}: ${r.rate}`);
    return {
      ok: true,
      kind: 'rate',
      answer: 'نرخ‌ها:\n' + lines.join('\n'),
      data: rates,
      raw,
    };
  }
  
  if (q.kind === 'profit' || q.kind === 'today') {
    const stats = await deps.getTodayStats();
    return {
      ok: true,
      kind: q.kind as any,
      answer: `📊 امروز: ${stats?.count || 0} معامله — سود ${Number(stats?.profit || 0).toLocaleString('en-US')}`,
      data: stats,
      raw,
    };
  }
  
  return { ok: false, kind: 'unknown', answer: 'نفهمیدم. مثلاً بپرس: «مانده احمد چقدره؟»', raw };
}

// ═══════════════════════════════════════════
// Dialogue — گفتگوی چند مرحله‌ای
// ═══════════════════════════════════════════

export interface DialogueStep {
  question: string;
  field: string;
  validate?: (v: string) => boolean;
  parse?: (v: string) => any;
}

export interface DialogueState {
  active: boolean;
  intent: 'buy' | 'sell' | 'hawala' | 'check' | 'adjust' | null;
  step: number;
  data: any;
  steps: DialogueStep[];
}

export function startDialogue(intent: string): DialogueState {
  if (intent === 'buy' || intent === 'sell') {
    return {
      active: true,
      intent: intent as any,
      step: 0,
      data: {},
      steps: [
        { question: 'چه ارزی؟ (دالر/یورو/افغانی/...)', field: 'currency', parse: (v) => detectCurrency(v) || v },
        { question: 'چقدر؟', field: 'amount', parse: (v) => wordsToNumber(v) || parseFloat(normDigits(v)) },
        { question: 'نرخ؟', field: 'rate', parse: (v) => parseFloat(normDigits(v)) },
        { question: 'از/به کی؟', field: 'peer' },
      ],
    };
  }
  return { active: false, intent: null, step: 0, data: {}, steps: [] };
}

export function processDialogueAnswer(state: DialogueState, answer: string): { state: DialogueState; done: boolean; summary?: string } {
  if (!state.active || state.step >= state.steps.length) {
    return { state, done: true, summary: buildSummary(state) };
  }
  const step = state.steps[state.step];
  const parsed = step.parse ? step.parse(answer) : answer;
  state.data[step.field] = parsed;
  state.step++;
  if (state.step >= state.steps.length) {
    return { state, done: true, summary: buildSummary(state) };
  }
  return { state, done: false };
}

function buildSummary(state: DialogueState): string {
  const d = state.data;
  const action = state.intent === 'buy' ? 'خرید' : 'فروش';
  const lines = [`${action} ${d.amount || '?'} ${d.currency || '?'}`];
  if (d.rate) lines.push(`نرخ: ${d.rate}`);
  if (d.peer) lines.push(`طرف: ${d.peer}`);
  if (d.amount && d.rate) lines.push(`معادل: ${(d.amount * d.rate).toLocaleString('en-US')}`);
  return lines.join(' | ');
}
