// fix-ads.js — فیکس ثبت + نمایش آگهی‌ها
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. حذف فیلتر subcategory از load
// ═══════════════════════════════════════════
const loadPatterns = [
  "const list = await fn({ category: sub, search, city: cityFilter, subcategory: subCat });",
  "const list = await fn({ category: sub, search, city: cityFilter, subcategory: '' });",
];

for (const p of loadPatterns) {
  if (s.includes(p)) {
    s = s.replace(p, "const list = await fn({ category: sub, search, city: cityFilter, subcategory: '' });");
    console.log('✅ فیلتر subcategory حذف شد');
    n++;
    break;
  }
}

// ═══════════════════════════════════════════
// ۲. حذف الزام subcategory در submit
// ═══════════════════════════════════════════
const submitChecks = [
  "if (!form.subcategory) return showToast?.('دسته الزامی', true);\n    ",
  "if (!form.subcategory) return showToast?.('دسته الزامی', true);",
];

for (const p of submitChecks) {
  if (s.includes(p)) {
    s = s.replace(p, '');
    console.log('✅ الزام subcategory در submit حذف شد');
    n++;
    break;
  }
}

// ═══════════════════════════════════════════
// ۳. در submit — subcategory رو خالی بفرست اگر نیست
// ═══════════════════════════════════════════
const oldPayload = "subcategory: form.subcategory,";
if (s.includes(oldPayload)) {
  s = s.replace(oldPayload, "subcategory: form.subcategory || 'other',");
  console.log('✅ subcategory پیش‌فرض other');
  n++;
}

// ═══════════════════════════════════════════
// ۴. در submit — validation ساده
// ═══════════════════════════════════════════
const oldCheck = `if (!form.title || form.title.trim().length < 3) return showToast?.('عنوان حداقل ۳ کاراکتر', true);
    if (!form.city) return showToast?.('شهر الزامی', true);`;

const newCheck = `if (!form.title || form.title.trim().length < 3) return showToast?.('عنوان حداقل ۳ کاراکتر', true);
    if (!form.city) return showToast?.('شهر الزامی', true);
    if (!form.subcategory) {
      // اگر subcategory نداره، از اولین زیردسته استفاده کن
      const firstCat = cats && cats[0] && cats[0].k;
      if (firstCat) form.subcategory = firstCat;
    }`;

if (s.includes(oldCheck)) {
  s = s.replace(oldCheck, newCheck);
  console.log('✅ submit بهبود یافت');
  n++;
}

// ═══════════════════════════════════════════
// ۵. بعد از submit — رفرش با تأخیر
// ═══════════════════════════════════════════
const oldAfter = `      setSubCat('');
      setCityFilter('');
      setSearch('');
      // کمی صبر بعد reload
      setTimeout(() => load(), 300);`;

const newAfter = `      setSubCat('');
      setCityFilter('');
      setSearch('');
      // کمی صبر بعد reload
      setTimeout(() => load(), 500);
      setTimeout(() => load(), 1500);`;

if (s.includes(oldAfter)) {
  s = s.replace(oldAfter, newAfter);
  console.log('✅ رفرش دوباره اضافه شد');
  n++;
}

if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ هیچ تغییری اعمال نشد');
  // دیباگ
  console.log('\n--- دیباگ: جستجوی الگوها ---');
  console.log('load pattern 1:', s.includes(loadPatterns[0]));
  console.log('load pattern 2:', s.includes(loadPatterns[1]));
  console.log('subcategory check:', s.includes('if (!form.subcategory)'));
}