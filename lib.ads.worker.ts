import { getBotConfig } from './lib.assistant';
import {
  getAdsConfig, saveAdsConfig,
  getAdsQueue, removeAdFromQueue,
  addAdToHistory,
} from './lib.assistant';
import { rubikaSendMessage, rubikaSendPhoto } from './lib.assistant.rubika';
import { telegramSendMessage, telegramSendPhoto } from './lib.assistant.telegram';

let isRunning = false;
let busy = false;
let timer: any = null;
let backoffMs = 0;

async function sendToFacebook(cfg: any, text: string, imageUri: string): Promise<{ ok: boolean; error: string }> {
  try {
    if (!cfg?.send_to_facebook) return { ok: false, error: 'disabled' };
    const pageId = String(cfg?.facebook_page_id || '').trim();
    const token = String(cfg?.facebook_page_token || '').trim();
    if (!pageId || !token) return { ok: false, error: 'missing facebook page/token' };

    if (imageUri) {
      const form = new FormData();
      form.append('caption', String(text || ''));
      form.append('access_token', token);
      form.append('source', { uri: imageUri, name: 'ad.jpg', type: 'image/jpeg' } as any);
      const res = await fetch('https://graph.facebook.com/v20.0/' + pageId + '/photos', { method: 'POST', body: form as any });
      const data: any = await res.json().catch(() => null);
      if (data?.id) return { ok: true, error: '' };
      return { ok: false, error: data?.error?.message || 'facebook photo failed' };
    }

    const res = await fetch('https://graph.facebook.com/v20.0/' + pageId + '/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: String(text || ''), access_token: token }),
    });
    const data: any = await res.json().catch(() => null);
    if (data?.id) return { ok: true, error: '' };
    return { ok: false, error: data?.error?.message || 'facebook feed failed' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'facebook error' };
  }
}

async function sendToTelegram(cfg: any, text: string, imageUri: string): Promise<{ ok: boolean; error: string }> {
  try {
    if (!cfg?.send_to_telegram) return { ok: false, error: 'disabled' };
    const token = String(cfg?.telegram_token || '').trim();
    const chat = String(cfg?.telegram_chat_id || '').trim();
    if (!token || !chat) return { ok: false, error: 'missing telegram token/chat' };
    let mid = '';
    if (imageUri && /^https?:\/\//i.test(imageUri)) {
      mid = await telegramSendPhoto(token, chat, imageUri, text);
    }
    if (!mid) {
      mid = await telegramSendMessage(token, chat, text);
    }
    return { ok: !!mid, error: mid ? '' : 'telegram send failed' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'telegram error' };
  }
}

async function sendToInstagram(cfg: any, text: string, imageUrl: string): Promise<{ ok: boolean; error: string }> {
  try {
    if (!cfg?.send_to_instagram) return { ok: false, error: 'disabled' };
    const igId = String(cfg?.instagram_user_id || '').trim();
    const token = String(cfg?.instagram_token || '').trim();
    const url = String(imageUrl || '').trim();
    if (!igId || !token) return { ok: false, error: 'missing instagram id/token' };
    if (!url || !/^https:\/\//i.test(url)) return { ok: false, error: 'instagram needs public https image url' };

    const createRes = await fetch('https://graph.facebook.com/v20.0/' + igId + '/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: url, caption: String(text || ''), access_token: token }),
    });
    const createData: any = await createRes.json().catch(() => null);
    const creationId = String(createData?.id || '');
    if (!creationId) return { ok: false, error: createData?.error?.message || 'instagram create failed' };

    const pubRes = await fetch('https://graph.facebook.com/v20.0/' + igId + '/media_publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    });
    const pubData: any = await pubRes.json().catch(() => null);
    if (pubData?.id) return { ok: true, error: '' };
    return { ok: false, error: pubData?.error?.message || 'instagram publish failed' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'instagram error' };
  }
}

async function sendToWhatsApp(cfg: any, text: string): Promise<{ ok: boolean; error: string; sent: number; failed: number }> {
  try {
    if (!cfg?.send_to_whatsapp) return { ok: false, error: 'disabled', sent: 0, failed: 0 };
    const phoneId = String(cfg?.whatsapp_phone_number_id || '').trim();
    const token = String(cfg?.whatsapp_token || '').trim();
    const tpl = String(cfg?.whatsapp_template_name || '').trim();
    const lang = String(cfg?.whatsapp_template_lang || 'fa').trim() || 'fa';
    const recipientsRaw = String(cfg?.whatsapp_recipients || '').trim();
    const recipients = recipientsRaw.split(/[,\n;]+/).map((s: string) => s.replace(/[^0-9]/g, '')).filter(Boolean);
    if (!phoneId || !token || !tpl || recipients.length === 0) {
      return { ok: false, error: 'missing whatsapp phone/token/template/recipients', sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const to of recipients) {
      try {
        const body: any = {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: tpl,
            language: { code: lang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: String(text || '') }] },
            ],
          },
        };
        const res = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(body),
        });
        const data: any = await res.json().catch(() => null);
        if (res.ok && data?.messages?.length) sent++;
        else { failed++; errors.push(data?.error?.message || ('HTTP ' + res.status)); }
      } catch (e: any) { failed++; errors.push(e?.message || 'whatsapp error'); }
    }

    return { ok: sent > 0, error: errors.slice(0, 3).join(' | '), sent, failed };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'whatsapp error', sent: 0, failed: 0 };
  }
}

async function tick() {
  if (!isRunning) return;
  if (busy) { timer = setTimeout(tick, 1000); return; }
  busy = true;
  try {
    const cfg = await getAdsConfig();
    if (!cfg || !cfg.enabled) { busy = false; timer = setTimeout(tick, 30000); return; }
    const intervalMs = Math.max(1, Number(cfg.interval_minutes || 60)) * 60 * 1000;
    const lastAt = Number(cfg.last_sent_at || 0);
    const now = Date.now();
    if (lastAt && now - lastAt < intervalMs) { busy = false; timer = setTimeout(tick, 30000); return; }

    const queue = await getAdsQueue();
    if (!Array.isArray(queue) || queue.length === 0) { busy = false; timer = setTimeout(tick, 30000); return; }

    const bot = await getBotConfig();
    const token = String(bot?.rubika_token || '').trim();
    const channel = String(cfg.channel_name || '').trim() || String(bot?.rubika_channel_id || '').trim();
    if (!token || !channel) {
      console.log('[AdsWorker] missing token or channel');
      busy = false; timer = setTimeout(tick, 60000); return;
    }

    const item = queue[0];
    const text = String(item?.text || '').trim();
    if (!text) {
      await removeAdFromQueue(0);
      busy = false; timer = setTimeout(tick, 3000); return;
    }

    let okRubika = false;
    let errorRubika = '';
    if (cfg.send_to_channel) {
      if (item?.imageUri) {
        try {
          const r = await rubikaSendPhoto(token, channel, String(item.imageUri), text);
          okRubika = !!r;
          if (!okRubika) errorRubika = 'rubika sendPhoto failed';
        } catch (e: any) { errorRubika = e?.message || 'rubika sendPhoto error'; }
      } else {
        try {
          const r = await rubikaSendMessage(token, channel, text);
          okRubika = !!r;
          if (!okRubika) errorRubika = 'rubika sendMessage failed';
        } catch (e: any) { errorRubika = e?.message || 'rubika sendMessage error'; }
      }
    }

    const tg = await sendToTelegram(cfg, text, String(item?.imageUri || ''));
    const okTelegram = tg.ok;
    const errorTelegram = tg.error;

    const fb = await sendToFacebook(cfg, text, String(item?.imageUri || ''));
    const okFacebook = fb.ok;
    const errorFacebook = fb.error;

    const ig = await sendToInstagram(cfg, text, String(item?.imageUrl || ''));
    const okInstagram = ig.ok;
    const errorInstagram = ig.error;

    const wa = await sendToWhatsApp(cfg, text);
    const okWhatsApp = wa.ok;
    const errorWhatsApp = wa.error;

    const ok = okRubika || okTelegram || okFacebook || okInstagram || okWhatsApp;
    const error = [errorRubika, errorTelegram, errorFacebook, errorInstagram, errorWhatsApp].filter(Boolean).join(' | ');

    if (ok) {
      await removeAdFromQueue(0);
      await addAdToHistory({ text, imageUri: item?.imageUri || '', status: 'sent', rubika: okRubika, telegram: okTelegram, facebook: okFacebook, instagram: okInstagram, whatsapp: okWhatsApp });
      cfg.last_sent_at = Date.now();
      await saveAdsConfig(cfg);
      backoffMs = 0;
      console.log('[AdsWorker] sent, queue=' + (queue.length - 1));
    } else {
      await addAdToHistory({ text, imageUri: item?.imageUri || '', status: 'failed', error, rubika: okRubika, telegram: okTelegram, facebook: okFacebook, instagram: okInstagram, whatsapp: okWhatsApp });
      if (String(error).includes('TOO_REQUESTS')) {
        backoffMs = Math.min(backoffMs + 10000, 60000);
      } else {
        backoffMs = Math.min(backoffMs + 5000, 30000);
      }
      console.log('[AdsWorker] failed: ' + error + ' backoff=' + backoffMs);
    }
  } catch (e: any) {
    console.log('[AdsWorker] err ' + (e?.message || e));
  } finally {
    busy = false;
  }
  if (isRunning) timer = setTimeout(tick, Math.max(30000, backoffMs));
}

export async function startAdsWorker() {
  if (isRunning) return;
  isRunning = true;
  backoffMs = 0;
  console.log('[AdsWorker] started');
  tick();
}

export function stopAdsWorker() {
  isRunning = false;
  busy = false;
  if (timer) clearTimeout(timer);
  timer = null;
  console.log('[AdsWorker] stopped');
}
