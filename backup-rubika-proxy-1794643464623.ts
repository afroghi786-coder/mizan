import { getProducts } from './lib.offline';
import { getBotConfig, saveBotConfig, issueAssistantInvoice } from './lib.assistant';
import AsyncStorage from './lib.storage';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
// lib.assistant.rubika.ts — اتصال امن به Rubika Bot API
// فعلاً فقط تست اتصال (getMe) و دریافت پیام (getUpdates). هیچ پیامی ارسال نمی‌شود.

const RUBIKA_BASE = 'https://botapi.rubika.ir/v3';

export async function rubikaPing(token: string): Promise<{ ok: boolean; name?: string; username?: string; error?: string; raw?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  try {
    const res = await fetch(RUBIKA_BASE + '/' + t + '/getMe', { method: 'POST' });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = null; }

    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status + ' — ' + txt.slice(0, 250) };
    if (!data) return { ok: false, error: 'پاسخ غیر JSON — ' + txt.slice(0, 250) };

    const isOk = data.ok === true || data.status === 'OK' || data.status === 'ok' || data.success === true;
    if (!isOk) {
      const desc = data.description || data.status || data.message || data.error || JSON.stringify(data).slice(0, 250);
      return { ok: false, error: String(desc) };
    }

    const candidates = [
      data.result?.bot,
      data.result?.user,
      data.result,
      data.bot,
      data.user,
    ].filter(Boolean);

    let username = '';
    let name = '';
    for (const c of candidates) {
      if (!username) username = String(c.username || c.user_name || c.username_bot || c.bot_username || '').trim();
      if (!name) name = String(c.first_name || c.name || c.title || c.bot_name || c.display_name || '').trim();
      if (username || name) break;
    }

    if (!username && !name) {
      return { ok: true, username: '', name: '', raw: JSON.stringify(data).slice(0, 250) };
    }

    return { ok: true, username, name, raw: txt.slice(0, 250) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در اتصال' };
  }
}

export async function rubikaGetUpdates(token: string, offsetId?: string): Promise<{ ok: boolean; count: number; lastText?: string; lastChat?: string; nextOffset?: string; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, count: 0, error: 'توکن وارد نشده است' };
  try {
    const body: any = {};
    if (offsetId) body.offset_id = offsetId;
    const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: any = await res.json();
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, count: 0, error: data?.description || ('HTTP ' + res.status) };
    }
    const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
    let lastText = '';
    let lastChat = '';
    let nextOffset = offsetId || '';
    for (const u of updates) {
      console.log('[RAW_UPDATE]', JSON.stringify(u));
      console.log('[DEBUG] Update received:', JSON.stringify(u));
      // ساختار پیام در روبیکا ممکن است متفاوت باشد، این یک تلاش اولیه است
      const msg = u.message || u.new_message || null;
      if (msg) {
        lastText = msg.text || msg.caption || '[پیام]';
        lastChat = String(msg.sender_id || msg.chat_id || '');
      }
      if (u.update_id) nextOffset = u.update_id;
    }
    return { ok: true, count: updates.length, lastText, lastChat, nextOffset };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message || 'خطا در دریافت' };
  }
}


// ═══════════════════════════════════════════
//  ارسال پست محصول به کانال (دستیار فروش)
// ═══════════════════════════════════════════
export async function rubikaSendPhoto(token: string, chatId: string, imageUri: string, caption?: string): Promise<{ ok: boolean; message_id?: string; error?: string; raw?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  if (!chatId) return { ok: false, error: 'شناسه کانال وارد نشده است' };
  if (!imageUri) return { ok: false, error: 'عکسی انتخاب نشده است' };

  const findString = (obj: any, keys: string[]): string => {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of keys) {
      if (typeof obj[k] === 'string' && obj[k]) return obj[k];
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object') {
        const found = findString(v, keys);
        if (found) return found;
      }
    }
    return '';
  };

  const findFileId = (obj: any) => findString(obj, ['file_id', 'fileId', 'id']);
  const findUploadUrl = (obj: any) => findString(obj, ['upload_url', 'uploadUrl', 'url']);

  try {
    const reqRes = await fetch(RUBIKA_BASE + '/' + t + '/requestSendFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Image' }),
    });
    const reqTxt = await reqRes.text();
    let reqData: any = null;
    try { reqData = JSON.parse(reqTxt); } catch {}
    const uploadUrl = findUploadUrl(reqData);
    if (!uploadUrl) return { ok: false, error: 'لینک آپلود دریافت نشد', raw: reqTxt.slice(0, 800) };

    const form = new FormData();
    const file = new File(imageUri);
    form.append('file', file);

    const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
    const upTxt = await upRes.text();
    let upData: any = null;
    try { upData = JSON.parse(upTxt); } catch {}
    const fileId = findFileId(upData);
    if (!fileId) return { ok: false, error: 'file_id پس از آپلود دریافت نشد', raw: upTxt.slice(0, 800) };

    const sendRes = await fetch(RUBIKA_BASE + '/' + t + '/sendFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, file_id: fileId, text: caption || '' }),
    });
    const sendTxt = await sendRes.text();
    let sendData: any = null;
    try { sendData = JSON.parse(sendTxt); } catch {}
    const isOk = sendData?.ok === true || sendData?.status === 'OK' || sendData?.status === 'ok';
    if (!isOk) return { ok: false, error: String(sendData?.description || sendData?.status || 'ارسال عکس ناموفق'), raw: sendTxt.slice(0, 800) };

    const msgId = String(sendData?.result?.message_id || sendData?.result?.message?.message_id || '');
    return { ok: true, message_id: msgId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در ارسال عکس' };
  }
}

export async function rubikaSendMessage(token: string, chatId: string, text: string, inlineKeypad?: any): Promise<{ ok: boolean; message_id?: string; error?: string; raw?: string; request?: any }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  if (!chatId) return { ok: false, error: 'شناسه کانال وارد نشده است' };
  const body: any = { chat_id: chatId, text: text || '' };
  if (inlineKeypad) body.inline_keypad = inlineKeypad;
  try {
    const res = await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = null; }

    if (!res.ok) {
      return { ok: false, error: 'HTTP ' + res.status + ' — ' + (data?.description || txt.slice(0, 300)), raw: txt.slice(0, 1200), request: body };
    }
    if (!data) {
      return { ok: false, error: 'پاسخ غیر JSON — ' + txt.slice(0, 300), raw: txt.slice(0, 1200), request: body };
    }

    const isOk = data.ok === true || data.status === 'OK' || data.status === 'ok';
    if (!isOk) {
      const desc = data.description || data.status || data.error || JSON.stringify(data).slice(0, 300);
      return { ok: false, error: String(desc), raw: txt.slice(0, 1200), request: body };
    }

    const msgId = String(data.result?.message_id || data.result?.message?.message_id || '');
    return { ok: true, message_id: msgId, raw: txt.slice(0, 600), request: body };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در ارسال پیام', request: body };
  }
}

export async function rubikaEditInlineKeypad(token: string, chatId: string, messageId: string, inlineKeypad: any): Promise<{ ok: boolean; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      inline_keypad: inlineKeypad,
    };

    const res = await fetch(RUBIKA_BASE + '/' + t + '/editInlineKeypad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = null; }

    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status + ' — ' + txt.slice(0, 1000) };
    if (!data) return { ok: false, error: 'پاسخ غیر JSON' };

    const isOk = data.ok === true || data.status === 'OK' || data.status === 'ok';
    if (!isOk) {
      const desc = data.description || data.status || data.error || JSON.stringify(data).slice(0, 200);
      return { ok: false, error: String(desc) };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در ویرایش دکمه' };
  }
}

export function buildOrderButton(productCode: string) {
  return {
    rows: [
      {
        buttons: [
          {
            id: '100',
            type: 'Simple',
            button_text: 'سفارش',
          },
        ],
      },
    ],
  };
}



function _collectCandidates(obj: any, out: any[], depth = 0) {
  if (!obj || depth > 10) return;
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (/^c[0-9A-Za-z]{8,}$/.test(s) || /^c[A-Za-z0-9]{6,}$/.test(s)) {
      out.push(s);
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) _collectCandidates(item, out, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      _collectCandidates(obj[k], out, depth + 1);
    }
  }
}

function _deepFindChannelId(obj: any): string {
  const out: string[] = [];
  _collectCandidates(obj, out);
  if (!out.length) return '';
  // آخرین کاندید c را برمی‌گردانیم
  return out[out.length - 1];
}

export async function rubikaExtractChannelId(token: string, offsetId?: string): Promise<{ ok: boolean; channel_id?: string; count: number; raw?: string; candidates?: any[]; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, count: 0, error: 'توکن وارد نشده است' };
  try {
    const body: any = {};
    if (offsetId) body.offset_id = offsetId;
    const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = null; }

    if (!res.ok) return { ok: false, count: 0, error: 'HTTP ' + res.status + ' — ' + txt.slice(0, 200) };
    if (!data) return { ok: false, count: 0, error: 'پاسخ غیر JSON — ' + txt.slice(0, 200) };

    const isOk = data.ok === true || data.status === 'OK' || data.status === 'ok';
    if (!isOk) {
      const desc = data.description || data.status || data.error || JSON.stringify(data).slice(0, 200);
      return { ok: false, count: 0, error: String(desc) };
    }

    const updates = Array.isArray(data.data?.updates)
      ? data.data.updates
      : Array.isArray(data.result)
        ? data.result
        : [];

    // جستجوی متنی دقیق برای هر چیزی که شبیه "chat_id":"c..." یا "channel_id":"c..." باشد
    const regexChatId = /"chat_id"\s*:\s*"(c[a-zA-Z0-9]+)"/g;
    const regexChannelId = /"channel_id"\s*:\s*"(c[a-zA-Z0-9]+)"/g;
    
    const matchesChat = Array.from(txt.matchAll(regexChatId)).map(m => m[1]);
    const matchesChannel = Array.from(txt.matchAll(regexChannelId)).map(m => m[1]);
    
    const allMatches = [...matchesChat, ...matchesChannel];
    const uniqueMatches = Array.from(new Set(allMatches));

    if (!uniqueMatches.length) {
      return {
        ok: false,
        count: updates.length,
        error: 'شناسه کانال (c...) در پاسخ خام پیدا نشد. مطمئن شو ربات در کانال ادمین است و پیام جدیدی در کانال وجود دارد.',
        raw: txt.slice(0, 800),
      };
    }

    // معمولاً آخرین شناسه کانالِ ثبت‌شده درست‌ترین است
    const chosen = uniqueMatches[uniqueMatches.length - 1];

    return {
      ok: true,
      channel_id: chosen,
      count: updates.length,
      raw: txt.slice(0, 800),
      candidates: uniqueMatches.map((id, i) => ({ index: i, id })),
    };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message || 'خطا در دریافت' };
  }
}


export async function rubikaSendMessageDebug(token: string, chatId: string, text: string, inlineKeypad: any): Promise<{ ok: boolean; message_id?: string; error?: string; raw?: string; request?: any }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  if (!chatId) return { ok: false, error: 'شناسه کانال وارد نشده است' };
  const body: any = { chat_id: chatId, text: text || '', inline_keypad: inlineKeypad };
  try {
    const res = await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch { data = null; }

    if (!res.ok) {
      return { ok: false, error: 'HTTP ' + res.status + ' — ' + (data?.description || txt.slice(0, 300)), raw: txt.slice(0, 1200), request: body };
    }
    if (!data) {
      return { ok: false, error: 'پاسخ غیر JSON — ' + txt.slice(0, 300), raw: txt.slice(0, 1200), request: body };
    }

    const isOk = data.ok === true || data.status === 'OK' || data.status === 'ok';
    if (!isOk) {
      const desc = data.description || data.status || data.error || JSON.stringify(data).slice(0, 300);
      return { ok: false, error: String(desc), raw: txt.slice(0, 1200), request: body };
    }

    const msgId = String(data.result?.message_id || data.result?.message?.message_id || '');
    return { ok: true, message_id: msgId, raw: txt.slice(0, 600), request: body };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در ارسال پیام', request: body };
  }
}


export function buildChannelPostText(product: any, botUsername: string) {
  const code = product.code || 'TEST-001';
  const name = product.name || 'محصول آزمایشی';
  const price = product.price ? Number(product.price).toLocaleString('en-US') : '100,000';
  const color = product.color || '';
  const material = product.material || '';
  const size = product.size || '';
  const qty = product.qty || '';
  const note = product.note || '';
  const deepLink = 'https://rubika.ir/' + botUsername + '?start=' + code;

  let text = '🛍️ ' + name + '\n';
  if (color) text += '🎨 رنگ: ' + color + '\n';
  if (material) text += '🧵 جنس: ' + material + '\n';
  if (size) text += '📏 سایز: ' + size + '\n';
  if (qty) text += '📦 تعداد: ' + qty + '\n';
  text += '💰 قیمت: ' + price + ' تومان\n';
  text += '🏷️ کد مدل: [ ' + code + ' ]\n';
  if (note) text += '📝 یادداشت: ' + note + '\n';
  
  text += '\n👇 برای ثبت سفارش، روی لینک زیر کلیک کنید:\n';
  text += deepLink + '\n\n';
  
  text += '━━━━━━━━━━━━━━━━━━━━\n';
  text += '⚖️【 میـزان | MIZAN 】\n';
  text += '📐 حساب‌های دقیق\n';
  text += '🔒 معاملات امن\n';
  text += '👦🏻 ذهن آسوده\n';
  text += '━━━━━━━━━━━━━━━━━━━━';

  return text;
}


import { buildCatalogIndex, findProduct } from './lib.assistant.catalog';


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
                type: String(btn.type || 'Simple'),
                button_text: label.slice(0, 30),
              };
            })
            .filter(Boolean),
        }))
        .filter((row: any) => row.buttons.length > 0);

      if (cleanRows.length > 0) {
        body.inline_keypad = { rows: cleanRows };
      }
    }
    await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.log('[botSend Error]', e);
  }
}

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

async function getBotOffset(): Promise<string> {
  try { return (await AsyncStorage.getItem('@mizan_rubika_offset')) || ''; } catch { return ''; }
}
async function setBotOffset(v: string): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_rubika_offset', String(v || '')); } catch {}
}
async function getBotCart(chatId: string): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem('@mizan_bot_cart_' + String(chatId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
async function setBotCart(chatId: string, cart: any[]): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_cart_' + String(chatId), JSON.stringify(cart || [])); } catch {}
}
async function getBotState(chatId: string): Promise<any> {
  try {
    const raw = await AsyncStorage.getItem('@mizan_bot_state_' + String(chatId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function setBotState(chatId: string, state: any): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_bot_state_' + String(chatId), JSON.stringify(state || {})); } catch {}
}
async function clearBotState(chatId: string): Promise<void> {
  try { await AsyncStorage.removeItem('@mizan_bot_state_' + String(chatId)); } catch {}
}
function parseBotCodes(text: string): string[] {
  try {
    const cleaned = String(text || '').replace(/\/start/gi, ' ').replace(/[\[\]{}()]/g, ' ').replace(/[،,;\n\r\t]+/g, ' ').trim();
    if (!cleaned) return [];
    return cleaned.split(/\s+/).map(s => s.trim()).filter(Boolean);
  } catch { return []; }
}
function botCartSummary(cart: any[]): string {
  if (!cart || !cart.length) return '🛒 سبد خرید شما خالی است.';
  const lines = cart.map((it, i) => {
    const name = it.name || it.code || '—';
    const price = Number(it.price || 0).toLocaleString('en-US');
    return (i + 1) + '. ' + name + ' — کد: [ ' + (it.code || '') + ' ] — قیمت: ' + price + ' تومان';
  });
  return '🛒 سبد خرید شما:\n' + lines.join('\n');
}

async function botShowPreInvoice(t: string, chatId: string, cart: any[], state: any) {
  let total = 0; const lines = [];
  cart.forEach((it: any, i: number) => {
    total += it.qty * it.price;
    lines.push((i + 1) + '. کد: ' + it.code + ' - ' + (it.cartons ? it.cartons + ' کارتن' : it.qty + ' جفت') + ' - ' + (it.qty * it.price).toLocaleString('en-US'));
  });
  const reply = '🧾 **پیش‌فاکتور نهایی**\n\n👤 نام: ' + state.name + '\n📱 تلفن: ' + state.phone + '\n📍 آدرس: ' + state.address + '\n🚚 باربری: ' + state.shipping + '\n\n' + lines.join('\n') + '\n\n💰 **جمع کل:** ' + total.toLocaleString('en-US') + ' تومان\n\nآیا تایید می‌کنید؟';
  await botSend(t, chatId, reply, { rows: [{ buttons: [{ type: 'Simple', button_text: '✅ تایید نهایی' }, { type: 'Simple', button_text: '❌ انصراف' }] }] });
}

async function botShowMainMenu(t: string, chatId: string) {
  await botSend(t, chatId, '🏠 **منوی اصلی میزان:**', {
    rows: [
      { buttons: [ { id: 'show_products', type: 'Simple', button_text: '📦 لیست محصولات' } ] },
      { buttons: [ { id: 'show_cart', type: 'Simple', button_text: '🛒 سبد خرید' } ] }
    ]
  });
}

async function botShowProducts(t: string, chatId: string) {
  try {
    const catalog = await getCatalogCached();
    const arr = Array.isArray(catalog.products) ? catalog.products : [];
    
    if (!arr.length) {
      await botSend(t, chatId, '❌ هیچ محصولی یافت نشد. لطفاً ابتدا در میزان کالا ثبت کنید.', { rows: [{ buttons: [{ id: 'menu', type: 'Simple', button_text: '🔙 بازگشت به منو' }] }] });
      return;
    }

    const pageItems = arr.slice(0, 15); // حداکثر ۱۵ محصول برای نمایش در کیبورد
    const rows: any[] = [];
    
    for (const p of pageItems) {
      const codeText = String(p.code || '').trim();
      if (!codeText) continue;
      rows.push({ buttons: [{ id: 'sel_' + codeText, type: 'Simple', button_text: codeText }] });
    }
    
    if (rows.length === 0) {
      await botSend(t, chatId, '❌ محصولات یافت شدند اما هیچ‌کدام کد نداشتند.', { rows: [{ buttons: [{ id: 'menu', type: 'Simple', button_text: '🔙 بازگشت به منو' }] }] });
      return;
    }

    rows.push({ buttons: [{ id: 'menu', type: 'Simple', button_text: '🔙 بازگشت به منو' }] });
    await botSend(t, chatId, '📦 **لیست کد محصولات:**\nبرای انتخاب، روی کد کلیک کنید:', { rows });
  } catch (e: any) {
    await botSend(t, chatId, '❌ خطا در دریافت محصولات: ' + (e?.message || ''));
  }
}

async function botShowCart(t: string, chatId: string) {
  const cart = await getBotCart(chatId);
  if (!cart.length) {
    await botSend(t, chatId, '🛒 سبد خرید شما خالی است.', {
      rows: [
        { buttons: [{ id: 'show_products', type: 'Simple', button_text: '📦 لیست محصولات' }] },
        { buttons: [{ id: 'menu', type: 'Simple', button_text: '🔙 بازگشت به منو' }] }
      ]
    });
    return;
  }
  let total = 0;
  let text = '🛒 **سبد خرید شما:**\n\n';
  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const subtotal = item.qty * item.price;
    total += subtotal;
    text += (i + 1) + '. کد: ' + item.code + ' — ' + (item.cartons ? item.cartons + ' کارتن' : item.qty + ' جفت') + ' — ' + subtotal.toLocaleString('en-US') + '\n';
  }
  text += '\n💰 **جمع کل: ' + total.toLocaleString('en-US') + ' تومان**';

  const rows: any[] = [];
  rows.push({ buttons: [{ type: 'Simple', button_text: '✅ نهایی‌سازی سفارش' }] });
  rows.push({ buttons: [{ type: 'Simple', button_text: '🧹 خالی کردن سبد' }] });
  rows.push({ buttons: [{ id: 'menu', type: 'Simple', button_text: '🔙 بازگشت به منو' }] });
  
  await botSend(t, chatId, text, { rows });
}


export async function processRubikaUpdates(token: string): Promise<{ ok: boolean; processed: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, processed: 0, error: 'توکن خالی است' };

  try {
    const offset = await getBotOffset();
    const body: any = { limit: 10 };
    if (offset) body.offset_id = offset;

    const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data: any = await res.json();
    if (!data || (data.status !== 'OK' && data.ok !== true)) return { ok: false, processed: 0, error: 'خطا' };

    const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
    let processed = 0;
    let nextOffset = offset;

    for (const u of updates) {
      if (u.update_id) nextOffset = String(Number(u.update_id) + 1);
      const chatId = String(u.chat_id || u.new_message?.chat_id || '');
      const msgText = String(u.new_message?.text || '').trim();
      const cbData = String(u.data || u.callback_query?.data || u.button_id || '').trim();
      const map: any = {
        'menu': '🔙 بازگشت به منو',
        'menu_back': '🔙 بازگشت به منو',
        'menu_products': '📦 لیست محصولات',
        'show_products': '📦 لیست محصولات',
        'menu_cart': '🛒 سبد خرید',
        'show_cart': '🛒 سبد خرید',
        'btn_checkout': '✅ نهایی‌سازی سفارش',
        'checkout': '✅ نهایی‌سازی سفارش',
        'btn_clear': '🧹 خالی کردن سبد',
        'clear_cart': '🧹 خالی کردن سبد',
        'btn_confirm': '✅ تایید نهایی',
        'confirm_cart': '✅ تایید نهایی',
        'btn_cancel': '❌ انصراف',
        'cancel_cart': '❌ انصراف',
      };
      const text = map[msgText || cbData] || msgText || cbData;
      if (!chatId || !text) continue;

      const cart = await getBotCart(chatId);
      const state = await getBotState(chatId);

      if (text === '/start' || text === '🔙 بازگشت به منو') {
        await clearBotState(chatId);
        await botShowMainMenu(t, chatId); processed++; continue;
      }
      if (text === '📦 لیست محصولات') {
        await clearBotState(chatId);
        await botShowProducts(t, chatId); processed++; continue;
      }
      if (text === '🛒 سبد خرید') {
        await clearBotState(chatId);
        await botShowCart(t, chatId); processed++; continue;
      }
      if (text === '🧹 خالی کردن سبد') {
        await setBotCart(chatId, []);
        await clearBotState(chatId);
        await botSend(t, chatId, '🧹 سبد خرید شما خالی شد.');
        await botShowMainMenu(t, chatId); processed++; continue;
      }
      if (text === '✅ نهایی‌سازی سفارش') {
        if (!cart.length) { await botSend(t, chatId, '❌ سبد خرید شما خالی است.'); processed++; continue; }
        await setBotState(chatId, { step: 'waiting_name' });
        await botSend(t, chatId, '📝 لطفاً نام و نام خانوادگی خود را وارد کنید:'); processed++; continue;
      }

      if (state && state.step) {
        if (state.step === 'waiting_quantity') {
          const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
          if (isNaN(num) || num <= 0) { await botSend(t, chatId, '❌ لطفاً یک عدد معتبر وارد کنید.'); processed++; continue; }
          
          const catalog = await getCatalogCached();
          const p = findProduct(catalog, state.selected_code);
          
          if (p) {
            const qty_pairs = Number(p.raw?.qty_pairs) || 0;
            let finalQty = num, cartons = 0;
            if (qty_pairs > 0) { cartons = num; finalQty = num * qty_pairs; }
            
            const existing = cart.findIndex((x: any) => String(x.code) === String(state.selected_code));
            if (existing >= 0) {
              cart[existing].qty += finalQty;
              cart[existing].cartons = (cart[existing].cartons || 0) + cartons;
            } else {
              cart.push({ code: state.selected_code, name: p?.name, price: Number(p?.price || 0), qty: finalQty, cartons: cartons, qty_pairs });
            }
            await setBotCart(chatId, cart);
          }
          await clearBotState(chatId);
          await botShowCart(t, chatId);
          processed++; continue;
        }
        
        if (state.step === 'waiting_name') {
          state.name = text; state.step = 'waiting_phone'; await setBotState(chatId, state);
          await botSend(t, chatId, '📱 لطفاً شماره تماس خود را وارد کنید:'); processed++; continue;
        }
        if (state.step === 'waiting_phone') {
          state.phone = text; state.step = 'waiting_address'; await setBotState(chatId, state);
          await botSend(t, chatId, '📍 لطفاً آدرس دقیق خود را وارد کنید:'); processed++; continue;
        }
        if (state.step === 'waiting_address') {
          state.address = text; state.step = 'waiting_shipping'; await setBotState(chatId, state);
          await botSend(t, chatId, '🚚 لطفاً نام شرکت باربری مورد نظر را وارد کنید:'); processed++; continue;
        }
        if (state.step === 'waiting_shipping') {
          state.shipping = text; state.step = 'confirm'; await setBotState(chatId, state);
          const lines = []; let total = 0;
          cart.forEach((it: any, i: number) => { total += it.qty * it.price; lines.push((i+1)+'. '+it.code+' - '+(it.cartons?it.cartons+' کارتن':it.qty+' جفت')+' - '+(it.qty*it.price).toLocaleString()); });
          const reply = '🧾 **پیش‌فاکتور نهایی**\n\n👤 نام: ' + state.name + '\n📱 تلفن: ' + state.phone + '\n📍 آدرس: ' + state.address + '\n🚚 باربری: ' + state.shipping + '\n\n' + lines.join('\n') + '\n\n💰 **جمع کل:** ' + total.toLocaleString() + ' تومان\n\nآیا تایید می‌کنید؟';
          await botSend(t, chatId, reply, { rows: [{ buttons: [{ type: 'Simple', button_text: '✅ تایید نهایی' }, { type: 'Simple', button_text: '❌ انصراف' }] }] });
          processed++; continue;
        }

        if (state.step === 'confirm') {
          if (text === '✅ تایید نهایی') {
            const botCfg = await getBotConfig();
            let invNum = '';
            try { invNum = await generateInvoiceNumber(); } catch { invNum = 'INV-' + Date.now(); }
            const total = cart.reduce((sum: number, it: any) => sum + (it.qty * it.price), 0);
            let invoiceText = '🧾 **فاکتور فروش میزان**\n\n🔢 شماره فاکتور: ' + invNum + '\n👤 نام: ' + state.name + '\n📱 تلفن: ' + state.phone + '\n📍 آدرس: ' + state.address + '\n🚚 باربری: ' + state.shipping + '\n📅 تاریخ: ' + new Date().toLocaleDateString('fa-IR') + '\n\n';
            cart.forEach((it: any, idx: number) => { invoiceText += (idx + 1) + '. کد: ' + it.code + '\n   ' + (it.cartons ? it.cartons + ' کارتن (' + it.qty + ' جفت)' : it.qty + ' جفت') + ' × ' + it.price.toLocaleString() + ' = ' + (it.qty * it.price).toLocaleString() + '\n'; });
            invoiceText += '\n💰 **مبلغ کل:** ' + total.toLocaleString() + ' تومان\n';

            await botSend(t, chatId, invoiceText + '\n\n📌 لطفاً مبلغ واریزی خود را در همین چت ارسال کنید تا برای حسابدار ثبت شود.');
            
            if (botCfg.rubika_admin_chat_id) {
              const adminText = '🔔 **فاکتور جدید صادر شد:**\n\n' + invoiceText;
              const adminRes = await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: botCfg.rubika_admin_chat_id, text: adminText }) });
              const adminData = await adminRes.json();
              await setBotState(chatId, { ...state, step: 'waiting_payment', invoice_number: invNum, admin_msg_id: adminData?.result?.message_id || '' });
            }
            try { await issueAssistantInvoice({ id: 'inv_' + Date.now(), invoice_number: invNum, customer_name: state.name, customer_phone: state.phone, customer_address: state.address, customer_shipping: state.shipping, items: cart.map((it: any) => ({ code: it.code, name: it.name, qty: it.qty, priceUnit: it.price, total: it.qty * it.price })), total_amount: total, status: 'issued', created_at: new Date().toISOString(), source: 'rubika' }); } catch (e) {}
            await setBotCart(chatId, []);
            processed++; continue;
          }
          if (text === '❌ انصراف') {
            await setBotCart(chatId, []); await clearBotState(chatId); await botSend(t, chatId, '❌ سفارش لغو شد.'); await botShowMainMenu(t, chatId); processed++; continue;
          }
        }

        if (state.step === 'waiting_payment') {
          const botCfg = await getBotConfig();
          if (botCfg.rubika_admin_chat_id) {
            const reqBody: any = { chat_id: botCfg.rubika_admin_chat_id, text: '💰 **واریزی جدید:**\n🔢 فاکتور: ' + state.invoice_number + '\n👤 مشتری: ' + state.name + '\n📝 واریز: ' + text };
            if (state.admin_msg_id) reqBody.reply_to_message_id = state.admin_msg_id;
            await fetch(RUBIKA_BASE + '/' + t + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) });
            await botSend(t, chatId, '✅ پیام واریز شما برای حسابدار ارسال شد.');
            await clearBotState(chatId);
          }
          processed++; continue;
        }
      }

      const catalog = await getCatalogCached();
      const p = findProduct(catalog, text);
      if (p && (!state || !state.step)) {
        await setBotState(chatId, { step: 'waiting_quantity', selected_code: p.code });
        await botSend(t, chatId, '📦 لطفاً تعداد برای مدل [ ' + p.code + ' ] را وارد کنید:', { rows: [{ buttons: [{ type: 'Simple', button_text: '🔙 بازگشت به منو' }] }] });
        processed++; continue;
      }

      if (!state || !state.step) {
        if (!cbData) await botShowMainMenu(t, chatId);
      }
      processed++;
    }

    if (nextOffset && nextOffset !== offset) await setBotOffset(nextOffset);
    return { ok: true, processed };
  } catch (e: any) {
    return { ok: false, processed: 0, error: e?.message };
  }
}


export async function resetBotOffset() {
  try { await AsyncStorage.removeItem('@mizan_rubika_offset'); console.log('[DEBUG] Offset reset successfully'); } catch {}
}


export async function rubikaExtractAdminChatId(token: string): Promise<{ ok: boolean; chat_id?: string; error?: string; raw?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  try {
    const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch {}
    if (!data || (data.status !== 'OK' && data.ok !== true)) {
      return { ok: false, error: data?.description || 'خطا در دریافت', raw: txt.slice(0, 800) };
    }
    
    // دقیقا همان روشی که برای کانال استفاده کردیم (جستجوی متنی در پاسخ خام)
    const regexChatId = /"chat_id"\s*:\s*"(b[a-zA-Z0-9]+)"/g;
    const matches = txt.match(regexChatId);
    
    if (matches && matches.length > 0) {
      // استخراج شناسه از آخرین پیام
      const lastMatch = matches[matches.length - 1];
      const idMatch = lastMatch.match(/"chat_id"\s*:\s*"([^"]+)"/);
      if (idMatch && idMatch[1]) {
        return { ok: true, chat_id: idMatch[1] };
      }
    }
    
    return { ok: false, error: 'شناسه چت ادمین پیدا نشد. لطفاً ابتدا در چت خصوصی ربات یک پیام بفرستید و دوباره تلاش کنید.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در دریافت' };
  }
}


export async function requestAdminChatCapture(): Promise<void> {
  try { await AsyncStorage.setItem('@mizan_capture_admin', '1'); } catch {}
}


export async function rubikaDebugUpdates(token: string): Promise<{ ok: boolean; count?: number; raw?: string; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  try {
    const res = await fetch(RUBIKA_BASE + '/' + t + '/getUpdates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch {}
    if (!res.ok || !data) return { ok: false, error: 'خطا در دریافت', raw: txt.slice(0, 1500) };
    
    const updates = Array.isArray(data.data?.updates) ? data.data.updates : [];
    // فقط اطلاعات مهم را جدا می‌کنیم تا خوانا باشد
    const simple = updates.map((u: any) => ({
      type: u.type,
      chat_id: u.chat_id || u.new_message?.chat_id || u.callback_query?.chat_id || '',
      text: u.new_message?.text || u.data || '',
      update_id: u.update_id
    }));
    
    return { ok: true, count: updates.length, raw: JSON.stringify(simple, null, 2).slice(0, 2000) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در دریافت' };
  }
}


export async function rubikaRemoveWebhook(token: string): Promise<{ ok: boolean; error?: string; raw?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  try {
    // روش اول: فرستادن URL خالی
    let res = await fetch(RUBIKA_BASE + '/' + t + '/updateBotEndpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '' }),
    });
    let txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch {}
    
    let isOk = data?.ok === true || data?.status === 'OK' || data?.status === 'ok';
    if (!isOk) {
      // روش دوم: فرستادن بدنه کامل با URL خالی
      res = await fetch(RUBIKA_BASE + '/' + t + '/updateBotEndpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ReceiveUpdate', url: '' }),
      });
      txt = await res.text();
      try { data = JSON.parse(txt); } catch {}
      isOk = data?.ok === true || data?.status === 'OK' || data?.status === 'ok';
    }

    if (!isOk) {
      return { ok: false, error: String(data?.description || data?.status || 'خطا در حذف وبهوک'), raw: txt.slice(0, 800) };
    }
    return { ok: true, raw: txt.slice(0, 200) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در حذف وبهوک' };
  }
}


export async function forceFixBot(token: string): Promise<{ ok: boolean; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن خالی است' };
  try {
    await fetch(RUBIKA_BASE + '/' + t + '/updateBotEndpoints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: '' })
    }).catch(() => {});
    await AsyncStorage.removeItem('@mizan_rubika_offset');
    await AsyncStorage.removeItem('@mizan_last_raw_update');
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e?.message }; }
}

export async function getBotLastError(): Promise<string> {
  try { return (await AsyncStorage.getItem('@mizan_bot_last_error')) || 'هیچ خطایی ثبت نشده است.'; } catch { return ''; }
}
