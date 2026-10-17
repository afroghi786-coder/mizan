// lib.voice.ts — صدا با expo-speech-recognition (امن، بدون کرش)
import { Platform } from 'react-native';
import AsyncStorage from './lib.storage';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const hasNativeSpeech = isAndroid;

// ─── ذخیره زبان
const LANG_KEY = '@mizan_voice_lang';

export async function getActiveVoiceLang(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    return v || 'fa-IR';
  } catch { return 'fa-IR'; }
}

export async function setActiveVoiceLang(lang: string): Promise<void> {
  try { await AsyncStorage.setItem(LANG_KEY, lang); } catch {}
}

// ═══════════════════════════════════════════
// STT — تشخیص گفتار
// ═══════════════════════════════════════════
export function isSTTAvailable(): boolean {
  if (isAndroid) return true;
  if (isWeb && typeof window !== 'undefined') {
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
  return false;
}

export async function startSTT(
  onPartial: (t: string) => void,
  onResult: (t: string) => void,
  onError: (e: string) => void
): Promise<any> {
  const lang = await getActiveVoiceLang();

  // ─── گوشی: expo-speech-recognition
  if (isAndroid) {
    try {
      // ۱. درخواست مجوز
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        onError('دسترسی به میکروفون داده نشد');
        return null;
      }

      // ۲. لیسنرها
      const subResult = ExpoSpeechRecognitionModule.addListener('result', (ev: any) => {
        const text = ev?.results?.[0]?.transcript || '';
        if (!text) return;
        if (ev?.isFinal) onResult(text);
        else onPartial(text);
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (ev: any) => {
        const msg = ev?.message || ev?.error || 'خطای میکروفون';
        onError(msg);
      });

      // ۳. شروع
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
      });

      console.log('[voice] 🎤 started with lang:', lang);

      return {
        type: 'native',
        stop: () => {
          try { ExpoSpeechRecognitionModule.stop(); } catch {}
          try { subResult?.remove?.(); } catch {}
          try { subError?.remove?.(); } catch {}
        }
      };
    } catch (e: any) {
      console.log('[voice] start err:', e);
      onError(e?.message || 'خطا در راه‌اندازی میکروفون');
      return null;
    }
  }

  // ─── وب: Web Speech API
  if (isWeb && typeof window !== 'undefined') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onError('مرورگر از میکروفون پشتیبانی نمی‌کند (Chrome)');
      return null;
    }
    try {
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (ev: any) => {
        let finalText = '', interimText = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        if (interimText) onPartial(interimText);
        if (finalText) onResult(finalText.trim());
      };
      rec.onerror = (ev: any) => {
        let msg = 'خطای میکروفون';
        if (ev.error === 'not-allowed') msg = 'دسترسی میکروفون رد شد';
        else if (ev.error === 'no-speech') msg = 'چیزی نشنیدم';
        else if (ev.error === 'network') msg = 'نیاز به اینترنت';
        onError(msg);
      };
      rec.start();
      return { type: 'web', rec, stop: () => { try { rec.stop(); } catch {} } };
    } catch (e: any) {
      onError(e?.message || 'خطا');
      return null;
    }
  }

  onError('دستگاه پشتیبانی نمی‌کند');
  return null;
}

export async function stopSTT(handle: any): Promise<void> {
  if (!handle) return;
  try {
    if (handle.stop) handle.stop();
  } catch {}
}

// ═══════════════════════════════════════════
// TTS — پاسخ صوتی
// ═══════════════════════════════════════════
export async function speakText(text: string, lang?: string): Promise<void> {
  if (!text || !text.trim()) return;
  const useLang = lang || await getActiveVoiceLang();

  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try {
      const synth = (window as any).speechSynthesis;
      synth.cancel();
      const u = new (window as any).SpeechSynthesisUtterance(text);
      u.lang = useLang;
      u.rate = 0.95;
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

// ─── Continuous Mode
let _continuous = false;
let _contHandle: any = null;
let _onResult: ((t: string) => void) | null = null;
let _onPartial: ((t: string) => void) | null = null;

export function isContinuousMode(): boolean { return _continuous; }

export async function startContinuous(
  onResult: (t: string) => void,
  onPartial: (t: string) => void,
  onError: (e: string) => void
): Promise<void> {
  _onResult = onResult;
  _onPartial = onPartial;
  _continuous = true;

  const startOnce = async () => {
    if (!_continuous) return;
    _contHandle = await startSTT(
      (p) => { if (_onPartial) _onPartial(p); },
      (t) => {
        if (_onResult) _onResult(t);
        if (_continuous) setTimeout(startOnce, 400);
      },
      (e) => {
        onError(e);
        if (_continuous) setTimeout(startOnce, 1500);
      }
    );
  };
  await startOnce();
}

export function stopContinuous(): void {
  _continuous = false;
  _onResult = null;
  _onPartial = null;
  if (_contHandle) { stopSTT(_contHandle); _contHandle = null; }
}

export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
