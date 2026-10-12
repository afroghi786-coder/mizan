const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══ ۱. محدود کردن ارتفاع زیرتب‌ها ═══
// پیدا کردن ScrollView زیرتب‌ها
const oldTabs = `<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsRow}>`;
const newTabs = `<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsRow} style={{ maxHeight: 62, flexGrow: 0, minHeight: 62 }}>`;

if (s.includes(oldTabs)) {
  s = s.replace(oldTabs, newTabs);
  console.log('✅ محدودیت ارتفاع زیرتب‌ها اضافه شد');
  n++;
} else {
  console.log('⚠️ الگوی ScrollView زیرتب پیدا نشد');
}

// ═══ ۲. فیکس استایل subTab با ارتفاع ثابت ═══
const oldSubTab = `  subTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#0f2438',
    borderWidth: 1.5,
    borderColor: '#334155',
    minWidth: 105,
    alignItems: 'center',
  },`;

const newSubTab = `  subTab: {
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f2438',
    borderWidth: 1.5,
    borderColor: '#334155',
    minWidth: 105,
    justifyContent: 'center',
    alignItems: 'center',
  },`;

if (s.includes(oldSubTab)) {
  s = s.replace(oldSubTab, newSubTab);
  console.log('✅ استایل subTab فیکس شد');
  n++;
} else {
  console.log('⚠️ الگوی subTab پیدا نشد');
  // جستجوی subTab در فایل
  const idx = s.indexOf('subTab:');
  if (idx > 0) {
    const end = s.indexOf('},', idx) + 2;
    console.log('   محدوده واقعی subTab:');
    console.log(s.substring(idx, end));
  }
}

// ═══ ۳. کوچک کردن کارت‌های دسته (اختیاری — برای فضای بیشتر) ═══
const oldBigCard = `  bigCard: {
    backgroundColor: '#0f2438',
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderRightWidth: 5,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    minHeight: 92,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },`;

const newBigCard = `  bigCard: {
    backgroundColor: '#0f2438',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderRightWidth: 5,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },`;

if (s.includes(oldBigCard)) {
  s = s.replace(oldBigCard, newBigCard);
  console.log('✅ کارت دسته کوچک‌تر (فضا بیشتر)');
  n++;
}

// ═══ ذخیره ═══
if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ هیچ تغییری اعمال نشد');
}