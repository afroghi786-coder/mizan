import { captureRef } from 'react-native-view-shot';
import { Alert } from 'react-native';
import { Platform } from 'react-native';
import React from 'react';
import { buildStandardHtml, shareHtmlAsPdf, printHtml, exportExcel, numToWords, currencyLabel, mizanSignaturesHtml, mizanComputerNoteHtml } from './lib.share';
import { toStorageDateFull } from './lib';;
import DateField from './lib.datefield';;
// BoxesScreen.tsx — صندوق استاندارد با کاردکس و تراکنش
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getBoxes, saveBox, deleteBox, getBoxTransactions, addBoxTransaction, deleteBoxTransaction, getAllBalances, getBoxKardex, doTransfer, migrateOldTransfers, TYPE_LABEL } from './lib.boxes';

const CUR: Record<string, { name: string; flag: string; dec: number }> = {
  AFN: { name: 'افغانی', flag: '🇦🇫', dec: 0 },
  USD: { name: 'دالر امریکایی', flag: '🇺🇸', dec: 2 },
  EUR: { name: 'یورو', flag: '🇪🇺', dec: 2 },
  GBP: { name: 'پوند انگلیس', flag: '🇬🇧', dec: 2 },
  PKR: { name: 'کلدار پاکستان', flag: '🇵🇰', dec: 0 },
  IRR: { name: 'ریال ایران', flag: '🇮🇷', dec: 0 },
  TOM: { name: 'تومان ایران', flag: '🇮🇷', dec: 0 },
  AED: { name: 'درهم امارات', flag: '🇦🇪', dec: 2 },
  SAR: { name: 'ریال سعودی', flag: '🇸🇦', dec: 2 },
  TRY: { name: 'لیر ترکیه', flag: '🇹🇷', dec: 2 },
  CNY: { name: 'یوان چین', flag: '🇨🇳', dec: 2 },
  INR: { name: 'روپیه هند', flag: '🇮🇳', dec: 0 },
  JPY: { name: 'ین ژاپن', flag: '🇯🇵', dec: 0 },
  CHF: { name: 'فرانک سوئیس', flag: '🇨🇭', dec: 2 },
  CAD: { name: 'دلار کانادا', flag: '🇨🇦', dec: 2 },
  AUD: { name: 'دلار استرالیا', flag: '🇦🇺', dec: 2 },
  KWD: { name: 'دینار کویت', flag: '🇰🇼', dec: 3 },
  QAR: { name: 'ریال قطر', flag: '🇶🇦', dec: 2 },
  OMR: { name: 'ریال عمان', flag: '🇴🇲', dec: 3 },
  BHD: { name: 'دینار بحرین', flag: '🇧🇭', dec: 3 },
  JOD: { name: 'دینار اردن', flag: '🇯🇴', dec: 3 },
  IQD: { name: 'دینار عراق', flag: '🇮🇶', dec: 0 },
  MYR: { name: 'رینگیت مالزی', flag: '🇲🇾', dec: 2 },
  RUB: { name: 'روبل روسیه', flag: '🇷🇺', dec: 2 },
  TJS: { name: 'سامانی تاجیکستان', flag: '🇹🇯', dec: 2 },
  UZS: { name: 'سوم ازبکستان', flag: '🇺🇿', dec: 0 },
  TMT: { name: 'منات ترکمنستان', flag: '🇹🇲', dec: 2 },
  KGS: { name: 'سوم قرقیزستان', flag: '🇰🇬', dec: 2 },
  KZT: { name: 'تنگه قزاقستان', flag: '🇰🇿', dec: 2 },
  AZN: { name: 'منات آذربایجان', flag: '🇦🇿', dec: 2 },
  HKD: { name: 'دلار هنگ‌کنگ', flag: '🇭🇰', dec: 2 },
  SGD: { name: 'دلار سنگاپور', flag: '🇸🇬', dec: 2 },
  THB: { name: 'بات تایلند', flag: '🇹🇭', dec: 2 },
  EGP: { name: 'جنيه مصر', flag: '🇪🇬', dec: 2 },
  LYD: { name: 'دینار لیبی', flag: '🇱🇾', dec: 3 },
  SYP: { name: 'لیره سوریه', flag: '🇸🇾', dec: 0 },
  LBP: { name: 'لیره لبنان', flag: '🇱🇧', dec: 0 },
  YER: { name: 'ریال یمن', flag: '🇾🇪', dec: 0 },
  ETB: { name: 'بیر اتیوپی', flag: '🇪🇹', dec: 2 },
  NOK: { name: 'کرون نروژ', flag: '🇳🇴', dec: 2 },
  SEK: { name: 'کرون سوئد', flag: '🇸🇪', dec: 2 },
  DKK: { name: 'کرون دانمارک', flag: '🇩🇰', dec: 2 },
  NZD: { name: 'دلار نیوزیلند', flag: '🇳🇿', dec: 2 },
  ZAR: { name: 'رند افریقای جنوبی', flag: '🇿🇦', dec: 2 },
};
const fmt = (n: any, d = 2) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export default function BoxesScreen({ showToast, buyers, filterName }: any) {
  const [deepFilter, setDeepFilter] = React.useState('');
  const [boxes, setBoxes] = useState<any[]>([]);

  // 🔍 فیلتر صندوق‌ها بر اساس deepFilter
  const filteredBoxes = React.useMemo(() => {
    if (!deepFilter || !deepFilter.trim()) return boxes;
    const q = String(deepFilter).toLowerCase().trim();
    return (boxes || []).filter((b: any) =>
      String(b.name || '').toLowerCase().includes(q) ||
      String(b.code || '').toLowerCase().includes(q) ||
      String(b.owner_code || '').toLowerCase().includes(q) ||
      String(b.owner_name || '').toLowerCase().includes(q)
    );
  }, [boxes, deepFilter]);

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBox, setSelectedBox] = useState<any>(null);
  const [kardex, setKardex] = useState<any[]>([]);
  const [boxModal, setBoxModal] = useState(false);
  const [boxForm, setBoxForm] = useState<any>({});
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState<any>({});
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState<any>({});
  const [showOwnerPick, setShowOwnerPick] = useState(false);
  const [showBoxCur, setShowBoxCur] = useState(false);
  const [boxCurSearch, setBoxCurSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await migrateOldTransfers();
      setBoxes(await getBoxes());
      setBalances(await getAllBalances());
    } catch (e: any) { showToast?.('خطا: ' + e.message, true); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openKardex = async (box: any) => {
    setSelectedBox(box);
    setKardex(await getBoxKardex(box.id || box.local_id));
  };

  const saveBoxHandler = async () => {
    if (!boxForm.name) return showToast?.('نام الزامی', true);
    setSaving(true);
    try {
      await saveBox({ ...boxForm, opening: Number(boxForm.opening) || 0 });
      showToast?.('✅ ذخیره شد');
      setBoxModal(false); setBoxForm({});
      await load();
    } catch (e: any) { showToast?.('خطا: ' + e.message, true); }
    finally { setSaving(false); }
  };

  const saveTxHandler = async () => {
    const amount = Number(txForm.amount) || 0;
    if (amount <= 0) return showToast?.('مبلغ الزامی', true);
    if (!selectedBox) return;
    setSaving(true);
    try {
      const t = txForm.type;
      await addBoxTransaction({
        box_id: selectedBox.id || selectedBox.local_id, box_code: selectedBox.code,
        type: t, currency: selectedBox.currency,
        in: (t === 'deposit' || t === 'fee_in' || t === 'adjust_in') ? amount : 0,
        out: (t === 'withdraw' || t === 'fee_out' || t === 'adjust_out') ? amount : 0,
        counterparty_code: txForm.counterparty_code || '', counterparty_name: txForm.counterparty_name || '',
        description: txForm.description || '', date: txForm.date || new Date().toLocaleDateString('fa-IR'),
      });
      showToast?.('✅ ثبت شد');
      setTxModal(false); setTxForm({});
      await openKardex(selectedBox); await load();
    } catch (e: any) { showToast?.('خطا: ' + e.message, true); }
    finally { setSaving(false); }
  };

  const saveTransfer = async () => {
    if (!transferForm.from_box_code || !transferForm.to_box_code) return showToast?.('صندوق‌ها را انتخاب کن', true);
    if (transferForm.from_box_code === transferForm.to_box_code) return showToast?.('صندوق‌ها یکسانند', true);
    const amt = Number(transferForm.amount) || 0;
    if (amt <= 0) return showToast?.('مبلغ الزامی', true);
    const fromBox = boxes.find((b: any) => b.code === transferForm.from_box_code);
    const toBox = boxes.find((b: any) => b.code === transferForm.to_box_code);
    const sameCur = (fromBox?.currency || '') === (toBox?.currency || '');
    const rate = sameCur ? 1 : (Number(transferForm.rate) || 0);
    const result = sameCur ? amt : amt * rate;
    if (!sameCur && rate <= 0) return showToast?.('نرخ تبدیل الزامی', true);
    setSaving(true);
    try {
      await doTransfer({
        from_box_code: transferForm.from_box_code,
        to_box_code: transferForm.to_box_code,
        amount: amt,
        to_amount: result,
        rate: rate,
        from_currency: fromBox?.currency || '',
        to_currency: toBox?.currency || '',
        date: transferForm.date || new Date().toLocaleDateString('fa-IR'),
        description: transferForm.description || '',
      });
      showToast?.('✅ ' + (sameCur ? 'انتقال' : 'تبدیل') + ' ثبت شد');
      setTransferModal(false); setTransferForm({});
      await load();
    } catch (e: any) { showToast?.('خطا: ' + e.message, true); }
    finally { setSaving(false); }
  };

  const buildKardexHtml = () => {
    if (!selectedBox) return '';
    const dec = CUR[selectedBox.currency]?.dec || 2;
    const curLbl = currencyLabel(selectedBox.currency);
    const first = kardex.length > 0 ? kardex[0] as any : null;
    const last = kardex.length > 0 ? kardex[kardex.length - 1] as any : null;
    const opening = first ? (Number(first.running) || 0) - (Number(first.in) || 0) + (Number(first.out) || 0) : 0;
    let totalIn = 0, totalOut = 0;
    kardex.forEach((r: any) => { totalIn += Number(r.in) || 0; totalOut += Number(r.out) || 0; });
    const closing = last ? (Number(last.running) || 0) : 0;
    const period = (first && last && first.date && last.date) ? (first.date + ' تا ' + last.date) : '—';
    const serial = 'KX-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + (selectedBox.code || 'X');
    const rows = kardex.map((r: any, i: number) => '<tr><td>' + (i + 1) + '</td><td>' + (r.date || '—') + '</td><td>' + (r.code || '—') + '</td><td>' + (r.type_label || '—') + '</td><td>' + (r.description || '—') + '</td><td>' + (r.in ? fmt(r.in, dec) : '—') + '</td><td>' + (r.out ? fmt(r.out, dec) : '—') + '</td><td>' + fmt(r.running, dec) + '</td></tr>').join('');
    const totalsRow = '<tr class="total"><td colspan="5" style="text-align:left;font-weight:bold">جمع کل</td><td style="color:#059669;font-weight:bold">' + fmt(totalIn, dec) + '</td><td style="color:#dc2626;font-weight:bold">' + fmt(totalOut, dec) + '</td><td style="font-weight:bold">' + fmt(closing, dec) + '</td></tr>';
    const info = '<div class="info">' +
      '<b>🆔 کد:</b> ' + (selectedBox.code || '—') + ' &nbsp;|&nbsp; ' +
      '<b>💱 ارز:</b> ' + (selectedBox.currency || '—') + ' (' + curLbl + ') &nbsp;|&nbsp; ' +
      '<b>👤 صاحب:</b> ' + (selectedBox.owner_name || '—') +
      '<br><b>📅 دوره:</b> ' + period +
      '<br><b>📄 شماره سند:</b> ' + serial +
      '</div>';
    const summary = '<div class="info">' +
      '<b>💰 مانده اول دوره:</b> ' + fmt(opening, dec) + ' ' + curLbl + ' &nbsp;|&nbsp; ' +
      '<b>📥 جمع ورودی:</b> ' + fmt(totalIn, dec) + ' ' + curLbl + ' &nbsp;|&nbsp; ' +
      '<b>📤 جمع خروجی:</b> ' + fmt(totalOut, dec) + ' ' + curLbl +
      '<br><b>💵 مانده آخر دوره:</b> ' + fmt(closing, dec) + ' ' + curLbl +
      '</div>';
    const table = '<table><tr><th>#</th><th>تاریخ</th><th>سند</th><th>نوع</th><th>شرح</th><th>ورودی</th><th>خروجی</th><th>مانده</th></tr>' + rows + totalsRow + '</table>';
    const netWords = '<div class="net-words">مانده آخر دوره به حروف: ' + numToWords(closing) + ' ' + curLbl + '</div>';
    const body = info + summary + table + netWords + mizanSignaturesHtml() + mizanComputerNoteHtml();
    return buildStandardHtml('کاردکس صندوق ' + selectedBox.name, body, '📦 ' + selectedBox.code);
  };
  const exportKardexExcel = async () => {
    try {
      const data = kardex.map((r: any, i: number) => ({
        '#': i + 1, 'تاریخ': r.date || '', 'سند': r.code || '', 'نوع': r.type_label || '',
        'شرح': r.description || '', 'ورودی': r.in || 0, 'خروجی': r.out || 0, 'مانده': r.running || 0
      }));
      const r = await exportExcel([{ name: 'کاردکس', data }], 'kardex-' + (selectedBox?.code || 'box') + '-' + Date.now() + '.xlsx');
      showToast?.(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast?.('خطا: ' + e.message, true); }
  };
  const printKardex = async () => {
    if (!selectedBox) { showToast?.('صندوقی انتخاب نشده', true); return; }
    const html = buildKardexHtml();
    if (!html) return;
    if (Platform.OS === 'web') { const r = await printHtml(html); showToast?.(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); return; }
    Alert.alert('خروجی کاردکس', 'نوع خروجی را انتخاب کنید', [
      { text: '📷 تصویر / اشتراک', onPress: shareKardexAsImage },
      { text: 'PDF / اشتراک', onPress: async () => { const r = await shareHtmlAsPdf(html, 'kardex-' + selectedBox.code + '-' + Date.now() + '.pdf'); showToast?.(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } },
      { text: 'چاپ', onPress: async () => { const r = await printHtml(html); showToast?.(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } },
      { text: 'اکسل', onPress: exportKardexExcel },
      { text: 'لغو', style: 'cancel' }
    ]);
  };;
  const kardexImageRef = useRef<any>(null);
  const [imageCaptureMode, setImageCaptureMode] = useState(false);
  const shareKardexAsImage = async () => {
    if (!selectedBox) { showToast?.('صندوقی انتخاب نشده', true); return; }
    setImageCaptureMode(true);
    await new Promise(function(r){ setTimeout(r, 400); });
    try {
      if (!kardexImageRef.current) throw new Error('ref null');
      const uri = await captureRef(kardexImageRef.current, { format: 'jpg', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'اشتراک تصویر کاردکس' });
        showToast?.('✅ تصویر آماده شد');
      } else {
        showToast?.('اشتراک پشتیبانی نمی‌شود', true);
      }
    } catch (e: any) {
      showToast?.('خطا: ' + (e?.message || ''), true);
    } finally {
      setImageCaptureMode(false);
    }
  };

  // ═══ کادر جزئیات صندوق ═══
  if (selectedBox) {
    const bal = balances[selectedBox.id || selectedBox.local_id] || 0;
    const col = bal > 0 ? '#00ff88' : bal < 0 ? '#ff3355' : '#94a3b8';
    return (
      <View style={{ flex: 1 }}>

        {/* 🔍 جستجوی صندوق */}
        <View style={{ flexDirection: 'row-reverse', padding: 10, gap: 8, alignItems: 'center' }}>
          <TextInput accessibilityLabel="🔍 جستجوی صندوق (اسم / کد)"
            style={{ flex: 1, backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: deepFilter ? '#f59e0b' : '#334155', borderRadius: 8, padding: 10, textAlign: 'right', fontSize: 13 }}
            value={deepFilter}
            onChangeText={setDeepFilter}
            placeholder="🔍 جستجوی صندوق (اسم / کد)"
            placeholderTextColor="#64748b"
          />
          {deepFilter ? (
            <TouchableOpacity onPress={() => setDeepFilter('')} style={{ backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{ backgroundColor: '#065f46', padding: 12, borderRadius: 10 }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>📦 {selectedBox.name}</Text>
              <Text style={{ color: '#a7f3d0', fontSize: 11, marginTop: 4 }}>🆔 {selectedBox.code} | 💱 {CUR[selectedBox.currency]?.flag} {selectedBox.currency}</Text>
              {selectedBox.owner_name ? <Text style={{ color: '#a7f3d0', fontSize: 11 }}>👤 {selectedBox.owner_name}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#a7f3d0', fontSize: 10 }}>موجودی</Text>
              <Text style={{ color: col, fontSize: 22, fontWeight: 'bold' }}>{fmt(bal, CUR[selectedBox.currency]?.dec || 2)}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {[['➕ واریز','deposit','#059669'],['➖ برداشت','withdraw','#dc2626'],['💰 کارمزد','fee_out','#d97706'],['⚖️ تعدیل','adjust_in','#7c3aed']].map(([lbl,ty,bg]) => (
            <TouchableOpacity key={ty as string} onPress={() => { setTxForm({ type: ty as string, amount: '', date: toStorageDateFull(new Date()) }); setTxModal(true); }}
              style={{ backgroundColor: bg as string, paddingVertical: 10, borderRadius: 8, flex: 1, minWidth: 90 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>{lbl as string}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <TouchableOpacity accessibilityLabel="پرینت" onPress={printKardex} style={{ backgroundColor: '#8e44ad', paddingVertical: 10, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>🖨️ پرینت</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="برگشت" onPress={() => setSelectedBox(null)} style={{ backgroundColor: '#64748b', paddingVertical: 10, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>↩️ برگشت</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#d4af37', fontSize: 13, fontWeight: 'bold', marginTop: 12, marginBottom: 6, textAlign: 'right' }}>📋 کاردکس ({kardex.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={s.tblHeader}>
              {['#','تاریخ','سند','نوع','👤 طرف حساب','شرح','ورودی','خروجی','مانده','حذف'].map((h,i) => (
                <Text key={i} style={[s.th, { width: [36,90,90,120,160,180,100,100,110,60][i] }]}>{h}</Text>
              ))}
            </View>
            {kardex.map((r: any, i: number) => (
              <View key={r.id || i} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#0a1628' }]}>
                <Text style={[s.td, { width: 36, color: '#d4af37' }]}>{i + 1}</Text>
                <Text style={[s.td, { width: 90, color: '#94a3b8', fontSize: 10 }]}>{r.date || '—'}</Text>
                <Text style={[s.td, { width: 90, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{r.code || '—'}</Text>
                <Text style={[s.td, { width: 120, color: '#e2e8f0', fontSize: 10 }]}>{r.type_label || '—'}</Text>
                <Text style={[s.td, { width: 160, color: '#00ff88', fontSize: 10, fontWeight: 'bold' }]} numberOfLines={2}>{r.counterparty_code ? '🆔 ' + r.counterparty_code : (r.owner_code ? '👤 ' + r.owner_code : '—')}{r.counterparty_name ? '\n' + r.counterparty_name : ''}</Text>
                <Text style={[s.td, { width: 180, color: '#cbd5e1', fontSize: 10 }]} numberOfLines={2}>{r.description || '—'}</Text>
                <Text style={[s.td, { width: 100, color: '#00ff88', fontWeight: 'bold', fontSize: 11 }]}>{r.in ? fmt(r.in, CUR[selectedBox.currency]?.dec || 2) : '—'}</Text>
                <Text style={[s.td, { width: 100, color: '#ff3355', fontWeight: 'bold', fontSize: 11 }]}>{r.out ? fmt(r.out, CUR[selectedBox.currency]?.dec || 2) : '—'}</Text>
                <Text style={[s.td, { width: 110, color: '#fbbf24', fontWeight: 'bold', fontSize: 12 }]}>{fmt(r.running, CUR[selectedBox.currency]?.dec || 2)}</Text>
                <View style={[s.td, { width: 60, alignItems: 'center' }]}>
                  {r.type === 'opening' ? <Text>🔒</Text> : (
                    <TouchableOpacity onPress={async () => {
                      if (typeof window !== 'undefined' && !window.confirm('حذف؟')) return;
                      await deleteBoxTransaction(r.id || r.local_id);
                      await openKardex(selectedBox); await load();
                    }}><Text>🗑</Text></TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Modal تراکنش */}
        <Modal visible={txModal} transparent animationType="slide" onRequestClose={() => setTxModal(false)}>
          <View style={s.mBg}><View style={s.mBox}>
            <View style={[s.mHead, { backgroundColor: '#059669' }]}>
              <Text style={s.mTitle}>{TYPE_LABEL[txForm.type] || 'تراکنش'}</Text>
              <TouchableOpacity onPress={() => setTxModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14, maxHeight: 500 }}>
              {(txForm.type === 'adjust_in' || txForm.type === 'adjust_out') && (
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 8 }}>
                  <TouchableOpacity accessibilityLabel="افزایش" onPress={() => setTxForm((f: any) => ({ ...f, type: 'adjust_in' }))} style={[s.chip, txForm.type === 'adjust_in' && s.chipActive]}><Text style={[s.chipTxt, txForm.type === 'adjust_in' && s.chipTxtActive]}>➕ افزایش</Text></TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="کاهش" onPress={() => setTxForm((f: any) => ({ ...f, type: 'adjust_out' }))} style={[s.chip, txForm.type === 'adjust_out' && s.chipActive]}><Text style={[s.chipTxt, txForm.type === 'adjust_out' && s.chipTxtActive]}>➖ کاهش</Text></TouchableOpacity>
                </View>
              )}
              {(txForm.type === 'fee_in' || txForm.type === 'fee_out') && (
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 8 }}>
                  <TouchableOpacity accessibilityLabel="دریافت" onPress={() => setTxForm((f: any) => ({ ...f, type: 'fee_in' }))} style={[s.chip, txForm.type === 'fee_in' && s.chipActive]}><Text style={[s.chipTxt, txForm.type === 'fee_in' && s.chipTxtActive]}>📥 دریافت</Text></TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="پرداخت" onPress={() => setTxForm((f: any) => ({ ...f, type: 'fee_out' }))} style={[s.chip, txForm.type === 'fee_out' && s.chipActive]}><Text style={[s.chipTxt, txForm.type === 'fee_out' && s.chipTxtActive]}>📤 پرداخت</Text></TouchableOpacity>
                </View>
              )}
              <Text style={s.lbl}>مبلغ *</Text>
              <TextInput style={s.inp} value={String(txForm.amount || '')} onChangeText={v => setTxForm((f: any) => ({ ...f, amount: v.replace(/[^\d.-]/g, '') }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
              <Text style={s.lbl}>تاریخ</Text>
              <DateField value={txForm.date} onChange={(v: string) => setTxForm((f: any) => ({ ...f, date: v }))} compact defaultToToday />
              <Text style={s.lbl}>طرف حساب (اختیاری)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
                {(buyers || []).slice(0, 20).map((b: any) => (
                  <TouchableOpacity key={b.code} onPress={() => setTxForm((f: any) => ({ ...f, counterparty_code: b.code, counterparty_name: b.name }))}
                    style={[s.curPick, txForm.counterparty_code === b.code && s.curPickActive]}>
                    <Text style={[s.curPickTxt, txForm.counterparty_code === b.code && { color: '#fff' }]}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.lbl}>شرح</Text>
              <TextInput style={[s.inp, { minHeight: 60 }]} value={txForm.description || ''} onChangeText={v => setTxForm((f: any) => ({ ...f, description: v }))} multiline placeholderTextColor="#94a3b8" />
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                <TouchableOpacity accessibilityLabel="انصراف" style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setTxModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={saveTxHandler} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View></View>
        </Modal>
      </View>
    );
  }

  // ═══ لیست صندوق‌ها ═══
  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: '#d4af37', fontSize: 14, fontWeight: 'bold' }}>📦 صندوق‌ها ({boxes.length})</Text>
        <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
          <TouchableOpacity accessibilityLabel="انتقال" onPress={() => { setTransferForm({ from_box_code: '', to_box_code: '', amount: '', date: toStorageDateFull(new Date()) }); setTransferModal(true); }} style={{ backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🔄 انتقال</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="جدید" onPress={() => { setBoxForm({ name: '', currency: 'USD', owner_code: '', owner_name: '', opening: '0' }); setBoxModal(true); }} style={{ backgroundColor: '#7c3aed', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>➕ جدید</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : boxes.length === 0 ? (
        <Text style={s.empty}>هنوز صندوقی نیست</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={s.tblHeader}>
              {['#','کد','نام صندوق','ارز','موجودی','👤 صاحب صندوق','عملیات'].map((h,i) => (
                <Text key={i} style={[s.th, { width: [36,100,170,100,130,160,200][i] }]}>{h}</Text>
              ))}
            </View>
            {filteredBoxes.map((b: any, i: number) => {
              const id = b.id || b.local_id;
              const bal = balances[id] || 0;
              const col = bal > 0 ? '#00ff88' : bal < 0 ? '#ff3355' : '#94a3b8';
              return (
                <View key={id} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#0a1628' }]}>
                  <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                  <Text style={[s.td, { width: 100, color: '#7c3aed', fontWeight: 'bold', fontSize: 11 }]}>{b.code}</Text>
                  <TouchableOpacity onPress={() => openKardex(b)} style={{ width: 170 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>{b.name}</Text>
                  </TouchableOpacity>
                  <Text style={[s.td, { width: 100, color: '#60a5fa' }]}>{CUR[b.currency]?.flag} {b.currency}</Text>
                  <Text style={[s.td, { width: 130, color: col, fontWeight: 'bold', fontSize: 13 }]}>{bal > 0 ? '+' : ''}{fmt(bal, CUR[b.currency]?.dec || 2)}</Text>
                  <Text style={[s.td, { width: 160, color: '#00ff88', fontWeight: 'bold', fontSize: 11 }]}>{b.owner_name ? `👤 ${b.owner_name}` : '—'}</Text>
                  <View style={[s.td, { width: 200, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                    <TouchableOpacity accessibilityLabel="کاردکس" onPress={() => openKardex(b)} style={[s.iconBtn, { backgroundColor: '#dbeafe' }]}><Text style={{ fontSize: 11, color: '#1e40af', fontWeight: 'bold' }}>📋 کاردکس</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setBoxForm({ ...b }); setBoxModal(true); }} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                      if (typeof window !== 'undefined' && !window.confirm('حذف صندوق ' + b.name + '؟')) return;
                      await deleteBox(id); showToast?.('🗑 حذف شد'); await load();
                    }} style={[s.iconBtn, { backgroundColor: '#fee2e2' }]}><Text>🗑</Text></TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* BOX_CUR_MODAL */}
      <Modal visible={showBoxCur} transparent animationType="fade" onRequestClose={() => setShowBoxCur(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
            <TouchableOpacity onPress={() => setShowBoxCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 10 }}>
            <TextInput accessibilityLabel="🔍 جستجو: USD یا دالر یا افغانی..."
              style={[s.inp, { textAlign: 'right' }]}
              value={boxCurSearch}
              onChangeText={setBoxCurSearch}
              placeholder="🔍 جستجو: USD یا دالر یا افغانی..."
              placeholderTextColor="#94a3b8"
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 400, padding: 10 }}>
            {Object.keys(CUR)
              .filter(k => {
                const q = boxCurSearch.toLowerCase().trim();
                if (!q) return true;
                return k.toLowerCase().includes(q) || CUR[k].name.includes(boxCurSearch);
              })
              .map(k => (
                <TouchableOpacity key={k} style={s.pickRow} onPress={() => { setBoxForm((f: any) => ({ ...f, currency: k })); setShowBoxCur(false); }}>
                  <Text style={s.pickName}>{CUR[k].flag} {CUR[k].name} ({k})</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* Modal صندوق جدید/ویرایش */}
      <Modal visible={boxModal} transparent animationType="slide" onRequestClose={() => setBoxModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}></Text>
            <TouchableOpacity onPress={() => setBoxModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            <Text style={s.lbl}>👤 صاحب صندوق (از تب خریداران)</Text>
            <TouchableOpacity style={s.inp} onPress={() => setShowOwnerPick(true)}>
              <Text style={{ color: boxForm.owner_name ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>{boxForm.owner_name ? `👤 ${boxForm.owner_name}  (${boxForm.owner_code || '—'})` : '🔍 انتخاب از خریداران...'}</Text>
            </TouchableOpacity>
            <Text style={s.lbl}>نام صندوق *</Text>
            <TextInput accessibilityLabel="صندوق دلار" style={s.inp} value={boxForm.name || ''} onChangeText={v => setBoxForm((f: any) => ({ ...f, name: v }))} placeholder="صندوق دلار" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>ارز *</Text>
            <TouchableOpacity
              style={s.inp}
              onPress={() => { setBoxCurSearch(''); setShowBoxCur(true); }}
            >
              <Text style={{ color: boxForm.currency ? '#fff' : '#94a3b8', textAlign: 'right' }}>
                {boxForm.currency ? `${CUR[boxForm.currency]?.flag} ${boxForm.currency} — ${CUR[boxForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>
            <Text style={s.lbl}>موجودی افتتاحیه</Text>
            <TextInput style={s.inp} value={String(boxForm.opening || '')} onChangeText={v => setBoxForm((f: any) => ({ ...f, opening: v.replace(/[^\d.-]/g, '') }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>📅 تاریخ افتتاحیه</Text>
            <DateField value={boxForm.opening_date || toStorageDateFull(new Date())} onChange={(v: string) => setBoxForm((f: any) => ({ ...f, opening_date: v }))} compact defaultToToday />
            <Text style={s.lbl}>یادداشت</Text>
            <TextInput style={[s.inp, { minHeight: 60 }]} value={boxForm.notes || ''} onChangeText={v => setBoxForm((f: any) => ({ ...f, notes: v }))} multiline placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity accessibilityLabel="انصراف" style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setBoxModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={saveBoxHandler} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* Modal انتخاب صاحب */}
      <Modal visible={showOwnerPick} transparent animationType="fade" onRequestClose={() => setShowOwnerPick(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#0891b2' }]}>
            <Text style={s.mTitle}>👤 انتخاب صاحب ({(buyers || []).length})</Text>
            <TouchableOpacity onPress={() => setShowOwnerPick(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400, padding: 10 }}>
            {(buyers || []).length === 0 ? <Text style={s.empty}>هنوز خریداری نیست</Text> : (buyers || []).map((b: any) => (
              <TouchableOpacity key={b.code} onPress={() => {
                setBoxForm((f: any) => ({ ...f, owner_code: b.code, owner_name: b.name, name: f.name || ('صندوق ' + (CUR[f.currency]?.name || '') + ' — ' + b.name) }));
                setShowOwnerPick(false);
              }} style={s.pickRow}>
                <Text style={s.pickName}>👤 {b.name}</Text>
                <Text style={s.pickSub}>🆔 {b.code} | 📞 {b.phone || '—'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      {/* Modal انتقال */}
      <Modal visible={transferModal} transparent animationType="slide" onRequestClose={() => setTransferModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}>
            <Text style={s.mTitle}>🔄 انتقال بین صندوق‌ها</Text>
            <TouchableOpacity onPress={() => setTransferModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            <Text style={s.lbl}>از صندوق *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {filteredBoxes.map((b: any) => (
                <TouchableOpacity key={b.code} onPress={() => setTransferForm((f: any) => ({ ...f, from_box_code: b.code }))} style={[s.curPick, transferForm.from_box_code === b.code && s.curPickActive, { flexDirection: 'column', alignItems: 'center', paddingVertical: 8 }]}>
                  <Text style={[s.curPickTxt, transferForm.from_box_code === b.code && { color: '#fff' }]}>{b.name}</Text>
                  {b.owner_code ? <Text style={{ fontSize: 9, color: transferForm.from_box_code === b.code ? '#a7f3d0' : '#94a3b8', marginTop: 3 }}>🆔 {b.owner_code}</Text> : null}
                  {b.owner_name ? <Text style={{ fontSize: 9, color: transferForm.from_box_code === b.code ? '#a7f3d0' : '#94a3b8' }}>👤 {b.owner_name}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>به صندوق *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {filteredBoxes.map((b: any) => (
                <TouchableOpacity key={b.code} onPress={() => setTransferForm((f: any) => ({ ...f, to_box_code: b.code }))} style={[s.curPick, transferForm.to_box_code === b.code && s.curPickActive, { flexDirection: 'column', alignItems: 'center', paddingVertical: 8 }]}>
                  <Text style={[s.curPickTxt, transferForm.to_box_code === b.code && { color: '#fff' }]}>{b.name}</Text>
                  {b.owner_code ? <Text style={{ fontSize: 9, color: transferForm.to_box_code === b.code ? '#a7f3d0' : '#94a3b8', marginTop: 3 }}>🆔 {b.owner_code}</Text> : null}
                  {b.owner_name ? <Text style={{ fontSize: 9, color: transferForm.to_box_code === b.code ? '#a7f3d0' : '#94a3b8' }}>👤 {b.owner_name}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>مبلغ ارسال *</Text>
            <TextInput style={s.inp} value={String(transferForm.amount || '')} onChangeText={v => setTransferForm((f: any) => ({ ...f, amount: v.replace(/[^\d.-]/g, '') }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
            {(() => {
              const fb = boxes.find((b: any) => b.code === transferForm.from_box_code);
              const tb = boxes.find((b: any) => b.code === transferForm.to_box_code);
              if (!fb || !tb) return null;
              const sameCur = (fb.currency || '') === (tb.currency || '');
              if (sameCur) return (
                <View style={{ backgroundColor: '#065f46', padding: 8, borderRadius: 6, marginTop: 8 }}>
                  <Text style={{ color: '#a7f3d0', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>✅ ارزها یکسان — انتقال ساده</Text>
                </View>
              );
              const amt = Number(transferForm.amount) || 0;
              const rate = Number(transferForm.rate) || 0;
              const result = amt * rate;
              return (
                <>
                  <View style={{ backgroundColor: '#7c2d12', padding: 8, borderRadius: 6, marginTop: 8 }}>
                    <Text style={{ color: '#fed7aa', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>⚠️ ارزها متفاوت — تبدیل لازم است</Text>
                  </View>
                  <Text style={s.lbl}>💹 نرخ تبدیل ({fb.currency} → {tb.currency}) *</Text>
                  <TextInput accessibilityLabel="مثلاً 70500" style={s.inp} value={String(transferForm.rate || '')} onChangeText={v => setTransferForm((f: any) => ({ ...f, rate: v.replace(/[^\d.-]/g, '') }))} keyboardType="numeric" placeholder="مثلاً 70500" placeholderTextColor="#94a3b8" />
                  {amt > 0 && rate > 0 && (
                    <View style={{ backgroundColor: '#0f2438', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 2, borderColor: '#10b981' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'center', marginBottom: 4 }}>مبلغ دریافتی</Text>
                      <Text style={{ color: '#00ff88', fontSize: 18, fontWeight: 'bold', textAlign: 'center', fontFamily: 'monospace' }}>{fmt(result, CUR[tb.currency]?.dec || 2)} {tb.currency}</Text>
                    </View>
                  )}
                </>
              );
            })()}
            <Text style={s.lbl}>📅 تاریخ</Text>
            <DateField value={transferForm.date || toStorageDateFull(new Date())} onChange={(v: string) => setTransferForm((f: any) => ({ ...f, date: v }))} compact defaultToToday />
            <Text style={s.lbl}>شرح</Text>
            <TextInput style={[s.inp, { minHeight: 60 }]} value={transferForm.description || ''} onChangeText={v => setTransferForm((f: any) => ({ ...f, description: v }))} multiline placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity accessibilityLabel="انصراف" style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setTransferModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={saveTransfer} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ انتقال</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>
      {/* Hidden branded kardex for image capture */}
      <Modal visible={imageCaptureMode} transparent animationType="none">
        <View style={{ position: 'absolute', left: -9999, top: 0 }}>
          <View ref={kardexImageRef} collapsable={false} style={IMG.container}>
            <View style={IMG.brand}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 22 }}>⚖️</Text>
                <View>
                  <Text style={IMG.brandTitle}>میزان</Text>
                  <Text style={IMG.brandSlogan}>حساب‌ها دقیق، معاملات امن، ذهن آسوده.</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={IMG.brandMeta}>📦 {selectedBox?.code || ''}</Text>
                <Text style={IMG.brandMeta}>💱 {selectedBox?.currency || ''}</Text>
              </View>
            </View>
            <Text style={IMG.title}>کاردکس صندوق {selectedBox?.name || ''}</Text>
            <View style={IMG.info}>
              <Text style={IMG.infoTxt}>👤 صاحب: {selectedBox?.owner_name || '—'}</Text>
              <Text style={IMG.infoTxt}>💰 مانده فعلی: {fmt(balances[selectedBox?.id || selectedBox?.local_id] || 0, CUR[selectedBox?.currency]?.dec || 2)} {selectedBox?.currency || ''}</Text>
              <Text style={IMG.infoTxt}>📅 {new Date().toLocaleDateString('fa-IR')}</Text>
            </View>
            <View style={IMG.thead}>
              <Text style={[IMG.th, { width: 30 }]}>#</Text>
              <Text style={[IMG.th, { width: 80 }]}>تاریخ</Text>
              <Text style={[IMG.th, { width: 80 }]}>سند</Text>
              <Text style={[IMG.th, { width: 70 }]}>نوع</Text>
              <Text style={[IMG.th, { flex: 1 }]}>شرح</Text>
              <Text style={[IMG.th, { width: 80 }]}>ورودی</Text>
              <Text style={[IMG.th, { width: 80 }]}>خروجی</Text>
              <Text style={[IMG.th, { width: 90 }]}>مانده</Text>
            </View>
            {kardex.map(function(r: any, i: number) {
              return (
                <View key={i} style={[IMG.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                  <Text style={[IMG.td, { width: 30 }]}>{i + 1}</Text>
                  <Text style={[IMG.td, { width: 80 }]}>{r.date || '—'}</Text>
                  <Text style={[IMG.td, { width: 80 }]}>{r.code || '—'}</Text>
                  <Text style={[IMG.td, { width: 70 }]}>{r.type_label || '—'}</Text>
                  <Text style={[IMG.td, { flex: 1, textAlign: 'right' }]}>{r.description || '—'}</Text>
                  <Text style={[IMG.td, { width: 80, color: '#059669' }]}>{r.in ? fmt(r.in, CUR[selectedBox?.currency]?.dec || 2) : '—'}</Text>
                  <Text style={[IMG.td, { width: 80, color: '#dc2626' }]}>{r.out ? fmt(r.out, CUR[selectedBox?.currency]?.dec || 2) : '—'}</Text>
                  <Text style={[IMG.td, { width: 90, fontWeight: 'bold' }]}>{fmt(r.running, CUR[selectedBox?.currency]?.dec || 2)}</Text>
                </View>
              );
            })}
            {kardex.length > 0 && (
              <View style={IMG.summary}>
                <Text style={IMG.summaryLine}>💰 مانده اول دوره: {fmt((Number((kardex[0] as any)?.running)||0) - (Number((kardex[0] as any)?.in)||0) + (Number((kardex[0] as any)?.out)||0), CUR[selectedBox?.currency]?.dec || 2)} {selectedBox?.currency || ''}</Text>
                <Text style={IMG.summaryLine}>📥 جمع ورودی: {fmt(kardex.reduce((a: number, r: any) => a + (Number(r.in)||0), 0), CUR[selectedBox?.currency]?.dec || 2)} {selectedBox?.currency || ''}</Text>
                <Text style={IMG.summaryLine}>📤 جمع خروجی: {fmt(kardex.reduce((a: number, r: any) => a + (Number(r.out)||0), 0), CUR[selectedBox?.currency]?.dec || 2)} {selectedBox?.currency || ''}</Text>
                <Text style={[IMG.summaryLine, { fontWeight: 'bold', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 4, marginTop: 4 }]}>💵 مانده آخر دوره: {fmt(Number((kardex[kardex.length-1] as any)?.running)||0, CUR[selectedBox?.currency]?.dec || 2)} {selectedBox?.currency || ''}</Text>
              </View>
            )}
            <View style={IMG.signs}>
              <View style={IMG.signBox}><Text style={IMG.signTxt}>امضای صاحب حساب</Text></View>
              <View style={IMG.signBox}><Text style={IMG.signTxt}>امضای مدیر مالی</Text></View>
              <View style={IMG.signBox}><Text style={IMG.signTxt}>مهر شرکت</Text></View>
            </View>
            <Text style={IMG.compNote}>⚖️ این سند به‌صورت خودکار توسط سیستم میزان تولید شده است.</Text>
            <Text style={IMG.footer}>میزان — کاردکس خودکار</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  dateBox: { flexDirection: 'row', alignItems: 'center', padding: 6, borderWidth: 2, borderRadius: 8, gap: 1, backgroundColor: '#1a2332', borderColor: '#334155' },
  dateInp: { padding: 4, textAlign: 'center', fontSize: 13, color: '#fff', backgroundColor: 'transparent' },
  dateSep: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  typeBtn: { marginLeft: 'auto', padding: 4, borderRadius: 6, backgroundColor: '#334155' },
  typeBtnTxt: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  tblHeader: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 10, borderRadius: 8, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  tblRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingVertical: 8, alignItems: 'center', minHeight: 44 },
  th: { color: '#d4af37', fontSize: 11, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },
  td: { fontSize: 12, textAlign: 'center', paddingHorizontal: 4, color: '#e2e8f0' },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#dbeafe' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },
  mBg: { width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', width: '95%', maxWidth: 600, overflow: 'hidden' },
  mHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  lbl: { color: '#cbd5e1', fontSize: 12, marginBottom: 4, marginTop: 10, textAlign: 'right', fontWeight: 'bold' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  curPick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332', marginLeft: 4 },
  curPickActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  curPickTxt: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  pickRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  pickName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  pickSub: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' },
});
const IMG = StyleSheet.create({
  container: { backgroundColor: '#ffffff', padding: 14, width: 720, borderRadius: 8 },
  brand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#d4af37', paddingBottom: 10, marginBottom: 10 },
  brandTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f2438' },
  brandSlogan: { fontSize: 10, color: '#64748b' },
  brandMeta: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#0f2438', textAlign: 'center', marginVertical: 8 },
  info: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 8, marginBottom: 10 },
  infoTxt: { fontSize: 12, color: '#0f2438', textAlign: 'right', marginVertical: 2 },
  thead: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6 },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 3 },
  trow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 5 },
  td: { fontSize: 10, color: '#0f2438', textAlign: 'center', paddingHorizontal: 3 },
  footer: { fontSize: 9, color: '#94a3b8', textAlign: 'center', marginTop: 10 },
  summary: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 8, marginVertical: 8 },
  summaryLine: { fontSize: 11, color: '#0f2438', textAlign: 'right', marginVertical: 1 },
  signs: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 14, gap: 8 },
  signBox: { flex: 1, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4, alignItems: 'center', minHeight: 30 },
  signTxt: { fontSize: 9, color: '#475569' },
  compNote: { fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
});

