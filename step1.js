const fs = require('fs');
let a = fs.readFileSync('App.tsx', 'utf8');
const orig = a;

// مخفی کردن تب‌ها در صرافی — مثل بازار
if (a.includes("tab !== 'publicMarket' && (") && !a.includes("tab !== 'exchange' && tab !== 'publicMarket'")) {
  a = a.replace(
    "tab !== 'publicMarket' && (",
    "tab !== 'exchange' && tab !== 'publicMarket' && ("
  );
  console.log('✅ تب‌ها در صرافی مخفی شد');
} else if (a.includes("tab !== 'exchange' && tab !== 'publicMarket'")) {
  console.log('ℹ️ قبلاً اعمال شده');
} else {
  console.log('⚠️ الگو پیدا نشد');
}

if (a !== orig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('💾 ذخیره شد');
}