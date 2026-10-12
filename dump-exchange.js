const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('📊 تحلیل کامل تب صرافی (ExchangeScreen.tsx)');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// ═══════════════════════════════════════════
// ۱. اطلاعات کلی فایل
// ═══════════════════════════════════════════
const s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const lines = s.split('\n');
console.log('📄 فایل: ExchangeScreen.tsx');
console.log('📏 تعداد خط: ' + lines.length);
console.log('📏 حجم: ' + (s.length / 1024).toFixed(1) + ' KB');
console.log('');

// ═══════════════════════════════════════════
// ۲. Import ها (کامپوننت‌های خارجی)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('📦 Import ها (کامپوننت‌ها و ماژول‌ها)');
console.log('═══════════════════════════════════════════════════════════');
const imports = s.match(/import[\s\S]*?from\s+['"][^'"]+['"]/g) || [];
imports.forEach((imp, i) => {
  const clean = imp.replace(/\s+/g, ' ').substring(0, 150);
  console.log('  ' + (i + 1) + '. ' + clean);
});
console.log('');

// ═══════════════════════════════════════════
// ۳. State ها (useState)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('🎛️ State ها (useState)');
console.log('═══════════════════════════════════════════════════════════');
const states = s.match(/const\s+\[[^\]]+\]\s*=\s*useState[^;]*;/g) || [];
states.forEach((st, i) => {
  const clean = st.replace(/\s+/g, ' ').substring(0, 120);
  console.log('  ' + (i + 1) + '. ' + clean);
});
console.log('');

// ═══════════════════════════════════════════
// ۴. توابع (function ها)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('⚙️ توابع (const/function)');
console.log('═══════════════════════════════════════════════════════════');
const funcs = s.match(/(const|function)\s+\w+\s*[=\(]/g) || [];
const uniqueFuncs = [...new Set(funcs)];
uniqueFuncs.forEach((f, i) => {
  console.log('  ' + (i + 1) + '. ' + f.replace(/\s+/g, ' '));
});
console.log('');

// ═══════════════════════════════════════════
// ۵. تب‌های اصلی (جستجو برای tab names)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('📑 تب‌ها / زیرتب‌ها');
console.log('═══════════════════════════════════════════════════════════');

// الگوهای احتمالی
const patterns = [
  { name: 'tab', regex: /tab\s*===\s*['"]([^'"]+)['"]/g },
  { name: 'subTab', regex: /subTab\s*===\s*['"]([^'"]+)['"]/g },
  { name: 'activeTab', regex: /activeTab\s*===\s*['"]([^'"]+)['"]/g },
  { name: 'currentTab', regex: /currentTab\s*===\s*['"]([^'"]+)['"]/g },
  { name: 'setTab', regex: /setTab\s*\(\s*['"]([^'"]+)['"]/g },
  { name: 'setSubTab', regex: /setSubTab\s*\(\s*['"]([^'"]+)['"]/g },
];

const foundTabs = {};
patterns.forEach(p => {
  let m;
  const found = new Set();
  while ((m = p.regex.exec(s)) !== null) found.add(m[1]);
  if (found.size) {
    foundTabs[p.name] = [...found];
  }
});

if (Object.keys(foundTabs).length === 0) {
  console.log('  ⚠️ هیچ تب پیدا نشد با الگوهای معمول');
} else {
  Object.entries(foundTabs).forEach(([name, tabs]) => {
    console.log('  📌 ' + name + ':');
    tabs.forEach(t => console.log('     - "' + t + '"'));
  });
}
console.log('');

// ═══════════════════════════════════════════
// ۶. جستجوی کلمات فارسی رایج
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('🇮🇷 کلمات کلیدی فارسی');
console.log('═══════════════════════════════════════════════════════════');
const persianWords = [
  'حواله', 'حواله‌جات', 'حواله جات', 'بازار', 'بازار زنده', 'بازار عمومی',
  'صرافی', 'صندوق', 'تنظیمات', 'پیام', 'نوتیفیکیشن', 'اعلان',
  'داشبورد', 'خانه', 'خرید', 'فروش', 'ارز', 'گروه', 'گروه‌ها',
];

const persianFound = {};
persianWords.forEach(w => {
  const count = (s.match(new RegExp(w, 'g')) || []).length;
  if (count > 0) persianFound[w] = count;
});

// مرتب‌سازی بر اساس تعداد
Object.entries(persianFound)
  .sort((a, b) => b[1] - a[1])
  .forEach(([w, c]) => {
    console.log('  ' + w + ': ' + c + ' بار');
  });
console.log('');

// ═══════════════════════════════════════════
// ۷. کامپوننت‌های داخلی (function components)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('🧩 کامپوننت‌های داخلی');
console.log('═══════════════════════════════════════════════════════════');
const components = s.match(/(function|const)\s+[A-Z]\w+\s*[=\(]/g) || [];
const uniqueComponents = [...new Set(components)];
uniqueComponents.forEach((c, i) => {
  console.log('  ' + (i + 1) + '. ' + c.replace(/\s+/g, ' '));
});
console.log('');

// ═══════════════════════════════════════════
// ۸. خطوط کلیدی (حاوی حواله، تب، etc)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 خطوط کلیدی (شماره خط + متن)');
console.log('═══════════════════════════════════════════════════════════');

const keywords = ['subTab', 'setSubTab', 'activeTab', 'حواله‌جات', 'حواله جات', 'tab ==='];
const seenLines = new Set();
let keyCount = 0;

lines.forEach((line, i) => {
  for (const kw of keywords) {
    if (line.includes(kw) && !seenLines.has(i)) {
      seenLines.add(i);
      keyCount++;
      if (keyCount <= 50) {
        console.log('  خط ' + (i + 1) + ': ' + line.trim().substring(0, 100));
      }
    }
  }
});

if (keyCount > 50) {
  console.log('  ... و ' + (keyCount - 50) + ' خط دیگه');
}
console.log('');

// ═══════════════════════════════════════════
// ۹. فایل‌های مرتبط
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('📂 فایل‌های مرتبط در پروژه');
console.log('═══════════════════════════════════════════════════════════');
const relatedFiles = [
  'ExchangeScreen.tsx', 'LiveMarketScreen.tsx', 'PublicMarketScreen.tsx',
  'ExchangeBell.tsx', 'lib.network.ts', 'App.tsx'
];
relatedFiles.forEach(f => {
  if (fs.existsSync(f)) {
    const size = fs.statSync(f).size;
    const content = fs.readFileSync(f, 'utf8');
    const lc = content.split('\n').length;
    console.log('  ✅ ' + f + ' (' + lc + ' خط، ' + (size / 1024).toFixed(1) + ' KB)');
  } else {
    console.log('  ❌ ' + f + ' (وجود ندارد)');
  }
});
console.log('');

// ═══════════════════════════════════════════
// ۱۰. خروجی به فایل
// ═══════════════════════════════════════════
const report = {
  file: 'ExchangeScreen.tsx',
  totalLines: lines.length,
  imports: imports.map(i => i.replace(/\s+/g, ' ')),
  states: states.map(st => st.replace(/\s+/g, ' ')),
  functions: uniqueFuncs,
  tabs: foundTabs,
  persianWords: persianFound,
  components: uniqueComponents,
};

fs.writeFileSync('exchange-report.json', JSON.stringify(report, null, 2), 'utf8');
console.log('═══════════════════════════════════════════════════════════');
console.log('💾 گزارش کامل در فایل: exchange-report.json');
console.log('═══════════════════════════════════════════════════════════');