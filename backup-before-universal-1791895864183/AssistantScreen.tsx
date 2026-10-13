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
import { deepSearch, resolveBox, resolvePerson, addToBox, setContext, getContext, clearContext, Entity, norm } from './lib.assistant.core';
import { deepNav } from './lib.assistant.bridge';

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
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [awaitingAnswer, setAwaitingAnswer] = useState<string>('');
  const [panelData, setPanelData] = useState<any>(null);
  const [panelLoading, setPanelLoading] = useState(false);

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
      // 🧠 Context و دستورات وابسته
      const ctx = getContext();
      const lowCmd = norm(command);

      // ─── تأیید/لغو pending action ───
      if (pendingAction) {
        if (/تایید|تأیید|ok|بله|آره|انجام/.test(lowCmd)) {
          try {
            const res = await executeAction(pendingAction.action, pendingAction.params || {});
            const reply = res;
            setLastResult({ kind: 'action', action: pendingAction.action, params: pendingAction.params, confidence: 100, raw: command, reply });
            setPendingAction(null);
            await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'action', action: pendingAction.action, params: {}, confidence: 100, raw: command, reply }, response: reply, timestamp: Date.now() });
            setHistory(await getAssistantHistory());
            speak(reply);
            showToast?.(reply);
            setProcessing(false);
            return;
          } catch (e: any) {
            showToast?.('❌ ' + (e?.message || ''), true);
            setProcessing(false);
            return;
          }
        }
        if (/لغو|نه|cancel|بیخیال/.test(lowCmd)) {
          setPendingAction(null);
          setLastResult({ kind: 'action', action: 'cancel', params: {}, confidence: 100, raw: command, reply: '❌ لغو شد' });
          showToast?.('❌ لغو شد');
          setProcessing(false);
          return;
        }
      }

      // ─── «۵۰۰ به آن اضافه کن» (Context) ───
      const addMatch = lowCmd.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:به\s+(?:آن|اون|همون)|اضافه|بزن|واریز)|به\s+(?:آن|اون|همون)\s+(\d+(?:\.\d+)?)/);
      if (addMatch && ctx.lastEntity) {
        const amt = parseFloat(addMatch[1] || addMatch[2] || '0');
        if (amt > 0) {
          if (ctx.lastEntity.type === 'box') {
            const r = await addToBox(ctx.lastEntity.id, amt, 'in', 'افزایش از دستیار');
            // رفرش panel
            try {
              const { getBoxes } = await import('./lib.fx');
              const boxes = await getBoxes() || [];
              const box = boxes.find((b: any) => (b.id || b.local_id || b.code) === ctx.lastEntity!.id);
              if (box) {
                const { getAllBalances } = await import('./lib.boxes');
                const bals = await getAllBalances();
                setPanelData({
                  type: 'box',
                  title: box.name || box.code,
                  currency: box.currency || 'AFN',
                  balance: bals[box.id || box.local_id] || 0,
                  box,
                });
              }
            } catch {}
            const reply = r.msg;
            setLastResult({ kind: 'action', action: 'addToBox', params: {}, confidence: 100, raw: command, reply });
            await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'action', action: 'addToBox', params: {}, confidence: 100, raw: command, reply }, response: reply, timestamp: Date.now() });
            setHistory(await getAssistantHistory());
            speak(reply);
            showToast?.(reply);
            setProcessing(false);
            return;
          }
          if (ctx.lastEntity.type === 'customer') {
            try {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              const balKey = '@mizan_manual_balances_v1';
              const raw = await AsyncStorage.getItem(balKey);
              const bals = raw ? JSON.parse(raw) : {};
              const oldBal = bals[ctx.lastEntity.id] || 0;
              bals[ctx.lastEntity.id] = oldBal + amt;
              await AsyncStorage.setItem(balKey, JSON.stringify(bals));
              setPanelData((p: any) => p && p.type === 'customer' ? { ...p, balance: oldBal + amt } : p);
              const reply = `✅ ${amt.toLocaleString('en-US')} به مانده ${ctx.lastEntity.name} اضافه شد`;
              setLastResult({ kind: 'action', action: 'addBalance', params: {}, confidence: 100, raw: command, reply });
              speak(reply);
              showToast?.(reply);
              setProcessing(false);
              return;
            } catch {}
          }
        }
      }

      // ─── «کم کن» ───
      const subMatch = lowCmd.match(/(\d+(?:\.\d+)?)\s*(?:از\s+(?:آن|اون)|کم\s+کن)/);
      if (subMatch && ctx.lastEntity?.type === 'box') {
        const amt = parseFloat(subMatch[1]);
        if (amt > 0) {
          const r = await addToBox(ctx.lastEntity.id, amt, 'out', 'کاهش از دستیار');
          try {
            const { getBoxes } = await import('./lib.fx');
            const boxes = await getBoxes() || [];
            const box = boxes.find((b: any) => (b.id || b.local_id || b.code) === ctx.lastEntity!.id);
            if (box) {
              const { getAllBalances } = await import('./lib.boxes');
              const bals = await getAllBalances();
              setPanelData({
                type: 'box',
                title: box.name || box.code,
                currency: box.currency || 'AFN',
                balance: bals[box.id || box.local_id] || 0,
                box,
              });
            }
          } catch {}
          const reply = r.msg;
          setLastResult({ kind: 'action', action: 'subFromBox', params: {}, confidence: 100, raw: command, reply });
          speak(reply);
          showToast?.(reply);
          setProcessing(false);
          return;
        }
      }

      // ─── جستجو + نمایش در Panel ───
      const isBoxQuery = /صندوق/.test(lowCmd);
      const isStatementQuery = /صورتحساب|صورت.?حساب|کاردکس/.test(lowCmd);
      const isInvoiceQuery = /فاکتور/.test(lowCmd) && !/بزن|بساز|جدید/.test(lowCmd);
      const isCustomerQuery = /مشتری/.test(lowCmd);

      if (isBoxQuery || isStatementQuery || isInvoiceQuery || isCustomerQuery) {
        setPanelLoading(true);
        
        const currencyMatch = lowCmd.match(/(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|usd|afn|eur)/);
        const curMap: any = { 'دالر': 'USD', 'دلار': 'USD', 'یورو': 'EUR', 'افغانی': 'AFN', 'تومان': 'IRT', 'ریال': 'IRR', 'روپیه': 'PKR', 'درهم': 'AED' };
        const currency = currencyMatch ? (curMap[currencyMatch[1]] || currencyMatch[1].toUpperCase()) : undefined;

        let nameQuery = lowCmd
          .replace(/صندوق|صورتحساب|صورت.?حساب|کاردکس|فاکتور|مشتری|دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|را|بیار|بیاور|بگیر|بزن|بساز|برای|از|به|چقدر|چقد/g, '')
          .replace(/[^\u0600-\u06FF\w\s\d]/g, '')
          .trim();

        if (nameQuery && nameQuery.length >= 2) {
          if (isBoxQuery) {
            const box = await resolveBox(nameQuery, currency);
            if (box) {
              try {
                const { getAllBalances } = await import('./lib.boxes');
                const bals = await getAllBalances();
                const balance = bals[box.id || box.local_id] || 0;
                setContext({ lastEntity: { type: 'box', id: box.id || box.local_id, name: box.name || box.code, meta: box }, lastSearch: nameQuery });
                setPanelData({
                  type: 'box',
                  title: box.name || box.code,
                  currency: box.currency || 'AFN',
                  balance,
                  box,
                });
                const reply = `📦 ${box.name} — ${balance.toLocaleString('en-US')} ${box.currency || 'AFN'}`;
                setLastResult({ kind: 'query', action: 'showBox', params: {}, confidence: 95, raw: command, reply });
                await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'query', action: 'showBox', params: {}, confidence: 95, raw: command, reply }, response: reply, timestamp: Date.now() });
                setHistory(await getAssistantHistory());
                speak(reply);
                showToast?.(reply);
              } catch (e) { showToast?.('❌ خطا', true); }
            } else {
              showToast?.('❌ صندوق پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }

          if (isStatementQuery) {
            const person = await resolvePerson(nameQuery);
            if (person) {
              try {
                const { getBoxTransactions, getAllBalances } = await import('./lib.boxes');
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                const balKey = '@mizan_manual_balances_v1';
                const raw = await AsyncStorage.getItem(balKey);
                const bals = raw ? JSON.parse(raw) : {};
                const balance = bals[person.id || person.local_id] || 0;

                setContext({ lastEntity: { type: 'customer', id: person.id || person.local_id, name: person.name, meta: person }, lastSearch: nameQuery });
                setPanelData({
                  type: 'customer',
                  title: person.name,
                  phone: person.phone,
                  balance,
                  bank: person.bank,
                  person,
                });
                const reply = `👤 ${person.name} — مانده: ${balance.toLocaleString('en-US')}`;
                setLastResult({ kind: 'query', action: 'showCustomer', params: {}, confidence: 95, raw: command, reply });
                await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'query', action: 'showCustomer', params: {}, confidence: 95, raw: command, reply }, response: reply, timestamp: Date.now() });
                setHistory(await getAssistantHistory());
                speak(reply);
                showToast?.(reply);
              } catch (e) { showToast?.('❌ خطا', true); }
            } else {
              showToast?.('❌ طرف پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }

          if (isInvoiceQuery) {
            const results = await deepSearch(nameQuery, ['invoice']);
            if (results.length > 0) {
              if (results.length === 1) {
                const inv = results[0].meta;
                setContext({ lastEntity: { type: 'invoice', id: inv.invoice, name: inv.invoice, meta: inv }, lastSearch: nameQuery });
                setPanelData({
                  type: 'invoice',
                  title: 'فاکتور ' + inv.invoice,
                  customer: inv.name,
                  total: inv.total,
                  paid: inv.paid,
                  date: inv.date,
                  items: inv.items || [],
                  invoice: inv,
                });
                const reply = `📄 فاکتور ${inv.invoice} — ${inv.name} — ${(Number(inv.total) || 0).toLocaleString('en-US')}`;
                setLastResult({ kind: 'query', action: 'showInvoice', params: {}, confidence: 95, raw: command, reply });
                speak(reply);
                showToast?.(reply);
              } else {
                setSearchResults(results);
                setLastResult({ kind: 'query', action: 'searchInvoice', params: {}, confidence: 80, raw: command, reply: `📄 ${results.length} فاکتور پیدا شد` });
                showToast?.(`📄 ${results.length} فاکتور — یکی رو انتخاب کن`);
              }
            } else {
              showToast?.('❌ فاکتوری پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }

          if (isCustomerQuery) {
            const person = await resolvePerson(nameQuery);
            if (person) {
              try {
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
                const bals = raw ? JSON.parse(raw) : {};
                const balance = bals[person.id || person.local_id] || 0;

                setContext({ lastEntity: { type: 'customer', id: person.id || person.local_id, name: person.name, meta: person }, lastSearch: nameQuery });
                setPanelData({
                  type: 'customer',
                  title: person.name,
                  phone: person.phone,
                  balance,
                  bank: person.bank,
                  person,
                });
                const reply = `👤 ${person.name} — مانده: ${balance.toLocaleString('en-US')}`;
                setLastResult({ kind: 'query', action: 'showCustomer', params: {}, confidence: 95, raw: command, reply });
                speak(reply);
                showToast?.(reply);
              } catch {}
            } else {
              showToast?.('❌ مشتری پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }
        }
        setPanelLoading(false);
      }

      // ─── پارسر معمولی ───
      const intent = parseIntent(command);
      setLastResult(intent);

      let finalReply = intent.reply;

      if (intent.kind === 'navigate') {
        // فقط پیام بده — توی صفحه بمون
        finalReply = '💡 برای دیدن: ' + intent.params.label + ' — بگو «' + intent.params.label + ' رو نشون بده»';
      } else if (intent.kind === 'query') {
        try {
          const answer = await executeQuery(intent.action, intent.params || {});
          finalReply = answer;
        } catch (e: any) {
          finalReply = '❌ خطا: ' + (e?.message || '');
        }
      } else if (intent.kind === 'action') {
        setPendingAction(intent);
        finalReply = '⚠️ آماده: ' + intent.reply + '\n\nبگو «تأیید» یا «لغو»';
      } else if (intent.kind === 'create') {
        finalReply = '📝 ' + intent.reply + ' — به‌زودی';
      } else {
        // چک تأیید/لغو
        const lowT = command.toLowerCase().trim();
        if ((lowT.includes('تایید') || lowT.includes('تأیید') || lowT === 'ok' || lowT.includes('بله') || lowT.includes('آره')) && pendingAction) {
          try {
            const res = await executeAction(pendingAction.action, pendingAction.params || {});
            finalReply = res;
            setPendingAction(null);
          } catch (e: any) {
            finalReply = '❌ ' + (e?.message || '');
          }
        } else if ((lowT.includes('لغو') || lowT === 'نه' || lowT === 'cancel') && pendingAction) {
          finalReply = '❌ لغو شد';
          setPendingAction(null);
        }
      }

      try { await recordCommand(command, intent.kind); } catch {}
      try { setLearnedCmds(await getLearnedCommands()); } catch {}

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

        {/* 📊 Panel — نمایش داده */}
        {panelData && (
          <View style={[s.card, { borderColor: '#059669', marginTop: 12 }]}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={s.cardTitle}>{
                panelData.type === 'box' ? '📦 صندوق' :
                panelData.type === 'customer' ? '👤 مشتری' :
                panelData.type === 'invoice' ? '📄 فاکتور' : '📋'
              }</Text>
              <TouchableOpacity onPress={() => { setPanelData(null); clearContext(); }}>
                <Text style={{ color: '#dc2626', fontSize: 22, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>

            {panelData.type === 'box' && (
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{panelData.title}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right' }}>ارز: {panelData.currency}</Text>
                <View style={{ backgroundColor: '#1a2332', padding: 14, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>موجودی فعلی</Text>
                  <Text style={{ color: '#10b981', fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>
                    {Math.abs(Number(panelData.balance) || 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{panelData.currency}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 12 }}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => { setText('۵۰۰ به آن اضافه کن'); }}>
                    <Text style={s.btnTxt}>➕ افزودن</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626' }]} onPress={() => { setText('۱۰۰ از آن کم کن'); }}>
                    <Text style={s.btnTxt}>➖ کاهش</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {panelData.type === 'customer' && (
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{panelData.title}</Text>
                {panelData.phone ? <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right' }}>📞 {panelData.phone}</Text> : null}
                {panelData.bank ? <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right', marginTop: 2 }}>🏦 {panelData.bank}</Text> : null}
                <View style={{ backgroundColor: '#1a2332', padding: 14, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>مانده</Text>
                  <Text style={{
                    color: panelData.balance > 0 ? '#10b981' : panelData.balance < 0 ? '#ef4444' : '#94a3b8',
                    fontSize: 28, fontWeight: 'bold', marginTop: 4,
                  }}>
                    {Math.abs(Number(panelData.balance) || 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                    {panelData.balance > 0 ? '🟢 طلبکار' : panelData.balance < 0 ? '🔴 بدهکار' : '⚪ تسویه'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 12 }}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => { setText('۵۰۰ به آن اضافه کن'); }}>
                    <Text style={s.btnTxt}>➕ واریز</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => { setText('فاکتور جدید برای ' + panelData.title); }}>
                    <Text style={s.btnTxt}>📄 فاکتور</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626' }]} onPress={() => { setText('۱۰۰ از آن کم کن'); }}>
                    <Text style={s.btnTxt}>➖</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {panelData.type === 'invoice' && (
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{panelData.title}</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'right' }}>👤 {panelData.customer}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 2 }}>
                  📅 {panelData.date ? new Date(panelData.date).toLocaleDateString('fa-IR') : ''}
                </Text>
                <View style={{ backgroundColor: '#1a2332', padding: 14, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>مبلغ کل</Text>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
                    {(Number(panelData.total) || 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: panelData.paid >= panelData.total ? '#10b981' : '#f59e0b', fontSize: 12, marginTop: 4 }}>
                    پرداخت‌شده: {(Number(panelData.paid) || 0).toLocaleString('en-US')}
                  </Text>
                </View>
                {panelData.items && panelData.items.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 }}>اقلام:</Text>
                    {panelData.items.slice(0, 5).map((it: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 4 }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{it.model_name || '—'}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>{it.quantity} × {it.price_unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {panelLoading && (
          <View style={{ alignItems: 'center', padding: 14 }}>
            <ActivityIndicator color="#7c3aed" size="large" />
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>در حال جستجو...</Text>
          </View>
        )}

        {/* 🔍 نتایج جستجو */}
        {searchResults.length > 0 && (
          <View style={[s.card, { borderColor: '#0891b2', marginTop: 12 }]}>
            <Text style={s.cardTitle}>🔍 نتایج ({searchResults.length})</Text>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={[s.sampleBtn, { marginTop: 6, borderColor: r.score > 60 ? '#059669' : '#f59e0b' }]}
                onPress={() => {
                  setContext({ lastEntity: { type: r.type, id: r.id, name: r.name, meta: r.meta } });
                  showToast?.('✅ انتخاب شد: ' + r.name);
                  setSearchResults([]);
                }}
              >
                <Text style={s.sampleIcon}>
                  {r.type === 'box' ? '📦' : r.type === 'customer' ? '👤' : r.type === 'invoice' ? '📄' : '📋'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.sampleTxt}>{r.name}</Text>
                  {r.subtitle ? <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right' }}>{r.subtitle}</Text> : null}
                </View>
                <Text style={{ color: r.score > 60 ? '#059669' : '#f59e0b', fontSize: 11, fontWeight: 'bold' }}>{r.score}%</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => setSearchResults([])}>
              <Text style={s.btnTxt}>✕ بستن</Text>
            </TouchableOpacity>
          </View>
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
