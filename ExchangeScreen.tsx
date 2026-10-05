// ExchangeScreen.tsx — صرافی کامل با شریک + مشتری خودکار
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import {
  getFxTrades, createFxTrade, updateFxTrade, deleteFxTrade,
  getFxCustomers, createFxCustomer, updateFxCustomer, deleteFxCustomer,
  getFxPartners, createFxPartner, updateFxPartner, deleteFxPartner,
} from './lib.offline';

const CUR: Record<string, { name: string; flag: string; dec: number }> = {
  AFN:{name:'افغانی',flag:'🇦🇫',dec:0}, USD:{name:'دالر',flag:'🇺🇸',dec:2},
  EUR:{name:'یورو',flag:'🇪🇺',dec:2}, GBP:{name:'پوند',flag:'🇬🇧',dec:2},
  PKR:{name:'کلدار',flag:'🇵🇰',dec:0}, IRR:{name:'ریال ایران',flag:'🇮🇷',dec:0},
  TOM:{name:'تومان',flag:'🇮🇷',dec:0}, AED:{name:'درهم',flag:'🇦🇪',dec:2},
  SAR:{name:'ریال سعودی',flag:'🇸🇦',dec:2}, TRY:{name:'لیر',flag:'🇹🇷',dec:2},
  CNY:{name:'یوان',flag:'🇨🇳',dec:2}, INR:{name:'روپیه هند',flag:'🇮🇳',dec:0},
};
const fmt = (n: number, d = 2) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const parse = (s: any) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;

export default function ExchangeScreen({ showToast }: any) {
  const [sub, setSub] = useState<'new' | 'list' | 'customers' | 'partners' | 'positions'>('new');
  const [trades, setTrades] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [load, setLoad] = useState(true);

  // فرم معامله
  const [editId, setEditId] = useState<string | null>(null);
  const [fPartner, setFPartner] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fCustName, setFCustName] = useState('');
  const [fCustCode, setFCustCode] = useState('');
  const [fBank, setFBank] = useState('');
  const [fHolder, setFHolder] = useState('');
  const [fHolderCode, setFHolderCode] = useState('');
  const [fFrom, setFFrom] = useState('USD');
  const [fTo, setFTo] = useState('AFN');
  const [fFromQty, setFFromQty] = useState('');
  const [fToQty, setFToQty] = useState('');
  const [fRate, setFRate] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fDate, setFDate] = useState(new Date().toLocaleDateString('fa-IR'));
  const [showFromCur, setShowFromCur] = useState(false);
  const [showToCur, setShowToCur] = useState(false);
  const [showPartnerPick, setShowPartnerPick] = useState(false);
  const [custModal, setCustModal] = useState(false);
  const [partnerModal, setPartnerModal] = useState(false);
  const [custForm, setCustForm] = useState<any>({ name: '', phone: '', bank: '', holder_name: '', holder_code: '', notes: '' });
  const [partnerForm, setPartnerForm] = useState<any>({ name: '', phone: '', notes: '' });
  const [custEditId, setCustEditId] = useState<string | null>(null);
  const [partnerEditId, setPartnerEditId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [t, c, p] = await Promise.all([getFxTrades(), getFxCustomers(), getFxPartners()]);
      setTrades(t); setCustomers(c); setPartners(p);
    } catch {}
  };
  useEffect(() => { (async () => { await reload(); setLoad(false); })(); }, []);

  // ════ جستجوی مشتری با تلفن ════
  const lookupCustomer = (phone: string) => {
    const p = String(phone).replace(/[^\d]/g, '');
    if (p.length < 5) return;
    const found = customers.find(c => String(c.phone || '').replace(/[^\d]/g, '') === p);
    if (found) {
      setFCustName(found.name || '');
      setFCustCode(found.code || '');
      if (found.bank) setFBank(found.bank);
      if (found.holder_name) setFHolder(found.holder_name);
      if (found.holder_code) setFHolderCode(found.holder_code);
      showToast('✅ مشتری قبلی: ' + found.name);
    } else if (fCustName && p.length === 11) {
      // مشتری جدید
      setFCustCode('X_?');
      showToast('🆕 مشتری جدید — هنگام ثبت، کد ساخته می‌شود');
    }
  };

  // ════ محاسبه ════
  const recalc = (field: 'from' | 'rate' | 'to', val: string) => {
    const fq = field === 'from' ? parse(val) : parse(fFromQty);
    const tq = field === 'to' ? parse(val) : parse(fToQty);
    const r = field === 'rate' ? parse(val) : parse(fRate);
    if (field === 'rate' && fq > 0 && r > 0) setFToQty(fmt(fq * r, CUR[fTo]?.dec || 2));
    else if (field === 'to' && fq > 0 && tq > 0) setFRate(fmt(tq / fq, 6));
    else if (field === 'from' && r > 0) setFToQty(fmt(fq * r, CUR[fTo]?.dec || 2));
  };

  // ════ ذخیره معامله ════
  const submit = async () => {
    if (!fPartner) return showToast('شریک معامله‌کننده را انتخاب کن', true);
    if (!fPhone || fPhone.length < 10) return showToast('شماره تماس مشتری الزامی', true);
    if (!fCustName) return showToast('نام مشتری الزامی', true);
    const fq = parse(fFromQty), tq = parse(fToQty), r = parse(fRate);
    if (fq <= 0 || tq <= 0) return showToast('مقدارها را وارد کن', true);
    if (fFrom === fTo) return showToast('ارز مبدأ و مقصد یکسان است', true);

    const partner = partners.find(p => p.code === fPartner);
    const partnerName = partner?.name || '';

    // ═══ مشتری: اگه جدید بود، بساز ═══
    let custCode = fCustCode;
    if (!custCode || custCode === 'X_?') {
      const newC = await createFxCustomer({
        name: fCustName, phone: fPhone, bank: fBank,
        holder_name: fHolder, holder_code: fHolderCode,
      });
      custCode = newC.code;
    } else {
      // آپدیت اطلاعات مشتری
      const existing = customers.find(c => c.code === custCode);
      if (existing) {
        await updateFxCustomer(existing.local_id || existing.id, {
          bank: fBank, holder_name: fHolder, holder_code: fHolderCode,
        });
      }
    }

    const tradeData = {
      partner_code: fPartner, partner_name: partnerName,
      customer_code: custCode, customer_name: fCustName, customer_phone: fPhone,
      bank: fBank, holder_name: fHolder, holder_code: fHolderCode,
      from_currency: fFrom, to_currency: fTo,
      from_qty: fq, to_qty: tq, rate: r || (fq > 0 ? tq / fq : 0),
      description: fDesc, date: fDate,
    };

    if (editId) {
      await updateFxTrade(editId, tradeData);
      showToast('✅ معامله ویرایش شد');
    } else {
      await createFxTrade(tradeData);
      showToast('✅ معامله ثبت شد');
    }
    await reload();
    resetForm();
    setSub('list');
  };

  const resetForm = () => {
    setEditId(null); setFPartner(''); setFPhone(''); setFCustName('');
    setFCustCode(''); setFBank(''); setFHolder(''); setFHolderCode('');
    setFFrom('USD'); setFTo('AFN'); setFFromQty(''); setFToQty(''); setFRate('');
    setFDesc(''); setFDate(new Date().toLocaleDateString('fa-IR'));
  };

  const openEdit = (t: any) => {
    setEditId(t.local_id || t.id);
    setFPartner(t.partner_code || '');
    setFPhone(t.customer_phone || '');
    setFCustName(t.customer_name || '');
    setFCustCode(t.customer_code || '');
    setFBank(t.bank || '');
    setFHolder(t.holder_name || '');
    setFHolderCode(t.holder_code || '');
    setFFrom(t.from_currency || 'USD');
    setFTo(t.to_currency || 'AFN');
    setFFromQty(String(t.from_qty || ''));
    setFToQty(String(t.to_qty || ''));
    setFRate(String(t.rate || ''));
    setFDesc(t.description || '');
    setFDate(t.date || '');
    setSub('new');
  };

  const submitCustomer = async () => {
    if (!custForm.name) return showToast('نام مشتری الزامی', true);
    if (!custForm.phone) return showToast('شماره تماس الزامی', true);
    if (custEditId) {
      await updateFxCustomer(custEditId, custForm);
      showToast('✅ ویرایش شد');
    } else {
      await createFxCustomer(custForm);
      showToast('✅ مشتری ثبت شد');
    }
    await reload();
    setCustModal(false);
    setCustEditId(null);
    setCustForm({ name: '', phone: '', bank: '', holder_name: '', holder_code: '', notes: '' });
  };

  const submitPartner = async () => {
    if (!partnerForm.name) return showToast('نام شریک الزامی', true);
    if (partnerEditId) {
      await updateFxPartner(partnerEditId, partnerForm);
      showToast('✅ ویرایش شد');
    } else {
      await createFxPartner(partnerForm);
      showToast('✅ شریک ثبت شد');
    }
    await reload();
    setPartnerModal(false);
    setPartnerEditId(null);
    setPartnerForm({ name: '', phone: '', notes: '' });
  };

  // ════ پوزیشن ارزی ════
  const positions = (() => {
    const p: Record<string, number> = {};
    Object.keys(CUR).forEach(k => p[k] = 0);
    trades.forEach(t => {
      p[t.from_currency] = (p[t.from_currency] || 0) - (Number(t.from_qty) || 0);
      p[t.to_currency] = (p[t.to_currency] || 0) + (Number(t.to_qty) || 0);
    });
    return p;
  })();

  if (load) return <View style={s.center}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1 }}>
      {/* زیرتب‌ها */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.subsBar} contentContainerStyle={s.subsCont}>
        {[
          { k: 'new', l: '➕ معامله جدید' },
          { k: 'list', l: '📋 لیست' },
          { k: 'customers', l: '👥 مشتریان' },
          { k: 'partners', l: '💼 شرکا' },
          { k: 'positions', l: '📊 پوزیشن' },
        ].map(x => (
          <TouchableOpacity key={x.k} onPress={() => setSub(x.k as any)} style={[s.sub, sub === x.k && s.subActive]}>
            <Text style={[s.subTxt, sub === x.k && s.subTxtActive]}>{x.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.page} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* ═══════ فرم معامله ═══════ */}
        {sub === 'new' && (
          <View>
            <Text style={s.title}>{editId ? '✏️ ویرایش معامله' : '💱 معامله جدید'}</Text>

            {/* شریک */}
            <Text style={s.lbl}>💼 شریک معامله‌کننده *</Text>
            <TouchableOpacity style={s.inp} onPress={() => setShowPartnerPick(true)}>
              <Text style={{ color: fPartner ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {fPartner ? (partners.find(p => p.code === fPartner)?.name + ' (' + fPartner + ')') : 'انتخاب شریک...'}
              </Text>
            </TouchableOpacity>

            {/* تلفن مشتری */}
            <Text style={s.lbl}>📞 شماره تماس مشتری *</Text>
            <TextInput
              style={s.inp} value={fPhone}
              onChangeText={v => { const d = v.replace(/[^\d]/g, '').slice(0, 11); setFPhone(d); if (d.length === 11) lookupCustomer(d); }}
              keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor="#94a3b8"
            />

            {/* مشتری */}
            <Text style={s.lbl}>👤 نام مشتری * {fCustCode ? <Text style={s.badge}>{fCustCode}</Text> : null}</Text>
            <TextInput style={s.inp} value={fCustName} onChangeText={setFCustName} placeholder="نام و نام خانوادگی" placeholderTextColor="#94a3b8" />

            {/* بانک + صاحب حساب */}
            <Text style={s.lbl}>🏦 بانک</Text>
            <TextInput style={s.inp} value={fBank} onChangeText={setFBank} placeholder="ملی، ملت، ..." placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>👤 صاحب حساب {fHolderCode ? <Text style={s.badge}>{fHolderCode}</Text> : null}</Text>
            <TextInput style={s.inp} value={fHolder} onChangeText={setFHolder} placeholder="نام صاحب حساب" placeholderTextColor="#94a3b8" />

            {/* ارز مبدأ */}
            <Text style={s.lbl}>📤 ارز مبدأ (می‌دهم) *</Text>
            <View style={s.curRow}>
              <TouchableOpacity style={s.curPick} onPress={() => setShowFromCur(true)}>
                <Text style={s.curPickTxt}>{CUR[fFrom]?.flag} {fFrom}</Text>
              </TouchableOpacity>
              <TextInput style={[s.inp, { flex: 1 }]} value={fFromQty} onChangeText={v => { setFFromQty(v); recalc('from', v); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />
            </View>

            {/* نرخ */}
            <Text style={s.lbl}>💹 نرخ تبدیل</Text>
            <TextInput style={s.inp} value={fRate} onChangeText={v => { setFRate(v); recalc('rate', v); }} keyboardType="numeric" placeholder="مثلاً 70500" placeholderTextColor="#94a3b8" />

            {/* ارز مقصد */}
            <Text style={s.lbl}>📥 ارز مقصد (می‌گیرم) *</Text>
            <View style={s.curRow}>
              <TouchableOpacity style={s.curPick} onPress={() => setShowToCur(true)}>
                <Text style={s.curPickTxt}>{CUR[fTo]?.flag} {fTo}</Text>
              </TouchableOpacity>
              <TextInput style={[s.inp, { flex: 1 }]} value={fToQty} onChangeText={v => { setFToQty(v); recalc('to', v); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />
            </View>

            {/* تاریخ + شرح */}
            <Text style={s.lbl}>📅 تاریخ</Text>
            <TextInput style={s.inp} value={fDate} onChangeText={setFDate} placeholder="1405/08/15" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>📝 توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 60, textAlignVertical: 'top' }]} value={fDesc} onChangeText={setFDesc} multiline placeholder="..." placeholderTextColor="#94a3b8" />

            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={resetForm}>
                <Text style={s.btnTxt}>🔄 پاک کردن</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submit}>
                <Text style={s.btnTxt}>{editId ? '💾 ذخیره تغییرات' : '✅ ثبت معامله'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════ لیست معاملات ═══════ */}
        {sub === 'list' && (
          <View>
            <Text style={s.title}>📋 معاملات ({trades.length})</Text>
            {trades.length === 0 ? <Text style={s.empty}>هنوز معامله‌ای ثبت نشده</Text> : trades.map((t: any) => (
              <View key={t.local_id || t.id} style={s.tradeCard}>
                <View style={s.tradeHead}>
                  <Text style={s.tradeCustName}>{t.customer_name} {t.customer_code ? <Text style={s.badge}>{t.customer_code}</Text> : null}</Text>
                  <Text style={s.tradeDate}>📅 {t.date || (t.created_at || '').slice(0, 10)}</Text>
                </View>
                <Text style={s.tradeLine}>💼 شریک: <Text style={s.bold}>{t.partner_name || '—'}</Text> | 📞 {t.customer_phone || '—'}</Text>
                <View style={s.tradeMoney}>
                  <Text style={s.moneyOut}>{CUR[t.from_currency]?.flag} {fmt(t.from_qty, CUR[t.from_currency]?.dec)} {t.from_currency}</Text>
                  <Text style={s.moneyArrow}>→</Text>
                  <Text style={s.moneyIn}>{CUR[t.to_currency]?.flag} {fmt(t.to_qty, CUR[t.to_currency]?.dec)} {t.to_currency}</Text>
                </View>
                <Text style={s.tradeRate}>💹 نرخ: {fmt(t.rate, 6)}</Text>
                {t.bank ? <Text style={s.tradeSub}>🏦 {t.bank} — {t.holder_name || '—'}</Text> : null}
                <View style={s.tradeActions}>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#dbeafe' }]} onPress={() => openEdit(t)}>
                    <Text style={[s.smBtnTxt, { color: '#1e40af' }]}>✏️ ویرایش</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#fee2e2' }]} onPress={async () => { await deleteFxTrade(t.local_id || t.id); await reload(); showToast('🗑 حذف شد'); }}>
                    <Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑 حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══════ مشتریان ═══════ */}
        {sub === 'customers' && (
          <View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.title}>👥 مشتریان ({customers.length})</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 8 }]} onPress={() => { setCustEditId(null); setCustForm({ name: '', phone: '', bank: '', holder_name: '', holder_code: '', notes: '' }); setCustModal(true); }}>
                <Text style={[s.btnTxt, { fontSize: 11 }]}>➕ جدید</Text>
              </TouchableOpacity>
            </View>
            {customers.length === 0 ? <Text style={s.empty}>هنوز مشتری‌ای ثبت نشده</Text> : customers.map((c: any) => (
              <View key={c.local_id || c.id} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>{c.name}</Text>
                  <Text style={s.badge}>{c.code}</Text>
                </View>
                <Text style={s.cardRow}>📞 {c.phone || '—'}</Text>
                {c.bank ? <Text style={s.cardRow}>🏦 {c.bank} — {c.holder_name || '—'}</Text> : null}
                <View style={s.tradeActions}>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#dbeafe' }]} onPress={() => { setCustEditId(c.local_id || c.id); setCustForm({ name: c.name, phone: c.phone, bank: c.bank || '', holder_name: c.holder_name || '', holder_code: c.holder_code || '', notes: c.notes || '' }); setCustModal(true); }}>
                    <Text style={[s.smBtnTxt, { color: '#1e40af' }]}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#fee2e2' }]} onPress={async () => { await deleteFxCustomer(c.local_id || c.id); await reload(); showToast('🗑 حذف شد'); }}>
                    <Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══════ شرکا ═══════ */}
        {sub === 'partners' && (
          <View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.title}>💼 شرکا ({partners.length})</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8 }]} onPress={() => { setPartnerEditId(null); setPartnerForm({ name: '', phone: '', notes: '' }); setPartnerModal(true); }}>
                <Text style={[s.btnTxt, { fontSize: 11 }]}>➕ جدید</Text>
              </TouchableOpacity>
            </View>
            {partners.length === 0 ? <Text style={s.empty}>هنوز شریکی ثبت نشده</Text> : partners.map((p: any) => (
              <View key={p.local_id || p.id} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardTitle}>{p.name}</Text>
                  <Text style={s.badge}>{p.code}</Text>
                </View>
                <Text style={s.cardRow}>📞 {p.phone || '—'}</Text>
                <View style={s.tradeActions}>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#dbeafe' }]} onPress={() => { setPartnerEditId(p.local_id || p.id); setPartnerForm({ name: p.name, phone: p.phone || '', notes: p.notes || '' }); setPartnerModal(true); }}>
                    <Text style={[s.smBtnTxt, { color: '#1e40af' }]}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smBtn, { backgroundColor: '#fee2e2' }]} onPress={async () => { await deleteFxPartner(p.local_id || p.id); await reload(); showToast('🗑 حذف شد'); }}>
                    <Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══════ پوزیشن ═══════ */}
        {sub === 'positions' && (
          <View>
            <Text style={s.title}>📊 پوزیشن ارزی</Text>
            {Object.keys(CUR).map(code => {
              const q = positions[code] || 0;
              if (q === 0) return null;
              const col = q > 0 ? '#059669' : '#dc2626';
              return (
                <View key={code} style={s.posCard}>
                  <Text style={s.posFlag}>{CUR[code].flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.posName}>{CUR[code].name}</Text>
                    <Text style={s.posCode}>{code}</Text>
                  </View>
                  <Text style={[s.posVal, { color: col }]}>{q > 0 ? '+' : ''}{fmt(q, CUR[code].dec)}</Text>
                </View>
              );
            })}
            {Object.keys(CUR).every(k => (positions[k] || 0) === 0) && <Text style={s.empty}>هنوز معامله‌ای ثبت نشده</Text>}
          </View>
        )}
      </ScrollView>

      {/* ═══ Modal انتخاب شریک ═══ */}
      <Modal visible={showPartnerPick} transparent animationType="fade">
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}><Text style={s.mTitle}>💼 انتخاب شریک</Text><TouchableOpacity onPress={() => setShowPartnerPick(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
            <ScrollView style={{ maxHeight: 400, padding: 12 }}>
              {partners.length === 0 ? <Text style={s.empty}>هنوز شریکی ثبت نشده — از تب 💼 شرکا اضافه کن</Text> : partners.map((p: any) => (
                <TouchableOpacity key={p.code} style={s.pickRow} onPress={() => { setFPartner(p.code); setShowPartnerPick(false); }}>
                  <Text style={s.pickName}>{p.name}</Text>
                  <Text style={s.badge}>{p.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ Modal ارز مبدأ ═══ */}
      <Modal visible={showFromCur} transparent animationType="fade">
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>📤 ارز مبدأ</Text><TouchableOpacity onPress={() => setShowFromCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400, padding: 12 }}>
            {Object.keys(CUR).map(k => (
              <TouchableOpacity key={k} style={s.pickRow} onPress={() => { setFFrom(k); setShowFromCur(false); if (fFromQty && fRate) recalc('rate', fRate); }}>
                <Text style={s.pickName}>{CUR[k].flag} {CUR[k].name}</Text><Text style={s.badge}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ Modal ارز مقصد ═══ */}
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

      {/* ═══ Modal مشتری ═══ */}
      <Modal visible={custModal} transparent animationType="slide">
        <View style={s.mBg}>
          <ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
            <View style={s.mHead}><Text style={s.mTitle}>{custEditId ? '✏️ ویرایش مشتری' : '➕ مشتری جدید'}</Text><TouchableOpacity onPress={() => setCustModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
            <View style={{ padding: 16 }}>
              <Text style={s.lbl}>نام *</Text>
              <TextInput style={s.inp} value={custForm.name} onChangeText={v => setCustForm({ ...custForm, name: v })} />
              <Text style={s.lbl}>تلفن *</Text>
              <TextInput style={s.inp} value={custForm.phone} onChangeText={v => setCustForm({ ...custForm, phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} />
              <Text style={s.lbl}>بانک</Text>
              <TextInput style={s.inp} value={custForm.bank} onChangeText={v => setCustForm({ ...custForm, bank: v })} />
              <Text style={s.lbl}>صاحب حساب</Text>
              <TextInput style={s.inp} value={custForm.holder_name} onChangeText={v => setCustForm({ ...custForm, holder_name: v })} />
              <Text style={s.lbl}>توضیحات</Text>
              <TextInput style={[s.inp, { minHeight: 60 }]} value={custForm.notes} onChangeText={v => setCustForm({ ...custForm, notes: v })} multiline />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setCustModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitCustomer}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ═══ Modal شریک ═══ */}
      <Modal visible={partnerModal} transparent animationType="slide">
        <View style={s.mBg}>
          <ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
            <View style={s.mHead}><Text style={s.mTitle}>{partnerEditId ? '✏️ ویرایش شریک' : '➕ شریک جدید'}</Text><TouchableOpacity onPress={() => setPartnerModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
            <View style={{ padding: 16 }}>
              <Text style={s.lbl}>نام *</Text>
              <TextInput style={s.inp} value={partnerForm.name} onChangeText={v => setPartnerForm({ ...partnerForm, name: v })} />
              <Text style={s.lbl}>تلفن</Text>
              <TextInput style={s.inp} value={partnerForm.phone} onChangeText={v => setPartnerForm({ ...partnerForm, phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} />
              <Text style={s.lbl}>توضیحات</Text>
              <TextInput style={[s.inp, { minHeight: 60 }]} value={partnerForm.notes} onChangeText={v => setPartnerForm({ ...partnerForm, notes: v })} multiline />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setPartnerModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submitPartner}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subsBar: { maxHeight: 50, backgroundColor: '#fff' },
  subsCont: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  sub: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  subActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  subTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  subTxtActive: { color: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#065f46', textAlign: 'right', marginBottom: 12 },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', backgroundColor: '#fff', color: '#0f2438', justifyContent: 'center' },
  badge: { fontSize: 10, backgroundColor: '#dbeafe', color: '#1e40af', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold' },
  curRow: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  curPick: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 2, borderColor: '#059669', backgroundColor: '#f0fdf4', minWidth: 90, alignItems: 'center' },
  curPickTxt: { fontSize: 13, fontWeight: 'bold', color: '#065f46' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 30, fontSize: 12 },
  // کارت معامله
  tradeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRightWidth: 4, borderRightColor: '#059669' },
  tradeHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  tradeCustName: { fontSize: 14, fontWeight: 'bold', color: '#0f2438' },
  tradeDate: { fontSize: 11, color: '#64748b' },
  tradeLine: { fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 6 },
  bold: { fontWeight: 'bold', color: '#0f2438' },
  tradeMoney: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#f0fdf4', paddingVertical: 8, borderRadius: 8, marginBottom: 6 },
  moneyOut: { fontSize: 12, fontWeight: 'bold', color: '#dc2626', fontFamily: 'monospace' },
  moneyArrow: { fontSize: 16, color: '#059669' },
  moneyIn: { fontSize: 12, fontWeight: 'bold', color: '#059669', fontFamily: 'monospace' },
  tradeRate: { fontSize: 11, color: '#d97706', textAlign: 'right', fontWeight: 'bold' },
  tradeSub: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 4 },
  tradeActions: { flexDirection: 'row-reverse', gap: 6, marginTop: 8 },
  smBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  smBtnTxt: { fontSize: 11, fontWeight: 'bold' },
  // کارت عمومی
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f2438' },
  cardRow: { fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 3 },
  // پوزیشن
  posCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  posFlag: { fontSize: 26, marginLeft: 10 },
  posName: { fontSize: 13, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
  posCode: { fontSize: 10, color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' },
  posVal: { fontSize: 15, fontWeight: 'bold', fontFamily: 'monospace' },
  // Modal
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '90%' },
  mHead: { backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  mTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  pickRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickName: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
});
