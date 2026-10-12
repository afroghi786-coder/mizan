// add-settings.js — اضافه کردن مودال تنظیمات به PublicMarketScreen
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══ ۱. اضافه دکمه ⚙️ در هدر ═══
const oldHeader = `          {onBack ? (
            <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
              <Text style={st.backBtnTxt}>‹ بازگشت</Text>
            </TouchableOpacity>
          ) : <View style={st.backBtn} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <View style={st.backBtn} />`;

const newHeader = `          {onBack ? (
            <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
              <Text style={st.backBtnTxt}>‹ بازگشت</Text>
            </TouchableOpacity>
          ) : <View style={st.backBtn} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>`;

if (s.includes(oldHeader)) {
  s = s.replace(oldHeader, newHeader);
  console.log('✅ دکمه ⚙️ اضافه شد');
  n++;
} else {
  console.log('⚠️ الگوی هدر پیدا نشد');
}

// ═══ ۲. اضافه مودال تنظیمات قبل از مودال چت ═══
const oldModalMarker = `      {/* مودال چت */}`;
const settingsModal = `      {/* مودال تنظیمات بازار */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={st.mTitle}>⚙️ تنظیمات اعلان‌های بازار</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>
            {[
              { k: 'notify_sound',        l: '🔔 صدا هنگام اعلان' },
              { k: 'notify_vibrate',      l: '📳 لرزش گوشی' },
              { k: 'notify_browser',      l: '💬 نوتیف مرورگر / سیستم' },
              { k: 'notify_hawala_claim', l: '✅ کسی حواله من را قبول کرد' },
              { k: 'notify_fx_claim',     l: '✅ کسی آگهی ارز من را خرید' },
              { k: 'notify_direct',       l: '🔒 حواله خصوصی جدید' },
              { k: 'notify_hawala_new',   l: '📤 حواله جدید در شهر من' },
              { k: 'notify_fx_new',       l: '💱 آگهی فروش ارز جدید' },
            ].map((x: any) => (
              <View key={x.k} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#0a1628', borderRadius: 10, marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', flex: 1 }}>{x.l}</Text>
                <Switch
                  value={prefs[x.k] !== false}
                  onValueChange={(v: boolean) => setPrefs({ ...prefs, [x.k]: v })}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={async () => {
                try {
                  const m = await import('./lib.network');
                  await (m as any).savePreferences?.(prefs);
                  showToast?.('✅ تنظیمات ذخیره شد');
                  setSettingsModal(false);
                } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
              }}
              style={[st.btn, { backgroundColor: '#059669', marginTop: 14 }]}
            >
              <Text style={st.btnTxt}>💾 ذخیره تنظیمات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                try {
                  const m = await import('./lib.network');
                  await (m as any).savePreferences?.(prefs);
                  showToast?.('✅ تست صدا');
                } catch (e: any) {}
                try {
                  const nt = await import('./lib.notifications');
                  (nt as any).playNotifSound?.();
                } catch {}
              }}
              style={[st.btn, { backgroundColor: '#0ea5e9', marginTop: 8 }]}
            >
              <Text style={st.btnTxt}>🔔 تست صدا</Text>
            </TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال چت */}`;

if (s.includes(oldModalMarker)) {
  s = s.replace(oldModalMarker, settingsModal);
  console.log('✅ مودال تنظیمات اضافه شد');
  n++;
} else {
  console.log('⚠️ نشانگر مودال چت پیدا نشد');
}

// ═══ ۳. استایل دکمه تنظیمات ═══
const oldStyle = `  backBtn: { width: 90, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },`;
const newStyle = `  backBtn: { width: 90, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },`;

if (s.includes(oldStyle)) {
  s = s.replace(oldStyle, newStyle);
  console.log('✅ استایل دکمه اضافه شد');
  n++;
}

if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ هیچ تغییری اعمال نشد');
}