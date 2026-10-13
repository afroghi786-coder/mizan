const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-fixnewline-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('App.tsx', 'utf8');
const orig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// پیدا کردن و fix کردن \n خام توی خط render
// الگو: یه خط که توش \\n داره (یعنی backslash + n)
const badLineRegex = /(\{tab === 'publicMarket' && <PublicMarketScreen showToast=\{showToast\} \/>\})\\n(\s*)(\{tab === 'manualEntry' && <ManualEntryScreen showToast=\{showToast\} \/>\})/;

if (badLineRegex.test(s)) {
  s = s.replace(badLineRegex, '$1\n      $3');
  console.log('✅ \\n خام fix شد (regex 1)');
} else {
  // الگوی دیگه: شاید \\n توی وسط خط باشه
  const lines = s.split('\n');
  let fixed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('\\n') && lines[i].includes('manualEntry')) {
      // جای \\n با newline واقعی + indent
      const newLine = lines[i].replace(/\\n\s*/g, '\n      ');
      lines[i] = newLine;
      fixed = true;
      console.log('✅ خط ' + (i+1) + ' fix شد');
    }
  }
  if (fixed) s = lines.join('\n');
}

// بازم چک کن
if (s.includes('\\n') && s.includes('manualEntry')) {
  // روش تهاجمی: همه \\n رو به newline تبدیل کن (فقط توی خط manualEntry)
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('manualEntry') || lines[i].includes('PublicMarketScreen showToast')) {
      lines[i] = lines[i].replace(/\\n/g, '\n      ');
    }
  }
  s = lines.join('\n');
  console.log('✅ \\n خام تهاجمی fix شد');
}

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const final = fs.readFileSync('App.tsx', 'utf8');
const finalLines = final.split(/\r?\n/);

console.log('─── خطوط manualEntry ───');
finalLines.forEach((l, i) => {
  if (l.includes('manualEntry') || l.includes('ManualEntryScreen')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 140));
  }
});

console.log('');
console.log('─── خطوط PublicMarketScreen showToast ───');
finalLines.forEach((l, i) => {
  if (l.includes('PublicMarketScreen showToast')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 140));
  }
});

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');