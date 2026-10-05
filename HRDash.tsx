// HRDash.tsx — داشبورد حرفه‌ای منابع انسانی
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function HRDash({ emps, atts, salaries, loans, leaves }: any) {
  const t = new Date();
  const todayStr = t.toLocaleDateString('fa-IR');
  const thisMonth = todayStr.slice(0, 7);

  const activeEmps = (emps || []).filter((e: any) => e.status === 'فعال');
  const inactiveEmps = (emps || []).filter((e: any) => e.status === 'غيرفعال' || e.status === 'اخراجی');
  const todayA = (atts || []).filter((a: any) => a.date === todayStr);
  const present = todayA.filter((a: any) => a.status === 'حاضر').length;
  const absent = todayA.filter((a: any) => a.status === 'غایب').length;
  const leave = todayA.filter((a: any) => a.status === 'مرخصی').length;
  const mission = todayA.filter((a: any) => a.status === 'ماموریت').length;
  const rate = activeEmps.length ? Math.round((present / activeEmps.length) * 100) : 0;

  const monthS = (salaries || []).filter((x: any) => String(x.payment_date || '').startsWith(thisMonth) || String(x.month || '') === thisMonth);
  const monthTotal = monthS.reduce((a: number, x: any) => a + (Number(x.net_salary) || Number(x.payment) || 0), 0);
  const monthTax = monthS.reduce((a: number, x: any) => a + (Number(x.tax) || 0), 0);
  const monthIns = monthS.reduce((a: number, x: any) => a + (Number(x.employee_insurance) || 0) + (Number(x.employer_insurance) || 0), 0);
  const loanBalance = (loans || []).filter((l: any) => l.status === 'active').reduce((a: number, x: any) => a + (Number(x.balance) || 0), 0);
  const monthLeaves = (leaves || []).filter((l: any) => String(l.from_date || '').startsWith(thisMonth));

  const last7: any[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t.getTime() - i * 86400000);
    const ds = d.toLocaleDateString('fa-IR');
    last7.push({ label: ds.slice(5), val: (atts || []).filter((a: any) => a.date === ds && a.status === 'حاضر').length });
  }
  const maxW = Math.max(...last7.map(x => x.val), 1);

  const depts: Record<string, number> = {};
  activeEmps.forEach((e: any) => { const d = e.department || 'سایر'; depts[d] = (depts[d] || 0) + 1; });
  const maxD = Math.max(...Object.values(depts), 1);

  const empStats: Record<string, any> = {};
  (atts || []).forEach((a: any) => {
    if (!a.employee_code) return;
    if (!empStats[a.employee_code]) empStats[a.employee_code] = { name: a.employee_name || '—', present: 0 };
    if (a.status === 'حاضر') empStats[a.employee_code].present++;
  });
  const top5 = Object.entries(empStats).sort((a: any, b: any) => b[1].present - a[1].present).slice(0, 5);

  const paidCodes = new Set(monthS.map((x: any) => x.employee_code));
  const unpaid = activeEmps.filter((e: any) => !paidCodes.has(e.code)).length;

  return (
    <View style={s.dash}>
      {/* هدر */}
      <View style={s.head}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20 }}>💼</Text>
          <Text style={s.headTitle}>داشبورد منابع انسانی</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.headDate}>{todayStr}</Text>
          <Text style={s.headTime}>{pad2(t.getHours())}:{pad2(t.getMinutes())}</Text>
        </View>
      </View>

      {/* KPI کارمندان */}
      <Text style={s.secLbl}>👥 آمار کارمندان</Text>
      <View style={s.row}>
        <K l="👥 کل" v={emps.length} c="#60a5fa" />
        <K l="✅ فعال" v={activeEmps.length} c="#34d399" />
        <K l="⏰ مرخصی" v={monthLeaves.length} c="#fbbf24" />
        <K l="🏦 وام" v={(loans || []).filter((l: any) => l.status === 'active').length} c="#a78bfa" />
      </View>

      {/* KPI حضور امروز */}
      <Text style={s.secLbl}>📅 حضور امروز</Text>
      <View style={s.row}>
        <K l="✅ حاضر" v={present} c="#00ff88" />
        <K l="❌ غایب" v={absent} c="#ff3355" />
        <K l="🌴 مرخصی" v={leave} c="#fbbf24" />
        <K l="✈️ ماموریت" v={mission} c="#a78bfa" />
      </View>

      {/* نرخ حضور */}
      <View style={s.progressBox}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={s.pLbl}>🎯 نرخ حضور امروز</Text>
          <Text style={s.pVal}>{rate}%</Text>
        </View>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: rate + '%', backgroundColor: rate >= 80 ? '#00ff88' : rate >= 50 ? '#fbbf24' : '#ff3355' }]} />
        </View>
      </View>

      {/* KPI مالی */}
      <Text style={s.secLbl}>💰 آمار مالی این ماه</Text>
      <View style={s.row}>
        <K l="💰 حقوق" v={fmt(monthTotal)} c="#00ff88" wide />
        <K l="📊 مالیات" v={fmt(monthTax)} c="#ff3355" wide />
      </View>
      <View style={s.row}>
        <K l="🏥 بیمه" v={fmt(monthIns)} c="#fbbf24" wide />
        <K l="🏦 مانده وام" v={fmt(loanBalance)} c="#a78bfa" wide />
      </View>

      {/* نمودار ۷ روز */}
      <View style={s.chartBox}>
        <Text style={s.chartTitle}>📊 حضور ۷ روز اخیر</Text>
        <View style={s.chartRow}>
          {last7.map((d, i) => (
            <View key={i} style={s.chartCol}>
              <Text style={s.chartVal}>{d.val}</Text>
              <View style={[s.chartBar, { height: Math.max(3, (d.val / maxW) * 40) }]} />
              <Text style={s.chartLbl}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* دپارتمان‌ها */}
      {Object.keys(depts).length > 0 && (
        <View style={s.chartBox}>
          <Text style={s.chartTitle}>🏢 توزیع دپارتمان‌ها</Text>
          {Object.entries(depts).map(([d, c]: any) => (
            <View key={d} style={{ marginBottom: 5 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={s.deptName}>{d}</Text>
                <Text style={s.deptVal}>{c}</Text>
              </View>
              <View style={s.deptBar}>
                <View style={[s.deptFill, { width: ((c / maxD) * 100) + '%' }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top 5 */}
      {top5.length > 0 && (
        <View style={s.chartBox}>
          <Text style={s.chartTitle}>🏆 ۵ کارمند برتر (حضور)</Text>
          {top5.map(([code, s1]: any, i: number) => (
            <View key={code} style={s.topRow}>
              <Text style={[s.topNum, { color: ['#fbbf24','#94a3b8','#a16207','#64748b','#64748b'][i] }]}>{i + 1}.</Text>
              <Text style={s.topName} numberOfLines={1}>{s1.name}</Text>
              <Text style={s.topVal}>{s1.present} روز</Text>
            </View>
          ))}
        </View>
      )}

      {/* هشدار */}
      {unpaid > 0 && (
        <View style={s.alert}>
          <Text style={s.alertTxt}>💰 {unpaid} کارمند حقوق این ماه را نگرفته‌اند</Text>
        </View>
      )}
      {todayA.length === 0 && activeEmps.length > 0 && (
        <View style={[s.alert, { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.4)' }]}>
          <Text style={[s.alertTxt, { color: '#a78bfa' }]}>📅 امروز هیچ حضوری ثبت نشده</Text>
        </View>
      )}
    </View>
  );
}

function K({ l, v, c, wide }: any) {
  return (
    <View style={[s.kCard, wide && { flex: 1 }, { borderRightColor: c }]}>
      <Text style={s.kLbl} numberOfLines={1}>{l}</Text>
      <Text style={[s.kVal, { color: c }]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  dash: { backgroundColor: '#080b13', padding: 10, margin: 6, marginTop: 8, borderRadius: 14, borderWidth: 2, borderColor: '#1f3a5f' },
  head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,136,0.15)' },
  headTitle: { color: '#f4d47a', fontSize: 13, fontWeight: 'bold' },
  headDate: { color: '#00ff88', fontSize: 9, fontFamily: 'monospace' },
  headTime: { color: '#64748b', fontSize: 8, fontFamily: 'monospace' },
  secLbl: { color: '#94a3b8', fontSize: 9, textAlign: 'right', marginBottom: 4, marginTop: 4 },
  row: { flexDirection: 'row-reverse', gap: 3, marginBottom: 6 },
  kCard: { flex: 1, padding: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, borderRightWidth: 3, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  kLbl: { color: '#94a3b8', fontSize: 8, marginBottom: 3, textAlign: 'center' },
  kVal: { fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
  progressBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 8, marginBottom: 6 },
  pLbl: { color: '#94a3b8', fontSize: 10 },
  pVal: { color: '#00ff88', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  chartBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 8, marginBottom: 6 },
  chartTitle: { color: '#94a3b8', fontSize: 10, marginBottom: 6, textAlign: 'right' },
  chartRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-around', height: 55 },
  chartCol: { alignItems: 'center', flex: 1 },
  chartVal: { color: '#00ff88', fontSize: 8 },
  chartBar: { width: '70%', backgroundColor: 'rgba(0,255,136,0.6)', borderRadius: 2, marginTop: 2 },
  chartLbl: { color: '#64748b', fontSize: 7, marginTop: 3 },
  deptName: { color: '#e2e8f0', fontSize: 9 },
  deptVal: { color: '#60a5fa', fontSize: 9, fontFamily: 'monospace' },
  deptBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  deptFill: { height: 4, backgroundColor: '#3b82f6' },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 3 },
  topNum: { fontSize: 11, width: 20, fontWeight: 'bold' },
  topName: { flex: 1, color: '#fff', fontSize: 10, textAlign: 'right' },
  topVal: { color: '#00ff88', fontSize: 10, fontWeight: 'bold' },
  alert: { backgroundColor: 'rgba(251,146,60,0.15)', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: 'rgba(251,146,60,0.4)' },
  alertTxt: { color: '#fb923c', fontSize: 9, textAlign: 'right' },
});
