const fs = require('fs');
let a = fs.readFileSync('App.tsx', 'utf8');
const orig = a;
let n = 0;

// ═══════════════════════════════════════════
// ۱. حذف تب exchange تکراری
// ═══════════════════════════════════════════
const dupRe = /\},\{ key: 'exchange',[^}]+\}/;
if (dupRe.test(a)) {
  a = a.replace(dupRe, '},');
  console.log('✅ تب exchange تکراری حذف شد');
  n++;
} else {
  // روش ۲: پیدا کردن خط دوم exchange
  const lines = a.split('\n');
  let count = 0;
  let removed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("key: 'exchange'")) {
      count++;
      if (count === 2) {
        // حذف بخش تکراری
        const oldLine = lines[i];
        // پیدا کردن `},` بعدی
        const joinIdx = lines[i].indexOf('{ key: \'exchange\'', lines[i].indexOf('}'));
        if (joinIdx > 0) {
          lines[i] = lines[i].substring(0, joinIdx);
          a = lines.join('\n');
          console.log('✅ تب تکراری حذف شد (روش ۲)');
          removed = true;
          n++;
          break;
        }
      }
    }
  }
  if (!removed) console.log('ℹ️ تب تکراری نیست یا قبلاً حذف شده');
}

// ═══════════════════════════════════════════
// ۲. wrap تب‌ها — مخفی در صرافی + بازار
// ═══════════════════════════════════════════
if (a.includes("tab !== 'publicMarket' && (") && !a.includes("tab !== 'exchange'")) {
  a = a.replace(
    "tab !== 'publicMarket' && (",
    "tab !== 'exchange' && tab !== 'publicMarket' && ("
  );
  console.log('✅ تب‌ها در صرافی مخفی شد');
  n++;
} else if (a.includes("tab !== 'exchange'")) {
  console.log('ℹ️ wrap از قبل هست');
} else {
  console.log('⚠️ wrap پیدا نشد');
}

// ═══════════════════════════════════════════
// ۳. اضافه ExchangeBell به MainApp (نه App)
// ═══════════════════════════════════════════
if (!a.includes('<ExchangeBell showToast={showToast} onBack')) {
  // پیدا کردن LanguageModal داخل MainApp (visible={showLang})
  const langIdx = a.indexOf('visible={showLang}');
  if (langIdx > 0) {
    // پیدا کردن `<LanguageModal` قبلش
    const modalIdx = a.lastIndexOf('<LanguageModal', langIdx);
    if (modalIdx > 0) {
      // پیدا کردن ابتدای خط
      const lineStart = a.lastIndexOf('\n', modalIdx) + 1;
      const indent = a.substring(lineStart, modalIdx);
      
      // اضافه ExchangeBell
      const bellCode = indent + "{tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n";
      
      a = a.substring(0, lineStart) + bellCode + a.substring(lineStart);
      console.log('✅ ExchangeBell به MainApp اضافه شد');
      n++;
    } else {
      console.log('❌ LanguageModal پیدا نشد');
    }
  } else {
    console.log('❌ visible={showLang} پیدا نشد');
  }
} else {
  console.log('ℹ️ ExchangeBell از قبل هست');
}

if (a !== orig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('\n💾 App.tsx ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ تغییری اعمال نشد');
}

// ═══════════════════════════════════════════
// ۴. بررسی duplicate
// ═══════════════════════════════════════════
const checkMatches = [...a.matchAll(/key: 'exchange'/g)];
console.log('\n📊 تعداد تب exchange:', checkMatches.length);

const bellMatches = [...a.matchAll(/<ExchangeBell/g)];
console.log('📊 تعداد render ExchangeBell:', bellMatches.length);