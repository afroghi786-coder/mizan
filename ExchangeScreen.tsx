// ExchangeScreen.tsx — صرافی (کاملاً آفلاین با AsyncStorage)
import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══ ۲۷ ارز ═══
const CUR: Record<string, { name: string; flag: string; dec: number; color: string }> = {
  AFN:{name:'افغانی',flag:'🇦🇫',dec:0,color:'#f59e0b'},
  USD:{name:'دالر آمریکا',flag:'🇺🇸',dec:2,color:'#10b981'},
  EUR:{name:'یورو',flag:'🇪🇺',dec:2,color:'#3b82f6'},
  GBP:{name:'پوند',flag:'🇬🇧',dec:2,color:'#0891b2'},
  PKR:{name:'کلدار',flag:'🇵🇰',dec:0,color:'#059669'},
  INR:{name:'روپیه هند',flag:'🇮🇳',dec:0,color:'#ea580c'},
  IRR:{name:'ریال ایران',flag:'🇮🇷',dec:0,color:'#dc2626'},
  TOM:{name:'تومان',flag:'🇮🇷',dec:0,color:'#a855f7'},
  TRY:{name:'لیر ترکیه',flag:'🇹🇷',dec:2,color:'#e11d48'},
  CNY:{name:'یوان چین',flag:'🇨🇳',dec:2,color:'#dc2626'},
  RUB:{name:'روبل',flag:'🇷🇺',dec:2,color:'#0891b2'},
  AED:{name:'درهم امارات',flag:'🇦🇪',dec:2,color:'#16a34a'},
  SAR:{name:'ریال سعودی',flag:'🇸🇦',dec:2,color:'#15803d'},
  QAR:{name:'ریال قطر',flag:'🇶🇦',dec:2,color:'#7c2d12'},
  KWD:{name:'دینار کویت',flag:'🇰🇼',dec:2,color:'#0891b2'},
  OMR:{name:'ریال عمان',flag:'🇴🇲',dec:2,color:'#dc2626'},
  BHD:{name:'دینار بحرین',flag:'🇧🇭',dec:2,color:'#b91c1c'},
  KGS:{name:'سوم قرقیز',flag:'🇰🇬',dec:0,color:'#dc2626'},
  UZS:{name:'سوم ازبک',flag:'🇺🇿',dec:0,color:'#0891b2'},
  TJK:{name:'سامانی',flag:'🇹🇯',dec:2,color:'#dc2626'},
  TKM:{name:'منات ترکمن',flag:'🇹🇲',dec:2,color:'#059669'},
  CAD:{name:'دالر کانادا',flag:'🇨🇦',dec:2,color:'#dc2626'},
  AUD:{name:'دالر استرالیا',flag:'🇦🇺',dec:2,color:'#0891b2'},
  JPY:{name:'ین ژاپن',flag:'🇯🇵',dec:0,color:'#dc2626'},
  CHF:{name:'فرانک سوئیس',flag:'🇨🇭',dec:2,color:'#dc2626'},
  MYR:{name:'رینگت مالزی',flag:'🇲🇾',dec:2,color:'#0891b2'},
  SGD:{name:'دالر سنگاپور',flag:'🇸🇬',dec:2,color:'#dc2626'},
};
const MAIN = ['AFN','USD','EUR','GBP','PKR','AED','IRR','TOM'];
const POS_KEY = '@mizan_fx_positions';
const TRD_KEY = '@mizan_fx_trades';

const fmt = (n: number, d = 2) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const parse = (s: any) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;

export default function ExchangeScreen({ showToast }: any) {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [trades, setTrades] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('AFN');
  const [fromQty, setFromQty] = useState('');
  const [toQty, setToQty] = useState('');
  const [rate, setRate] = useState('');
  const [desc, setDesc] = useState('');
  const [load, setLoad] = useState(true);

  // ─── بارگذاری ───
  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(POS_KEY);
        const t = await AsyncStorage.getItem(TRD_KEY);
        const pos: Record<string, number> = p ? JSON.parse(p) : {};
        Object.keys(CUR).forEach(k => { if (pos[k] === undefined) pos[k] = 0; });
        setPositions(pos);
        setTrades(t ? JSON.parse(t) : []);
      } catch {}
      setLoad(false);
    })();
  }, []);

  const save = async (p: Record<string, number>, t: any[]) => {
    try {
      await AsyncStorage.setItem(POS_KEY, JSON.stringify(p));
      await AsyncStorage.setItem(TRD_KEY, JSON.stringify(t));
    } catch {}
  };

  // ─── محاسبه ───
  const recalc = (fq: string, r: string, field: 'to' | 'rate') => {
    const f = parse(fq), rr = parse(r);
    if (field === 'rate') {
      const t = f * rr;
      setToQty(t ? fmt(t, CUR[to]?.dec || 2) : '');
    } else {
      const t = parse(toQty);
      if (f > 0 && t > 0) setRate(fmt(t / f, 6));
    }
  };

  const openTrade = (f: string, t: string) => {
    setFrom(f); setTo(t); setFromQty(''); setToQty(''); setRate(''); setDesc('');
    setModal(true);
  };

  const submit = async () => {
    const fq = parse(fromQty), tq = parse(toQty), r = parse(rate);
    if (fq <= 0) return showToast('مقدار مبدأ را وارد کن', true);
    if (tq <= 0) return showToast('مقدار مقصد را وارد کن', true);
    if (from === to) return showToast('ارز مبدأ و مقصد یکسان است', true);

    const newPos = { ...positions };
    newPos[from] = (newPos[from] || 0) - fq;
    newPos[to] = (newPos[to] || 0) + tq;

    const newTrade = {
      id: Date.now(), date: new Date().toLocaleDateString('fa-IR'),
      from, to, fromQty: fq, toQty: tq, rate: r || (fq ? tq / fq : 0), desc,
    };
    const newTrades = [newTrade, ...trades].slice(0, 500);

    setPositions(newPos);
    setTrades(newTrades);
    await save(newPos, newTrades);
    setModal(false);
    showToast('✅ معامله ثبت شد');
  };

  const deleteTrade = async (id: number) => {
    const t = trades.find((x: any) => x.id === id);
    if (!t) return;
    const newPos = { ...positions };
    newPos[t.from] = (newPos[t.from] || 0) + t.fromQty;
    newPos[t.to] = (newPos[t.to] || 0) - t.toQty;
    const newTrades = trades.filter((x: any) => x.id !== id);
    setPositions(newPos);
    setTrades(newTrades);
    await save(newPos, newTrades);
    showToast('↩️ معامله حذف شد');
  };

  if (load) return <View style={s.center}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Text style={s.title}>💱 صرافی</Text>
      <Text style={s.sub}>مدیریت پوزیشن ارزی — کاملاً آفلاین</Text>

      {/* پوزیشن‌ها */}
      <View style={s.grid}>
        {MAIN.map(code => {
          const c = CUR[code];
          const q = positions[code] || 0;
          const col = q > 0 ? '#059669' : q < 0 ? '#dc2626' : '#94a3b8';
          return (
            <View key={code} style={s.card}>
              <Text style={s.sym}>{c.flag}</Text>
              <Text style={s.name}>{c.name}</Text>
              <Text style={[s.bal, { color: col }]}>{q > 0 ? '+' : ''}{fmt(q, c.dec)}</Text>
              <TouchableOpacity style={[s.miniBtn, { backgroundColor: c.color }]} onPress={() => openTrade(code, code === 'AFN' ? 'USD' : 'AFN')}>
                <Text style={s.miniBtnTxt}>💱 معامله</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* دکمه معامله جدید */}
      <TouchableOpacity style={s.bigBtn} onPress={() => openTrade('USD', 'AFN')}>
        <Text style={s.bigBtnTxt}>➕ معامله جدید</Text>
      </TouchableOpacity>

      {/* همه‌ی پوزیشن‌ها */}
      <Text style={s.secT}>📊 همه‌ی ارزها</Text>
      <View style={s.tbl}>
        {Object.keys(CUR).map(code => {
          const c = CUR[code];
          const q = positions[code] || 0;
          if (q === 0) return null;
          const col = q > 0 ? '#059669' : '#dc2626';
          return (
            <View key={code} style={s.row}>
              <Text style={s.rowFlag}>{c.flag}</Text>
              <Text style={s.rowName}>{c.name}</Text>
              <Text style={[s.rowVal, { color: col }]}>{fmt(q, c.dec)}</Text>
            </View>
          );
        })}
        {Object.keys(CUR).every(k => !positions[k]) && <Text style={s.empty}>هنوز معامله‌ای ثبت نشده</Text>}
      </View>

      {/* تاریخچه */}
      {trades.length > 0 && (
        <>
          <Text style={s.secT}>📜 تاریخچه ({trades.length})</Text>
          {trades.slice(0, 30).map((t: any) => (
            <View key={t.id} style={s.tradeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.tradeLine}>
                  {CUR[t.from]?.flag} {fmt(t.fromQty, CUR[t.from]?.dec)} {t.from}
                  {' → '}
                  {CUR[t.to]?.flag} {fmt(t.toQty, CUR[t.to]?.dec)} {t.to}
                </Text>
                <Text style={s.tradeSub}>📅 {t.date} — نرخ: {fmt(t.rate, 6)}{t.desc ? ' — ' + t.desc : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteTrade(t.id)} style={s.delBtn}>
                <Text style={{ fontSize: 16 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* مودال معامله */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox} keyboardShouldPersistTaps="handled">
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>💱 معامله ارز</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.lbl}>📤 ارز مبدأ (می‌دهم)</Text>
              <View style={s.pickRow}>
                {Object.keys(CUR).map(k => (
                  <TouchableOpacity key={k} onPress={() => setFrom(k)} style={[s.pick, from === k && s.pickActive]}>
                    <Text style={[s.pickTxt, from === k && s.pickTxtActive]}>{CUR[k].flag} {k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={s.inp} value={fromQty} onChangeText={v => { setFromQty(v); recalc(v, rate, 'rate'); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>📥 ارز مقصد (می‌گیرم)</Text>
              <View style={s.pickRow}>
                {Object.keys(CUR).map(k => (
                  <TouchableOpacity key={k} onPress={() => setTo(k)} style={[s.pick, to === k && s.pickActive]}>
                    <Text style={[s.pickTxt, to === k && s.pickTxtActive]}>{CUR[k].flag} {k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={s.inp} value={toQty} onChangeText={v => { setToQty(v); recalc(fromQty, rate, 'to'); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>💹 نرخ تبدیل</Text>
              <TextInput style={s.inp} value={rate} onChangeText={v => { setRate(v); recalc(fromQty, v, 'rate'); }} keyboardType="numeric" placeholder="1.00" placeholderTextColor="#94a3b8" />

              <Text style={s.lbl}>📝 توضیحات (اختیاری)</Text>
              <TextInput style={s.inp} value={desc} onChangeText={setDesc} placeholder="مثلاً: مشتری احمد" placeholderTextColor="#94a3b8" />

              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}>
                  <Text style={s.btnTxt}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submit}>
                  <Text style={s.btnTxt}>✅ ثبت معامله</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#065f46', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  card: { width: '48%', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  sym: { fontSize: 24, marginBottom: 4 },
  name: { fontSize: 11, color: '#64748b', marginBottom: 6 },
  bal: { fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 8 },
  miniBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  miniBtnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  bigBtn: { backgroundColor: '#059669', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  bigBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  secT: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', marginTop: 12, marginBottom: 8, textAlign: 'right' },
  tbl: { backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowFlag: { fontSize: 20, width: 32, textAlign: 'center' },
  rowName: { flex: 1, fontSize: 13, color: '#0f2438', textAlign: 'right', paddingRight: 8 },
  rowVal: { fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 12 },
  tradeRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  tradeLine: { fontSize: 13, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', fontFamily: 'monospace' },
  tradeSub: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 },
  delBtn: { padding: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '90%' },
  modalHead: { backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 6 },
  pickRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  pick: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  pickActive: { backgroundColor: '#059669', borderColor: '#059669' },
  pickTxt: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  pickTxtActive: { color: '#fff' },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'center', backgroundColor: '#f8fafc', color: '#0f2438', fontFamily: 'monospace' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
