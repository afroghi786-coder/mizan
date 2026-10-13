const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-deepnav-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['AssistantScreen.tsx', 'lib.assistant.ts', 'App.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.assistant.bridge.ts — پل ارتباطی با Screen ها
// ═══════════════════════════════════════════════════════
const bridgeCode = `// lib.assistant.bridge.ts — پل دستیار با صفحات
type Handler = (params: any) => any;

const handlers: Record<string, Handler> = {};

export function registerHandler(key: string, fn: Handler): void {
  handlers[key] = fn;
}

export function unregisterHandler(key: string): void {
  delete handlers[key];
}

export async function callHandler(key: string, params: any): Promise<any> {
  const fn = handlers[key];
  if (!fn) return { ok: false, error: 'handler not registered: ' + key };
  try {
    return await fn(params);
  } catch (e: any) {
    return { ok: false, error: e?.message || 'error' };
  }
}

export function hasHandler(key: string): boolean {
  return !!handlers[key];
}

export function listHandlers(): string[] {
  return Object.keys(handlers);
}

// ─── Deep Link (برای عبور داده بین صفحات)
const DEEP_KEY = '@mizan_deep_link_v1';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeepLink {
  tab: string;
  sub?: string;
  action: string;
  params: any;
  ts: number;
}

export async function setDeepLink(dl: DeepLink): Promise<void> {
  await AsyncStorage.setItem(DEEP_KEY, JSON.stringify(dl));
}

export async function consumeDeepLink(): Promise<DeepLink | null> {
  try {
    const raw = await AsyncStorage.getItem(DEEP_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(DEEP_KEY);
    return JSON.parse(raw);
  } catch { return null; }
}

export async function peekDeepLink(): Promise<DeepLink | null> {
  try {
    const raw = await AsyncStorage.getItem(DEEP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Deep Navigation helper
export async function deepNav(tab: string, sub: string | undefined, action: string, params: any): Promise<void> {
  await setDeepLink({ tab, sub, action, params, ts: Date.now() });
}
`;

fs.writeFileSync('lib.assistant.bridge.ts', bridgeCode, 'utf8');
console.log('✅ lib.assistant.bridge.ts ساخته شد');

// ═══════════════════════════════════════════════════════
// ۲. آپدیت lib.assistant.ts — Intent های جدید برای deep nav
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ lib.assistant.ts ═══');
let asst = fs.readFileSync('lib.assistant.ts', 'utf8');
const asstOrig = asst;
const asstCRLF = asst.includes('\r\n');
if (asstCRLF) asst = asst.replace(/\r\n/g, '\n');

// اضافه Intent های جدید برای «صندوق [شخص]» و «فاکتور جدید برای [شخص]»
const newIntents = `
  // ═══ Deep: صندوق [شخص] ═══
  const boxPersonMatch = t.match(/(?:صندوق|موجودی)\\s+(?:ارز\\s+)?(?:دالر|دلار|یورو|افغانی|تومان)?\\s*(?:از\\s+|برای\\s+)?([\\u0600-\\u06FF]{2,})/);
  if (boxPersonMatch && /صندوق/.test(t)) {
    return {
      kind: 'navigate',
      action: 'gotoBoxPerson',
      params: { name: boxPersonMatch[1], tab: 'exchange', sub: 'boxes' },
      confidence: 80,
      raw,
      reply: 'میرم به صندوق ' + boxPersonMatch[1],
    };
  }

  // ═══ Deep: فاکتور جدید برای [شخص] ═══
  const newInvPersonMatch = t.match(/(?:فاکتور|فاکتر)\\s+(?:جدید|فروش|بزن|بساز)\\s*(?:برای\\s+)?([\\u0600-\\u06FF]{2,})/);
  if (newInvPersonMatch) {
    return {
      kind: 'create',
      action: 'newInvoiceFor',
      params: { name: newInvPersonMatch[1], tab: 'sales' },
      confidence: 80,
      raw,
      reply: 'فاکتور جدید برای ' + newInvPersonMatch[1],
    };
  }

  // ═══ Deep: حواله [مبلغ] به [شخص/شهر] ═══
  const hawalaMatch = t.match(/حواله\\s+(\\d+(?:\\.\\d+)?)\\s*(?:هزار|میلیون)?\\s*(?:افغانی|تومان|ریال|دالر|دلار)?\\s*به\\s+([\\u0600-\\u06FF\\w]+)/);
  if (hawalaMatch) {
    let amt = parseFloat(hawalaMatch[1]);
    if (/هزار/.test(t)) amt *= 1000;
    else if (/میلیون/.test(t)) amt *= 1000000;
    return {
      kind: 'create',
      action: 'newHawalaFor',
      params: { amount: amt, target: hawalaMatch[2], tab: 'exchange', sub: 'hawalas' },
      confidence: 80,
      raw,
      reply: 'حواله ' + amt + ' به ' + hawalaMatch[2],
    };
  }

  // ═══ Deep: مشتری [نام] ═══
  const custMatch = t.match(/(?:مشتری|مشتر)\\s+([\\u0600-\\u06FF]{2,})/);
  if (custMatch && !/مشتریان/.test(t)) {
    return {
      kind: 'navigate',
      action: 'gotoCustomer',
      params: { name: custMatch[1], tab: 'exchange', sub: 'customers' },
      confidence: 75,
      raw,
      reply: 'میرم به مشتری ' + custMatch[1],
    };
  }
`;

// اضافه قبل از "// Navigation" اصلی
const navMarker = `  // Navigation\n  for (const nav of NAV_MAP) {`;
if (asst.includes(navMarker)) {
  asst = asst.replace(navMarker, newIntents + '\n  ' + navMarker);
  console.log('✅ Intent های Deep Navigation اضافه شد');
} else {
  console.log('⚠️ نقطه درج پیدا نشد');
}

if (asstCRLF) asst = asst.replace(/\n/g, '\r\n');
if (asst !== asstOrig) {
  fs.writeFileSync('lib.assistant.ts', asst, 'utf8');
  console.log('💾 lib.assistant.ts ذخیره شد');
}

// ═══════════════════════════════════════════════════════
// ۳. AssistantScreen — استفاده از bridge
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ AssistantScreen.tsx ═══');
let screen = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const screenOrig = screen;
const screenCRLF = screen.includes('\r\n');
if (screenCRLF) screen = screen.replace(/\r\n/g, '\n');

// اضافه import bridge
if (!screen.includes('assistant.bridge')) {
  screen = screen.replace(
    "} from './lib.assistant.executor';",
    "} from './lib.assistant.executor';\nimport { deepNav } from './lib.assistant.bridge';"
  );
  console.log('✅ import bridge اضافه شد');
}

// آپدیت بلوک navigate برای deep nav
const oldNavBlock = `if (intent.kind === 'navigate') {
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab);
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
      } else if (intent.kind === 'query') {`;

const newNavBlock = `if (intent.kind === 'navigate') {
        // Deep Navigation
        try {
          await deepNav(
            intent.params.tab,
            intent.params.sub,
            intent.action || 'goto',
            intent.params
          );
        } catch (e) { console.log('deepNav err:', e); }
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab);
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
      } else if (intent.kind === 'query') {`;

if (screen.includes(oldNavBlock)) {
  screen = screen.replace(oldNavBlock, newNavBlock);
  console.log('✅ Nav → Deep Nav');
}

// آپدیت بلوک create برای deep nav
const oldCreateBlock = `if (intent.kind === 'create') {
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            if (intent.action === 'newInvoice') goTab('sales');
            else if (intent.action === 'newHawala') {
              goTab('exchange');
              setTimeout(() => goSub('hawalas'), 150);
            } else if (intent.action === 'newCustomer') {
              goTab('exchange');
              setTimeout(() => goSub('customers'), 150);
            }
          }, 100);
        }, 600);
        finalReply = '📝 ' + intent.reply;
      }`;

const newCreateBlock = `if (intent.kind === 'create') {
        try {
          await deepNav(
            intent.params.tab || 'exchange',
            intent.params.sub,
            intent.action || 'newInvoice',
            intent.params
          );
        } catch (e) { console.log('deepNav create err:', e); }
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab || 'exchange');
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
        finalReply = '📝 ' + intent.reply;
      }`;

if (screen.includes(oldCreateBlock)) {
  screen = screen.replace(oldCreateBlock, newCreateBlock);
  console.log('✅ Create → Deep Create');
}

if (screenCRLF) screen = screen.replace(/\n/g, '\r\n');
if (screen !== screenOrig) {
  fs.writeFileSync('AssistantScreen.tsx', screen, 'utf8');
  console.log('💾 AssistantScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════════════════
// ۴. ExchangeScreen — گوش دادن به Deep Link
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ ExchangeScreen.tsx ═══');
let ex = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const exOrig = ex;
const exCRLF = ex.includes('\r\n');
if (exCRLF) ex = ex.replace(/\r\n/g, '\n');

// اضافه import
if (!ex.includes('assistant.bridge')) {
  // پیدا کردن آخرین import
  const lines = ex.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import { consumeDeepLink, registerHandler } from './lib.assistant.bridge';");
    ex = lines.join('\n');
    console.log('✅ import bridge به ExchangeScreen اضافه شد');
  }
}

// اضافه useEffect برای consume deep link
if (!ex.includes('consumeDeepLink')) {
  // پیدا کردن اولین useEffect در ExchangeScreen
  const funcStart = ex.indexOf('function ExchangeScreen(');
  if (funcStart > 0) {
    const useEffectIdx = ex.indexOf('useEffect(', funcStart);
    if (useEffectIdx > 0) {
      // پیدا کردن انتهای useEffect
      let braceCount = 0;
      let endPos = -1;
      for (let i = useEffectIdx; i < ex.length; i++) {
        if (ex[i] === '{') braceCount++;
        else if (ex[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            // چک کن بعدش , [ یا );
            const next = ex.substring(i, i + 20);
            if (next.startsWith('}, [') || next.startsWith('});')) {
              const semi = ex.indexOf(';', i);
              if (semi > 0 && semi < i + 30) {
                endPos = semi + 1;
                break;
              }
            }
          }
        }
      }
      if (endPos > 0) {
        const dlCode = `\n\n  // 🤖 Deep Link handler (assistant navigation)\n  useEffect(() => {\n    const _handler = async () => {\n      try {\n        const dl = await consumeDeepLink();\n        if (dl && dl.tab === 'exchange') {\n          console.log('🤖 deep link:', dl);\n          // sub رو تنظیم کن اگه هست\n          if (dl.sub) {\n            setSub(dl.sub as any);\n          }\n          // فیلتر جستجو رو پر کن اگه اسم هست\n          if (dl.params?.name && dl.sub === 'boxes') {\n            // جستجو در صندوق‌ها — بذار برای فاز بعد\n          }\n        }\n      } catch (e) { console.log('deep link err:', e); }\n    };\n    _handler();\n    const iv = setInterval(_handler, 1500);\n    return () => clearInterval(iv);\n  }, []);`;
        ex = ex.substring(0, endPos) + dlCode + ex.substring(endPos);
        console.log('✅ Deep link handler به ExchangeScreen اضافه شد');
      }
    }
  }
}

if (exCRLF) ex = ex.replace(/\n/g, '\r\n');
if (ex !== exOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', ex, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
console.log((fs.existsSync('lib.assistant.bridge.ts') ? '✅' : '❌') + ' lib.assistant.bridge.ts');
const finAsst = fs.readFileSync('lib.assistant.ts', 'utf8');
console.log('Intents جدید: ' + (finAsst.includes('gotoBoxPerson') ? '✅' : '❌'));
const finScreen = fs.readFileSync('AssistantScreen.tsx', 'utf8');
console.log('deepNav: ' + (finScreen.includes('deepNav') ? '✅' : '❌'));
const finEx = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
console.log('ExchangeScreen deep link: ' + (finEx.includes('consumeDeepLink') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');
console.log('   copy /Y "' + bdir + '\\lib.assistant.ts" lib.assistant.ts');
console.log('   copy /Y "' + bdir + '\\App.tsx" App.tsx');