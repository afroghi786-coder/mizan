// EmployeesScreen.tsx — کارمندان + حضور + حقوق (آفلاین)
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EMP_KEY = '@mizan_employees';
const ATT_KEY = '@mizan_attendance';

export default function EmployeesScreen({ showToast }: any) {
  const [tab, setTab] = useState<'emp' | 'att' | 'sal'>('emp');
  const [emps, setEmps] = useState<any[]>([]);
  const [atts, setAtts] = useState<any[]>([]);
  const [load, setLoad] = useState(true);

  const [empModal, setEmpModal] = useState(false);
  const [empEdit, setEmpEdit] = useState<any>(null);
  const [empForm, setEmpForm] = useState<any>({ code: '', name: '', phone: '', role: '', type: 'ماهانه', amount: '', overtime: '' });

  const [attModal, setAttModal] = useState(false);
  const [attForm, setAttForm] = useState<any>({ date: '', code: '', status: 'حاضر', hours: '8', overtime: '0' });

  const [salEmp, setSalEmp] = useState('');
  const [salFrom, setSalFrom] = useState('');
  const [salTo, setSalTo] = useState('');
  const [salResult, setSalResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await AsyncStorage.getItem(EMP_KEY);
        const a = await AsyncStorage.getItem(ATT_KEY);
        setEmps(e ? JSON.parse(e) : []);
        setAtts(a ? JSON.parse(a) : []);
      } catch {}
      setLoad(false);
    })();
  }, []);

  const saveEmps = async (l: any[]) => { try { await AsyncStorage.setItem(EMP_KEY, JSON.stringify(l)); } catch {} };
  const saveAtts = async (l: any[]) => { try { await AsyncStorage.setItem(ATT_KEY, JSON.stringify(l)); } catch {} };

  // ─── کارمندان ───
  const openNewEmp = () => {
    setEmpEdit(null);
    const max = emps.reduce((m, e) => { const n = parseInt(String(e.code || '').replace(/[^\d]/g, '')) || 0; return n > m ? n : m; }, 0);
    setEmpForm({ code: 'E' + String(max + 1).padStart(3, '0'), name: '', phone: '', role: '', type: 'ماهانه', amount: '', overtime: '' });
    setEmpModal(true);
  };
  const openEditEmp = (e: any) => { setEmpEdit(e); setEmpForm({ ...e }); setEmpModal(true); };

  const submitEmp = async () => {
    if (!empForm.name) return showToast('نام الزامی', true);
    const item = { ...empForm, amount: Number(empForm.amount) || 0, overtime: Number(empForm.overtime) || 0, id: empEdit?.id || Date.now() };
    const newList = empEdit ? emps.map(x => x.id === empEdit.id ? item : x) : [item, ...emps];
    setEmps(newList);
    await saveEmps(newList);
    setEmpModal(false);
    showToast(empEdit ? '✅ ویرایش شد' : '✅ ثبت شد');
  };
  const removeEmp = async (id: number) => {
    const newList = emps.filter(x => x.id !== id);
    setEmps(newList);
    await saveEmps(newList);
    showToast('🗑 حذف شد');
  };

  // ─── حضور ───
  const openNewAtt = () => {
    setAttForm({ date: new Date().toLocaleDateString('fa-IR'), code: emps[0]?.code || '', status: 'حاضر', hours: '8', overtime: '0' });
    setAttModal(true);
  };
  const submitAtt = async () => {
    if (!attForm.code) return showToast('کارمند انتخاب کن', true);
    if (!attForm.date) return showToast('تاریخ الزامی', true);
    const emp = emps.find(e => e.code === attForm.code);
    const item = { ...attForm, empName: emp?.name || '', hours: Number(attForm.hours) || 0, overtime: Number(attForm.overtime) || 0, id: Date.now() };
    const newList = [item, ...atts];
    setAtts(newList);
    await saveAtts(newList);
    setAttModal(false);
    showToast('✅ ثبت شد');
  };
  const removeAtt = async (id: number) => {
    const newList = atts.filter(x => x.id !== id);
    setAtts(newList);
    await saveAtts(newList);
    showToast('🗑 حذف شد');
  };

  // ─── محاسبه حقوق ───
  const calcSalary = () => {
    if (!salEmp) return showToast('کارمند انتخاب کن', true);
    const emp = emps.find(e => e.code === salEmp);
    if (!emp) return showToast('کارمند یافت نشد', true);
    const filtered = atts.filter(a => a.code === salEmp);
    const present = filtered.filter(a => a.status === 'حاضر').length;
    const absent = filtered.filter(a => a.status === 'غایب').length;
    const totalHours = filtered.reduce((s, a) => s + (a.hours || 0), 0);
    const totalOT = filtered.reduce((s, a) => s + (a.overtime || 0), 0);
    let base = 0;
    if (emp.type === 'ماهانه') base = Math.round((emp.amount / 30) * present);
    else if (emp.type === 'روزانه') base = emp.amount * present;
    else if (emp.type === 'ساعتی') base = emp.amount * totalHours;
    const otAmount = totalOT * (emp.overtime || 0);
    setSalResult({ emp, present, absent, totalHours, totalOT, base, otAmount, total: base + otAmount });
  };

  if (load) return <View style={s.center}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Text style={s.title}>💼 کارمندان و حقوق</Text>

      {/* تب‌ها */}
      <View style={s.tabsRow}>
        <TouchableOpacity style={[s.tab, tab === 'emp' && s.tabActive]} onPress={() => setTab('emp')}><Text style={[s.tabTxt, tab === 'emp' && s.tabTxtActive]}>👥 کارمندان</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'att' && s.tabActive]} onPress={() => setTab('att')}><Text style={[s.tabTxt, tab === 'att' && s.tabTxtActive]}>📅 حضور</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'sal' && s.tabActive]} onPress={() => setTab('sal')}><Text style={[s.tabTxt, tab === 'sal' && s.tabTxtActive]}>💰 حقوق</Text></TouchableOpacity>
      </View>

      {/* کارمندان */}
      {tab === 'emp' && (
        <>
          <TouchableOpacity style={s.addBtn} onPress={openNewEmp}><Text style={s.addBtnTxt}>➕ کارمند جدید</Text></TouchableOpacity>
          {emps.length === 0 ? <Text style={s.empty}>هنوز کارمندی ثبت نشده</Text> : emps.map((e: any) => (
            <View key={e.id} style={s.card}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                <Text style={s.cardTitle}>{e.name}</Text>
                <Text style={s.codeBadge}>{e.code}</Text>
              </View>
              <Text style={s.cardSub}>📞 {e.phone || '—'} | 🏷️ {e.role || '—'}</Text>
              <Text style={s.cardSub}>💼 {e.type} | 💵 {(e.amount || 0).toLocaleString()}</Text>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
                <TouchableOpacity onPress={() => openEditEmp(e)} style={s.smBtn}><Text style={s.smBtnTxt}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => removeEmp(e.id)} style={[s.smBtn, { backgroundColor: '#fee2e2' }]}><Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* حضور */}
      {tab === 'att' && (
        <>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: '#1e3a8a' }]} onPress={openNewAtt}><Text style={s.addBtnTxt}>➕ ثبت حضور</Text></TouchableOpacity>
          {atts.length === 0 ? <Text style={s.empty}>هنوز حضوری ثبت نشده</Text> : atts.slice(0, 50).map((a: any) => (
            <View key={a.id} style={[s.card, { borderRightColor: a.status === 'حاضر' ? '#059669' : a.status === 'غایب' ? '#dc2626' : '#f59e0b' }]}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                <Text style={s.cardTitle}>{a.empName}</Text>
                <Text style={[s.status, {
                  backgroundColor: a.status === 'حاضر' ? '#d1fae5' : a.status === 'غایب' ? '#fee2e2' : '#fef3c7',
                  color: a.status === 'حاضر' ? '#065f46' : a.status === 'غایب' ? '#991b1b' : '#78350f'
                }]}>{a.status}</Text>
              </View>
              <Text style={s.cardSub}>📅 {a.date} | ⏰ {a.hours} ساعت | ⚡ اضافه: {a.overtime}</Text>
              <TouchableOpacity onPress={() => removeAtt(a.id)} style={[s.smBtn, { backgroundColor: '#fee2e2', marginTop: 6, alignSelf: 'flex-end' }]}><Text style={[s.smBtnTxt, { color: '#dc2626' }]}>🗑</Text></TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* حقوق */}
      {tab === 'sal' && (
        <>
          <View style={s.card}>
            <Text style={s.lbl}>کارمند</Text>
            <View style={s.pickRow}>
              {emps.map(e => (
                <TouchableOpacity key={e.id} onPress={() => setSalEmp(e.code)} style={[s.pick, salEmp === e.code && s.pickActive]}>
                  <Text style={[s.pickTxt, salEmp === e.code && s.pickTxtActive]}>{e.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={calcSalary}><Text style={s.addBtnTxt}>🧮 محاسبه حقوق</Text></TouchableOpacity>
          </View>
          {salResult && (
            <View style={s.card}>
              <Text style={s.cardTitle}>💰 {salResult.emp.name}</Text>
              <Text style={s.cardSub}>✅ حاضر: {salResult.present} روز | ❌ غایب: {salResult.absent}</Text>
              <Text style={s.cardSub}>⏰ ساعت: {salResult.totalHours} | ⚡ اضافه: {salResult.totalOT}</Text>
              <View style={{ marginTop: 10, borderTopWidth: 2, borderTopColor: '#d4af37', paddingTop: 10 }}>
                <View style={s.salRow}><Text style={s.salLbl}>حقوق پایه</Text><Text style={s.salVal}>{salResult.base.toLocaleString()}</Text></View>
                <View style={s.salRow}><Text style={s.salLbl}>اضافه‌کاری</Text><Text style={s.salVal}>{salResult.otAmount.toLocaleString()}</Text></View>
                <View style={[s.salRow, { backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, marginTop: 6 }]}>
                  <Text style={[s.salLbl, { fontWeight: 'bold', fontSize: 14 }]}>🎯 جمع کل</Text>
                  <Text style={[s.salVal, { color: '#059669', fontSize: 16 }]}>{salResult.total.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Modal کارمند */}
      <Modal visible={empModal} transparent animationType="slide">
        <View style={s.modalBg}>
          <ScrollView style={s.modalBox} keyboardShouldPersistTaps="handled">
            <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}>
              <Text style={s.modalTitle}>{empEdit ? '✏️ ویرایش' : '➕ کارمند جدید'}</Text>
              <TouchableOpacity onPress={() => setEmpModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.lbl}>کد</Text>
              <TextInput style={s.inp} value={empForm.code} onChangeText={v => setEmpForm({ ...empForm, code: v })} />
              <Text style={s.lbl}>نام *</Text>
              <TextInput style={s.inp} value={empForm.name} onChangeText={v => setEmpForm({ ...empForm, name: v })} />
              <Text style={s.lbl}>تلفن</Text>
              <TextInput style={s.inp} value={empForm.phone} onChangeText={v => setEmpForm({ ...empForm, phone: v.replace(/[^\d]/g, '') })} keyboardType="phone-pad" maxLength={11} />
              <Text style={s.lbl}>سمت</Text>
              <TextInput style={s.inp} value={empForm.role} onChangeText={v => setEmpForm({ ...empForm, role: v })} placeholder="فروشنده، حسابدار، ..." placeholderTextColor="#94a3b8" />
              <Text style={s.lbl}>نوع قرارداد</Text>
              <View style={s.pickRow}>
                {['ماهانه', 'روزانه', 'ساعتی'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setEmpForm({ ...empForm, type: t })} style={[s.pick, empForm.type === t && s.pickActive]}>
                    <Text style={[s.pickTxt, empForm.type === t && s.pickTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.lbl}>مبلغ قرارداد</Text>
              <TextInput style={s.inp} value={String(empForm.amount)} onChangeText={v => setEmpForm({ ...empForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
              <Text style={s.lbl}>نرخ اضافه‌کاری (ساعتی)</Text>
              <TextInput style={s.inp} value={String(empForm.overtime)} onChangeText={v => setEmpForm({ ...empForm, overtime: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setEmpModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitEmp}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal حضور */}
      <Modal visible={attModal} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <View style={[s.modalHead, { backgroundColor: '#1e3a8a' }]}>
              <Text style={s.modalTitle}>➕ ثبت حضور</Text>
              <TouchableOpacity onPress={() => setAttModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.lbl}>کارمند</Text>
              <View style={s.pickRow}>
                {emps.map(e => (
                  <TouchableOpacity key={e.id} onPress={() => setAttForm({ ...attForm, code: e.code })} style={[s.pick, attForm.code === e.code && s.pickActive]}>
                    <Text style={[s.pickTxt, attForm.code === e.code && s.pickTxtActive]}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.lbl}>تاریخ</Text>
              <TextInput style={s.inp} value={attForm.date} onChangeText={v => setAttForm({ ...attForm, date: v })} />
              <Text style={s.lbl}>وضعیت</Text>
              <View style={s.pickRow}>
                {['حاضر', 'غایب', 'مرخصی'].map(st => (
                  <TouchableOpacity key={st} onPress={() => setAttForm({ ...attForm, status: st })} style={[s.pick, attForm.status === st && s.pickActive]}>
                    <Text style={[s.pickTxt, attForm.status === st && s.pickTxtActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.lbl}>ساعت کار</Text>
              <TextInput style={s.inp} value={String(attForm.hours)} onChangeText={v => setAttForm({ ...attForm, hours: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
              <Text style={s.lbl}>اضافه‌کاری (ساعت)</Text>
              <TextInput style={s.inp} value={String(attForm.overtime)} onChangeText={v => setAttForm({ ...attForm, overtime: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setAttModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#1e3a8a', flex: 2 }]} onPress={submitAtt}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#7c3aed', textAlign: 'center', marginBottom: 12 },
  tabsRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  tabActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  tabTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  tabTxtActive: { color: '#fff' },
  addBtn: { backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 30, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRightWidth: 4, borderRightColor: '#7c3aed' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', flex: 1, textAlign: 'right' },
  codeBadge: { fontSize: 11, backgroundColor: '#ede9fe', color: '#6d28d9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold', fontFamily: 'monospace' },
  cardSub: { fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 4 },
  status: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  smBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#dbeafe' },
  smBtnTxt: { fontSize: 12, color: '#1e40af', fontWeight: 'bold' },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  pickRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  pick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  pickActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  pickTxt: { fontSize: 12, color: '#475569', fontWeight: 'bold' },
  pickTxtActive: { color: '#fff' },
  salRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 4 },
  salLbl: { fontSize: 13, color: '#475569', textAlign: 'right' },
  salVal: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', fontFamily: 'monospace' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '90%' },
  modalHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
