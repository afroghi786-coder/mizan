const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-boxnav2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['ExchangeScreen.tsx', 'BoxesScreen.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. ExchangeScreen — اضافه deep link handler (اگه نیست)
// ═══════════════════════════════════════════
console.log('═══ ExchangeScreen.tsx ═══');
let ex = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const exOrig = ex;
const exCRLF = ex.includes('\r\n');
if (exCRLF) ex = ex.replace(/\r\n/g, '\n');

// چک کن آیا useEffect با consumeDeepLink هست
if (!ex.includes('consumeDeepLink')) {
  console.log('⚠️ deep link handler نیست — اضافه می‌کنم');
  
  // پیدا کردن reload function
  const reloadMatch = ex.match(/(const reload = useCallback\(async \(\) => \{[\s\S]*?\}, \[[^\]]*\]\));/);
  
  if (reloadMatch) {
    const reloadEnd = ex.indexOf(reloadMatch[0]) + reloadMatch[0].length;
    const dlCode = `\n\n  // 🤖 Deep Link handler (assistant navigation)\n  useEffect(() => {\n    const _handler = async () => {\n      try {\n        const { consumeDeepLink } = await import('./lib.assistant.bridge');\n        const dl = await consumeDeepLink();\n        if (dl && dl.tab === 'exchange') {\n          console.log('🤖 deep link received:', dl);\n          if (dl.sub) setSub(dl.sub as any);\n          if (dl.params?.name) {\n            setBoxDeepSearch(dl.params.name);\n            console.log('🤖 فیلتر با: ' + dl.params.name);\n            setTimeout(() => setBoxDeepSearch(''), 20000);\n          }\n        }\n      } catch (e) { console.log('deep link err:', e); }\n    };\n    const iv = setInterval(_handler, 1000);\n    return () => clearInterval(iv);\n  }, []);`;
    ex = ex.substring(0, reloadEnd) + dlCode + ex.substring(reloadEnd);
    console.log('✅ deep link handler اضافه شد');
  } else {
    console.log('⚠️ reload پیدا نشد');
  }
} else {
  console.log('ℹ️ deep link handler از قبل هست');
}

if (exCRLF) ex = ex.replace(/\n/g, '\r\n');
if (ex !== exOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', ex, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. BoxesScreen — اضافه UI فیلتر
// ═══════════════════════════════════════════
console.log('');
console.log('═══ BoxesScreen.tsx ═══');
let bx = fs.readFileSync('BoxesScreen.tsx', 'utf8');
const bxOrig = bx;
const bxCRLF = bx.includes('\r\n');
if (bxCRLF) bx = bx.replace(/\r\n/g, '\n');

// ۲.۱ اضافه import TextInput اگه نیست
if (!bx.includes('TextInput')) {
  // پیدا کردن import react-native
  const rnImport = bx.match(/import\s*\{([^}]+)\}\s*from\s*['"]react-native['"]/);
  if (rnImport) {
    if (!rnImport[1].includes('TextInput')) {
      const newImports = rnImport[1].trim() + ', TextInput';
      bx = bx.replace(rnImport[0], `import { ${newImports} } from 'react-native'`);
      console.log('✅ TextInput به import اضافه شد');
    }
  }
}

// ۲.۲ اضافه فیلتر + جستجو در ابتدای render اصلی
// پیدا کردن "return (" تابع اصلی
const returnMatch = bx.match(/(\n\s*return \(\n\s*<View style=\{[^}]+\}>)/);

if (returnMatch) {
  const insertAfter = ex ? 0 : 0;
  const returnStart = bx.indexOf(returnMatch[0]) + returnMatch[0].length;
  
  // چک کن فیلتر قبلاً اضافه شده
  if (!bx.includes('🔍 جستجوی صندوق')) {
    const filterUI = `

      {/* 🔍 جستجوی صندوق */}
      <View style={{ flexDirection: 'row-reverse', padding: 10, gap: 8, alignItems: 'center' }}>
        <TextInput
          style={{ flex: 1, backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: deepFilter ? '#f59e0b' : '#334155', borderRadius: 8, padding: 10, textAlign: 'right', fontSize: 13 }}
          value={deepFilter}
          onChangeText={setDeepFilter}
          placeholder="🔍 جستجوی صندوق (اسم/کد)"
          placeholderTextColor="#64748b"
        />
        {deepFilter ? (
          <TouchableOpacity onPress={() => setDeepFilter('')} style={{ backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>`;
    bx = bx.substring(0, returnStart) + filterUI + bx.substring(returnStart);
    console.log('✅ UI فیلتر اضافه شد');
  } else {
    console.log('ℹ️ UI فیلتر از قبل هست');
  }
} else {
  console.log('⚠️ الگوی return پیدا نشد');
  // نمایش ۵ خط اول return
  const ridx = bx.indexOf('return (');
  if (ridx > 0) {
    console.log('نمونه return:');
    console.log(bx.substring(ridx, ridx + 300));
  }
}

// ۲.۳ فیلتر کردن boxes در نمایش
// دنبال boxes.map یا boxes.filter بگرد
const boxesVarPatterns = [
  /(const\s+boxesFiltered\s*=\s*[^;]+;)/,
  /(boxes\.map\(\(b:\s*any\))/,
  /(boxes\.map\(\(b\))/,
];

// ببینیم متغیر boxes کجاست
const boxesDecl = bx.match(/const\s+(\w+)\s*=\s*(?:await\s+)?getBoxes\(\)/);
console.log('📍 متغیر boxes: ' + (boxesDecl ? boxesDecl[0] : 'پیدا نشد'));

if (!bx.includes('boxesFiltered')) {
  // پیدا کردن جایی که boxes لیست می‌شه
  if (boxesDecl) {
    const declEnd = bx.indexOf(boxesDecl[0]) + boxesDecl[0].length;
    // پیدا کردن ; انتهای خط
    const semi = bx.indexOf(';', declEnd);
    if (semi > 0) {
      const insertPos = semi + 1;
      const filterCode = `\n  const boxesFiltered = deepFilter.trim()\n    ? boxes.filter((b: any) =>\n        String(b.name || '').includes(deepFilter) ||\n        String(b.code || '').includes(deepFilter) ||\n        String(b.owner_code || '').includes(deepFilter)\n      )\n    : boxes;`;
      bx = bx.substring(0, insertPos) + filterCode + bx.substring(insertPos);
      console.log('✅ boxesFiltered اضافه شد');
    }
  }
}

if (bxCRLF) bx = bx.replace(/\n/g, '\r\n');
if (bx !== bxOrig) {
  fs.writeFileSync('BoxesScreen.tsx', bx, 'utf8');
  console.log('💾 BoxesScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const finEx = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
console.log('deep link handler: ' + (finEx.includes('consumeDeepLink') ? '✅' : '❌'));
console.log('setBoxDeepSearch: ' + (finEx.includes('setBoxDeepSearch') ? '✅' : '❌'));

const finBx = fs.readFileSync('BoxesScreen.tsx', 'utf8');
console.log('UI فیلتر: ' + (finBx.includes('🔍 جستجوی صندوق') ? '✅' : '❌'));
console.log('boxesFiltered: ' + (finBx.includes('boxesFiltered') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('⚠️ نکته: باید توی نمایش صندوق‌ها، به جای "boxes" از "boxesFiltered" استفاده کنی');
console.log('   خروجی findstr /N "boxes.map" BoxesScreen.tsx رو بفرست تا دقیق جاش رو بگم');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\ExchangeScreen.tsx" ExchangeScreen.tsx');
console.log('   copy /Y "' + bdir + '\\BoxesScreen.tsx" BoxesScreen.tsx');