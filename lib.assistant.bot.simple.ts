// ============ دستیار فروش — نسخه ساده و مطمئن ============
import AsyncStorage from './lib.storage';
import { Platform } from 'react-native';
import { getBotConfig } from './lib.assistant';
import { getProducts, generateInvoiceNumber, findCustomerByPhoneOffline, generateCustomerCode } from './lib.offline';

const RUBIKA_BASE = Platform.OS === 'web'
  ? 'https://mizan-rubika-proxy.mizan1740.workers.dev'
  : 'https://botapi.rubika.ir/v3';

const K_OFFSET = '@mz_off_v3';
const K_STATE = (id) => '@mz_st_v3_' + id;
const K_CART = (id) => '@mz_ct_v3_' + id;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function toLatin(s) {
  const fa = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';
  const ar = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
  return String(s || '').replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (c) => {
    const i = fa.indexOf(c); if (i >= 0) return String(i);
    const j = ar.indexOf(c); return j >= 0 ? String(j) : c;
  });
}
function dig(s) { return toLatin(String(s || '')).replace(/[^0-9]/g, ''); }
function normPhone(raw) {
  let d = dig(raw);
  if (d.startsWith('0093')) d = d.slice(4);
  else if (d.startsWith('93')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.length === 9 ? d : '';
}
function normText(s) { return String(s || '').replace(/\u200c/g, '').trim(); }

async function api(token, method, body) {
  const url = RUBIKA_BASE + '/' + token + '/' + method;
  for (let a = 0; a < 2; a++) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tm = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch {} }, 12000) : null;
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}), signal: ctrl ? ctrl.signal : undefined,
      });
      if (tm) clearTimeout(tm);
      const raw = await res.text();
      let d = null; try { d = JSON.parse(raw); } catch {}
      const st = String((d && d.status) || '');
      if (st === 'TOO_REQUESTS') { if (a === 0) { await sleep(1500); continue; } return { ok: false, data: null, status: st }; }
      if (!res.ok) { if (a === 0) { await sleep(700); continue; } return { ok: false, data: null, status: 'HTTP' + res.status }; }
      return { ok: true, data: d, status: st };
    } catch (e) { if (a === 0) { await sleep(500); continue; } return { ok: false, data: null, status: 'NET' }; }
  }
  return { ok: false, data: null, status: 'FAIL' };
}

async function botSend(token, chatId, text, keypad) {
  const body = { chat_id: chatId, text: text || '' };
  if (keypad && Array.isArray(keypad.rows)) {
    const rows = keypad.rows
      .map((r) => ({ buttons: (Array.isArray(r.buttons) ? r.buttons : [])
        .map((b) => { const l = String(b.button_text || b.text || '').trim(); return l ? { button_text: l.slice(0, 30) } : null; })
        .filter(Boolean) }))
      .filter((r) => r.buttons.length > 0);
    if (rows.length) { body.chat_keypad = { rows }; body.chat_keypad_type = 'NEW'; }
  }
  const r = await api(token, 'sendMessage', body);
  return r.ok ? String((r.data && (r.data.message_id || (r.data.result && r.data.result.message_id))) || '') : '';
}

async function getCart(id) {
  try { const r = await AsyncStorage.getItem(K_CART(id)); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}
async function setCart(id, c) { try { await AsyncStorage.setItem(K_CART(id), JSON.stringify(c || [])); } catch {} }
async function getState(id) {
  try { const r = await AsyncStorage.getItem(K_STATE(id)); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function setState(id, s) { try { await AsyncStorage.setItem(K_STATE(id), JSON.stringify(s || {})); } catch {} }
async function clearState(id) { try { await AsyncStorage.removeItem(K_STATE(id)); } catch {} }

const B_HOME = '\u{1F3E0} شروع';
const B_BACK = '\u{1F519} برگشت';
const B_CART = '\u{1F6D2} سبد من';
const B_NEXT = '1\uFE0F\u20E3 کد بعدی';
const B_LIST = '2\uFE0F\u20E3 دیدن محصولات';
const B_DONE = '\u2705 ثبت سفارش';
function row() { const out = []; for (let i = 0; i < arguments.length; i++) out.push({ button_text: String(arguments[i]) }); return { buttons: out }; }

async function showMenu(t, id) {
  await botSend(t, id, '\u{1F44B} خوش آمدید\n\nبرای خرید فقط کد محصول را بفرستید.\nمثل: 125\n\nاگر کد را نمی‌دانید دکمه پایین را بزنید.', { rows: [row(B_LIST), row(B_CART)] });
}

async function showList(t, id, page) {
  let p = []; try { p = (await getProducts()) || []; } catch {}
  if (!p.length) { await botSend(t, id, '\u{1F4E6} هنوز محصولی ثبت نشده است.', { rows: [row(B_HOME)] }); return; }
  const per = 4;
  const tp = Math.max(1, Math.ceil(p.length / per));
  let pg = Number(page || 1); if (pg < 1) pg = 1; if (pg > tp) pg = tp;
  const sl = p.slice((pg - 1) * per, (pg - 1) * per + per);
  let tx = '\u{1F6CD} محصولات (صفحه ' + pg + ' از ' + tp + ')\n\n';
  sl.forEach((x, i) => { tx += (i + 1) + '. ' + x.name + '\n   کد ' + x.code + ' — ' + fmt(x.price) + ' افغانی\n\n'; });
  tx += 'شماره محصول را بفرستید (مثل: 2)';
  const rows = [];
  rows.push({ buttons: sl.map((x, i) => ({ button_text: String(i + 1) })) });
  const nav = [];
  if (pg > 1) nav.push({ button_text: '⬅️' });
  if (pg < tp) nav.push({ button_text: '➡️' });
  if (nav.length) rows.push({ buttons: nav });
  rows.push(row(B_CART));
  await setState(id, { step: 'list', page: pg, codes: sl.map((x) => String(x.code)) });
  await botSend(t, id, tx, { rows });
}

async function showCart(t, id) {
  const c = await getCart(id);
  if (!c.length) { await botSend(t, id, '🛒 سبد شما خالی است.\nکد محصول را بفرستید.', { rows: [row(B_LIST), row(B_HOME)] }); return; }
  let tot = 0; let tx = '🛒 سبد شما:\n\n';
  c.forEach((it, i) => {
    const s = Number(it.price || 0) * Number(it.qty || 0); tot += s;
    tx += (i + 1) + '. ' + it.name + '\n   × ' + it.qty + ' = ' + fmt(s) + '\n\n';
  });
  tx += '\u{1F4B0} جمع: ' + fmt(tot) + ' افغانی';
  const rows = c.map((x, i) => row('\u{1F5D1} حذف ' + (i + 1)));
  rows.push(row(B_DONE)); rows.push(row(B_LIST, B_HOME));
  await botSend(t, id, tx, { rows });
}

async function askQty(t, id, name, price) {
  await botSend(t, id, '\u2705 ' + name + '\n\u{1F4B0} ' + fmt(price) + ' افغانی\n\nچند عدد می‌خواهید؟ عدد بفرستید (مثل: 2)\nاگر نمی‌خواهید «0» بفرستید.',
    { rows: [row('1', '2', '3'), row('0'), row(B_BACK)] });
}

async function addAndNext(t, id, code, name, price, qty) {
  const c = await getCart(id);
  const ex = c.find((x) => String(x.code) === String(code));
  if (ex) ex.qty = Number(ex.qty || 0) + Number(qty);
  else c.push({ code, name, price: Number(price || 0), qty: Number(qty) });
  await setCart(id, c);
  const tot = c.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  await clearState(id);
  await botSend(t, id, '\u2705 ثبت شد: ' + name + ' × ' + qty + '\n\n🛒 جمع سبد: ' + fmt(tot) + ' افغانی\n\nمحصول دیگری هم می‌خواهید؟',
    { rows: [row(B_NEXT), row(B_CART, B_DONE)] });
}

async function issueInv(t, id, st, cart) {
  const phone = String(st.phone || '');
  let cc = '';
  try { const f = await findCustomerByPhoneOffline(phone); if (f) cc = String(f.customer_code || f.code || ''); if (!cc) cc = await generateCustomerCode(); } catch { cc = 'M' + Date.now(); }
  let inv = '';
  try { inv = 'BOT-' + (await generateInvoiceNumber()); } catch { inv = 'BOT-' + Date.now(); }
  let tot = 0; cart.forEach((it) => { tot += Number(it.price || 0) * Number(it.qty || 0); });
  const items = cart.map((it) => ({ code: String(it.code), name: String(it.name), qty: Number(it.qty || 0), priceUnit: Number(it.price || 0), total: Number(it.price || 0) * Number(it.qty || 0) }));
  try {
    const am = await import('./lib.assistant');
    await am.issueAssistantInvoice({
      id: 'inv_' + Date.now(), invoice_number: inv, customer_name: String(st.name || ''),
      customer_phone: phone, customer_address: String(st.address || ''), customer_shipping: String(st.shipping || ''),
      customer_code: cc, items, total_amount: tot, status: 'issued',
      created_at: new Date().toISOString(), source: 'rubika',
    });
  } catch (e) { console.log('[INV_ERR]', e && e.message); }
  let tx = '\u{1F9FE} سفارش شما ثبت شد\n\n\u{1F522} شماره سفارش: ' + inv + '\n\u{1F194} کد مشتری: ' + cc + '\n\n';
  items.forEach((it, i) => { tx += (i + 1) + '. ' + it.name + '\n   ' + it.qty + ' × ' + fmt(it.priceUnit) + ' = ' + fmt(it.total) + '\n'; });
  tx += '\n\u{1F4B0} مبلغ کل: ' + fmt(tot) + ' افغانی\n\nبا تشکر از خرید شما 🙏';
  await botSend(t, id, tx, { rows: [row(B_HOME)] });
  try {
    const cfg = await getBotConfig();
    const adm = String((cfg && cfg.rubika_admin_chat_id) || '').trim();
    if (adm) {
      let at = '\u{1F4EC} سفارش جدید\n\n\u{1F522} ' + inv + '\n\u{1F464} ' + (st.name || '-') + '\n\u{1F4DE} ' + phone + '\n\u{1F4CD} ' + (st.address || '-') + '\n\u{1F69A} ' + (st.shipping || '-') + '\n\n';
      items.forEach((it) => { at += '• ' + it.name + ' (' + it.code + ') × ' + it.qty + ' = ' + fmt(it.total) + '\n'; });
      at += '\n\u{1F4B0} ' + fmt(tot);
      await botSend(t, adm, at);
    }
  } catch {}
}

async function handle(t, id, text) {
  const raw = normText(text);
  const low = toLatin(raw);
  const st = await getState(id);

  if (low === '/start' || raw === B_HOME || raw === 'منو') { await clearState(id); await showMenu(t, id); return; }
  if (raw === B_CART) { await clearState(id); await showCart(t, id); return; }
  if (raw === B_LIST) { await showList(t, id, 1); return; }
  if (raw === '➡️') { await showList(t, id, Number((st && st.page) || 1) + 1); return; }
  if (raw === '⬅️') { await showList(t, id, Number((st && st.page) || 1) - 1); return; }

  if (raw === B_DONE) {
    const c = await getCart(id);
    if (!c.length) { await botSend(t, id, '⚠️ سبد خالی است.', { rows: [row(B_LIST), row(B_HOME)] }); return; }
    await setState(id, { step: 'ask_name' });
    await botSend(t, id, '\u{1F4DD} نام و نام خانوادگی خود را بنویسید.', { rows: [row(B_HOME)] });
    return;
  }

  if (raw.indexOf('\u{1F5D1} حذف ') === 0) {
    const i = parseInt(dig(raw.slice(5)), 10) - 1;
    const c = await getCart(id);
    if (i >= 0 && i < c.length) { c.splice(i, 1); await setCart(id, c); }
    await showCart(t, id); return;
  }

  if (st && st.step) {
    if (st.step === 'ask_qty') {
      if (low === '0') { await clearState(id); await botSend(t, id, 'باشه، اضافه نشد.', { rows: [row(B_NEXT), row(B_HOME)] }); return; }
      const n = parseInt(dig(raw), 10);
      if (!n || n <= 0 || n > 999) { await botSend(t, id, '\u26A0\uFE0F عدد بین 1 تا 999 بفرستید.', { rows: [row('1', '2', '3'), row(B_BACK)] }); return; }
      await addAndNext(t, id, st.code, st.name, st.price, n); return;
    }
    if (st.step === 'list') {
      if (raw === B_BACK) { await clearState(id); await showMenu(t, id); return; }
      const n = parseInt(dig(raw), 10);
      const codes = Array.isArray(st.codes) ? st.codes : [];
      if (n >= 1 && n <= codes.length) {
        let p = []; try { p = (await getProducts()) || []; } catch {}
        const pr = p.find((x) => String(x.code) === String(codes[n - 1]));
        if (pr) { await setState(id, { step: 'ask_qty', code: String(pr.code), name: String(pr.name), price: Number(pr.price || 0) }); await askQty(t, id, pr.name, pr.price); return; }
      }
      await botSend(t, id, '\u26A0\uFE0F شماره معتبر نیست.', { rows: [row(B_LIST), row(B_HOME)] }); return;
    }
    if (st.step === 'ask_name') {
      if (raw.length < 3) { await botSend(t, id, '\u26A0\uFE0F نام کامل را بنویسید.'); return; }
      await setState(id, { step: 'ask_phone', name: raw.slice(0, 60) });
      await botSend(t, id, '\u{1F4DE} ' + raw.slice(0, 30) + ' جان، شماره تلفن را بنویسید.\nمثل: 0700000000', { rows: [row(B_HOME)] }); return;
    }
    if (st.step === 'ask_phone') {
      const ph = normPhone(raw);
      if (!ph) { await botSend(t, id, '\u26A0\uFE0F شماره درست نیست. مثل: 0700000000'); return; }
      await setState(id, { step: 'ask_address', name: st.name, phone: '0' + ph });
      await botSend(t, id, '\u{1F4CD} آدرس خود را بنویسید.\nشهر و ولسوالی هم بنویسید.', { rows: [row(B_HOME)] }); return;
    }
    if (st.step === 'ask_address') {
      if (raw.length < 5) { await botSend(t, id, '\u26A0\uFE0F آدرس کامل را بنویسید.'); return; }
      await setState(id, { step: 'ask_shipping', name: st.name, phone: st.phone, address: raw.slice(0, 200) });
      await botSend(t, id, '\u{1F69A} با کدام باربری بفرستیم؟\nنام باربری را بنویسید.', { rows: [row('بدون باربری'), row(B_HOME)] }); return;
    }
    if (st.step === 'ask_shipping') {
      const c = await getCart(id);
      if (!c.length) { await clearState(id); await showMenu(t, id); return; }
      const finalSt = { step: 'done', name: st.name, phone: st.phone, address: st.address, shipping: raw.slice(0, 80) };
      await clearState(id); await setCart(id, []);
      await issueInv(t, id, finalSt, c); return;
    }
  }

  if (low && /^[0-9A-Za-z_-]{1,20}$/.test(low) && /[0-9]/.test(low)) {
    let p = []; try { p = (await getProducts()) || []; } catch {}
    const pr = p.find((x) => String(x.code).trim() === low);
    if (pr) { await setState(id, { step: 'ask_qty', code: String(pr.code), name: String(pr.name), price: Number(pr.price || 0) }); await askQty(t, id, pr.name, pr.price); return; }
    await botSend(t, id, '\u{1F914} کد «' + raw + '» را پیدا نکردم.\n\nکد را دوباره بفرستید یا دکمه پایین را بزنید.',
      { rows: [row(B_LIST), row(B_HOME)] }); return;
  }

  await botSend(t, id, '\u{1F44B} متوجه نشدم.\n\nبرای خرید فقط کد محصول را بفرستید (مثل: 125).\nاگر کد را نمی‌دانید دکمه پایین را بزنید.',
    { rows: [row(B_LIST), row(B_CART), row(B_HOME)] });
}

// ============ حلقه polling ============
let _timer = null;
let _busy = false;
let _delay = 1500;

function schedule() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  const d = Math.max(500, _delay);
  _timer = setTimeout(async () => {
    _timer = null;
    try { await processRubikaUpdatesSimple(''); } catch (e) { console.log('[TICK_ERR]', e && e.message); }
    schedule();
  }, d);
}

export function startBotPolling(token) {
  stopBotPolling();
  if (!token) { console.log('[BOT_SIMPLE] NO TOKEN — polling not started'); return; }
  _delay = 1500;
  console.log('[BOT_SIMPLE] STARTED with token ' + String(token).slice(0, 5) + '...');
  schedule();
}

export function stopBotPolling() {
  if (_timer) { clearTimeout(_timer); _timer = null; console.log('[BOT_SIMPLE] STOPPED'); }
}

export async function processRubikaUpdatesSimple(tokenIn) {
  if (_busy) return { ok: true, processed: 0 };
  _busy = true;
  let processed = 0;
  try {
    let token = String(tokenIn || '').trim();
    if (!token) {
      const cfg = await getBotConfig();
      token = String((cfg && cfg.rubika_token) || '').trim();
      console.log('[BOT_SIMPLE] token from config: ' + (token ? 'FOUND len=' + token.length : 'EMPTY'));
    }
    if (!token) { _delay = 5000; return { ok: false, processed: 0, error: 'NO_TOKEN' }; }
    console.log('[BOT_SIMPLE][TRACE] token OK, len=' + token.length + ' base=' + RUBIKA_BASE);

    if (!globalThis.__mzWebhookCleared) {
      console.log('[BOT_SIMPLE][TRACE] clearing webhook...');
      try { await api(token, 'updateBotEndpoints', { url: '' }); globalThis.__mzWebhookCleared = true; console.log('[BOT_SIMPLE] webhook cleared'); } catch (we) { console.log('[BOT_SIMPLE][WEBHOOK_ERR]', String(we && we.message || we)); }
    }

    let off = '';
    try { off = String((await AsyncStorage.getItem(K_OFFSET)) || ''); } catch {}
    let had = false;

    for (let it = 0; it < 4; it++) {
      const body = { limit: 50 };
      if (off) body.offset_id = off;
      console.log('[BOT_SIMPLE][TRACE] getUpdates call, off=' + (off || 'none'));
      let r;
      try { r = await api(token, 'getUpdates', body); }
      catch (ge) { console.log('[BOT_SIMPLE][GETUPD_ERR]', String(ge && ge.message || ge)); _delay = 3000; break; }
      console.log('[BOT_SIMPLE][TRACE] getUpdates returned ok=' + r.ok + ' status=' + (r.status || '?'));
      if (!r.ok) { console.log('[BOT_SIMPLE][FAIL] status=' + r.status + ' body=' + JSON.stringify(r.data).slice(0, 300)); _delay = r.status === 'TOO_REQUESTS' ? 5000 : 3000; break; }
      const ups = (r.data && r.data.data && Array.isArray(r.data.data.updates)) ? r.data.data.updates : [];
      if (!ups.length) break;
      had = true;
      console.log('[BOT_SIMPLE] got ' + ups.length + ' updates');

      for (let k = 0; k < ups.length; k++) {
        const u = ups[k];
        try {
          const msg = u.new_message || u.message || null;
          const cb = u.callback_query || null;
          const chatId = String(u.chat_id || (msg && msg.chat_id) || (cb && cb.chat_id) || '');
          if (!chatId || chatId.charAt(0) === 'c') continue;
          const txt = normText((msg && (msg.text || msg.caption)) || '');
          if (!txt) continue;
          console.log('[BOT_SIMPLE] msg from ' + chatId + ': ' + txt.slice(0, 30));
          await handle(token, chatId, txt);
          processed++;
        } catch (e) { console.log('[HANDLE_ERR]', e && e.message); }
      }

      const next = String((r.data && (r.data.next_offset_id || (r.data.data && r.data.data.next_offset_id))) || '').trim();
      if (next && next !== off) { off = next; try { await AsyncStorage.setItem(K_OFFSET, next); } catch {} }
      else break;
    }

    _delay = had ? 900 : 2500;
    return { ok: true, processed };
  } catch (e) {
    _delay = 5000;
    return { ok: false, processed, error: String((e && e.message) || e) };
  } finally {
    _busy = false;
  }
}
