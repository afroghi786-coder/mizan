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

export async function getSalesGrouped() {
  return cachedRead('sales_grouped', () => lib.getSalesGrouped());
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

export async function getPurchasesGrouped() {
  return cachedRead('purchases_grouped', () => lib.getPurchasesGrouped());
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

export async function getInvoiceDetail(invoiceNumber: string) {
  return cachedRead('invoice_detail_' + invoiceNumber, () => lib.getInvoiceDetail(invoiceNumber));
}

export async function lookupCustomerByPhone(phone: string) {
  return cachedRead('cust_' + phone, () => lib.lookupCustomerByPhone(phone));
}

export async function lookupSupplierByName(name: string) {
  return cachedRead('sup_' + name, () => lib.lookupSupplierByName(name));
}

export async function lookupCodeByName(name: string) {
  return cachedRead('code_' + name, () => lib.lookupCodeByName(name));
}

// تابع کمکی: قبل از رفتن به آفلاین، همه‌چیز رو کش کن
export async function prepareOffline() {
  try {
    await Promise.all([
      lib.getProducts().then((d: any) => setLocal('products', d)),
      lib.getSalesGrouped().then((d: any) => setLocal('sales_grouped', d)),
      lib.getPurchasesGrouped().then((d: any) => setLocal('purchases_grouped', d)),
      lib.getUnpaidInvoices().then((d: any) => setLocal('unpaid_invoices', d)),
      lib.getSettings().then((d: any) => setLocal('settings', d)),
    ]);
    return true;
  } catch (e) {
    console.log('prepareOffline failed:', e);
    return false;
  }
}
