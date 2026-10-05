// lib.emp.ts — ماژول کامل کارمندان (آفلاین + آنلاین)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib';

const KEY = (k: string) => '@mizan_local_' + k;
const get = async (k: string) => { try { const r = await AsyncStorage.getItem(KEY(k)); return r ? JSON.parse(r) : null; } catch { return null; } };
const set = async (k: string, v: any) => { try { await AsyncStorage.setItem(KEY(k), JSON.stringify(v)); } catch {} };
const genId = () => 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
const genCode = (prefix: string, list: any[], field: string, start = 1) => {
  let max = start - 1;
  list.forEach(x => {
    const m = String(x[field] || '').match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) { const n = +m[1]; if (n > max) max = n; }
  });
  return prefix + String(max + 1).padStart(3, '0');
};

// ═══════════════════════════════════════════
//  کارمندان
// ═══════════════════════════════════════════
export async function getEmployees(): Promise<any[]> {
  let list = (await get('employees')) || [];
  try {
    const { data } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
    if (data && data.length) {
      // merge
      const merged: Record<string, any> = {};
      list.forEach(x => merged[x.local_id || x.id] = x);
      data.forEach((x: any) => merged[x.local_id || x.id] = x);
      list = Object.values(merged);
    }
  } catch {}
  return list;
}
export async function createEmployee(p: any): Promise<any> {
  const list = await getEmployees();
  const code = p.code || genCode('EMP-', list, 'code', 1);
  const item = { ...p, code, local_id: genId(), created_at: new Date().toISOString() };
  await set('employees', [item, ...list]);
  try { await supabase.from('employees').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateEmployee(id: string, p: any) {
  const list = await getEmployees();
  await set('employees', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('employees').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteEmployee(id: string) {
  const list = await getEmployees();
  await set('employees', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('employees').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  حضور و غیاب
// ═══════════════════════════════════════════
export async function getAttendance(): Promise<any[]> {
  let list = (await get('attendance')) || [];
  try {
    const { data } = await supabase.from('attendance').select('*').order('created_at', { ascending: false });
    if (data && data.length) {
      const merged: Record<string, any> = {};
      list.forEach(x => merged[x.local_id || x.id] = x);
      data.forEach((x: any) => merged[x.local_id || x.id] = x);
      list = Object.values(merged);
    }
  } catch {}
  return list;
}
export async function createAttendance(p: any): Promise<any> {
  const list = await getAttendance();
  const item = { ...p, local_id: genId(), created_at: new Date().toISOString() };
  await set('attendance', [item, ...list]);
  try { await supabase.from('attendance').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateAttendance(id: string, p: any) {
  const list = await getAttendance();
  await set('attendance', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('attendance').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteAttendance(id: string) {
  const list = await getAttendance();
  await set('attendance', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('attendance').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  پرداخت حقوق (ردیفی)
// ═══════════════════════════════════════════
export async function getSalaryPayments(): Promise<any[]> {
  let list = (await get('salary_payments')) || [];
  try {
    const { data } = await supabase.from('salary_payments').select('*').order('created_at', { ascending: false });
    if (data && data.length) {
      const merged: Record<string, any> = {};
      list.forEach(x => merged[x.local_id || x.id] = x);
      data.forEach((x: any) => merged[x.local_id || x.id] = x);
      list = Object.values(merged);
    }
  } catch {}
  return list;
}
export async function createSalaryPayment(p: any): Promise<any> {
  const list = await getSalaryPayments();
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  let maxN = 1000;
  list.forEach((x: any) => { const m = String(x.invoice_number || '').match(/^PY-\d{6}-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; } });
  const inv = p.invoice_number || 'PY-' + ds + '-' + (maxN + 1);
  const item = { ...p, invoice_number: inv, local_id: genId(), created_at: new Date().toISOString() };
  await set('salary_payments', [item, ...list]);
  try { await supabase.from('salary_payments').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateSalaryPayment(id: string, p: any) {
  const list = await getSalaryPayments();
  await set('salary_payments', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('salary_payments').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteSalaryPayment(id: string) {
  const list = await getSalaryPayments();
  await set('salary_payments', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('salary_payments').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  وام و مساعده
// ═══════════════════════════════════════════
export async function getLoans(): Promise<any[]> {
  let list = (await get('employee_loans')) || [];
  try {
    const { data } = await supabase.from('employee_loans').select('*').order('created_at', { ascending: false });
    if (data && data.length) {
      const merged: Record<string, any> = {};
      list.forEach(x => merged[x.local_id || x.id] = x);
      data.forEach((x: any) => merged[x.local_id || x.id] = x);
      list = Object.values(merged);
    }
  } catch {}
  return list;
}
export async function createLoan(p: any): Promise<any> {
  const list = await getLoans();
  const item = { ...p, local_id: genId(), created_at: new Date().toISOString() };
  await set('employee_loans', [item, ...list]);
  try { await supabase.from('employee_loans').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateLoan(id: string, p: any) {
  const list = await getLoans();
  await set('employee_loans', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('employee_loans').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteLoan(id: string) {
  const list = await getLoans();
  await set('employee_loans', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('employee_loans').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
