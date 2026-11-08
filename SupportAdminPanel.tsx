import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import {
  adminFetchSupportTickets,
  adminFetchSupportMessages,
  adminSendSupportReply,
  adminUpdateSupportStatus,
  adminMarkSupportReadByAdmin,
  adminGetOpenSupportCount,
  adminGetUnreadMessagesCount,
  adminGetUnreadCountsByTicket,
} from './lib.supportAdmin';
import { pollSupportAdminNotifications } from './lib.supportNotify';
import { getSupportSettings, saveSupportSettings, SupportSettings } from './lib.supportSettings';

export default function SupportAdminPanel({ showToast }: any) {
  const [filter, setFilter] = useState<'all'|'open'|'in_progress'|'closed'>('all');
  const [tickets, setTickets] = useState<any[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [adminUnread, setAdminUnread] = useState(0);
  const [contactSettings, setContactSettings] = useState<SupportSettings>({ phone: '', email: '', whatsapp: '', telegram: '', channel: '', address: '', working_hours: '' });
  const [contactSaving, setContactSaving] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const list = await adminFetchSupportTickets(filter);
      setTickets(Array.isArray(list) ? list : []);
      const c = await adminGetOpenSupportCount();
      setOpenCount(c);
      const u = await adminGetUnreadMessagesCount();
      setAdminUnread(u);
      const m = await adminGetUnreadCountsByTicket();
      setUnreadMap(m || {});
    } finally { setLoading(false); }
  };

  const loadMessages = async (t: any) => {
    if (!t?.id) return;
    setSelected(t);
    setReply('');
    try {
      const m = await adminFetchSupportMessages(t.id);
      setMessages(Array.isArray(m) ? m : []);
      await adminMarkSupportReadByAdmin(t.id);
      try { const m2 = await adminGetUnreadCountsByTicket(); setUnreadMap(m2 || {}); } catch {}
      setTimeout(() => { try { scrollRef.current?.scrollToEnd({ animated: true }); } catch {} }, 120);
    } catch { setMessages([]); }
  };

  useEffect(() => { loadTickets(); pollSupportAdminNotifications(); } , [filter]);
  useEffect(() => { (async () => { try { const s = await getSupportSettings(); setContactSettings(s); } catch {} })(); }, []);
  useEffect(() => {
    const iv = setInterval(async () => { await pollSupportAdminNotifications(); if (!selected) loadTickets(); }, 15000);
    return () => clearInterval(iv);
  }, [filter, selected]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selected?.id || sending) return;
    setSending(true);
    try {
      const r = await adminSendSupportReply(selected.id, text);
      if (r.ok) {
        setReply('');
        const m = await adminFetchSupportMessages(selected.id);
        setMessages(Array.isArray(m) ? m : []);
        setTimeout(() => { try { scrollRef.current?.scrollToEnd({ animated: true }); } catch {} }, 120);
        if (showToast) showToast('پاسخ ارسال شد', false);
      } else {
        const msg = r.error || 'ارسال نشد';
        if (showToast) showToast(msg, true); else Alert.alert('خطا', msg);
      }
    } finally { setSending(false); }
  };

  const changeStatus = async (status: 'open'|'in_progress'|'closed') => {
    if (!selected?.id) return;
    const r = await adminUpdateSupportStatus(selected.id, status);
    if (r.ok) {
      if (showToast) showToast('وضعیت به‌روزرسانی شد', false);
      setSelected({ ...selected, status });
      await loadTickets();
    } else {
      if (showToast) showToast(r.error || 'خطا', true); else Alert.alert('خطا', r.error || 'خطا');
    }
  };

  const statusLabel = (s: string) => s === 'open' ? '🟢 باز' : s === 'in_progress' ? '🟡 در بررسی' : '⚪ بسته';

  return (
    <View style={{ flex: 1 }}>
      <View style={st.header}>
        <Text style={st.title}>🎧 پشتیبانی</Text>
        <Text style={st.sub}>تیکت‌های باز: {openCount}</Text>
        <Text style={st.sub}>پیام جدید: {adminUnread}</Text>
      </View>

      <View style={st.contactCard}>
        <View style={st.contactHeader}>
          <View style={{ flex: 1 }}>
            <Text style={st.contactTitle}>☎️ تنظیمات تماس پشتیبانی</Text>
            <Text style={st.contactHint}>این اطلاعات در تب پشتیبانی کاربر نمایش داده می‌شود</Text>
          </View>
          <View style={st.contactIconBox}><Text style={{ fontSize: 20 }}>🛠️</Text></View>
        </View>

        <View style={st.contactGrid}>
          <View style={st.contactField}>
            <Text style={st.contactLbl}>📱 شماره تماس</Text>
            <TextInput value={contactSettings.phone} onChangeText={(v) => setContactSettings({ ...contactSettings, phone: v })} style={st.contactInp} placeholder="0791234567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
          </View>
          <View style={st.contactField}>
            <Text style={st.contactLbl}>📧 ایمیل</Text>
            <TextInput value={contactSettings.email} onChangeText={(v) => setContactSettings({ ...contactSettings, email: v })} style={st.contactInp} placeholder="support@mizan.app" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View style={st.contactField}>
            <Text style={st.contactLbl}>🟢 واتساب</Text>
            <TextInput value={contactSettings.whatsapp} onChangeText={(v) => setContactSettings({ ...contactSettings, whatsapp: v })} style={st.contactInp} placeholder="0791234567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
          </View>
          <View style={st.contactField}>
            <Text style={st.contactLbl}>✈️ آیدی تلگرام</Text>
            <TextInput value={contactSettings.telegram} onChangeText={(v) => setContactSettings({ ...contactSettings, telegram: v })} style={st.contactInp} placeholder="@mizan_support" placeholderTextColor="#94a3b8" autoCapitalize="none" />
          </View>
          <View style={st.contactField}>
            <Text style={st.contactLbl}>📢 آدرس کانال</Text>
            <TextInput value={contactSettings.channel} onChangeText={(v) => setContactSettings({ ...contactSettings, channel: v })} style={st.contactInp} placeholder="https://t.me/mizan_channel" placeholderTextColor="#94a3b8" autoCapitalize="none" />
          </View>
          <View style={st.contactField}>
            <Text style={st.contactLbl}>🕒 ساعات پاسخ‌دهی</Text>
            <TextInput value={contactSettings.working_hours} onChangeText={(v) => setContactSettings({ ...contactSettings, working_hours: v })} style={st.contactInp} placeholder="۸ صبح تا ۸ شب" placeholderTextColor="#94a3b8" />
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={st.contactLbl}>📍 آدرس دفتر</Text>
          <TextInput value={contactSettings.address} onChangeText={(v) => setContactSettings({ ...contactSettings, address: v })} style={st.contactInp} placeholder="کابل، چهارراهی..." placeholderTextColor="#94a3b8" />
        </View>

        <TouchableOpacity
          style={[st.contactSaveBtn, contactSaving && { opacity: 0.6 }]}
          disabled={contactSaving}
          onPress={async () => {
            setContactSaving(true);
            try {
              const r = await saveSupportSettings(contactSettings);
              if (r.ok) { if (showToast) showToast('✅ تنظیمات تماس ذخیره شد', false); }
              else { if (showToast) showToast(r.error || 'ذخیره نشد', true); }
            } finally { setContactSaving(false); }
          }}
        >
          <Text style={st.contactSaveTxt}>{contactSaving ? '⏳ در حال ذخیره...' : '💾 ذخیره تنظیمات تماس'}</Text>
        </TouchableOpacity>
      </View>

      <View style={st.filterRow}>
        {[
          { k: 'all', l: 'همه' },
          { k: 'open', l: 'باز' },
          { k: 'in_progress', l: 'در بررسی' },
          { k: 'closed', l: 'بسته' },
        ].map(x => (
          <TouchableOpacity key={x.k} onPress={() => { setFilter(x.k as any); setSelected(null); setMessages([]); }} style={[st.filterBtn, filter === x.k && st.filterBtnActive]}>
            <Text style={[st.filterTxt, filter === x.k && { color: '#fff' }]}>{x.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator color="#0891b2" style={{ marginTop: 20 }} /> : null}
        {!loading && tickets.length === 0 ? <Text style={st.empty}>تیکتی با این فیلتر نیست.</Text> : tickets.map((t: any) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => loadMessages(t)}
            style={[
              st.ticketCard,
              (unreadMap[t.id] || 0) > 0 && st.ticketUnread,
              selected?.id === t.id && { borderColor: '#0891b2', borderWidth: 2 },
            ]}
          >
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <Text style={st.ticketStatus}>{statusLabel(t.status)}</Text>
                {(unreadMap[t.id] || 0) > 0 ? (
                  <View style={st.unreadBadge}>
                    <Text style={st.unreadBadgeTxt}>💬 {unreadMap[t.id]}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={st.ticketDate}>{String(t.created_at || '').slice(0, 16).replace('T', ' ')}</Text>
            </View>
            <Text style={st.ticketSubject} numberOfLines={2}>{t.subject || t.message || '—'}</Text>
            <Text style={st.ticketMeta}>👤 {t.user_name || '—'} • 📧 {t.user_email || '—'}</Text>
            <Text style={st.ticketMeta}>📞 {t.user_phone || '—'} • نوع: {t.type} • دستگاه: {String(t.device_id || '').slice(0, 12)}</Text>
          </TouchableOpacity>
        ))}

        {selected ? (
          <View style={st.chatCard}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={st.chatTitle} numberOfLines={1}>💬 {selected.subject || 'تیکت'}</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setMessages([]); }}><Text style={st.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={st.ticketMeta}>👤 {selected.user_name || '—'} • 📧 {selected.user_email || '—'} • 📞 {selected.user_phone || '—'}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity style={st.statusBtn} onPress={() => changeStatus('in_progress')}><Text style={st.statusBtnTxt}>در بررسی</Text></TouchableOpacity>
              <TouchableOpacity style={st.statusBtn} onPress={() => changeStatus('closed')}><Text style={st.statusBtnTxt}>بستن</Text></TouchableOpacity>
              <TouchableOpacity style={st.statusBtn} onPress={() => changeStatus('open')}><Text style={st.statusBtnTxt}>باز کردن</Text></TouchableOpacity>
            </View>

            <ScrollView ref={scrollRef} style={{ maxHeight: 320 }} contentContainerStyle={{ paddingVertical: 6 }}>
              {messages.length === 0 ? <Text style={st.empty}>پیامی نیست.</Text> : messages.map((m: any, i: number) => {
                const isAdmin = m.sender === 'admin';
                return (
                  <View key={m.id || i} style={[st.bubble, isAdmin ? st.adminBubble : st.userBubble]}>
                    <Text style={st.sender}>{isAdmin ? 'ادمین' : 'کاربر'}</Text>
                    <Text style={st.msgText}>{m.message}</Text>
                    <Text style={st.date}>{String(m.created_at || '').slice(0, 16).replace('T', ' ')}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <TextInput
              value={reply}
              onChangeText={setReply}
              style={st.input}
              placeholder="پاسخ ادمین..."
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TouchableOpacity style={[st.sendBtn, sending && { opacity: 0.6 }]} onPress={sendReply} disabled={sending}>
              <Text style={st.sendTxt}>{sending ? 'در حال ارسال...' : '📤 ارسال پاسخ'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  contactCard: { backgroundColor: '#ffffff', margin: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#c7d2fe', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  contactHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  contactTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
  contactHint: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 },
  contactIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  contactGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  contactField: { width: '48%', marginBottom: 8 },
  contactLbl: { fontSize: 11, fontWeight: 'bold', color: '#334155', textAlign: 'right', marginBottom: 4 },
  contactInp: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  contactSaveBtn: { backgroundColor: '#059669', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  contactSaveTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  ticketUnread: { borderColor: '#ef4444', borderWidth: 2, backgroundColor: '#fef2f2' },
  unreadBadge: { backgroundColor: '#ef4444', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeTxt: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  header: { padding: 12, backgroundColor: '#0f2438' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  sub: { color: '#a5f3fc', fontSize: 11, textAlign: 'right', marginTop: 2 },
  filterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, padding: 10, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  filterBtnActive: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  filterTxt: { fontSize: 11, color: '#334155', fontWeight: 'bold' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 12 },
  ticketCard: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  ticketStatus: { fontSize: 10, color: '#475569' },
  ticketDate: { fontSize: 10, color: '#64748b' },
  ticketSubject: { fontSize: 13, color: '#0f2438', textAlign: 'right', marginTop: 4, fontWeight: 'bold' },
  ticketMeta: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 3 },
  chatCard: { backgroundColor: '#fff', borderRadius: 12, padding: 10, marginTop: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  chatTitle: { flex: 1, fontSize: 13, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
  closeTxt: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, paddingHorizontal: 6 },
  statusBtn: { backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusBtnTxt: { fontSize: 10, color: '#0369a1', fontWeight: 'bold' },
  bubble: { maxWidth: '85%', padding: 8, borderRadius: 10, marginBottom: 6 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#dbeafe' },
  adminBubble: { alignSelf: 'flex-start', backgroundColor: '#fef3c7' },
  sender: { fontSize: 9, fontWeight: 'bold', color: '#475569', marginBottom: 2, textAlign: 'right' },
  msgText: { fontSize: 12, color: '#0f2438', textAlign: 'right', lineHeight: 18 },
  date: { fontSize: 8, color: '#64748b', marginTop: 3, textAlign: 'left' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 8, fontSize: 12, textAlign: 'right', backgroundColor: '#f8fafc', minHeight: 50, textAlignVertical: 'top', marginTop: 6 },
  sendBtn: { backgroundColor: '#059669', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  sendTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
