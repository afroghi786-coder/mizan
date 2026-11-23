import AsyncStorage from './lib.storage';
import { Platform } from 'react-native';
import { getBotConfig } from './lib.assistant';
import { getProducts, generateInvoiceNumber, getSalesGrouped, findCustomerByPhoneOffline, generateCustomerCode } from './lib.offline';

const RUBIKA_BASE = Platform.OS === 'web'
  ? 'https://mizan-rubika-proxy.mizan1740.workers.dev'
  : 'https://botapi.rubika.ir/v3';

function normText(s: string) { return String(s || '').trim(); }
function fmt(n: number): string { return Number(n || 0).toLocaleString('en-US'); }

async function botSend(t: string, chatId: string, text: string, keypad?: any): Promise<string> {
  const buildBody = () => {
    const body: any = { chat_id: chatId, text: text || '' };
    if (keypad && Array.isArray(keypad.rows)) {
      const cleanRows = keypad.rows
        .map((row: any) => ({
          buttons: (Array.isArray(row.buttons) ? row.buttons : [])
            .map((btn: any) => {
              const label = String(btn.button_text || btn.text || '').trim();
              if (!label) return null;
              return { button_text: label.slice(0, 30) };
            })
            .filter(Boolean),
        }))
        .filter((row: any) => row.buttons.length > 0);
      if (cleanRows.length > 0) {
        body.chat_keypad = { rows: cleanRows };
        body.chat_keypad_type = 'NEW';
        body.keypad = { rows: cleanRows };
      }
    }
    return body;
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const txt = await res.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch {}
      if (!res.ok) {
        console.log('[botSend HTTP]', res.status, txt.slice(0, 200));
        if (attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
        return '';
      }
      if (data && data.status === 'TOO_REQUESTS') throw new Error('TOO_REQUESTS');
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

async function showMainMenu(t: string, chatId: string) {
  await botSend(t, chatId, '🏠 منوی اصلی:', { rows: [
    { buttons: [{ button_text: '🛍️ مشاهده محصولات' }] },
    { buttons: [{ button_text: '🛒 سبد خرید من' }] }
  ] });
}

async function showProducts(t: string, chatId: string) {
  try {
    const prods = await getProducts() || [];
    if (!prods.length) { await botSend(t, chatId, '⚠️ هیچ محصولی ثبت نشده است.'); return; }
    let text = '🛍️ لیست محصولات:\n\n';
    prods.slice(0, 20).forEach((p: any) => { text += 'کد ' + p.code + ': ' + p.name + ' - ' + fmt(p.price) + ' افغانی\n'; });
    text += '\nبرای انتخاب، روی کد محصول کلیک کنید یا کد را تایپ کنید.';
    const rows: any[] = [];
    for (const p of prods.slice(0, 20)) rows.push({ buttons: [{ button_text: String(p.code) }] });
    rows.push({ buttons: [{ button_text: '🏠 منوی اصلی' }] });
    await botSend(t, chatId, text, { rows });
  } catch (e: any) { await botSend(t, chatId, '❌ خطا: ' + (e?.message || '')); }
}

async function showCart(t: string, chatId: string) {
  const cart = await getCart(chatId);
  if (!cart.length) { await botSend(t, chatId, '🛒 سبد خرید شما خالی است.', { rows: [{ buttons: [{ button_text: '🏠 منوی اصلی' }] }] }); return; }
  let total = 0; let text = '🛒 سبد خرید شما:\n\n';
  cart.forEach((it: any, i: number) => { const sub = Number(it.price || 0) * Number(it.qty || 0); total += sub; text += (i + 1) + '. ' + it.name + ' (' + it.code + ') × ' + it.qty + ' = ' + fmt(sub) + ' افغانی\n'; });
  text += '\n💰 جمع کل: ' + fmt(total) + ' افغانی';
  const rows: any[] = [];
  for (const it of cart) rows.push({ buttons: [{ button_text: '🗑️ حذف ' + String(it.name).slice(0, 15) }] });
  rows.push({ buttons: [{ button_text: '✅ نهایی سازی سفارش' }, { button_text: '🗑️ خالی کردن سبد' }] });
  rows.push({ buttons: [{ button_text: '🛍️ افزودن محصول جدید' }, { button_text: '🏠 منوی اصلی' }] });
  await botSend(t, chatId, text, { rows });
}

let _pollingTimer: any = null;
export function startBotPolling(token: string) {
  stopBotPolling();
  if (!token) return;
  console.log('[BOT_POLLING_STARTED]');
  _pollingTimer = setInterval(async () => {
    try { await processRubikaUpdatesSimple(token); } catch {}
  }, 3000);
}
export function stopBotPolling() {
  if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null; console.log('[BOT_POLLING_STOPPED]'); }
}

export let __mizanOffset = '';
async function getBotOffset(): Promise<string> {
  try { return (await AsyncStorage.getItem('@mizan_rubika_offset')) || ''; } catch { return ''; }
}
async function setBotOffset(v: string): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_rubika_offset', String(v || '')); } catch {}
}
async function loadSeen(): Promise<Set<string>> {
  try { const r = await AsyncStorage.getItem('@mizan_bot_seen'); return new Set(r ? JSON.parse(r) : []); } catch { return new Set(); }
}
async function saveSeen(seen: Set<string>): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_seen', JSON.stringify(Array.from(seen))); } catch {}
}

export async function processRubikaUpdatesSimple(token: string): Promise<{ ok: boolean; processed: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, processed: 0, error: 'توکن ربات خالی است' };

  try {
    if (!(globalThis as any).__mizanWebhookRemoved) {
      try {
        await fetch(RUBIKA_BASE + '/' + t + '/updateBotEndpoints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: '' }) });
        (globalThis as any).__mizanWebhookRemoved = true;
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
    const MAX_ITER = 5;

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
        console.log('[GET_UPDATES_ERR]', st, txt.slice(0, 100));
        break;
      }

      const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
      if (updates.length === 0) break;

      for (const u of updates) {
        try {
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
                  const debtStatus = remaining < 0 ? 'بستانکاری: ' + fmt(Math.abs(remaining)) : 'بدهی: ' + fmt(remaining);
                  await botSend(t, chatId, '✅ تسویه حساب انجام شد!\n👤 کاربر: ' + inv.customer_name + '\n💰 مبلغ واریز: ' + fmt(amount) + '\n💳 وضعیت حساب: ' + debtStatus);
                  if (inv.customer_chat_id) {
                    await botSend(t, inv.customer_chat_id, '✅ تسویه حساب شما تایید شد!\n💰 مبلغ واریز: ' + fmt(amount) + '\n💳 وضعیت حساب: ' + debtStatus);
                  }
                  totalProcessed++;
                  continue;
                }
              }
            }
          }

          if (action === 'menu' || action === 'menu_back' || msgText === '/start' || msgText === '🏠 منوی اصلی' || msgText === 'منو') {
            await clearState(chatId);
            await showMainMenu(t, chatId);
            totalProcessed++; continue;
          }
          if (msgText.includes('مشاهده محصولات')) {
            await clearState(chatId);
            await showProducts(t, chatId);
            totalProcessed++; continue;
          }
          if (msgText.includes('سبد خرید')) {
            await clearState(chatId);
            await showCart(t, chatId);
            totalProcessed++; continue;
          }
          if (msgText.includes('خالی کردن سبد') || msgText === '🗑️ خالی کردن') {
            await setCart(chatId, []);
            await clearState(chatId);
            await botSend(t, chatId, '🗑️ سبد خرید شما خالی شد.');
            await showMainMenu(t, chatId);
            totalProcessed++; continue;
          }
          if (msgText.includes('افزودن محصول جدید')) {
            await clearState(chatId);
            await showProducts(t, chatId);
            totalProcessed++; continue;
          }
          if (msgText.includes('نهایی سازی سفارش') || msgText.includes('پایان انتخاب محصولات')) {
            const c = await getCart(chatId);
            if (!c.length) { await botSend(t, chatId, '⚠️ سبد خرید شما خالی است.'); totalProcessed++; continue; }
            await setState(chatId, { step: 'waiting_details' });
            await botSend(t, chatId, '📝 لطفاً مشخصات خود را در یک پیام و هر مورد در یک خط بفرستید:\n\n1) نام و نام خانوادگی\n2) شماره تماس\n3) آدرس\n4) نام باربری');
            totalProcessed++; continue;
          }

          if (msgText.startsWith('🗑️ حذف ')) {
            const name = msgText.replace('🗑️ حذف ', '').trim();
            const c = await getCart(chatId);
            await setCart(chatId, c.filter((x: any) => String(x.name).slice(0, 15) !== name));
            await showCart(t, chatId);
            totalProcessed++; continue;
          }

          if (msgText === '✅ تأیید سفارش' || msgText === '✅ تأیید' || action === 'confirm_yes') {
            const state = await getState(chatId);
            const cart = await getCart(chatId);
            if (!state || state.step !== 'confirm' || !cart.length) { await showMainMenu(t, chatId); totalProcessed++; continue; }

            const phone = String(state.phone || '');
            let customerCode = '';
            try {
              const found = await findCustomerByPhoneOffline(phone);
              if (found) customerCode = String(found.customer_code || found.code || '');
              if (!customerCode) customerCode = await generateCustomerCode();
            } catch { customerCode = 'M_' + Date.now(); }

            let prevSales = 0, prevPaid = 0, prevCount = 0;
            try {
              const grouped = await getSalesGrouped();
              const prev = (grouped || []).filter((g: any) => String(g.phone || '') === phone || (state.name && String(g.name || '') === String(state.name)));
              prev.forEach((g: any) => { prevSales += Number(g.total || 0); prevPaid += Number(g.paid || 0); });
              prevCount = prev.length;
            } catch {}

            let invNum = '';
            try {
              const baseInv = await generateInvoiceNumber();
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

            await setInv(invNum, { invoice_number: invNum, customer_chat_id: chatId, customer_name: state.name || '', customer_code: customerCode, total: grandTotal, paid: 0, items: cart, admin_message_id: mid });

            try {
              await assistantMod.issueAssistantInvoice({
                id: 'inv_' + Date.now(), invoice_number: invNum, customer_name: state.name || '', customer_phone: phone, customer_address: state.address || '', customer_shipping: state.shipping || '', customer_code: customerCode, items: cart.map((it: any) => ({ code: it.code, name: it.name, qty: it.qty, priceUnit: it.price, total: Number(it.price || 0) * Number(it.qty || 0) })), total_amount: grandTotal, status: 'issued', created_at: new Date().toISOString(), source: 'rubika'
              });
            } catch {}

            await setCart(chatId, []);
            await setState(chatId, { step: 'waiting_payment', invoice_number: invNum });
            totalProcessed++; continue;
          }
          if (msgText === '❌ انصراف' || msgText === '❌ لغو' || action === 'confirm_no') {
            await setCart(chatId, []);
            await clearState(chatId);
            await botSend(t, chatId, '❌ سفارش لغو شد.');
            await showMainMenu(t, chatId);
            totalProcessed++; continue;
          }

          const state = await getState(chatId);
          if (state && state.step) {
            if (state.step === 'waiting_qty') {
              const n = parseInt(String(msgText).replace(/[^0-9]/g, ''), 10);
              if (!n || n <= 0) { await botSend(t, chatId, '⚠️ لطفاً یک عدد معتبر وارد کنید.'); totalProcessed++; continue; }
              const cart = await getCart(chatId);
              const existing = cart.find((x: any) => String(x.code) === String(state.code));
              if (existing) existing.qty += n;
              else cart.push({ code: state.code, name: state.name, price: state.price, qty: n });
              await setCart(chatId, cart);
              await clearState(chatId);
              await botSend(t, chatId, '✅ به سبد خرید اضافه شد.', { rows: [
                { buttons: [{ button_text: '🛍️ سفارش بعدی' }, { button_text: '🛒 سبد خرید' }] },
                { buttons: [{ button_text: '✅ نهایی سازی سفارش' }] }
              ] });
              totalProcessed++; continue;
            }

            if (state.step === 'waiting_details') {
              const lines = msgText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
              if (lines.length < 4) {
                await botSend(t, chatId, '⚠️ لطفاً دقیقاً ۴ خط بفرستید:\n1) نام\n2) تلفن\n3) آدرس\n4) باربری');
                totalProcessed++; continue;
              }
              const name = lines[0];
              const phone = lines[1];
              const address = lines[2];
              const shipping = lines.slice(3).join(' ');
              const cart = await getCart(chatId);
              let total = 0; const lines2: string[] = [];
              cart.forEach((it: any, i: number) => { total += Number(it.price || 0) * Number(it.qty || 0); lines2.push((i + 1) + '. ' + it.name + ' (' + it.code + ') × ' + it.qty + ' = ' + fmt(Number(it.price || 0) * Number(it.qty || 0))); });
              const reply = '🧾 پیش‌فاکتور سفارش\n\n👤 ' + name + '\n📞 ' + phone + '\n📍 ' + address + '\n🚚 ' + shipping + '\n\n' + lines2.join('\n') + '\n\n💰 مبلغ کل: ' + fmt(total) + ' افغانی\n\nآیا سفارش را تأیید می‌کنید؟';
              await setState(chatId, { step: 'confirm', name, phone, address, shipping });
              await botSend(t, chatId, reply, { rows: [{ buttons: [{ button_text: '✅ تأیید سفارش' }, { button_text: '❌ انصراف' }] }] });
              totalProcessed++; continue;
            }

            if (state.step === 'waiting_payment') {
              if (adminChat) {
                const amount = Number(String(msgText).replace(/[^0-9]/g, '')) || 0;
                const inv = await getInv(state.invoice_number);
                if (inv) {
                  const mid = await botSend(t, adminChat, '📱 پیامک تراکنش از مشتری:\n👤 کاربر: ' + inv.customer_name + '\n💰 مبلغ: ' + fmt(amount) + '\n📝 شماره تراکنش: ' + msgText.slice(0, 100), undefined);
                  if (mid) await setAdminInv(String(mid), { invoice_number: inv.invoice_number });
                  await botSend(t, chatId, '✅ پیامک تراکنش شما به حسابدار ارسال شد. پس از تایید، بدهی شما به‌روزرسانی می‌شود.');
                }
              }
              totalProcessed++; continue;
            }
          }

          const catalog = await getProducts() || [];
          const p = (catalog || []).find((x: any) => String(x.code).trim() === action.trim() || String(x.code).trim() === msgText.trim());
          if (p) {
            await setState(chatId, { step: 'waiting_qty', code: p.code, name: p.name, price: p.price || 0 });
            await botSend(t, chatId, '📦 ' + p.name + '\n💰 قیمت: ' + fmt(p.price || 0) + '\n📦 قفسه: ' + (p.shelf || '—') + '\n\n🔢 تعداد مورد نظر را انتخاب یا وارد کنید:', { rows: [
              { buttons: [{ button_text: '۱' }, { button_text: '۲' }, { button_text: '۳' }] },
              { buttons: [{ button_text: '۵' }, { button_text: '۱۰' }] },
              { buttons: [{ button_text: '🏠 منوی اصلی' }] }
            ] });
            totalProcessed++; continue;
          }

          await botSend(t, chatId, '🤖 متوجه نشدم. لطفاً /start را بزنید یا کد محصول را دقیقاً وارد کنید.');

        } catch (err: any) {
          console.log('[LOOP_ERR]', err?.message || err);
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
