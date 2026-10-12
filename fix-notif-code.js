const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-notifcode-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// پیدا کردن بلوک دوم texts (که p.code نداره)
// ═══════════════════════════════════════════

// الگوی خاص بلوک دوم: direct_hawala بدون p.code
const block2StartMarker = "const texts: any = {";
const positions = [];
let idx = 0;
while ((idx = s.indexOf(block2StartMarker, idx)) !== -1) {
  positions.push(idx);
  idx += block2StartMarker.length;
}
console.log('📍 تعداد const texts: ' + positions.length);

if (positions.length < 2) {
  console.log('⚠️ فقط یک texts داریم — شاید اسمش فرق داره');
  process.exit(1);
}

// بلوک دوم = positions[1]
const block2Start = positions[1];

// انتهای بلوک رو پیدا کن (اولین `};` بعد از block2Start)
const block2End = s.indexOf('};', block2Start);
if (block2End === -1) {
  console.log('❌ انتهای بلوک دوم پیدا نشد');
  process.exit(1);
}

const oldBlock = s.substring(block2Start, block2End + 2);
console.log('📏 طول بلوک دوم: ' + oldBlock.length);
console.log('');
console.log('📌 بلوک فعلی:');
console.log(oldBlock);
console.log('');

// ═══════════════════════════════════════════
// بلوک جدید با p.code
// ═══════════════════════════════════════════
const newBlock = `const texts: any = {
                fx_taken: \`✅ \${p.from_name} آگهی شما را قبول کرد\`,
                hawala_taken: \`✅ \${p.from_name} حواله شما را قبول کرد\${p.code ? ' [' + p.code + ']' : ''}\`,
                direct_hawala: \`🔒 حواله خصوصی از \${p.from_name}\${p.code ? ' [' + p.code + ']' : ''}\`,
                direct_accepted: \`✅ \${p.from_name} حواله را قبول کرد\${p.code ? ' [' + p.code + ']' : ''}\`,
                direct_delivered: \`📦 \${p.from_name} حواله را تحویل داد\${p.code ? ' [' + p.code + ']' : ''}\`,
                group_invite: \`🌐 دعوت به گروه \${p.groupName || ''}\`,
                group_join: \`👥 \${p.from_name} به گروه پیوست\`,
                fx_new: \`💱 \${p.from_name} فروش \${fmt(p.amount)} \${p.currency}\`,
                hawala_new: \`📤 \${p.from_name} حواله \${fmt(p.amount)} \${p.currency}\${p.code ? ' [' + p.code + ']' : ''}\`,
                new_message: \`💬 پیام جدید از \${p.from_name || p.from_email || "کاربر"}\`,
                virtual_message: \`💬 پیام جدید از \${p.from || "کاربر"}\`,
              };`;

s = s.substring(0, block2Start) + newBlock + s.substring(block2End + 2);

if (wasCRLF) s = s.replace(/\n/g, '\r\n');

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('✅ بلوک دوم با p.code آپدیت شد');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('⚠️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');