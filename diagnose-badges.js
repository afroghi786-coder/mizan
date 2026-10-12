const fs = require('fs');

console.log('═══════════════════════════════════════════');
console.log('۱. lib.network — آیا _sb صادر شده؟');
console.log('═══════════════════════════════════════════');
const net = fs.readFileSync('lib.network.ts', 'utf8');
const sbExports = net.match(/(export|module\.exports).*_sb/g) || [];
console.log('   تعداد export های _sb: ' + sbExports.length);
sbExports.forEach(e => console.log('   → ' + e));
console.log('   آیا _sb اصلاً تعریف شده؟ ' + (net.includes('_sb') ? '✅ بله' : '❌ نه'));
console.log('   آیا client از supabase ساخته؟ ' + (net.includes('createClient') ? '✅ بله' : '❌ نه'));

console.log('');
console.log('═══════════════════════════════════════════');
console.log('۲. LiveMarketScreen — badge code چک');
console.log('═══════════════════════════════════════════');
const lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');

// notifUnread state
console.log('   state notifUnread: ' + (lm.includes('const [notifUnread') ? '✅' : '❌'));

// useEffect setNotifUnread
console.log('   useEffect setNotifUnread: ' + (lm.includes('setNotifUnread(map)') ? '✅' : '❌'));

// bell badge
console.log('   __bellBadgeAdded__: ' + (lm.includes('__bellBadgeAdded__') ? '✅' : '❌'));

// chat badge
console.log('   __chatBadgeAdded__: ' + (lm.includes('__chatBadgeAdded__') ? '✅' : '❌'));

// notifList usage
console.log('   notifList.map: ' + (lm.includes('notifList.map') ? '✅' : '❌'));

console.log('');
console.log('═══════════════════════════════════════════');
console.log('۳. notifList چطور پر میشه؟');
console.log('═══════════════════════════════════════════');
const notifFetch = lm.match(/setNotifList\s*\([^)]{0,200}/g) || [];
console.log('   تعداد setNotifList: ' + notifFetch.length);
notifFetch.slice(0, 5).forEach((n, i) => console.log('   ' + (i+1) + '. ' + n.substring(0, 120).replace(/\s+/g, ' ')));

console.log('');
console.log('═══════════════════════════════════════════');
console.log('۴. net.email — آیا set میشه؟');
console.log('═══════════════════════════════════════════');
console.log('   net.email usage: ' + (lm.includes('net.email') ? '✅' : '❌'));
console.log('   net.email in useEffect: ' + (lm.includes('[notifList, net.email]') ? '✅' : '❌'));

console.log('');
console.log('═══════════════════════════════════════════');
console.log('۵. نمونه کد badge روی 🔔');
console.log('═══════════════════════════════════════════');
const bellIdx = lm.indexOf('__bellBadgeAdded__');
if (bellIdx > 0) {
  console.log(lm.substring(bellIdx - 400, bellIdx + 50));
} else {
  console.log('   ❌ پیدا نشد');
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('۶. نمونه کد badge روی 💬 پیام');
console.log('═══════════════════════════════════════════');
const chatIdx = lm.indexOf('__chatBadgeAdded__');
if (chatIdx > 0) {
  console.log(lm.substring(chatIdx - 500, chatIdx + 50));
} else {
  console.log('   ❌ پیدا نشد');
}