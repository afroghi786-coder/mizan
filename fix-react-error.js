const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-reactfix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('BoxesScreen.tsx', path.join(bdir, 'BoxesScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('BoxesScreen.tsx', 'utf8');
const orig = s;
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. حذف deepFilter که اشتباه افتاده
// ═══════════════════════════════════════════
const badLine = `  const [deepFilter, setDeepFilter] = React.useState<string>('');\n`;
if (s.includes(badLine)) {
  s = s.replace(badLine, '');
  console.log('🗑 deepFilter از جای اشتباه حذف شد');
}

// حذف خطوط خالی اضافی
s = s.replace(/\n\n\n+/g, '\n\n');

// ═══════════════════════════════════════════
// ۲. اضافه import React (اگه نیست)
// ═══════════════════════════════════════════
if (!/import\s+React\b/.test(s)) {
  // پیدا کردن اولین import
  const lines = s.split('\n');
  let firstImport = -1;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].trim().startsWith('import ')) {
      firstImport = i;
      break;
    }
  }
  if (firstImport >= 0) {
    lines.splice(firstImport, 0, "import React from 'react';");
    s = lines.join('\n');
    console.log('✅ import React اضافه شد');
  }
} else {
  console.log('ℹ️ React از قبل import هست');
}

// ═══════════════════════════════════════════
// ۳. اضافه deepFilter + filteredBoxes در جای درست
// (داخل تابع BoxesScreen، بعد از useState های دیگه)
// ═══════════════════════════════════════════
if (!s.includes('deepFilter')) {
  // پیدا کردن `export default function BoxesScreen`
  const funcIdx = s.indexOf('export default function BoxesScreen');
  if (funcIdx < 0) {
    console.log('❌ BoxesScreen پیدا نشد');
    process.exit(1);
  }
  
  // پیدا کردن اولین { بعد از function
  const openBrace = s.indexOf('{', funcIdx);
  if (openBrace < 0) {
    console.log('❌ { پیدا نشد');
    process.exit(1);
  }
  
  // اضافه بعد از {
  const insertCode = `\n  const [deepFilter, setDeepFilter] = React.useState('');\n  const filteredBoxes = React.useMemo(() => {\n    if (!deepFilter || !deepFilter.trim()) return boxes;\n    const q = String(deepFilter).toLowerCase().trim();\n    return (boxes || []).filter((b) =>\n      String(b.name || '').toLowerCase().includes(q) ||\n      String(b.code || '').toLowerCase().includes(q) ||\n      String(b.owner_code || '').toLowerCase().includes(q) ||\n      String(b.owner_name || '').toLowerCase().includes(q)\n    );\n  }, [boxes, deepFilter]);`;
  
  s = s.substring(0, openBrace + 1) + insertCode + s.substring(openBrace + 1);
  console.log('✅ deepFilter + filteredBoxes اضافه شد بعد از function');
} else {
  console.log('ℹ️ deepFilter از قبل هست');
}

// ═══════════════════════════════════════════
// ۴. حذف useEffect قبلی برای sync filterName (اگه بود)
// ═══════════════════════════════════════════
const oldEffectRegex = /\n\n\s*React\.useEffect\(\(\)\s*=>\s*\{[\s\S]*?setDeepFilter\(String\(filterName\)\.trim\(\)\)[\s\S]*?\}, \[filterName\]\);/;
if (oldEffectRegex.test(s)) {
  s = s.replace(oldEffectRegex, '');
  console.log('🗑 useEffect قدیمی حذف شد');
}

if (crlf) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('BoxesScreen.tsx', s, 'utf8');
  console.log('💾 BoxesScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۵. چک نهایی — ۱۰ خط اول
// ═══════════════════════════════════════════
console.log('');
console.log('═══ ۱۵ خط اول ═══');
const lines = s.split(/\r?\n/);
for (let i = 0; i < Math.min(15, lines.length); i++) {
  console.log((i + 1) + ': ' + lines[i]);
}

console.log('');
console.log('═══ چک نهایی ═══');
const fin = fs.readFileSync('BoxesScreen.tsx', 'utf8');
console.log('import React: ' + (/import\s+React\b/.test(fin) ? '✅' : '❌'));
console.log('deepFilter داخل function: ' + (fin.includes('const [deepFilter, setDeepFilter] = React.useState') ? '✅' : '❌'));
console.log('filteredBoxes: ' + (fin.includes('filteredBoxes = React.useMemo') ? '✅' : '❌'));
console.log('filteredBoxes.map: ' + (fin.includes('filteredBoxes.map') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\BoxesScreen.tsx" BoxesScreen.tsx');