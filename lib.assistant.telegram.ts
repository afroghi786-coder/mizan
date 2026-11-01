// lib.assistant.telegram.ts — اتصال امن به Telegram Bot API
// فعلاً فقط تست اتصال (getMe). هیچ پیامی ارسال نمی‌شود.

const TELEGRAM_BASE = 'https://api.telegram.org';

export async function telegramPing(token: string): Promise<{ ok: boolean; username?: string; name?: string; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'توکن وارد نشده است' };
  try {
    const res = await fetch(TELEGRAM_BASE + '/bot' + t + '/getMe');
    const data: any = await res.json();
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, error: data?.description || ('HTTP ' + res.status) };
    }
    const r = data.result || {};
    return { ok: true, username: r.username || '', name: (r.first_name || '') + ' ' + (r.last_name || '') };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا در اتصال' };
  }
}


export async function telegramGetUpdates(token: string, offset?: number): Promise<{ ok: boolean; count: number; lastText?: string; lastChat?: string; nextOffset?: number; error?: string }> {
  const t = String(token || '').trim();
  if (!t) return { ok: false, count: 0, error: 'توکن وارد نشده است' };
  try {
    const url = TELEGRAM_BASE + '/bot' + t + '/getUpdates?timeout=0' + (offset ? ('&offset=' + offset) : '');
    const res = await fetch(url);
    const data: any = await res.json();
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, count: 0, error: data?.description || ('HTTP ' + res.status) };
    }
    const updates = Array.isArray(data.result) ? data.result : [];
    let lastText = '';
    let lastChat = '';
    let nextOffset = offset || 0;
    for (const u of updates) {
      const msg = u.message || u.edited_message || u.channel_post || null;
      if (msg) {
        lastText = msg.text || msg.caption || ('[' + (msg.photo ? 'عکس' : msg.video ? 'ویدیو' : 'پیام') + ']');
        lastChat = String(msg.chat?.title || msg.chat?.username || msg.chat?.first_name || msg.chat?.id || '');
      }
      nextOffset = Math.max(nextOffset, (u.update_id || 0) + 1);
    }
    return { ok: true, count: updates.length, lastText, lastChat, nextOffset };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message || 'خطا در دریافت' };
  }
}


export async function telegramSendMessage(token: string, chatId: string, text: string): Promise<string> {
  const t = String(token || '').trim();
  const c = String(chatId || '').trim();
  if (!t || !c) return '';
  try {
    const res = await fetch('https://api.telegram.org/bot' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: c, text: String(text || ''), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data: any = await res.json().catch(() => null);
    return String(data?.result?.message_id || '');
  } catch { return ''; }
}

export async function telegramSendPhoto(token: string, chatId: string, imageUrl: string, caption: string): Promise<string> {
  const t = String(token || '').trim();
  const c = String(chatId || '').trim();
  const u = String(imageUrl || '').trim();
  if (!t || !c || !u || !/^https?:\/\//i.test(u)) return '';
  try {
    const res = await fetch('https://api.telegram.org/bot' + t + '/sendPhoto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: c, photo: u, caption: String(caption || ''), parse_mode: 'HTML' }),
    });
    const data: any = await res.json().catch(() => null);
    return String(data?.result?.message_id || '');
  } catch { return ''; }
}
