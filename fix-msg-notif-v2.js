const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-msgnotif-v2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — آپدیت sendMessage با regex
// ═══════════════════════════════════════════
let n = fs.readFileSync('lib.network.ts', 'utf8');
console.log('📏 طول فایل lib.network.ts: ' + n.length);
console.log('📏 line ending: ' + (n.includes('\r\n') ? 'Windows (\\r\\n)' : 'Unix (\\n)'));
console.log('');

const nOrig = n;

// الگوی regex برای پیدا کردن بلوک sendMessage
// از "if (error) { console.log('sendMessage error:" تا "return { success: true };\n}"
const regex = /(if \(error\) \{ console\.log\('sendMessage error:', error\.message\); throw new Error\(error\.message\); \}\s*\r?\n\s*)(return \{ success: true \};\r?\n\})/;

const match = n.match(regex);
if (!match) {
  console.log('❌ الگوی sendMessage با regex پیدا نشد!');
  console.log('🔍 دنبال این خط می‌گردم:');
  console.log('   "if (error) { console.log(\'sendMessage error:\'"');
  const idx = n.indexOf("sendMessage error:");
  if (idx > 0) {
    console.log('   ✅ این خط پیدا شد در موقعیت ' + idx);
    console.log('   متن اطراف:');
    console.log(n.substring(idx - 100, idx + 200));
  } else {
    console.log('   ❌ حتی این خط هم نیست');
  }
  process.exit(1);
}

console.log('✅ الگو پیدا شد!');

// ساخت کد جدید
const notifCode = `  // 🔔 ساخت اعلان پیام (فقط اگه از این فرستنده اعلان نخوانده نداریم)
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

  `;

const replacement = match[1] + notifCode + match[2];
n = n.replace(regex, replacement);

if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('✅ sendMessage آپدیت شد');
} else {
  console.log('⚠️ تغییر نکرد');
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen.tsx — اضافه new_message
// ═══════════════════════════════════════════
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ۲.۱ اضافه به texts
if (!s.includes('new_message:')) {
  const textsAnchor = 'virtual_message: `💬 پیام جدید از ${p.from || "کاربر"}`,';
  if (s.includes(textsAnchor)) {
    s = s.replace(textsAnchor, 'new_message: `💬 پیام جدید از ${p.from_name || p.from_email || "کاربر"}`,\n                ' + textsAnchor);
    console.log('✅ new_message به texts اضافه شد');
  } else {
    const alt = 'hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency}`,';
    if (s.includes(alt)) {
      s = s.replace(alt, alt + '\n                new_message: `💬 پیام جدید از ${p.from_name || p.from_email || "کاربر"}`,');
      console.log('✅ new_message به texts اضافه شد (روش دوم)');
    } else {
      console.log('⚠️ anchor texts پیدا نشد');
    }
  }
} else {
  console.log('ℹ️ new_message از قبل هست');
}

// ۲.۲ اضافه به badge
if (!s.includes("t === 'new_message'")) {
  const fxAnchor = "else if (t === 'fx_new' || t === 'fx_taken') rId = 'fx_' + p.offerId;";
  if (s.includes(fxAnchor)) {
    s = s.replace(fxAnchor, fxAnchor + "\n                          else if (t === 'new_message') rId = p.room_id;");
    console.log('✅ new_message به badge اضافه شد');
  } else {
    console.log('⚠️ anchor badge پیدا نشد');
  }
} else {
  console.log('ℹ️ new_message در badge از قبل هست');
}

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