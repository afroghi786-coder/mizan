const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-enablemanual-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('App.tsx', 'utf8');
const orig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// پیدا کردن placeholder «تست دستیار»
const placeholderPatterns = [
  `{tab === 'manualEntry' && <View style={{flex:1, backgroundColor:'#0a1628', justifyContent:'center', alignItems:'center'}}><Text style={{color:'#fff', fontSize:18}}>🧪 تست دستیار</Text></View>}`,
  `{tab === 'manualEntry' && <View style={{flex:1, backgroundColor:'#0a1628', justifyContent:'center', alignItems:'center'}}><Text style={{color:'#fff', fontSize:20}}>🧪 تست SMS</Text></View>}`,
];

let replaced = false;
for (const pat of placeholderPatterns) {
  if (s.includes(pat)) {
    s = s.replace(pat, `{tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`);
    console.log('✅ placeholder → ManualEntryScreen');
    replaced = true;
    break;
  }
}

if (!replaced) {
  // regex fallback
  const regex = /\{tab === 'manualEntry' && <View[^}]+>.*?تست دستیار.*?<\/View>\}/;
  if (regex.test(s)) {
    s = s.replace(regex, `{tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`);
    console.log('✅ placeholder → ManualEntryScreen (regex)');
    replaced = true;
  } else {
    // جستجوی گسترده
    const lines = s.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("tab === 'manualEntry'")) {
        console.log('خط ' + (i+1) + ': ' + lines[i].trim().substring(0, 150));
        lines[i] = `      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`;
        replaced = true;
      }
    }
    if (replaced) {
      s = lines.join('\n');
      console.log('✅ placeholder → ManualEntryScreen (خطی)');
    }
  }
}

if (!replaced) {
  console.log('⚠️ placeholder پیدا نشد — بررسی دستی لازمه');
}

// چک import
if (!s.includes("import ManualEntryScreen")) {
  console.log('⚠️ import نیست — اضافه می‌کنم');
  const lines = s.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import ManualEntryScreen from './ManualEntryScreen';");
    s = lines.join('\n');
    console.log('✅ import اضافه شد');
  }
}

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const final = fs.readFileSync('App.tsx', 'utf8');
console.log('import: ' + (final.includes('import ManualEntryScreen') ? '✅' : '❌'));
console.log('render: ' + (final.includes('<ManualEntryScreen') ? '✅' : '❌'));
console.log('tab: ' + (final.includes("'manualEntry'") ? '✅' : '❌'));

const finalLines = final.split(/\r?\n/);
console.log('');
console.log('─── خطوط render دستیار ───');
finalLines.forEach((l, i) => {
  if (l.includes('manualEntry')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 140));
  }
});

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');