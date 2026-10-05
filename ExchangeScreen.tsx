// ExchangeScreen.tsx — صرافی (استاندارد)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import {
  getFxTrades, createFxTrade, updateFxTrade, deleteFxTrade,
  getFxCustomers, createFxCustomer, updateFxCustomer, deleteFxCustomer,
  findFxCustomerByPhone,
} from './lib.fx';

const CUR: Record<string, { name: string; flag: string; dec: number }> = {
  AFN:{name:'افغانی',flag:'🇦🇫',dec:0}, USD:{name:'دالر',flag:'🇺🇸',dec:2},
  EUR:{name:'یورو',flag:'🇪🇺',dec:2}, GBP:{name:'پوند',flag:'🇬🇧',dec:2},
  PKR:{name:'کلدار',flag:'🇵🇰',dec:0}, IRR:{name:'ریال ایران',flag:'🇮🇷',dec:0},
  TOM:{name:'تومان',flag:'🇮🇷',dec:0}, AED:{name:'درهم',flag:'🇦🇪',dec:2},
  SAR:{name:'ریال سعودی',flag:'🇸🇦',dec:2}, TRY:{name:'لیر',flag:'🇹🇷',dec:2},
};
const BANKS = ['ملی','ملت','صادرات','تجارت','سپه','کشاورزی','مسکن','پاسارگاد','پارسیان','سامان','رفاه','اقتصاد نوین','سینا','شهر','آینده','دی','قوامین','صنعت و معدن','کارآفرین','مهر ایران','بلوبانک','رسالت'];
const fmt = (n: any, d = 2) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const parse = (s: any) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function ExchangeScreen({ showToast }: any) {
  const [sub, setSub] = useState<'list' | 'form' | 'customers' | 'buyers' | 'positions'>('list');
  const [trades, setTrades] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [load, setLoad] = useState(true);

  const reload = useCallback(async () => {
    try {
      const all = await getFxCustomers();
      setCustomers(all.filter((x: any) => (x.type || 'customer') === 'customer'));
      setBuyers(all.filter((x: any) => x.type === 'buyer'));
      setTrades(await getFxTrades());
    } catch (e) { console.log(e); }
  }, []);

  useEffect(() => {
    let m = true;
    (async () => { await reload(); if (m) setLoad(false); })();
    const t = setTimeout(() => { if (m) setLoad(false); }, 5000);
    return () => { m = false; clearTimeout(t); };
  }, [reload]);

  if (load) return <View style={s.center}><ActivityIndicator size="large" color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* زیرتب‌ها */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.subsBar} contentContainerStyle={s.subsCont}>
        {[
          { k: 'list', l: '📋 معاملات' },
          { k: 'form', l: '➕ معامله جدید' },
          { k: 'customers', l: '👤 مشتریان' },
          { k: 'buyers', l: '🏢 خریداران' },
          { k: 'positions', l: '📊 پوزیشن' },
        ].map((x: any) => (
          <TouchableOpacity key={x.k} onPress={() => setSub(x.k)} style={[s.sub, sub === x.k && s.subActive]}>
            <Text style={[s.subTxt, sub === x.k && s.subTxtActive]}>{x.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {sub === 'list' && <TradesList trades={trades} reload={reload} showToast={showToast} openForm={() => setSub('form')} />}
        {sub === 'form' && <TradeForm customers={customers} buyers={buyers} reload={reload} showToast={showToast} onDone={() => setSub('list')} />}
        {sub === 'customers' && <PartyList type="customer" list={customers} reload={reload} showToast={showToast} />}
        {sub === 'buyers' && <PartyList type="buyer" list={buyers} reload={reload} showToast={showToast} />}
        {sub === 'positions' && <Positions trades={trades} />}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════
//  LIST
// ══════════════════════════════════════════════════════
function TradesList({ trades, reload, showToast, openForm }: any) {
  const remove = async (id: string) => {
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('حذف شود؟')) return;
    await deleteFxTrade(id);
    await reload();
    showToast('🗑 حذف شد');
  };
  return (
    <View>
      <TouchableOpacity style={s.addBtn} onPress={openForm}>
        <Text style={s.addBtnTxt}>➕ معامله جدید</Text>
      </TouchableOpacity>
      <Text style={s.secT}>📋 معاملات ({trades.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={s.tH}>
            <Text style={[s.th, { width: 36 }]}>#</Text>
            <Text style={[s.th, { width: 130 }]}>فاکتور</Text>
            <Text style={[s.th, { width: 130 }]}>تاریخ/ساعت</Text>
            <Text style={[s.th, { width: 90 }]}>نوع</Text>
            <Text style={[s.th, { width: 130 }]}>خریدار</Text>
            <Text style={[s.th, { width: 130 }]}>مشتری</Text>
            <Text style={[s.th, { width: 100 }]}>از ارز</Text>
            <Text style={[s.th, { width: 100 }]}>به ارز</Text>
            <Text style={[s.th, { width: 90 }]}>نرخ</Text>
            <Text style={[s.th, { width: 100 }]}>سود</Text>
            <Text style={[s.th, { width: 90 }]}>بانک</Text>
            <Text style={[s.th, { width: 90 }]}>عملیات</Text>
          </View>
          {trades.length === 0 ? (
            <View style={{ padding: 30 }}><Text style={s.empty}>هنوز معامله‌ای نیست</Text></View>
          ) : trades.map((t: any, i: number) => (
            <View key={t.local_id || t.id} style={[s.tR, i % 2 === 0 && { backgroundColor: '#fff' }]}>
              <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 130, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{t.invoice_number}</Text>
              <Text style={[s.td, { width: 130, color: '#475569', fontSize: 10 }]}>{t.date} {t.payment_time || ''}</Text>
              <Text style={[s.td, { width: 90, color: t.trade_type === 'buy' ? '#059669' : '#dc2626', fontSize: 11, fontWeight: 'bold' }]}>
                {t.trade_type === 'buy' ? '📥 خرید' : '📤 فروش'}
              </Text>
              <Text style={[s.td, { width: 130, color: '#0f2438', fontSize: 11, textAlign: 'right' }]} numberOfLines={1}>{t.buyer_name || '—'}</Text>
              <Text style={[s.td, { width: 130, color: '#0f2438', fontSize: 11, textAlign: 'right' }]} numberOfLines={1}>{t.customer_name || '—'}</Text>
              <Text style={[s.td, { width: 100, color: '#fb923c', fontSize: 11 }]}>{CUR[t.from_currency]?.flag} {t.from_currency} {fmt(t.from_qty, CUR[t.from_currency]?.dec)}</Text>
              <Text style={[s.td, { width: 100, color: '#34d399', fontSize: 11 }]}>{CUR[t.to_currency]?.flag} {t.to_currency} {fmt(t.to_qty, CUR[t.to_currency]?.dec)}</Text>
              <Text style={[s.td, { width: 90, color: '#fbbf24', fontSize: 11 }]}>{fmt(t.rate, 4)}</Text>
              <Text style={[s.td, { width: 100, color: (Number(t.profit) || 0) > 0 ? '#00ff88' : '#dc2626', fontWeight: 'bold', fontSize: 11 }]}>{fmt(t.profit, 0)}</Text>
              <Text style={[s.td, { width: 90, color: '#475569', fontSize: 10 }]}>{t.bank || '—'}</Text>
              <View style={[s.td, { width: 90, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={() => remove(t.local_id || t.id)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════
//  FORM
// ══════════════════════════════════════════════════════
function TradeForm({ customers, buyers, reload, showToast, onDone }: any) {
  const [form, setForm] = useState<any>({
    trade_type: 'buy',
    buyer_code: '', buyer_name: '', buyer_phone: '',
    customer_code: '', customer_name: '', customer_phone: '',
    from_currency: 'AFN', to_currency: 'USD',
    from_qty: '', to_qty: '', rate: '',
    bank: '', holder_name: '', payment_method: 'cash',
    date: new Date().toLocaleDateString('fa-IR'),
    time_h: pad2(new Date().getHours()), time_m: pad2(new Date().getMinutes()),
    description: '',
  });
  const [showBuyerList, setShowBuyerList] = useState(false);
  const [showCustList, setShowCustList] = useState(false);

  const pickBuyer = (b: any) => {
    setForm({ ...form, buyer_code: b.code, buyer_name: b.name, buyer_phone: b.phone || '', bank: b.bank || form.bank });
    setShowBuyerList(false);
  };
  const pickCustomer = (c: any) => {
    setForm({ ...form, customer_code: c.code, customer_name: c.name, customer_phone: c.phone || '' });
    setShowCustList(false);
  };

  const lookupBuyer = (v: string) => {
    const p = v.replace(/[^\d]/g, '').slice(0, 11);
    setForm((f: any) => ({ ...f, buyer_phone: p }));
    if (p.length === 11) {
      const found = buyers.find((b: any) => String(b.phone || '').replace(/[^\d]/g, '') === p);
      if (found) { setForm((f: any) => ({ ...f, buyer_code: found.code, buyer_name: found.name })); }
    }
  };
  const lookupCustomer = (v: string) => {
    const p = v.replace(/[^\d]/g, '').slice(0, 11);
    setForm((f: any) => ({ ...f, customer_phone: p }));
    if (p.length === 11) {
      const found = customers.find((c: any) => String(c.phone || '').replace(/[^\d]/g, '') === p);
      if (found) { setForm((f: any) => ({ ...f, customer_code: found.code, customer_name: found.name })); }
    }
  };

  const recalc = (field: 'from' | 'rate' | 'to', v: string) => {
    const f = field === 'from' ? parse(v) : parse(form.from_qty);
    const t = field === 'to' ? parse(v) : parse(form.to_qty);
    const r = field === 'rate' ? parse(v) : parse(form.rate);
    if (field === 'rate' && f > 0 && r > 0) setForm((p: any) => ({ ...p, to_qty: fmt(f * r, CUR[p.to_currency]?.dec || 2) }));
    else if (field === 'to' && f > 0 && t > 0) setForm((p: any) => ({ ...p, rate: fmt(t / f, 6) }));
    else if (field === 'from' && r > 0) setForm((p: any) => ({ ...p, to_qty: fmt(f * r, CUR[p.to_currency]?.dec || 2) }));
  };

  const submit = async () => {
    try {
      if (!form.buyer_name && !form.buyer_phone) return showToast('اطلاعات خریدار الزامی', true);
      if (!form.customer_name && !form.customer_phone) return showToast('اطلاعات مشتری الزامی', true);
      const fq = parse(form.from_qty), tq = parse(form.to_qty);
      if (fq <= 0 || tq <= 0) return showToast('مقدارها را وارد کن', true);
      if (form.from_currency === form.to_currency) return showToast('ارزها یکسانند', true);

      // ذخیره/به‌روزرسانی خریدار
      let bCode = form.buyer_code;
      if (form.buyer_phone && form.buyer_name) {
        const ex = buyers.find((b: any) => String(b.phone || '').replace(/[^\d]/g, '') === String(form.buyer_phone).replace(/[^\d]/g, ''));
        if (ex) { bCode = ex.code; await updateFxCustomer(ex.local_id || ex.id, { name: form.buyer_name, bank: form.bank }); }
        else { const n = await createFxCustomer({ type: 'buyer', name: form.buyer_name, phone: form.buyer_phone, bank: form.bank }); bCode = n.code; }
      }

      // ذخیره/به‌روزرسانی مشتری
      let cCode = form.customer_code;
      if (form.customer_phone && form.customer_name) {
        const ex = customers.find((c: any) => String(c.phone || '').replace(/[^\d]/g, '') === String(form.customer_phone).replace(/[^\d]/g, ''));
        if (ex) { cCode = ex.code; await updateFxCustomer(ex.local_id || ex.id, { name: form.customer_name }); }
        else { const n = await createFxCustomer({ type: 'customer', name: form.customer_name, phone: form.customer_phone }); cCode = n.code; }
      }

      const payload = {
        ...form,
        buyer_code: bCode,
        customer_code: cCode,
        from_qty: fq,
        to_qty: tq,
        rate: parse(form.rate) || (fq > 0 ? tq / fq : 0),
        payment_time: (form.time_h || '00') + ':' + (form.time_m || '00'),
        profit: 0,
      };
      await createFxTrade(payload);
      await reload();
      showToast('✅ معامله ثبت شد');
      onDone();
    } catch (e: any) { showToast('❌ ' + (e?.message || ''), true); }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={s.formTitle}>➕ معامله جدید</Text>

      {/* نوع */}
      <View style={s.card}>
        <Text style={s.lbl}>🔀 نوع معامله</Text>
        <View style={s.chips}>
          <TouchableOpacity onPress={() => setForm({ ...form, trade_type: 'buy', from_currency: 'AFN', to_currency: 'USD' })} style={[s.chip, form.trade_type === 'buy' && s.chipActive]}>
            <Text style={[s.chipTxt, form.trade_type === 'buy' && s.chipTxtActive]}>📥 خرید ارز</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setForm({ ...form, trade_type: 'sell', from_currency: 'USD', to_currency: 'AFN' })} style={[s.chip, form.trade_type === 'sell' && s.chipActive]}>
            <Text style={[s.chipTxt, form.trade_type === 'sell' && s.chipTxtActive]}>📤 فروش ارز</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* خریدار */}
      <View style={s.card}>
        <Text style={s.secT}>🏢 اطلاعات خریدار</Text>
        <Text style={s.lbl}>📞 تلفن خریدار</Text>
        <TextInput style={s.inp} value={form.buyer_phone} onChangeText={lookupBuyer} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor="#94a3b8" />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 4 }}>
          <TouchableOpacity style={s.miniBtn} onPress={() => setShowBuyerList(true)}>
            <Text style={s.miniBtnTxt}>📋 انتخاب از لیست</Text>
          </TouchableOpacity>
          {form.buyer_code ? <Text style={s.codeBadge}>{form.buyer_code}</Text> : null}
        </View>
        <Text style={s.lbl}>👤 نام خریدار</Text>
        <TextInput style={s.inp} value={form.buyer_name} onChangeText={v => setForm({ ...form, buyer_name: v })} placeholder="نام خریدار" placeholderTextColor="#94a3b8" />
      </View>

      {/* مشتری */}
      <View style={s.card}>
        <Text style={s.secT}>👤 اطلاعات مشتری</Text>
        <Text style={s.lbl}>📞 تلفن مشتری</Text>
        <TextInput style={s.inp} value={form.customer_phone} onChangeText={lookupCustomer} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor="#94a3b8" />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 4 }}>
          <TouchableOpacity style={s.miniBtn} onPress={() => setShowCustList(true)}>
            <Text style={s.miniBtnTxt}>📋 انتخاب از لیست</Text>
          </TouchableOpacity>
          {form.customer_code ? <Text style={s.codeBadge}>{form.customer_code}</Text> : null}
        </View>
        <Text style={s.lbl}>👤 نام مشتری</Text>
        <TextInput style={s.inp} value={form.customer_name} onChangeText={v => setForm({ ...form, customer_name: v })} placeholder="نام مشتری" placeholderTextColor="#94a3b8" />
      </View>

      {/* ارزها */}
      <View style={s.card}>
        <Text style={s.secT}>💱 مبالغ ارز</Text>
        <Text style={s.lbl}>📤 ارز مبدأ</Text>
        <View style={s.curRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
            <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
              {Object.keys(CUR).map(c => (
                <TouchableOpacity key={c} onPress={() => setForm({ ...form, from_currency: c })} style={[s.curChip, form.from_currency === c && s.curChipActive]}>
                  <Text style={[s.curChipTxt, form.from_currency === c && s.curChipTxtActive]}>{CUR[c].flag} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TextInput style={[s.inp, { marginTop: 6 }]} value={form.from_qty} onChangeText={v => { setForm({ ...form, from_qty: v }); recalc('from', v); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />
        </View>

        <Text style={s.lbl}>💹 نرخ تبدیل</Text>
        <TextInput style={s.inp} value={form.rate} onChangeText={v => { setForm({ ...form, rate: v }); recalc('rate', v); }} keyboardType="numeric" placeholder="مثلاً 70500" placeholderTextColor="#94a3b8" />

        <Text style={s.lbl}>📥 ارز مقصد</Text>
        <View style={s.curRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
            <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
              {Object.keys(CUR).map(c => (
                <TouchableOpacity key={c} onPress={() => setForm({ ...form, to_currency: c })} style={[s.curChip, form.to_currency === c && s.curChipActive]}>
                  <Text style={[s.curChipTxt, form.to_currency === c && s.curChipTxtActive]}>{CUR[c].flag} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TextInput style={[s.inp, { marginTop: 6 }]} value={form.to_qty} onChangeText={v => { setForm({ ...form, to_qty: v }); recalc('to', v); }} keyboardType="numeric" placeholder="مقدار" placeholderTextColor="#94a3b8" />
        </View>
      </View>

      {/* پرداخت */}
      <View style={s.card}>
        <Text style={s.secT}>💳 اطلاعات پرداخت</Text>
        <Text style={s.lbl}>روش پرداخت</Text>
        <View style={s.chips}>
          {[{ k: 'cash', l: '💵 نقدی' }, { k: 'bank', l: '🏦 بانکی' }].map((m: any) => (
            <TouchableOpacity key={m.k} onPress={() => setForm({ ...form, payment_method: m.k })} style={[s.chip, form.payment_method === m.k && s.chipActive]}>
              <Text style={[s.chipTxt, form.payment_method === m.k && s.chipTxtActive]}>{m.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.payment_method === 'bank' && (
          <>
            <Text style={s.lbl}>🏦 بانک</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
              <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                {BANKS.map(b => (
                  <TouchableOpacity key={b} onPress={() => setForm({ ...form, bank: b })} style={[s.curChip, form.bank === b && s.curChipActive]}>
                    <Text style={[s.curChipTxt, form.bank === b && s.curChipTxtActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.lbl}>👤 صاحب حساب</Text>
            <TextInput style={s.inp} value={form.holder_name} onChangeText={v => setForm({ ...form, holder_name: v })} placeholder="نام صاحب حساب" placeholderTextColor="#94a3b8" />
          </>
        )}

        <Text style={s.lbl}>📅 تاریخ پرداخت</Text>
        <View style={s.dateBox}>
          <TextInput style={[s.dateInp, { flex: 2.5 }]} value={form.date} onChangeText={v => setForm({ ...form, date: v })} placeholder="1405/08/15" placeholderTextColor="#94a3b8" />
          <Text style={s.dateSep}>|</Text>
          <TextInput style={[s.dateInp, { flex: 1 }]} value={form.time_h} onChangeText={v => setForm({ ...form, time_h: v.replace(/[^\d]/g, '').slice(0, 2) })} placeholder="HH" maxLength={2} placeholderTextColor="#94a3b8" />
          <Text style={s.dateSep}>:</Text>
          <TextInput style={[s.dateInp, { flex: 1 }]} value={form.time_m} onChangeText={v => setForm({ ...form, time_m: v.replace(/[^\d]/g, '').slice(0, 2) })} placeholder="MM" maxLength={2} placeholderTextColor="#94a3b8" />
        </View>

        <Text style={s.lbl}>📝 توضیحات</Text>
        <TextInput style={[s.inp, { minHeight: 60 }]} value={form.description} onChangeText={v => setForm({ ...form, description: v })} multiline placeholder="اختیاری" placeholderTextColor="#94a3b8" />
      </View>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={submit}>
        <Text style={s.btnTxt}>✅ ثبت معامله</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={onDone}>
        <Text style={s.btnTxt}>↩️ برگشت</Text>
      </TouchableOpacity>

      {/* Modal انتخاب خریدار */}
      <Modal visible={showBuyerList} transparent animationType="fade">
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>🏢 انتخاب خریدار ({buyers.length})</Text><TouchableOpacity onPress={() => setShowBuyerList(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400, padding: 10 }}>
            {buyers.length === 0 ? <Text style={s.empty}>هنوز خریداری نیست — یکی اضافه کن</Text> :
              buyers.map((b: any) => (
                <TouchableOpacity key={b.code} onPress={() => pickBuyer(b)} style={s.pickRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickName}>{b.name}</Text>
                    <Text style={s.pickSub}>📞 {b.phone || '—'} | 🆔 {b.code}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* Modal انتخاب مشتری */}
      <Modal visible={showCustList} transparent animationType="fade">
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#1e3a8a' }]}><Text style={s.mTitle}>👤 انتخاب مشتری ({customers.length})</Text><TouchableOpacity onPress={() => setShowCustList(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400, padding: 10 }}>
            {customers.length === 0 ? <Text style={s.empty}>هنوز مشتری‌ای نیست — یکی اضافه کن</Text> :
              customers.map((c: any) => (
                <TouchableOpacity key={c.code} onPress={() => pickCustomer(c)} style={s.pickRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickName}>{c.name}</Text>
                    <Text style={s.pickSub}>📞 {c.phone || '—'} | 🆔 {c.code}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════
//  PARTY LIST (مشتریان / خریداران)
// ══════════════════════════════════════════════════════
function PartyList({ type, list, reload, showToast }: any) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const title = type === 'buyer' ? '🏢 خریداران' : '👤 مشتریان';

  const openNew = () => {
    setEditId(null);
    setForm({ type, code: '', name: '', phone: '', bank: '', account_number: '', holder_name: '', address: '', note: '' });
    setModal(true);
  };
  const openEdit = (x: any) => { setEditId(x.local_id || x.id); setForm({ ...x }); setModal(true); };

  const submit = async () => {
    try {
      if (!form.name) return showToast('نام الزامی', true);
      if (!form.phone) return showToast('تلفن الزامی', true);
      if (editId) await updateFxCustomer(editId, { ...form });
      else await createFxCustomer({ ...form, type });
      await reload();
      setModal(false);
      showToast(editId ? '✅ ویرایش شد' : '✅ ثبت شد');
    } catch (e: any) { showToast('❌ ' + (e?.message || ''), true); }
  };

  const remove = async (id: string) => {
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('حذف شود؟')) return;
    await deleteFxCustomer(id);
    await reload();
    showToast('🗑 حذف شد');
  };

  return (
    <View>
      <TouchableOpacity style={[s.addBtn, { backgroundColor: type === 'buyer' ? '#059669' : '#1e3a8a' }]} onPress={openNew}>
        <Text style={s.addBtnTxt}>➕ افزودن {type === 'buyer' ? 'خریدار' : 'مشتری'} جدید</Text>
      </TouchableOpacity>
      <Text style={s.secT}>{title} ({list.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={s.tH}>
            <Text style={[s.th, { width: 36 }]}>#</Text>
            <Text style={[s.th, { width: 90 }]}>کد</Text>
            <Text style={[s.th, { width: 180 }]}>نام</Text>
            <Text style={[s.th, { width: 120 }]}>تلفن</Text>
            <Text style={[s.th, { width: 100 }]}>بانک</Text>
            <Text style={[s.th, { width: 120 }]}>حساب</Text>
            <Text style={[s.th, { width: 150 }]}>صاحب حساب</Text>
            <Text style={[s.th, { width: 180 }]}>آدرس</Text>
            <Text style={[s.th, { width: 100 }]}>عملیات</Text>
          </View>
          {list.length === 0 ? <View style={{ padding: 30 }}><Text style={s.empty}>خالی</Text></View> : list.map((x: any, i: number) => (
            <View key={x.local_id || x.id} style={[s.tR, i % 2 === 0 && { backgroundColor: '#fff' }]}>
              <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 90, color: type === 'buyer' ? '#059669' : '#1e3a8a', fontWeight: 'bold', fontSize: 11 }]}>{x.code}</Text>
              <Text style={[s.td, { width: 180, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{x.name}</Text>
              <Text style={[s.td, { width: 120, color: '#475569', fontSize: 11 }]}>{x.phone || '—'}</Text>
              <Text style={[s.td, { width: 100, color: '#475569', fontSize: 11 }]}>{x.bank || '—'}</Text>
              <Text style={[s.td, { width: 120, color: '#475569', fontSize: 10 }]}>{x.account_number || '—'}</Text>
              <Text style={[s.td, { width: 150, color: '#0f2438', fontSize: 10, textAlign: 'right' }]} numberOfLines={1}>{x.holder_name || '—'}</Text>
              <Text style={[s.td, { width: 180, color: '#64748b', fontSize: 10, textAlign: 'right' }]} numberOfLines={1}>{x.address || '—'}</Text>
              <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={() => openEdit(x)} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(x.local_id || x.id)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={[s.mHead, { backgroundColor: type === 'buyer' ? '#059669' : '#1e3a8a' }]}>
            <Text style={s.mTitle}>{editId ? '✏️ ویرایش' : '➕ افزودن'} {type === 'buyer' ? 'خریدار' : 'مشتری'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={s.lbl}>نام *</Text>
            <TextInput style={s.inp} value={form.name || ''} onChangeText={v => setForm({ ...form, name: v })} placeholder="نام کامل" />
            <Text style={s.lbl}>تلفن *</Text>
            <TextInput style={s.inp} value={form.phone || ''} onChangeText={v => setForm({ ...form, phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} placeholder="09..." />
            <Text style={s.lbl}>بانک</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
              <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                {BANKS.map(b => (
                  <TouchableOpacity key={b} onPress={() => setForm({ ...form, bank: b })} style={[s.curChip, form.bank === b && s.curChipActive]}>
                    <Text style={[s.curChipTxt, form.bank === b && s.curChipTxtActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.lbl}>شماره حساب</Text>
            <TextInput style={s.inp} value={form.account_number || ''} onChangeText={v => setForm({ ...form, account_number: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
            <Text style={s.lbl}>صاحب حساب</Text>
            <TextInput style={s.inp} value={form.holder_name || ''} onChangeText={v => setForm({ ...form, holder_name: v })} placeholder="نام صاحب حساب" />
            <Text style={s.lbl}>آدرس</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={form.address || ''} onChangeText={v => setForm({ ...form, address: v })} multiline />
            <Text style={s.lbl}>یادداشت</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={form.note || ''} onChangeText={v => setForm({ ...form, note: v })} multiline />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: type === 'buyer' ? '#059669' : '#1e3a8a', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════
//  POSITIONS
// ══════════════════════════════════════════════════════
function Positions({ trades }: any) {
  const pos: Record<string, number> = {};
  Object.keys(CUR).forEach(c => pos[c] = 0);
  trades.forEach((t: any) => {
    pos[t.from_currency] = (pos[t.from_currency] || 0) - (Number(t.from_qty) || 0);
    pos[t.to_currency] = (pos[t.to_currency] || 0) + (Number(t.to_qty) || 0);
  });
  const rows = Object.entries(pos).filter(([_, v]) => v !== 0);
  return (
    <View>
      <Text style={s.secT}>📊 پوزیشن ارزی ({rows.length})</Text>
      {rows.length === 0 ? <Text style={s.empty}>معامله‌ای ثبت نشده</Text> :
        rows.map(([c, v]: any) => (
          <View key={c} style={s.posCard}>
            <Text style={{ fontSize: 26 }}>{CUR[c].flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.posName}>{CUR[c].name}</Text>
              <Text style={s.posCode}>{c}</Text>
            </View>
            <Text style={[s.posVal, { color: v > 0 ? '#059669' : '#dc2626' }]}>
              {v > 0 ? '+' : ''}{fmt(v, CUR[c].dec)}
            </Text>
          </View>
        ))}
    </View>
  );
}

// ══════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subsBar: { maxHeight: 50, backgroundColor: '#fff' },
  subsCont: { gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  sub: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  subActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  subTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  subTxtActive: { color: '#fff' },
  addBtn: { backgroundColor: '#059669', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: '#065f46', textAlign: 'center', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  secT: { fontSize: 13, fontWeight: 'bold', color: '#065f46', textAlign: 'right', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#d1fae5', paddingBottom: 4 },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 8, marginBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  chipTxt: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  curRow: { marginTop: 4 },
  curChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  curChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  curChipTxt: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
  curChipTxtActive: { color: '#fff' },
  codeBadge: { color: '#7c3aed', fontSize: 11, fontWeight: 'bold', textAlign: 'right', flex: 1 },
  miniBtn: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  miniBtnTxt: { color: '#1e40af', fontSize: 11, fontWeight: 'bold' },
  dateBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: '#f8fafc', borderRadius: 10, padding: 6, borderWidth: 2, borderColor: '#e2e8f0' },
  dateInp: { padding: 8, fontSize: 13, color: '#0f2438', textAlign: 'center', fontFamily: 'monospace' },
  dateSep: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 12 },
  // Table
  tH: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },
  tR: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 6, backgroundColor: '#f8fafc', alignItems: 'center' },
  td: { fontSize: 11, textAlign: 'center', paddingHorizontal: 4, color: '#1a2332' },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  // Modal
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 },
  mBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '95%' },
  mHead: { backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  mTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pickRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickName: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
  pickSub: { fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 2 },
  // Positions
  posCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  posName: { fontSize: 13, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
  posCode: { fontSize: 10, color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' },
  posVal: { fontSize: 15, fontWeight: 'bold', fontFamily: 'monospace' },
});
