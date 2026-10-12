const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-layout-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. اضافه استایل inpSm (compact)
// ═══════════════════════════════════════════
if (!s.includes('inpSm:')) {
  const inpMatch = s.match(/(\n\s*inp:\s*\{[^}]*\})/);
  if (inpMatch) {
    const newStyle = ",\n  inpSm: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, fontSize: 11, textAlign: 'right', marginBottom: 4 }";
    s = s.replace(inpMatch[0], inpMatch[0] + newStyle);
    console.log('✅ استایل inpSm اضافه شد (compact)');
  }
} else {
  console.log('ℹ️ inpSm از قبل هست');
}

// ═══════════════════════════════════════════
// تابع کمکی
// ═══════════════════════════════════════════
function fixBlock(s, color, formName, closeModalCall) {
  console.log('');
  console.log('═══ ' + formName + ' (' + color + ') ═══');
  
  const startMarker = `<Text style={[s.lbl, { color: '${color}', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات فرستنده</Text>`;
  const endMarker = `<TouchableOpacity style={[s.btn, { backgroundColor: '${color}', flex: 2 }]}`;
  
  const start = s.indexOf(startMarker);
  if (start === -1) {
    console.log('❌ startMarker پیدا نشد');
    return s;
  }
  console.log('✅ start در موقعیت ' + start);
  
  const end = s.indexOf(endMarker, start);
  if (end === -1) {
    console.log('❌ endMarker پیدا نشد');
    return s;
  }
  console.log('✅ end در موقعیت ' + end);
  
  const block = s.substring(start, end);
  console.log('📏 طول بلوک: ' + block.length + ' بایت');
  
  // ۱. حذف بلوک از موقعیت اشتباه
  s = s.substring(0, start) + s.substring(end);
  console.log('✅ بلوک از موقعیت قبلی حذف شد');
  
  // ۲. تبدیل inp به inpSm
  const newBlock = block.replace(/style=\{s\.inp\}/g, 'style={s.inpSm}');
  console.log('✅ استایل inp → inpSm تبدیل شد');
  
  // ۳. پیدا کردن note input
  const notePattern = formName + '.note}';
  const noteIdx = s.indexOf(notePattern);
  if (noteIdx === -1) {
    console.log('❌ ' + notePattern + ' پیدا نشد');
    return s;
  }
  
  // ۴. پیدا کردن closeModalCall بعد از note
  const closeIdx = s.indexOf(closeModalCall, noteIdx);
  if (closeIdx === -1) {
    console.log('❌ ' + closeModalCall + ' پیدا نشد');
    return s;
  }
  
  // ۵. پیدا کردن rowBtns قبل از closeIdx
  const rowBtnsIdx = s.lastIndexOf('<View style={s.rowBtns}>', closeIdx);
  if (rowBtnsIdx === -1) {
    console.log('❌ rowBtns پیدا نشد');
    return s;
  }
  console.log('✅ rowBtns در موقعیت ' + rowBtnsIdx);
  
  // ۶. اضافه قبل از rowBtns
  s = s.substring(0, rowBtnsIdx) + newBlock + '\n                ' + s.substring(rowBtnsIdx);
  console.log('✅ بلوک قبل از دکمه‌ها اضافه شد');
  
  return s;
}

// اجرا
s = fixBlock(s, '#f59e0b', 'hawalaForm', 'setHawalaModal(false)');
s = fixBlock(s, '#0891b2', 'directForm', 'setDirectModal(false)');

// ═══════════════════════════════════════════
// ذخیره
// ═══════════════════════════════════════════
if (wasCRLF) s = s.replace(/\n/g, '\r\n');

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('');
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');