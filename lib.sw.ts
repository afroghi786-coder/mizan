// lib.sw.ts — Service Worker (WebView-safe)
let _swReg: any = null;

const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

export async function registerSW(): Promise<any> {
  if (!hasSW) { console.log('⚠️ SW not supported'); return null; }
  try {
    _swReg = await navigator.serviceWorker.register('/mizan/sw.js', { scope: '/mizan/' });
    console.log('✅ SW registered');
    return _swReg;
  } catch (e: any) { console.log('❌ SW:', e?.message); return null; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export const VAPID_PUBLIC_KEY = 'REPLACE_WITH_PUBLIC_KEY';

export async function subscribeToPush(email: string): Promise<any> {
  try {
    if (!hasSW) return { ok: false, error: 'no SW' };
    if (!_swReg) await registerSW();
    if (!_swReg) return { ok: false, error: 'SW not ready' };
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
      return { ok: false, error: 'no Notification API' };
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'denied' };

    let sub = await _swReg.pushManager.getSubscription();
    if (!sub) {
      sub = await _swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const m = await import('./lib.network');
    if (typeof (m as any).savePushSubscription === 'function') {
      await (m as any).savePushSubscription(email, sub.toJSON());
    }
    return { ok: true };
  } catch (e: any) {
    console.log('❌ subscribe:', e?.message);
    return { ok: false, error: e?.message };
  }
}
