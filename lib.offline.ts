// lib.offline.ts — لایه‌ی Offline-First روی lib.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as lib from './lib';

export * from './lib';

const MODE_KEY = '@mizan_mode';
const LOCAL = '@mizan_local_';
const QUEUE = '@mizan_queue';

let MODE: 'online' | 'offline' = 'online';
let listeners: Array<(m: 'online' | 'offline') => void> = [];

export async function loadMode() {
  const m = await AsyncStorage.getItem(MODE_KEY);
  MODE = m === 'offline' ? 'offline' : 'online';
  return MODE;
}
export function getMode() { return MODE; }
export async function setMode(m: 'online' | 'offline') {
  MODE = m;
  await AsyncStorage.setItem(MODE_KEY, m);
  listeners.forEach(fn => fn(m));
}
export function subscribeMode(fn: (m: 'online' | 'offline') => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(f => f !== fn); };
}

async function getLocal<T>(k: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(LOCAL + k);
  return raw ? JSON.parse(raw) : null;
}
async function setLocal(k: string, v: any) {
  await AsyncStorage.setItem(LOCAL + k, JSON.stringify(v));
}

export async function getQueue(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(QUEUE);
  return raw ? JSON.parse(raw) : [];
}
async function enqueue(op: string, payload: any) {
  const q = await getQueue();
  q.push({ op, payload, ts: Date.now() });
  await AsyncStorage.setItem(QUEUE, JSON.stringify(q));
}
export async function getQueueCount() { return (await getQueue()).length; }
export async function clearQueue() { await AsyncStorage.setItem(QUEUE, '[]'); }

export async function syncToServer(): Promise<{ ok: number; fail: number }> {
  const q = await getQueue();
  const remaining: any[] = [];
  let ok = 0, fail = 0;
  for (const item of q) {
    try {
      await (lib as any)[item.op](item.payload);
      ok++;
    } catch (e) {
      remaining.push(item);
      fail++;
    }
  }
  await AsyncStorage.setItem(QUEUE, JSON.stringify(remaining));
  return { ok, fail };
}

export async function pullFromServer() {
  try {
    const [products, sales, purchases, settings] = await Promise.all([
      lib.getProducts(),
      lib.supabase.from('sales').select('*').order('created_at', { ascending: false }),
      lib.supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      lib.getSettings(),
    ]);
    await setLocal('products', products);
    await setLocal('sales', sales.data || []);
    await setLocal('purchases', purchases.data || []);
    await setLocal('settings', settings);
  } catch (e) { console.log('Pull failed:', e); }
}

async function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (MODE === 'online') {
    try {
      const fresh = await fetcher();
      await setLocal(key, fresh);
      return fresh;
    } catch {
      const cached = await getLocal<T>(key);
      if (cached) return cached;
      throw new Error('آفلاین — داده‌ای موجود نیست');
    }
  }
  const cached = await getLocal<T>(key);
  if (cached) return cached;
  try { return await fetcher(); } catch { throw new Error('داده‌ای موجود نیست'); }
}

export async function getProducts() {
  return cachedRead('products', () => lib.getProducts());
}
export async function createProduct(p: any) {
  const list: any[] = (await getLocal('products')) || [];
  list.push({ ...p, _localId: Date.now() });
  await setLocal('products', list);
  if (MODE === 'online') {
    try { await lib.createProduct(p); await setLocal('products', await lib.getProducts()); }
    catch { await enqueue('createProduct', p); }
  } else {
    await enqueue('createProduct', p);
  }
}
export async function updateProduct(id: string, p: any) {
  const list: any[] = (await getLocal('products')) || [];
  const idx = list.findIndex((x: any) => x.id === id);
  if (idx >= 0) { list[idx] = { ...list[idx], ...p }; await setLocal('products', list); }
  if (MODE === 'online') {
    try { await lib.updateProduct(id, p); } catch { await enqueue('updateProduct', { id, p }); }
  } else {
    await enqueue('updateProduct', { id, p });
  }
}
export async function deleteProduct(id: string) {
  const list: any[] = (await getLocal('products')) || [];
  await setLocal('products', list.filter((x: any) => x.id !== id));
  if (MODE === 'online') {
    try { await lib.deleteProduct(id); } catch { await enqueue('deleteProduct', id); }
  } else {
    await enqueue('deleteProduct', id);
  }
}

export async function createSale(payload: any) {
  if (MODE === 'online') {
    try { return await lib.createSale(payload); }
    catch { await enqueue('createSale', payload); return payload.invoiceNumber; }
  }
  await enqueue('createSale', payload);
  return payload.invoiceNumber;
}
export async function deleteSale(inv: string) {
  if (MODE === 'online') {
    try { await lib.deleteSale(inv); } catch { await enqueue('deleteSale', inv); }
  } else {
    await enqueue('deleteSale', inv);
  }
}

export async function deletePurchase(inv: string) {
  if (MODE === 'online') {
    try { await lib.deletePurchase(inv); } catch { await enqueue('deletePurchase', inv); }
  } else {
    await enqueue('deletePurchase', inv);
  }
}

export async function getSettings() {
  return cachedRead('settings', () => lib.getSettings());
}
export async function updateSettings(s: any) {
  await setLocal('settings', s);
  if (MODE === 'online') {
    try { await lib.updateSettings(s); } catch { await enqueue('updateSettings', s); }
  } else {
    await enqueue('updateSettings', s);
  }
}

export async function getInventory() {
  return cachedRead('inventory', () => lib.getInventory());
}
export async function getDashboardStats(r: string, f: string) {
  return cachedRead(`stats_${r}_${f}`, () => lib.getDashboardStats(r, f));
}

// ═══════════════════════════════════════════
//  wrappers اضافی — اینا رو هم کش کن
// ═══════════════════════════════════════════

export async function getUnpaidInvoices() {
  return cachedRead('unpaid_invoices', () => lib.getUnpaidInvoices());
}






// تابع کمکی: قبل از رفتن به آفلاین، همه‌چیز رو کش کن

// ═══════════════════════════════════════════
//  جستجو در cache محلی (بدون سرور)
// ═══════════════════════════════════════════



// ═══════════════════════════════════════════
//  بازنویسی lookup ها با cache
// ═══════════════════════════════════════════



// ═══════════════════════════════════════════
//  prepareOffline — همه‌چیز رو دانلود کن
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  Lookup های آفلاین
// ═══════════════════════════════════════════

async function getSupplierList() {
  let list = await getLocal<any[]>('all_purchases_for_lookup');
  if (!list || !list.length) {
    const grouped = await getLocal<any[]>('purchases_grouped') || [];
    list = [];
    for (const g of grouped) {
      if (g.phone) list.push({ supplier_phone: g.phone, supplier_name: g.name, supplier_code: g.supplierCode || '' });
    }
  }
  return list || [];
}


export async function findSupplierByNameOffline(name: string) {
  const list = await getSupplierList();
  for (const p of list) {
    if (p.supplier_name === name) return {
      supplier_name: p.supplier_name, supplier_code: p.supplier_code,
      supplier_phone: p.supplier_phone,
    };
  }
  return null;
}

export async function findCodeByNameOffline(name: string) {
  if (!name || name.length < 2) return '';
  const sales = await getCustomerList();
  const purchases = await getSupplierList();
  for (const s of sales) if (s.customer_name === name && s.customer_code) return s.customer_code;
  for (const p of purchases) if (p.supplier_name === name && p.supplier_code) return p.supplier_code;
  return '';
}


export async function lookupSupplierByName(name: string) {
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupSupplierByName(name);
      if (fresh) await setLocal('sup_' + name, fresh);
      return fresh;
    } catch (e) { return await findSupplierByNameOffline(name); }
  }
  const cached = await getLocal<any>('sup_' + name);
  if (cached) return cached;
  return await findSupplierByNameOffline(name);
}

export async function lookupCodeByName(name: string) {
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupCodeByName(name);
      if (fresh) await setLocal('code_' + name, fresh);
      return fresh;
    } catch (e) { return await findCodeByNameOffline(name); }
  }
  const cached = await getLocal<string>('code_' + name);
  if (cached) return cached;
  return await findCodeByNameOffline(name);
}

// ═══════════════════════════════════════════
//  prepareOffline — کامل و مطمئن
// ═══════════════════════════════════════════
export async function prepareOffline(): Promise<boolean> {
  try {
    const results = await Promise.allSettled([
      lib.getProducts(),
      lib.getSalesGrouped(),
      lib.getPurchasesGrouped(),
      lib.getUnpaidInvoices(),
      lib.getSettings(),
      lib.supabase.from('sales').select('*'),
      lib.supabase.from('purchases').select('supplier_code, supplier_name, supplier_phone'),
    ]);

    const [products, salesGrouped, purchasesGrouped, unpaid, settings, allSales, allPurchases] = results;

    if (products.status === 'fulfilled') await setLocal('products', products.value);
    if (salesGrouped.status === 'fulfilled') await setLocal('sales_grouped', salesGrouped.value);
    if (purchasesGrouped.status === 'fulfilled') await setLocal('purchases_grouped', purchasesGrouped.value);
    if (unpaid.status === 'fulfilled') await setLocal('unpaid_invoices', unpaid.value);
    if (settings.status === 'fulfilled') await setLocal('settings', settings.value);
    if (allSales.status === 'fulfilled') {
      const full = allSales.value.data || [];
      // برای lookup
      await setLocal('all_sales_for_lookup', full.map((r: any) => ({
        customer_code: r.customer_code,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_address: r.customer_address,
      })));
      // ⭐ برای محاسبه مانده — همه فیلدها
      await setLocal('all_sales_full', full);
    }
    if (allPurchases.status === 'fulfilled') await setLocal('all_purchases_for_lookup', allPurchases.value.data || []);

    // چک نهایی
    const customerCount = (await getLocal<any[]>('all_sales_for_lookup'))?.length || 0;
    console.log('prepareOffline done. Customers cached:', customerCount);
    return true;
  } catch (e) {
    console.log('prepareOffline error:', e);
    return false;
  }
}

// ═══════════════════════════════════════════
//  شماره فاکتور و کد مشتری آفلاین
// ═══════════════════════════════════════════
export async function generateInvoiceNumber(): Promise<string> {
  if (MODE === 'online') {
    try { return await lib.generateInvoiceNumber(); } catch {}
  }
  const today = new Date();
  const ds = String(today.getFullYear()).slice(-2)
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const salesGrouped = (await getLocal<any[]>('sales_grouped')) || [];
  const queue = await getQueue();
  let maxN = 1000;
  const all: string[] = [
    ...salesGrouped.map((g: any) => g.invoice || ''),
    ...queue.filter((q: any) => q.op === 'createSale').map((q: any) => q.payload.invoiceNumber || ''),
  ];
  for (const inv of all) {
    const m = String(inv).match(/^\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
  }
  return ds + '-' + (maxN + 1);
}

export async function generateCustomerCode(): Promise<string> {
  if (MODE === 'online') {
    try { return await lib.generateCustomerCode(); } catch {}
  }
  const salesGrouped = (await getLocal<any[]>('sales_grouped')) || [];
  const queue = await getQueue();
  let maxN = 1000;
  const all: string[] = [
    ...salesGrouped.map((g: any) => g.customerCode || ''),
    ...queue.filter((q: any) => q.op === 'createSale').map((q: any) => q.payload.customerCode || ''),
  ];
  for (const ccode of all) {
    const m = String(ccode).match(/^M_(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN) maxN = n; }
  }
  return 'M_' + (maxN + 1);
}


// ═══════════════════════════════════════════
//  getSalesGrouped — با ادغام صف
// ═══════════════════════════════════════════
export async function getSalesGrouped() {
  let serverList: any[] = [];
  if (MODE === 'online') {
    try {
      serverList = await lib.getSalesGrouped();
      await setLocal('sales_grouped', serverList);
    } catch {
      serverList = (await getLocal<any[]>('sales_grouped')) || [];
    }
  } else {
    serverList = (await getLocal<any[]>('sales_grouped')) || [];
  }

  // ادغام با صف
  const queue = await getQueue();
  const pendingByInv: Record<string, any> = {};
  for (const item of queue) {
    if (item.op === 'createSale') {
      const p = item.payload;
      const inv = p.invoiceNumber;
      if (!pendingByInv[inv]) {
        pendingByInv[inv] = {
          invoice: inv, name: p.customerName, phone: p.customerPhone,
          total: 0, paid: 0, items: [],
          date: new Date(item.ts).toISOString(),
          _pending: true,
        };
      }
      for (const it of p.items || []) {
        pendingByInv[inv].total += (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        pendingByInv[inv].paid += Number(it.payment) || 0;
        pendingByInv[inv].items.push(it);
      }
    }
  }
  return [...Object.values(pendingByInv), ...serverList];
}

// ═══════════════════════════════════════════
//  getPurchasesGrouped — با ادغام صف
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  searchAllInvoices — با ادغام صف آفلاین
// ═══════════════════════════════════════════
export async function searchAllInvoices(q: string) {
  const [sales, purchases] = await Promise.all([
    getSalesGrouped(),
    getPurchasesGrouped(),
  ]);
  const query = (q || '').toLowerCase().trim();
  const filt = (arr: any[], type: string) =>
    arr.map((r) => ({ ...r, type, sheetType: type }))
      .filter((r) => !query ||
        (String(r.invoice) + ' ' + String(r.name || '') + ' ' + String(r.phone || '')).toLowerCase().includes(query));
  return [...filt(sales, 'sales'), ...filt(purchases, 'purchases')];
}

// ═══════════════════════════════════════════
//  getInvoiceDetail — از صف یا سرور
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  deleteSale — اگه توی صف بود، از صف حذف کن
// ═══════════════════════════════════════════


// ═══════════════════════════════════════════
//  updateInvoiceInQueue — ویرایش فاکتور آفلاین
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  شماره فاکتور خرید آفلاین با P-
// ═══════════════════════════════════════════
async function genPurchaseInvoiceNumber() {
  const today = new Date();
  const ds = String(today.getFullYear()).slice(-2)
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const grouped = (await getLocal<any[]>('purchases_grouped')) || [];
  const queue = await getQueue();
  let maxN = 1000;
  for (const g of grouped) {
    const m = String(g.invoice || '').match(/^P-\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
  }
  for (const q of queue) {
    if (q.op === 'createPurchase') {
      const inv = q.payload?._pendingInvNumber || q.payload?.invoiceNumber || '';
      const m = String(inv).match(/^P-\d{6}-(\d+)$/);
      if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
    }
  }
  return 'P-' + ds + '-' + (maxN + 1);
}

// ═══════════════════════════════════════════
//  createPurchase — با شماره P-
// ═══════════════════════════════════════════
export async function createPurchase(payload: any) {
  if (MODE === 'online') {
    try { return await lib.createPurchase(payload); }
    catch {
      const pInv = await genPurchaseInvoiceNumber();
      const newPayload = { ...payload, _pendingInvNumber: pInv };
      await enqueue('createPurchase', newPayload);
      return pInv;
    }
  }
  const pInv = await genPurchaseInvoiceNumber();
  const newPayload = { ...payload, _pendingInvNumber: pInv };
  await enqueue('createPurchase', newPayload);
  return pInv;
}

// ═══════════════════════════════════════════
//  getPurchasesGrouped — با شماره P-
// ═══════════════════════════════════════════
export async function getPurchasesGrouped() {
  let serverList: any[] = [];
  if (MODE === 'online') {
    try {
      serverList = await lib.getPurchasesGrouped();
      await setLocal('purchases_grouped', serverList);
    } catch {
      serverList = (await getLocal<any[]>('purchases_grouped')) || [];
    }
  } else {
    serverList = (await getLocal<any[]>('purchases_grouped')) || [];
  }

  const queue = await getQueue();
  const pendingByInv: Record<string, any> = {};
  for (const item of queue) {
    if (item.op === 'createPurchase') {
      const p = item.payload;
      const inv = p._pendingInvNumber || p.invoiceNumber || 'P-PENDING';
      if (!pendingByInv[inv]) {
        pendingByInv[inv] = {
          invoice: inv,
          manual: p.manualInvoice || '',
          name: p.supplierName,
          phone: p.supplierPhone,
          total: 0, paid: 0, items: [],
          date: new Date(item.ts).toISOString(),
          _pending: true,
        };
      }
      const items = (p.items && p.items.length) ? p.items : [{ modelName: '—', quantity: 0, priceUnit: 0 }];
      for (const it of items) {
        pendingByInv[inv].total += (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        pendingByInv[inv].items.push(it);
      }
      pendingByInv[inv].paid += Number(p.paymentAmount) || 0;
    }
  }
  return [...Object.values(pendingByInv), ...serverList];
}

// ═══════════════════════════════════════════
//  getInvoiceDetail — از صف یا سرور
// ═══════════════════════════════════════════
export async function getInvoiceDetail(invoiceNumber: string) {
  const queue = await getQueue();

  // فاکتور فروش
  for (const item of queue) {
    if (item.op === 'createSale' && item.payload?.invoiceNumber === invoiceNumber) {
      const p = item.payload;
      return (p.items || []).map((it: any, idx: number) => ({
        id: 'queued_' + idx,
        invoice_number: p.invoiceNumber,
        customer_code: p.customerCode,
        customer_name: p.customerName,
        customer_phone: p.customerPhone,
        customer_address: p.customerAddress,
        shipping: p.shipping,
        model_code: it.modelCode,
        model_name: it.modelName,
        quantity: it.quantity,
        price_unit: it.priceUnit,
        payment: idx === 0 ? (it.payment || 0) : 0,
        deposit_date: it.depositDate || '',
        bank_name: it.bankName || '',
        account_holder: it.accountHolder || '',
        account_holder_code: it.accountHolderCode || '',
        description: it.description || '',
        date_factor: new Date(item.ts).toISOString().slice(0, 10).replace(/-/g, '/'),
        date_reg: new Date(item.ts).toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/'),
        _pending: true,
      }));
    }

    // فاکتور خرید — چک هر دو شماره
    if (item.op === 'createPurchase') {
      const pInv = item.payload?._pendingInvNumber || item.payload?.invoiceNumber;
      if (pInv === invoiceNumber) {
        const p = item.payload;
        const items = (p.items && p.items.length) ? p.items : [{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, description: '' }];
        return items.map((it: any, idx: number) => ({
          id: 'queued_' + idx,
          invoice_number: pInv,
          manual_invoice: p.manualInvoice || '',
          supplier_code: p.supplierCode || '',
          supplier_name: p.supplierName,
          supplier_phone: p.supplierPhone || '',
          model_code: it.modelCode || '',
          model_name: it.modelName || '',
          quantity: it.quantity || 0,
          price_unit: it.priceUnit || 0,
          payment: idx === 0 ? (p.paymentAmount || 0) : 0,
          deposit_date: idx === 0 ? (p.paymentDate || '') : '',
          bank_name: idx === 0 ? (p.bankAccount || '') : '',
          account_holder: idx === 0 ? (p.payerName || '') : '',
          payer_code: idx === 0 ? (p.payerCode || '') : '',
          description: it.description || '',
          date_factor: new Date(item.ts).toISOString().slice(0, 10).replace(/-/g, '/'),
          date_reg: new Date(item.ts).toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/'),
          _pending: true,
        }));
      }
    }
  }

  // از سرور
  if (MODE === 'online') {
    try { return await lib.getInvoiceDetail(invoiceNumber); } catch { return []; }
  }
  const cached = await getLocal<any[]>('invoice_detail_' + invoiceNumber);
  return cached || [];
}

// ═══════════════════════════════════════════
//  updateInvoiceInQueue — ویرایش آفلاین
// ═══════════════════════════════════════════
export async function updateInvoiceInQueue(invoiceNumber: string, type: 'sales' | 'purchases', rows: any[]) {
  const queue = await getQueue();
  const op = type === 'sales' ? 'createSale' : 'createPurchase';
  let found = false;

  for (const item of queue) {
    if (item.op !== op) continue;

    // چک هر دو شماره برای purchase
    let match = false;
    if (type === 'sales') {
      match = item.payload?.invoiceNumber === invoiceNumber;
    } else {
      match = (item.payload?._pendingInvNumber === invoiceNumber)
        || (item.payload?.invoiceNumber === invoiceNumber);
    }

    if (match) {
      found = true;
      const validRows = rows.filter((r: any) => !r._deleted);
      if (type === 'sales') {
        item.payload.items = validRows.map((r: any) => ({
          modelCode: r.modelCode,
          modelName: r.modelName,
          quantity: r.quantity,
          priceUnit: r.priceUnit,
          payment: r.payment,
          depositDate: r.depositDate,
          bankName: r.bankName,
          accountHolder: r.accountHolder,
          accountHolderCode: r.accountHolderCode,
          description: r.description,
        }));
      } else {
        item.payload.items = validRows.map((r: any) => ({
          modelCode: r.modelCode,
          modelName: r.modelName,
          quantity: r.quantity,
          priceUnit: r.priceUnit,
          description: r.description,
        }));
        // اطلاعات پرداخت از ردیف اول
        if (validRows[0]) {
          item.payload.paymentAmount = validRows[0].payment || 0;
          item.payload.paymentDate = validRows[0].depositDate || '';
          item.payload.bankAccount = validRows[0].bankName || '';
          item.payload.payerName = validRows[0].accountHolder || '';
          item.payload.payerCode = validRows[0].accountHolderCode || '';
        }
      }
      break;
    }
  }

  if (found) {
    await AsyncStorage.setItem('@mizan_queue', JSON.stringify(queue));
  }
  return found;
}

// ═══════════════════════════════════════════
//  حذف از صف
// ═══════════════════════════════════════════
export async function deleteSaleFromQueue(invoiceNumber: string) {
  const queue = await getQueue();
  const filtered = queue.filter((item: any) =>
    !(item.op === 'createSale' && item.payload?.invoiceNumber === invoiceNumber)
  );
  await AsyncStorage.setItem('@mizan_queue', JSON.stringify(filtered));
}

export async function deletePurchaseFromQueue(invoiceNumber: string) {
  const queue = await getQueue();
  const filtered = queue.filter((item: any) => {
    if (item.op !== 'createPurchase') return true;
    const pInv = item.payload?._pendingInvNumber || item.payload?.invoiceNumber;
    return pInv !== invoiceNumber;
  });
  await AsyncStorage.setItem('@mizan_queue', JSON.stringify(filtered));
}

// ═══════════════════════════════════════════
//  جستجوی مشتری — چک cache + صف
// ═══════════════════════════════════════════
export async function findCustomerByPhoneOffline(phone: string) {
  const p = String(phone).replace(/[^0-9]/g, '');
  if (!p) return null;

  // ۱. جستجو در cache (sales_grouped + all_sales_for_lookup)
  const list = await getCustomerList();
  for (const s of list) {
    const sp = String(s.customer_phone || '').replace(/[^0-9]/g, '');
    if (sp === p) {
      return {
        customer_name: s.customer_name,
        customer_address: s.customer_address || '',
        customer_code: s.customer_code,
        found_as: 'customer',
      };
    }
  }

  // ۲. جستجو در صف (فاکتورهای آفلاین ثبت‌شده)
  const queue = await getQueue();
  for (const item of queue) {
    if (item.op === 'createSale') {
      const itemPhone = String(item.payload?.customerPhone || '').replace(/[^0-9]/g, '');
      if (itemPhone === p) {
        return {
          customer_name: item.payload?.customerName || '',
          customer_address: item.payload?.customerAddress || '',
          customer_code: item.payload?.customerCode || '',
          found_as: 'customer',
        };
      }
    }
    // فاکتورهای خرید — تأمین‌کننده‌ها رو هم چک کن
    if (item.op === 'createPurchase') {
      const sp = String(item.payload?.supplierPhone || '').replace(/[^0-9]/g, '');
      if (sp === p) {
        return {
          customer_name: item.payload?.supplierName || '',
          customer_address: '',
          customer_code: item.payload?.supplierCode || '',
          found_as: 'supplier',
        };
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════
//  lookupCustomerByPhone — با چک صف
// ═══════════════════════════════════════════
export async function lookupCustomerByPhone(phone: string) {
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupCustomerByPhone(phone);
      if (fresh) {
        await setLocal('cust_' + phone, fresh);
        return fresh;
      }
      // اگه سرور پیدا نکرد، صف رو چک کن (چون ممکنه آفلاین ثبت شده باشه)
      const fromQueue = await findCustomerByPhoneOffline(phone);
      return fromQueue;
    } catch {
      return await findCustomerByPhoneOffline(phone);
    }
  }
  // آفلاین: اول cache، بعد صف
  const cached = await getLocal<any>('cust_' + phone);
  if (cached) return cached;
  return await findCustomerByPhoneOffline(phone);
}

// ═══════════════════════════════════════════
//  getCustomerList — با ادغام صف
// ═══════════════════════════════════════════
async function getCustomerList(): Promise<any[]> {
  const result: any[] = [];
  const seen = new Set<string>();

  // از all_sales_for_lookup
  const all = (await getLocal<any[]>('all_sales_for_lookup')) || [];
  for (const s of all) {
    const key = String(s.customer_phone || '') + '_' + String(s.customer_code || '');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }

  // از sales_grouped
  const grouped = (await getLocal<any[]>('sales_grouped')) || [];
  for (const g of grouped) {
    const key = String(g.phone || '') + '_' + String(g.customerCode || g.code || '');
    if (!seen.has(key) && g.phone) {
      seen.add(key);
      result.push({
        customer_phone: g.phone,
        customer_name: g.name,
        customer_address: g.address || '',
        customer_code: g.customerCode || g.code || '',
      });
    }
  }

  return result;
}


// ═══════════════════════════════════════════
//  صرافی (FX Trades)
// ═══════════════════════════════════════════
export async function getFxTrades(): Promise<any[]> {
  return cachedRead('fx_trades', async () => {
    const { data } = await lib.supabase.from('fx_trades').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createFxTrade(p: any): Promise<any> {
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  const local = (await getLocal<any[]>('fx_trades')) || [];
  await setLocal('fx_trades', [item, ...local]);
  if (MODE === 'online') {
    try {
      const { error } = await lib.supabase.from('fx_trades').insert({
        from_currency: p.from_currency, to_currency: p.to_currency,
        from_qty: p.from_qty, to_qty: p.to_qty, rate: p.rate || 0,
        description: p.description || '', local_id: item.local_id,
      });
      if (error) throw error;
    } catch { await enqueue('createFxTrade', p); }
  } else { await enqueue('createFxTrade', p); }
  return item;
}
export async function deleteFxTrade(localId: string) {
  const local = (await getLocal<any[]>('fx_trades')) || [];
  await setLocal('fx_trades', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_trades').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}

// ═══════════════════════════════════════════
//  هزینه‌ها (Expenses)
// ═══════════════════════════════════════════
export async function getExpenses(): Promise<any[]> {
  return cachedRead('expenses', async () => {
    const { data } = await lib.supabase.from('expenses').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createExpense(p: any): Promise<any> {
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  const local = (await getLocal<any[]>('expenses')) || [];
  await setLocal('expenses', [item, ...local]);
  if (MODE === 'online') {
    try {
      const { error } = await lib.supabase.from('expenses').insert({
        type: p.type, title: p.title, amount: p.amount,
        date: p.date, bank: p.bank || '', description: p.description || '', local_id: item.local_id,
      });
      if (error) throw error;
    } catch { await enqueue('createExpense', p); }
  } else { await enqueue('createExpense', p); }
  return item;
}
export async function deleteExpense(localId: string) {
  const local = (await getLocal<any[]>('expenses')) || [];
  await setLocal('expenses', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('expenses').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}

// ═══════════════════════════════════════════
//  کارمندان (Employees)
// ═══════════════════════════════════════════
export async function getEmployees(): Promise<any[]> {
  return cachedRead('employees', async () => {
    const { data } = await lib.supabase.from('employees').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createEmployee(p: any): Promise<any> {
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  const local = (await getLocal<any[]>('employees')) || [];
  await setLocal('employees', [item, ...local]);
  if (MODE === 'online') {
    try {
      const { error } = await lib.supabase.from('employees').insert({
        code: p.code, name: p.name, phone: p.phone || '', role: p.role || '',
        contract_type: p.contract_type, amount: p.amount || 0, overtime_rate: p.overtime_rate || 0,
        local_id: item.local_id,
      });
      if (error) throw error;
    } catch { await enqueue('createEmployee', p); }
  } else { await enqueue('createEmployee', p); }
  return item;
}
export async function deleteEmployee(localId: string) {
  const local = (await getLocal<any[]>('employees')) || [];
  await setLocal('employees', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('employees').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}

// ═══════════════════════════════════════════
//  حضور (Attendance)
// ═══════════════════════════════════════════
export async function getAttendance(): Promise<any[]> {
  return cachedRead('attendance', async () => {
    const { data } = await lib.supabase.from('attendance').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createAttendance(p: any): Promise<any> {
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  const local = (await getLocal<any[]>('attendance')) || [];
  await setLocal('attendance', [item, ...local]);
  if (MODE === 'online') {
    try {
      const { error } = await lib.supabase.from('attendance').insert({
        employee_code: p.employee_code, employee_name: p.employee_name || '',
        date: p.date, status: p.status, hours: p.hours || 0, overtime: p.overtime || 0,
        local_id: item.local_id,
      });
      if (error) throw error;
    } catch { await enqueue('createAttendance', p); }
  } else { await enqueue('createAttendance', p); }
  return item;
}
export async function deleteAttendance(localId: string) {
  const local = (await getLocal<any[]>('attendance')) || [];
  await setLocal('attendance', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('attendance').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}
