const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-search-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['AssistantScreen.tsx', 'lib.assistant.ts'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.assistant.core.ts — موتور جستجو + Context
// ═══════════════════════════════════════════════════════
const coreCode = `// lib.assistant.core.ts — موتور جستجو + Context دستیار
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════
// Context — حافظه دستیار
// ═══════════════════════════════════════════
export interface AsstContext {
  lastEntity?: { type: string; id: string; name: string; meta: any };
  lastSearch?: string;
  lastTab?: string;
  lastSub?: string;
  lastAction?: string;
  updatedAt: number;
}

let _ctx: AsstContext = { updatedAt: 0 };

export function setContext(patch: Partial<AsstContext>): void {
  _ctx = { ..._ctx, ...patch, updatedAt: Date.now() };
}
export function getContext(): AsstContext { return _ctx; }
export function clearContext(): void { _ctx = { updatedAt: 0 }; }

// ═══════════════════════════════════════════
// نرمال‌سازی
// ═══════════════════════════════════════════
export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Levenshtein فاصله
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// امتیاز تطبیق
function score(text: string, query: string): number {
  const t = norm(text);
  const q = norm(query);
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.endsWith(q)) return 75;
  if (t.includes(q)) return 60;
  if (q.includes(t)) return 55;
  // فازی
  const dist = lev(t, q);
  const ratio = 1 - dist / Math.max(t.length, q.length);
  if (ratio > 0.65) return Math.round(ratio * 55);
  // کلمات
  const qWords = q.split(/\\s+/);
  const tWords = t.split(/\\s+/);
  let matched = 0;
  for (const qw of qWords) {
    for (const tw of tWords) {
      if (tw.includes(qw) || qw.includes(tw)) { matched++; break; }
    }
  }
  if (matched > 0) return Math.round(40 * (matched / qWords.length));
  return 0;
}

// ═══════════════════════════════════════════
// Entity types
// ═══════════════════════════════════════════
export type EntityType = 'box' | 'customer' | 'supplier' | 'invoice' | 'hawala' | 'check' | 'product';

export interface Entity {
  type: EntityType;
  id: string;
  name: string;
  subtitle?: string;
  meta: any;
  score: number;
}

// ═══════════════════════════════════════════
// Deep Search
// ═══════════════════════════════════════════
export async function deepSearch(query: string, types?: EntityType[]): Promise<Entity[]> {
  const results: Entity[] = [];
  const wantAll = !types || !types.length;

  // ─── صندوق‌ها ───
  if (wantAll || types!.includes('box')) {
    try {
      const { getBoxes } = await import('./lib.fx');
      const boxes = await getBoxes().catch(() => []) || [];
      for (const b of boxes) {
        const s1 = score(b.name || '', query);
        const s2 = score(b.code || '', query);
        const s3 = score(b.currency || '', query);
        const s = Math.max(s1, s2, s3);
        if (s > 0) {
          results.push({
            type: 'box',
            id: b.id || b.local_id || b.code,
            name: b.name || b.code || 'صندوق',
            subtitle: \`\${b.currency || 'AFN'} — موجودی: \${(Number(b.opening) || 0).toLocaleString('en-US')}\`,
            meta: b,
            score: s,
          });
        }
      }
    } catch (e) { console.log('search box err:', e); }
  }

  // ─── مشتریان ───
  if (wantAll || types!.includes('customer')) {
    try {
      const { getFxCustomers } = await import('./lib.fx.cust');
      const custs = await getFxCustomers().catch(() => []) || [];
      for (const c of custs) {
        const s1 = score(c.name || '', query);
        const s2 = score(c.phone || '', query);
        const s3 = score(c.code || '', query);
        const s = Math.max(s1, s2, s3);
        if (s > 0) {
          results.push({
            type: 'customer',
            id: c.id || c.local_id || c.code || '',
            name: c.name || 'مشتری',
            subtitle: c.phone || c.bank || '',
            meta: c,
            score: s,
          });
        }
      }
    } catch (e) { console.log('search customer err:', e); }
  }

  // ─── فاکتورهای فروش ───
  if (wantAll || types!.includes('invoice')) {
    try {
      const { getSalesGrouped } = await import('./lib');
      const sales = await getSalesGrouped().catch(() => []) || [];
      for (const s of sales) {
        const s1 = score(s.invoice || '', query);
        const s2 = score(s.name || '', query);
        const s3 = score(s.phone || '', query);
        const sc = Math.max(s1, s2, s3);
        if (sc > 0) {
          results.push({
            type: 'invoice',
            id: s.invoice,
            name: \`فاکتور \${s.invoice} — \${s.name || ''}\`,
            subtitle: \`\${(Number(s.total) || 0).toLocaleString('en-US')} افغانی — \${new Date(s.date || 0).toLocaleDateString('fa-IR')}\`,
            meta: s,
            score: sc,
          });
        }
      }
    } catch (e) { console.log('search invoice err:', e); }
  }

  // مرتب‌سازی بر اساس امتیاز
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10);
}

// ═══════════════════════════════════════════
// Resolve — پیدا کردن یک entity
// ═══════════════════════════════════════════
export async function resolveBox(name: string, currency?: string): Promise<any | null> {
  try {
    const { getBoxes } = await import('./lib.fx');
    const boxes = await getBoxes().catch(() => []) || [];
    let best: any = null;
    let bestScore = 0;
    for (const b of boxes) {
      let s = score(b.name || '', name);
      if (currency && b.currency === currency) s += 20;
      else if (currency && b.currency !== currency) s -= 30;
      if (s > bestScore) { bestScore = s; best = b; }
    }
    return bestScore >= 40 ? best : null;
  } catch { return null; }
}

export async function resolvePerson(name: string): Promise<any | null> {
  try {
    const { getFxCustomers } = await import('./lib.fx.cust');
    const custs = await getFxCustomers().catch(() => []) || [];
    let best: any = null;
    let bestScore = 0;
    for (const c of custs) {
      const s1 = score(c.name || '', name);
      const s2 = score(c.phone || '', name);
      const s = Math.max(s1, s2);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return bestScore >= 40 ? best : null;
  } catch { return null; }
}

// ═══════════════════════════════════════════
// Action Executor
// ═══════════════════════════════════════════
export async function addToBox(boxId: string, amount: number, type: 'in' | 'out', note?: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const { getBoxes, addBoxTransaction } = await import('./lib.boxes');
    const boxes = await getBoxes().catch(() => []) || [];
    const box = boxes.find((b: any) => (b.id || b.local_id || b.code) === boxId);
    if (!box) return { ok: false, msg: 'صندوق پیدا نشد' };

    await addBoxTransaction({
      box_id: box.id || box.local_id,
      box_code: box.code,
      type: type === 'in' ? 'in' : 'out',
      amount,
      currency: box.currency || 'AFN',
      description: note || (type === 'in' ? 'افزایش از دستیار' : 'کاهش از دستیار'),
      date: new Date().toISOString(),
    });

    return {
      ok: true,
      msg: \`✅ \${type === 'in' ? 'افزایش' : 'کاهش'} \${amount.toLocaleString('en-US')} \${box.currency || ''} در صندوق \${box.name}\`,
    };
  } catch (e: any) {
    return { ok: false, msg: '❌ ' + (e?.message || 'خطا') };
  }
}

// ═══════════════════════════════════════════
// Pre-fill Form
// ═══════════════════════════════════════════
export interface Prefill {
  type: string;
  fields: Record<string, any>;
}

export async function buildInvoicePrefill(personName: string): Promise<Prefill | null> {
  const p = await resolvePerson(personName);
  if (!p) return null;
  return {
    type: 'invoice',
    fields: {
      customer_name: p.name,
      customer_code: p.code || p.id || p.local_id,
      customer_phone: p.phone || '',
      customer_bank: p.bank || '',
      customer_holder: p.holder_name || '',
    },
  };
}
`;

fs.writeFileSync('lib.assistant.core.ts', coreCode, 'utf8');
console.log('✅ lib.assistant.core.ts ساخته شد (' + coreCode.split('\n').length + ' خط)');

// ═══════════════════════════════════════════════════════
// ۲. AssistantScreen — استفاده از search + context
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ AssistantScreen.tsx ═══');
let screen = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const screenOrig = screen;
const screenCRLF = screen.includes('\r\n');
if (screenCRLF) screen = screen.replace(/\r\n/g, '\n');

// import
if (!screen.includes('assistant.core')) {
  screen = screen.replace(
    "} from './lib.assistant.executor';",
    "} from './lib.assistant.executor';\nimport { deepSearch, resolveBox, resolvePerson, addToBox, setContext, getContext, clearContext, Entity, norm } from './lib.assistant.core';"
  );
  console.log('✅ import core اضافه شد');
}

// state search results
if (!screen.includes('searchResults')) {
  screen = screen.replace(
    "const [pendingAction, setPendingAction] = useState<any>(null);",
    "const [pendingAction, setPendingAction] = useState<any>(null);\n  const [searchResults, setSearchResults] = useState<Entity[]>([]);\n  const [awaitingAnswer, setAwaitingAnswer] = useState<string>('');"
  );
  console.log('✅ state searchResults اضافه شد');
}

// در runCommand — قبل از intent parsing، context-aware command ها رو چک کن
const beforeIntentMarker = `      const intent = parseIntent(command);
      setLastResult(intent);`;
const beforeIntentNew = `      // 🧠 اول context و دستورات وابسته رو چک کن
      const ctx = getContext();
      const lowCmd = norm(command);

      // ─── تأیید/لغو pending action ───
      if (pendingAction) {
        if (/تایید|تأیید|ok|بله|آره|انجام|تاییدیه/.test(lowCmd)) {
          try {
            const res = await executeAction(pendingAction.action, pendingAction.params || {});
            setLastResult({ kind: 'action', action: pendingAction.action, params: pendingAction.params, confidence: 100, raw: command, reply: res });
            setPendingAction(null);
            await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'action', action: pendingAction.action, params: {}, confidence: 100, raw: command, reply: res }, response: res, timestamp: Date.now() });
            setHistory(await getAssistantHistory());
            speak(res);
            showToast?.(res);
            setProcessing(false);
            return;
          } catch (e: any) {
            showToast?.('❌ ' + (e?.message || ''), true);
            setProcessing(false);
            return;
          }
        }
        if (/لغو|نه|cancel|کنسل|بیخیال/.test(lowCmd)) {
          const msg = '❌ لغو شد';
          setPendingAction(null);
          setLastResult({ kind: 'action', action: 'cancel', params: {}, confidence: 100, raw: command, reply: msg });
          showToast?.(msg);
          setProcessing(false);
          return;
        }
      }

      // ─── دستورات وابسته به Context: «۵۰۰ به آن اضافه کن» ───
      const addToItMatch = lowCmd.match(/(\\d+(?:\\.\\d+)?)\\s*(?:به\\s+(?:آن|اون|همون)|اضافه\\s+کن|اضافه\\s+کن\\s+به\\s+(?:آن|اون|همون))/);
      const addToItMatch2 = lowCmd.match(/به\\s+(?:آن|اون|همون)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:اضافه|بزن|واریز)?/);
      const addMatch = addToItMatch || addToItMatch2;
      
      if (addMatch && ctx.lastEntity) {
        const amt = parseFloat((addToItMatch ? addToItMatch[1] : addToItMatch2![1]) || '0');
        if (amt > 0) {
          if (ctx.lastEntity.type === 'box') {
            const r = await addToBox(ctx.lastEntity.id, amt, 'in', 'افزایش از دستیار');
            const reply = r.msg;
            setLastResult({ kind: 'action', action: 'addToBox', params: { boxId: ctx.lastEntity.id, amount: amt }, confidence: 100, raw: command, reply });
            await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'action', action: 'addToBox', params: {}, confidence: 100, raw: command, reply }, response: reply, timestamp: Date.now() });
            setHistory(await getAssistantHistory());
            speak(reply);
            showToast?.(reply);
            setProcessing(false);
            return;
          }
          if (ctx.lastEntity.type === 'customer') {
            // افزایش مانده مشتری
            try {
              const balKey = '@mizan_manual_balances_v1';
              const raw = await (await import('@react-native-async-storage/async-storage')).default.getItem(balKey);
              const bals = raw ? JSON.parse(raw) : {};
              bals[ctx.lastEntity.id] = (bals[ctx.lastEntity.id] || 0) + amt;
              await (await import('@react-native-async-storage/async-storage')).default.setItem(balKey, JSON.stringify(bals));
              const reply = \`✅ \${amt.toLocaleString('en-US')} به مانده \${ctx.lastEntity.name} اضافه شد\`;
              setLastResult({ kind: 'action', action: 'addBalance', params: {}, confidence: 100, raw: command, reply });
              speak(reply);
              showToast?.(reply);
              setProcessing(false);
              return;
            } catch {}
          }
        }
      }

      // ─── «بیشتر/کمتر از آن» ───
      const subFromItMatch = lowCmd.match(/(\\d+(?:\\.\\d+)?)\\s*(?:از\\s+(?:آن|اون|همون)|کم\\s+کن)/);
      if (subFromItMatch && ctx.lastEntity && ctx.lastEntity.type === 'box') {
        const amt = parseFloat(subFromItMatch[1]);
        if (amt > 0) {
          const r = await addToBox(ctx.lastEntity.id, amt, 'out', 'کاهش از دستیار');
          const reply = r.msg;
          setLastResult({ kind: 'action', action: 'subFromBox', params: {}, confidence: 100, raw: command, reply });
          speak(reply);
          showToast?.(reply);
          setProcessing(false);
          return;
        }
      }

      // ─── جستجوی عمیق: «صندوق [ارز] [نام]» یا «صورتحساب [نام]» یا «فاکتور [نام/شماره]» ───
      const isBoxQuery = /صندوق/.test(lowCmd);
      const isStatementQuery = /صورتحساب|صورت.?حساب|کاردکس/.test(lowCmd);
      const isInvoiceQuery = /فاکتور/.test(lowCmd) && !/بزن|بساز|جدید/.test(lowCmd);

      if (isBoxQuery || isStatementQuery || isInvoiceQuery) {
        // استخراج اسم و ارز
        const currencyMatch = lowCmd.match(/(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|usd|afn|eur)/);
        const curMap: any = { 'دالر': 'USD', 'دلار': 'USD', 'یورو': 'EUR', 'افغانی': 'AFN', 'تومان': 'IRT', 'ریال': 'IRR', 'روپیه': 'PKR', 'درهم': 'AED' };
        const currency = currencyMatch ? (curMap[currencyMatch[1]] || currencyMatch[1].toUpperCase()) : undefined;

        // حذف کلمات کلیدی
        let nameQuery = lowCmd
          .replace(/صندوق|صورتحساب|صورت.?حساب|کاردکس|فاکتور|دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|را|بیار|بیاور|بگیر|بزن|بساز|برای|از|به/g, '')
          .replace(/[^\\u0600-\\u06FF\\w\\s]/g, '')
          .trim();

        if (nameQuery && nameQuery.length >= 2) {
          if (isBoxQuery) {
            const box = await resolveBox(nameQuery, currency);
            if (box) {
              setContext({ lastEntity: { type: 'box', id: box.id || box.local_id, name: box.name || box.code, meta: box }, lastSearch: nameQuery });
              // navigation
              const { deepNav } = await import('./lib.assistant.bridge');
              await deepNav('exchange', 'boxes', 'gotoBox', { name: nameQuery, currency, boxId: box.id || box.local_id });
              const reply = \`📦 صندوق \${box.name} (\${box.currency}) — موجودی \${(Number(box.opening) || 0).toLocaleString('en-US')}\`;
              setLastResult({ kind: 'query', action: 'findBox', params: {}, confidence: 95, raw: command, reply });
              speak(reply);
              showToast?.(reply);
              setTimeout(() => {
                onExit?.();
                setTimeout(() => { goTab('exchange'); setTimeout(() => goSub('boxes'), 150); }, 100);
              }, 600);
              setProcessing(false);
              return;
            }
          }
          if (isStatementQuery) {
            const person = await resolvePerson(nameQuery);
            if (person) {
              setContext({ lastEntity: { type: 'customer', id: person.id || person.local_id, name: person.name, meta: person }, lastSearch: nameQuery });
              const { deepNav } = await import('./lib.assistant.bridge');
              await deepNav('exchange', 'ledger', 'gotoStatement', { name: nameQuery, personId: person.id || person.local_id });
              const reply = \`📊 صورتحساب \${person.name}\`;
              setLastResult({ kind: 'query', action: 'statement', params: {}, confidence: 95, raw: command, reply });
              speak(reply);
              setTimeout(() => {
                onExit?.();
                setTimeout(() => { goTab('exchange'); setTimeout(() => goSub('ledger'), 150); }, 100);
              }, 600);
              setProcessing(false);
              return;
            }
          }
          if (isInvoiceQuery) {
            const results = await deepSearch(nameQuery, ['invoice']);
            if (results.length > 0) {
              setSearchResults(results);
              const reply = \`📄 \${results.length} فاکتور پیدا شد — کدام؟\`;
              setLastResult({ kind: 'query', action: 'searchInvoice', params: { results }, confidence: 80, raw: command, reply });
              speak(reply);
              setProcessing(false);
              return;
            }
          }
        }
      }

      // ─── پارسر معمولی ───
      const intent = parseIntent(command);
      setLastResult(intent);`;

if (screen.includes(beforeIntentMarker)) {
  screen = screen.replace(beforeIntentMarker, beforeIntentNew);
  console.log('✅ Context-aware commands اضافه شد');
} else {
  console.log('⚠️ محل runCommand پیدا نشد');
}

// UI: نمایش نتایج جستجو
if (!screen.includes('🔍 نتایج جستجو')) {
  const resultsMarker = `        {lastResult && (`;
  const resultsUI = `        {/* 🔍 نتایج جستجو */}
        {searchResults.length > 0 && (
          <View style={[s.card, { borderColor: '#0891b2', marginTop: 12 }]}>
            <Text style={s.cardTitle}>🔍 نتایج ({searchResults.length})</Text>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={[s.sampleBtn, { marginTop: 6, borderColor: r.score > 60 ? '#059669' : '#f59e0b' }]}
                onPress={() => {
                  setContext({ lastEntity: { type: r.type, id: r.id, name: r.name, meta: r.meta } });
                  showToast?.('✅ انتخاب شد: ' + r.name);
                  setSearchResults([]);
                }}
              >
                <Text style={s.sampleIcon}>
                  {r.type === 'box' ? '📦' : r.type === 'customer' ? '👤' : r.type === 'invoice' ? '📄' : '📋'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.sampleTxt}>{r.name}</Text>
                  {r.subtitle ? <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right' }}>{r.subtitle}</Text> : null}
                </View>
                <Text style={{ color: r.score > 60 ? '#059669' : '#f59e0b', fontSize: 11, fontWeight: 'bold' }}>{r.score}%</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => setSearchResults([])}>
              <Text style={s.btnTxt}>✕ بستن</Text>
            </TouchableOpacity>
          </View>
        )}

        {lastResult && (`;
  if (screen.includes(resultsMarker)) {
    screen = screen.replace(resultsMarker, resultsUI);
    console.log('✅ UI نتایج جستجو اضافه شد');
  }
}

if (screenCRLF) screen = screen.replace(/\n/g, '\r\n');
if (screen !== screenOrig) {
  fs.writeFileSync('AssistantScreen.tsx', screen, 'utf8');
  console.log('💾 AssistantScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
console.log((fs.existsSync('lib.assistant.core.ts') ? '✅' : '❌') + ' lib.assistant.core.ts');
const fin = fs.readFileSync('AssistantScreen.tsx', 'utf8');
console.log('import core: ' + (fin.includes('assistant.core') ? '✅' : '❌'));
console.log('Context-aware: ' + (fin.includes('ctx.lastEntity') ? '✅' : '❌'));
console.log('Deep search: ' + (fin.includes('resolveBox') ? '✅' : '❌'));
console.log('UI results: ' + (fin.includes('🔍 نتایج') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');