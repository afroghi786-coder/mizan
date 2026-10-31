import { requestAdminChatCapture } from './lib.assistant.rubika';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from './lib.storage';
import { telegramPing, telegramGetUpdates } from './lib.assistant.telegram';
import { rubikaPing, rubikaGetUpdates, rubikaSendMessage, rubikaExtractChannelId, rubikaSendPhoto, buildOrderButton, rubikaSendMessageDebug, buildChannelPostText, rubikaExtractAdminChatId } from './lib.assistant.rubika';
import { getBotConfig, saveBotConfig, getWatcherConfig, saveWatcherConfig, getWatcherSources, saveWatcherSources, getAdsConfig, saveAdsConfig, getSecureStorageMode } from './lib.assistant';



export default function SettingsAssistant({ showToast }: any) {
  const [activeTab, setActiveTab] = useState('bot');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [botConfig, setBotConfig] = useState({
    telegram_token: '', telegram_enabled: false,
    rubika_token: '', rubika_enabled: false, rubika_channel_id: '', rubika_admin_chat_id: '', sleep_enabled: true, sleep_start: '20:00', sleep_end: '08:00', sleep_message: '🌙 ربات در حال استراحت است. لطفاً بعداً پیام دهید.',
    whatsapp_token: '', whatsapp_phone: '', whatsapp_enabled: false, order_mode: 'both',
  });

  const [watcherConfig, setWatcherConfig] = useState({
    enabled: false, accessibility_granted: false, last_scan_at: '',
  });

  const [sources, setSources] = useState([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', platform: 'telegram', link: '', type: 'rate' });

  const [rubikaResultVisible, setRubikaResultVisible] = useState(false);
  const [rubikaResultTitle, setRubikaResultTitle] = useState('');
  const [rubikaResultBody, setRubikaResultBody] = useState('');

  const [adsConfig, setAdsConfig] = useState({
    enabled: false,
    channel_name: '',
    channel_link: '',
    send_to_channel: true,
    send_to_members: false,
    send_to_social: false,
    instagram: false,
    facebook: false,
    whatsapp: false,
    daily_limit: 10,
    schedule_start: '09:00',
    schedule_end: '22:00',
    sent_today: 0,
    queued_count: 0,
    last_sent_at: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const b = await getBotConfig();
        if (b) setBotConfig((prev) => ({ ...prev, ...b }));
        const w = await getWatcherConfig();
        if (w) setWatcherConfig((prev) => ({ ...prev, ...w }));
        const s = await getWatcherSources();
        if (Array.isArray(s)) setSources(s);
        const a = await getAdsConfig();
        if (a) setAdsConfig((prev) => ({ ...prev, ...a }));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const saveBot = async () => {
    setSaving(true);
    try {
      await saveBotConfig(botConfig);
      showToast?.('✅ تنظیمات دستیار فروش ذخیره شد (توکن‌ها در فاز نهایی به SecureStore منتقل می‌شوند)');
    } catch (e: any) { showToast?.(e?.message || 'خطا', true); }
    finally { setSaving(false); }
  };

  const saveWatcher = async () => {
    setSaving(true);
    try {
      await saveWatcherConfig(watcherConfig);
      await saveWatcherSources(sources);
      showToast?.('✅ تنظیمات دیده‌بان ذخیره شد');
    } catch (e: any) { showToast?.(e?.message || 'خطا', true); }
    finally { setSaving(false); }
  };

  const saveAds = async () => {
    setSaving(true);
    try {
      await saveAdsConfig(adsConfig);
      showToast?.('✅ تنظیمات دستیار تبلیغات ذخیره شد');
    } catch (e: any) { showToast?.(e?.message || 'خطا', true); }
    finally { setSaving(false); }
  };

  const addSource = () => {
    if (!newSource.name || !newSource.link) { showToast?.('نام و لینک الزامی است', true); return; }
    const src = {
      id: 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: newSource.name,
      platform: newSource.platform,
      link: newSource.link,
      type: newSource.type,
      enabled: true,
      added_at: new Date().toISOString(),
    };
    setSources([...sources, src]);
    setNewSource({ name: '', platform: 'telegram', link: '', type: 'rate' });
    setShowAddSource(false);
    showToast?.('✅ کانال اضافه شد — برای اعمال، ذخیره را بزنید');
  };

  const removeSource = (id: string) => {
    setSources(sources.filter((s: any) => s.id !== id));
    showToast?.('🗑 کانال حذف شد — برای اعمال، ذخیره را بزنید');
  };

  const toggleSource = (id: string) => {
    setSources(sources.map((s: any) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  if (loading) return <ActivityIndicator color="#0ea5e9" style={{ marginTop: 20 }} />;

  const secureMode = getSecureStorageMode();
  const secureModeWarning = secureMode === 'secure' ? null : (
    <View style={{ padding: 8, backgroundColor: '#fef3c7', borderRadius: 6, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b' }}>
      <Text style={{ fontSize: 10, color: '#92400e', textAlign: 'right' }}>
        ⚠️ حافظه امن روی این دستگاه فعال نیست. توکن‌ها موقتاً در حافظه معمولی ذخیره می‌شوند. برای امنیت کامل، از نسخه اندروید یا iOS استفاده کنید.
      </Text>
    </View>
  );

  const inputStyle = { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 8, textAlign: 'left', backgroundColor: '#fff' };
  const labelStyle = { fontSize: 11, color: '#64748b', marginBottom: 4, textAlign: 'right' };
  const cardStyle = { padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 12 };

  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>🤝 دستیار فروش</Text>
      <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 12 }}>
        دو بخش مستقل با یک هسته مشترک. هر کدام جداگانه فعال می‌شوند.
      </Text>

      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setActiveTab('bot')} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: activeTab === 'bot' ? '#7c3aed' : '#e2e8f0', alignItems: 'center' }}>
          <Text style={{ color: activeTab === 'bot' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 11 }}>🤝 دستیار فروش</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('watcher')} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: activeTab === 'watcher' ? '#0ea5e9' : '#e2e8f0', alignItems: 'center' }}>
          <Text style={{ color: activeTab === 'watcher' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 11 }}>👁️ دیده‌بان</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('ads')} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: activeTab === 'ads' ? '#f59e0b' : '#e2e8f0', alignItems: 'center' }}>
          <Text style={{ color: activeTab === 'ads' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 11 }}>📣 تبلیغات</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'bot' && (
        <View>
          {secureModeWarning}
          <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>🤝 دستیار فروش میزان</Text>
          <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 8 }}>
            این دستیار فروش با توکن رسمی هر پلتفرم کار می‌کند. توکن‌ها فعلاً به‌عنوان جای‌نگهدار ذخیره می‌شوند و در فاز نهایی به SecureStore منتقل خواهند شد.
          </Text>
          <View style={{ padding: 8, backgroundColor: '#fef3c7', borderRadius: 6, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b' }}>
            <Text style={{ fontSize: 10, color: '#92400e', textAlign: 'right' }}>
              ⚠️ این بخش در حال ساخت است. توکن‌ها هنوز به API متصل نمی‌شوند.
            </Text>
          </View>

          <View style={cardStyle}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'right' }}>📱 تلگرام</Text>
              <Switch value={botConfig.telegram_enabled} onValueChange={(v) => setBotConfig({ ...botConfig, telegram_enabled: v })} />
            </View>
            <Text style={labelStyle}>توکن دستیار فروش (BotFather)</Text>
            <TextInput value={botConfig.telegram_token} onChangeText={(v) => setBotConfig({ ...botConfig, telegram_token: v })} placeholder="123456:ABC-DEF..." style={inputStyle} />
            <TouchableOpacity disabled={!botConfig.telegram_token} onPress={async () => {
              showToast?.('⏳ در حال تست اتصال تلگرام...');
              const r = await telegramPing(botConfig.telegram_token);
              if (r.ok) showToast?.('✅ اتصال برقرار است — @' + (r.username || '') + ' ' + (r.name || ''));
              else showToast?.('❌ ' + (r.error || 'اتصال برقرار نشد'), true);
            }} style={{ backgroundColor: botConfig.telegram_token ? '#0ea5e9' : '#94a3b8', padding: 8, borderRadius: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🔌 تست اتصال در تلگرام</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!botConfig.telegram_token} onPress={async () => {
              showToast?.('⏳ در حال دریافت پیام‌های تلگرام...');
              const r = await telegramGetUpdates(botConfig.telegram_token);
              if (r.ok) {
                if (r.count === 0) showToast?.('📭 پیام جدیدی نیست');
                else showToast?.('📨 ' + r.count + ' پیام — آخرین: ' + (r.lastChat || '') + ' — ' + (r.lastText || '').slice(0, 60));
              } else {
                showToast?.('❌ ' + (r.error || 'دریافت ناموفق'), true);
              }
            }} style={{ backgroundColor: botConfig.telegram_token ? '#0f766e' : '#94a3b8', padding: 8, borderRadius: 6, marginTop: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📥 تست دریافت پیام از تلگرام</Text>
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'right' }}>📱 روبیکا</Text>
              <Switch value={botConfig.rubika_enabled} onValueChange={(v) => setBotConfig({ ...botConfig, rubika_enabled: v })} />
            </View>
            <Text style={labelStyle}>توکن دستیار فروش (پنل روبیکا)</Text>
            <TextInput value={botConfig.rubika_token} onChangeText={(v) => setBotConfig({ ...botConfig, rubika_token: v })} placeholder="توکن دستیار فروش روبیکا" style={inputStyle} />
            <Text style={labelStyle}>شناسه کانال روبیکا (مثلاً @mychannel)</Text>
            <TextInput value={botConfig.rubika_channel_id || ''} onChangeText={(v) => setBotConfig({ ...botConfig, rubika_channel_id: v })} placeholder="@mychannel" autoCapitalize="none" style={inputStyle} />
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 8, marginBottom: 4, textAlign: 'right' }}>شناسه چت ادمین (برای دریافت فاکتورها)</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6, alignItems: 'center' }}>
              <TextInput value={botConfig.rubika_admin_chat_id || ''} onChangeText={(v) => setBotConfig({ ...botConfig, rubika_admin_chat_id: v })} placeholder="مثلاً b123456" autoCapitalize="none" style={[inputStyle, { flex: 1 }]} />

            <TouchableOpacity disabled={!botConfig.rubika_token} onPress={async () => {
                const r = await rubikaExtractAdminChatId(botConfig.rubika_token);
                if (r.ok && r.chat_id) {
                  setBotConfig((prev: any) => ({ ...prev, rubika_admin_chat_id: r.chat_id }));
                  showToast?.('✅ شناسه چت ادمین دریافت شد');
                } else {
                  showToast?.(r.error || 'شناسه پیدا نشد', true);
                }
              }} style={{ backgroundColor: botConfig.rubika_token ? '#0ea5e9' : '#94a3b8', padding: 8, borderRadius: 6, marginTop: 6, marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>🔍 دریافت خودکار شناسه ادمین</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!botConfig.rubika_token || !botConfig.rubika_admin_chat_id} onPress={async () => {
                const r = await rubikaSendMessage(botConfig.rubika_token, botConfig.rubika_admin_chat_id, '✅ این یک پیام تست است. شناسه ادمین شما به درستی ثبت شده است.');
                if (r.ok) showToast?.('✅ پیام تست به چت ادمین ارسال شد. لطفاً روبیکا را چک کنید.');
                else showToast?.('❌ خطا در ارسال: ' + r.error, true);
              }} style={{ backgroundColor: (botConfig.rubika_token && botConfig.rubika_admin_chat_id) ? '#10b981' : '#94a3b8', padding: 8, borderRadius: 6, marginTop: 6, marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>✅ تست شناسه ادمین</Text>
            </TouchableOpacity>
              <TouchableOpacity disabled={!botConfig.rubika_token} onPress={async () => {
                await requestAdminChatCapture();
                showToast?.('📩 لطفاً یک پیام در چت خصوصی ربات بفرستید تا شناسه ثبت شود');
              }} style={{ backgroundColor: botConfig.rubika_token ? '#0ea5e9' : '#94a3b8', padding: 8, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>دریافت خودکار</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12, padding: 10, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>🌙 ساعت خواب ربات</Text>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 12 }}>فعال</Text>
                <Switch value={!!botConfig.sleep_enabled} onValueChange={(v) => setBotConfig({ ...botConfig, sleep_enabled: v })} />
              </View>
              <Text style={{ fontSize: 11, textAlign: 'right', marginBottom: 2 }}>از ساعت (مثلاً 20:00)</Text>
              <TextInput value={botConfig.sleep_start || '20:00'} onChangeText={(v) => setBotConfig({ ...botConfig, sleep_start: v })} placeholder="20:00" style={inputStyle} />
              <Text style={{ fontSize: 11, textAlign: 'right', marginTop: 6, marginBottom: 2 }}>تا ساعت (مثلاً 08:00)</Text>
              <TextInput value={botConfig.sleep_end || '08:00'} onChangeText={(v) => setBotConfig({ ...botConfig, sleep_end: v })} placeholder="08:00" style={inputStyle} />
              <Text style={{ fontSize: 11, textAlign: 'right', marginTop: 6, marginBottom: 2 }}>پیام خاموشی</Text>
              <TextInput value={botConfig.sleep_message || ''} onChangeText={(v) => setBotConfig({ ...botConfig, sleep_message: v })} placeholder="متن پیام" style={inputStyle} />
            </View>
            <TouchableOpacity disabled={!botConfig.rubika_token} onPress={async () => {
              showToast?.('⏳ در حال دریافت شناسه کانال از روبیکا...');
              const r = await rubikaExtractChannelId(botConfig.rubika_token);
              const ok = !!r.ok;
              const lines = [];
              lines.push('وضعیت: ' + (ok ? '✅ موفق' : '❌ ناموفق'));
              if (ok && r.channel_id) {
                setBotConfig((prev: any) => ({ ...prev, rubika_channel_id: r.channel_id }));
                lines.push('شناسه کانال: ' + r.channel_id);
                lines.push('در فیلد ذخیره شد. دکمه «💾 ذخیره تنظیمات دستیار فروش» را بزن.');
              }
              if (r.count !== undefined) lines.push('تعداد به‌روزرسانی: ' + r.count);
              if (!ok && r.error) lines.push('خطا: ' + r.error);
              if (r.request) lines.push('درخواست: ' + JSON.stringify(r.request).slice(0, 600));
              if (r.raw) lines.push('پاسخ خام: ' + String(r.raw).slice(0, 1200));
              if (r.raw) lines.push('\nپاسخ خام روبیکا:\n' + r.raw);
              setRubikaResultTitle(ok ? 'شناسه کانال روبیکا' : 'خطای دریافت شناسه کانال');
              setRubikaResultBody(lines.join('\n'));
              setRubikaResultVisible(true);
            }} style={{ backgroundColor: botConfig.rubika_token ? '#0f766e' : '#94a3b8', padding: 8, borderRadius: 6, marginBottom: 8 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📥 دریافت شناسه کانال از روبیکا</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!botConfig.rubika_token} onPress={async () => {
              showToast?.('⏳ در حال تست اتصال روبیکا...');
              const r = await rubikaPing(botConfig.rubika_token);
              const ok = !!r.ok;
              const label = r.username ? ('@' + r.username) : (r.name || '');
              const lines = [];
              lines.push('وضعیت: ' + (ok ? '✅ موفق' : '❌ ناموفق'));
              if (label) lines.push('شناسه: ' + label);
              if (!ok && r.error) lines.push('خطا: ' + r.error);
              if (r.raw) lines.push('\nپاسخ خام روبیکا:\n' + r.raw);
              setRubikaResultTitle(ok ? 'نتیجه تست اتصال روبیکا' : 'خطای اتصال روبیکا');
              setRubikaResultBody(lines.join('\n'));
              setRubikaResultVisible(true);
            }} style={{ backgroundColor: botConfig.rubika_token ? '#0ea5e9' : '#94a3b8', padding: 8, borderRadius: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🔌 تست اتصال در روبیکا</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={!botConfig.rubika_token || !botConfig.rubika_channel_id} onPress={async () => {
              showToast?.('⏳ در حال ارسال پیام تست به کانال...');
              const r = await rubikaSendMessage(botConfig.rubika_token, botConfig.rubika_channel_id, '✅ تست ارسال از دستیار میزان');
              const ok = !!r.ok;
              const lines = [];
              lines.push('وضعیت: ' + (ok ? '✅ موفق' : '❌ ناموفق'));
              if (r.message_id) lines.push('شناسه پیام: ' + r.message_id);
              if (!ok && r.error) lines.push('خطا: ' + r.error);
              setRubikaResultTitle(ok ? 'نتیجه ارسال به کانال' : 'خطای ارسال به کانال');
              setRubikaResultBody(lines.join('\n'));
              setRubikaResultVisible(true);
            }} style={{ backgroundColor: (botConfig.rubika_token && botConfig.rubika_channel_id) ? '#7c3aed' : '#94a3b8', padding: 8, borderRadius: 6, marginTop: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📤 تست ارسال پیام به کانال</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={!botConfig.rubika_token || !botConfig.rubika_channel_id} onPress={async () => {
              showToast?.('⏳ در حال ارسال متن هوشمند...');
              const sampleProduct = { code: 'TEST-001', name: 'کفش اسپرت مدل تست', price: 850000, color: 'سفید' };
              const botUsername = 'TamaddonBOT';
              const caption = buildChannelPostText(sampleProduct, botUsername);
              
              // ارسال فقط متن (بدون عکس) برای تست
              const r = await rubikaSendMessage(botConfig.rubika_token, botConfig.rubika_channel_id, caption);
              
              const ok = !!r.ok;
              const lines = [];
              lines.push('وضعیت: ' + (ok ? '✅ موفق' : '❌ ناموفق'));
              if (!ok && r.error) lines.push('خطا: ' + r.error);
              if (r.raw) lines.push('پاسخ خام: ' + String(r.raw).slice(0, 800));
              setRubikaResultTitle(ok ? 'پست هوشمند متن‌محور' : 'خطای ارسال پست متنی');
              setRubikaResultBody(lines.join('\n'));
              setRubikaResultVisible(true);
            }} style={{ backgroundColor: (botConfig.rubika_token && botConfig.rubika_channel_id) ? '#10b981' : '#94a3b8', padding: 8, borderRadius: 6, marginTop: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📝 تست ارسال پست هوشمند (بدون عکس)</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={!botConfig.rubika_token || !botConfig.rubika_channel_id} onPress={async () => {
              showToast?.('⏳ در حال ارسال متن ساده...');
              const r = await rubikaSendMessage(botConfig.rubika_token, botConfig.rubika_channel_id, '✅ این یک پیام متنی ساده است (بدون دکمه)');
              const ok = !!r.ok;
              const lines = [];
              lines.push('وضعیت: ' + (ok ? '✅ موفق' : '❌ ناموفق'));
              if (r.message_id) lines.push('شناسه پیام: ' + r.message_id);
              if (!ok && r.error) lines.push('خطا: ' + r.error);
              if (r.raw) lines.push('پاسخ خام: ' + String(r.raw).slice(0, 500));
              setRubikaResultTitle(ok ? 'نتیجه ارسال متن ساده' : 'خطای ارسال متن ساده');
              setRubikaResultBody(lines.join('\n'));
              setRubikaResultVisible(true);
            }} style={{ backgroundColor: (botConfig.rubika_token && botConfig.rubika_channel_id) ? '#10b981' : '#94a3b8', padding: 8, borderRadius: 6, marginTop: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📝 تست ارسال متن ساده</Text>
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', textAlign: 'right' }}>📱 واتساپ</Text>
              <Switch value={botConfig.whatsapp_enabled} onValueChange={(v) => setBotConfig({ ...botConfig, whatsapp_enabled: v })} />
            </View>
            <Text style={labelStyle}>شماره تجاری واتساپ</Text>
            <TextInput value={botConfig.whatsapp_phone} onChangeText={(v) => setBotConfig({ ...botConfig, whatsapp_phone: v })} placeholder="+93700000000" style={inputStyle} />
            <Text style={labelStyle}>توکن دسترسی (Meta)</Text>
            <TextInput value={botConfig.whatsapp_token} onChangeText={(v) => setBotConfig({ ...botConfig, whatsapp_token: v })} placeholder="EAAB..." style={inputStyle} />
            <TouchableOpacity disabled={!botConfig.whatsapp_token} onPress={() => showToast?.('🔌 تست اتصال در فاز بعدی فعال می‌شود')} style={{ backgroundColor: botConfig.whatsapp_token ? '#0ea5e9' : '#94a3b8', padding: 8, borderRadius: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🔌 تست اتصال در واتساپ</Text>
            </TouchableOpacity>
          </View>

          
          <View style={cardStyle}>
            <Text style={{ fontWeight: 'bold', textAlign: 'right', marginBottom: 8 }}>🛍️ تنظیمات نوع فروش</Text>
            <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 8 }}>
              مشتری هنگام خرید، بر اساس این تنظیمات می‌تواند سفارش دهد.
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              {[{ k: 'pair', l: '👟 جفتی' }, { k: 'carton', l: '📦 کارتنی' }, { k: 'both', l: '⚖️ هر دو' }].map((opt) => (
                <TouchableOpacity
                  key={opt.k}
                  onPress={() => setBotConfig({ ...botConfig, order_mode: opt.k })}
                  style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: (botConfig.order_mode || 'both') === opt.k ? '#7c3aed' : '#e2e8f0', alignItems: 'center' }}
                >
                  <Text style={{ color: (botConfig.order_mode || 'both') === opt.k ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 11 }}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity disabled={saving} onPress={saveBot} style={{ backgroundColor: '#059669', padding: 10, borderRadius: 8 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>{saving ? '⏳...' : '💾 ذخیره تنظیمات دستیار فروش'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'watcher' && (
        <View>
          {secureModeWarning}
          <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>👁️ دیده‌بان میزان</Text>
          <View style={{ padding: 10, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#92400e', textAlign: 'right', fontWeight: 'bold', marginBottom: 4 }}>⚠️ هشدار مهم</Text>
            <Text style={{ fontSize: 10, color: '#92400e', textAlign: 'right' }}>
              دیده‌بان فقط روی اندروید و با دسترسی Accessibility کار می‌کند. این قابلیت آزمایشی است و فقط کانال‌های معرفی‌شده را می‌خواند. مسئولیت استفاده با خود شماست.
            </Text>
          </View>

          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold', textAlign: 'right' }}>فعال‌سازی دیده‌بان</Text>
            <Switch value={watcherConfig.enabled} onValueChange={(v) => setWatcherConfig({ ...watcherConfig, enabled: v })} />
          </View>

          <View style={{ padding: 10, backgroundColor: '#eff6ff', borderRadius: 8, borderWidth: 1, borderColor: '#93c5fd', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e40af', textAlign: 'right', fontWeight: 'bold', marginBottom: 4 }}>🔐 دسترسی Accessibility</Text>
            <Text style={{ fontSize: 10, color: '#1e40af', textAlign: 'right', marginBottom: 6 }}>
              وضعیت: {watcherConfig.accessibility_granted ? '✅ فعال' : '❌ غیرفعال'}
            </Text>
            <TouchableOpacity onPress={() => showToast?.('این دکمه در فاز بعدی به تنظیمات Accessibility اندروید وصل می‌شود')} style={{ backgroundColor: '#1e40af', padding: 8, borderRadius: 6 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>باز کردن تنظیمات دسترسی</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontWeight: 'bold', textAlign: 'right' }}>کانال‌های مجاز ({sources.length})</Text>
            <TouchableOpacity onPress={() => setShowAddSource(true)} style={{ backgroundColor: '#0ea5e9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ افزودن</Text>
            </TouchableOpacity>
          </View>

          {sources.length === 0 && (
            <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: 16 }}>هیچ کانالی اضافه نشده.</Text>
          )}

          {sources.map((src: any) => (
            <View key={src.id} style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', textAlign: 'right', flex: 1 }}>📱 {src.name}</Text>
                <Switch value={src.enabled} onValueChange={() => toggleSource(src.id)} />
              </View>
              <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{src.link}</Text>
              <Text style={{ fontSize: 10, color: '#475569', textAlign: 'right' }}>نوع: {src.type === 'rate' ? 'نرخ ارز' : src.type === 'gold' ? 'طلا' : src.type === 'crypto' ? 'کریپتو' : 'عمومی'}</Text>
              <TouchableOpacity onPress={() => removeSource(src.id)} style={{ marginTop: 6, padding: 4, backgroundColor: '#dc2626', borderRadius: 4 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 10 }}>🗑 حذف</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity disabled={saving} onPress={saveWatcher} style={{ backgroundColor: '#059669', padding: 10, borderRadius: 8, marginTop: 12 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>{saving ? '⏳...' : '💾 ذخیره تنظیمات دیده‌بان'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={rubikaResultVisible} transparent animationType="slide" onRequestClose={() => setRubikaResultVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '85%' }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' }}>{rubikaResultTitle}</Text>
            <TextInput
              value={rubikaResultBody}
              editable={false}
              multiline
              selectable
              style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, minHeight: 160, maxHeight: 320, textAlign: 'left', backgroundColor: '#f8fafc', fontSize: 12 }}
            />
            <TouchableOpacity onPress={() => setRubikaResultVisible(false)} style={{ marginTop: 12, backgroundColor: '#64748b', padding: 10, borderRadius: 8 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddSource} transparent animationType="slide" onRequestClose={() => setShowAddSource(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, textAlign: 'right' }}>➕ افزودن کانال</Text>

            <Text style={labelStyle}>نام نمایشی</Text>
            <TextInput value={newSource.name} onChangeText={(v) => setNewSource({ ...newSource, name: v })} placeholder="مثلاً نرخ ارز بازار" style={inputStyle} />

            <Text style={labelStyle}>پلتفرم</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setNewSource({ ...newSource, platform: 'telegram' })} style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: newSource.platform === 'telegram' ? '#0ea5e9' : '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ color: newSource.platform === 'telegram' ? '#fff' : '#475569', fontWeight: 'bold' }}>📱 تلگرام</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNewSource({ ...newSource, platform: 'rubika' })} style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: newSource.platform === 'rubika' ? '#0ea5e9' : '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ color: newSource.platform === 'rubika' ? '#fff' : '#475569', fontWeight: 'bold' }}>📱 روبیکا</Text>
              </TouchableOpacity>
            </View>

            <Text style={labelStyle}>لینک یا شناسه کانال</Text>
            <TextInput value={newSource.link} onChangeText={(v) => setNewSource({ ...newSource, link: v })} placeholder="https://t.me/channelname" autoCapitalize="none" style={inputStyle} />

            <Text style={labelStyle}>نوع محتوا</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {[{ k: 'rate', l: '💵 نرخ ارز' }, { k: 'gold', l: '🥇 طلا' }, { k: 'crypto', l: '₿ کریپتو' }, { k: 'general', l: '📰 عمومی' }].map((t) => (
                <TouchableOpacity key={t.k} onPress={() => setNewSource({ ...newSource, type: t.k })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: newSource.type === t.k ? '#7c3aed' : '#e2e8f0' }}>
                  <Text style={{ color: newSource.type === t.k ? '#fff' : '#475569', fontSize: 11, fontWeight: 'bold' }}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowAddSource(false)} style={{ flex: 1, padding: 10, borderRadius: 6, backgroundColor: '#64748b' }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addSource} style={{ flex: 2, padding: 10, borderRadius: 6, backgroundColor: '#059669' }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>✅ افزودن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
