const fs = require('fs');
const s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');

// پیدا کردن همه "return ("ها
const allReturns = [];
let pos = 0;
while (true) {
  const idx = s.indexOf('return (', pos);
  if (idx < 0) break;
  allReturns.push(idx);
  pos = idx + 1;
}

console.log('تعداد return ( :', allReturns.length);
console.log();

// آخرین return ( اصلی‌ترین هست
const lastReturn = allReturns[allReturns.length - 1];
const lineNum = s.substring(0, lastReturn).split('\n').length;

console.log('═══ آخرین return ( در خط ' + lineNum + ') ═══');
console.log();

// نمایش ۲۰۰۰ کاراکتر بعد از return
console.log(s.substring(lastReturn, Math.min(lastReturn + 2000, s.length)));