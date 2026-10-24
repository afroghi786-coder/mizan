// lib.ts — تقویم، تاریخ، دیتابیس Supabase، ابزارها
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from './lib.storage';

// ═══════════════════════════════════════════════════
// 🔌 Supabase
// ═══════════════════════════════════════════════════
const SUPABASE_URL = 'https://paslxvwlbojdzflbmyoh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc2x4dndsYm9qZHpmbGJteW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjA5MTAsImV4cCI6MjEwNTQ5NjkxMH0.gOkwEyVlRi0C11277KxswLFiMFGf4c-ctMgsGLZQuk4';

let _sbClient: any = null;
let _sbReady = false;
function _initSB() {
  if (_sbReady) return _sbClient;
  _sbReady = true;
  try {
    _sbClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
  } catch (e) {
    console.log('[lib.ts] createClient failed:', e);
    _sbClient = null;
  }
  return _sbClient;
}
export const _safeSupabase = _initSB();
export const supabase: any = _safeSupabase || new Proxy({} as any, {
  get() { return () => { throw new Error('Supabase not initialized'); }; },
});

// ═══════════════════════════════════════════════════
// 🧰 Helpers
// ═══════════════════════════════════════════════════
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
export const parseNum = (v: any): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v ?? '');
  s = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  s = s.replace(/[,\s\u200c\u00a0]/g, '');
  s = s.replace(/[^\d-]/g, '');
  const m = s.match(/-?\d+/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return isNaN(n) ? 0 : n;
};
export const toFaNum = (v: string | number): string =>
  String(v).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
export const normText = (v: any) =>
  String(v ?? '').replace(/[\u200c\u200e\u200f\u202a-\u202e]/g, '').trim();
export const normPhone = (v: any): string => {
  const d = String(v ?? '').replace(/[^\d]/g, '');
  if (!d) return '';
  return d.charAt(0) !== '0' && d.length >= 10 ? '0' + d : d;
};

// ═══════════════════════════════════════════════════
// 📅 تبدیل تقویم
// ═══════════════════════════════════════════════════
export function g2j(gy: number, gm: number, gd: number): [number, number, number] {
  const g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) - 80 + gd + g[gm - 1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let jm: number, jd: number;
  if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); }
  else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
  return [jy, jm, jd];
}
export function j2g(jy: number, jm: number, jd: number) {
  jy += 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8
    + Math.floor(((jy % 33) + 3) / 4) + jd
    + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const sa = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm: number;
  for (gm = 0; gm < 13 && gd > sa[gm]; gm++) gd -= sa[gm];
  return { y: gy, m: gm, d: gd };
}
export function g2h(date: Date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const jd = Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4)
    + Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12)
    - Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) + d - 32075;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hm = Math.floor((24 * l) / 709);
  const hd = l - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;
  return { y: hy, m: hm, d: hd };
}
export function h2g(hy: number, hm: number, hd: number) {
  const jd = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2)
    + hd + 1948440 - 385;
  let l = jd + 68569;
  const n1 = Math.floor((4 * l) / 146097); l -= Math.floor((146097 * n1 + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001); l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const day = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  return { y: 100 * (n1 - 49) + i + l, m: j + 2 - 12 * l, d: day };
}

// ═══════════════════════════════════════════════════
// 📅 نوع تقویم
// ═══════════════════════════════════════════════════
export type CalType = 'jalali' | 'gregorian' | 'hijri';
let _calType: CalType = 'jalali';
export const getCalType = (): CalType => _calType;
export const setCalType = (t: CalType) => { _calType = t; };
export async function loadCalType(): Promise<CalType> {
  const v = await AsyncStorage.getItem('MIZAN_CAL');
  if (v === 'jalali' || v === 'gregorian' || v === 'hijri') _calType = v;
  return _calType;
}
export async function saveCalType(t: CalType) {
  _calType = t;
  await AsyncStorage.setItem('MIZAN_CAL', t);
}

// ═══════════════════════════════════════════════════
// 📅 پارس/ذخیره/نمایش تاریخ
// ═══════════════════════════════════════════════════
export function parseDateAny(v: any): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = s.match(/^(1[34]\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    const g = j2g(+m[1], +m[2], +m[3]);
    return new Date(g.y, g.m - 1, g.d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
export function toStorageDate(d: any): string {
  const dt = d instanceof Date ? d : parseDateAny(d);
  if (!dt || isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}/${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}`;
}
export function toStorageDateFull(d: any): string {
  const dt = d instanceof Date ? d : parseDateAny(d);
  if (!dt || isNaN(dt.getTime())) return '';
  return `${toStorageDate(dt)} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
}
export function formatDateForType(d: Date, type?: CalType): string {
  if (!d || isNaN(d.getTime())) return '';
  const t = type || _calType;
  let dp = '';
  if (t === 'jalali') {
    const [y, m, day] = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    dp = `${y}/${pad2(m)}/${pad2(day)}`;
  } else if (t === 'hijri') {
    const h = g2h(d);
    dp = `${h.y}/${pad2(h.m)}/${pad2(h.d)}`;
  } else {
    dp = `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  }
  return `${dp} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
export const displayDate = (v: any, t?: CalType): string => {
  const d = parseDateAny(v);
  return d ? formatDateForType(d, t) : '';
};
export const displayDateOnly = (v: any, t?: CalType): string =>
  displayDate(v, t).split(' ')[0] || '';
export const jalaliDisplay = (d: Date): string => {
  const [y, m, day] = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${y}/${pad2(m)}/${pad2(day)}`;
};

// ═══════════════════════════════════════════════════
// 🧾 ثابت‌ها
// ═══════════════════════════════════════════════════
export const BANKS = [
  'ملت','ملی','صادرات','تجارت','سپه','پاسارگاد','پارسیان','سامان','رفاه','کشاورزی',
  'مسکن','اقتصاد نوین','سینا','شهر','آینده','دی','کارآفرین','مهر ایران','قوامین',
  'صنعت و معدن','بلوبانک','رسالت','حکمت',
];
export const SHIPPINGS = [
  'پست پیشتاز','تیپاکس','چاپار','پست','باربری','باربری تهرانی','باربری مشهد',
  'باربری اصفهان','باربری تبریز','باربری شیراز','هما','ماهان',
];
export const DASH_RANGE_LABELS: Record<string, string> = {
  today: 'امروز', month: 'ماه جاری', year: 'سال جاری',
  last6months: '۶ ماه اخیر', all: 'کل داده‌ها',
};

// ═══════════════════════════════════════════════════
// 🗂️ Types
// ═══════════════════════════════════════════════════
export interface Product {
  id?: string;
  code: string;
  name: string;
  price: number;
  shelf?: string;
  supplier_code?: string;
  supplier_name?: string;
  supplier_phone?: string;
  payer_name?: string;
  shipping_name?: string;
}
export interface SaleItem {
  modelCode: string;
  modelName: string;
  quantity: number;
  priceUnit: number;
  payment: number;
  depositDate: string;
  bankName: string;
  accountHolder: string;
  accountHolderCode: string;
  description: string;
}
export interface PurchaseItem {
  modelCode: string;
  modelName: string;
  quantity: number;
  priceUnit: number;
  description: string;
}
export interface Settings {
  emails?: string[];
  cal_type?: CalType;
  profit_margin?: number;
  inventory_threshold?: number;
  dashboard_range?: string;
  dashboard_filter?: string;
  auto_delete_enabled?: boolean;
  auto_delete_hours?: number;
  sched_daily?: any;
  sched_weekly?: any;
  theme?: string;
    tab_pins?: Record<string, string>;
}

// ═══════════════════════════════════════════════════
// 🗄️ DB — کالاها
// ═══════════════════════════════════════════════════
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data || []) as Product[];
}
export async function createProduct(p: Product) {
  const { id, ...rest } = p as any;
  const { error } = await supabase.from('products').insert(rest);
  if (error) throw new Error(error.message);
}
export async function updateProduct(idOrPayload: any, pArg?: any) {
  // ۲ حالت: (id, p) از UI، یا ({id, code, p}) از صف سینک
  let id: any, code: any, data: any;
  if (pArg !== undefined) {
    id = idOrPayload; data = pArg; code = pArg?.code;
  } else {
    id = idOrPayload?.id; code = idOrPayload?.code;
    data = idOrPayload?.p || idOrPayload;
  }

  const isLocal = !id || String(id).startsWith('l_') || String(id).startsWith('_');

  // اگر id سروری نداریم، با code پیدا کن
  let targetId = id;
  if (isLocal && code) {
    const { data: found } = await supabase.from('products').select('id').eq('code', code).limit(1);
    targetId = found?.[0]?.id;
  }

  if (!targetId) {
    if (code) {
      const { data: found } = await supabase.from('products').select('id').eq('code', code).limit(1);
      targetId = found?.[0]?.id;
    }
  }

  if (!targetId) throw new Error('id یا code سروری لازم است');

  const clean: any = { ...data };
  delete clean.id; delete clean._localId; delete clean.local_id;
  if (Object.keys(clean).length === 0) return;

  const { error } = await supabase.from('products').update(clean).eq('id', targetId);
  if (error) throw new Error(error.message);
}
export async function deleteProduct(idOrPayload: any) {
  // ۲ حالت: id رشته‌ای از UI، یا ({id, code}) از صف سینک
  let id: any, code: any;
  if (typeof idOrPayload === 'string') {
    id = idOrPayload;
  } else if (idOrPayload && typeof idOrPayload === 'object') {
    id = idOrPayload.id; code = idOrPayload.code;
  }

  const isLocal = !id || String(id).startsWith('l_') || String(id).startsWith('_');

  if (code) {
    const { error } = await supabase.from('products').delete().eq('code', code);
    if (error) throw new Error(error.message);
    return;
  }

  if (isLocal) return; // بدون code قابل حذف از سرور نیست
  if (!id) return;

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════
// 🗄️ DB — فروش
// ═══════════════════════════════════════════════════
export async function lookupCustomerByPhone(phone: string) {
  const p = normPhone(phone);
  if (p.length < 5) return null;
  const { data } = await supabase
    .from('sales')
    .select('customer_name, customer_address, customer_code')
    .eq('customer_phone', p)
    .order('created_at', { ascending: false })
    .limit(1);
  return data && data[0] ? {
    customer_name: data[0].customer_name,
    customer_address: data[0].customer_address,
    customer_code: data[0].customer_code,
  } : null;
}
export async function generateCustomerCode(): Promise<string> {
  const { data } = await supabase
    .from('sales')
    .select('customer_code')
    .like('customer_code', 'M_%')
    .order('customer_code', { ascending: false })
    .limit(50);
  let maxN = 1000;
  (data || []).forEach((r: any) => {
    const m = String(r.customer_code || '').match(/^M_(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN) maxN = n; }
  });
  return 'M_' + (maxN + 1);
}

// ⭐ شماره فاکتور فروش: YYMMDD-NNNN (ترتیبی برای هر کاربر)
// ⭐ شماره فاکتور فروش: YYMMDD-NNNN (افزایشی، هرگز تکرار نمی‌شه)
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const ds = String(now.getFullYear()).slice(-2) + pad2(now.getMonth() + 1) + pad2(now.getDate());
  // ⭐ همه فاکتورهای کاربر (بدون فیلتر تاریخ)
  const { data } = await supabase
    .from('sales')
    .select('invoice_number');
  let maxN = 1000;
  (data || []).forEach((r: any) => {
    const inv = String(r.invoice_number || '');
    // فقط فاکتورهای فروش (بدون P-)
    const m = inv.match(/^\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
  });
  return `${ds}-${maxN + 1}`;
}

// ⭐ شماره فاکتور خرید: P-YYMMDD-NNNN (ترتیبی برای هر کاربر)
// ⭐ شماره فاکتور خرید: P-YYMMDD-NNNN (افزایشی، هرگز تکرار نمی‌شه)
export async function generatePurchaseInvoiceNumber(manualInvoice: string): Promise<string> {
  const now = new Date();
  const ds = String(now.getFullYear()).slice(-2) + pad2(now.getMonth() + 1) + pad2(now.getDate());
  // ⭐ همه فاکتورهای خرید کاربر (بدون فیلتر تاریخ)
  const { data } = await supabase
    .from('purchases')
    .select('invoice_number');
  let maxN = 1000;
  (data || []).forEach((r: any) => {
    const inv = String(r.invoice_number || '');
    // فقط فاکتورهای خرید (با P-)
    const m = inv.match(/^P-\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
  });
  return `P-${ds}-${maxN + 1}`;
}

export async function createSale(payload: {
  invoiceNumber: string; customerCode: string; customerName: string;
  customerPhone: string; customerAddress: string; shipping: string; items: SaleItem[];
  receiverName?: string; receiverCode?: string; receiverBank?: string; receiverAccount?: string;
}) {
  const now = new Date();
  const rows = payload.items.map((it, idx) => ({
    invoice_number: payload.invoiceNumber,
    customer_code: payload.customerCode,
    customer_name: payload.customerName,
    customer_phone: normPhone(payload.customerPhone),
    customer_address: payload.customerAddress || '',
    receiver_name: payload.receiverName || '',
    receiver_code: payload.receiverCode || '',
    receiver_bank: payload.receiverBank || '',
    receiver_account: payload.receiverAccount || '',
    shipping: payload.shipping,
    model_code: it.modelCode || '',
    model_name: it.modelName,
    shelf: it.shelf || '',
    quantity: it.quantity,
    price_unit: it.priceUnit,
    payment: idx === 0 ? (payload.paymentAmount !== undefined ? payload.paymentAmount : (it.payment || 0)) : 0,
    deposit_date: idx === 0 ? (payload.payDate || it.depositDate || '') : '',
    bank_name: idx === 0 ? (payload.receiverBank || it.bankName || '') : '',
    account_holder: idx === 0 ? (payload.receiverName || it.accountHolder || '') : '',
    account_holder_code: idx === 0 ? (payload.receiverCode || it.accountHolderCode || '') : '',
    description: idx === 0 ? (payload.note || it.description || '') : (it.description || ''),
    date_factor: payload.invoiceDate ? toStorageDate(payload.invoiceDate) : toStorageDate(now),
    date_reg: payload.invoiceDate ? toStorageDateFull(payload.invoiceDate) : toStorageDateFull(now),
  }));
  const { error } = await supabase.from('sales').insert(rows);
  if (error) throw new Error(error.message);
  return payload.invoiceNumber;
}
export async function getSalesGrouped() {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const groups: Record<string, any> = {};
  (data || []).forEach((r: any) => {
    if (!groups[r.invoice_number]) {
      groups[r.invoice_number] = {
        invoice: r.invoice_number, name: r.customer_name,
        phone: r.customer_phone, total: 0, paid: 0, items: [],
        date: r.date_reg || r.created_at,
      };
    }
    const g = groups[r.invoice_number];
    g.total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
    g.paid += Number(r.payment) || 0;
    g.items.push(r);
  });
  return Object.values(groups).sort((a: any, b: any) =>
    String(b.date).localeCompare(String(a.date)));
}
export async function deleteSale(invoiceNumber: string) {
  const { error } = await supabase.from('sales').delete().eq('invoice_number', invoiceNumber);
  if (error) throw new Error(error.message);
}
export async function getUnpaidInvoices() {
  const grouped: any[] = await getSalesGrouped();
  return grouped.filter((g) => (g.paid || 0) === 0);
}
export async function searchAllInvoices(q: string) {
  const [sales, purchases] = await Promise.all([
    getSalesGrouped(),
    getPurchasesGrouped(),
  ]);
  const query = (q || '').toLowerCase().trim();
  const filt = (arr: any[], type: string) =>
    arr.map((r) => ({ ...r, type, sheetType: type }))
      .filter((r) => !query ||
        `${r.invoice} ${r.name || ''} ${r.phone || ''}`.toLowerCase().includes(query));
  return [...filt(sales, 'sales'), ...filt(purchases, 'purchases')];
}
export async function getInvoiceDetail(invoiceNumber: string, type?: string) {
  const table = type === 'purchase' ? 'purchases' : 'sales';
  const { data, error } = await supabase
    .from(table).select('*')
    .eq('invoice_number', invoiceNumber)
    .order('created_at');
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data;
  // اگر در جدول اصلی نبود، جدول دیگر را امتحان کن
  if (!type) {
    const otherTable = table === 'sales' ? 'purchases' : 'sales';
    const { data: d2 } = await supabase.from(otherTable).select('*').eq('invoice_number', invoiceNumber).order('created_at');
    return d2 || [];
  }
  return [];
}

// ═══════════════════════════════════════════════════
// 🗄️ DB — خرید
// ═══════════════════════════════════════════════════
export async function lookupSupplierByName(name: string) {
  const { data } = await supabase
    .from('purchases')
    .select('supplier_code, supplier_name, supplier_phone')
    .eq('supplier_name', name)
    .order('created_at', { ascending: false }).limit(1);
  return data && data[0] ? data[0] : null;
}

export async function createPurchase(payload: any) {
  const now = new Date();
  const items: PurchaseItem[] = payload.items || [];
  const totalAll = items.reduce((a, it) => a + it.quantity * it.priceUnit, 0);
  const remaining = totalAll - (payload.paymentAmount || 0);

  // ⭐ شماره داخلی با P- (مستقل از فروش)
  const finalInvoiceNumber = await generatePurchaseInvoiceNumber(payload.manualInvoice || '');

  if (items.length === 0) {
    const { error } = await supabase.from('purchases').insert({
      invoice_number: finalInvoiceNumber,
      manual_invoice: payload.manualInvoice,
      supplier_code: payload.supplierCode || '',
      supplier_name: payload.supplierName,
      supplier_phone: payload.supplierPhone || '',
      model_code: '', model_name: '', quantity: 0, price_unit: 0, amount: 0,
      total_amount: 0, payment: payload.paymentAmount || 0,
      balance: -(payload.paymentAmount || 0),
      description: payload.note || '',
      deposit_date: payload.paymentDate || toStorageDateFull(now),
      bank_name: payload.bankAccount || '',
      account_holder: payload.payerName || '',
      payer_code: payload.payerCode || '',
      receiver: payload.receiverAccount || '',
      date_factor: payload.invoiceDate ? toStorageDate(payload.invoiceDate) : toStorageDate(now),
      date_reg: payload.invoiceDate ? toStorageDateFull(payload.invoiceDate) : toStorageDateFull(now),
    });
    if (error) throw new Error(error.message);
    return finalInvoiceNumber;
  }

  const rows = items.map((it, idx) => ({
    invoice_number: finalInvoiceNumber,
    manual_invoice: payload.manualInvoice,
    supplier_code: payload.supplierCode || '',
    supplier_name: payload.supplierName,
    supplier_phone: payload.supplierPhone || '',
    model_code: it.modelCode || '',
    model_name: it.modelName,
    quantity: it.quantity,
    price_unit: it.priceUnit,
    amount: it.quantity * it.priceUnit,
    total_amount: idx === 0 ? totalAll : 0,
    payment: idx === 0 ? (payload.paymentAmount || 0) : 0,
    balance: idx === 0 ? remaining : 0,
    description: it.description || '',
    deposit_date: idx === 0 ? (payload.paymentDate || toStorageDateFull(now)) : '',
    bank_name: idx === 0 ? (payload.bankAccount || '') : '',
    account_holder: idx === 0 ? (payload.payerName || '') : '',
    payer_code: idx === 0 ? (payload.payerCode || '') : '',
    receiver: idx === 0 ? (payload.receiverAccount || '') : '',
    date_factor: payload.invoiceDate ? toStorageDate(payload.invoiceDate) : toStorageDate(now),
    date_reg: payload.invoiceDate ? toStorageDateFull(payload.invoiceDate) : toStorageDateFull(now),
  }));
  const { error } = await supabase.from('purchases').insert(rows);
  if (error) throw new Error(error.message);
  return finalInvoiceNumber;
}

export async function getPurchasesGrouped() {
  const { data, error } = await supabase
    .from('purchases').select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const groups: Record<string, any> = {};
  (data || []).forEach((r: any) => {
    if (!groups[r.invoice_number]) {
      groups[r.invoice_number] = {
        invoice: r.invoice_number,
        manual: r.manual_invoice,
        name: r.supplier_name,
        phone: r.supplier_phone, total: 0, paid: 0, items: [],
        date: r.date_reg || r.created_at,
      };
    }
    const g = groups[r.invoice_number];
    g.total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
    g.paid += Number(r.payment) || 0;
    g.items.push(r);
  });
  return Object.values(groups);
}
export async function deletePurchase(invoiceNumber: string) {
  const { error } = await supabase.from('purchases').delete().eq('invoice_number', invoiceNumber);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════
// 🗄️ DB — داشبورد و سود
// ═══════════════════════════════════════════════════
export async function getDashboardStats(range: string = 'month', filter: string = 'both') {
  const settings = await getSettings();
  const margin = settings.profit_margin ?? 0.10;

  const now = new Date();
  let startDate: Date | null = null;
  const calType = getCalType();
  
  if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === 'month') {
    try {
      if (calType === 'jalali') {
        const [jy, jm] = g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const g = j2g(jy, jm, 1);
        startDate = new Date(g.y, g.m - 1, g.d);
      } else if (calType === 'hijri') {
        const h = g2h(now);
        const g = h2g(h.y, h.m, 1);
        startDate = new Date(g.y, g.m - 1, g.d);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    } catch (e) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  } else if (range === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1); // برای سال، معمولاً سال میلادی مبناست، اگر نیاز شد تغییر می‌دهیم
  } else if (range === 'last6months') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  const inRange = (d: any) => {
    if (!startDate) return true;
    const dt = parseDateAny(d);
    return !!dt && dt >= startDate && dt <= now;
  };

  const [{ data: pData }, { data: sData }] = await Promise.all([
    supabase.from('purchases').select('*'),
    supabase.from('sales').select('*'),
  ]);

  const purchaseByCode: Record<string, { date: number; price: number }[]> = {};
  const purchaseNames: Record<string, string> = {};
  let totalPurchases = 0, supplierPaid = 0, supplierDebt = 0;
  (pData || []).forEach((r: any) => {
    const pDate = parseDateAny(r.date_factor) || parseDateAny(r.date_reg);
    const code = String(r.model_code || '').trim();
    const name = String(r.model_name || '').trim();
    const price = Number(r.price_unit) || 0;
    if (code && pDate && price > 0) {
      (purchaseByCode[code] ||= []).push({ date: pDate.getTime(), price });
    }
    if (code && name) purchaseNames[code] = name;
    if (filter !== 'sales' && inRange(r.date_factor)) {
      totalPurchases += Number(r.amount || (r.quantity * r.price_unit)) || 0;
      supplierPaid += Number(r.payment) || 0;
      supplierDebt += Number(r.balance) || 0;
    }
  });
  Object.values(purchaseByCode).forEach((arr) => arr.sort((a, b) => a.date - b.date));

  const findPurchaseForSale = (code: string, saleTime: number) => {
    const arr = purchaseByCode[code];
    if (!arr || !arr.length) return { price: 0, source: 'unknown' as const };
    const sd = new Date(saleTime);
    const saleYM = `${sd.getFullYear()}/${pad2(sd.getMonth() + 1)}`;
    for (let k = arr.length - 1; k >= 0; k--) {
      const pd = new Date(arr[k].date);
      const ym = `${pd.getFullYear()}/${pad2(pd.getMonth() + 1)}`;
      if (ym === saleYM && arr[k].date <= saleTime) {
        return { price: arr[k].price, source: 'same-month' as const };
      }
    }
    let lastBefore: any = null;
    for (let k = 0; k < arr.length; k++) {
      if (arr[k].date <= saleTime) lastBefore = arr[k];
      else break;
    }
    if (lastBefore) return { price: lastBefore.price, source: 'historical' as const };
    return { price: 0, source: 'unknown' as const };
  };

  let totalSales = 0, customerPaid = 0, totalProfit = 0;
  const modelProfits: Record<string, any> = {};
  (sData || []).forEach((r: any) => {
    const saleDate = parseDateAny(r.date_factor) || parseDateAny(r.date_reg);
    if (!saleDate) return;
    if (!inRange(r.date_factor)) return;
    const code = String(r.model_code || '').trim();
    const name = String(r.model_name || '').trim();
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    const lineTotal = qty * price;
    const payment = Number(r.payment) || 0;
    if (filter !== 'purchase') {
      totalSales += lineTotal;
      customerPaid += payment;
    }
    if (filter !== 'purchase') {
      const info = findPurchaseForSale(code, saleDate.getTime());
      const rowProfit = info.price > 0 && qty > 0 && price > 0
        ? (price - info.price) * qty : 0;
      totalProfit += rowProfit;
      if (code) {
        if (!modelProfits[code]) {
          modelProfits[code] = {
            code, name: name || purchaseNames[code] || '—',
            purchasePrice: info.price, priceSource: info.source,
            totalQty: 0, totalSales: 0, totalProfit: 0, estimated: false,
          };
        }
        const m = modelProfits[code];
        m.totalQty += qty; m.totalSales += lineTotal; m.totalProfit += rowProfit;
        if (name) m.name = name;
        if (info.price > 0) { m.purchasePrice = info.price; m.priceSource = info.source; }
      }
    }
  });

  const models = Object.values(modelProfits);
  let estimatedCount = 0;
  if (filter !== 'purchase') {
    models.forEach((m: any) => {
      if ((!m.purchasePrice || m.purchasePrice <= 0) && m.totalQty > 0 && m.totalSales > 0) {
        const avgSale = m.totalSales / m.totalQty;
        const estUnit = avgSale * margin;
        m.purchasePrice = avgSale - estUnit;
        m.totalProfit = estUnit * m.totalQty;
        m.priceSource = 'estimated';
        m.estimated = true;
        totalProfit += m.totalProfit;
        estimatedCount++;
      }
    });
  }
  (models as any[]).sort((a, b) => b.totalProfit - a.totalProfit);

  return {
    totalSales, totalPurchases, customerPaid,
    customerDebt: totalSales - customerPaid,
    supplierPaid, supplierDebt,
    profit: totalProfit,
    models, estimatedCount,
    defaultMargin: margin,
    rangeLabel: DASH_RANGE_LABELS[range] || range,
  };
}
export async function getProfitByModel() {
  const d = await getDashboardStats('month', 'both');
  return d.models;
}

// ═══════════════════════════════════════════════════
// 🗄️ DB — انبار
// ═══════════════════════════════════════════════════
export async function getInventory() {
  const settings = await getSettings();
  const threshold = settings.inventory_threshold ?? 5;
  const [{ data: pData }, { data: sData }, { data: aData }, products] = await Promise.all([
    supabase.from('purchases').select('model_code, model_name, quantity, price_unit, date_factor, date_reg'),
    supabase.from('sales').select('model_code, model_name, quantity, price_unit, date_factor, date_reg'),
    supabase.from('stock_adjustments').select('model_code, adjustment'),
    getProducts(),
  ]);
  const adjustmentMap: Record<string, number> = {};
  (aData || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    adjustmentMap[c] = (adjustmentMap[c] || 0) + (Number(r.adjustment) || 0);
  });
  const productMap: Record<string, Product> = {};
  products.forEach((p) => { productMap[p.code] = p; });
  const models: Record<string, any> = {};
  const nowTs = Date.now();
  (pData || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    if (!models[c]) models[c] = { code: c, name: r.model_name || '', bought: 0, sold: 0, boughtValue: 0, lastPrice: 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    models[c].bought += qty;
    models[c].boughtValue += qty * price;
    if (r.model_name) models[c].name = r.model_name;
    if (price > 0) models[c].lastPrice = price;
    const d = parseDateAny(r.date_factor || r.date_reg);
    if (d && d.getTime() > models[c].lastPurchaseTime) models[c].lastPurchaseTime = d.getTime();
  });
  (sData || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    if (!models[c]) models[c] = { code: c, name: r.model_name || '', bought: 0, sold: 0, boughtValue: 0, lastPrice: 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    models[c].sold += qty;
    if (price > 0) models[c].lastSalePrice = price;
    if (r.model_name && !models[c].name) models[c].name = r.model_name;
    const d = parseDateAny(r.date_factor || r.date_reg);
    if (d && d.getTime() > models[c].lastSaleTime) models[c].lastSaleTime = d.getTime();
  });
  products.forEach((p) => {
    if (!models[p.code]) {
      models[p.code] = { code: p.code, name: p.name, bought: 0, sold: 0, boughtValue: 0, lastPrice: p.price || 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
    }
  });
  const list = Object.values(models).map((m: any) => {
    const adj = adjustmentMap[m.code] || 0;
    const stock = m.bought - m.sold + adj;
    let status: string = 'ok';
    if (stock < 0) status = 'negative';
    else if (stock === 0) status = 'out';
    else if (stock < threshold) status = 'low';
    const unitCost = m.bought > 0 ? Math.round(m.boughtValue / m.bought) : 0;
    const totalValue = stock * unitCost;
    const potentialRevenue = stock * (m.lastSalePrice || 0);
    const lastPurchaseDate = m.lastPurchaseTime ? new Date(m.lastPurchaseTime) : null;
    const lastSaleDate = m.lastSaleTime ? new Date(m.lastSaleTime) : null;
    const daysSinceLastSale = lastSaleDate ? Math.floor((nowTs - m.lastSaleTime) / 86400000) : null;
    const daysSincePurchase = lastPurchaseDate ? Math.floor((nowTs - m.lastPurchaseTime) / 86400000) : null;
    return {
      ...m,
      currentQty: stock,
      adjustment: adj,
      shelf: productMap[m.code]?.shelf || '',
      status,
      unitCost,
      totalValue,
      potentialRevenue,
      lastPurchaseDate: lastPurchaseDate ? lastPurchaseDate.toISOString() : '',
      lastSaleDate: lastSaleDate ? lastSaleDate.toISOString() : '',
      daysSinceLastSale,
      daysSincePurchase,
    };
  });
  const order: Record<string, number> = { negative: 0, out: 1, low: 2, ok: 3 };
  list.sort((a: any, b: any) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return String(a.name).localeCompare(String(b.name), 'fa');
  });
  const stats = {
    totalModels: list.length,
    totalQty: list.reduce((a: number, m: any) => a + m.currentQty, 0),
    lowStock: list.filter((m: any) => m.status === 'low').length,
    outOfStock: list.filter((m: any) => m.status === 'out').length,
    negative: list.filter((m: any) => m.status === 'negative').length,
    totalValue: list.reduce((a: number, m: any) => a + m.totalValue, 0),
    potentialRevenue: list.reduce((a: number, m: any) => a + m.potentialRevenue, 0),
    topByValue: list.slice().sort((a: any, b: any) => b.totalValue - a.totalValue).slice(0, 5).map((m: any) => ({ code: m.code, name: m.name, value: m.totalValue, qty: m.currentQty })),
    agingBuckets: {
      healthy: list.filter((m: any) => m.currentQty > 0 && m.daysSinceLastSale !== null && m.daysSinceLastSale <= 30).length,
      slow: list.filter((m: any) => m.currentQty > 0 && m.daysSinceLastSale !== null && m.daysSinceLastSale > 30 && m.daysSinceLastSale <= 60).length,
      verySlow: list.filter((m: any) => m.currentQty > 0 && m.daysSinceLastSale !== null && m.daysSinceLastSale > 60 && m.daysSinceLastSale <= 90).length,
      dead: list.filter((m: any) => m.currentQty > 0 && (m.daysSinceLastSale === null || m.daysSinceLastSale > 90)).length,
    },
  };
  return { list, stats, threshold };
}

// ═══════════════════════════════════════════════════
// 🗄️ DB — تنظیمات
// ═══════════════════════════════════════════════════
export async function getSettings(): Promise<Settings> {
  const { data } = await supabase.from('settings').select('*').limit(1);
  const s: Settings = (data && data[0]) || {};
  if (s.cal_type) setCalType(s.cal_type);
  return s;
}
export async function updateSettings(s: Settings) {
  let clean: any = { ...s };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await supabase.from('settings').select('id').limit(1);
    const op = data && data[0]
      ? await supabase.from('settings').update(clean).eq('id', data[0].id)
      : await supabase.from('settings').insert(clean);
    if (!op.error) return;
    const msg = String(op.error.message || '');
    const m = msg.match(/Could not find the '([^']+)' column|column "([^"]+)" of relation "[^"]+" does not exist/i);
    const missing = m && (m[1] || m[2]);
    if (missing && clean[missing] !== undefined) {
      clean = { ...clean };
      delete clean[missing];
      console.log('[updateSettings] stripped missing column:', missing);
      continue;
    }
    throw new Error(msg);
  }
  throw new Error('settings upload failed after retries');
}


export async function lookupCodeByName(name: string): Promise<string> {
  if (!name || name.length < 2) return '';
  const { data: p1 } = await supabase.from('products').select('supplier_code').eq('supplier_name', name).limit(1);
  if (p1 && p1[0]?.supplier_code) return p1[0].supplier_code;
  const { data: p2 } = await supabase.from('purchases').select('supplier_code').eq('supplier_name', name).limit(1);
  if (p2 && p2[0]?.supplier_code) return p2[0].supplier_code;
  const { data: p3 } = await supabase.from('sales').select('customer_code').eq('customer_name', name).limit(1);
  if (p3 && p3[0]?.customer_code) return p3[0].customer_code;
  return '';
}


// ═══════════════════════════════════════════
//  صرافی
// ═══════════════════════════════════════════
export async function createFxTrade(p: any) {
  const { error } = await supabase.from('fx_trades').insert({
    from_currency: p.from_currency, to_currency: p.to_currency,
    from_qty: p.from_qty, to_qty: p.to_qty, rate: p.rate || 0,
    description: p.description || '', local_id: p.local_id || '',
  });
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════
//  هزینه‌ها
// ═══════════════════════════════════════════
export async function createExpense(p: any) {
  const { error } = await supabase.from('expenses').insert({
    type: p.type, title: p.title, amount: p.amount, date: p.date,
    bank: p.bank || '', description: p.description || '', local_id: p.local_id || '',
  });
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════
//  کارمندان
// ═══════════════════════════════════════════
export async function createEmployee(p: any) {
  const { error } = await supabase.from('employees').insert({
    code: p.code, name: p.name, phone: p.phone || '', role: p.role || '',
    contract_type: p.contract_type, amount: p.amount || 0,
    overtime_rate: p.overtime_rate || 0, local_id: p.local_id || '',
  });
  if (error) throw new Error(error.message);
}

export async function createAttendance(p: any) {
  const { error } = await supabase.from('attendance').insert({
    employee_code: p.employee_code, employee_name: p.employee_name || '',
    date: p.date, status: p.status, hours: p.hours || 0,
    overtime: p.overtime || 0, local_id: p.local_id || '',
  });
  if (error) throw new Error(error.message);
}


export async function createFxCustomer(p: any) {
  const { error } = await supabase.from('fx_customers').insert({
    code: p.code, name: p.name, phone: p.phone || '', bank: p.bank || '',
    holder_name: p.holder_name || '', holder_code: p.holder_code || '',
    notes: p.notes || '', local_id: p.local_id || '',
  });
  if (error) throw new Error(error.message);
}
export async function createFxPartner(p: any) {
  const { error } = await supabase.from('fx_partners').insert({
    code: p.code, name: p.name, phone: p.phone || '', notes: p.notes || '', local_id: p.local_id || '',
  });
  if (error) throw new Error(error.message);
}


// ═══════════════════════════════════════════
//  updateSale / updatePurchase — برای سینک ویرایش آفلاین
// ═══════════════════════════════════════════
export async function updateSale(payload: { invoiceNumber: string; rows: any[] }) {
  const { invoiceNumber, rows } = payload || {};
  if (!invoiceNumber) throw new Error('invoiceNumber لازم است');
  
  // دریافت اطلاعات قبلی برای حفظ متادیتا (مشتری، تاریخ و...)
  const { data: oldRows, error: fetchErr } = await supabase.from('sales').select('*').eq('invoice_number', invoiceNumber).limit(1);
  if (fetchErr) throw fetchErr;
  if (!oldRows || oldRows.length === 0) throw new Error('فاکتور اصلی در سرور پیدا نشد');
  
  const template = oldRows[0];
  const cleanRows = rows.filter((r: any) => !r._deleted).map((r: any) => {
    const merged = { ...template };
    delete merged.id; delete merged.created_at; // اجازه بده تا سرور رکورد جدید بسازد
    merged.model_code = r.modelCode || '';
    merged.model_name = r.modelName || '';
    merged.quantity = Number(r.quantity) || 0;
    merged.price_unit = Number(r.priceUnit) || 0;
    merged.payment = Number(r.payment) || 0;
    merged.amount = (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0);
    merged.description = r.description || '';
    if (r.dateFactor) merged.date_factor = r.dateFactor;
    if (r.dateReg) merged.date_reg = r.dateReg;
    if (r.bankName) merged.bank_name = r.bankName;
    if (r.accountHolder) merged.account_holder = r.accountHolder;
    if (r.accountHolderCode) merged.account_holder_code = r.accountHolderCode;
    if (r.depositDate) merged.deposit_date = r.depositDate;
    return merged;
  });

  const { error: delErr } = await supabase.from('sales').delete().eq('invoice_number', invoiceNumber);
  if (delErr) throw delErr;
  if (cleanRows.length) {
    const { error } = await supabase.from('sales').insert(cleanRows);
    if (error) throw error;
  }
}

export async function updatePurchase(payload: { invoiceNumber: string; rows: any[] }) {
  const { invoiceNumber, rows } = payload || {};
  if (!invoiceNumber) throw new Error('invoiceNumber لازم است');
  
  const { data: oldRows, error: fetchErr } = await supabase.from('purchases').select('*').eq('invoice_number', invoiceNumber).limit(1);
  if (fetchErr) throw fetchErr;
  if (!oldRows || oldRows.length === 0) throw new Error('فاکتور اصلی در سرور پیدا نشد');
  
  const template = oldRows[0];
  const cleanRows = rows.filter((r: any) => !r._deleted).map((r: any) => {
    const merged = { ...template };
    delete merged.id; delete merged.created_at;
    merged.model_code = r.modelCode || '';
    merged.model_name = r.modelName || '';
    merged.quantity = Number(r.quantity) || 0;
    merged.price_unit = Number(r.priceUnit) || 0;
    merged.payment = Number(r.payment) || 0;
    merged.amount = (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0);
    merged.description = r.description || '';
    if (r.dateFactor) merged.date_factor = r.dateFactor;
    if (r.dateReg) merged.date_reg = r.dateReg;
    return merged;
  });

  const { error: delErr } = await supabase.from('purchases').delete().eq('invoice_number', invoiceNumber);
  if (delErr) throw delErr;
  if (cleanRows.length) {
    const { error } = await supabase.from('purchases').insert(cleanRows);
    if (error) throw error;
  }
}


// ═══════════════════════════════════════════
//  updateExpense / deleteExpense — برای سینک صف هزینه‌ها
// ═══════════════════════════════════════════
export async function updateExpense(p: any) {
  const id = p?.local_id || p?.id;
  if (!id) throw new Error('local_id لازم است');
  const clean: any = { ...p };
  delete clean.id; delete clean.user_id;
  const { error: delErr } = await supabase.from('expenses').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (delErr) throw delErr;
  const { error } = await supabase.from('expenses').insert(clean);
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  if (!id) throw new Error('id لازم است');
  const { error } = await supabase.from('expenses').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw error;
}


// ═══════════════════════════════════════════
//  Sync helpers for employees module (offline queue)
// ═══════════════════════════════════════════
async function _empUpsert(table: string, p: any) {
  const id = p?.local_id || p?.id;
  if (!id) throw new Error('local_id لازم');
  let clean: any = { ...p };
  delete clean.id; delete clean.user_id;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error: delErr } = await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id);
    if (delErr) throw delErr;
    const { error } = await supabase.from(table).insert(clean);
    if (!error) return;
    const m = error.message.match(/Could not find the '([^']+)' column|column "([^"]+)" of relation "[^"]+" does not exist/i);
    const missing = m && (m[1] || m[2]);
    if (missing && clean[missing] !== undefined) {
      clean = { ...clean };
      delete clean[missing];
      console.log('[upload] stripped missing column:', missing);
      continue;
    }
    throw error;
  }
  throw new Error('upload failed after retries');
}
async function _empDelete(table: string, id: string) {
  if (!id) throw new Error('id لازم');
  const { error } = await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw error;
}
async function _empCreate(table: string, p: any) {
  let clean: any = { ...p };
  delete clean.id; delete clean.user_id;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from(table).insert(clean);
    if (!error) return;
    const m = error.message.match(/Could not find the '([^']+)' column|column "([^"]+)" of relation "[^"]+" does not exist/i);
    const missing = m && (m[1] || m[2]);
    if (missing && clean[missing] !== undefined) {
      clean = { ...clean };
      delete clean[missing];
      console.log('[upload] stripped missing column:', missing);
      continue;
    }
    throw error;
  }
  throw new Error('upload failed after retries');
}

export const updateEmployee = (p: any) => _empUpsert('employees', p);
export const deleteEmployee = (id: string) => _empDelete('employees', id);

export const updateAttendance = (p: any) => _empUpsert('attendance', p);
export const deleteAttendance = (id: string) => _empDelete('attendance', id);

export const createLeave = (p: any) => _empCreate('employee_leaves', p);
export const updateLeave = (p: any) => _empUpsert('employee_leaves', p);
export const deleteLeave = (id: string) => _empDelete('employee_leaves', id);

export const createSalaryPayment = (p: any) => _empCreate('salary_payments', p);
export const updateSalaryPayment = (p: any) => _empUpsert('salary_payments', p);
export const deleteSalaryPayment = (id: string) => _empDelete('salary_payments', id);

export const createLoan = (p: any) => _empCreate('employee_loans', p);
export const updateLoan = (p: any) => _empUpsert('employee_loans', p);
export const deleteLoan = (id: string) => _empDelete('employee_loans', id);

export const createBatch = (p: any) => _empCreate('payroll_batches', p);
export const updateBatch = (p: any) => _empUpsert('payroll_batches', p);
export const deleteBatch = (id: string) => _empDelete('payroll_batches', id);

// ═══════════════════════════════════════════
//  getInventoryByModel — کاردکس مدل (خرید/فروش)
// ═══════════════════════════════════════════
export async function getInventoryByModel(code: string) {
  const c = String(code || '').trim();
  if (!c) return { purchases: [], sales: [] };
  const [{ data: pData, error: pErr }, { data: sData, error: sErr }] = await Promise.all([
    supabase.from('purchases').select('*').eq('model_code', c).order('created_at', { ascending: true }),
    supabase.from('sales').select('*').eq('model_code', c).order('created_at', { ascending: true }),
  ]);
  if (pErr) console.log('[getInventoryByModel] purchases err:', pErr.message);
  if (sErr) console.log('[getInventoryByModel] sales err:', sErr.message);
  return { purchases: pData || [], sales: sData || [] };
}
// ═══════════════════════════════════════════
//  Stock Adjustments
// ═══════════════════════════════════════════
export async function getStockAdjustments(code?: string) {
  let q: any = supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false });
  if (code) q = q.eq('model_code', String(code).trim());
  const { data, error } = await q;
  if (error) { console.log('[getStockAdjustments]', error.message); return []; }
  return data || [];
}
export async function createStockAdjustment(p: any) {
  const clean: any = { ...p };
  delete clean.id; delete clean.user_id;
  const { error } = await supabase.from('stock_adjustments').insert(clean);
  if (error) throw new Error(error.message);
  return clean;
}
export async function deleteStockAdjustment(id: string) {
  const { error } = await supabase.from('stock_adjustments').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}
// ═══════════════════════════════════════════
//  Parties — طرف‌حساب‌ها (تأمین‌کننده/مشتری/هر دو)
// ═══════════════════════════════════════════
export async function getParties(type?: string) {
  let q: any = supabase.from('parties').select('*').order('name', { ascending: true });
  if (type) q = q.in('type', [type, 'both']);
  const { data, error } = await q;
  if (error) { console.log('[getParties]', error.message); return []; }
  return data || [];
}

export async function createParty(p: any) {
  const clean: any = { ...p };
  delete clean.id; delete clean.user_id;
  if (!clean.local_id) clean.local_id = 'party_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  if (!clean.created_at) clean.created_at = new Date().toISOString();
  clean.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('parties').insert(clean).select().single();
  if (error) throw new Error(error.message);
  return data || clean;
}

export async function updateParty(idOrPayload: any, pArg?: any) {
  const payload: any = pArg ? { ...pArg } : { ...idOrPayload };
  const id = typeof idOrPayload === 'string' ? idOrPayload : (payload.local_id || payload.id);
  if (!id) throw new Error('شناسه طرف‌حساب لازم است');
  const clean: any = { ...payload };
  delete clean.id; delete clean.user_id;
  clean.updated_at = new Date().toISOString();
  const { error } = await supabase.from('parties').update(clean).or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
  return clean;
}

export async function deleteParty(idOrPayload: any) {
  const id = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload?.local_id || idOrPayload?.id);
  if (!id) throw new Error('شناسه طرف‌حساب لازم است');
  const { error } = await supabase.from('parties').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}

export async function lookupPartyByPhone(phone: string) {
  const p = String(phone || '').replace(/[^0-9]/g, '');
  if (!p) return null;
  const { data } = await supabase.from('parties').select('*').eq('phone', p).limit(1);
  return (data && data[0]) || null;
}

export async function lookupPartyByName(name: string) {
  const n = String(name || '').trim();
  if (!n) return null;
  const { data } = await supabase.from('parties').select('*').eq('name', n).limit(1);
  return (data && data[0]) || null;
}
// ═══════════════════════════════════════════
//  Partners & Bank Accounts & Transactions
// ═══════════════════════════════════════════
export async function getPartners() {
  const { data, error } = await supabase.from('partners').select('*').order('code', { ascending: true });
  if (error) { console.log('[getPartners]', error.message); return []; }
  return data || [];
}
export async function createPartner(p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  if (!clean.local_id) clean.local_id = 'pt_' + Date.now();
  const { error } = await supabase.from('partners').insert(clean);
  if (error) throw new Error(error.message);
  return clean;
}
export async function updatePartner(id: string, p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  const { error } = await supabase.from('partners').update(clean).or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}
export async function deletePartner(id: string) {
  const { error } = await supabase.from('partners').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}

export async function getPartnerBankAccounts(partnerCode: string) {
  const { data, error } = await supabase.from('partner_bank_accounts').select('*').eq('partner_code', partnerCode);
  if (error) { console.log('[getPBA]', error.message); return []; }
  return data || [];
}
export async function createPartnerBankAccount(p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  if (!clean.local_id) clean.local_id = 'pba_' + Date.now();
  const { error } = await supabase.from('partner_bank_accounts').insert(clean);
  if (error) throw new Error(error.message);
  return clean;
}
export async function updatePartnerBankAccount(id: string, p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  const { error } = await supabase.from('partner_bank_accounts').update(clean).or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}
export async function deletePartnerBankAccount(id: string) {
  const { error } = await supabase.from('partner_bank_accounts').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}

export async function getPartnerTransactions(partnerCode: string) {
  const { data, error } = await supabase.from('partner_transactions').select('*').eq('partner_code', partnerCode).order('transaction_date', { ascending: true });
  if (error) { console.log('[getPT]', error.message); return []; }
  return data || [];
}
export async function createPartnerTransaction(p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  if (!clean.local_id) clean.local_id = 'ptx_' + Date.now();
  const { error } = await supabase.from('partner_transactions').insert(clean);
  if (error) throw new Error(error.message);
  return clean;
}
export async function deletePartnerTransaction(id: string) {
  const { error } = await supabase.from('partner_transactions').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}
// ═══════════════════════════════════════════
//  Banks
// ═══════════════════════════════════════════
export async function getBanks() {
  const { data, error } = await supabase.from('banks').select('*').order('name', { ascending: true });
  if (error) { console.log('[getBanks]', error.message); return []; }
  return data || [];
}
export async function createBank(p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  if (!clean.local_id) clean.local_id = 'bank_' + Date.now();
  const { error } = await supabase.from('banks').insert(clean);
  if (error) throw new Error(error.message);
  return clean;
}
export async function updateBank(id: string, p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  const { error } = await supabase.from('banks').update(clean).or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}
export async function deleteBank(id: string) {
  const { error } = await supabase.from('banks').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════
//  Shippings
// ═══════════════════════════════════════════
export async function getShippings() {
  const { data, error } = await supabase.from('shippings').select('*').order('name', { ascending: true });
  if (error) { console.log('[getShippings]', error.message); return []; }
  return data || [];
}
export async function createShipping(p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  if (!clean.local_id) clean.local_id = 'ship_' + Date.now();
  const { error } = await supabase.from('shippings').insert(clean);
  if (error) throw new Error(error.message);
  return clean;
}
export async function updateShipping(id: string, p: any) {
  const clean = { ...p }; delete clean.id; delete clean.user_id;
  const { error } = await supabase.from('shippings').update(clean).or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}
export async function deleteShipping(id: string) {
  const { error } = await supabase.from('shippings').delete().or('local_id.eq.' + id + ',id.eq.' + id);
  if (error) throw new Error(error.message);
}