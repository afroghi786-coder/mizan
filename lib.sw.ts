// lib.sw.ts — Service Worker (فقط برای PWA — به‌صورت دستی فعال شود)
// ⚠️ در WebView APK قابل استفاده نیست
export async function registerSW(): Promise<any> {
  // در WebView هیچ کاری نمی‌کند
  try {
    if (typeof navigator === 'undefined') return null;
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.register('/mizan/sw.js', { scope: '/mizan/' });
    return reg;
  } catch (e) { return null; }
}
export async function subscribeToPush(_email: string): Promise<any> {
  return { ok: false, error: 'manual only' };
}
export const VAPID_PUBLIC_KEY = '';
