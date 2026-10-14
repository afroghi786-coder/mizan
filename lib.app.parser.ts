// lib.app.parser.ts — پارسر عمیق
// تشخیص فعل + موضوع + شخص + قصد

import { findAction, findTab, findSubTab, findForm, ACTIONS } from './lib.app.schema';
import { getActivity, AppEvent } from './lib.app.events';

// ═══════════════════════════════════════════
// نرمال‌سازی
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// تشخیص ارز
// ═══════════════════════════════════════════
const CURRENCIES: Record<string, string> = {
  'دالر': 'USD', 'دلار': 'USD', 'دولار': 'USD', 'usd': 'USD',
  'یورو': 'EUR', 'eur': 'EUR',
  'افغانی': 'AFN', 'افغان': 'AFN', 'afn': 'AFN',
  'تومان': 'IRT', 'تومن': 'IRT', 'irt': 'IRT',
  'ریال': 'IRR', 'irr': 'IRR',
  'روپیه': 'PKR', 'پاکستانی': 'PKR', 'pkr': 'PKR',
  'درهم': 'AED', 'aed': 'AED',
  'لیر': 'TRY', 'لیره': 'TRY',
  'پوند': 'GBP', 'gbp': 'GBP',
};

export function detectCurrency(text: string): string | undefined {
  const t = lower(text);
  for (const [k, v] of Object.entries(CURRENCIES)) {
    if (t.includes(k)) return v;
  }
  return undefined;
}

// ═══════════════════════════════════════════
// تشخیص مبلغ
// ═══════════════════════════════════════════
const WORD_NUMS: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'پانزده': 15, 'بیست': 20,
  'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60,
  'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'صد': 100, 'دویست': 200, 'سیصد': 300,
  'چهارصد': 400, 'پونصد': 500, 'پانصد': 500,
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
    if (w === 'هزار' && found) sum *= 1000;
    else if (w === 'میلیون' && found) sum *= 1000000;
  }
  return found ? sum : null;
}

// ═══════════════════════════════════════════
// استخراج اسم شخص (بدون کلمات کلیدی)
// ═══════════════════════════════════════════
const STOP_WORDS = [
  'صندوق', 'کارتکس', 'کاردکس', 'کارت', 'مشتری', 'طرف', 'حساب',
  'فاکتور', 'فاکتر', 'صورت', 'حواله', 'چک', 'گروه', 'شریک',
  'را', 'رو', 'بیار', 'بیاور', 'بگیر', 'بده', 'بزن', 'بساز',
  'باز', 'کن', 'بگرد', 'پیدا', 'نشون', 'نشان', 'ببین',
  'به', 'از', 'برای', 'واسه', 'با', 'یه',
  'مبلغ', 'مقدار', 'قیمت', 'عدد', 'تومان',
  'دالر', 'دلار', 'یورو', 'افغانی', 'تومان', 'ریال', 'روپیه', 'درهم',
  'usd', 'eur', 'afn', 'irt', 'irr', 'pkr', 'aed',
  'اضافه', 'کم', 'واریز', 'برداشت', 'کسر', 'افزایش', 'کاهش',
  'مانده', 'موجودی', 'حساب',
  'سود', 'درآمد', 'گزارش', 'امروز', 'دیروز', 'ماه', 'سال', 'هفته',
  'چقدر', 'چند', 'چیه', 'کیه', 'کجا', 'کی', 'چی',
  'همه', 'تمام', 'کل', 'لیست',
  'و', 'یا', 'تا',
  'ویرایش', 'جدید', 'حذف', 'پاک',
  'ورود', 'خروج',
];

export function extractPerson(text: string): string | undefined {
  let t = lower(text);
  
  for (const sw of STOP_WORDS) {
    t = t.replace(new RegExp('\\b' + sw + '\\b', 'g'), ' ');
  }
  
  t = t.replace(/[^\u0600-\u06FF\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // اگه فقط یه کلمه موند و بین ۲-۴ حرف داره
  const words = t.split(' ').filter(w => w.length >= 2 && w.length <= 20);
  if (words.length >= 1 && words.length <= 3) {
    return words.join(' ');
  }
  return undefined;
}

// ═══════════════════════════════════════════
// تشخیص فعل / قصد
// ═══════════════════════════════════════════
export type Verb =
  | 'show'      // نشان بده، بیار
  | 'open'      // باز کن
  | 'create'    // بساز، بزن
  | 'edit'      // ویرایش کن
  | 'delete'    // حذف کن
  | 'add'       // اضافه کن
  | 'subtract'  // کم کن
  | 'search'    // بگرد، پیدا کن
  | 'ask'       // بپرس (سؤال)
  | 'none';

export function detectVerb(text: string): Verb {
  const t = lower(text);
  
  if (/(?:حذف|پاک|بنداز)/.test(t)) return 'delete';
  if (/(?:ویرایش|تغییر|عوض|اصلاح|درست)/.test(t)) return 'edit';
  if (/(?:بساز|ایجاد|ثبت کن|جدید|بزن|اضافه کردن)/.test(t)) return 'create';
  if (/(?:اضافه|واریز|افزایش|جمع|بستانکار)/.test(t)) return 'add';
  if (/(?:کم کن|برداشت|کسر|کاهش|خرج)/.test(t)) return 'subtract';
  if (/(?:بگرد|پیدا|جستجو)/.test(t)) return 'search';
  if (/(?:باز کن|باز کن|بیار|نشون|نشان|بده|بیاور)/.test(t)) return 'show';
  if (/(?:چقدر|چند|چیه|کیه|کجا|چرا)/.test(t)) return 'ask';
  
  return 'none';
}

// ═══════════════════════════════════════════
// تشخیص نوع (Action / Query / Navigation / Create)
// ═══════════════════════════════════════════
export type CommandKind = 'navigate' | 'form' | 'query' | 'action' | 'unknown';

export interface ParsedCommand {
  kind: CommandKind;
  action?: string;
  tab?: string;
  sub?: string;
  modal?: string;
  params: any;
  confidence: number;
  raw: string;
  reply: string;
}

// ═══════════════════════════════════════════
// پارسر اصلی
// ═══════════════════════════════════════════
export function parse(text: string): ParsedCommand {
  const raw = text;
  const t = lower(text);
  const normText = norm(text);
  const currency = detectCurrency(t);
  const amount = extractAmount(t);
  const person = extractPerson(t);
  const verb = detectVerb(t);
  
  // ═══ ۱. اگه دقیقاً یه Action هست ═══
  const action = findAction(t);
  if (action && (verb === 'none' || verb === 'show' || verb === 'open' || verb === 'create' || verb === 'edit')) {
    // Action مثل: «نرخ اضافه کن»، «فاکتور جدید بساز»
    const reply = getActionReply(action, verb);
    return {
      kind: 'navigate',
      action: action.key,
      tab: action.target.tab,
      sub: action.target.sub,
      modal: action.target.modal,
      params: { currency, amount, person },
      confidence: 90,
      raw,
      reply,
    };
  }
  
  // ═══ ۲. اگه فرم هست ═══
  const form = findForm(t);
  if (form && (verb === 'create' || verb === 'show' || verb === 'open')) {
    return {
      kind: 'form',
      action: form.key,
      tab: form.screen === 'ExchangeScreen' ? 'exchange' :
           form.screen === 'LiveMarketScreen' ? 'exchange' :
           form.screen === 'BoxesScreen' ? 'exchange' :
           form.screen === 'GroupsScreen' ? 'exchange' :
           form.screen === 'PublicMarketScreen' ? 'publicMarket' :
           'exchange',
      modal: form.key,
      params: { currency, amount, person },
      confidence: 85,
      raw,
      reply: '📝 ' + form.label + ' رو باز می‌کنم',
    };
  }
  
  // ═══ ۳. Navigation — تب / زیرتب ═══
  // اول sub-tab چک کن
  const sub = findSubTab(t);
  if (sub) {
    return {
      kind: 'navigate',
      tab: 'exchange',
      sub: sub.key,
      params: { currency, amount, person, filter: person },
      confidence: 88,
      raw,
      reply: 'میرم به ' + sub.label + (person ? ' — ' + person : ''),
    };
  }
  
  // بعد tab
  const tab = findTab(t);
  if (tab) {
    return {
      kind: 'navigate',
      tab: tab.key,
      params: { currency, amount, person, filter: person },
      confidence: 85,
      raw,
      reply: 'میرم به ' + tab.label + (person ? ' — ' + person : ''),
    };
  }
  
  // ═══ ۴. عملیات (واریز/برداشت) ═══
  if (verb === 'add' && amount && person) {
    return {
      kind: 'action',
      action: 'deposit',
      params: { person, amount, currency: currency || 'AFN' },
      confidence: 80,
      raw,
      reply: `واریز ${amount.toLocaleString('en-US')} ${currency || 'AFN'} به ${person}`,
    };
  }
  
  if (verb === 'subtract' && amount && person) {
    return {
      kind: 'action',
      action: 'withdraw',
      params: { person, amount, currency: currency || 'AFN' },
      confidence: 80,
      raw,
      reply: `برداشت ${amount.toLocaleString('en-US')} ${currency || 'AFN'} از ${person}`,
    };
  }
  
  // ═══ ۵. سؤال ═══
  if (verb === 'ask' || /(?:چقدر|چند|چیه|کیه|کجا)/.test(t)) {
    return {
      kind: 'query',
      action: 'ask',
      params: { query: raw, person, currency },
      confidence: 70,
      raw,
      reply: 'در حال بررسی...',
    };
  }
  
  // ═══ ۶. اگه فقط اسم هست ═══
  if (person && person.length >= 2) {
    // اول صندوق، بعد مشتری
    return {
      kind: 'query',
      action: 'findPerson',
      params: { person, currency },
      confidence: 60,
      raw,
      reply: `دنبال ${person} می‌گردم...`,
    };
  }
  
  // ═══ ۷. نامفهوم ═══
  return {
    kind: 'unknown',
    params: {},
    confidence: 10,
    raw,
    reply: '🤔 نفهمیدم. یه راهنمایی بزن تا بفهمی چی می‌تونم بکنم',
  };
}

// ═══════════════════════════════════════════
// پیام برای Action
// ═══════════════════════════════════════════
function getActionReply(action: any, verb: Verb): string {
  if (verb === 'create' || action.key.startsWith('new_')) {
    return '📝 ' + action.label + ' رو باز می‌کنم';
  }
  return '→ ' + action.label;
}

// ═══════════════════════════════════════════
// تجزیه چند-دستوری
// ═══════════════════════════════════════════
export function parseMulti(text: string): ParsedCommand[] {
  const parts = norm(text)
    .split(/\s+و\s+|\s*،\s*|\s*;\s*|\s+بعد\s+|\s+بعدش\s+|\s+سپس\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 1);
  
  if (parts.length <= 1) return [parse(text)];
  return parts.map(p => parse(p));
}

// ═══════════════════════════════════════════
// راهنما
// ═══════════════════════════════════════════
export const HELP_TEXT = `🤖 من می‌تونم این کارها رو بکنم:

📍 ناوبری:
  • «صندوق‌ها» — می‌رم صندوق‌ها
  • «مشتریان» — می‌رم مشتریان
  • «حواله‌جات» — می‌رم حواله‌جات
  • «فاکتور فروش» — می‌رم فروش
  • «بازار زنده» — می‌رم بازار زنده

📝 فرم‌ها:
  • «صندوق جدید» — فرم صندوق
  • «حواله جدید» — فرم حواله
  • «فاکتور جدید» — فرم فاکتور
  • «مشتری جدید» — فرم مشتری
  • «نرخ جدید» — فرم نرخ

💰 عملیات:
  • «۵۰۰ به احمد اضافه کن» — واریز
  • «۱۰۰ از فروغی کم کن» — برداشت

❓ سؤال:
  • «مانده احمد» — مانده
  • «سود امروز» — سود
  • «کی بدهکاره؟» — لیست

🔍 جستجو:
  • «احمد» — پیدا کردن همه جا
  • «صندوق فروغی» — صندوق خاص

💡 هرچی بگی، سعی می‌کنم بفهمم و انجام بدم`;
