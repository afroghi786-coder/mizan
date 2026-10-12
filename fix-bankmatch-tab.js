const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-tabadd-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('App.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// چک کن tab توی array هست یا نه
if (/k:\s*['"]bankMatch['"]/.test(s)) {
  console.log('ℹ️ tab از قبل توی array هست');
  process.exit(0);
}

// پیدا کردن خط publicMarket (توی array tabs)
const lines = s.split('\n');
let targetLine = -1;
let indentation = '';
let foundLine = '';

for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (L.includes("k: 'publicMarket'") && L.includes('l:')) {
    targetLine = i;
    foundLine = L;
    // استخراج indentation
    const m = L.match(/^(\s*)/);
    indentation = m ? m[1] : '    ';
    break;
  }
}

if (targetLine < 0) {
  console.log('❌ خط publicMarket توی array پیدا نشد');
  console.log('   بذار خطوطی که publicMarket دارن رو نشون بدم:');
  lines.forEach((l, i) => {
    if (l.includes('publicMarket')) console.log('   خط ' + (i+1) + ': ' + l.trim().substring(0, 120));
  });
  process.exit(1);
}

console.log('✅ خط پیدا شد: خط ' + (targetLine + 1));
console.log('   متن: ' + foundLine.trim().substring(0, 100));
console.log('   indentation: "' + indentation + '"');

// چک کن خط با کاما یا } تمام می‌شه
const trimmedLine = lines[targetLine].trim();
const lastChar = trimmedLine.slice(-1);
let comma = ',';
if (lastChar === ',') comma = '';

// اضافه خط جدید
const newLine = indentation + "{ k: 'bankMatch', l: '🏦 بانک' }" + comma;
// اگه خط اصلی کاما نداشت، اضافه‌ش کن
if (comma === ',' && !lines[targetLine].trimEnd().endsWith(',')) {
  lines[targetLine] = lines[targetLine].trimEnd() + ',';
}
lines.splice(targetLine + 1, 0, newLine);
console.log('✅ tab اضافه شد بعد از خط ' + (targetLine + 1));

s = lines.join('\n');

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

// چک نهایی
const check = fs.readFileSync('App.tsx', 'utf8');
console.log('');
console.log('═══ چک نهایی ═══');
console.log("tab توی array: " + (check.includes("k: 'bankMatch'") ? '✅' : '❌'));
console.log("render: " + (check.includes('<SmsMatchScreen') ? '✅' : '❌'));

// چاپ ۵ خط اطراف
console.log('');
console.log('─── ۵ خط اطراف tab جدید ───');
const finalLines = check.split('\n');
const idx = finalLines.findIndex(l => l.includes("k: 'bankMatch'"));
if (idx > 0) {
  for (let i = Math.max(0, idx - 3); i < Math.min(finalLines.length, idx + 4); i++) {
    console.log((i + 1) + ': ' + finalLines[i]);
  }
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\App.tsx" App.tsx');