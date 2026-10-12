const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ امن
// ═══════════════════════════════════════════
const backupDir = 'backup-before-badges-v3-' + Date.now();
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(backupDir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ در: ' + backupDir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ═══════════════════════════════════════════
// ۱. دیاگنوستیک
// ═══════════════════════════════════════════
console.log('═══ دیاگنوستیک ═══');
console.log('__chatBadgeAdded__ count: ' + (s.match(/__chatBadgeAdded__/g) || []).length);
console.log('__bellBadgeAdded__ count: ' + (s.match(/__bellBadgeAdded__/g) || []).length);
console.log('💬 پیام count: ' + (s.match(/💬 پیام/g) || []).length);
console.log('openChatFromNotif count: ' + (s.match(/openChatFromNotif/g) || []).length);

// ═══════════════════════════════════════════
// ۲. حذف همه chat badge ها
// ═══════════════════════════════════════════
const chatBadgeRegex = /\{\(\(\)[\s\S]{0,2000}?\}\)\(\)\}\{\/\*\s*__chatBadgeAdded__\s*\*\/\}/g;
const removed1 = (s.match(chatBadgeRegex) || []).length;
s = s.replace(chatBadgeRegex, '');
console.log('');
console.log('🗑 حذف ' + removed1 + ' chat badge قدیمی');

// ═══════════════════════════════════════════
// ۳. حذف همه bell badge ها
// ═══════════════════════════════════════════
const bellBadgeRegex = /\{\(\(\)[\s\S]{0,2000}?\}\)\(\)\}\{\/\*\s*__bellBadgeAdded__\s*\*\/\}/g;
const removed2 = (s.match(bellBadgeRegex) || []).length;
s = s.replace(bellBadgeRegex, '');
console.log('🗑 حذف ' + removed2 + ' bell badge قدیمی');

// ═══════════════════════════════════════════
// ۴. اضافه یک chat badge به هر دکمه پیام
// ═══════════════════════════════════════════
console.log('');
console.log('═══ اضافه chat badge (فقط یکی) ═══');

const chatTextRegex = /<Text[^>]*>💬 پیام<\/Text>/g;
let m;
const positions = [];
while ((m = chatTextRegex.exec(s)) !== null) {
  positions.push({ idx: m.index, text: m[0] });
}
console.log('تعداد 💬 پیام: ' + positions.length);

const chatBadge = `{(() => {
                          const p = (n && n.payload) || {};
                          const t = String((n && n.type) || '');
                          let rId = '';
                          if (t === 'direct_hawala' || t === 'direct_accepted') rId = 'dh_' + p.hawalaId;
                          else if (t === 'hawala_taken' || t === 'hawala_new') rId = 'hw_' + (p.taskId || p.hawalaId);
                          else if (t === 'fx_new' || t === 'fx_taken') rId = 'fx_' + p.offerId;
                          const cnt = notifUnread[rId] || 0;
                          return cnt > 0 ? (
                            <View style={{ backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, marginRight: 4 }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{cnt > 9 ? '۹+' : cnt}</Text>
                            </View>
                          ) : null;
                        })()}{/* __chatBadgeAdded__ */}`;

let addedCount = 0;
for (let i = positions.length - 1; i >= 0; i--) {
  const pos = positions[i];
  const before = s.substring(Math.max(0, pos.idx - 800), pos.idx);
  if (before.includes('openChatFromNotif')) {
    const insertAt = pos.idx + pos.text.length;
    s = s.substring(0, insertAt) + chatBadge + s.substring(insertAt);
    addedCount++;
  }
}
console.log('✅ اضافه شد: ' + addedCount + ' badge (فقط یکی برای هر دکمه)');

// ═══════════════════════════════════════════
// ۵. اضافه bell badge با position: relative
// ═══════════════════════════════════════════
console.log('');
console.log('═══ اضافه bell badge ═══');

const bellTargetIdx = s.indexOf('onPress={() => setNotifModal(true)}');
if (bellTargetIdx > 0) {
  const btnStart = s.lastIndexOf('<TouchableOpacity', bellTargetIdx);
  let depth = 0;
  let i = btnStart;
  let btnEnd = -1;
  while (i < s.length) {
    const nextOpen = s.indexOf('<TouchableOpacity', i + 1);
    const nextClose = s.indexOf('</TouchableOpacity>', i + 1);
    if (nextClose < 0) break;
    if (nextOpen > 0 && nextOpen < nextClose) { depth++; i = nextOpen + 1; }
    else { if (depth === 0) { btnEnd = nextClose + '</TouchableOpacity>'.length; break; } depth--; i = nextClose + 1; }
  }

  if (btnEnd > 0) {
    let btn = s.substring(btnStart, btnEnd);
    console.log('دکمه زنگ پیدا شد (' + btn.length + ' بایت)');

    // اطمینان از position: 'relative'
    if (!/position:\s*['"]relative['"]/.test(btn)) {
      if (btn.includes('style={{')) {
        const styleStart = btn.indexOf('style={{');
        const insertAt = styleStart + 'style={{'.length;
        btn = btn.substring(0, insertAt) + " position: 'relative'," + btn.substring(insertAt);
        console.log("✅ position: 'relative' به style اضافه شد");
      } else {
        const openEnd = btn.indexOf('>');
        btn = btn.substring(0, openEnd) + " style={{ position: 'relative' }}" + btn.substring(openEnd);
        console.log("✅ style با position اضافه شد");
      }
    } else {
      console.log("ℹ️ position: 'relative' از قبل هست");
    }

    const bellBadge = `{(() => { const c = (notifList || []).filter((x: any) => !x.is_read).length; return c > 0 ? (
                          <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, zIndex: 99999, elevation: 10 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{c > 99 ? '۹۹+' : c}</Text>
                          </View>
                        ) : null; })()}{/* __bellBadgeAdded__ */}`;

    const closeIdx = btn.lastIndexOf('</TouchableOpacity>');
    btn = btn.substring(0, closeIdx) + bellBadge + btn.substring(closeIdx);

    s = s.substring(0, btnStart) + btn + s.substring(btnEnd);
    console.log('✅ bell badge اضافه شد');
  }
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy "' + backupDir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');