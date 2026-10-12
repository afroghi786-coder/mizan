const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-simple-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const wasCRLF = n.includes('\r\n');
if (wasCRLF) n = n.replace(/\r\n/g, '\n');

// پیدا کردن بلوک
let startIdx = n.indexOf('// 🚀 استفاده از RPC');
if (startIdx < 0) startIdx = n.indexOf('// 🔄 اگر اعلان قبلی');
if (startIdx < 0) startIdx = n.indexOf('// 🧹 پاک کردن');

const endMarker = '// ساخت اعلان جدید با کانتکست';
let endIdx = n.indexOf(endMarker, startIdx);

if (startIdx < 0 || endIdx < 0) {
  console.log('❌ markers پیدا نشد');
  console.log('start: ' + startIdx + ', end: ' + endIdx);
  process.exit(1);
}

console.log('✅ markers: ' + startIdx + ' → ' + endIdx);

const newBlock = `// ✅ INSERT ساده — Trigger سرور خودش تکراری‌ها رو پاک می‌کنه
    try {
      await _sb.from('net_notifications').insert({
        to_email: toEmail,
        type: 'new_message',
        payload: {
          from_email: _myEmail,
          from_name: _myName || _myEmail.split('@')[0],
          room_id: roomId,
          last_text: text.trim().slice(0, 80),
          code: _hawalaCode,
          hawalaId: _hawalaId,
          hawalaType: _hawalaType,
          beneficiaryName: _beneficiaryName,
          amount: _amount,
          currency: _currency,
        },
      });
      console.log('✅ اعلان پیام insert شد | hawalaId:', _hawalaId);
    } catch (e) { console.log('msg notif insert err:', e); }

    `;

n = n.substring(0, startIdx) + newBlock + n.substring(endIdx);

if (wasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');