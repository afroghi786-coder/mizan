// ManualEntryScreen.tsx — دستیار صراف حرفه‌ای
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch, NativeModules,
  Platform, DeviceEventEmitter, Alert
} from 'react-native';
import AsyncStorage from 'expo-sqlite/kv-store';
import {
  parseCommand, saveManual, getHistory, addHistory,
  getLearned, addLearned, clearLearned, ParseContext,
  ParsedResult, LearnedPattern,
  getManualSettings, saveManualSettings, DEFAULT_SETTINGS, ManualSettings,
  getShortcuts, bumpShortcut, Shortcut,
  getLastUndo, markUndone,
  exportToExcel,
  parseExchangeCommand, answerQuery, startDialogue, processDialogueAnswer,
  ExchangeCmd, QueryResult,
} from './lib.manual';
import { getFxCustomers } from './lib.fx.cust';
import { getHawalas, createHawala } from './lib.fx';
import { getSalesGrouped, createSale, getPurchasesGrouped, createPurchase } from './lib';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BALANCE_KEY = '@mizan_manual_balances_v1';
const { Speech } = NativeModules;
const speechAvailable = !!(Speech && Platform.OS === 'android');

type Mode = 'entry' | 'query' | 'dialogue';

export default function ManualEntryScreen({ showToast }: any) {
  const [mode, setMode] = useState<Mode>('entry');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [exchResult, setExchResult] = useState<ExchangeCmd | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [learnedModal, setLearnedModal] = useState(false);
  const [learned, setLearned] = useState<LearnedPattern[]>([]);
  const [settings, setSettings] = useState<ManualSettings>(DEFAULT_SETTINGS);
  const [settingsModal, setSettingsModal] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'today'>('today');
  const [undoEntry, setUndoEntry] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [dialogue, setDialogue] = useState<any>({ active: false, steps: [], step: 0, data: {} });
  const [dialogueAnswer, setDialogueAnswer] = useState('');
  const [speakAnswers, setSpeakAnswers] = useState(true);

  // ═══════════════════════════════════════════
  // Load
  // ═══════════════════════════════════════════
  const load = useCallback(async () => {
    try { setCustomers((await getFxCustomers().catch(() => [])) || []); } catch (e) { console.log('cust:', e); }
    try {
      const purch = await getPurchasesGrouped().catch(() => []);
      setSuppliers((purch || []).map((x: any) => ({ id: x.supplier_code || x.id, name: x.supplier_name, phone: x.supplier_phone, type: 'supplier' })));
    } catch (e) { console.log('supp:', e); }
    try { setPartners([]); } catch {}
    try { setHistory((await getHistory()) || []); } catch (e) { console.log('hist:', e); }
    try {
      const bals = await AsyncStorage.getItem(BALANCE_KEY);
      setBalances(bals ? JSON.parse(bals) : {});
    } catch (e) { console.log('bal:', e); }
    try { setLearned((await getLearned()) || []); } catch (e) { console.log('lrn:', e); }
    try { setSettings((await getManualSettings()) || DEFAULT_SETTINGS); } catch (e) { console.log('st:', e); }
    try {
      const sc = await getShortcuts();
      setShortcuts(sc && sc.length ? sc : [
        { id: 'sc1', label: 'تسویه', text: 'تسویه ', icon: '✅', usageCount: 0 },
        { id: 'sc2', label: 'پرداخت', text: 'به ', icon: '💸', usageCount: 0 },
        { id: 'sc3', label: 'دریافت', text: 'از ', icon: '💰', usageCount: 0 },
        { id: 'sc4', label: 'خرید ارز', text: 'خرید دالر ', icon: '💵', usageCount: 0 },
        { id: 'sc5', label: 'فروش ارز', text: 'فروش دالر ', icon: '💱', usageCount: 0 },
      ]);
    } catch (e) { 
      console.log('sc:', e);
      setShortcuts([
        { id: 'sc1', label: 'تسویه', text: 'تسویه ', icon: '✅', usageCount: 0 },
        { id: 'sc2', label: 'پرداخت', text: 'به ', icon: '💸', usageCount: 0 },
      ]);
    }
    try { setUndoEntry(await getLastUndo()); } catch (e) { console.log('undo:', e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ═══════════════════════════════════════════
  // Speech Setup
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!speechAvailable) return;
    const subs = [
      DeviceEventEmitter.addListener('onSpeechReady', () => setListening(true)),
      DeviceEventEmitter.addListener('onSpeechEnd', () => { /* processing */ }),
      DeviceEventEmitter.addListener('onSpeechPartial', (m: any) => setPartialText(m?.text || '')),
      DeviceEventEmitter.addListener('onSpeechResult', (m: any) => {
        setListening(false);
        setPartialText('');
        const t = m?.text || '';
        if (t) {
          setText(t);
          if (mode === 'dialogue') setDialogueAnswer(t);
        }
      }),
      DeviceEventEmitter.addListener('onSpeechError', (m: any) => {
        setListening(false);
        setPartialText('');
        showToast?.('🎤 ' + (m?.message || 'خطا'), true);
      }),
    ];
    return () => { subs.forEach(s => s.remove()); };
  }, [mode, showToast]);

  const startVoice = async () => {
    if (!speechAvailable) {
      showToast?.('🎤 روی این دستگاه پشتیبانی نمی‌شود', true);
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

  // ═══════════════════════════════════════════
  // Parse
  // ═══════════════════════════════════════════
  const analyze = async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    setResult(null); setExchResult(null); setQueryResult(null);
    try {
      const ctx: ParseContext = {
        customers: customers.map((c: any) => ({ id: c.id || c.local_id, name: c.name, phone: c.phone, type: 'customer' })),
        suppliers: suppliers.map((s: any) => ({ id: s.id, name: s.name, phone: s.phone, type: 'supplier' })),
        partners,
      };
      
      if (mode === 'query') {
        const qr = await answerQuery(text, ctx, {
          getBalance: (id: string) => balances[id] || 0,
          getBoxes: async () => [],
          getRates: async () => [],
          getTodayStats: async () => {
            const today = history.filter(h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000);
            return { count: today.length, profit: 0 };
          },
        });
        setQueryResult(qr);
        if (qr.ok) speak(qr.answer);
      } else {
        // صرافی رو اول چک کن
        const ex = parseExchangeCommand(text, ctx);
        if (ex.ok && ex.amount > 0 && ex.rate) {
          setExchResult(ex);
        } else {
          // پارسر عادی
          const r = await parseCommand(text, ctx);
          if (r.from) r.from.balance = balances[r.from.id] || 0;
          if (r.to) r.to.balance = balances[r.to.id] || 0;
          if (r.person) r.person.balance = balances[r.person.id] || 0;
          setResult(r);
          
          // خودکار تأیید
          if (settings.autoConfirm && r.ok && r.confidence >= settings.autoConfirmThreshold) {
            setTimeout(() => confirmResult(r), 300);
          }
        }
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setAnalyzing(false);
  };

  // ═══════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════
  const confirmResult = async (r: ParsedResult) => {
    setSaving(true);
    try {
      const saveRes = await saveManual(r, {
        createSale: async (p) => { try { await createSale({ ...p, amount: p.amount }); } catch {} },
        createPurchase: async (p) => { try { await createPurchase({ ...p, amount: p.amount }); } catch {} },
        createHawala: async (p) => { try { await createHawala(p); } catch {} },
        updateBalance: async (id, delta) => {
          const cur = balances[id] || 0;
          const next = { ...balances, [id]: cur + delta };
          setBalances(next);
          await AsyncStorage.setItem(BALANCE_KEY, JSON.stringify(next));
        },
      });
      
      if (saveRes.ok) {
        await addHistory({ id: 'h_' + Date.now(), raw: text, parsed: r, timestamp: Date.now(), saved: true });
        setHistory(await getHistory());
        setUndoEntry(await getLastUndo());
        showToast?.(saveRes.message);
        speak(saveRes.message.replace('✅', 'ثبت شد'));
        setText(''); setResult(null);
      } else {
        showToast?.(saveRes.message, true);
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setSaving(false);
  };

  const confirmExchange = async () => {
    if (!exchResult) return;
    const ex = exchResult;
    const r: ParsedResult = {
      ok: true,
      confidence: ex.confidence,
      amount: ex.amount,
      type: ex.side === 'buy' ? 'purchase' : 'sale',
      to: ex.side === 'buy' ? ex.peer : undefined,
      from: ex.side === 'sell' ? ex.peer : undefined,
      raw: ex.raw,
      warnings: ex.warnings,
    };
    await confirmResult(r);
    setExchResult(null);
  };

  const undo = async () => {
    if (!undoEntry) return;
    await markUndone(undoEntry.id);
    setUndoEntry(null);
    showToast?.('↩️ عملیات لغو شد');
  };

  const teach = async () => {
    if (!result || !text) return;
    const lp: LearnedPattern = {
      id: 'learned_' + Date.now(),
      regex: text.replace(/[0-9]+/g, '\\d+').replace(/[ا-ی]+/g, '[\\u0600-\\u06FF]+'),
      action: (result.type as any) || 'purchase',
      description: 'آموخته از: ' + text,
      examples: [text],
      createdAt: Date.now(),
      usageCount: 0,
    };
    await addLearned(lp);
    setLearned(await getLearned());
    showToast?.('🧠 یاد گرفته شد');
  };

  const exportExcel = async () => {
    try {
      const rows = historyFilter === 'today'
        ? history.filter(h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000)
        : history;
      if (!rows.length) { showToast?.('چیزی برای خروجی نیست', true); return; }
      const csv = await exportToExcel(rows);
      const uri = FileSystem.cacheDirectory + 'mizan-' + Date.now() + '.csv';
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
        showToast?.('✅ خروجی آماده شد');
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
  };

  const applyShortcut = (sc: Shortcut) => {
    setText(sc.text + text);
    bumpShortcut(sc.id);
  };

  // ═══════════════════════════════════════════
  // Dialogue
  // ═══════════════════════════════════════════
  const startDL = (intent: string) => {
    const d = startDialogue(intent);
    setDialogue(d);
    setDialogueAnswer('');
    setMode('dialogue');
    if (d.active) speak(d.steps[0]?.question || '');
  };

  const answerDL = async () => {
    if (!dialogueAnswer.trim()) return;
    const r = processDialogueAnswer(dialogue, dialogueAnswer);
    setDialogue({ ...r.state });
    setDialogueAnswer('');
    if (r.done) {
      showToast?.('📋 ' + (r.summary || 'تمام'));
      speak(r.summary || 'تمام شد');
    } else {
      speak(r.state.steps[r.state.step]?.question || '');
    }
  };

  const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };
  const balanceLabel = (b: number) => {
    if (b > 0) return { text: 'طلبکار: +' + fmt(b), color: '#10b981' };
    if (b < 0) return { text: 'بدهکار: ' + fmt(b), color: '#ef4444' };
    return { text: 'تسویه', color: '#94a3b8' };
  };

  const filteredHistory = historyFilter === 'today'
    ? history.filter(h => Date.now() - h.timestamp < 24 * 60 * 60 * 1000)
    : history;

  // ═══════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🤖 دستیار صراف</Text>
        <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
          <TouchableOpacity onPress={() => setLearnedModal(true)}>
            <Text style={s.badge}>🧠 {learned.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSettingsModal(true)}>
            <Text style={s.badge}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Tabs */}
      <View style={s.modeTabs}>
        <TouchableOpacity accessibilityLabel="ورود" style={[s.modeTab, mode === 'entry' && s.modeTabActive]} onPress={() => setMode('entry')}>
          <Text style={[s.modeTabTxt, mode === 'entry' && s.modeTabTxtActive]}>✏️ ورود</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="سؤال" style={[s.modeTab, mode === 'query' && s.modeTabActive]} onPress={() => setMode('query')}>
          <Text style={[s.modeTabTxt, mode === 'query' && s.modeTabTxtActive]}>❓ سؤال</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="گفتگو" style={[s.modeTab, mode === 'dialogue' && s.modeTabActive]} onPress={() => setMode('dialogue')}>
          <Text style={[s.modeTabTxt, mode === 'dialogue' && s.modeTabTxtActive]}>💬 گفتگو</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 12 }} keyboardShouldPersistTaps="handled">
        {/* Shortcuts */}
        {mode === 'entry' && shortcuts.length > 0 && (
          <>
            <Text style={s.lbl}>⚡ دسترسی سریع:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {shortcuts.map(sc => (
                <TouchableOpacity key={sc.id} style={s.shortcutBtn} onPress={() => applyShortcut(sc)}>
                  <Text style={s.shortcutIcon}>{sc.icon}</Text>
                  <Text style={s.shortcutLabel}>{sc.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity accessibilityLabel="گفتگو" style={[s.shortcutBtn, { borderColor: '#059669' }]} onPress={() => startDL('buy')}>
                <Text style={s.shortcutIcon}>🎤</Text>
                <Text style={s.shortcutLabel}>گفتگو</Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* Dialogue */}
        {mode === 'dialogue' && dialogue.active && (
          <View style={s.card}>
            <Text style={s.cardTitle}>💬 گفتگو ({dialogue.step + 1}/{dialogue.steps.length})</Text>
            <Text style={s.dlQuestion}>{dialogue.steps[dialogue.step]?.question || 'تمام شد'}</Text>
            {dialogue.step < dialogue.steps.length && (
              <>
                <TextInput accessibilityLabel="پاسخ..."
                  style={s.inp}
                  value={dialogueAnswer}
                  onChangeText={setDialogueAnswer}
                  placeholder="پاسخ..."
                  placeholderTextColor="#64748b"
                  onSubmitEditing={answerDL}
                />
                <View style={s.row}>
                  <TouchableOpacity accessibilityLabel="پاسخ" style={[s.btn, { backgroundColor: '#059669' }]} onPress={answerDL}>
                    <Text style={s.btnTxt}>↩️ پاسخ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: '#f59e0b' }]}
                    onPress={listening ? stopVoice : startVoice}
                  >
                    <Text style={s.btnTxt}>{listening ? '⏹' : '🎤'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {dialogue.step >= dialogue.steps.length && (
              <View>
                <Text style={s.dlSummary}>📋 خلاصه: {'\n'}{
                  Object.entries(dialogue.data).map(([k, v]: any) => `${k}: ${v}`).join('\n')
                }</Text>
                <TouchableOpacity accessibilityLabel="تأیید و تحلیل"
                  style={[s.btn, { backgroundColor: '#059669', marginTop: 8 }]}
                  onPress={() => {
                    const d = dialogue.data;
                    const txt = `${d.amount || ''} ${d.currency || ''} ${d.rate ? 'به نرخ ' + d.rate : ''}`;
                    setText(txt);
                    setMode('entry');
                    setDialogue({ active: false, steps: [], step: 0, data: {} });
                    setTimeout(analyze, 200);
                  }}
                >
                  <Text style={s.btnTxt}>✅ تأیید و تحلیل</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Input area */}
        {mode !== 'dialogue' && (
          <>
            <Text style={s.lbl}>{mode === 'query' ? '❓ بپرس:' : '✏️ بنویسید:'}</Text>
            <TextInput
              style={s.bigInp}
              value={listening && partialText ? partialText : text}
              onChangeText={setText}
              placeholder={mode === 'query' ? 'مثلاً: مانده احمد چقدره؟' : 'مثلاً: از محمود ۵۰۰۰ به احمد'}
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
            />

            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2' }]} onPress={analyze} disabled={analyzing || !text.trim()}>
                {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔍 {mode === 'query' ? 'پاسخ' : 'تحلیل'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: listening ? '#dc2626' : '#7c3aed' }]}
                onPress={listening ? stopVoice : startVoice}
                disabled={!speechAvailable}
              >
                <Text style={s.btnTxt}>{listening ? '⏹ توقف' : '🎤 صوتی'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => { setText(''); setResult(null); setExchResult(null); setQueryResult(null); }}>
                <Text style={s.btnTxt}>🗑</Text>
              </TouchableOpacity>
              {undoEntry && (
                <TouchableOpacity style={[s.btn, { backgroundColor: '#f59e0b' }]} onPress={undo}>
                  <Text style={s.btnTxt}>↩️</Text>
                </TouchableOpacity>
              )}
            </View>

            {listening && (
              <View style={s.listeningBox}>
                <Text style={s.listeningTxt}>🎤 در حال گوش دادن...</Text>
              </View>
            )}
          </>
        )}

        {/* Exchange Result */}
        {exchResult && (
          <View style={[s.card, { borderColor: exchResult.ok ? '#059669' : '#dc2626' }]}>
            <Text style={s.cardTitle}>
              {exchResult.side === 'buy' ? '💵 خرید ارز' : '💱 فروش ارز'} — {exchResult.confidence}%
            </Text>
            <Text style={s.rowTxt}>💰 مقدار: <Text style={s.bold}>{fmt(exchResult.amount)} {exchResult.currency}</Text></Text>
            {exchResult.rate ? <Text style={s.rowTxt}>📈 نرخ: <Text style={s.bold}>{exchResult.rate}</Text></Text> : null}
            {exchResult.total ? <Text style={s.rowTxt}>💵 معادل: <Text style={s.bold}>{fmt(exchResult.total)}</Text></Text> : null}
            {exchResult.peer ? <Text style={s.rowTxt}>👤 طرف: <Text style={s.bold}>{exchResult.peer.name}</Text></Text> : null}
            {exchResult.warnings.map((w, i) => <Text key={i} style={s.warn}>⚠️ {w}</Text>)}
            <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 10 }]} onPress={confirmExchange} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت معامله</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Query Result */}
        {queryResult && (
          <View style={[s.card, { borderColor: queryResult.ok ? '#0891b2' : '#dc2626' }]}>
            <Text style={s.cardTitle}>{queryResult.ok ? '📊 پاسخ' : '⚠️'}</Text>
            <Text style={s.queryAnswer}>{queryResult.answer}</Text>
            {speechAvailable && queryResult.ok && (
              <TouchableOpacity accessibilityLabel="بخوان" style={[s.btn, { backgroundColor: '#7c3aed', marginTop: 8 }]} onPress={() => speak(queryResult.answer)}>
                <Text style={s.btnTxt}>🔊 بخوان</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Normal Result */}
        {result && (
          <View style={[s.card, { borderColor: result.ok ? '#059669' : '#dc2626' }]}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{result.ok ? '✅ تشخیص داده شد' : '⚠️ ناقص'}</Text>
              {settings.showConfidence && <Text style={s.conf}>{result.confidence}%</Text>}
            </View>
            {result.amount !== undefined && (
              <Text style={s.rowTxt}>💰 مبلغ: <Text style={s.bold}>{fmt(result.amount)} {result.currency || ''}</Text></Text>
            )}
            {result.type && (
              <Text style={s.rowTxt}>📊 نوع: <Text style={s.bold}>{
                result.type === 'sale' ? '💸 فروش' :
                result.type === 'purchase' ? '🛒 خرید' :
                result.type === 'transfer' ? '🔄 انتقال' :
                result.type === 'adjust' ? '⚖️ تنظیم' :
                result.type === 'exchange' ? '💱 صرافی' : result.type
              }</Text></Text>
            )}
            {result.warnings?.map((w, i) => <Text key={i} style={s.warn}>⚠️ {w}</Text>)}
            {(result.from || result.to || result.person) && (
              <View style={{ marginTop: 10 }}>
                <Text style={s.lbl}>👥 طرفین:</Text>
                {[result.from, result.to, result.person].filter(Boolean).map((p: any, i: number) => {
                  const bal = balances[p.id] || 0;
                  const bl = balanceLabel(bal);
                  return (
                    <View key={i} style={s.personBox}>
                      <Text style={s.personName}>👤 {p.name}</Text>
                      {p.phone ? <Text style={s.personPhone}>📞 {p.phone}</Text> : null}
                      <Text style={[s.personBal, { color: bl.color }]}>💰 {bl.text}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={[s.row, { marginTop: 12 }]}>
              <TouchableOpacity style={[s.btn, { backgroundColor: result.ok ? '#059669' : '#475569', flex: 2 }]} onPress={() => confirmResult(result)} disabled={!result.ok || saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ تأیید و ثبت</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={teach}>
                <Text style={s.btnTxt}>🧠</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* History */}
        {filteredHistory.length > 0 && (
          <>
            <View style={[s.row, { marginTop: 16, alignItems: 'center' }]}>
              <Text style={[s.lbl, { flex: 1, marginTop: 0 }]}>📋 تاریخچه ({filteredHistory.length})</Text>
              <TouchableOpacity accessibilityLabel="امروز" style={[s.smallBtn, { backgroundColor: historyFilter === 'today' ? '#0891b2' : '#334155' }]} onPress={() => setHistoryFilter('today')}>
                <Text style={s.smallBtnTxt}>امروز</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="همه" style={[s.smallBtn, { backgroundColor: historyFilter === 'all' ? '#0891b2' : '#334155' }]} onPress={() => setHistoryFilter('all')}>
                <Text style={s.smallBtnTxt}>همه</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.smallBtn, { backgroundColor: '#059669' }]} onPress={exportExcel}>
                <Text style={s.smallBtnTxt}>📤</Text>
              </TouchableOpacity>
            </View>
            {filteredHistory.slice(0, 15).map((h: any, i: number) => (
              <View key={i} style={[s.card, { borderColor: '#334155', marginBottom: 6 }]}>
                <Text style={s.histRaw}>«{h.raw}»</Text>
                <Text style={s.histDate}>{fmtDate(h.timestamp)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Learned Modal */}
      <Modal visible={learnedModal} transparent animationType="slide" onRequestClose={() => setLearnedModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}>
            <Text style={s.mTitle}>🧠 الگوهای یادگرفته ({learned.length})</Text>
            <TouchableOpacity onPress={() => setLearnedModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 12 }}>
            {learned.length === 0 ? <Text style={s.empty}>هنوز چیزی یاد نگرفته‌ام</Text> : learned.map((lp, i) => (
              <View key={i} style={s.learnedItem}>
                <Text style={s.learnedDesc}>{lp.description}</Text>
                <Text style={s.learnedEx}>مثال: {lp.examples?.[0] || '—'}</Text>
              </View>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}>
            <Text style={s.mTitle}>⚙️ تنظیمات دستیار</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 12 }}>
            <View style={s.switchRow}>
              <Text style={s.lbl2}>🤖 تأیید خودکار</Text>
              <Switch value={settings.autoConfirm} onValueChange={(v) => setSettings({ ...settings, autoConfirm: v })} />
            </View>
            <Text style={s.lbl2}>🎯 حداقل اطمینان (٪)</Text>
            <TextInput style={s.inp} keyboardType="numeric" value={String(settings.autoConfirmThreshold)} onChangeText={(v) => setSettings({ ...settings, autoConfirmThreshold: Number(v) || 95 })} />
            <View style={s.switchRow}>
              <Text style={s.lbl2}>📊 نمایش اطمینان</Text>
              <Switch value={settings.showConfidence} onValueChange={(v) => setSettings({ ...settings, showConfidence: v })} />
            </View>
            <View style={s.switchRow}>
              <Text style={s.lbl2}>🔊 پاسخ صوتی</Text>
              <Switch value={speakAnswers} onValueChange={setSpeakAnswers} />
            </View>
            <Text style={s.lbl2}>💱 واحد پول</Text>
            <TextInput style={s.inp} value={settings.defaultCurrency} onChangeText={(v) => setSettings({ ...settings, defaultCurrency: v })} />
            <TouchableOpacity accessibilityLabel="ذخیره" style={[s.btn, { backgroundColor: '#059669', marginTop: 14 }]} onPress={async () => { await saveManualSettings(settings); showToast?.('✅ ذخیره شد'); setSettingsModal(false); }}>
              <Text style={s.btnTxt}>💾 ذخیره</Text>
            </TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  badge: { color: '#7c3aed', fontSize: 13, fontWeight: 'bold', backgroundColor: '#1a2332', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeTabs: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  modeTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#1a2332' },
  modeTabActive: { backgroundColor: '#7c3aed' },
  modeTabTxt: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  modeTabTxtActive: { color: '#fff' },
  lbl: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', marginTop: 10, marginBottom: 6, textAlign: 'right' },
  lbl2: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right', flex: 1 },
  bigInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 15, textAlign: 'right', minHeight: 70 },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right', marginTop: 4 },
  row: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginLeft: 4 },
  smallBtnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 2, borderColor: '#334155' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  conf: { color: '#94a3b8', fontSize: 11 },
  bold: { fontWeight: 'bold', color: '#fff' },
  rowTxt: { color: '#cbd5e1', fontSize: 13, marginTop: 4, textAlign: 'right' },
  warn: { color: '#f59e0b', fontSize: 12, marginTop: 4, textAlign: 'right' },
  personBox: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  personName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  personPhone: { color: '#94a3b8', fontSize: 12, marginTop: 2, textAlign: 'right' },
  personBal: { fontSize: 12, marginTop: 4, fontWeight: 'bold', textAlign: 'right' },
  histRaw: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  histDate: { color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'right' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 13 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '85%', overflow: 'hidden' },
  mHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  x: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  learnedItem: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 8 },
  learnedDesc: { color: '#fff', fontSize: 13, textAlign: 'right' },
  learnedEx: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' },
  shortcutBtn: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#7c3aed', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 6, alignItems: 'center', minWidth: 70 },
  shortcutIcon: { fontSize: 18 },
  shortcutLabel: { color: '#fff', fontSize: 11, marginTop: 2, fontWeight: 'bold' },
  listeningBox: { backgroundColor: '#7c3aed', padding: 10, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  listeningTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  dlQuestion: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginTop: 8, textAlign: 'right' },
  dlSummary: { color: '#cbd5e1', fontSize: 13, marginTop: 10, textAlign: 'right', lineHeight: 22 },
  queryAnswer: { color: '#fff', fontSize: 15, marginTop: 6, textAlign: 'right', lineHeight: 24 },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
});
