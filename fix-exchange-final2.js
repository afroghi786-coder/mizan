const fs = require('fs');
let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const orig = s;

// تبدیل CRLF به LF برای پردازش
const hasCRLF = s.includes('\r\n');
if (hasCRLF) {
  s = s.replace(/\r\n/g, '\n');
  console.log('ℹ️ CRLF به LF تبدیل شد');
}

// پیدا کردن انتهای StyleSheet — قبلش آخرین return
const styleSheetIdx = s.indexOf('const s = StyleSheet.create({');
if (styleSheetIdx < 0) {
  console.log('❌ StyleSheet پیدا نشد');
  process.exit(1);
}

// پیدا کردن آخرین `</View>` قبل از StyleSheet
const beforeStyle = s.substring(0, styleSheetIdx);
const lastViewIdx = beforeStyle.lastIndexOf('</View>');

if (lastViewIdx < 0) {
  console.log('❌ آخرین </View> پیدا نشد');
  process.exit(1);
}

console.log('✅ آخرین </View> در خط', s.substring(0, lastViewIdx).split('\n').length);

// چک کن قبلاً UI اضافه شده
if (s.includes('exchBellModal') && s.includes('setExchBellModal(true)')) {
  console.log('ℹ️ دکمه از قبل هست');
  process.exit(0);
}

// UI
const ui = `      {/* 🔔 دکمه شناور اعلان */}
      <TouchableOpacity
        onPress={() => setExchBellModal(true)}
        style={{ position: 'absolute', top: 80, left: 14, width: 52, height: 52, borderRadius: 26, backgroundColor: '#0f2438', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
      >
        <Text style={{ fontSize: 24 }}>🔔</Text>
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
              ) : exchNotifList.map((nt: any, i: number) => {
                const p = nt.payload || {};
                const sender = p.from_name || p.from_email?.split('@')[0] || 'کسی';
                const isUnread = !nt.is_read;
                const texts: any = {
                  hawala_taken: '✅ ' + sender + ' حواله شما را قبول کرد',
                  fx_taken: '✅ ' + sender + ' آگهی شما را قبول کرد',
                  direct_hawala: '🔒 حواله خصوصی از ' + sender,
                  direct_accepted: '✅ ' + sender + ' حواله را قبول کرد',
                  direct_delivered: '📦 ' + sender + ' حواله را تحویل داد',
                  fx_new: '💱 ' + sender + ' فروش ارز',
                  hawala_new: '📤 ' + sender + ' حواله جدید',
                };
                const msgText = texts[nt.type] || '🔔 اعلان جدید';
                return (
                  <View key={nt.id || i} style={{ backgroundColor: isUnread ? '#1e3a5f' : '#0f172a', padding: 12, borderRadius: 10, marginBottom: 8, borderRightWidth: 4, borderRightColor: isUnread ? '#f59e0b' : '#334155' }}>
                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', fontWeight: isUnread ? 'bold' : 'normal', lineHeight: 20 }}>
                      {msgText}
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                      {nt.created_at ? new Date(nt.created_at).toLocaleString('fa-IR') : ''}
                    </Text>
                    {(p.from_email || p.fromEmail) ? (
                      <TouchableOpacity
                        onPress={() => openChatFromNotif(nt)}
                        style={{ marginTop: 10, backgroundColor: '#0891b2', paddingVertical: 8, borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>💬 پیام</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
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
                <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>هنوز پیامی نیست — شما شروع کنید</Text>
              ) : exchChatMsgs.map((msg: any, i: number) => {
                const myEmail = (globalThis as any).__myEmail || '';
                const mine = msg.from_email === myEmail;
                return (
                  <View key={msg.id || i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? '#0891b2' : '#1e293b', padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%' }}>
                    {!mine ? <Text style={{ color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 }}>{msg.from_name || msg.from_email?.split('@')[0]}</Text> : null}
                    <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', lineHeight: 19 }}>{msg.text}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, textAlign: 'right', marginTop: 3 }}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
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
      </Modal>

`;

// اضافه UI قبل از آخرین </View>
s = s.substring(0, lastViewIdx) + ui + s.substring(lastViewIdx);

// برگردوندن CRLF
if (hasCRLF) {
  s = s.replace(/\n/g, '\r\n');
  console.log('ℹ️ LF به CRLF برگشت');
}

fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
console.log('💾 ذخیره شد');