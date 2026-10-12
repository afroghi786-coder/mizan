const fs = require('fs');
let a = fs.readFileSync('App.tsx', 'utf8');
const orig = a;
let n = 0;

// ═══════════════════════════════════════════
// ۱. حذف تب exchange تکراری (چسبیده)
// ═══════════════════════════════════════════
const dupRe = /\},\s*\{\s*key:\s*'exchange'[^}]+\}/;
if (dupRe.test(a)) {
  a = a.replace(dupRe, '},');
  console.log('✅ تب تکراری حذف شد');
  n++;
} else {
  // روش دوم: خط به خط
  const lines = a.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/key:\s*'exchange'/g);
    if (m) count += m.length;
  }
  if (count > 1) {
    for (let i = 0; i < lines.length; i++) {
      const idx1 = lines[i].indexOf("{ key: 'exchange'");
      const idx2 = lines[i].indexOf("{ key: 'exchange'", idx1 + 1);
      if (idx2 > 0) {
        lines[i] = lines[i].substring(0, idx2);
        a = lines.join('\n');
        console.log('✅ تب تکراری حذف شد (روش خط)');
        n++;
        break;
      }
    }
  } else {
    console.log('ℹ️ تب تکراری نیست');
  }
}

// ═══════════════════════════════════════════
// ۲. پاس onBack به ExchangeScreen
// ═══════════════════════════════════════════
const oldRender = "{tab === 'exchange' && <ExchangeScreen showToast={showToast} />}";
const newRender = "{tab === 'exchange' && <ExchangeScreen showToast={showToast} />}";
if (a.includes(oldRender)) {
  // ExchangeScreen بدون onBack - همینه که می‌خوایم
  console.log('ℹ️ ExchangeScreen بدون onBack (خوبه)');
} else {
  // اگه onBack داره، حذفش کن
  a = a.replace(/<ExchangeScreen[^/]*onBack[^/]*\/>/g, '<ExchangeScreen showToast={showToast} />');
  console.log('✅ onBack از ExchangeScreen حذف شد');
  n++;
}

// ═══════════════════════════════════════════
// ۳. اضافه ExchangeBell به App.tsx (خارج از ScrollView)
// ═══════════════════════════════════════════
// حذف قبلی‌ها
a = a.replace(/\{tab === 'exchange' && <ExchangeBell[^}]*\/>\}\n/g, '');
a = a.replace(/<ExchangeBell[^>]*\/>\n/g, '');

// اضافه بعد از بسته شدن tab content View، داخل MainApp
const anchor = '</View>\n      <LanguageModal';
const bellCode = "</View>\n      {tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n      <LanguageModal";

if (a.includes(anchor)) {
  a = a.replace(anchor, bellCode);
  console.log('✅ ExchangeBell در App.tsx اضافه شد');
  n++;
} else {
  // روش جایگزین - دنبال visible={showLang}
  const idx = a.indexOf('visible={showLang}');
  if (idx > 0) {
    const modalIdx = a.lastIndexOf('<LanguageModal', idx);
    const lineStart = a.lastIndexOf('\n', modalIdx) + 1;
    const indent = a.substring(lineStart, modalIdx);
    const insert = indent + "{tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n";
    a = a.substring(0, lineStart) + insert + a.substring(lineStart);
    console.log('✅ ExchangeBell اضافه شد (روش ۲)');
    n++;
  } else {
    console.log('❌ LanguageModal پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ذخیره
// ═══════════════════════════════════════════
if (a !== orig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('💾 App.tsx ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('⚠️ تغییری اعمال نشد');
}

// چک نهایی
const exchangeCount = (a.match(/key:\s*'exchange'/g) || []).length;
const bellCount = (a.match(/<ExchangeBell/g) || []).length;
console.log('\n📊 تعداد تب exchange:', exchangeCount);
console.log('📊 تعداد ExchangeBell:', bellCount);