const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ امن
// ═══════════════════════════════════════════
const backupDir = 'backup-before-pmfix';
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
fs.copyFileSync('App.tsx', path.join(backupDir, 'App.tsx'));
console.log('🛡 بکاپ App.tsx گرفته شد در ' + backupDir);
console.log('');

// ═══════════════════════════════════════════
// ۱. اضافه دکمه برگشت برای publicMarket
// ═══════════════════════════════════════════
let s = fs.readFileSync('App.tsx', 'utf8');
const sOrig = s;

// چک کن از قبل نباشه
if (s.includes("{tab === 'publicMarket' && (\n") && s.includes("setTab('order')")) {
  // چک دقیق‌تر: آیا دکمه برگشت برای publicMarket هست؟
  const pmBackRegex = /\{tab === 'publicMarket' && \(\s*\n\s*<TouchableOpacity[\s\S]*?setTab\('order'\)[\s\S]*?<\/TouchableOpacity>\s*\n\s*\)\}/;
  if (pmBackRegex.test(s)) {
    console.log('ℹ️ دکمه برگشت بازار عمومی از قبل هست — کاری نکردم');
    process.exit(0);
  }
}

// اضافه قبل از </SafeAreaView> — کنار دکمه برگشت صرافی
const idx = s.lastIndexOf('</SafeAreaView>');
if (idx < 0) {
  console.log('❌ </SafeAreaView> پیدا نشد!');
  process.exit(1);
}

const lineStart = s.lastIndexOf('\n', idx) + 1;

const pmBackBtn = "      {tab === 'publicMarket' && (\n        <TouchableOpacity\n          onPress={() => setTab('order')}\n          style={{ position: 'absolute', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}\n        >\n          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 }}>←</Text>\n        </TouchableOpacity>\n      )}\n";

s = s.substring(0, lineStart) + pmBackBtn + s.substring(lineStart);

if (s !== sOrig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('✅ دکمه برگشت بازار عمومی اضافه شد');
  console.log('💾 App.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 اگر خراب شد: copy ' + backupDir + '\\App.tsx App.tsx');