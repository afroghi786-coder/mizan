// AdminPanel.tsx — پنل ادمین کامل با ۳ تب
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './lib';

const DURATIONS = [
  { k: '10d', l: '۱۰ روز', interval: '10 days', days: 10 },
  { k: '1m', l: '۱ ماه', interval: '30 days', days: 30 },
  { k: '3m', l: '۳ ماه', interval: '90 days', days: 90 },
  { k: '6m', l: '۶ ماه', interval: '180 days', days: 180 },
  { k: '1y', l: '۱ سال', interval: '365 days', days: 365 },
];

export default function AdminPanel({ showToast }: any) {
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState('1m');
  const [extend, setExtend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [tab, setTab] = useState<'issue' | 'requests' | 'list'>('issue');

  // ═══ بارگذاری درخواست‌ها ═══
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data } = await supabase
        .from('license_requests')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);
      setRequests(data || []);
    } catch (e) { console.log(e); }
    finally { setRequestsLoading(false); }
  };

  // ═══ بارگذاری لیست لایسنس‌ها ═══
  const loadList = async () => {
    setListLoading(true);
    try {
      const { data } = await supabase
        .from('licenses')
        .select('user_id, plan, status, expires_at, last_payment_at')
        .order('last_payment_at', { ascending: false })
        .limit(50);
      setList(data || []);
    } catch (e) { console.log(e); }
    finally { setListLoading(false); }
  };

  useEffect(() => { loadList(); loadRequests(); }, []);

  // ═══ صدور لایسنس ═══
  const saveLicense = async (userId: string, dur: string, ext: boolean) => {
    const info = DURATIONS.find(d => d.k === dur);
    if (!info) throw new Error('مدت نامعتبر');

    const { data: existing } = await supabase
      .from('licenses')
      .select('user_id, expires_at')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing[0]) {
      // تمدید با RPC
      const { error } = await supabase.rpc('extend_license', {
        p_user_id: userId,
        p_days: info.days,
        p_from_now: !ext,
      });
      if (error) throw error;
    } else {
      // صدور جدید
      const { error } = await supabase.from('licenses').insert({
        user_id: userId,
        plan: info.k,
        status: 'active',
        expires_at: new Date(Date.now() + info.days * 24 * 3600 * 1000).toISOString(),
        last_payment_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
  };

  // ═══ صدور دستی ═══
  const issue = async () => {
    if (!email.trim() || !email.includes('@')) return showToast('ایمیل معتبر وارد کن', true);
    setLoading(true);
    try {
      const { data: uid, error } = await supabase.rpc('get_user_id_by_email', {
        user_email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      if (!uid) throw new Error('کاربر با این ایمیل پیدا نشد');
      await saveLicense(uid, duration, extend);
      showToast('✅ لایسنس صادر شد');
      setEmail('');
      loadList();
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    } finally { setLoading(false); }
  };

  // ═══ تأیید درخواست ═══
  const approveRequest = async (req: any) => {
    try {
      await saveLicense(req.user_id, '1m', false);
      await supabase.from('license_requests')
        .update({ status: 'approved', handled_at: new Date().toISOString() })
        .eq('id', req.id);
      showToast('✅ لایسنس ۱ ماه صادر شد');
      loadRequests();
      loadList();
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    }
  };

  // ═══ رد درخواست ═══
  const rejectRequest = async (req: any) => {
    try {
      await supabase.from('license_requests')
        .update({ status: 'rejected', handled_at: new Date().toISOString() })
        .eq('id', req.id);
      showToast('❌ رد شد');
      loadRequests();
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={s.title}>🔐 پنل ادمین</Text>
      <Text style={s.sub}>مدیریت لایسنس‌ها و درخواست‌ها</Text>

      {/* تب‌ها */}
      <View style={s.tabsRow}>
        <TouchableOpacity onPress={() => setTab('issue')} style={[s.tab, tab === 'issue' && s.tabActive]}>
          <Text style={[s.tabTxt, tab === 'issue' && s.tabTxtActive]}>✅ صدور</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('requests')} style={[s.tab, tab === 'requests' && s.tabActive]}>
          <Text style={[s.tabTxt, tab === 'requests' && s.tabTxtActive]}>
            📩 درخواست‌ها{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('list')} style={[s.tab, tab === 'list' && s.tabActive]}>
          <Text style={[s.tabTxt, tab === 'list' && s.tabTxtActive]}>📋 لیست</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ تب صدور ═══ */}
      {tab === 'issue' && (
        <View style={s.card}>
          <Text style={s.lbl}>📧 ایمیل کاربر</Text>
          <TextInput
            style={s.inp}
            value={email}
            onChangeText={setEmail}
            placeholder="user@example.com"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={s.lbl}>⏱️ مدت لایسنس</Text>
          <View style={s.chipsWrap}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d.k} onPress={() => setDuration(d.k)} style={[s.chip, duration === d.k && s.chipActive]}>
                <Text style={[s.chipTxt, duration === d.k && s.chipTxtActive]}>{d.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.checkboxRow} onPress={() => setExtend(!extend)}>
            <Text style={s.checkbox}>{extend ? '☑️' : '⬜'}</Text>
            <Text style={s.checkboxLbl}>مدت جدید به انقضای فعلی اضافه شود (تمدید)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={issue} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ صدور لایسنس</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ تب درخواست‌ها ═══ */}
      {tab === 'requests' && (
        <View>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#334155', marginBottom: 12 }]} onPress={loadRequests}>
            <Text style={s.btnTxt}>🔄 بروزرسانی</Text>
          </TouchableOpacity>

          {requestsLoading ? <ActivityIndicator color="#d4af37" /> : requests.length === 0 ? (
            <Text style={s.empty}>📭 درخواستی وجود ندارد</Text>
          ) : requests.map((r, i) => {
            const isPending = r.status === 'pending';
            const isApproved = r.status === 'approved';
            return (
              <View key={i} style={[s.reqCard, isPending && { borderColor: '#f59e0b', borderWidth: 2 }]}>
                <View style={s.reqHeader}>
                  <Text style={[s.reqBadge,
                    isPending && { backgroundColor: '#fef3c7', color: '#78350f' },
                    isApproved && { backgroundColor: '#d1fae5', color: '#065f46' },
                    !isPending && !isApproved && { backgroundColor: '#fee2e2', color: '#991b1b' }
                  ]}>
                    {isPending ? '⏳ در انتظار' : isApproved ? '✅ تأیید شده' : '❌ رد شده'}
                  </Text>
                  <Text style={s.reqDate}>
                    {r.requested_at ? new Date(r.requested_at).toLocaleDateString('fa-IR') : ''}
                  </Text>
                </View>

                <Text style={s.reqRow}>📧 <Text style={s.reqBold}>{r.email}</Text></Text>
                <Text style={s.reqRow}>👤 {r.full_name}</Text>
                <Text style={s.reqRow}>📞 {r.phone}</Text>
                {r.message ? <Text style={s.reqRow}>💬 {r.message}</Text> : null}

                {isPending && (
                  <View style={s.reqActions}>
                    <TouchableOpacity style={[s.reqBtn, { backgroundColor: '#dc2626' }]} onPress={() => rejectRequest(r)}>
                      <Text style={s.reqBtnTxt}>❌ رد</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.reqBtn, { backgroundColor: '#059669', flex: 2 }]} onPress={() => approveRequest(r)}>
                      <Text style={s.reqBtnTxt}>✅ تأیید + صدور ۱ ماه</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ═══ تب لیست ═══ */}
      {tab === 'list' && (
        <View>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#334155', marginBottom: 12 }]} onPress={loadList}>
            <Text style={s.btnTxt}>🔄 بروزرسانی</Text>
          </TouchableOpacity>

          {listLoading ? <ActivityIndicator color="#d4af37" /> : list.map((l, i) => {
            const exp = l.expires_at ? new Date(l.expires_at) : null;
            const daysLeft = exp ? Math.floor((exp.getTime() - Date.now()) / (24 * 3600 * 1000)) : 0;
            const active = daysLeft > 0 && l.status === 'active';
            return (
              <View key={i} style={s.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listItemId} numberOfLines={1}>{l.user_id?.slice(0, 8)}...</Text>
                  <Text style={s.listItemPlan}>
                    {l.plan} — {active ? `${daysLeft} روز مانده` : 'منقضی'}
                  </Text>
                </View>
                <Text style={[s.badge, active ? s.badgeOk : s.badgeBad]}>{active ? '✅' : '❌'}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f2438', textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 12, marginBottom: 6 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f2438', textAlign: 'right', backgroundColor: '#f8fafc' },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  chipTxtActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 8 },
  checkbox: { fontSize: 20 },
  checkboxLbl: { flex: 1, fontSize: 12, color: '#475569', textAlign: 'right' },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  tabsRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  tabActive: { backgroundColor: '#0f2438', borderColor: '#0f2438' },
  tabTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  tabTxtActive: { color: '#fff' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },
  reqCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  reqHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  reqBadge: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  reqDate: { fontSize: 10, color: '#94a3b8' },
  reqRow: { fontSize: 12, color: '#475569', textAlign: 'right', marginBottom: 4, lineHeight: 20 },
  reqBold: { fontWeight: 'bold', color: '#0f2438' },
  reqActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  reqBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  reqBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  listItem: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  listItemId: { fontSize: 11, color: '#7c3aed', fontWeight: 'bold', textAlign: 'right' },
  listItemPlan: { fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 2 },
  badge: { fontSize: 16, paddingHorizontal: 8 },
  badgeOk: { color: '#059669' },
  badgeBad: { color: '#dc2626' },
});
