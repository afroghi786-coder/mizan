import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { listenSupportChat, sendSupportChatMessage } from './lib.supportChat';
import { markSupportMessagesRead } from './lib.support';

export default function SupportChatBox({ visible, ticket, onClose, showToast }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!visible || !ticket?.id) return;
    setMessages([]);
    const stop = listenSupportChat(ticket.id, (msgs) => {
      setMessages(Array.isArray(msgs) ? msgs : []);
      markSupportMessagesRead(ticket.id).catch(() => {});
    });
    return () => stop();
  }, [visible, ticket?.id]);

  useEffect(() => {
    setTimeout(() => {
      try { scrollRef.current?.scrollToEnd({ animated: true }); } catch {}
    }, 120);
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || !ticket?.id || sending) return;
    setSending(true);
    try {
      const r = await sendSupportChatMessage(ticket.id, text);
      if (r?.ok) {
        setInput('');
        if (r?.queued) {
          if (showToast) showToast('پیام در صف ارسال ذخیره شد', false);
          else Alert.alert('ثبت شد', 'پیام ذخیره شد و بعد از اتصال به اینترنت ارسال می‌شود.');
        }
      } else {
        const msg = r?.error || 'ارسال نشد';
        if (showToast) showToast(msg, true);
        else Alert.alert('خطا', msg);
      }
    } finally {
      setSending(false);
    }
  };

  const statusText = () => {
    if (!ticket) return '';
    if (ticket.status === 'open') return '🟢 باز';
    if (ticket.status === 'in_progress') return '🟡 در بررسی';
    return '⚪ بسته';
  };

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.overlay}>
        <View style={st.sheet}>
          <View style={st.header}>
            <View style={{ flex: 1 }}>
              <Text style={st.title} numberOfLines={1}>💬 گفتگو با پشتیبانی</Text>
              <Text style={st.sub} numberOfLines={1}>
                {ticket?.subject || ticket?.message || 'تیکت'} • {statusText()}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={st.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={st.msgs} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
            {messages.length === 0 ? (
              <Text style={st.empty}>هنوز پیامی در این گفتگو نیست. اولین پیام را بفرستید.</Text>
            ) : messages.map((m: any, i: number) => {
              const isAdmin = m.sender === 'admin';
              return (
                <View key={m.id || ('m_' + i)} style={[st.bubble, isAdmin ? st.adminBubble : st.userBubble]}>
                  <Text style={st.sender}>{isAdmin ? 'پشتیبانی' : 'شما'}</Text>
                  <Text style={st.msgText}>{m.message}</Text>
                  <Text style={st.date}>{String(m.created_at || '').slice(0, 16).replace('T', ' ')}</Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={st.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              style={st.input}
              placeholder="پیام خود را بنویسید..."
              placeholderTextColor="#94a3b8"
              multiline
              onSubmitEditing={send}
            />
            <TouchableOpacity style={[st.sendBtn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.sendTxt}>ارسال</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#f8fafc', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '92%', minHeight: '70%' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, backgroundColor: '#0f2438', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  title: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  sub: { color: '#a5f3fc', fontSize: 10, textAlign: 'right', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  msgs: { flex: 1, backgroundColor: '#f1f5f9' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 30, fontSize: 12 },
  bubble: { maxWidth: '82%', padding: 10, borderRadius: 12, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#dbeafe' },
  adminBubble: { alignSelf: 'flex-start', backgroundColor: '#fef3c7' },
  sender: { fontSize: 10, fontWeight: 'bold', color: '#475569', marginBottom: 3, textAlign: 'right' },
  msgText: { fontSize: 13, color: '#0f2438', textAlign: 'right', lineHeight: 20 },
  date: { fontSize: 9, color: '#64748b', marginTop: 5, textAlign: 'left' },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, textAlign: 'right', backgroundColor: '#f8fafc', maxHeight: 100 },
  sendBtn: { backgroundColor: '#0891b2', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
