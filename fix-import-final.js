const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-importfinal-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. حذف خط import خراب
// ═══════════════════════════════════════════
let removed = 0;
while (s.includes("import { emitHawalaUpdate } from './lib.events';\n")) {
  s = s.replace("import { emitHawalaUpdate } from './lib.events';\n", '');
  removed++;
}
console.log('🗑 ' + removed + ' خط خراب حذف شد');

// ═══════════════════════════════════════════
// ۲. پیدا کردن آخرین import چندخطی (با } from)
// ═══════════════════════════════════════════
// فقط ۱۰۰ خط اول رو نگاه کن
const first100Lines = s.split('\n').slice(0, 100).join('\n');
const matches = [...first100Lines.matchAll(/\}\s+from\s+['"][^'"]+['"];/g)];

if (matches.length === 0) {
  console.log('❌ هیچ import چندخطی پیدا نشد');
  process.exit(1);
}

// آخرین تطابق در ۱۰۰ خط اول
const lastMatch = matches[matches.length - 1];
const insertAt = lastMatch.index + lastMatch[0].length;
console.log('✅ آخرین import چندخطی پیدا شد در موقعیت ' + insertAt);
console.log('   متن: ' + lastMatch[0].substring(0, 80));
console.log('');

// ═══════════════════════════════════════════
// ۳. اضافه import درست
// ═══════════════════════════════════════════
const importLine = "\nimport { emitHawalaUpdate } from './lib.events';";
s = s.substring(0, insertAt) + importLine + s.substring(insertAt);
console.log('✅ import درست بعد از آخرین import چندخطی اضافه شد');

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۴. نمایش تأییدیه — ۲۰ خط اول
// ═══════════════════════════════════════════
console.log('');
console.log('═══ چک نهایی — ۲۰ خط اول ═══');
const finalLines = fs.readFileSync('LiveMarketScreen.tsx', 'utf8').split('\n');
for (let i = 0; i < Math.min(20, finalLines.length); i++) {
  console.log((i + 1) + ': ' + finalLines[i]);
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');