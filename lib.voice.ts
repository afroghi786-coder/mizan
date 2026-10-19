// lib.voice.ts — Whisper (اصلی) + Vosk (پشتیبان)
import { Platform } from 'react-native';
import AsyncStorage from './lib.storage';

export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';

const LANG_KEY = '@mizan_voice_lang';

// --- Whisper ---
let whisperCtx: any = null;
let whisperLoading = false;

async function getWhisperCtx() {
  if (whisperCtx) return whisperCtx;
  if (whisperLoading) return null;
  whisperLoading = true;
  try {
    console.warn('WHISPER_INIT...');
    const { initWhisper } = require('whisper.rn');
    whisperCtx = await initWhisper({
      filePath: require('../../assets/ggml-tiny.bin'),
    });
    console.warn('WHISPER_READY');
    whisperLoading = false;
    return whisperCtx;
  } catch (e: any) {
    console.warn('WHISPER_INIT_FAIL', e?.message || String(e));
    whisperLoading = false;
    return null;
  }
}

// --- Vosk (پشتیبان) ---
let VoskModule: any = null;
let VoskLoaded = false;
let voskSubs: any[] = [];

function getVosk(): any {
  if (VoskModule) return VoskModule;
  try {
    const mod = require('react-native-vosk');
    VoskModule = mod?.default || mod;
    console.warn('VOSK_LOADED', VoskModule ? Object.keys(VoskModule) : 'null');
  } catch (e) {
    console.warn('VOSK_LOAD_FAIL', e);
  }
  return VoskModule;
}

// --- Common ---
export async function getActiveVoiceLang(): Promise<string> {
  try { const v = await AsyncStorage.getItem(LANG_KEY); return v || 'fa'; }
  catch { return 'fa'; }
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
      rec.lang = await getActiveVoiceLang() === 'fa' ? 'fa-IR' : 'fa-IR';
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

  if (!isAndroid) { onError('میکروفون در دسترس نیست'); return null; }
  const perm = await requestMicPermission();
  if (!perm) { onError('دسترسی میکروفون داده نشد'); return null; }

  // ۱. اول Whisper
  const wh = await getWhisperCtx();
  if (wh) {
    try {
      console.warn('WHISPER_STARTING...');
      const { stop, promise } = await wh.transcribeRealtime({
        language: 'fa',
        onTranscribe: (data: any) => {
          try {
            if (data?.isFinished) {
              const txt = (data.result || '').trim();
              if (txt) { console.warn('WHISPER_RESULT', txt); onResult(txt); }
            } else if (data?.result) {
              onPartial(data.result);
            }
          } catch (e) { console.warn('WHISPER_CB_ERR', e); }
        },
        onError: (err: any) => {
          console.warn('WHISPER_ERR', err);
          onError('خطای Whisper: ' + String(err));
        },
      });
      console.warn('WHISPER_STARTED');
      return { type: 'whisper', stop: () => { try { stop(); } catch {} } };
    } catch (e: any) {
      console.warn('WHISPER_START_ERR', e?.message || String(e));
      // اگر Whisper خطا داد، می‌رویم سراغ Vosk
    }
  }

  // ۲. پشتیبان: Vosk
  console.warn('FALLBACK_TO_VOSK');
  const V = getVosk();
  if (!V) { onError('هیچ موتور گفتاری کار نکرد'); return null; }

  if (!VoskLoaded) {
    try {
      console.warn('VOSK_LOADING_MODEL...');
      await V.loadModel('model-fa-fa');
      VoskLoaded = true;
      console.warn('VOSK_MODEL_LOADED');
    } catch (e: any) {
      console.warn('VOSK_MODEL_ERR', e?.message || String(e));
      onError('Vosk هم لود نشد: ' + (e?.message || ''));
      return null;
    }
  }

  try {
    voskSubs.forEach((s: any) => { try { s?.remove?.(); } catch {} });
    voskSubs = [];

    if (V.onFinalResult) {
      const sub = V.onFinalResult((r: any) => {
        const t = typeof r === 'string' ? r : '';
        if (t && t.trim()) onResult(t.trim());
      });
      if (sub) voskSubs.push(sub);
    }
    if (V.onPartialResult) {
      const sub = V.onPartialResult((r: any) => {
        const t = typeof r === 'string' ? r : '';
        if (t) onPartial(t);
      });
      if (sub) voskSubs.push(sub);
    }
    if (V.onError) {
      const sub = V.onError((e: any) => onError(String(e)));
      if (sub) voskSubs.push(sub);
    }

    if (V.start) await V.start();
    console.warn('VOSK_STARTED');
    return {
      type: 'vosk',
      stop: () => {
        try { if (V.stop) V.stop(); } catch {}
        voskSubs.forEach((s: any) => { try { s?.remove?.(); } catch {} });
        voskSubs = [];
      }
    };
  } catch (e: any) {
    console.warn('VOSK_START_ERR', e?.message || String(e));
    onError('Vosk start failed: ' + (e?.message || ''));
    return null;
  }
}

export async function stopSTT(handle: any): Promise<void> {
  if (!handle) return;
  try { if (handle.stop) handle.stop(); } catch {}
}

export async function speakText(text: string, lang?: string): Promise<void> {
  if (!text || !text.trim()) return;
  const useLang = lang || ((await getActiveVoiceLang()) === 'fa' ? 'fa-IR' : 'en-US');
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

let _cont = false;
let _handle: any = null;
let _onR: ((t: string) => void) | null = null;
let _onP: ((t: string) => void) | null = null;
let _onE: ((e: string) => void) | null = null;

export function isContinuousMode(): boolean { return _cont; }

export async function startContinuous(
  onResult: (t: string) => void,
  onPartial: (t: string) => void,
  onError: (e: string) => void
): Promise<void> {
  _onR = onResult; _onP = onPartial; _onE = onError; _cont = true;
  const once = async () => {
    if (!_cont) return;
    _handle = await startSTT(
      (p) => { if (_onP) _onP(p); },
      (t) => { if (_onR) _onR(t); if (_cont) setTimeout(once, 300); },
      (e) => { if (_onE) _onE(e); _cont = false; }
    );
  };
  await once();
}

export function stopContinuous(): void {
  _cont = false; _onR = null; _onP = null; _onE = null;
  if (_handle) { stopSTT(_handle); _handle = null; }
}

export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
