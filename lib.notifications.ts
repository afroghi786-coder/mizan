// lib.notifications.ts — WebView-safe
// ⚠️ هیچ API خطرناکی بدون چک اجرا نمی‌شود

const _W = (typeof window !== 'undefined') ? window : null;
const _N = (typeof navigator !== 'undefined') ? navigator : null;

// تشخیص WebView (APK)
const _isWebView = (() => {
  try {
    if (!_N) return false;
    const ua = (_N.userAgent || '').toLowerCase();
    if (ua.includes('wv') || ua.includes('webview')) return true;
    if (typeof (_W as any)?.ReactNativeWebView !== 'undefined') return true;
    // Android بدون Chrome Mobile معمولاً WebView است
    if (ua.includes('android') && !ua.includes('chrome')) return true;
    return false;
  } catch { return false; }
})();

// در WebView: همه‌چیز غیرفعال
let _audioCtx: any = null;
let _unlocked = false;
let _playing = false;

export function unlockAudio() {
  if (_isWebView) return;
  try {
    if (!_W) return;
    const Ctx = (_W as any).AudioContext || (_W as any).webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
    if (!_unlocked && _audioCtx) {
      const o = _audioCtx.createOscillator();
      const g = _audioCtx.createGain();
      g.gain.value = 0;
      o.connect(g); g.connect(_audioCtx.destination);
      o.start(); o.stop(_audioCtx.currentTime + 0.01);
      _unlocked = true;
    }
  } catch (e) { /* silent */ }
}

export function playNotifSound() {
  if (_isWebView) return;  // ⚠️ در WebView صدا پخش نمی‌شود
  try {
    unlockAudio();
    if (!_audioCtx || _playing) return;
    _playing = true;
    const t = _audioCtx.currentTime;
    const o1 = _audioCtx.createOscillator();
    const g1 = _audioCtx.createGain();
    o1.connect(g1); g1.connect(_audioCtx.destination);
    o1.frequency.value = 880;
    o1.type = 'sine';
    g1.gain.setValueAtTime(0.4, t);
    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    o1.start(t); o1.stop(t + 0.4);
    const o2 = _audioCtx.createOscillator();
    const g2 = _audioCtx.createGain();
    o2.connect(g2); g2.connect(_audioCtx.destination);
    o2.frequency.value = 1320;
    o2.type = 'sine';
    g2.gain.setValueAtTime(0.4, t + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    o2.start(t + 0.2); o2.stop(t + 0.6);
    setTimeout(() => { _playing = false; }, 800);
  } catch (e) { _playing = false; }
}

export function vibrateNotif() {
  if (_isWebView) return;  // ⚠️ در WebView لرزش غیرفعال
  try {
    if (_N && typeof (_N as any).vibrate === 'function') {
      (_N as any).vibrate([200, 100, 200]);
    }
  } catch (e) { /* silent */ }
}

export function showBrowserNotif(title: string, body: string) {
  if (_isWebView) return;  // ⚠️ در WebView نوتیف مرورگر غیرفعال
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, { body, silent: false, tag: 'mizan-' + Date.now() });
    setTimeout(() => { try { n.close(); } catch {} }, 8000);
  } catch (e) { /* silent */ }
}

export async function requestNotifPermission(): Promise<string> {
  if (_isWebView) return 'unsupported';
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (typeof Notification.requestPermission !== 'function') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return await Notification.requestPermission();
  } catch (e) { return 'error'; }
}

export function isWebView(): boolean {
  return _isWebView;
}
