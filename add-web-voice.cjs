const fs = require('fs');

// ═══════════════════════════════════════════
// lib.voice.ts — صدا Cross-Platform
// ═══════════════════════════════════════════
const voice = `// lib.voice.ts — صدا روی وب + گوشی
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
`;

fs.writeFileSync('lib.voice.ts', voice, 'utf8');
console.log('✅ lib.voice.ts');

// ═══════════════════════════════════════════
// LocalBotScreen — استفاده از lib.voice
// ═══════════════════════════════════════════
let bot = fs.readFileSync('LocalBotScreen.tsx', 'utf8');
const orig = bot;
const crlf = bot.includes('\r\n');
if (crlf) bot = bot.replace(/\r\n/g, '\n');

// اضافه import
if (!bot.includes('./lib.voice')) {
  bot = bot.replace(
    "import { execute, ExecResult, getLastEntity, clearLastEntity } from './lib.local.exec';",
    "import { execute, ExecResult, getLastEntity, clearLastEntity } from './lib.local.exec';\nimport { isSTTAvailable, startSTT, stopSTT, speakText, stopSpeak } from './lib.voice';"
  );
  console.log('✅ import voice');
}

// حذف کد قدیمی Speech
bot = bot.replace(
  /const \{ Speech \} = NativeModules;\s*\n\s*const voiceAvailable = [^;]+;/g,
  `const voiceAvailable = isSTTAvailable();`
);
console.log('✅ voiceAvailable آپدیت');

// رفرنس handle برای STT
if (!bot.includes('sttHandle')) {
  bot = bot.replace(
    "const scrollRef = useRef<any>(null);",
    "const scrollRef = useRef<any>(null);\n  const sttHandle = useRef<any>(null);"
  );
}

// حذف useEffect قبلی Speech (چون توی lib.voice مدیریت می‌شه)
const oldEffect = /useEffect\(\(\) => \{\s*if \(!voiceAvailable\) return;[\s\S]*?\}, \[showToast\]\);/;
if (oldEffect.test(bot)) {
  bot = bot.replace(oldEffect, `useEffect(() => {
    // ─── Web listeners
    // (توی lib.voice مدیریت می‌شود)
  }, []);`);
  console.log('✅ useEffect قدیمی حذف');
}

// startVoice
const oldStart = `const startVoice = async () => {
    if (!voiceAvailable) { showToast?.('🎤 فقط اندروید', true); return; }
    try { setPartial(''); await Speech.startListening('fa-IR'); } catch {}
  };`;
const newStart = `const startVoice = async () => {
    if (!voiceAvailable) {
      showToast?.('🎤 میکروفون در این محیط کار نمی‌کند', true);
      return;
    }
    setPartial('');
    sttHandle.current = startSTT(
      (partialTxt) => setPartial(partialTxt),
      (finalTxt) => {
        setListening(false);
        setPartial('');
        if (finalTxt) { setText(finalTxt); setTimeout(() => run(finalTxt), 150); }
      },
      (err) => {
        setListening(false);
        setPartial('');
        showToast?.('🎤 ' + err, true);
      }
    );
    setListening(true);
  };`;

if (bot.includes(oldStart)) {
  bot = bot.replace(oldStart, newStart);
  console.log('✅ startVoice');
}

// stopVoice
const oldStop = `const stopVoice = async () => { try { await Speech.stopListening(); } catch {} setListening(false); };`;
const newStop = `const stopVoice = async () => {
    if (sttHandle.current) stopSTT(sttHandle.current);
    sttHandle.current = null;
    setListening(false);
  };`;

if (bot.includes(oldStop)) {
  bot = bot.replace(oldStop, newStop);
  console.log('✅ stopVoice');
}

// speak
const oldSpeak = `const speak = async (t: string) => { if (!voiceAvailable || !voiceReply) return; try { await Speech.speak(t, 'fa-IR'); } catch {} };`;
const newSpeak = `const speak = async (t: string) => {
    if (!voiceReply) return;
    speakText(t, 'fa-IR');
  };`;

if (bot.includes(oldSpeak)) {
  bot = bot.replace(oldSpeak, newSpeak);
  console.log('✅ speak');
}

// subtitle — نمایش وضعیت صوت
bot = bot.replace(
  /<Text style=\{s\.subtitle\}>\{voiceAvailable \? '[^']*' : '[^']*'\}<\/Text>/g,
  `<Text style={s.subtitle}>{voiceAvailable ? (isWeb ? '🌐 وب • 🔇 صوتی' : '📴 آفلاین • 🎤 صوتی') : '⌨️ فقط متنی'}</Text>`
);

if (crlf) bot = bot.replace(/\n/g, '\r\n');
if (bot !== orig) {
  fs.writeFileSync('LocalBotScreen.tsx', bot, 'utf8');
  console.log('💾 LocalBotScreen.tsx');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');