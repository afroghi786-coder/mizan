// lib.app.wizard.ts — فرم‌ساز گفتگویی
// ربات فیلد به فیلد می‌پرسه و کاربر جواب می‌ده

import { speakText } from './lib.voice';

// ═══════════════════════════════════════════
// Form Field تعریف
// ═══════════════════════════════════════════
export interface FormField {
  key: string;
  label: string;        // سؤال
  hint?: string;        // راهنما
  type: 'text' | 'number' | 'phone' | 'date' | 'choice' | 'items';
  required?: boolean;
  choices?: string[];
  default?: any;
  validate?: (v: any) => string | null;
  onAnswer?: (v: any, form: any) => void | Promise<void>;
}

// ═══════════════════════════════════════════
// Form Definition
// ═══════════════════════════════════════════
export interface FormDef {
  key: string;
  title: string;
  icon: string;
  fields: FormField[];
  onComplete?: (data: any) => Promise<any>;
}

// ═══════════════════════════════════════════
// Wizard State
// ═══════════════════════════════════════════
export interface WizardState {
  formKey: string;
  fields: FormField[];
  currentIndex: number;
  data: any;
  items: any[];      // برای اقلام
  currentItem: any;  // قلم در حال پر شدن
  itemFieldIndex: number;
  status: 'active' | 'confirming' | 'done' | 'cancelled';
  rawLines: string[];  // تاریخچه گفتگو
}

// ═══════════════════════════════════════════
// نرمال‌سازی
// ═══════════════════════════════════════════
function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d: string) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يىئ]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumber(s: string): number | null {
  const t = norm(s).replace(/,/g, '');
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  const words: any = {
    'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
    'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
    'یازده': 11, 'دوازده': 12, 'پانزده': 15, 'بیست': 20,
    'سی': 30, 'چهل': 40, 'پنجاه': 50, 'صد': 100,
    'دویست': 200, 'سیصد': 300, 'پونصد': 500, 'پانصد': 500,
    'هزار': 1000,
  };
  for (const [k, v] of Object.entries(words)) {
    if (t.includes(k)) return v as number;
  }
  return null;
}

function isYes(s: string): boolean {
  return /بله|اره|آره|بلی|yes|ok|اوکی|تایید|تأیید|درسته|صحیح/i.test(s);
}

function isNo(s: string): boolean {
  return /نه|نخیر|خیر|no|نیست|تمام|تموم|بس/i.test(s);
}

// ═══════════════════════════════════════════
// تعریف فرم‌ها
// ═══════════════════════════════════════════

// ─── فرم فاکتور فروش
export const FORM_INVOICE: FormDef = {
  key: 'invoice',
  title: 'فاکتور فروش',
  icon: '📄',
  fields: [
    {
      key: 'customer_phone',
      label: '📞 شماره تماس مشتری چیه؟',
      hint: 'مثلاً ۰۷۰۰۱۲۳۴۵۶',
      type: 'phone',
      required: true,
      onAnswer: async (v: any, form: any) => {
        try {
          const lib = await import('./lib');
          const found = await (lib as any).lookupCustomerByPhone?.(v);
          if (found) {
            form.customer_name = found.customer_name || '';
            form.customer_address = found.customer_address || '';
            form.customer_code = found.customer_code || '';
            form._customerFound = true;
          } else {
            form._customerFound = false;
          }
        } catch {}
      },
    },
    {
      key: 'customer_name',
      label: '👤 اسم مشتری چیه؟',
      type: 'text',
      required: true,
    },
    {
      key: 'customer_address',
      label: '📍 آدرس مشتری؟ (اگه نمی‌دونی بگو «ندارم»)',
      type: 'text',
      required: false,
    },
    {
      key: 'shipping',
      label: '🚚 روش ارسال چیه؟ (پست، تیپاکس، ...)',
      type: 'choice',
      choices: ['پست', 'تیپاکس', 'چاپار', 'باربری', 'حضوری'],
      required: false,
    },
    {
      key: 'payment',
      label: '💰 چقدر پرداخت کرده؟ (اگه صفر بگو ۰)',
      type: 'number',
      required: false,
      default: 0,
    },
  ],
};

// ─── فرم صندوق
export const FORM_BOX: FormDef = {
  key: 'box',
  title: 'صندوق جدید',
  icon: '📦',
  fields: [
    {
      key: 'name',
      label: '📝 اسم صندوق چیه؟',
      hint: 'مثلاً: صندوق دالر فروغی',
      type: 'text',
      required: true,
    },
    {
      key: 'currency',
      label: '💱 چه ارزی؟ (افغانی، دالر، یورو، ...)',
      type: 'choice',
      choices: ['AFN', 'USD', 'EUR', 'GBP', 'PKR', 'IRR', 'IRT', 'AED', 'TRY'],
      required: true,
      default: 'AFN',
    },
    {
      key: 'owner_name',
      label: '👤 صاحب صندوق کیه؟',
      type: 'text',
      required: false,
    },
    {
      key: 'opening',
      label: '💰 موجودی اولیه چقدره؟ (اگه صفر بگو ۰)',
      type: 'number',
      required: false,
      default: 0,
    },
  ],
};

// ─── فرم مشتری
export const FORM_CUSTOMER: FormDef = {
  key: 'customer',
  title: 'مشتری جدید',
  icon: '👤',
  fields: [
    {
      key: 'name',
      label: '📝 اسم مشتری چیه؟',
      type: 'text',
      required: true,
    },
    {
      key: 'phone',
      label: '📞 شماره تماسش چیه؟',
      type: 'phone',
      required: false,
    },
    {
      key: 'bank',
      label: '🏦 بانکش چیه؟',
      type: 'choice',
      choices: ['ملی', 'صداقت', 'عزیزی', 'آی‌بی‌آی', 'میوند', 'تجارت', 'ندارم'],
      required: false,
    },
    {
      key: 'holder_name',
      label: '👤 صاحب حساب کیه؟',
      type: 'text',
      required: false,
    },
  ],
};

// ─── فرم حواله
export const FORM_HAWALA: FormDef = {
  key: 'hawala',
  title: 'حواله جدید',
  icon: '💸',
  fields: [
    {
      key: 'direction',
      label: '📤 ارسال یا 📥 دریافت؟',
      type: 'choice',
      choices: ['ارسال', 'دریافت'],
      required: true,
      default: 'ارسال',
    },
    {
      key: 'amount',
      label: '💰 مبلغ حواله چقدره؟',
      type: 'number',
      required: true,
    },
    {
      key: 'currency',
      label: '💱 چه ارزی؟',
      type: 'choice',
      choices: ['AFN', 'USD', 'EUR', 'PKR', 'IRR'],
      required: true,
      default: 'AFN',
    },
    {
      key: 'sender_name',
      label: '👤 اسم فرستنده؟',
      type: 'text',
      required: true,
    },
    {
      key: 'beneficiary_name',
      label: '👤 اسم گیرنده؟',
      type: 'text',
      required: true,
    },
    {
      key: 'beneficiary_phone',
      label: '📞 تلفن گیرنده؟',
      type: 'phone',
      required: false,
    },
    {
      key: 'beneficiary_city',
      label: '📍 شهر گیرنده؟',
      type: 'text',
      required: false,
    },
  ],
};

// ─── فرم نرخ
export const FORM_RATE: FormDef = {
  key: 'rate',
  title: 'نرخ جدید',
  icon: '📈',
  fields: [
    {
      key: 'currency',
      label: '💱 چه ارزی؟ (دالر، یورو، ...)',
      type: 'choice',
      choices: ['USD', 'EUR', 'GBP', 'PKR', 'IRR', 'IRT', 'AED', 'TRY', 'CNY', 'SAR'],
      required: true,
    },
    {
      key: 'rate',
      label: '💰 نرخ چقدره؟ (به افغانی)',
      type: 'number',
      required: true,
    },
  ],
};

// ─── فرم چک
export const FORM_CHECK: FormDef = {
  key: 'check',
  title: 'چک جدید',
  icon: '🧾',
  fields: [
    {
      key: 'direction',
      label: '📥 چک دریافت کردی یا 📤 دادی؟',
      type: 'choice',
      choices: ['دریافت', 'پرداخت'],
      required: true,
    },
    {
      key: 'check_number',
      label: '🔢 شماره چک چیه؟',
      type: 'text',
      required: true,
    },
    {
      key: 'bank',
      label: '🏦 کدوم بانک؟',
      type: 'choice',
      choices: ['ملی', 'صداقت', 'عزیزی', 'آی‌بی‌آی', 'میوند', 'تجارت', 'دیگر'],
      required: true,
    },
    {
      key: 'amount',
      label: '💰 مبلغ چک چقدره؟',
      type: 'number',
      required: true,
    },
  ],
};

// ═══════════════════════════════════════════
// گرفتن فرم با کلید
// ═══════════════════════════════════════════

// ─── فرم فاکتور خرید
export const FORM_PURCHASE: FormDef = {
  key: 'purchase',
  title: 'فاکتور خرید',
  icon: '🛒',
  fields: [
    {
      key: 'supplier_name',
      label: '👤 اسم تامین‌کننده چیه؟',
      type: 'text',
      required: true,
    },
    {
      key: 'supplier_phone',
      label: '📞 شماره تماسش چیه؟',
      type: 'phone',
      required: false,
    },
    {
      key: 'amount',
      label: '💰 مبلغ کل چقدره؟',
      type: 'number',
      required: true,
    },
    {
      key: 'note',
      label: '📝 توضیحات؟ (اگه نداری بگو «ندارم»)',
      type: 'text',
      required: false,
    },
  ],
};

export const ALL_FORMS: Record<string, FormDef> = {
  invoice: FORM_INVOICE,
  purchase: FORM_PURCHASE,
  box: FORM_BOX,
  customer: FORM_CUSTOMER,
  hawala: FORM_HAWALA,
  rate: FORM_RATE,
  check: FORM_CHECK,
};

export function getForm(key: string): FormDef | null {
  return ALL_FORMS[key] || null;
}

// ═══════════════════════════════════════════
// Wizard Engine
// ═══════════════════════════════════════════
export function startWizard(formKey: string): WizardState | null {
  const form = getForm(formKey);
  if (!form) return null;
  
  const data: any = {};
  // پیش‌فرض‌ها
  for (const f of form.fields) {
    if (f.default !== undefined) data[f.key] = f.default;
  }
  
  return {
    formKey,
    fields: form.fields,
    currentIndex: 0,
    data,
    items: [],
    currentItem: {},
    itemFieldIndex: 0,
    status: 'active',
    rawLines: [],
  };
}

export function getCurrentQuestion(w: WizardState): string {
  if (w.status === 'confirming') {
    return '✅ همه چیز آماده — ذخیره کنم؟ (بله/نه)';
  }
  if (w.currentIndex >= w.fields.length) {
    return '✅ همه چیز آماده — ذخیره کنم؟ (بله/نه)';
  }
  const f = w.fields[w.currentIndex];
  let q = f.label;
  if (f.hint) q += '\n   💡 ' + f.hint;
  if (f.choices && f.choices.length > 0) {
    q += '\n   گزینه‌ها: ' + f.choices.join(' | ');
  }
  return q;
}

export async function answerCurrent(w: WizardState, answer: string): Promise<{ w: WizardState; reply: string; done: boolean }> {
  if (w.status === 'done' || w.status === 'cancelled') {
    return { w, reply: 'این فرم بسته شده', done: true };
  }
  
  const a = answer.trim();
  
  // اگه در حالت تأیید نهایی
  if (w.status === 'confirming' || w.currentIndex >= w.fields.length) {
    if (isYes(a)) {
      const result = await saveWizard(w);
      return { w: { ...w, status: result.ok ? 'done' : 'cancelled' }, reply: result.message, done: true };
    }
    if (isNo(a)) {
      return { w: { ...w, status: 'cancelled' }, reply: '❌ لغو شد', done: true };
    }
    return { w, reply: 'بگو بله یا نه', done: false };
  }
  
  const field = w.fields[w.currentIndex];
  let value: any = a;
  
  // تبدیل نوع
  if (field.type === 'number') {
    const n = extractNumber(a);
    if (n === null && field.required) {
      return { w, reply: '❌ عدد معتبر بگو', done: false };
    }
    value = n || 0;
  } else if (field.type === 'phone') {
    value = norm(a).replace(/[^\d]/g, '');
    if (value.length < 5 && field.required) {
      return { w, reply: '❌ شماره معتبر بگو', done: false };
    }
  } else if (field.type === 'choice' && field.choices) {
    // پیدا کردن گزینه
    const q = norm(a);
    let matched: string | null = null;
    for (const c of field.choices) {
      if (norm(c).includes(q) || q.includes(norm(c))) {
        matched = c;
        break;
      }
    }
    if (!matched && field.required) {
      return { w, reply: '❌ یکی از گزینه‌ها رو بگو: ' + field.choices.join(' | '), done: false };
    }
    value = matched || a;
  }
  
  // ذخیره
  w.data[field.key] = value;
  
  // onAnswer callback
  let extraMsg = '';
  if (field.onAnswer) {
    try {
      await field.onAnswer(value, w.data);
      // چک کن مشتری پیدا شد؟
      if (field.key === 'customer_phone' && w.data._customerFound) {
        extraMsg = '\n✅ این مشتری قبلاً هست: ' + (w.data.customer_name || '');
      }
    } catch (e) { console.log('onAnswer err:', e); }
  }
  
  // اگه customer_name از قبل پر شد، ازش رد شو
  const next = { ...w, currentIndex: w.currentIndex + 1 };
  
  // اگه فیلد بعدی customer_name ولی از قبل پره، برو بعدی
  if (field.key === 'customer_phone' && w.data._customerFound) {
    const nameIdx = w.fields.findIndex(f => f.key === 'customer_name');
    if (nameIdx >= 0 && next.currentIndex === nameIdx + 1) {
      // این فیلد پره، برو بعدی
      next.currentIndex = nameIdx + 1;
    }
  }
  
  // اگه به انتهای لیست رسیدیم → confirming
  if (next.currentIndex >= w.fields.length) {
    next.status = 'confirming';
  }
  
  // سؤال بعدی
  let reply = extraMsg;
  if (next.status === 'confirming') {
    reply += '\n✅ همه چیز آماده — ذخیره کنم؟ (بله/نه)';
    // خلاصه
    reply += '\n\n📋 خلاصه:\n';
    for (const [k, v] of Object.entries(w.data)) {
      if (k.startsWith('_')) continue;
      const f = w.fields.find(x => x.key === k);
      if (f && v !== undefined && v !== '' && v !== null) {
        reply += '   • ' + (f.label.replace(/^[^\s]+ /, '')) + ': ' + v + '\n';
      }
    }
  } else {
    reply += '\n' + getCurrentQuestion(next);
  }
  
  return { w: next, reply, done: false };
}

// ═══════════════════════════════════════════
// ذخیره فرم
// ═══════════════════════════════════════════
async function saveWizard(w: WizardState): Promise<{ ok: boolean; message: string }> {
  try {
    if (w.formKey === 'box') {
      const bx = await import('./lib.boxes');
      await (bx as any).saveBox({
        name: w.data.name,
        currency: w.data.currency || 'AFN',
        owner_name: w.data.owner_name || '',
        opening: Number(w.data.opening) || 0,
        code: 'B_' + Date.now(),
      });
      return { ok: true, message: '✅ صندوق ' + w.data.name + ' ساخته شد' };
    }
    
    if (w.formKey === 'customer') {
      const cc = await import('./lib.fx.cust');
      await (cc as any).saveCust({
        name: w.data.name,
        phone: w.data.phone || '',
        bank: w.data.bank || '',
        holder_name: w.data.holder_name || '',
        code: 'C_' + Date.now(),
      });
      return { ok: true, message: '✅ مشتری ' + w.data.name + ' اضافه شد' };
    }
    
    if (w.formKey === 'hawala') {
      const fx = await import('./lib.fx');
      await (fx as any).createHawala({
        direction: w.data.direction === 'دریافت' ? 'receive' : 'send',
        amount: Number(w.data.amount) || 0,
        currency: w.data.currency || 'AFN',
        sender_name: w.data.sender_name,
        beneficiary_name: w.data.beneficiary_name,
        beneficiary_phone: w.data.beneficiary_phone || '',
        beneficiary_city: w.data.beneficiary_city || '',
        status: 'pending',
        date: new Date().toISOString(),
      });
      return { ok: true, message: '✅ حواله ثبت شد' };
    }
    
    if (w.formKey === 'rate') {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem('@mizan_local_daily_rates');
      const rates = raw ? JSON.parse(raw) : [];
      rates.unshift({
        currency: w.data.currency,
        rate: Number(w.data.rate) || 0,
        date: new Date().toISOString(),
      });
      await AsyncStorage.setItem('@mizan_local_daily_rates', JSON.stringify(rates.slice(0, 500)));
      return { ok: true, message: '✅ نرخ ' + w.data.currency + ' ثبت شد: ' + w.data.rate };
    }
    
    if (w.formKey === 'check') {
      const fx = await import('./lib.fx');
      await (fx as any).createCheck?.({
        direction: w.data.direction === 'دریافت' ? 'in' : 'out',
        check_number: w.data.check_number,
        bank: w.data.bank,
        amount: Number(w.data.amount) || 0,
        currency: 'AFN',
        status: 'pending',
      });
      return { ok: true, message: '✅ چک ثبت شد' };
    }
    
    return { ok: false, message: '❌ فرم پشتیبانی نمی‌شه' };
  } catch (e: any) {
    return { ok: false, message: '❌ خطا: ' + (e?.message || '') };
  }
}

// ═══════════════════════════════════════════
// راهنما
// ═══════════════════════════════════════════
export const WIZARD_HELP = [
  '📝 فرم‌های آماده:',
  '   • «فاکتور فروش» یا «فاکتور جدید»',
  '   • «صندوق جدید»',
  '   • «مشتری جدید»',
  '   • «حواله جدید»',
  '   • «نرخ جدید»',
  '   • «چک جدید»',
  '',
  'ربات فیلد به فیلد می‌پرسه — تو فقط جواب بده',
].join('\n');
