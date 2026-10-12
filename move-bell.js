const fs = require('fs');
let a = fs.readFileSync('App.tsx', 'utf8');
const orig = a;

// ۱. import ExchangeBell
if (!a.includes("import ExchangeBell")) {
  const lines = a.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') && lines[i].includes("from './")) {
      lastImport = i;
    }
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import ExchangeBell from './ExchangeBell';");
    a = lines.join('\n');
    console.log('✅ import ExchangeBell اضافه شد');
  }
}

// ۲. ExchangeBell رو در App.tsx قرار بده (بعد از تب‌ها)
const tabsEndMarker = '</ScrollView>\n      <View key={`tab-';
if (a.includes(tabsEndMarker)) {
  // چک کن قبلاً اضافه شده یا نه
  if (!a.includes('<ExchangeBell')) {
    // اضافه بعد از بسته شدن tab content
    const contentEndMarker = '</View>\n      </View>\n      <LanguageModal';
    if (a.includes(contentEndMarker)) {
      a = a.replace(
        contentEndMarker,
        '</View>\n      </View>\n      {tab === \'exchange\' && <ExchangeBell showToast={showToast} onBack={() => setTab(\'order\')} />}\n      <LanguageModal'
      );
      console.log('✅ ExchangeBell به App.tsx اضافه شد');
    } else {
      // روش دیگه — پیدا کردن آخرین </View> قبل از LanguageModal
      const langIdx = a.indexOf('<LanguageModal');
      if (langIdx > 0) {
        const beforeLang = a.substring(0, langIdx);
        const lastViewClose = beforeLang.lastIndexOf('</View>');
        const insertPos = lastViewClose + 7;
        a = a.substring(0, insertPos) + '\n      {tab === \'exchange\' && <ExchangeBell showToast={showToast} onBack={() => setTab(\'order\')} />}' + a.substring(insertPos);
        console.log('✅ ExchangeBell اضافه شد (روش ۲)');
      }
    }
  } else {
    console.log('ℹ️ ExchangeBell از قبل در App.tsx هست');
  }
}

// ۳. حذف ExchangeBell از ExchangeScreen (اگه هست)
let e = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const eOrig = e;
e = e.replace(/\n\s*\{\/\*\s*بازگشت[^}]*\}\}\n\s*<TouchableOpacity[\s\S]*?<\/TouchableOpacity>\n/g, '\n');
e = e.replace(/\n\s*<ExchangeBell[^/]*\/>\n/g, '\n');
if (e !== eOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', e, 'utf8');
  console.log('✅ ExchangeBell از ExchangeScreen حذف شد');
}

if (a !== orig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

console.log('\n✅ تمام');