// lib-db.ts
import { supabase } from './lib-supabase';
import { parseDateAny } from './lib-date';

// ═══════════════════════════════════════════
// 👤 احراز هویت
// ═══════════════════════════════════════════
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('کاربر وارد نشده');
  return user;
}

// ═══════════════════════════════════════════
// 📦 کالاها (منابع)
// ═══════════════════════════════════════════
export async function getProducts() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)          // ⭐ فیلتر
    .order('name');
  if (error) return [];
  return data || [];
}

export async function createProduct(p: any) {
  const user = await requireUser();
  const { error } = await supabase.from('products').insert({ ...p, user_id: user.id });
  if (error) throw error;
}

export async function updateProduct(id: string, p: any) {
  const user = await requireUser();
  const { error } = await supabase.from('products').update(p).eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const user = await requireUser();
  const { error } = await supabase.from('products').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

// ═══════════════════════════════════════════
// 🛒 فاکتور فروش
// ═══════════════════════════════════════════
export async function getSales() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('invoices_sales')
    .select('*')
    .eq('user_id', user.id)          // ⭐ فیلتر
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getSalesGrouped() {
  const all = await getSales();
  const groups: Record<string, any> = {};
  all.forEach((s: any) => {
    const key = s.invoice_number;
    if (!groups[key]) {
      groups[key] = {
        invoice: s.invoice_number,
        name: s.customer_name,
        phone: s.customer_phone,
        code: s.customer_code,
        address: s.customer_address,
        shipping: s.shipping,
        items: [],
        total: 0,
        paid: 0,
        created_at: s.created_at,
      };
    }
    groups[key].items.push(s);
    groups[key].total += (s.quantity || 0) * (s.price || 0);
    groups[key].paid += s.payment || 0;
  });
  return Object.values(groups).sort((a: any, b: any) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

export async function createSale(data: any) {
  const user = await requireUser();
  const rows = data.items.map((item: any, idx: number) => ({
    user_id: user.id,
    invoice_number: data.invoiceNumber,
    customer_code: data.customerCode || '',
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_address: data.customerAddress || '',
    model_code: item.modelCode || '',
    model_name: item.modelName,
    quantity: item.quantity,
    price: item.priceUnit,
    payment: idx === 0 ? (item.payment || 0) : 0,
    shipping: data.shipping || '',
    deposit_date: item.depositDate || null,
    bank_name: item.bankName || '',
    account_holder: item.accountHolder || '',
    description: item.description || '',
  }));
  const { error } = await supabase.from('invoices_sales').insert(rows);
  if (error) throw error;
}

export async function updateSaleRow(id: string, patch: any) {
  const user = await requireUser();
  const { error } = await supabase.from('invoices_sales').update(patch).eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function deleteSale(invoiceNumber: string) {
  const user = await requireUser();
  const { error } = await supabase.from('invoices_sales').delete()
    .eq('invoice_number', invoiceNumber).eq('user_id', user.id);
  if (error) throw error;
}

export async function deleteSaleRow(id: string) {
  const user = await requireUser();
  const { error } = await supabase.from('invoices_sales').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function lookupCustomerByPhone(phone: string) {
  const user = await requireUser();
  const { data } = await supabase.from('invoices_sales')
    .select('customer_name, customer_address, customer_code')
    .eq('customer_phone', phone)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!data || !data.length) return null;
  return data[0];
}

// ═══════════════════════════════════════════
// 🛍️ فاکتور خرید
// ═══════════════════════════════════════════
export async function getPurchases() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('invoices_purchases')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPurchasesGrouped() {
  const all = await getPurchases();
  const groups: Record<string, any> = {};
  all.forEach((s: any) => {
    const key = s.invoice_number;
    if (!groups[key]) {
      groups[key] = {
        invoice: s.invoice_number,
        name: s.supplier_name,
        phone: s.supplier_phone,
        code: s.supplier_code,
        items: [],
        total: 0,
        paid: 0,
        created_at: s.created_at,
      };
    }
    groups[key].items.push(s);
    groups[key].total += (s.quantity || 0) * (s.price || 0);
    groups[key].paid += s.payment || 0;
  });
  return Object.values(groups).sort((a: any, b: any) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

export async function createPurchase(data: any) {
  const user = await requireUser();
  const payAmt = data.paymentAmount || 0;

  if (!data.items || data.items.length === 0) {
    const { error } = await supabase.from('invoices_purchases').insert({
      user_id: user.id,
      invoice_number: data.invoiceNumber,
      supplier_code: data.supplierCode || '',
      supplier_name: data.supplierName,
      supplier_phone: data.supplierPhone || '',
      model_code: '', model_name: '', quantity: 0, price: 0,
      payment: payAmt,
      note: data.note || '',
      payment_date: data.paymentDate || new Date().toISOString(),
      bank_account: data.bankAccount || '',
      payer_name: data.payerName || '',
      receiver_account: data.receiverAccount || '',
    });
    if (error) throw error;
    return;
  }

  const rows = data.items.map((item: any, idx: number) => ({
    user_id: user.id,
    invoice_number: data.invoiceNumber,
    supplier_code: data.supplierCode || '',
    supplier_name: data.supplierName,
    supplier_phone: data.supplierPhone || '',
    model_code: item.modelCode || '',
    model_name: item.modelName,
    quantity: item.quantity,
    price: item.priceUnit,
    payment: idx === 0 ? payAmt : 0,
    note: data.note || '',
    payment_date: data.paymentDate || new Date().toISOString(),
    bank_account: data.bankAccount || '',
    payer_name: data.payerName || '',
    receiver_account: data.receiverAccount || '',
  }));
  const { error } = await supabase.from('invoices_purchases').insert(rows);
  if (error) throw error;
}

export async function updatePurchaseRow(id: string, patch: any) {
  const user = await requireUser();
  const { error } = await supabase.from('invoices_purchases').update(patch).eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function deletePurchase(invoiceNumber: string) {
  const user = await requireUser();
  const { error } = await supabase.from('invoices_purchases').delete()
    .eq('invoice_number', invoiceNumber).eq('user_id', user.id);
  if (error) throw error;
}

export async function deletePurchaseRow(id: string) {
  const user = await requireUser();
  const { error } = await supabase.from('invoices_purchases').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function lookupSupplierByName(name: string) {
  const user = await requireUser();
  const { data } = await supabase.from('invoices_purchases')
    .select('supplier_code, supplier_phone')
    .eq('supplier_name', name)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!data || !data.length) return null;
  return data[0];
}

// ═══════════════════════════════════════════
// 📊 داشبورد — منطق کامل (کپی از وب)
// ═══════════════════════════════════════════
export async function getDashboardStats(range = 'month', filter = 'both') {
  const [sales, purchases] = await Promise.all([getSales(), getPurchases()]);

  const now = new Date();
  let start: Date | null = null;
  if (range === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (range === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === 'year') start = new Date(now.getFullYear(), 0, 1);
  else if (range === 'last6months') start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const inRange = (d: string) => !start || new Date(d) >= start;

  // ⭐ نقشه قیمت خرید بر اساس کد مدل
  const purchaseByCode: Record<string, Array<{ date: number; price: number }>> = {};
  let totalPurchases = 0, supplierPaid = 0, supplierDebt = 0;

  purchases.forEach((p: any) => {
    const pDate = parseDateAny(p.created_at);
    if (p.model_code && pDate && p.price > 0) {
      if (!purchaseByCode[p.model_code]) purchaseByCode[p.model_code] = [];
      purchaseByCode[p.model_code].push({ date: pDate.getTime(), price: p.price });
    }
    if (filter !== 'sales' && inRange(p.created_at)) {
      totalPurchases += (p.quantity || 0) * (p.price || 0);
      supplierPaid += p.payment || 0;
    }
  });
  supplierDebt = totalPurchases - supplierPaid;

  Object.keys(purchaseByCode).forEach((k) => {
    purchaseByCode[k].sort((a, b) => a.date - b.date);
  });

  // ⭐ پیدا کردن قیمت خرید برای هر فروش
  function findPurchaseForSale(code: string, saleTime: number) {
    if (!code || !purchaseByCode[code] || !purchaseByCode[code].length) {
      return { price: 0, source: 'unknown' };
    }
    const arr = purchaseByCode[code];
    const saleDate = new Date(saleTime);
    const saleYM = `${saleDate.getFullYear()}/${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

    // اولویت ۱: خرید هم‌ماه
    for (let k = arr.length - 1; k >= 0; k--) {
      const pd = new Date(arr[k].date);
      const purchYM = `${pd.getFullYear()}/${String(pd.getMonth() + 1).padStart(2, '0')}`;
      if (purchYM === saleYM && arr[k].date <= saleTime) {
        return { price: arr[k].price, source: 'same-month' };
      }
    }
    // اولویت ۲: آخرین خرید قبل
    let lastBefore = null;
    for (let k = 0; k < arr.length; k++) {
      if (arr[k].date <= saleTime) lastBefore = arr[k];
      else break;
    }
    if (lastBefore) return { price: lastBefore.price, source: 'historical' };
    return { price: 0, source: 'unknown' };
  }

  let totalSales = 0, customerPaid = 0, totalProfit = 0;
  const modelProfits: Record<string, any> = {};

  if (filter !== 'purchase') {
    sales.forEach((s: any) => {
      if (!inRange(s.created_at)) return;
      const saleDate = parseDateAny(s.created_at);
      const qty = s.quantity || 0;
      const price = s.price || 0;
      const line = qty * price;
      totalSales += line;
      customerPaid += s.payment || 0;

      const info = findPurchaseForSale(s.model_code, saleDate ? saleDate.getTime() : 0);
      let rowProfit = 0;
      if (info.price > 0 && qty > 0 && price > 0) {
        rowProfit = (price - info.price) * qty;
        totalProfit += rowProfit;
      }
      const key = s.model_code || s.model_name;
      if (!key) return;
      if (!modelProfits[key]) {
        modelProfits[key] = {
          code: s.model_code,
          name: s.model_name || '—',
          purchasePrice: info.price,
          priceSource: info.source,
          totalQty: 0, totalSales: 0, totalProfit: 0,
          estimated: false,
        };
      }
      modelProfits[key].totalQty += qty;
      modelProfits[key].totalSales += line;
      modelProfits[key].totalProfit += rowProfit;
      if (info.price > 0) {
        modelProfits[key].purchasePrice = info.price;
        modelProfits[key].priceSource = info.source;
      }
    });
  }

  // ⭐ تخمین برای مدل‌های بدون خرید
  const DEFAULT_MARGIN = 0.10;
  let estimatedCount = 0;
  Object.values(modelProfits).forEach((m: any) => {
    if ((!m.purchasePrice || m.purchasePrice <= 0) && m.totalQty > 0 && m.totalSales > 0) {
      const avgSale = m.totalSales / m.totalQty;
      const estUnitProfit = avgSale * DEFAULT_MARGIN;
      const estTotal = estUnitProfit * m.totalQty;
      const estPurchase = avgSale - estUnitProfit;
      m.purchasePrice = estPurchase;
      m.totalProfit = estTotal;
      m.priceSource = 'estimated';
      m.estimated = true;
      totalProfit += estTotal;
      estimatedCount++;
    }
  });

  const customerDebt = totalSales - customerPaid;

  return {
    totalSales,
    totalPurchases,
    customerPaid,
    customerDebt,
    supplierPaid,
    supplierDebt,
    profit: totalProfit,
    estimatedCount,
    defaultMargin: DEFAULT_MARGIN,
    models: Object.values(modelProfits).sort((a: any, b: any) => b.totalProfit - a.totalProfit),
  };
}

// ═══════════════════════════════════════════
// 💹 سود به تفکیک مدل
// ═══════════════════════════════════════════
export async function getProfitByModel() {
  const stats = await getDashboardStats('all', 'sales');
  return stats.models || [];
}

// ═══════════════════════════════════════════
// 📦 انبار — کامل (با قفسه)
// ═══════════════════════════════════════════
export async function getInventory() {
  const [products, sales, purchases] = await Promise.all([
    getProducts(), getSales(), getPurchases(),
  ]);

  const stats: Record<string, any> = {};

  products.forEach((p: any) => {
    if (!p.code) return;
    stats[p.code] = {
      code: p.code, name: p.name,
      shelf: p.shelf || '',
      bought: 0, sold: 0,
    };
  });

  purchases.forEach((p: any) => {
    if (!p.model_code) return;
    if (!stats[p.model_code]) {
      stats[p.model_code] = { code: p.model_code, name: p.model_name, shelf: '', bought: 0, sold: 0 };
    }
    stats[p.model_code].bought += p.quantity || 0;
  });

  sales.forEach((s: any) => {
    if (!s.model_code) return;
    if (!stats[s.model_code]) {
      stats[s.model_code] = { code: s.model_code, name: s.model_name, shelf: '', bought: 0, sold: 0 };
    }
    stats[s.model_code].sold += s.quantity || 0;
  });

  return Object.values(stats).map((s: any) => {
    const currentQty = s.bought - s.sold;
    let status = 'ok';
    if (currentQty < 0) status = 'negative';
    else if (currentQty === 0) status = 'out';
    else if (currentQty < 5) status = 'low';
    return { ...s, currentQty, status };
  }).sort((a: any, b: any) => {
    const order: any = { negative: 0, out: 1, low: 2, ok: 3 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return String(a.name).localeCompare(String(b.name), 'fa');
  });
}

// ═══════════════════════════════════════════
// 🔍 جستجو و جزئیات
// ═══════════════════════════════════════════
export async function searchAllInvoices(query = '') {
  const [sales, purchases] = await Promise.all([getSalesGrouped(), getPurchasesGrouped()]);
  const all = [
    ...sales.map((s: any) => ({ ...s, type: 'sales' })),
    ...purchases.map((p: any) => ({ ...p, type: 'purchases' })),
  ];
  all.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter((i: any) =>
    String(i.invoice).toLowerCase().includes(q) ||
    String(i.name || '').toLowerCase().includes(q) ||
    String(i.phone || '').toLowerCase().includes(q)
  );
}

export async function getInvoiceDetails(invoiceNumber: string, type: 'sales' | 'purchases') {
  const user = await requireUser();
  const table = type === 'sales' ? 'invoices_sales' : 'invoices_purchases';
  const { data, error } = await supabase.from(table).select('*')
    .eq('invoice_number', invoiceNumber)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════
// 🗑️ پرداخت‌نشده
// ═══════════════════════════════════════════
export async function getUnpaidInvoices() {
  const sales = await getSalesGrouped();
  return sales.filter((s: any) => s.paid === 0);
}

// ═══════════════════════════════════════════
// ⚙️ تنظیمات کاربر
// ═══════════════════════════════════════════
export async function getSettings() {
  const user = await requireUser();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();     // ⭐ رفع باگ single
  return data;
}

export async function updateSettings(patch: any) {
  const user = await requireUser();
  const { error } = await supabase.from('subscriptions').upsert({
    user_id: user.id,
    ...patch,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ═══════════════════════════════════════════
// 🆔 شماره فاکتور / کد مشتری (از سرور)
// ═══════════════════════════════════════════
// ⭐ این‌ها از Supabase RPC صدا زده می‌شوند تا تصادم نکنند
export async function generateInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invoice_number');
  if (error || !data) {
    // fallback
    const ds = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `${ds}-${Date.now() % 10000}`;
  }
  return data;
}

export async function generateCustomerCode(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_customer_code');
  if (error || !data) {
    return 'M_' + String(Date.now()).slice(-6);
  }
  return data;
}

// ═══════════════════════════════════════════
// 📅 ابزارها
// ═══════════════════════════════════════════
export function formatPrice(n: number | null | undefined) {
  if (!n || n === 0) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export function formatDate(d: string | Date | null) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}/${p(dt.getMonth() + 1)}/${p(dt.getDate())}`;
}

export function formatDateTime(d: string | Date | null) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${formatDate(dt)} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
}
