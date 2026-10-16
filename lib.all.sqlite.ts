// lib.all.sqlite.ts — پیاده‌سازی SQLite برای همه Entity ها
// 🎯 هر entity با یک `makeEntity` ساخته می‌شه

import AsyncStorage from '@react-native-async-storage/async-storage';
import { dbGetAll, dbUpsert, dbDelete, dbGetById } from './libsqlite';

function genId(p: string): string {
  return p + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ═══════════════════════════════════════════
// Factory: ساخت CRUD برای یک table
// ═══════════════════════════════════════════
export function makeEntity(
  table: string,
  oldKey: string,
  fields: string[],
  idPrefix: string,
) {
  const fallbackGetAll = async (): Promise<any[]> => {
    try {
      const r = await AsyncStorage.getItem(oldKey);
      return r ? JSON.parse(r) : [];
    } catch { return []; }
  };

  const fallbackSave = async (item: any): Promise<any> => {
    try {
      const r = await AsyncStorage.getItem(oldKey);
      const all = r ? JSON.parse(r) : [];
      const id = item.id || item.local_id || genId(idPrefix);
      const enriched = { ...item, id, local_id: id, created_at: item.created_at || new Date().toISOString() };
      const next = [enriched, ...all.filter((x: any) => (x.id || x.local_id) !== id)];
      await AsyncStorage.setItem(oldKey, JSON.stringify(next));
      return enriched;
    } catch { return item; }
  };

  const fallbackDelete = async (id: string): Promise<void> => {
    try {
      const r = await AsyncStorage.getItem(oldKey);
      const all = r ? JSON.parse(r) : [];
      await AsyncStorage.setItem(oldKey, JSON.stringify(all.filter((x: any) => (x.id || x.local_id) !== id)));
    } catch {}
  };

  return {
    async getAll(): Promise<any[]> {
      const r = await dbGetAll(table);
      if (r.length === 0) {
        // اگه SQLite خالیه، fallback
        const fb = await fallbackGetAll();
        if (fb.length > 0) return fb;
      }
      return r;
    },

    async getById(id: string): Promise<any | null> {
      const r = await dbGetById(table, id);
      if (r) return r;
      const all = await fallbackGetAll();
      return all.find((x: any) => (x.id || x.local_id) === id) || null;
    },

    async save(item: any): Promise<any> {
      try {
        return await dbUpsert(table, item, fields);
      } catch {
        return await fallbackSave(item);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        await dbDelete(table, id);
      } catch {
        await fallbackDelete(id);
      }
    },
  };
}

// ═══════════════════════════════════════════
// Entity های آماده
// ═══════════════════════════════════════════
export const Customers   = makeEntity('customers',  '@mizan_local_fx_cust',      ['name','phone','code'],           'cust_');
export const Trades      = makeEntity('trades',     '@mizan_local_fx_trades',    ['from','to','amount'],            'trd_');
export const Partners    = makeEntity('partners',   '@mizan_local_fx_partners',  ['name','phone'],                  'prt_');
export const Hawalas     = makeEntity('hawalas',    '@mizan_local_fx_hawalas',   ['code','sender_name','beneficiary_name'], 'haw_');
export const Checks      = makeEntity('checks',     '@mizan_local_fx_checks',    ['check_number','bank','amount'],  'chk_');
export const Transfers   = makeEntity('transfers',  '@mizan_local_fx_transfers', ['from_box_code','to_box_code'],   'trf_');
export const Employees   = makeEntity('employees',  '@mizan_local_employees',    ['name','phone','role'],           'emp_');
export const Attendance  = makeEntity('attendance', '@mizan_local_attendance',   ['employee_id','date'],            'att_');
export const Loans       = makeEntity('loans',      '@mizan_local_loans',        ['employee_id','amount'],          'lon_');
export const Leaves      = makeEntity('leaves',     '@mizan_local_leaves',       ['employee_id','type'],            'lev_');
export const Salaries    = makeEntity('salaries',   '@mizan_local_salaries',     ['employee_id','month'],           'sal_');
export const Expenses    = makeEntity('expenses',   '@mizan_local_expenses',     ['title','amount'],                'exp_');
export const Products    = makeEntity('products',   '@mizan_local_products',     ['name','code'],                   'prd_');
export const Sales       = makeEntity('sales',      '@mizan_local_sales',        ['invoice','name','total'],        'sal_inv_');
export const Purchases   = makeEntity('purchases',  '@mizan_local_purchases',    ['invoice','name','total'],        'pur_inv_');
