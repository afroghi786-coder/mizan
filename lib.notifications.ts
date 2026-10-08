// lib.notifications.ts — Global notification helpers (WebView-safe)
let _audioCtx: any = null;
let _unlocked = false;
let _playingSound = false;

const isWeb = typeof window !== 'undefined';
const hasAudio = isWeb && (typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
const hasNotif = isWeb && typeof Notification !== 'undefined';

export function unlockAudio() {
  if (!hasAudio) return;
  try {
    if (!_audioCtx) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      _audioCtx = new Ctx();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
    if (!_unlocked && _audioCtx) {
      const o = _audioCtx.createOscillator();
      const g = _audioCtx.createGain();
      g.gain.value = 0;
      o.connect(g); g.connect(_audioCtx.destination);
      o.start(); o.stop(_audioCtx.currentTime + 0.01);
      _unlocked = true;
    }
  } catch (e) { console.log('unlockAudio err:', e); }
}

export function playNotifSound() {
  if (!hasAudio) return;
  try {
    unlockAudio();
    if (!_audioCtx || _playingSound) return;
    _playingSound = true;
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
    setTimeout(() => { _playingSound = false; }, 800);
  } catch (e) { _playingSound = false; }
}

export function vibrateNotif() {
  try {
    if (isWeb && navigator && typeof (navigator as any).vibrate === 'function') {
      (navigator as any).vibrate([200, 100, 200]);
    }
  } catch (e) {}
}

export function showBrowserNotif(title: string, body: string) {
  if (!hasNotif) return;
  try {
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/mizan/favicon.ico',
      silent: false,
      tag: 'mizan-' + Date.now(),
    });
    setTimeout(() => { try { n.close(); } catch {} }, 8000);
  } catch (e) {}
}

export async function requestNotifPermission(): Promise<string> {
  if (!hasNotif) return 'unsupported';
  try {
    if (typeof Notification.requestPermission !== 'function') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return await Notification.requestPermission();
  } catch (e) { return 'error'; }
}
