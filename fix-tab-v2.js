const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-tabv2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('App.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// چک کن tab از قبل هست
if (/key:\s*['"]bankMatch['"]/.test(s)) {
  console.log('ℹ️ tab از قبل هست');
  process.exit(0);
}

const lines = s.split('\n');
let targetLine = -1;
let indentation = '';

// پیدا کردن خط publicMarket (با key: و label:)
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (L.includes("key: 'publicMarket'") && L.includes('label:')) {
    targetLine = i;
    const m = L.match(/^(\s*)/);
    indentation = m ? m[1] : '    ';
    console.log('✅ خط ' + (i + 1) + ' پیدا شد');
    console.log('   ' + L.trim());
    break;
  }
}

if (targetLine < 0) {
  console.log('❌ پیدا نشد');
  process.exit(1);
}

// خط جدید با همون فرمت
const newLine = indentation + "{ key: 'bankMatch', icon: '🏦', label: 'بانک', color: '#f59e0b' },";
lines.splice(targetLine + 1, 0, newLine);
console.log('✅ tab جدید اضافه شد');
console.log('   ' + newLine.trim());

s = lines.join('\n');

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

// چک نهایی
const check = fs.readFileSync('App.tsx', 'utf8');
console.log('');
console.log('═══ چک ═══');
console.log("key: 'bankMatch': " + (check.includes("key: 'bankMatch'") ? '✅' : '❌'));
console.log("render: " + (check.includes('<SmsMatchScreen') ? '✅' : '❌'));

console.log('');
console.log('─── ۵ خط اطراف ───');
const finalLines = check.split('\n');
const idx = finalLines.findIndex(l => l.includes("key: 'bankMatch'"));
if (idx > 0) {
  for (let i = Math.max(0, idx - 2); i < Math.min(finalLines.length, idx + 4); i++) {
    console.log((i + 1) + ': ' + finalLines[i]);
  }
}

console.log('');
console.log('✅ تمام');