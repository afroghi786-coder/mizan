// lib.assistant.ts — مغز دستیار فوق‌هوشمند
import AsyncStorage from '@react-native-async-storage/async-storage';

let _nav: any = {};
export function setNavigator(n: any) { _nav = { ..._nav, ...n }; }
export function goTab(t: string) { try { _nav.setTab?.(t); } catch {} }
export function goSub(s: string) { try { _nav.setSub?.(s); } catch {} }

export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

export type IntentKind = 'navigate' | 'query' | 'action' | 'create' | 'unknown';

export interface Intent {
  kind: IntentKind;
  action: string;
  params: any;
  confidence: number;
  raw: string;
  reply: string;
}

const NAV_MAP: Array<{ words: string[]; tab: string; sub?: string; label: string }> = [
  { words: ['بازار زنده', 'بازارزنده'], tab: 'exchange', sub: 'liveMarket', label: 'بازار زنده' },
  { words: ['بازار عمومی', 'بازارعمومی'], tab: 'publicMarket', label: 'بازار عمومی' },
  { words: ['صندوق'], tab: 'exchange', sub: 'boxes', label: 'صندوق‌ها' },
  { words: ['حواله جات', 'حواله‌جات', 'حواله‌ها'], tab: 'exchange', sub: 'hawalas', label: 'حواله‌جات' },
  { words: ['چک'], tab: 'exchange', sub: 'checks', label: 'چک‌ها' },
  { words: ['مشتری'], tab: 'exchange', sub: 'customers', label: 'مشتریان' },
  { words: ['شریک', 'شرکا'], tab: 'exchange', sub: 'partners', label: 'شرکا' },
  { words: ['گزارش', 'دفتر'], tab: 'exchange', sub: 'ledger', label: 'گزارش' },
  { words: ['فاکتور فروش', 'فروش'], tab: 'sales', label: 'فاکتور فروش' },
  { words: ['فاکتور خرید', 'خرید'], tab: 'purchases', label: 'فاکتور خرید' },
  { words: ['گروه'], tab: 'exchange', sub: 'myGroups', label: 'گروه‌ها' },
  { words: ['داشبورد', 'خانه'], tab: 'dashboard', label: 'داشبورد' },
  { words: ['کارمند'], tab: 'employees', label: 'کارمندان' },
  { words: ['هزینه'], tab: 'expenses', label: 'هزینه‌ها' },
  { words: ['انبار', 'موجودی'], tab: 'inventory', label: 'انبار' },
  { words: ['تنظیمات'], tab: 'settings', label: 'تنظیمات' },
  { words: ['بانک'], tab: 'bankMatch', label: 'بانک' },
  { words: ['صرافی'], tab: 'exchange', sub: 'list', label: 'صرافی' },
];

export function parseIntent(text: string): Intent {
  const raw = text;
  const t = norm(text).toLowerCase();

  if (!t || t.length < 2) {
    return { kind: 'unknown', action: '', params: {}, confidence: 0, raw, reply: 'چیزی نگفتی' };
  }


  // ═══ Deep: صندوق [شخص] ═══
  const boxPersonMatch = t.match(/(?:صندوق|موجودی)\s+(?:ارز\s+)?(?:دالر|دلار|یورو|افغانی|تومان)?\s*(?:از\s+|برای\s+)?([\u0600-\u06FF]{2,})/);
  if (boxPersonMatch && /صندوق/.test(t)) {
    return {
      kind: 'navigate',
      action: 'gotoBoxPerson',
      params: { name: boxPersonMatch[1], tab: 'exchange', sub: 'boxes' },
      confidence: 80,
      raw,
      reply: 'میرم به صندوق ' + boxPersonMatch[1],
    };
  }

  // ═══ Deep: فاکتور جدید برای [شخص] ═══
  const newInvPersonMatch = t.match(/(?:فاکتور|فاکتر)\s+(?:جدید|فروش|بزن|بساز)\s*(?:برای\s+)?([\u0600-\u06FF]{2,})/);
  if (newInvPersonMatch) {
    return {
      kind: 'create',
      action: 'newInvoiceFor',
      params: { name: newInvPersonMatch[1], tab: 'sales' },
      confidence: 80,
      raw,
      reply: 'فاکتور جدید برای ' + newInvPersonMatch[1],
    };
  }

  // ═══ Deep: حواله [مبلغ] به [شخص/شهر] ═══
  const hawalaMatch = t.match(/حواله\s+(\d+(?:\.\d+)?)\s*(?:هزار|میلیون)?\s*(?:افغانی|تومان|ریال|دالر|دلار)?\s*به\s+([\u0600-\u06FF\w]+)/);
  if (hawalaMatch) {
    let amt = parseFloat(hawalaMatch[1]);
    if (/هزار/.test(t)) amt *= 1000;
    else if (/میلیون/.test(t)) amt *= 1000000;
    return {
      kind: 'create',
      action: 'newHawalaFor',
      params: { amount: amt, target: hawalaMatch[2], tab: 'exchange', sub: 'hawalas' },
      confidence: 80,
      raw,
      reply: 'حواله ' + amt + ' به ' + hawalaMatch[2],
    };
  }

  // ═══ Deep: مشتری [نام] ═══
  const custMatch = t.match(/(?:مشتری|مشتر)\s+([\u0600-\u06FF]{2,})/);
  if (custMatch && !/مشتریان/.test(t)) {
    return {
      kind: 'navigate',
      action: 'gotoCustomer',
      params: { name: custMatch[1], tab: 'exchange', sub: 'customers' },
      confidence: 75,
      raw,
      reply: 'میرم به مشتری ' + custMatch[1],
    };
  }

    // Navigation
  for (const nav of NAV_MAP) {
    for (const w of nav.words) {
      if (t.includes(w.toLowerCase())) {
        return {
          kind: 'navigate',
          action: 'goto',
          params: { tab: nav.tab, sub: nav.sub, label: nav.label },
          confidence: 90,
          raw,
          reply: 'میرم به ' + nav.label,
        };
      }
    }
  }

  // Query — مانده
  const balanceMatch = t.match(/(?:مانده|حساب|بدهکار|طلبکار)\s+(?:از\s+)?([\u0600-\u06FF\w]+)/);
  if (balanceMatch) {
    return { kind: 'query', action: 'getBalance', params: { name: balanceMatch[1] }, confidence: 85, raw, reply: 'مانده ' + balanceMatch[1] };
  }

  // Query — صندوق
  if (/صندوق/.test(t)) {
    return { kind: 'query', action: 'getBox', params: {}, confidence: 80, raw, reply: 'موجودی صندوق' };
  }

  // Query — سود
  if (/سود|درآمد/.test(t)) {
    return { kind: 'query', action: 'getProfit', params: {}, confidence: 90, raw, reply: 'سود امروز' };
  }

  // Query — نرخ
  if (/نرخ|قیمت/.test(t)) {
    const cm = t.match(/(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)/);
    return { kind: 'query', action: 'getRate', params: { currency: cm?.[1] }, confidence: 85, raw, reply: 'نرخ ' + (cm?.[1] || 'ارز') };
  }

  // Transfer
  const tm = t.match(/(\d+(?:\.\d+)?)\s*(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)?\s*از\s+([\u0600-\u06FF\w]+)\s+به\s+([\u0600-\u06FF\w]+)/);
  if (tm) {
    return {
      kind: 'action',
      action: 'transfer',
      params: { amount: parseFloat(tm[1]), currency: tm[2] || 'AFN', from: tm[3], to: tm[4] },
      confidence: 85,
      raw,
      reply: 'انتقال ' + tm[1] + ' ' + (tm[2] || '') + ' از ' + tm[3] + ' به ' + tm[4],
    };
  }

  // Pay
  const pm = t.match(/(\d+(?:\.\d+)?)\s*(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)?\s*به\s+([\u0600-\u06FF\w]+)/);
  if (pm) {
    return {
      kind: 'action',
      action: 'pay',
      params: { amount: parseFloat(pm[1]), currency: pm[2] || 'AFN', to: pm[3] },
      confidence: 80,
      raw,
      reply: 'پرداخت ' + pm[1] + ' ' + (pm[2] || '') + ' به ' + pm[3],
    };
  }

  // Receive
  const rm = t.match(/(\d+(?:\.\d+)?)\s*(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)?\s*از\s+([\u0600-\u06FF\w]+)/);
  if (rm) {
    return {
      kind: 'action',
      action: 'receive',
      params: { amount: parseFloat(rm[1]), currency: rm[2] || 'AFN', from: rm[3] },
      confidence: 80,
      raw,
      reply: 'دریافت ' + rm[1] + ' ' + (rm[2] || '') + ' از ' + rm[3],
    };
  }

  // Create
  if (/فاکتور/.test(t) && /(بزن|بساز|جدید)/.test(t)) {
    return { kind: 'create', action: 'newInvoice', params: {}, confidence: 85, raw, reply: 'فرم فاکتور جدید' };
  }
  if (/حواله/.test(t) && /(بزن|بساز|بفرست|جدید)/.test(t)) {
    return { kind: 'create', action: 'newHawala', params: {}, confidence: 85, raw, reply: 'فرم حواله جدید' };
  }
  if (/مشتری/.test(t) && /(جدید|اضافه|بساز)/.test(t)) {
    return { kind: 'create', action: 'newCustomer', params: {}, confidence: 80, raw, reply: 'مشتری جدید' };
  }

  if (/چقدر|چند|چیه|کیه|کجا/.test(t)) {
    return { kind: 'query', action: 'general', params: { q: text }, confidence: 60, raw, reply: 'در حال جستجو...' };
  }

  return {
    kind: 'unknown',
    action: '',
    params: {},
    confidence: 10,
    raw,
    reply: 'متوجه نشدم. مثلاً: «بازار زنده»، «صندوق‌ها»، «مانده احمد»',
  };
}

const HIST_KEY = '@mizan_assistant_history_v1';
export async function getAssistantHistory(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(HIST_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}
export async function addAssistantHistory(h: any): Promise<void> {
  const list = await getAssistantHistory();
  list.unshift(h);
  await AsyncStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 100)));
}
export async function clearAssistantHistory(): Promise<void> {
  await AsyncStorage.removeItem(HIST_KEY);
}

export const SAMPLE_COMMANDS = [
  { icon: '🏛️', text: 'بازار زنده رو بیار' },
  { icon: '📦', text: 'صندوق‌ها' },
  { icon: '💸', text: 'مانده احمد چقدره؟' },
  { icon: '📊', text: 'سود امروز چقدره؟' },
  { icon: '💱', text: 'نرخ دالر چنده؟' },
  { icon: '🔄', text: '۱۰۰ دالر از احمد به محمود' },
  { icon: '📝', text: 'فاکتور فروش رو بیار' },
  { icon: '➕', text: 'فاکتور جدید بزن' },
  { icon: '👥', text: 'مشتریان رو بیار' },
  { icon: '📋', text: 'حواله‌جات' },
  { icon: '🏦', text: 'بانک رو باز کن' },
  { icon: '🎯', text: 'بازار عمومی' },
];
