const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ امن قبل از هر تغییر
// ═══════════════════════════════════════════
const backupDir = 'backup-before-tabfix';
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

const filesToBackup = ['App.tsx', 'LiveMarketScreen.tsx', 'PublicMarketScreen.tsx'];
let backupCount = 0;
for (const f of filesToBackup) {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(backupDir, f));
    backupCount++;
  }
}
console.log('🛡 بکاپ گرفته شد: ' + backupCount + ' فایل در پوشه ' + backupDir);
console.log('   (اگر خراب شد: copy ' + backupDir + '\\App.tsx App.tsx)');
console.log('');

// ═══════════════════════════════════════════
// ۱. پیدا کردن نوار تب‌ها در App.tsx
// ═══════════════════════════════════════════
console.log('═══ App.tsx ═══');
let s = fs.readFileSync('App.tsx', 'utf8');
const sOrig = s;

// اگر قبلاً wrap شده، اول unwrap کن
const alreadyWrapped = s.includes("{tab !== 'exchange' && tab !== 'publicMarket'");
if (alreadyWrapped) {
  console.log('ℹ️ شرط از قبل بود — دوباره اعمال نمی‌کنم');
  process.exit(0);
}

// دنبال ScrollView که تب‌ها رو رندر می‌کنه بگرد
// الگو: <ScrollView ... horizontal ...> و داخلش tabs.map
// یا یک View که داخلش tabs.map هست

const tabsMapIdx = s.indexOf('tabs.map');
if (tabsMapIdx < 0) {
  console.log('❌ tabs.map پیدا نشد!');
  console.log('   فایل دست نخورده موند.');
  process.exit(1);
}
console.log('✅ tabs.map در موقعیت ' + tabsMapIdx + ' پیدا شد');

// از tabs.map به عقب برو تا ScrollView یا View که wrap کرده رو پیدا کنی
// الگو: <ScrollView یا <View
const before = s.substring(0, tabsMapIdx);

// نزدیک‌ترین ScrollView یا View به tabs.map
const lastScrollView = before.lastIndexOf('<ScrollView');
const lastView = before.lastIndexOf('<View');
const lastAnimatedView = before.lastIndexOf('<Animated.View');

let wrapStart = -1;
let wrapTag = '';

// کدوم نزدیک‌تره؟
const candidates = [
  { idx: lastScrollView, tag: '<ScrollView' },
  { idx: lastView, tag: '<View' },
  { idx: lastAnimatedView, tag: '<Animated.View' },
].filter(c => c.idx > 0).sort((a, b) => b.idx - a.idx);

if (!candidates.length) {
  console.log('❌ هیچ ScrollView/View قبل از tabs.map پیدا نشد!');
  process.exit(1);
}

wrapStart = candidates[0].idx;
wrapTag = candidates[0].tag;
console.log('✅ ' + wrapTag + ' در موقعیت ' + wrapStart + ' پیدا شد (برای wrap)');

// از wrapStart به عقب برو تا نقطه‌ای که JSX expression شروع می‌شه
// اینجا ما باید ببینیم آیا قبلاً داخل { } هست یا نه
// ساده‌ترین: از wrapStart تا tabs.map رو نگاه کن، ببین چطور بسته می‌شه
// روش عملی: کل بلوک ScrollView رو با شمارش تگ پیدا کن
const tagName = wrapTag.replace('<', '').replace('.', '\\.');
const openRe = new RegExp('<' + tagName + '\\b', 'g');
const closeRe = new RegExp('</' + tagName + '>', 'g');

// از wrapStart شروع کن، اولین </ScrollView> که به wrapStart می‌خوره رو پیدا کن
// شمارش تگ‌های باز و بسته
let depth = 0;
let pos = wrapStart;
let endPos = -1;

while (pos < s.length) {
  const nextOpen = s.indexOf('<' + wrapTag.substring(1), pos + 1);
  const nextClose = s.indexOf('</' + wrapTag.substring(1) + '>', pos + 1);

  if (nextClose < 0) break;

  if (nextOpen > 0 && nextOpen < nextClose) {
    // چک کن self-closing نیست
    const afterOpen = s.substring(nextOpen, nextOpen + 200);
    if (afterOpen.match(/\/>/)) {
      // self-closing، ignore
      pos = nextOpen + 1;
    } else {
      depth++;
      pos = nextOpen + 1;
    }
  } else {
    if (depth === 0) {
      endPos = nextClose + ('</' + wrapTag.substring(1) + '>').length;
      break;
    }
    depth--;
    pos = nextClose + 1;
  }
}

if (endPos < 0) {
  console.log('❌ بسته شدن ' + wrapTag + ' پیدا نشد!');
  process.exit(1);
}

console.log('✅ بسته شدن در موقعیت ' + endPos + ' پیدا شد');
console.log('   طول بلوک: ' + (endPos - wrapStart) + ' کاراکتر');

// ═══════════════════════════════════════════
// ۲. wrap کردن بلوک با شرط
// ═══════════════════════════════════════════
const block = s.substring(wrapStart, endPos);
const wrapped = "{tab !== 'exchange' && tab !== 'publicMarket' && (\n        " + block + "\n      )}";

s = s.substring(0, wrapStart) + wrapped + s.substring(endPos);

if (s !== sOrig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('');
  console.log('💾 App.tsx ذخیره شد');
  console.log('✅ نوار تب‌ها wrap شد با شرط: tab !== exchange && tab !== publicMarket');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 اگر خراب شد، بازگردانی:');
console.log('   copy backup-before-tabfix\\App.tsx App.tsx');