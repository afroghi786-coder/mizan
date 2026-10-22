// lib.emp.ts — استاندارد آفلاین/آنلاین (منطق محاسبات دست‌نخورده)
import AsyncStorage from './lib.storage';
import { supabase } from './lib';
import { getMode, enqueue } from './lib.offline';

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
    return true;
  } catch (e) { console.log('[writeLocal ERR]', key, e); return false; }
}

async function fetchAll(table: string, key: string): Promise<any[]> {
  const local = await readLocal(key);
  if (getMode() === 'offline') return local;
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

async function saveItem(table: string, key: string, item: any, isUpdate: boolean, opName: string): Promise<any> {
  const list = await readLocal(key);
  const idx = list.findIndex(x => (x.local_id || x.id) === (item.local_id || item.id));
  const newList = idx >= 0
    ? list.map((x, i) => i === idx ? { ...x, ...item } : x)
    : [item, ...list];
  const ok = await writeLocal(key, newList);
  if (!ok) throw new Error('ذخیره محلی ناموفق');

  const cleanItem: any = { ...item };
  delete cleanItem.user_id;
  delete cleanItem.id;

  if (getMode() === 'online') {
    try {
      const { error } = isUpdate
        ? await supabase.from(table).upsert(cleanItem, { onConflict: 'local_id' })
        : await supabase.from(table).insert(cleanItem);
      if (error) { console.log('[supa write]', table, error.message); await enqueue(opName, item); }
    } catch (e) { console.log('[supa write exc]', table, e); await enqueue(opName, item); }
  } else {
    await enqueue(opName, item);
  }
  return item;
}

async function removeById(table: string, key: string, id: string, opName: string) {
  const list = await readLocal(key);
  await writeLocal(key, list.filter(x => x.local_id !== id && x.id !== id));
  if (getMode() === 'online') {
    try {
      const { error } = await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id);
      if (error) await enqueue(opName, id);
    } catch { await enqueue(opName, id); }
  } else {
    await enqueue(opName, id);
  }
}

// ═══════════════════════════════════════════
//  کارمندان
// ═══════════════════════════════════════════
export const getEmployees = () => fetchAll('employees', 'employees');
export async function createEmployee(p: any): Promise<any> {
  const list = await readLocal('employees');
  const code = (p.code && String(p.code).trim()) || ('EMP-' + String(list.length + 1).padStart(4, '0'));
  const item = { ...p, code, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('employees', 'employees', item, false, 'createEmployee');
}
export const updateEmployee = (id: string, p: any) => saveItem('employees', 'employees', { ...p, local_id: id }, true, 'updateEmployee');
export const deleteEmployee = (id: string) => removeById('employees', 'employees', id, 'deleteEmployee');

// ═══════════════════════════════════════════
//  حضور
// ═══════════════════════════════════════════
export const getAttendance = () => fetchAll('attendance', 'attendance');
export async function createAttendance(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('attendance', 'attendance', item, false, 'createAttendance');
}
export const deleteAttendance = (id: string) => removeById('attendance', 'attendance', id, 'deleteAttendance');

// ═══════════════════════════════════════════
//  مرخصی
// ═══════════════════════════════════════════
export const getLeaves = () => fetchAll('employee_leaves', 'employee_leaves');
export async function createLeave(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('employee_leaves', 'employee_leaves', item, false, 'createLeave');
}
export const deleteLeave = (id: string) => removeById('employee_leaves', 'employee_leaves', id, 'deleteLeave');

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
  return await saveItem('salary_payments', 'salary_payments', item, false, 'createSalaryPayment');
}
export const updateSalaryPayment = (id: string, p: any) => saveItem('salary_payments', 'salary_payments', { ...p, local_id: id }, true, 'updateSalaryPayment');
export const deleteSalaryPayment = (id: string) => removeById('salary_payments', 'salary_payments', id, 'deleteSalaryPayment');

// ═══════════════════════════════════════════
//  وام
// ═══════════════════════════════════════════
export const getLoans = () => fetchAll('employee_loans', 'employee_loans');
export async function createLoan(p: any) {
  const item = { ...p, local_id: gid(), created_at: new Date().toISOString() };
  return await saveItem('employee_loans', 'employee_loans', item, false, 'createLoan');
}
export const deleteLoan = (id: string) => removeById('employee_loans', 'employee_loans', id, 'deleteLoan');

// ═══════════════════════════════════════════
//  Batch حقوق
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
  return await saveItem('payroll_batches', 'payroll_batches', item, false, 'createBatch');
}
export const deleteBatch = (id: string) => removeById('payroll_batches', 'payroll_batches', id, 'deleteBatch');

// ═══════════════════════════════════════════
//  محاسبات (دست‌نخورده)
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

export function calcEmployeeSalary(
  emp: any,
  month: string,
  atts: any[],
  loans: any[],
  leaves: any[] = [],
  salaries: any[] = [],
  settings: any = {}
) {
  const cfg = {
    deduct_absence: settings?.deduct_absence !== false,
    absence_rate: Math.max(0, Number(settings?.absence_rate ?? 1.0)),
    deduct_unpaid_leave: settings?.deduct_unpaid_leave === true,
    unpaid_leave_rate: Math.max(0, Number(settings?.unpaid_leave_rate ?? 1.0)),
    deduct_paid_leave: settings?.deduct_paid_leave === true,
    paid_leave_rate: Math.max(0, Number(settings?.paid_leave_rate ?? 1.0)),
    deduct_sick_leave: settings?.deduct_sick_leave === true,
    sick_leave_rate: Math.max(0, Number(settings?.sick_leave_rate ?? 0.5)),
    insurance_rate: Math.max(0, Number(settings?.insurance_rate ?? 7)),
    employer_insurance_rate: Math.max(0, Number(settings?.employer_insurance_rate ?? 23)),
    auto_tax: settings?.auto_tax !== false,
    loan_deduction: settings?.loan_deduction !== false,
    overtime_rate_multiplier: Math.max(0, Number(settings?.overtime_rate_multiplier ?? 1.4)),
    work_days_per_month: Math.max(1, Number(settings?.work_days_per_month ?? 30)),
  };

  const myAtts = (atts || []).filter((a: any) => a.employee_code === emp.code && String(a.date || '').startsWith(month));
  const present = myAtts.filter((a: any) => a.status === 'حاضر').length;
  const absent = myAtts.filter((a: any) => a.status === 'غایب').length;
  const leaveFromAtt = myAtts.filter((a: any) => a.status === 'مرخصی').length;
  const totalHours = myAtts.reduce((s: number, a: any) => s + (Number(a.hours) || 0), 0);
  const totalOT = myAtts.reduce((s: number, a: any) => s + (Number(a.overtime) || 0), 0);

  const myLeaves = (leaves || []).filter((l: any) => {
    if (l.employee_code !== emp.code) return false;
    if (l.status && l.status !== 'approved') return false;
    const from = String(l.from_date || '');
    const to = String(l.to_date || '');
    return from.startsWith(month) || to.startsWith(month);
  });
  const annualLeaveDays = myLeaves.filter((l: any) => l.leave_type === 'annual').reduce((s: number, l: any) => s + (Number(l.days) || 0), 0);
  const sickLeaveDays = myLeaves.filter((l: any) => l.leave_type === 'sick').reduce((s: number, l: any) => s + (Number(l.days) || 0), 0);
  const unpaidLeaveDays = myLeaves.filter((l: any) => l.leave_type === 'unpaid').reduce((s: number, l: any) => s + (Number(l.days) || 0), 0);
  const totalLeave = leaveFromAtt + annualLeaveDays + sickLeaveDays + unpaidLeaveDays;

  const type = emp.contract_type || 'ماهانه';
  const base = type === 'ماهانه'
    ? Math.round((Number(emp.base_salary || emp.amount) || 0) / cfg.work_days_per_month * present)
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
  const ot = Math.round(totalOT * otRate * cfg.overtime_rate_multiplier);

  const gross = base + housing + food + transport + other + ot;

  const insurance = Math.round(gross * (cfg.insurance_rate / 100));
  const employerInsurance = Math.round(gross * (cfg.employer_insurance_rate / 100));
  const tax = cfg.auto_tax ? calcTax(gross - insurance) : 0;

  const activeLoan = cfg.loan_deduction
    ? (loans || []).find((l: any) => l.employee_code === emp.code && l.status === 'active')
    : null;
  const loanDeduction = activeLoan ? Number(activeLoan.monthly_amount) || 0 : 0;

  const dailyRate = type === 'ماهانه'
    ? (Number(emp.base_salary || emp.amount) || 0) / cfg.work_days_per_month
    : (Number(emp.amount) || 0);

  const absentDeduction = cfg.deduct_absence ? Math.round(absent * dailyRate * cfg.absence_rate) : 0;
  const unpaidLeaveDeduction = cfg.deduct_unpaid_leave ? Math.round(unpaidLeaveDays * dailyRate * cfg.unpaid_leave_rate) : 0;
  const paidLeaveDeduction = cfg.deduct_paid_leave ? Math.round(annualLeaveDays * dailyRate * cfg.paid_leave_rate) : 0;
  const sickLeaveDeduction = cfg.deduct_sick_leave ? Math.round(sickLeaveDays * dailyRate * cfg.sick_leave_rate) : 0;

  const totalOtherDeductions = absentDeduction + unpaidLeaveDeduction + paidLeaveDeduction + sickLeaveDeduction;
  const totalDeductions = insurance + tax + loanDeduction + totalOtherDeductions;
  const net = Math.max(0, gross - totalDeductions);

  const mySalaries = (salaries || []).filter((x: any) => {
    if (x.employee_code !== emp.code) return false;
    const m = String(x.month || '');
    const d = String(x.payment_date || '');
    return m.startsWith(month) || d.startsWith(month);
  });
  const alreadyPaid = mySalaries.reduce((acc: number, x: any) => acc + (Number(x.payment) || 0), 0);
  const remaining = Math.max(0, net - alreadyPaid);

  return {
    attendance_days: present, absent_days: absent,
    leave_days: totalLeave,
    paid_leave_days: annualLeaveDays + sickLeaveDays,
    unpaid_leave_days: unpaidLeaveDays,
    annual_leave_days: annualLeaveDays,
    sick_leave_days: sickLeaveDays,
    worked_hours: totalHours, overtime_hours: totalOT,
    base_salary: base,
    housing_allowance: housing, food_allowance: food,
    transport_allowance: transport, other_allowance: other, overtime: ot,
    gross_salary: gross,
    employee_insurance: insurance, employer_insurance: employerInsurance, tax,
    loan: loanDeduction,
    deduction: absentDeduction,
    absence_deduction: absentDeduction,
    unpaid_leave_deduction: unpaidLeaveDeduction,
    paid_leave_deduction: paidLeaveDeduction,
    sick_leave_deduction: sickLeaveDeduction,
    total_other_deductions: totalOtherDeductions,
    total_deductions: totalDeductions,
    net_salary: net,
    already_paid: alreadyPaid,
    remaining: remaining,
    _config: cfg,
  };
}
