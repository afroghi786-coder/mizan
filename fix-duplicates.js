const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf8');
const orig = app;
let n = 0;

// ═══════════════════════════════════════════
// ۱. حذف تب exchange تکراری (چسبیده به هم)
// ═══════════════════════════════════════════
const dupTabRe = /(\{ key: 'exchange', icon: '💱', label: t\('صرافی'\), color: '#065f46' \},)\{ key: 'exchange',[^}]+\}/;
if (dupTabRe.test(app)) {
  app = app.replace(dupTabRe, '$1');
  console.log('✅ تب exchange تکراری حذف شد');
  n++;
} else {
  console.log('⚠️ الگوی تب چسبیده پیدا نشد — روش جایگزین');
  const tabRe = /^(\s*)\{ key: 'exchange',[^\n]*\},?\s*$/gm;
  const matches = [...app.matchAll(tabRe)];
  console.log('   تعداد تب exchange:', matches.length);
  if (matches.length > 1) {
    // دومی رو حذف کن
    const second = matches[1];
    const endOfLine = app.indexOf('\n', second.index + second[0].length - 1);
    app = app.substring(0, second.index) + app.substring(endOfLine + 1);
    console.log('✅ تب exchange تکراری حذف شد (روش ۲)');
    n++;
  }
}

// ═══════════════════════════════════════════
// ۲. حذف render exchange تکراری
// ═══════════════════════════════════════════
const renderRe = /\{tab === 'exchange' && <ExchangeScreen[^}]+\}\}/g;
const renderMatches = [...app.matchAll(renderRe)];
console.log('\nتعداد render exchange:', renderMatches.length);

if (renderMatches.length > 1) {
  // دومی رو حذف کن
  const second = renderMatches[1];
  app = app.substring(0, second.index) + app.substring(second.index + second[0].length);
  console.log('✅ render exchange تکراری حذف شد');
  n++;
}

// ═══════════════════════════════════════════
// ۳. wrap تب‌ها — مخفی کردن در صرافی هم
// ═══════════════════════════════════════════
if (app.includes("tab !== 'publicMarket' && (") && !app.includes("tab !== 'exchange'")) {
  app = app.replace(
    "tab !== 'publicMarket' && (",
    "tab !== 'exchange' && tab !== 'publicMarket' && ("
  );
  console.log('✅ تب‌ها در صرافی هم مخفی شد');
  n++;
} else if (app.includes("tab !== 'exchange'")) {
  console.log('ℹ️ تب‌ها قبلاً در صرافی مخفی بود');
} else {
  console.log('⚠️ الگوی wrap پیدا نشد');
}

// ═══════════════════════════════════════════
// ۴. ذخیره
// ═══════════════════════════════════════════
if (app !== orig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ تغییری اعمال نشد');
}