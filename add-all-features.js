const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-allfeatures-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['ManualEntryScreen.tsx', 'lib.manual.ts', 'App.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.manual.ts — الگوهای بیشتر + تنظیمات + Undo
// ═══════════════════════════════════════════════════════
let lm = fs.readFileSync('lib.manual.ts', 'utf8');
const lmOrig = lm;
const lmCRLF = lm.includes('\r\n');
if (lmCRLF) lm = lm.replace(/\r\n/g, '\n');

// اضافه الگوهای بیشتر به parseCommand
const morePatterns = `
    // «X تسویه» یا «تسویه X»
    {
      name: 'settle',
      regex: /(?:تسویه\\s+([\\u0600-\\u06FF\\w]+)|([\\u0600-\\u06FF\\w]+)\\s+تسویه)/i,
      handler: (m) => {
        const name = m[1] || m[2];
        const res = findPerson(name, [...ctx.customers, ...ctx.suppliers, ...ctx.partners]);
        const curBal = 0; // مانده محاسبه می‌شود در UI
        return {
          ok: !!res.person,
          confidence: res.person ? 75 : 20,
          amount: 0,
          type: 'adjust',
          person: res.person,
          adjustment: -curBal,
          candidates: res.candidates,
          raw,
          warnings: res.person ? ['مانده صفر می‌شود'] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X ۵۰۰۰ دادن» یا «X ۵۰۰۰ داد»
    {
      name: 'gave',
      regex: /([\\u0600-\\u06FF\\w]+)\\s+(?:مبلغ\\s+)?(\\d+(?:\\.\\d+)?)\\s+(?:دادن|داد|پرداخت)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.suppliers, ...ctx.partners, ...ctx.customers]);
        let conf = 40;
        if (res.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: amt,
          type: 'purchase',
          to: res.person,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X ۵۰۰۰ گرفت»
    {
      name: 'received',
      regex: /([\\u0600-\\u06FF\\w]+)\\s+(?:مبلغ\\s+)?(\\d+(?:\\.\\d+)?)\\s+(?:گرفت|دریافت|دریافت کرد)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.customers, ...ctx.partners, ...ctx.suppliers]);
        let conf = 40;
        if (res.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: amt,
          type: 'sale',
          from: res.person,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «۵۰۰۰ برای احمد از محمود»
    {
      name: 'for_from',
      regex: /(\\d+(?:\\.\\d+)?)\\s+برای\\s+([\\u0600-\\u06FF\\w]+)\\s+از\\s+([\\u0600-\\u06FF\\w]+)/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const toName = m[2];
        const fromName = m[3];
        const toRes = findPerson(toName, [...ctx.suppliers, ...ctx.partners]);
        const fromRes = findPerson(fromName, [...ctx.customers, ...ctx.partners]);
        let conf = 30;
        if (fromRes.person) conf += 25;
        if (toRes.person) conf += 25;
        if (amt > 0) conf += 20;
        return {
          ok: !!(fromRes.person && toRes.person),
          confidence: conf,
          amount: amt,
          type: 'transfer',
          from: fromRes.person,
          to: toRes.person,
          candidates: [...fromRes.candidates, ...toRes.candidates],
          raw,
          warnings: [
            ...(fromRes.person ? [] : ['فرستنده پیدا نشد']),
            ...(toRes.person ? [] : ['گیرنده پیدا نشد']),
          ],
        };
      },
    },
    // صرافی: «۱۰۰۰ دالر به افغانی ۷۰»
    {
      name: 'exchange',
      regex: /(\\d+(?:\\.\\d+)?)\\s+(دالر|دلار|یورو|تومان|افغانی|ریال|روپیه|USD|EUR|AFN|IRR|PKR)\\s+به\\s+(افغانی|تومان|ریال|دالر|دلار|یورو|AFN|IRR|USD|EUR)\\s+(\\d+(?:\\.\\d+)?)?/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const fromCur = m[2];
        const toCur = m[3];
        const rate = m[4] ? parseFloat(m[4]) : null;
        return {
          ok: true,
          confidence: 85,
          amount: amt,
          currency: fromCur,
          type: 'exchange',
          note: fromCur + ' → ' + toCur + (rate ? ' @ ' + rate : ''),
          raw,
          warnings: rate ? [] : ['نرخ مشخص نشد'],
        };
      },
    },
`;

// درج قبل از بسته شدن آرایه patterns
const insertPoint = `    // «به X [مبلغ]» یا «به X -[مبلغ]»`;
if (lm.includes(insertPoint)) {
  lm = lm.replace(insertPoint, morePatterns + '\n' + insertPoint);
  console.log('✅ ۵ الگوی جدید اضافه شد');
} else {
  console.log('⚠️ نقطه درج پیدا نشد');
}

// اضافه Settings + Undo به lib.manual.ts
const settingsCode = `

// ─── تنظیمات پارسر
const SETTINGS_KEY = '@mizan_manual_settings_v1';

export interface ManualSettings {
  autoConfirm: boolean;        // تأیید خودکار
  autoConfirmThreshold: number; // حداقل اطمینان (0-100)
  showConfidence: boolean;
  enableSounds: boolean;
  defaultCurrency: string;
}

export const DEFAULT_SETTINGS: ManualSettings = {
  autoConfirm: false,
  autoConfirmThreshold: 95,
  showConfidence: true,
  enableSounds: true,
  defaultCurrency: 'AFN',
};

export async function getManualSettings(): Promise<ManualSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export async function saveManualSettings(s: ManualSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── Undo/Redo
const UNDO_KEY = '@mizan_manual_undo_v1';

export interface UndoEntry {
  id: string;
  action: any;
  timestamp: number;
  undone: boolean;
}

export async function pushUndo(action: any): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_KEY);
    const list: UndoEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: 'u_' + Date.now(),
      action,
      timestamp: Date.now(),
      undone: false,
    });
    await AsyncStorage.setItem(UNDO_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export async function getLastUndo(): Promise<UndoEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_KEY);
    const list: UndoEntry[] = raw ? JSON.parse(raw) : [];
    return list.find(x => !x.undone) || null;
  } catch { return null; }
}

export async function markUndone(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(UNDO_KEY);
    const list: UndoEntry[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) list[idx].undone = true;
    await AsyncStorage.setItem(UNDO_KEY, JSON.stringify(list));
  } catch {}
}

// ─── Shortcuts
const SHORTCUTS_KEY = '@mizan_manual_shortcuts_v1';

export interface Shortcut {
  id: string;
  label: string;
  text: string;
  icon: string;
  usageCount: number;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'sc1', label: 'تسویه', text: 'تسویه ', icon: '✅', usageCount: 0 },
  { id: 'sc2', label: 'پرداخت به', text: 'به ', icon: '💸', usageCount: 0 },
  { id: 'sc3', label: 'دریافت از', text: 'از ', icon: '💰', usageCount: 0 },
  { id: 'sc4', label: 'انتقال', text: 'از  به ', icon: '🔄', usageCount: 0 },
];

export async function getShortcuts(): Promise<Shortcut[]> {
  try {
    const raw = await AsyncStorage.getItem(SHORTCUTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SHORTCUTS;
  } catch { return DEFAULT_SHORTCUTS; }
}

export async function saveShortcuts(list: Shortcut[]): Promise<void> {
  await AsyncStorage.setItem(SHORTCUTS_KEY, JSON.stringify(list));
}

export async function bumpShortcut(id: string): Promise<void> {
  const list = await getShortcuts();
  const s = list.find(x => x.id === id);
  if (s) s.usageCount = (s.usageCount || 0) + 1;
  await saveShortcuts(list);
}

// ─── Excel Export
export async function exportToExcel(rows: any[]): Promise<string> {
  const header = 'تاریخ,مبلغ,نوع,طرف,توضیحات\\n';
  const body = rows.map(r => {
    const d = new Date(r.timestamp || Date.now()).toLocaleString('fa-IR');
    const amt = r.parsed?.amount || 0;
    const type = r.parsed?.type || '—';
    const person = r.parsed?.from?.name || r.parsed?.to?.name || r.parsed?.person?.name || '—';
    const raw = (r.raw || '').replace(/,/g, '،');
    return \`"\${d}","\${amt}","\${type}","\${person}","\${raw}"\`;
  }).join('\\n');
  return '\\uFEFF' + header + body; // BOM برای Excel فارسی
}
`;

lm = lm + settingsCode;
console.log('✅ تنظیمات + Undo + Shortcuts + Excel اضافه شد');

if (lmCRLF) lm = lm.replace(/\n/g, '\r\n');
if (lm !== lmOrig) {
  fs.writeFileSync('lib.manual.ts', lm, 'utf8');
  console.log('💾 lib.manual.ts ذخیره شد (' + lm.split(/\r?\n/).length + ' خط)');
}

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('✅ فایل lib.manual.ts آپدیت شد');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('⚠️ مرحله بعد: ManualEntryScreen.tsx رو بازنویسی می‌کنم');
console.log('   ولی این فایل خیلی بزرگه — بذار اول ببینم lib.manual.ts سالمه');
console.log('');
console.log('بزن:');
console.log('  node add-all-features.js 2>&1 | findstr /C:"✅" /C:"⚠️" /C:"❌"');