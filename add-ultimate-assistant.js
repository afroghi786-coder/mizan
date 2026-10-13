const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// بکاپ کامل
// ═══════════════════════════════════════════
const bdir = 'backup-before-ultimate-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
const filesToBackup = [
  'lib.manual.ts',
  'ManualEntryScreen.tsx',
  'android/app/src/main/java/com/mezan786/mizan/MainApplication.kt',
  'App.tsx',
];
filesToBackup.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(bdir, path.basename(f)));
  }
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// مرحله ۱: Android Native Speech Module (Java)
// ═══════════════════════════════════════════════════════
const speechDir = 'android/app/src/main/java/com/mezan786/mizan/speech';
if (!fs.existsSync(speechDir)) fs.mkdirSync(speechDir, { recursive: true });
console.log('═══ مرحله ۱: Native Speech ═══');

const speechModule = `package com.mezan786.mizan.speech;

import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.util.ArrayList;
import java.util.Locale;

public class SpeechModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private final ReactApplicationContext reactContext;
    private SpeechRecognizer speechRecognizer;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean isListening = false;

    public SpeechModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        context.addLifecycleEventListener(this);
        // Init TTS
        tts = new TextToSpeech(context, status -> {
            if (status == TextToSpeech.SUCCESS) {
                try {
                    int faResult = tts.setLanguage(new Locale("fa", "IR"));
                    if (faResult == TextToSpeech.LANG_MISSING_DATA || faResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.US);
                    }
                    ttsReady = true;
                } catch (Exception e) {
                    ttsReady = false;
                }
            }
        });
    }

    @Override
    public String getName() {
        return "Speech";
    }

    private void sendEvent(String name, WritableMap params) {
        try {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(name, params);
        } catch (Exception ignored) {}
    }

    @ReactMethod
    public void startListening(String lang, Promise promise) {
        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
            promise.reject("NOT_AVAILABLE", "Speech recognition not available");
            return;
        }
        if (isListening) {
            promise.resolve(true);
            return;
        }
        try {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
            }
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
            final Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            String useLang = (lang != null && !lang.isEmpty()) ? lang : "fa-IR";
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, useLang);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, useLang);
            intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.getPackageName());

            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {
                    isListening = true;
                    WritableMap m = Arguments.createMap();
                    m.putString("status", "ready");
                    sendEvent("onSpeechReady", m);
                }
                @Override public void onBeginningOfSpeech() {
                    WritableMap m = Arguments.createMap();
                    m.putString("status", "speaking");
                    sendEvent("onSpeechStart", m);
                }
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {
                    WritableMap m = Arguments.createMap();
                    m.putString("status", "processing");
                    sendEvent("onSpeechEnd", m);
                }
                @Override public void onError(int error) {
                    isListening = false;
                    WritableMap m = Arguments.createMap();
                    m.putInt("error", error);
                    m.putString("message", errorToString(error));
                    sendEvent("onSpeechError", m);
                }
                @Override public void onResults(Bundle results) {
                    isListening = false;
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    WritableArray arr = Arguments.createArray();
                    if (matches != null) {
                        for (String s : matches) arr.pushString(s);
                    }
                    WritableMap m = Arguments.createMap();
                    m.putArray("results", arr);
                    if (matches != null && !matches.isEmpty()) m.putString("text", matches.get(0));
                    else m.putString("text", "");
                    sendEvent("onSpeechResult", m);
                }
                @Override public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        WritableMap m = Arguments.createMap();
                        m.putString("text", matches.get(0));
                        sendEvent("onSpeechPartial", m);
                    }
                }
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            speechRecognizer.startListening(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("START_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopListening(Promise promise) {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.stopListening();
            }
            isListening = false;
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void cancel(Promise promise) {
        try {
            if (speechRecognizer != null) {
                speechRecognizer.cancel();
            }
            isListening = false;
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("CANCEL_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void speak(String text, String lang, Promise promise) {
        try {
            if (!ttsReady) {
                promise.reject("TTS_NOT_READY", "TTS not ready");
                return;
            }
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mizan_" + System.currentTimeMillis());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("TTS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopSpeaking(Promise promise) {
        try {
            if (tts != null) tts.stop();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_TTS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            boolean avail = SpeechRecognizer.isRecognitionAvailable(reactContext);
            promise.resolve(avail);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    private String errorToString(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "خطای صدا";
            case SpeechRecognizer.ERROR_CLIENT: return "خطای کلاینت";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "مجوز صدا ندارید";
            case SpeechRecognizer.ERROR_NETWORK: return "خطای شبکه";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "شبکه timeout شد";
            case SpeechRecognizer.ERROR_NO_MATCH: return "چیزی نفهمیدم";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "موتور مشغول است";
            case SpeechRecognizer.ERROR_SERVER: return "خطای سرور";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "چیزی نگفتی";
            default: return "خطای ناشناخته: " + error;
        }
    }

    @Override public void onHostResume() {}
    @Override public void onHostPause() {
        if (speechRecognizer != null) {
            try { speechRecognizer.stopListening(); } catch (Exception ignored) {}
        }
    }
    @Override public void onHostDestroy() {
        if (speechRecognizer != null) {
            try { speechRecognizer.destroy(); } catch (Exception ignored) {}
            speechRecognizer = null;
        }
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception ignored) {}
        }
    }
}
`;

const speechPackage = `package com.mezan786.mizan.speech;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SpeechPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new SpeechModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

fs.writeFileSync(path.join(speechDir, 'SpeechModule.java'), speechModule, 'utf8');
fs.writeFileSync(path.join(speechDir, 'SpeechPackage.java'), speechPackage, 'utf8');
console.log('✅ SpeechModule.java + SpeechPackage.java ساخته شد');

// ثبت در MainApplication.kt
const mainAppPath = 'android/app/src/main/java/com/mezan786/mizan/MainApplication.kt';
let mainApp = fs.readFileSync(mainAppPath, 'utf8');
const mainCRLF = mainApp.includes('\r\n');
if (mainCRLF) mainApp = mainApp.replace(/\r\n/g, '\n');

if (!mainApp.includes('SpeechPackage')) {
  // اضافه import
  if (mainApp.includes('import com.mezan786.mizan.sms.SmsReaderPackage')) {
    mainApp = mainApp.replace(
      'import com.mezan786.mizan.sms.SmsReaderPackage',
      'import com.mezan786.mizan.sms.SmsReaderPackage\nimport com.mezan786.mizan.speech.SpeechPackage'
    );
  } else {
    mainApp = mainApp.replace(
      'import expo.modules.ExpoReactHostFactory',
      'import expo.modules.ExpoReactHostFactory\nimport com.mezan786.mizan.speech.SpeechPackage'
    );
  }
  // اضافه add(SpeechPackage())
  mainApp = mainApp.replace(
    /(add\(SmsReaderPackage\(\)\))/,
    '$1\n          add(SpeechPackage())'
  );
  // اگه SmsReaderPackage نبود
  if (!mainApp.includes('add(SpeechPackage())')) {
    mainApp = mainApp.replace(
      '// add(MyReactNativePackage())',
      '// add(MyReactNativePackage())\n          add(SpeechPackage())'
    );
  }
  console.log('✅ MainApplication.kt آپدیت شد');
} else {
  console.log('ℹ️ SpeechPackage از قبل هست');
}

if (mainCRLF) mainApp = mainApp.replace(/\n/g, '\r\n');
fs.writeFileSync(mainAppPath, mainApp, 'utf8');

// اضافه مجوز RECORD_AUDIO به AndroidManifest
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = fs.readFileSync(manifestPath, 'utf8');
const manCRLF = manifest.includes('\r\n');
if (manCRLF) manifest = manifest.replace(/\r\n/g, '\n');

if (!manifest.includes('RECORD_AUDIO')) {
  manifest = manifest.replace(
    '  <queries>',
    '  <uses-permission android:name="android.permission.RECORD_AUDIO"/>\n  <uses-permission android:name="android.permission.INTERNET"/>\n  <queries>'
  );
  console.log('✅ مجوز RECORD_AUDIO اضافه شد');
}

if (manCRLF) manifest = manifest.replace(/\n/g, '\r\n');
fs.writeFileSync(manifestPath, manifest, 'utf8');

console.log('');

// ═══════════════════════════════════════════════════════
// مرحله ۲: lib.manual.ts — پارسر پیشرفته صرافی
// ═══════════════════════════════════════════════════════
console.log('═══ مرحله ۲: پارسر پیشرفته ═══');

let lm = fs.readFileSync('lib.manual.ts', 'utf8');
const lmCRLF = lm.includes('\r\n');
if (lmCRLF) lm = lm.replace(/\r\n/g, '\n');

// اگه قبلاً اضافه نشده، پارسر صرافی + query engine اضافه کن
if (!lm.includes('parseExchangeCommand')) {
  const exchangerCode = `

// ═══════════════════════════════════════════
// پارسر صرافی پیشرفته
// ═══════════════════════════════════════════

export interface ExchangeCmd {
  ok: boolean;
  side: 'buy' | 'sell';
  currency: string;
  amount: number;
  rate?: number;
  total?: number;
  peer?: any;
  confidence: number;
  raw: string;
  warnings: string[];
}

const CUR_MAP: Record<string, string> = {
  'دالر': 'USD', 'دلار': 'USD', 'دالار': 'USD', 'usd': 'USD', 'دولار': 'USD',
  'یورو': 'EUR', 'eur': 'EUR', 'یورو': 'EUR',
  'افغانی': 'AFN', 'افغانی': 'AFN', 'afn': 'AFN',
  'تومان': 'IRT', 'تومن': 'IRT', 'تومان': 'IRT',
  'ریال': 'IRR', 'irr': 'IRR',
  'روپیه': 'PKR', 'پاکستانی': 'PKR', 'pkr': 'PKR',
  'درهم': 'AED', 'aed': 'AED',
  'تومان': 'IRT',
  'لیر': 'TRY', 'لیره': 'TRY', 'try': 'TRY',
};

function detectCurrency(text: string): string | null {
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(CUR_MAP)) {
    if (t.includes(k)) return v;
  }
  return null;
}

export function parseExchangeCommand(text: string, ctx: any): ExchangeCmd {
  const raw = text;
  const norm = normDigits(text).toLowerCase();
  const warnings: string[] = [];
  
  // تشخیص نوع: خرید یا فروش
  let side: 'buy' | 'sell' | null = null;
  if (/خرید|خریدم|میخرم|گرفتم|دریافت/.test(norm)) side = 'buy';
  else if (/فروش|فروختم|میفروشم|دادم|تحویل/.test(norm)) side = 'sell';
  
  // تشخیص ارز
  const currency = detectCurrency(norm);
  
  // استخراج اعداد
  const allNums = (norm.match(/\\d+(?:\\.\\d+)?/g) || []).map(Number);
  
  let amount: number | undefined;
  let rate: number | undefined;
  
  // کلمات + عدد
  const wordMatch = norm.match(/(پنج|ده|بیست|پنجاه|صد|هزار|میلیون|میلیارد)[\\s\\d]*/);
  if (wordMatch) {
    const w = wordsToNumber(wordMatch[0]);
    if (w) amount = w;
  }
  
  if (allNums.length >= 2) {
    // بزرگتر = مقدار، کوچکتر = نرخ (معمولاً)
    const sorted = [...allNums].sort((a, b) => b - a);
    // اگه یکی خیلی بزرگتره
    if (sorted[0] / sorted[1] > 10) {
      amount = sorted[0] / sorted[1];
      rate = sorted[1];
    } else {
      amount = sorted[0];
      rate = sorted[1];
    }
  } else if (allNums.length === 1) {
    amount = allNums[0];
  }
  
  // اگه amount از کلمه آمد، اولین عدد رو rate بگیر
  if (amount && !rate && allNums.length >= 1) {
    rate = allNums[0];
  }
  
  // تشخیص طرف معامله
  let peer: any;
  const peerMatch = norm.match(/(?:از|به|با)\\s+([\\u0600-\\u06FF\\w]+)/);
  if (peerMatch) {
    const findRes = findPerson(peerMatch[1], [
      ...(ctx.customers || []),
      ...(ctx.suppliers || []),
      ...(ctx.partners || []),
    ]);
    peer = findRes.person;
    if (!peer) warnings.push('طرف پیدا نشد: ' + peerMatch[1]);
  }
  
  if (!side) warnings.push('نوع معامله مشخص نیست (خرید/فروش)');
  if (!currency) warnings.push('ارز مشخص نیست');
  if (!amount) warnings.push('مقدار مشخص نیست');
  
  const total = amount && rate ? amount * rate : undefined;
  let confidence = 0;
  if (side) confidence += 25;
  if (currency) confidence += 20;
  if (amount) confidence += 25;
  if (rate) confidence += 15;
  if (peer) confidence += 15;
  
  return {
    ok: confidence >= 60,
    side: side || 'buy',
    currency: currency || 'USD',
    amount: amount || 0,
    rate,
    total,
    peer,
    confidence,
    raw,
    warnings,
  };
}

// ═══════════════════════════════════════════
// Query Engine — سؤال و جواب حسابداری
// ═══════════════════════════════════════════

export interface QueryResult {
  ok: boolean;
  kind: 'balance' | 'fund' | 'rate' | 'profit' | 'list' | 'today' | 'unknown';
  answer: string;
  data?: any;
  raw: string;
}

export function parseQuery(text: string): { kind: string; target?: string } {
  const t = normDigits(text).toLowerCase();
  
  if (/مانده|چقدر.*بدهکار|چقدر.*طلبکار/.test(t)) {
    return { kind: 'balance' };
  }
  if (/صندوق|دالر.*چند|افغانی.*چند/.test(t)) {
    return { kind: 'fund' };
  }
  if (/نرخ|قیمت/.test(t)) {
    return { kind: 'rate' };
  }
  if (/سود|درآمد/.test(t)) {
    return { kind: 'profit' };
  }
  if (/کی|کدوم|لیست/.test(t) && /طلبکار|بدهکار/.test(t)) {
    return { kind: 'list' };
  }
  if (/گزارش|امروز|خلاصه/.test(t)) {
    return { kind: 'today' };
  }
  
  // تلاش برای پیدا کردن نام
  const nameMatch = t.match(/([\\u0600-\\u06FF]{3,})/);
  return { kind: 'balance', target: nameMatch ? nameMatch[1] : undefined };
}

export async function answerQuery(
  text: string,
  ctx: any,
  deps: {
    getBalance: (personId: string) => number;
    getBoxes: () => Promise<any[]>;
    getRates: () => Promise<any[]>;
    getTodayStats: () => Promise<any>;
  }
): Promise<QueryResult> {
  const raw = text;
  const q = parseQuery(text);
  
  if (q.kind === 'balance') {
    const nameMatch = normDigits(text).match(/([\\u0600-\\u06FF]{2,})/g);
    if (!nameMatch) return { ok: false, kind: 'balance', answer: 'اسم طرف را بگو', raw };
    
    // جستجو بین همه نام‌ها
    for (const n of nameMatch) {
      if (/مانده|چقدر|چقد|بدهکار|طلبکار|حساب/.test(n)) continue;
      const res = findPerson(n, [
        ...(ctx.customers || []),
        ...(ctx.suppliers || []),
        ...(ctx.partners || []),
      ]);
      if (res.person) {
        const bal = deps.getBalance(res.person.id);
        const label = bal > 0 ? 'طلبکار' : bal < 0 ? 'بدهکار' : 'تسویه';
        return {
          ok: true,
          kind: 'balance',
          answer: \`\${res.person.name}: \${Math.abs(bal).toLocaleString('en-US')} — \${label}\`,
          data: { person: res.person, balance: bal },
          raw,
        };
      }
    }
    return { ok: false, kind: 'balance', answer: 'طرف پیدا نشد', raw };
  }
  
  if (q.kind === 'fund') {
    const boxes = await deps.getBoxes();
    if (!boxes || !boxes.length) return { ok: true, kind: 'fund', answer: 'صندوقی وجود ندارد', raw };
    const lines = boxes.map(b => \`• \${b.name || b.code}: \${Number(b.balance || 0).toLocaleString('en-US')} \${b.currency || ''}\`);
    return {
      ok: true,
      kind: 'fund',
      answer: 'صندوق‌ها:\\n' + lines.join('\\n'),
      data: boxes,
      raw,
    };
  }
  
  if (q.kind === 'rate') {
    const rates = await deps.getRates();
    if (!rates || !rates.length) return { ok: true, kind: 'rate', answer: 'نرخی ثبت نشده', raw };
    const lines = rates.slice(0, 8).map(r => \`• \${r.currency}: \${r.rate}\`);
    return {
      ok: true,
      kind: 'rate',
      answer: 'نرخ‌ها:\\n' + lines.join('\\n'),
      data: rates,
      raw,
    };
  }
  
  if (q.kind === 'profit' || q.kind === 'today') {
    const stats = await deps.getTodayStats();
    return {
      ok: true,
      kind: q.kind as any,
      answer: \`📊 امروز: \${stats?.count || 0} معامله — سود \${Number(stats?.profit || 0).toLocaleString('en-US')}\`,
      data: stats,
      raw,
    };
  }
  
  return { ok: false, kind: 'unknown', answer: 'نفهمیدم. مثلاً بپرس: «مانده احمد چقدره؟»', raw };
}

// ═══════════════════════════════════════════
// Dialogue — گفتگوی چند مرحله‌ای
// ═══════════════════════════════════════════

export interface DialogueStep {
  question: string;
  field: string;
  validate?: (v: string) => boolean;
  parse?: (v: string) => any;
}

export interface DialogueState {
  active: boolean;
  intent: 'buy' | 'sell' | 'hawala' | 'check' | 'adjust' | null;
  step: number;
  data: any;
  steps: DialogueStep[];
}

export function startDialogue(intent: string): DialogueState {
  if (intent === 'buy' || intent === 'sell') {
    return {
      active: true,
      intent: intent as any,
      step: 0,
      data: {},
      steps: [
        { question: 'چه ارزی؟ (دالر/یورو/افغانی/...)', field: 'currency', parse: (v) => detectCurrency(v) || v },
        { question: 'چقدر؟', field: 'amount', parse: (v) => wordsToNumber(v) || parseFloat(normDigits(v)) },
        { question: 'نرخ؟', field: 'rate', parse: (v) => parseFloat(normDigits(v)) },
        { question: 'از/به کی؟', field: 'peer' },
      ],
    };
  }
  return { active: false, intent: null, step: 0, data: {}, steps: [] };
}

export function processDialogueAnswer(state: DialogueState, answer: string): { state: DialogueState; done: boolean; summary?: string } {
  if (!state.active || state.step >= state.steps.length) {
    return { state, done: true, summary: buildSummary(state) };
  }
  const step = state.steps[state.step];
  const parsed = step.parse ? step.parse(answer) : answer;
  state.data[step.field] = parsed;
  state.step++;
  if (state.step >= state.steps.length) {
    return { state, done: true, summary: buildSummary(state) };
  }
  return { state, done: false };
}

function buildSummary(state: DialogueState): string {
  const d = state.data;
  const action = state.intent === 'buy' ? 'خرید' : 'فروش';
  const lines = [\`\${action} \${d.amount || '?'} \${d.currency || '?'}\`];
  if (d.rate) lines.push(\`نرخ: \${d.rate}\`);
  if (d.peer) lines.push(\`طرف: \${d.peer}\`);
  if (d.amount && d.rate) lines.push(\`معادل: \${(d.amount * d.rate).toLocaleString('en-US')}\`);
  return lines.join(' | ');
}
`;

  lm = lm + exchangerCode;
  console.log('✅ پارسر صرافی + Query + Dialogue اضافه شد');
}

if (lmCRLF) lm = lm.replace(/\n/g, '\r\n');
fs.writeFileSync('lib.manual.ts', lm, 'utf8');
console.log('💾 lib.manual.ts ذخیره شد (' + lm.split(/\r?\n/).length + ' خط)');

console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('📋 چک نهایی:');
console.log((fs.existsSync(speechDir + '/SpeechModule.java') ? '✅' : '❌') + ' SpeechModule.java');
console.log((fs.existsSync(speechDir + '/SpeechPackage.java') ? '✅' : '❌') + ' SpeechPackage.java');
const checkMain = fs.readFileSync(mainAppPath, 'utf8');
console.log('MainApplication.kt: ' + (checkMain.includes('SpeechPackage') ? '✅' : '❌'));
const checkMan = fs.readFileSync(manifestPath, 'utf8');
console.log('RECORD_AUDIO: ' + (checkMan.includes('RECORD_AUDIO') ? '✅' : '❌'));
console.log('lib.manual.ts: ' + (fs.existsSync('lib.manual.ts') ? '✅' : '❌'));
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\MainApplication.kt" android\\app\\src\\main\\java\\com\\mezan786\\mizan\\MainApplication.kt');
console.log('   copy /Y "' + bdir + '\\lib.manual.ts" lib.manual.ts');
console.log('   rmdir /S /Q ' + speechDir);