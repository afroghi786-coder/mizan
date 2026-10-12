const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-chatroom-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ═══════════════════════════════════════════
// ۱. اضافه new_message به شرط‌های room_id
// ═══════════════════════════════════════════
const anchor = "else if (nt.type === 'hawala_new' && p.hawalaId) roomId = 'hw_' + p.hawalaId;";

if (s.includes(anchor) && !s.includes("nt.type === 'new_message'")) {
  const insert = "\n    else if (nt.type === 'new_message' && p.room_id) roomId = p.room_id;";
  s = s.replace(anchor, anchor + insert);
  console.log('✅ new_message به openChatFromNotif اضافه شد');
} else if (s.includes("nt.type === 'new_message'")) {
  console.log('ℹ️ از قبل بود');
} else {
  console.log('❌ anchor پیدا نشد!');
  console.log('   دنبال این خط می‌گردم:');
  console.log('   ' + anchor);
  process.exit(1);
}

// ═══════════════════════════════════════════
// ۲. چک: اگه room_id خالیه، fallback به همون else
// ═══════════════════════════════════════════
// (دیگه نیازی نیست، شرط بالا اگه room_id نداشت می‌ره توی else)

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');