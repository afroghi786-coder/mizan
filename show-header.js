const fs = require('fs');
const s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');

// پیدا کردن return اول
const idx = s.indexOf('return (');
if (idx < 0) {
  console.log('❌ return پیدا نشد');
  process.exit(1);
}

// نمایش ۵۰ خط اول return
const start = idx;
const end = s.indexOf('</View>', s.indexOf('{/* ═══', start));
console.log('═══ بخش هدر ═══');
console.log(s.substring(start, Math.min(start + 1500, s.length)));