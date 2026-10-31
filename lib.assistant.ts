import AsyncStorage from './lib.storage';
import { Platform } from 'react-native';
import { generateInvoiceNumber, generateCustomerCode, createSale, getSalesGrouped, getQueue } from './lib.offline';

let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const BOT_KEY = '@mizan_assistant_bot_config';
const WATCHER_KEY = '@mizan_assistant_watcher_config';
const SOURCES_KEY = '@mizan_assistant_watcher_sources';
const ADS_KEY = '@mizan_assistant_ads_config';

const isWeb = Platform.OS === 'web';
const canSecure = !isWeb && SecureStore && typeof SecureStore.getItemAsync === 'function';

async function _secureGet(key: string): Promise<string | null> {
  if (canSecure) {
    try { return await SecureStore.getItemAsync(key); } catch {}
  }
  return await AsyncStorage.getItem(key);
}

async function _secureSet(key: string, value: string): Promise<void> {
  if (canSecure) {
    try { await SecureStore.setItemAsync(key, value); } catch {}
  }
  await AsyncStorage.setItem(key, value);
}

async function _readJson(key: string, fallback: any) {
  try {
    const raw = await _secureGet(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

async function _writeJson(key: string, value: any) {
  await _secureSet(key, JSON.stringify(value));
}

async function _readJsonAsync(key: string, fallback: any) {
  try { const raw = await AsyncStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw); } catch { return fallback; }
}
async function _writeJsonAsync(key: string, value: any) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
export async function getBotConfig() {
  return await _readJsonAsync(BOT_KEY, {
    telegram_token: '', telegram_enabled: false,
    rubika_token: '', rubika_enabled: false, rubika_channel_id: '', rubika_admin_chat_id: '', sleep_enabled: true, sleep_start: '20:00', sleep_end: '08:00', sleep_message: '🌙 ربات در حال استراحت است. لطفاً بعداً پیام دهید.',
    whatsapp_token: '', whatsapp_phone: '', whatsapp_enabled: false, order_mode: 'both',
  });
}

export async function saveBotConfig(cfg: any) {
  await _writeJsonAsync(BOT_KEY, cfg);
}

export async function getWatcherConfig() {
  return await _readJson(WATCHER_KEY, {
    enabled: false, accessibility_granted: false, last_scan_at: '',
  });
}

export async function saveWatcherConfig(cfg: any) {
  await _writeJson(WATCHER_KEY, cfg);
}

export async function getWatcherSources() {
  const v = await _readJson(SOURCES_KEY, []);
  return Array.isArray(v) ? v : [];
}

export async function saveWatcherSources(sources: any[]) {
  await _writeJson(SOURCES_KEY, Array.isArray(sources) ? sources : []);
}

export async function getAdsConfig() {
  return await _readJson(ADS_KEY, {
    enabled: false,
    channel_name: '',
    channel_link: '',
    send_to_channel: true,
    send_to_members: false,
    send_to_social: false,
    instagram: false,
    facebook: false,
    whatsapp: false,
    daily_limit: 10,
    schedule_start: '09:00',
    schedule_end: '22:00',
    sent_today: 0,
    queued_count: 0,
    last_sent_at: '',
  });
}

export async function saveAdsConfig(cfg: any) {
  await _writeJson(ADS_KEY, cfg);
}

export function isSecureStorageAvailable() {
  return !!canSecure;
}

export function getSecureStorageMode() {
  if (canSecure) return 'secure';
  if (isWeb) return 'web-fallback';
  return 'async-fallback';
}


// ═══════════════════════════════════════════
//  ساختار داده سفارش‌ها (دستیار فروش)
// ═══════════════════════════════════════════
const ORDERS_KEY = '@mizan_assistant_orders';

export async function getOrders() {
  const v = await _readJson(ORDERS_KEY, []);
  return Array.isArray(v) ? v : [];
}

export async function saveOrder(order: any) {
  const list = await getOrders();
  const id = order.id || ('ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const item = { ...order, id, created_at: order.created_at || new Date().toISOString() };
  const filtered = list.filter((x: any) => x.id !== id);
  await _writeJson(ORDERS_KEY, [...filtered, item]);
  return item;
}

export async function updateOrderStatus(id: string, status: string) {
  const list = await getOrders();
  const updated = list.map((x: any) => x.id === id ? { ...x, status, updated_at: new Date().toISOString() } : x);
  await _writeJson(ORDERS_KEY, updated);
}

// ═══════════════════════════════════════════
//  ساختار داده نرخ‌ها (دستیار دیده‌بان)
// ═══════════════════════════════════════════
const RATE_SNAPSHOTS_KEY = '@mizan_assistant_rate_snapshots';
const RATE_SUMMARY_KEY = '@mizan_assistant_rate_summary';

export async function getRateSnapshots() {
  const v = await _readJson(RATE_SNAPSHOTS_KEY, []);
  return Array.isArray(v) ? v : [];
}

export async function saveRateSnapshot(snap: any) {
  const list = await getRateSnapshots();
  const item = { ...snap, at: snap.at || new Date().toISOString() };
  const trimmed = [...list, item].slice(-1000);
  await _writeJson(RATE_SNAPSHOTS_KEY, trimmed);
  return item;
}

export async function getRateSummary() {
  return await _readJson(RATE_SUMMARY_KEY, {});
}

export async function saveRateSummary(summary: any) {
  await _writeJson(RATE_SUMMARY_KEY, summary);
}

// ═══════════════════════════════════════════
//  ساختار داده تبلیغات (دستیار تبلیغات)
// ═══════════════════════════════════════════
const ADS_QUEUE_KEY = '@mizan_assistant_ads_queue';
const ADS_HISTORY_KEY = '@mizan_assistant_ads_history';

export async function getAdsQueue() {
  const v = await _readJson(ADS_QUEUE_KEY, []);
  return Array.isArray(v) ? v : [];
}

export async function enqueueAd(ad: any) {
  const list = await getAdsQueue();
  const id = ad.id || ('ad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const item = { ...ad, id, status: ad.status || 'queued', created_at: new Date().toISOString() };
  await _writeJson(ADS_QUEUE_KEY, [...list, item]);
  return item;
}

export async function markAdSent(id: string, result: string) {
  const list = await getAdsQueue();
  const target = list.find((x: any) => x.id === id);
  if (!target) return;
  const remaining = list.filter((x: any) => x.id !== id);
  await _writeJson(ADS_QUEUE_KEY, remaining);
  const history = await _readJson(ADS_HISTORY_KEY, []);
  const hist = Array.isArray(history) ? history : [];
  hist.push({ ...target, status: 'sent', result, sent_at: new Date().toISOString() });
  await _writeJson(ADS_HISTORY_KEY, hist.slice(-500));
}

export async function getAdsHistory() {
  const v = await _readJson(ADS_HISTORY_KEY, []);
  return Array.isArray(v) ? v : [];
}


// ═══════════════════════════════════════════
//  ساختار پیش‌نویس سفارش (دستیار فروش)
//  هیچ فاکتور واقعی در این فاز ساخته نمی‌شود.
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  فاکتورهای دستیار فروش
//  تا قبل از تأیید، در سیستم اصلی و شیت ثبت نمی‌شوند.
// ═══════════════════════════════════════════
const ASSISTANT_INVOICES_KEY = '@mizan_assistant_invoices';
const ASSISTANT_PAYMENTS_KEY = '@mizan_assistant_payments';

export type AssistantInvoiceStatus = 'issued' | 'edited' | 'approved' | 'transferred' | 'rejected';

export async function getAssistantInvoices() {
  const v = await _readJson(ASSISTANT_INVOICES_KEY, []);
  return Array.isArray(v) ? v : [];
}

export async function getAssistantInvoiceById(id: string) {
  const list = await getAssistantInvoices();
  return list.find((x: any) => x.id === id) || null;
}

export async function issueAssistantInvoice(inv: any) {
  const list = await getAssistantInvoices();
  const id = inv.id || ('ainv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const item = {
    id,
    status: 'issued',
    platform: inv.platform || '',
    channel: inv.channel || '',
    post_id: inv.post_id || '',
    invoice_number: inv.invoice_number || '',
    customer_code: inv.customer_code || '',
    customer_name: inv.customer_name || '',
    phone: inv.phone || '',
    address: inv.address || '',
    shipping: inv.shipping || '',
    items: Array.isArray(inv.items) ? inv.items : [],
    total: Number(inv.total || 0) || 0,
    paid: Number(inv.paid || 0) || 0,
    note: inv.note || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await _writeJson(ASSISTANT_INVOICES_KEY, [...list, item]);
  return item;
}

export async function updateAssistantInvoice(id: string, patch: any) {
  const list = await getAssistantInvoices();
  const current = list.find((x: any) => x.id === id);
  if (!current) return null;
  if (current.status === 'transferred') return current;
  const updated = list.map((x: any) => x.id === id ? {
    ...x,
    ...patch,
    status: x.status === 'approved' ? 'edited' : x.status,
    updated_at: new Date().toISOString(),
  } : x);
  await _writeJson(ASSISTANT_INVOICES_KEY, updated);
  return updated.find((x: any) => x.id === id) || null;
}

export async function deleteAssistantInvoice(id: string) {
  const list = await getAssistantInvoices();
  const filtered = list.filter((x: any) => x.id !== id);
  await _writeJson(ASSISTANT_INVOICES_KEY, filtered);
}

export async function approveAssistantInvoice(id: string) {
  const list = await getAssistantInvoices();
  const updated = list.map((x: any) => x.id === id ? {
    ...x,
    status: 'approved',
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } : x);
  await _writeJson(ASSISTANT_INVOICES_KEY, updated);
  return updated.find((x: any) => x.id === id) || null;
}

export async function rejectAssistantInvoice(id: string, reason: string) {
  const list = await getAssistantInvoices();
  const updated = list.map((x: any) => x.id === id ? {
    ...x,
    status: 'rejected',
    rejected_reason: String(reason || ''),
    updated_at: new Date().toISOString(),
  } : x);
  await _writeJson(ASSISTANT_INVOICES_KEY, updated);
  return updated.find((x: any) => x.id === id) || null;
}

export async function markAssistantInvoiceTransferred(id: string, invoice_number: string) {
  const list = await getAssistantInvoices();
  const updated = list.map((x: any) => x.id === id ? {
    ...x,
    status: 'transferred',
    invoice_number,
    transferred_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } : x);
  await _writeJson(ASSISTANT_INVOICES_KEY, updated);
  return updated.find((x: any) => x.id === id) || null;
}

export async function getAssistantPayments() {
  const v = await _readJson(ASSISTANT_PAYMENTS_KEY, []);
  return Array.isArray(v) ? v : [];
}

export async function saveAssistantPayment(p: any) {
  const list = await getAssistantPayments();
  const id = p.id || ('apay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const item = {
    id,
    invoice_id: p.invoice_id || '',
    invoice_number: p.invoice_number || '',
    amount: Number(p.amount || 0) || 0,
    method: p.method || '',
    bank: p.bank || '',
    ref: p.ref || '',
    status: p.status || 'pending',
    created_at: new Date().toISOString(),
  };
  await _writeJson(ASSISTANT_PAYMENTS_KEY, [...list, item]);
  return item;
}

export async function approveAssistantPayment(id: string) {
  const list = await getAssistantPayments();
  const updated = list.map((x: any) => x.id === id ? {
    ...x,
    status: 'approved',
    approved_at: new Date().toISOString(),
  } : x);
  await _writeJson(ASSISTANT_PAYMENTS_KEY, updated);
  return updated.find((x: any) => x.id === id) || null;
}

export async function rejectAssistantPayment(id: string) {
  const list = await getAssistantPayments();
  const updated = list.map((x: any) => x.id === id ? {
    ...x,
    status: 'rejected',
    rejected_at: new Date().toISOString(),
  } : x);
  await _writeJson(ASSISTANT_PAYMENTS_KEY, updated);
  return updated.find((x: any) => x.id === id) || null;
}


export async function transferAssistantInvoice(id: string) {
  const inv = await getAssistantInvoiceById(id);
  if (!inv) throw new Error('فاکتور پیدا نشد');
  if (inv.status === 'transferred') return inv;
  if (inv.status !== 'approved' && inv.status !== 'edited') {
    throw new Error('فاکتور باید اول تأیید شود');
  }

  let invoiceNumber = String(inv.invoice_number || '').trim();
  const grouped = await getSalesGrouped();
  const q = await getQueue();
  const existing = new Set<string>();
  (grouped || []).forEach((g: any) => existing.add(String(g.invoice || '')));
  (q || []).filter((x: any) => x.op === 'createSale').forEach((x: any) => existing.add(String(x.payload?.invoiceNumber || '')));

  if (!invoiceNumber || existing.has(invoiceNumber)) {
    invoiceNumber = await generateInvoiceNumber();
    let guard = 0;
    while (existing.has(invoiceNumber) && guard < 5) {
      invoiceNumber = await generateInvoiceNumber();
      guard++;
    }
  }

  let customerCode = String(inv.customer_code || '').trim();
  if (!customerCode) customerCode = await generateCustomerCode();

  const items = (Array.isArray(inv.items) ? inv.items : []).map((it: any) => ({
    modelCode: it.code || it.modelCode || '',
    modelName: it.name || it.modelName || '',
    shelf: it.shelf || '',
    quantity: Number(it.qty_pairs ?? it.quantity ?? 0) || 0,
    priceUnit: Number(it.price_unit ?? it.priceUnit ?? 0) || 0,
    payment: 0,
  }));

  const payload: any = {
    invoiceNumber,
    customerCode,
    customerName: inv.customer_name || '',
    customerPhone: inv.phone || '',
    customerAddress: inv.address || '',
    shipping: inv.shipping || '',
    items,
    note: inv.note || '',
  };

  await createSale(payload);
  const updated = await markAssistantInvoiceTransferred(id, invoiceNumber);
  return updated;
}
