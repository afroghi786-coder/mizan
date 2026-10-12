const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ امن
// ═══════════════════════════════════════════
const bdir = 'backup-before-msgnotif-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — اضافه کردن اعلان به sendMessage
// ═══════════════════════════════════════════
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;

const oldSendMessage = `  if (error) { console.log('sendMessage error:', error.message); throw new Error(error.message); }
  return { success: true };
}`;

const newSendMessage = `  if (error) { console.log('sendMessage error:', error.message); throw new Error(error.message); }

  // 🔔 ساخت اعلان پیام (فقط اگه از این فرستنده اعلان نخوانده نداریم)
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
  } catch (e) { console.log('msg notif error:', e); }

  return { success: true };
}`;

if (n.includes(oldSendMessage)) {
  n = n.replace(oldSendMessage, newSendMessage);
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('✅ sendMessage آپدیت شد — اعلان پیام اضافه شد');
} else {
  console.log('❌ الگوی sendMessage پیدا نشد!');
  console.log('   فایل دست نخورده موند.');
  process.exit(1);
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen.tsx — اضافه new_message به texts + badge
// ═══════════════════════════════════════════
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ۲.۱ اضافه به texts
const textsAnchor = 'virtual_message: `💬 پیام جدید از ${p.from || "کاربر"}`,';
if (s.includes(textsAnchor) && !s.includes('new_message:')) {
  s = s.replace(textsAnchor, 'new_message: `💬 پیام جدید از ${p.from_name || p.from_email || "کاربر"}`,\n                ' + textsAnchor);
  console.log('✅ new_message به texts اضافه شد');
} else if (!s.includes('new_message:')) {
  // اگه virtual_message نبود، از hawala_new استفاده کن
  const alt = 'hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency}`,';
  if (s.includes(alt)) {
    s = s.replace(alt, alt + '\n                new_message: `💬 پیام جدید از ${p.from_name || p.from_email || "کاربر"}`,');
    console.log('✅ new_message به texts اضافه شد (روش دوم)');
  }
}

// ۲.۲ اضافه new_message به badge
const fxAnchor = "else if (t === 'fx_new' || t === 'fx_taken') rId = 'fx_' + p.offerId;";
if (s.includes(fxAnchor) && !s.includes("t === 'new_message'")) {
  s = s.replace(fxAnchor, fxAnchor + "\n                          else if (t === 'new_message') rId = p.room_id;");
  console.log('✅ new_message به badge اضافه شد');
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy "' + bdir + '\\lib.network.ts" lib.network.ts');
console.log('   copy "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');