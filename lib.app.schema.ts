// lib.app.schema.ts — نقشه کامل اپ میزان
// این فایل کل ساختار اپ رو به ربات یاد می‌ده

export interface TabDef {
  key: string;
  label: string;
  icon: string;
  keywords: string[];  // کلماتی که کاربر ممکنه بگه
}

export interface SubTabDef {
  key: string;
  label: string;
  keywords: string[];
}

export interface FormDef {
  key: string;
  label: string;
  screen: string;
  fields: string[];
  keywords: string[];
}

export interface ActionDef {
  key: string;
  label: string;
  keywords: string[];
  target: { tab: string; sub?: string; modal?: string };
}

// ═══════════════════════════════════════════
// تب‌های اصلی اپ
// ═══════════════════════════════════════════
export const TABS: TabDef[] = [
  { key: 'order', label: 'سفارش', icon: '🛒',
    keywords: ['سفارش', 'فروش', 'فاکتور', 'فاکتور فروش', 'فروشنده', 'خریدار', 'مشتری'] },
  { key: 'purchase', label: 'خرید', icon: '🛍️',
    keywords: ['خرید', 'فاکتور خرید', 'تامین', 'تامین‌کننده'] },
  { key: 'print', label: 'پرینت', icon: '🖨️',
    keywords: ['پرینت', 'چاپ'] },
  { key: 'mgr', label: 'مدیریت', icon: '📋',
    keywords: ['مدیریت'] },
  { key: 'profit', label: 'سود', icon: '💹',
    keywords: ['سود', 'درآمد', 'گزارش سود'] },
  { key: 'inventory', label: 'انبار', icon: '📦',
    keywords: ['انبار', 'موجودی', 'جنس', 'کالا'] },
  { key: 'exchange', label: 'صرافی', icon: '💱',
    keywords: ['صرافی', 'معامله', 'ارز'] },
  { key: 'publicMarket', label: 'بازار', icon: '🏛️',
    keywords: ['بازار', 'بازار عمومی', 'آگهی'] },
  { key: 'aiAssistant', label: 'ربات', icon: '🤖',
    keywords: ['ربات', 'دستیار'] },
  { key: 'botLearning', label: 'آموزش', icon: '🎓',
    keywords: ['آموزش', 'یادگیری'] },
  { key: 'manualEntry', label: 'دستیار', icon: '🤖',
    keywords: ['دستیار'] },
  { key: 'bankMatch', label: 'بانک', icon: '🏦',
    keywords: ['بانک', 'پیامک', 'اس ام اس', 'sms'] },
  { key: 'expenses', label: 'هزینه‌ها', icon: '🧾',
    keywords: ['هزینه', 'خرج', 'مصرف'] },
  { key: 'employees', label: 'کارمندان', icon: '💼',
    keywords: ['کارمند', 'کارگر', 'پرسنل'] },
];

// ═══════════════════════════════════════════
// زیرتب‌های صرافی
// ═══════════════════════════════════════════
export const EXCHANGE_SUBS: SubTabDef[] = [
  { key: 'list', label: 'معاملات', keywords: ['معاملات', 'لیست معاملات', 'تاریخچه معاملات'] },
  { key: 'form', label: 'معامله جدید', keywords: ['معامله جدید', 'ثبت معامله', 'معامله بساز', 'خرید ارز', 'فروش ارز'] },
  { key: 'hawalas', label: 'حواله‌جات', keywords: ['حواله', 'حواله‌جات', 'حواله جدید', 'ارسال حواله', 'دریافت حواله'] },
  { key: 'boxes', label: 'صندوق‌ها', keywords: ['صندوق', 'صندوق‌ها', 'کارتکس', 'کاردکس', 'کارت‌کس', 'صندوقچه', 'باکس'] },
  { key: 'checks', label: 'چک‌ها', keywords: ['چک', 'چک‌ها', 'چک جدید', 'چک دریافتی', 'چک پرداختی'] },
  { key: 'ledger', label: 'کاردکس', keywords: ['کاردکس', 'دفتر', 'دفتر کل', 'حساب کل'] },
  { key: 'statement', label: 'پرینت حساب', keywords: ['پرینت حساب', 'صورتحساب', 'گزارش حساب'] },
  { key: 'customers', label: 'مشتریان', keywords: ['مشتری', 'مشتریان', 'طرف حساب', 'اشخاص'] },
  { key: 'partners', label: 'خریداران', keywords: ['خریدار', 'خریداران', 'شریک', 'شرکا', 'تامین‌کننده'] },
  { key: 'liveMarket', label: 'بازار زنده', keywords: ['بازار زنده', 'بازار زنده صرافی', 'معاملات زنده'] },
  { key: 'myGroups', label: 'شبکه‌های من', keywords: ['شبکه', 'شبکه‌های من', 'گروه', 'گروه‌ها'] },
];

// ═══════════════════════════════════════════
// فرم‌ها / Modal ها
// ═══════════════════════════════════════════
export const FORMS: FormDef[] = [
  { key: 'boxForm', label: 'فرم صندوق', screen: 'ExchangeScreen',
    fields: ['name', 'currency', 'owner_code', 'opening'],
    keywords: ['صندوق جدید', 'صندوق بساز', 'اضافه کردن صندوق'] },
  { key: 'hawForm', label: 'فرم حواله', screen: 'ExchangeScreen',
    fields: ['sender', 'beneficiary', 'amount', 'currency'],
    keywords: ['حواله جدید', 'حواله بساز', 'اضافه کردن حواله', 'ارسال حواله'] },
  { key: 'ckForm', label: 'فرم چک', screen: 'ExchangeScreen',
    fields: ['direction', 'check_number', 'bank', 'amount', 'currency'],
    keywords: ['چک جدید', 'چک بساز', 'اضافه کردن چک'] },
  { key: 'trForm', label: 'فرم ترانسفر', screen: 'ExchangeScreen',
    fields: ['from_box', 'to_box', 'amount'],
    keywords: ['ترانسفر', 'انتقال', 'انتقال صندوق'] },
  { key: 'custForm', label: 'فرم مشتری', screen: 'ExchangeScreen',
    fields: ['name', 'phone', 'bank', 'holder_name'],
    keywords: ['مشتری جدید', 'مشتری بساز', 'اضافه کردن مشتری'] },
  { key: 'partnerForm', label: 'فرم شریک', screen: 'ExchangeScreen',
    fields: ['name', 'phone', 'notes'],
    keywords: ['شریک جدید', 'اضافه کردن شریک'] },
  { key: 'txForm', label: 'تراکنش صندوق', screen: 'BoxesScreen',
    fields: ['type', 'amount', 'description'],
    keywords: ['واریز', 'برداشت', 'تراکنش جدید'] },
  { key: 'transferForm', label: 'انتقال صندوق', screen: 'BoxesScreen',
    fields: ['from', 'to', 'amount'],
    keywords: ['انتقال صندوق', 'جابه‌جایی'] },
  { key: 'fxForm', label: 'آگهی ارز', screen: 'LiveMarketScreen',
    fields: ['currency', 'amount', 'rate'],
    keywords: ['آگهی فروش ارز', 'نرخ بذار', 'فروش ارز'] },
  { key: 'directForm', label: 'حواله خصوصی', screen: 'LiveMarketScreen',
    fields: ['toEmail', 'currency', 'amount'],
    keywords: ['حواله خصوصی'] },
  { key: 'rateForm', label: 'فرم نرخ', screen: 'LiveMarketScreen',
    fields: ['currency', 'rate'],
    keywords: ['نرخ', 'نرخ ارز', 'اضافه کردن نرخ', 'قیمت ارز'] },
  { key: 'groupForm', label: 'فرم گروه', screen: 'GroupsScreen',
    fields: ['name', 'city'],
    keywords: ['گروه جدید', 'گروه بساز'] },
];

// ═══════════════════════════════════════════
// Action ها
// ═══════════════════════════════════════════
export const ACTIONS: ActionDef[] = [
  // Navigation
  { key: 'goto_order', label: 'سفارش', keywords: ['سفارش', 'سفارش جدید'],
    target: { tab: 'order' } },
  { key: 'goto_purchase', label: 'خرید', keywords: ['خرید', 'فاکتور خرید'],
    target: { tab: 'purchase' } },
  { key: 'goto_invoice_list', label: 'فاکتور فروش', keywords: ['فاکتور فروش', 'فاکتورهای فروش', 'فاکتور مشتری'],
    target: { tab: 'order' } },
  { key: 'goto_exchange', label: 'صرافی', keywords: ['صرافی'],
    target: { tab: 'exchange', sub: 'list' } },
  { key: 'goto_boxes', label: 'صندوق‌ها', keywords: ['صندوق', 'صندوق‌ها', 'کارتکس', 'کاردکس'],
    target: { tab: 'exchange', sub: 'boxes' } },
  { key: 'goto_hawalas', label: 'حواله‌جات', keywords: ['حواله', 'حواله‌جات'],
    target: { tab: 'exchange', sub: 'hawalas' } },
  { key: 'goto_checks', label: 'چک‌ها', keywords: ['چک', 'چک‌ها'],
    target: { tab: 'exchange', sub: 'checks' } },
  { key: 'goto_customers', label: 'مشتریان', keywords: ['مشتری', 'مشتریان'],
    target: { tab: 'exchange', sub: 'customers' } },
  { key: 'goto_partners', label: 'شریکان', keywords: ['شریک', 'شرکا'],
    target: { tab: 'exchange', sub: 'partners' } },
  { key: 'goto_live_market', label: 'بازار زنده', keywords: ['بازار زنده'],
    target: { tab: 'exchange', sub: 'liveMarket' } },
  { key: 'goto_public_market', label: 'بازار عمومی', keywords: ['بازار عمومی', 'بازار'],
    target: { tab: 'publicMarket' } },
  { key: 'goto_profit', label: 'سود', keywords: ['سود', 'گزارش سود'],
    target: { tab: 'profit' } },
  { key: 'goto_inventory', label: 'انبار', keywords: ['انبار', 'موجودی'],
    target: { tab: 'inventory' } },
  { key: 'goto_expenses', label: 'هزینه‌ها', keywords: ['هزینه', 'هزینه‌ها'],
    target: { tab: 'expenses' } },
  { key: 'goto_employees', label: 'کارمندان', keywords: ['کارمند', 'کارمندان'],
    target: { tab: 'employees' } },

  // Form Opening
  { key: 'new_invoice', label: 'فاکتور جدید', keywords: ['فاکتور جدید', 'فاکتور بساز', 'فاکتور بزن', 'ثبت فاکتور'],
    target: { tab: 'order', modal: 'newInvoice' } },
  { key: 'new_box', label: 'صندوق جدید', keywords: ['صندوق جدید', 'صندوق بساز'],
    target: { tab: 'exchange', sub: 'boxes', modal: 'boxForm' } },
  { key: 'new_hawala', label: 'حواله جدید', keywords: ['حواله جدید', 'حواله بساز', 'حواله بزن'],
    target: { tab: 'exchange', sub: 'hawalas', modal: 'hawForm' } },
  { key: 'new_check', label: 'چک جدید', keywords: ['چک جدید', 'چک بساز'],
    target: { tab: 'exchange', sub: 'checks', modal: 'ckForm' } },
  { key: 'new_customer', label: 'مشتری جدید', keywords: ['مشتری جدید', 'مشتری بساز', 'اضافه کردن مشتری'],
    target: { tab: 'exchange', sub: 'customers', modal: 'custForm' } },
  { key: 'new_rate', label: 'نرخ جدید', keywords: ['نرخ جدید', 'نرخ بذار', 'اضافه کردن نرخ', 'نرخ ارز اضافه کن'],
    target: { tab: 'exchange', sub: 'liveMarket', modal: 'rateModal' } },
  { key: 'new_fx_offer', label: 'آگهی ارز', keywords: ['آگهی فروش ارز', 'آگهی ارز', 'ارز بفروش'],
    target: { tab: 'exchange', sub: 'liveMarket', modal: 'fxModal' } },
];

// ═══════════════════════════════════════════
// پیدا کردن target از متن
// ═══════════════════════════════════════════
export function findAction(text: string): ActionDef | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  
  // بیشترین تطابق کلمه‌ای
  let best: ActionDef | null = null;
  let bestScore = 0;
  
  for (const a of ACTIONS) {
    for (const kw of a.keywords) {
      const k = kw.toLowerCase();
      let score = 0;
      if (t === k) score = 100;
      else if (t.startsWith(k)) score = 90;
      else if (t.includes(k)) score = 70;
      else if (k.includes(t) && t.length > 2) score = 50;
      if (score > bestScore) { bestScore = score; best = a; }
    }
  }
  
  return bestScore >= 50 ? best : null;
}

// ═══════════════════════════════════════════
// پیدا کردن tab
// ═══════════════════════════════════════════
export function findTab(text: string): TabDef | null {
  const t = text.toLowerCase().trim();
  let best: TabDef | null = null;
  let bestScore = 0;
  
  for (const tab of TABS) {
    for (const kw of tab.keywords) {
      const k = kw.toLowerCase();
      let score = 0;
      if (t === k) score = 100;
      else if (t === tab.label) score = 100;
      else if (t.includes(k)) score = 70;
      if (score > bestScore) { bestScore = score; best = tab; }
    }
  }
  return bestScore >= 60 ? best : null;
}

// ═══════════════════════════════════════════
// پیدا کردن sub-tab
// ═══════════════════════════════════════════
export function findSubTab(text: string): SubTabDef | null {
  const t = text.toLowerCase().trim();
  let best: SubTabDef | null = null;
  let bestScore = 0;
  
  for (const sub of EXCHANGE_SUBS) {
    for (const kw of sub.keywords) {
      const k = kw.toLowerCase();
      let score = 0;
      if (t === k) score = 100;
      else if (t === sub.label) score = 100;
      else if (t.includes(k)) score = 70;
      if (score > bestScore) { bestScore = score; best = sub; }
    }
  }
  return bestScore >= 60 ? best : null;
}

// ═══════════════════════════════════════════
// پیدا کردن فرم
// ═══════════════════════════════════════════
export function findForm(text: string): FormDef | null {
  const t = text.toLowerCase().trim();
  let best: FormDef | null = null;
  let bestScore = 0;
  
  for (const f of FORMS) {
    for (const kw of f.keywords) {
      const k = kw.toLowerCase();
      let score = 0;
      if (t === k) score = 100;
      else if (t.includes(k)) score = 80;
      if (score > bestScore) { bestScore = score; best = f; }
    }
  }
  return bestScore >= 60 ? best : null;
}

// ═══════════════════════════════════════════
// آمار
// ═══════════════════════════════════════════
export const SCHEMA_STATS = {
  tabs: TABS.length,
  exchangeSubs: EXCHANGE_SUBS.length,
  forms: FORMS.length,
  actions: ACTIONS.length,
  totalKeywords: TABS.reduce((s, t) => s + t.keywords.length, 0)
    + EXCHANGE_SUBS.reduce((s, x) => s + x.keywords.length, 0)
    + ACTIONS.reduce((s, a) => s + a.keywords.length, 0)
    + FORMS.reduce((s, f) => s + f.keywords.length, 0),
};
