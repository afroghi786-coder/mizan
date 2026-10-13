const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-custfix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['lib.assistant.core.ts', 'AssistantScreen.tsx', 'lib.manual.ts'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. پیدا کردن اسم واقعی تابع در lib.fx.cust.ts
// ═══════════════════════════════════════════
const cust = fs.readFileSync('lib.fx.cust.ts', 'utf8');
console.log('═══ توابع lib.fx.cust.ts ═══');
const exports = [...cust.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m => m[1]);
exports.forEach(e => console.log('  ✅ ' + e));

if (!exports.length) {
  console.log('❌ هیچ export ای پیدا نشد');
  process.exit(1);
}

// ═══════════════════════════════════════════
// ۲. جایگزینی در lib.assistant.core.ts
// ═══════════════════════════════════════════
let core = fs.readFileSync('lib.assistant.core.ts', 'utf8');
const coreOrig = core;
const coreCRLF = core.includes('\r\n');
if (coreCRLF) core = core.replace(/\r\n/g, '\n');

// جایگزینی getFxCustomers با getAllCust
if (core.includes('getFxCustomers')) {
  // اگه اسم فرق داره
  const correctName = exports.find(e => /cust/i.test(e) || /customers/i.test(e)) || 'getAllCust';
  console.log('');
  console.log('🔧 جایگزین می‌کنم: getFxCustomers → ' + correctName);
  core = core.replace(/\bgetFxCustomers\b/g, correctName);
  fs.writeFileSync('lib.assistant.core.ts', core, 'utf8');
  console.log('✅ lib.assistant.core.ts fix شد');
}

// ═══════════════════════════════════════════
// ۳. جایگزینی در AssistantScreen.tsx
// ═══════════════════════════════════════════
let asst = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const asstOrig = asst;
const asstCRLF = asst.includes('\r\n');
if (asstCRLF) asst = asst.replace(/\r\n/g, '\n');

if (asst.includes('getFxCustomers')) {
  const correctName = exports.find(e => /cust/i.test(e) || /customers/i.test(e)) || 'getAllCust';
  asst = asst.replace(/\bgetFxCustomers\b/g, correctName);
  fs.writeFileSync('AssistantScreen.tsx', asst, 'utf8');
  console.log('✅ AssistantScreen.tsx fix شد');
}

// ═══════════════════════════════════════════
// ۴. جایگزینی در lib.manual.ts
// ═══════════════════════════════════════════
let man = fs.readFileSync('lib.manual.ts', 'utf8');
if (man.includes('getFxCustomers')) {
  const correctName = exports.find(e => /cust/i.test(e) || /customers/i.test(e)) || 'getAllCust';
  man = man.replace(/\bgetFxCustomers\b/g, correctName);
  fs.writeFileSync('lib.manual.ts', man, 'utf8');
  console.log('✅ lib.manual.ts fix شد');
}

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\lib.assistant.core.ts" lib.assistant.core.ts');