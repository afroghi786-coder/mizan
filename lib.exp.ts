// lib.exp.ts — Expenses via SQLite
import { Expenses } from './lib.all.sqlite';

export async function getExpenses(): Promise<any[]> {
  return Expenses.getAll();
}

export async function createExpense(p: any): Promise<any> {
  return Expenses.save(p);
}

export async function updateExpense(id: string, p: any): Promise<any> {
  const existing = await Expenses.getById(id);
  return Expenses.save({ ...(existing || {}), ...p, id });
}

export async function deleteExpense(id: string): Promise<void> {
  return Expenses.delete(id);
}
