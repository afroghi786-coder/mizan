// EmployeesScreen.tsx — ماژول استاندارد کارمندان
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getAttendance, createAttendance, updateAttendance, deleteAttendance,
  getSalaryPayments, createSalaryPayment, updateSalaryPayment, deleteSalaryPayment,
  getLoans, createLoan, updateLoan, deleteLoan,
  getLeaves, createLeave, deleteLeave,
  getBatches, createBatch, deleteBatch,
  calcEmployeeSalary, calcTax, calcInsurance, TAX_BRACKETS,
} from './lib.emp';
import { printPayslip, exportBankFile } from './EmpHelpers';

const BANKS = ['ملی','ملت','صادرات','تجارت','سپه','کشاورزی','مسکن','پاسارگاد','پارسیان','سامان','رفاه','اقتصاد نوین','سینا','شهر','آینده','دی','قوامین','صنعت و معدن','کارآفرین','مهر ایران','بلوبانک','رسالت'];
const DEPTS = ['فروش','انبار','حسابداری','مدیریت','تولید','کنترل کیفیت','پشتیبانی','مالی'];
const CONTRACT_TYPES = ['ماهانه','روزانه','ساعتی','پروژه‌ای'];
const EDU_LEVELS = ['زیر دیپلم','دیپلم','فوق دیپلم','کارشناسی','کارشناسی ارشد','دکتری'];
const STATUSES = ['فعال','غیرفعال','مرخصی','اخراجی'];
const ATT_STATUSES = ['حاضر','غایب','مرخصی','ماموریت','تعطیل'];
const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
const parse = (s: any) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;
const today = () => new Date().toLocaleDateString('fa-IR');
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function EmployeesScreen({ showToast }: any) {
  const [tab, setTab] = useState<'emp' | 'att' | 'salary' | 'loans' | 'leaves' | 'payroll'>('emp');
  const [emps, setEmps] = useState<any[]>([]);
  const [atts, setAtts] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [load, setLoad] = useState(true);

  const reload = useCallback(async () => {
    try { setEmps(await getEmployees()); } catch (e) { console.log('emp:', e); }
    try { setAtts(await getAttendance()); } catch (e) { console.log('att:', e); }
    try { setSalaries(await getSalaryPayments()); } catch (e) { console.log('sal:', e); }
    try { setLoans(await getLoans()); } catch (e) { console.log('loan:', e); }
    try { setLeaves(await getLeaves()); } catch (e) { console.log('leave:', e); }
    try { setBatches(await getBatches()); } catch (e) { console.log('batch:', e); }
    try {
      const { getProducts } = require('./lib.offline');
      setProds((await getProducts()) || []);
    } catch (e) { console.log('prods:', e); }
  }, []);

  useEffect(() => { (async () => { await reload(); setLoad(false); })(); }, [reload]);

  if (load) return <View style={s.center}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* Dashboard */}
      <HRDashboard emps={emps} atts={atts} salaries={salaries} loans={loans} leaves={leaves} batches={batches} />

      {/* زیرتب‌ها */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={s.subsBar} contentContainerStyle={s.subsCont}>
        {[
          { k: 'emp', l: '👥 کارمندان' },
          { k: 'att', l: '📅 حضور' },
          { k: 'leaves', l: '🌴 مرخصی' },
          { k: 'payroll', l: '💼 لیست حقوق' },
          { k: 'salary', l: '💰 پرداخت' },
          { k: 'loans', l: '🏦 وام' },
        ].map((x: any) => (
          <TouchableOpacity key={x.k} onPress={() => setTab(x.k)} style={[s.sub, tab === x.k && s.subActive]}>
            <Text style={[s.subTxt, tab === x.k && s.subTxtActive]}>{x.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {tab === 'emp' && <EmpTab {...{ emps, reload, showToast }} />}
        {tab === 'att' && <AttTab {...{ emps, atts, reload, showToast }} />}
        {tab === 'salary' && <SalaryTab {...{ emps, salaries, atts, prods, reload, showToast }} />}
        {tab === 'loans' && <LoansTab {...{ emps, loans, reload, showToast }} />}
        {tab === 'leaves' && <LeavesTab {...{ emps, leaves, reload, showToast }} />}
        {tab === 'payroll' && <PayrollTab {...{ emps, atts, loans, salaries, batches, reload, showToast }} />}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════
//  TAB 1: کارمندان

// ═══════════════════════════════════════════
//  HR Dashboard Pro
// ═══════════════════════════════════════════
function HRDashboard({ emps, atts, salaries, loans, leaves }: any) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('fa-IR');
  const thisMonth = todayStr.slice(0, 7);

  const activeEmps = emps.filter((e: any) => e.status === 'فعال');
  const todayAtts = atts.filter((a: any) => a.date === todayStr);
  const presentToday = todayAtts.filter((a: any) => a.status === 'حاضر').length;
  const absentToday = todayAtts.filter((a: any) => a.status === 'غایب').length;
  const leaveToday = todayAtts.filter((a: any) => a.status === 'مرخصی').length;
  const missionToday = todayAtts.filter((a: any) => a.status === 'ماموریت').length;
  const attendanceRate = activeEmps.length ? Math.round((presentToday / activeEmps.length) * 100) : 0;

  const monthSalaries = salaries.filter((s: any) => String(s.payment_date || '').startsWith(thisMonth) || String(s.month || '') === thisMonth);
  const monthTotal = monthSalaries.reduce((a: number, x: any) => a + (Number(x.net_salary) || Number(x.payment) || 0), 0);
  const monthTax = monthSalaries.reduce((a: number, x: any) => a + (Number(x.tax) || 0), 0);
  const monthInsurance = monthSalaries.reduce((a: number, x: any) => a + (Number(x.employee_insurance) || 0), 0);
  const monthEmployer = monthSalaries.reduce((a: number, x: any) => a + (Number(x.employer_insurance) || 0), 0);
  const totalLoanBalance = loans.filter((l: any) => l.status === 'active').reduce((a: number, x: any) => a + (Number(x.balance) || 0), 0);
  const monthLeaves = leaves.filter((l: any) => String(l.from_date || '').startsWith(thisMonth));

  const deptDist: Record<string, number> = {};
  activeEmps.forEach((e: any) => { const d = e.department || 'سایر'; deptDist[d] = (deptDist[d] || 0) + 1; });
  const maxDept = Math.max(...Object.values(deptDist), 1);

  const last7: { date: string; present: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const ds = d.toLocaleDateString('fa-IR');
    last7.push({ date: ds.slice(5), present: atts.filter((a: any) => a.date === ds && a.status === 'حاضر').length });
  }
  const maxWeek = Math.max(...last7.map(x => x.present), 1);

  const empStats: Record<string, any> = {};
  atts.forEach((a: any) => {
    if (!a.employee_code) return;
    if (!empStats[a.employee_code]) empStats[a.employee_code] = { name: a.employee_name || '—', present: 0, ot: 0 };
    if (a.status === 'حاضر') empStats[a.employee_code].present++;
    empStats[a.employee_code].ot += Number(a.overtime) || 0;
  });
  const top5 = Object.entries(empStats).sort((a: any, b: any) => b[1].present - a[1].present).slice(0, 5);

  const paidCodes = new Set(monthSalaries.map((s: any) => s.employee_code));
  const unpaidCount = activeEmps.filter((e: any) => !paidCodes.has(e.code)).length;

  return (
    <View style={{ backgroundColor: '#080b13', padding: 10, margin: 8, marginBottom: 6, borderRadius: 14, borderWidth: 2, borderColor: '#1f3a5f' }}>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,136,0.15)' }}>
        <Text style={{ color: '#f4d47a', fontSize: 14, fontWeight: 'bold' }}>💼 داشبورد منابع انسانی</Text>
        <Text style={{ color: '#00ff88', fontSize: 10, fontFamily: 'monospace' }}>{todayStr}</Text>
      </View>

      {/* KPI کارمندان */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={[hd.c, { borderRightColor: '#3b82f6' }]}><Text style={hd.l}>👥 کل</Text><Text style={[hd.v, { color: '#60a5fa' }]}>{emps.length}</Text></View>
        <View style={[hd.c, { borderRightColor: '#10b981' }]}><Text style={hd.l}>✅ فعال</Text><Text style={[hd.v, { color: '#34d399' }]}>{activeEmps.length}</Text></View>
        <View style={[hd.c, { borderRightColor: '#f59e0b' }]}><Text style={hd.l}>⏰ مرخصی</Text><Text style={[hd.v, { color: '#fbbf24' }]}>{monthLeaves.length}</Text></View>
        <View style={[hd.c, { borderRightColor: '#8b5cf6' }]}><Text style={hd.l}>🏦 وام</Text><Text style={[hd.v, { color: '#a78bfa' }]}>{loans.filter((l: any) => l.status === 'active').length}</Text></View>
      </View>

      {/* KPI حضور */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={[hd.c, { borderRightColor: '#00ff88' }]}><Text style={hd.l}>✅ حاضر</Text><Text style={[hd.v, { color: '#00ff88' }]}>{presentToday}</Text></View>
        <View style={[hd.c, { borderRightColor: '#dc2626' }]}><Text style={hd.l}>❌ غایب</Text><Text style={[hd.v, { color: '#ff3355' }]}>{absentToday}</Text></View>
        <View style={[hd.c, { borderRightColor: '#fbbf24' }]}><Text style={hd.l}>🌴 مرخصی</Text><Text style={[hd.v, { color: '#fbbf24' }]}>{leaveToday}</Text></View>
        <View style={[hd.c, { borderRightColor: '#a78bfa' }]}><Text style={hd.l}>✈️ ماموریت</Text><Text style={[hd.v, { color: '#a78bfa' }]}>{missionToday}</Text></View>
      </View>

      {/* نرخ حضور */}
      <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: '#94a3b8', fontSize: 10 }}>🎯 نرخ حضور امروز</Text>
          <Text style={{ color: '#00ff88', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }}>{attendanceRate}%</Text>
        </View>
        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ width: attendanceRate + '%', height: 6, backgroundColor: attendanceRate >= 80 ? '#00ff88' : attendanceRate >= 50 ? '#fbbf24' : '#ff3355', borderRadius: 3 }} />
        </View>
      </View>

      {/* مالی */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={[hd.cw, { borderRightColor: '#00ff88' }]}><Text style={hd.l}>💰 کل حقوق ماه</Text><Text style={[hd.vw, { color: '#00ff88' }]} numberOfLines={1}>{fmt(monthTotal)}</Text></View>
        <View style={[hd.cw, { borderRightColor: '#dc2626' }]}><Text style={hd.l}>📊 مالیات</Text><Text style={[hd.vw, { color: '#ff3355' }]} numberOfLines={1}>{fmt(monthTax)}</Text></View>
      </View>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={[hd.cw, { borderRightColor: '#f59e0b' }]}><Text style={hd.l}>🏥 بیمه</Text><Text style={[hd.vw, { color: '#fbbf24' }]} numberOfLines={1}>{fmt(monthInsurance + monthEmployer)}</Text></View>
        <View style={[hd.cw, { borderRightColor: '#8b5cf6' }]}><Text style={hd.l}>🏦 مانده وام</Text><Text style={[hd.vw, { color: '#a78bfa' }]} numberOfLines={1}>{fmt(totalLoanBalance)}</Text></View>
      </View>

      {/* نمودار ۷ روز */}
      <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' }}>
        <Text style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, textAlign: 'right' }}>📊 حضور ۷ روز اخیر</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-around', height: 60, gap: 3 }}>
          {last7.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: '#00ff88', fontSize: 9, marginBottom: 2 }}>{d.present}</Text>
              <View style={{ width: '70%', height: Math.max(3, (d.present / maxWeek) * 45), backgroundColor: 'rgba(0,255,136,0.6)', borderRadius: 2 }} />
              <Text style={{ color: '#64748b', fontSize: 7, marginTop: 3 }}>{d.date}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* توزیع دپارتمان */}
      {Object.keys(deptDist).length > 0 && (
        <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' }}>
          <Text style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, textAlign: 'right' }}>🏢 توزیع دپارتمان‌ها</Text>
          {Object.entries(deptDist).map(([dept, cnt]: any) => (
            <View key={dept} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: '#e2e8f0', fontSize: 9 }}>{dept}</Text>
                <Text style={{ color: '#60a5fa', fontSize: 9, fontFamily: 'monospace' }}>{cnt}</Text>
              </View>
              <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: ((cnt / maxDept) * 100) + '%', height: 4, backgroundColor: '#3b82f6' }} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top 5 */}
      {top5.length > 0 && (
        <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(244,212,122,0.2)' }}>
          <Text style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, textAlign: 'right' }}>🏆 ۵ کارمند برتر</Text>
          {top5.map(([code, s]: any, i: number) => (
            <View key={code} style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: ['#fbbf24','#94a3b8','#a16207','#64748b','#64748b'][i], fontSize: 12, width: 22, fontWeight: 'bold' }}>{i + 1}.</Text>
              <Text style={{ flex: 1, color: '#fff', fontSize: 11, textAlign: 'right' }}>{s.name}</Text>
              <Text style={{ color: '#00ff88', fontSize: 11, fontWeight: 'bold', marginRight: 8 }}>{s.present} روز</Text>
            </View>
          ))}
        </View>
      )}

      {/* هشدارها */}
      {unpaidCount > 0 && (
        <View style={{ backgroundColor: 'rgba(251,146,60,0.15)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(251,146,60,0.4)' }}>
          <Text style={{ color: '#fb923c', fontSize: 10, textAlign: 'right' }}>💰 {unpaidCount} کارمند حقوق این ماه را نگرفته‌اند</Text>
        </View>
      )}
      {todayAtts.length === 0 && activeEmps.length > 0 && (
        <View style={{ backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 8, padding: 8, marginTop: 4, borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)' }}>
          <Text style={{ color: '#a78bfa', fontSize: 10, textAlign: 'right' }}>📅 امروز هیچ حضوری ثبت نشده</Text>
        </View>
      )}
    </View>
  );
}

const hd = StyleSheet.create({
  c: { flex: 1, marginHorizontal: 2, padding: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, borderRightWidth: 3, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  l: { color: '#94a3b8', fontSize: 8, marginBottom: 3, textAlign: 'center' },
  v: { fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  cw: { flex: 1, marginHorizontal: 2, padding: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, borderRightWidth: 3, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  vw: { fontSize: 12, fontWeight: '900', fontFamily: 'monospace' },
});

// ═══════════════════════════════════════════
function EmpTab({ emps, reload, showToast }: any) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const openNew = () => {
    setEditId(null);
    setForm({
      code: '', name: '', father_name: '', national_id: '', phone: '', emergency_phone: '',
      address: '', department: 'فروش', role: '', contract_type: 'ماهانه', start_date: today(),
      end_date: '', amount: '', base_salary: '', housing_allowance: '', food_allowance: '', transport_allowance: '', other_allowance: '', overtime_rate: '', bank: '', account_number: '',
      education: '', insurance_number: '', status: 'فعال', note: '',
    });
    setModal(true);
  };
  const openEdit = (e: any) => { setEditId(e.local_id || e.id); setForm({ ...e }); setModal(true); };

  const submit = async () => {
    try {
      if (!form.name) { alert('⚠️ نام الزامی'); return; }
      if (!form.phone) { alert('⚠️ تلفن الزامی'); return; }
      const payload = { ...form };
      if (editId) await updateEmployee(editId, payload);
      else await createEmployee(payload);
      await reload();
      setModal(false);
      alert('✅ ذخیره شد');
    } catch (e) {
      alert('❌ خطا: ' + (e.message || ''));
    }
  };

  const remove = async (id: string) => {
    if (!(await new Promise(res => { if (typeof window !== 'undefined' && window.confirm) res(window.confirm('حذف شود؟')); else res(true); }))) return;
    await deleteEmployee(id);
    await reload();
    showToast('🗑 حذف شد');
  };

  return (
    <View>
      <TouchableOpacity style={s.addBtn} onPress={openNew}><Text style={s.addBtnTxt}>➕ استخدام کارمند جدید</Text></TouchableOpacity>
      <Text style={s.secT}>📋 لیست کارمندان ({emps.length})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ maxWidth: "100%" }} contentContainerStyle={{ paddingRight: 4 }}>
        <View>
          <View style={[s.tblHeader, { minWidth: 1300 }]}>
            <Text style={[s.th, { width: 40 }]}>#</Text>
            <Text style={[s.th, { width: 80 }]}>کد</Text>
            <Text style={[s.th, { width: 150 }]}>نام و نام خانوادگی</Text>
            <Text style={[s.th, { width: 110 }]}>تلفن</Text>
            <Text style={[s.th, { width: 100 }]}>سمت</Text>
            <Text style={[s.th, { width: 100 }]}>دپارتمان</Text>
            <Text style={[s.th, { width: 90 }]}>قرارداد</Text>
            <Text style={[s.th, { width: 110 }]}>مبلغ</Text>
            <Text style={[s.th, { width: 100 }]}>شروع</Text>
            <Text style={[s.th, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.th, { width: 100 }]}>عملیات</Text>
          </View>
          {emps.length === 0 ? <View style={{ padding: 30 }}><Text style={s.empty}>هنوز کارمندی نیست</Text></View> : emps.map((e: any, i: number) => (
            <View key={e.local_id || e.id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#fff' }]}>
              <Text style={[s.td, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 80, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{e.code}</Text>
              <Text style={[s.td, { width: 150, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]}>{e.name}</Text>
              <Text style={[s.td, { width: 110, color: '#475569', fontSize: 11 }]}>{e.phone || '—'}</Text>
              <Text style={[s.td, { width: 100, color: '#0f2438' }]}>{e.role || '—'}</Text>
              <Text style={[s.td, { width: 100, color: '#475569' }]}>{e.department || '—'}</Text>
              <Text style={[s.td, { width: 90, color: '#7c3aed' }]}>{e.contract_type}</Text>
              <Text style={[s.td, { width: 110, color: '#059669', fontWeight: 'bold' }]}>{fmt(e.amount)}</Text>
              <Text style={[s.td, { width: 100, color: '#64748b', fontSize: 10 }]}>{e.start_date || '—'}</Text>
              <View style={[s.td, { width: 90 }]}>
                <Text style={[s.badge, e.status === 'فعال' && { backgroundColor: '#d1fae5', color: '#065f46' }, e.status === 'اخراجی' && { backgroundColor: '#fee2e2', color: '#991b1b' }]}>{e.status}</Text>
              </View>
              <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={() => openEdit(e)} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(e.local_id || e.id)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal استخدام */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={s.mHead}><Text style={s.mTitle}>{editId ? '✏️ ویرایش کارمند' : '➕ استخدام کارمند'}</Text><TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={s.section}>👤 اطلاعات شخصی</Text>
            <Text style={s.lbl}>نام و نام خانوادگی *</Text>
            <TextInput style={s.inp} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
            <Text style={s.lbl}>نام پدر</Text>
            <TextInput style={s.inp} value={form.father_name} onChangeText={v => setForm({ ...form, father_name: v })} />
            <Text style={s.lbl}>کد ملی</Text>
            <TextInput style={s.inp} value={form.national_id} onChangeText={v => setForm({ ...form, national_id: v.replace(/[^\d]/g, '').slice(0, 10) })} keyboardType="numeric" maxLength={10} />
            <Text style={s.lbl}>تلفن *</Text>
            <TextInput style={s.inp} value={form.phone} onChangeText={v => setForm({ ...form, phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} />
            <Text style={s.lbl}>تلفن اضطراری</Text>
            <TextInput style={s.inp} value={form.emergency_phone} onChangeText={v => setForm({ ...form, emergency_phone: v.replace(/[^\d]/g, '').slice(0, 11) })} keyboardType="phone-pad" maxLength={11} />
            <Text style={s.lbl}>آدرس</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={form.address} onChangeText={v => setForm({ ...form, address: v })} multiline />
            <Text style={s.lbl}>مدرک تحصیلی</Text>
            <View style={s.chips}>
              {EDU_LEVELS.map(x => <TouchableOpacity key={x} onPress={() => setForm({ ...form, education: x })} style={[s.chip, form.education === x && s.chipActive]}><Text style={[s.chipTxt, form.education === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
            </View>

            <Text style={s.section}>💼 اطلاعات شغلی</Text>
            <Text style={s.lbl}>سمت *</Text>
            <TextInput style={s.inp} value={form.role} onChangeText={v => setForm({ ...form, role: v })} placeholder="فروشنده، حسابدار، ..." />
            <Text style={s.lbl}>دپارتمان</Text>
            <View style={s.chips}>
              {DEPTS.map(x => <TouchableOpacity key={x} onPress={() => setForm({ ...form, department: x })} style={[s.chip, form.department === x && s.chipActive]}><Text style={[s.chipTxt, form.department === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>نوع قرارداد</Text>
            <View style={s.chips}>
              {CONTRACT_TYPES.map(x => <TouchableOpacity key={x} onPress={() => setForm({ ...form, contract_type: x })} style={[s.chip, form.contract_type === x && s.chipActive]}><Text style={[s.chipTxt, form.contract_type === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>تاریخ شروع</Text>
            <TextInput style={s.inp} value={form.start_date} onChangeText={v => setForm({ ...form, start_date: v })} placeholder="1405/08/15" />
            <Text style={s.lbl}>حقوق پایه ماهانه</Text>
            <TextInput style={s.inp} value={String(form.base_salary || '')} onChangeText={v => setForm({ ...form, base_salary: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" />
            <Text style={s.lbl}>حق مسکن</Text>
            <TextInput style={s.inp} value={String(form.housing_allowance || '')} onChangeText={v => setForm({ ...form, housing_allowance: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" />
            <Text style={s.lbl}>حق خواربار</Text>
            <TextInput style={s.inp} value={String(form.food_allowance || '')} onChangeText={v => setForm({ ...form, food_allowance: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" />
            <Text style={s.lbl}>حق ایاب و ذهاب</Text>
            <TextInput style={s.inp} value={String(form.transport_allowance || '')} onChangeText={v => setForm({ ...form, transport_allowance: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" />
            <Text style={s.lbl}>سایر مزایا</Text>
            <TextInput style={s.inp} value={String(form.other_allowance || '')} onChangeText={v => setForm({ ...form, other_allowance: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="0" />
            <Text style={s.lbl}>مبلغ قرارداد (کل)</Text>
            <TextInput style={s.inp} value={String(form.amount || '')} onChangeText={v => setForm({ ...form, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
            <Text style={s.lbl}>نرخ اضافه‌کاری (ساعتی)</Text>
            <TextInput style={s.inp} value={String(form.overtime_rate || '')} onChangeText={v => setForm({ ...form, overtime_rate: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />

            <Text style={s.section}>🏦 اطلاعات بانکی</Text>
            <Text style={s.lbl}>بانک کارمند</Text>
            <View style={s.chips}>
              {BANKS.map(x => <TouchableOpacity key={x} onPress={() => setForm({ ...form, bank: x })} style={[s.chip, form.bank === x && s.chipActive]}><Text style={[s.chipTxt, form.bank === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>شماره حساب</Text>
            <TextInput style={s.inp} value={form.account_number} onChangeText={v => setForm({ ...form, account_number: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
            <Text style={s.lbl}>شماره بیمه</Text>
            <TextInput style={s.inp} value={form.insurance_number} onChangeText={v => setForm({ ...form, insurance_number: v })} />

            <Text style={s.section}>📌 وضعیت</Text>
            <View style={s.chips}>
              {STATUSES.map(x => <TouchableOpacity key={x} onPress={() => setForm({ ...form, status: x })} style={[s.chip, form.status === x && s.chipActive]}><Text style={[s.chipTxt, form.status === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>یادداشت</Text>
            <TextInput style={[s.inp, { minHeight: 60 }]} value={form.note} onChangeText={v => setForm({ ...form, note: v })} multiline />

            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 20 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════
//  TAB 2: حضور و غیاب
// ═══════════════════════════════════════════
function AttTab({ emps, atts, reload, showToast }: any) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [filter, setFilter] = useState('');

  const openNew = () => {
    setForm({ employee_code: emps[0]?.code || '', employee_name: emps[0]?.name || '', date: today(), status: 'حاضر', check_in: '08:00', check_out: '17:00', hours: '8', overtime: '0', note: '' });
    setModal(true);
  };

  const submit = async () => {
    if (!form.employee_code) return showToast('کارمند را انتخاب کن', true);
    await createAttendance(form);
    await reload();
    setModal(false);
    showToast('✅ ثبت شد');
  };

  const filtered = filter ? atts.filter((a: any) => a.employee_code === filter) : atts;

  return (
    <View>
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#1e3a8a' }]} onPress={openNew}><Text style={s.addBtnTxt}>➕ ثبت حضور</Text></TouchableOpacity>
      <Text style={s.lbl}>فیلتر کارمند</Text>
      <View style={s.chips}>
        <TouchableOpacity onPress={() => setFilter('')} style={[s.chip, !filter && s.chipActive]}><Text style={[s.chipTxt, !filter && s.chipTxtActive]}>همه</Text></TouchableOpacity>
        {emps.map((e: any) => <TouchableOpacity key={e.code} onPress={() => setFilter(e.code)} style={[s.chip, filter === e.code && s.chipActive]}><Text style={[s.chipTxt, filter === e.code && s.chipTxtActive]}>{e.name}</Text></TouchableOpacity>)}
      </View>

      <Text style={s.secT}>📋 حضور و غیاب ({filtered.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ maxWidth: "100%" }} contentContainerStyle={{ paddingRight: 4 }}>
        <View>
          <View style={[s.tblHeader, { minWidth: 1300 }]}>
            <Text style={[s.th, { width: 40 }]}>#</Text>
            <Text style={[s.th, { width: 100 }]}>تاریخ</Text>
            <Text style={[s.th, { width: 90 }]}>کد</Text>
            <Text style={[s.th, { width: 150 }]}>نام</Text>
            <Text style={[s.th, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.th, { width: 80 }]}>ورود</Text>
            <Text style={[s.th, { width: 80 }]}>خروج</Text>
            <Text style={[s.th, { width: 70 }]}>ساعت</Text>
            <Text style={[s.th, { width: 80 }]}>اضافه</Text>
            <Text style={[s.th, { width: 100 }]}>عملیات</Text>
          </View>
          {filtered.length === 0 ? <View style={{ padding: 30 }}><Text style={s.empty}>حضوری ثبت نشده</Text></View> : filtered.map((a: any, i: number) => {
            const stCol = a.status === 'حاضر' ? '#059669' : a.status === 'غایب' ? '#dc2626' : a.status === 'مرخصی' ? '#f59e0b' : '#64748b';
            return (
              <View key={a.local_id || a.id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#fff' }]}>
                <Text style={[s.td, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.td, { width: 100, color: '#475569', fontSize: 11 }]}>{a.date}</Text>
                <Text style={[s.td, { width: 90, color: '#7c3aed', fontSize: 10, fontWeight: 'bold' }]}>{a.employee_code}</Text>
                <Text style={[s.td, { width: 150, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]}>{a.employee_name}</Text>
                <Text style={[s.td, { width: 90, color: stCol, fontWeight: 'bold' }]}>{a.status}</Text>
                <Text style={[s.td, { width: 80, color: '#475569' }]}>{a.check_in || '—'}</Text>
                <Text style={[s.td, { width: 80, color: '#475569' }]}>{a.check_out || '—'}</Text>
                <Text style={[s.td, { width: 70, color: '#0f2438', fontWeight: 'bold' }]}>{a.hours}</Text>
                <Text style={[s.td, { width: 80, color: '#f59e0b', fontWeight: 'bold' }]}>{a.overtime}</Text>
                <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={async () => { await deleteAttendance(a.local_id || a.id); await reload(); showToast('🗑'); }} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={[s.mHead, { backgroundColor: '#1e3a8a' }]}><Text style={s.mTitle}>➕ ثبت حضور</Text><TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={s.lbl}>کارمند *</Text>
            <View style={s.chips}>
              {emps.map((e: any) => <TouchableOpacity key={e.code} onPress={() => setForm({ ...form, employee_code: e.code, employee_name: e.name })} style={[s.chip, form.employee_code === e.code && s.chipActive]}><Text style={[s.chipTxt, form.employee_code === e.code && s.chipTxtActive]}>{e.name}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>تاریخ</Text>
            <TextInput style={s.inp} value={form.date} onChangeText={v => setForm({ ...form, date: v })} />
            <Text style={s.lbl}>وضعیت</Text>
            <View style={s.chips}>
              {ATT_STATUSES.map(x => <TouchableOpacity key={x} onPress={() => setForm({ ...form, status: x })} style={[s.chip, form.status === x && s.chipActive]}><Text style={[s.chipTxt, form.status === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>ورود</Text><TextInput style={s.inp} value={form.check_in} onChangeText={v => setForm({ ...form, check_in: v })} placeholder="08:00" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>خروج</Text><TextInput style={s.inp} value={form.check_out} onChangeText={v => setForm({ ...form, check_out: v })} placeholder="17:00" /></View>
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>ساعت کار</Text><TextInput style={s.inp} value={String(form.hours)} onChangeText={v => setForm({ ...form, hours: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>اضافه‌کاری</Text><TextInput style={s.inp} value={String(form.overtime)} onChangeText={v => setForm({ ...form, overtime: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" /></View>
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#1e3a8a', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════
//  TAB 3: پرداخت حقوق
// ═══════════════════════════════════════════
function SalaryTab({ emps, salaries, atts, prods, reload, showToast }: any) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [editId, setEditId] = useState<string | null>(null);

  const openNew = () => {
    setEditId(null);
    setForm({
      employee_code: '', employee_name: '',
      month: new Date().toLocaleDateString('fa-IR').slice(0, 7),
      from_date: '', to_date: '',
      base_salary: '0', overtime: '0', bonus: '0', deduction: '0', loan: '0', insurance: '0',
      net_salary: '0', payment: '0', balance: '0',
      payment_method: 'cash', bank: '', payer_name: '', payer_code: '',
      payment_date: today(), description: '', status: 'paid',
    });
    setModal(true);
  };

  const pickEmployee = (e: any) => {
    const newForm = { ...form, employee_code: e.code, employee_name: e.name, bank: e.bank || '' };
    // محاسبه خودکار از حضور
    const month = newForm.month || '';
    const myAtts = atts.filter((a: any) => a.employee_code === e.code);
    const present = myAtts.filter((a: any) => a.status === 'حاضر').length;
    const totalOT = myAtts.reduce((sum: number, a: any) => sum + (Number(a.overtime) || 0), 0);
    let base = 0;
    if (e.contract_type === 'ماهانه') base = Math.round((Number(e.amount) || 0) / 30 * present);
    else if (e.contract_type === 'روزانه') base = (Number(e.amount) || 0) * present;
    else if (e.contract_type === 'ساعتی') {
      const totalH = myAtts.reduce((sum: number, a: any) => sum + (Number(a.hours) || 0), 0);
      base = (Number(e.amount) || 0) * totalH;
    } else base = Number(e.amount) || 0;
    const ot = totalOT * (Number(e.overtime_rate) || 0);
    const gross = base + ot;
    const net = gross - parse(newForm.deduction) - parse(newForm.loan) - parse(newForm.insurance);
    setForm({ ...newForm, base_salary: String(base), overtime: String(ot), net_salary: String(net), payment: String(net), balance: '0' });
  };

  const recalc = (f: any) => {
    const gross = parse(f.base_salary) + parse(f.overtime) + parse(f.bonus);
    const net = gross - parse(f.deduction) - parse(f.loan) - parse(f.insurance);
    const bal = net - parse(f.payment);
    return { ...f, net_salary: String(net), balance: String(bal) };
  };

  const upd = (k: string, v: any) => setForm((prev: any) => recalc({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.employee_code) return showToast('کارمند را انتخاب کن', true);
    const payload: any = {};
    Object.keys(form).forEach(k => {
      if (['base_salary','overtime','bonus','deduction','loan','insurance','net_salary','payment','balance'].includes(k)) payload[k] = parse(form[k]);
      else payload[k] = form[k];
    });
    if (editId) await updateSalaryPayment(editId, payload);
    else await createSalaryPayment(payload);
    await reload();
    setModal(false);
    showToast(editId ? '✅ ویرایش شد' : '✅ حقوق ثبت شد');
  };

  const remove = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('حذف شود؟')) return;
    await deleteSalaryPayment(id);
    await reload();
    showToast('🗑 حذف شد');
  };

  return (
    <View>
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#059669' }]} onPress={openNew}><Text style={s.addBtnTxt}>➕ پرداخت حقوق جدید</Text></TouchableOpacity>
      <Text style={s.secT}>📋 لیست پرداختی‌ها ({salaries.length})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ maxWidth: "100%" }} contentContainerStyle={{ paddingRight: 4 }}>
        <View>
          <View style={[s.tblHeader, { minWidth: 1300 }]}>
            <Text style={[s.th, { width: 40 }]}>#</Text>
            <Text style={[s.th, { width: 130 }]}>شماره فیش</Text>
            <Text style={[s.th, { width: 100 }]}>تاریخ</Text>
            <Text style={[s.th, { width: 150 }]}>کارمند</Text>
            <Text style={[s.th, { width: 90 }]}>ماه</Text>
            <Text style={[s.th, { width: 110 }]}>خالص</Text>
            <Text style={[s.th, { width: 110 }]}>پرداخت</Text>
            <Text style={[s.th, { width: 100 }]}>مانده</Text>
            <Text style={[s.th, { width: 100 }]}>روش</Text>
            <Text style={[s.th, { width: 120 }]}>بانک</Text>
            <Text style={[s.th, { width: 130 }]}>پرداخت‌کننده</Text>
            <Text style={[s.th, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.th, { width: 100 }]}>عملیات</Text>
          </View>
          {salaries.length === 0 ? <View style={{ padding: 30 }}><Text style={s.empty}>هنوز پرداختی نیست</Text></View> : salaries.map((sp: any, i: number) => (
            <View key={sp.local_id || sp.id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#fff' }]}>
              <Text style={[s.td, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 130, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{sp.invoice_number}</Text>
              <Text style={[s.td, { width: 100, color: '#475569', fontSize: 10 }]}>{sp.payment_date}</Text>
              <Text style={[s.td, { width: 150, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]}>{sp.employee_name}</Text>
              <Text style={[s.td, { width: 90, color: '#475569', fontSize: 11 }]}>{sp.month}</Text>
              <Text style={[s.td, { width: 110, color: '#fbbf24', fontWeight: 'bold' }]}>{fmt(sp.net_salary)}</Text>
              <Text style={[s.td, { width: 110, color: '#059669', fontWeight: 'bold' }]}>{fmt(sp.payment)}</Text>
              <Text style={[s.td, { width: 100, color: Number(sp.balance) > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{fmt(sp.balance)}</Text>
              <Text style={[s.td, { width: 100, color: '#7c3aed', fontSize: 11 }]}>{sp.payment_method === 'cash' ? '💵 نقدی' : '🏦 بانک'}</Text>
              <Text style={[s.td, { width: 120, color: '#475569', fontSize: 11 }]}>{sp.bank || '—'}</Text>
              <Text style={[s.td, { width: 130, color: '#0f2438', fontSize: 11, textAlign: 'right' }]}>{sp.payer_name || '—'}</Text>
              <View style={[s.td, { width: 90 }]}>
                <Text style={[s.badge, sp.status === 'paid' && { backgroundColor: '#d1fae5', color: '#065f46' }, sp.status !== 'paid' && { backgroundColor: '#fef3c7', color: '#78350f' }]}>{sp.status === 'paid' ? '✅ پرداخت' : '⏳ در انتظار'}</Text>
              </View>
              <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={() => { setEditId(sp.local_id || sp.id); setForm({ ...sp }); setModal(true); }} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(sp.local_id || sp.id)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal پرداخت حقوق */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={[s.mHead, { backgroundColor: '#059669' }]}><Text style={s.mTitle}>{editId ? '✏️ ویرایش' : '➕ پرداخت حقوق'}</Text><TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>

            <Text style={s.section}>👤 کارمند</Text>
            <View style={s.chips}>
              {emps.map((e: any) => <TouchableOpacity key={e.code} onPress={() => pickEmployee(e)} style={[s.chip, form.employee_code === e.code && s.chipActive]}><Text style={[s.chipTxt, form.employee_code === e.code && s.chipTxtActive]}>{e.name}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>ماه</Text>
            <TextInput style={s.inp} value={form.month} onChangeText={v => upd('month', v)} placeholder="1405/08" />

            <Text style={s.section}>💰 محاسبه حقوق</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>حقوق پایه</Text><TextInput style={s.inp} value={String(form.base_salary)} onChangeText={v => upd('base_salary', v)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>اضافه‌کاری</Text><TextInput style={s.inp} value={String(form.overtime)} onChangeText={v => upd('overtime', v)} keyboardType="numeric" /></View>
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>پاداش</Text><TextInput style={s.inp} value={String(form.bonus)} onChangeText={v => upd('bonus', v)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>کسر کار</Text><TextInput style={s.inp} value={String(form.deduction)} onChangeText={v => upd('deduction', v)} keyboardType="numeric" /></View>
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>وام/مساعده</Text><TextInput style={s.inp} value={String(form.loan)} onChangeText={v => upd('loan', v)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>بیمه</Text><TextInput style={s.inp} value={String(form.insurance)} onChangeText={v => upd('insurance', v)} keyboardType="numeric" /></View>
            </View>
            <View style={[s.summaryBox]}>
              <Text style={s.summaryLbl}>💰 خالص پرداختی</Text>
              <Text style={[s.summaryVal, { color: '#00ff88' }]}>{fmt(form.net_salary)}</Text>
              <Text style={s.summaryLbl}>📌 مانده</Text>
              <Text style={[s.summaryVal, { color: parse(form.balance) > 0 ? '#ff3355' : '#059669' }]}>{fmt(form.balance)}</Text>
            </View>

            <Text style={s.section}>💳 اطلاعات پرداخت</Text>
            <Text style={s.lbl}>روش پرداخت</Text>
            <View style={s.chips}>
              {[{ k: 'cash', l: '💵 نقدی' }, { k: 'bank', l: '🏦 بانک' }].map((x: any) => <TouchableOpacity key={x.k} onPress={() => upd('payment_method', x.k)} style={[s.chip, form.payment_method === x.k && s.chipActive]}><Text style={[s.chipTxt, form.payment_method === x.k && s.chipTxtActive]}>{x.l}</Text></TouchableOpacity>)}
            </View>

            {form.payment_method === 'bank' && (
              <>
                <Text style={s.lbl}>بانک</Text>
                <View style={s.chips}>
                  {BANKS.map(x => <TouchableOpacity key={x} onPress={() => upd('bank', x)} style={[s.chip, form.bank === x && s.chipActive]}><Text style={[s.chipTxt, form.bank === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>)}
                </View>
              </>
            )}

            <Text style={s.lbl}>نام پرداخت‌کننده (از منابع)</Text>
            <View style={s.chips}>
              {[...new Set(prods.map((p: any) => p.payer_name).filter(Boolean))].slice(0, 20).map((x: any) => (
                <TouchableOpacity key={x} onPress={() => {
                  const prod = prods.find((p: any) => p.payer_name === x);
                  upd('payer_name', x);
                  if (prod?.supplier_code) upd('payer_code', prod.supplier_code);
                }} style={[s.chip, form.payer_name === x && s.chipActive]}><Text style={[s.chipTxt, form.payer_name === x && s.chipTxtActive]}>{x}</Text></TouchableOpacity>
              ))}
            </View>
            {form.payer_code ? <Text style={{ color: '#7c3aed', fontSize: 11, textAlign: 'right', marginTop: 4 }}>کد: {form.payer_code}</Text> : null}

            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>مبلغ پرداخت</Text><TextInput style={s.inp} value={String(form.payment)} onChangeText={v => upd('payment', v)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>تاریخ پرداخت</Text><TextInput style={s.inp} value={form.payment_date} onChangeText={v => upd('payment_date', v)} /></View>
            </View>

            <Text style={s.lbl}>وضعیت</Text>
            <View style={s.chips}>
              {[{ k: 'paid', l: '✅ پرداخت‌شده' }, { k: 'pending', l: '⏳ در انتظار' }].map((x: any) => <TouchableOpacity key={x.k} onPress={() => upd('status', x.k)} style={[s.chip, form.status === x.k && s.chipActive]}><Text style={[s.chipTxt, form.status === x.k && s.chipTxtActive]}>{x.l}</Text></TouchableOpacity>)}
            </View>

            <Text style={s.lbl}>توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={form.description} onChangeText={v => upd('description', v)} multiline />

            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 20 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════
//  TAB 4: وام و مساعده
// ═══════════════════════════════════════════
function LoansTab({ emps, loans, reload, showToast }: any) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});

  const openNew = () => {
    setForm({ employee_code: '', employee_name: '', type: 'loan', amount: '', installments: '1', monthly_amount: '', paid: '0', balance: '0', date: today(), note: '', status: 'active' });
    setModal(true);
  };

  const pickEmp = (e: any) => {
    const amt = parse(form.amount);
    const inst = parse(form.installments) || 1;
    setForm({ ...form, employee_code: e.code, employee_name: e.name, monthly_amount: String(Math.round(amt / inst)), balance: String(amt) });
  };

  const submit = async () => {
    if (!form.employee_code) return showToast('کارمند را انتخاب کن', true);
    if (!form.amount) return showToast('مبلغ الزامی', true);
    const amt = parse(form.amount);
    const payload = { ...form, amount: amt, installments: parse(form.installments), monthly_amount: parse(form.monthly_amount), paid: parse(form.paid), balance: amt - parse(form.paid) };
    await createLoan(payload);
    await reload();
    setModal(false);
    showToast('✅ ثبت شد');
  };

  return (
    <View>
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#dc2626' }]} onPress={openNew}><Text style={s.addBtnTxt}>➕ ثبت وام / مساعده</Text></TouchableOpacity>
      <Text style={s.secT}>📋 وام‌ها و مساعده‌ها ({loans.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ maxWidth: "100%" }} contentContainerStyle={{ paddingRight: 4 }}>
        <View>
          <View style={[s.tblHeader, { minWidth: 1300 }]}>
            <Text style={[s.th, { width: 40 }]}>#</Text>
            <Text style={[s.th, { width: 150 }]}>کارمند</Text>
            <Text style={[s.th, { width: 80 }]}>نوع</Text>
            <Text style={[s.th, { width: 110 }]}>مبلغ کل</Text>
            <Text style={[s.th, { width: 80 }]}>اقساط</Text>
            <Text style={[s.th, { width: 110 }]}>قسط ماهانه</Text>
            <Text style={[s.th, { width: 110 }]}>پرداختی</Text>
            <Text style={[s.th, { width: 110 }]}>مانده</Text>
            <Text style={[s.th, { width: 100 }]}>تاریخ</Text>
            <Text style={[s.th, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.th, { width: 100 }]}>عملیات</Text>
          </View>
          {loans.length === 0 ? <View style={{ padding: 30 }}><Text style={s.empty}>هنوز وامی ثبت نشده</Text></View> : loans.map((l: any, i: number) => (
            <View key={l.local_id || l.id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#fff' }]}>
              <Text style={[s.td, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 150, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]}>{l.employee_name}</Text>
              <Text style={[s.td, { width: 80, color: '#7c3aed' }]}>{l.type === 'loan' ? 'وام' : 'مساعده'}</Text>
              <Text style={[s.td, { width: 110, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(l.amount)}</Text>
              <Text style={[s.td, { width: 80, color: '#0f2438' }]}>{l.installments}</Text>
              <Text style={[s.td, { width: 110, color: '#f59e0b', fontWeight: 'bold' }]}>{fmt(l.monthly_amount)}</Text>
              <Text style={[s.td, { width: 110, color: '#059669', fontWeight: 'bold' }]}>{fmt(l.paid)}</Text>
              <Text style={[s.td, { width: 110, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(l.balance)}</Text>
              <Text style={[s.td, { width: 100, color: '#475569', fontSize: 10 }]}>{l.date}</Text>
              <Text style={[s.td, { width: 90 }]}><Text style={[s.badge, l.status === 'active' && { backgroundColor: '#fef3c7', color: '#78350f' }, l.status === 'paid' && { backgroundColor: '#d1fae5', color: '#065f46' }]}>{l.status === 'active' ? 'فعال' : 'تسویه'}</Text></Text>
              <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={async () => { await deleteLoan(l.local_id || l.id); await reload(); showToast('🗑'); }} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={[s.mHead, { backgroundColor: '#dc2626' }]}><Text style={s.mTitle}>➕ ثبت وام / مساعده</Text><TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={s.lbl}>کارمند</Text>
            <View style={s.chips}>
              {emps.map((e: any) => <TouchableOpacity key={e.code} onPress={() => pickEmp(e)} style={[s.chip, form.employee_code === e.code && s.chipActive]}><Text style={[s.chipTxt, form.employee_code === e.code && s.chipTxtActive]}>{e.name}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>نوع</Text>
            <View style={s.chips}>
              {[{ k: 'loan', l: 'وام' }, { k: 'advance', l: 'مساعده' }].map((x: any) => <TouchableOpacity key={x.k} onPress={() => setForm({ ...form, type: x.k })} style={[s.chip, form.type === x.k && s.chipActive]}><Text style={[s.chipTxt, form.type === x.k && s.chipTxtActive]}>{x.l}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>مبلغ کل</Text>
            <TextInput style={s.inp} value={String(form.amount)} onChangeText={v => setForm({ ...form, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
            <Text style={s.lbl}>تعداد اقساط</Text>
            <TextInput style={s.inp} value={String(form.installments)} onChangeText={v => setForm({ ...form, installments: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
            <Text style={s.lbl}>قسط ماهانه</Text>
            <TextInput style={s.inp} value={String(form.monthly_amount)} onChangeText={v => setForm({ ...form, monthly_amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" />
            <Text style={s.lbl}>تاریخ</Text>
            <TextInput style={s.inp} value={form.date} onChangeText={v => setForm({ ...form, date: v })} />
            <Text style={s.lbl}>توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={form.note} onChangeText={v => setForm({ ...form, note: v })} multiline />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}



// ═══════════════════════════════════════════
//  TAB 5: مرخصی‌ها
// ═══════════════════════════════════════════
function LeavesTab({ emps, leaves, reload, showToast }: any) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});

  const openNew = () => {
    setForm({ employee_code: '', employee_name: '', leave_type: 'annual', from_date: today(), to_date: today(), days: '1', reason: '', status: 'approved' });
    setModal(true);
  };

  const submit = async () => {
    if (!form.employee_code) return showToast('کارمند را انتخاب کن', true);
    const payload = { ...form, days: parse(form.days) };
    await createLeave(payload);
    await reload();
    setModal(false);
    showToast('✅ ثبت شد');
  };

  const TYPE_LABELS: Record<string, string> = { annual: '🌴 استحقاقی', sick: '🤒 استعلاجی', unpaid: '🚫 بدون حقوق', maternity: '👶 زایمان', emergency: '⚠️ اضطراری' };

  return (
    <View>
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#10b981' }]} onPress={openNew}><Text style={s.addBtnTxt}>➕ ثبت مرخصی</Text></TouchableOpacity>
      <Text style={s.secT}>📋 مرخصی‌ها ({leaves.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ maxWidth: "100%" }} contentContainerStyle={{ paddingRight: 4 }}>
        <View>
          <View style={[s.tblHeader, { minWidth: 1300 }]}>
            <Text style={[s.th, { width: 40 }]}>#</Text>
            <Text style={[s.th, { width: 150 }]}>کارمند</Text>
            <Text style={[s.th, { width: 120 }]}>نوع</Text>
            <Text style={[s.th, { width: 100 }]}>از تاریخ</Text>
            <Text style={[s.th, { width: 100 }]}>تا تاریخ</Text>
            <Text style={[s.th, { width: 80 }]}>روز</Text>
            <Text style={[s.th, { width: 150 }]}>دلیل</Text>
            <Text style={[s.th, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.th, { width: 100 }]}>عملیات</Text>
          </View>
          {leaves.length === 0 ? <View style={{ padding: 30 }}><Text style={s.empty}>مرخصی ثبت نشده</Text></View> : leaves.map((l: any, i: number) => (
            <View key={l.local_id || l.id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#fff' }]}>
              <Text style={[s.td, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 150, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]}>{l.employee_name}</Text>
              <Text style={[s.td, { width: 120, color: '#7c3aed', fontSize: 11 }]}>{TYPE_LABELS[l.leave_type] || l.leave_type}</Text>
              <Text style={[s.td, { width: 100, color: '#475569', fontSize: 11 }]}>{l.from_date}</Text>
              <Text style={[s.td, { width: 100, color: '#475569', fontSize: 11 }]}>{l.to_date}</Text>
              <Text style={[s.td, { width: 80, color: '#dc2626', fontWeight: 'bold' }]}>{l.days}</Text>
              <Text style={[s.td, { width: 150, color: '#475569', fontSize: 11, textAlign: 'right' }]} numberOfLines={1}>{l.reason || '—'}</Text>
              <Text style={[s.td, { width: 90 }]}><Text style={[s.badge, l.status === 'approved' && { backgroundColor: '#d1fae5', color: '#065f46' }, l.status === 'pending' && { backgroundColor: '#fef3c7', color: '#78350f' }]}>{l.status === 'approved' ? '✅ تأیید' : '⏳'}</Text></Text>
              <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={async () => { await deleteLeave(l.local_id || l.id); await reload(); showToast('🗑'); }} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.mBg}><ScrollView style={s.mBox} keyboardShouldPersistTaps="handled">
          <View style={[s.mHead, { backgroundColor: '#10b981' }]}><Text style={s.mTitle}>➕ ثبت مرخصی</Text><TouchableOpacity onPress={() => setModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={s.lbl}>کارمند</Text>
            <View style={s.chips}>
              {emps.map((e: any) => <TouchableOpacity key={e.code} onPress={() => setForm({ ...form, employee_code: e.code, employee_name: e.name })} style={[s.chip, form.employee_code === e.code && s.chipActive]}><Text style={[s.chipTxt, form.employee_code === e.code && s.chipTxtActive]}>{e.name}</Text></TouchableOpacity>)}
            </View>
            <Text style={s.lbl}>نوع مرخصی</Text>
            <View style={s.chips}>
              {Object.entries(TYPE_LABELS).map(([k, v]: any) => <TouchableOpacity key={k} onPress={() => setForm({ ...form, leave_type: k })} style={[s.chip, form.leave_type === k && s.chipActive]}><Text style={[s.chipTxt, form.leave_type === k && s.chipTxtActive]}>{v}</Text></TouchableOpacity>)}
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>از تاریخ</Text><TextInput style={s.inp} value={form.from_date} onChangeText={v => setForm({ ...form, from_date: v })} /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>تا تاریخ</Text><TextInput style={s.inp} value={form.to_date} onChangeText={v => setForm({ ...form, to_date: v })} /></View>
              <View style={{ width: 80 }}><Text style={s.lbl}>روز</Text><TextInput style={s.inp} value={String(form.days)} onChangeText={v => setForm({ ...form, days: v.replace(/[^\d]/g, '') })} keyboardType="numeric" /></View>
            </View>
            <Text style={s.lbl}>دلیل</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={form.reason} onChangeText={v => setForm({ ...form, reason: v })} multiline />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#10b981', flex: 2 }]} onPress={submit}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView></View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════
//  TAB 6: لیست حقوق (Payroll Batch)
// ═══════════════════════════════════════════
function PayrollTab({ emps, atts, loans, salaries, batches, reload, showToast }: any) {
  const [month, setMonth] = useState(new Date().toLocaleDateString('fa-IR').slice(0, 7));
  const [calc, setCalc] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [payslipData, setPayslipData] = useState<any>(null);

  const doCalc = () => {
    const results = emps.filter((e: any) => e.status === 'فعال').map((e: any) => {
      const d = calcEmployeeSalary(e, month, atts, loans);
      return { employee: e, ...d };
    });
    setCalc(results);
    showToast('✅ ' + results.length + ' کارمند محاسبه شد');
  };

  const totals = calc.reduce((a: any, x: any) => ({
    gross: a.gross + x.gross_salary,
    net: a.net + x.net_salary,
    tax: a.tax + x.tax,
    insurance: a.insurance + x.employee_insurance,
    employer: a.employer + x.employer_insurance,
  }), { gross: 0, net: 0, tax: 0, insurance: 0, employer: 0 });

  const saveBatch = async () => {
    if (!calc.length) return showToast('اول محاسبه کن', true);
    const batch = await createBatch({
      month,
      total_employees: calc.length,
      total_gross: totals.gross,
      total_deductions: totals.gross - totals.net,
      total_net: totals.net,
      total_tax: totals.tax,
      total_insurance: totals.insurance,
      status: 'draft',
    });
    // ذخیره هر پرداخت
    for (const c of calc) {
      await createSalaryPayment({
        batch_number: batch.batch_number,
        employee_code: c.employee.code,
        employee_name: c.employee.name,
        month,
        attendance_days: c.attendance_days,
        absent_days: c.absent_days,
        leave_days: c.leave_days,
        worked_hours: c.worked_hours,
        base_salary: c.base_salary,
        housing_allowance: c.housing_allowance,
        food_allowance: c.food_allowance,
        transport_allowance: c.transport_allowance,
        other_allowance: c.other_allowance,
        overtime: c.overtime,
        gross_salary: c.gross_salary,
        employee_insurance: c.employee_insurance,
        employer_insurance: c.employer_insurance,
        tax: c.tax,
        loan: c.loan,
        deduction: c.deduction,
        net_salary: c.net_salary,
        payment: c.net_salary,
        balance: 0,
        payment_method: 'bank',
        bank: c.employee.bank || '',
        payment_date: today(),
        status: 'paid',
      });
    }
    await reload();
    showToast('✅ دسته ' + batch.batch_number + ' ذخیره شد');
  };

  return (
    <View>
      <View style={[s.card, { padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }]}>
        <Text style={s.lbl}>📅 ماه حقوق (مثلاً 1405/08)</Text>
        <TextInput style={s.inp} value={month} onChangeText={setMonth} placeholder="1405/08" />
        <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12 }}>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 1 }]} onPress={doCalc}>
            <Text style={s.btnTxt}>🧮 محاسبه حقوق همه</Text>
          </TouchableOpacity>
          {calc.length > 0 && (
            <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 1 }]} onPress={saveBatch}>
              <Text style={s.btnTxt}>💾 ذخیره دسته</Text>
            </TouchableOpacity>
          )}
        </View>
        {calc.length > 0 && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#0ea5e9', marginTop: 8 }]} onPress={() => { if (exportBankFile(calc.map((c: any) => c.employee), calc, month)) showToast('✅ فایل بانکی'); }}>
            <Text style={s.btnTxt}>📥 فایل بانکی (CSV)</Text>
          </TouchableOpacity>
        )}
      </View>

      {calc.length > 0 && (
        <>
          {/* جمع کل */}
          <View style={[s.dash, { marginTop: 12 }]}>
            <Text style={s.dashTitle}>📊 خلاصه دسته {month}</Text>
            <View style={s.dashRow}>
              <View style={s.dashItem}><Text style={s.dashLbl}>👥 تعداد</Text><Text style={[s.dashVal, { color: '#60a5fa' }]}>{calc.length}</Text></View>
              <View style={s.dashItem}><Text style={s.dashLbl}>💰 کل دریافتی</Text><Text style={[s.dashVal, { color: '#fbbf24' }]}>{fmt(totals.gross)}</Text></View>
              <View style={s.dashItem}><Text style={s.dashLbl}>📉 کل کسورات</Text><Text style={[s.dashVal, { color: '#f87171' }]}>{fmt(totals.gross - totals.net)}</Text></View>
              <View style={s.dashItem}><Text style={s.dashLbl}>✅ خالص</Text><Text style={[s.dashVal, { color: '#34d399' }]}>{fmt(totals.net)}</Text></View>
            </View>
            <View style={[s.dashRow, { marginTop: 6 }]}>
              <View style={s.dashItem}><Text style={s.dashLbl}>مالیات</Text><Text style={[s.dashVal, { color: '#dc2626' }]}>{fmt(totals.tax)}</Text></View>
              <View style={s.dashItem}><Text style={s.dashLbl}>بیمه کارمند</Text><Text style={[s.dashVal, { color: '#dc2626' }]}>{fmt(totals.insurance)}</Text></View>
              <View style={s.dashItem}><Text style={s.dashLbl}>بیمه کارفرما</Text><Text style={[s.dashVal, { color: '#f59e0b' }]}>{fmt(totals.employer)}</Text></View>
              <View style={s.dashItem}><Text style={s.dashLbl}>هزینه کارفرما</Text><Text style={[s.dashVal, { color: '#a78bfa' }]}>{fmt(totals.gross + totals.employer)}</Text></View>
            </View>
          </View>

          {/* جدول */}
          <Text style={s.secT}>📋 لیست محاسبه‌شده</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ maxWidth: "100%" }} contentContainerStyle={{ paddingRight: 4 }}>
            <View>
              <View style={[s.tblHeader, { minWidth: 1300 }]}>
                <Text style={[s.th, { width: 40 }]}>#</Text>
                <Text style={[s.th, { width: 150 }]}>کارمند</Text>
                <Text style={[s.th, { width: 70 }]}>حاضر</Text>
                <Text style={[s.th, { width: 70 }]}>غایب</Text>
                <Text style={[s.th, { width: 70 }]}>مرخصی</Text>
                <Text style={[s.th, { width: 90 }]}>اضافه‌کار</Text>
                <Text style={[s.th, { width: 100 }]}>پایه</Text>
                <Text style={[s.th, { width: 100 }]}>مزایا</Text>
                <Text style={[s.th, { width: 110 }]}>کل دریافتی</Text>
                <Text style={[s.th, { width: 100 }]}>بیمه</Text>
                <Text style={[s.th, { width: 100 }]}>مالیات</Text>
                <Text style={[s.th, { width: 90 }]}>وام</Text>
                <Text style={[s.th, { width: 110 }]}>خالص</Text>
                <Text style={[s.th, { width: 100 }]}>فیش</Text>
              </View>
              {calc.map((c: any, i: number) => (
                <View key={c.employee.code} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#fff' }]}>
                  <Text style={[s.td, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                  <Text style={[s.td, { width: 150, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' }]}>{c.employee.name}</Text>
                  <Text style={[s.td, { width: 70, color: '#059669', fontWeight: 'bold' }]}>{c.attendance_days}</Text>
                  <Text style={[s.td, { width: 70, color: '#dc2626' }]}>{c.absent_days}</Text>
                  <Text style={[s.td, { width: 70, color: '#f59e0b' }]}>{c.leave_days}</Text>
                  <Text style={[s.td, { width: 90, color: '#7c3aed' }]}>{c.overtime_hours}س</Text>
                  <Text style={[s.td, { width: 100, color: '#475569' }]}>{fmt(c.base_salary)}</Text>
                  <Text style={[s.td, { width: 100, color: '#475569' }]}>{fmt(c.housing_allowance + c.food_allowance + c.transport_allowance + c.other_allowance)}</Text>
                  <Text style={[s.td, { width: 110, color: '#fbbf24', fontWeight: 'bold' }]}>{fmt(c.gross_salary)}</Text>
                  <Text style={[s.td, { width: 100, color: '#dc2626' }]}>{fmt(c.employee_insurance)}</Text>
                  <Text style={[s.td, { width: 100, color: '#dc2626' }]}>{fmt(c.tax)}</Text>
                  <Text style={[s.td, { width: 90, color: '#dc2626' }]}>{fmt(c.loan)}</Text>
                  <Text style={[s.td, { width: 110, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(c.net_salary)}</Text>
                  <View style={[s.td, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                    <TouchableOpacity onPress={() => printPayslip(c.employee, c, month).then((ok: any) => ok && showToast('✅ فیش'))} style={[s.iconBtn, { backgroundColor: '#dbeafe', borderRadius: 6, paddingHorizontal: 10 }]}>
                      <Text style={{ fontSize: 11 }}>🖨️ فیش</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* دسته‌های قبلی */}
      {batches.length > 0 && (
        <>
          <Text style={[s.secT, { marginTop: 20 }]}>📁 دسته‌های قبلی ({batches.length})</Text>
          {batches.map((b: any) => (
            <View key={b.local_id || b.id} style={[s.card, { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#7c3aed' }]}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 'bold', color: '#7c3aed', fontSize: 13 }}>{b.batch_number}</Text>
                <Text style={{ color: '#64748b', fontSize: 11 }}>{b.month}</Text>
              </View>
              <Text style={{ color: '#0f2438', fontSize: 12, marginTop: 6, textAlign: 'right' }}>
                👥 {b.total_employees} کارمند | 💰 کل: {fmt(b.total_net)} | 📉 مالیات: {fmt(b.total_tax)}
              </Text>
              <TouchableOpacity onPress={async () => { await deleteBatch(b.local_id || b.id); await reload(); showToast('🗑'); }} style={[s.iconBtn, { marginTop: 6, alignSelf: 'flex-end' }]}>
                <Text>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dash: { backgroundColor: '#0f2438', padding: 12, margin: 10, marginBottom: 0, borderRadius: 14, borderWidth: 2, borderColor: '#1f3a5f' },
  dashTitle: { color: '#f4d47a', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  dashRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  dashItem: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, paddingVertical: 8, marginHorizontal: 2, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  dashLbl: { color: '#94a3b8', fontSize: 9, marginBottom: 4 },
  dashVal: { fontSize: 15, fontWeight: 'bold', fontFamily: 'monospace' },
  subsBar: { maxHeight: 50, marginTop: 8 },
  subsCont: { gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  sub: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  subActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  subTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  subTxtActive: { color: '#fff' },
  addBtn: { backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  secT: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 8, marginTop: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 12 },
  tblHeader: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },
  tblRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 6, backgroundColor: '#f8fafc', alignItems: 'center' },
  td: { fontSize: 11, textAlign: 'center', paddingHorizontal: 4, color: '#1a2332' },
  badge: { fontSize: 9, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold', backgroundColor: '#dbeafe', color: '#1e40af', overflow: 'hidden' },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  section: { fontSize: 13, fontWeight: 'bold', color: '#7c3aed', textAlign: 'right', marginTop: 16, marginBottom: 8, borderBottomWidth: 2, borderBottomColor: '#ede9fe', paddingBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', backgroundColor: '#f8fafc', color: '#0f2438' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipTxt: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 },
  mBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '95%' },
  mHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  mTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  summaryBox: { backgroundColor: '#0f2438', borderRadius: 12, padding: 14, marginTop: 14, alignItems: 'center', borderWidth: 2, borderColor: '#d4af37' },
  summaryLbl: { color: '#cbd5e1', fontSize: 11, marginBottom: 4 },
  summaryVal: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, fontFamily: 'monospace' },
});
