const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-mapfix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('BoxesScreen.tsx', path.join(bdir, 'BoxesScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('BoxesScreen.tsx', 'utf8');
const orig = s;
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

// پیدا کردن همه boxes.map
const matches = [...s.matchAll(/boxes\.map\(/g)];
console.log('📍 تعداد boxes.map: ' + matches.length);

// چک کن filteredBoxes وجود داره
if (!s.includes('filteredBoxes')) {
  console.log('❌ filteredBoxes نیست — اول fix-box-nav-v3 رو بزن');
  process.exit(1);
}

// عوض کن همه boxes.map به filteredBoxes.map
const before = (s.match(/boxes\.map\(/g) || []).length;
s = s.replace(/\bboxes\.map\(/g, 'filteredBoxes.map(');
const after = (s.match(/filteredBoxes\.map\(/g) || []).length;
console.log('✅ ' + (before - (s.match(/boxes\.map\(/g) || []).length) + ' مورد عوض شد');
console.log('📊 filteredBoxes.map الان: ' + after);

if (crlf) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('BoxesScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const fin = fs.readFileSync('BoxesScreen.tsx', 'utf8');
console.log('filteredBoxes.map: ' + (fin.includes('filteredBoxes.map') ? '✅' : '❌'));
console.log('boxes.map (قدیمی): ' + ((fin.match(/[^d]boxes\.map\(/g) || []).length) + ' مورد باقی‌مونده');

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\BoxesScreen.tsx" BoxesScreen.tsx');