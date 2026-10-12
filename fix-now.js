const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. App.tsx
// ═══════════════════════════════════════════
let a = fs.readFileSync('App.tsx', 'utf8');
const aOrig = a;

// حذف import قبلی اگر بود
a = a.replace(/import ExchangeBell from '\.\/ExchangeBell';\n?/g, '');

// import جدید
const importLine = "import ExchangeBell from './ExchangeBell';";
const lines = a.split('\n');
let lastImport = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ') && lines[i].includes("from './")) {
    lastImport = i;
  }
}
if (lastImport >= 0) {
  lines.splice(lastImport + 1, 0, importLine);
  a = lines.join('\n');
  console.log('✅ import اضافه شد');
}

// حذف دکمه برگشت قبلی که مستقیم اضافه کردیم
const directBackRe = /\s*\{tab === 'exchange' && \(\s*\n\s*<TouchableOpacity[\s\S]*?onPress=\{\(\) => setTab\('order'\)\}[\s\S]*?<\/TouchableOpacity>\s*\n\s*\)\}/g;
if (directBackRe.test(a)) {
  a = a.replace(directBackRe, '');
  console.log('✅ دکمه برگشت مستقیم حذف شد (چون ExchangeBell خودش داره)');
}

// حذف render قدیمی ExchangeBell اگر بود
a = a.replace(/\s*\{tab === 'exchange' && <ExchangeBell[^}]*\/>\}/g, '');

// اضافه render ExchangeBell — قبل از </SafeAreaView>
const idx = a.lastIndexOf('</SafeAreaView>');
if (idx > 0) {
  const lineStart = a.lastIndexOf('\n', idx) + 1;
  const render = "      {tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n";
  a = a.substring(0, lineStart) + render + a.substring(lineStart);
  console.log('✅ ExchangeBell render اضافه شد');
}

if (a !== aOrig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. ExchangeBell.tsx — چک کن onBack داره
// ═══════════════════════════════════════════
let b = fs.readFileSync('ExchangeBell.tsx', 'utf8');

if (!b.includes('onBack')) {
  console.log('⚠️ ExchangeBell onBack نداره — اضافه می‌کنم');
  // props
  b = b.replace(
    /export default function ExchangeBell\(\{\s*showToast\s*\}: any\)/,
    'export default function ExchangeBell({ showToast, onBack }: any)'
  );
  // دکمه برگشت
  b = b.replace(
    '{/* دکمه اعلان */}',
    `{onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={{ position: 'fixed', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
        >
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
      ) : null}

      {/* دکمه اعلان */}`
  );
  fs.writeFileSync('ExchangeBell.tsx', b, 'utf8');
  console.log('💾 ExchangeBell.tsx ذخیره شد');
} else {
  console.log('ℹ️ ExchangeBell onBack داره');
}

console.log('\n✅ تمام');