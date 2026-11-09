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

async function botSend(t: string, chatId: string, text: string, keypad?: any) {
  try {
    const body: any = { chat_id: chatId, text: text || '' };
    if (keypad && Array.isArray(keypad.rows)) {
      const cleanRows = keypad.rows
        .map((row: any, ri: number) => ({
          buttons: (Array.isArray(row.buttons) ? row.buttons : [])
            .map((btn: any, bi: number) => {
              const label = String(btn.button_text || btn.text || '').trim();
              if (!label) return null;
              return {
                id: String(btn.id || ('btn_' + ri + '_' + bi)),
                type: 'Simple',
                button_text: label.slice(0, 30),
              };
            })
            .filter(Boolean),
        }))
        .filter((row: any) => row.buttons.length > 0);
      if (cleanRows.length > 0) body.inline_keypad = { rows: cleanRows };
    }
    const res = await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => null);
    console.log('[DIAG_RESP] raw=' + JSON.stringify(data).slice(0, 800));
    return data?.result?.message_id || data?.message_id || '';
  } catch (e) {
    console.log('[botSend Error]', e);
    return '';
  }
}

async function getBotOffset() {
  try { return (await AsyncStorage.getItem('@mizan_rubika_offset')) || ''; } catch { return ''; }
}
async function setBotOffset(v: string) {
  try { await AsyncStorage.setItem('@mizan_rubika_offset', String(v || '')); } catch {}
}
async function getCart(chatId: string) {
  try { const r = await AsyncStorage.getItem('@mizan_bot_cart_' + chatId); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
async function setCart(chatId: string, cart: any[]) {
  try { await AsyncStorage.setItem('@mizan_bot_cart_' + chatId, JSON.stringify(cart || [])); } catch {}
}
async function getState(chatId: string) {
  try { const r = await AsyncStorage.getItem('@mizan_bot_state_' + chatId); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setState(chatId: string, state: any) {
  try { await AsyncStorage.setItem('@mizan_bot_state_' + chatId, JSON.stringify(state || {})); } catch {}
}
async function clearState(chatId: string) {
  try { await AsyncStorage.removeItem('@mizan_bot_state_' + chatId); } catch {}
}
async function getAdminInv(adminMsgId: string) {
  try { const r = await AsyncStorage.getItem('@mizan_bot_admin_' + adminMsgId); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setAdminInv(adminMsgId: string, inv: any) {
  try { await AsyncStorage.setItem('@mizan_bot_admin_' + adminMsgId, JSON.stringify(inv)); } catch {}
}
async function getInv(invNum: string) {
  try { const r = await AsyncStorage.getItem('@mizan_bot_inv_' + invNum); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setInv(invNum: string, inv: any) {
  try { await AsyncStorage.setItem('@mizan_bot_inv_' + invNum, JSON.stringify(inv)); } catch {}
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-US');
}

async function showMainMenu(t: string, chatId: string) {
  await botSend(t, chatId, '🏠 منوی اصلی میزان:', {
    rows: [
      { buttons: [
        { id: 'menu_products', button_text: '📦 لیست محصولات' },
        { id: 'menu_cart', button_text: '🛒 سبد خرید' },
      ] },
    ],
  });
}

async function showProducts(t: string, chatId: string) {
  try {
    const catalog = await getCatalogCached();
    const arr = Array.isArray(catalog.products) ? catalog.products : [];
    const valid = arr.filter((p: any) => String(p.code || '').trim());
    if (!valid.length) {
      await botSend(t, chatId, '❌ هیچ محصولی یافت نشد. لطفاً در میزان کالا ثبت کنید.', {
        rows: [{ buttons: [{ id: 'menu', button_text: '🔙 بازگشت به منو' }] }],
      });
      return;
    }
    const rows: any[] = [];
    for (const p of valid.slice(0, 20)) {
      rows.push({ buttons: [{ id: 'sel_' + String(p.code), button_text: String(p.code).slice(0, 30) }] });
    }
    rows.push({ buttons: [{ id: 'menu', button_text: '🔙 بازگشت به منو' }] });
    await botSend(t, chatId, '📦 لیست کد محصولات:\nبرای انتخاب، روی کد کلیک کنید:', { rows });
  } catch (e: any) {
    await botSend(t, chatId, '❌ خطا در دریافت محصولات: ' + (e?.message || ''));
  }
}

async function showQuantity(t: string, chatId: string, code: string) {
  await setState(chatId, { step: 'waiting_qty', code });
  await botSend(t, chatId, '📦 مدل ' + code + '\nچند کارتن می‌خواهید؟', {
    rows: [
      { buttons: [
        { id: 'qty_1', button_text: '۱ کارتن' },
        { id: 'qty_2', button_text: '۲ کارتن' },
        { id: 'qty_3', button_text: '۳ کارتن' },
      ] },
      { buttons: [
        { id: 'qty_5', button_text: '۵ کارتن' },
        { id: 'qty_10', button_text: '۱۰ کارتن' },
        { id: 'qty_other', button_text: 'سایر' },
      ] },
      { buttons: [{ id: 'menu', button_text: '🔙 بازگشت به منو' }] },
    ],
  });
}

async function showCart(t: string, chatId: string) {
  const cart = await getCart(chatId);
  if (!cart.length) {
    await botSend(t, chatId, '🛒 سبد خرید شما خالی است.', {
      rows: [{ buttons: [{ id: 'menu', button_text: '🔙 بازگشت به منو' }] }],
    });
    return;
  }
  let total = 0;
  let text = '🛒 سبد خرید شما:\n\n';
  cart.forEach((it: any, i: number) => {
    const sub = Number(it.price || 0) * Number(it.qty || 0);
    total += sub;
    text += (i + 1) + '. ' + it.code + ' — ' + it.qty + ' جفت — ' + fmt(sub) + ' تومان\n';
  });
  text += '\n💰 جمع کل: ' + fmt(total) + ' تومان';
  const rows: any[] = [];
  for (const it of cart) {
    rows.push({ buttons: [{ id: 'cart_remove_' + String(it.code), button_text: '🗑️ حذف ' + String(it.code).slice(0, 15) }] });
  }
  rows.push({ buttons: [
    { id: 'cart_checkout', button_text: '✅ نهایی‌سازی' },
    { id: 'cart_clear', button_text: '🧹 خالی کردن' },
  ] });
  rows.push({ buttons: [{ id: 'menu', button_text: '🔙 بازگشت به منو' }] });
  await botSend(t, chatId, text, { rows });
}

async function addToCart(chatId: string, code: string, cartons: number) {
  const catalog = await getCatalogCached();
  const p = findProduct(catalog, code);
  if (!p) return false;
  const cart = await getCart(chatId);
  const qtyPairs = Number(p.raw?.qty_pairs) || 0;
  const totalQty = qtyPairs > 0 ? cartons * qtyPairs : cartons;
  const existing = cart.findIndex((x: any) => String(x.code) === String(code));
  if (existing >= 0) {
    cart[existing].qty += totalQty;
    cart[existing].cartons = (cart[existing].cartons || 0) + cartons;
  } else {
    cart.push({ code: String(code), name: p.name || code, price: Number(p.price || 0), qty: totalQty, cartons, qty_pairs: qtyPairs });
  }
  await setCart(chatId, cart);
  return true;
}

export async function processRubikaUpdatesSimple(token: string): Promise<{ ok: boolean; processed: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, processed: 0, error: 'توکن خالی است' };
  try {
    const cfg = await getBotConfig();
    const adminChat = String(cfg?.rubika_admin_chat_id || '').trim();
    const offset = await getBotOffset();
    const body: any = { limit: 10 };
    if (offset) body.offset_id = offset;
    console.log('[DIAG_FETCH] calling getUpdates, offset=' + (offset || 'none'));
    const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => null);
    if (!data || (data.status !== 'OK' && data.ok !== true)) return { ok: false, processed: 0, error: 'خطا در دریافت' };
    const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
    let processed = 0;
    let nextOffset = offset;
    console.log('[DIAG_UPDATES] count=' + updates.length);
    for (const u of updates) {
      console.log('[DIAG_UPDATE]', JSON.stringify(u).slice(0, 600));
      if (u.update_id) nextOffset = String(Number(u.update_id) + 1);
      const chatId = String(u.chat_id || u.new_message?.chat_id || '');
      const msgText = String(u.new_message?.text || '').trim();
      const cbData = String(u.data || u.callback_query?.data || u.button_id || '').trim();
      const replyTo = String(u.new_message?.reply_to_message_id || u.reply_to_message_id || '');
      if (!chatId) continue;

      // ── ادمین: تایید واریز ──
      if (adminChat && chatId === adminChat && replyTo) {
        const map = await getAdminInv(replyTo);
        if (map && map.invoice_number) {
          const inv = await getInv(map.invoice_number);
          const amount = Number(String(msgText).replace(/[^0-9]/g, '')) || 0;
          if (inv && amount > 0) {
            inv.paid = Number(inv.paid || 0) + amount;
            const remaining = Number(inv.total || 0) - inv.paid;
            await setInv(map.invoice_number, inv);
            let adminText = '✅ واریز تایید شد\n\n';
            adminText += '🔢 فاکتور: ' + inv.invoice_number + '\n';
            adminText += '👤 مشتری: ' + inv.customer_name + '\n';
            adminText += '💰 مبلغ کل: ' + fmt(inv.total) + ' تومان\n';
            adminText += '💳 واریز جدید: ' + fmt(amount) + ' تومان\n';
            adminText += '📥 جمع واریز: ' + fmt(inv.paid) + ' تومان\n';
            adminText += '⏳ باقی‌مانده: ' + fmt(remaining) + ' تومان';
            await botSend(t, chatId, adminText);
            let custText = '✅ واریز شما تایید شد\n\n';
            custText += '🔢 فاکتور: ' + inv.invoice_number + '\n';
            custText += '💳 مبلغ واریز: ' + fmt(amount) + ' تومان\n';
            custText += '⏳ باقی‌مانده: ' + fmt(remaining) + ' تومان';
            await botSend(t, inv.customer_chat_id, custText);
            processed++; continue;
          }
        }
      }

      // ── دکمه‌های منو ──
      const cb = cbData || msgText;
      if (cb === 'menu' || cb === 'menu_back' || msgText === '/start' || msgText === '🔙 بازگشت به منو') {
        await clearState(chatId);
        await showMainMenu(t, chatId); processed++; continue;
      }
      if (cb === 'menu_products' || cb === 'show_products' || msgText === '📦 لیست محصولات') {
        await clearState(chatId);
        await showProducts(t, chatId); processed++; continue;
      }
      if (cb === 'menu_cart' || cb === 'show_cart' || msgText === '🛒 سبد خرید') {
        await clearState(chatId);
        await showCart(t, chatId); processed++; continue;
      }
      if (cb === 'cart_clear' || msgText === '🧹 خالی کردن') {
        await setCart(chatId, []);
        await clearState(chatId);
        await botSend(t, chatId, '🧹 سبد خرید شما خالی شد.');
        await showMainMenu(t, chatId); processed++; continue;
      }
      if (cb === 'cart_checkout' || msgText === '✅ نهایی‌سازی') {
        const cart = await getCart(chatId);
        if (!cart.length) { await botSend(t, chatId, '❌ سبد خرید خالی است.'); processed++; continue; }
        await setState(chatId, { step: 'waiting_name' });
        await botSend(t, chatId, '📝 لطفاً نام و نام خانوادگی خود را وارد کنید:'); processed++; continue;
      }
      if (cb.startsWith('cart_remove_')) {
        const code = cb.slice('cart_remove_'.length);
        const cart = await getCart(chatId);
        await setCart(chatId, cart.filter((x: any) => String(x.code) !== String(code)));
        await showCart(t, chatId); processed++; continue;
      }

      // ── انتخاب محصول ──
      if (cb.startsWith('sel_')) {
        const code = cb.slice(4);
        await showQuantity(t, chatId, code); processed++; continue;
      }

      // ── دکمه‌های تعداد ──
      if (cb.startsWith('qty_')) {
        const state = await getState(chatId);
        if (!state || state.step !== 'waiting_qty') { await showMainMenu(t, chatId); processed++; continue; }
        if (cb === 'qty_other') {
          await setState(chatId, { step: 'waiting_qty_other', code: state.code });
          await botSend(t, chatId, '🔢 تعداد کارتن را بنویسید:'); processed++; continue;
        }
        const n = Number(cb.replace('qty_', ''));
        if (n > 0) {
          await addToCart(chatId, state.code, n);
          await clearState(chatId);
          await showCart(t, chatId);
        }
        processed++; continue;
      }

      // ── دکمه‌های تایید/انصراف ──
      if (cb === 'confirm_yes' || msgText === '✅ تایید نهایی') {
        const state = await getState(chatId);
        const cart = await getCart(chatId);
        if (!state || state.step !== 'confirm' || !cart.length) { await showMainMenu(t, chatId); processed++; continue; }
        let invNum = '';
        try { invNum = await generateInvoiceNumber(); } catch { invNum = 'INV-' + Date.now(); }
        let total = 0;
        cart.forEach((it: any) => { total += Number(it.price || 0) * Number(it.qty || 0); });
        let invText = '🧾 فاکتور فروش میزان\n\n';
        invText += '🔢 شماره: ' + invNum + '\n';
        invText += '👤 نام: ' + (state.name || '') + '\n';
        invText += '📱 تلفن: ' + (state.phone || '') + '\n';
        invText += '📍 آدرس: ' + (state.address || '') + '\n';
        invText += '🚚 باربری: ' + (state.shipping || '') + '\n\n';
        cart.forEach((it: any, i: number) => {
          invText += (i + 1) + '. ' + it.code + ' — ' + it.qty + ' جفت — ' + fmt(Number(it.price || 0) * Number(it.qty || 0)) + ' تومان\n';
        });
        invText += '\n💰 جمع کل: ' + fmt(total) + ' تومان';
        await botSend(t, chatId, invText + '\n\n📌 برای ثبت واریز، روی همین فاکتور ریپلای بزنید و مبلغ را بفرستید.');
        const invData = { invoice_number: invNum, customer_chat_id: chatId, customer_name: state.name || '', total, paid: 0, items: cart };
        await setInv(invNum, invData);
        if (adminChat) {
          const adminMsgId = await botSend(t, adminChat, '🔔 فاکتور جدید:\n\n' + invText);
          if (adminMsgId) await setAdminInv(String(adminMsgId), { invoice_number: invNum });
        }
        try { await issueAssistantInvoice({ id: 'inv_' + Date.now(), invoice_number: invNum, customer_name: state.name || '', customer_phone: state.phone || '', customer_address: state.address || '', customer_shipping: state.shipping || '', items: cart.map((it: any) => ({ code: it.code, name: it.name, qty: it.qty, priceUnit: it.price, total: Number(it.price || 0) * Number(it.qty || 0) })), total_amount: total, status: 'issued', created_at: new Date().toISOString(), source: 'rubika' }); } catch {}
        await setCart(chatId, []);
        await setState(chatId, { step: 'waiting_payment', invoice_number: invNum });
        processed++; continue;
      }
      if (cb === 'confirm_no' || msgText === '❌ انصراف') {
        await setCart(chatId, []); await clearState(chatId);
        await botSend(t, chatId, '❌ سفارش لغو شد.');
        await showMainMenu(t, chatId); processed++; continue;
      }

      // ── ماشین حالت متنی ──
      const state = await getState(chatId);
      if (state && state.step) {
        if (state.step === 'waiting_qty_other') {
          const n = parseInt(String(msgText).replace(/[^0-9]/g, ''), 10);
          if (!n || n <= 0) { await botSend(t, chatId, '❌ لطفاً یک عدد معتبر وارد کنید.'); processed++; continue; }
          await addToCart(chatId, state.code, n);
          await clearState(chatId);
          await showCart(t, chatId); processed++; continue;
        }
        if (state.step === 'waiting_name') { state.name = msgText; state.step = 'waiting_phone'; await setState(chatId, state); await botSend(t, chatId, '📱 شماره تماس را وارد کنید:'); processed++; continue; }
        if (state.step === 'waiting_phone') { state.phone = msgText; state.step = 'waiting_address'; await setState(chatId, state); await botSend(t, chatId, '📍 آدرس را وارد کنید:'); processed++; continue; }
        if (state.step === 'waiting_address') { state.address = msgText; state.step = 'waiting_shipping'; await setState(chatId, state); await botSend(t, chatId, '🚚 نام باربری را وارد کنید:'); processed++; continue; }
        if (state.step === 'waiting_shipping') {
          state.shipping = msgText; state.step = 'confirm'; await setState(chatId, state);
          const cart = await getCart(chatId);
          let total = 0; const lines: string[] = [];
          cart.forEach((it: any, i: number) => { total += Number(it.price || 0) * Number(it.qty || 0); lines.push((i + 1) + '. ' + it.code + ' — ' + it.qty + ' جفت — ' + fmt(Number(it.price || 0) * Number(it.qty || 0))); });
          const reply = '🧾 پیش‌فاکتور نهایی\n\n👤 ' + state.name + '\n📱 ' + state.phone + '\n📍 ' + state.address + '\n🚚 ' + state.shipping + '\n\n' + lines.join('\n') + '\n\n💰 جمع کل: ' + fmt(total) + ' تومان\n\nآیا تایید می‌کنید؟';
          await botSend(t, chatId, reply, { rows: [{ buttons: [{ id: 'confirm_yes', button_text: '✅ تایید نهایی' }, { id: 'confirm_no', button_text: '❌ انصراف' }] }] });
          processed++; continue;
        }
        if (state.step === 'waiting_payment') {
          if (adminChat) {
            const amount = Number(String(msgText).replace(/[^0-9]/g, '')) || 0;
            const inv = await getInv(state.invoice_number);
            if (inv) {
              await botSend(t, adminChat, '💰 واریزی جدید از ' + inv.customer_name + '\n🔢 فاکتور: ' + inv.invoice_number + '\n📝 متن: ' + msgText + '\n💰 مبلغ اعلامی: ' + fmt(amount));
              await botSend(t, chatId, '✅ پیام واریز شما برای حسابدار ارسال شد. پس از تایید، باقی‌مانده به شما اطلاع داده می‌شود.');
            }
          }
          processed++; continue;
        }
      }

      if (!state || !state.step) await showMainMenu(t, chatId);
      processed++;
    }
    if (nextOffset && nextOffset !== offset) await setBotOffset(nextOffset);
    return { ok: true, processed };
  } catch (e: any) {
    return { ok: false, processed: 0, error: e?.message || 'خطا' };
  }
}
