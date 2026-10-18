// lib.voice.ts — Vosk (آفلاین) + fallback به expo-speech-recognition
import { Platform } from 'react-native';
import AsyncStorage from './lib.storage';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const hasNativeSpeech = isAndroid;

const LANG_KEY = '@mizan_voice_lang';

let _Vosk: any = null;
let _voskTried = false;
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

let ExpoSR: any = null;
let _expoTried = false;
function getExpoSR() {
  if (_expoTried) return ExpoSR;
  _expoTried = true;
  try {
    const m = require('expo-speech-recognition');
    ExpoSR = m.ExpoSpeechRecognitionModule;
    console.log('EXPO_SR_LOADED');
  } catch (e) {
    console.log('EXPO_SR_LOAD_FAIL', e);
  }
  return ExpoSR;
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
  const E = getExpoSR();
  if (E?.requestPermissionsAsync) {
    try { const r = await E.requestPermissionsAsync(); return !!r?.granted; } catch {}
  }
  return true;
}

export async function startSTT(
  onPartial: (t: string) => void,
  onResult: (t: string) => void,
  onError: (e: string) => void
): Promise<any> {
  const lang = await getActiveVoiceLang();

  // وب
  if (isWeb && typeof window !== 'undefined') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError('مرورگر پشتیبانی نمی‌کند'); return null; }
    try {
      const rec = new SR();
      rec.lang = lang; rec.continuous = false; rec.interimResults = true;
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

  // اندروید: اول Vosk
  if (isAndroid) {
    const perm = await requestMicPermission();
    if (!perm) { onError('دسترسی میکروفون داده نشد'); return null; }

    const V = getVosk();
    if (V) {
      try {
        if (V.loadModel) await V.loadModel('model-fa-fa');
        const resultCb = (res: any) => {
          const t = res?.text || res?.result?.[0]?.text || res?.transcript || '';
          if (t) onResult(String(t).trim());
        };
        const partialCb = (res: any) => {
          const t = res?.text || res?.partial || '';
          if (t) onPartial(String(t));
        };
        const errorCb = (e: any) => onError(String(e?.message || e || 'خطای Vosk'));

        if (V.onResult) V.onResult(resultCb);
        if (V.onPartialResult) V.onPartialResult(partialCb);
        if (V.onError) V.onError(errorCb);

        if (V.start) V.start();
        else if (V.startListening) V.startListening();
        else throw new Error('Vosk start method not found');

        console.log('VOSK_STARTED');
        return {
          type: 'vosk',
          stop: () => {
            try { if (V.stop) V.stop(); else if (V.stopListening) V.stopListening(); } catch {}
          },
        };
      } catch (e: any) {
        console.log('VOSK_START_ERR', e?.message || String(e));
      }
    }

    // fallback: expo-speech-recognition
    const E = getExpoSR();
    if (E) {
      try {
        const listeners: any[] = [];
        listeners.push(E.addListener('result', (event: any) => {
          try {
            const t = event?.results?.[0]?.transcript;
            if (t) { if (event.isFinal) onResult(t); else onPartial(t); }
          } catch {}
        }));
        listeners.push(E.addListener('error', (event: any) => {
          try {
            const err = event?.error || 'خطا';
            if (err === 'no-speech') onError('چیزی نشنیدم، دوباره بگو');
            else if (err === 'language-not-supported') onError('زبان فارسی روی سرویس گفتار گوشی نصب نیست');
            else onError(err);
          } catch {}
        }));
        E.start({ lang, interimResults: true, continuous: false, requiresOnDeviceRecognition: false });
        return { type: 'expo', stop: () => { try { E.stop(); listeners.forEach(l => l.remove?.()); } catch {} } };
      } catch (e: any) { onError(e?.message || 'خطا'); return null; }
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
  if (isAndroid) {
    try { require('expo-speech').speak(text, { language: useLang, rate: 0.95 }); } catch {}
  }
}

export function stopSpeak(): void {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try { (window as any).speechSynthesis.cancel(); } catch {}
    return;
  }
  if (isAndroid) { try { require('expo-speech').stop(); } catch {} }
}

let _continuous = false;
let _contHandle: any = null;
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
  const startOnce = async () => {
    if (!_continuous) return;
    _contHandle = await startSTT(
      (p) => { if (_onPartial) _onPartial(p); },
      (t) => { if (_onResult) _onResult(t); if (_continuous) setTimeout(startOnce, 500); },
      (e) => { if (_onError) _onError(e); if (_continuous) setTimeout(startOnce, 2000); }
    );
  };
  await startOnce();
}

export function stopContinuous(): void {
  _continuous = false; _onResult = null; _onPartial = null; _onError = null;
  if (_contHandle) { stopSTT(_contHandle); _contHandle = null; }
}

export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
