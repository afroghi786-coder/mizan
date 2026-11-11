import AsyncStorage from './lib.storage';
import { bridgeDeleteTable, bridgeSaveTable } from './lib.sheets';

import type { RowSnapshot } from './lib.snapshot';

const TOMBSTONE_KEY = '@mizan_tombstones';
const ENRICH_CACHE_KEY = '@mizan_enrich_cache_ts';
const ENRICH_CACHE_TTL_MS = 5 * 60 * 1000;
const DELETED_TAB = '_deleted';

const BUSINESS_TABLES = [
  'sales', 'purchases', 'sales_returns', 'purchase_returns',
  'expenses', 'employees', 'salary_payments', 'employee_loans',
  'attendance', 'employee_leaves', 'payroll_batches',
  'parties', 'partners', 'partner_transactions', 'partner_bank_accounts',
  'products', 'banks', 'shippings', 'stock_adjustments',
];

export const TABLE_LABELS: Record<string, string> = {
  sales: 'فروش',
  purchases: 'خرید',
  sales_returns: 'مرجوعی فروش',
  purchase_returns: 'مرجوعی خرید',
  expenses: 'هزینه‌ها',
  employees: 'کارمندان',
  salary_payments: 'حقوق',
  employee_loans: 'وام کارمندان',
  attendance: 'حضور و غیاب',
  employee_leaves: 'مرخصی',
  payroll_batches: 'دسته‌های حقوق',
  parties: 'طرف‌حساب‌ها',
  partners: 'شرکا',
  partner_transactions: 'تراکنش شرکا',
  partner_bank_accounts: 'حساب بانکی شرکا',
  products: 'محصولات',
  banks: 'بانک‌ها',
  shippings: 'باربری',
  stock_adjustments: 'اصلاح موجودی',
};

export type DeletedItem = {
  table: string;
  key: string;
  deleted_at: string;
  device_id: string;
  device_label?: string;
  tableLabel: string;
  snapshot: RowSnapshot | null;
};

export function isBusinessTable(table: string): boolean {
  return BUSINESS_TABLES.includes(table);
}

async function _readTombstones(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONE_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    return arr;
  } catch { return []; }
}

async function _writeTombstones(arr: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TOMBSTONE_KEY, JSON.stringify(arr || []));
  } catch {}
}

async function _rewriteDeletedTab(remaining: any[]): Promise<void> {
  try {
    const cleanRows = (remaining || []).map((t: any) => {
      const row: any = {
        table: String(t.table || ''),
        key: String(t.key || ''),
        deleted_at: String(t.deleted_at || ''),
        device_id: String(t.device_id || ''),
        device_label: String(t.device_label || ''),
      };
      try {
        if (t.snapshot) {
          let obj: any = t.snapshot;
          if (typeof obj === 'string') {
            try { obj = JSON.parse(obj); } catch { obj = null; }
          }
          if (obj) {
            try {
              if (obj.raw && Array.isArray(obj.raw.items) && obj.raw.items.length > 2) {
                obj = JSON.parse(JSON.stringify(obj));
                obj.raw.items = obj.raw.items.slice(0, 2);
              }
              if (obj.raw && Array.isArray(obj.raw.rows) && obj.raw.rows.length > 2) {
                obj.raw.rows = obj.raw.rows.slice(0, 2);
              }
            } catch {}
            let s = JSON.stringify(obj);
            if (s.length > 3500) {
              try {
                const trimmed = { primary: obj.primary || '', secondary: obj.secondary || '', raw: { invoice: obj.raw?.invoice, name: obj.raw?.name, total: obj.raw?.total, date: obj.raw?.date } };
                s = JSON.stringify(trimmed);
              } catch {}
            }
            row.snapshot = s;
          } else {
            row.snapshot = '';
          }
        } else {
          row.snapshot = '';
        }
      } catch { row.snapshot = ''; }
      return row;
    });
    await bridgeSaveTable(DELETED_TAB, cleanRows);
  } catch (e: any) {
    console.log('[recovery] rewrite _deleted:', e?.message);
  }
}

const DEVICE_LABELS_MAP_KEY = '@mizan_device_labels_map';
const KEY_FIELDS_FOR_LOOKUP = ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id'];

export async function getDeviceLabelsMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_LABELS_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function _setDeviceLabelsMap(map: Record<string, string>): Promise<void> {
  try { await AsyncStorage.setItem(DEVICE_LABELS_MAP_KEY, JSON.stringify(map)); } catch {}
}

export async function setDeviceName(deviceId: string, name: string): Promise<void> {
  const id = String(deviceId || '').trim();
  if (!id) return;
  const nm = String(name || '').trim();
  const map = await getDeviceLabelsMap();
  if (nm) map[id] = nm; else delete map[id];
  await _setDeviceLabelsMap(map);
  const arr = await _readTombstones();
  for (const t of arr) {
    if (t && String(t.device_id || '') === id) {
      if (nm) t.device_label = nm;
    }
  }
  await _writeTombstones(arr);
  await _rewriteDeletedTab(arr);
}

export async function enrichMissingSnapshots(): Promise<{ ok: boolean; enriched: number; error?: string }> {
  try {
    const arr = await _readTombstones();
    const missing = arr.filter((t: any) => t && isBusinessTable(String(t.table || '')) && !t.snapshot);
    if (missing.length === 0) return { ok: true, enriched: 0 };

    const pullRes: any = await bridgePull();
    const tables = pullRes?.tables || {};
    let enriched = 0;

    for (const t of missing) {
      const rows = tables[t.table] || [];
      if (!Array.isArray(rows)) continue;
      const targetKey = String(t.key || '').trim();
      const row = rows.find((r: any) => {
        if (!r) return false;
        for (const f of KEY_FIELDS_FOR_LOOKUP) {
          const v = r[f];
          if (v !== undefined && v !== null && String(v).trim() === targetKey) return true;
        }
        return false;
      });
      if (row) {
        t.snapshot = { primary: '', secondary: '', raw: row };
        enriched++;
      }
    }

    if (enriched > 0) {
      await _writeTombstones(arr);
      await _rewriteDeletedTab(arr);
    }
    return { ok: true, enriched };
  } catch (e: any) { return { ok: false, enriched: 0, error: e?.message }; }
}

export async function getDeletedItems(): Promise<DeletedItem[]> {
  const arr = await _readTombstones();
  const out: DeletedItem[] = [];
  for (const t of arr) {
    if (!t) continue;
    const table = String(t.table || '').trim();
    const key = String(t.key || '').trim();
    if (!table || !key) continue;
    if (!isBusinessTable(table)) continue;
    out.push({
      table,
      key,
      deleted_at: String(t.deleted_at || ''),
      device_id: String(t.device_id || ''),
      device_label: String(t.device_label || ''),
      tableLabel: TABLE_LABELS[table] || table,
      snapshot: (t as any).snapshot || null,
    });
  }
  try {
    const labelMapForTombstones = await getDeviceLabelsMap();
    for (const item of out) {
      if (!item.device_label && item.device_id) {
        item.device_label = labelMapForTombstones[item.device_id] || '';
      }
    }
    const snapMod = await import('./lib.snapshot');
    for (const item of out) {
      if (item.snapshot) continue;
      try {
        (item as any).snapshot = await snapMod.getRowSnapshot(item.table, item.key);
      } catch {}
    }
  } catch {}
  out.sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || ''));
  return out;
}

export async function getDeletedCount(): Promise<number> {
  const items = await getDeletedItems();
  return items.length;
}


export async function restoreAuditEdit(table: string, key: string, beforeData: any) {
  try {
    const storageKey = '@mizan_' + table;
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return { ok: false, error: 'داده‌ای یافت نشد' };
    let list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [list];
    
    const idx = list.findIndex((x: any) => String(x.id || x.key || x.code) === String(key));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...beforeData };
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
      return { ok: true };
    }
    return { ok: false, error: 'آیتم در جدول یافت نشد' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function restoreItem(table: string, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isBusinessTable(table)) return { ok: false, error: 'جدول مجاز نیست' };
    const arr = await _readTombstones();
    const remaining = arr.filter((t: any) => {
      if (!t) return false;
      if (String(t.table) === table && String(t.key) === key) return false;
      return true;
    });
    await _writeTombstones(remaining);
    await _rewriteDeletedTab(remaining);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا' };
  }
}

async function _removeFromLocalStorage(table: string, key: string): Promise<void> {
  try {
    const k = String(key || '').trim();
    if (!k) return;
    const KEY_FIELDS = ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id'];
    const targetKeys: string[] = ['@mizan_local_' + table];
    if (table === 'sales') targetKeys.push('@mizan_local_sales_grouped');
    if (table === 'purchases') targetKeys.push('@mizan_local_purchases_grouped');
    if (table === 'sales_returns') targetKeys.push('@mizan_local_sales_returns_grouped');
    if (table === 'purchase_returns') targetKeys.push('@mizan_local_purchase_returns_grouped');
    let allKeys: string[] = [];
    try { allKeys = await AsyncStorage.getAllKeys(); } catch { allKeys = []; }
    if (Array.isArray(allKeys)) {
      for (const ak of allKeys) {
        if (table === 'partner_transactions' && ak.includes('_local_ptx_') && targetKeys.indexOf(ak) < 0) targetKeys.push(ak);
        if (table === 'partner_bank_accounts' && ak.includes('_local_pba_') && targetKeys.indexOf(ak) < 0) targetKeys.push(ak);
        if (ak.indexOf('_local_' + table) >= 0 && targetKeys.indexOf(ak) < 0) targetKeys.push(ak);
      }
    }
    let removed = 0;
    for (const tk of targetKeys) {
      try {
        const raw = await AsyncStorage.getItem(tk);
        if (!raw) continue;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) continue;
        const kept = arr.filter((row: any) => {
          if (!row || typeof row !== 'object') return true;
          for (const f of KEY_FIELDS) {
            const v = row[f];
            if (v !== undefined && v !== null && String(v).trim() === k) return false;
          }
          return true;
        });
        if (kept.length !== arr.length) {
          await AsyncStorage.setItem(tk, JSON.stringify(kept));
          removed += (arr.length - kept.length);
          console.log('[recovery] removed', (arr.length - kept.length), 'from', tk);
        }
      } catch {}
    }
    console.log('[recovery] total local rows removed:', removed);
  } catch (e: any) { console.log('[recovery] local cleanup:', e?.message); }
}

export async function permanentlyDeleteItem(table: string, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isBusinessTable(table)) return { ok: false, error: 'جدول مجاز نیست' };
    let bridgeFailed = '';
    try {
      const res: any = await bridgeDeleteTable(table, [key]);
      if (res && typeof res.deleted === 'number' && res.deleted === 0) {
        bridgeFailed = 'ردیف در شیت پیدا نشد';
      } else if (res && res.ok === false) {
        bridgeFailed = String(res.error || 'خطا در حذف از شیت');
      }
    } catch (e: any) {
      bridgeFailed = e?.message || 'خطا در اتصال به شیت';
    }
    if (bridgeFailed) {
      return { ok: false, error: 'حذف از شیت انجام نشد: ' + bridgeFailed };
    }
    await _removeFromLocalStorage(table, key);
    const arr = await _readTombstones();
    const remaining = arr.filter((t: any) => {
      if (!t) return false;
      if (String(t.table) === table && String(t.key) === key) return false;
      return true;
    });
    await _writeTombstones(remaining);
    await _rewriteDeletedTab(remaining);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا' };
  }
}

export async function restoreAll(): Promise<{ ok: boolean; error?: string }> {
  try {
    const arr = await _readTombstones();
    const remaining = arr.filter((t: any) => !t || !isBusinessTable(String(t.table || '')));
    await _writeTombstones(remaining);
    await _rewriteDeletedTab(remaining);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطا' };
  }
}


export async function restoreMany(items: { table: string; key: string }[]): Promise<{ ok: boolean; restored: number; error?: string }> {
  try {
    const arr = await _readTombstones();
    const keySet = new Set(items.map(x => x.table + '|' + x.key));
    const remaining = arr.filter((t: any) => !t || !keySet.has(String(t.table) + '|' + String(t.key)));
    const removed = arr.length - remaining.length;
    await _writeTombstones(remaining);
    await _rewriteDeletedTab(remaining);
    return { ok: true, restored: removed };
  } catch (e: any) { return { ok: false, restored: 0, error: e?.message }; }
}

export async function permanentlyDeleteMany(items: { table: string; key: string }[]): Promise<{ ok: boolean; deleted: number; failed: number; error?: string }> {
  let deleted = 0, failed = 0;
  for (const it of items) {
    try {
      const r = await permanentlyDeleteItem(it.table, it.key);
      if (r.ok) deleted++; else failed++;
    } catch { failed++; }
  }
  return { ok: failed === 0, deleted, failed };
}


export async function shouldEnrich(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ENRICH_CACHE_KEY);
    const ts = Number(raw || 0);
    return Date.now() - ts > ENRICH_CACHE_TTL_MS;
  } catch { return true; }
}

export async function markEnriched(): Promise<void> {
  try { await AsyncStorage.setItem(ENRICH_CACHE_KEY, String(Date.now())); } catch {}
}


export async function cleanupOldTombstones(daysOld: number = 30): Promise<{ ok: boolean; removed: number; remaining: number; error?: string }> {
  try {
    const arr = await _readTombstones();
    const cutoffMs = Date.now() - daysOld * 86400000;
    const remaining = arr.filter((t: any) => {
      if (!t) return false;
      const at = t.deleted_at ? new Date(t.deleted_at).getTime() : 0;
      if (!at) return true;
      return at >= cutoffMs;
    });
    const removed = arr.length - remaining.length;
    if (removed > 0) {
      await _writeTombstones(remaining);
      await _rewriteDeletedTab(remaining);
    }
    return { ok: true, removed, remaining: remaining.length };
  } catch (e: any) { return { ok: false, removed: 0, remaining: 0, error: e?.message || 'خطا' }; }
}

export async function getTombstoneStats(): Promise<{ total: number; oldest: string; newest: string; byTable: Record<string, number> }> {
  try {
    const arr = await _readTombstones();
    const byTable: Record<string, number> = {};
    let oldest = '';
    let newest = '';
    for (const t of arr) {
      if (!t) continue;
      const tab = String(t.table || '');
      if (tab) byTable[tab] = (byTable[tab] || 0) + 1;
      const at = String(t.deleted_at || '');
      if (at) {
        if (!oldest || at < oldest) oldest = at;
        if (!newest || at > newest) newest = at;
      }
    }
    return { total: arr.length, oldest, newest, byTable };
  } catch { return { total: 0, oldest: '', newest: '', byTable: {} }; }
}


export async function cleanupAllLocalTombstones(): Promise<{ ok: boolean; tombstones: number; rowsRemoved: number; error?: string }> {
  try {
    const arr = await _readTombstones();
    let rowsRemoved = 0;
    for (const t of arr) {
      if (!t) continue;
      const tab = String(t.table || '').trim();
      const key = String(t.key || '').trim();
      if (!tab || !key) continue;
      try { await _removeFromLocalStorage(tab, key); rowsRemoved++; } catch {}
    }
    await _writeTombstones([]);
    try { await _rewriteDeletedTab([]); } catch {}
    return { ok: true, tombstones: arr.length, rowsRemoved };
  } catch (e: any) { return { ok: false, tombstones: 0, rowsRemoved: 0, error: e?.message || 'خطا' }; }
}


export async function cleanupTombstonesByHours(hoursOld: number): Promise<{ ok: boolean; removed: number; remaining: number; error?: string }> {
  try {
    const arr = await _readTombstones();
    const cutoff = hoursOld > 0 ? Date.now() - hoursOld * 3600000 : 0;
    const toRemove: any[] = [];
    const remaining: any[] = [];
    for (const t of arr) {
      if (!t) { remaining.push(t); continue; }
      const at = t.deleted_at ? new Date(t.deleted_at).getTime() : 0;
      if (cutoff === 0 || (at && at < cutoff) || (!at && cutoff > 0)) {
        toRemove.push(t);
      } else {
        remaining.push(t);
      }
    }
    for (const t of toRemove) {
      if (t && t.table && t.key) {
        try { await _removeFromLocalStorage(String(t.table), String(t.key)); } catch {}
      }
    }
    if (toRemove.length > 0) {
      await _writeTombstones(remaining);
      await _rewriteDeletedTab(remaining);
    }
    return { ok: true, removed: toRemove.length, remaining: remaining.length };
  } catch (e: any) { return { ok: false, removed: 0, remaining: 0, error: e?.message || 'خطا' }; }
}


export async function fetchSnapshotsFromSheetForAll(): Promise<{ ok: boolean; filled: number; total: number; error?: string }> {
  try {
    const { bridgePing, bridgePull } = await import('./lib.sheets');

    // ۱. تست اتصال
    let ping: any = null;
    try { ping = await bridgePing(); } catch (e: any) { return { ok: false, filled: 0, total: 0, error: 'اتصال شیت: ' + (e?.message || 'خطا') }; }
    if (!ping || !ping.ok) return { ok: false, filled: 0, total: 0, error: 'شیت پاسخ نداد' };

    // ۲. خواندن همه جدول‌ها یک‌جا
    let pullRes: any = null;
    try { pullRes = await bridgePull(); } catch (e: any) { return { ok: false, filled: 0, total: 0, error: 'دریافت از شیت: ' + (e?.message || 'خطا') }; }
    const tables = pullRes?.tables || {};

    // ۳. پر کردن tombstoneهای بدون snapshot
    const arr = await _readTombstones();
    const KEY_FIELDS = ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id'];
    let filled = 0;
    for (const t of arr) {
      if (!t || t.snapshot) continue;
      const tab = String(t.table || '').trim();
      const k = String(t.key || '').trim();
      if (!tab || !k) continue;
      if (!isBusinessTable(tab)) continue;
      const rows = tables[tab] || [];
      if (!Array.isArray(rows)) continue;
      const row = rows.find((r: any) => {
        if (!r) return false;
        for (const f of KEY_FIELDS) {
          const v = r[f];
          if (v !== undefined && v !== null && String(v).trim() === k) return true;
        }
        // grp_sale_ / grp_purchase_
        const lid = String(r.local_id || '');
        if (lid.startsWith('grp_sale_') && lid.slice(9) === k) return true;
        if (lid.startsWith('grp_purchase_') && lid.slice(13) === k) return true;
        return false;
      });
      if (row) {
        t.snapshot = {
          primary: row.name || row.customer_name || row.supplier_name || '',
          secondary: row.invoice || row.invoice_number || '',
          phone: row.phone || '',
          amount: Number(row.total) || Number(row.amount) || 0,
          date: row.date || row.date_factor || '',
          raw: row,
        };
        filled++;
      }
    }

    if (filled > 0) {
      await _writeTombstones(arr);
      await _rewriteDeletedTab(arr);
    }
    return { ok: true, filled, total: arr.length };
  } catch (e: any) {
    return { ok: false, filled: 0, total: 0, error: e?.message || 'خطا' };
  }
}
