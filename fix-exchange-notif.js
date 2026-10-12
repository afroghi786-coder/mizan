const fs = require('fs');
let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. چک: آیا notifModal هست؟
// ═══════════════════════════════════════════
if (!s.includes('notifList')) {
  console.log('❌ ExchangeScreen مودال اعلان نداره');
  console.log('ℹ️  باید اول یک مودال اعلان بسازیم');
  process.exit(0);
}

console.log('✅ notifModal هست');

// ═══════════════════════════════════════════
// ۲. پیدا کردن openChatWith یا معادل
// ═══════════════════════════════════════════
const hasOpenChat = s.includes('openChatWith');
console.log('openChatWith:', hasOpenChat ? '✅' : '❌');

// ═══════════════════════════════════════════
// ۳. اضافه کردن openChatFromNotif اگر نیست
// ═══════════════════════════════════════════
if (!s.includes('openChatFromNotif')) {
  // پیدا کردن اولین تابع async
  const anchor = s.indexOf('const submit');
  const anchor2 = s.indexOf('const load');
  const useAnchor = anchor > 0 ? anchor : (anchor2 > 0 ? anchor2 : -1);
  
  if (useAnchor > 0) {
    // پیدا کردن انتهای خط
    const lineEnd = s.indexOf('\n', useAnchor);
    
    const newFn = `
  // 🔔 باز کردن چت از اعلان
  const openChatFromNotif = (nt: any) => {
    const p = nt.payload || {};
    const fromEmail = p.from_email || p.fromEmail || '';
    const fromName = p.from_name || p.fromName || fromEmail.split('@')[0] || 'کسی';
    const fromCity = p.from_city || p.fromCity || '';

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
    if (typeof setNotifModal === 'function') setNotifModal(false);
    // باز کردن چت بعد از کمی صبر
    setTimeout(() => {
      // اگر openChatWith هست استفاده کن
      if (typeof (window as any).__openChatWith === 'function') {
        (window as any).__openChatWith(roomId, fromEmail, fromName, fromCity);
      }
    }, 200);
  };
`;
    s = s.substring(0, lineEnd) + newFn + s.substring(lineEnd);
    console.log('✅ openChatFromNotif اضافه شد');
    n++;
  }
}

// ═══════════════════════════════════════════
// ۴. اضافه کردن دکمه پیام به هر اعلان
// ═══════════════════════════════════════════
// الگوی کارت اعلان — مشابه LiveMarketScreen
const patterns = [
  // الگو ۱: با n.created_at و تاریخ fa-IR
  {
    old: `{n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                </View>
              );`,
    new: `{n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                  {((n.payload?.from_email) || (n.payload?.fromEmail)) ? (
                    <TouchableOpacity
                      onPress={() => openChatFromNotif(n)}
                      style={{ marginTop: 10, backgroundColor: '#0891b2', paddingVertical: 8, borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>💬 پیام</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );`,
  },
  // الگو ۲: با marginTop متفاوت
  {
    old: `{n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                </View>`,
    new: `{n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                  {((n.payload?.from_email) || (n.payload?.fromEmail)) ? (
                    <TouchableOpacity
                      onPress={() => openChatFromNotif(n)}
                      style={{ marginTop: 10, backgroundColor: '#0891b2', paddingVertical: 8, borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>💬 پیام</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>`,
  },
];

let matched = false;
for (const p of patterns) {
  if (s.includes(p.old)) {
    s = s.replace(p.old, p.new);
    console.log('✅ دکمه 💬 پیام اضافه شد');
    matched = true;
    n++;
    break;
  }
}

if (!matched) {
  console.log('⚠️ الگوی کارت اعلان پیدا نشد');
  // چاپ محدوده notifModal
  const idx = s.indexOf('notifList.map');
  if (idx > 0) {
    console.log('\n═══ محدوده notifList.map ═══');
    console.log(s.substring(idx, idx + 1500));
  }
}

// ═══════════════════════════════════════════
// ۵. ذخیره
// ═══════════════════════════════════════════
if (s !== orig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\n⚠️ تغییری اعمال نشد');
}