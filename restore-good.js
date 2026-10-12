const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. حذف تب تکراری exchange
// ═══════════════════════════════════════════
console.log('═══ حذف تب تکراری ═══');
const lines = fs.readFileSync('App.tsx', 'utf8').split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  const idx1 = lines[i].indexOf("{ key: 'exchange'");
  const idx2 = lines[i].indexOf("{ key: 'exchange'", idx1 + 1);
  if (idx1 >= 0 && idx2 >= 0) {
    lines[i] = lines[i].substring(0, idx2).trimEnd();
    if (!lines[i].endsWith(',')) lines[i] += ',';
    console.log('✅ تب تکراری حذف شد (خط ' + (i+1) + ')');
    fixed = true;
  }
}
if (!fixed) console.log('ℹ️ تب تکراری نبود');

let s = lines.join('\n');

// ═══════════════════════════════════════════
// ۲. حذف ExchangeBell (اگر هست)
// ═══════════════════════════════════════════
s = s.replace(/import ExchangeBell from '\.\/ExchangeBell';\n?/g, '');
s = s.replace(/\s*\{tab === 'exchange' && <ExchangeBell[^}]*\/>\}/g, '');
console.log('✅ ExchangeBell حذف شد (اگر بود)');

// ═══════════════════════════════════════════
// ۳. اضافه دکمه برگشت — مستقیم در App.tsx
// ═══════════════════════════════════════════
// حذف نسخه قبلی اگر هست (از اسکریپت‌های قبلی)
s = s.replace(/\s*\{tab === 'exchange' && \(\s*\n\s*<TouchableOpacity[\s\S]*?setTab\('order'\)[\s\S]*?<\/TouchableOpacity>\s*\n\s*\)\}/g, '');

// اضافه قبل از </SafeAreaView>
const idx = s.lastIndexOf('</SafeAreaView>');
if (idx > 0) {
  const lineStart = s.lastIndexOf('\n', idx) + 1;
  const backBtn = "      {tab === 'exchange' && (\n        <TouchableOpacity\n          onPress={() => setTab('order')}\n          style={{ position: 'absolute', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}\n        >\n          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 }}>←</Text>\n        </TouchableOpacity>\n      )}\n";
  s = s.substring(0, lineStart) + backBtn + s.substring(lineStart);
  console.log('✅ دکمه برگشت اضافه شد');
}

fs.writeFileSync('App.tsx', s, 'utf8');
console.log('');
console.log('💾 App.tsx ذخیره شد');

// چک نهایی
const finalCheck = fs.readFileSync('App.tsx', 'utf8');
const exchangeTabs = (finalCheck.match(/key: 'exchange'/g) || []).length;
const backBtns = (finalCheck.match(/setTab\('order'\)/g) || []).length;
console.log('');
console.log('📊 تعداد تب exchange: ' + exchangeTabs);
console.log('📊 تعداد دکمه برگشت: ' + backBtns);