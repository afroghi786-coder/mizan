// ExchangeScreen.tsx — صرافی با Dashboard + جدول ردیفی
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import {
  getFxTrades, createFxTrade, updateFxTrade, deleteFxTrade,
  getFxCustomers, createFxCustomer, updateFxCustomer, deleteFxCustomer,
  getFxPartners, createFxPartner, updateFxPartner, deleteFxPartner,
} from './lib.offline';

// ═══ ارزها ═══
const CUR: Record<string, { name: string; flag: string; dec: number }> = {
  AFN:{name:'افغانی',flag:'🇦🇫',dec:0}, USD:{name:'دالر',flag:'🇺🇸',dec:2},
  EUR:{name:'یورو',flag:'🇪🇺',dec:2}, GBP:{name:'پوند',flag:'🇬🇧',dec:2},
  PKR:{name:'کلدار',flag:'🇵🇰',dec:0}, IRR:{name:'ریال ایران',flag:'🇮🇷',dec:0},
  TOM:{name:'تومان',flag:'🇮🇷',dec:0}, AED:{name:'درهم',flag:'🇦🇪',dec:2},
  SAR:{name:'ریال سعودی',flag:'🇸🇦',dec:2}, TRY:{name:'لیر',flag:'🇹🇷',dec:2},
};
const MAIN_CURS = ['USD', 'EUR', 'AFN', 'PKR', 'AED'];

const fmt = (n: number, d = 2) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const parse = (s: any) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;
const pad2 = (n: number) => String(n).padStart(2, '0');

// ═══ تولید شماره فاکتور FX-YYMMDD-NNNN ═══
function genInvoiceNumber(trades: any[]): string {
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + pad2(d.getMonth() + 1) + pad2(d.getDate());
  let maxN = 1000;
  trades.forEach(t => {
    const m = String(t.invoice_number || '').match(/^FX-\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
  });
  return 'FX-' + ds + '-' + (maxN + 1);
}

export default function ExchangeScreen({ showToast }: any) {
  const [sub, setSub] = useState<'list' | 'form' | 'customers' | 'partners'>('list');
  const [trades, setTrades] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [load, setLoad] = useState(true);
  const [now, setNow] = useState(new Date());

  // فرم معامله
  const [editId, setEditId] = useState<string | null>(null);
  const [fInvoice, setFInvoice] = useState('');
  const [fType, setFType] = useState<'buy' | 'sell'>('buy');
  const [fPartner, setFPartner] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fCustName, setFCustName] = useState('');
  const [fCustCode, setFCustCode] = useState('');
  const [fBank, setFBank] = useState('');
  const [fHolder, setFHolder] = useState('');
  const [fFrom, setFFrom] = useState('AFN');
  const [fTo, setFTo] = useState('USD');
  const [fFromQty, setFFromQty] = useState('');
  const [fToQty, setFToQty] = useState('');
  const [fRate, setFRate] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fDate, setFDate] = useState(new Date().toLocaleDateString('fa-IR'));

  // Modals
  const [showFromCur, setShowFromCur] = useState(false);
  const [showToCur, setShowToCur] = useState(false);
  const [showPartnerPick, setShowPartnerPick] = useState(false);
  const [custModal, setCustModal] = useState(false);
  const [partnerModal, setPartnerModal] = useState(false);
  const [custForm, setCustForm] = useState<any>({ name: '', phone: '', bank: '', holder_name: '', holder_code: '', notes: '' });
  const [partnerForm, setPartnerForm] = useState<any>({ name: '', phone: '', notes: '' });
  const [custEditId, setCustEditId] = useState<string | null>(null);
  const [partnerEditId, setPartnerEditId] = useState<string | null>(null);

  // ═══ Clock ═══
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  const reload = useCallback(async () => {
    try {
      const [t, c, p] = await Promise.all([getFxTrades(), getFxCustomers(), getFxPartners()]);
      setTrades(t); setCustomers(c); setPartners(p);
    } catch {}
  }, []);

  useEffect(() => { (async () => { await reload(); setLoad(false); })(); }, [reload]);

  // ═══ Dashboard stats ═══
  const dash = (() => {
    let totalBuy = 0, totalSell = 0, totalProfit = 0;
    const pos: Record<string, number> = {};
    Object.keys(CUR).forEach(k => pos[k] = 0);
    trades.forEach((t: any) => {
      const fq = Number(t.from_qty) || 0;
      const tq = Number(t.to_qty) || 0;
      const pf = Number(t.profit) || 0;
      totalProfit += pf;
      if (t.from_currency === 'AFN') totalBuy += fq;
      if (t.to_currency === 'AFN') totalSell += tq;
      pos[t.from_currency] = (pos[t.from_currency] || 0) - fq;
      pos[t.to_currency] = (pos[t.to_currency] || 0) + tq;
    });
    return { totalBuy, totalSell, totalProfit, pos, count: trades.length };
  })();

  // ═══ جستجوی مشتری ═══
  const lookupCustomer = (phone: string) => {
    const p = String(phone).replace(/[^\d]/g, '');
    if (p.length < 5) return;
    const found = customers.find(c => String(c.phone || '').replace(/[^\d]/g, '') === p);
    if (found) {
      setFCustName(found.name || '');
      setFCustCode(found.code || '');
      if (found.bank) setFBank(found.bank);
      if (found.holder_name) setFHolder(found.holder_name);
      showToast('✅ مشتری قبلی: ' + found.name);
    } else if (p.length === 11) {
      setFCustCode('');
      showToast('🆕 مشتری جدید — هنگام ثبت، کد ساخته می‌شود');
    }
  };

  // ═══ محاسبه ═══
  const recalc = (field: 'from' | 'rate' | 'to', val: string) => {
    const fq = field === 'from' ? parse(val) : parse(fFromQty);
    const tq = field === 'to' ? parse(val) : parse(fToQty);
    const r = field === 'rate' ? parse(val) : parse(fRate);
    if (field === 'rate' && fq > 0 && r > 0) setFToQty(fmt(fq * r, CUR[fTo]?.dec || 2));
    else if (field === 'to' && fq > 0 && tq > 0) setFRate(fmt(tq / fq, 6));
    else if (field === 'from' && r > 0) setFToQty(fmt(fq * r, CUR[fTo]?.dec || 2));
  };

  // ═══ محاسبه سود ═══
  const calcProfit = (): number => {
    // سود = (مقدار فروش AFN - مقدار خرید AFN) برای این معامله
    const fq = parse(fFromQty), tq = parse(fToQty);
    if (fFrom === 'AFN' && fTo !== 'AFN') return 0; // خرید — سود فوری نداره
    if (fTo === 'AFN' && fFrom !== 'AFN') {
      // فروش — سود نسبت به میانگین خرید همون ارز
      const avgBuyRate = (() => {
        let sum = 0, qty = 0;
        trades.forEach(t => {
          if (t.from_currency === 'AFN' && t.to_currency === fFrom) {
            sum += Number(t.from_qty) || 0;
            qty += Number(t.to_qty) || 0;
          }
        });
        return qty > 0 ? sum / qty : 0;
      })();
      if (avgBuyRate > 0) return tq - (fq * avgBuyRate);
    }
    return 0;
  };

  // ═══ ثبت معامله ═══
  const submit = async () => {
    if (!fPartner) return showToast('شریک را انتخاب کن', true);
    if (!fPhone || fPhone.length < 10) return showToast('شماره تماس الزامی', true);
    if (!fCustName) return showToast('نام مشتری الزامی', true);
    const fq = parse(fFromQty), tq = parse(fToQty), r = parse(fRate);
    if (fq <= 0 || tq <= 0) return showToast('مقدارها را وارد کن', true);
    if (fFrom === fTo) return showToast('ارزها یکسانند', true);

    const partner = partners.find(p => p.code === fPartner);
    const partnerName = partner?.name || '';

    // مشتری: اگه جدید بود بساز
    let custCode = fCustCode;
    if (!custCode) {
      const newC = await createFxCustomer({ name: fCustName, phone: fPhone, bank: fBank, holder_name: fHolder });
      custCode = newC.code;
    } else {
      const existing = customers.find(c => c.code === custCode);
      if (existing) {
        await updateFxCustomer(existing.local_id || existing.id, { bank: fBank, holder_name: fHolder });
      }
    }

    const profit = calcProfit();

    const data: any = {
      invoice_number: fInvoice,
      trade_type: fType,
      partner_code: fPartner, partner_name: partnerName,
      customer_code: custCode, customer_name: fCustName, customer_phone: fPhone,
      bank: fBank, holder_name: fHolder, holder_code: fHolder || '',
      from_currency: fFrom, to_currency: fTo,
      from_qty: fq, to_qty: tq,
      rate: r || (fq > 0 ? tq / fq : 0),
      profit: profit,
      description: fDesc, date: fDate,
    };

    if (editId) {
      await updateFxTrade(editId, data);
      showToast('✅ ویرایش شد');
    } else {
      await createFxTrade(data);
      showToast('✅ ثبت شد');
    }
    await reload();
    resetForm();
    setSub('list');
  };

  const resetForm = () => {
    setEditId(null); setFInvoice(''); setFType('buy');
    setFPartner(''); setFPhone(''); setFCustName(''); setFCustCode('');
    setFBank(''); setFHolder(''); setFFrom('AFN'); setFTo('USD');
    setFFromQty(''); setFToQty(''); setFRate(''); setFDesc('');
    setFDate(new Date().toLocaleDateString('fa-IR'));
  };

  const openNew = () => {
    resetForm();
    setFInvoice(genInvoiceNumber(trades));
    setSub('form');
  };

  const openEdit = (t: any) => {
    setEditId(t.local_id || t.id);
    setFInvoice(t.invoice_number || '');
    setFType(t.trade_type || 'buy');
    setFPartner(t.partner_code || '');
    setFPhone(t.customer_phone || '');
    setFCustName(t.customer_name || '');
    setFCustCode(t.customer_code || '');
    setFBank(t.bank || '');
    setFHolder(t.holder_name || '');
    setFFrom(t.from_currency || 'AFN');
    setFTo(t.to_currency || 'USD');
    setFFromQty(String(t.from_qty || ''));
    setFToQty(String(t.to_qty || ''));
    setFRate(String(t.rate || ''));
    setFDesc(t.description || '');
    setFDate(t.date || '');
    setSub('form');
  };

  const submitCustomer = async () => {
    if (!custForm.name || !custForm.phone) return showToast('نام و تلفن الزامی', true);
    if (custEditId) { await updateFxCustomer(custEditId, custForm); showToast('✅ ویرایش شد'); }
    else { await createFxCustomer(custForm); showToast('✅ ثبت شد'); }
    await reload();
    setCustModal(false); setCustEditId(null);
    setCustForm({ name: '', phone: '', bank: '', holder_name: '', holder_code: '', notes: '' });
  };

  const submitPartner = async () => {
    if (!partnerForm.name) return showToast('نام الزامی', true);
    if (partnerEditId) { await updateFxPartner(partnerEditId, partnerForm); showToast('✅ ویرایش شد'); }
    else { await createFxPartner(partnerForm); showToast('✅ ثبت شد'); }
    await reload();
    setPartnerModal(false); setPartnerEditId(null);
    setPartnerForm({ name: '', phone: '', notes: '' });
  };

  if (load) return <View style={s.center}><ActivityIndicator color="#d4af37" /></View>;

  const timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.page} contentContainerStyle={{ padding: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* ═══════ DASHBOARD ═══════ */}
        <View style={s.dash}>
          {/* ساعت و تاریخ */}
          <View style={s.clockRow}>
            <Text style={s.time}>{timeStr}</Text>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text style={s.dateSmall}>{fDate}</Text>
              <Text style={s.dateSub}>📅 امروز</Text>
            </View>
          </View>

          {/* سود */}
          <View style={s.profitBox}>
            <Text style={s.profitLbl}>💰 سود خالص صرافی</Text>
            <Text style={[s.profitVal, {
              color: dash.totalProfit < 0 ? '#ff3355' : dash.totalProfit === 0 ? '#fbbf24' : '#00ff88',
              textShadowColor: dash.totalProfit < 0 ? '#ff3355' : dash.totalProfit === 0 ? '#fbbf24' : '#00ff88',
            }]}>
              {fmt(dash.totalProfit, 0)}
            </Text>
            <Text style={s.profitUnit}>AFN</Text>
          </View>

          {/* آمار */}
          <View style={s.grid}>
            <View style={s.dItem}>
              <Text style={s.dLbl}>📥 کل خرید AFN</Text>
              <Text style={[s.dVal, { color: '#fb923c', textShadowColor: '#fb923c' }]} numberOfLines={1}>{fmt(dash.totalBuy, 0)}</Text>
            </View>
            <View style={s.dItem}>
              <Text style={s.dLbl}>📤 کل فروش AFN</Text>
              <Text style={[s.dVal, { color: '#34d399', textShadowColor: '#34d399' }]} numberOfLines={1}>{fmt(dash.totalSell, 0)}</Text>
            </View>
            <View style={s.dItem}>
              <Text style={s.dLbl}>📋 معاملات</Text>
              <Text style={[s.dVal, { color: '#60a5fa', textShadowColor: '#60a5fa' }]}>{fmt(dash.count, 0)}</Text>
            </View>
          </View>

          {/* پوزیشن‌های اصلی */}
          <View style={s.posRow}>
            {MAIN_CURS.map(c => {
              const q = dash.pos[c] || 0;
              const col = q > 0 ? '#00ff88' : q < 0 ? '#ff3355' : '#64748b';
              return (
                <View key={c} style={s.posBox}>
                  <Text style={s.posFlag}>{CUR[c].flag}</Text>
                  <Text style={s.posCode}>{c}</Text>
                  <Text style={[s.posVal, { color: col, textShadowColor: col }]}>{q > 0 ? '+' : ''}{fmt(q, CUR[c].dec)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ═══════ زیرتب‌ها ═══════ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.subsBar} contentContainerStyle={s.subsCont}>
          {[
            { k: 'list', l: '📋 لیست معاملات' },
            { k: 'form', l: '➕ معامله جدید' },
            { k: 'customers', l: '👥 مشتریان' },
            { k: 'partners', l: '💼 شرکا' },
          ].map(x => (
            <TouchableOpacity key={x.k} onPress={() => { if (x.k === 'form' && sub !== 'form') { openNew(); return; } setSub(x.k as any); }} style={[s.sub, sub === x.k && s.subActive]}>
              <Text style={[s.subTxt, sub === x.k && s.subTxtActive]}>{x.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ═══════ لیست (جدول ردیفی) ═══════ */}
        {sub === 'list' && (
          <View>
            <Text style={s.secT}>📄 لیست معاملات ({trades.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Header */}
                <View style={s.tblHeader}>
                  <Text style={[s.th, { width: 36 }]}>#</Text>
                  <Text style={[s.th, { width: 100 }]}>فاکتور</Text>
                  <Text style={[s.th, { width: 85 }]}>تاریخ</Text>
                  <Text style={[s.th, { width: 100 }]}>شریک</Text>
                  <Text style={[s.th, { width: 130 }]}>مشتری</Text>
                  <Text style={[s.th, { width: 100 }]}>تلفن</Text>
                  <Text style={[s.th, { width: 90 }]}>از</Text>
                  <Text style={[s.th, { width: 100 }]}>به</Text>
                  <Text style={[s.th, { width: 90 }]}>نرخ</Text>
                  <Text style={[s.th, { width: 100 }]}>سود</Text>
                  <Text style={[s.th, { width: 100 }]}>عملیات</Text>
                </View>
                {/* Rows */}
                {trades.length === 0 ? (
                  <View style={{ padding: 30, alignItems: 'center' }}><Text style={s.empty}>هنوز معامله‌ای ثبت نشده</Text></View>
                ) : trades.map((t: any, i: number) => {
                  const profitCol = (Number(t.profit) || 0) > 0 ? '#00ff88' : (Number(t.profit) || 0) < 0 ? '#ff3355' : '#64748b';
                  return (
                    <View key={t.local_id || t.id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#0a1628' }]}>
                      <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                      <Text style={[s.td, { width: 100, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{t.invoice_number || '—'}</Text>
                      <Text style={[s.td, { width: 85, color: '#94a3b8', fontSize: 10 }]}>{t.date || '—'}</Text>
                      <Text style={[s.td, { width: 100, color: '#e2e8f0' }]}>{t.partner_name || '—'}</Text>
                      <Text style={[s.td, { width: 130, color: '#ffffff', fontWeight: 'bold' }]}>{t.customer_name || '—'}</Text>
                      <Text style={[s.td, { width: 100, color: '#94a3b8', fontSize: 10 }]}>{t.customer_phone || '—'}</Text>
                      <Text style={[s.td, { width: 90, color: '#fb923c' }]}>{CUR[t.from_currency]?.flag}{fmt(t.from_qty, CUR[t.from_currency]?.dec)}</Text>
                      <Text style={[s.td, { width: 100, color: '#34d399' }]}>{CUR[t.to_currency]?.flag}{fmt(t.to_qty, CUR[t.to_currency]?.dec)}</Text>
                      <Text style={[s.td, { width: 90, color: '#fbbf24', fontSize: 10 }]}>{fmt(t.rate, 4)}</Text>
                      <Text style={[s.td, { width: 100, color: profitCol, fontWeight: 'bold' }]}>{fmt(t.profit, 0)}</Text>
                      <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                        <TouchableOpacity onPress={() => openEdit(t)} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                        <TouchableOpacity onPress={async () => { await deleteFxTrade(t.local_id || t.id); await reload(); showToast('🗑 حذف شد'); }} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ═══════ فرم ═══════ */}
        {sub === 'form' && (
          <View style={s.formCard}>
            <Text style={s.formTitle}>{editId ? '✏️ ویرایش معامله' : '➕ معامله جدید'}</Text>

            <Text style={s.lbl}>🧾 شماره فاکتور</Text>
            <TextInput style={s.inp} value={fInvoice} onChangeText={setFInvoice} editable={!editId} />

            <Text style={s.lbl}>📅 تاریخ</Text>
            <TextInput style={s.inp} value={fDate} onChangeText={setFDate} />

            <Text style={s.lbl}>💼 شریک معامله‌کننده *</Text>
            <TouchableOpacity style={s.inp} onPress={() => setShowPartnerPick(true)}>
              <Text style={{ color: fPartner ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {fPartner ? (partners.find(p => p.code === fPartner)?.name + ' (' + fPartner + ')') : 'انتخاب شریک...'}
              </Text>
            </TouchableOpacity>

            <Text style={s.lbl}>📞 شماره تماس مشتری *</Text>
            <TextInput style={s.inp} value={fPhone} onChangeText={v => { const d = v.replace(/[^\d]/g, '').slice(0, 11); setFPhone(d); if (d.length === 11) lookupCustomer(d); }} keyboardType="phone-pad" maxLength={11} placeholder="09..." />

            <Text style={s.lbl}>👤 نام مشتری * {fCustCode ? <Text style={s.badge}>{fCustCode}</Text> : null}</Text>
            <TextInput style={s.inp} value={fCustName} onChangeText={setFCustName} placeholder="نام و نام خانوادگی" />

            <Text style={s.lbl}>🏦 بانک</Text>
            <TextInput style={s.inp} value={fBank} onChangeText={setFBank} />

            <Text style={s.lbl}>👤 صاحب حساب</Text>
            <TextInput style={s.inp} value={fHolder} onChangeText={setFHolder} />

            {/* نوع معامله */}
            <Text style={s.lbl}>🔀 نوع معامله</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity onPress={() => { setFType('buy'); setFFrom('AFN'); setFTo('USD'); }} style={[s.typeBtn, fType === 'buy' && s.typeBtnBuy]}>
                <Text style={[s.typeBtnTxt, fType === 'buy' && { color: '#fff' }]}>📥 خرید ارز</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setFType('sell'); setFFrom('USD'); setFTo('AFN'); }} style={[s.typeBtn, fType === 'sell' && s.typeBtnSell]}>
                <Text style={[s.typeBtnTxt, fType === 'sell' && { color: '#fff' }]}>📤 فروش ارز</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.lbl}>📤 از ارز (می‌دهم) *</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={s.curPick} onPress={() => setShowFromCur(true)}>
                <Text style={s.curPickTxt}>{CUR[fFrom]?.flag} {fFrom}</Text>
              </TouchableOpacity>
              <TextInput style={[s.inp, { flex: 1 }]} value={fFromQty} onChangeText={v => { setFFromQty(v); recalc('from', v); }} keyboardType="numeric" placeholder="مقدار" />
            </View>

            <Text style={s.lbl}>💹 نرخ تبدیل</Text>
            <TextInput style={s.inp} value={fRate} onChangeText={v => { setFRate(v); recalc('rate', v); }} keyboardType="numeric" placeholder="مثلاً 70500" />

            <Text style={s.lbl}>📥 به ارز (می‌گیرم) *</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={s.curPick} onPress={() => setShowToCur(true)}>
                <Text style={s.curPickTxt}>{CUR[fTo]?.flag} {fTo}</Text>
              </TouchableOpacity>
              <TextInput style={[s.inp, { flex: 1 }]} value={fToQty} onChangeText={v => { setFToQty(v); recalc('to', v); }} keyboardType="numeric" placeholder="مقدار" />
            </View>

            <Text style={s.lbl}>📝 توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 60, textAlignVertical: 'top' }]} value={fDesc} onChangeText={setFDesc} multiline />

            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => { resetForm(); setSub('list'); }}>
                <Text style={s.btnTxt}>↩️ برگشت</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submit}>
                <Text style={s.btnTxt}>{editId ? '💾 ذخیره' : '✅ ثبت معامله'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════ مشتریان ═══════ */}
        {sub === 'customers' && (
          <View>
            <View style={s.headRow}>
              <Text style={s.secT}>👥 مشتریان ({customers.length})</Text>
              <TouchableOpacity style={s.addSmBtn} onPress={() => { setCustEditId(null); setCustForm({ name: '', phone: '', bank: '', holder_name: '', holder_code: '', notes: '' }); setCustModal(true); }}>
                <Text style={s.addSmBtnTxt}>➕ جدید</Text>
              </TouchableOpacity>
            </View>
            {customers.map((c: any) => (
              <View key={c.local_id || c.id} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>{c.name}</Text>
                  <Text style={s.badge}>{c.code}</Text>
                </View>
                <Text style={s.cardSub}>📞 {c.phone || '—'}  |  🏦 {c.bank || '—'}</Text>
                {c.holder_name ? <Text style={s.cardSub}>👤 {c.holder_name}</Text> : null}
                <View style={s.actions}>
                  <TouchableOpacity style={s.smBtn} onPress={() => { setCustEditId(c.local_id || c.id); setCustForm({ name: c.name, phone: c.phone, bank: c.bank || '', holder_name: c.holder_name || '', holder_code: c.holder_code || '', notes: c.notes || '' }); setCustModal(true); }}><Text style={s.smBtnTxt}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#fee2e2' }]} onPress={async () => { await deleteFxCustomer(c.local_id || c.id); await reload(); showToast('🗑'); }}><Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══════ شرکا ═══════ */}
        {sub === 'partners' && (
          <View>
            <View style={s.headRow}>
              <Text style={s.secT}>💼 شرکا ({partners.length})</Text>
              <TouchableOpacity style={s.addSmBtn} onPress={() => { setPartnerEditId(null); setPartnerForm({ name: '', phone: '', notes: '' }); setPartnerModal(true); }}>
                <Text style={s.addSmBtnTxt}>➕ جدید</Text>
              </TouchableOpacity>
            </View>
            {partners.map((p: any) => (
              <View key={p.local_id || p.id} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>{p.name}</Text>
                  <Text style={s.badge}>{p.code}</Text>
                </View>
                <Text style={s.cardSub}>📞 {p.phone || '—'}</Text>
                <View style={s.actions}>
                  <TouchableOpacity style={s.smBtn} onPress={() => { setPartnerEditId(p.local_id || p.id); setPartnerForm({ name: p.name, phone: p.phone || '', notes: p.notes || '' }); setPartnerModal(true); }}><Text style={s.smBtnTxt}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#fee2e2' }]} onPress={async () => { await deleteFxPartner(p.local_id || p.id); await reload(); showToast('🗑'); }}><Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ═══ Modals ═══ */}
      {/* ارز مبدأ */}
      <Modal visible={showFromCur} transparent animationType="fade">
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>📤 ارز مبدأ</Text><TouchableOpacity onPress={() => setShowFromCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400, padding: 12 }}>
            {Object.keys(CUR).map(k => (
              <TouchableOpacity key={k} style={s.pickRow} onPress={() => { setFFrom(k); setShowFromCur(false); }}>
                <Text style={s.pickName}>{CUR[k].flag} {CUR[k].name}</Text><Text style={s.badge}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* ارز مقصد */}
      <Modal visible={showToCur} transparent animationType="fade">
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>📥 ارز مقصد</Text><TouchableOpacity onPress={() => setShowToCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400, padding: 12 }}>
            {Object.keys(CUR).map(k => (
              <TouchableOpacity key={k} style={s.pickRow} onPress={() => { setFTo(k); setShowToCur(false); }}>
                <Text style={s.pickName}>{CUR[k].flag} {CUR[k].name}</Text><Text style={s.badge}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* انتخاب شریک */}
      <Modal visible={showPartnerPick} transparent animationType="fade">
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>💼 انتخاب شریک</Text><TouchableOpacity onPress={() => setShowPartnerPick(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400, padding: 12 }}>
            {partners.length === 0 ? <Text style={s.empty}>هنوز شریکی نیست</Text> : partners.map((p: any) => (
              <TouchableOpacity key={p.code} style={s.pickRow} onPress={() => { setFPartner(p.code); setShowPartnerPick(false); }}>
                <Text style={s.pickName}>{p.name}</Text><Text style={s.badge}>{p.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* مشتری */}
      <Modal visible={custModal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={s.mHead}><Text style={s.mTitle}>{custEditId ? '✏️ ویرایش' : '➕ مشتری جدید'}</Text><TouchableOpacity onPress={() => setCustModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={s.lbl}>نام *</Text><TextInput style={s.inp} value={custForm.name} onChangeText={v => setCustForm({ ...custForm, name: v })} />
            <Text style={s.lbl}>تلفن *</Text><TextInput style={s.inp} value={custForm.phone} onChangeText={v => setCustForm({ ...custForm, phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} />
            <Text style={s.lbl}>بانک</Text><TextInput style={s.inp} value={custForm.bank} onChangeText={v => setCustForm({ ...custForm, bank: v })} />
            <Text style={s.lbl}>صاحب حساب</Text><TextInput style={s.inp} value={custForm.holder_name} onChangeText={v => setCustForm({ ...custForm, holder_name: v })} />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setCustModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitCustomer}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>

      {/* شریک */}
      <Modal visible={partnerModal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={s.mHead}><Text style={s.mTitle}>{partnerEditId ? '✏️ ویرایش' : '➕ شریک جدید'}</Text><TouchableOpacity onPress={() => setPartnerModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={s.lbl}>نام *</Text><TextInput style={s.inp} value={partnerForm.name} onChangeText={v => setPartnerForm({ ...partnerForm, name: v })} />
            <Text style={s.lbl}>تلفن</Text><TextInput style={s.inp} value={partnerForm.phone} onChangeText={v => setPartnerForm({ ...partnerForm, phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setPartnerModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submitPartner}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}

// ═══ Styles ═══
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Dashboard (دقیقاً مثل DigitalDashboard)
  dash: { backgroundColor: '#080b13', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: '#1f3a5f' },
  clockRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  time: { color: '#00ff88', fontSize: 32, fontWeight: '900', letterSpacing: 4, textShadowColor: '#00ff88', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 },
  dateSmall: { color: '#4ade80', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 },
  dateSub: { color: '#4ade80', fontSize: 10, fontFamily: 'monospace' },
  profitBox: { alignItems: 'center', paddingVertical: 14, marginBottom: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  profitLbl: { color: '#94a3b8', fontSize: 13, marginBottom: 10, fontWeight: 'bold', letterSpacing: 1 },
  profitVal: { fontSize: 42, fontWeight: '900', letterSpacing: 3, lineHeight: 50, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  profitUnit: { color: '#64748b', fontSize: 11, marginTop: 8, letterSpacing: 3 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  dItem: { width: '32%', paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.18)', alignItems: 'center', minHeight: 60, justifyContent: 'center' },
  dLbl: { color: '#94a3b8', fontSize: 9, marginBottom: 6, textAlign: 'center' },
  dVal: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  posRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(0,255,136,0.1)' },
  posBox: { alignItems: 'center', minWidth: 55 },
  posFlag: { fontSize: 20, marginBottom: 2 },
  posCode: { color: '#94a3b8', fontSize: 9, fontFamily: 'monospace', marginBottom: 3 },
  posVal: { fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },

  // زیرتب‌ها
  subsBar: { maxHeight: 50, marginBottom: 10 },
  subsCont: { gap: 6, paddingHorizontal: 2 },
  sub: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  subActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  subTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  subTxtActive: { color: '#fff' },

  secT: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 8 },

  // جدول ردیفی
  tblHeader: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },
  tblRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 6, backgroundColor: '#fff', alignItems: 'center' },
  td: { fontSize: 11, textAlign: 'center', paddingHorizontal: 4, color: '#1a2332' },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },

  // فرم
  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: '#065f46', textAlign: 'center', marginBottom: 12 },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  badge: { fontSize: 10, backgroundColor: '#dbeafe', color: '#1e40af', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold' },
  curPick: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 2, borderColor: '#059669', backgroundColor: '#f0fdf4', minWidth: 100, alignItems: 'center' },
  curPickTxt: { fontSize: 13, fontWeight: 'bold', color: '#065f46' },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center' },
  typeBtnBuy: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  typeBtnSell: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  typeBtnTxt: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 30, fontSize: 12 },

  // کارت‌های مشتری/شریک
  headRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addSmBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addSmBtnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f2438' },
  cardSub: { fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 3 },
  actions: { flexDirection: 'row-reverse', gap: 6, marginTop: 8 },
  smBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#dbeafe' },
  smBtnTxt: { fontSize: 11, color: '#1e40af', fontWeight: 'bold' },

  // Modals
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '90%' },
  mHead: { backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  mTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  pickRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickName: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
});
