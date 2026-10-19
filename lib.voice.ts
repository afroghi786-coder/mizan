// lib.voice.ts — Vosk offline (Android) + web fallback
import { Platform } from 'react-native';
import AsyncStorage from './lib.storage';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const hasNativeSpeech = isAndroid;

const LANG_KEY = '@mizan_voice_lang';

let _Vosk: any = null;
let _voskTried = false;
let _voskSubs: any[] = [];
function getVosk() {
  if (_voskTried) return _Vosk;
  _voskTried = true;
  try {
    const mod = require('react-native-vosk');
    _Vosk = mod?.default || mod;
    console.log('VOSK_LOADED', _Vosk ? Object.keys(_Vosk) : 'null');
  } catch (e) {
    console.log('VOSK_LOAD_FAIL', e);
  }
  return _Vosk;
}

export async function getActiveVoiceLang(): Promise<string> {
  try { const v = await AsyncStorage.getItem(LANG_KEY); return v || 'fa-IR'; }
  catch { return 'fa-IR'; }
}
export async function setActiveVoiceLang(lang: string): Promise<void> {
  try { await AsyncStorage.setItem(LANG_KEY, lang); } catch {}
}
export function isSTTAvailable(): boolean {
  if (isWeb && typeof window !== 'undefined') {
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
  return isAndroid;
}

export async function requestMicPermission(): Promise<boolean> {
  if (!isAndroid) return true;
  try {
    const m: any = require('expo-speech-recognition');
    const r = await m.ExpoSpeechRecognitionModule?.requestPermissionsAsync?.();
    return !!r?.granted;
  } catch { return true; }
}

export async function startSTT(
  onPartial: (t: string) => void,
  onResult: (t: string) => void,
  onError: (e: string) => void
): Promise<any> {
  // وب
  if (isWeb && typeof window !== 'undefined') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError('مرورگر پشتیبانی نمی‌کند'); return null; }
    try {
      const rec = new SR();
      rec.lang = await getActiveVoiceLang();
      rec.continuous = false; rec.interimResults = true;
      rec.onresult = (ev: any) => {
        let f = '', i = '';
        for (let k = ev.resultIndex; k < ev.results.length; k++) {
          const t = ev.results[k][0].transcript;
          if (ev.results[k].isFinal) f += t; else i += t;
        }
        if (i) onPartial(i);
        if (f) onResult(f.trim());
      };
      rec.onerror = (ev: any) => onError(ev.error || 'خطا');
      rec.start();
      return { type: 'web', stop: () => { try { rec.stop(); } catch {} } };
    } catch (e: any) { onError(e?.message || 'خطا'); return null; }
  }

  if (isAndroid) {
    const perm = await requestMicPermission();
    if (!perm) { onError('دسترسی میکروفون داده نشد'); return null; }

    const V = getVosk();
    if (!V) { onError('موتور آفلاین Vosk لود نشد (نیاز به rebuild دارد)'); return null; }

    // پاک کردن listenerهای قبلی
    if (_voskSubs && _voskSubs.length) {
      _voskSubs.forEach((sub: any) => { try { sub?.remove?.(); } catch {} });
      _voskSubs = [];
    }

    try {
      console.log('VOSK_LOADING_MODEL...');
      if (V.loadModel) await V.loadModel('model-fa-fa');
      console.log('VOSK_MODEL_LOADED');
    } catch (e: any) {
      console.log('VOSK_MODEL_ERR', e?.message || String(e));
      onError('مدل Vosk لود نشد: ' + (e?.message || ''));
      return null;
    }

    try {
      if (V.onFinalResult) {
        const sub = V.onFinalResult((r: any) => {
          try {
            const t = typeof r === 'string' ? r : (r?.text || '');
            if (t && t.trim()) { console.log('VOSK_FINAL', t); onResult(String(t).trim()); }
          } catch (e) { console.log('VOSK_RESULT_ERR', e); }
        });
        if (sub) _voskSubs.push(sub);
      }
      if (V.onResult) {
        const sub = V.onResult((r: any) => {
          try {
            const t = typeof r === 'string' ? r : (r?.text || '');
            if (t && t.trim()) { console.log('VOSK_RESULT', t); onResult(String(t).trim()); }
          } catch (e) { console.log('VOSK_RESULT_ERR', e); }
        });
        if (sub) _voskSubs.push(sub);
      }
      if (V.onPartialResult) {
        const sub = V.onPartialResult((r: any) => {
          try {
            const t = typeof r === 'string' ? r : (r?.text || '');
            if (t) onPartial(String(t));
          } catch {}
        });
        if (sub) _voskSubs.push(sub);
      }
      if (V.onError) {
        const sub = V.onError((e: any) => {
          try {
            console.log('VOSK_ERROR', e);
            onError(String(e?.message || e || 'خطای Vosk'));
          } catch {}
        });
        if (sub) _voskSubs.push(sub);
      }

      console.log('VOSK_STARTING...');
      if (V.start) await V.start();
      else if (V.startListening) await V.startListening();
      else throw new Error('start method not found');

      console.log('VOSK_STARTED');

      return {
        type: 'vosk',
        stop: () => {
          try {
            if (_voskSubs && _voskSubs.length) {
              _voskSubs.forEach((sub: any) => { try { sub?.remove?.(); } catch {} });
              _voskSubs = [];
            }
            if (V.stop) V.stop();
            else if (V.stopListening) V.stopListening();
            console.log('VOSK_STOPPED');
          } catch {}
        },
      };
    } catch (e: any) {
      console.log('VOSK_START_ERR', e?.message || String(e));
      onError('Vosk start failed: ' + (e?.message || ''));
      return null;
    }
  }

  onError('میکروفون در دسترس نیست');
  return null;
}

export async function stopSTT(handle: any): Promise<void> {
  if (!handle) return;
  try { if (handle.stop) handle.stop(); } catch {}
}

export async function speakText(text: string, lang?: string): Promise<void> {
  if (!text || !text.trim()) return;
  const useLang = lang || await getActiveVoiceLang();
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try {
      const synth = (window as any).speechSynthesis; synth.cancel();
      const u = new (window as any).SpeechSynthesisUtterance(text);
      u.lang = useLang; u.rate = 0.95; synth.speak(u);
    } catch {}
    return;
  }
  if (isAndroid) { try { require('expo-speech').speak(text, { language: useLang, rate: 0.95 }); } catch {} }
}

export function stopSpeak(): void {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try { (window as any).speechSynthesis.cancel(); } catch {}
    return;
  }
  if (isAndroid) { try { require('expo-speech').stop(); } catch {} }
}

let _continuous = false;
let _handle: any = null;
let _onResult: ((t: string) => void) | null = null;
let _onPartial: ((t: string) => void) | null = null;
let _onError: ((e: string) => void) | null = null;

export function isContinuousMode(): boolean { return _continuous; }

export async function startContinuous(
  onResult: (t: string) => void,
  onPartial: (t: string) => void,
  onError: (e: string) => void
): Promise<void> {
  _onResult = onResult; _onPartial = onPartial; _onError = onError; _continuous = true;
  _handle = await startSTT(
    (p) => { if (_onPartial) _onPartial(p); },
    (t) => { if (_onResult) _onResult(t); },
    (e) => { if (_onError) _onError(e); }
  );
}

export function stopContinuous(): void {
  _continuous = false; _onResult = null; _onPartial = null; _onError = null;
  if (_handle) { stopSTT(_handle); _handle = null; }
}

export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
