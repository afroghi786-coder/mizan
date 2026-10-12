const fs = require('fs');

// ═══════════════════════════════════════════
// بخش ۱: تشخیص App.tsx
// ═══════════════════════════════════════════
console.log('═══ App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');

// پیدا کردن همه تب‌های exchange
const exchangeMatches = [...app.matchAll(/key:\s*'exchange'/g)];
console.log('تعداد تب exchange:', exchangeMatches.length);
exchangeMatches.forEach((m, i) => {
  const line = app.substring(0, m.index).split('\n').length;
  console.log(`  [${i+1}] خط ${line}`);
});

// پیدا کردن همه render های exchange
const renderMatches = [...app.matchAll(/tab === 'exchange'/g)];
console.log('تعداد render exchange:', renderMatches.length);
renderMatches.forEach((m, i) => {
  const line = app.substring(0, m.index).split('\n').length;
  console.log(`  [${i+1}] خط ${line}`);
});

// چاپ محدوده‌ی tabs
const tabsIdx = app.indexOf('const tabs = [');
if (tabsIdx > 0) {
  const tabsEnd = app.indexOf('];', tabsIdx);
  console.log('\n─── محدوده tabs ───');
  console.log(app.substring(tabsIdx, tabsEnd + 2));
}

// چک کن publicMarket رو wrap کرده
console.log('\n─── چک wrap tabs ───');
console.log('publicMarket wrap هست:', app.includes("tab !== 'publicMarket' && ("));

// ═══════════════════════════════════════════
// بخش ۲: تشخیص ExchangeBell
// ═══════════════════════════════════════════
console.log('\n═══ ExchangeBell.tsx ═══');
const bell = fs.readFileSync('ExchangeBell.tsx', 'utf8');
console.log('حجم:', bell.length);
console.log('position fixed:', bell.includes("position: 'fixed'"));

// چک کن getActions منطق درست داره
const hasDirectHawala = bell.includes("nt.type === 'direct_hawala'");
console.log("direct_hawala در getActions:", hasDirectHawala);