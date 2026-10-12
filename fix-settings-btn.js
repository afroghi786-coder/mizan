// fix-settings-btn.js — اضافه کردن دکمه ⚙️ به هدر
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;

// پیدا کردن دکمه بازگشت و اضافه کردن دکمه تنظیمات بعد از عنوان
// الگو: بعد از brandTitle و before </View> در headerTop

const patterns = [
  // الگو ۱: با placeholder
  {
    old: `<View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <View style={st.backBtn} />`,
    new: `<View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>`
  },
  // الگو ۲: بدون placeholder
  {
    old: `<View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>`,
    new: `<View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>`
  },
  // الگو ۳: بر اساس کلاس backBtn
  {
    old: `</View>
          <View style={st.backBtn} />
        </View>`,
    new: `</View>
          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>`
  }
];

let done = false;
for (let i = 0; i < patterns.length; i++) {
  if (s.includes(patterns[i].old)) {
    s = s.replace(patterns[i].old, patterns[i].new);
    console.log('✅ دکمه ⚙️ اضافه شد (الگو ' + (i+1) + ')');
    done = true;
    break;
  }
}

if (!done) {
  console.log('⚠️ الگو پیدا نشد — چاپ محدوده هدر:');
  // چاپ محدوده‌ی headerTop
  const idx = s.indexOf('headerTop:');
  if (idx > 0) {
    console.log(s.substring(idx - 200, idx + 800));
  } else {
    // چاپ محدوده‌ی brandTitle
    const idx2 = s.indexOf('brandTitle');
    if (idx2 > 0) {
      console.log(s.substring(idx2 - 300, idx2 + 300));
    }
  }
}

if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\n💾 ذخیره شد');
}