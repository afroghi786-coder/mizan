const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-msgupdate-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['lib.network.ts', 'LiveMarketScreen.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — UPDATE instead of DELETE+INSERT
// ═══════════════════════════════════════════
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const nWasCRLF = n.includes('\r\n');
if (nWasCRLF) n = n.replace(/\r\n/g, '\n');

// پیدا کردن بلوک کامل از "// 🧹 پاک کردن" تا "ساخت اعلان جدید با کانتکست"
const startMarker = '// 🧹 پاک کردن همه اعلان‌های همین حواله';
const endMarker = '// ساخت اعلان جدید با کانتکست';

const startIdx = n.indexOf(startMarker);
const endIdx = n.indexOf(endMarker, startIdx);

if (startIdx < 0 || endIdx < 0) {
  console.log('❌ markers پیدا نشد');
  console.log('start: ' + startIdx + ', end: ' + endIdx);
  process.exit(1);
}

console.log('✅ markers: ' + startIdx + ' → ' + endIdx);

// بلوک جدید: UPDATE if exists, else INSERT
const newBlock = `// 🔄 اگر اعلان قبلی برای این حواله هست، UPDATE کن (نه DELETE+INSERT)
    let _didUpdate = false;
    try {
      if (_hawalaId || roomId) {
        const { data: allList } = await _sb.from('net_notifications')
          .select('id, payload')
          .eq('to_email', toEmail);
        const matches = (allList || []).filter((x: any) => {
          const pl = x.payload || {};
          return pl.hawalaId === _hawalaId || pl.room_id === roomId;
        });
        if (matches.length > 0) {
          // اعلان اول رو UPDATE کن، بقیه رو پاک کن
          const firstId = matches[0].id;
          await _sb.from('net_notifications')
            .update({
              is_read: false,
              created_at: new Date().toISOString(),
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
            })
            .eq('id', firstId);
          // بقیه رو پاک کن
          for (let i = 1; i < matches.length; i++) {
            try { await _sb.from('net_notifications').delete().eq('id', matches[i].id); } catch {}
          }
          _didUpdate = true;
          console.log('🔄 اعلان آپدیت شد:', firstId, '| hawalaId:', _hawalaId);
        }
      }
    } catch (e) { console.log('update notif err:', e); }

    // اگه آپدیت نشد، اعلان جدید بساز
    if (!_didUpdate) {
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
        console.log('➕ اعلان جدید ساخته شد | hawalaId:', _hawalaId);
      } catch (e) { console.log('insert notif err:', e); }
    }

    `;

n = n.substring(0, startIdx) + newBlock + n.substring(endIdx);

if (nWasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen.tsx — متن اعلان با کانتکست
// ═══════════════════════════════════════════
console.log('');
console.log('═══ LiveMarketScreen.tsx ═══');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const sWasCRLF = s.includes('\r\n');
if (sWasCRLF) s = s.replace(/\r\n/g, '\n');

// آپدیت new_message با کانتکست واضح
const nmOld = "new_message: `💬 پیام جدید از ${p.from_name || p.from_email || \"کاربر\"}${p.code ? ' [' + p.code + ']' : ''}`,";
const nmNew = "new_message: `${p.hawalaType === 'direct' ? '📤 پیام برای حواله‌ات' : p.hawalaType === 'public' ? '📤 پیام برای حواله عمومی' : '💬 پیام جدید'} از ${p.from_name || p.from_email || \"کاربر\"}${p.code ? ' #' + p.code : ''}`,";

if (s.includes(nmOld)) {
  s = s.replace(nmOld, nmNew);
  console.log('✅ new_message آپدیت شد (متن واضح)');
} else {
  console.log('⚠️ new_message الگو پیدا نشد');
  const idx = s.indexOf('new_message:');
  if (idx > 0) console.log('نمونه: ' + s.substring(idx, idx + 200));
}

if (sWasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');