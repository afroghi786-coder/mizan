// lib.ts — تقویم، تاریخ، دیتابیس Supabase، ابزارها (همه در یک فایل)
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════════════
// 🔌 Supabase
// ═══════════════════════════════════════════════════
const SUPABASE_URL = 'https://xxx.supabase.co';       // ← عوض کن
const SUPABASE_ANON = 'eyJhbGciOi...';                 // ← عوض کن

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ═══════════════════════════════════════════════════
// 🧰 Helpers
// ═══════════════════════════════════════════════════
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
export const parseNum = (v: any): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = String(v ?? '').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
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
// 📅 نوع تقویم (global state)
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
  const { error } = await supabase.from('products').insert(p);
  if (error) throw new Error(error.message);
}
export async function updateProduct(id: string, p: Partial<Product>) {
  const { error } = await supabase.from('products').update(p).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function deleteProduct(id: string) {
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
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const ds = String(now.getFullYear()).slice(-2) + pad2(now.getMonth() + 1) + pad2(now.getDate());
  const { data } = await supabase
    .from('sales')
    .select('invoice_number')
    .order('created_at', { ascending: false })
    .limit(200);
  let maxS = 1000;
  const existing = new Set<string>();
  (data || []).forEach((r: any) => {
    const inv = String(r.invoice_number || '');
    if (!inv) return;
    existing.add(inv);
    const m = inv.match(/-?(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxS && n < 1000000) maxS = n; }
  });
  let next = maxS + 1, cand = `${ds}-${next}`;
  while (existing.has(cand)) { next++; cand = `${ds}-${next}`; }
  return cand;
}
export async function createSale(payload: {
  invoiceNumber: string; customerCode: string; customerName: string;
  customerPhone: string; customerAddress: string; shipping: string; items: SaleItem[];
}) {
  const now = new Date();
  const rows = payload.items.map((it, idx) => ({
    invoice_number: payload.invoiceNumber,
    customer_code: payload.customerCode,
    customer_name: payload.customerName,
    customer_phone: normPhone(payload.customerPhone),
    customer_address: payload.customerAddress || '',
    shipping: payload.shipping,
    model_code: it.modelCode || '',
    model_name: it.modelName,
    quantity: it.quantity,
    price_unit: it.priceUnit,
    payment: idx === 0 ? (it.payment || 0) : 0,
    deposit_date: it.depositDate || '',
    bank_name: it.bankName || '',
    account_holder: it.accountHolder || '',
    description: it.description || '',
    date_factor: toStorageDate(now),
    date_reg: toStorageDateFull(now),
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
export async function getInvoiceDetail(invoiceNumber: string) {
  const { data, error } = await supabase
    .from('sales').select('*')
    .eq('invoice_number', invoiceNumber)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data || [];
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
  if (items.length === 0) {
    const { error } = await supabase.from('purchases').insert({
      invoice_number: payload.invoiceNumber,
      manual_invoice: payload.manualInvoice,
      supplier_code: payload.supplierCode || '',
      supplier_name: payload.supplierName,
      supplier_phone: payload.supplierPhone || '',
      model_code: '', model_name: '', quantity: 0, price_unit: 0, amount: 0,
      total_amount: 0, payment: payload.paymentAmount || 0,
      balance: -payload.paymentAmount || 0,
      description: payload.note || '',
      deposit_date: payload.paymentDate || toStorageDateFull(now),
      bank_name: payload.bankAccount || '',
      account_holder: payload.payerName || '',
      receiver: payload.receiverAccount || '',
      date_factor: toStorageDate(now),
      date_reg: toStorageDateFull(now),
    });
    if (error) throw new Error(error.message);
    return payload.invoiceNumber;
  }
  const rows = items.map((it, idx) => ({
    invoice_number: payload.invoiceNumber,
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
    receiver: idx === 0 ? (payload.receiverAccount || '') : '',
    date_factor: toStorageDate(now),
    date_reg: toStorageDateFull(now),
  }));
  const { error } = await supabase.from('purchases').insert(rows);
  if (error) throw new Error(error.message);
  return payload.invoiceNumber;
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
        invoice: r.invoice_number, name: r.supplier_name,
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
// 🗄️ DB — داشبورد و سود (منطق منبع قیمت مثل وب)
// ═══════════════════════════════════════════════════
export async function getDashboardStats(range: string = 'month', filter: string = 'both') {
  const settings = await getSettings();
  const margin = settings.profit_margin ?? 0.10;

  const now = new Date();
  let startDate: Date | null = null;
  if (range === 'today') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (range === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === 'year') startDate = new Date(now.getFullYear(), 0, 1);
  else if (range === 'last6months') startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const inRange = (d: any) => {
    if (!startDate) return true;
    const dt = parseDateAny(d);
    return !!dt && dt >= startDate && dt <= now;
  };

  const [{ data: pData }, { data: sData }] = await Promise.all([
    supabase.from('purchases').select('*'),
    supabase.from('sales').select('*'),
  ]);

  // خریدها → نقشه قیمت به تفکیک کد مدل
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

  const [{ data: pData }, { data: sData }, products] = await Promise.all([
    supabase.from('purchases').select('model_code, model_name, quantity, price_unit'),
    supabase.from('sales').select('model_code, model_name, quantity'),
    getProducts(),
  ]);

  const productMap: Record<string, Product> = {};
  products.forEach((p) => { productMap[p.code] = p; });

  const models: Record<string, any> = {};
  (pData || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    if (!models[c]) models[c] = { code: c, name: r.model_name || '', bought: 0, sold: 0, lastPrice: 0 };
    models[c].bought += Number(r.quantity) || 0;
    if (r.model_name) models[c].name = r.model_name;
    const p = Number(r.price_unit) || 0;
    if (p > 0) models[c].lastPrice = p;
  });
  (sData || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    if (!models[c]) models[c] = { code: c, name: r.model_name || '', bought: 0, sold: 0, lastPrice: 0 };
    models[c].sold += Number(r.quantity) || 0;
    if (r.model_name && !models[c].name) models[c].name = r.model_name;
  });
  // کالاهای بدون تراکنش
  products.forEach((p) => {
    if (!models[p.code]) {
      models[p.code] = { code: p.code, name: p.name, bought: 0, sold: 0, lastPrice: p.price || 0 };
    }
  });

  const list = Object.values(models).map((m: any) => {
    const stock = m.bought - m.sold;
    let status: string = 'ok';
    if (stock < 0) status = 'negative';
    else if (stock === 0) status = 'out';
    else if (stock < threshold) status = 'low';
    return {
      ...m,
      currentQty: stock,
      shelf: productMap[m.code]?.shelf || '',
      status,
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
  const { data } = await supabase.from('settings').select('id').limit(1);
  if (data && data[0]) {
    const { error } = await supabase.from('settings').update(s).eq('id', data[0].id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('settings').insert(s);
    if (error) throw new Error(error.message);
  }
}
