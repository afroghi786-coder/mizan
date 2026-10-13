const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-rebuildui-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('ManualEntryScreen.tsx', path.join(bdir, 'ManualEntryScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

const newUI = `// ManualEntryScreen.tsx — دستیار هوشمند کامل
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch, Share, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseCommand, saveManual, getHistory, addHistory,
  getLearned, addLearned, clearLearned, ParseContext,
  ParsedResult, LearnedPattern,
  getManualSettings, saveManualSettings, DEFAULT_SETTINGS, ManualSettings,
  getShortcuts, bumpShortcut, Shortcut,
  getLastUndo, markUndone,
  exportToExcel,
} from './lib.manual';
import { getFxCustomers } from './lib.fx.cust';
import { getHawalas, createHawala } from './lib.fx';
import { getSalesGrouped, createSale, getPurchasesGrouped, createPurchase } from './lib';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BALANCE_KEY = '@mizan_manual_balances_v1';

export default function ManualEntryScreen({ showToast }: any) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParsedResult | null>(null);
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

  const load = useCallback(async () => {
    try {
      const [cust, sales, purch, hist, bals, lrn, st, sc, un] = await Promise.all([
        getFxCustomers().catch(() => []),
        getSalesGrouped().catch(() => []),
        getPurchasesGrouped().catch(() => []),
        getHistory(),
        AsyncStorage.getItem(BALANCE_KEY),
        getLearned(),
        getManualSettings(),
        getShortcuts(),
        getLastUndo(),
      ]);
      setCustomers(cust || []);
      setSuppliers((purch || []).map((x: any) => ({ id: x.supplier_code || x.id, name: x.supplier_name, phone: x.supplier_phone, type: 'supplier' })));
      setPartners([]);
      setHistory(hist);
      setBalances(bals ? JSON.parse(bals) : {});
      setLearned(lrn);
      setSettings(st);
      setShortcuts(sc);
      setUndoEntry(un);
    } catch (e: any) { console.log('load err:', e?.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // پیشنهاد خودکار بر اساس تاریخچه
  useEffect(() => {
    if (!text || text.length < 2) { setSuggestions([]); return; }
    const histRaw = history.slice(0, 30).map(h => h.raw).filter(Boolean);
    const similar = histRaw.filter((h: string) => 
      h.startsWith(text.slice(0, 3)) || text.startsWith(h.slice(0, 3))
    ).slice(0, 3);
    setSuggestions([...new Set(similar)]);
  }, [text, history]);

  const analyze = async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    try {
      const ctx: ParseContext = {
        customers: customers.map((c: any) => ({ id: c.id || c.local_id, name: c.name, phone: c.phone, type: 'customer' })),
        suppliers: suppliers.map((s: any) => ({ id: s.id, name: s.name, phone: s.phone, type: 'supplier' })),
        partners,
      };
      const r = await parseCommand(text, ctx);
      if (r.from) r.from.balance = balances[r.from.id] || 0;
      if (r.to) r.to.balance = balances[r.to.id] || 0;
      if (r.person) r.person.balance = balances[r.person.id] || 0;
      setResult(r);
      
      // خودکار تأیید
      if (settings.autoConfirm && r.ok && r.confidence >= settings.autoConfirmThreshold) {
        setTimeout(() => confirmResult(r), 300);
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setAnalyzing(false);
  };

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
        await addHistory({
          id: 'h_' + Date.now(),
          raw: text,
          parsed: r,
          timestamp: Date.now(),
          saved: true,
        });
        setHistory(await getHistory());
        setUndoEntry(await getLastUndo());
        showToast?.(saveRes.message);
        setText('');
        setResult(null);
      } else {
        showToast?.(saveRes.message, true);
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setSaving(false);
  };

  const confirm = () => {
    if (result?.ok) confirmResult(result);
  };

  const undo = async () => {
    if (!undoEntry) return;
    await markUndone(undoEntry.id);
    setUndoEntry(null);
    showToast?.('↩️ عملیات لغو شد (بازگشت کامل ممکن نیست)');
  };

  const teach = async () => {
    if (!result || !text) return;
    const id = 'learned_' + Date.now();
    const lp: LearnedPattern = {
      id,
      regex: text.replace(/[0-9]+/g, '\\\\d+').replace(/[ا-ی]+/g, '[\\\\u0600-\\\\u06FF]+'),
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
      const fileUri = FileSystem.cacheDirectory + 'mizan-manual-' + Date.now() + '.csv';
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'خروجی دستیار' });
        showToast?.('✅ خروجی آماده شد');
      } else {
        showToast?.('اشتراک‌گذاری پشتیبانی نمی‌شود', true);
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
  };

  const applyShortcut = (sc: Shortcut) => {
    setText(sc.text + text);
    bumpShortcut(sc.id);
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

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🤖 دستیار هوشمند</Text>
        <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
          <TouchableOpacity onPress={() => setLearnedModal(true)}>
            <Text style={s.badge}>🧠 {learned.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSettingsModal(true)}>
            <Text style={s.badge}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={s.lbl}>⚡ دسترسی سریع:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {shortcuts.map((sc) => (
            <TouchableOpacity
              key={sc.id}
              style={s.shortcutBtn}
              onPress={() => applyShortcut(sc)}
            >
              <Text style={s.shortcutIcon}>{sc.icon}</Text>
              <Text style={s.shortcutLabel}>{sc.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.lbl}>✏️ بنویسید:</Text>
        <TextInput
          style={s.bigInp}
          value={text}
          onChangeText={setText}
          placeholder="مثلاً: از محمود ۵۰۰۰ به احمد"
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={3}
        />

        {suggestions.length > 0 && (
          <View style={s.suggestBox}>
            <Text style={s.suggestLbl}>💡 پیشنهاد:</Text>
            {suggestions.map((sg, i) => (
              <TouchableOpacity key={i} onPress={() => setText(sg)}>
                <Text style={s.suggestItem}>«{sg}»</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.row}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#0891b2' }]}
            onPress={analyze}
            disabled={analyzing || !text.trim()}
          >
            {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔍 تحلیل</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#64748b' }]}
            onPress={() => { setText(''); setResult(null); }}
          >
            <Text style={s.btnTxt}>🗑 پاک</Text>
          </TouchableOpacity>
          {undoEntry && (
            <TouchableOpacity
              style={[s.btn, { backgroundColor: '#f59e0b' }]}
              onPress={undo}
            >
              <Text style={s.btnTxt}>↩️ لغو</Text>
            </TouchableOpacity>
          )}
        </View>

        {result && (
          <View style={[s.card, { borderColor: result.ok ? '#059669' : '#dc2626' }]}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{result.ok ? '✅ تشخیص داده شد' : '⚠️ ناقص'}</Text>
              {settings.showConfidence && <Text style={s.conf}>اطمینان: {result.confidence}%</Text>}
            </View>

            {result.amount !== undefined && (
              <Text style={s.rowTxt}>💰 مبلغ: <Text style={s.bold}>{fmt(result.amount)} {result.currency || ''}</Text></Text>
            )}
            {result.type && (
              <Text style={s.rowTxt}>📊 نوع: <Text style={s.bold}>{
                result.type === 'sale' ? '💸 فروش' :
                result.type === 'purchase' ? '🛒 خرید' :
                result.type === 'transfer' ? '🔄 انتقال' :
                result.type === 'adjust' ? '⚖️ تنظیم مانده' :
                result.type === 'exchange' ? '💱 صرافی' : result.type
              }</Text></Text>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {result.warnings.map((w, i) => (
                  <Text key={i} style={s.warn}>⚠️ {w}</Text>
                ))}
              </View>
            )}

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
              <TouchableOpacity
                style={[s.btn, { backgroundColor: result.ok ? '#059669' : '#475569', flex: 2 }]}
                onPress={confirm}
                disabled={!result.ok || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ تأیید و ثبت</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#7c3aed' }]}
                onPress={teach}
              >
                <Text style={s.btnTxt}>🧠 یاد بگیر</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {filteredHistory.length > 0 && (
          <>
            <View style={[s.row, { marginTop: 16, alignItems: 'center' }]}>
              <Text style={[s.lbl, { flex: 1, marginTop: 0 }]}>📋 تاریخچه ({filteredHistory.length})</Text>
              <TouchableOpacity
                style={[s.smallBtn, { backgroundColor: historyFilter === 'today' ? '#0891b2' : '#334155' }]}
                onPress={() => setHistoryFilter('today')}
              >
                <Text style={s.smallBtnTxt}>امروز</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.smallBtn, { backgroundColor: historyFilter === 'all' ? '#0891b2' : '#334155' }]}
                onPress={() => setHistoryFilter('all')}
              >
                <Text style={s.smallBtnTxt}>همه</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.smallBtn, { backgroundColor: '#059669' }]}
                onPress={exportExcel}
              >
                <Text style={s.smallBtnTxt}>📤</Text>
              </TouchableOpacity>
            </View>
            {filteredHistory.slice(0, 15).map((h: any, i: number) => (
              <View key={i} style={[s.card, { borderColor: '#334155', marginBottom: 6 }]}>
                <Text style={s.histRaw}>«{h.raw}»</Text>
                <Text style={s.histDate}>{fmtDate(h.timestamp)}</Text>
                {h.parsed?.amount !== undefined && (
                  <Text style={s.histAmt}>💰 {fmt(h.parsed.amount)}</Text>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Learned Modal */}
      <Modal visible={learnedModal} transparent animationType="slide" onRequestClose={() => setLearnedModal(false)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>🧠 الگوهای یادگرفته ({learned.length})</Text>
              <TouchableOpacity onPress={() => setLearnedModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              {learned.length === 0 ? (
                <Text style={s.empty}>هنوز چیزی یاد نگرفته‌ام</Text>
              ) : (
                learned.map((lp, i) => (
                  <View key={i} style={s.learnedItem}>
                    <Text style={s.learnedDesc}>{lp.description}</Text>
                    <Text style={s.learnedEx}>مثال: {lp.examples?.[0] || '—'}</Text>
                    <Text style={s.learnedUse}>استفاده: {lp.usageCount} بار</Text>
                  </View>
                ))
              )}
              {learned.length > 0 && (
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: '#dc2626', marginTop: 12 }]}
                  onPress={async () => { await clearLearned(); setLearned([]); showToast?.('🗑 پاک شد'); }}
                >
                  <Text style={s.btnTxt}>🗑 پاک کردن همه</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>⚙️ تنظیمات دستیار</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              <View style={s.switchRow}>
                <Text style={s.lbl2}>🤖 تأیید خودکار (اطمینان بالا)</Text>
                <Switch value={settings.autoConfirm} onValueChange={(v) => setSettings({ ...settings, autoConfirm: v })} />
              </View>

              <Text style={s.lbl2}>🎯 حداقل اطمینان برای خودکار (٪)</Text>
              <TextInput
                style={s.inp}
                keyboardType="numeric"
                value={String(settings.autoConfirmThreshold)}
                onChangeText={(v) => setSettings({ ...settings, autoConfirmThreshold: Number(v) || 95 })}
              />

              <View style={s.switchRow}>
                <Text style={s.lbl2}>📊 نمایش درصد اطمینان</Text>
                <Switch value={settings.showConfidence} onValueChange={(v) => setSettings({ ...settings, showConfidence: v })} />
              </View>

              <Text style={s.lbl2}>💱 واحد پول پیش‌فرض</Text>
              <TextInput
                style={s.inp}
                value={settings.defaultCurrency}
                onChangeText={(v) => setSettings({ ...settings, defaultCurrency: v })}
              />

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#059669', marginTop: 14 }]}
                onPress={async () => { await saveManualSettings(settings); showToast?.('✅ ذخیره شد'); setSettingsModal(false); }}
              >
                <Text style={s.btnTxt}>💾 ذخیره</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]}
                onPress={() => setSettings({ ...DEFAULT_SETTINGS })}
              >
                <Text style={s.btnTxt}>🔄 بازگشت به پیش‌فرض</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  badge: { color: '#7c3aed', fontSize: 13, fontWeight: 'bold', backgroundColor: '#1a2332', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
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
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
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
  histAmt: { color: '#10b981', fontSize: 12, marginTop: 2, textAlign: 'right' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 13 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '85%', overflow: 'hidden' },
  mHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  x: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  learnedItem: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 8 },
  learnedDesc: { color: '#fff', fontSize: 13, textAlign: 'right' },
  learnedEx: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' },
  learnedUse: { color: '#7c3aed', fontSize: 11, marginTop: 2, textAlign: 'right' },
  shortcutBtn: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#7c3aed', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 6, alignItems: 'center', minWidth: 70 },
  shortcutIcon: { fontSize: 18 },
  shortcutLabel: { color: '#fff', fontSize: 11, marginTop: 2, fontWeight: 'bold' },
  suggestBox: { backgroundColor: '#1a2332', borderRadius: 8, padding: 8, marginTop: 6, borderWidth: 1, borderColor: '#0891b2' },
  suggestLbl: { color: '#0891b2', fontSize: 12, fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  suggestItem: { color: '#cbd5e1', fontSize: 12, paddingVertical: 4, textAlign: 'right' },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
});
`;

fs.writeFileSync('ManualEntryScreen.tsx', newUI, 'utf8');
console.log('✅ ManualEntryScreen.tsx بازنویسی شد (' + newUI.split('\n').length + ' خط)');
console.log('💾 ذخیره شد');
console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('اگه خطا داد → F12 → Console → خطا رو بفرست');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\\\ManualEntryScreen.tsx" ManualEntryScreen.tsx');