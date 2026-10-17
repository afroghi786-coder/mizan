// lib.voice.ts — صدا با Vosk (آفلاین چندزبانه)
// 📴 وب: Web Speech API
// 📱 گوشی: Vosk (آفلاین کامل)

import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import AsyncStorage from './lib.storage';

// ─── Vosk (فقط روی گوشی)
let Vosk: any = null;
try {
  if (Platform.OS === 'android') {
    Vosk = require('react-native-vosk').default;
  }
} catch (e) {
  console.log('[voice] Vosk not available:', e);
}

// ─── محیط
export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const hasNativeSpeech = !!(Vosk && isAndroid);

// ─── ذخیره زبان فعال
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

// ─── نگاشت زبان به مدل Vosk
function mapLangToModel(lang: string): string {
  const l = String(lang || '').toLowerCase();
  if (l.startsWith('fa') || l.startsWith('prs') || l.startsWith('dar')) return 'model-fa-fa';
  if (l.startsWith('ps')) return 'model-ps-ps';
  if (l.startsWith('ar')) return 'model-ar-ar';
  if (l.startsWith('en')) return 'model-en-us';
  return 'model-fa-fa';
}

// ─── وضعیت Vosk
let _voskLoaded = false;
let _voskLoadedModel = '';

async function ensureVoskModel(lang: string): Promise<boolean> {
  if (!Vosk) return false;
  const model = mapLangToModel(lang);
  if (_voskLoaded && _voskLoadedModel === model) return true;

  try {
    // unload قبلی
    if (_voskLoaded) {
      try { await Vosk.unload(); } catch {}
      _voskLoaded = false;
    }
    await Vosk.loadModel(model);
    _voskLoaded = true;
    _voskLoadedModel = model;
    console.log('[voice] Vosk model loaded:', model);
    return true;
  } catch (e: any) {
    console.log('[voice] Vosk load error:', e?.message || e);
    return false;
  }
}

// ═══════════════════════════════════════════
// STT — تشخیص گفتار
// ═══════════════════════════════════════════
export function isSTTAvailable(): boolean {
  if (hasNativeSpeech) return true;
  if (isWeb && typeof window !== 'undefined') {
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
  return false;
}

// ═══════════════════════════════════════════
// STT با استفاده از Vosk (میکروفون آفلاین)
// ═══════════════════════════════════════════
let voskLoaded = false;
let voskListening = false;

export async function startSTT(onPartial: (t: string) => void, onResult: (t: string) => void, onError: (e: string) => void): Promise<any> {
  const lang = await getActiveVoiceLang();
  
  if (isAndroid) {
    try {
      const Vosk = require('react-native-vosk').default;
      if (!Vosk) {
        onError('پکیج Vosk نصب نیست');
        return null;
      }

      // 1. لود کردن مدل
      if (!voskLoaded) {
        const modelName = mapLangToModel(lang);
        console.log('⏳ Loading Vosk model:', modelName);
        await Vosk.loadModel(modelName);
        voskLoaded = true;
        console.log('✅ Model loaded');
      }

      // 2. متصل کردن Event Listener ها
      Vosk.onResult((res: any) => {
        const text = typeof res === 'string' ? res : (res?.text || res?.result?.[0]?.text || '');
        if (text) onResult(text);
      });

      Vosk.onPartialResult((res: any) => {
        const text = typeof res === 'string' ? res : (res?.partial || '');
        if (text) onPartial(text);
      });

      Vosk.onError((err: any) => {
        const msg = typeof err === 'string' ? err : (err?.message || 'خطای Vosk');
        onError(msg);
      });

      // 3. شروع به گوش دادن
      await Vosk.start();
      voskListening = true;
      console.log('🎤 Vosk started listening');

      return {
        type: 'vosk',
        stop: async () => {
          try { await Vosk.stop(); } catch {}
          voskListening = false;
        }
      };
    } catch (e: any) {
      console.log('Vosk error:', e);
      onError(e?.message || 'خطا در راه‌اندازی Vosk');
      return null;
    }
  }

  // وب (Web Speech API)
  if (isWeb && typeof window !== 'undefined') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onError('مرورگر از میکروفون پشتیبانی نمی‌کند (Chrome استفاده کن)');
      return null;
    }
    try {
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (ev: any) => {
        let finalText = '';
        let interimText = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        if (interimText) onPartial(interimText);
        if (finalText) onResult(finalText.trim());
      };
      rec.onerror = (ev: any) => {
        onError(ev.error === 'not-allowed' ? 'دسترسی میکروفون رد شد' : 'خطای میکروفون');
      };
      rec.start();
      return { type: 'web', rec, stop: () => { try { rec.stop(); } catch {} } };
    } catch (e: any) {
      onError(e?.message || 'خطا');
      return null;
    }
  }

  onError('دستگاه شما از میکروفون پشتیبانی نمی‌کند');
  return null;
}

export async function stopSTT(handle: any): Promise<void> {
  if (!handle) return;
  try {
    if (handle.stop) await handle.stop();
  } catch {}
}

// ═══════════════════════════════════════════
// TTS — پاسخ صوتی
// ═══════════════════════════════════════════
export async function speakText(text: string, lang?: string): Promise<void> {
  if (!text || !text.trim()) return;
  const useLang = lang || await getActiveVoiceLang();

  // ─── وب
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try {
      const synth = (window as any).speechSynthesis;
      synth.cancel();
      const u = new (window as any).SpeechSynthesisUtterance(text);
      const voices = synth.getVoices() || [];
      const want = useLang.toLowerCase();
      const v = voices.find((x: any) =>
        x.lang?.toLowerCase().startsWith(want.substring(0, 2))
      );
      if (v) { u.voice = v; u.lang = v.lang; }
      else { u.lang = useLang; }
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      synth.speak(u);
    } catch (e) { console.log('speak err:', e); }
    return;
  }

  // ─── گوشی: expo-speech
  if (isAndroid) {
    try {
      const Speech = require('expo-speech');
      Speech.speak(text, { language: useLang, rate: 0.95, pitch: 1.0 });
    } catch (e) {
      console.log('expo-speech err:', e);
    }
  }
}

export function stopSpeak(): void {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try { (window as any).speechSynthesis.cancel(); } catch {}
    return;
  }
  if (isAndroid) {
    try {
      const Speech = require('expo-speech');
      Speech.stop();
    } catch {}
  }
}

// ═══════════════════════════════════════════
// Continuous Mode — میکروفون یکبار روشن بمونه
// ═══════════════════════════════════════════
let _continuous = false;
let _continuousHandle: any = null;
let _onContinuousResult: ((txt: string) => void) | null = null;
let _onContinuousPartial: ((txt: string) => void) | null = null;

export function isContinuousMode(): boolean {
  return _continuous;
}

export async function startContinuous(
  onResult: (txt: string) => void,
  onPartial: (txt: string) => void,
  onError: (err: string) => void
): Promise<void> {
  _onContinuousResult = onResult;
  _onContinuousPartial = onPartial;
  _continuous = true;

  const startOnce = async () => {
    if (!_continuous) return;

    _continuousHandle = await startSTT(
      (p) => { if (_onContinuousPartial) _onContinuousPartial(p); },
      (t) => {
        if (_onContinuousResult) _onContinuousResult(t);
        if (_continuous) setTimeout(startOnce, 300);
      },
      (e) => {
        if (onError) onError(e);
        if (_continuous) setTimeout(startOnce, 1500);
      }
    );
  };

  await startOnce();
}

export function stopContinuous(): void {
  _continuous = false;
  _onContinuousResult = null;
  _onContinuousPartial = null;
  if (_continuousHandle) {
    stopSTT(_continuousHandle);
    _continuousHandle = null;
  }
}

// ─── لیست صداهای موجود (وب)
export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
