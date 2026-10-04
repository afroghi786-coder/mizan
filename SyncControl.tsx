// SyncControl.tsx — کلید Online/Offline + مودال sync
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import {
  getMode, setMode, subscribeMode, loadMode,
  getQueueCount, syncToServer, pullFromServer, clearQueue, prepareOffline,
} from './lib.offline';

export default function SyncControl({ showToast }: any) {
  const [mode, setModeLocal] = useState<'online' | 'offline'>('online');
  const [queue, setQueue] = useState(0);
  const [modal, setModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  const confirmSync = async () => {
    setSyncing(true);
    try {
      await setMode('online');
      const r = await syncToServer();
      await pullFromServer();
      await clearQueue();
      setQueue(0);
      showToast(`✅ ${r.ok} مورد ذخیره شد${r.fail ? ` — ${r.fail} ناموفق` : ''}`);
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

  return (
    <>
      <TouchableOpacity onPress={toggle} style={[
        s.bar,
        { backgroundColor: mode === 'online' ? '#059669' : '#64748b' },
      ]}>
        <Text style={s.txt}>
          {mode === 'online' ? '🟢 آنلاین' : '🔴 آفلاین'}
          {queue > 0 ? `  •  ${queue} مورد در انتظار` : ''}
        </Text>
      </TouchableOpacity>

      <Modal visible={modal} transparent animationType="fade">
        <View style={s.bg}>
          <View style={s.box}>
            <Text style={s.title}>📤 آپلود به سرور؟</Text>
            <Text style={s.desc}>
              {queue > 0
                ? `${queue} مورد در حالت آفلاین ذخیره شده.\nحالا آپلود شود به سرور مرکزی؟`
                : 'موردی برای آپلود نیست.\nحالت به آنلاین تغییر کند؟'}
            </Text>
            {syncing ? (
              <ActivityIndicator color="#059669" style={{ marginTop: 16 }} />
            ) : (
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={skipSync}>
                  <Text style={s.btnTxt}>فقط آنلاین شو</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={confirmSync}>
                  <Text style={s.btnTxt}>✅ بله، آپلود کن</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  bar: { paddingVertical: 6, alignItems: 'center' },
  txt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 12 },
  desc: { fontSize: 13, color: '#475569', textAlign: 'right', lineHeight: 22 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
