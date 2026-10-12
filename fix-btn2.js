const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;

const old = `          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <View style={st.backBtn} />`;

const nw = `          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>`;

if (s.includes(old)) {
  s = s.replace(old, nw);
  console.log('✅ دکمه ⚙️ اضافه شد');
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ الگو پیدا نشد');
  const lines = s.split('\n');
  for (let i = 259; i < 264; i++) {
    console.log('خط ' + (i+1) + ': [' + lines[i] + ']');
  }
}