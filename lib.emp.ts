// lib.emp.ts — نسخه محکم و ساده
import AsyncStorage from 'expo-sqlite/kv-store';
import { supabase } from './lib';

const K = (k: string) => '@mizan_local_' + k;
const gid = () => 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

async function readLocal(key: string): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(K(key));
    if (!r) return [];
    const parsed = JSON.parse(r);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { console.log('[readLocal]', key, e); return []; }
}

async function writeLocal(key: string, list: any[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(K(key), JSON.stringify(list));
    console.log('[writeLocal]', key, 'count:', list.length);
    return true;
  } catch (e) { console.log('[writeLocal ERR]', key, e); return false; }
}

async function fetchAll(table: string, key: string): Promise<any[]> {
  const local = await readLocal(key);
  try {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) { console.log('[supa read]', table, error.message); return local; }
    if (data && data.length) {
      const merged: Record<string, any> = {};
      local.forEach(x => { merged[x.local_id || x.id] = x; });
      data.forEach(x => { merged[x.local_id || x.id] = x; });
      return Object.values(merged);
    }
  } catch (e) { console.log('[supa read exc]', table, e); }
  return local;
}

async function saveItem(table: string, key: string, item: any, isUpdate: boolean): Promise<any> {
  const list = await readLocal(key);
  const idx = list.findIndex(x => (x.local_id || x.id) === (item.local_id || item.id));
  let newList;
  if (idx >= 0) {
    newList = list.map((x, i) => i === idx ? { ...x, ...item } : x);
  } else {
    newList = [item, ...list];
  }
  const ok = await writeLocal(key, newList);
  if (!ok) throw new Error('ذخیره محلی ناموفق');

  // supabase در پس‌زمینه
  try {
    const cleanItem: any = { ...item };
    delete cleanItem.user_id;
    delete cleanItem.id;
    if (isUpdate) {
      const { error } = await supabase.from(table).upsert(cleanItem, { onConflict: 'local_id' });
      if (error) console.log('[supa upsert]', table, error.message);
    } else {
      const { error } = await supabase.from(table).insert(cleanItem);
      if (error) console.log('[supa insert]', table, error.message);
    }
  } catch (e) { console.log('[supa exc]', table, e); }

  return item;
}

async function removeById(table: string, key: string, id: string) {
  const list = await readLocal(key);
  await writeLocal(key, list.filter(x => x.local_id !== id && x.id !== id));
  try { await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  کارمندان
// ═══════════════════════════════════════════
export const getEmployees = () => fetchAll('employees', 'employees');

export async function createEmployee(p: any): Promise<any> {
  const list = await readLocal('employees');
  const code = (p.code && String(p.code).trim()) || ('EMP-' + String(list.length + 1).padStart(4, '0'));
  const item = { ...p, code, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('employees', 'employees', item, false);
}
export const updateEmployee = (id: string, p: any) => saveItem('employees', 'employees', { ...p, local_id: id }, true);
export const deleteEmployee = (id: string) => removeById('employees', 'employees', id);

// ═══════════════════════════════════════════
//  حضور
// ═══════════════════════════════════════════
export const getAttendance = () => fetchAll('attendance', 'attendance');
export async function createAttendance(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('attendance', 'attendance', item, false);
}
export const deleteAttendance = (id: string) => removeById('attendance', 'attendance', id);

// ═══════════════════════════════════════════
//  مرخصی
// ═══════════════════════════════════════════
export const getLeaves = () => fetchAll('employee_leaves', 'employee_leaves');
export async function createLeave(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('employee_leaves', 'employee_leaves', item, false);
}
export const deleteLeave = (id: string) => removeById('employee_leaves', 'employee_leaves', id);

// ═══════════════════════════════════════════
//  پرداخت حقوق
// ═══════════════════════════════════════════
export const getSalaryPayments = () => fetchAll('salary_payments', 'salary_payments');
export async function createSalaryPayment(p: any) {
  const list = await readLocal('salary_payments');
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  let maxN = 1000;
  list.forEach(x => { const m = String(x.invoice_number || '').match(/^PY-\d{6}-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const inv = p.invoice_number || 'PY-' + ds + '-' + (maxN + 1);
  const item = { ...p, invoice_number: inv, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('salary_payments', 'salary_payments', item, false);
}
export const updateSalaryPayment = (id: string, p: any) => saveItem('salary_payments', 'salary_payments', { ...p, local_id: id }, true);
export const deleteSalaryPayment = (id: string) => removeById('salary_payments', 'salary_payments', id);

// ═══════════════════════════════════════════
//  وام
// ═══════════════════════════════════════════
export const getLoans = () => fetchAll('employee_loans', 'employee_loans');
export async function createLoan(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('employee_loans', 'employee_loans', item, false);
}
export const deleteLoan = (id: string) => removeById('employee_loans', 'employee_loans', id);

// ═══════════════════════════════════════════
//  Batch
// ═══════════════════════════════════════════
export const getBatches = () => fetchAll('payroll_batches', 'payroll_batches');
export async function createBatch(p: any) {
  const list = await readLocal('payroll_batches');
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
  let maxN = 1000;
  list.forEach(x => { const m = String(x.batch_number || '').match(/^BATCH-\d{4}-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const num = p.batch_number || 'BATCH-' + ds + '-' + (maxN + 1);
  const item = { ...p, batch_number: num, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('payroll_batches', 'payroll_batches', item, false);
}
export const deleteBatch = (id: string) => removeById('payroll_batches', 'payroll_batches', id);

// ═══════════════════════════════════════════
//  محاسبات
// ═══════════════════════════════════════════
export const TAX_BRACKETS = [
  { min: 0, max: 5000000, rate: 0 },
  { min: 5000000, max: 10000000, rate: 10 },
  { min: 10000000, max: 15000000, rate: 15 },
  { min: 15000000, max: 20000000, rate: 20 },
  { min: 20000000, max: 25000000, rate: 25 },
  { min: 25000000, max: Infinity, rate: 30 },
];

export function calcTax(monthlySalary: number): number {
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

export function calcEmployeeSalary(emp: any, month: string, atts: any[], loans: any[]) {
  const myAtts = (atts || []).filter((a: any) => a.employee_code === emp.code && String(a.date || '').startsWith(month));
  const present = myAtts.filter(a => a.status === 'حاضر').length;
  const absent = myAtts.filter(a => a.status === 'غایب').length;
  const leave = myAtts.filter(a => a.status === 'مرخصی').length;
  const totalHours = myAtts.reduce((s, a) => s + (Number(a.hours) || 0), 0);
  const totalOT = myAtts.reduce((s, a) => s + (Number(a.overtime) || 0), 0);

  const type = emp.contract_type || 'ماهانه';
  const base = type === 'ماهانه'
    ? Math.round((Number(emp.base_salary || emp.amount) || 0) / 30 * present)
    : type === 'روزانه'
    ? (Number(emp.amount) || 0) * present
    : type === 'ساعتی'
    ? (Number(emp.amount) || 0) * totalHours
    : 0;

  const housing = Number(emp.housing_allowance) || 0;
  const food = Number(emp.food_allowance) || 0;
  const transport = Number(emp.transport_allowance) || 0;
  const other = Number(emp.other_allowance) || 0;
  const otRate = Number(emp.overtime_rate) || 0;
  const ot = Math.round(totalOT * otRate * 1.4);

  const gross = base + housing + food + transport + other + ot;
  const insurance = calcInsurance(gross, 7);
  const employerInsurance = calcInsurance(gross, 23);
  const tax = calcTax(gross - insurance);

  const activeLoan = (loans || []).find((l: any) => l.employee_code === emp.code && l.status === 'active');
  const loanDeduction = activeLoan ? Number(activeLoan.monthly_amount) || 0 : 0;
  const dailyRate = type === 'ماهانه' ? (Number(emp.base_salary || emp.amount) || 0) / 30 : (Number(emp.amount) || 0);
  const absentDeduction = Math.round(absent * dailyRate);
  const net = Math.max(0, gross - insurance - tax - loanDeduction - absentDeduction);

  return {
    attendance_days: present, absent_days: absent, leave_days: leave,
    worked_hours: totalHours, overtime_hours: totalOT,
    base_salary: base,
    housing_allowance: housing, food_allowance: food,
    transport_allowance: transport, other_allowance: other, overtime: ot,
    gross_salary: gross,
    employee_insurance: insurance, employer_insurance: employerInsurance, tax,
    loan: loanDeduction, deduction: absentDeduction, net_salary: net,
  };
}
