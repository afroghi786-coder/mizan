const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-quickfix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lmOrig = lm;
const wasCRLF = lm.includes('\r\n');
lm = lm.replace(/\r\n/g, '\n');

// حذف const _c که اضافه شده بود
lm = lm.replace(/\s*const _c = p\.code \? ` \[\$\{p\.code\}\]` : '';\n/g, '\n');
console.log('✅ const _c حذف شد (اگر بود)');

// جایگزینی ${_c} با کد inline
lm = lm.replace(/\$\{_c\}/g, "${p.code ? ' [' + p.code + ']' : ''}");
console.log('✅ ${_c} با کد inline جایگزین شد');

if (wasCRLF) lm = lm.replace(/\n/g, '\r\n');

if (lm !== lmOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', lm, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');