import { getBotConfig } from './lib.assistant';
import { processRubikaUpdatesSimple } from './lib.assistant.bot.simple';

let isRunning = false;
let busy = false;
let timer: any = null;
let cachedConfig: any = null;
let lastConfigAt = 0;

async function getCachedConfig() {
  const now = Date.now();
  if (!cachedConfig || now - lastConfigAt > 30000) {
    cachedConfig = await getBotConfig();
    lastConfigAt = now;
  }
  return cachedConfig;
}

async function loop() {
  console.log('[DIAG_WORKER] loop tick ' + new Date().toISOString());
  if (!isRunning) return;

  if (busy) {
    timer = setTimeout(loop, 300);
    return;
  }

  busy = true;
  try {
    const config = await getCachedConfig();
    console.log('[DIAG_CONFIG]', JSON.stringify({
      hasToken: !!config?.rubika_token,
      tokenLen: String(config?.rubika_token || '').length,
      enabled: !!config?.rubika_enabled,
      admin: !!config?.rubika_admin_chat_id,
      channel: !!config?.rubika_channel_id,
      sleep: !!config?.sleep_enabled,
      sleepStart: config?.sleep_start,
      sleepEnd: config?.sleep_end,
    }));
    console.log('[WORKER_STATUS]', JSON.stringify({
      hasToken: !!config?.rubika_token,
      tokenLen: String(config?.rubika_token || '').length,
      enabled: !!config?.rubika_enabled,
      hasAdmin: !!config?.rubika_admin_chat_id,
      hasChannel: !!config?.rubika_channel_id,
      sleepEnabled: !!config?.sleep_enabled,
      sleepStart: config?.sleep_start || '',
      sleepEnd: config?.sleep_end || '',
      now: new Date().toISOString(),
    }));
    if (config && config.rubika_token && config.rubika_enabled !== false) {
      await processRubikaUpdatesSimple(config.rubika_token);
    }
  } catch (e) {
    console.log('[GlobalBotWorker] Error:', e);
  } finally {
    busy = false;
  }

  if (isRunning) {
    timer = setTimeout(loop, 1200);
  }
}

export async function startGlobalBotWorker() {
  if (isRunning) return;
  isRunning = true;
  console.log('[GlobalBotWorker] Started (cached config)');
  loop();
}

export function stopGlobalBotWorker() {
  isRunning = false;
  busy = false;
  if (timer) clearTimeout(timer);
  timer = null;
  cachedConfig = null;
  console.log('[GlobalBotWorker] Stopped');
}
