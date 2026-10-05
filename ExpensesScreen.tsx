// ExpensesScreen.tsx — هزینه‌ها (استاندارد بین‌المللی)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { getExpenses, createExpense, updateExpense, deleteExpense } from './lib.exp';

const CATEGORIES = [
  'اجاره', 'برق', 'آب', 'گاز', 'تلفن', 'اینترنت', 'حقوق',
  'حمل و نقل', 'سوخت', 'تعمیرات', 'لوازم اداری', 'تبلیغات',
  'مالیات', 'بیمه', 'خرید تجهیزات', 'سفر', 'پذیرایی', 'متفرقه',
];
const BANKS = ['ملی','ملت','صادرات','تجارت','سپه','کشاورزی','مسکن','پاسارگاد','پارسیان','سامان','رفاه','اقتصاد نوین','سینا','شهر','آینده','دی','قوامین','صنعت و معدن','کارآفرین','مهر ایران','بلوبانک','رسالت'];
const STATUSES = [{ k: 'paid', l: '✅ پرداخت‌شده' }, { k: 'pending', l: '⏳ در انتظار' }];

const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
const parse = (s: any) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;
const pad2 = (n: number) => String(n).padStart(2, '0');
const today = () => new Date().toLocaleDateString('fa-IR');

export default function ExpensesScreen({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [load, setLoad] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [filterCat, setFilterCat] = useState('');
  const [q, setQ] = useState('');

  const reload = useCallback(async () => {
    try { setList(await getExpenses()); } catch (e) { console.log(e); }
    try {
      const { getProducts } = require('./lib.offline');
      const p = await getProducts();
      setProds(p || []);
    } catch {}
  }, []);

  useEffect(() => {
    let m = true;
    (async () => { await reload(); if (m) setLoad(false); })();
    const t = setTimeout(() => { if (m) setLoad(false); }, 5000);
    return () => { m = false; clearTimeout(t); };
  }, [reload]);

  const empty = () => ({
    category: 'متفرقه', title: '', amount: '',
    payment_method: 'cash', bank: '', account_number: '',
    payer_name: '', payer_code: '', receiver_name: '', receiver_code: '',
    payment_date: today(), description: '', status: 'paid',
  });

  const openNew = () => { setEditId(null); setForm(empty()); setModal(true); };
  const openEdit = (e: any) => { setEditId(e.local_id || e.id); setForm({ ...e }); setModal(true); };

  const submit = async () => {
    try {
      if (!form.title) return showToast('عنوان الزامی', true);
      if (!form.amount || parse(form.amount) <= 0) return showToast('مبلغ الزامی', true);
      if (form.payment_method === 'bank' && !form.bank) return showToast('بانک الزامی', true);
      const payload = { ...form, amount: parse(form.amount) };
      if (editId) await updateExpense(editId, payload);
      else await createExpense(payload);
      await reload();
      setModal(false);
      showToast(editId ? '✅ ویرایش شد' : '✅ هزینه ثبت شد');
    } catch (e: any) { showToast('❌ ' + (e?.message || ''), true); }
  };

  const remove = async (id: string) => {
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('حذف شود؟')) return;
    await deleteExpense(id);
    await reload();
    showToast('🗑 حذف شد');
  };

  // ─── فیلتر ───
  const filtered = list.filter((x: any) => {
    if (filterCat && x.category !== filterCat) return false;
    if (q) {
      const h = `${x.invoice_number || ''} ${x.title || ''} ${x.receiver_name || ''} ${x.description || ''}`.toLowerCase();
      if (!h.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  // ─── آمار ───
  const thisMonth = today().slice(0, 7);
  const monthTotal = filtered.filter((x: any) => String(x.payment_date || '').startsWith(thisMonth)).reduce((a: number, x: any) => a + (Number(x.amount) || 0), 0);
  const cashTotal = filtered.filter((x: any) => x.payment_method === 'cash').reduce((a: number, x: any) => a + (Number(x.amount) || 0), 0);
  const bankTotal = filtered.filter((x: any) => x.payment_method === 'bank').reduce((a: number, x: any) => a + (Number(x.amount) || 0), 0);

  // ─── پرداخت‌کننده‌ها از منابع ───
  const payerNames = [...new Set((prods || []).map((p: any) => p.payer_name).filter(Boolean))];

  if (load) return <View style={s.center}><ActivityIndicator size="large" color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* ═══ Dashboard ═══ */}
      <View style={s.dash}>
        <View style={s.dashHead}>
          <Text style={s.dashTitle}>🧾 داشبورد هزینه‌ها</Text>
          <Text style={s.dashDate}>{today()}</Text>
        </View>
        <View style={s.dashRow}>
          <Card l="📊 تعداد" v={filtered.length} c="#60a5fa" />
          <Card l="💰 این ماه" v={fmt(monthTotal)} c="#fbbf24" wide />
        </View>
        <View style={s.dashRow}>
          <Card l="💵 نقدی" v={fmt(cashTotal)} c="#34d399" wide />
          <Card l="🏦 بانکی" v={fmt(bankTotal)} c="#a78bfa" wide />
        </View>
      </View>

      {/* ═══ محتوا ═══ */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={s.addBtn} onPress={openNew}>
          <Text style={s.addBtnTxt}>➕ ثبت هزینه جدید</Text>
        </TouchableOpacity>

        {/* جستجو */}
        <TextInput
          style={s.inp}
          value={q}
          onChangeText={setQ}
          placeholder="🔍 جستجو: عنوان، شماره فاکتور، دریافت‌کننده..."
          placeholderTextColor="#94a3b8"
        />

        {/* فیلتر دسته */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42, marginTop: 8 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
            <TouchableOpacity onPress={() => setFilterCat('')} style={[s.chip, !filterCat && s.chipActive]}>
              <Text style={[s.chipTxt, !filterCat && s.chipTxtActive]}>همه</Text>
            </TouchableOpacity>
            {CATEGORIES.slice(0, 12).map(c => (
              <TouchableOpacity key={c} onPress={() => setFilterCat(c)} style={[s.chip, filterCat === c && s.chipActive]}>
                <Text style={[s.chipTxt, filterCat === c && s.chipTxtActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={s.secT}>📋 لیست هزینه‌ها ({filtered.length})</Text>

        {/* جدول ردیفی */}
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={s.tH}>
              <Text style={[s.th, { width: 36 }]}>#</Text>
              <Text style={[s.th, { width: 130 }]}>شماره سند</Text>
              <Text style={[s.th, { width: 90 }]}>تاریخ</Text>
              <Text style={[s.th, { width: 100 }]}>دسته</Text>
              <Text style={[s.th, { width: 170 }]}>عنوان</Text>
              <Text style={[s.th, { width: 110 }]}>مبلغ</Text>
              <Text style={[s.th, { width: 90 }]}>روش</Text>
              <Text style={[s.th, { width: 100 }]}>بانک</Text>
              <Text style={[s.th, { width: 90 }]}>حساب</Text>
              <Text style={[s.th, { width: 130 }]}>پرداخت‌کننده</Text>
              <Text style={[s.th, { width: 130 }]}>دریافت‌کننده</Text>
              <Text style={[s.th, { width: 140 }]}>توضیحات</Text>
              <Text style={[s.th, { width: 80 }]}>وضعیت</Text>
              <Text style={[s.th, { width: 100 }]}>عملیات</Text>
            </View>
            {filtered.length === 0 ? (
              <View style={{ padding: 30 }}><Text style={s.empty}>هنوز هزینه‌ای ثبت نشده</Text></View>
            ) : filtered.map((x: any, i: number) => (
              <View key={x.local_id || x.id} style={[s.tR, i % 2 === 0 && { backgroundColor: '#fff' }]}>
                <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.td, { width: 130, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{x.invoice_number}</Text>
                <Text style={[s.td, { width: 90, color: '#475569', fontSize: 10 }]}>{x.payment_date || '—'}</Text>
                <View style={[s.td, { width: 100 }]}>
                  <Text style={s.catBadge}>{x.category || 'متفرقه'}</Text>
                </View>
                <Text style={[s.td, { width: 170, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{x.title}</Text>
                <Text style={[s.td, { width: 110, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(x.amount)}</Text>
                <Text style={[s.td, { width: 90, color: '#7c3aed', fontSize: 11 }]}>{x.payment_method === 'cash' ? '💵 نقدی' : '🏦 بانکی'}</Text>
                <Text style={[s.td, { width: 100, color: '#475569', fontSize: 10 }]}>{x.bank || '—'}</Text>
                <Text style={[s.td, { width: 90, color: '#475569', fontSize: 10 }]}>{x.account_number || '—'}</Text>
                <Text style={[s.td, { width: 130, color: '#0f2438', fontSize: 10, textAlign: 'right' }]} numberOfLines={1}>{x.payer_name || '—'}</Text>
                <Text style={[s.td, { width: 130, color: '#0f2438', fontSize: 10, textAlign: 'right' }]} numberOfLines={1}>{x.receiver_name || '—'}</Text>
                <Text style={[s.td, { width: 140, color: '#64748b', fontSize: 10, textAlign: 'right' }]} numberOfLines={1}>{x.description || '—'}</Text>
                <View style={[s.td, { width: 80 }]}>
                  <Text style={[s.badge, x.status === 'paid' ? { backgroundColor: '#d1fae5', color: '#065f46' } : { backgroundColor: '#fef3c7', color: '#78350f' }]}>
                    {x.status === 'paid' ? '✅' : '⏳'}
                  </Text>
                </View>
                <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={() => openEdit(x)} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(x.local_id || x.id)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* ═══ Modal فرم ═══ */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}>
          <ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
            <View style={s.mHead}>
              <Text style={s.mTitle}>{editId ? '✏️ ویرایش هزینه' : '➕ ثبت هزینه جدید'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>

              <Text style={s.section}>📋 اطلاعات هزینه</Text>
              <Text style={s.lbl}>دسته‌بندی</Text>
              <View style={s.chips}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c} onPress={() => setForm({ ...form, category: c })} style={[s.chip, form.category === c && s.chipActive]}>
                    <Text style={[s.chipTxt, form.category === c && s.chipTxtActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.lbl}>عنوان *</Text>
              <TextInput style={s.inp} value={form.title || ''} onChangeText={v => setForm({ ...form, title: v })} placeholder="مثلاً: قبض برق ماه مهر" />

              <Text style={s.lbl}>مبلغ *</Text>
              <TextInput style={s.inp} value={String(form.amount || '')} onChangeText={v => setForm({ ...form, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" />

              <Text style={s.lbl}>توضیحات</Text>
              <TextInput style={[s.inp, { minHeight: 60 }]} value={form.description || ''} onChangeText={v => setForm({ ...form, description: v })} multiline placeholder="اختیاری" />

              <Text style={s.section}>💳 اطلاعات پرداخت</Text>
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
                  <Text style={s.lbl}>بانک</Text>
                  <View style={s.chips}>
                    {BANKS.map(b => (
                      <TouchableOpacity key={b} onPress={() => setForm({ ...form, bank: b })} style={[s.chip, form.bank === b && s.chipActive]}>
                        <Text style={[s.chipTxt, form.bank === b && s.chipTxtActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.lbl}>شماره حساب</Text>
                  <TextInput style={s.inp} value={form.account_number || ''} onChangeText={v => setForm({ ...form, account_number: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="شماره حساب" />
                </>
              )}

              <Text style={s.lbl}>👤 نام پرداخت‌کننده (از منابع)</Text>
              {payerNames.length > 0 ? (
                <View style={s.chips}>
                  {payerNames.slice(0, 20).map((n: any) => (
                    <TouchableOpacity key={n} onPress={() => {
                      const prod = (prods || []).find((p: any) => p.payer_name === n);
                      setForm({ ...form, payer_name: n, payer_code: prod?.supplier_code || '' });
                    }} style={[s.chip, form.payer_name === n && s.chipActive]}>
                      <Text style={[s.chipTxt, form.payer_name === n && s.chipTxtActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TextInput style={s.inp} value={form.payer_name || ''} onChangeText={v => setForm({ ...form, payer_name: v })} placeholder="نام پرداخت‌کننده" />
              {form.payer_code ? <Text style={s.codeBadge}>کد: {form.payer_code}</Text> : null}

              <Text style={s.lbl}>🏢 دریافت‌کننده</Text>
              <TextInput style={s.inp} value={form.receiver_name || ''} onChangeText={v => setForm({ ...form, receiver_name: v })} placeholder="مثلاً: شرکت برق، آقای احمدی" />

              <Text style={s.lbl}>📅 تاریخ و زمان پرداخت</Text>
              <View style={s.dateBox}>
                <TextInput style={[s.dateInp, { flex: 2 }]} value={form.payment_date || ''} onChangeText={v => setForm({ ...form, payment_date: v })} placeholder="1405/08/15" />
                <Text style={s.dateSep}>|</Text>
                <TextInput style={[s.dateInp, { flex: 1, textAlign: 'center' }]} value={form.payment_time_h || ''} onChangeText={v => setForm({ ...form, payment_time_h: v.replace(/[^\d]/g, '').slice(0, 2) })} placeholder="HH" maxLength={2} />
                <Text style={s.dateSep}>:</Text>
                <TextInput style={[s.dateInp, { flex: 1, textAlign: 'center' }]} value={form.payment_time_m || ''} onChangeText={v => setForm({ ...form, payment_time_m: v.replace(/[^\d]/g, '').slice(0, 2) })} placeholder="MM" maxLength={2} />
              </View>

              <Text style={s.section}>📌 وضعیت</Text>
              <View style={s.chips}>
                {STATUSES.map(st => (
                  <TouchableOpacity key={st.k} onPress={() => setForm({ ...form, status: st.k })} style={[s.chip, form.status === st.k && s.chipActive]}>
                    <Text style={[s.chipTxt, form.status === st.k && s.chipTxtActive]}>{st.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 20 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}>
                  <Text style={s.btnTxt}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 2 }]} onPress={submit}>
                  <Text style={s.btnTxt}>💾 ذخیره</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Card({ l, v, c, wide }: any) {
  return (
    <View style={[s.kCard, wide && { flex: 1 }, { borderRightColor: c }]}>
      <Text style={s.kLbl}>{l}</Text>
      <Text style={[s.kVal, { color: c }]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dash: { backgroundColor: '#080b13', padding: 10, margin: 8, marginBottom: 6, borderRadius: 14, borderWidth: 2, borderColor: '#1f3a5f' },
  dashHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,51,85,0.15)' },
  dashTitle: { color: '#f4d47a', fontSize: 13, fontWeight: 'bold' },
  dashDate: { color: '#ff3355', fontSize: 10, fontFamily: 'monospace' },
  dashRow: { flexDirection: 'row-reverse', gap: 4, marginBottom: 5 },
  kCard: { flex: 1, padding: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, borderRightWidth: 3, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  kLbl: { color: '#94a3b8', fontSize: 9, marginBottom: 3, textAlign: 'center' },
  kVal: { fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
  addBtn: { backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  secT: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 8, marginTop: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 12 },
  // جدول
  tH: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },
  tR: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 6, backgroundColor: '#f8fafc', alignItems: 'center' },
  td: { fontSize: 11, textAlign: 'center', paddingHorizontal: 4, color: '#1a2332' },
  catBadge: { fontSize: 9, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#78350f', overflow: 'hidden', textAlign: 'center' },
  badge: { fontSize: 9, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold', overflow: 'hidden' },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  // فرم
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  section: { fontSize: 13, fontWeight: 'bold', color: '#dc2626', textAlign: 'right', marginTop: 16, marginBottom: 8, borderBottomWidth: 2, borderBottomColor: '#fee2e2', paddingBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipTxt: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  codeBadge: { color: '#7c3aed', fontSize: 11, textAlign: 'right', marginTop: 4, fontWeight: 'bold' },
  dateBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', borderRadius: 10, padding: 6, borderWidth: 2, borderColor: '#e2e8f0' },
  dateInp: { padding: 8, fontSize: 13, color: '#0f2438', textAlign: 'center', fontFamily: 'monospace' },
  dateSep: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  // Modal
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 },
  mBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '95%' },
  mHead: { backgroundColor: '#dc2626', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  mTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
