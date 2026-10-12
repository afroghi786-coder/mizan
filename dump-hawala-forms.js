const fs = require('fs');

console.log('═══════════════════════════════════════════════════════════');
console.log('📋 تحلیل فرم‌های حواله');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// ═══════════════════════════════════════════
// ۱. فرم حواله محلی (ExchangeScreen)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('🏢 فرم حواله محلی صرافی (ExchangeScreen → hawalas)');
console.log('═══════════════════════════════════════════════════════════');

const ex = fs.readFileSync('ExchangeScreen.tsx', 'utf8');

// hawForm state
const hawFormMatch = ex.match(/const\s+\[hawForm,\s*setHawForm\]\s*=\s*useState<any>\(\{[\s\S]*?\}\)/);
if (hawFormMatch) {
  console.log('📌 hawForm state:');
  console.log(hawFormMatch[0]);
} else {
  console.log('❌ hawForm پیدا نشد');
}
console.log('');

// createHawala import (کدوم فایل؟)
const createMatch = ex.match(/import\s*\{[^}]*createHawala[^}]*\}\s*from\s*['"]([^'"]+)['"]/);
if (createMatch) {
  console.log('📌 createHawala از فایل: ' + createMatch[1]);
}
console.log('');

// بخش UI فرم (خط ۸۸۷ تا ۱۰۰۰)
const lines = ex.split('\n');
console.log('📌 UI فرم حواله محلی (خط ۸۸۷ تا ۹۸۰):');
console.log('');
for (let i = 886; i < 980 && i < lines.length; i++) {
  const line = lines[i].trim();
  if (line && (line.includes('TextInput') || line.includes('hawForm') || line.includes('placeholder') || line.includes('TouchableOpacity') && line.includes('submit'))) {
    console.log('  خط ' + (i + 1) + ': ' + line.substring(0, 120));
  }
}
console.log('');

// ═══════════════════════════════════════════
// ۲. فرم حواله P2P (LiveMarketScreen)
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('🌐 فرم حواله P2P (LiveMarketScreen)');
console.log('═══════════════════════════════════════════════════════════');

const lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');

// دنبال فرم حواله P2P بگرد
const p2pFormMatch = lm.match(/const\s+\[dhForm,\s*setDhForm\]\s*=\s*useState<any>\(\{[\s\S]*?\}\)/);
if (p2pFormMatch) {
  console.log('📌 dhForm state (حواله خصوصی):');
  console.log(p2pFormMatch[0]);
} else {
  console.log('⚠️ dhForm پیدا نشد — دنبال اسامی دیگه می‌گردم:');
  const stateMatches = lm.match(/const\s+\[\w*[Hh]awala\w*,\s*set\w+\]\s*=\s*useState/g);
  if (stateMatches) stateMatches.forEach(m => console.log('  → ' + m));
}
console.log('');

// تابع ارسال حواله P2P
const sendMatch = lm.match(/const\s+sendDirectHawala\w*\s*=[\s\S]*?};/);
if (sendMatch) {
  console.log('📌 تابع ارسال حواله خصوصی:');
  console.log(sendMatch[0].substring(0, 500));
} else {
  console.log('⚠️ sendDirectHawala پیدا نشد');
}
console.log('');

// ═══════════════════════════════════════════
// ۳. جدول‌های ذخیره‌سازی
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('💾 جدول‌های ذخیره‌سازی حواله');
console.log('═══════════════════════════════════════════════════════════');

// local hawala table
const localTable = ex.match(/from\(['"]([^'"]*hawal[^'"]*)['"]\)/gi);
if (localTable) {
  const uniq = [...new Set(localTable.map(t => t.match(/['"]([^'"]+)['"]/)[1]))];
  console.log('📌 جدول‌های محلی (ExchangeScreen): ' + uniq.join(', '));
}

const netTables = lm.match(/from\(['"]([^'"]*hawal[^'"]*)['"]\)/gi);
if (netTables) {
  const uniq = [...new Set(netTables.map(t => t.match(/['"]([^'"]+)['"]/)[1]))];
  console.log('📌 جدول‌های شبکه‌ای (LiveMarketScreen): ' + uniq.join(', '));
}
console.log('');

// ═══════════════════════════════════════════
// ۴. فایل lib که createHawala داره
// ═══════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('📂 توابع CRUD حواله محلی');
console.log('═══════════════════════════════════════════════════════════');

const libMatch = ex.match(/import\s*\{[^}]*createHawala[^}]*\}\s*from\s*['"]([^'"]+)['"]/);
if (libMatch) {
  const libFile = libMatch[1].replace('./', '') + '.ts';
  console.log('📌 فایل: ' + libFile);
  if (fs.existsSync(libFile)) {
    const libContent = fs.readFileSync(libFile, 'utf8');
    const fnMatch = libContent.match(/export\s+(async\s+)?function\s+createHawala[\s\S]*?^}/m);
    if (fnMatch) {
      console.log('📌 تابع createHawala:');
      console.log(fnMatch[0].substring(0, 800));
    }
  }
}
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ تمام');
console.log('═══════════════════════════════════════════════════════════');