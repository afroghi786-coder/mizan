const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-boxnav3-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('BoxesScreen.tsx', path.join(bdir, 'BoxesScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let bx = fs.readFileSync('BoxesScreen.tsx', 'utf8');
const orig = bx;
const crlf = bx.includes('\r\n');
if (crlf) bx = bx.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. پیدا کردن return اصلی
// ═══════════════════════════════════════════
const returnIdx = bx.indexOf('return (\n      <View style={{ flex: 1 }}>');
if (returnIdx < 0) {
  console.log('❌ return پیدا نشد');
  // نمایش ۳۰۰ کاراکتر بعد از return
  const rIdx = bx.indexOf('return (');
  if (rIdx > 0) console.log(bx.substring(rIdx, rIdx + 300));
  process.exit(1);
}
console.log('✅ return در ' + returnIdx);

// ۲. اضافه TextInput import اگه نیست
if (!bx.includes('TextInput')) {
  const rnImport = bx.match(/import\s*\{([^}]+)\}\s*from\s*['"]react-native['"]/);
  if (rnImport) {
    const newImports = rnImport[1].trim() + ', TextInput';
    bx = bx.replace(rnImport[0], `import { ${newImports} } from 'react-native'`);
    console.log('✅ TextInput اضافه شد');
  }
}

// ۳. اضافه UI فیلتر بعد از <View style={{ flex: 1 }}>
const startTag = 'return (\n      <View style={{ flex: 1 }}>';
const insertPos = bx.indexOf(startTag) + startTag.length;

const filterUI = `

        {/* 🔍 جستجوی صندوق */}
        <View style={{ flexDirection: 'row-reverse', padding: 10, gap: 8, alignItems: 'center' }}>
          <TextInput
            style={{ flex: 1, backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: deepFilter ? '#f59e0b' : '#334155', borderRadius: 8, padding: 10, textAlign: 'right', fontSize: 13 }}
            value={deepFilter}
            onChangeText={setDeepFilter}
            placeholder="🔍 جستجوی صندوق (اسم / کد)"
            placeholderTextColor="#64748b"
          />
          {deepFilter ? (
            <TouchableOpacity onPress={() => setDeepFilter('')} style={{ backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>`;

if (!bx.includes('🔍 جستجوی صندوق')) {
  bx = bx.substring(0, insertPos) + filterUI + bx.substring(insertPos);
  console.log('✅ UI فیلتر اضافه شد');
} else {
  console.log('ℹ️ UI فیلتر از قبل هست');
}

// ۴. پیدا کردن متغیر boxes
console.log('');
console.log('📍 جستجوی متغیر boxes:');
const boxesLines = bx.split('\n');
let boxesVarName = 'boxes';
let boxesDeclLine = -1;
boxesLines.forEach((l, i) => {
  if (/const\s+\[?\w*,?\s*set\w*\]?\s*=\s*useState.*Box/i.test(l) || /const\s+boxes\s*=/.test(l)) {
    console.log('   خط ' + (i+1) + ': ' + l.trim().substring(0, 100));
    if (l.includes('const boxes')) boxesDeclLine = i;
  }
});

// ═══════════════════════════════════════════
// ۵. اضافه فیلتر خودکار — با useEffect
// ═══════════════════════════════════════════
if (!bx.includes('filteredBoxes')) {
  // پیدا کردن اولین useEffect یا اضافه بعد از state
  const useStateMatch = bx.match(/const\s*\[\s*boxes\s*,\s*setBoxes\s*\]\s*=\s*useState/);
  if (useStateMatch) {
    const declEnd = bx.indexOf(');', bx.indexOf(useStateMatch[0])) + 2;
    const filterCode = `\n\n  // 🔍 فیلتر صندوق‌ها بر اساس deepFilter\n  const filteredBoxes = React.useMemo(() => {\n    if (!deepFilter || !deepFilter.trim()) return boxes;\n    const q = String(deepFilter).toLowerCase().trim();\n    return (boxes || []).filter((b: any) =>\n      String(b.name || '').toLowerCase().includes(q) ||\n      String(b.code || '').toLowerCase().includes(q) ||\n      String(b.owner_code || '').toLowerCase().includes(q) ||\n      String(b.owner_name || '').toLowerCase().includes(q)\n    );\n  }, [boxes, deepFilter]);\n`;
    bx = bx.substring(0, declEnd) + filterCode + bx.substring(declEnd);
    console.log('✅ filteredBoxes اضافه شد');
  } else {
    console.log('⚠️ useState boxes پیدا نشد — بذار دنبال اسامی دیگه بگردیم');
    // جستجوی اسامی احتمالی
    const candidates = ['boxList', 'allBoxes', 'boxData', 'list'];
    candidates.forEach(c => {
      if (bx.includes('const ' + c)) {
        console.log('   متغیر احتمالی: ' + c);
      }
    });
  }
}

if (crlf) bx = bx.replace(/\n/g, '\r\n');
if (bx !== orig) {
  fs.writeFileSync('BoxesScreen.tsx', bx, 'utf8');
  console.log('💾 BoxesScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const fin = fs.readFileSync('BoxesScreen.tsx', 'utf8');
console.log('UI فیلتر: ' + (fin.includes('🔍 جستجوی صندوق') ? '✅' : '❌'));
console.log('filteredBoxes: ' + (fin.includes('filteredBoxes') ? '✅' : '❌'));
console.log('deepFilter: ' + (fin.includes('deepFilter') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('⚠️ حالا باید "boxes.map" رو به "filteredBoxes.map" عوض کنی');
console.log('   این دستور رو بزن:');
console.log('   findstr /N "boxes.map" BoxesScreen.tsx');
console.log('   خروجی رو بفرست تا بگم دقیقاً کجا رو عوض کنی');