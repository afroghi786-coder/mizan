const fs = require('fs');
const path = require('path');

console.log('🔧 Fix Require Cycle...\n');

const bdir = 'backup-before-cycle-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });

// فایل‌های دخیل در حلقه
const files = ['App.tsx', 'ExchangeScreen.tsx', 'BoxesScreen.tsx'];
files.forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});

// پیدا کردن وابستگی‌های چرخشی
// این بخش ساده است اما برای شناسایی وابستگی‌های مستقیم کافی است
const appContent = fs.readFileSync('App.tsx', 'utf8');
const exchangeContent = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const boxesContent = fs.readFileSync('BoxesScreen.tsx', 'utf8');

// بررسی وابستگی‌های مستقیم
const appImportsExchange = appContent.includes("from './ExchangeScreen'");
const exchangeImportsApp = exchangeContent.includes("from './App'");
const exchangeImportsBoxes = exchangeContent.includes("from './BoxesScreen'");
const boxesImportsApp = boxesContent.includes("from './App'");

console.log('📊 وابستگی‌های شناسایی شده:');
console.log('  App -> ExchangeScreen: ' + appImportsExchange);
console.log('  ExchangeScreen -> App: ' + exchangeImportsApp);
console.log('  ExchangeScreen -> BoxesScreen: ' + exchangeImportsBoxes);
console.log('  BoxesScreen -> App: ' + boxesImportsApp);

// راه‌حل: شکستن حلقه با حذف وابستگی BoxesScreen به App
if (boxesImportsApp) {
  let newBoxesContent = boxesContent.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\/App['"];?\n?/g, '');
  fs.writeFileSync('BoxesScreen.tsx', newBoxesContent, 'utf8');
  console.log('✅ وابستگی BoxesScreen به App حذف شد.');
} else {
  console.log('ℹ️ وابستگی BoxesScreen به App وجود ندارد یا قبلاً حذف شده است.');
}

// راه‌حل جایگزین: اگر ExchangeScreen به App وابسته است، آن را حذف کن
if (exchangeImportsApp) {
  let newExchangeContent = exchangeContent.replace(/import\s*\{[^}]*\}\s*from\s*['"]\.\/App['"];?\n?/g, '');
  fs.writeFileSync('ExchangeScreen.tsx', newExchangeContent, 'utf8');
  console.log('✅ وابستگی ExchangeScreen به App حذف شد.');
} else {
  console.log('ℹ️ وابستگی ExchangeScreen به App وجود ندارد یا قبلاً حذف شده است.');
}

console.log('\n✅ حلقه‌ی وابستگی (در صورت وجود) تا حد امکان شکسته شد.');
console.log('🛡 بکاپ در پوشه: ' + bdir);