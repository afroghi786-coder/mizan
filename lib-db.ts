import { supabase } from './lib-supabase';

// ═══════════════════════════════════════════
// 👤 احراز هویت
// ═══════════════════════════════════════════
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ═══════════════════════════════════════════
// 📦 کالاها (منابع)
// ═══════════════════════════════════════════
export async function getProducts() {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) return [];
  return data || [];
}

export async function createProduct(p: any) {
  const user = await getCurrentUser();
  if (!user) throw new Error('کاربر وارد نشده');
  const { error } = await supabase.from('products').insert({ ...p, user_id: user.id });
  if (error) throw error;
}

export async function updateProduct(id: string, p: any) {
  const { error } = await supabase.from('products').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ═══════════════════════════════════════════
// 🛒 فاکتور فروش
// ═══════════════════════════════════════════
export async function getSales() {
  const { data, error } = await supabase.from('invoices_sales').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// گروه‌بندی بر اساس شماره فاکتور
export async function getSalesGrouped() {
  const all = await getSales();
  const groups: any = {};
  all.forEach((s: any) => {
    if (!groups[s.invoice_number]) {
      groups[s.invoice_number] = {
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
    groups[s.invoice_number].items.push(s);
    groups[s.invoice_number].total += (s.quantity || 0) * (s.price || 0);
    groups[s.invoice_number].paid += (s.payment || 0);
  });
  return Object.values(groups);
}

export async function createSale(data: any) {
  const user = await getCurrentUser();
  if (!user) throw new Error('کاربر وارد نشده');
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

// ویرایش چند ردیف از یک فاکتور
export async function updateSaleRow(id: string, patch: any) {
  const { error } = await supabase.from('invoices_sales').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteSale(invoiceNumber: string) {
  const { error } = await supabase.from('invoices_sales').delete().eq('invoice_number', invoiceNumber);
  if (error) throw error;
}

export async function deleteSaleRow(id: string) {
  const { error } = await supabase.from('invoices_sales').delete().eq('id', id);
  if (error) throw error;
}

export async function lookupCustomerByPhone(phone: string) {
  const { data } = await supabase.from('invoices_sales')
    .select('customer_name, customer_address, customer_code')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false }).limit(1);
  if (!data || !data.length) return null;
  return data[0];
}

// ═══════════════════════════════════════════
// 🛍️ فاکتور خرید
// ═══════════════════════════════════════════
export async function getPurchases() {
  const { data, error } = await supabase.from('invoices_purchases').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPurchasesGrouped() {
  const all = await getPurchases();
  const groups: any = {};
  all.forEach((s: any) => {
    if (!groups[s.invoice_number]) {
      groups[s.invoice_number] = {
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
    groups[s.invoice_number].items.push(s);
    groups[s.invoice_number].total += (s.quantity || 0) * (s.price || 0);
    groups[s.invoice_number].paid += (s.payment || 0);
  });
  return Object.values(groups);
}

export async function createPurchase(data: any) {
  const user = await getCurrentUser();
  if (!user) throw new Error('کاربر وارد نشده');

  const payAmt = data.paymentAmount || 0;

  // اگر هیچ مدلی نیست → فقط یک ردیف پرداخت
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

  // حالت عادی: چند مدل
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
  const { error } = await supabase.from('invoices_purchases').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePurchase(invoiceNumber: string) {
  const { error } = await supabase.from('invoices_purchases').delete().eq('invoice_number', invoiceNumber);
  if (error) throw error;
}

export async function deletePurchaseRow(id: string) {
  const { error } = await supabase.from('invoices_purchases').delete().eq('id', id);
  if (error) throw error;
}

export async function lookupSupplierByName(name: string) {
  const { data } = await supabase.from('invoices_purchases')
    .select('supplier_code, supplier_phone')
    .eq('supplier_name', name).order('created_at', { ascending: false }).limit(1);
  if (!data || !data.length) return null;
  return data[0];
}

// ═══════════════════════════════════════════
// 📊 داشبورد آماری
// ═══════════════════════════════════════════
export async function getDashboardStats(range: string = 'month', filter: string = 'both') {
  const sales = await getSales();
  const purchases = await getPurchases();

  const now = new Date();
  let start: Date | null = null;
  if (range === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (range === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === 'year') start = new Date(now.getFullYear(), 0, 1);
  else if (range === 'last6months') start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const inRange = (d: string) => !start || new Date(d) >= start;

  let totalSales = 0, customerPaid = 0;
  let totalPurchases = 0, supplierPaid = 0, supplierDebt = 0;

  if (filter !== 'purchase') {
    sales.forEach((s: any) => {
      if (!inRange(s.created_at)) return;
      totalSales += (s.quantity || 0) * (s.price || 0);
      customerPaid += s.payment || 0;
    });
  }
  if (filter !== 'sales') {
    purchases.forEach((p: any) => {
      if (!inRange(p.created_at)) return;
      totalPurchases += (p.quantity || 0) * (p.price || 0);
      supplierPaid += p.payment || 0;
    });
    supplierDebt = totalPurchases - supplierPaid;
  }

  const customerDebt = totalSales - customerPaid;
  const profit = Math.round(totalSales * 0.10);

  return {
    totalSales, totalPurchases, customerPaid, customerDebt,
    supplierPaid, supplierDebt, profit,
  };
}

// ═══════════════════════════════════════════
// 💹 سود به تفکیک مدل
// ═══════════════════════════════════════════
export async function getProfitByModel() {
  const sales = await getSales();
  const purchases = await getPurchases();

  const purchasePrice: any = {};
  purchases.forEach((p: any) => {
    if (p.model_code && p.price > 0) purchasePrice[p.model_code] = p.price;
  });

  const models: any = {};
  sales.forEach((s: any) => {
    const code = s.model_code || s.model_name;
    if (!code) return;
    if (!models[code]) {
      models[code] = {
        code, name: s.model_name || '—',
        purchasePrice: purchasePrice[s.model_code] || 0,
        totalQty: 0, totalSales: 0, totalProfit: 0,
      };
    }
    const qty = s.quantity || 0;
    const price = s.price || 0;
    const line = qty * price;
    models[code].totalQty += qty;
    models[code].totalSales += line;
    const buy = models[code].purchasePrice;
    if (buy > 0) models[code].totalProfit += (price - buy) * qty;
    else models[code].totalProfit += line * 0.10;
  });

  return Object.values(models).sort((a: any, b: any) => b.totalProfit - a.totalProfit);
}

// ═══════════════════════════════════════════
// 📦 انبار
// ═══════════════════════════════════════════
export async function getInventory() {
  const products = await getProducts();
  const sales = await getSales();
  const purchases = await getPurchases();

  const stats: any = {};
  products.forEach((p: any) => {
    if (!p.code) return;
    stats[p.code] = { code: p.code, name: p.name, shelf: p.shelf || '', bought: 0, sold: 0 };
  });
  purchases.forEach((p: any) => {
    if (!p.model_code) return;
    if (!stats[p.model_code]) stats[p.model_code] = { code: p.model_code, name: p.model_name, shelf: '', bought: 0, sold: 0 };
    stats[p.model_code].bought += p.quantity || 0;
  });
  sales.forEach((s: any) => {
    if (!s.model_code) return;
    if (!stats[s.model_code]) stats[s.model_code] = { code: s.model_code, name: s.model_name, shelf: '', bought: 0, sold: 0 };
    stats[s.model_code].sold += s.quantity || 0;
  });

  return Object.values(stats).map((s: any) => ({
    ...s, currentQty: s.bought - s.sold,
  })).sort((a: any, b: any) => a.currentQty - b.currentQty);
}

// ═══════════════════════════════════════════
// 🔍 جستجوی همه فاکتورها
// ═══════════════════════════════════════════
export async function searchAllInvoices(query: string = '') {
  const sales = await getSalesGrouped();
  const purchases = await getPurchasesGrouped();

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

// دریافت جزئیات یک فاکتور
export async function getInvoiceDetails(invoiceNumber: string, type: 'sales' | 'purchases') {
  const table = type === 'sales' ? 'invoices_sales' : 'invoices_purchases';
  const { data, error } = await supabase.from(table).select('*')
    .eq('invoice_number', invoiceNumber)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════
// 🗑️ فاکتورهای پرداخت‌نشده (برای حذف خودکار)
// ═══════════════════════════════════════════
export async function getUnpaidInvoices() {
  const sales = await getSalesGrouped();
  return sales.filter((s: any) => s.paid === 0);
}

// ═══════════════════════════════════════════
// ⚙️ تنظیمات کاربر (در جدول subscriptions)
// ═══════════════════════════════════════════
export async function getSettings() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).single();
  return data;
}

export async function updateSettings(patch: any) {
  const user = await getCurrentUser();
  if (!user) throw new Error('کاربر وارد نشده');
  const { error } = await supabase.from('subscriptions').upsert({
    user_id: user.id,
    ...patch,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ═══════════════════════════════════════════
// 📅 ابزارها
// ═══════════════════════════════════════════
export function generateInvoiceNumber() {
  const now = new Date();
  const ds = String(now.getFullYear()).slice(-2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');
  const t = String(Date.now()).slice(-4);
  return ds + '-' + t;
}

export function generateCustomerCode() {
  return 'M_' + String(Date.now()).slice(-6);
}

export function formatPrice(n: number) {
  if (!n || n === 0) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.getFullYear() + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + String(dt.getDate()).padStart(2, '0');
}

export function formatDateTime(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  return formatDate(d) + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
}