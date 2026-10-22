import { displayDate, displayDateOnly } from './lib-date';
// ExchangeInvoice.tsx — فاکتور A5 صرافی
import { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildStandardHtml, shareHtmlAsPdf, exportExcel, numToWords, currencyLabel, mizanSignaturesHtml, mizanComputerNoteHtml } from './lib.share';
const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');

export default function ExchangeInvoice({ invoice, onBack, onNew, showToast }: any) {
  const ref = useRef<View>(null);
  const t = invoice.trade || {};
  const buyer = invoice.buyer || {};
  const customer = invoice.customer || {};
  const buyerSummary = invoice.buyerSummary || { count: 0, totalFrom: 0, totalTo: 0, profit: 0 };
  const customerSummary = invoice.customerSummary || { count: 0, totalFrom: 0, totalTo: 0, profit: 0 };
  // === Standard fields (world-class receipt) ===
  const _serial = 'FX-' + String(t.date || '').replace(/[^0-9]/g, '').slice(0, 8) + '-' + String(t.invoice_number || '—');
  const _tracking = 'TRK-' + String(t.invoice_number || Date.now()).replace(/[^A-Z0-9]/gi, '').slice(-8).toUpperCase();
  const _fromCurLabel = currencyLabel(t.from_currency);
  const _toCurLabel = currencyLabel(t.to_currency);
  const _amountInWords = numToWords(Number(t.to_qty) || 0) + ' ' + _toCurLabel;
  const _settlementStatus = t.payment_method === 'cash' ? '✅ نقدی — تسویه شده' : '🏦 بانکی — تسویه شده';

  const capture = async (mode: 'share' | 'print') => {
    try {
      const uri = await captureRef(ref, { format: 'jpg', quality: 0.92 });
      if (mode === 'print') await Print.printAsync({ uri });
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else showToast('اشتراک پشتیبانی نمی‌شود', true);
    } catch (e: any) { showToast(e.message, true); }
  };

  const exportPDF = async () => {
    try {
      var _p = [];
      _p.push('<div class="info"><b>🆔 شماره سند:</b> ' + _serial + ' &nbsp;|&nbsp; <b>🔑 کد رهگیری:</b> ' + _tracking + '<br><b>📅 تاریخ:</b> ' + (displayDate(t.date) || t.date || '—') + ' ' + (t.payment_time || '') + ' &nbsp;|&nbsp; <b>🧾 فاکتور:</b> ' + (t.invoice_number || '—') + '</div>');

      _p.push('<div class="title">🏢 خریدار و مشتری</div>');
      _p.push('<table>');
      _p.push('<tr><th>🏢 خریدار</th><td>' + (buyer.name || '—') + '</td><th>📞 تلفن</th><td>' + (buyer.phone || '—') + '</td></tr>');
      _p.push('<tr><th>🆔 کد خریدار</th><td>' + (buyer.code || '—') + '</td><th>🏦 بانک</th><td>' + (t.bank || '—') + '</td></tr>');
      _p.push('<tr><th>👤 مشتری</th><td>' + (customer.name || '—') + '</td><th>📞 تلفن</th><td>' + (customer.phone || '—') + '</td></tr>');
      _p.push('<tr><th>🆔 کد مشتری</th><td>' + (customer.code || '—') + '</td><th>👤 صاحب حساب</th><td>' + (t.holder_name || '—') + '</td></tr>');
      _p.push('</table>');

      _p.push('<div class="title">💱 جزئیات معامله</div>');
      _p.push('<table>');
      _p.push('<tr><th>📤 از ارز</th><td class="red">' + fmt(t.from_qty) + ' ' + _fromCurLabel + '</td><th>📥 به ارز</th><td class="green">' + fmt(t.to_qty) + ' ' + _toCurLabel + '</td></tr>');
      _p.push('<tr><th>💹 نرخ تبدیل</th><td>' + fmt(t.rate) + '</td><th>💵 روش پرداخت</th><td>' + (t.payment_method === 'cash' ? 'نقدی' : 'بانکی') + '</td></tr>');
      _p.push('</table>');

      if (buyerSummary.count > 0) {
        _p.push('<div class="title">💰 خلاصه مالی خریدار</div>');
        _p.push('<table>');
        _p.push('<tr><th>📊 تعداد معاملات</th><td>' + fmt(buyerSummary.count) + '</td><th>📤 جمع مبالغ</th><td class="red">' + fmt(buyerSummary.totalFrom) + '</td></tr>');
        _p.push('<tr><th>📥 جمع دریافتی</th><td class="green">' + fmt(buyerSummary.totalTo) + '</td><th>💰 سود</th><td class="green">' + fmt(buyerSummary.profit) + '</td></tr>');
        _p.push('</table>');
      }
      if (customerSummary.count > 0) {
        _p.push('<div class="title">💰 خلاصه مالی مشتری</div>');
        _p.push('<table>');
        _p.push('<tr><th>📊 تعداد معاملات</th><td>' + fmt(customerSummary.count) + '</td><th>📤 جمع مبالغ</th><td class="red">' + fmt(customerSummary.totalFrom) + '</td></tr>');
        _p.push('<tr><th>📥 جمع دریافتی</th><td class="green">' + fmt(customerSummary.totalTo) + '</td><th>💰 سود</th><td class="green">' + fmt(customerSummary.profit) + '</td></tr>');
        _p.push('</table>');
      }

      _p.push('<div class="net">🎯 این معامله — ' + fmt(t.from_qty) + ' ' + _fromCurLabel + ' ← ' + fmt(t.to_qty) + ' ' + _toCurLabel + '</div>');
      _p.push('<div class="net-words">💵 مبلغ به حروف: ' + _amountInWords + '</div>');
      _p.push('<table style="margin-top:6px"><tr><th>✅ وضعیت تسویه</th><td style="text-align:center;font-weight:bold;color:#065f46">' + _settlementStatus + '</td></tr></table>');
      _p.push(mizanSignaturesHtml(['امضای خریدار', 'امضای مشتری', 'مهر شرکت']));
      _p.push(mizanComputerNoteHtml());

      var html = buildStandardHtml('رسید معامله ارز ' + (t.trade_type === 'buy' ? '(خرید)' : '(فروش)'), _p.join(''), '🧾 ' + (t.invoice_number || ''));
      html = html.replace('</head>', '<style>@page{size:A5;margin:8mm}</style></head>');

      var r = await shareHtmlAsPdf(html, 'fx-invoice-' + (t.invoice_number || Date.now()) + '.pdf');
      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast(e.message, true); }
  }
  const exportExcelBtn = async () => {
    try {
      var _rows = [
        { 'بخش': 'سند', 'عنوان': 'شماره سند', 'مقدار': _serial },
        { 'بخش': 'سند', 'عنوان': 'کد رهگیری', 'مقدار': _tracking },
        { 'بخش': 'سند', 'عنوان': 'تاریخ', 'مقدار': (displayDate(t.date) || t.date || '') },
        { 'بخش': 'سند', 'عنوان': 'شماره فاکتور', 'مقدار': t.invoice_number || '' },
        { 'بخش': 'خریدار', 'عنوان': 'نام', 'مقدار': buyer.name || '' },
        { 'بخش': 'خریدار', 'عنوان': 'کد', 'مقدار': buyer.code || '' },
        { 'بخش': 'خریدار', 'عنوان': 'تلفن', 'مقدار': buyer.phone || '' },
        { 'بخش': 'مشتری', 'عنوان': 'نام', 'مقدار': customer.name || '' },
        { 'بخش': 'مشتری', 'عنوان': 'کد', 'مقدار': customer.code || '' },
        { 'بخش': 'مشتری', 'عنوان': 'تلفن', 'مقدار': customer.phone || '' },
        { 'بخش': 'معامله', 'عنوان': 'از مقدار', 'مقدار': Number(t.from_qty) || 0 },
        { 'بخش': 'معامله', 'عنوان': 'از ارز', 'مقدار': _fromCurLabel },
        { 'بخش': 'معامله', 'عنوان': 'به مقدار', 'مقدار': Number(t.to_qty) || 0 },
        { 'بخش': 'معامله', 'عنوان': 'به ارز', 'مقدار': _toCurLabel },
        { 'بخش': 'معامله', 'عنوان': 'نرخ', 'مقدار': Number(t.rate) || 0 },
        { 'بخش': 'معامله', 'عنوان': 'روش پرداخت', 'مقدار': t.payment_method === 'cash' ? 'نقدی' : 'بانکی' },
        { 'بخش': 'معامله', 'عنوان': 'بانک', 'مقدار': t.bank || '' },
        { 'بخش': 'معامله', 'عنوان': 'صاحب حساب', 'مقدار': t.holder_name || '' },
        { 'بخش': 'معامله', 'عنوان': 'مبلغ به حروف', 'مقدار': _amountInWords },
        { 'بخش': 'وضعیت', 'عنوان': 'تسویه', 'مقدار': _settlementStatus },
      ];
      var r = await exportExcel([{ name: 'رسید صرافی', data: _rows }], 'fx-invoice-' + (t.invoice_number || Date.now()) + '.xlsx');
      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast(e.message, true); }
  };
;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f7fa' }} contentContainerStyle={{ padding: 10, paddingBottom: 60 }}>
      <View ref={ref} collapsable={false} style={s.invoice}>

        {/* هدر */}
        <View style={s.head}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 22 }}>⚖️</Text>
            <View>
              <Text style={s.brand}>میزان</Text>
              <Text style={s.slogan}>صرافی — حساب‌ها دقیق، معاملات امن</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.small}>📅 {t.date || ''} {t.payment_time || ''}</Text>
            <Text style={s.small}>🧾 {t.invoice_number || ''}</Text>
            <Text style={[s.small, { color: '#0891b2', fontWeight: 'bold' }]}>🔑 {_tracking}</Text>
          </View>
        </View>

        <Text style={s.title}>رسید معامله ارز {t.trade_type === 'buy' ? '(خرید)' : '(فروش)'}</Text>

        {/* خریدار / مشتری */}
        <View style={s.section}>
          <Text style={s.sectionT}>🏢 خریدار</Text>
          <View style={s.grid}>
            <View style={s.cell}><Text style={s.cellL}>نام</Text><Text style={s.cellV}>{buyer.name || '—'}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>کد</Text><Text style={s.cellV}>{buyer.code || '—'}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>تلفن</Text><Text style={s.cellV}>{buyer.phone || '—'}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>بانک</Text><Text style={s.cellV}>{t.bank || '—'}</Text></View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionT}>👤 مشتری</Text>
          <View style={s.grid}>
            <View style={s.cell}><Text style={s.cellL}>نام</Text><Text style={s.cellV}>{customer.name || '—'}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>کد</Text><Text style={s.cellV}>{customer.code || '—'}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>تلفن</Text><Text style={s.cellV}>{customer.phone || '—'}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>صاحب حساب</Text><Text style={s.cellV}>{t.holder_name || '—'}</Text></View>
          </View>
        </View>

        {/* جزئیات معامله */}
        <View style={s.section}>
          <Text style={s.sectionT}>💱 جزئیات معامله</Text>
          <View style={s.grid}>
            <View style={s.cell}><Text style={s.cellL}>📤 از ارز</Text><Text style={[s.cellV, { color: '#dc2626' }]}>{fmt(t.from_qty)} {t.from_currency}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>📥 به ارز</Text><Text style={[s.cellV, { color: '#059669' }]}>{fmt(t.to_qty)} {t.to_currency}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>💹 نرخ</Text><Text style={s.cellV}>{fmt(t.rate)}</Text></View>
            <View style={s.cell}><Text style={s.cellL}>💵 پرداخت</Text><Text style={s.cellV}>{t.payment_method === 'cash' ? 'نقدی' : 'بانکی'}</Text></View>
          </View>
        </View>

        {/* خلاصه مالی */}
        <View style={[s.section, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
          <Text style={[s.sectionT, { borderBottomColor: '#fcd34d' }]}>💰 خلاصه مالی خریدار</Text>
          <View style={s.sumRow}><Text style={s.sumLbl}>📊 تعداد معاملات</Text><Text style={s.sumVal}>{fmt(buyerSummary.count)}</Text></View>
          <View style={s.sumRow}><Text style={s.sumLbl}>📤 جمع مبالغ</Text><Text style={[s.sumVal, { color: '#dc2626' }]}>{fmt(buyerSummary.totalFrom)}</Text></View>
          <View style={s.sumRow}><Text style={s.sumLbl}>📥 جمع دریافتی</Text><Text style={[s.sumVal, { color: '#059669' }]}>{fmt(buyerSummary.totalTo)}</Text></View>
          <View style={[s.sumRow, { backgroundColor: '#fef3c7', borderRadius: 6, marginTop: 4, paddingVertical: 6 }]}>
            <Text style={[s.sumLbl, { fontWeight: 'bold' }]}>💰 سود از این خریدار</Text>
            <Text style={[s.sumVal, { color: '#065f46', fontWeight: 'bold', fontSize: 14 }]}>{fmt(buyerSummary.profit)}</Text>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Text style={[s.sectionT, { borderBottomColor: '#bfdbfe' }]}>💰 خلاصه مالی مشتری</Text>
          <View style={s.sumRow}><Text style={s.sumLbl}>📊 تعداد معاملات</Text><Text style={s.sumVal}>{fmt(customerSummary.count)}</Text></View>
          <View style={s.sumRow}><Text style={s.sumLbl}>📤 جمع مبالغ</Text><Text style={[s.sumVal, { color: '#dc2626' }]}>{fmt(customerSummary.totalFrom)}</Text></View>
          <View style={s.sumRow}><Text style={s.sumLbl}>📥 جمع دریافتی</Text><Text style={[s.sumVal, { color: '#059669' }]}>{fmt(customerSummary.totalTo)}</Text></View>
          <View style={[s.sumRow, { backgroundColor: '#dbeafe', borderRadius: 6, marginTop: 4, paddingVertical: 6 }]}>
            <Text style={[s.sumLbl, { fontWeight: 'bold' }]}>💰 سود از این مشتری</Text>
            <Text style={[s.sumVal, { color: '#1e40af', fontWeight: 'bold', fontSize: 14 }]}>{fmt(customerSummary.profit)}</Text>
          </View>
        </View>

        <View style={s.netBox}>
          <Text style={s.netTxt}>🎯 این معامله — {fmt(t.from_qty)} {_fromCurLabel} ← {fmt(t.to_qty)} {_toCurLabel}</Text>
        </View>
        <View style={{ marginTop: 6, padding: 8, backgroundColor: '#d1fae5', borderRadius: 6, alignItems: 'center' }}>
          <Text style={{ color: '#065f46', fontWeight: 'bold', fontSize: 11 }}>{_settlementStatus}</Text>
        </View>
        <View style={{ marginTop: 6, padding: 8, backgroundColor: '#fffbeb', borderRadius: 6, borderWidth: 1, borderColor: '#fcd34d' }}>
          <Text style={{ color: '#92400e', fontSize: 11, textAlign: 'center' }}>💵 به حروف: <Text style={{ fontWeight: 'bold' }}>{_amountInWords}</Text></Text>
        </View>

        <View style={s.footer}>
          <Text style={s.footerTxt}>📞 میزان: ________________</Text>
          <Text style={s.footerThanks}>با تشکر از اعتماد شما 🙏</Text>
        </View>
      </View>

      {/* دکمه‌ها */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <TouchableOpacity accessibilityLabel="پرینت" style={[s.btn, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#1e3a5f', flex: 1, minWidth: 90 }]} onPress={() => capture('print')}>
          <Text style={[s.btnTxt, { color: '#1e3a5f' }]}>🖨️ پرینت</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="اشتراک" style={[s.btn, { backgroundColor: '#0ea5e9', flex: 1, minWidth: 90 }]} onPress={() => capture('share')}>
          <Text style={s.btnTxt}>📤 اشتراک</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="PDF" style={[s.btn, { backgroundColor: '#8e44ad', flex: 1, minWidth: 90 }]} onPress={exportPDF}>
          <Text style={s.btnTxt}>📄 PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="اکسل" style={[s.btn, { backgroundColor: '#059669', flex: 1, minWidth: 90 }]} onPress={exportExcelBtn}>
          <Text style={s.btnTxt}>📊 اکسل</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TouchableOpacity accessibilityLabel="برگشت" style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={onBack}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
        <TouchableOpacity accessibilityLabel="معامله جدید" style={[s.btn, { backgroundColor: '#065f46', flex: 1 }]} onPress={onNew}><Text style={s.btnTxt}>➕ معامله جدید</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  invoice: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#d4af37', marginBottom: 8 },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#0f2438' },
  slogan: { fontSize: 9, color: '#1e3a5f' },
  small: { fontSize: 10, color: '#475569', fontFamily: 'monospace', textAlign: 'left' },
  title: { textAlign: 'center', fontSize: 13, fontWeight: 'bold', color: '#065f46', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6, marginVertical: 8 },
  section: { marginTop: 8, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  sectionT: { fontSize: 11, color: '#0f2438', fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 4, marginBottom: 6, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '48%', backgroundColor: '#fff', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  cellL: { fontSize: 9, color: '#64748b', marginBottom: 2, textAlign: 'right' },
  cellV: { fontSize: 11, color: '#0f2438', fontWeight: 'bold', textAlign: 'right' },
  sumRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sumLbl: { fontSize: 11, color: '#475569' },
  sumVal: { fontSize: 12, color: '#0f2438', fontWeight: 'bold', fontFamily: 'monospace' },
  netBox: { marginTop: 10, padding: 10, backgroundColor: '#d1fae5', borderRadius: 8, borderWidth: 2, borderColor: '#059669' },
  netTxt: { textAlign: 'center', fontSize: 12, color: '#065f46', fontWeight: 'bold' },
  footer: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#d4af37', alignItems: 'center' },
  footerTxt: { fontSize: 10, color: '#1e3a5f', fontFamily: 'monospace', marginBottom: 4 },
  footerThanks: { fontSize: 10, color: '#78350f', fontWeight: 'bold' },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
