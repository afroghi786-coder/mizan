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

export async function processRubikaUpdatesSimple(token: string): Promise<{ ok: boolean; processed: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, processed: 0, error: 'توکن ربات خالی است' };

  try {
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
      const data: any = await res.json().catch(() => null);
      
      if (!data || (data.status !== 'OK' && data.ok !== true)) {
        const st = String(data?.status || '');
        if (st === 'TOO_REQUESTS') return { ok: false, processed: totalProcessed, error: 'TOO_REQUESTS' };
        console.log('[GET_UPDATES_ERR] ' + st);
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

          const msgText = normText(msg?.text || '');
          let cbData = '';
          const rawCb = u.data || cb?.data || u.button_id || null;
          if (typeof rawCb === 'string') cbData = rawCb;
          else if (rawCb && typeof rawCb === 'object') {
            cbData = String(rawCb.data || rawCb.id || rawCb.button_id || rawCb.value || JSON.stringify(rawCb));
          }
          cbData = cbData.trim();
          const replyTo = String(msg?.reply_to_message_id || u.reply_to_message_id || '');

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
                  const bank = 'نامشخص';
                  const holder = 'نامشخص';
                  inv.paid = Number(inv.paid || 0) + amount;
                  const remaining = Number(inv.total || 0) - inv.paid;
                  await setInv(map.invoice_number, inv);
                  
                  const debtStatus = remaining < 0 ? 'بستانکاری: ' + fmt(Math.abs(remaining)) : 'بدهی: ' + fmt(remaining);
                  
                  await botSend(t, chatId, '✅ تسویه حساب انجام شد!\n👤 کاربر: ' + inv.customer_name + '\n🏦 بانک: ' + bank + '\n👤 صاحب حساب: ' + holder + '\n💰 مبلغ واریز: ' + fmt(amount) + '\n💳 وضعیت حساب: ' + debtStatus);
                  
                  if (inv.customer_chat_id) {
                    await botSend(t, inv.customer_chat_id, '✅ تسویه حساب شما تایید شد!\n🏦 بانک: ' + bank + '\n👤 صاحب حساب: ' + holder + '\n💰 مبلغ واریز: ' + fmt(amount) + '\n💳 وضعیت حساب: ' + debtStatus);
                  }
                  totalProcessed++;
                  continue;
                }
              }
            }
          }

          const action = cbData || msgText;

          if (action === 'menu' || action === 'menu_back' || msgText === '/start' || msgText === '🏠 منوی اصلی' || msgText === 'منو') {
            await clearState(chatId);
            await showMainMenu(t, chatId);
            totalProcessed++; continue;
          }

          if (action === 'menu_products' || msgText === '🛍️ مشاهده محصولات' || msgText.includes('مشاهده محصولات')) {
            await clearState(chatId);
            await showProducts(t, chatId);
            totalProcessed++; continue;
          }

          if (action === 'menu_cart' || msgText === '🛒 سبد خرید من' || msgText.includes('سبد خرید')) {
            await clearState(chatId);
            await showCart(t, chatId);
            totalProcessed++; continue;
          }

          if (action === 'cart_clear' || msgText === '🗑️ خالی کردن سبد' || msgText === '🗑️ خالی کردن') {
            await setCart(chatId, []);
            await clearState(chatId);
            await botSend(t, chatId, '🗑️ سبد خرید شما خالی شد.');
            await showMainMenu(t, chatId);
            totalProcessed++; continue;
          }

          if (action === 'cart_checkout' || msgText === '✅ پایان انتخاب محصولات' || msgText === '✅ نهایی سازی سفارش') {
            const c = await getCart(chatId);
            if (!c.length) { await botSend(t, chatId, '⚠️ سبد خرید شما خالی است.'); totalProcessed++; continue; }
            await setState(chatId, { step: 'waiting_name' });
            await botSend(t, chatId, '👤 لطفاً نام و نام خانوادگی خود را وارد کنید:');
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
            const catalog = await getCatalogCached();
            const p = (catalog.products || []).find((x: any) => String(x.code) === String(code));
            if (!p) { await botSend(t, chatId, '❌ محصول با این کد یافت نشد.'); totalProcessed++; continue; }
            await setState(chatId, { step: 'waiting_qty', code: p.code, name: p.name, price: p.price || 0 });
            await botSend(t, chatId, '📦 ' + p.name + '\n💰 قیمت: ' + fmt(p.price || 0) + '\n📦 قفسه: ' + (p.shelf || '—') + '\n\n🔢 تعداد کارتن مورد نظر را وارد کنید:', { rows: [
              { buttons: [{ id: 'qty_1', button_text: '۱' }, { id: 'qty_2', button_text: '۲' }, { id: 'qty_3', button_text: '۳' }] },
              { buttons: [{ id: 'qty_5', button_text: '۵' }, { id: 'qty_10', button_text: '۱۰' }, { id: 'qty_other', button_text: 'سایر' }] },
              { buttons: [{ id: 'menu', button_text: '🏠 منوی اصلی' }] }
            ] });
            totalProcessed++; continue;
          }

          if (action.startsWith('qty_')) {
            const state = await getState(chatId);
            if (!state || state.step !== 'waiting_qty') { await showMainMenu(t, chatId); totalProcessed++; continue; }
            if (action === 'qty_other') {
              await setState(chatId, { step: 'waiting_qty_other', code: state.code, name: state.name, price: state.price });
              await botSend(t, chatId, '🔢 تعداد دلخواه را وارد کنید:');
              totalProcessed++; continue;
            }
            const n = Number(action.replace('qty_', ''));
            if (n > 0) {
              const cart = await getCart(chatId);
              const existing = cart.find((x: any) => String(x.code) === String(state.code));
              if (existing) existing.qty += n;
              else cart.push({ code: state.code, name: state.name, price: state.price, qty: n });
              await setCart(chatId, cart);
              await clearState(chatId);
              await botSend(t, chatId, '✅ به سبد خرید اضافه شد. یک محصول دیگر اضافه می‌کنید یا سفارش را نهایی می‌کنید؟', { rows: [
                { buttons: [{ id: 'menu_products', button_text: '➕ سفارش بعدی' }, { id: 'menu_cart', button_text: '🛒 سبد خرید' }] },
                { buttons: [{ id: 'cart_checkout', button_text: '✅ نهایی سازی سفارش' }] }
              ] });
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
              const found = await offlineMod.findCustomerByPhoneOffline(phone);
              if (found) customerCode = String(found.customer_code || found.code || '');
              if (!customerCode) customerCode = await offlineMod.generateCustomerCode();
            } catch { customerCode = 'M_' + Date.now(); }

            let prevSales = 0, prevPaid = 0, prevCount = 0;
            try {
              const grouped = await offlineMod.getSalesGrouped();
              const prev = (grouped || []).filter((g: any) => String(g.phone || '') === phone || (state.name && String(g.name || '') === String(state.name)));
              prev.forEach((g: any) => { prevSales += Number(g.total || 0); prevPaid += Number(g.paid || 0); });
              prevCount = prev.length;
            } catch {}

            let invNum = '';
            try { 
              const baseInv = await offlineMod.generateInvoiceNumber(); 
              invNum = 'BOT-' + baseInv;
            } catch { invNum = 'BOT-INV-' + Date.now(); }

            let total = 0;
            cart.forEach((it: any) => { total += Number(it.price || 0) * Number(it.qty || 0); });

            const prevBalance = prevSales - prevPaid;
            const grandTotal = total + prevBalance;

            let custInvText = '🧾 فاکتور شماره: ' + invNum + '\n🆔 کد مشتری: ' + customerCode + '\n\n';
            cart.forEach((it: any, i: number) => { custInvText += (i + 1) + '. ' + it.name + ' (' + it.code + ') × ' + it.qty + ' = ' + fmt(Number(it.price || 0) * Number(it.qty || 0)) + '\n'; });
            custInvText += '\n💰 جمع سفارش: ' + fmt(total) + '\n';
            if (prevCount > 0) custInvText += '📌 بدهی قبلی: ' + fmt(prevBalance) + '\n';
            custInvText += '💳 مبلغ قابل پرداخت: ' + fmt(grandTotal) + '\n\n';
            custInvText += 'لطفاً برای ثبت واریزی، روی همین فاکتور ریپلای بزنید و مبلغ واریزی را ارسال کنید.';
            
            await botSend(t, chatId, custInvText);
            
            const adminInvText = '📬 فاکتور جدید از مشتری: ' + (state.name || 'نامشخص') + '\n🆔 کد مشتری: ' + customerCode + '\n💳 بدهی فعلی: ' + fmt(grandTotal);
            
            let mid = '';
            if (adminChat) {
              mid = await botSend(t, adminChat, adminInvText);
              if (mid) await setAdminInv(String(mid), { invoice_number: invNum });
            }

            await setInv(invNum, { invoice_number: invNum, customer_chat_id: chatId, customer_name: state.name || '', customer_code: customerCode, total: grandTotal, paid: 0, items: cart });

            try {
              await assistantMod.issueAssistantInvoice({
                id: 'inv_' + Date.now(), invoice_number: invNum, customer_name: state.name || '', customer_phone: phone, customer_address: state.address || '', customer_shipping: state.shipping || '', customer_code: customerCode, items: cart.map((it: any) => ({ code: it.code, name: it.name, qty: it.qty, priceUnit: it.price, total: Number(it.price || 0) * Number(it.qty || 0) })), total_amount: grandTotal, status: 'issued', created_at: new Date().toISOString(), source: 'rubika'
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
              if (!n || n <= 0) { await botSend(t, chatId, '⚠️ لطفاً یک عدد معتبر وارد کنید.'); totalProcessed++; continue; }
              const cart = await getCart(chatId);
              const existing = cart.find((x: any) => String(x.code) === String(state.code));
              if (existing) existing.qty += n;
              else cart.push({ code: state.code, name: state.name, price: state.price, qty: n });
              await setCart(chatId, cart);
              await clearState(chatId);
              await botSend(t, chatId, '✅ به سبد خرید اضافه شد.', { rows: [
                { buttons: [{ id: 'menu_products', button_text: '➕ سفارش بعدی' }, { id: 'menu_cart', button_text: '🛒 سبد خرید' }] },
                { buttons: [{ id: 'cart_checkout', button_text: '✅ نهایی سازی سفارش' }] }
              ] });
              totalProcessed++; continue;
            }
            if (state.step === 'waiting_name') { state.name = msgText; state.step = 'waiting_phone'; await setState(chatId, state); await botSend(t, chatId, '📞 شماره تماس خود را وارد کنید:'); totalProcessed++; continue; }
            if (state.step === 'waiting_phone') { state.phone = msgText; state.step = 'waiting_address'; await setState(chatId, state); await botSend(t, chatId, '📍 آدرس دقیق خود را وارد کنید:'); totalProcessed++; continue; }
            if (state.step === 'waiting_address') { state.address = msgText; state.step = 'waiting_shipping'; await setState(chatId, state); await botSend(t, chatId, '🚚 نام باربری را وارد کنید:'); totalProcessed++; continue; }
            if (state.step === 'waiting_shipping') {
              state.shipping = msgText; state.step = 'confirm'; await setState(chatId, state);
              const cart = await getCart(chatId);
              let total = 0; const lines: string[] = [];
              cart.forEach((it: any, i: number) => { total += Number(it.price || 0) * Number(it.qty || 0); lines.push((i + 1) + '. ' + it.name + ' (' + it.code + ') × ' + it.qty + ' = ' + fmt(Number(it.price || 0) * Number(it.qty || 0))); });
              const reply = '🧾 پیش‌فاکتور سفارش\n\n👤 ' + state.name + '\n📞 ' + state.phone + '\n📍 ' + state.address + '\n🚚 ' + state.shipping + '\n\n' + lines.join('\n') + '\n\n💰 مبلغ کل: ' + fmt(total) + ' افغانی\n\nآیا سفارش را تأیید می‌کنید؟';
              await botSend(t, chatId, reply, { rows: [{ buttons: [{ id: 'confirm_yes', button_text: '✅ تأیید سفارش' }, { id: 'confirm_no', button_text: '❌ انصراف' }] }] });
              totalProcessed++; continue;
            }
            if (state.step === 'waiting_payment') {
              if (adminChat) {
                const amount = Number(String(msgText).replace(/[^0-9]/g, '')) || 0;
                const inv = await getInv(state.invoice_number);
                if (inv && inv.admin_message_id) {
                  const bank = 'نامشخص';
                  const holder = 'نامشخص';
                  const mid = await botSend(t, adminChat, '📱 پیامک تراکنش از مشتری:\n👤 کاربر: ' + inv.customer_name + '\n🏦 بانک: ' + bank + '\n👤 صاحب حساب: ' + holder + '\n💰 مبلغ: ' + fmt(amount) + '\n📝 شماره تراکنش: ' + msgText.slice(0, 100));
                  if (mid) await setAdminInv(String(mid), { invoice_number: inv.invoice_number });
                  await botSend(t, chatId, '✅ پیامک تراکنش شما به حسابدار ارسال شد. پس از تایید، بدهی شما به‌روزرسانی می‌شود.');
                } else {
                  await botSend(t, chatId, '⚠️ فاکتور یافت نشد.');
                }
              }
              totalProcessed++; continue;
            }
          }

          const _codeMatch = msgText.match(/^(?:[sS][_-]?)?(\d{1,6})$/);
          if (_codeMatch) {
            const code = String(_codeMatch[1]).padStart(3, '0');
            const catalog = await getCatalogCached();
            const p = (catalog.products || []).find((x: any) => String(x.code) === code || String(x.code) === String(_codeMatch[1]));
            if (p) {
              await setState(chatId, { step: 'waiting_qty', code: p.code, name: p.name, price: p.price || 0 });
              await botSend(t, chatId, '📦 ' + p.name + '\n💰 قیمت: ' + fmt(p.price || 0) + '\n📦 قفسه: ' + (p.shelf || '—') + '\n\n🔢 تعداد کارتن مورد نظر را وارد کنید:', { rows: [
                { buttons: [{ id: 'qty_1', button_text: '۱' }, { id: 'qty_2', button_text: '۲' }, { id: 'qty_3', button_text: '۳' }] },
                { buttons: [{ id: 'qty_5', button_text: '۵' }, { id: 'qty_10', button_text: '۱۰' }, { id: 'qty_other', button_text: 'سایر' }] },
                { buttons: [{ id: 'menu', button_text: '🏠 منوی اصلی' }] }
              ] });
            } else {
              await botSend(t, chatId, '❌ محصولی با کد ' + code + ' یافت نشد.');
            }
            totalProcessed++; continue;
          }
          await botSend(t, chatId, '🤖 متوجه نشدم. لطفاً /start را بزنید.');

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
