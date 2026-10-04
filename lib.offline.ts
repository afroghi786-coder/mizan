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

export async function createPurchase(payload: any) {
  if (MODE === 'online') {
    try { return await lib.createPurchase(payload); }
    catch { await enqueue('createPurchase', payload); return 'queued'; }
  }
  await enqueue('createPurchase', payload);
  return 'queued';
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

export async function searchAllInvoices(q: string) {
  return cachedRead('search_all_' + q, () => lib.searchAllInvoices(q));
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
async function getCustomerList() {
  let list = await getLocal<any[]>('all_sales_for_lookup');
  if (!list || !list.length) {
    // fallback: از sales_grouped
    const grouped = await getLocal<any[]>('sales_grouped') || [];
    list = [];
    for (const g of grouped) {
      if (g.phone) {
        list.push({ customer_phone: g.phone, customer_name: g.name, customer_code: g.customerCode || g.code || '' });
      }
    }
  }
  return list || [];
}

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

export async function findCustomerByPhoneOffline(phone: string) {
  const list = await getCustomerList();
  const p = String(phone).replace(/[^0-9]/g, '');
  for (const s of list) {
    const sp = String(s.customer_phone || '').replace(/[^0-9]/g, '');
    if (sp === p) return {
      customer_name: s.customer_name, customer_address: s.customer_address || '',
      customer_code: s.customer_code, found_as: 'customer',
    };
  }
  return null;
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

export async function lookupCustomerByPhone(phone: string) {
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupCustomerByPhone(phone);
      if (fresh) await setLocal('cust_' + phone, fresh);
      return fresh;
    } catch (e) { return await findCustomerByPhoneOffline(phone); }
  }
  const cached = await getLocal<any>('cust_' + phone);
  if (cached) return cached;
  return await findCustomerByPhoneOffline(phone);
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
      lib.supabase.from('sales').select('customer_code, customer_name, customer_phone, customer_address'),
      lib.supabase.from('purchases').select('supplier_code, supplier_name, supplier_phone'),
    ]);

    const [products, salesGrouped, purchasesGrouped, unpaid, settings, allSales, allPurchases] = results;

    if (products.status === 'fulfilled') await setLocal('products', products.value);
    if (salesGrouped.status === 'fulfilled') await setLocal('sales_grouped', salesGrouped.value);
    if (purchasesGrouped.status === 'fulfilled') await setLocal('purchases_grouped', purchasesGrouped.value);
    if (unpaid.status === 'fulfilled') await setLocal('unpaid_invoices', unpaid.value);
    if (settings.status === 'fulfilled') await setLocal('settings', settings.value);
    if (allSales.status === 'fulfilled') await setLocal('all_sales_for_lookup', allSales.value.data || []);
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

export async function getInvoiceDetail(invoiceNumber: string) {
  if (MODE === 'online') {
    try { return await lib.getInvoiceDetail(invoiceNumber); } catch { return []; }
  }
  const cached = await getLocal<any[]>('invoice_detail_' + invoiceNumber);
  return cached || [];
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
      const inv = p.invoiceNumber || 'P-PENDING';
      if (!pendingByInv[inv]) {
        pendingByInv[inv] = {
          invoice: inv, name: p.supplierName, phone: p.supplierPhone,
          total: 0, paid: 0, items: [],
          date: new Date(item.ts).toISOString(),
          _pending: true,
        };
      }
      for (const it of p.items || []) {
        pendingByInv[inv].total += (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        pendingByInv[inv].items.push(it);
      }
      pendingByInv[inv].paid += Number(p.paymentAmount) || 0;
    }
  }
  return [...Object.values(pendingByInv), ...serverList];
}
