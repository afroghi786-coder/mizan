// lib.emp.ts — Employees via SQLite
import { Employees, Attendance, Loans, Leaves, Salaries } from './lib.all.sqlite';

function genCode(): string {
  return 'EMP-' + Date.now().toString(36).toUpperCase();
}

// ─── Employees
export async function getEmployees(): Promise<any[]> {
  return Employees.getAll();
}

export async function createEmployee(p: any): Promise<any> {
  return Employees.save({ ...p, code: p.code || genCode() });
}

export async function updateEmployee(id: string, p: any): Promise<any> {
  const existing = await Employees.getById(id);
  return Employees.save({ ...(existing || {}), ...p, id });
}

export async function deleteEmployee(id: string): Promise<void> {
  return Employees.delete(id);
}

// ─── Attendance
export async function getAttendance(): Promise<any[]> {
  return Attendance.getAll();
}

export async function createAttendance(p: any): Promise<any> {
  return Attendance.save(p);
}

export async function updateAttendance(id: string, p: any): Promise<any> {
  const existing = await Attendance.getById(id);
  return Attendance.save({ ...(existing || {}), ...p, id });
}

export async function deleteAttendance(id: string): Promise<void> {
  return Attendance.delete(id);
}

// ─── Loans
export async function getLoans(): Promise<any[]> {
  return Loans.getAll();
}

export async function createLoan(p: any): Promise<any> {
  return Loans.save(p);
}

export async function deleteLoan(id: string): Promise<void> {
  return Loans.delete(id);
}

// ─── Leaves
export async function getLeaves(): Promise<any[]> {
  return Leaves.getAll();
}

export async function createLeave(p: any): Promise<any> {
  return Leaves.save(p);
}

export async function deleteLeave(id: string): Promise<void> {
  return Leaves.delete(id);
}

// ─── Salaries
export async function getSalaries(): Promise<any[]> {
  return Salaries.getAll();
}

export async function createSalary(p: any): Promise<any> {
  return Salaries.save(p);
}

export async function deleteSalary(id: string): Promise<void> {
  return Salaries.delete(id);
}
