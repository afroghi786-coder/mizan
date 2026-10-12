const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-rpc-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const wasCRLF = n.includes('\r\n');
if (wasCRLF) n = n.replace(/\r\n/g, '\n');

// پیدا کردن بلوک از "// 🔄 اگر اعلان قبلی" تا "// ساخت اعلان جدید"
const startMarker = '// 🔄 اگر اعلان قبلی';
const endMarker = '// ساخت اعلان جدید با کانتکست';

const startIdx = n.indexOf(startMarker);
const endIdx = n.indexOf(endMarker, startIdx);

// اگه پیدا نشد، از marker دیگه
let sIdx = startIdx;
let eIdx = endIdx;

if (sIdx < 0 || eIdx < 0) {
  // جستجو از "let _didUpdate"
  const altStart = n.indexOf('// 🔄 اگر اعلان قبلی');
  const altStart2 = n.indexOf('let _didUpdate');
  if (altStart2 > 0) {
    sIdx = n.lastIndexOf('    //', altStart2);
    if (sIdx < 0) sIdx = altStart2;
  }
  const altEnd = n.indexOf('if (!_didUpdate)');
  if (altEnd > 0) eIdx = altEnd;
}

if (sIdx < 0 || eIdx < 0) {
  console.log('❌ markers پیدا نشد');
  console.log('start: ' + sIdx + ', end: ' + eIdx);
  const idx = n.indexOf('let _didUpdate');
  if (idx > 0) console.log('نمونه:\n' + n.substring(idx - 100, idx + 200));
  process.exit(1);
}

console.log('✅ markers: ' + sIdx + ' → ' + eIdx);

// بلوک جدید — RPC
const newBlock = `// 🚀 استفاده از RPC برای upsert (بدون RLS)
    try {
      const { error: _rpcErr } = await _sb.rpc('upsert_hawala_msg_notif', {
        p_to_email: toEmail,
        p_from_email: _myEmail,
        p_from_name: _myName || _myEmail.split('@')[0],
        p_room_id: roomId,
        p_hawala_id: _hawalaId,
        p_hawala_type: _hawalaType,
        p_code: _hawalaCode,
        p_last_text: text.trim().slice(0, 80),
        p_beneficiary_name: _beneficiaryName,
        p_amount: _amount,
        p_currency: _currency,
      });
      if (_rpcErr) {
        console.log('rpc err:', _rpcErr.message);
        // fallback: INSERT معمولی
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
      } else {
        console.log('✅ RPC upsert موفق:', _hawalaId);
      }
    } catch (e) { console.log('rpc exception:', e); }

    `;

n = n.substring(0, sIdx) + newBlock + n.substring(eIdx);

if (wasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');