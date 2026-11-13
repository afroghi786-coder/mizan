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
      const data: any = await res.json().catch(() => null);
      if (data && data.status === 'TOO_REQUESTS') {
        throw new Error('TOO_REQUESTS');
      }
      if (!res.ok) console.log('[botSend HTTP] ' + res.status);
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
    if (!valid.length) { await botSend(t, chatId, '❌ هیچ محصولی یافت نشد.', { rows: [{ buttons: [{ id: 'menu', button_text: '🔙 بازگشت' }] }] }); return; }
    const rows: any[] = [];
    for (const p of valid.slice(0, 20)) rows.push({ buttons: [{ id: 'sel_' + String(p.code), button_text: String(p.code).slice(0, 30) }] });
    rows.push({ buttons: [{ id: 'menu', button_text: '🔙 بازگشت' }] });
    await botSend(t, chatId, '📦 لیست کد محصولات:', { rows });
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
  if (!cart.length) { await botSend(t, chatId, '🛒 سبد خالی است.', { rows: [{ buttons: [{ id: 'menu', button_text: '🔙 بازگشت' }] }] }); return; }
  let total = 0; let text = '🛒 سبد:\n\n';
  cart.forEach((it: any, i: number) => { const sub = Number(it.price || 0) * Number(it.qty || 0); total += sub; text += (i + 1) + '. ' + it.code + ' — ' + it.qty + ' جفت — ' + fmt(sub) + ' تومان\n'; });
  text += '\n💰 جمع: ' + fmt(total) + ' تومان';
  const rows: any[] = [];
  for (const it of cart) rows.push({ buttons: [{ id: 'cart_remove_' + String(it.code), button_text: '🗑️ حذف ' + String(it.code).slice(0, 15) }] });
  rows.push({ buttons: [{ id: 'cart_checkout', button_text: '✅ نهایی' }, { id: 'cart_clear', button_text: '🧹 خالی' }] });
  rows.push({ buttons: [{ id: 'menu', button_text: '🔙 بازگشت' }] });
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

export async function processRubikaUpdatesSimple(token: string): Promise<{ ok: boolean; processed: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, processed: 0, error: 'توکن خالی' };

  try {
    const cfg = await getBotConfig();
    const adminChat = String(cfg?.rubika_admin_chat_id || '').trim();

    let offsetId = __mizanOffset;
    if (!offsetId) { try { offsetId = String((globalThis as any).__mizanOffset || ''); } catch {} }
    if (!offsetId) { try { offsetId = String(await getBotOffset() || ''); } catch {} }
    let diskOffset = '';
    try { diskOffset = String(await getBotOffset() || ''); } catch {}
    console.log('[OFFSET_INIT] mem=' + (__mizanOffset || 'NONE') + ' glob=' + (String((globalThis as any).__mizanOffset || '') || 'NONE') + ' disk=' + (diskOffset || 'NONE'));

    const seen = await loadSeen();
    let totalProcessed = 0;
    const MAX_ITER = 25;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const body: any = { limit: 50 };
      if (offsetId) body.offset_id = offsetId;
      console.log('[GET_UPDATES] iter=' + iter + ' body=' + JSON.stringify(body));

      const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: any = await res.json().catch(() => null);
      if (!data || (data.status !== 'OK' && data.ok !== true)) {
        const st = String(data?.status || '');
        if (st === 'TOO_REQUESTS') return { ok: false, processed: totalProcessed, error: 'TOO_REQUESTS' };
        console.log('[GET_UPDATES_ERR] ' + st);
        break;
      }

      const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
    const recentUpdates = updates.slice(-10);
      console.log('[GET_UPDATES_OK] iter=' + iter + ' count=' + updates.length);

      if (updates.length === 0) {
        console.log('[GET_UPDATES_DONE] caught up');
        break;
      }

      for (const u of recentUpdates) {
        if (u.type !== 'NewMessage' && !u.callback_query && !u.data) continue;
        const chatId = String(u.chat_id || u.new_message?.chat_id || '');
        if (!chatId || chatId.startsWith('c0')) continue;

        const msgId = String(u.new_message?.message_id || '');
        if (msgId && seen.has(msgId)) continue;
        if (msgId) seen.add(msgId);

        const msgText = normText(u.new_message?.text || '');
        let cbData = '';
        const rawCb = u.data || u.callback_query?.data || u.button_id || u.callback_query || null;
        if (typeof rawCb === 'string') cbData = rawCb;
        else if (rawCb && typeof rawCb === 'object') {
          cbData = String(rawCb.data || rawCb.id || rawCb.button_id || rawCb.value || JSON.stringify(rawCb));
        }
        cbData = cbData.trim();
        const replyTo = String(u.new_message?.reply_to_message_id || u.reply_to_message_id || '');

        console.log('[PROC] chat=' + chatId + ' text=' + JSON.stringify(msgText.slice(0,30)) + ' cb=' + JSON.stringify(cbData));

        if (adminChat && chatId === adminChat && replyTo) {
          const map = await getAdminInv(replyTo);
          if (map && map.invoice_number) {
            const inv = await getInv(map.invoice_number);
            if (inv) {
              let amount = Number(String(msgText).replace(/[^0-9]/g, '')) || 0;
              if (!amount && (msgText === 'تایید' || msgText === 'تأیید')) {
                amount = Number(inv.total || 0) - Number(inv.paid || 0);
              }
              if (amount > 0) {
                inv.paid = Number(inv.paid || 0) + amount;
                const remaining = Number(inv.total || 0) - inv.paid;
                await setInv(map.invoice_number, inv);
                await botSend(t, chatId, '✅ پرداخت ثبت شد\n🧾 ' + inv.invoice_number + '\n💰 ' + fmt(amount) + '\n💳 کل پرداخت: ' + fmt(inv.paid) + '\n📌 مانده: ' + fmt(remaining));
                await botSend(t, inv.customer_chat_id, '✅ پرداخت شما ثبت شد\n🧾 ' + inv.invoice_number + '\n💰 ' + fmt(amount) + '\n📌 مانده: ' + fmt(remaining));
                try { await clearState(inv.customer_chat_id); } catch {}
                totalProcessed++;
                continue;
              }
            }
          }
        }

const action = cbData || msgText;

        if (action === 'menu' || action === 'menu_back' || msgText === '/start' || msgText === '🔙 بازگشت به منو' || msgText === '🔙 بازگشت' || msgText === 'منو') {
          await clearState(chatId);
          await showMainMenu(t, chatId);
          totalProcessed++; continue;
        }
        if (action === 'menu_products' || msgText === '📦 لیست محصولات' || msgText.includes('لیست محصولات')) {
          await clearState(chatId);
          await showProducts(t, chatId);
          totalProcessed++; continue;
        }
        if (action === 'menu_cart' || msgText === '🛒 سبد خرید' || msgText.includes('سبد خرید')) {
          await clearState(chatId);
          await showCart(t, chatId);
          totalProcessed++; continue;
        }
        if (action === 'cart_clear' || msgText === '🧹 خالی کردن' || msgText === '🧹 خالی') {
          await setCart(chatId, []);
          await clearState(chatId);
          await botSend(t, chatId, '🧹 سبد خرید خالی شد.');
          await showMainMenu(t, chatId);
          totalProcessed++; continue;
        }
        if (action === 'cart_checkout' || msgText === '✅ نهایی‌سازی' || msgText === '✅ نهایی') {
          const c = await getCart(chatId);
          if (!c.length) { await botSend(t, chatId, '❌ سبد خرید خالی است.'); totalProcessed++; continue; }
          await setState(chatId, { step: 'waiting_name' });
          await botSend(t, chatId, '📝 نام و نام خانوادگی خود را وارد کنید:');
          totalProcessed++; continue;
        }
        if (action.startsWith('cart_remove_')) {
          const code = action.slice('cart_remove_'.length);
          const c = await getCart(chatId);
          await setCart(chatId, c.filter((x: any) => String(x.code) !== String(code)));
          await showCart(t, chatId);
          totalProcessed++; continue;
        }
        if (action.startsWith('sel_')) {
          const code = action.slice(4);
          await showQuantity(t, chatId, code);
          totalProcessed++; continue;
        }
        if (action.startsWith('qty_')) {
          const state = await getState(chatId);
          if (!state || state.step !== 'waiting_qty') { await showMainMenu(t, chatId); totalProcessed++; continue; }
          if (action === 'qty_other') {
            await setState(chatId, { step: 'waiting_qty_other', code: state.code });
            await botSend(t, chatId, '🔢 تعداد کارتن را بنویسید:');
            totalProcessed++; continue;
          }
          const n = Number(action.replace('qty_', ''));
          if (n > 0) {
            await addToCart(chatId, state.code, n);
            await clearState(chatId);
            await showCart(t, chatId);
          }
          totalProcessed++; continue;
        }
        if (action === 'confirm_yes' || msgText === '✅ تأیید سفارش' || msgText === '✅ تأیید') {
          const state = await getState(chatId);
          const cart = await getCart(chatId);
          if (!state || state.step !== 'confirm' || !cart.length) { await showMainMenu(t, chatId); totalProcessed++; continue; }

          const phone = String(state.phone || '');
          let customerCode = '';
          try {
            const offlineMod: any = await import('./lib.offline');
            const found = await offlineMod.findCustomerByPhoneOffline(phone);
            if (found) customerCode = String(found.customer_code || found.code || '');
            if (!customerCode) {
              customerCode = await offlineMod.generateCustomerCode();
            }
          } catch { customerCode = 'M_' + Date.now(); }

          let prevSales = 0, prevPaid = 0, prevCount = 0;
          try {
            const offlineMod: any = await import('./lib.offline');
            const grouped = await offlineMod.getSalesGrouped();
            const prev = (grouped || []).filter((g: any) => String(g.phone || '') === phone || (state.name && String(g.name || '') === String(state.name)));
            prev.forEach((g: any) => { prevSales += Number(g.total || 0); prevPaid += Number(g.paid || 0); });
            prevCount = prev.length;
          } catch {}

          let invNum = '';
          try { invNum = await generateInvoiceNumber(); } catch { invNum = 'INV-' + Date.now(); }

          let total = 0;
          cart.forEach((it: any) => { total += Number(it.price || 0) * Number(it.qty || 0); });

          let invText = '🧾 پیش‌فاکتور سفارش\n';
          invText += '🧾 شماره: ' + invNum + '\n';
          invText += '👤 نام: ' + (state.name || '') + '\n';
          invText += '📞 تلفن: ' + phone + '\n';
          invText += '🆔 کد مشتری: ' + customerCode + '\n';
          invText += '📍 آدرس: ' + (state.address || '') + '\n';
          invText += '🚚 باربری: ' + (state.shipping || '') + '\n\n';
          cart.forEach((it: any, i: number) => { invText += (i + 1) + '. ' + it.code + ' × ' + it.qty + ' = ' + fmt(Number(it.price || 0) * Number(it.qty || 0)) + '\n'; });
          invText += '\n💰 جمع این سفارش: ' + fmt(total) + ' افغانی\n';
          if (prevCount > 0) {
            const prevBalance = prevSales - prevPaid;
            invText += '\n📊 خلاصه حساب قبلی:\n';
            invText += '🧾 تعداد فاکتورهای قبلی: ' + prevCount + '\n';
            invText += '💵 جمع خریدهای قبلی: ' + fmt(prevSales) + '\n';
            invText += '💳 جمع پرداخت‌های قبلی: ' + fmt(prevPaid) + '\n';
            invText += '📌 مانده قبلی: ' + fmt(prevBalance) + '\n';
            invText += '💰 مانده کل با این سفارش: ' + fmt(prevBalance + total) + '\n';
          }

          await botSend(t, chatId, invText + '\n📌 سفارش شما ثبت شد. برای هماهنگی پرداخت منتظر تماس ما باشید.');

          await setInv(invNum, { invoice_number: invNum, customer_chat_id: chatId, customer_name: state.name || '', customer_code: customerCode, total, paid: 0, items: cart });

          if (adminChat) {
            const mid = await botSend(t, adminChat, '📥 سفارش جدید:\n\n' + invText);
            if (mid) await setAdminInv(String(mid), { invoice_number: invNum });
          }

          try {
            await issueAssistantInvoice({
              id: 'inv_' + Date.now(),
              invoice_number: invNum,
              customer_name: state.name || '',
              customer_phone: phone,
              customer_address: state.address || '',
              customer_shipping: state.shipping || '',
              customer_code: customerCode,
              items: cart.map((it: any) => ({ code: it.code, name: it.name, qty: it.qty, priceUnit: it.price, total: Number(it.price || 0) * Number(it.qty || 0) })),
              total_amount: total,
              status: 'issued',
              created_at: new Date().toISOString(),
              source: 'rubika',
            });
          } catch {}

          await setCart(chatId, []);
          await setState(chatId, { step: 'waiting_payment', invoice_number: invNum });
          totalProcessed++; continue;
        }

if (action === 'confirm_no' || msgText === '❌ انصراف' || msgText === '❌ لغو') {
          await setCart(chatId, []);
          await clearState(chatId);
          await botSend(t, chatId, '❌ سفارش لغو شد.');
          await showMainMenu(t, chatId);
          totalProcessed++; continue;
        }

        const state = await getState(chatId);
        if (state && state.step) {
          if (state.step === 'waiting_qty_other') {
            const n = parseInt(String(msgText).replace(/[^0-9]/g, ''), 10);
            if (!n || n <= 0) { await botSend(t, chatId, '❌ لطفاً یک عدد معتبر وارد کنید.'); totalProcessed++; continue; }
            await addToCart(chatId, state.code, n);
            await clearState(chatId);
            await showCart(t, chatId);
            totalProcessed++; continue;
          }
          if (state.step === 'waiting_name') { state.name = msgText; state.step = 'waiting_phone'; await setState(chatId, state); await botSend(t, chatId, '📱 شماره تماس را وارد کنید:'); totalProcessed++; continue; }
          if (state.step === 'waiting_phone') { state.phone = msgText; state.step = 'waiting_address'; await setState(chatId, state); await botSend(t, chatId, '📍 آدرس را وارد کنید:'); totalProcessed++; continue; }
          if (state.step === 'waiting_address') { state.address = msgText; state.step = 'waiting_shipping'; await setState(chatId, state); await botSend(t, chatId, '🚚 نام باربری را وارد کنید:'); totalProcessed++; continue; }
          if (state.step === 'waiting_shipping') {
            state.shipping = msgText; state.step = 'confirm'; await setState(chatId, state);
            const cart = await getCart(chatId);
            let total = 0; const lines: string[] = [];
            cart.forEach((it: any, i: number) => { total += Number(it.price || 0) * Number(it.qty || 0); lines.push((i + 1) + '. ' + it.code + ' × ' + it.qty + ' = ' + fmt(Number(it.price || 0) * Number(it.qty || 0))); });
            const reply = '🧾 پیش‌فاکتور نهایی\n\n👤 ' + state.name + '\n📱 ' + state.phone + '\n📍 ' + state.address + '\n🚚 ' + state.shipping + '\n\n' + lines.join('\n') + '\n\n💰 جمع کل: ' + fmt(total) + ' تومان\n\nآیا تایید می‌کنید؟';
            await botSend(t, chatId, reply, { rows: [{ buttons: [{ id: 'confirm_yes', button_text: '✅ تایید' }, { id: 'confirm_no', button_text: '❌ لغو' }] }] });
            totalProcessed++; continue;
          }
          if (state.step === 'waiting_payment') {
            if (adminChat) {
              const amount = Number(String(msgText).replace(/[^0-9]/g, '')) || 0;
              const inv = await getInv(state.invoice_number);
              if (inv) {
                const mid = await botSend(t, adminChat, '💰 واریز از ' + inv.customer_name + '\n🔢 ' + inv.invoice_number + '\n📝 ' + msgText + '\n💰 ' + fmt(amount));
                if (mid) await setAdminInv(String(mid), { invoice_number: inv.invoice_number });
                await botSend(t, chatId, '✅ پیام واریز شما برای حسابدار ارسال شد.');
              }
            }
            totalProcessed++; continue;
          }
        }

        console.log('[FALLBACK] chat=' + chatId + ' text=' + JSON.stringify(msgText));
      const _codeMatch = msgText.match(/^(?:[sS][_-]?)?(\d{1,6})$/);
      if (_codeMatch) {
        const _code = 's_' + String(_codeMatch[1]).padStart(3, '0');
        await showQuantity(t, chatId, _code);
        totalProcessed++; continue;
      }
      await botSend(t, chatId, '🤖 دستور نامشخص. لطفاً /start را بزنید.');
        totalProcessed++;
      }

      const nextOffset = String(data.data?.next_offset_id || data.next_offset_id || '').trim();
      if (!nextOffset || nextOffset === offsetId) {
        console.log('[GET_UPDATES_STOP] no progress');
        break;
      }
      offsetId = nextOffset;

      if (updates.length < 50) {
        console.log('[GET_UPDATES_STOP] partial page');
        break;
      }
    }

    if (offsetId) {
      __mizanOffset = offsetId;
      try { (globalThis as any).__mizanOffset = offsetId; } catch {}
      try { await setBotOffset(offsetId); } catch {}
      console.log('[OFFSET_SAVED] ' + offsetId);
    }

    await saveSeen(seen);
    console.log('[DONE] processed=' + totalProcessed + ' seen=' + seen.size);
    return { ok: true, processed: totalProcessed };
  } catch (e: any) {
    console.log('[ERR] ' + (e?.message || e));
    try { await saveSeen(seen); } catch {}
    return { ok: false, processed: 0, error: e?.message || 'خطا' };
  }
}
