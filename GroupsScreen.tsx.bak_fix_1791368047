// GroupsScreen.tsx — گروه‌های خصوصی صرافان
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import {
  initNetwork, loadNetSettings, getMyNetInfo,
  createGroup, inviteToGroupByEmail, joinGroupByCode, leaveGroup,
  kickGroupMember, deleteGroup, getGroupDetails, listenMyGroups, NET_CITIES,
} from './lib.network';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

export default function GroupsScreen({ showToast }: any) {
  const [net, setNet] = useState<any>({ connected: false, email: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [inviteModal, setInviteModal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', city: 'KBL' });
  const [joinCode, setJoinCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    await initNetwork();
    setNet(getMyNetInfo());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!net.connected || !net.email) return;
    listenMyGroups(setGroups);
  }, [net.connected, net.email]);

  const submitCreate = async () => {
    if (!createForm.name || createForm.name.length < 3) return showToast?.('نام حداقل ۳ کاراکتر', true);
    setSaving(true);
    try {
      const r = await createGroup(createForm.name, createForm.city);
      showToast?.('✅ گروه ساخته شد — کد دعوت: ' + r.inviteCode);
      setCreateModal(false);
      setCreateForm({ name: '', city: 'KBL' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitJoin = async () => {
    setSaving(true);
    try {
      await joinGroupByCode(joinCode);
      showToast?.('✅ پیوستید');
      setJoinModal(false);
      setJoinCode('');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitInvite = async () => {
    if (!inviteModal) return;
    setSaving(true);
    try {
      await inviteToGroupByEmail(inviteModal.id, inviteEmail);
      showToast?.('✅ دعوت ارسال شد');
      setInviteModal(null);
      setInviteEmail('');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const viewDetail = async (gid: string) => {
    try {
      const d = await getGroupDetails(gid);
      if (d) setDetailModal({ id: gid, ...d });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doLeave = async (gid: string, gname: string) => {
    if (typeof window !== 'undefined' && !window.confirm('از «' + gname + '» خارج می‌شوید؟')) return;
    try { await leaveGroup(gid); showToast?.('✅ خارج شدید'); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doKick = async (gid: string, email: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm('اخراج «' + name + '»؟')) return;
    try { await kickGroupMember(gid, email); showToast?.('✅ اخراج شد'); viewDetail(gid); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doDelete = async (gid: string) => {
    if (typeof window !== 'undefined' && !window.confirm('حذف گروه؟ قابل بازگشت نیست.')) return;
    try { await deleteGroup(gid); showToast?.('✅ حذف شد'); setDetailModal(null); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const copyCode = (code: string) => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(code); } catch {}
    showToast?.('✅ کپی شد');
  };

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  if (!net.connected || !net.name) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>🌐</Text>
        <Text style={s.emptyTxt}>ابتدا در بازار زنده پروفایل خود را کامل کنید</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
        <TouchableOpacity style={[s.actBtn, { backgroundColor: '#059669' }]} onPress={() => setCreateModal(true)}>
          <Text style={s.actBtnTxt}>➕ ساخت گروه</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actBtn, { backgroundColor: '#1e40af' }]} onPress={() => setJoinModal(true)}>
          <Text style={s.actBtnTxt}>🔑 پیوستن با کد</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.secT}>📋 گروه‌های من ({groups.length})</Text>
      {groups.length === 0 ? (
        <Text style={s.empty2}>هنوز در گروهی نیستید</Text>
      ) : groups.map((g: any) => (
        <View key={g.id} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>🌐 {g.name}</Text>
            <Text style={[s.role, g.role === 'owner' ? s.roleOwner : s.roleMember]}>
              {g.role === 'owner' ? '👑 مالک' : '👤 عضو'}
            </Text>
          </View>
          <Text style={s.cardSub}>📍 {NET_CITIES[g.city] || g.city} | 👥 {g.memberCount || 1} عضو</Text>
          {g.role === 'owner' && (
            <TouchableOpacity style={s.inviteBox} onPress={() => copyCode(g.inviteCode)}>
              <Text style={s.inviteLbl}>🔑 کد دعوت (لمس کن کپی)</Text>
              <Text style={s.inviteCode}>{g.inviteCode}</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#1e40af', flex: 1 }]} onPress={() => viewDetail(g.id)}>
              <Text style={s.btnTxt}>👁️ مشاهده</Text>
            </TouchableOpacity>
            {g.role === 'owner' && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 1 }]} onPress={() => { setInviteModal(g); setInviteEmail(''); }}>
                <Text style={s.btnTxt}>➕ دعوت</Text>
              </TouchableOpacity>
            )}
            {g.role !== 'owner' && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 1 }]} onPress={() => doLeave(g.id, g.name)}>
                <Text style={s.btnTxt}>🚪 خروج</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* ساخت گروه */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}>
            <Text style={s.mTitle}>➕ ساخت گروه جدید</Text>
            <TouchableOpacity onPress={() => setCreateModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>نام گروه *</Text>
            <TextInput style={s.inp} value={createForm.name} onChangeText={v => setCreateForm({ ...createForm, name: v })} placeholder="مثلاً صرافان مورد اعتماد" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>شهر</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setCreateForm({ ...createForm, city: k })} style={[s.chip, createForm.city === k && s.chipAct]}>
                  <Text style={[s.chipTxt, createForm.city === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setCreateModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submitCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ساخت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* پیوستن */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#1e40af' }]}>
            <Text style={s.mTitle}>🔑 پیوستن به گروه</Text>
            <TouchableOpacity onPress={() => setJoinModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>کد دعوت (INV-XXXXXXXX)</Text>
            <TextInput style={s.inp} value={joinCode} onChangeText={v => setJoinCode(v.toUpperCase())} placeholder="INV-ABCD1234" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setJoinModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#1e40af', flex: 2 }]} onPress={submitJoin} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ پیوستن</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* دعوت با ایمیل */}
      <Modal visible={!!inviteModal} transparent animationType="slide" onRequestClose={() => setInviteModal(null)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}>➕ دعوت به «{inviteModal?.name}»</Text>
            <TouchableOpacity onPress={() => setInviteModal(null)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ایمیل صراف مورد اعتماد</Text>
            <TextInput style={s.inp} value={inviteEmail} onChangeText={setInviteEmail} placeholder="ahmed@gmail.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
            <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 6, textAlign: 'right' }}>
              💡 اگر صراف در شبکه نصب نکرده باشد، عضویتش بعداً ثبت می‌شود.
            </Text>
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setInviteModal(null)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitInvite} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>📧 دعوت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* جزئیات */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#1e3a8a' }]}>
            <Text style={s.mTitle}>👁️ {detailModal?.meta?.name}</Text>
            <TouchableOpacity onPress={() => setDetailModal(null)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          {detailModal && (
            <ScrollView style={{ padding: 14 }}>
              <Text style={s.detailSub}>📍 {NET_CITIES[detailModal.meta?.city] || '—'} | 👑 {detailModal.meta?.ownerName}</Text>
              {detailModal.meta?.ownerEmail === net.email && (
                <TouchableOpacity style={s.inviteBox} onPress={() => copyCode(detailModal.meta.inviteCode)}>
                  <Text style={s.inviteLbl}>🔑 کد دعوت (لمس کن کپی)</Text>
                  <Text style={s.inviteCode}>{detailModal.meta.inviteCode}</Text>
                </TouchableOpacity>
              )}
              <Text style={s.secT}>👥 اعضا ({detailModal.members?.length || 0})</Text>
              {(detailModal.members || []).map((m: any) => (
                <View key={m.key} style={s.memberRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName}>{m.name} {m.email === net.email ? '(شما)' : ''}</Text>
                    <Text style={s.memberEmail}>{m.email}</Text>
                  </View>
                  {m.role === 'owner' ? (
                    <Text style={s.roleOwner}>👑</Text>
                  ) : detailModal.meta?.ownerEmail === net.email ? (
                    <TouchableOpacity onPress={() => doKick(detailModal.id, m.email, m.name)}>
                      <Text style={{ fontSize: 16 }}>👢</Text>
                    </TouchableOpacity>
                  ) : <Text style={s.roleMember}>👤</Text>}
                </View>
              ))}
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setDetailModal(null)}>
                  <Text style={s.btnTxt}>بستن</Text>
                </TouchableOpacity>
                {detailModal.meta?.ownerEmail === net.email && (
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 1 }]} onPress={() => doDelete(detailModal.id)}>
                    <Text style={s.btnTxt}>🗑 حذف</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  actBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  secT: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  cardSub: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 6 },
  role: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleOwner: { backgroundColor: '#fef3c7', color: '#92400e', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleMember: { backgroundColor: '#dbeafe', color: '#1e40af', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inviteBox: { backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 6 },
  inviteLbl: { color: '#94a3b8', fontSize: 10, textAlign: 'right' },
  inviteCode: { color: '#00ff88', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', marginTop: 2, letterSpacing: 2 },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  empty: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyTxt: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  empty2: { color: '#94a3b8', textAlign: 'center', padding: 30, fontSize: 13 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  mHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  x: { color: '#fff', fontSize: 24 },
  lbl: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 4, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332', marginLeft: 4, marginTop: 4 },
  chipAct: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  rowBtns: { flexDirection: 'row-reverse', gap: 8, marginTop: 16 },
  detailSub: { color: '#cbd5e1', fontSize: 12, textAlign: 'right', marginTop: 4 },
  memberRow: { backgroundColor: '#1a2332', padding: 10, borderRadius: 6, marginBottom: 6, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  memberEmail: { color: '#94a3b8', fontSize: 10, fontFamily: 'monospace', textAlign: 'right', marginTop: 2 },
});

