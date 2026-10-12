// fix-market-bell.js — 🔔 نوتیف + فیکس رنگ + لیست پیام‌ها
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. اضافه state های نوتیف و پیام
// ═══════════════════════════════════════════
if (!s.includes('notifList')) {
  s = s.replace(
    'const [favCats, setFavCats] = useState<string[]>([]);',
    `const [favCats, setFavCats] = useState<string[]>([]);
  const [notifModal, setNotifModal] = useState(false);
  const [notifList, setNotifList] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myAdsCount, setMyAdsCount] = useState(0);`
  );
  console.log('✅ state ها اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۲. polling پیام‌های نخوانده
// ═══════════════════════════════════════════
if (!s.includes('fetchMyUnreadMessages')) {
  s = s.replace(
    "  useEffect(() => { load(); }, [load]);",
    `  useEffect(() => { load(); }, [load]);

  // polling پیام‌های نخوانده — هر ۳ ثانیه
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        const list = await (m as any).fetchMyUnreadMessages?.();
        if (!alive) return;
        setNotifList(list || []);
        setUnreadCount((list || []).length);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);`
  );
  console.log('✅ polling پیام‌ها اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۳. اضافه 🔔 به هدر بازار (کنار ⚙️)
// ═══════════════════════════════════════════
const oldSettingsBtn = `          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>`;

const newSettingsBtn = `          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            <TouchableOpacity onPress={() => setNotifModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {unreadCount > 0 ? (
                <View style={st.badge}>
                  <Text style={st.badgeTxt}>{unreadCount > 9 ? '۹+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </TouchableOpacity>
          </View>`;

if (s.includes(oldSettingsBtn)) {
  s = s.replace(oldSettingsBtn, newSettingsBtn);
  console.log('✅ 🔔 به هدر اضافه شد');
  n++;
} else {
  console.log('⚠️ دکمه ⚙️ پیدا نشد');
}

// ═══════════════════════════════════════════
// ۴. مودال لیست نوتیف‌ها + مودال تنظیمات با رنگ درست
// ═══════════════════════════════════════════
// پیدا کردن شروع مودال تنظیمات
const settingsStart = s.indexOf('{/* ═══ مودال تنظیمات بازار ═══ */}');
const settingsEnd = s.indexOf('{/* مودال چت */}');

if (settingsStart > 0 && settingsEnd > settingsStart) {
  // حذف مودال قدیمی
  s = s.substring(0, settingsStart) + s.substring(settingsEnd);
  console.log('✅ مودال قدیمی حذف شد (برای جایگزینی با رنگ درست)');
}

// اضافه هر دو مودال
const newModals = `      {/* ═══ 🔔 مودال اعلان‌ها ═══ */}
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={() => setNotifModal(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: '#f59e0b' }]}>
            <Text style={st.mTitle}>🔔 اعلان‌ها ({notifList.length})</Text>
            <TouchableOpacity onPress={() => setNotifModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 12, maxHeight: 480 }}>
            {notifList.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Text style={{ fontSize: 50, marginBottom: 10 }}>📭</Text>
                <Text style={{ color: '#94a3b8', fontSize: 14 }}>هنوز اعلانی نیست</Text>
                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>وقتی کسی به آگهی‌ات پیام بدهد، اینجا می‌بینی</Text>
              </View>
            ) : notifList.map((m: any, i: number) => {
              const sender = m.from_name || m.from_email?.split('@')[0] || 'کسی';
              const peerEmail = m.from_email;
              const adId = (m.room_id || '').replace('ad_', '');
              return (
                <TouchableOpacity
                  key={m.id || i}
                  onPress={() => {
                    setNotifModal(false);
                    // باز کردن چت
                    setChatRoom({ id: m.room_id, type: 'public_ad' });
                    setChatPeer({ email: peerEmail, name: sender, adId: adId, adTitle: '' });
                    setChatInput('');
                    setChatMessages([]);
                    setChatModal(true);
                  }}
                  style={st.notifRow}
                  activeOpacity={0.7}
                >
                  <View style={[st.notifIcon, { backgroundColor: subColor + '20' }]}>
                    <Text style={{ fontSize: 20 }}>💬</Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={st.notifTitle}>💬 {sender}</Text>
                    <Text style={st.notifText} numberOfLines={2}>{m.text || '...'}</Text>
                    <Text style={st.notifTime}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                  {!m.is_read ? <View style={st.notifDot} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ ⚙️ مودال تنظیمات بازار ═══ */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={st.mTitle}>⚙️ تنظیمات بازار عمومی</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>

            <Text style={st.settingsSection}>🔔 صدا و هشدار</Text>
            {[
              { k: 'm_sound',   l: '🔊 صدا هنگام اعلان' },
              { k: 'm_vibrate', l: '📳 لرزش گوشی' },
              { k: 'm_browser', l: '💬 نوتیف مرورگر' },
            ].map((x: any) => (
              <View key={x.k} style={st.settingsRow}>
                <Text style={st.settingsLabel}>{x.l}</Text>
                <Switch
                  value={marketPrefs[x.k] !== false}
                  onValueChange={(v: boolean) => setMarketPrefs({ ...marketPrefs, [x.k]: v })}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            <Text style={st.settingsSection}>📢 اعلان‌های بازار</Text>
            {[
              { k: 'm_new_ad_city', l: '🆕 آگهی جدید در شهر من' },
              { k: 'm_new_ad_cat',  l: '🏷️ آگهی جدید در دسته‌های من' },
              { k: 'm_chat_msg',    l: '💬 پیام جدید در چت آگهی من' },
              { k: 'm_saved_ad',    l: '⭐ ذخیره آگهی من' },
            ].map((x: any) => (
              <View key={x.k} style={st.settingsRow}>
                <Text style={st.settingsLabel}>{x.l}</Text>
                <Switch
                  value={marketPrefs[x.k] !== false}
                  onValueChange={(v: boolean) => setMarketPrefs({ ...marketPrefs, [x.k]: v })}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            <Text style={st.settingsSection}>🏙️ شهرهای مورد علاقه</Text>
            <View style={st.settingsChipsWrap}>
              {CITY_KEYS.map(c => {
                const on = favCities.includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setFavCities(on ? favCities.filter(x => x !== c) : [...favCities, c])}
                    style={[st.chip, on && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                  >
                    <Text style={[st.chipTxt, on && { color: '#fff', fontWeight: 'bold' }]}>{CITIES[c]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.settingsSection}>🏷️ دسته‌های مورد علاقه</Text>
            <View style={st.settingsChipsWrap}>
              {SUBS.map(x => {
                const on = favCats.includes(x.k);
                return (
                  <TouchableOpacity
                    key={x.k}
                    onPress={() => setFavCats(on ? favCats.filter(y => y !== x.k) : [...favCats, x.k])}
                    style={[st.chip, on && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                  >
                    <Text style={[st.chipTxt, on && { color: '#fff', fontWeight: 'bold' }]}>{x.i} {x.l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => { saveMarketPrefs(); showToast?.('✅ ذخیره شد'); setSettingsModal(false); }}
              style={[st.btn, { backgroundColor: '#059669', marginTop: 18 }]}
            >
              <Text style={st.btnTxt}>💾 ذخیره تنظیمات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                try {
                  const nt = await import('./lib.notifications');
                  (nt as any).playNotifSound?.();
                  (nt as any).vibrateNotif?.();
                  showToast?.('🔔 صدا + لرزش');
                } catch (e) { showToast?.('❌ خطا', true); }
              }}
              style={[st.btn, { backgroundColor: '#0ea5e9', marginTop: 8 }]}
            >
              <Text style={st.btnTxt}>🔔 تست صدا و لرزش</Text>
            </TouchableOpacity>

          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال چت */}`;

if (s.includes('{/* مودال چت */}')) {
  s = s.replace('{/* مودال چت */}', newModals);
  console.log('✅ مودال نوتیف + مودال تنظیمات (با رنگ درست) اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۵. پیام روی کارت آگهی + دکمه پیام سریع
// ═══════════════════════════════════════════
// اضافه دکمه 📩 کنار آگهی
const oldChatBtn = `              {a.user_email && a.user_email !== userEmail ? (
                <TouchableOpacity onPress={() => openChat(a)} style={[st.chatBtn, { backgroundColor: subColor }]}>
                  <Text style={st.chatBtnTxt}>💬 چت</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#64748b', fontSize: 11 }}>آگهی خودم</Text>
              )}`;

const newChatBtn = `              {a.user_email && a.user_email !== userEmail ? (
                <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                  <TouchableOpacity onPress={() => openChat(a)} style={[st.chatBtn, { backgroundColor: subColor }]}>
                    <Text style={st.chatBtnTxt}>💬 چت</Text>
                  </TouchableOpacity>
                  {a.phone ? (
                    <TouchableOpacity style={[st.chatBtn, { backgroundColor: '#059669' }]}>
                      <Text style={st.chatBtnTxt}>📞 تماس</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Text style={{ color: '#64748b', fontSize: 11 }}>آگهی خودم</Text>
              )}`;

if (s.includes(oldChatBtn)) {
  s = s.replace(oldChatBtn, newChatBtn);
  console.log('✅ دکمه‌های چت + تماس روی کارت اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۶. استایل‌های جدید + فیکس رنگ
// ═══════════════════════════════════════════
if (!s.includes('notifRow')) {
  s = s.replace(
    '  settingsSection: {',
    `  // نوتیف
  notifRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0a1628', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  notifIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 3 },
  notifText: { color: '#cbd5e1', fontSize: 12, textAlign: 'right', lineHeight: 18 },
  notifTime: { color: '#64748b', fontSize: 10, textAlign: 'right', marginTop: 4 },
  notifDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginLeft: 6 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // فیکس رنگ متن تنظیمات
  settingsSection: {`
  );
  console.log('✅ استایل‌های نوتیف اضافه شد');
  n++;
}

// فیکس رنگ لابل تنظیمات اگر نیست
if (!s.includes("settingsLabel: { color: '#fff'")) {
  s = s.replace(
    /settingsLabel:\s*\{[^}]+\},/,
    "settingsLabel: { color: '#fff', fontSize: 13, textAlign: 'right', flex: 1, lineHeight: 20 },"
  );
  console.log('✅ رنگ لابل تنظیمات فیکس شد');
  n++;
}

if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ هیچ تغییری اعمال نشد');
}