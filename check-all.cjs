const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════');
console.log('🔍 چک کامل فایل‌ها + import ها');
console.log('═══════════════════════════════════════════\n');

const issues = [];

// ═══════════════════════════════════════════
// ۱. چک فایل‌های اصلی
// ═══════════════════════════════════════════
console.log('═══ فایل‌های اصلی ═══');
const coreFiles = [
  'App.tsx',
  'lib.voice.ts',
  'lib.datefield.tsx',
  'lib.local.nlu.ts',
  'lib.local.exec.ts',
  'lib.learning.ts',
  'lib.learning.intents.ts',
  'LocalBotScreen.tsx',
  'LearningScreen.tsx',
  'lib.offline.ts',
  'lib.boxes.ts',
  'lib.fx.ts',
  'lib.fx.cust.ts',
  'lib.ts',
];

coreFiles.forEach(f => {
  if (fs.existsSync(f)) {
    const size = fs.statSync(f).size;
    console.log('✅ ' + f + ' (' + (size/1024).toFixed(1) + ' KB)');
  } else {
    console.log('❌ ' + f + ' نیست!');
    issues.push('missing:' + f);
  }
});

// ═══════════════════════════════════════════
// ۲. چک lib.offline — توابع موردنیاز DateField
// ═══════════════════════════════════════════
console.log('\n═══ lib.offline.ts — توابع موردنیاز ═══');
if (fs.existsSync('lib.offline.ts')) {
  const offline = fs.readFileSync('lib.offline.ts', 'utf8');
  ['parseDateAny', 'toStorageDateFull', 'getCalType'].forEach(fn => {
    const exists = offline.includes('export function ' + fn) ||
                   offline.includes('export const ' + fn) ||
                   offline.includes('export async function ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('offline:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۳. چک lib.voice — توابع
// ═══════════════════════════════════════════
console.log('\n═══ lib.voice.ts — توابع ═══');
if (fs.existsSync('lib.voice.ts')) {
  const voice = fs.readFileSync('lib.voice.ts', 'utf8');
  ['isSTTAvailable', 'startSTT', 'stopSTT', 'speakText', 'stopSpeak', 'isWeb'].forEach(fn => {
    const exists = voice.includes('export function ' + fn) ||
                   voice.includes('export const ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('voice:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۴. چک lib.local.nlu — توابع
// ═══════════════════════════════════════════
console.log('\n═══ lib.local.nlu.ts — توابع ═══');
if (fs.existsSync('lib.local.nlu.ts')) {
  const nlu = fs.readFileSync('lib.local.nlu.ts', 'utf8');
  ['parseMulti', 'parseCommand', 'norm', 'nameScore', 'extractAmount', 'detectCurrency'].forEach(fn => {
    const exists = nlu.includes('export function ' + fn) || nlu.includes('export const ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('nlu:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۵. چک lib.local.exec — توابع
// ═══════════════════════════════════════════
console.log('\n═══ lib.local.exec.ts — توابع ═══');
if (fs.existsSync('lib.local.exec.ts')) {
  const exec = fs.readFileSync('lib.local.exec.ts', 'utf8');
  ['execute', 'setLastEntity', 'getLastEntity', 'clearLastEntity'].forEach(fn => {
    const exists = exec.includes('export function ' + fn) || exec.includes('export const ' + fn) || exec.includes('export async function ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('exec:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۶. چک lib.learning — توابع
// ═══════════════════════════════════════════
console.log('\n═══ lib.learning.ts — توابع ═══');
if (fs.existsSync('lib.learning.ts')) {
  const lrn = fs.readFileSync('lib.learning.ts', 'utf8');
  ['getLessons', 'addLesson', 'matchLesson', 'getAliases', 'applyAliases', 'getFails', 'logFail', 'getStats'].forEach(fn => {
    const exists = lrn.includes('export function ' + fn) || lrn.includes('export const ' + fn) || lrn.includes('export async function ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('learning:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۷. چک import های LocalBotScreen
// ═══════════════════════════════════════════
console.log('\n═══ LocalBotScreen.tsx — import ها ═══');
if (fs.existsSync('LocalBotScreen.tsx')) {
  const screen = fs.readFileSync('LocalBotScreen.tsx', 'utf8');
  const imports = screen.match(/import[\s\S]*?from\s+['"][^'"]+['"]/g) || [];
  imports.forEach(imp => {
    const clean = imp.replace(/\s+/g, ' ').substring(0, 120);
    console.log('  ' + clean);
  });
  
  // چک SafeAreaView
  if (screen.includes('SafeAreaView') && !screen.includes("from 'react-native'") && !screen.includes("from 'react-native-safe-area-context'")) {
    console.log('  ❌ SafeAreaView import نشده');
    issues.push('LocalBotScreen:SafeAreaView');
  }
}

// ═══════════════════════════════════════════
// ۸. چک lib.boxes — getAllBalances
// ═══════════════════════════════════════════
console.log('\n═══ lib.boxes.ts — توابع موردنیاز ═══');
if (fs.existsSync('lib.boxes.ts')) {
  const bx = fs.readFileSync('lib.boxes.ts', 'utf8');
  ['getBoxes', 'getAllBalances', 'addBoxTransaction', 'getBoxTransactions'].forEach(fn => {
    const exists = bx.includes('export function ' + fn) || bx.includes('export const ' + fn) || bx.includes('export async function ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('boxes:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۹. چک lib.fx.cust — getAllCust
// ═══════════════════════════════════════════
console.log('\n═══ lib.fx.cust.ts — توابع ═══');
if (fs.existsSync('lib.fx.cust.ts')) {
  const c = fs.readFileSync('lib.fx.cust.ts', 'utf8');
  ['getAllCust', 'saveCust'].forEach(fn => {
    const exists = c.includes('export function ' + fn) || c.includes('export const ' + fn) || c.includes('export async function ' + fn);
    console.log((exists ? '✅' : '❌') + ' ' + fn);
    if (!exists) issues.push('cust:' + fn);
  });
}

// ═══════════════════════════════════════════
// ۱۰. نتیجه
// ═══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
if (issues.length === 0) {
  console.log('✅ همه چیز اوکی!');
  console.log('');
  console.log('الان:');
  console.log('  npx expo start --clear');
  console.log('');
  console.log('اگه بازم خطا داد:');
  console.log('  F12 → Console → خطا رو کامل بفرست');
} else {
  console.log('❌ مشکلات پیدا شد (' + issues.length + '):');
  issues.forEach(i => console.log('  - ' + i));
  console.log('');
  console.log('خروجی اینا رو بفرست تا fix کنم');
}
console.log('═══════════════════════════════════════════');