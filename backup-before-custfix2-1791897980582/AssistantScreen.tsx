// AssistantScreen.tsx — دستیار کامل
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch, NativeModules,
  Platform, DeviceEventEmitter
} from 'react-native';
import { getAssistantHistory, addAssistantHistory, SAMPLE_COMMANDS } from './lib.assistant';
import {
  deepSearch, resolveBox, resolvePerson, setContext, getContext, clearContext,
  boxDeposit, boxWithdraw, extractCurrency, extractAmount, Entity, norm
} from './lib.assistant.core';

const { Speech } = NativeModules;
const speechAvailable = !!(Speech && Platform.OS === 'android');

export default function AssistantScreen({ showToast, onExit }: any) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [speakAnswers, setSpeakAnswers] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [box, setBox] = useState<any>(null);          // صندوق باز شده
  const [boxTxs, setBoxTxs] = useState<any[]>([]);    // تراکنش‌های صندوق
  const [amount, setAmount] = useState('');           // مبلغ ورودی
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastMsg, setLastMsg] = useState('');

  const load = useCallback(async () => {
    try { setHistory((await getAssistantHistory()) || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!speechAvailable) return;
    const subs = [
      DeviceEventEmitter.addListener('onSpeechReady', () => setListening(true)),
      DeviceEventEmitter.addListener('onSpeechPartial', (m: any) => setPartialText(m?.text || '')),
      DeviceEventEmitter.addListener('onSpeechResult', (m: any) => {
        setListening(false);
        setPartialText('');
        const t = m?.text || '';
        if (t) { setText(t); setTimeout(() => run(t), 200); }
      }),
      DeviceEventEmitter.addListener('onSpeechError', (m: any) => {
        setListening(false); setPartialText('');
        showToast?.('🎤 ' + (m?.message || 'خطا'), true);
      }),
    ];
    return () => { subs.forEach(s => s.remove()); };
  }, [showToast]);

  const startVoice = async () => {
    if (!speechAvailable) { showToast?.('🎤 فقط روی گوشی', true); return; }
    try { setPartialText(''); await Speech.startListening('fa-IR'); } catch (e: any) { showToast?.('❌ ' + (e?.message || ''), true); }
  };
  const stopVoice = async () => { if (!speechAvailable) return; try { await Speech.stopListening(); } catch {} setListening(false); };
  const speak = async (t: string) => { if (!speechAvailable || !speakAnswers) return; try { await Speech.speak(t, 'fa-IR'); } catch {} };

  // ═══════════════════════════════════════════
  // باز کردن صندوق
  // ═══════════════════════════════════════════
  const openBox = async (b: any) => {
    try {
      const { getBoxTransactions, getAllBalances } = await import('./lib.boxes');
      const txs = await getBoxTransactions(b.id || b.local_id).catch(() => []) || [];
      const bals = await getAllBalances().catch(() => ({})) || {};
      const balance = bals[b.id || b.local_id] || 0;
      setBox({ ...b, _balance: balance });
      setBoxTxs(txs || []);
      setSearchResults([]);
      setContext({ lastEntity: { type: 'box', id: b.id || b.local_id, name: b.name || b.code, meta: b } });
      setLastMsg('📦 ' + (b.name || b.code) + ' — ' + balance.toLocaleString('en-US') + ' ' + (b.currency || 'AFN'));
      speak('صندوق ' + (b.name || b.code));
    } catch (e: any) { showToast?.('❌ ' + (e?.message || ''), true); }
  };

  const refreshBox = async () => {
    if (!box) return;
    try {
      const { getBoxTransactions, getAllBalances } = await import('./lib.boxes');
      const txs = await getBoxTransactions(box.id || box.local_id).catch(() => []) || [];
      const bals = await getAllBalances().catch(() => ({})) || {};
      const balance = bals[box.id || box.local_id] || 0;
      setBox({ ...box, _balance: balance });
      setBoxTxs(txs || []);
    } catch {}
  };

  // ═══════════════════════════════════════════
  // اجرای دستور
  // ═══════════════════════════════════════════
  const run = async (cmd?: string) => {
    const c = (cmd || text).trim();
    if (!c) return;
    setProcessing(true);
    setText('');

    try {
      const low = norm(c);

      // ─── اگه صندوق بازه: واریز/برداشت ───
      if (box) {
        const amt = extractAmount(low);
        const isDeposit = /واریز|اضافه|بزن|جمع|افزایش|دریافت/.test(low);
        const isWithdraw = /برداشت|کم|کسر|خرج|پرداخت/.test(low);
        
        if (amt && amt > 0 && (isDeposit || isWithdraw)) {
          const r = isDeposit ? await boxDeposit(box, amt) : await boxWithdraw(box, amt);
          setLastMsg(r.msg);
          speak(r.msg);
          showToast?.(r.msg);
          await refreshBox();
          await addAssistantHistory({ id: 'h_' + Date.now(), text: c, intent: { kind: 'action', action: isDeposit ? 'deposit' : 'withdraw', params: { amount: amt }, confidence: 100, raw: c, reply: r.msg }, response: r.msg, timestamp: Date.now() });
          setHistory(await getAssistantHistory());
          setProcessing(false);
          return;
        }

        // بستن
        if (/بستن|بنداز|خروج|برو|لغو|تمام/.test(low)) {
          setBox(null);
          setBoxTxs([]);
          clearContext();
          setLastMsg('بسته شد');
          setProcessing(false);
          return;
        }
      }

      // ─── جستجو ───
      setLoading(true);
      
      // تشخیص نوع
      let types: string[] | undefined;
      const isBoxQuery = /صندوق|کارتکش|کاردکس|کارت.?کس/.test(low);
      const isCustQuery = /مشتری|طرف.?حساب/.test(low);
      const isInvQuery = /فاکتور|فاکتر|صورت.?حساب/.test(low);
      
      if (isBoxQuery) types = ['box'];
      else if (isCustQuery) types = ['customer'];
      else if (isInvQuery) types = ['invoice'];

      // استخراج اسم
      const nameQuery = low
        .replace(/کارتکش|کاردکس|کارت.?کس|فاکتور|فاکتر|صورت.?حساب|صندوق|مشتری|طرف.?حساب|حواله|چک|را|بیار|بیاور|بگیر|نشون|نشان|بده|بزن|ویرایش|کن|برای|از|به|رو|بیارش|دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|usd|afn|eur|irr|irt/g, '')
        .replace(/[^\u0600-\u06FF\w\s\d]/g, '')
        .trim();

      const currency = extractCurrency(low);

      // اگه صندوق: با ارز و اسم
      if (isBoxQuery && nameQuery.length >= 2) {
        const b = await resolveBox(nameQuery, currency);
        if (b) {
          setLoading(false);
          setProcessing(false);
          await openBox(b);
          return;
        }
      }

      // جستجوی کلی
      if (nameQuery.length >= 2) {
        const results = await deepSearch(nameQuery, types);
        if (results.length === 1) {
          setLoading(false);
          setProcessing(false);
          if (results[0].type === 'box') { await openBox(results[0].meta); return; }
          showToast?.('✅ ' + results[0].name);
          setLastMsg(results[0].name + ' — ' + (results[0].subtitle || ''));
          speak(results[0].name);
          setProcessing(false);
          return;
        }
        if (results.length > 1) {
          setSearchResults(results);
          setLastMsg(`${results.length} نتیجه — انتخاب کن`);
          speak(`${results.length} نتیجه`);
          setLoading(false);
          setProcessing(false);
          return;
        }
      }

      setLastMsg('❌ پیدا نشد');
      showToast?.('❌ پیدا نشد', true);
      setLoading(false);
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || ''), true);
    }
    setProcessing(false);
  };

  // ═══════════════════════════════════════════
  // واریز/برداشت سریع
  // ═══════════════════════════════════════════
  const quickDeposit = async () => {
    const amt = Number(amount) || 0;
    if (!box || amt <= 0) { showToast?.('مبلغ معتبر وارد کن', true); return; }
    const r = await boxDeposit(box, amt);
    setLastMsg(r.msg);
    speak(r.msg);
    showToast?.(r.msg);
    setAmount('');
    await refreshBox();
  };

  const quickWithdraw = async () => {
    const amt = Number(amount) || 0;
    if (!box || amt <= 0) { showToast?.('مبلغ معتبر وارد کن', true); return; }
    const r = await boxWithdraw(box, amt);
    setLastMsg(r.msg);
    speak(r.msg);
    showToast?.(r.msg);
    setAmount('');
    await refreshBox();
  };

  const useSample = (t: string) => { setText(t); setTimeout(() => run(t), 100); };

  // ═══════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.backBtn}><Text style={s.backTxt}>×</Text></TouchableOpacity>
        <Text style={s.title}>🤖 دستیار</Text>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.menuBtn}><Text style={s.menuTxt}>☰</Text></TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        
        {/* ═══ صندوق باز ═══ */}
        {box && (
          <View style={s.boxCard}>
            <View style={s.boxHead}>
              <Text style={s.boxTitle}>📦 {box.name || box.code}</Text>
              <TouchableOpacity onPress={() => { setBox(null); setBoxTxs([]); clearContext(); }}>
                <Text style={s.boxX}>×</Text>
              </TouchableOpacity>
            </View>

            {/* اطلاعات */}
            <View style={s.boxInfo}>
              <View style={s.boxInfoRow}><Text style={s.boxLbl}>کد</Text><Text style={s.boxVal}>{box.code || '—'}</Text></View>
              <View style={s.boxInfoRow}><Text style={s.boxLbl}>ارز</Text><Text style={s.boxVal}>{box.currency || 'AFN'}</Text></View>
              <View style={s.boxInfoRow}><Text style={s.boxLbl}>صاحب</Text><Text style={s.boxVal}>{box.owner_name || '—'}</Text></View>
            </View>

            {/* موجودی */}
            <View style={s.balanceBox}>
              <Text style={s.balanceLbl}>موجودی فعلی</Text>
              <Text style={s.balanceNum}>{Math.abs(Number(box._balance) || 0).toLocaleString('en-US')}</Text>
              <Text style={s.balanceCur}>{box.currency || 'AFN'}</Text>
            </View>

            {/* واریز/برداشت */}
            <View style={s.actionBox}>
              <TextInput
                style={s.amtInp}
                value={amount}
                onChangeText={setAmount}
                placeholder="مبلغ (مثلاً 500)"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#059669' }]} onPress={quickDeposit}>
                  <Text style={s.actionTxt}>✅ واریز</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#dc2626' }]} onPress={quickWithdraw}>
                  <Text style={s.actionTxt}>❌ برداشت</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* کارتکش */}
            <Text style={s.txTitle}>📋 کارتکش ({boxTxs.length})</Text>
            {boxTxs.length === 0 ? (
              <Text style={s.empty}>تراکنشی نیست</Text>
            ) : (
              boxTxs.slice(0, 30).map((tx: any, i: number) => {
                const isDep = tx.type === 'deposit' || tx.type === 'in' || tx.type === 'transfer_in';
                return (
                  <View key={i} style={s.txRow}>
                    <Text style={s.txIcon}>{isDep ? '➕' : '➖'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.txAmt, { color: isDep ? '#10b981' : '#ef4444' }]}>
                        {isDep ? '+' : '-'}{(Number(tx.amount) || 0).toLocaleString('en-US')} {tx.currency || box.currency || ''}
                      </Text>
                      <Text style={s.txDesc}>{tx.description || ''}</Text>
                    </View>
                    <Text style={s.txDate}>{tx.date ? new Date(tx.date).toLocaleDateString('fa-IR') : ''}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ═══ نتایج جستجو ═══ */}
        {!box && searchResults.length > 0 && (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>🔍 {searchResults.length} نتیجه:</Text>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={s.resultItem}
                onPress={async () => {
                  if (r.type === 'box') await openBox(r.meta);
                  else { showToast?.('✅ ' + r.name); setSearchResults([]); }
                }}
              >
                <Text style={s.resultIcon}>{r.type === 'box' ? '📦' : r.type === 'customer' ? '👤' : '📄'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName}>{r.name}</Text>
                  {r.subtitle ? <Text style={s.resultSub}>{r.subtitle}</Text> : null}
                </View>
                <Text style={s.resultScore}>{r.score}%</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => setSearchResults([])}>
              <Text style={s.actionTxt}>✕ بستن</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ آخرین پیام ═══ */}
        {lastMsg ? (
          <View style={s.msgBox}>
            <Text style={s.msgTxt}>{lastMsg}</Text>
          </View>
        ) : null}

        {/* ═══ ورودی ═══ */}
        {!box && (
          <>
            <TextInput
              style={s.bigInp}
              value={text}
              onChangeText={setText}
              placeholder="مثلاً: کارتکش دالر فروغی"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
              onSubmitEditing={() => run()}
            />
            <View style={s.row}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={() => run()} disabled={processing || !text.trim()}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={s.actionTxt}>▶ جستجو</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#0891b2' }]} onPress={startVoice} disabled={!speechAvailable}>
                <Text style={s.actionTxt}>🎤</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#64748b' }]} onPress={() => { setText(''); setSearchResults([]); }}>
                <Text style={s.actionTxt}>🗑</Text>
              </TouchableOpacity>
            </View>

            {listening && <View style={s.listeningBox}><Text style={s.listeningTxt}>🎤 {partialText || 'گوش می‌دم...'}</Text></View>}
            {loading && <ActivityIndicator color="#7c3aed" size="large" style={{ marginTop: 14 }} />}

            <Text style={s.sectionT}>💡 نمونه:</Text>
            <View style={s.samplesGrid}>
              {[
                { icon: '📦', text: 'کارتکش دالر فروغی' },
                { icon: '📦', text: 'صندوق احمد' },
                { icon: '👤', text: 'مشتری رضا' },
                { icon: '📄', text: 'فاکتور فروغی' },
              ].map((sc, i) => (
                <TouchableOpacity key={i} style={s.sampleBtn} onPress={() => useSample(sc.text)}>
                  <Text style={s.sampleIcon}>{sc.icon}</Text>
                  <Text style={s.sampleTxt}>{sc.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={sidebarOpen} transparent animationType="slide" onRequestClose={() => setSidebarOpen(false)}>
        <TouchableOpacity style={s.sbBg} activeOpacity={1} onPress={() => setSidebarOpen(false)}>
          <View style={s.sidebar}>
            <View style={s.sbHead}>
              <Text style={s.sbTitle}>⚙️ دستیار</Text>
              <TouchableOpacity onPress={() => setSidebarOpen(false)}><Text style={s.sbX}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14 }}>
              <View style={s.sbRow}>
                <Text style={s.sbLbl}>🔊 پاسخ صوتی</Text>
                <Switch value={speakAnswers} onValueChange={setSpeakAnswers} />
              </View>
              <Text style={[s.sbLbl, { marginTop: 16, fontWeight: 'bold' }]}>📌 نمونه:</Text>
              <Text style={s.sbHint}>• «کارتکش دالر فروغی»</Text>
              <Text style={s.sbHint}>• «۵۰۰ واریز» (وقتی صندوق بازه)</Text>
              <Text style={s.sbHint}>• «۱۰۰ برداشت»</Text>
              <Text style={s.sbHint}>• «بستن»</Text>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backBtn: { padding: 8 }, backTxt: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  menuBtn: { padding: 8 }, menuTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  bigInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#7c3aed', borderRadius: 12, padding: 14, fontSize: 16, textAlign: 'right', minHeight: 70 },
  row: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  boxCard: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#7c3aed' },
  boxHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
  boxTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  boxX: { color: '#dc2626', fontSize: 26, fontWeight: 'bold' },
  boxInfo: { marginBottom: 10 },
  boxInfoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 4 },
  boxLbl: { color: '#94a3b8', fontSize: 12 },
  boxVal: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  balanceBox: { backgroundColor: '#1a2332', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  balanceLbl: { color: '#94a3b8', fontSize: 12 },
  balanceNum: { color: '#10b981', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  balanceCur: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  actionBox: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginBottom: 12 },
  amtInp: { backgroundColor: '#0f2438', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', fontWeight: 'bold' },
  txTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginTop: 8, marginBottom: 6 },
  txRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  txIcon: { fontSize: 16 },
  txAmt: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  txDesc: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  txDate: { color: '#64748b', fontSize: 10 },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 13 },
  resultCard: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#0891b2' },
  resultTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  resultItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6 },
  resultIcon: { fontSize: 20 },
  resultName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  resultSub: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  resultScore: { color: '#059669', fontSize: 12, fontWeight: 'bold' },
  msgBox: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#7c3aed' },
  msgTxt: { color: '#fff', fontSize: 14, textAlign: 'right', fontWeight: 'bold' },
  sectionT: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', marginTop: 14, marginBottom: 8, textAlign: 'right' },
  samplesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  sampleBtn: { backgroundColor: '#1a2332', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  sampleIcon: { fontSize: 16 },
  sampleTxt: { color: '#cbd5e1', fontSize: 12 },
  listeningBox: { backgroundColor: '#7c3aed', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  listeningTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  sbBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'flex-end' },
  sidebar: { width: '80%', height: '100%', backgroundColor: '#0f2438', borderLeftWidth: 1, borderColor: '#334155' },
  sbHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sbTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  sbX: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sbRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  sbLbl: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  sbHint: { color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'right' },
});
