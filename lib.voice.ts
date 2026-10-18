// lib.voice.ts — میکروفون امن (وب + اندروید با Lazy Load)
import { Platform } from 'react-native';
import AsyncStorage from './lib.storage';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';

const LANG_KEY = '@mizan_voice_lang';

let ExpoSpeechRecognitionModule: any = null;
let _moduleLoadAttempted = false;

async function loadNativeModule() {
  if (!isAndroid) return false;
  if (ExpoSpeechRecognitionModule) return true;
  if (_moduleLoadAttempted) return false;
  _moduleLoadAttempted = true;
  try {
    const m = require('expo-speech-recognition');
    ExpoSpeechRecognitionModule = m.ExpoSpeechRecognitionModule;
    console.log('✅ expo-speech-recognition loaded');
    return true;
  } catch (e) {
    console.log('❌ expo-speech-recognition load failed:', e);
    return false;
  }
}

export function hasNativeSpeech(): boolean {
  if (isAndroid) return true; // we'll try on demand
  return false;
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
  const ok = await loadNativeModule();
  if (!ok || !ExpoSpeechRecognitionModule) return false;
  try {
    const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!r?.granted;
  } catch { return false; }
}

export async function startSTT(
  onPartial: (t: string) => void,
  onResult: (t: string) => void,
  onError: (e: string) => void
): Promise<any> {
  const lang = await getActiveVoiceLang();

  // ─── وب ───
  if (isWeb && typeof window !== 'undefined') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError('مرورگر پشتیبانی نمی‌کند'); return null; }
    try {
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
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
      return { type: 'web', rec, stop: () => { try { rec.stop(); } catch {} } };
    } catch (e: any) { onError(e?.message || 'خطا'); return null; }
  }

  // ─── اندروید (Lazy) ───
  if (isAndroid) {
    const ok = await loadNativeModule();
    if (!ok || !ExpoSpeechRecognitionModule) {
      onError('ماژول تشخیص گفتار در دسترس نیست (شاید نیاز به rebuild دارد)');
      return null;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        onError('دسترسی میکروفون داده نشد');
        return null;
      }

      const listeners: any[] = [];

      // نتیجه نهایی
      const resSub = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        try {
          if (event?.results?.[0]?.transcript) {
            const txt = event.results[0].transcript;
            if (event.isFinal) onResult(txt);
            else onPartial(txt);
          }
        } catch {}
      });
      listeners.push(resSub);

      // خطا
      const errSub = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        try {
          console.log('MIC_DETAIL', JSON.stringify(event));
          const err = event?.error || 'خطا';
          const msg = event?.message ? ' — ' + event.message : '';
          if (err === 'no-speech') onError('چیزی نشنیدم، دوباره بگو');
          else if (err === 'service-not-allowed') onError('سرویس گفتار گوشی اجازه نداد');
          else if (err === 'language-not-supported') onError('زبان فارسی روی گوشی نصب نیست');
          else onError(err + msg);
        } catch {}
      });
      listeners.push(errSub);

      // پایان
      const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
        // nothing needed here for now
      });
      listeners.push(endSub);

      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
                addsPunctuation: false,
      });

      console.log('🎤 Android STT started');

      return {
        type: 'android',
        stop: () => {
          try {
            ExpoSpeechRecognitionModule.stop();
            listeners.forEach(l => { try { l.remove(); } catch {} });
          } catch {}
        },
      };
    } catch (e: any) {
      console.log('Android STT error:', e);
      onError(e?.message || 'خطا در شروع میکروفون');
      return null;
    }
  }

  onError('میکروفون در دسترس نیست');
  return null;
}

export async function stopSTT(handle: any): Promise<void> {
  if (!handle) return;
  try {
    if (handle.type === 'android') {
      const ok = await loadNativeModule();
      if (ok && ExpoSpeechRecognitionModule) ExpoSpeechRecognitionModule.stop();
    } else if (handle.stop) {
      handle.stop();
    }
  } catch {}
}

export async function speakText(text: string, lang?: string): Promise<void> {
  if (!text || !text.trim()) return;
  const useLang = lang || await getActiveVoiceLang();
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try {
      const synth = (window as any).speechSynthesis;
      synth.cancel();
      const u = new (window as any).SpeechSynthesisUtterance(text);
      u.lang = useLang; u.rate = 0.95;
      synth.speak(u);
    } catch {}
    return;
  }
  if (isAndroid) {
    try {
      const Speech = require('expo-speech');
      Speech.speak(text, { language: useLang, rate: 0.95 });
    } catch {}
  }
}

export function stopSpeak(): void {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try { (window as any).speechSynthesis.cancel(); } catch {}
    return;
  }
  if (isAndroid) {
    try { require('expo-speech').stop(); } catch {}
  }
}

// ─── Continuous mode ───
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
  _onResult = onResult;
  _onPartial = onPartial;
  _onError = onError;
  _continuous = true;
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
  _continuous = false;
  _onResult = null; _onPartial = null; _onError = null;
  if (_contHandle) { stopSTT(_contHandle); _contHandle = null; }
  if (isAndroid) {
    loadNativeModule().then(ok => {
      if (ok && ExpoSpeechRecognitionModule) {
        try { ExpoSpeechRecognitionModule.stop(); } catch {}
      }
    });
  }
}

export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
