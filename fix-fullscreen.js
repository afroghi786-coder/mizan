// fix-fullscreen.js
const fs = require('fs');

// ═══════════════════════════════════════════
// بخش ۱: App.tsx — مخفی کردن تب‌ها در بازار
// ═══════════════════════════════════════════
console.log('═══ App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;

// پیدا کردن ScrollView تب‌ها
const idx = app.indexOf('contentContainerStyle={s.tabsCont}>');
if (idx > 0) {
  const startIdx = app.lastIndexOf('<ScrollView', idx);
  const closeIdx = app.indexOf('</ScrollView>', idx);
  
  if (startIdx > 0 && closeIdx > 0) {
    const closeEnd = closeIdx + '</ScrollView>'.length;
    const block = app.substring(startIdx, closeEnd);
    
    // چک کن قبلاً wrap نشده
    if (!app.substring(startIdx - 30, startIdx).includes("publicMarket")) {
      app = app.substring(0, startIdx) + 
            "{tab !== 'publicMarket' && (\n      " + block + ")}\n      " + 
            app.substring(closeEnd);
      console.log('✅ تب‌ها در بازار مخفی شد');
    } else {
      console.log('ℹ️ از قبل wrap شده');
    }
  } else {
    console.log('❌ محدوده تب پیدا نشد');
  }
} else {
  console.log('❌ tabsCont پیدا نشد');
}

// اضافه کردن onBack به PublicMarketScreen
if (!app.includes("onBack={() => setTab('exchange')}")) {
  const oldRender = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}";
  const newRender = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} onBack={() => setTab('exchange')} />}";
  if (app.includes(oldRender)) {
    app = app.replace(oldRender, newRender);
    console.log('✅ onBack اضافه شد');
  } else {
    console.log('⚠️ الگوی render پیدا نشد');
  }
}

if (app !== appOrig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد\n');
} else {
  console.log('⚠️ App.tsx تغییر نکرد\n');
}

// ═══════════════════════════════════════════
// بخش ۲: PublicMarketScreen.tsx — اضافه کردن onBack + هدر کامل
// ═══════════════════════════════════════════
console.log('═══ PublicMarketScreen.tsx ═══');
let pms = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const pmsOrig = pms;

// ۱. اضافه کردن onBack به props
if (!pms.includes('userEmail, onBack }')) {
  pms = pms.replace(
    'export default function PublicMarketScreen({ showToast, userEmail }: any) {',
    'export default function PublicMarketScreen({ showToast, userEmail, onBack }: any) {'
  );
  console.log('✅ onBack prop اضافه شد');
}

// ۲. اضافه کردن هدر بازار با دکمه بازگشت
const oldHeader = `      {/* ═══ هدر: عنوان + جستجو ═══ */}
      <View style={st.header}>
        <View style={st.searchWrap}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            style={st.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="جستجو در بازار..."
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>`;

const newHeader = `      {/* ═══ هدر: بازگشت + عنوان + جستجو ═══ */}
      <View style={st.header}>
        <View style={st.headerTop}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
              <Text style={st.backBtnTxt}>‹ بازگشت</Text>
            </TouchableOpacity>
          ) : <View style={st.backBtn} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <View style={st.backBtn} />
        </View>
        <View style={st.searchWrap}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            style={st.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="جستجو در بازار..."
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>`;

if (pms.includes(oldHeader)) {
  pms = pms.replace(oldHeader, newHeader);
  console.log('✅ هدر با بازگشت اضافه شد');
} else {
  console.log('⚠️ الگوی هدر پیدا نشد — هدر دست نخورده');
}

// ۳. استایل هدر جدید
const oldStyles = `  // ═══ هدر ═══
  header: {
    backgroundColor: '#0f2438',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },`;

const newStyles = `  // ═══ هدر ═══
  header: {
    backgroundColor: '#0f2438',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  backBtn: {
    width: 90,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnTxt: {
    color: '#d4af37',
    fontSize: 14,
    fontWeight: 'bold',
  },
  brandTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },`;

if (pms.includes(oldStyles)) {
  pms = pms.replace(oldStyles, newStyles);
  console.log('✅ استایل هدر اضافه شد');
}

// ۴. بزرگ‌تر کردن فضای آگهی — کم کردن padding پایین FAB
pms = pms.replace(
  'contentContainerStyle={{ padding: 10, paddingBottom: 100 }}',
  'contentContainerStyle={{ padding: 10, paddingBottom: 90 }}'
);

if (pms !== pmsOrig) {
  fs.writeFileSync('PublicMarketScreen.tsx', pms, 'utf8');
  console.log('💾 PublicMarketScreen ذخیره شد');
} else {
  console.log('⚠️ PublicMarketScreen تغییر نکرد');
}

console.log('\n✅ تمام');