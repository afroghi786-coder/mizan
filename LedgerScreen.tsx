// LedgerScreen.tsx — ترازنامه یکپارچه با مودال جامع (۱۹ ستون)
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Share, Modal, TextInput } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { getLedgerData } from './lib.offline';
import { getCurrencySync } from './lib.currency';
import { buildStandardHtml, shareHtmlAsPdf, printHtml, exportExcel, numToWords, mizanSignaturesHtml, mizanComputerNoteHtml } from './lib.share';
import { displayDate } from './lib-date';
import { toFaNum } from './lib';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US');
const TYPE_LABEL = { sale: 'فروش', purchase: 'خرید', payment_received: 'دریافت وجه', payment_sent: 'پرداخت', triangular_received: 'دریافت مثلثی' };
const TYPE_COLOR = { sale: '#1e40af', purchase: '#dc2626', payment_received: '#059669', payment_sent: '#0891b2', triangular_received: '#7c3aed' };

export default function LedgerScreen({ onBack, showToast }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const ref = useRef(null);
  const modalRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getLedgerData();
      setData(result);
    } catch (e) { if (showToast) showToast('خطا در بارگذاری', true); console.log(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const curLabel = (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : 'افغانی');

  const openParty = (p) => { setSelectedParty(p); setModalVisible(true); };
  const partyDetails = selectedParty ? selectedParty.transactions : [];

  const filteredData = data.filter((r) => {
    const q = searchQuery.trim();
    if (!q) return true;
    if ((r.name || '').includes(q)) return true;
    if ((r.phone || '').includes(q)) return true;
    if ((r.allCodes || []).some((c) => String(c).includes(q))) return true;
    return false;
  });

  const pTotal = partyDetails.reduce((a, t) => ({
    qty: a.qty + (t.qty || 0), debit: a.debit + (t.debit || 0), credit: a.credit + (t.credit || 0),
  }), { qty: 0, debit: 0, credit: 0 });

  // PDF builder
  const _buildHtml = (forParty) => {
    var _p = [];
    _p.push('<div class="info"><b>📅 تاریخ:</b> ' + displayDate(new Date()) + ' &nbsp;|&nbsp; <b>💱 واحد:</b> ' + curLabel + '</div>');
    if (!forParty) {
      _p.push('<div class="title">📊 ترازنامه (کلی)</div>');
      _p.push('<table style="width:100%; table-layout:fixed; border-collapse:collapse;">');
      _p.push('<thead><tr style="background:#0f2438; color:#fff;">');
      _p.push('<th style="width:4%">#</th>');
      _p.push('<th style="width:14%">نوع</th>');
      _p.push('<th style="width:20%">نام</th>');
      _p.push('<th style="width:14%">کدها</th>');
      _p.push('<th style="width:12%">تلفن</th>');
      _p.push('<th style="width:10%">بدهکار</th>');
      _p.push('<th style="width:10%">بستانکار</th>');
      _p.push('<th style="width:10%">مانده</th>');
      _p.push('<th style="width:10%">وضعیت</th>');
      _p.push('</tr></thead><tbody>');
      
      var tdSum = 0, tcSum = 0;
      var rows = data.map(function(r, i) {
        var st = r.balance > 0 ? 'طرف بدهکار' : r.balance < 0 ? 'ما بدهکار' : 'تسویه';
        var col = r.balance > 0 ? '#dc2626' : r.balance < 0 ? '#059669' : '#64748b';
        if (r.balance > 0) tdSum += r.balance;
        if (r.balance < 0) tcSum += Math.abs(r.balance);
        
        var typeColor = r.type === 'مشتری' ? '#059669' : r.type === 'تأمین‌کننده' ? '#ea580c' : '#7c3aed';
        
        return '<tr>' +
          '<td style="text-align:center">' + (i+1) + '</td>' +
          '<td style="text-align:center; font-weight:bold; color:' + typeColor + '">' + (r.type || '—') + '</td>' +
          '<td style="text-align:right">' + r.name + '</td>' +
          '<td style="text-align:center">' + (r.allCodes||[]).join(', ') + '</td>' +
          '<td style="text-align:center">' + r.phone + '</td>' +
          '<td style="text-align:center">' + fmt(r.totalDebit) + '</td>' +
          '<td style="text-align:center">' + fmt(r.totalCredit) + '</td>' +
          '<td style="text-align:center; font-weight:bold">' + fmt(Math.abs(r.balance)) + '</td>' +
          '<td style="text-align:center; color:' + col + '; font-weight:bold">' + st + '</td>' +
        '</tr>';
      }).join('');
      _p.push(rows);
      _p.push('<tr style="background:#f1f5f9; font-weight:bold;">');
      _p.push('<td colspan="5" style="text-align:left; padding:8px">جمع کل:</td>');
      _p.push('<td style="text-align:center">' + fmt(data.reduce((a, r) => a + r.totalDebit, 0)) + '</td>');
      _p.push('<td style="text-align:center">' + fmt(data.reduce((a, r) => a + r.totalCredit, 0)) + '</td>');
      _p.push('<td style="text-align:center">' + fmt(tdSum + tcSum) + '</td>');
      _p.push('<td style="text-align:center">طرف بدهکار: ' + fmt(tdSum) + '<br>ما بدهکار: ' + fmt(tcSum) + '</td>');
      _p.push('</tr></tbody></table>');
    } else {
      _p.push('<div class="title">📋 کارت حساب: ' + selectedParty.name + '</div>');
      _p.push('<div class="info"><b>کدها:</b> ' + (selectedParty.allCodes||[]).join(', ') + ' &nbsp;|&nbsp; <b>تلفن:</b> ' + (selectedParty.allPhones||[]).join(', ') + ' &nbsp;|&nbsp; <b>وضعیت:</b> ' + (selectedParty.balance > 0 ? 'طرف بدهکار' : selectedParty.balance < 0 ? 'ما بدهکار' : 'تسویه') + '</div>');
      _p.push('<table style="font-size:8px"><tr><th>#</th><th>تاریخ</th><th>نوع</th><th>فاکتور</th><th>فاکتور دستی</th><th>کد مدل</th><th>نام مدل</th><th>تعداد</th><th>قیمت</th><th>جمع ردیف</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>بانک</th><th>صاحب حساب</th><th>کد صاحب</th><th>تاریخ واریز</th><th>باربری</th><th>شرح</th></tr>');
      var tQty = 0, tDebit = 0, tCredit = 0;
      var rows = partyDetails.map(function(t, i) {
        tQty += (t.qty || 0); tDebit += (t.debit || 0); tCredit += (t.credit || 0);
        return '<tr><td>' + (i+1) + '</td><td>' + displayDate(t.date) + '</td><td>' + (TYPE_LABEL[t.type]||t.type) + '</td><td>' + (t.invoice||'—') + '</td><td>' + (t.manualInvoice||'—') + '</td><td>' + (t.modelCode||'—') + '</td><td style="text-align:right">' + (t.modelName||'—') + '</td><td>' + (t.qty?toFaNum(t.qty):'—') + '</td><td>' + (t.priceUnit?fmt(t.priceUnit):'—') + '</td><td>' + (t.lineTotal?fmt(t.lineTotal):'—') + '</td><td style="color:#1e40af;font-weight:bold">' + (t.debit?fmt(t.debit):'—') + '</td><td style="color:#059669;font-weight:bold">' + (t.credit?fmt(t.credit):'—') + '</td><td style="font-weight:bold">' + fmt(Math.abs(t.runningBalance||0)) + '</td><td>' + (t.bank||'—') + '</td><td>' + (t.holder||'—') + '</td><td>' + (t.holderCode||'—') + '</td><td>' + (t.depositDate?displayDate(t.depositDate):'—') + '</td><td>' + (t.shipping||'—') + '</td><td style="text-align:right">' + (t.description||'—') + '</td></tr>';
      }).join('');
      _p.push(rows);
      _p.push('<tr class="total"><td colspan="7" style="text-align:left;font-weight:bold">جمع کل:</td><td style="font-weight:bold">' + toFaNum(tQty) + '</td><td></td><td></td><td style="color:#1e40af;font-weight:bold">' + fmt(tDebit) + '</td><td style="color:#059669;font-weight:bold">' + fmt(tCredit) + '</td><td style="font-weight:bold">' + fmt(Math.abs(selectedParty.balance)) + '</td><td colspan="6"></td></tr>');
      _p.push('</table>');
      _p.push('<div class="net-words">💵 مانده به حروف: ' + numToWords(Math.abs(selectedParty.balance)) + ' ' + curLabel + '</div>');
    }
    _p.push(mizanSignaturesHtml(['مدیر مالی', 'حسابدار', 'مهر شرکت']));
    _p.push(mizanComputerNoteHtml());
    var html = buildStandardHtml('ترازنامه', _p.join(''), '📊 ترازنامه');
    html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
    return html;
  };

  const pdfAll = async () => { try { var r = await shareHtmlAsPdf(_buildHtml(false), 'ledger-' + Date.now() + '.pdf'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const printAll = async () => { try { var r = await printHtml(_buildHtml(false)); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const imgAll = async () => { try { if (!ref.current) return; var uri = await captureRef(ref, { format: 'jpg', quality: 0.95 }); if (Platform.OS === 'web') { await Share.share({ message: 'ترازنامه', url: uri }); } else if (await require('expo-sharing').isAvailableAsync()) { await require('expo-sharing').shareAsync(uri); } } catch (e) { if (showToast) showToast(e.message, true); } };
  const xlsAll = async () => { try { var rows = data.map((r, i) => ({ '#': i+1, 'نام': r.name, 'کدها': (r.allCodes||[]).join(', '), 'تلفن': r.phone, 'طرف بدهکار': r.totalDebit, 'ما بدهکار': r.totalCredit, 'مانده': Math.abs(r.balance), 'وضعیت': r.balance > 0 ? 'ما بستانکاریم' : r.balance < 0 ? 'ما بدهکاریم' : 'تسویه' })); var r2 = await exportExcel([{ name: 'ترازنامه', data: rows }], 'ledger-' + Date.now() + '.xlsx'); if (showToast) showToast(r2.ok ? '✅ ' + r2.message : '❌ ' + r2.message, !r2.ok); } catch (e) { if (showToast) showToast(e.message, true); } };

  const pdfParty = async () => { try { var r = await shareHtmlAsPdf(_buildHtml(true), 'statement-' + selectedParty.code + '.pdf'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const printParty = async () => { try { var r = await printHtml(_buildHtml(true)); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const imgParty = async () => { try { if (!modalRef.current) return; var uri = await captureRef(modalRef, { format: 'jpg', quality: 0.95 }); if (Platform.OS === 'web') { await Share.share({ message: 'کارت حساب', url: uri }); } else if (await require('expo-sharing').isAvailableAsync()) { await require('expo-sharing').shareAsync(uri); } } catch (e) { if (showToast) showToast(e.message, true); } };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f2438' }}>📊 ترازنامه (دفتر معین)</Text>
        <TouchableOpacity onPress={onBack} style={{ padding: 8, backgroundColor: '#e2e8f0', borderRadius: 8 }}>
          <Text style={{ fontWeight: 'bold' }}>← بازگشت</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row-reverse', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 16, color: '#64748b', marginRight: 8 }}>🔍</Text>
        <TextInput style={{ flex: 1, paddingVertical: 10, textAlign: 'right', fontSize: 13, color: '#0f2438' }} placeholder="جستجو (نام، کد، تلفن)..." placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}><Text style={{ color: '#dc2626', fontWeight: 'bold' }}>✕</Text></TouchableOpacity>)}
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={pdfAll} style={[s.btn, { backgroundColor: '#8e44ad' }]}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
        <TouchableOpacity onPress={printAll} style={[s.btn, { backgroundColor: '#0ea5e9' }]}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
        <TouchableOpacity onPress={imgAll} style={[s.btn, { backgroundColor: '#f59e0b' }]}><Text style={s.btnTxt}>📤 تصویر</Text></TouchableOpacity>
        <TouchableOpacity onPress={xlsAll} style={[s.btn, { backgroundColor: '#059669' }]}><Text style={s.btnTxt}>📊 اکسل</Text></TouchableOpacity>
      </View>

      <View ref={ref} collapsable={false} style={{ backgroundColor: '#fff', padding: 8, borderRadius: 8, alignSelf: 'stretch', width: '100%' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}>
          <View style={{ flex: 1, minWidth: '100%' }}>
            <View style={s.thead}>
              <Text style={[s.th, { width: 40, flex: 0.5 }]}>#</Text>
              <Text style={[s.th, { flex: 1.5 }]}>نوع</Text>
              <Text style={[s.th, { flex: 3, textAlign: 'right', paddingRight: 8 }]}>نام طرف حساب</Text>
              <Text style={[s.th, { flex: 2 }]}>کدها</Text>
              <Text style={[s.th, { flex: 2 }]}>تلفن</Text>
              <Text style={[s.th, { flex: 1.5 }]}>جمع بدهکار</Text>
              <Text style={[s.th, { flex: 1.5 }]}>جمع بستانکار</Text>
              <Text style={[s.th, { flex: 1.5 }]}>مانده</Text>
              <Text style={[s.th, { flex: 1.2 }]}>وضعیت</Text>
            </View>
            {filteredData.map((r, i) => (
              <TouchableOpacity key={i} onPress={() => openParty(r)} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                <Text style={[s.td, { width: 40, flex: 0.5 }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 1.5, fontSize: 10, fontWeight: 'bold', color: r.type === 'مشتری' ? '#059669' : r.type === 'تأمین‌کننده' ? '#ea580c' : '#7c3aed' }]}>
                  {r.type || '—'}
                </Text>
                <Text style={[s.td, { flex: 3, textAlign: 'right', paddingRight: 8, color: '#2563eb', textDecorationLine: 'underline', fontWeight: 'bold' }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[s.td, { flex: 2, fontSize: 9 }]} numberOfLines={1}>{(r.allCodes || []).join(', ')}</Text>
                <Text style={[s.td, { flex: 2, fontSize: 10 }]} numberOfLines={1}>{r.phone}</Text>
                <Text style={[s.td, { flex: 1.5, color: '#1e40af', fontWeight: 'bold' }]}>{fmt(r.totalDebit)}</Text>
                <Text style={[s.td, { flex: 1.5, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.totalCredit)}</Text>
                <Text style={[s.td, { flex: 1.5, fontWeight: 'bold' }]}>{fmt(Math.abs(r.balance))}</Text>
                <Text style={[s.td, { flex: 1.2, fontWeight: 'bold', color: r.balance > 0 ? '#dc2626' : r.balance < 0 ? '#059669' : '#64748b' }]}>{r.balance > 0 ? 'ما بستانکاریم' : r.balance < 0 ? 'ما بدهکاریم' : 'تسویه'}</Text>
              </TouchableOpacity>
            ))}
            {filteredData.length === 0 && (<View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>موردی یافت نشد</Text></View>)}
          </View>
        </ScrollView>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>📋 کارت حساب: {selectedParty?.name}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, padding: 8, flexWrap: 'wrap', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <TouchableOpacity onPress={pdfParty} style={[s.btn, { backgroundColor: '#8e44ad' }]}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
              <TouchableOpacity onPress={printParty} style={[s.btn, { backgroundColor: '#0ea5e9' }]}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
              <TouchableOpacity onPress={imgParty} style={[s.btn, { backgroundColor: '#f59e0b' }]}><Text style={s.btnTxt}>📤 تصویر</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 8 }} ref={modalRef} collapsable={false}>
              <View style={s.modalInfo}>
                <Text style={s.infoTxt}><b>کدها:</b> {(selectedParty?.allCodes || []).join(', ')}</Text>
                <Text style={s.infoTxt}><b>تلفن‌ها:</b> {(selectedParty?.allPhones || []).join(', ')}</Text>
                <Text style={s.infoTxt}><b>وضعیت:</b> <Text style={{ color: selectedParty?.balance > 0 ? '#dc2626' : selectedParty?.balance < 0 ? '#059669' : '#64748b', fontWeight: 'bold' }}>{selectedParty?.balance > 0 ? 'ما بستانکاریم' : selectedParty?.balance < 0 ? 'ما بدهکاریم' : 'تسویه'}</Text></Text>
                <Text style={s.infoTxt}><b>مانده نهایی:</b> {fmt(Math.abs(selectedParty?.balance || 0))} {curLabel}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginVertical: 8 }}>ریز تراکنش‌ها (۱۹ ستون)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={[s.thead, { backgroundColor: '#334155' }]}>
                    <Text style={[s.th, { width: 30 }]}>#</Text>
                    <Text style={[s.th, { width: 80 }]}>تاریخ</Text>
                    <Text style={[s.th, { width: 70 }]}>نوع</Text>
                    <Text style={[s.th, { width: 85 }]}>فاکتور</Text>
                    <Text style={[s.th, { width: 85 }]}>فاکتور دستی</Text>
                    <Text style={[s.th, { width: 65 }]}>کد مدل</Text>
                    <Text style={[s.th, { width: 100 }]}>نام مدل</Text>
                    <Text style={[s.th, { width: 45 }]}>تعداد</Text>
                    <Text style={[s.th, { width: 65 }]}>قیمت</Text>
                    <Text style={[s.th, { width: 75 }]}>جمع ردیف</Text>
                    <Text style={[s.th, { width: 80 }]}>ما بستانکاریم</Text>
                    <Text style={[s.th, { width: 80 }]}>ما بدهکاریم</Text>
                    <Text style={[s.th, { width: 85 }]}>مانده</Text>
                    <Text style={[s.th, { width: 70 }]}>بانک</Text>
                    <Text style={[s.th, { width: 85 }]}>صاحب حساب</Text>
                    <Text style={[s.th, { width: 70 }]}>کد صاحب</Text>
                    <Text style={[s.th, { width: 80 }]}>تاریخ واریز</Text>
                    <Text style={[s.th, { width: 70 }]}>باربری</Text>
                    <Text style={[s.th, { width: 110 }]}>شرح</Text>
                  </View>
                  {partyDetails.map((t, i) => (
                    <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }, t.type === 'payment_received' && { backgroundColor: '#f0fdf4' }, t.type === 'payment_sent' && { backgroundColor: '#eff6ff' }, t.type === 'triangular_received' && { backgroundColor: '#fef3c7' }]}>
                      <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                      <Text style={[s.td, { width: 80, fontSize: 9 }]}>{displayDate(t.date)}</Text>
                      <Text style={[s.td, { width: 70, color: TYPE_COLOR[t.type] || '#0f2438', fontWeight: 'bold', fontSize: 9 }]}>{TYPE_LABEL[t.type] || t.type}</Text>
                      <Text style={[s.td, { width: 85, color: '#7c3aed', fontSize: 9 }]} numberOfLines={1}>{t.invoice || '—'}</Text>
                      <Text style={[s.td, { width: 85, fontSize: 9 }]} numberOfLines={1}>{t.manualInvoice || '—'}</Text>
                      <Text style={[s.td, { width: 65, fontSize: 9 }]} numberOfLines={1}>{t.modelCode || '—'}</Text>
                      <Text style={[s.td, { width: 100, textAlign: 'right', fontSize: 9 }]} numberOfLines={2}>{t.modelName || '—'}</Text>
                      <Text style={[s.td, { width: 45, fontSize: 9 }]}>{t.qty ? toFaNum(t.qty) : '—'}</Text>
                      <Text style={[s.td, { width: 65, fontSize: 9 }]}>{t.priceUnit ? fmt(t.priceUnit) : '—'}</Text>
                      <Text style={[s.td, { width: 75, fontSize: 9, fontWeight: 'bold' }]}>{t.lineTotal ? fmt(t.lineTotal) : '—'}</Text>
                      <Text style={[s.td, { width: 80, fontSize: 9, color: t.debit ? '#1e40af' : '#475569', fontWeight: 'bold' }]}>{t.debit ? fmt(t.debit) : '—'}</Text>
                      <Text style={[s.td, { width: 80, fontSize: 9, color: t.credit ? '#059669' : '#475569', fontWeight: 'bold' }]}>{t.credit ? fmt(t.credit) : '—'}</Text>
                      <Text style={[s.td, { width: 85, fontSize: 9, fontWeight: 'bold' }]}>{fmt(Math.abs(t.runningBalance || 0))}</Text>
                      <Text style={[s.td, { width: 70, fontSize: 9 }]} numberOfLines={1}>{t.bank || '—'}</Text>
                      <Text style={[s.td, { width: 85, fontSize: 9 }]} numberOfLines={1}>{t.holder || '—'}</Text>
                      <Text style={[s.td, { width: 70, fontSize: 9 }]} numberOfLines={1}>{t.holderCode || '—'}</Text>
                      <Text style={[s.td, { width: 80, fontSize: 9 }]}>{t.depositDate ? displayDate(t.depositDate) : '—'}</Text>
                      <Text style={[s.td, { width: 70, fontSize: 9 }]} numberOfLines={1}>{t.shipping || '—'}</Text>
                      <Text style={[s.td, { width: 110, textAlign: 'right', fontSize: 9 }]} numberOfLines={2}>{t.description || '—'}</Text>
                    </View>
                  ))}
                  <View style={[s.trow, { backgroundColor: '#e2e8f0', borderTopWidth: 2, borderTopColor: '#0f2438' }]}>
                    <Text style={[s.td, { width: 30 }]}></Text>
                    <Text style={[s.td, { width: 80, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                    <Text style={[s.td, { width: 70 }]}></Text>
                    <Text style={[s.td, { width: 85 }]}></Text>
                    <Text style={[s.td, { width: 85 }]}></Text>
                    <Text style={[s.td, { width: 65 }]}></Text>
                    <Text style={[s.td, { width: 100 }]}></Text>
                    <Text style={[s.td, { width: 45, fontWeight: 'bold', fontSize: 10 }]}>{toFaNum(pTotal.qty)}</Text>
                    <Text style={[s.td, { width: 65 }]}></Text>
                    <Text style={[s.td, { width: 75 }]}></Text>
                    <Text style={[s.td, { width: 80, color: '#1e40af', fontWeight: 'bold', fontSize: 10 }]}>{fmt(pTotal.debit)}</Text>
                    <Text style={[s.td, { width: 80, color: '#059669', fontWeight: 'bold', fontSize: 10 }]}>{fmt(pTotal.credit)}</Text>
                    <Text style={[s.td, { width: 85, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs(selectedParty?.balance || 0))}</Text>
                    <Text style={[s.td, { width: 70 }]}></Text>
                    <Text style={[s.td, { width: 85 }]}></Text>
                    <Text style={[s.td, { width: 70 }]}></Text>
                    <Text style={[s.td, { width: 80 }]}></Text>
                    <Text style={[s.td, { width: 70 }]}></Text>
                    <Text style={[s.td, { width: 110 }]}></Text>
                  </View>
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  thead: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 8, width: '100%' },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 3 },
  trow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8, alignItems: 'center', width: '100%' },
  td: { fontSize: 10, color: '#0f2438', textAlign: 'center', paddingHorizontal: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 6 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '95%', width: '98%', alignSelf: 'center', overflow: 'hidden' },
  modalHead: { backgroundColor: '#0f2438', padding: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#d4af37', fontWeight: 'bold', fontSize: 14 },
  modalInfo: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  infoTxt: { fontSize: 11, color: '#1e3a5f', textAlign: 'right', marginVertical: 2 },
});
