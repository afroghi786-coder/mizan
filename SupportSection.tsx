import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { checkLicense, LicenseInfo } from './license';
import { getQueueCount } from './lib.offline';
import LicenseRequest from './LicenseRequest';
import { createSupportTicket, getMySupportTickets, flushSupportQueue, getSupportQueueCount, getSupportUnreadCount, getSupportUnreadCountsByTicket } from './lib.support';
import { getSupportSettings, SupportSettings } from './lib.supportSettings';
import { pollSupportUserNotifications } from './lib.supportNotify';
import SupportChatBox from './SupportChatBox';

export default function SupportSection({ showToast, initialTicketId }: any) {
  const [lic, setLic] = useState<LicenseInfo | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [supportQueue, setSupportQueue] = useState(0);
  const [showRequest, setShowRequest] = useState(false);
  const [formType, setFormType] = useState<'issue'|'feature'|'contact'>('issue');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [openTicket, setOpenTicket] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [contactInfo, setContactInfo] = useState<SupportSettings>({ phone: '', email: '', whatsapp: '', telegram: '', channel: '', address: '', working_hours: '' });

  const load = async () => {
    try { const r = await checkLicense(); setLic(r); } catch {}
    try { const q = await getQueueCount(); setQueueCount(Number(q) || 0); } catch {}
    try { const sq = await getSupportQueueCount(); setSupportQueue(sq); } catch {}
    try { const t = await getMySupportTickets(); setTickets(Array.isArray(t) ? t : []); } catch {}
    try { const uc = await getSupportUnreadCount(); setUnread(Number(uc) || 0); } catch {}
    try { const m = await getSupportUnreadCountsByTicket(); setUnreadMap(m || {}); } catch {}
    try { const s = await getSupportSettings(); setContactInfo(s); } catch {}
  };

  useEffect(() => {
    (async () => { await flushSupportQueue(); await pollSupportUserNotifications(); await load(); })();
    const iv = setInterval(async () => { await pollSupportUserNotifications(); await load(); }, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!initialTicketId || !tickets.length) return;
    const found = tickets.find((x: any) => String(x.id) === String(initialTicketId));
    if (found) setOpenTicket(found);
  }, [initialTicketId, tickets]);

  const statusText = () => {
    if (!lic) return 'در حال بررسی...';
    if (lic.status === 'active') return '✅ فعال';
    if (lic.status === 'expired') return '⛔ منقضی شده';
    if (lic.status === 'suspended') return '⏸️ معلق';
    return '❓ نامشخص';
  };

  const daysLeft = () => {
    if (!lic?.expiresAt) return null;
    const ms = new Date(lic.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / 86400000);
  };

  const dl = daysLeft();

  const submitForm = async () => {
    if (!message.trim()) { Alert.alert('پیام خالی', 'لطفاً متن پیام را وارد کنید.'); return; }
    setSending(true);
    try {
      const r = await createSupportTicket({
        type: formType,
        subject: subject.trim(),
        message: message.trim(),
        licenseStatus: lic?.status || '',
      });
      if (r.ok) {
        Alert.alert('ثبت شد', r.queued ? 'پیام شما ذخیره شد و بعد از اتصال به اینترنت ارسال می‌شود.' : 'پیام شما ارسال شد.');
        setSubject(''); setMessage('');
        await load();
      } else {
        Alert.alert('خطا', r.error || 'ثبت نشد');
      }
    } finally { setSending(false); }
  };

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <Text style={st.title}>🎧 پشتیبانی</Text>

      <View style={st.card}>
        <Text style={st.cardTitle}>وضعیت لایسنس</Text>
        <Text style={st.row}>وضعیت: {statusText()}</Text>
        {lic?.expiresAt ? <Text style={st.row}>تاریخ انقضا: {String(lic.expiresAt).slice(0, 10)}</Text> : null}
        {dl !== null ? <Text style={st.row}>روزهای باقی‌مانده: {dl}</Text> : null}
        {lic?.reason ? <Text style={st.reason}>{lic.reason}</Text> : null}
        <TouchableOpacity style={st.btn} onPress={() => setShowRequest(true)}>
          <Text style={st.btnTxt}>📩 درخواست تمدید لایسنس</Text>
        </TouchableOpacity>
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>ارسال پیام به پشتیبانی</Text>
        <View style={st.typeRow}>
          {[
            { k: 'issue', l: 'گزارش مشکل' },
            { k: 'feature', l: 'پیشنهاد ویژگی' },
            { k: 'contact', l: 'تماس با پشتیبانی' },
          ].map(x => (
            <TouchableOpacity key={x.k} onPress={() => setFormType(x.k as any)} style={[st.typeBtn, formType === x.k && st.typeBtnActive]}>
              <Text style={[st.typeTxt, formType === x.k && { color: '#fff' }]}>{x.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={st.lbl}>موضوع (اختیاری)</Text>
        <TextInput value={subject} onChangeText={setSubject} style={st.inp} placeholder="مثلاً مشکل در سینک" placeholderTextColor="#94a3b8" />
        <Text style={st.lbl}>متن پیام *</Text>
        <TextInput value={message} onChangeText={setMessage} style={[st.inp, { minHeight: 80, textAlignVertical: 'top' }]} multiline placeholder="مشکل یا پیشنهاد خود را بنویسید..." placeholderTextColor="#94a3b8" />
        <TouchableOpacity style={st.btn} onPress={submitForm} disabled={sending}>
          <Text style={st.btnTxt}>{sending ? 'در حال ارسال...' : '📤 ارسال'}</Text>
        </TouchableOpacity>
        {supportQueue > 0 ? <Text style={st.reason}>در صف ارسال: {supportQueue} پیام (بعد از اتصال ارسال می‌شود)</Text> : null}
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>📞 تماس با پشتیبانی</Text>
        {contactInfo.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL('tel:' + contactInfo.phone).catch(() => {})}>
            <Text style={st.contactRow}>📱 {contactInfo.phone}</Text>
          </TouchableOpacity>
        ) : null}
        {contactInfo.email ? (
          <TouchableOpacity onPress={() => Linking.openURL('mailto:' + contactInfo.email).catch(() => {})}>
            <Text style={st.contactRow}>📧 {contactInfo.email}</Text>
          </TouchableOpacity>
        ) : null}
        {contactInfo.whatsapp ? (
          <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/' + String(contactInfo.whatsapp).replace(/[^0-9]/g, '')).catch(() => {})}>
            <Text style={st.contactRow}>🟢 واتساب: {contactInfo.whatsapp}</Text>
          </TouchableOpacity>
        ) : null}
        {contactInfo.telegram ? (
          <TouchableOpacity onPress={() => Linking.openURL('https://t.me/' + String(contactInfo.telegram).replace('@', '')).catch(() => {})}>
            <Text style={st.contactRow}>✈️ تلگرام: {contactInfo.telegram}</Text>
          </TouchableOpacity>
        ) : null}
        {contactInfo.channel ? (
          <TouchableOpacity onPress={() => Linking.openURL(contactInfo.channel).catch(() => {})}>
            <Text style={st.contactRow}>📢 کانال: {contactInfo.channel}</Text>
          </TouchableOpacity>
        ) : null}
        {contactInfo.address ? <Text style={st.contactRow}>📍 {contactInfo.address}</Text> : null}
        {contactInfo.working_hours ? <Text style={st.contactRow}>🕒 {contactInfo.working_hours}</Text> : null}
        {!contactInfo.phone && !contactInfo.email && !contactInfo.whatsapp && !contactInfo.telegram && !contactInfo.channel ? (
          <Text style={st.row}>اطلاعات تماس هنوز توسط ادمین تنظیم نشده است.</Text>
        ) : null}
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>گفتگوهای من با پشتیبانی ({tickets.length}){unread > 0 ? ' • ' + unread + ' پاسخ جدید' : ''}</Text>
        <Text style={st.hint}>این گفتگوها خصوصی هستند و فقط شما و ادمین آن‌ها را می‌بینید.</Text>
        {tickets.length === 0 ? <Text style={st.row}>هنوز گفتگویی ثبت نکرده‌اید.</Text> : tickets.map((t: any) => (
          <TouchableOpacity
          key={t.id}
          onPress={() => setOpenTicket(t)}
          style={[st.ticketRow, (unreadMap[t.id] || 0) > 0 && st.ticketUnread]}
        >
            <Text style={st.ticketStatus}>{t.status === 'open' ? '🟢 باز' : t.status === 'in_progress' ? '🟡 در بررسی' : '⚪ بسته'}</Text>
            <Text style={st.ticketSubject} numberOfLines={1}>{t.subject || t.message || '—'}</Text>
            {(unreadMap[t.id] || 0) > 0 ? (
            <View style={st.unreadBadge}><Text style={st.unreadBadgeTxt}>💬 {unreadMap[t.id]}</Text></View>
          ) : null}
          <Text style={st.ticketDate}>{String(t.created_at || '').slice(0, 10)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>راهنما و سوالات پرتکرار</Text>
        <Text style={st.row}>• نحوه ثبت خرید و فروش</Text>
        <Text style={st.row}>• نحوه سینک با Google Sheet</Text>
        <Text style={st.row}>• نحوه بکاپ و بازیابی</Text>
        <Text style={st.row}>• استفاده آفلاین و چنددستگاهی</Text>
        <Text style={st.row}>• رفع مشکلات رایج</Text>
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>وضعیت سینک</Text>
        <Text style={st.row}>تعداد رکوردهای در صف: {queueCount}</Text>
        <TouchableOpacity style={st.btnAlt} onPress={load}><Text style={st.btnTxt}>🔄 بروزرسانی وضعیت</Text></TouchableOpacity>
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>بکاپ</Text>
        <Text style={st.row}>قبل از حذف برنامه، از تنظیمات بکاپ بگیر.</Text>
        <Text style={st.row}>فایل بکاپ را جای امن نگه دار.</Text>
      </View>

      <View style={st.card}>
        <Text style={st.cardTitle}>درباره برنامه</Text>
        <Text style={st.row}>نسخه: 1.0.0</Text>
        <Text style={st.row}>سیستم حسابداری میزان</Text>
      </View>

      <SupportChatBox
        visible={!!openTicket}
        ticket={openTicket}
        onClose={() => { setOpenTicket(null); setTimeout(load, 400); }}
        showToast={showToast}
      />

      <LicenseRequest visible={showRequest} onClose={() => setShowRequest(false)} showToast={showToast} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  ticketUnread: { backgroundColor: '#fef2f2', borderRightWidth: 4, borderRightColor: '#ef4444', paddingHorizontal: 6, borderRadius: 6 },
  unreadBadge: { backgroundColor: '#ef4444', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, minWidth: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  unreadBadgeTxt: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  page: { padding: 12, paddingBottom: 120 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f2438', textAlign: 'center', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 8 },
  row: { fontSize: 12, color: '#334155', textAlign: 'right', marginBottom: 4 },
  hint: { fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 6 },
  reason: { fontSize: 11, color: '#b45309', textAlign: 'right', marginTop: 4, marginBottom: 4 },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 6, marginBottom: 4 },
  inp: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right', backgroundColor: '#f8fafc', marginBottom: 8 },
  btn: { backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnAlt: { backgroundColor: '#0891b2', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  typeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  typeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  typeBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  typeTxt: { fontSize: 11, color: '#334155', fontWeight: 'bold' },
  ticketRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  ticketStatus: { fontSize: 10, color: '#475569', width: 70 },
  ticketSubject: { flex: 1, fontSize: 12, color: '#0f2438', textAlign: 'right' },
  ticketDate: { fontSize: 10, color: '#64748b', width: 80, textAlign: 'left' },
});
