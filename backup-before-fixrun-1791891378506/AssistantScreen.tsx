// AssistantScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch, NativeModules,
  Platform, DeviceEventEmitter
} from 'react-native';
import {
  parseIntent, goTab, goSub, getAssistantHistory, addAssistantHistory,
  clearAssistantHistory, SAMPLE_COMMANDS,
} from './lib.assistant';
import { executeQuery, executeAction, getLearnedCommands, recordCommand, LearnedCmd } from './lib.assistant.executor';

const { Speech } = NativeModules;
const speechAvailable = !!(Speech && Platform.OS === 'android');

export default function AssistantScreen({ showToast, onExit }: any) {
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [speakAnswers, setSpeakAnswers] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [learnedCmds, setLearnedCmds] = useState<LearnedCmd[]>([]);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const load = useCallback(async () => {
    try { setHistory((await getAssistantHistory()) || []); } catch {}
    try { setLearnedCmds(await getLearnedCommands()); } catch {}
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
        if (t) {
          setText(t);
          setTimeout(() => runCommand(t), 200);
        }
      }),
      DeviceEventEmitter.addListener('onSpeechError', (m: any) => {
        setListening(false);
        setPartialText('');
        showToast?.('🎤 ' + (m?.message || 'خطا'), true);
      }),
    ];
    return () => { subs.forEach(s => s.remove()); };
  }, [showToast]);

  const startVoice = async () => {
    if (!speechAvailable) {
      showToast?.('🎤 فقط روی گوشی', true);
      return;
    }
    try {
      setPartialText('');
      await Speech.startListening('fa-IR');
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
  };

  const stopVoice = async () => {
    if (!speechAvailable) return;
    try { await Speech.stopListening(); } catch {}
    setListening(false);
  };

  const speak = async (txt: string) => {
    if (!speechAvailable || !speakAnswers) return;
    try { await Speech.speak(txt, 'fa-IR'); } catch {}
  };

  const runCommand = async (cmd?: string) => {
    const command = (cmd || text).trim();
    if (!command) return;
    setProcessing(true);
    setText('');

    try {
      const intent = parseIntent(command);
      setLastResult(intent);

      let finalReply = intent.reply;

      if (intent.kind === 'navigate') {
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab);
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
      } else if (intent.kind === 'create') {
        if (intent.action === 'newInvoice') {
          setTimeout(() => {
            onExit?.();
            setTimeout(() => goTab('exchange'), 100);
          }, 600);
        }
      }

      await addAssistantHistory({
        id: 'h_' + Date.now(),
        text: command,
        intent,
        response: finalReply,
        timestamp: Date.now(),
      });
      setHistory(await getAssistantHistory());
      speak(finalReply);
      showToast?.('🤖 ' + finalReply);
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setProcessing(false);
  };

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };

  const useSample = (txt: string) => {
    setText(txt);
    setTimeout(() => runCommand(txt), 100);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.backBtn}>
          <Text style={s.backTxt}>×</Text>
        </TouchableOpacity>
        <Text style={s.title}>🤖 دستیار هوشمند</Text>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.menuBtn}>
          <Text style={s.menuTxt}>☰</Text>
        </TouchableOpacity>
      </View>

      <View style={s.modeRow}>
        <TouchableOpacity style={[s.modeBtn, mode === 'text' && s.modeBtnActive]} onPress={() => setMode('text')}>
          <Text style={[s.modeTxt, mode === 'text' && s.modeTxtActive]}>⌨️ متنی</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.modeBtn, mode === 'voice' && s.modeBtnActive]} onPress={() => setMode('voice')}>
          <Text style={[s.modeTxt, mode === 'voice' && s.modeTxtActive]}>🎤 صوتی</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
        {mode === 'voice' && (
          <View style={s.voiceCenter}>
            <TouchableOpacity
              style={[s.bigMic, listening && s.bigMicActive]}
              onPress={listening ? stopVoice : startVoice}
              disabled={!speechAvailable}
            >
              <Text style={s.bigMicTxt}>{listening ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
            <Text style={s.voiceHint}>
              {!speechAvailable ? '🎤 فقط روی گوشی' : listening ? '🎤 در حال گوش دادن...' : '🎤 بزن و صحبت کن'}
            </Text>
            {listening && partialText ? (
              <View style={s.partialBox}><Text style={s.partialTxt}>{partialText}</Text></View>
            ) : null}
          </View>
        )}

        {mode === 'text' && (
          <>
            <TextInput
              style={s.bigInp}
              value={text}
              onChangeText={setText}
              placeholder="مثلاً: بازار زنده رو بیار"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
              onSubmitEditing={() => runCommand()}
            />
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={() => runCommand()} disabled={processing || !text.trim()}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>▶ اجرا</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2' }]} onPress={startVoice} disabled={!speechAvailable}>
                <Text style={s.btnTxt}>🎤</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => { setText(''); setLastResult(null); }}>
                <Text style={s.btnTxt}>🗑</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {lastResult && (
          <View style={[s.card, { borderColor: lastResult.confidence >= 70 ? '#059669' : lastResult.confidence >= 40 ? '#f59e0b' : '#dc2626' }]}>
            <Text style={s.cardTitle}>
              {lastResult.kind === 'navigate' ? '🧭 ناوبری' : lastResult.kind === 'query' ? '❓ سؤال' : lastResult.kind === 'action' ? '⚡ عمل' : lastResult.kind === 'create' ? '➕ ساخت' : '⚠️ نامفهوم'}
            </Text>
            <Text style={s.rowTxt}>🎯 اطمینان: <Text style={s.bold}>{lastResult.confidence}%</Text></Text>
            <Text style={s.rowTxt}>💬 پاسخ: <Text style={s.bold}>{lastResult.reply}</Text></Text>
            {speechAvailable && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', marginTop: 8 }]} onPress={() => speak(lastResult.reply)}>
                <Text style={s.btnTxt}>🔊 بخوان</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={s.sectionT}>💡 پیشنهادها:</Text>
        <View style={s.samplesGrid}>
          {SAMPLE_COMMANDS.map((sc, i) => (
            <TouchableOpacity key={i} style={s.sampleBtn} onPress={() => useSample(sc.text)}>
              <Text style={s.sampleIcon}>{sc.icon}</Text>
              <Text style={s.sampleTxt}>{sc.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {history.length > 0 && (
          <>
            <Text style={[s.sectionT, { marginTop: 16 }]}>📋 تاریخچه ({history.length})</Text>
            {history.slice(0, 10).map((h: any, i: number) => (
              <TouchableOpacity key={i} style={[s.card, { borderColor: '#334155', marginBottom: 6 }]} onPress={() => setText(h.text)}>
                <Text style={s.histTxt}>«{h.text}»</Text>
                <Text style={s.histMeta}>{fmtDate(h.timestamp)} — {h.response}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
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
              <View style={s.sbRow}>
                <Text style={s.sbLbl}>🎤 میکروفون</Text>
                <Text style={s.sbVal}>{speechAvailable ? '✅ فعال' : '❌ وب'}</Text>
              </View>
              <Text style={[s.sbLbl, { marginTop: 16, fontWeight: 'bold' }]}>📌 دستورات:</Text>
              <Text style={s.sbHint}>• «بازار زنده رو بیار»</Text>
              <Text style={s.sbHint}>• «صندوق‌ها»</Text>
              <Text style={s.sbHint}>• «مانده احمد»</Text>
              <Text style={s.sbHint}>• «نرخ دالر چنده؟»</Text>
              <Text style={s.sbHint}>• «۱۰۰ دالر از احمد به محمود»</Text>
              <Text style={s.sbHint}>• «فاکتور جدید بزن»</Text>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#dc2626', marginTop: 16 }]}
                onPress={async () => { await clearAssistantHistory(); setHistory([]); showToast?.('🗑 پاک شد'); }}
              >
                <Text style={s.btnTxt}>🗑 پاک کردن تاریخچه</Text>
              </TouchableOpacity>
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
  backBtn: { padding: 8 },
  backTxt: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  menuBtn: { padding: 8 },
  menuTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  modeRow: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', padding: 8, gap: 6 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#1a2332' },
  modeBtnActive: { backgroundColor: '#7c3aed' },
  modeTxt: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  modeTxtActive: { color: '#fff' },
  bigInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#7c3aed', borderRadius: 12, padding: 14, fontSize: 16, textAlign: 'right', minHeight: 70 },
  row: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 2, borderColor: '#334155' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  rowTxt: { color: '#cbd5e1', fontSize: 13, marginTop: 4, textAlign: 'right' },
  bold: { fontWeight: 'bold', color: '#fff' },
  sectionT: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 8, textAlign: 'right' },
  voiceCenter: { alignItems: 'center', paddingVertical: 30 },
  bigMic: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#1a2332' },
  bigMicActive: { backgroundColor: '#dc2626', borderColor: '#fca5a5' },
  bigMicTxt: { fontSize: 60, color: '#fff' },
  voiceHint: { color: '#cbd5e1', fontSize: 14, marginTop: 16, textAlign: 'center' },
  partialBox: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginTop: 16, borderWidth: 1, borderColor: '#7c3aed' },
  partialTxt: { color: '#fff', fontSize: 15, textAlign: 'right' },
  samplesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  sampleBtn: { backgroundColor: '#1a2332', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  sampleIcon: { fontSize: 16 },
  sampleTxt: { color: '#cbd5e1', fontSize: 12 },
  histTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },
  histMeta: { color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'right' },
  sbBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'flex-end' },
  sidebar: { width: '80%', height: '100%', backgroundColor: '#0f2438', borderLeftWidth: 1, borderColor: '#334155' },
  sbHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sbTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  sbX: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sbRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  sbLbl: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  sbVal: { color: '#94a3b8', fontSize: 12 },
  sbHint: { color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'right' },
});
