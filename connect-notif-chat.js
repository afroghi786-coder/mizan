// connect-notif-chat.js — وصل کردن هر اعلان به چت
const fs = require('fs');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. پیدا کردن تابع openChatWith
// ═══════════════════════════════════════════
const chatFnExists = s.includes('openChatWith');
console.log('openChatWith:', chatFnExists ? '✅ هست' : '❌ نیست');

// ═══════════════════════════════════════════
// ۲. اضافه کردن تابع openChatFromNotif
// ═══════════════════════════════════════════
if (!s.includes('openChatFromNotif')) {
  // پیدا کردن anchor — بعد از openChatWith
  const idx = s.indexOf('const openChatWith');
  if (idx > 0) {
    // پیدا کردن انتهای تابع
    let depth = 0;
    let end = idx;
    let started = false;
    for (let i = idx; i < s.length; i++) {
      if (s[i] === '{') { depth++; started = true; }
      else if (s[i] === '}') {
        depth--;
        if (started && depth === 0) {
          end = i + 1;
          if (s[end] === ';') end++;
          break;
        }
      }
    }

    const newFn = `

  // 🔔 باز کردن چت از اعلان
  const openChatFromNotif = (nt: any) => {
    const p = nt.payload || {};
    const fromEmail = p.from_email || p.fromEmail || '';
    const fromName = p.from_name || p.fromName || fromEmail.split('@')[0] || 'کسی';
    const fromCity = p.from_city || p.fromCity || '';

    // ساخت room_id بر اساس نوع اعلان
    let roomId = '';
    if (nt.type === 'hawala_taken' && p.taskId) roomId = 'hw_' + p.taskId;
    else if (nt.type === 'fx_taken' && p.offerId) roomId = 'fx_' + p.offerId;
    else if (nt.type === 'direct_hawala' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'direct_accepted' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'direct_delivered' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'fx_new' && p.offerId) roomId = 'fx_' + p.offerId;
    else if (nt.type === 'hawala_new' && p.hawalaId) roomId = 'hw_' + p.hawalaId;
    else roomId = 'nt_' + (nt.id || Date.now());

    // بستن مودال اعلان‌ها
    setNotifModal(false);
    // باز کردن چت
    setTimeout(() => {
      openChatWith(roomId, fromEmail, fromName, fromCity);
    }, 200);
  };`;

    s = s.substring(0, end) + newFn + s.substring(end);
    console.log('✅ openChatFromNotif اضافه شد');
    n++;
  } else {
    console.log('⚠️ openChatWith پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ۳. پیدا کردن مودال اعلان‌ها و اضافه کردن دکمه
// ═══════════════════════════════════════════
const hasNotifModal = s.includes('notifModal');
console.log('notifModal:', hasNotifModal ? '✅' : '❌');

// پیدا کردن map اعلان‌ها در مودال
// الگو: notifList.map((n: any) => { ... return ( ... )
const notifMapPatterns = [
  /(notifList\.map\(\(n: any,\s*i: number\)\s*=>\s*\{[\s\S]*?return\s*\()/,
  /(notifList\.map\(\(n: any\)\s*=>\s*\{[\s\S]*?return\s*\()/,
  /(notifList\.map\(\((?:n|item|msg): any[^)]*\)\s*=>\s*\{[\s\S]*?return\s*\()/,
];

let matchedPattern = null;
let matchResult = null;
for (const p of notifMapPatterns) {
  const m = s.match(p);
  if (m) {
    matchedPattern = p;
    matchResult = m;
    break;
  }
}

if (matchResult) {
  console.log('✅ الگوی notifList.map پیدا شد');
  
  // در داخل هر notification، یک دکمه پیام اضافه کن
  // باید داخل View کارت اعلان باشه
  
  // روش ساده: پیدا کردن `{!n.is_read ?` یا `نوع اعلان` و اضافه دکمه بعدش
  // ولی چون نمی‌دونم ساختار دقیق چیه، یک روش دیگه:
  
  // پیدا کردن `texts[n.type]` یا `const msg =` — بعدش دکمه اضافه کن
  const msgVarPattern = /(const\s+msg\s*=\s*texts\[[^\]]+\]\s*\|\|[^;]+;)/;
  const msgMatch = s.match(msgVarPattern);
  
  if (msgMatch) {
    console.log('✅ msg variable پیدا شد');
    // اضافه نکردن اینجا چون داخل return نیست
  }
  
  // بهترین روش: جستجو در کل مودال notifModal
  const notifModalStart = s.indexOf('visible={notifModal}');
  if (notifModalStart > 0) {
    // پیدا کردن انتهای مودال
    const modalStart = s.lastIndexOf('<Modal', notifModalStart);
    let depth = 0;
    let modalEnd = modalStart;
    let foundFirst = false;
    for (let i = modalStart; i < s.length; i++) {
      if (s.substring(i, i + 6) === '<Modal') { depth++; foundFirst = true; i += 5; }
      else if (s.substring(i, i + 8) === '</Modal>') {
        depth--;
        if (foundFirst && depth === 0) {
          modalEnd = i + 8;
          break;
        }
        i += 7;
      }
    }
    
    const modalContent = s.substring(modalStart, modalEnd);
    
    // چک: قبلاً دکمه اضافه شده؟
    if (modalContent.includes('openChatFromNotif')) {
      console.log('ℹ️ دکمه پیام از قبل هست');
    } else {
      // پیدا کردن TouchableOpacity کارت اعلان
      // الگو: onPress={() => { setNotifModal(false); setHawalaModal(true); }} یا مشابه
      // یا: style={[s.card...]} یا هر جایی که کارت اعلان رندر می‌شه
      
      // روش ۱: پیدا کردن یک onPress که setNotifModal(false) داره
      const onPressPattern = /(onPress=\{\(\)\s*=>\s*\{[^}]*setNotifModal\(false\)[^}]*\}[^}]*\})/;
      
      // روش ۲ (مطمئن‌تر): پیدا کردن `<View key={n.id || i}` یا مشابه در modal content
      const cardViewPattern = /(<View key=\{(?:n\.id|item\.id|msg\.id|i)[^}]*\}[^>]*>)/;
      const cardMatch = modalContent.match(cardViewPattern);
      
      if (cardMatch) {
        console.log('✅ کارت اعلان پیدا شد:', cardMatch[0].substring(0, 80));
        
        // دکمه رو بعد از View اضافه می‌کنیم، اما مطمئن نیستیم ساختار داخلی چیه
        // راه بهتر: پیدا کردن آخرین `</TouchableOpacity>` یا `</View>` در کارت
        
        // چون نمی‌تونم ساختار رو دقیق ببینم، از یک روش دیگه استفاده می‌کنم:
        // پیدا کردن `{texts[n.type] || '🔔 اعلان جدید'}` یا مشابه و اضافه دکمه بعدش
        
        // بهتره از یک uniqueId استفاده کنم — به کاربر می‌گم manual fix بده
        console.log('⚠️ ساختار کارت پیدا شد ولی برای دقیق بودن نیاز به Manual Fix دارم');
      } else {
        console.log('⚠️ کارت اعلان پیدا نشد');
      }
    }
  }
} else {
  console.log('⚠️ الگوی notifList.map پیدا نشد');
}

// ═══════════════════════════════════════════
// ۴. صرف‌نظر از نتیجه، ذخیره
// ═══════════════════════════════════════════
if (s !== orig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('\\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ تغییر اعمال نشد');
}

// ═══════════════════════════════════════════
// ۵. چاپ محدوده notifModal برای بررسی
// ═══════════════════════════════════════════
console.log('\\n═══ محدوده مودال اعلان‌ها ═══');
const nmIdx = s.indexOf('visible={notifModal}');
if (nmIdx > 0) {
  // پیدا کردن شروع
  const startIdx = s.lastIndexOf('<Modal', nmIdx);
  console.log(s.substring(startIdx, Math.min(startIdx + 3000, s.length)));
}