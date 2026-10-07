// GroupsScreen.tsx — شبکه‌های خصوصی صرافان
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { initNetwork, loadNetSettings, getMyNetInfo, NET_CITIES } from './lib.network';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

export default function GroupsScreen({ showToast }: any) {
  const [net, setNet] = useState<any>({ connected: false, code: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', city: 'KBL' });
  const [joinCode, setJoinCode] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    await initNetwork();
    const info = getMyNetInfo();
    setNet(info);
    if (info.connected) await loadMyGroups();
    setLoading(false);
  }, []);

  const loadMyGroups = async () => {
    try {
      const firebase = require('firebase/compat/app');
      const db = firebase.database();
      const myCode = getMyNetInfo().code;
      const snap = await db.ref('agents/' + myCode + '/groups').once('value');
      const links: any[] = [];
      snap.forEach((c: any) => links.push({ id: c.key, ...c.val() }));
      const promises = links.map((l: any) => db.ref('groups/' + l.id + '/meta').once('value'));
      const metas = await Promise.all(promises);
      const result: any[] = [];
      metas.forEach((m: any, i: number) => {
        const v = m.val();
        if (v) result.push({ id: links[i].id, role: links[i].role, ...v });
      });
      result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setGroups(result);
    } catch (e: any) { console.log('load groups:', e); }
  };

  useEffect(() => { refresh(); }, [refresh]);

  const submitCreate = async () => {
    if (!createForm.name || createForm.name.length < 3) return showToast?.('نام حداقل ۳ کاراکتر', true);
    setSaving(true);
    try {
      const firebase = require('firebase/compat/app');
      const db = firebase.database();
      const myCode = getMyNetInfo().code;
      const myName = getMyNetInfo().name;
      const groupId = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const inviteCode = 'INV-' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const now = Date.now();
      const updates: any = {};
      updates['groups/' + groupId + '/meta'] = {
        name: createForm.name, ownerCode: myCode, ownerName: myName,
        city: createForm.city, inviteCode, createdAt: now, memberCount: 1, status: 'active',
      };
      updates['groups/' + groupId + '/members/' + myCode] = { name: myName, joinedAt: now, role: 'owner' };
      updates['agents/' + myCode + '/groups/' + groupId] = { role: 'owner', joinedAt: now };
      await db.ref().update(updates);
      showToast?.('✅ گروه ساخته شد — کد: ' + inviteCode);
      setCreateModal(false);
      setCreateForm({ name: '', city: 'KBL' });
      await loadMyGroups();
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!/^INV-[A-Z0-9]{8}$/.test(code)) return showToast?.('کد نامعتبر', true);
    setSaving(true);
    try {
      const firebase = require('firebase/compat/app');
      const db = firebase.database();
      const myCode = getMyNetInfo().code;
      const myName = getMyNetInfo().name;
      const snap = await db.ref('groups').once('value');
      let foundId = '', found: any = null;
      snap.forEach((c: any) => {
        const v = c.val();
        if (v && v.meta && v.meta.inviteCode === code && v.meta.status === 'active') { foundId = c.key; found = v; }
      });
      if (!foundId) throw new Error('گروهی با این کد یافت نشد');
      if (found.members && found.members[myCode]) throw new Error('قبلاً عضو هستید');
      const now = Date.now();
      const updates: any = {};
      updates['groups/' + foundId + '/members/' + myCode] = { name: myName, joinedAt: now, role: 'member' };
      updates['agents/' + myCode + '/groups/' + foundId] = { role: 'member', joinedAt: now };
      updates['groups/' + foundId + '/meta/memberCount'] = (found.meta.memberCount || 1) + 1;
      await db.ref().update(updates);
      showToast?.('✅ پیوستید');
      setJoinModal(false);
      setJoinCode('');
      await loadMyGroups();
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const viewDetail = async (groupId: string) => {
    try {
      const firebase = require('firebase/compat/app');
      const db = firebase.database();
      const [mSnap, memSnap] = await Promise.all([
        db.ref('groups/' + groupId + '/meta').once('value'),
        db.ref('groups/' + groupId + '/members').once('value'),
      ]);
      const meta = mSnap.val();
      const members: any[] = [];
      memSnap.forEach((c: any) => { const v = c.val(); if (v) members.push({ code: c.key, ...v }); });
      members.sort((a, b) => (a.role === 'owner' ? -1 : (b.role === 'owner' ? 1 : 0)));
      setDetailModal({ id: groupId, meta, members });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  if (!net.connected) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>🌐</Text>
        <Text style={s.emptyTxt}>ابتدا در شبکه صرافی ثبت‌نام کنید</Text>
        <Text style={s.emptySub}>به تب «بازار زنده» بروید و تنظیمات شبکه را وارد کنید</Text>
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
          <Text style={s.actBtnTxt}>🔑 پیوستن</Text>
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
            <View style={s.inviteBox}>
              <Text style={s.inviteLbl}>🔑 کد دعوت:</Text>
              <Text style={s.inviteCode}>{g.inviteCode}</Text>
            </View>
          )}
          <TouchableOpacity style={[s.btn, { backgroundColor: '#1e40af' }]} onPress={() => viewDetail(g.id)}>
            <Text style={s.btnTxt}>👁️ مشاهده جزئیات</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Create Modal */}
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

      {/* Join Modal */}
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

      {/* Detail Modal */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#1e3a8a' }]}>
            <Text style={s.mTitle}>👁️ جزئیات گروه</Text>
            <TouchableOpacity onPress={() => setDetailModal(null)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          {detailModal && (
            <ScrollView style={{ padding: 14 }}>
              <Text style={s.detailTitle}>{detailModal.meta?.name}</Text>
              <Text style={s.detailSub}>📍 {NET_CITIES[detailModal.meta?.city] || '—'} | 👑 {detailModal.meta?.ownerName}</Text>
              <Text style={s.secT}>👥 اعضا ({detailModal.members.length})</Text>
              {detailModal.members.map((m: any) => (
                <View key={m.code} style={s.memberRow}>
                  <Text style={s.memberName}>{m.name} {m.code === net.code ? '(شما)' : ''}</Text>
                  <Text style={s.memberCode}>{m.code}</Text>
                  <Text style={[s.role, m.role === 'owner' ? s.roleOwner : s.roleMember]}>
                    {m.role === 'owner' ? '👑' : '👤'}
                  </Text>
                </View>
              ))}
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => setDetailModal(null)}>
                <Text style={s.btnTxt}>بستن</Text>
              </TouchableOpacity>
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
  roleOwner: { backgroundColor: '#fef3c7', color: '#92400e' },
  roleMember: { backgroundColor: '#dbeafe', color: '#1e40af' },
  inviteBox: { backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginBottom: 8 },
  inviteLbl: { color: '#94a3b8', fontSize: 10, textAlign: 'right' },
  inviteCode: { color: '#00ff88', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', marginTop: 2 },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  empty: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyTxt: { color: '#d4af37', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  emptySub: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
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
  detailTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  detailSub: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginTop: 4 },
  memberRow: { backgroundColor: '#1a2332', padding: 10, borderRadius: 6, marginBottom: 6, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { color: '#fff', fontSize: 12, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  memberCode: { color: '#7c3aed', fontSize: 10, fontFamily: 'monospace', marginLeft: 6 },
});
