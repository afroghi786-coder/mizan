// add-exchange-bell.js — اضافه کردن 🔔 + اعلان به ExchangeScreen
const fs = require('fs');
let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. اضافه state ها
// ═══════════════════════════════════════════
if (!s.includes('exchBellModal')) {
  const re = /(const \[sub, setSub\] = useState\([^)]+\);)/;
  const m = s.match(re);
  if (m) {
    s = s.replace(m[1], m[1] + `
  // 🔔 notification state
  const [exchBellModal, setExchBellModal] = useState(false);
  const [exchNotifList, setExchNotifList] = useState<any[]>([]);
  const [exchUnread, setExchUnread] = useState(0);
  const [exchChatModal, setExchChatModal] = useState(false);
  const [exchChatRoom, setExchChatRoom] = useState<any>(null);
  const [exchChatPeer, setExchChatPeer] = useState<any>(null);
  const [exchChatMsgs, setExchChatMsgs] = useState<any[]>([]);
  const [exchChatInput, setExchChatInput] = useState('');
  const [exchChatSending, setExchChatSending] = useState(false);`);
    console.log('✅ state ها اضافه شد');
    n++;
  } else {
    console.log('⚠️ sub state پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ۲. polling پیام‌ها
// ═══════════════════════════════════════════
if (!s.includes('setExchNotifList')) {
  const re = /(useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);)/;
  const m = s.match(re);
  if (m) {
    s = s.replace(m[1], m[1] + `

  // 🔔 polling پیام‌های نخوانده
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        await (m as any).initNetwork?.();
        const list = await (m as any).fetchMyUnreadMessages?.();
        if (!alive) return;
        setExchNotifList(list || []);
        setExchUnread((list || []).length);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // 💬 chat listener
  useEffect(() => {
    if (!exchChatModal || !exchChatRoom?.id) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        const msgs = await (m as any).fetchMessages(exchChatRoom.id);
        if (alive) setExchChatMsgs(msgs || []);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    (async () => {
      try {
        const m = await import('./lib.network');
        await (m as any).markRoomRead(exchChatRoom.id);
      } catch {}
    })();
    return () => { alive = false; clearInterval(iv); };
  }, [exchChatModal, exchChatRoom?.id]);`);
    console.log('✅ polling اضافه شد');
    n++;
  } else {
    console.log('⚠️ useEffect پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ۳. UI: دکمه شناور + مودال‌ها
// ═══════════════════════════════════════════
if (!s.includes('exchBellFloating')) {
  const lastClose = s.lastIndexOf('</View>');
  if (lastClose > 0) {
    const ui = `
      {/* 🔔 دکمه شناور اعلان */}
      <TouchableOpacity
        onPress={() => setExchBellModal(true)}
        style={{ position: 'absolute', top: 90, left: 14, width: 50, height: 50, borderRadius: 25, backgroundColor: '#0f2438', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
      >
        <Text style={{ fontSize: 22 }}>🔔</Text>
        {exchUnread > 0 ? (
          <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{exchUnread > 9 ? '۹+' : exchUnread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* 🔔 مودال اعلان‌ها */}
      <Modal visible={exchBellModal} transparent animationType="slide" onRequestClose={() => setExchBellModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 12 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 16, maxHeight: '88%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#f59e0b', padding: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1, textAlign: 'right' }}>🔔 اعلان‌ها ({exchNotifList.length})</Text>
              <TouchableOpacity onPress={() => setExchBellModal(false)}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12, maxHeight: 500 }}>
              {exchNotifList.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <Text style={{ fontSize: 50, marginBottom: 10 }}>📭</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 14 }}>هنوز اعلانی نیست</Text>
                </View>
              ) : exchNotifList.map((msg: any, i: number) => {
                const sender = msg.from_name || msg.from_email?.split('@')[0] || 'کسی';
                return (
                  <TouchableOpacity
                    key={msg.id || i}
                    onPress={() => {
                      setExchBellModal(false);
                      setExchChatRoom({ id: msg.room_id });
                      setExchChatPeer({ email: msg.from_email, name: sender });
                      setExchChatInput('');
                      setExchChatMsgs([]);
                      setExchChatModal(true);
                    }}
                    style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0a1628', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 20 }}>💬</Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 3 }}>💬 {sender}</Text>
                      <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'right' }} numberOfLines={2}>{msg.text || '...'}</Text>
                      <Text style={{ color: '#64748b', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 💬 مودال چت */}
      <Modal visible={exchChatModal} transparent animationType="slide" onRequestClose={() => setExchChatModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 12 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 16, maxHeight: '88%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#0891b2', padding: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1, textAlign: 'right' }}>💬 چت با {exchChatPeer?.name || '—'}</Text>
              <TouchableOpacity onPress={() => setExchChatModal(false)}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14, maxHeight: 400, backgroundColor: '#0a1628' }}>
              {exchChatMsgs.length === 0 ? (
                <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>هنوز پیامی نیست</Text>
              ) : exchChatMsgs.map((msg: any, i: number) => {
                const myEmail = (globalThis as any).__myEmail || '';
                const mine = msg.from_email === myEmail;
                return (
                  <View key={msg.id || i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? '#0891b2' : '#1e293b', padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%' }}>
                    {!mine ? <Text style={{ color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 }}>{msg.from_name || msg.from_email?.split('@')[0]}</Text> : null}
                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', lineHeight: 19 }}>{msg.text}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row-reverse', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
              <TextInput
                style={{ flex: 1, backgroundColor: '#0a1628', color: '#fff', borderWidth: 1.5, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, textAlign: 'right' }}
                value={exchChatInput}
                onChangeText={setExchChatInput}
                placeholder="پیام..."
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={{ backgroundColor: '#0891b2', paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center' }}
                onPress={async () => {
                  if (!exchChatInput.trim() || !exchChatRoom || !exchChatPeer) return;
                  const text = exchChatInput.trim();
                  setExchChatInput('');
                  setExchChatSending(true);
                  try {
                    const m = await import('./lib.network');
                    await (m as any).sendMessage(exchChatRoom.id, exchChatPeer.email, text);
                    const msgs = await (m as any).fetchMessages(exchChatRoom.id);
                    setExchChatMsgs(msgs || []);
                  } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
                  setExchChatSending(false);
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>📤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>`;
    s = s.slice(0, lastClose) + ui + s.slice(lastClose);
    console.log('✅ UI اضافه شد');
    n++;
  } else {
    console.log('⚠️ آخرین </View> پیدا نشد');
  }
}

if (s !== orig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('\\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ هیچ تغییری اعمال نشد');
}