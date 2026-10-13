// SmsMatchScreen.tsx — تطبیق بانکی
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Modal, TextInput } from 'react-native';
import {
  getSettings, saveSettings, getTransactions, processNewSms, matchTransactions,
  confirmMatch, rejectMatch, getStats, DEFAULT_SETTINGS,
} from './lib.sms';

export default function SmsMatchScreen({ showToast }: any) {
  const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [detailTx, setDetailTx] = useState<any>(null);

  const load = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    const list = await getTransactions();
    setTxs(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Polling
  useEffect(() => {
    if (!settings.enabled) return;
    const iv = setInterval(async () => {
      await processNewSms();
      await matchTransactions();
      const list = await getTransactions();
      setTxs(list);
    }, settings.pollInterval || 30000);
    return () => clearInterval(iv);
  }, [settings.enabled, settings.pollInterval]);

  const toggleEnabled = async (val: boolean) => {
    const ns = { ...settings, enabled: val };
    setSettings(ns);
    await saveSettings(ns);
    if (val) {
      showToast?.('✅ فعال شد — در حال اسکن...');
      setTimeout(scanNow, 500);
    } else {
      showToast?.('⏸ غیرفعال شد');
    }
  };

  const scanNow = async () => {
    setScanning(true);
    try {
      const r = await processNewSms();
      await matchTransactions();
      const list = await getTransactions();
      setTxs(list);
      showToast?.(r.new > 0 ? '✅ ' + r.new + ' تراکنش جدید' : '🔍 تراکنش جدیدی نبود');
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setScanning(false);
  };

  const stats = getStats(txs);
  const matched = txs.filter(t => t.status === 'matched');
  const pending = txs.filter(t => t.status === 'pending_confirm');
  const unmatched = txs.filter(t => t.status === 'pending' && !t.candidates);
  const rejected = txs.filter(t => t.status === 'rejected');

  const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
  const fmtDate = (ts: any) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#0891b2" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🏦 تطبیق بانکی</Text>
        <Switch value={settings.enabled} onValueChange={toggleEnabled} />
      </View>

      {!settings.enabled && (
        <View style={s.offBox}>
          <Text style={s.offTxt}>🔴 غیرفعال</Text>
          <Text style={s.offHint}>برای شروع، کلید بالا را روشن کنید</Text>
        </View>
      )}

      {settings.enabled && (
        <>
          <View style={s.statsRow}>
            <View style={[s.statBox, { backgroundColor: '#059669' }]}>
              <Text style={s.statNum}>{stats.matched}</Text>
              <Text style={s.statLbl}>🟢 تطبیق</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: '#f59e0b' }]}>
              <Text style={s.statNum}>{stats.pending}</Text>
              <Text style={s.statLbl}>🟡 انتظار</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: '#dc2626' }]}>
              <Text style={s.statNum}>{stats.unmatched}</Text>
              <Text style={s.statLbl}>🔴 بدون</Text>
            </View>
          </View>

          <View style={s.actionsRow}>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2' }]} onPress={scanNow} disabled={scanning}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔍 اسکن</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => setSettingsModal(true)}>
              <Text style={s.btnTxt}>⚙️ تنظیمات</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView style={{ flex: 1, padding: 10 }}>
        {txs.length === 0 && (
          <Text style={s.empty}>📭 تراکنشی نیست</Text>
        )}

        {matched.length > 0 && <Text style={s.sectionT}>🟢 تطبیق‌شده ({matched.length})</Text>}
        {matched.map((t: any) => (
          <View key={t.id} style={[s.card, { borderColor: '#059669' }]}>
            <View style={s.cardHead}>
              <Text style={s.amt}>{t.type === 'deposit' ? '➕' : '➖'} {fmt(t.amount)} AFN</Text>
              <Text style={s.date}>{fmtDate(t.date)}</Text>
            </View>
            <Text style={s.matched}>👤 {t.matchedInvoice?.name || '—'} — {t.matchedInvoice?.invoice || '—'}</Text>
            <Text style={s.diff}>✅ اختلاف زمانی: {t.matchedInvoice?.diffDays ?? 0} روز</Text>
          </View>
        ))}

        {pending.length > 0 && <Text style={s.sectionT}>🟡 در انتظار تأیید ({pending.length})</Text>}
        {pending.map((t: any) => (
          <TouchableOpacity key={t.id} style={[s.card, { borderColor: '#f59e0b' }]} onPress={() => setDetailTx(t)}>
            <View style={s.cardHead}>
              <Text style={s.amt}>{t.type === 'deposit' ? '➕' : '➖'} {fmt(t.amount)} AFN</Text>
              <Text style={s.date}>{fmtDate(t.date)}</Text>
            </View>
            {(t.candidates || []).slice(0, 2).map((c: any, i: number) => (
              <Text key={i} style={s.cand}>👤 {c.name} — {c.invoice} ({c.diffDays} روز)</Text>
            ))}
            <Text style={s.tapHint}>👆 برای انتخاب لمس کنید</Text>
          </TouchableOpacity>
        ))}

        {unmatched.length > 0 && <Text style={s.sectionT}>🔴 بدون تطبیق ({unmatched.length})</Text>}
        {unmatched.map((t: any) => (
          <View key={t.id} style={[s.card, { borderColor: '#dc2626' }]}>
            <View style={s.cardHead}>
              <Text style={s.amt}>{t.type === 'deposit' ? '➕' : '➖'} {fmt(t.amount)} AFN</Text>
              <Text style={s.date}>{fmtDate(t.date)}</Text>
            </View>
            <Text style={s.cand}>فاکتور مشابهی پیدا نشد</Text>
          </View>
        ))}

        {rejected.length > 0 && <Text style={s.sectionT}>⚪ رد شده ({rejected.length})</Text>}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detailTx} transparent animationType="slide" onRequestClose={() => setDetailTx(null)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>🟡 انتخاب فاکتور</Text>
              <TouchableOpacity onPress={() => setDetailTx(null)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              {detailTx && (
                <>
                  <View style={s.txInfo}>
                    <Text style={s.txAmt}>{detailTx.type === 'deposit' ? '➕ واریز' : '➖ برداشت'}</Text>
                    <Text style={s.txBig}>{fmt(detailTx.amount)} AFN</Text>
                    <Text style={s.txDate}>📅 {fmtDate(detailTx.date)}</Text>
                  </View>
                  <Text style={s.mLbl}>💡 فاکتورهای مشابه:</Text>
                  {(detailTx.candidates || []).map((c: any, i: number) => {
                    const color = c.diffDays <= 1 ? '#059669' : c.diffDays <= 3 ? '#f59e0b' : '#dc2626';
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[s.candBox, { borderColor: color }]}
                        onPress={async () => {
                          await confirmMatch(detailTx.id, c);
                          await load();
                          setDetailTx(null);
                          showToast?.('✅ تطبیق انجام شد');
                        }}
                      >
                        <Text style={s.candName}>👤 {c.name}</Text>
                        <Text style={s.candInv}>📄 {c.invoice}</Text>
                        <Text style={s.candAmt}>💰 {fmt(c.amount)} AFN</Text>
                        <Text style={[s.candDiff, { color }]}>
                          {c.diffDays === 0 ? '✅ همون روز' : (c.diffDays > 0 ? '⚠️ ' + c.diffDays + ' روز بعد' : '⚠️ ' + Math.abs(c.diffDays) + ' روز قبل')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: '#dc2626', marginTop: 12 }]}
                    onPress={async () => { await rejectMatch(detailTx.id); await load(); setDetailTx(null); }}
                  >
                    <Text style={s.btnTxt}>❌ هیچ‌کدام</Text>
                  </TouchableOpacity>
                </>
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
              <Text style={s.mTitle}>⚙️ تنظیمات</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              <Text style={s.mLbl}>🕐 بازه زمانی مجاز (روز)</Text>
              <TextInput
                style={s.inp}
                keyboardType="numeric"
                value={String(settings.timeTolerance || 3)}
                onChangeText={(v) => setSettings({ ...settings, timeTolerance: Number(v) || 3 })}
              />

              <Text style={s.mLbl}>💰 تلورانس مبلغ (٪)</Text>
              <TextInput
                style={s.inp}
                keyboardType="numeric"
                value={String(settings.amountTolerance || 1)}
                onChangeText={(v) => setSettings({ ...settings, amountTolerance: Number(v) || 1 })}
              />

              <Text style={s.mLbl}>⏱ بازه اسکن (ثانیه)</Text>
              <TextInput
                style={s.inp}
                keyboardType="numeric"
                value={String(Math.round((settings.pollInterval || 30000) / 1000))}
                onChangeText={(v) => setSettings({ ...settings, pollInterval: (Number(v) || 30) * 1000 })}
              />

              <View style={s.switchRow}>
                <Text style={s.mLbl}>🤖 تطبیق خودکار</Text>
                <Switch value={settings.autoMatch} onValueChange={(v) => setSettings({ ...settings, autoMatch: v })} />
              </View>

              <View style={s.switchRow}>
                <Text style={s.mLbl}>🚫 فیلتر تبلیغات</Text>
                <Switch value={settings.filterAds} onValueChange={(v) => setSettings({ ...settings, filterAds: v })} />
              </View>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#059669', marginTop: 14 }]}
                onPress={async () => { await saveSettings(settings); showToast?.('✅ ذخیره شد'); setSettingsModal(false); }}
              >
                <Text style={s.btnTxt}>💾 ذخیره</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]}
                onPress={() => { setSettings({ ...DEFAULT_SETTINGS, enabled: settings.enabled }); }}
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
  center: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  offBox: { padding: 30, alignItems: 'center' },
  offTxt: { color: '#dc2626', fontSize: 18, fontWeight: 'bold' },
  offHint: { color: '#94a3b8', fontSize: 13, marginTop: 8, textAlign: 'center' },
  statsRow: { flexDirection: 'row-reverse', padding: 10, gap: 8 },
  statBox: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  statLbl: { color: '#fff', fontSize: 11, marginTop: 4 },
  actionsRow: { flexDirection: 'row-reverse', paddingHorizontal: 10, gap: 8, marginBottom: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 30 },
  sectionT: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', marginTop: 12, marginBottom: 6, textAlign: 'right' },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  amt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  date: { color: '#94a3b8', fontSize: 11 },
  matched: { color: '#10b981', fontSize: 12, marginTop: 4, textAlign: 'right' },
  diff: { color: '#94a3b8', fontSize: 11, marginTop: 3, textAlign: 'right' },
  cand: { color: '#cbd5e1', fontSize: 11, marginTop: 3, textAlign: 'right' },
  tapHint: { color: '#0891b2', fontSize: 11, marginTop: 6, textAlign: 'center' },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '88%', overflow: 'hidden' },
  mHead: { backgroundColor: '#1e3a8a', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  x: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  txInfo: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  txAmt: { color: '#94a3b8', fontSize: 12 },
  txBig: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
  txDate: { color: '#94a3b8', fontSize: 11 },
  mLbl: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 6, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, textAlign: 'right', marginBottom: 6 },
  switchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  candBox: { backgroundColor: '#1a2332', borderWidth: 2, borderRadius: 10, padding: 12, marginBottom: 8 },
  candName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  candInv: { color: '#cbd5e1', fontSize: 12, marginTop: 4, textAlign: 'right' },
  candAmt: { color: '#fff', fontSize: 13, marginTop: 4, textAlign: 'right' },
  candDiff: { fontSize: 11, fontWeight: 'bold', marginTop: 4, textAlign: 'right' },
});
