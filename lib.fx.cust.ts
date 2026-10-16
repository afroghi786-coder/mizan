// lib.fx.cust.ts — Customers via SQLite
import { Customers } from './lib.all.sqlite';

export async function getAllCust(): Promise<any[]> {
  return Customers.getAll();
}

export async function saveCust(item: any): Promise<any> {
  return Customers.save(item);
}

export async function deleteCust(id: string): Promise<void> {
  return Customers.delete(id);
}
