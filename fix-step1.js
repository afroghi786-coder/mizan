const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. App.tsx — حذف تب تکراری + پاس onBack
// ═══════════════════════════════════════════
let a = fs.readFileSync('App.tsx', 'utf8');
const aOrig = a;

// حذف تب تکراری
const dupPattern = /\},\{ key: 'exchange',[^}]+\}/;
if (dupPattern.test(a)) {
  a = a.replace(dupPattern, '},');
  console.log('✅ تب تکراری حذف شد');
} else {
  console.log('ℹ️ تب تکراری نیست');
}

// پاس onBack
const oldRender = "{tab === 'exchange' && <ExchangeScreen showToast={showToast} />}";
const newRender = "{tab === 'exchange' && <ExchangeScreen showToast={showToast} onBack={() => setTab('order')} />}";
if (a.includes(oldRender)) {
  a = a.replace(oldRender, newRender);
  console.log('✅ onBack پاس شد');
} else if (a.includes("onBack={() => setTab")) {
  console.log('ℹ️ onBack از قبل هست');
} else {
  console.log('⚠️ render exchange پیدا نشد');
}

if (a !== aOrig) {
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. ExchangeScreen.tsx — props + دکمه برگشت
// ═══════════════════════════════════════════
let e = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const eOrig = e;

// props: onBack
if (!e.match(/function ExchangeScreen\(\{[^}]*onBack[^}]*\}/)) {
  e = e.replace(
    /export default function ExchangeScreen\(\{([^}]+)\}(: any)?\)/,
    (m, props, tail) => {
      const p = props.trim().replace(/,$/, '');
      return `export default function ExchangeScreen({${p}, onBack}${tail || ''})`;
    }
  );
  console.log('✅ onBack به props اضافه شد');
} else {
  console.log('ℹ️ onBack از قبل در props');
}

// دکمه برگشت شناور
if (!e.includes('{onBack ? (')) {
  const styleSheetIdx = e.indexOf('const s = StyleSheet.create({');
  if (styleSheetIdx < 0) {
    console.log('❌ StyleSheet پیدا نشد');
    process.exit(1);
  }
  
  const beforeStyle = e.substring(0, styleSheetIdx);
  const lastViewIdx = beforeStyle.lastIndexOf('</View>');
  
  if (lastViewIdx < 0) {
    console.log('❌ آخرین </View> پیدا نشد');
    process.exit(1);
  }
  
  const lineStart = e.lastIndexOf('\n', lastViewIdx) + 1;
  const indent = e.substring(lineStart, lastViewIdx);
  
  const backBtn = `${indent}{onBack ? (
${indent}  <TouchableOpacity
${indent}    onPress={onBack}
${indent}    style={{ position: 'fixed' as any, bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
${indent}  >
${indent}    <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>←</Text>
${indent}  </TouchableOpacity>
${indent}) : null}

`;
  
  e = e.substring(0, lineStart) + backBtn + e.substring(lineStart);
  console.log('✅ دکمه برگشت اضافه شد');
} else {
  console.log('ℹ️ دکمه برگشت از قبل هست');
}

if (e !== eOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', e, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

console.log('\n✅ تمام');