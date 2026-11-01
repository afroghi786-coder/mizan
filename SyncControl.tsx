import { displayDate, displayDateOnly } from './lib-date';
// SyncControl.tsx — کلید Online/Offline + مودال sync
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import {
  getMode, setMode, subscribeMode, loadMode,
  getQueueCount, syncToServer, pullFromServer, clearQueue, prepareOffline,
} from './lib.offline';
import { getQueueDetails, retryFailed, clearFailedItems, getUnseenAuditCount, markAuditSeen, getAuditEvents } from './lib.offline';
import { syncByDestination, getSyncDestination, getConflicts } from './lib.sheets';

export default function SyncControl({ showToast, compact }: any) {
  const [mode, setModeLocal] = useState<'online' | 'offline'>('online');
  const [queue, setQueue] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [auditUnseen, setAuditUnseen] = useState(0);
  const [auditPreview, setAuditPreview] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const [queueDetailModal, setQueueDetailModal] = useState(false);
  const [queueDetailList, setQueueDetailList] = useState<any[]>([]);

  useEffect(() => {
    loadMode().then(setModeLocal);
    const unsub = subscribeMode(setModeLocal);
    const tick = setInterval(async () => {
      try { setQueue(await getQueueCount()); } catch {}
      try { const c = await getConflicts(); setConflictCount(Array.isArray(c) ? c.length : 0); } catch {}
      try { setAuditUnseen(await getUnseenAuditCount()); const evs = await getAuditEvents(); setAuditPreview(Array.isArray(evs) ? evs.slice(-3).reverse() : []); } catch {}
    }, 3000);
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
      const dest = await getSyncDestination();
      const r = await syncByDestination((done: number, total: number) => setSyncProgress({ done, total }));
      if (dest !== 'private') { await pullFromServer(); }
      setQueue(await getQueueCount());
      const destLabel = dest === 'private' ? 'فضای اختصاصی' : dest === 'both' ? 'هر دو مقصد' : 'سرور مرکزی';
      showToast('✅ ' + r.ok + ' مورد در ' + destLabel + ' ذخیره شد' + (r.fail ? ' — ' + r.fail + ' ناموفق' : ''));
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

  const OP_FA: Record<string, string> = {
    createSale: 'ثبت فروش', updateSale: 'ویرایش فروش', deleteSale: 'حذف فروش',
    createPurchase: 'ثبت خرید', updatePurchase: 'ویرایش خرید', deletePurchase: 'حذف خرید',
    createExpense: 'ثبت هزینه', updateExpense: 'ویرایش هزینه', deleteExpense: 'حذف هزینه',
    createEmployee: 'ثبت کارمند', updateEmployee: 'ویرایش کارمند', deleteEmployee: 'حذف کارمند',
    createAttendance: 'ثبت حضور', updateAttendance: 'ویرایش حضور', deleteAttendance: 'حذف حضور',
    createSalaryPayment: 'ثبت حقوق', updateSalaryPayment: 'ویرایش حقوق', deleteSalaryPayment: 'حذف حقوق',
    createLoan: 'ثبت وام', updateLoan: 'ویرایش وام', deleteLoan: 'حذف وام',
    createLeave: 'ثبت مرخصی', updateLeave: 'ویرایش مرخصی', deleteLeave: 'حذف مرخصی',
    createBatch: 'ثبت لیست حقوق', updateBatch: 'ویرایش لیست حقوق', deleteBatch: 'حذف لیست حقوق',
    createParty: 'ثبت طرف‌حساب', updateParty: 'ویرایش طرف‌حساب', deleteParty: 'حذف طرف‌حساب',
    createPartner: 'ثبت شریک', updatePartner: 'ویرایش شریک', deletePartner: 'حذف شریک',
    createPBA: 'ثبت حساب بانکی شریک', deletePBA: 'حذف حساب بانکی شریک',
    createPTX: 'ثبت حرکت شریک', deletePTX: 'حذف حرکت شریک',
    createBank: 'ثبت بانک', updateBank: 'ویرایش بانک', deleteBank: 'حذف بانک',
    createShipping: 'ثبت باربری', updateShipping: 'ویرایش باربری', deleteShipping: 'حذف باربری',
    createProduct: 'ثبت کالا', updateProduct: 'ویرایش کالا', deleteProduct: 'حذف کالا',
    createStockAdjustment: 'ثبت تعدیل انبار', deleteStockAdjustment: 'حذف تعدیل انبار',
    updateSettings: 'ویرایش تنظیمات',
  };
  const faOp = (op: string) => OP_FA[op] || op;

  const cancelSync = () => {
    setModal(false);
    showToast?.('لغو شد — حالت تغییر نکرد');
  };

const modalJSX = (
    <Modal visible={modal} transparent animationType="fade">
      <View style={s.bg}>
        <View style={s.box}>
          <Text style={s.title}>📤 ذخیره داده‌ها</Text>
          <Text style={s.desc}>
            {queue > 0
              ? queue + ' مورد در حالت آفلاین ذخیره شده.\nحالا در مقصد انتخاب‌شده ذخیره شود؟'
              : 'موردی برای آپلود نیست.\nحالت به آنلاین تغییر کند؟'}
          </Text>
          {auditUnseen > 0 ? (
            <View style={{ backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#0ea5e9', borderRadius: 8, padding: 8, marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: '#075985', textAlign: 'right', fontWeight: 'bold' }}>
                📜 {auditUnseen} تغییر جدید در تاریخچه تعدیلات
              </Text>
              {auditPreview.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  {auditPreview.map((ev: any, i: number) => (
                    <Text key={i} style={{ fontSize: 10, color: '#0c4a6e', textAlign: 'right', marginTop: 2 }} numberOfLines={1}>
                      • {ev.summary || ev.type || 'رویداد'} {ev.table ? '(' + ev.table + ')' : ''} {ev.at ? '— ' + String(ev.at).slice(0, 16) : ''}
                    </Text>
                  ))}
                </View>
              )}
              <TouchableOpacity onPress={async () => { await markAuditSeen(); setAuditUnseen(0); setAuditPreview([]); }} style={{ marginTop: 6, backgroundColor: '#0ea5e9', paddingVertical: 6, borderRadius: 6 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>✅ دیدم</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {conflictCount > 0 ? (
            <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, padding: 8, marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: '#92400e', textAlign: 'right' }}>
                ⚠️ {conflictCount} تضاد ثبت شده — از تنظیمات → گزارش تضاد بررسی کنید
              </Text>
            </View>
          ) : null}
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
                            <TouchableOpacity accessibilityLabel="انصراف" style={[s.btn, { backgroundColor: '#475569' }]} onPress={cancelSync}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
<TouchableOpacity accessibilityLabel="فقط آنلاین شو" style={[s.btn, { backgroundColor: '#64748b' }]} onPress={skipSync}>
                <Text style={s.btnTxt}>فقط آنلاین شو</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="بله، آپلود کن" style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={confirmSync}>
                <Text style={s.btnTxt}>✅ بله، ذخیره کن</Text>
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
                    <Text style={{ color: "#0f2438", fontWeight: "bold", fontSize: 12 }}>{it.failed ? "❌ " : "⏳ "}{faOp(it.op)}</Text>
                    <Text style={{ color: "#64748b", fontSize: 11 }}>تلاش: {it.attempts}</Text>
                  </View>
                  {it.label ? <Text style={{ color: "#334155", fontSize: 11, marginTop: 4 }} numberOfLines={1}>شناسه: {it.label}</Text> : null}
                  {it.ts ? <Text style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>زمان: {new Date(it.ts).toLocaleString('fa-IR')}</Text> : null}
                  {it.payload ? <Text style={{ color: "#475569", fontSize: 10, marginTop: 2 }} numberOfLines={1}>جزئیات: {typeof it.payload === 'string' ? it.payload : JSON.stringify(it.payload).slice(0, 90)}</Text> : null}
                  {it.lastError ? <Text style={{ color: "#dc2626", fontSize: 10, marginTop: 2 }} numberOfLines={2}>خطا: {it.lastError}</Text> : null}
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
                  <Text style={s.btnTxt}>🗑️ پاک کردن ناموفق‌ها</Text>
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
