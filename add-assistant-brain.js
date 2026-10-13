const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-brain-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['AssistantScreen.tsx', 'lib.assistant.ts'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.assistant.executor.ts — مغز اجرایی
// ═══════════════════════════════════════════════════════
const execCode = `// lib.assistant.executor.ts — اجراکننده واقعی دستورات
import AsyncStorage from '@react-native-async-storage/async-storage';

const BALANCE_KEY = '@mizan_manual_balances_v1';
const RATES_KEY = '@mizan_local_daily_rates';

// ─── خواندن مانده‌ها
async function getBalances(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(BALANCE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function updateBalance(id: string, delta: number): Promise<void> {
  const bal = await getBalances();
  bal[id] = (bal[id] || 0) + delta;
  await AsyncStorage.setItem(BALANCE_KEY, JSON.stringify(bal));
}

// ─── نرمال‌سازی نام
function normalizeName(s: string): string {
  return String(s || '')
    .replace(/[يى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/\\s+/g, ' ')
    .toLowerCase()
    .trim();
}

// ─── پیدا کردن طرف
async function findPerson(name: string): Promise<any> {
  const q = normalizeName(name);
  if (!q) return null;
  
  try {
    const { getFxCustomers } = await import('./lib.fx.cust');
    const customers = await getFxCustomers().catch(() => []) || [];
    const all = customers.map((c: any) => ({ ...c, type: 'customer' }));
    
    // جستجوی دقیق
    let best: any = null;
    let bestScore = 0;
    for (const p of all) {
      const n = normalizeName(p.name || '');
      if (!n) continue;
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q)) score = 80;
      else if (n.includes(q)) score = 60;
      else if (q.includes(n)) score = 50;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 50 ? best : null;
  } catch (e) {
    console.log('findPerson err:', e);
    return null;
  }
}

// ═══════════════════════════════════════════
// Query — خواندن داده
// ═══════════════════════════════════════════
export async function executeQuery(action: string, params: any): Promise<string> {
  try {
    if (action === 'getBalance') {
      const p = await findPerson(params.name || '');
      if (!p) return '❌ طرف پیدا نشد: ' + params.name;
      const balances = await getBalances();
      const bal = balances[p.id || p.local_id] || 0;
      const label = bal > 0 ? '🟢 طلبکار' : bal < 0 ? '🔴 بدهکار' : '⚪ تسویه';
      return \`👤 \${p.name}: \${Math.abs(bal).toLocaleString('en-US')} افغانی — \${label}\`;
    }

    if (action === 'getBox') {
      try {
        const { getBoxes } = await import('./lib.fx');
        const boxes = await getBoxes().catch(() => []) || [];
        if (!boxes.length) return '📦 صندوقی ثبت نشده';
        const lines = boxes.slice(0, 10).map((b: any) =>
          \`• \${b.name || b.code || 'صندوق'}: \${Number(b.opening || 0).toLocaleString('en-US')} \${b.currency || 'AFN'}\`
        );
        return '📦 صندوق‌ها:\\n' + lines.join('\\n');
      } catch (e) { return '📦 صندوقی نیست'; }
    }

    if (action === 'getProfit') {
      try {
        const { getSalesGrouped } = await import('./lib');
        const sales = await getSalesGrouped().catch(() => []) || [];
        const today = Date.now() - 24 * 60 * 60 * 1000;
        const todaySales = (sales || []).filter((s: any) => {
          const ts = new Date(s.date || s.created_at || 0).getTime();
          return ts >= today;
        });
        const total = todaySales.reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
        return \`📊 امروز: \${todaySales.length} معامله — \${total.toLocaleString('en-US')} افغانی\`;
      } catch (e) { return '📊 آمار امروز در دسترس نیست'; }
    }

    if (action === 'getRate') {
      try {
        const raw = await AsyncStorage.getItem(RATES_KEY);
        const rates = raw ? JSON.parse(raw) : [];
        const curMap: any = { 'دالر': 'USD', 'دلار': 'USD', 'یورو': 'EUR', 'افغانی': 'AFN', 'تومان': 'IRT', 'ریال': 'IRR', 'روپیه': 'PKR' };
        const cur = params.currency || 'دالر';
        const code = curMap[cur] || cur;
        const found = (rates || []).find((r: any) => r.currency === code || r.currency === cur);
        if (!found) return \`💱 نرخ \${cur} ثبت نشده\`;
        return \`💱 نرخ \${cur}: \${found.rate}\`;
      } catch (e) { return '💱 نرخ در دسترس نیست'; }
    }

    return 'پاسخ آماده نیست';
  } catch (e: any) {
    return '❌ خطا: ' + (e?.message || 'نامشخص');
  }
}

// ═══════════════════════════════════════════
// Action — نوشتن داده
// ═══════════════════════════════════════════
export async function executeAction(action: string, params: any): Promise<string> {
  try {
    if (action === 'pay') {
      const p = await findPerson(params.to || '');
      if (!p) return '❌ طرف پیدا نشد: ' + params.to;

      try {
        const { createPurchase } = await import('./lib');
        await createPurchase({
          supplier_name: p.name,
          supplier_code: p.id || p.local_id,
          amount: params.amount,
          note: 'دستیار: ' + params.amount + ' ' + (params.currency || ''),
          local_id: 'asst_p_' + Date.now(),
        });
      } catch (e) { console.log('pay createPurchase err:', e); }

      await updateBalance(p.id || p.local_id, -Number(params.amount));

      return \`✅ پرداخت \${params.amount} \${params.currency || 'افغانی'} به \${p.name} ثبت شد\`;
    }

    if (action === 'receive') {
      const p = await findPerson(params.from || '');
      if (!p) return '❌ طرف پیدا نشد: ' + params.from;

      try {
        const { createSale } = await import('./lib');
        await createSale({
          customer_name: p.name,
          customer_code: p.id || p.local_id,
          amount: params.amount,
          note: 'دستیار: ' + params.amount + ' ' + (params.currency || ''),
          local_id: 'asst_r_' + Date.now(),
        });
      } catch (e) { console.log('receive createSale err:', e); }

      await updateBalance(p.id || p.local_id, Number(params.amount));

      return \`✅ دریافت \${params.amount} \${params.currency || 'افغانی'} از \${p.name} ثبت شد\`;
    }

    if (action === 'transfer') {
      const from = await findPerson(params.from || '');
      const to = await findPerson(params.to || '');
      if (!from) return '❌ فرستنده پیدا نشد: ' + params.from;
      if (!to) return '❌ گیرنده پیدا نشد: ' + params.to;

      try {
        const { createSale, createPurchase } = await import('./lib');
        await createSale({
          customer_name: from.name,
          customer_code: from.id || from.local_id,
          amount: params.amount,
          note: 'انتقال از ' + from.name + ' به ' + to.name,
          local_id: 'asst_ts_' + Date.now(),
        });
        await createPurchase({
          supplier_name: to.name,
          supplier_code: to.id || to.local_id,
          amount: params.amount,
          note: 'انتقال از ' + from.name + ' به ' + to.name,
          local_id: 'asst_tp_' + Date.now(),
        });
      } catch (e) { console.log('transfer err:', e); }

      await updateBalance(from.id || from.local_id, Number(params.amount));
      await updateBalance(to.id || to.local_id, -Number(params.amount));

      return \`✅ انتقال \${params.amount} \${params.currency || 'افغانی'} از \${from.name} به \${to.name} ثبت شد\`;
    }

    return 'عمل پشتیبانی نمی‌شود';
  } catch (e: any) {
    return '❌ خطا: ' + (e?.message || 'نامشخص');
  }
}

// ═══════════════════════════════════════════
// یادگیری — از تاریخچه، پرکاربردترین‌ها رو استخراج کن
// ═══════════════════════════════════════════
const LEARNED_CMDS_KEY = '@mizan_asst_learned_cmds_v1';

export interface LearnedCmd {
  text: string;
  count: number;
  lastUsed: number;
  intent: string;
}

export async function getLearnedCommands(): Promise<LearnedCmd[]> {
  try {
    const raw = await AsyncStorage.getItem(LEARNED_CMDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function recordCommand(text: string, intentKind: string): Promise<void> {
  try {
    const list = await getLearnedCommands();
    const key = text.trim().toLowerCase();
    const idx = list.findIndex(x => x.text.toLowerCase() === key);
    if (idx >= 0) {
      list[idx].count++;
      list[idx].lastUsed = Date.now();
    } else {
      list.push({ text: text.trim(), count: 1, lastUsed: Date.now(), intent: intentKind });
    }
    // مرتب‌سازی بر اساس تعداد
    list.sort((a, b) => b.count - a.count);
    await AsyncStorage.setItem(LEARNED_CMDS_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {}
}

export async function clearLearnedCommands(): Promise<void> {
  await AsyncStorage.removeItem(LEARNED_CMDS_KEY);
}
`;

fs.writeFileSync('lib.assistant.executor.ts', execCode, 'utf8');
console.log('✅ lib.assistant.executor.ts ساخته شد (' + execCode.split('\n').length + ' خط)');

// ═══════════════════════════════════════════════════════
// ۲. AssistantScreen.tsx — آپدیت برای استفاده از executor
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ AssistantScreen.tsx ═══');
let screen = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const screenOrig = screen;
const screenCRLF = screen.includes('\r\n');
if (screenCRLF) screen = screen.replace(/\r\n/g, '\n');

// اضافه import
if (!screen.includes('assistant.executor')) {
  screen = screen.replace(
    "} from './lib.assistant';",
    "} from './lib.assistant';\nimport { executeQuery, executeAction, getLearnedCommands, recordCommand, LearnedCmd } from './lib.assistant.executor';"
  );
  console.log('✅ import executor اضافه شد');
}

// state جدید برای یادگیری
if (!screen.includes('learnedCmds')) {
  screen = screen.replace(
    "const [lastResult, setLastResult] = useState<any>(null);",
    "const [lastResult, setLastResult] = useState<any>(null);\n  const [learnedCmds, setLearnedCmds] = useState<LearnedCmd[]>([]);\n  const [pendingAction, setPendingAction] = useState<any>(null);"
  );
  console.log('✅ state جدید اضافه شد');
}

// load یادگیری
if (!screen.includes('setLearnedCmds(await getLearnedCommands())')) {
  screen = screen.replace(
    "try { setHistory((await getAssistantHistory()) || []); } catch {}",
    "try { setHistory((await getAssistantHistory()) || []); } catch {}\n    try { setLearnedCmds(await getLearnedCommands()); } catch {}"
  );
  console.log('✅ یادگیری به load اضافه شد');
}

// تعویض runCommand برای استفاده از executor
const oldRunStart = "      // اجرای Intent\n      let finalReply = intent.reply;";
const newRunStart = "      // اجرای Intent\n      let finalReply = intent.reply;";
// (جایگزینی کامل بخش switch در گام بعد)

// پیدا کردن بلوک اجرای intent
const oldBlockRegex = /\/\/ اجرای Intent[\s\S]*?(?=\n      \/\/ ذخیره در تاریخچه)/;
const newBlock = `// اجرای Intent
      let finalReply = intent.reply;

      if (intent.kind === 'navigate') {
        // ناوبری — از دستیار خارج شو و برو
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab);
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
      } else if (intent.kind === 'query') {
        // Query واقعی — داده رو بخون
        try {
          const answer = await executeQuery(intent.action, intent.params || {});
          finalReply = answer;
        } catch (e: any) {
          finalReply = '❌ خطا در خواندن: ' + (e?.message || '');
        }
      } else if (intent.kind === 'action') {
        // Action — نیاز به تأیید
        setPendingAction(intent);
        finalReply = '⚠️ آماده ' + intent.reply + '\\n\\nبگو «تأیید» تا انجام بشه یا «لغو»';
      } else if (intent.kind === 'create') {
        // باز کردن فرم
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            if (intent.action === 'newInvoice') {
              goTab('sales');
            } else if (intent.action === 'newHawala') {
              goTab('exchange');
              setTimeout(() => goSub('hawalas'), 150);
            } else if (intent.action === 'newCustomer') {
              goTab('exchange');
              setTimeout(() => goSub('customers'), 150);
            }
          }, 100);
        }, 600);
        finalReply = '📝 باز کردن ' + intent.reply;
      } else if (intent.kind === 'unknown') {
        // شاید کاربر «تأیید» یا «لغو» گفته
        const t = command.toLowerCase().trim();
        if (/تایید|تأیید|ok|بله|آره|انجام بده/.test(t) && pendingAction) {
          try {
            const res = await executeAction(pendingAction.action, pendingAction.params || {});
            finalReply = res;
            setPendingAction(null);
          } catch (e: any) {
            finalReply = '❌ خطا: ' + (e?.message || '');
          }
        } else if (/لغو|نه|cancel|کنسل/.test(t) && pendingAction) {
          finalReply = '❌ لغو شد';
          setPendingAction(null);
        }
      }

      // ثبت در یادگیری
      try { await recordCommand(command, intent.kind); } catch {}
      setLearnedCmds(await getLearnedCommands());

`;
if (oldBlockRegex.test(screen)) {
  screen = screen.replace(oldBlockRegex, newBlock);
  console.log('✅ runCommand آپدیت شد (executor واقعی)');
} else {
  console.log('⚠️ بلوک اجرای intent پیدا نشد');
}

// اضافه نمایش یادگرفته‌ها در پایین + action pending
if (!screen.includes('📍 یادگرفته‌ها')) {
  const histSection = `        {/* تاریخچه */}`;
  const learnedSection = `        {/* یادگرفته‌ها (پرکاربردترین) */}
        {learnedCmds.length > 0 && (
          <>
            <Text style={[s.sectionT, { marginTop: 16 }]}>📍 یادگرفته‌ها (پرکاربردترین):</Text>
            <View style={s.samplesGrid}>
              {learnedCmds.slice(0, 6).map((lc, i) => (
                <TouchableOpacity key={i} style={[s.sampleBtn, { borderColor: '#f59e0b' }]} onPress={() => useSample(lc.text)}>
                  <Text style={s.sampleIcon}>⭐</Text>
                  <Text style={s.sampleTxt}>{lc.text} ({lc.count})</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* pending action */}
        {pendingAction && (
          <View style={[s.card, { borderColor: '#f59e0b', marginTop: 12 }]}>
            <Text style={s.cardTitle}>⚠️ در انتظار تأیید</Text>
            <Text style={s.rowTxt}>⚡ عمل: <Text style={s.bold}>{pendingAction.reply}</Text></Text>
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => runCommand('تأیید')}>
                <Text style={s.btnTxt}>✅ تأیید</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626' }]} onPress={() => runCommand('لغو')}>
                <Text style={s.btnTxt}>❌ لغو</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

${histSection}`;
  if (screen.includes(histSection)) {
    screen = screen.replace(histSection, learnedSection);
    console.log('✅ بخش یادگرفته‌ها + تأیید اضافه شد');
  }
}

if (screenCRLF) screen = screen.replace(/\n/g, '\r\n');
if (screen !== screenOrig) {
  fs.writeFileSync('AssistantScreen.tsx', screen, 'utf8');
  console.log('💾 AssistantScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
console.log((fs.existsSync('lib.assistant.executor.ts') ? '✅' : '❌') + ' lib.assistant.executor.ts');
const fin = fs.readFileSync('AssistantScreen.tsx', 'utf8');
console.log('import executor: ' + (fin.includes('assistant.executor') ? '✅' : '❌'));
console.log('executeQuery: ' + (fin.includes('executeQuery') ? '✅' : '❌'));
console.log('executeAction: ' + (fin.includes('executeAction') ? '✅' : '❌'));
console.log('learnedCmds: ' + (fin.includes('learnedCmds') ? '✅' : '❌'));
console.log('pendingAction: ' + (fin.includes('pendingAction') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');