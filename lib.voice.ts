// lib.voice.ts — صدا روی وب + گوشی
import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';

const { Speech } = NativeModules;

// ─── تشخیص محیط
export const isWeb = Platform.OS === 'web';
export const isAndroid = Platform.OS === 'android';
export const hasNativeSpeech = !!(Speech && isAndroid);

// ═══════════════════════════════════════════
// STT — تبدیل صدا به متن
// ═══════════════════════════════════════════
export function isSTTAvailable(): boolean {
  if (hasNativeSpeech) return true;
  if (isWeb && typeof window !== 'undefined') {
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
  return false;
}

export function startSTT(onPartial: (t: string) => void, onResult: (t: string) => void, onError: (e: string) => void): any {
  // ─── گوشی
  if (hasNativeSpeech) {
    try {
      Speech.startListening('fa-IR');
      // listeners از DeviceEventEmitter میان
      return { type: 'native' };
    } catch (e: any) {
      onError(e?.message || 'خطا');
      return null;
    }
  }
  
  // ─── وب (Chrome/Edge)
  if (isWeb && typeof window !== 'undefined') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onError('مرورگر شما از میکروفون پشتیبانی نمی‌کند (از Chrome استفاده کنید)');
      return null;
    }
    
    try {
      const rec = new SR();
      rec.lang = 'fa-IR';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      
      rec.onresult = (ev: any) => {
        let finalText = '';
        let interimText = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const transcript = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += transcript;
          else interimText += transcript;
        }
        if (interimText) onPartial(interimText);
        if (finalText) onResult(finalText.trim());
      };
      
      rec.onerror = (ev: any) => {
        let msg = 'خطا در میکروفون';
        if (ev.error === 'not-allowed') msg = 'دسترسی میکروفون رد شد';
        else if (ev.error === 'no-speech') msg = 'چیزی نشنیدم';
        else if (ev.error === 'network') msg = 'نیاز به اینترنت برای تشخیص صدا';
        else if (ev.error === 'language-not-supported') msg = 'فارسی پشتیبانی نمی‌شود';
        onError(msg);
      };
      
      rec.onend = () => {};
      rec.start();
      return { type: 'web', rec };
    } catch (e: any) {
      onError(e?.message || 'خطا');
      return null;
    }
  }
  
  onError('دستگاه شما از میکروفون پشتیبانی نمی‌کند');
  return null;
}

export function stopSTT(handle: any): void {
  if (!handle) return;
  if (handle.type === 'native' && hasNativeSpeech) {
    try { Speech.stopListening(); } catch {}
  }
  if (handle.type === 'web' && handle.rec) {
    try { handle.rec.stop(); } catch {}
  }
}

// ═══════════════════════════════════════════
// TTS — پاسخ صوتی
// ═══════════════════════════════════════════
export function speakText(text: string, lang: string = 'fa-IR'): void {
  if (!text || !text.trim()) return;
  
  // ─── گوشی
  if (hasNativeSpeech) {
    try { Speech.speak(text, lang); } catch {}
    return;
  }
  
  // ─── وب (Chrome, Edge, Safari)
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try {
      const synth = (window as any).speechSynthesis;
      synth.cancel(); // قطع قبلی
      
      const u = new (window as any).SpeechSynthesisUtterance(text);
      // سعی کن فارسی
      const voices = synth.getVoices() || [];
      const faVoice = voices.find((v: any) =>
        v.lang?.toLowerCase().startsWith('fa') ||
        v.lang?.toLowerCase().startsWith('ar') ||
        v.name?.toLowerCase().includes('persian') ||
        v.name?.toLowerCase().includes('farsi') ||
        v.name?.toLowerCase().includes('arabic')
      );
      
      if (faVoice) {
        u.voice = faVoice;
        u.lang = faVoice.lang;
      } else {
        u.lang = lang;
      }
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      synth.speak(u);
    } catch (e) { console.log('speak err:', e); }
  }
}

export function stopSpeak(): void {
  if (hasNativeSpeech) {
    try { Speech.stopSpeaking?.(); } catch {}
    return;
  }
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    try { (window as any).speechSynthesis.cancel(); } catch {}
  }
}

// ─── لیست صداهای موجود (وب)
export function getVoices(): any[] {
  if (isWeb && typeof window !== 'undefined' && (window as any).speechSynthesis) {
    return (window as any).speechSynthesis.getVoices() || [];
  }
  return [];
}
