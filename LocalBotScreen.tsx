import { displayDate, displayDateOnly } from './lib-date';
// LocalBotScreen.tsx — ربات محلی (آفلاین)
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, NativeModules, Platform, DeviceEventEmitter
} from 'react-native';
import { parseMulti, Command } from './lib.local.nlu';
import { execute, ExecResult, getLastEntity, clearLastEntity } from './lib.local.exec';
import { isSTTAvailable, startSTT, stopSTT, speakText, stopSpeak, isWeb } from './lib.voice';
import { matchLesson, applyAliases, logFail } from './lib.learning';

const voiceAvailable = isSTTAvailable();

export default function LocalBotScreen({ showToast, onExit }: any) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [panel, setPanel] = useState<any>(null);
  const [voiceReply, setVoiceReply] = useState(true);
  const scrollRef = useRef<any>(null);
  const sttHandle = useRef<any>(null);

  useEffect(() => {
    // ─── Web listeners
    // (توی lib.voice مدیریت می‌شود)
  }, []);

  const startVoice = async () => {
    // mic lock removed
    setPartial('');
    sttHandle.current = startSTT(
      (partialTxt) => setPartial(partialTxt),
      (finalTxt) => {
        setListening(false);
        setPartial('');
        if (finalTxt) { setText(finalTxt); setTimeout(() => run(finalTxt), 150); }
      },
      (err) => {
        setListening(false);
        setPartial('');
        showToast?.('🎤 ' + err, true);
      }
    );
    setListening(true);
  };
  const stopVoice = async () => {
    if (sttHandle.current) stopSTT(sttHandle.current);
    sttHandle.current = null;
    setListening(false);
  };
  const speak = async (t: string) => {
    if (!voiceReply) return;
    speakText(t, 'fa-IR');
  };

  const push = (role: 'user' | 'bot', text: string) => {
    setMessages(m => [...m, { role, text, ts: Date.now() }]);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 80);
  };

  const run = async (input?: string) => {
    const q = (input || text).trim();
    if (!q || loading) return;
    setText('');
    push('user', q);
    setLoading(true);

    try {
      // ۱. اعمال مترادف‌ها
      const aliased = await applyAliases(q);
      
      // ۲. چک درس‌های یادگرفته
      const lesson = await matchLesson(aliased);
      if (lesson) {
        // از درس استفاده کن
        const fakeCmd: any = { intent: lesson.intent, params: lesson.params || {}, raw: aliased };
        const r = await execute(fakeCmd);
        if (r.message) push('bot', r.message);
        if (r.panel) setPanel(r.panel);
        if (lesson.params?.name && !['list_boxes','list_customers','today_profit','help'].includes(lesson.intent)) {
          // اضافه کردن نام از درس اگه نبود
        }
        speak(r.message);
        setLoading(false);
        return;
      }
      
      const cmds = parseMulti(aliased);
      if (cmds.length === 0) {
        push('bot', '🤔 نفهمیدم');
        await logFail(q);
        setLoading(false);
        return;
      }

      // اجرا همه
      let lastResult: ExecResult | null = null;
      for (const c of cmds) {
        const r = await execute(c);
        lastResult = r;
        if (r.message) push('bot', r.message);
        if (r.panel) setPanel(r.panel);
        if (!r.ok) {
          // اگه unknown بود، لاگ کن
          if (c.intent === 'unknown') await logFail(q);
          break;
        }
      }

      if (lastResult?.message) speak(lastResult.message);
    } catch (e: any) {
      push('bot', '❌ ' + (e?.message || 'خطا'));
    }
    setLoading(false);
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const examples = [
    'صندوق احمد',
    'صندوق دالر فروغی',
    '۵۰۰ به احمد اضافه کن',
    '۱۰۰ از فروغی کم کن',
    'مانده رضا',
    'سود امروز',
    'همه صندوق‌ها',
    'مشتری کریمی',
    'راهنما',
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.iconBtn}><Text style={s.iconTxt}>×</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🤖 ربات محلی</Text>
          <Text style={s.subtitle}>{voiceAvailable ? (isWeb ? '🌐 وب • 🔇 صوتی' : '📴 آفلاین • 🎤 صوتی') : '⌨️ فقط متنی'}</Text>
        </View>
        <TouchableOpacity onPress={() => setVoiceReply(v => !v)} style={s.iconBtn}>
          <Text style={s.iconTxt}>{voiceReply ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenLearning?.()} style={s.iconBtn}>
          <Text style={s.iconTxt}>🎓</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        {messages.length === 0 && (
          <View>
            <View style={s.welcome}>
              <Text style={s.welcomeIcon}>🤖</Text>
              <Text style={s.welcomeTitle}>ربات محلی</Text>
              <Text style={s.welcomeSub}>کاملاً آفلاین — بدون اینترنت</Text>
            </View>

            <Text style={s.examplesTitle}>💡 نمونه دستورات:</Text>
            {examples.map((ex, i) => (
              <TouchableOpacity key={i} style={s.exBtn} onPress={() => { setText(ex); setTimeout(() => run(ex), 100); }}>
                <Text style={s.exTxt}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[s.msg, m.role === 'user' ? s.msgUser : s.msgBot]}>
            <Text style={s.msgTxt}>{m.text}</Text>
            <Text style={s.msgTime}>{fmtTime(m.ts)}</Text>
          </View>
        ))}

        {loading && (
          <View style={[s.msg, s.msgBot]}>
            <ActivityIndicator color="#10b981" />
          </View>
        )}

        {/* Panel */}
        {panel && (
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelTitle}>
                {panel.kind === 'box' ? '📦 صندوق'
                  : panel.kind === 'customer' ? '👤 مشتری'
                  : panel.kind === 'invoice' ? '📄 فاکتور'
                  : panel.kind === 'stats' ? '📊 گزارش'
                  : panel.kind === 'list_boxes' ? '📦 صندوق‌ها'
                  : panel.kind === 'list_customers' ? '👥 مشتریان'
                  : '📋'}
              </Text>
              <TouchableOpacity onPress={() => { setPanel(null); clearLastEntity(); }}>
                <Text style={{ color: '#dc2626', fontSize: 22, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>

            {panel.kind === 'box' && (
              <View>
                <Text style={s.pName}>{panel.box.name} — {panel.box.currency}</Text>
                <View style={s.balBox}>
                  <Text style={s.balLbl}>موجودی</Text>
                  <Text style={s.balNum}>{Math.abs(Number(panel.box._balance) || 0).toLocaleString('en-US')}</Text>
                </View>
                {panel.box.owner_name ? <Text style={s.pSub}>👤 صاحب: {panel.box.owner_name}</Text> : null}
                {panel.txs && panel.txs.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.pSec}>📋 تراکنش‌ها ({panel.txs.length}):</Text>
                    {panel.txs.slice(0, 15).map((t: any, i: number) => {
                      const isDep = t.type === 'deposit' || t.type === 'in' || t.type === 'transfer_in';
                      return (
                        <View key={i} style={s.txRow}>
                          <Text style={{ color: isDep ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: 13 }}>
                            {isDep ? '➕' : '➖'} {(Number(t.amount) || 0).toLocaleString('en-US')}
                          </Text>
                          <Text style={s.txDesc}>{t.description || ''}</Text>
                          <Text style={s.txDate}>{t.date ? displayDateOnly(t.date) : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {panel.kind === 'customer' && (
              <View>
                <Text style={s.pName}>{panel.customer.name}</Text>
                {panel.customer.phone ? <Text style={s.pSub}>📞 {panel.customer.phone}</Text> : null}
                {panel.customer.bank ? <Text style={s.pSub}>🏦 {panel.customer.bank}</Text> : null}
                {panel.balance !== undefined && (
                  <View style={s.balBox}>
                    <Text style={s.balLbl}>مانده</Text>
                    <Text style={[s.balNum, { color: panel.balance >= 0 ? '#10b981' : '#ef4444' }]}>
                      {Math.abs(Number(panel.balance) || 0).toLocaleString('en-US')}
                    </Text>
                    <Text style={s.balSub}>
                      {panel.balance > 0 ? '🟢 طلبکار' : panel.balance < 0 ? '🔴 بدهکار' : '⚪ تسویه'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {panel.kind === 'invoice' && (
              <View>
                <Text style={s.pName}>فاکتور {panel.invoice.invoice}</Text>
                <Text style={s.pSub}>👤 {panel.invoice.name}</Text>
                <Text style={s.pSub}>📅 {panel.invoice.date ? displayDateOnly(panel.invoice.date) : ''}</Text>
                <View style={s.balBox}>
                  <Text style={s.balLbl}>جمع کل</Text>
                  <Text style={s.balNum}>{(Number(panel.invoice.total) || 0).toLocaleString('en-US')}</Text>
                  <Text style={s.balSub}>پرداخت: {(Number(panel.invoice.paid) || 0).toLocaleString('en-US')}</Text>
                </View>
                {panel.invoice.items && panel.invoice.items.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.pSec}>اقلام:</Text>
                    {panel.invoice.items.slice(0, 8).map((it: any, i: number) => (
                      <Text key={i} style={s.pItem}>• {it.model_name || '—'} × {it.quantity} — {Number(it.price_unit || 0).toLocaleString('en-US')}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {panel.kind === 'stats' && (
              <View>
                <Text style={s.pSub}>📅 {panel.rangeLabel}</Text>
                <View style={s.statRow}><Text style={s.statLbl}>فروش</Text><Text style={s.statVal}>{panel.sales} ({panel.totalSales.toLocaleString('en-US')})</Text></View>
                <View style={s.statRow}><Text style={s.statLbl}>خرید</Text><Text style={s.statVal}>{panel.purchases} ({panel.totalPurchases.toLocaleString('en-US')})</Text></View>
                <View style={[s.statRow, { borderTopWidth: 1, borderTopColor: '#334155', marginTop: 6, paddingTop: 8 }]}>
                  <Text style={[s.statLbl, { fontWeight: 'bold', color: '#10b981' }]}>سود</Text>
                  <Text style={[s.statVal, { color: panel.profit >= 0 ? '#10b981' : '#ef4444', fontSize: 18 }]}>
                    {panel.profit.toLocaleString('en-US')}
                  </Text>
                </View>
              </View>
            )}

            {(panel.kind === 'list_boxes' || panel.kind === 'list_customers') && panel.list && (
              <View>
                {panel.list.slice(0, 30).map((r: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    style={s.listItem}
                    onPress={async () => {
                      if (r.kind === 'box') {
                        const bx = await import('./lib.boxes');
                        const txs = await bx.getBoxTransactions(r.box.id || r.box.local_id) || [];
                        setPanel({ kind: 'box', box: r.box, txs });
                      } else if (r.kind === 'customer') {
                        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                        const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
                        const bals = raw ? JSON.parse(raw) : {};
                        const bal = bals[r.customer.id || r.customer.local_id] || 0;
                        setPanel({ kind: 'customer', customer: r.customer, balance: bal });
                      }
                    }}
                  >
                    <Text style={s.listTxt}>
                      {r.kind === 'box' ? '📦 ' + r.box.name : '👤 ' + r.customer.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={s.bottomBar}>
        {listening && <View style={s.listen}><Text style={s.listenTxt}>🎤 {partial || 'گوش می‌دم...'}</Text></View>}
        <View style={s.inputRow}>
          <TextInput accessibilityLabel="مثلاً: صندوق احمد"
            style={s.inp}
            value={text}
            onChangeText={setText}
            placeholder="مثلاً: صندوق احمد"
            placeholderTextColor="#64748b"
            onSubmitEditing={() => run()}
          />
          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => run()} disabled={loading || !text.trim()}>
            <Text style={s.btnTxt}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: listening ? '#dc2626' : '#0891b2' }]}
            onPress={listening ? stopVoice : startVoice}
            disabled={!voiceAvailable}
          >
            <Text style={s.btnTxt}>{listening ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  iconBtn: { padding: 8 }, iconTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  welcome: { alignItems: 'center', paddingVertical: 30 },
  welcomeIcon: { fontSize: 60 },
  welcomeTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  welcomeSub: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  examplesTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 10, marginBottom: 8 },
  exBtn: { backgroundColor: '#1a2332', padding: 12, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  exTxt: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  msg: { padding: 10, borderRadius: 10, marginTop: 8, maxWidth: '88%' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: '#7c3aed' },
  msgBot: { alignSelf: 'flex-start', backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#10b981' },
  msgTxt: { color: '#fff', fontSize: 14, lineHeight: 22, textAlign: 'right' },
  msgTime: { color: '#94a3b8', fontSize: 9, marginTop: 4, textAlign: 'left' },
  panel: { backgroundColor: '#0f2438', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 2, borderColor: '#10b981' },
  panelHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  panelTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pName: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  pSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'right' },
  pSec: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
  pItem: { color: '#cbd5e1', fontSize: 12, marginTop: 3, textAlign: 'right' },
  balBox: { backgroundColor: '#1a2332', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  balLbl: { color: '#94a3b8', fontSize: 11 },
  balNum: { color: '#10b981', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  balSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  txRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 4 },
  txDesc: { color: '#94a3b8', fontSize: 11, flex: 1, textAlign: 'right' },
  txDate: { color: '#64748b', fontSize: 10 },
  statRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  statLbl: { color: '#cbd5e1', fontSize: 13 },
  statVal: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  listItem: { backgroundColor: '#1a2332', padding: 10, borderRadius: 6, marginTop: 4 },
  listTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },
  bottomBar: { padding: 10, backgroundColor: '#0f2438', borderTopWidth: 1, borderTopColor: '#334155' },
  inputRow: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  inp: { flex: 1, backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, fontSize: 14, textAlign: 'right' },
  btn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  listen: { backgroundColor: '#7c3aed', padding: 8, borderRadius: 8, marginBottom: 24 },
  listenTxt: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
