const fs = require('fs');
const lines = fs.readFileSync('ExchangeScreen.tsx', 'utf8').split('\n');

// پیدا کردن خط تعریف تابع و اصلاح
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export default function ExchangeScreen')) {
    console.log('قبل: ' + lines[i]);
    // جایگزینی کامل خط
    lines[i] = "export default function ExchangeScreen({ showToast, onBack }: any) {";
    console.log('بعد: ' + lines[i]);
    found = true;
    break;
  }
}

if (!found) {
  console.log('❌ خط تعریف تابع پیدا نشد — چاپ ۱۵ خط اول:');
  for (let i = 0; i < 15; i++) console.log((i+1) + ': ' + lines[i]);
  process.exit(1);
}

fs.writeFileSync('ExchangeScreen.tsx', lines.join('\n'), 'utf8');
console.log('💾 ذخیره شد');