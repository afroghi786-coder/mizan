// ExpensesScreen.tsx — هزینه‌ها (آفلاین)
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { getExpenses, createExpense, deleteExpense } from './lib.offline';

const TYPES = ['حقوق','اجاره','برق','آب','حمل‌ونقل','لوازم','تعمیرات','مالیات','متفرقه'];

export default function ExpensesScreen({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [load, setLoad] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>({ type: 'متفرقه', date: '', title: '', amount: '', bank: '', desc: '' });

  const reload = async () => {
    try { setList(await getExpenses()); } catch {}
  };
  useEffect(() => { (async () => { await reload(); setLoad(false); })(); }, []);

  const openNew = () => {
    setEdit(null);
    setForm({ type: 'متفرقه', date: new Date().toLocaleDateString('fa-IR'), title: '', amount: '', bank: '', desc: '' });
    setModal(true);
  };
  const openEdit = (x: any) => { setEdit(x); setForm({ ...x }); setModal(true); };

  const submit = async () => {
    if (!form.title) return showToast('عنوان الزامی', true);
    if (!form.amount || Number(form.amount) <= 0) return showToast('مبلغ الزامی', true);
    await createExpense({ type: form.type, title: form.title, amount: Number(form.amount), date: form.date, bank: form.bank || '', description: form.desc || '' });
    await reload();
    setModal(false);
    showToast('✅ ثبت شد');
  };

  const remove = async (id: any) => {
    await deleteExpense(String(id));
    await reload();
    showToast('🗑 حذف شد');
  };

  const total = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const thisMonth = list.filter(x => x.date && x.date.includes('/')).reduce((s, x) => s + (Number(x.amount) || 0), 0);

  if (load) return <View style={s.center}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Text style={s.title}>🧾 هزینه‌ها</Text>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statLbl}>📊 تعداد</Text><Text style={s.statVal}>{list.length}</Text></View>
        <View style={[s.stat, { borderRightColor: '#dc2626' }]}><Text style={s.statLbl}>💰 جمع کل</Text><Text style={[s.statVal, { color: '#dc2626' }]}>{total.toLocaleString()}</Text></View>
      </View>

      <TouchableOpacity style={s.addBtn} onPress={openNew}>
        <Text style={s.addBtnTxt}>➕ هزینه جدید</Text>
      </TouchableOpacity>

      <Text style={s.secT}>📋 لیست ({list.length})</Text>
      {list.length === 0 ? (
        <Text style={s.empty}>هنوز هزینه‌ای ثبت نشده</Text>
      ) : list.map((x: any) => (
        <View key={x.local_id || x.id} style={s.card}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={s.cardTitle}>{x.title}</Text>
            <Text style={s.cardAmount}>{(Number(x.amount) || 0).toLocaleString()}</Text>
          </View>
          <View style={s.cardRow}>
            <Text style={s.badge}>{x.type}</Text>
            <Text style={s.cardSub}>📅 {x.date}</Text>
            {x.bank ? <Text style={s.cardSub}>🏦 {x.bank}</Text> : null}
          </View>
          {x.desc ? <Text style={s.cardDesc}>{x.desc}</Text> : null}
          <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
            <TouchableOpacity onPress={() => openEdit({ ...x, id: x.local_id || x.id })} style={s.smBtn}><Text style={s.smBtnTxt}>✏️ ویرایش</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => remove(x.local_id || x.id)} style={[s.smBtn, { backgroundColor: '#fee2e2' }]}><Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑 حذف</Text></TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox} keyboardShouldPersistTaps="handled">
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{edit ? '✏️ ویرایش' : '➕ هزینه جدید'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.lbl}>نوع</Text>
              <View style={s.typesRow}>
                {TYPES.map(t => (
                  <TouchableOpacity key={t} onPress={() => setForm({ ...form, type: t })} style={[s.type, form.type === t && s.typeActive]}>
                    <Text style={[s.typeTxt, form.type === t && s.typeTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.lbl}>عنوان *</Text>
              <TextInput style={s.inp} value={form.title} onChangeText={v => setForm({ ...form, title: v })} placeholder="مثلاً: اجاره مغازه" placeholderTextColor="#94a3b8" />
              <Text style={s.lbl}>مبلغ *</Text>
              <TextInput style={s.inp} value={String(form.amount)} onChangeText={v => setForm({ ...form, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
              <Text style={s.lbl}>تاریخ</Text>
              <TextInput style={s.inp} value={form.date} onChangeText={v => setForm({ ...form, date: v })} placeholder="1405/08/15" placeholderTextColor="#94a3b8" />
              <Text style={s.lbl}>بانک (اختیاری)</Text>
              <TextInput style={s.inp} value={form.bank} onChangeText={v => setForm({ ...form, bank: v })} placeholder="ملی، ملت، ..." placeholderTextColor="#94a3b8" />
              <Text style={s.lbl}>توضیحات (اختیاری)</Text>
              <TextInput style={[s.inp, { height: 70, textAlignVertical: 'top' }]} value={form.desc} onChangeText={v => setForm({ ...form, desc: v })} multiline placeholder="..." placeholderTextColor="#94a3b8" />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
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
  title: { fontSize: 22, fontWeight: 'bold', color: '#dc2626', textAlign: 'center', marginBottom: 12 },
  statsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderRightWidth: 4, borderRightColor: '#f59e0b' },
  statLbl: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  statVal: { fontSize: 16, fontWeight: 'bold', color: '#0f2438' },
  addBtn: { backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  addBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  secT: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', marginBottom: 8, textAlign: 'right' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 30, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRightWidth: 4, borderRightColor: '#dc2626' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', flex: 1, textAlign: 'right' },
  cardAmount: { fontSize: 14, fontWeight: 'bold', color: '#dc2626', fontFamily: 'monospace' },
  cardRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center', marginTop: 4 },
  badge: { fontSize: 10, backgroundColor: '#fef3c7', color: '#78350f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold' },
  cardSub: { fontSize: 11, color: '#64748b' },
  cardDesc: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  smBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#dbeafe' },
  smBtnTxt: { fontSize: 11, color: '#1e40af', fontWeight: 'bold' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '90%' },
  modalHead: { backgroundColor: '#dc2626', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  typesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 },
  type: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  typeActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  typeTxt: { fontSize: 11, color: '#475569' },
  typeTxtActive: { color: '#fff', fontWeight: 'bold' },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
