// lib.emp.ts — استاندارد بین‌المللی
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib';

const K = (k: string) => '@mizan_local_' + k;
const getL = async (k: string) => { try { const r = await AsyncStorage.getItem(K(k)); return r ? JSON.parse(r) : null; } catch { return null; } };
const setL = async (k: string, v: any) => { try { await AsyncStorage.setItem(K(k), JSON.stringify(v)); } catch {} };
const gid = () => 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

async function fetchAll(table: string, key: string): Promise<any[]> {
  let list = (await getL(key)) || [];
  try {
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (data && data.length) {
      const merged: Record<string, any> = {};
      list.forEach((x: any) => merged[x.local_id || x.id] = x);
      data.forEach((x: any) => merged[x.local_id || x.id] = x);
      list = Object.values(merged);
    }
  } catch {}
  return list;
}
async function pushItem(table: string, key: string, item: any) {
  const list = await fetchAll(table, key);
  const existing = list.find((x: any) => (x.local_id || x.id) === (item.local_id || item.id));
  const newList = existing
    ? list.map((x: any) => (x.local_id === existing.local_id || x.id === existing.id) ? { ...x, ...item } : x)
    : [item, ...list];
  await setL(key, newList);
  try {
    if (existing && (existing.id || existing.local_id)) {
      await supabase.from(table).upsert({ ...item, user_id: undefined, id: undefined }, { onConflict: 'local_id' });
    } else {
      await supabase.from(table).insert({ ...item, user_id: undefined, id: undefined });
    }
  } catch {}
}
async function removeItem(table: string, key: string, id: string) {
  const list = await fetchAll(table, key);
  await setL(key, list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  کارمندان
// ═══════════════════════════════════════════
export const getEmployees = () => fetchAll('employees', 'employees');
export async function createEmployee(p: any) {
  const list = await getEmployees();
  const code = p.code || 'EMP-' + String(list.length + 1).padStart(4, '0');
  const item = { ...p, code, local_id: gid(), created_at: new Date().toISOString() };
  await pushItem('employees', 'employees', item);
  return item;
}
export const updateEmployee = (id: string, p: any) => pushItem('employees', 'employees', { ...p, local_id: id });
export const deleteEmployee = (id: string) => removeItem('employees', 'employees', id);

// ═══════════════════════════════════════════
//  حضور و غیاب
// ═══════════════════════════════════════════
export const getAttendance = () => fetchAll('attendance', 'attendance');
export async function createAttendance(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  await pushItem('attendance', 'attendance', item);
  return item;
}
export const deleteAttendance = (id: string) => removeItem('attendance', 'attendance', id);

// ═══════════════════════════════════════════
//  مرخصی‌ها
// ═══════════════════════════════════════════
export const getLeaves = () => fetchAll('employee_leaves', 'employee_leaves');
export async function createLeave(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  await pushItem('employee_leaves', 'employee_leaves', item);
  return item;
}
export const deleteLeave = (id: string) => removeItem('employee_leaves', 'employee_leaves', id);

// ═══════════════════════════════════════════
//  پرداخت حقوق
// ═══════════════════════════════════════════
export const getSalaryPayments = () => fetchAll('salary_payments', 'salary_payments');
export async function createSalaryPayment(p: any) {
  const list = await getSalaryPayments();
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  let maxN = 1000;
  list.forEach((x: any) => { const m = String(x.invoice_number || '').match(/^PY-\d{6}-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const inv = p.invoice_number || 'PY-' + ds + '-' + (maxN + 1);
  const item = { ...p, invoice_number: inv, local_id: gid(), created_at: new Date().toISOString() };
  await pushItem('salary_payments', 'salary_payments', item);
  return item;
}
export const updateSalaryPayment = (id: string, p: any) => pushItem('salary_payments', 'salary_payments', { ...p, local_id: id });
export const deleteSalaryPayment = (id: string) => removeItem('salary_payments', 'salary_payments', id);

// ═══════════════════════════════════════════
//  وام
// ═══════════════════════════════════════════
export const getLoans = () => fetchAll('employee_loans', 'employee_loans');
export async function createLoan(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  await pushItem('employee_loans', 'employee_loans', item);
  return item;
}
export const deleteLoan = (id: string) => removeItem('employee_loans', 'employee_loans', id);

// ═══════════════════════════════════════════
//  دسته پرداخت حقوق (Batch)
// ═══════════════════════════════════════════
export const getBatches = () => fetchAll('payroll_batches', 'payroll_batches');
export async function createBatch(p: any) {
  const list = await getBatches();
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
  let maxN = 1000;
  list.forEach((x: any) => { const m = String(x.batch_number || '').match(/^BATCH-\d{4}-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const num = p.batch_number || 'BATCH-' + ds + '-' + (maxN + 1);
  const item = { ...p, batch_number: num, local_id: gid(), created_at: new Date().toISOString() };
  await pushItem('payroll_batches', 'payroll_batches', item);
  return item;
}
export const deleteBatch = (id: string) => removeItem('payroll_batches', 'payroll_batches', id);

// ═══════════════════════════════════════════
//  🧮 محاسبه استاندارد حقوق
// ═══════════════════════════════════════════
// پله‌های مالیات (پیش‌فرض — قابل تنظیم)
export const TAX_BRACKETS = [
  { min: 0, max: 5000000, rate: 0 },
  { min: 5000000, max: 10000000, rate: 10 },
  { min: 10000000, max: 15000000, rate: 15 },
  { min: 15000000, max: 20000000, rate: 20 },
  { min: 20000000, max: 25000000, rate: 25 },
  { min: 25000000, max: Infinity, rate: 30 },
];

export function calcTax(monthlySalary: number): number {
  // معافیت سالانه → ماهانه (ساده‌شده)
  const annual = monthlySalary * 12;
  let tax = 0;
  TAX_BRACKETS.forEach(b => {
    if (annual > b.min) {
      const taxable = Math.min(annual, b.max) - b.min;
      if (taxable > 0) tax += taxable * (b.rate / 100);
    }
  });
  return Math.round(tax / 12);
}

export function calcInsurance(gross: number, rate: number = 7): number {
  return Math.round(gross * (rate / 100));
}

// ═══════════════════════════════════════════
//  📊 محاسبه حقوق یک کارمند در یک ماه
// ═══════════════════════════════════════════
export function calcEmployeeSalary(emp: any, month: string, atts: any[], loans: any[]) {
  const myAtts = atts.filter((a: any) => a.employee_code === emp.code && (a.date || '').startsWith(month));
  const present = myAtts.filter((a: any) => a.status === 'حاضر').length;
  const absent = myAtts.filter((a: any) => a.status === 'غایب').length;
  const leave = myAtts.filter((a: any) => a.status === 'مرخصی').length;
  const totalHours = myAtts.reduce((s: number, a: any) => s + (Number(a.hours) || 0), 0);
  const totalOT = myAtts.reduce((s: number, a: any) => s + (Number(a.overtime) || 0), 0);

  // حقوق پایه بر اساس نوع قرارداد
  const type = emp.contract_type || 'ماهانه';
  let base = 0;
  if (type === 'ماهانه') base = Math.round((Number(emp.base_salary || emp.amount) || 0) / 30 * present);
  else if (type === 'روزانه') base = (Number(emp.amount) || 0) * present;
  else if (type === 'ساعتی') base = (Number(emp.amount) || 0) * totalHours;

  // مزایا
  const housing = Number(emp.housing_allowance) || 0;
  const food = Number(emp.food_allowance) || 0;
  const transport = Number(emp.transport_allowance) || 0;
  const other = Number(emp.other_allowance) || 0;

  // اضافه‌کاری
  const otRate = Number(emp.overtime_rate) || 0;
  const ot = Math.round(totalOT * otRate * 1.4); // ۱.۴ برابر استاندارد

  // مجموع دریافتی (Gross)
  const gross = base + housing + food + transport + other + ot;

  // کسورات
  const insurance = calcInsurance(gross, 7);
  const employerInsurance = calcInsurance(gross, 23);
  const tax = calcTax(gross - insurance);

  // وام فعال این کارمند
  const activeLoan = loans.find((l: any) => l.employee_code === emp.code && l.status === 'active');
  const loanDeduction = activeLoan ? Number(activeLoan.monthly_amount) || 0 : 0;

  // کسر غیبت
  const dailyRate = type === 'ماهانه' ? (Number(emp.base_salary || emp.amount) || 0) / 30 : (Number(emp.amount) || 0);
  const absentDeduction = Math.round(absent * dailyRate);

  const totalDeductions = insurance + tax + loanDeduction + absentDeduction;
  const net = Math.max(0, gross - totalDeductions);

  return {
    attendance_days: present,
    absent_days: absent,
    leave_days: leave,
    worked_hours: totalHours,
    overtime_hours: totalOT,
    base_salary: base,
    housing_allowance: housing,
    food_allowance: food,
    transport_allowance: transport,
    other_allowance: other,
    overtime: ot,
    gross_salary: gross,
    employee_insurance: insurance,
    employer_insurance: employerInsurance,
    tax: tax,
    loan: loanDeduction,
    deduction: absentDeduction,
    net_salary: net,
  };
}
