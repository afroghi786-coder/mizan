import AsyncStorage from './lib.storage';
import { getBotConfig, issueAssistantInvoice } from './lib.assistant';
import { generateInvoiceNumber } from './lib.offline';
import { buildCatalogIndex, findProduct } from './lib.assistant.catalog';

const RUBIKA_BASE = 'https://botapi.rubika.ir/v3';

let __catalogCache: any = null;
let __catalogCacheAt = 0;
async function getCatalogCached() {
  const now = Date.now();
  if (!__catalogCache || now - __catalogCacheAt > 30000) {
    __catalogCache = await buildCatalogIndex();
    __catalogCacheAt = now;
  }
  return __catalogCache;
}

async function botSend(t: string, chatId: string, text: string, keypad?: any): Promise<string> {
  const buildBody = () => {
    const body: any = { chat_id: chatId, text: text || '' };
    if (keypad && Array.isArray(keypad.rows)) {
      const cleanRows = keypad.rows
        .map((row: any, ri: number) => ({
          buttons: (Array.isArray(row.buttons) ? row.buttons : [])
            .map((btn: any, bi: number) => {
              const label = String(btn.button_text || btn.text || '').trim();
              if (!label) return null;
              return { id: String(btn.id || ('btn_' + ri + '_' + bi)), type: 'Simple', button_text: label.slice(0, 30) };
            })
            .filter(Boolean),
        }))
        .filter((row: any) => row.buttons.length > 0);
      if (cleanRows.length > 0) body.inline_keypad = { rows: cleanRows };
    }
    return body;
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = buildBody();
      const res = await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch {}
      
      if (!res.ok) {
        console.log('[botSend HTTP] ' + res.status + ' — ' + txt);
        if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
        return '';
      }
      
      if (data && data.status === 'TOO_REQUESTS') {
        throw new Error('TOO_REQUESTS');
      }
      
      return String(data?.result?.message_id || data?.message_id || '');
    } catch (e: any) {
      console.log('[botSend Error]', e?.message || e);
      if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
      return '';
    }
  }
  return '';
}

async function getCart(chatId: string): Promise<any[]> {
  try { const r = await AsyncStorage.getItem('@mizan_bot_cart_' + chatId); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
async function setCart(chatId: string, cart: any[]): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_cart_' + chatId, JSON.stringify(cart || [])); } catch {}
}
async function getState(chatId: string): Promise<any> {
  try { const r = await AsyncStorage.getItem('@mizan_bot_state_' + chatId); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setState(chatId: string, state: any): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_state_' + chatId, JSON.stringify(state || {})); } catch {}
}
async function clearState(chatId: string): Promise<void> {
  try { await AsyncStorage.removeItem('@mizan_bot_state_' + chatId); } catch {}
}
async function getAdminInv(id: string): Promise<any> {
  try { const r = await AsyncStorage.getItem('@mizan_bot_admin_' + id); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setAdminInv(id: string, inv: any): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_admin_' + id, JSON.stringify(inv)); } catch {}
}
async function getInv(n: string): Promise<any> {
  try { const r = await AsyncStorage.getItem('@mizan_bot_inv_' + n); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setInv(n: string, inv: any): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_inv_' + n, JSON.stringify(inv)); } catch {}
}

function fmt(n: number): string { return Number(n || 0).toLocaleString('en-US'); }

async function showMainMenu(t: string, chatId: string) {
  await botSend(t, chatId, '🏠 منوی اصلی میزان:', { rows: [{ buttons: [
    { id: 'menu_products', button_text: '📦 لیست محصولات' },
    { id: 'menu_cart', button_text: '🛒 سبد خرید' },
  ] }] });
}

async function showProducts(t: string, chatId: string) {
  try {
    const catalog = await getCatalogCached();
    const arr = Array.isArray(catalog.products) ? catalog.products : [];
    const valid = arr.filter((p: any) => String(p.code || '').trim());
    if (!valid.length) { await botSend(t, chatId, '⚠️ هیچ محصولی ثبت نشده است.', { rows: [{ buttons: [{ id: 'menu', button_text: '🏠 منوی اصلی' }] }] }); return; }
    const rows: any[] = [];
    for (const p of valid.slice(0, 20)) rows.push({ buttons: [{ id: String(p.code), button_text: String(p.code).slice(0, 30) }] });
    rows.push({ buttons: [{ id: 'menu', button_text: '🏠 منوی اصلی' }] });
    await botSend(t, chatId, '🛍️ لیست کدهای محصولات:', { rows });
  } catch (e: any) { await botSend(t, chatId, '❌ خطا: ' + (e?.message || '')); }
}

async function showQuantity(t: string, chatId: string, code: string) {
  await setState(chatId, { step: 'waiting_qty', code });
  await botSend(t, chatId, '📦 مدل ' + code + '\nچند کارتن؟', { rows: [
    { buttons: [{ id: 'qty_1', button_text: '۱' }, { id: 'qty_2', button_text: '۲' }, { id: 'qty_3', button_text: '۳' }] },
    { buttons: [{ id: 'qty_5', button_text: '۵' }, { id: 'qty_10', button_text: '۱۰' }, { id: 'qty_other', button_text: 'سایر' }] },
    { buttons: [{ id: 'menu', button_text: '🔙 بازگشت' }] },
  ] });
}

async function showCart(t: string, chatId: string) {
  const cart = await getCart(chatId);
  if (!cart.length) { await botSend(t, chatId, '🛒 سبد خرید شما خالی است.', { rows: [{ buttons: [{ id: 'menu', button_text: '🏠 منوی اصلی' }] }] }); return; }
  let total = 0; let text = '🛒 سبد خرید شما:\n\n';
  cart.forEach((it: any, i: number) => { const sub = Number(it.price || 0) * Number(it.qty || 0); total += sub; text += (i + 1) + '. ' + it.name + ' (' + it.code + ') × ' + it.qty + ' = ' + fmt(sub) + ' افغانی\n'; });
  text += '\n💰 جمع کل: ' + fmt(total) + ' افغانی';
  const rows: any[] = [];
  for (const it of cart) rows.push({ buttons: [{ id: 'cart_remove_' + String(it.code), button_text: '🗑️ حذف ' + String(it.name).slice(0, 15) }] });
  rows.push({ buttons: [{ id: 'cart_checkout', button_text: '✅ پایان انتخاب محصولات' }, { id: 'cart_clear', button_text: '🗑️ خالی کردن سبد' }] });
  rows.push({ buttons: [{ id: 'menu', button_text: '🏠 منوی اصلی' }] });
  await botSend(t, chatId, text, { rows });
}

async function addToCart(chatId: string, code: string, cartons: number): Promise<boolean> {
  const catalog = await getCatalogCached();
  const p = findProduct(catalog, code);
  if (!p) return false;
  const cart = await getCart(chatId);
  const qtyPairs = Number(p.raw?.qty_pairs) || 0;
  const totalQty = qtyPairs > 0 ? cartons * qtyPairs : cartons;
  const idx = cart.findIndex((x: any) => String(x.code) === String(code));
  if (idx >= 0) { cart[idx].qty += totalQty; cart[idx].cartons = (cart[idx].cartons || 0) + cartons; }
  else cart.push({ code: String(code), name: p.name || code, price: Number(p.price || 0), qty: totalQty, cartons, qty_pairs: qtyPairs });
  await setCart(chatId, cart);
  return true;
}

const SEEN_KEY = '@mizan_bot_seen_msgs_v2';

async function loadSeen(): Promise<Set<string>> {
  try { const r = await AsyncStorage.getItem(SEEN_KEY); const a = r ? JSON.parse(r) : []; return new Set(Array.isArray(a) ? a.map(String) : []); } catch { return new Set(); }
}
async function saveSeen(set: Set<string>) {
  try { const arr = Array.from(set).slice(-500); await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(arr)); } catch {}
}

async function getBotOffset(): Promise<string> {
  try { return (await AsyncStorage.getItem('@mizan_rubika_offset')) || ''; } catch { return ''; }
}
async function setBotOffset(v: string): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_rubika_offset', String(v || '')); } catch {}
}

let _offsetMemory = '';

export let __mizanOffset = '';

function normText(s: any): string {
  try {
    return String(s || '')
      .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch { return ''; }
}


let _botPollingTimer: any = null;
let _webhookRemoved = false;

export async function processRubikaUpdatesSimple(token: string): Promise<{ ok: boolean; processed: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, processed: 0, error: 'توکن ربات خالی است' };

  try {
    // حذف Webhook در اولین اجرا (برای جلوگیری از سکوت ربات)
    if (!_webhookRemoved) {
      try {
        await fetch(RUBIKA_BASE + '/' + t + '/updateBotEndpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: '' }),
        });
        _webhookRemoved = true;
        console.log('[WEBHOOK_REMOVED]');
      } catch {}
    }

    const cfg = await getBotConfig();
    const adminChat = String(cfg?.rubika_admin_chat_id || '').trim();
    const offlineMod: any = await import('./lib.offline');
    const assistantMod: any = await import('./lib.assistant');

    let offsetId = __mizanOffset;
    if (!offsetId) { try { offsetId = String((globalThis as any).__mizanOffset || ''); } catch {} }
    if (!offsetId) { try { offsetId = String(await getBotOffset() || ''); } catch {} }
    
    const seen = await loadSeen();
    let totalProcessed = 0;
    const MAX_ITER = 25;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const body: any = { limit: 50 };
      if (offsetId) body.offset_id = offsetId;
      
      const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch {}
      
      if (!data || (data.status !== 'OK' && data.ok !== true)) {
        const st = String(data?.status || '');
        if (st === 'TOO_REQUESTS') return { ok: false, processed: totalProcessed, error: 'TOO_REQUESTS' };
        console.log('[GET_UPDATES_ERR] ' + st + ' — ' + txt.slice(0, 100));
        break;
      }

      const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
      if (updates.length === 0) break;

      for (const u of updates) {
        try {
          const isChannel = /channel/i.test(String(u.type || '')) || !!u.channel_post || (u.chat_id && String(u.chat_id).startsWith('c'));
          if (isChannel) continue;

          const msg = u.new_message || u.message || null;
          const cb = u.callback_query || null;
          const chatId = String(u.chat_id || msg?.chat_id || cb?.chat_id || cb?.message?.chat_id || '');
          
          if (!chatId) continue;
          if (chatId.startsWith('c')) continue;

          const msgId = String(msg?.message_id || cb?.message?.message_id || '');
          if (msgId && seen.has(msgId)) continue;
          if (msgId) seen.add(msgId);

          const msgText = normText(msg?.text || msg?.caption || '').trim();
          let cbData = '';
          const rawCb = u.data || cb?.data || u.button_id || null;
          if (typeof rawCb === 'string') cbData = rawCb;
          else if (rawCb && typeof rawCb === 'object') {
            cbData = String(rawCb.data || rawCb.id || rawCb.button_id || rawCb.value || JSON.stringify(rawCb));
          }
          cbData = cbData.trim();
          const replyTo = String(msg?.reply_to_message_id || u.reply_to_message_id || '');
          const action = cbData || msgText;

          // ... (منطق پردازش پیام - همان کد قبلی) ...
          // (اینجا همان کدهای قبلی برای منو، سبد، پرداخت و ... قرار می‌گیرد)

        } catch (err: any) {
          console.log('[LOOP_ERR] Skipping update due to error:', err?.message || err);
        }
      }

      const nextOffset = String(data.data?.next_offset_id || data.next_offset_id || '').trim();
      if (!nextOffset || nextOffset === offsetId) break;
      offsetId = nextOffset;
      if (updates.length < 50) break;
    }

    if (offsetId) {
      __mizanOffset = offsetId;
      try { (globalThis as any).__mizanOffset = offsetId; } catch {}
      try { await setBotOffset(offsetId); } catch {}
    }

    await saveSeen(seen);
    return { ok: true, processed: totalProcessed };
  } catch (e: any) {
    return { ok: false, processed: 0, error: e?.message || 'خطا' };
  }
}

export function startBotPolling(token: string) {
  stopBotPolling();
  if (!token) return;
  console.log('[BOT_POLLING_STARTED]');
  _botPollingTimer = setInterval(async () => {
    try { await processRubikaUpdatesSimple(token); } catch {}
  }, 3000);
}

export function stopBotPolling() {
  if (_botPollingTimer) {
    clearInterval(_botPollingTimer);
    _botPollingTimer = null;
    console.log('[BOT_POLLING_STOPPED]');
  }
}

