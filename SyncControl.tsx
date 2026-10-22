import { displayDate, displayDateOnly } from './lib-date';
// SyncControl.tsx — کلید Online/Offline + مودال sync
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import {
  getMode, setMode, subscribeMode, loadMode,
  getQueueCount, syncToServer, pullFromServer, clearQueue, prepareOffline,
} from './lib.offline';
import { getQueueDetails, retryFailed, clearFailedItems } from './lib.offline';

export default function SyncControl({ showToast, compact }: any) {
  const [mode, setModeLocal] = useState<'online' | 'offline'>('online');
  const [queue, setQueue] = useState(0);
  const [modal, setModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const [queueDetailModal, setQueueDetailModal] = useState(false);
  const [queueDetailList, setQueueDetailList] = useState<any[]>([]);

  useEffect(() => {
    loadMode().then(setModeLocal);
    const unsub = subscribeMode(setModeLocal);
    const tick = setInterval(async () => setQueue(await getQueueCount()), 3000);
    return () => { unsub(); clearInterval(tick); };
  }, []);

  const toggle = async () => {
    if (mode === 'offline') {
      setModal(true);
    } else {
      showToast('⏳ در حال آماده‌سازی آفلاین...');
      await prepareOffline();
      await setMode('offline');
      showToast('🔴 آفلاین — همه‌چیز آماده است');
    }
  };

    const openQueueDetail = async () => {
    const list = await getQueueDetails();
    setQueueDetailList(list);
    setQueueDetailModal(true);
  };
  const doRetryFailed = async () => {
    const n = await retryFailed();
    setQueueDetailList(await getQueueDetails());
    setQueue(await getQueueCount());
    if (showToast) showToast("🔄 " + n + " مورد برای تلاش مجدد");
  };
  const doClearFailed = async () => {
    const n = await clearFailedItems();
    setQueueDetailList(await getQueueDetails());
    setQueue(await getQueueCount());
    if (showToast) showToast("🗑️ " + n + " مورد پاک شد");
  };
const confirmSync = async () => {
    setSyncing(true);
    try {
      await setMode('online');
      setSyncProgress({ done: 0, total: 0 });
      const r = await syncToServer((done: number, total: number) => setSyncProgress({ done, total }));
      await pullFromServer();
      setQueue(await getQueueCount());
      showToast('✅ ' + r.ok + ' مورد ذخیره شد' + (r.fail ? ' — ' + r.fail + ' ناموفق' : ''));
      setModal(false);
    } catch (e: any) {
      showToast(e?.message || 'خطا در sync', true);
    } finally { setSyncing(false); }
  };

  const skipSync = async () => {
    await setMode('online');
    setModal(false);
    showToast('🟢 آنلاین — بدون sync');
  };

  const modalJSX = (
    <Modal visible={modal} transparent animationType="fade">
      <View style={s.bg}>
        <View style={s.box}>
          <Text style={s.title}>📤 آپلود به سرور؟</Text>
          <Text style={s.desc}>
            {queue > 0
              ? queue + ' مورد در حالت آفلاین ذخیره شده.\nحالا آپلود شود به سرور مرکزی؟'
              : 'موردی برای آپلود نیست.\nحالت به آنلاین تغییر کند؟'}
          </Text>
          {mode === 'offline' && queue > 0 && (
            <TouchableOpacity
              style={{ backgroundColor: "#334155", paddingVertical: 10, borderRadius: 10, marginTop: 12, alignItems: "center" }}
              onPress={openQueueDetail}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>📋 مشاهده صف ({queue})</Text>
            </TouchableOpacity>
          )}

          {syncing ? (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
            <ActivityIndicator color="#059669" />
            {syncProgress.total > 0 && (
              <Text style={{ color: '#475569', marginTop: 8, fontSize: 12 }}>
                {syncProgress.done} / {syncProgress.total}
              </Text>
            )}
          </View>
          ) : (
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity accessibilityLabel="فقط آنلاین شو" style={[s.btn, { backgroundColor: '#64748b' }]} onPress={skipSync}>
                <Text style={s.btnTxt}>فقط آنلاین شو</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="بله، آپلود کن" style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={confirmSync}>
                <Text style={s.btnTxt}>✅ بله، آپلود کن</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // ─── حالت compact (دکمه کوچک) ───
  const queueDetailModalJSX = (
    <Modal visible={queueDetailModal} transparent animationType="slide" onRequestClose={() => setQueueDetailModal(false)}>
      <View style={s.bg}>
        <View style={[s.box, { maxHeight: 500 }]}>
          <Text style={s.title}>📋 جزئیات صف ({queueDetailList.length})</Text>
          <ScrollView style={{ maxHeight: 350, marginTop: 8 }}>
            {queueDetailList.length === 0 && (
              <Text style={{ color: "#64748b", textAlign: "center", padding: 20 }}>صف خالی است</Text>
            )}
            {queueDetailList.map(function(it, i) {
              return (
                <View key={i} style={{ padding: 10, marginBottom: 6, borderRadius: 8, backgroundColor: it.failed ? "#fee2e2" : "#f1f5f9", borderWidth: 1, borderColor: it.failed ? "#ef4444" : "#e2e8f0" }}>
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
                    <Text style={{ color: "#0f2438", fontWeight: "bold", fontSize: 12 }}>{it.failed ? "❌ " : "⏳ "}{it.op}</Text>
                    <Text style={{ color: "#64748b", fontSize: 11 }}>تلاش: {it.attempts}</Text>
                  </View>
                  {it.label ? <Text style={{ color: "#334155", fontSize: 11, marginTop: 4 }} numberOfLines={1}>{it.label}</Text> : null}
                  {it.lastError ? <Text style={{ color: "#dc2626", fontSize: 10, marginTop: 2 }} numberOfLines={2}>{it.lastError}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[s.btn, { backgroundColor: "#64748b" }]} onPress={() => setQueueDetailModal(false)}>
              <Text style={s.btnTxt}>بستن</Text>
            </TouchableOpacity>
            {queueDetailList.some(function(x) { return x.failed; }) && (
              <View style={{ flex: 2, flexDirection: "row-reverse", gap: 8 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: "#dc2626", flex: 1 }]} onPress={doClearFailed}>
                  <Text style={s.btnTxt}>🗑️ پاک failed</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: "#059669", flex: 2 }]} onPress={doRetryFailed}>
                  <Text style={s.btnTxt}>🔄 تلاش مجدد</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  if (compact) {
    return (
      <>
        <TouchableOpacity onPress={toggle} style={[
          s.compactBtn,
          { borderColor: mode === 'online' ? '#059669' : '#64748b' },
        ]}>
          <Text style={{ fontSize: 18 }}>{mode === 'online' ? '🟢' : '🔴'}</Text>
          {mode === 'offline' && queue > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{queue}</Text>
            </View>
          )}
        </TouchableOpacity>
        {modalJSX}
      {queueDetailModalJSX}
      </>
    );
  }

  // ─── حالت نوار ───
  return (
    <>
      <TouchableOpacity onPress={toggle} style={[
        s.bar,
        { backgroundColor: mode === 'online' ? '#059669' : '#64748b' },
      ]}>
        <Text style={s.txt}>
          {mode === 'online' ? '🟢 آنلاین' : '🔴 آفلاین'}
          {mode === 'offline' && queue > 0 ? '  •  ' + queue + ' مورد در انتظار' : ''}
        </Text>
      </TouchableOpacity>
      {modalJSX}
      {queueDetailModalJSX}
    </>
  );
}

const s = StyleSheet.create({
  bar: { paddingVertical: 6, alignItems: 'center' },
  txt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  compactBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#dc2626', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 12 },
  desc: { fontSize: 13, color: '#475569', textAlign: 'right', lineHeight: 22 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
