const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-final2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['AssistantScreen.tsx', 'lib.assistant.core.ts'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// lib.assistant.core.ts — موتور کامل
// ═══════════════════════════════════════════════════════
const core = `// lib.assistant.core.ts — موتور کامل دستیار
export function norm(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[يى]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

export function score(text: string, query: string): number {
  const t = norm(text);
  const q = norm(query);
  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.includes(q)) return 70;
  if (q.includes(t)) return 60;
  const dist = lev(t, q);
  const ratio = 1 - dist / Math.max(t.length, q.length);
  if (ratio > 0.7) return Math.round(ratio * 60);
  return 0;
}

export interface Entity {
  type: 'box' | 'customer' | 'invoice';
  id: string;
  name: string;
  subtitle?: string;
  meta: any;
  score: number;
}

export function extractCurrency(text: string): string | undefined {
  const t = norm(text);
  if (/دالر|دلار|دولار|usd/.test(t)) return 'USD';
  if (/یورو|eur/.test(t)) return 'EUR';
  if (/افغانی|افغان|afn/.test(t)) return 'AFN';
  if (/تومان|تومن|irt/.test(t)) return 'IRT';
  if (/ریال|irr/.test(t)) return 'IRR';
  if (/روپیه|پاکستانی|pkr/.test(t)) return 'PKR';
  if (/درهم|aed/.test(t)) return 'AED';
  if (/لیر|try/.test(t)) return 'TRY';
  return undefined;
}

export function extractAmount(text: string): number | null {
  const t = norm(text).replace(/,/g, '');
  const m = t.match(/(\\d+(?:\\.\\d+)?)/);
  if (m) return parseFloat(m[1]);
  return null;
}

// ─── Context
let _ctx: any = {};
export function setContext(patch: any) { _ctx = { ..._ctx, ...patch }; }
export function getContext() { return _ctx; }
export function clearContext() { _ctx = {}; }

// ─── Resolve
export async function resolveBox(name: string, currency?: string): Promise<any | null> {
  try {
    const bx = await import('./lib.boxes');
    const boxes = await bx.getBoxes().catch(() => []) || [];
    const bals = await bx.getAllBalances().catch(() => ({})) || {};
    if (!boxes.length) return null;
    
    const curr = currency ? String(currency).toUpperCase() : '';
    let best: any = null;
    let bestScore = 0;
    
    for (const b of boxes) {
      if (curr && String(b.currency || '').toUpperCase() !== curr) continue;
      const s = Math.max(score(b.name || '', name), score(b.code || '', name), score(b.owner_name || '', name));
      if (s > bestScore) { bestScore = s; best = { ...b, _balance: bals[b.id || b.local_id] || 0 }; }
    }
    
    if (!best && curr) {
      for (const b of boxes) {
        const s = Math.max(score(b.name || '', name), score(b.code || '', name), score(b.owner_name || '', name));
        if (s > bestScore) { bestScore = s; best = { ...b, _balance: bals[b.id || b.local_id] || 0 }; }
      }
    }
    
    return bestScore >= 40 ? best : null;
  } catch (e) { console.log('resolveBox err:', e); return null; }
}

export async function resolvePerson(name: string): Promise<any | null> {
  try {
    const c = await import('./lib.fx.cust');
    const custs = await c.getAllCust().catch(() => []) || [];
    let best: any = null;
    let bestScore = 0;
    for (const p of custs) {
      const s = Math.max(score(p.name || '', name), score(p.phone || '', name), score(p.code || '', name));
      if (s > bestScore) { bestScore = s; best = p; }
    }
    return bestScore >= 40 ? best : null;
  } catch (e) { console.log('resolvePerson err:', e); return null; }
}

// ─── Deep Search
export async function deepSearch(query: string, types?: string[]): Promise<Entity[]> {
  const results: Entity[] = [];
  const wantAll = !types || !types.length;

  if (wantAll || types!.includes('box')) {
    try {
      const bx = await import('./lib.boxes');
      const boxes = await bx.getBoxes().catch(() => []) || [];
      const bals = await bx.getAllBalances().catch(() => ({})) || {};
      for (const b of boxes) {
        const s = Math.max(score(b.name || '', query), score(b.code || '', query), score(b.owner_name || '', query));
        if (s > 0) {
          const bal = bals[b.id || b.local_id] || 0;
          results.push({
            type: 'box',
            id: b.id || b.local_id || b.code,
            name: b.name || b.code || 'صندوق',
            subtitle: \`\${b.currency || 'AFN'} — موجودی: \${bal.toLocaleString('en-US')}\`,
            meta: { ...b, _balance: bal },
            score: s,
          });
        }
      }
    } catch (e) { console.log('search box err:', e); }
  }

  if (wantAll || types!.includes('customer')) {
    try {
      const c = await import('./lib.fx.cust');
      const custs = await c.getAllCust().catch(() => []) || [];
      for (const p of custs) {
        const s = Math.max(score(p.name || '', query), score(p.phone || '', query), score(p.code || '', query));
        if (s > 0) {
          results.push({ type: 'customer', id: p.id || p.local_id || p.code, name: p.name || 'مشتری', subtitle: p.phone || '', meta: p, score: s });
        }
      }
    } catch (e) { console.log('search customer err:', e); }
  }

  if (wantAll || types!.includes('invoice')) {
    try {
      const lib = await import('./lib');
      const sales = await lib.getSalesGrouped().catch(() => []) || [];
      for (const inv of sales) {
        const s = Math.max(score(inv.invoice || '', query), score(inv.name || '', query), score(inv.phone || '', query));
        if (s > 0) {
          results.push({
            type: 'invoice',
            id: inv.invoice,
            name: \`فاکتور \${inv.invoice} — \${inv.name || ''}\`,
            subtitle: \`\${(Number(inv.total) || 0).toLocaleString('en-US')} — \${inv.items?.length || 0} قلم\`,
            meta: inv,
            score: s,
          });
        }
      }
    } catch (e) { console.log('search invoice err:', e); }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 15);
}

// ─── Box Operations
export async function boxOp(box: any, amount: number, type: 'deposit' | 'withdraw', note?: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const bx = await import('./lib.boxes');
    await bx.addBoxTransaction({
      box_id: box.id || box.local_id,
      box_code: box.code,
      type,
      amount,
      currency: box.currency || 'AFN',
      description: note || (type === 'deposit' ? 'واریز' : 'برداشت'),
      date: new Date().toISOString(),
    });
    return { ok: true, msg: \`✅ \${type === 'deposit' ? 'واریز' : 'برداشت'} \${amount.toLocaleString('en-US')} \${box.currency || 'AFN'}\` };
  } catch (e: any) { return { ok: false, msg: '❌ ' + (e?.message || 'خطا') }; }
}

// ─── Save Operations
export async function saveBox(box: any): Promise<boolean> {
  try {
    const bx = await import('./lib.boxes');
    await bx.saveBox(box);
    return true;
  } catch (e) { console.log('saveBox err:', e); return false; }
}

export async function saveCustomer(c: any): Promise<boolean> {
  try {
    const cc = await import('./lib.fx.cust');
    await cc.saveCust(c);
    return true;
  } catch (e) { console.log('saveCust err:', e); return false; }
}

export async function deleteBoxById(id: string): Promise<boolean> {
  try {
    const bx = await import('./lib.boxes');
    await bx.deleteBox(id);
    return true;
  } catch { return false; }
}

export async function deleteCustById(id: string): Promise<boolean> {
  try {
    const c = await import('./lib.fx.cust');
    await c.deleteCust(id);
    return true;
  } catch { return false; }
}
`;

fs.writeFileSync('lib.assistant.core.ts', core, 'utf8');
console.log('✅ lib.assistant.core.ts ساخته شد (' + core.split('\n').length + ' خط)');

// ═══════════════════════════════════════════════════════
// AssistantScreen.tsx — UI کامل
// ═══════════════════════════════════════════════════════
const screen = `// AssistantScreen.tsx — دستیار کامل نهایی
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch, NativeModules,
  Platform, DeviceEventEmitter
} from 'react-native';
import {
  deepSearch, resolveBox, resolvePerson, setContext, getContext, clearContext,
  boxOp, extractCurrency, extractAmount, Entity, norm,
  saveBox, saveCustomer, deleteBoxById, deleteCustById,
} from './lib.assistant.core';

const { Speech } = NativeModules;
const speechAvailable = !!(Speech && Platform.OS === 'android');

export default function AssistantScreen({ showToast, onExit }: any) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [speakAnswers, setSpeakAnswers] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form
  const [form, setForm] = useState<any>(null); // { type, title, fields, entity, items, txs }
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [lastMsg, setLastMsg] = useState('');

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
  // باز کردن entity
  // ═══════════════════════════════════════════
  const openEntity = async (e: Entity) => {
    setSearchResults([]);
    setContext({ lastEntity: { type: e.type, id: e.id, name: e.name, meta: e.meta } });

    if (e.type === 'box') {
      try {
        const bx = await import('./lib.boxes');
        const txs = await bx.getBoxTransactions(e.meta.id || e.meta.local_id).catch(() => []) || [];
        const bals = await bx.getAllBalances().catch(() => ({})) || {};
        const bal = bals[e.meta.id || e.meta.local_id] || 0;
        setForm({
          type: 'box',
          title: '📦 ' + (e.meta.name || e.meta.code),
          entity: e.meta,
          fields: {
            name: { label: 'نام صندوق', value: e.meta.name || '', editable: true },
            code: { label: 'کد', value: e.meta.code || '', editable: false },
            currency: { label: 'ارز', value: e.meta.currency || 'AFN', editable: true },
            owner_name: { label: 'صاحب', value: e.meta.owner_name || '', editable: true },
          },
          balance: bal,
          txs: txs || [],
          amount: '',
        });
        setLastMsg('📦 ' + (e.meta.name || e.meta.code) + ' — ' + bal.toLocaleString('en-US') + ' ' + (e.meta.currency || 'AFN'));
        speak('صندوق ' + (e.meta.name || e.meta.code));
      } catch (err: any) { showToast?.('❌ ' + (err?.message || ''), true); }
    } else if (e.type === 'customer') {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
        const bals = raw ? JSON.parse(raw) : {};
        const bal = bals[e.meta.id || e.meta.local_id] || 0;
        setForm({
          type: 'customer',
          title: '👤 ' + e.meta.name,
          entity: e.meta,
          fields: {
            name: { label: 'نام', value: e.meta.name || '', editable: true },
            phone: { label: 'تلفن', value: e.meta.phone || '', editable: true },
            bank: { label: 'بانک', value: e.meta.bank || '', editable: true },
            holder_name: { label: 'صاحب حساب', value: e.meta.holder_name || '', editable: true },
            holder_code: { label: 'شماره حساب', value: e.meta.holder_code || '', editable: true },
            notes: { label: 'توضیحات', value: e.meta.notes || '', editable: true },
          },
          balance: bal,
          txs: [],
          amount: '',
        });
        setLastMsg('👤 ' + e.meta.name + ' — مانده: ' + bal.toLocaleString('en-US'));
        speak(e.meta.name);
      } catch (err: any) { showToast?.('❌ ' + (err?.message || ''), true); }
    } else if (e.type === 'invoice') {
      try {
        const items = (e.meta.items || []).map((it: any) => ({
          model_code: it.model_code || '',
          model_name: it.model_name || '',
          quantity: it.quantity || 1,
          price_unit: it.price_unit || 0,
        }));
        setForm({
          type: 'invoice',
          title: '📄 فاکتور ' + (e.meta.invoice || ''),
          entity: e.meta,
          fields: {
            invoice: { label: 'شماره فاکتور', value: e.meta.invoice || '', editable: false },
            name: { label: 'مشتری', value: e.meta.name || '', editable: true },
            phone: { label: 'تلفن', value: e.meta.phone || '', editable: true },
            date: { label: 'تاریخ', value: e.meta.date ? new Date(e.meta.date).toLocaleDateString('fa-IR') : '', editable: true },
          },
          balance: 0,
          txs: [],
          amount: '',
          items,
          total: e.meta.total || 0,
          paid: e.meta.paid || 0,
        });
        setLastMsg('📄 فاکتور ' + (e.meta.invoice || '') + ' — ' + (e.meta.name || ''));
        speak('فاکتور ' + (e.meta.invoice || ''));
      } catch (err: any) { showToast?.('❌ ' + (err?.message || ''), true); }
    }
  };

  // ═══════════════════════════════════════════
  // اجرای دستور
  // ═══════════════════════════════════════════
  const run = async (cmd?: string) => {
    const c = (cmd || text).trim();
    if (!c) return;
    setProcessing(true);
    setText('');
    const low = norm(c);
    const amt = extractAmount(low);

    try {
      // اگه فرم بازه: واریز/برداشت/ذخیره/بستن
      if (form) {
        // واریز/برداشت صندوق
        if (form.type === 'box') {
          const isDep = /واریز|اضافه|بزن|جمع|افزایش/.test(low);
          const isWit = /برداشت|کم|کسر|خرج|پرداخت/.test(low);
          if (amt && amt > 0 && (isDep || isWit)) {
            const r = await boxOp(form.entity, amt, isDep ? 'deposit' : 'withdraw');
            setLastMsg(r.msg);
            speak(r.msg);
            showToast?.(r.msg);
            // refresh
            await openEntity({ type: 'box', id: '', name: '', meta: form.entity, score: 100 });
            setProcessing(false);
            return;
          }
        }
        // ذخیره
        if (/ذخیره|سیو|ثبت/.test(low)) {
          if (form.type === 'box') {
            const updated = { ...form.entity };
            Object.entries(form.fields).forEach(([k, f]: any) => { updated[k] = f.value; });
            await saveBox(updated);
            showToast?.('✅ ذخیره شد');
            speak('ذخیره شد');
          } else if (form.type === 'customer') {
            const updated = { ...form.entity };
            Object.entries(form.fields).forEach(([k, f]: any) => { updated[k] = f.value; });
            await saveCustomer(updated);
            showToast?.('✅ ذخیره شد');
            speak('ذخیره شد');
          } else {
            showToast?.('✅ ذخیره شد');
          }
          setProcessing(false);
          return;
        }
        // بستن
        if (/بستن|بنداز|خروج|لغو|تمام/.test(low)) {
          setForm(null);
          clearContext();
          setLastMsg('بسته شد');
          setProcessing(false);
          return;
        }
      }

      // ─── جستجو ───
      // تشخیص نوع
      let types: string[] | undefined;
      if (/صندوق|کارتکش|کاردکس/.test(low)) types = ['box'];
      else if (/مشتری|طرف.?حساب/.test(low)) types = ['customer'];
      else if (/فاکتور|فاکتر|صورت.?حساب/.test(low)) types = ['invoice'];

      const nameQuery = low
        .replace(/کارتکش|کاردکس|فاکتور|فاکتر|صورت.?حساب|صندوق|مشتری|طرف.?حساب|حواله|چک|را|بیار|بیاور|بگیر|نشون|نشان|بده|بزن|ویرایش|کن|برای|از|به|رو|دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|usd|afn|eur/g, '')
        .replace(/[^\\u0600-\\u06FF\\w\\s\\d]/g, '')
        .trim();

      const currency = extractCurrency(low);

      if (nameQuery.length >= 2) {
        // اگه صندوق + ارز → resolveBox مستقیم
        if (types?.includes('box')) {
          const b = await resolveBox(nameQuery, currency);
          if (b) {
            await openEntity({ type: 'box', id: '', name: '', meta: b, score: 100 });
            setProcessing(false);
            return;
          }
        }
        // جستجوی کلی
        const results = await deepSearch(nameQuery, types);
        if (results.length === 1) {
          await openEntity(results[0]);
          setProcessing(false);
          return;
        }
        if (results.length > 1) {
          setSearchResults(results);
          setLastMsg(\`\${results.length} نتیجه — انتخاب کن\`);
          speak(\`\${results.length} نتیجه\`);
          setProcessing(false);
          return;
        }
      }

      setLastMsg('❌ پیدا نشد');
      showToast?.('❌ پیدا نشد', true);
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || ''), true);
    }
    setProcessing(false);
  };

  // ═══════════════════════════════════════════
  // UI Helpers
  // ═══════════════════════════════════════════
  const updateField = (k: string, v: any) => {
    setForm((f: any) => f ? { ...f, fields: { ...f.fields, [k]: { ...f.fields[k], value: v } } } : f);
  };

  const doBoxOp = async (type: 'deposit' | 'withdraw') => {
    if (!form || !form.amount) return;
    const amt = Number(form.amount) || 0;
    if (amt <= 0) { showToast?.('مبلغ معتبر نیست', true); return; }
    const r = await boxOp(form.entity, amt, type);
    setLastMsg(r.msg);
    speak(r.msg);
    showToast?.(r.msg);
    // refresh
    await openEntity({ type: 'box', id: '', name: '', meta: form.entity, score: 100 });
  };

  const useSample = (t: string) => { setText(t); setTimeout(() => run(t), 100); };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.backBtn}><Text style={s.backTxt}>×</Text></TouchableOpacity>
        <Text style={s.title}>🤖 دستیار</Text>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.menuBtn}><Text style={s.menuTxt}>☰</Text></TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        {/* FORM */}
        {form && (
          <View style={s.formCard}>
            <View style={s.formHead}>
              <Text style={s.formTitle}>{form.title}</Text>
              <TouchableOpacity onPress={() => { setForm(null); clearContext(); }}>
                <Text style={s.formX}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Fields */}
            {Object.entries(form.fields).map(([k, f]: any) => (
              <View key={k} style={s.fRow}>
                <Text style={s.fLbl}>{f.label}</Text>
                {f.editable ? (
                  <TextInput
                    style={s.fInp}
                    value={String(f.value || '')}
                    onChangeText={(v) => updateField(k, v)}
                    placeholderTextColor="#64748b"
                  />
                ) : (
                  <Text style={s.fRead}>{String(f.value || '—')}</Text>
                )}
              </View>
            ))}

            {/* Balance (for box/customer) */}
            {(form.type === 'box' || form.type === 'customer') && (
              <View style={s.balBox}>
                <Text style={s.balLbl}>موجودی / مانده</Text>
                <Text style={[s.balNum, { color: (form.balance || 0) >= 0 ? '#10b981' : '#ef4444' }]}>
                  {Math.abs(Number(form.balance) || 0).toLocaleString('en-US')}
                </Text>
              </View>
            )}

            {/* Amount + deposit/withdraw */}
            {form.type === 'box' && (
              <View style={s.opBox}>
                <TextInput
                  style={s.opInp}
                  value={form.amount}
                  onChangeText={(v) => setForm({ ...form, amount: v })}
                  placeholder="مبلغ"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
                <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[s.opBtn, { backgroundColor: '#059669' }]} onPress={() => doBoxOp('deposit')}>
                    <Text style={s.opTxt}>✅ واریز</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.opBtn, { backgroundColor: '#dc2626' }]} onPress={() => doBoxOp('withdraw')}>
                    <Text style={s.opTxt}>❌ برداشت</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Transactions */}
            {form.type === 'box' && form.txs && form.txs.length > 0 && (
              <>
                <Text style={s.secT}>📋 کارتکش ({form.txs.length})</Text>
                {form.txs.slice(0, 20).map((tx: any, i: number) => {
                  const isDep = tx.type === 'deposit' || tx.type === 'in' || tx.type === 'transfer_in';
                  return (
                    <View key={i} style={s.txRow}>
                      <Text style={s.txIcon}>{isDep ? '➕' : '➖'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.txAmt, { color: isDep ? '#10b981' : '#ef4444' }]}>
                          {isDep ? '+' : '-'}{(Number(tx.amount) || 0).toLocaleString('en-US')} {tx.currency || ''}
                        </Text>
                        <Text style={s.txDesc}>{tx.description || ''}</Text>
                      </View>
                      <Text style={s.txDate}>{tx.date ? new Date(tx.date).toLocaleDateString('fa-IR') : ''}</Text>
                    </View>
                  );
                })}
              </>
            )}

            {/* Invoice Items */}
            {form.type === 'invoice' && form.items && (
              <>
                <Text style={s.secT}>📋 اقلام ({form.items.length})</Text>
                {form.items.map((it: any, i: number) => (
                  <View key={i} style={s.itemBox}>
                    <Text style={s.itemName}>📦 {it.model_name || '—'} × {it.quantity} — {Number(it.price_unit).toLocaleString('en-US')}</Text>
                    <TouchableOpacity onPress={() => setForm({ ...form, items: form.items.filter((_: any, idx: number) => idx !== i) })}>
                      <Text style={{ color: '#dc2626', fontSize: 18, fontWeight: 'bold' }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[s.opBtn, { backgroundColor: '#0891b2', marginTop: 8 }]}
                  onPress={() => setForm({ ...form, items: [...(form.items || []), { model_name: '', quantity: 1, price_unit: 0 }] })}
                >
                  <Text style={s.opTxt}>➕ افزودن قلم</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}>
              <TouchableOpacity style={[s.opBtn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={() => run('ذخیره')}>
                <Text style={s.opTxt}>💾 ذخیره</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.opBtn, { backgroundColor: '#64748b' }]} onPress={() => { setForm(null); clearContext(); }}>
                <Text style={s.opTxt}>✕ بستن</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search Results */}
        {!form && searchResults.length > 0 && (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>🔍 {searchResults.length} نتیجه:</Text>
            {searchResults.map((r, i) => (
              <TouchableOpacity key={i} style={s.resultItem} onPress={() => openEntity(r)}>
                <Text style={s.resultIcon}>{r.type === 'box' ? '📦' : r.type === 'customer' ? '👤' : '📄'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName}>{r.name}</Text>
                  {r.subtitle ? <Text style={s.resultSub}>{r.subtitle}</Text> : null}
                </View>
                <Text style={s.resultScore}>{r.score}%</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.opBtn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => setSearchResults([])}>
              <Text style={s.opTxt}>✕ بستن</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Last Message */}
        {lastMsg ? <View style={s.msgBox}><Text style={s.msgTxt}>{lastMsg}</Text></View> : null}

        {/* Input */}
        {!form && (
          <>
            <TextInput
              style={s.bigInp}
              value={text}
              onChangeText={setText}
              placeholder="مثلاً: صندوق احمد | فاکتور فروغی | مشتری رضا"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
              onSubmitEditing={() => run()}
            />
            <View style={s.row}>
              <TouchableOpacity style={[s.opBtn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={() => run()} disabled={processing || !text.trim()}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={s.opTxt}>▶ جستجو</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.opBtn, { backgroundColor: '#0891b2' }]} onPress={startVoice} disabled={!speechAvailable}>
                <Text style={s.opTxt}>🎤</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.opBtn, { backgroundColor: '#64748b' }]} onPress={() => { setText(''); setSearchResults([]); }}>
                <Text style={s.opTxt}>🗑</Text>
              </TouchableOpacity>
            </View>

            {listening && <View style={s.listenBox}><Text style={s.listenTxt}>🎤 {partialText || 'گوش می‌دم...'}</Text></View>}

            <Text style={s.secT}>💡 نمونه:</Text>
            <View style={s.samplesGrid}>
              {[
                { icon: '📦', text: 'صندوق احمد' },
                { icon: '📦', text: 'کارتکش دالر فروغی' },
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

      {/* Sidebar */}
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
              <Text style={[s.sbLbl, { marginTop: 16, fontWeight: 'bold' }]}>📌 نمونه:</Text>
              <Text style={s.sbHint}>• «صندوق احمد»</Text>
              <Text style={s.sbHint}>• «کارتکش دالر فروغی»</Text>
              <Text style={s.sbHint}>• «مشتری رضا»</Text>
              <Text style={s.sbHint}>• «فاکتور فروغی»</Text>
              <Text style={[s.sbLbl, { marginTop: 16, fontWeight: 'bold' }]}>💡 وقتی فرم بازه:</Text>
              <Text style={s.sbHint}>• «۵۰۰ واریز»</Text>
              <Text style={s.sbHint}>• «۱۰۰ برداشت»</Text>
              <Text style={s.sbHint}>• «ذخیره»</Text>
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
  opBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  opTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  formCard: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#7c3aed' },
  formHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
  formTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  formX: { color: '#dc2626', fontSize: 26, fontWeight: 'bold' },
  fRow: { marginBottom: 10 },
  fLbl: { color: '#94a3b8', fontSize: 12, marginBottom: 4, textAlign: 'right' },
  fInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'right' },
  fRead: { color: '#cbd5e1', fontSize: 14, textAlign: 'right', padding: 10, backgroundColor: '#0a1628', borderRadius: 8 },
  balBox: { backgroundColor: '#1a2332', padding: 16, borderRadius: 10, alignItems: 'center', marginVertical: 10 },
  balLbl: { color: '#94a3b8', fontSize: 12 },
  balNum: { fontSize: 30, fontWeight: 'bold', marginTop: 4 },
  opBox: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginBottom: 10 },
  opInp: { backgroundColor: '#0f2438', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', fontWeight: 'bold' },
  secT: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginTop: 12, marginBottom: 6 },
  txRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  txIcon: { fontSize: 16 },
  txAmt: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  txDesc: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  txDate: { color: '#64748b', fontSize: 10 },
  itemBox: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6 },
  itemName: { color: '#fff', fontSize: 13, textAlign: 'right', flex: 1 },
  resultCard: { backgroundColor: '#0f2438', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#0891b2' },
  resultTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  resultItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6 },
  resultIcon: { fontSize: 20 },
  resultName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  resultSub: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  resultScore: { color: '#059669', fontSize: 12, fontWeight: 'bold' },
  msgBox: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#7c3aed' },
  msgTxt: { color: '#fff', fontSize: 14, textAlign: 'right', fontWeight: 'bold' },
  samplesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  sampleBtn: { backgroundColor: '#1a2332', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  sampleIcon: { fontSize: 16 },
  sampleTxt: { color: '#cbd5e1', fontSize: 12 },
  listenBox: { backgroundColor: '#7c3aed', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  listenTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
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

fs.writeFileSync('AssistantScreen.tsx', screen, 'utf8');
console.log('✅ AssistantScreen.tsx ساخته شد (' + screen.split('\n').length + ' خط)');
console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');
console.log('   copy /Y "' + bdir + '\\lib.assistant.core.ts" lib.assistant.core.ts');