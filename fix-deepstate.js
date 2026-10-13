const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-deepstate-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('BoxesScreen.tsx', path.join(bdir, 'BoxesScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('BoxesScreen.tsx', 'utf8');
const orig = s;
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

// چک کن state declaration هست یا نه
if (s.includes('const [deepFilter, setDeepFilter]')) {
  console.log('ℹ️ deepFilter state از قبل هست');
} else {
  console.log('⚠️ deepFilter state نیست — اضافه می‌کنم');
  
  // پیدا کردن تابع BoxesScreen
  const funcIdx = s.indexOf('export default function BoxesScreen');
  if (funcIdx < 0) {
    console.log('❌ BoxesScreen پیدا نشد');
    process.exit(1);
  }
  
  // پیدا کردن اولین { بعد از function signature
  let openBrace = -1;
  let depth = 0;
  for (let i = funcIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (s[i] === '{' && depth === 0) {
      openBrace = i;
      break;
    }
  }
  
  if (openBrace < 0) {
    // روش دیگه: اولین { بعد از اولین ) بعد از function
    const parenClose = s.indexOf(')', funcIdx);
    if (parenClose > 0) {
      openBrace = s.indexOf('{', parenClose);
    }
  }
  
  if (openBrace < 0) {
    console.log('❌ { پیدا نشد');
    process.exit(1);
  }
  
  console.log('✅ { در ' + openBrace);
  
  // اضافه state بعد از {
  const stateCode = `\n  const [deepFilter, setDeepFilter] = React.useState('');`;
  s = s.substring(0, openBrace + 1) + stateCode + s.substring(openBrace + 1);
  console.log('✅ deepFilter state اضافه شد');
}

if (crlf) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('BoxesScreen.tsx', s, 'utf8');
  console.log('💾 BoxesScreen.tsx ذخیره شد');
}

// چک نهایی
console.log('');
console.log('═══ چک ═══');
const fin = fs.readFileSync('BoxesScreen.tsx', 'utf8');
console.log('state declaration: ' + (fin.includes('const [deepFilter, setDeepFilter]') ? '✅' : '❌'));

// نمایش خطوط اطراف deepFilter
const lines = fin.split(/\r?\n/);
console.log('');
console.log('─── خطوط اطراف deepFilter ───');
lines.forEach((l, i) => {
  if (l.includes('deepFilter') || l.includes('filteredBoxes') || l.includes('export default function BoxesScreen')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 100));
  }
});

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');