const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-disablemanual-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));

let s = fs.readFileSync('App.tsx', 'utf8');
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// import رو نگه دار ولی render رو کامنت کن
s = s.replace(
  /{tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} \/>}/g,
  "{tab === 'manualEntry' && <View style={{flex:1, backgroundColor:'#0a1628', justifyContent:'center', alignItems:'center'}}><Text style={{color:'#fff', fontSize:18}}>🧪 تست دستیار</Text></View>}"
);

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('App.tsx', s, 'utf8');
console.log('✅ render دستیار غیرفعال شد');
console.log('');
console.log('سرور رو ری‌استارت کن و بگو:');
console.log('  🅰️ سایت بالا اومد → مشکل از ManualEntryScreen هست');
console.log('  🅱️ هنوز سفید → مشکل از App.tsx');