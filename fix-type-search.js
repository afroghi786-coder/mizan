const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-typesearch-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('AssistantScreen.tsx', path.join(bdir, 'AssistantScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const orig = s;
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

// پیدا کردن بلاک runCommand — بخش searchQuery
const oldSearch = `      // جستجو
      setSearchLoading(true);
      const searchQuery = lowCmd
        .replace(/فاکتور|صندوق|مشتری|حواله|چک|را|بیار|بیاور|بگیر|نشون|نشان|بده|بزن|ویرایش|کن|برای|از|به|را/g, '')
        .replace(/[^\\u0600-\\u06FF\\w\\s\\d]/g, '')
        .trim();

      if (searchQuery && searchQuery.length >= 2) {
        const results = await deepSearch(searchQuery);`;

const newSearch = `      // 🎯 تشخیص نوع entity از کلمات کلیدی
      let typeHint: any[] | undefined;
      if (/صندوق/.test(lowCmd)) typeHint = ['box'];
      else if (/مشتری|طرف حساب|طرف\\s*حساب/.test(lowCmd)) typeHint = ['customer'];
      else if (/حواله/.test(lowCmd)) typeHint = ['hawala'];
      else if (/چک/.test(lowCmd)) typeHint = ['check'];
      else if (/فاکتور\\s*خرید|خرید/.test(lowCmd)) typeHint = ['purchase'];  // در حال حاضر purchase پشتیبانی نمی‌شود
      else if (/فاکتور|فاکتر/.test(lowCmd)) typeHint = ['invoice'];
      
      // جستجو
      setSearchLoading(true);
      const searchQuery = lowCmd
        .replace(/فاکتور|فاکتر|صندوق|مشتری|طرف\\s*حساب|حواله|چک|را|بیار|بیاور|بگیر|نشون|نشان|بده|بزن|ویرایش|کن|برای|از|به|را|رو|بیارش/g, '')
        .replace(/[^\\u0600-\\u06FF\\w\\s\\d]/g, '')
        .trim();

      if (searchQuery && searchQuery.length >= 2) {
        const results = await deepSearch(searchQuery, typeHint);`;

if (s.includes(oldSearch)) {
  s = s.replace(oldSearch, newSearch);
  console.log('✅ Type detection اضافه شد');
} else {
  console.log('⚠️ الگوی searchQuery پیدا نشد');
}

if (crlf) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('AssistantScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
}

console.log('');
console.log('═══ چک ═══');
const fin = fs.readFileSync('AssistantScreen.tsx', 'utf8');
console.log('typeHint: ' + (fin.includes('typeHint') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');