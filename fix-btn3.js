const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;

// regex — بدون وابستگی به emoji
const re = /(<View style=\{\{ flex: 1, alignItems: 'center' \}\}>\s*\n\s*<Text style=\{st\.brandTitle\}>[^<]*<\/Text>\s*\n\s*<\/View>\s*\n)(\s*)(<View style=\{st\.backBtn\} \/>)/;

const match = s.match(re);
if (match) {
  const nw = match[1] + '          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>\n            <Text style={{ fontSize: 18 }}>⚙️</Text>\n          </TouchableOpacity>';
  s = s.replace(re, nw);
  console.log('✅ دکمه ⚙️ اضافه شد');
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ regex هم پیدا نشد — روش مستقیم خط 263:');
  const lines = s.split('\n');
  // خط 263 خط placeholder هست (index 262)
  if (lines[262] && lines[262].includes('st.backBtn')) {
    lines[262] = `          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>\n            <Text style={{ fontSize: 18 }}>⚙️</Text>\n          </TouchableOpacity>`;
    s = lines.join('\n');
    fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
    console.log('✅ خط 263 مستقیم جایگزین شد');
  } else {
    console.log('خط 263 این نیست:', lines[262]);
  }
}