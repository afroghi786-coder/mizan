import { getBotConfig } from './lib.assistant';
import { processRubikaUpdates } from './lib.assistant.rubika';

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
  if (!isRunning) return;

  if (busy) {
    timer = setTimeout(loop, 300);
    return;
  }

  busy = true;
  try {
    const config = await getCachedConfig();
    if (config && config.rubika_token && config.rubika_enabled !== false) {
      await processRubikaUpdates(config.rubika_token);
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
