const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-msgctx-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['lib.network.ts', 'LiveMarketScreen.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — sendMessage با کانتکست حواله
// ═══════════════════════════════════════════
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const nWasCRLF = n.includes('\r\n');
if (nWasCRLF) n = n.replace(/\r\n/g, '\n');

// پیدا کردن بلوک sendMessage
const smOld = `  // 🔔 ساخت اعلان پیام (فقط اگه از این فرستنده اعلان نخوانده نداریم)
  try {
    const { data: existing } = await _sb.from('net_notifications')
      .select('id')
      .eq('to_email', toEmail)
      .eq('type', 'new_message')
      .eq('is_read', false)
      .eq('payload->>from_email', _myEmail)
      .limit(1);
    if (!existing || existing.length === 0) {
      await _sb.from('net_notifications').insert({
        to_email: toEmail,
        type: 'new_message',
        payload: {
          from_email: _myEmail,
          from_name: _myName || _myEmail.split('@')[0],
          room_id: roomId,
          last_text: text.trim().slice(0, 80),
        },
      });
    }
  } catch (e) { console.log('msg notif error:', e); }`;

const smNew = `  // 🔔 ساخت اعلان پیام با کانتکست حواله
  try {
    // استخراج hawalaId و code از room_id
    let _hawalaId = '';
    let _hawalaCode = '';
    let _hawalaType = '';
    let _beneficiaryName = '';
    let _amount = 0;
    let _currency = '';

    if (roomId.startsWith('dh_')) {
      _hawalaId = roomId.substring(3);
      _hawalaType = 'direct';
      const { data } = await _sb.from('net_direct_hawalas')
        .select('code, beneficiary_name, amount, currency')
        .eq('id', _hawalaId).single();
      if (data) {
        _hawalaCode = data.code || '';
        _beneficiaryName = data.beneficiary_name || '';
        _amount = data.amount || 0;
        _currency = data.currency || '';
      }
    } else if (roomId.startsWith('hw_')) {
      _hawalaId = roomId.substring(3);
      _hawalaType = 'public';
      const { data } = await _sb.from('net_hawalas')
        .select('code, beneficiary_name, amount, currency')
        .eq('id', _hawalaId).single();
      if (data) {
        _hawalaCode = data.code || '';
        _beneficiaryName = data.beneficiary_name || '';
        _amount = data.amount || 0;
        _currency = data.currency || '';
      }
    } else if (roomId.startsWith('fx_')) {
      _hawalaId = roomId.substring(3);
      _hawalaType = 'fx';
    }

    // حذف اعلان‌های نخوانده قبلی همون حواله (جلوگیری از تکرار)
    try {
      if (_hawalaId) {
        await _sb.from('net_notifications')
          .delete()
          .eq('to_email', toEmail)
          .eq('is_read', false)
          .in('type', ['direct_hawala', 'hawala_new', 'new_message', 'direct_accepted']);
      }
    } catch (e) { console.log('del old notif err:', e); }

    // حذف دقيق بر اساس hawalaId در payload
    try {
      if (_hawalaId) {
        const { data: existingList } = await _sb.from('net_notifications')
          .select('id, payload, type')
          .eq('to_email', toEmail)
          .eq('is_read', false);
        const toDelete = (existingList || []).filter((x: any) => {
          const pl = x.payload || {};
          return pl.hawalaId === _hawalaId || pl.room_id === roomId;
        });
        for (const item of toDelete) {
          try { await _sb.from('net_notifications').delete().eq('id', item.id); } catch {}
        }
      }
    } catch (e) { console.log('clean old notif err:', e); }

    // ساخت اعلان جدید با کانتکست
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
  } catch (e) { console.log('msg notif error:', e); }`;

if (n.includes(smOld)) {
  n = n.replace(smOld, smNew);
  console.log('✅ sendMessage با کانتکست حواله آپدیت شد');
} else {
  console.log('⚠️ الگوی sendMessage پیدا نشد');
  const idx = n.indexOf("// 🔔 ساخت اعلان پیام");
  if (idx > 0) console.log('نمونه:\n' + n.substring(idx, idx + 600));
}

if (nWasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen.tsx — نمایش کد در اعلان پیام
// ═══════════════════════════════════════════
console.log('');
console.log('═══ LiveMarketScreen.tsx ═══');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const sWasCRLF = s.includes('\r\n');
if (sWasCRLF) s = s.replace(/\r\n/g, '\n');

// آپدیت new_message در texts
const nmOld = "new_message: `💬 پیام جدید از ${p.from_name || p.from_email || \"کاربر\"}`,";
const nmNew = "new_message: `💬 پیام جدید از ${p.from_name || p.from_email || \"کاربر\"}${p.code ? ' [' + p.code + ']' : ''}`,";

if (s.includes(nmOld)) {
  s = s.replace(nmOld, nmNew);
  console.log('✅ new_message آپدیت شد (کد اضافه)');
} else {
  console.log('⚠️ new_message الگو پیدا نشد');
  const idx = s.indexOf('new_message:');
  if (idx > 0) console.log('نمونه: ' + s.substring(idx, idx + 120));
}

// آپدیت virtual_message
const vmOld = "virtual_message: `💬 پیام جدید از ${p.from || \"کاربر\"}`,";
const vmNew = "virtual_message: `💬 پیام جدید از ${p.from || \"کاربر\"}${p.code ? ' [' + p.code + ']' : ''}`,";
if (s.includes(vmOld)) {
  s = s.replace(vmOld, vmNew);
  console.log('✅ virtual_message آپدیت شد');
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