// EmpHelpers.tsx — فیش حقوقی و خروجی‌ها
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');

// ═══════════════════════════════════════════
//  فیش حقوقی A5
// ═══════════════════════════════════════════
export async function printPayslip(emp: any, data: any, month: string, companyName: string = 'میزان') {
  const html = `
    <html dir="rtl"><head><meta charset="utf-8">
    <style>
      @page { size: A5; margin: 8mm; }
      body { font-family: Tahoma; direction: rtl; color: #0f2438; }
      .header { display: flex; justify-content: space-between; border-bottom: 3px double #0f2438; padding-bottom: 6px; margin-bottom: 10px; }
      .brand { font-size: 16px; font-weight: bold; }
      .title { text-align: center; font-size: 14px; font-weight: bold; background: #0f2438; color: #fff; padding: 6px; margin: 10px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      td, th { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; }
      th { background: #f1f5f9; font-weight: bold; }
      .green { color: #059669; font-weight: bold; }
      .red { color: #dc2626; font-weight: bold; }
      .totals { background: #fef3c7; font-weight: bold; font-size: 11px; }
      .net { background: #d1fae5; font-size: 13px; text-align: center; font-weight: bold; padding: 8px; margin-top: 8px; }
      .sign { display: flex; justify-content: space-between; margin-top: 20px; font-size: 10px; }
      .sign-box { border-top: 1px dashed #94a3b8; padding-top: 4px; min-width: 120px; text-align: center; }
    </style></head><body>
      <div class="header">
        <div><div class="brand">⚖️ ${companyName}</div><div style="font-size: 8px; color: #64748b;">فیش حقوقی رسمی</div></div>
        <div style="text-align: left; font-size: 9px;">
          <div>📅 ماه: <b>${month}</b></div>
          <div>📆 صدور: ${new Date().toLocaleDateString('fa-IR')}</div>
        </div>
      </div>

      <table>
        <tr><th style="width: 25%;">نام و نام خانوادگی</th><td>${emp.name || '-'}</td><th style="width: 20%;">کد پرسنلی</th><td>${emp.code || '-'}</td></tr>
        <tr><th>کد ملی</th><td>${emp.national_id || '-'}</td><th>سمت</th><td>${emp.role || '-'}</td></tr>
        <tr><th>دپارتمان</th><td>${emp.department || '-'}</td><th>نوع قرارداد</th><td>${emp.contract_type || '-'}</td></tr>
        <tr><th>شماره بیمه</th><td>${emp.insurance_number || '-'}</td><th>بانک</th><td>${emp.bank || '-'} ${emp.account_number ? '(' + emp.account_number + ')' : ''}</td></tr>
      </table>

      <div class="title">📋 خلاصه حضور و غیاب</div>
      <table>
        <tr><th>روزهای کارکرد</th><td class="green">${data.attendance_days}</td><th>روزهای غیبت</th><td class="red">${data.absent_days}</td><th>مرخصی</th><td>${data.leave_days}</td></tr>
        <tr><th>ساعت کارکرد</th><td>${data.worked_hours}</td><th>ساعت اضافه‌کاری</th><td>${data.overtime_hours}</td><th></th><td></td></tr>
      </table>

      <div class="title">💰 دریافتی‌ها</div>
      <table>
        <tr><th>حقوق پایه</th><td>${fmt(data.base_salary)}</td><th>اضافه‌کاری</th><td>${fmt(data.overtime)}</td></tr>
        <tr><th>حق مسکن</th><td>${fmt(data.housing_allowance)}</td><th>حق خواربار</th><td>${fmt(data.food_allowance)}</td></tr>
        <tr><th>حق ایاب و ذهاب</th><td>${fmt(data.transport_allowance)}</td><th>سایر مزایا</th><td>${fmt(data.other_allowance)}</td></tr>
        <tr class="totals"><th colspan="3">جمع کل دریافتی (Gross)</th><td class="green">${fmt(data.gross_salary)}</td></tr>
      </table>

      <div class="title">📉 کسورات</div>
      <table>
        <tr><th>بیمه سهم کارمند (۷٪)</th><td class="red">${fmt(data.employee_insurance)}</td><th>مالیات بر درآمد</th><td class="red">${fmt(data.tax)}</td></tr>
        <tr><th>قسط وام</th><td class="red">${fmt(data.loan)}</td><th>کسر غیبت</th><td class="red">${fmt(data.deduction)}</td></tr>
        <tr class="totals"><th colspan="3">جمع کل کسورات</th><td class="red">${fmt(data.employee_insurance + data.tax + data.loan + data.deduction)}</td></tr>
      </table>

      <div class="net">💵 خالص پرداختی: ${fmt(data.net_salary)} افغانی</div>

      <div style="font-size: 9px; color: #64748b; margin-top: 8px;">
        <div>🧾 بیمه سهم کارفرما (۲۳٪): ${fmt(data.employer_insurance)}</div>
        <div>📌 کل هزینه کارفرما: ${fmt(data.gross_salary + data.employer_insurance)}</div>
      </div>

      <div class="sign">
        <div class="sign-box">امضای کارمند</div>
        <div class="sign-box">امضای مدیر</div>
        <div class="sign-box">مهر شرکت</div>
      </div>

      <div style="text-align: center; margin-top: 12px; font-size: 8px; color: #94a3b8;">⚖️ میزان — حساب‌ها دقیق، معاملات امن</div>
    </body></html>
  `;
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════
//  خروجی CSV برای واریز بانکی
// ═══════════════════════════════════════════
export function exportBankFile(employees: any[], data: any[], month: string) {
  const rows = [['کد پرسنلی', 'نام', 'کد ملی', 'بانک', 'شماره حساب', 'خالص پرداختی', 'ماه']];
  employees.forEach((e: any) => {
    const d = data.find((x: any) => x.employee_code === e.code);
    if (!d) return;
    rows.push([e.code || '', e.name || '', e.national_id || '', e.bank || '', e.account_number || '', String(d.net_salary), month]);
  });
  const csv = '\uFEFF' + rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-file-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch { return false; }
}
