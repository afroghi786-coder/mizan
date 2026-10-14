import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';

export default function ExchangeBell({ showToast, onBack }: any) {
  const [bellModal, setBellModal] = useState(false);
  const [notifList, setNotifList] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadByRoom, setUnreadByRoom] = useState<any>({});
  const [busy, setBusy] = useState('');
  const [chatModal, setChatModal] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [chatPeer, setChatPeer] = useState<any>(null);
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  const myEmail = () => (globalThis as any).__myEmail || '';

  const roomIdFor = (nt: any) => {
    const p = nt.payload || {};
    const t = String(nt.type || '');
    if (t.includes('direct') && p.hawalaId) return 'dh_' + p.hawalaId;
    if (t.includes('hawala') && (p.hawalaId || p.taskId)) return 'hw_' + (p.hawalaId || p.taskId);
    if (t.includes('fx') && p.offerId) return 'fx_' + p.offerId;
    if (p.hawalaId) return 'dh_' + p.hawalaId;
    if (p.offerId) return 'fx_' + p.offerId;
    if (p.taskId) return 'hw_' + p.taskId;
    return '';
  };

  const dealIdFor = (nt: any) => {
    const p = nt.payload || {};
    if (p.hawalaId) return { id: p.hawalaId, kind: 'direct' };
    if (p.taskId) return { id: p.taskId, kind: 'hawala' };
    if (p.offerId) return { id: p.offerId, kind: 'fx' };
    return { id: '', kind: '' };
  };

  const load = useCallback(async () => {
    try {
      const m = await import('./lib.network');
      await (m as any).initNetwork?.();
      const list = await (m as any).fetchMyUnreadMessages?.();
      setNotifList(list || []);
      setUnread((list || []).length);
      const sb = (m as any)._sb;
      const me = myEmail();
      if (!sb || !me) return;
      const uMap: any = {};
      for (const nt of (list || [])) {
        const rId = roomIdFor(nt);
        if (rId && uMap[rId] === undefined) {
          try {
            const { data } = await sb.from('net_messages').select('is_read').eq('room_id', rId).eq('to_email', me);
            uMap[rId] = (data || []).filter((x: any) => !x.is_read).length;
          } catch { uMap[rId] = 0; }
        }
      }
      setUnreadByRoom(uMap);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (!chatModal || !chatRoom?.id) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        const msgs = await (m as any).fetchMessages(chatRoom.id);
        if (alive) setChatMsgs(msgs || []);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    (async () => {
      try {
        const m = await import('./lib.network');
        await (m as any).markRoomRead(chatRoom.id);
      } catch {}
    })();
    return () => { alive = false; clearInterval(iv); };
  }, [chatModal, chatRoom?.id]);

  const openChat = async (nt: any) => {
    const p = nt.payload || {};
    let fromEmail = p.from_email || p.fromEmail || '';
    let fromName = p.from_name || p.fromName || '';
    const rId = roomIdFor(nt);
    if (!fromEmail) {
      try {
        const m = await import('./lib.network');
        const sb = (m as any)._sb;
        if (sb) {
          const { id, kind } = dealIdFor(nt);
          if (kind === 'direct') {
            const { data } = await sb.from('net_direct_hawalas').select('*').eq('id', id).single();
            if (data) { fromEmail = data.from_email; fromName = data.from_name; }
          } else if (kind === 'hawala') {
            const { data } = await sb.from('net_hawalas').select('*').eq('id', id).single();
            if (data) { fromEmail = data.from_email; fromName = data.from_name; }
          } else if (kind === 'fx') {
            const { data } = await sb.from('net_fx_offers').select('*').eq('id', id).single();
            if (data) { fromEmail = data.seller_email; fromName = data.seller_name; }
          }
        }
      } catch {}
    }
    if (!fromEmail) return showToast?.('⚠️ فرستنده پیدا نشد', true);
    setBellModal(false);
    setChatRoom({ id: rId });
    setChatPeer({ email: fromEmail, name: fromName || fromEmail.split('@')[0] });
    setChatInput('');
    setChatMsgs([]);
    setTimeout(() => setChatModal(true), 250);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !chatRoom?.id || !chatPeer?.email) return;
    const text = chatInput.trim();
    setChatInput('');
    setSending(true);
    try {
      const m = await import('./lib.network');
      await (m as any).sendMessage(chatRoom.id, chatPeer.email, text);
      const msgs = await (m as any).fetchMessages(chatRoom.id);
      setChatMsgs(msgs || []);
    } catch (e: any) { showToast?.('❌ ' + e?.message, true); }
    setSending(false);
  };

  const doAccept = async (nt: any) => {
    const { id, kind } = dealIdFor(nt);
    if (!id) return showToast?.('⚠️ ID معامله نیست', true);
    setBusy('a' + id);
    try {
      const m = await import('./lib.network');
      if (kind === 'direct') await (m as any).acceptDirectHawala?.(id);
      else if (kind === 'hawala') await (m as any).claimHawala?.(id);
      else if (kind === 'fx') await (m as any).claimFXOffer?.(id);
      showToast?.('✅ قبول شد');
      load();
    } catch (e: any) { showToast?.('❌ ' + e?.message, true); }
    setBusy('');
  };

  const doDeliver = async (nt: any) => {
    const { id, kind } = dealIdFor(nt);
    if (!id) return;
    setBusy('d' + id);
    try {
      const m = await import('./lib.network');
      if (kind === 'direct') await (m as any).deliverDirectHawala?.(id, myEmail());
      else if (kind === 'hawala') await (m as any).deliverHawalaByUser?.(id);
      showToast?.('✅ تحویل شد');
      load();
    } catch (e: any) { showToast?.('❌ ' + e?.message, true); }
    setBusy('');
  };

  const doCancel = async (nt: any) => {
    const { id, kind } = dealIdFor(nt);
    if (!id) return;
    setBusy('c' + id);
    try {
      const m = await import('./lib.network');
      if (kind === 'direct') await (m as any).cancelDirectHawala?.(id);
      else if (kind === 'hawala') await (m as any).cancelHawala?.(id);
      else if (kind === 'fx') await (m as any).cancelFXOffer?.(id);
      showToast?.('🗑 لغو شد');
      setNotifList((prev: any[]) => prev.filter((x: any) => dealIdFor(x).id !== id));
    } catch (e: any) { showToast?.('❌ ' + e?.message, true); }
    setBusy('');
  };

  const getInfo = (nt: any) => {
    const p = nt.payload || {};
    const sender = p.from_name || (p.from_email || '').split('@')[0] || 'کسی';
    const t = String(nt.type || '');
    if (t.includes('delivered')) return '📦 ' + sender + ' تحویل داد';
    if (t.includes('accepted') || t.includes('taken')) return '✅ ' + sender + ' قبول کرد';
    if (t.includes('direct')) return '🔒 حواله خصوصی از ' + sender;
    if (t.includes('fx')) return '💱 ' + sender + ' فروش ارز';
    if (t.includes('hawala')) return '📤 ' + sender + ' حواله';
    return '🔔 اعلان از ' + sender;
  };

  return (
    <>
      {/* دکمه برگشت */}
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={{ position: 'fixed' as any, bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
        >
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
      ) : null}

      {/* دکمه اعلان */}
      <TouchableOpacity
        onPress={() => setBellModal(true)}
        style={{ position: 'fixed' as any, bottom: 90, left: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#0f2438', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
      >
        <Text style={{ fontSize: 26 }}>🔔</Text>
        {unread > 0 ? (
          <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 11, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{unread > 9 ? '۹+' : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* مودال اعلان‌ها */}
      <Modal visible={bellModal} transparent animationType="slide" onRequestClose={() => setBellModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 12 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 16, maxHeight: '88%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#f59e0b', padding: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1, textAlign: 'right' }}>🔔 اعلان‌ها ({notifList.length})</Text>
              <TouchableOpacity onPress={() => setBellModal(false)}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12, maxHeight: 500 }}>
              {notifList.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <Text style={{ fontSize: 50, marginBottom: 10 }}>📭</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 14 }}>هنوز اعلانی نیست</Text>
                </View>
              ) : notifList.map((nt: any, i: number) => {
                const p = nt.payload || {};
                const rId = roomIdFor(nt);
                const unreadCount = unreadByRoom[rId] || 0;
                const t = String(nt.type || '');
                const isDone = t.includes('delivered');
                const isInfo = t.includes('group');
                const isUnread = !nt.is_read;
                const hasDeal = !!(p.hawalaId || p.offerId || p.taskId);

                return (
                  <View key={nt.id || i} style={{ backgroundColor: isUnread ? '#1e3a5f' : '#0f172a', padding: 12, borderRadius: 10, marginBottom: 10, borderRightWidth: 4, borderRightColor: isUnread ? '#f59e0b' : '#334155' }}>
                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', fontWeight: isUnread ? 'bold' : 'normal', lineHeight: 20 }}>{getInfo(nt)}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                      {nt.created_at ? new Date(nt.created_at).toLocaleString('fa-IR') : ''}
                    </Text>

                    <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {/* پیام */}
                      {rId ? (
                        <TouchableOpacity onPress={() => openChat(nt)} style={{ backgroundColor: '#0891b2', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 80, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{unreadCount > 0 ? '💬 پیام (' + unreadCount + ')' : '💬 پیام'}</Text>
                        </TouchableOpacity>
                      ) : null}

                      {/* قبول — برای هر معامله‌ای که قبول نشده */}
                      {hasDeal && !isDone && !isInfo ? (
                        <TouchableOpacity accessibilityLabel="قبول" onPress={() => doAccept(nt)} disabled={!!busy} style={{ backgroundColor: '#059669', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 80, alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>✅ قبول</Text>
                        </TouchableOpacity>
                      ) : null}

                      {/* تحویل — برای بعد از قبول */}
                      {hasDeal && !isDone && !isInfo && (t.includes('taken') || t.includes('accepted')) ? (
                        <TouchableOpacity accessibilityLabel="تحویل" onPress={() => doDeliver(nt)} disabled={!!busy} style={{ backgroundColor: '#7c3aed', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 80, alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>📦 تحویل</Text>
                        </TouchableOpacity>
                      ) : null}

                      {/* لغو */}
                      {hasDeal && !isDone && !isInfo ? (
                        <TouchableOpacity accessibilityLabel="لغو" onPress={() => doCancel(nt)} disabled={!!busy} style={{ backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 80, alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>❌ لغو</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* مودال چت */}
      <Modal visible={chatModal} transparent animationType="slide" onRequestClose={() => setChatModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 12 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 16, maxHeight: '88%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#0891b2', padding: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1, textAlign: 'right' }}>💬 چت با {chatPeer?.name || '—'}</Text>
              <TouchableOpacity onPress={() => setChatModal(false)}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14, maxHeight: 400, backgroundColor: '#0a1628' }}>
              {chatMsgs.length === 0 ? (
                <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>هنوز پیامی نیست</Text>
              ) : chatMsgs.map((msg: any, i: number) => {
                const mine = msg.from_email === myEmail();
                return (
                  <View key={msg.id || i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? '#0891b2' : '#1e293b', padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%' }}>
                    {!mine ? <Text style={{ color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 }}>{msg.from_name || (msg.from_email || '').split('@')[0]}</Text> : null}
                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', lineHeight: 19 }}>{msg.text}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row-reverse', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
              <TextInput accessibilityLabel="پیام..."
                style={{ flex: 1, backgroundColor: '#0a1628', color: '#fff', borderWidth: 1.5, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, textAlign: 'right' }}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="پیام..."
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity style={{ backgroundColor: '#0891b2', paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center' }} onPress={sendChat} disabled={sending}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>📤</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}