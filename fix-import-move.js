const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-importmove-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('ExchangeScreen.tsx', path.join(bdir, 'ExchangeScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. حذف import خراب (اون که وسط import چندخطی افتاده)
// ═══════════════════════════════════════════
const brokenLines = [
  "import { onHawalaUpdate } from './lib.events';\n",
  "import { onHawalaUpdate } from './lib.events';",
];

let removed = 0;
for (const line of brokenLines) {
  while (s.includes(line)) {
    s = s.replace(line, '');
    removed++;
  }
}
console.log('🗑 ' + removed + ' خط import خراب حذف شد');

// ═══════════════════════════════════════════
// ۲. پیدا کردن آخرین import کامل
// ═══════════════════════════════════════════
// منطق: از ابتدای فایل، آخرین خطی که با "import " شروع می‌شه و با ";" تموم می‌شه
const lines = s.split('\n');
let lastCompleteImportLine = -1;
for (let i = 0; i < Math.min(lines.length, 50); i++) {
  const L = lines[i].trim();
  if (L.startsWith('import ') && L.endsWith(';')) {
    lastCompleteImportLine = i;
  }
  // اگه به تابع رسیدیم، توقف
  if (L.startsWith('function ') || L.startsWith('export default function ') || L.startsWith('const ') && !L.startsWith('const DateField')) {
    break;
  }
}
console.log('📍 آخرین import کامل: خط ' + (lastCompleteImportLine + 1));
console.log('   ' + lines[lastCompleteImportLine]);

// ═══════════════════════════════════════════
// ۳. اضافه import درست
// ═══════════════════════════════════════════
lines.splice(lastCompleteImportLine + 1, 0, "import { onHawalaUpdate } from './lib.events';");
s = lines.join('\n');
console.log('✅ import درست در خط ' + (lastCompleteImportLine + 2) + ' اضافه شد');

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\ExchangeScreen.tsx" ExchangeScreen.tsx');