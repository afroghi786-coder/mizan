const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-superv2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['App.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.assistant.ts
// ═══════════════════════════════════════════════════════
const libCode = `// lib.assistant.ts — مغز دستیار فوق‌هوشمند
import AsyncStorage from '@react-native-async-storage/async-storage';

let _nav: any = {};
export function setNavigator(n: any) { _nav = { ..._nav, ...n }; }
export function goTab(t: string) { try { _nav.setTab?.(t); } catch {} }
export function goSub(s: string) { try { _nav.setSub?.(s); } catch {} }

export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\\s+/g, ' ')
    .trim();
}

export type IntentKind = 'navigate' | 'query' | 'action' | 'create' | 'unknown';

export interface Intent {
  kind: IntentKind;
  action: string;
  params: any;
  confidence: number;
  raw: string;
  reply: string;
}

const NAV_MAP: Array<{ words: string[]; tab: string; sub?: string; label: string }> = [
  { words: ['بازار زنده', 'بازارزنده'], tab: 'exchange', sub: 'liveMarket', label: 'بازار زنده' },
  { words: ['بازار عمومی', 'بازارعمومی'], tab: 'publicMarket', label: 'بازار عمومی' },
  { words: ['صندوق'], tab: 'exchange', sub: 'boxes', label: 'صندوق‌ها' },
  { words: ['حواله جات', 'حواله‌جات', 'حواله‌ها'], tab: 'exchange', sub: 'hawalas', label: 'حواله‌جات' },
  { words: ['چک'], tab: 'exchange', sub: 'checks', label: 'چک‌ها' },
  { words: ['مشتری'], tab: 'exchange', sub: 'customers', label: 'مشتریان' },
  { words: ['شریک', 'شرکا'], tab: 'exchange', sub: 'partners', label: 'شرکا' },
  { words: ['گزارش', 'دفتر'], tab: 'exchange', sub: 'ledger', label: 'گزارش' },
  { words: ['فاکتور فروش', 'فروش'], tab: 'sales', label: 'فاکتور فروش' },
  { words: ['فاکتور خرید', 'خرید'], tab: 'purchases', label: 'فاکتور خرید' },
  { words: ['گروه'], tab: 'exchange', sub: 'myGroups', label: 'گروه‌ها' },
  { words: ['داشبورد', 'خانه'], tab: 'dashboard', label: 'داشبورد' },
  { words: ['کارمند'], tab: 'employees', label: 'کارمندان' },
  { words: ['هزینه'], tab: 'expenses', label: 'هزینه‌ها' },
  { words: ['انبار', 'موجودی'], tab: 'inventory', label: 'انبار' },
  { words: ['تنظیمات'], tab: 'settings', label: 'تنظیمات' },
  { words: ['بانک'], tab: 'bankMatch', label: 'بانک' },
  { words: ['صرافی'], tab: 'exchange', sub: 'list', label: 'صرافی' },
];

export function parseIntent(text: string): Intent {
  const raw = text;
  const t = norm(text).toLowerCase();

  if (!t || t.length < 2) {
    return { kind: 'unknown', action: '', params: {}, confidence: 0, raw, reply: 'چیزی نگفتی' };
  }

  // Navigation
  for (const nav of NAV_MAP) {
    for (const w of nav.words) {
      if (t.includes(w.toLowerCase())) {
        return {
          kind: 'navigate',
          action: 'goto',
          params: { tab: nav.tab, sub: nav.sub, label: nav.label },
          confidence: 90,
          raw,
          reply: 'میرم به ' + nav.label,
        };
      }
    }
  }

  // Query — مانده
  const balanceMatch = t.match(/(?:مانده|حساب|بدهکار|طلبکار)\\s+(?:از\\s+)?([\\u0600-\\u06FF\\w]+)/);
  if (balanceMatch) {
    return { kind: 'query', action: 'getBalance', params: { name: balanceMatch[1] }, confidence: 85, raw, reply: 'مانده ' + balanceMatch[1] };
  }

  // Query — صندوق
  if (/صندوق/.test(t)) {
    return { kind: 'query', action: 'getBox', params: {}, confidence: 80, raw, reply: 'موجودی صندوق' };
  }

  // Query — سود
  if (/سود|درآمد/.test(t)) {
    return { kind: 'query', action: 'getProfit', params: {}, confidence: 90, raw, reply: 'سود امروز' };
  }

  // Query — نرخ
  if (/نرخ|قیمت/.test(t)) {
    const cm = t.match(/(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)/);
    return { kind: 'query', action: 'getRate', params: { currency: cm?.[1] }, confidence: 85, raw, reply: 'نرخ ' + (cm?.[1] || 'ارز') };
  }

  // Transfer
  const tm = t.match(/(\\d+(?:\\.\\d+)?)\\s*(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)?\\s*از\\s+([\\u0600-\\u06FF\\w]+)\\s+به\\s+([\\u0600-\\u06FF\\w]+)/);
  if (tm) {
    return {
      kind: 'action',
      action: 'transfer',
      params: { amount: parseFloat(tm[1]), currency: tm[2] || 'AFN', from: tm[3], to: tm[4] },
      confidence: 85,
      raw,
      reply: 'انتقال ' + tm[1] + ' ' + (tm[2] || '') + ' از ' + tm[3] + ' به ' + tm[4],
    };
  }

  // Pay
  const pm = t.match(/(\\d+(?:\\.\\d+)?)\\s*(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)?\\s*به\\s+([\\u0600-\\u06FF\\w]+)/);
  if (pm) {
    return {
      kind: 'action',
      action: 'pay',
      params: { amount: parseFloat(pm[1]), currency: pm[2] || 'AFN', to: pm[3] },
      confidence: 80,
      raw,
      reply: 'پرداخت ' + pm[1] + ' ' + (pm[2] || '') + ' به ' + pm[3],
    };
  }

  // Receive
  const rm = t.match(/(\\d+(?:\\.\\d+)?)\\s*(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم)?\\s*از\\s+([\\u0600-\\u06FF\\w]+)/);
  if (rm) {
    return {
      kind: 'action',
      action: 'receive',
      params: { amount: parseFloat(rm[1]), currency: rm[2] || 'AFN', from: rm[3] },
      confidence: 80,
      raw,
      reply: 'دریافت ' + rm[1] + ' ' + (rm[2] || '') + ' از ' + rm[3],
    };
  }

  // Create
  if (/فاکتور/.test(t) && /(بزن|بساز|جدید)/.test(t)) {
    return { kind: 'create', action: 'newInvoice', params: {}, confidence: 85, raw, reply: 'فرم فاکتور جدید' };
  }
  if (/حواله/.test(t) && /(بزن|بساز|بفرست|جدید)/.test(t)) {
    return { kind: 'create', action: 'newHawala', params: {}, confidence: 85, raw, reply: 'فرم حواله جدید' };
  }
  if (/مشتری/.test(t) && /(جدید|اضافه|بساز)/.test(t)) {
    return { kind: 'create', action: 'newCustomer', params: {}, confidence: 80, raw, reply: 'مشتری جدید' };
  }

  if (/چقدر|چند|چیه|کیه|کجا/.test(t)) {
    return { kind: 'query', action: 'general', params: { q: text }, confidence: 60, raw, reply: 'در حال جستجو...' };
  }

  return {
    kind: 'unknown',
    action: '',
    params: {},
    confidence: 10,
    raw,
    reply: 'متوجه نشدم. مثلاً: «بازار زنده»، «صندوق‌ها»، «مانده احمد»',
  };
}

const HIST_KEY = '@mizan_assistant_history_v1';
export async function getAssistantHistory(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(HIST_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}
export async function addAssistantHistory(h: any): Promise<void> {
  const list = await getAssistantHistory();
  list.unshift(h);
  await AsyncStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 100)));
}
export async function clearAssistantHistory(): Promise<void> {
  await AsyncStorage.removeItem(HIST_KEY);
}

export const SAMPLE_COMMANDS = [
  { icon: '🏛️', text: 'بازار زنده رو بیار' },
  { icon: '📦', text: 'صندوق‌ها' },
  { icon: '💸', text: 'مانده احمد چقدره؟' },
  { icon: '📊', text: 'سود امروز چقدره؟' },
  { icon: '💱', text: 'نرخ دالر چنده؟' },
  { icon: '🔄', text: '۱۰۰ دالر از احمد به محمود' },
  { icon: '📝', text: 'فاکتور فروش رو بیار' },
  { icon: '➕', text: 'فاکتور جدید بزن' },
  { icon: '👥', text: 'مشتریان رو بیار' },
  { icon: '📋', text: 'حواله‌جات' },
  { icon: '🏦', text: 'بانک رو باز کن' },
  { icon: '🎯', text: 'بازار عمومی' },
];
`;

fs.writeFileSync('lib.assistant.ts', libCode, 'utf8');
console.log('✅ lib.assistant.ts ساخته شد');

// ═══════════════════════════════════════════════════════
// ۲. AssistantScreen.tsx
// ═══════════════════════════════════════════════════════
const screenCode = `// AssistantScreen.tsx
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
`;

fs.writeFileSync('AssistantScreen.tsx', screenCode, 'utf8');
console.log('✅ AssistantScreen.tsx ساخته شد');

// ═══════════════════════════════════════════════════════
// ۳. App.tsx
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;
const appCRLF = app.includes('\r\n');
if (appCRLF) app = app.replace(/\r\n/g, '\n');

// ۳.۱ import
if (!app.includes("from './AssistantScreen'")) {
  const lines = app.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0,
      "import AssistantScreen from './AssistantScreen';\nimport { setNavigator } from './lib.assistant';");
    app = lines.join('\n');
    console.log('✅ import اضافه شد');
  }
}

// ۳.۲ tab
if (!app.includes("'assistant'")) {
  const pat = /(\{\s*key:\s*'publicMarket'[^}]*\},)/;
  const m = app.match(pat);
  if (m) {
    app = app.replace(m[0], m[0] + "\n    { key: 'assistant', icon: '🤖', label: 'دستیار', color: '#7c3aed' },");
    console.log('✅ tab اضافه شد');
  }
}

// ۳.۳ hide tabs
if (app.includes("{tab !== 'exchange' && tab !== 'publicMarket'")) {
  app = app.replace(
    "{tab !== 'exchange' && tab !== 'publicMarket'",
    "{tab !== 'exchange' && tab !== 'publicMarket' && tab !== 'assistant'"
  );
  console.log('✅ hide tabs');
}

// ۳.۴ render
if (!app.includes('<AssistantScreen')) {
  const pat = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}";
  if (app.includes(pat)) {
    app = app.replace(pat, pat + "\n      {tab === 'assistant' && <AssistantScreen showToast={showToast} onExit={() => setTab('dashboard')} />}");
    console.log('✅ render');
  }
}

// ۳.۵ navigator — روش ساده‌تر: جستجوی useEffect با استفاده از ایندکس
if (!app.includes('setNavigator({')) {
  const mainIdx = app.indexOf('function MainApp(');
  if (mainIdx > 0) {
    // پیدا کردن اولین "useEffect(" بعد از MainApp
    const useIdx = app.indexOf('useEffect(', mainIdx);
    if (useIdx > 0) {
      // پیدا کردن "}, [" یا "});" بعد از useEffect
      let braceCount = 0;
      let endPos = -1;
      for (let i = useIdx; i < app.length - 5; i++) {
        if (app[i] === '{') braceCount++;
        else if (app[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            // بعد از } ، باید , [ یا ) باشه
            const nextChars = app.substring(i, i + 30);
            if (nextChars.startsWith('}, [') || nextChars.startsWith('});')) {
              // پیدا کردن ; انتهای useEffect
              const semiIdx = app.indexOf(';', i);
              if (semiIdx > 0 && semiIdx < i + 50) {
                endPos = semiIdx + 1;
                break;
              }
            }
          }
        }
      }
      if (endPos > 0) {
        const navCode = `\n\n  // 🌉 Register navigator for assistant\n  useEffect(() => {\n    setNavigator({ setTab: (t: any) => setTab(t) });\n  }, []);`;
        app = app.substring(0, endPos) + navCode + app.substring(endPos);
        console.log('✅ navigator ثبت شد در موقعیت ' + endPos);
      } else {
        console.log('⚠️ انتهای useEffect پیدا نشد — navigator ثبت نشد (بعداً دستی)');
      }
    }
  }
}

if (appCRLF) app = app.replace(/\n/g, '\r\n');
if (app !== appOrig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
console.log((fs.existsSync('lib.assistant.ts') ? '✅' : '❌') + ' lib.assistant.ts');
console.log((fs.existsSync('AssistantScreen.tsx') ? '✅' : '❌') + ' AssistantScreen.tsx');
const fin = fs.readFileSync('App.tsx', 'utf8');
console.log('import: ' + (fin.includes('AssistantScreen') ? '✅' : '❌'));
console.log('tab: ' + (fin.includes("'assistant'") ? '✅' : '❌'));
console.log('hide: ' + (fin.includes("tab !== 'assistant'") ? '✅' : '❌'));
console.log('render: ' + (fin.includes('<AssistantScreen') ? '✅' : '❌'));
console.log('navigator: ' + (fin.includes('setNavigator({') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('  Ctrl+Shift+R');
console.log('  تب 🤖 دستیار رو بزن');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\App.tsx" App.tsx');