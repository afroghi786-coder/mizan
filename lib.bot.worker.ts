import { getBotConfig } from './lib.assistant';
import { processRubikaUpdatesSimple } from './lib.assistant.bot.simple';

let isRunning = false;
let busy = false;
let timer: any = null;
let cachedConfig: any = null;
let lastConfigAt = 0;
let backoffMs = 0;

function isSleeping(cfg: any): boolean {
  try {
    if (!cfg || !cfg.sleep_enabled) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const parse = (s: any) => {
      const m = String(s || '').match(/^(\d{1,2}):(\d{2})/);
      return m ? (+m[1]) * 60 + (+m[2]) : null;
    };
    const a = parse(cfg.sleep_start || '20:00');
    const b = parse(cfg.sleep_end || '08:00');
    if (a === null || b === null || a === b) return false;
    if (a < b) return cur >= a && cur < b;
    return cur >= a || cur < b;
  } catch { return false; }
}

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
    timer = setTimeout(loop, 500);
    return;
  }

  busy = true;
  let delay = 3000;
  try {
    const cfg = await getCachedConfig();
    if (cfg && cfg.rubika_token && cfg.rubika_enabled !== false) {
      if (isSleeping(cfg)) {
        delay = 60000;
      } else {
        const r = await processRubikaUpdatesSimple(cfg.rubika_token);
        if (r.error === 'TOO_REQUESTS') {
          backoffMs = Math.min(backoffMs + 5000, 30000);
          console.log('[Worker] TOO_REQUESTS backoff ' + backoffMs + 'ms');
        } else if (r.ok) {
          backoffMs = 0;
          if (r.processed > 0) console.log('[Worker] processed ' + r.processed);
        }
      }
    }
  } catch (e) {
    console.log('[Worker] err', e);
  } finally {
    busy = false;
  }
  delay = Math.max(delay, backoffMs);
  if (isRunning) timer = setTimeout(loop, delay);
}

export async function startGlobalBotWorker() {
  if (isRunning) return;
  isRunning = true;
  backoffMs = 0;
  console.log('[Worker] started (3s interval, sleep-aware)');
  loop();
}

export function stopGlobalBotWorker() {
  isRunning = false;
  busy = false;
  if (timer) clearTimeout(timer);
  timer = null;
  console.log('[Worker] stopped');
}