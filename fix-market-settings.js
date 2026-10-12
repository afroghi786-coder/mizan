// fix-market-settings.js — تنظیمات مخصوص بازار
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. حذف مودال تنظیمات قدیمی (کپی صرافی)
// ═══════════════════════════════════════════
// پیدا کردن مودال قدیمی
const oldStart = `      {/* مودال تنظیمات بازار */}`;
const oldEnd = `      {/* مودال چت */}`;

const startIdx = s.indexOf(oldStart);
const endIdx = s.indexOf(oldEnd);

if (startIdx > 0 && endIdx > startIdx) {
  // حذف کل بلوک قدیمی
  s = s.substring(0, startIdx) + s.substring(endIdx);
  console.log('✅ مودال قدیمی حذف شد');
  n++;
} else {
  console.log('⚠️ مودال قدیمی پیدا نشد');
}

// ═══════════════════════════════════════════
// ۲. اضافه کردن state های جدید بازار
// ═══════════════════════════════════════════
if (!s.includes('marketPrefs')) {
  s = s.replace(
    'const [prefs, setPrefs] = useState<any>({});',
    `const [prefs, setPrefs] = useState<any>({});
  const [marketPrefs, setMarketPrefs] = useState<any>({
    m_sound: true,
    m_vibrate: true,
    m_browser: true,
    m_new_ad_city: true,
    m_new_ad_cat: true,
    m_chat_msg: true,
    m_saved_ad: true,
  });
  const [favCities, setFavCities] = useState<string[]>(['KBL']);
  const [favCats, setFavCats] = useState<string[]>([]);`
  );
  console.log('✅ state ها اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۳. اضافه کردن load از localStorage
// ═══════════════════════════════════════════
if (!s.includes('mz_market_prefs')) {
  s = s.replace(
    'const cats = sub === \'jobs\' ? JOBS_CATS',
    `// بارگذاری تنظیمات بازار از localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mz_market_prefs');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.marketPrefs) setMarketPrefs(p.marketPrefs);
        if (p.favCities) setFavCities(p.favCities);
        if (p.favCats) setFavCats(p.favCats);
      }
    } catch {}
  }, []);

  const saveMarketPrefs = () => {
    try {
      localStorage.setItem('mz_market_prefs', JSON.stringify({
        marketPrefs, favCities, favCats,
      }));
    } catch {}
  };

  const cats = sub === 'jobs' ? JOBS_CATS`
  );
  console.log('✅ localStorage اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۴. اضافه کردن مودال تنظیمات جدید
// ═══════════════════════════════════════════
const newModal = `      {/* ═══ مودال تنظیمات بازار ═══ */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={st.mTitle}>⚙️ تنظیمات بازار عمومی</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>

            {/* بخش ۱: صدا و هشدار */}
            <Text style={st.settingsSection}>🔔 صدا و هشدار</Text>
            {[
              { k: 'm_sound',   l: '🔊 صدا هنگام اعلان' },
              { k: 'm_vibrate', l: '📳 لرزش گوشی' },
              { k: 'm_browser', l: '💬 نوتیف مرورگر / سیستم' },
            ].map(x => (
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

            {/* بخش ۲: اعلان‌های بازار */}
            <Text style={st.settingsSection}>📢 اعلان‌های بازار</Text>
            {[
              { k: 'm_new_ad_city', l: '🆕 آگهی جدید در شهر من' },
              { k: 'm_new_ad_cat',  l: '🏷️ آگهی جدید در دسته‌های من' },
              { k: 'm_chat_msg',    l: '💬 پیام جدید در چت آگهی من' },
              { k: 'm_saved_ad',    l: '⭐ ذخیره آگهی من' },
            ].map(x => (
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

            {/* بخش ۳: شهرهای مورد علاقه */}
            <Text style={st.settingsSection}>🏙️ شهرهای مورد علاقه</Text>
            <Text style={st.settingsHint}>آگهی‌های این شهرها را ببینید</Text>
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

            {/* بخش ۴: دسته‌های مورد علاقه */}
            <Text style={st.settingsSection}>🏷️ دسته‌های مورد علاقه</Text>
            <Text style={st.settingsHint}>آگهی‌های این دسته‌ها را ببینید</Text>
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

            {/* دکمه‌های پایین */}
            <TouchableOpacity
              onPress={() => { saveMarketPrefs(); showToast?.('✅ تنظیمات ذخیره شد'); setSettingsModal(false); }}
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
                } catch (e) { showToast?.('❌ خطا در تست', true); }
              }}
              style={[st.btn, { backgroundColor: '#0ea5e9', marginTop: 8 }]}
            >
              <Text style={st.btnTxt}>🔔 تست صدا و لرزش</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMarketPrefs({
                  m_sound: true, m_vibrate: true, m_browser: true,
                  m_new_ad_city: true, m_new_ad_cat: true,
                  m_chat_msg: true, m_saved_ad: true,
                });
                setFavCities(['KBL']);
                setFavCats([]);
                saveMarketPrefs();
                showToast?.('↩️ پیش‌فرض شد');
              }}
              style={[st.btn, { backgroundColor: '#64748b', marginTop: 8 }]}
            >
              <Text style={st.btnTxt}>↩️ بازگشت به پیش‌فرض</Text>
            </TouchableOpacity>

          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال چت */}`;

if (s.includes('{/* مودال چت */}')) {
  s = s.replace('{/* مودال چت */}', newModal);
  console.log('✅ مودال تنظیمات بازار اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ۵. اضافه استایل‌های جدید
// ═══════════════════════════════════════════
if (!s.includes('settingsSection')) {
  s = s.replace(
    '  mTitle: { color:',
    `  settingsSection: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', marginTop: 18, marginBottom: 8, textAlign: 'right' },
  settingsHint: { color: '#94a3b8', fontSize: 11, marginBottom: 8, textAlign: 'right' },
  settingsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#0a1628', borderRadius: 10, marginBottom: 8 },
  settingsLabel: { color: '#fff', fontSize: 13, textAlign: 'right', flex: 1 },
  settingsChipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  mTitle: { color:`
  );
  console.log('✅ استایل‌ها اضافه شد');
  n++;
}

// ═══════════════════════════════════════════
// ذخیره
// ═══════════════════════════════════════════
if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ هیچ تغییری اعمال نشد');
}