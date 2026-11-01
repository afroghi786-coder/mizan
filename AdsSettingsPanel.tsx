import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Image, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getAdsConfig, saveAdsConfig,
  getAdsQueue, addAdToQueue, removeAdFromQueue, clearAdsQueue,
  getAdsHistory, clearAdsHistory,
} from './lib.assistant';

export default function AdsSettingsPanel({ showToast }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>({
    enabled: false, interval_minutes: 60, channel_name: '', channel_link: '',
    send_to_channel: true,
    send_to_telegram: false, telegram_token: '', telegram_chat_id: '',
    send_to_facebook: false, facebook_page_id: '', facebook_page_token: '',
    send_to_instagram: false, instagram_user_id: '', instagram_token: '',
    whatsapp: false, last_sent_at: 0,
  });
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [adText, setAdText] = useState('');
  const [adImage, setAdImage] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const reloadQueue = async () => { try { const q = await getAdsQueue(); setQueue(Array.isArray(q) ? q : []); } catch {} };
  const reloadHistory = async () => { try { const h = await getAdsHistory(); setHistory(Array.isArray(h) ? h : []); } catch {} };

  useEffect(() => {
    (async () => {
      try { const a = await getAdsConfig(); if (a) setCfg((p: any) => ({ ...p, ...a })); } catch {}
      await reloadQueue(); await reloadHistory(); setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try { await saveAdsConfig(cfg); showToast?.('✅ تنظیمات دستیار تبلیغات ذخیره شد'); }
    catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    finally { setSaving(false); }
  };

  const sendNow = async () => {
    try {
      await saveAdsConfig({ ...cfg, enabled: true, last_sent_at: 0 });
      setCfg((p: any) => ({ ...p, enabled: true, last_sent_at: 0 }));
      showToast?.('🚀 ارسال فوری فعال شد؛ تا ۳۰ ثانیه آینده ارسال می‌شود');
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };

  const pickImage = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (!r.canceled && r.assets && r.assets[0]?.uri) setAdImage(r.assets[0].uri);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا در انتخاب عکس'), true); }
  };

  const addAd = async () => {
    const text = String(adText || '').trim();
    if (!text) { showToast?.('❌ متن تبلیغ خالی است', true); return; }
    setAdding(true);
    try {
      await addAdToQueue({ text, imageUri: adImage || '', imageUrl: adImageUrl || '' });
      setAdText(''); setAdImage(''); setAdImageUrl('');
      await reloadQueue();
      showToast?.('✅ تبلیغ به صف اضافه شد');
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    finally { setAdding(false); }
  };

  const removeAt = async (i: number) => { await removeAdFromQueue(i); await reloadQueue(); showToast?.('🗑️ از صف حذف شد'); };
  const clearAll = async () => { await clearAdsQueue(); await reloadQueue(); showToast?.('🧹 صف خالی شد'); };
  const clearHist = async () => { await clearAdsHistory(); await reloadHistory(); showToast?.('🧹 تاریخچه خالی شد'); };

  const shareAd = async (item: any) => {
    try {
      const message = String(item?.text || '');
      const url = String(item?.imageUrl || '').trim();
      await Share.share({ message: url ? message + '\n' + url : message });
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا در اشتراک‌گذاری'), true);
    }
  };

  const retryAd = async (h: any) => {
    try {
      await addAdToQueue({ text: h?.text || '', imageUri: h?.imageUri || '', imageUrl: h?.imageUrl || '' });
      await reloadQueue();
      showToast?.('🔁 تبلیغ به صف برگشت');
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };

  const destBadges = (h: any) => {
    const items = [
      h?.rubika ? 'روبیکا' : null,
      h?.telegram ? 'تلگرام' : null,
      h?.facebook ? 'فیسبوک' : null,
      h?.instagram ? 'اینستاگرام' : null,
      h?.whatsapp ? 'واتساپ' : null,
    ].filter(Boolean);
    return items.length ? items.join(' · ') : '—';
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#f59e0b" /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <Text style={s.title}>📣 تنظیمات دستیار تبلیغات</Text>

      <View style={s.row}><Text style={s.lbl}>فعال بودن دستیار تبلیغات</Text><Switch value={!!cfg.enabled} onValueChange={(v) => setCfg({ ...cfg, enabled: v })} /></View>

      <Text style={s.lbl}>بازه ارسال (دقیقه)</Text>
      <TextInput style={s.inp} keyboardType="numeric" value={String(cfg.interval_minutes ?? '')} onChangeText={(v) => setCfg({ ...cfg, interval_minutes: Number(v.replace(/[^0-9]/g, '')) || 0 })} placeholder="مثلاً 60" />

      <Text style={s.lbl}>نام کانال مقصد</Text>
      <TextInput style={s.inp} value={String(cfg.channel_name || '')} onChangeText={(v) => setCfg({ ...cfg, channel_name: v })} placeholder="مثلاً c0... یا نام کانال" />

      <Text style={s.lbl}>لینک کانال مقصد</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.channel_link || '')} onChangeText={(v) => setCfg({ ...cfg, channel_link: v })} placeholder="https://rubika.ir/..." />

      <View style={s.row}><Text style={s.lbl}>ارسال به کانال روبیکا</Text><Switch value={!!cfg.send_to_channel} onValueChange={(v) => setCfg({ ...cfg, send_to_channel: v })} /></View>

      <View style={s.row}><Text style={s.lbl}>ارسال به تلگرام</Text><Switch value={!!cfg.send_to_telegram} onValueChange={(v) => setCfg({ ...cfg, send_to_telegram: v })} /></View>
      <Text style={s.lbl}>توکن ربات تلگرام</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.telegram_token || '')} onChangeText={(v) => setCfg({ ...cfg, telegram_token: v })} placeholder="123456:ABC-DEF..." />
      <Text style={s.lbl}>Chat ID کانال/گروه تلگرام</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.telegram_chat_id || '')} onChangeText={(v) => setCfg({ ...cfg, telegram_chat_id: v })} placeholder="-100..." />

      <View style={s.row}><Text style={s.lbl}>ارسال به صفحه فیسبوک</Text><Switch value={!!cfg.send_to_facebook} onValueChange={(v) => setCfg({ ...cfg, send_to_facebook: v })} /></View>
      <Text style={s.lbl}>Page ID فیسبوک</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.facebook_page_id || '')} onChangeText={(v) => setCfg({ ...cfg, facebook_page_id: v })} placeholder="1234567890" />
      <Text style={s.lbl}>Page Access Token فیسبوک</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.facebook_page_token || '')} onChangeText={(v) => setCfg({ ...cfg, facebook_page_token: v })} placeholder="EAAB..." />

      <View style={s.row}><Text style={s.lbl}>ارسال به اینستاگرام بیزینس</Text><Switch value={!!cfg.send_to_instagram} onValueChange={(v) => setCfg({ ...cfg, send_to_instagram: v })} /></View>
      <Text style={s.lbl}>Instagram User ID</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.instagram_user_id || '')} onChangeText={(v) => setCfg({ ...cfg, instagram_user_id: v })} placeholder="178414..." />
      <Text style={s.lbl}>Instagram Access Token</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.instagram_token || '')} onChangeText={(v) => setCfg({ ...cfg, instagram_token: v })} placeholder="EAAB..." />

      <View style={s.row}><Text style={s.lbl}>ارسال به واتساپ (Cloud API)</Text><Switch value={!!cfg.send_to_whatsapp} onValueChange={(v) => setCfg({ ...cfg, send_to_whatsapp: v })} /></View>
      <Text style={s.lbl}>WhatsApp Phone Number ID</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.whatsapp_phone_number_id || '')} onChangeText={(v) => setCfg({ ...cfg, whatsapp_phone_number_id: v })} placeholder="1234567890" />
      <Text style={s.lbl}>WhatsApp Cloud Token</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.whatsapp_token || '')} onChangeText={(v) => setCfg({ ...cfg, whatsapp_token: v })} placeholder="EAAB..." />
      <Text style={s.lbl}>نام قالب تأییدشده</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.whatsapp_template_name || '')} onChangeText={(v) => setCfg({ ...cfg, whatsapp_template_name: v })} placeholder="ad_broadcast" />
      <Text style={s.lbl}>زبان قالب</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={String(cfg.whatsapp_template_lang || '')} onChangeText={(v) => setCfg({ ...cfg, whatsapp_template_lang: v })} placeholder="fa" />
      <Text style={s.lbl}>شماره‌های گیرنده (با کاما جدا کن)</Text>
      <TextInput style={[s.inp, { minHeight: 60 }]} multiline value={String(cfg.whatsapp_recipients || '')} onChangeText={(v) => setCfg({ ...cfg, whatsapp_recipients: v })} placeholder="93700000000,93711111111" />

      <TouchableOpacity style={s.btn} onPress={save} disabled={saving}>
        <Text style={s.btnTxt}>{saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات تبلیغات'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={sendNow}>
        <Text style={s.btnTxt}>🚀 ارسال فوری اولین تبلیغ صف</Text>
      </TouchableOpacity>

      <Text style={[s.title, { marginTop: 24 }]}>➕ افزودن تبلیغ به صف</Text>
      <TextInput style={[s.inp, { minHeight: 80 }]} multiline value={adText} onChangeText={setAdText} placeholder="متن تبلیغ را وارد کنید..." />
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#0ea5e9' }]} onPress={pickImage}>
          <Text style={s.btnTxt}>🖼️ انتخاب عکس (اختیاری)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#10b981' }]} onPress={addAd} disabled={adding}>
          <Text style={s.btnTxt}>{adding ? '...' : '➕ افزودن به صف'}</Text>
        </TouchableOpacity>
      </View>
      {adImage ? <Image source={{ uri: adImage }} style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 8 }} /> : null}
      <Text style={s.lbl}>لینک عمومی عکس برای اینستاگرام (اختیاری، باید HTTPS و JPEG باشد)</Text>
      <TextInput style={s.inp} autoCapitalize="none" value={adImageUrl} onChangeText={setAdImageUrl} placeholder="https://.../image.jpg" />

      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <Text style={s.title}>📋 صف تبلیغات ({queue.length})</Text>
        {queue.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={{ backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>🧹 خالی کردن</Text>
          </TouchableOpacity>
        )}
      </View>

      {queue.length === 0 && <Text style={s.empty}>صف خالی است.</Text>}
      {queue.map((q: any, i: number) => (
        <View key={i} style={s.card}>
          {q.imageUri ? <Image source={{ uri: q.imageUri }} style={{ width: '100%', height: 120, borderRadius: 6, marginBottom: 6 }} /> : null}
          <Text style={s.cardTxt} numberOfLines={4}>{q.text}</Text>
          {q.imageUrl ? <Text style={s.cardSub} numberOfLines={1}>URL: {q.imageUrl}</Text> : null}
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={s.cardSub}>{String(q.created_at || '').slice(0, 16)}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity onPress={() => shareAd(q)} style={{ backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#1e40af', fontWeight: 'bold', fontSize: 11 }}>📲 اشتراک‌گذاری</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeAt(i)} style={{ backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#991b1b', fontWeight: 'bold', fontSize: 11 }}>🗑️ حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <Text style={s.title}>📜 تاریخچه ارسال ({history.length})</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={clearHist} style={{ backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>🧹 خالی کردن</Text>
          </TouchableOpacity>
        )}
      </View>
      {history.length === 0 && <Text style={s.empty}>تاریچه‌ای نیست.</Text>}
      {history.slice().reverse().slice(0, 50).map((h: any, i: number) => (
        <View key={i} style={s.card}>
          <Text style={s.cardTxt} numberOfLines={3}>{h.text}</Text>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={[s.cardSub, { color: h.status === 'sent' ? '#059669' : '#dc2626' }]}>{h.status === 'sent' ? '✅ ارسال شد' : '❌ ناموفق'}</Text>
            <Text style={s.cardSub}>{String(h.sent_at || '').slice(0, 16)}</Text>
          </View>
          {h.error ? <Text style={[s.cardSub, { color: '#dc2626', marginTop: 4 }]}>{h.error}</Text> : null}
          <TouchableOpacity onPress={() => shareAd(h)} style={{ alignSelf: 'flex-end', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 6 }}>
            <Text style={{ color: '#1e40af', fontWeight: 'bold', fontSize: 11 }}>📲 اشتراک‌گذاری</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 10 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'right', backgroundColor: '#fff', color: '#0f2438' },
  btn: { backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 16, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTxt: { color: '#0f2438', fontSize: 12, textAlign: 'right' },
  cardSub: { color: '#94a3b8', fontSize: 10 },
});
