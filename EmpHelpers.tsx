import { displayDate, displayDateOnly } from './lib-date';
// EmpHelpers.tsx — فیش حقوقی استاندارد (محتوا + ظاهر)
import { Platform, Alert } from 'react-native';
import { shareHtmlAsPdf, printHtml, exportExcel, mizanStandardCss } from './lib.share';
import { currencyLabelByCode, getCurrencySync } from './lib.currency';
const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');

function _numToWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'صفر';
  var ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  var teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  var tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  var hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  var scales = ['', ' هزار', ' میلیون', ' میلیارد', ' هزار میلیارد'];
  function threeDigit(num) {
    var parts = [];
    var h = Math.floor(num / 100);
    var rem = num % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rem >= 10 && rem < 20) parts.push(teens[rem - 10]);
    else {
      var t = Math.floor(rem / 10);
      var o = rem % 10;
      if (t > 0) parts.push(tens[t]);
      if (o > 0) parts.push(ones[o]);
    }
    return parts.join(' و ');
  }
  var result = [];
  var scaleIdx = 0;
  while (n > 0) {
    var chunk = n % 1000;
    if (chunk > 0) result.unshift(threeDigit(chunk) + scales[scaleIdx]);
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return result.join(' و ');
}

function _currencyLabel(cur) {
  if (!cur) return getCurrencySync().label || 'افغانی';
  return currencyLabelByCode(String(cur));
}

function _pad2(n) { return String(n).padStart(2, '0'); }

function _safe(s, fb) { return (s === undefined || s === null || s === '') ? (fb || '—') : String(s); }

function _trackingCode(emp, month) {
  var base = (emp.code || emp.name || 'X') + '-' + (month || '');
  var hash = 0;
  for (var i = 0; i < base.length; i++) { hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0; }
  return 'MZ-' + Math.abs(hash).toString(36).toUpperCase().slice(0, 8);
}

function _docSerial(emp, month) {
  var d = new Date();
  var y = d.getFullYear();
  var m = _pad2(d.getMonth() + 1);
  var day = _pad2(d.getDate());
  return 'PS-' + y + m + day + '-' + (emp.code || 'X');
}

function _period(month) {
  if (!month) return '—';
  var mm = String(month).match(/^(\d{4})[\/-](\d{1,2})$/);
  if (!mm) return month;
  var y = parseInt(mm[1], 10);
  var mo = parseInt(mm[2], 10);
  if (mo < 1 || mo > 12) return month;
  var lastDay = new Date(y, mo, 0).getDate();
  return y + '/' + _pad2(mo) + '/01 تا ' + y + '/' + _pad2(mo) + '/' + _pad2(lastDay);
}

export function payslipHtml(emp: any, data: any, month: string, companyName: string = 'میزان'): string {
  var cur = _currencyLabel(emp && emp.currency);
  var extraCss = '@page{size:A5;margin:8mm}.title{text-align:center;font-size:12px;font-weight:bold;background:#0f2438;color:#fff;padding:5px;margin:7px 0}.green{color:#059669;font-weight:bold}.red{color:#dc2626;font-weight:bold}.totals{background:#fef3c7;font-weight:bold;font-size:10px}.net{background:#d1fae5;font-size:12px;text-align:center;font-weight:bold;padding:6px;margin-top:6px}.net-words{background:#f0fdf4;border:1px dashed #059669;font-size:10px;text-align:center;padding:5px;margin-top:4px;font-weight:bold}.sign{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:14px;font-size:9px}.sign-box{border-top:1px dashed #94a3b8;padding-top:3px;text-align:center;min-height:40px}th{background:#f1f5f9;text-align:right;font-size:9px;padding:4px 5px}td{text-align:right;font-size:9px;padding:4px 5px}table{font-size:9.5px;margin-bottom:6px}.meta-row{display:flex;justify-content:space-between;font-size:8.5px;color:#475569;margin-bottom:4px}.info-block{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px;font-size:9px;margin-bottom:6px}.info-row{display:flex;justify-content:space-between;padding:1px 0}.computer-note{text-align:center;font-size:7.5px;color:#94a3b8;margin-top:6px;font-style:italic}.tracking{font-family:monospace;font-weight:bold;color:#0891b2}';

  // Header: brand + doc meta
  var header = '<div class="brand"><div><div class="brand-title">⚖️ ' + _safe(companyName) + '</div><div class="brand-slogan">فیش حقوقی رسمی — ' + _safe(emp.contract_type, 'ماهانه') + '</div></div><div class="meta"><div>📅 دوره: <b>' + _period(month) + '</b></div><div>📆 صدور: <b>' + new Date().toLocaleDateString('fa-IR') + '</b></div></div></div>';

  // Document meta row
  var docMeta = '<div class="meta-row"><span>📄 شماره سند: <b>' + _docSerial(emp, month) + '</b></span><span>🔑 کد رهگیری: <b class="tracking">' + _trackingCode(emp, month) + '</b></span></div>';

  // Employee info block
  var empInfo = '<div class="info-block">'
    + '<div class="info-row"><span><b>نام:</b> ' + _safe(emp.name) + '</span><span><b>کد پرسنلی:</b> ' + _safe(emp.code) + '</span></div>'
    + '<div class="info-row"><span><b>کد ملی:</b> ' + _safe(emp.national_id) + '</span><span><b>سمت:</b> ' + _safe(emp.role) + '</span></div>'
    + '<div class="info-row"><span><b>دپارتمان:</b> ' + _safe(emp.department) + '</span><span><b>محل خدمت:</b> ' + _safe(emp.work_location || emp.department) + '</span></div>'
    + '<div class="info-row"><span><b>تاریخ استخدام:</b> ' + (displayDateOnly(emp.hire_date || emp.start_date) || '—') + '</span><span><b>نوع قرارداد:</b> ' + _safe(emp.contract_type) + '</span></div>'
    + '<div class="info-row"><span><b>شماره بیمه:</b> ' + _safe(emp.insurance_number) + '</span><span><b>روزهای بیمه:</b> ' + _safe(data.insurance_days || data.attendance_days, '—') + '</span></div>'
    + '<div class="info-row"><span><b>بانک:</b> ' + _safe(emp.bank) + '</span><span><b>شماره حساب:</b> ' + _safe(emp.account_number) + '</span></div>'
    + '<div class="info-row"><span><b>وضعیت تأهل:</b> ' + _safe(emp.marital_status) + '</span><span><b>تعداد اولاد:</b> ' + _safe(emp.dependents, '0') + '</span></div>'
    + '</div>';

  // Attendance
  var att = '<div class="title">📋 حضور و غیاب</div>'
    + '<table><tr><th>روز کارکرد</th><td class="green">' + (data.attendance_days || 0) + '</td><th>غیبت</th><td class="red">' + (data.absent_days || 0) + '</td><th>مرخصی</th><td>' + (data.leave_days || 0) + '</td><th>مانده مرخصی</th><td>' + _safe(emp.leave_balance, '—') + '</td></tr>'
    + '<tr><th>ساعت کارکرد</th><td>' + (data.worked_hours || 0) + '</td><th>ساعت اضافه‌کاری</th><td>' + (data.overtime_hours || 0) + '</td><th>ماموریت</th><td>' + _safe(emp.mission_days, '0') + '</td><th>تأخیر</th><td>' + _safe(emp.late_count, '0') + '</td></tr></table>';

  // Earnings
  var earnings = '<div class="title">💰 دریافتی‌ها (' + cur + ')</div>'
    + '<table><tr><th>حقوق پایه</th><td>' + fmt(data.base_salary) + '</td><th>اضافه‌کاری</th><td>' + fmt(data.overtime) + '</td></tr>'
    + '<tr><th>حق مسکن</th><td>' + fmt(data.housing_allowance) + '</td><th>حق خواربار</th><td>' + fmt(data.food_allowance) + '</td></tr>'
    + '<tr><th>حق ایاب و ذهاب</th><td>' + fmt(data.transport_allowance) + '</td><th>سایر مزایا</th><td>' + fmt(data.other_allowance) + '</td></tr>'
    + '<tr class="totals"><th colspan="3">جمع کل دریافتی</th><td class="green">' + fmt(data.gross_salary) + '</td></tr></table>';

  // Deductions
  var _dedRows = [];
  _dedRows.push('<tr><th>بیمه سهم کارمند</th><td class="red">' + fmt(data.employee_insurance) + '</td><th>مالیات بر درآمد</th><td class="red">' + fmt(data.tax) + '</td></tr>');
  var _loanRow = '<tr><th>قسط وام</th><td class="red">' + fmt(data.loan) + '</td>';
  var _absDed = Number(data.absence_deduction != null ? data.absence_deduction : (data.deduction || 0));
  _loanRow += '<th>کسر غیبت' + (data.absent_days ? ' (' + data.absent_days + ' روز)' : '') + '</th><td class="red">' + fmt(_absDed) + '</td></tr>';
  _dedRows.push(_loanRow);
  var _unpaid = Number(data.unpaid_leave_deduction || 0);
  var _paid = Number(data.paid_leave_deduction || 0);
  var _sick = Number(data.sick_leave_deduction || 0);
  if (_unpaid > 0 || _paid > 0 || _sick > 0) {
    var _leaveRow = '<tr>';
    _leaveRow += _unpaid > 0 ? '<th>مرخصی بدون حقوق' + (data.unpaid_leave_days ? ' (' + data.unpaid_leave_days + ' روز)' : '') + '</th><td class="red">' + fmt(_unpaid) + '</td>' : '<th></th><td></td>';
    _leaveRow += _sick > 0 ? '<th>مرخصی استعلاجی' + (data.sick_leave_days ? ' (' + data.sick_leave_days + ' روز)' : '') + '</th><td class="red">' + fmt(_sick) + '</td>' : '<th></th><td></td>';
    _leaveRow += '</tr>';
    _dedRows.push(_leaveRow);
  }
  if (_paid > 0) {
    _dedRows.push('<tr><th colspan="3">کسر مرخصی استحقاقی' + (data.annual_leave_days ? ' (' + data.annual_leave_days + ' روز)' : '') + '</th><td class="red">' + fmt(_paid) + '</td></tr>');
  }
  var _totalDed = Number(data.total_deductions != null ? data.total_deductions : ((data.employee_insurance || 0) + (data.tax || 0) + (data.loan || 0) + _absDed + _unpaid + _paid + _sick));
  var deductions = '<div class="title">📉 کسورات (' + cur + ')</div>'
    + '<table>' + _dedRows.join('')
    + '<tr class="totals"><th colspan="3">جمع کل کسورات</th><td class="red">' + fmt(_totalDed) + '</td></tr></table>';

  // Net + net in words
  var netNum = Number(data.net_salary) || 0;
  var alreadyPaid = Number(data.already_paid || 0);
  var remaining = Number(data.remaining != null ? data.remaining : netNum);
  var netWords = _numToWords(netNum);
  var net = '<div class="net">💵 خالص محاسبه‌شده: ' + fmt(netNum) + ' ' + cur + '</div>'
    + '<div class="net-words">به حروف: ' + netWords + ' ' + cur + '</div>';
  if (alreadyPaid > 0 || remaining !== netNum) {
    var _paidStyle = alreadyPaid > 0 ? 'background:#e0f2fe;color:#0c4a6e' : 'background:#f1f5f9;color:#64748b';
    var _remStyle = remaining > 0 ? 'background:#fee2e2;color:#991b1b' : 'background:#d1fae5;color:#065f46';
    net += '<table style="margin-top:6px"><tr>';
    net += '<th style="background:#f1f5f9">پرداخت‌شده تاکنون</th><td style="' + _paidStyle + ';font-weight:bold;text-align:center">' + fmt(alreadyPaid) + ' ' + cur + '</td>';
    net += '<th style="background:#f1f5f9">مانده قابل پرداخت</th><td style="' + _remStyle + ';font-weight:bold;text-align:center">' + (remaining === 0 ? '✅ تسویه' : fmt(remaining) + ' ' + cur) + '</td>';
    net += '</tr></table>';
  }

  // Employer cost
  var employer = '<div style="font-size:8.5px;color:#475569;margin-top:6px;border-top:1px dotted #cbd5e1;padding-top:4px">'
    + '<div>🧾 بیمه سهم کارفرما (۲۳٪): <b>' + fmt(data.employer_insurance) + ' ' + cur + '</b></div>'
    + '<div>📌 کل هزینه کارفرما: <b>' + fmt((data.gross_salary || 0) + (data.employer_insurance || 0)) + ' ' + cur + '</b></div>'
    + '</div>';

  // Signatures (4 boxes)
  var signs = '<div class="sign">'
    + '<div class="sign-box">امضای کارمند<br/><span style="font-size:7px;color:#94a3b8">تاریخ: ____</span></div>'
    + '<div class="sign-box">مدیر منابع انسانی<br/><span style="font-size:7px;color:#94a3b8">مهر و امضا</span></div>'
    + '<div class="sign-box">مدیر مالی<br/><span style="font-size:7px;color:#94a3b8">مهر و امضا</span></div>'
    + '<div class="sign-box">مهر شرکت<br/><span style="font-size:7px;color:#94a3b8">محل مهر</span></div>'
    + '</div>';

  // Footer
  var footer = '<div class="computer-note">⚖️ این سند به‌صورت خودکار توسط سیستم میزان تولید شده و بدون نیاز به امضا معتبر است.</div>';

  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>' + mizanStandardCss() + extraCss + '</style></head><body>' + header + docMeta + empInfo + att + earnings + deductions + net + employer + signs + footer + '</body></html>';
}

export async function printPayslip(emp: any, data: any, month: string, companyName: string = 'میزان'): Promise<boolean> {
  try {
    var html = payslipHtml(emp, data, month, companyName);
    var r = await shareHtmlAsPdf(html, 'payslip-' + (emp.code || emp.name || 'x') + '-' + month + '.pdf');
    return r.ok;
  } catch (e) { return false; }
}

export async function printPayslipDirect(emp: any, data: any, month: string, companyName: string = 'میزان'): Promise<boolean> {
  try {
    var html = payslipHtml(emp, data, month, companyName);
    var r = await printHtml(html);
    return r.ok;
  } catch (e) { return false; }
}

export async function sharePayslipExcel(emp: any, data: any, month: string): Promise<boolean> {
  try {
    var cur = _currencyLabel(emp && emp.currency);
    var rows = [
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'نام', 'مقدار': emp.name || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'کد پرسنلی', 'مقدار': emp.code || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'کد ملی', 'مقدار': emp.national_id || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'سمت', 'مقدار': emp.role || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'شماره بیمه', 'مقدار': emp.insurance_number || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'بانک', 'مقدار': emp.bank || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'شماره حساب', 'مقدار': emp.account_number || '' },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'دوره', 'مقدار': _period(month) },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'شماره سند', 'مقدار': _docSerial(emp, month) },
      { 'بخش': 'اطلاعات پرسنلی', 'عنوان': 'کد رهگیری', 'مقدار': _trackingCode(emp, month) },
      { 'بخش': 'حضور و غیاب', 'عنوان': 'روز کارکرد', 'مقدار': data.attendance_days || 0 },
      { 'بخش': 'حضور و غیاب', 'عنوان': 'روز غیبت', 'مقدار': data.absent_days || 0 },
      { 'بخش': 'حضور و غیاب', 'عنوان': 'مرخصی', 'مقدار': data.leave_days || 0 },
      { 'بخش': 'حضور و غیاب', 'عنوان': 'ساعت کارکرد', 'مقدار': data.worked_hours || 0 },
      { 'بخش': 'حضور و غیاب', 'عنوان': 'ساعت اضافه‌کاری', 'مقدار': data.overtime_hours || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'حقوق پایه', 'مقدار': data.base_salary || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'اضافه‌کاری', 'مقدار': data.overtime || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'حق مسکن', 'مقدار': data.housing_allowance || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'حق خواربار', 'مقدار': data.food_allowance || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'حق ایاب و ذهاب', 'مقدار': data.transport_allowance || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'سایر مزایا', 'مقدار': data.other_allowance || 0 },
      { 'بخش': 'دریافتی‌ها', 'عنوان': 'جمع دریافتی', 'مقدار': data.gross_salary || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'بیمه سهم کارمند', 'مقدار': data.employee_insurance || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'مالیات', 'مقدار': data.tax || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'قسط وام', 'مقدار': data.loan || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'کسر غیبت', 'مقدار': data.absence_deduction != null ? data.absence_deduction : (data.deduction || 0) },
      { 'بخش': 'کسورات', 'عنوان': 'کسر مرخصی بدون حقوق', 'مقدار': data.unpaid_leave_deduction || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'کسر مرخصی استعلاجی', 'مقدار': data.sick_leave_deduction || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'کسر مرخصی استحقاقی', 'مقدار': data.paid_leave_deduction || 0 },
      { 'بخش': 'کسورات', 'عنوان': 'جمع کسورات', 'مقدار': data.total_deductions != null ? data.total_deductions : ((data.employee_insurance || 0) + (data.tax || 0) + (data.loan || 0) + (data.deduction || 0)) },
      { 'بخش': 'خالص', 'عنوان': 'خالص محاسبه‌شده', 'مقدار': data.net_salary || 0 },
      { 'بخش': 'خالص', 'عنوان': 'خالص به حروف', 'مقدار': _numToWords(data.net_salary) + ' ' + cur },
      { 'بخش': 'خالص', 'عنوان': 'پرداخت‌شده تاکنون', 'مقدار': data.already_paid || 0 },
      { 'بخش': 'خالص', 'عنوان': 'مانده قابل پرداخت', 'مقدار': data.remaining != null ? data.remaining : (data.net_salary || 0) },
      { 'بخش': 'کارفرما', 'عنوان': 'بیمه سهم کارفرما', 'مقدار': data.employer_insurance || 0 },
      { 'بخش': 'کارفرما', 'عنوان': 'کل هزینه کارفرما', 'مقدار': (data.gross_salary || 0) + (data.employer_insurance || 0) }
    ];
    var r = await exportExcel([{ name: 'فیش حقوقی', data: rows }], 'payslip-' + (emp.code || emp.name || 'x') + '-' + month + '.xlsx');
    return r.ok;
  } catch (e) { return false; }
}

export async function payslipMenu(emp: any, data: any, month: string, showToast: any, companyName: string = 'میزان') {
  if (Platform.OS === 'web') {
    var htmlW = payslipHtml(emp, data, month, companyName);
    var rW = await printHtml(htmlW);
    if (showToast) showToast(rW.ok ? '✅ ' + rW.message : '❌ ' + rW.message, !rW.ok);
    return;
  }
  Alert.alert('خروجی فیش حقوقی', 'نوع خروجی را انتخاب کنید', [
    { text: '📄 PDF / اشتراک', onPress: async function() {
      var ok = await printPayslip(emp, data, month, companyName);
      if (showToast) showToast(ok ? '✅ PDF آماده شد' : '❌ خطا در PDF', !ok);
    }},
    { text: '🖨️ چاپ', onPress: async function() {
      var ok2 = await printPayslipDirect(emp, data, month, companyName);
      if (showToast) showToast(ok2 ? '✅ چاپ ارسال شد' : '❌ خطا در چاپ', !ok2);
    }},
    { text: '📊 اکسل', onPress: async function() {
      var ok3 = await sharePayslipExcel(emp, data, month);
      if (showToast) showToast(ok3 ? '✅ اکسل آماده شد' : '❌ خطا در اکسل', !ok3);
    }},
    { text: 'لغو', style: 'cancel' }
  ]);
}

export function exportBankFile(employees: any[], data: any[], month: string) {
  var rows = [['کد پرسنلی', 'نام', 'کد ملی', 'بانک', 'شماره حساب', 'خالص پرداختی', 'ماه']];
  employees.forEach(function(e) {
    var d = data.find(function(x) { return x.employee_code === e.code; });
    if (!d) return;
    rows.push([e.code || '', e.name || '', e.national_id || '', e.bank || '', e.account_number || '', String(d.net_salary), month]);
  });
  var csv = '\uFEFF' + rows.map(function(r) { return r.map(function(x) { return '"' + x + '"'; }).join(','); }).join('\n');
  try {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bank-file-' + month + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) { return false; }
}