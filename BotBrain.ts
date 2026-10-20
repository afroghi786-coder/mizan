// ═══════════════════════════════════════════════════════════
//  🧠 BotBrain — مغز ربات دستیار
//  کاملاً آفلاین | بدون API | سریع | همه‌چیزدان
// ═══════════════════════════════════════════════════════════

// ─── ۱. دانش کامل از اپ (نقشه) ────────────────────────────
export const APP_KNOWLEDGE: any = {
  tabs: {
    mgr: { label: 'مدیریت', aliases: ['مدیریت', 'مدیر', 'پنل'], subs: [] },
    order: {
      label: 'سفارش',
      aliases: ['سفارش', 'فروش', 'خانه', 'داشبورد', 'فاکتور فروش'],
      subs: [],
    },
    purchase: {
      label: 'خرید',
      aliases: ['خرید', 'فاکتور خرید'],
      subs: [],
    },
    exchange: {
      label: 'صرافی',
      aliases: ['صرافی', 'صراف', 'معاملات', 'ارز'],
      subs: [
        { key: 'list', label: 'معاملات', aliases: ['معاملات', 'معامله'] },
        { key: 'form', label: 'معامله جدید', aliases: ['معامله جدید', 'معامله نو'] },
        { key: 'boxes', label: 'صندوق‌ها', aliases: ['صندوق', 'صندوق‌ها', 'کارتکس', 'کاردکس'] },
        { key: 'hawalas', label: 'حواله‌جات', aliases: ['حواله', 'حواله‌جات', 'حواله‌ها'] },
        { key: 'checks', label: 'چک‌ها', aliases: ['چک', 'چک‌ها'] },
        { key: 'customers', label: 'مشتریان', aliases: ['مشتری', 'مشتریان'] },
        { key: 'partners', label: 'شریکان', aliases: ['شریک', 'شرکا', 'شریکان'] },
        { key: 'ledger', label: 'کاردکس', aliases: ['کاردکس', 'دفتر کل'] },
        { key: 'statement', label: 'پرینت حساب', aliases: ['پرینت', 'صورتحساب'] },
        { key: 'liveMarket', label: 'بازار زنده', aliases: ['بازار زنده', 'بازار زنده ارز'] },
        { key: 'myGroups', label: 'شبکه‌ها', aliases: ['شبکه', 'شبکه‌ها', 'گروه'] },
      ],
    },
    publicMarket: {
      label: 'بازار عمومی',
      aliases: ['بازار عمومی', 'بازار', 'مارکت'],
      subs: [],
    },
    inventory: {
      label: 'انبار',
      aliases: ['انبار', 'موجودی', 'کالا'],
      subs: [],
    },
    expenses: {
      label: 'هزینه‌ها',
      aliases: ['هزینه', 'هزینه‌ها', 'خرج'],
      subs: [],
    },
    employees: {
      label: 'کارمندان',
      aliases: ['کارمند', 'کارمندان', 'پرسنل'],
      subs: [],
    },
    profit: {
      label: 'سود',
      aliases: ['سود', 'درآمد', 'سود و زیان'],
      subs: [],
    },
    bankMatch: {
      label: 'بانک',
      aliases: ['بانک', 'اس ام اس', 'sms', 'پیامک بانکی'],
      subs: [],
    },
    botLearning: {
      label: 'آموزش',
      aliases: ['آموزش', 'یادگیری'],
      subs: [],
    },
    settings: {
      label: 'تنظیمات',
      aliases: ['تنظیمات', 'تنظیم'],
      subs: [],
    },
  },
};

// ─── ۲. دیکشنری دستورات ──────────────────────────────────
// خروجی: { type, tab?, sub?, field?, raw }
export type Intent =
  | { type: 'goto'; tab?: string; sub?: string; raw: string }
  | { type: 'open_flow'; flow: string; raw: string }
  | { type: 'back'; raw: string }
  | { type: 'cancel'; raw: string }
  | { type: 'confirm_yes'; raw: string }
  | { type: 'confirm_no'; raw: string }
  | { type: 'answer'; value: string; raw: string }
  | { type: 'unknown'; raw: string };

// کلمات کلیدی
const BACK_WORDS = ['برگرد', 'بازگشت', 'عقب', 'قبلی', 'back'];
const CANCEL_WORDS = ['لغو', 'بی‌خیال', 'کنسل', 'انصراف', 'cancel'];
const YES_WORDS = ['بله', 'آره', 'بلی', 'درسته', 'تایید', 'تأیید', 'yes', 'ok', 'باشه'];
const NO_WORDS = ['نه', 'خیر', 'نخیر', 'no', 'نمی‌خوام', 'نمیخوام'];

// ─── ۳. Flowها (گفتگوی چندمرحله‌ای) ─────────────────────
export const FLOWS: any = {
  create_sales_invoice: {
    name: 'صدور فاکتور فروش',
    screen: 'salesInvoice',
    intro: 'باشه، فاکتور فروش باز شد.',
    steps: [
      { field: 'customer',   question: 'شماره یا نام مشتری چنده؟', type: 'text' },
      { field: 'date',       question: 'تاریخ فاکتور؟ می‌تونی بگی "امروز"', type: 'text' },
      { field: 'item',       question: 'کالا یا خدمت چیه؟', type: 'text' },
      { field: 'quantity',   question: 'چند تا؟', type: 'number' },
      { field: 'unitPrice',  question: 'قیمت هر واحد؟', type: 'number' },
      { field: 'discount',   question: 'تخفیف داری؟ بگو مقدار یا "نه"', type: 'text' },
      { field: 'confirm',    question: 'فاکتور آماده است. ثبت کنم؟ بگو بله یا نه', type: 'yesno' },
    ],
    onComplete: 'submit_sales_invoice',
    onCancel: 'close_screen',
  },
  create_purchase_invoice: {
    name: 'صدور فاکتور خرید',
    screen: 'purchaseInvoice',
    intro: 'باشه، فاکتور خرید باز شد.',
    steps: [
      { field: 'supplier', question: 'نام تامین‌کننده؟', type: 'text' },
      { field: 'date',     question: 'تاریخ؟', type: 'text' },
      { field: 'item',     question: 'کالا؟', type: 'text' },
      { field: 'quantity', question: 'تعداد؟', type: 'number' },
      { field: 'unitPrice',question: 'قیمت واحد؟', type: 'number' },
      { field: 'confirm',  question: 'ثبت کنم؟ بله یا نه', type: 'yesno' },
    ],
    onComplete: 'submit_purchase_invoice',
    onCancel: 'close_screen',
  },
};

// ─── ۴. توابع کمکی ──────────────────────────────────────

function normalize(text: string): string {
  return text
    .trim()
    .replace(/\u200c/g, ' ')   // نیم‌فاصله
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F]/g, '') // اعراب
    .toLowerCase();
}

function containsAny(text: string, words: string[]): boolean {
  const n = normalize(text);
  return words.some(w => n.includes(normalize(w)));
}

// ─── ۵. تشخیص قصد ───────────────────────────────────────
export function parseIntent(text: string): Intent {
  const raw = text;
  const t = normalize(text);

  // لغو / برگشت / بله / نه
  if (containsAny(t, CANCEL_WORDS)) return { type: 'cancel', raw };
  if (containsAny(t, BACK_WORDS))   return { type: 'back', raw };
  if (containsAny(t, YES_WORDS))    return { type: 'confirm_yes', raw };
  if (containsAny(t, NO_WORDS))     return { type: 'confirm_no', raw };

  // شروع flow؟
  if (containsAny(t, ['فاکتور فروش', 'فاکتور بزن', 'فروش بزن', 'فاکتور جدید فروش'])) {
    return { type: 'open_flow', flow: 'create_sales_invoice', raw };
  }
  if (containsAny(t, ['فاکتور خرید', 'خرید بزن'])) {
    return { type: 'open_flow', flow: 'create_purchase_invoice', raw };
  }

  // ناوبری: زیرتب‌ها
  for (const tabKey of Object.keys(APP_KNOWLEDGE.tabs)) {
    const tab = APP_KNOWLEDGE.tabs[tabKey];
    for (const sub of tab.subs || []) {
      if (containsAny(t, sub.aliases)) {
        return { type: 'goto', tab: tabKey, sub: sub.key, raw };
      }
    }
  }

  // ناوبری: تب‌های اصلی
  for (const tabKey of Object.keys(APP_KNOWLEDGE.tabs)) {
    const tab = APP_KNOWLEDGE.tabs[tabKey];
    if (containsAny(t, tab.aliases)) {
      return { type: 'goto', tab: tabKey, raw };
    }
  }

  // اگر داخل flow هستیم، این جواب است
  return { type: 'answer', value: raw, raw };
}

// ─── ۶. موتور Flow ───────────────────────────────────────
export class FlowEngine {
  flowKey: string | null = null;
  stepIndex: number = 0;
  answers: any = {};

  start(flowKey: string) {
    this.flowKey = flowKey;
    this.stepIndex = 0;
    this.answers = {};
    return FLOWS[flowKey].intro;
  }

  currentStep(): any {
    if (!this.flowKey) return null;
    const flow = FLOWS[this.flowKey];
    if (this.stepIndex >= flow.steps.length) return null;
    return flow.steps[this.stepIndex];
  }

  // پاسخ کاربر را ثبت می‌کند و سوال بعدی را برمی‌گرداند
  answer(value: string): { done: boolean; question?: string } {
    if (!this.flowKey) return { done: true };
    const flow = FLOWS[this.flowKey];
    const step = flow.steps[this.stepIndex];

    // اعتبارسنجی ساده
    if (step.type === 'number' && isNaN(Number(value.replace(/[^0-9]/g, '')))) {
      return { done: false, question: 'عدد وارد کن لطفاً. ' + step.question };
    }
    if (step.type === 'yesno') {
      const isYes = containsAny(value, YES_WORDS);
      const isNo  = containsAny(value, NO_WORDS);
      if (!isYes && !isNo) {
        return { done: false, question: 'بگو بله یا نه. ' + step.question };
      }
      this.answers[step.field] = isYes;
    } else {
      this.answers[step.field] = value;
    }

    this.stepIndex++;

    if (this.stepIndex >= flow.steps.length) {
      return { done: true };
    }
    return { done: false, question: flow.steps[this.stepIndex].question };
  }

  back(): string {
    if (this.stepIndex > 0) this.stepIndex--;
    const step = this.currentStep();
    return step ? step.question : 'برگشتیم به اول';
  }

  cancel() {
    this.flowKey = null;
    this.stepIndex = 0;
    this.answers = {};
  }

  isActive(): boolean {
    return this.flowKey !== null;
  }
}

// ─── ۷. پاسخ‌های آماده ──────────────────────────────────
export function unknownReply(): string {
  return 'متوجه نشدم. می‌تونی بگی: برو صرافی، صندوق‌ها، فاکتور فروش بزن، یا برگرد.';
}

export function helpText(): string {
  return 'چیزهایی که می‌تونم انجام بدم: ' +
    '۱. رفتن به هر تب: "برو صرافی" ' +
    '۲. باز کردن زیرتب: "صندوق‌ها" ' +
    '۳. شروع کار جدید: "فاکتور فروش بزن" ' +
    '۴. برگشت: "برگرد" ' +
    '۵. لغو: "لغو کن"';
}
