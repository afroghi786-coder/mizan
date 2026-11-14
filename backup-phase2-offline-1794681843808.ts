// lib.offline.ts — لایه‌ی Offline-First روی lib.ts
import AsyncStorage from './lib.storage';
import * as lib from './lib';


// ═══ EDIT_AUDIT_WRAPPER ═══
const _EDIT_TRACKED = new Set<string>([
  'sales_grouped','purchases_grouped',
  'sales_returns','purchase_returns',
  'partners','parties','products','banks','shippings',
  'expenses','employees','salary_payments','employee_loans',
  'attendance','employee_leaves','payroll_batches',
  'stock_adjustments','partner_transactions','partner_bank_accounts',
  'settings'
]);

const _AUDIT_START = Date.now();

function _rowKeyFor(row: any): string {
  if (!row || typeof row !== 'object') return '';
  for (const f of ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id','phone','name']) {
    const v = row[f];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return '';
}

async function _logEditToAudit(table: string, before: any, after: any) {
  try {
    if (Date.now() - _AUDIT_START < 5000) return;
    const beforeArr = Array.isArray(before) ? before : (before ? [before] : []);
    const afterArr = Array.isArray(after) ? after : (after ? [after] : []);
    const beforeMap = new Map<string, any>();
    const afterMap = new Map<string, any>();
    for (const r of beforeArr) { const k = _rowKeyFor(r); if (k) beforeMap.set(k, r); }
    for (const r of afterArr) { const k = _rowKeyFor(r); if (k) afterMap.set(k, r); }
    const allKeys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
    const entries: any[] = [];
    for (const k of allKeys) {
      const b = beforeMap.get(k);
      const a = afterMap.get(k);
      let action = '';
      let changedFields: string[] = [];
      if (!b && a) action = 'create';
      else if (b && !a) action = 'delete';
      else if (b && a) {
        const allF = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
        for (const f of allF) {
          if (String(f).startsWith('_')) continue;
          if (JSON.stringify(b[f]) !== JSON.stringify(a[f])) changedFields.push(f);
        }
        if (changedFields.length === 0) continue;
        action = 'update';
      }
      if (!action) continue;
      const summary = action === 'create' ? 'ایجاد' : action === 'update' ? ('ویرایش: ' + changedFields.slice(0, 4).join('، ')) : 'حذف';
      entries.push({
        id: 'edit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        type: table + '_' + action,
        table: table, key: k,
        at: new Date().toISOString(),
        device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '',
        summary, action, fields: changedFields,
        before: b || null, after: a || null,
      });
    }
    if (entries.length === 0 || entries.length > 6) return;
    const raw = await AsyncStorage.getItem('@mizan_audit_events');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    arr.push(...entries);
    if (arr.length > 800) arr = arr.slice(arr.length - 800);
    await AsyncStorage.setItem('@mizan_audit_events', JSON.stringify(arr));
  } catch {}
}

const setLocal = async (key: string, value: any): Promise<void> => {
  const origKey = String(key || '');
  let table = origKey.replace(/^@mizan_local_/, '').replace(/^@mizan_/, '');
  if (table.startsWith('ptx_')) table = 'partner_transactions';
  else if (table.startsWith('pba_')) table = 'partner_bank_accounts';
  const tracked = _EDIT_TRACKED.has(table);
  let before: any = null;
  if (tracked) { try { before = await getLocal(origKey); } catch {} }
  await _origSetLocal(origKey, value);
  if (tracked) { try { await _logEditToAudit(table, before, value); } catch {} }
};

export * from './lib';

// 🚀 تابع مهاجرت یکپارچه به SQLite (فقط یکبار اجرا می‌شود)
async function _runInventoryMigration() {
  try {
    const isMigrated = await AsyncStorage.getItem('@mizan_sql_migrated_v1');
    if (isMigrated === 'true') return; // اگر قبلاً مهاجرت شده، کاری نکن

    console.log('[Migration] شروع مهاجرت داده‌های انبار به SQLite...');
    const storageModule = require('./lib.storage').default || require('./lib.storage');
    const db = await storageModule.getDb();
    if (!db) { console.log('[Migration] دیتابیس SQLite در دسترس نیست.'); return; }

    // ۱. مهاجرت فروش‌ها
    const salesRaw = await AsyncStorage.getItem('@mizan_local_sales');
    const salesArr = salesRaw ? JSON.parse(salesRaw) : [];
    for (const s of salesArr) {
      if (!s.invoice_number || !s.model_code) continue;
      await db.runAsync(
        'INSERT OR IGNORE INTO sales_db (invoice_number, model_code, quantity, price_unit, date, customer_name, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.invoice_number, s.model_code, Number(s.quantity)||0, Number(s.price_unit)||0, s.date_factor||s.date_reg||'', s.customer_name||'', JSON.stringify(s)]
      );
    }
    console.log('[Migration] ' + salesArr.length + ' ردیف فروش منتقل شد.');

    // ۲. مهاجرت خریدها
    const purchasesRaw = await AsyncStorage.getItem('@mizan_local_purchases');
    const purchasesArr = purchasesRaw ? JSON.parse(purchasesRaw) : [];
    for (const p of purchasesArr) {
      if (!p.invoice_number || !p.model_code) continue;
      await db.runAsync(
        'INSERT OR IGNORE INTO purchases_db (invoice_number, model_code, quantity, price_unit, date, supplier_name, data_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.invoice_number, p.model_code, Number(p.quantity)||0, Number(p.price_unit)||0, p.date_factor||p.date_reg||'', p.supplier_name||'', JSON.stringify(p)]
      );
    }
    console.log('[Migration] ' + purchasesArr.length + ' ردیف خرید منتقل شد.');

    // ۳. مهاجرت تعدیلات
    const adjRaw = await AsyncStorage.getItem('@mizan_local_stock_adjustments');
    const adjArr = adjRaw ? JSON.parse(adjRaw) : [];
    for (const a of adjArr) {
      if (!a.model_code) continue;
      await db.runAsync(
        'INSERT OR IGNORE INTO adjustments_db (model_code, adjustment, unit_cost, date, reason, data_json) VALUES (?, ?, ?, ?, ?, ?)',
        [a.model_code, Number(a.adjustment)||0, Number(a.unit_cost)||0, a.adjustment_date||'', a.reason||'', JSON.stringify(a)]
      );
    }
    console.log('[Migration] ' + adjArr.length + ' ردیف تعدیل منتقل شد.');

    await AsyncStorage.setItem('@mizan_sql_migrated_v1', 'true');
    console.log('✅ مهاجرت با موفقیت انجام شد.');
  } catch (e) {
    console.log('[Migration] خطا در مهاجرت:', e);
  }
}


const MODE_KEY = '@mizan_mode';
const LOCAL = '@mizan_local_';
const QUEUE = '@mizan_queue';

let MODE: 'online' | 'offline' = 'online';
let listeners: Array<(m: 'online' | 'offline') => void> = [];

export async function loadMode() {
  const m = await AsyncStorage.getItem(MODE_KEY);
  MODE = m === 'offline' ? 'offline' : 'online';
  return MODE;
}
export function getMode() { return MODE; }

// ═══ قفل داده تجاری ═══
// پیش‌فرض: قفل. فقط با مقدار 'open' باز می‌شود و هیچ دکمه‌ای در UI برای باز کردن آن نیست.
const BUSINESS_LOCK_KEY = '@mizan_business_lock';
const SYNC_DEST_KEY = '@mizan_sync_destination';

const BUSINESS_OPS = new Set<string>([
  'createProduct','updateProduct','deleteProduct',
  'createSale','updateSale','deleteSale',
  'createPurchase','updatePurchase','deletePurchase',
  'createSalesReturn','updateSalesReturn','deleteSalesReturn',
  'createPurchaseReturn','updatePurchaseReturn','deletePurchaseReturn',
  'createExpense','updateExpense','deleteExpense',
  'createEmployee','updateEmployee','deleteEmployee',
  'createAttendance','updateAttendance','deleteAttendance',
  'createSalaryPayment','updateSalaryPayment','deleteSalaryPayment',
  'createLoan','updateLoan','deleteLoan',
  'createLeave','updateLeave','deleteLeave',
  'createBatch','updateBatch','deleteBatch',
  'createParty','updateParty','deleteParty',
  'createPartner','updatePartner','deletePartner',
  'createPBA','deletePBA',
  'createPTX','deletePTX',
  'createBank','updateBank','deleteBank',
  'createShipping','updateShipping','deleteShipping',
  'createStockAdjustment','deleteStockAdjustment',
  'updateSettings'
]);

export async function serverBusinessAllowed() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — هیچ عملیات تجاری به Supabase نمی‌رود.
  return false;
}

export async function isBusinessLocked() {
  try {
    const v = await AsyncStorage.getItem(BUSINESS_LOCK_KEY);
    return v !== 'open';
  } catch { return true; }
}

export async function setBusinessLock(open: boolean) {
  await AsyncStorage.setItem(BUSINESS_LOCK_KEY, open ? 'open' : 'locked');
}


export async function setMode(m: 'online' | 'offline') {
  MODE = m;
  await AsyncStorage.setItem(MODE_KEY, m);
  listeners.forEach(fn => fn(m));
}
export function subscribeMode(fn: (m: 'online' | 'offline') => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(f => f !== fn); };
}

async function getLocal<T>(k: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(LOCAL + k);
  return raw ? JSON.parse(raw) : null;
}
async function _origSetLocal(k: string, v: any) {
  await AsyncStorage.setItem(LOCAL + k, JSON.stringify(v));
}

export async function getQueue(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(QUEUE);
  return raw ? JSON.parse(raw) : [];
}
const AUDIT_OPS: Record<string, {
  createPTX: { table: 'partner_transactions' },
  deletePTX: { table: 'partner_transactions' },
  createPBA: { table: 'partner_bank_accounts' },
  deletePBA: { table: 'partner_bank_accounts' },
  createPTX: { table: 'partner_transactions' },
  deletePTX: { table: 'partner_transactions' },
  createPBA: { table: 'partner_bank_accounts' },
  deletePBA: { table: 'partner_bank_accounts' }, table: string; type: string; summary: string }> = {
  createProduct: { table: 'products', type: 'product_create', summary: 'ثبت کالا' },
  updateProduct: { table: 'products', type: 'product_update', summary: 'ویرایش کالا' },
  deleteProduct: { table: 'products', type: 'product_delete', summary: 'حذف کالا' },
  createSale: { table: 'sales', type: 'sale_create', summary: 'ثبت فاکتور فروش' },
  deleteSale: { table: 'sales', type: 'sale_delete', summary: 'حذف فاکتور فروش' },
  createPurchase: { table: 'purchases', type: 'purchase_create', summary: 'ثبت فاکتور خرید' },
  deletePurchase: { table: 'purchases', type: 'purchase_delete', summary: 'حذف فاکتور خرید' },
  createExpense: { table: 'expenses', type: 'expense_create', summary: 'ثبت هزینه' },
  deleteExpense: { table: 'expenses', type: 'expense_delete', summary: 'حذف هزینه' },
  createEmployee: { table: 'employees', type: 'employee_create', summary: 'ثبت کارمند' },
  updateEmployee: { table: 'employees', type: 'employee_update', summary: 'ویرایش کارمند' },
  deleteEmployee: { table: 'employees', type: 'employee_delete', summary: 'حذف کارمند' },
  createAttendance: { table: 'attendance', type: 'attendance_create', summary: 'ثبت حضور' },
  updateAttendance: { table: 'attendance', type: 'attendance_update', summary: 'ویرایش حضور' },
  deleteAttendance: { table: 'attendance', type: 'attendance_delete', summary: 'حذف حضور' },
  createSalaryPayment: { table: 'salary_payments', type: 'salary_create', summary: 'ثبت حقوق' },
  updateSalaryPayment: { table: 'salary_payments', type: 'salary_update', summary: 'ویرایش حقوق' },
  deleteSalaryPayment: { table: 'salary_payments', type: 'salary_delete', summary: 'حذف حقوق' },
  createLoan: { table: 'employee_loans', type: 'loan_create', summary: 'ثبت وام' },
  updateLoan: { table: 'employee_loans', type: 'loan_update', summary: 'ویرایش وام' },
  deleteLoan: { table: 'employee_loans', type: 'loan_delete', summary: 'حذف وام' },
  createLeave: { table: 'employee_leaves', type: 'leave_create', summary: 'ثبت مرخصی' },
  updateLeave: { table: 'employee_leaves', type: 'leave_update', summary: 'ویرایش مرخصی' },
  deleteLeave: { table: 'employee_leaves', type: 'leave_delete', summary: 'حذف مرخصی' },
  createBatch: { table: 'payroll_batches', type: 'batch_create', summary: 'ثبت لیست حقوق' },
  updateBatch: { table: 'payroll_batches', type: 'batch_update', summary: 'ویرایش لیست حقوق' },
  deleteBatch: { table: 'payroll_batches', type: 'batch_delete', summary: 'حذف لیست حقوق' },
  createParty: { table: 'parties', type: 'party_create', summary: 'ثبت طرف‌حساب' },
  updateParty: { table: 'parties', type: 'party_update', summary: 'ویرایش طرف‌حساب' },
  deleteParty: { table: 'parties', type: 'party_delete', summary: 'حذف طرف‌حساب' },
  createPartner: { table: 'partners', type: 'partner_create', summary: 'ثبت شریک' },
  updatePartner: { table: 'partners', type: 'partner_update', summary: 'ویرایش شریک' },
  deletePartner: { table: 'partners', type: 'partner_delete', summary: 'حذف شریک' },
  createPBA: { table: 'partner_bank_accounts', type: 'pba_create', summary: 'ثبت حساب بانکی شریک' },
  deletePBA: { table: 'partner_bank_accounts', type: 'pba_delete', summary: 'حذف حساب بانکی شریک' },
  createPTX: { table: 'partner_transactions', type: 'ptx_create', summary: 'ثبت حرکت شریک' },
  deletePTX: { table: 'partner_transactions', type: 'ptx_delete', summary: 'حذف حرکت شریک' },
  createBank: { table: 'banks', type: 'bank_create', summary: 'ثبت بانک' },
  updateBank: { table: 'banks', type: 'bank_update', summary: 'ویرایش بانک' },
  deleteBank: { table: 'banks', type: 'bank_delete', summary: 'حذف بانک' },
  createShipping: { table: 'shippings', type: 'shipping_create', summary: 'ثبت باربری' },
  updateShipping: { table: 'shippings', type: 'shipping_update', summary: 'ویرایش باربری' },
  deleteShipping: { table: 'shippings', type: 'shipping_delete', summary: 'حذف باربری' },
  createStockAdjustment: { table: 'stock_adjustments', type: 'stock_create', summary: 'ثبت تعدیل انبار' },
  deleteStockAdjustment: { table: 'stock_adjustments', type: 'stock_delete', summary: 'حذف تعدیل انبار' },
  updateSettings: { table: 'settings', type: 'settings_update', summary: 'ویرایش تنظیمات' },
};

function _auditKeyOf(op: string, payload: any): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return '';
  const fields = ['local_id','id','code','_localId','invoiceNumber','invoice_number','invoice','employee_code','partner_code'];
  for (const f of fields) {
    const v = (payload as any)[f];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  const p = (payload as any).p;
  if (p && typeof p === 'object') {
    for (const f of fields) {
      const v = p[f];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
  }
  return '';
}

async function _maybeAuditFromEnqueue(op: string, payload: any) {
  try {
    const meta = AUDIT_OPS[op];
    if (!meta) return;
    const key = _auditKeyOf(op, payload) || op;
    const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
    await _pushAudit({ type: meta.type, table: meta.table, key, at: new Date().toISOString(), device_id: dev, summary: meta.summary });
  } catch {}
}

const DIRTY_TABLES_KEY = '@mizan_dirty_tables';

export async function getDirtyTables(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DIRTY_TABLES_KEY);
    if (raw === null) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch { return []; }
}

async function markTableDirty(table: string) {
  if (!table) return;
  try {
    const raw = await AsyncStorage.getItem(DIRTY_TABLES_KEY);
    if (raw === null) return;
    let arr: string[] = [];
    try { arr = JSON.parse(raw); } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    if (!arr.includes(table)) arr.push(table);
    await AsyncStorage.setItem(DIRTY_TABLES_KEY, JSON.stringify(arr));
  } catch {}
}

export async function setDirtyTables(tables: string[]) {
  try {
    const clean = Array.from(new Set((tables || []).map(String).filter(Boolean)));
    await AsyncStorage.setItem(DIRTY_TABLES_KEY, JSON.stringify(clean));
  } catch {}
}

export async function removeDirtyTables(tables: string[]) {
  try {
    const raw = await AsyncStorage.getItem(DIRTY_TABLES_KEY);
    let arr: string[] = [];
    if (raw !== null) { try { arr = JSON.parse(raw); } catch { arr = []; } }
    if (!Array.isArray(arr)) arr = [];
    const remove = new Set((tables || []).map(String));
    const next = arr.filter(t => !remove.has(String(t)));
    await AsyncStorage.setItem(DIRTY_TABLES_KEY, JSON.stringify(next));
  } catch {}
}

export async function enqueue(op: string, payload: any) {
  const q = await getQueue();
  q.push({ op, payload, ts: Date.now() });
  await AsyncStorage.setItem(QUEUE, JSON.stringify(q));
  await _maybeAuditFromEnqueue(op, payload);
  try {
    const meta = (typeof AUDIT_OPS !== 'undefined') ? AUDIT_OPS[op] : null;
    if (meta && meta.table) await markTableDirty(meta.table);
  } catch {}

  // PARTNER_DIRTY_FALLBACK — همان روال markTableDirty
  try {
    const opTable: Record<string, string> = {
      createPTX: 'partner_transactions',
      deletePTX: 'partner_transactions',
      createPBA: 'partner_bank_accounts',
      deletePBA: 'partner_bank_accounts',
    };
    const t = opTable[op];
    if (t) await markTableDirty(t);
  } catch {}
}
export async function getQueueCount() { return (await getQueue()).length; }
export async function clearQueue() { await AsyncStorage.setItem(QUEUE, '[]'); }

const TOMBSTONES_KEY = '@mizan_tombstones';

export async function recordTombstone(table: string, key: string, meta?: any) {
  try {
    let snapshot: any = null;
    try {
      const snapMod = await import('./lib.snapshot');
      const s = await snapMod.getRowSnapshot(table, key);
      if (s) {
        try {
          const json = JSON.stringify(s);
          if (json.length > 3500) {
            if (s.raw && Array.isArray(s.raw.items)) s.raw.items = s.raw.items.slice(0, 3);
            if (s.raw && Array.isArray(s.raw.rows)) s.raw.rows = s.raw.rows.slice(0, 3);
          }
        } catch {}
        snapshot = s;
      }
    } catch {}
    const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const clean = arr.filter((x: any) => !x || !(x.table === table && x.key === key));
    const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
    const devLabel = (await AsyncStorage.getItem('@mizan_device_label')) || '';
    clean.push({
      table: table,
      key: key,
      deleted_at: new Date().toISOString(),
      device_id: dev,
      device_label: devLabel,
      snapshot: snapshot,
      ...(meta || {}),
    });
    await AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(clean));
  } catch (e) { console.log('[recordTombstone]', e); }
}

export async function getTombstones(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

let _deletedPartiesCache: { phones: Set<string>, codes: Set<string>, names: Set<string>, ts: number } | null = null;

async function _getDeletedParties() {
  if (_deletedPartiesCache && Date.now() - _deletedPartiesCache.ts < 5000) {
    return _deletedPartiesCache;
  }
  const phones = new Set<string>();
  const codes = new Set<string>();
  const names = new Set<string>();
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (!t || t.table !== 'parties' || !t.meta) continue;
        let meta = t.meta;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch { continue; }
        }
        if (!meta || typeof meta !== 'object') continue;
        const p = String(meta.phone || '').replace(/[^0-9]/g, '');
        const c = String(meta.code || '').trim();
        const n = String(meta.name || '').trim();
        if (p) phones.add(p);
        if (c) codes.add(c);
        if (n) names.add(n);
      }
    }
  } catch {}
  _deletedPartiesCache = { phones, codes, names, ts: Date.now() };
  return _deletedPartiesCache;
}

function _invalidateDeletedPartiesCache() {
  _deletedPartiesCache = null;
}


export async function syncToServer(onProgress?: (done: number, total: number) => void): Promise<{ ok: number; fail: number }> {
  const q = await getQueue();
  const remaining: any[] = [];
  let ok = 0, fail = 0;
  const total = q.length;
  let dest = '';
  try { dest = (await AsyncStorage.getItem(SYNC_DEST_KEY)) || ''; } catch {}
  const businessToSheetOnly = dest === 'private' || dest === 'both';

  for (let i = 0; i < q.length; i++) {
    const item = q[i];
    if (item.failed) { remaining.push(item); if (onProgress) onProgress(i + 1, total); continue; }
    try {
      // در مقصد private/both، عملیات تجاری فقط به شیت می‌روند و از صف حذف می‌شوند.
      if (BUSINESS_OPS.has(String(item.op))) {
        // هیچ عملیات تجاری به Supabase نمی‌رود.
        if (onProgress) onProgress(i + 1, total);
        continue;
      }
      await (lib as any)[item.op](item.payload);
      ok++;
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      const isDup = /duplicate|unique|already exists|23505/i.test(msg);
      if (isDup) { ok++; } else {
        const attempts = (item.attempts || 0) + 1;
        if (attempts >= 5) {
          remaining.push({ ...item, attempts, lastError: msg, failed: true });
        } else {
          remaining.push({ ...item, attempts, lastError: msg });
        }
        fail++;
      }
    }
    if (onProgress) onProgress(i + 1, total);
    if ((i + 1) % 20 === 0) {
      await AsyncStorage.setItem(QUEUE, JSON.stringify([...remaining, ...q.slice(i + 1)]));
      await new Promise(r => setTimeout(r, 10));
    }
  }
  await AsyncStorage.setItem(QUEUE, JSON.stringify(remaining));
  return { ok, fail };
}

export async function pullFromServer() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — بخش تجاری از Supabase خوانده نمی‌شود.
  return;
}

async function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (MODE === 'online') {
    try {
      const fresh = await fetcher();
      await setLocal(key, fresh);
      return fresh;
    } catch {
      const cached = await getLocal<T>(key);
      if (cached) return cached;
      throw new Error('آفلاین — داده‌ای موجود نیست');
    }
  }
  const cached = await getLocal<T>(key);
  if (cached) return cached;
  try { return await fetcher(); } catch { throw new Error('داده‌ای موجود نیست'); }
}

async function _applyTombstones(table: string, arr: any[]) {
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
    let list: any[] = [];
    try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    const deleted = new Set<string>();
    for (const t of list) {
      if (t && String(t.table || '') === table) {
        const k = String(t.key || '').trim();
        if (k) deleted.add(k);
      }
    }
    if (!deleted.size) return arr;
    return (arr || []).filter((x: any) => {
      const keys = [x.local_id, x.id, x.invoice_number, x.code, x.phone, x.name, x.return_number]
        .map(v => String(v || '').trim()).filter(Boolean);
      return !keys.some(k => deleted.has(k));
    });
  } catch { return arr; }
}

export async function getProducts() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — کالاها فقط محلی
  const local = await getLocal<any[]>('products');
  return _applyTombstones('products', local || []);
}
export async function createProduct(p: any) {
  const devPr = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowPr = new Date().toISOString();
  const item = {
    ...p,
    _localId: Date.now(),
    local_id: p.local_id || ('prd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
    created_at: p.created_at || nowPr,
    updated_at: nowPr,
    device_id: devPr,
  };

  // پاک کردن tombstone قدیمی برای همان code/local_id تا کالای جدید پاک نشود
  try {
    const raw = await AsyncStorage.getItem('@mizan_tombstones');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (Array.isArray(arr)) {
      const keys = new Set<string>();
      if (item.local_id) keys.add(String(item.local_id));
      if (item.code) keys.add(String(item.code));
      const filtered = arr.filter((t: any) => {
        if (!t) return false;
        if (String(t.table || '') !== 'products') return true;
        return !keys.has(String(t.key || ''));
      });
      if (filtered.length !== arr.length) {
        await AsyncStorage.setItem('@mizan_tombstones', JSON.stringify(filtered));
      }
    }
  } catch {}

  const list: any[] = (await getLocal('products')) || [];
  await setLocal('products', [...list, item]);
  try { await _pushAudit({ type: 'product_create', table: 'products', key: String(item.code || item._localId), at: nowPr, device_id: devPr, summary: 'ثبت کالا' }); } catch {}
  await enqueue('createProduct', item);
}
export async function updateProduct(id: string, p: any) {
  const list: any[] = (await getLocal('products')) || [];
  const idx = list.findIndex((x: any) => x.id === id || x._localId === id || x.local_id === id);
  const code = p?.code || (idx >= 0 ? list[idx]?.code : undefined);
  if (idx >= 0) { list[idx] = { ...list[idx], ...p, updated_at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '' }; await setLocal('products', list); }
  try { await _pushAudit({ type: 'product_update', table: 'products', key: String(code || id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ویرایش کالا' }); } catch {}

  // اگر این محصول هنوز در صف createProduct است → همان را آپدیت کن
  const q = await getQueue();
  const createIdx = q.findIndex((it: any) => it.op === 'createProduct' && (it.payload?._localId === id || (code && it.payload?.code === code)));
  if (createIdx >= 0) {
    const newQ = q.slice();
    newQ[createIdx] = { ...newQ[createIdx], payload: { ...newQ[createIdx].payload, ...p } };
    await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));
    console.log('[updateProduct] updated pending createProduct in queue');
    return;
  }

  const payload = { id, code, p };
  if (await serverBusinessAllowed()) {
    try { await lib.updateProduct(id, p); } catch { await enqueue('updateProduct', payload); }
  } else {
    await enqueue('updateProduct', payload);
  }
}
export async function deleteProduct(id: string) {
  if (!id) { console.log('[deleteProduct] id empty, skip'); return; }
  const list: any[] = (await getLocal('products')) || [];
  const found = list.find((x: any) =>
    x.id === id || x._localId === id || x.local_id === id || x.code === id
  );
  const code = found?.code;
  const localId = found?.local_id;
  const anyId = found?.id;
  const anyLocalId = found?._localId;

  const keys = new Set<string>();
  if (localId) keys.add(String(localId));
  if (anyId) keys.add(String(anyId));
  if (anyLocalId) keys.add(String(anyLocalId));
  // فقط وقتی هیچ شناسه یکتایی نداریم، از code استفاده کن
  if (!localId && !anyId && !anyLocalId) {
    if (code) keys.add(String(code));
    keys.add(String(id));
  }
  for (const k of keys) await recordTombstone('products', k);

  await setLocal('products', list.filter((x: any) => {
    if (x.id && x.id === id) return false;
    if (x._localId && x._localId === id) return false;
    if (x.local_id && x.local_id === id) return false;
    if (x.code && x.code === id) return false;
    if (localId && x.local_id === localId) return false;
    if (anyId && x.id === anyId) return false;
    if (anyLocalId && x._localId === anyLocalId) return false;
    return true;
  }));

  try { await _pushAudit({ type: 'product_delete', table: 'products', key: String(localId || code || id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف کالا' }); } catch {}

  const q = await getQueue();
  const newQ = q.filter((it: any) => {
    if (it.op === 'createProduct') {
      const p = it.payload || {};
      if (anyLocalId && String(p._localId || '') === String(anyLocalId)) return false;
      if (localId && String(p.local_id || '') === String(localId)) return false;
      if (anyId && String(p.id || '') === String(anyId)) return false;
    }
    return true;
  });
  if (newQ.length !== q.length) await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));

  await enqueue('deleteProduct', { id, local_id: localId, code });
}

async function _localUpsertSale(payload: any) {
  try {
    const inv = String(payload.invoiceNumber || payload.invoice_number || '').trim();
    if (!inv) return;
    const items = payload.items || payload.rows || [];
    const old = (await getLocal<any[]>('sales')) || [];
    const filtered = old.filter((r: any) => String(r.invoice_number || '') !== inv);
    const baseDate = payload.invoiceDate || payload.date || new Date().toISOString();
    const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
    const now = new Date().toISOString();
    const rows = items.map((it: any, idx: number) => ({
      invoice_number: inv,
      local_id: 'sale_' + inv + '_' + idx,
      device_id: dev,
      updated_at: now,
      manual_invoice: payload.manualInvoice || '',
      customer_code: payload.customerCode || payload.customer_code || '',
      customer_name: payload.customerName || payload.customer_name || '',
      customer_phone: payload.customerPhone || payload.customer_phone || '',
      account_holder: payload.holderName || payload.accountHolder || payload.receiverName || it.accountHolder || it.holderName || '',
      account_holder_code: payload.holderCode || payload.accountHolderCode || payload.receiverCode || it.accountHolderCode || it.holderCode || '',
      model_code: it.modelCode || it.model_code || '',
      model_name: it.modelName || it.model_name || '',
      quantity: Number(it.quantity) || 0,
      price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
      payment: (() => {
        const rowPay = Number(it.payment) || 0;
        if (rowPay > 0) return rowPay;
        if (idx !== 0) return 0;
        return Number(payload.paymentAmount ?? payload.payment ?? payload.paid) || 0;
      })(),
      total: (Number(it.quantity) || 0) * (Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0),
      bank_name: payload.bank || payload.bankName || payload.receiverBank || it.bankName || '',
      deposit_date: payload.depositDate || payload.payDate || payload.paymentDate || it.depositDate || '',
      shipping: payload.shipping || '',
      date_factor: it.dateFactor || it.date_factor || baseDate,
      date_reg: it.dateReg || it.date_reg || baseDate,
      description: it.description || '',
      _pending: true,
    }));
    await setLocal('sales', [...filtered, ...rows]);
  } catch {}
}

async function _localUpsertPurchase(payload: any) {
  try {
    const inv = String(payload.invoiceNumber || payload.invoice_number || payload._pendingInvNumber || '').trim();
    if (!inv) return;
    const items = payload.items || payload.rows || [];
    const old = (await getLocal<any[]>('purchases')) || [];
    const filtered = old.filter((r: any) => String(r.invoice_number || '') !== inv);
    const baseDate = payload.invoiceDate || payload.date || new Date().toISOString();
    const devP = (await AsyncStorage.getItem('@mizan_device_id')) || '';
    const nowP = new Date().toISOString();
    const rows = items.map((it: any, idx: number) => ({
      invoice_number: inv,
      local_id: 'purchase_' + inv + '_' + idx,
      device_id: devP,
      updated_at: nowP,
      manual_invoice: payload.manualInvoice || '',
      supplier_code: payload.supplierCode || payload.supplier_code || '',
      supplier_name: payload.supplierName || payload.supplier_name || '',
      supplier_phone: payload.supplierPhone || payload.supplier_phone || '',
      account_holder: payload.payerName || payload.accountHolder || it.accountHolder || it.payerName || '',
      payer_code: payload.payerCode || payload.accountHolderCode || it.accountHolderCode || it.payerCode || '',
      model_code: it.modelCode || it.model_code || '',
      model_name: it.modelName || it.model_name || '',
      quantity: Number(it.quantity) || 0,
      price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
      payment: (() => {
        const rowPay = Number(it.payment) || 0;
        if (rowPay > 0) return rowPay;
        if (idx !== 0) return 0;
        return Number(payload.paymentAmount ?? payload.payment ?? payload.paid) || 0;
      })(),
      total: (Number(it.quantity) || 0) * (Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0),
      bank_name: payload.bankAccount || payload.bank || it.bankName || '',
      deposit_date: payload.paymentDate || payload.depositDate || it.depositDate || '',
      shipping: payload.shipping || '',
      date_factor: it.dateFactor || it.date_factor || baseDate,
      date_reg: it.dateReg || it.date_reg || baseDate,
      description: it.description || '',
      _pending: true,
    }));
    await setLocal('purchases', [...filtered, ...rows]);
  } catch {}
}

export async function createSale(payload: any) {
  await _localUpsertSale(payload);
  if (await serverBusinessAllowed()) {
    try {
      const r = await lib.createSale(payload);
        try { await _pushAudit({ type: 'sale_create', table: 'sales', key: String(payload.invoiceNumber), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت فاکتور فروش' }); } catch {}
      return r;
    }
    catch { await enqueue('createSale', payload); return payload.invoiceNumber; }
  }
  await enqueue('createSale', payload);
  try { await _pushAudit({ type: 'sale_create', table: 'sales', key: String(payload.invoiceNumber), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت فاکتور فروش' }); } catch {}
  return payload.invoiceNumber;
}
async function hasActiveReturns(invoiceNumber: string, type: 'sales' | 'purchase'): Promise<boolean> {
  const inv = String(invoiceNumber || '').trim();
  if (!inv) return false;
  const key = type === 'sales' ? 'sales_returns' : 'purchase_returns';
  const local = (await getLocal<any[]>(key)) || [];
  const q = await getQueue();

  const deletedIds = new Set<string>();
  for (const item of q) {
    if (type === 'sales' && item.op === 'deleteSalesReturn') {
      const id = String(item.payload || '').trim();
      if (id) deletedIds.add(id);
    }
    if (type === 'purchase' && item.op === 'deletePurchaseReturn') {
      const id = String(item.payload || '').trim();
      if (id) deletedIds.add(id);
    }
  }
  try {
    const raw = await AsyncStorage.getItem('@mizan_tombstones');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (!t) continue;
        if (type === 'sales' && String(t.table || '') !== 'sales_returns') continue;
        if (type === 'purchase' && String(t.table || '') !== 'purchase_returns') continue;
        const k = String(t.key || '').trim();
        if (k) deletedIds.add(k);
      }
    }
  } catch {}

  const pending = q
    .filter(x => (type === 'sales' ? x.op === 'createSalesReturn' : x.op === 'createPurchaseReturn'))
    .map(x => x.payload)
    .filter((p: any) => p && p.local_id && !deletedIds.has(String(p.local_id)));

  const all = [...pending, ...local];
  return all.some((r: any) => String(r.original_invoice_number || '').trim() === inv);
}

export async function deleteSale(inv: string) {
  if (await hasActiveReturns(inv, 'sales')) {
    throw new Error('برای این فاکتور برگشت فعال وجود دارد. ابتدا برگشت‌ها را حذف کنید.');
  }
  await recordTombstone('sales', String(inv));
  const grouped = (await getLocal<any[]>('sales_grouped')) || [];
  await setLocal('sales_grouped', grouped.filter((g: any) => g.invoice !== inv));
  try { await _pushAudit({ type: 'sale_delete', table: 'sales', key: String(inv), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف فاکتور فروش' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.deleteSale(inv); } catch { await enqueue('deleteSale', inv); }
  } else {
    await enqueue('deleteSale', inv);
  }
}

export async function deletePurchase(inv: string) {
  if (await hasActiveReturns(inv, 'purchase')) {
    throw new Error('برای این فاکتور برگشت فعال وجود دارد. ابتدا برگشت‌ها را حذف کنید.');
  }
  await recordTombstone('purchases', String(inv));
  const grouped = (await getLocal<any[]>('purchases_grouped')) || [];
  await setLocal('purchases_grouped', grouped.filter((g: any) => g.invoice !== inv));
  try { await _pushAudit({ type: 'purchase_delete', table: 'purchases', key: String(inv), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف فاکتور خرید' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.deletePurchase(inv); } catch { await enqueue('deletePurchase', inv); }
  } else {
    await enqueue('deletePurchase', inv);
  }
}

export async function getSettings() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — تنظیمات فقط محلی
  const local = await getLocal<any>('settings');
  return local || {};
}
export async function updateSettings(s: any) {
  await setLocal('settings', s);
  try { await _pushAudit({ type: 'settings_update', table: 'settings', key: 'settings', at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ویرایش تنظیمات' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.updateSettings(s); } catch { await enqueue('updateSettings', s); }
  } else {
    await enqueue('updateSettings', s);
  }
}

async function computeLocalInventory() {
  const [productsRaw, salesRaw, purchasesRaw, settingsRaw, adjRaw] = await Promise.all([
    getLocal<any[]>('products'),
    getLocal<any[]>('sales'),
    getLocal<any[]>('purchases'),
    getLocal<any>('settings'),
    getLocal<any[]>('stock_adjustments'),
  ]);
  const products = productsRaw || [];
  let sales = salesRaw || [];
  let purchases = purchasesRaw || [];
  const settings = (settingsRaw as any) || {};
  const threshold = settings.inventory_threshold ?? 5;
  let adjAll = (adjRaw || []).slice();

  // BUSINESS_LOCAL_ONLY — Merge grouped (device 2) + apply tombstones
  try {
    const _grpS = (await getLocal<any[]>('sales_grouped')) || [];
    const _grpP = (await getLocal<any[]>('purchases_grouped')) || [];
    const _haveS = new Set(sales.map((s: any) => String(s.invoice_number || '').trim()).filter(Boolean));
    const _haveP = new Set(purchases.map((p: any) => String(p.invoice_number || '').trim()).filter(Boolean));
    for (const _g of _grpS) {
      const _inv = String(_g.invoice || '').trim();
      if (!_inv || _haveS.has(_inv)) continue;
      for (const _it of (_g.items || [])) {
        sales.push({
          invoice_number: _inv,
          customer_code: _g.customerCode || '',
          customer_name: _g.name || '',
          model_code: _it.modelCode || _it.model_code || '',
          model_name: _it.modelName || _it.model_name || '',
          quantity: Number(_it.quantity) || 0,
          price_unit: Number(_it.priceUnit != null ? _it.priceUnit : _it.price_unit) || 0,
          payment: Number(_it.payment) || 0,
          date_factor: _g.date || '',
          date_reg: _g.date || '',
        });
      }
    }
    for (const _g of _grpP) {
      const _inv = String(_g.invoice || '').trim();
      if (!_inv || _haveP.has(_inv)) continue;
      for (const _it of (_g.items || [])) {
        purchases.push({
          invoice_number: _inv,
          supplier_code: _g.supplierCode || '',
          supplier_name: _g.name || '',
          model_code: _it.modelCode || _it.model_code || '',
          model_name: _it.modelName || _it.model_name || '',
          quantity: Number(_it.quantity) || 0,
          price_unit: Number(_it.priceUnit != null ? _it.priceUnit : _it.price_unit) || 0,
          payment: Number(_it.payment) || 0,
          date_factor: _g.date || '',
          date_reg: _g.date || '',
        });
      }
    }
    const _tomb = await getTombstones();
    const _deadS = new Set<string>();
    const _deadP = new Set<string>();
    for (const _t of _tomb) {
      if (String(_t.table || '') === 'sales') _deadS.add(String(_t.key || '').trim());
      if (String(_t.table || '') === 'purchases') _deadP.add(String(_t.key || '').trim());
    }
    if (_deadS.size) sales = sales.filter((s: any) => !_deadS.has(String(s.invoice_number || '').trim()));
    if (_deadP.size) purchases = purchases.filter((p: any) => !_deadP.has(String(p.invoice_number || '').trim()));
  } catch (e) { console.log('[inventory] merge/tombstone fail:', e); }

  const q = await getQueue();
  
  // --- Merge Deletions (حذف‌های آفلاین) ---
  for (const item of q) {
    if (item.op === 'deleteSale') {
      sales = sales.filter((s: any) => s.invoice_number !== item.payload);
    }
    if (item.op === 'deletePurchase') {
      purchases = purchases.filter((p: any) => p.invoice_number !== item.payload);
    }
  }

  // --- Merge Updates (ویرایش‌های آفلاین فاکتورهای سینک‌شده) ---
  for (const item of q) {
    if (item.op === 'updateSale' && item.payload) {
      const inv = item.payload.invoiceNumber;
      const oldRows = sales.filter((s: any) => s.invoice_number === inv);
      if (oldRows.length > 0) {
        const template = oldRows[0];
        sales = sales.filter((s: any) => s.invoice_number !== inv);
        for (const r of item.payload.rows) {
          sales.push({
            ...template,
            model_code: r.modelCode || '',
            model_name: r.modelName || '',
            quantity: Number(r.quantity) || 0,
            price_unit: Number(r.priceUnit) || 0,
            payment: Number(r.payment) || 0,
            total: (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0),
            description: r.description || '',
            date_factor: r.dateFactor || template.date_factor,
            date_reg: r.dateReg || template.date_reg
          });
        }
      }
    }
    if (item.op === 'updatePurchase' && item.payload) {
      const inv = item.payload.invoiceNumber;
      const oldRows = purchases.filter((p: any) => p.invoice_number === inv);
      if (oldRows.length > 0) {
        const template = oldRows[0];
        purchases = purchases.filter((p: any) => p.invoice_number !== inv);
        for (const r of item.payload.rows) {
          purchases.push({
            ...template,
            model_code: r.modelCode || '',
            model_name: r.modelName || '',
            quantity: Number(r.quantity) || 0,
            price_unit: Number(r.priceUnit) || 0,
            payment: Number(r.payment) || 0,
            total: (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0),
            description: r.description || '',
            date_factor: r.dateFactor || template.date_factor,
            date_reg: r.dateReg || template.date_reg
          });
        }
      }
    }
  }

  // --- Merge Creates (فاکتورهای آفلاین جدید) ---
  for (const item of q) {
    if (item.op === 'createSale' && item.payload) {
      const rows = item.payload.rows || item.payload.items || [];
      const baseDate = item.payload.invoiceDate || item.payload.date || new Date(item.ts || Date.now()).toISOString();
      const inv = item.payload.invoiceNumber || item.payload.invoice_number || item.payload._pendingInvNumber || '';
      if (inv && sales.some((s: any) => String(s.invoice_number || '') === String(inv))) continue;
      for (const r of rows) {
        sales.push({
          customer_code: item.payload.customerCode || item.payload.customer_code || '',
          customer_name: item.payload.customerName || item.payload.customer_name || '',
          customer_phone: item.payload.customerPhone || item.payload.customer_phone || '',
          model_code: r.model_code || r.modelCode || '',
          model_name: r.model_name || r.modelName || '',
          quantity: Number(r.quantity) || 0,
          price_unit: Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0,
          payment: Number(r.payment) || 0,
          total: (Number(r.quantity) || 0) * (Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0),
          invoice_number: inv,
          date_factor: r.date_factor || r.dateFactor || baseDate,
          date_reg: r.date_reg || r.dateReg || baseDate,
          description: r.description || '',
          _pending: true,
        });
      }
    }
    if (item.op === 'createPurchase' && item.payload) {
      const rows = item.payload.rows || item.payload.items || [];
      const baseDate = item.payload.invoiceDate || item.payload.date || new Date(item.ts || Date.now()).toISOString();
      const inv = item.payload.invoiceNumber || item.payload.invoice_number || item.payload._pendingInvNumber || '';
      if (inv && purchases.some((p: any) => String(p.invoice_number || '') === String(inv))) continue;
      for (const r of rows) {
        purchases.push({
          supplier_code: item.payload.supplierCode || item.payload.supplier_code || '',
          supplier_name: item.payload.supplierName || item.payload.supplier_name || '',
          supplier_phone: item.payload.supplierPhone || item.payload.supplier_phone || '',
          account_holder: item.payload.payerName || item.payload.accountHolder || r.accountHolder || r.account_holder || '',
          quantity: Number(r.quantity) || 0,
          price_unit: Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0,
          payment: Number(r.payment) || 0,
          total: (Number(r.quantity) || 0) * (Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0),
          model_code: r.model_code || r.modelCode || '',
          model_name: r.model_name || r.modelName || '',
          invoice_number: inv,
          manual_invoice: item.payload.manualInvoice || '',
          date_factor: r.date_factor || r.dateFactor || baseDate,
          date_reg: r.date_reg || r.dateReg || baseDate,
          bank_name: item.payload.bank || item.payload.bankName || item.payload.bankAccount || item.payload.receiverBank || r.bankName || r.bank_name || '',
          deposit_date: item.payload.depositDate || item.payload.paymentDate || item.payload.payDate || r.depositDate || r.deposit_date || '',
          shipping: item.payload.shipping || r.shipping || '',
          description: r.description || '',
          payer_code: item.payload.payerCode || item.payload.accountHolderCode || r.accountHolderCode || r.account_holder_code || r.payerCode || '',
          _pending: true,
        });
      }
    }
    if (item.op === 'createStockAdjustment' && item.payload) adjAll = adjAll.concat([item.payload]);
    if (item.op === 'deleteStockAdjustment' && item.payload) {
      const _delId = typeof item.payload === 'string' ? item.payload : String(item.payload?.local_id || item.payload?.id || '');
      if (_delId) adjAll = adjAll.filter((r: any) => String(r.local_id || '') !== _delId && String(r.id || '') !== _delId);
    }
  }
  // BUSINESS_LOCAL_ONLY — tombstone filter for adjustments (final safety)
  try {
    const _rawT = await AsyncStorage.getItem('@mizan_tombstones');
    let _arrT: any[] = [];
    try { _arrT = _rawT ? JSON.parse(_rawT) : []; } catch { _arrT = []; }
    if (Array.isArray(_arrT)) {
      const _delAdj = new Set<string>();
      for (const _t of _arrT) {
        if (!_t) continue;
        if (String(_t.table || '') !== 'stock_adjustments') continue;
        const _k = String(_t.key || '').trim();
        if (_k) _delAdj.add(_k);
      }
      if (_delAdj.size) {
        adjAll = adjAll.filter((r: any) => {
          const k1 = String(r.local_id || '').trim();
          const k2 = String(r.id || '').trim();
          if (k1 && _delAdj.has(k1)) return false;
          if (k2 && _delAdj.has(k2)) return false;
          return true;
        });
      }
    }
  } catch {}

  // Dedupe adjAll by local_id — جلوگیری از شمارش دوبرابر (queue + local)
  try {
    const _adjSeen = new Set<string>();
    adjAll = adjAll.filter((r: any) => {
      const k = String(r.local_id || r.id || '');
      if (!k) return true;
      if (_adjSeen.has(k)) return false;
      _adjSeen.add(k);
      return true;
    });
  } catch {}

  const adjustmentMap: Record<string, number> = {};
  const adjustmentValueMap: Record<string, number> = {};
  adjAll.forEach(function(r: any) {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    const _qty = Number(r.adjustment) || 0;
    const _cost = Number(r.unit_cost != null ? r.unit_cost : (r.unitCost != null ? r.unitCost : r.cost)) || 0;
    adjustmentMap[c] = (adjustmentMap[c] || 0) + _qty;
    if (_qty > 0 && _cost > 0) {
      adjustmentValueMap[c] = (adjustmentValueMap[c] || 0) + (_qty * _cost);
    }
  });
  const productMap: Record<string, any> = {};
  products.forEach((p: any) => { productMap[p.code] = p; });
  const models: Record<string, any> = {};
  const nowTs = Date.now();
  const _pda = (lib && lib.parseDateAny) ? lib.parseDateAny : function(d: any) { return d ? new Date(d) : null; };
  (purchases || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    if (!models[c]) models[c] = { code: c, name: r.model_name || '', bought: 0, sold: 0, boughtValue: 0, lastPrice: 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    models[c].bought += qty;
    models[c].boughtValue += qty * price;
    if (r.model_name) models[c].name = r.model_name;
    if (price > 0) models[c].lastPrice = price;
    const d = _pda(r.date_factor || r.date_reg);
    if (d && d.getTime() > models[c].lastPurchaseTime) models[c].lastPurchaseTime = d.getTime();
  });
  (sales || []).forEach((r: any) => {
    const c = String(r.model_code || '').trim();
    if (!c) return;
    if (!models[c]) models[c] = { code: c, name: r.model_name || '', bought: 0, sold: 0, boughtValue: 0, lastPrice: 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    models[c].sold += qty;
    if (price > 0) models[c].lastSalePrice = price;
    if (r.model_name && !models[c].name) models[c].name = r.model_name;
    const d = _pda(r.date_factor || r.date_reg);
    if (d && d.getTime() > models[c].lastSaleTime) models[c].lastSaleTime = d.getTime();
  });
  // ─── اثر برگشت از فروش: افزایش موجودی ───
  try {
    const salesReturns = await getSalesReturns();
    for (const r of salesReturns || []) {
      for (const it of (r.items || [])) {
        const c = String(it.modelCode || it.model_code || '').trim();
        if (!c) continue;
        if (!models[c]) models[c] = { code: c, name: it.modelName || it.model_name || '', bought: 0, sold: 0, boughtValue: 0, lastPrice: 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
        const qty = Number(it.returnQty || it.quantity) || 0;
        models[c].sold -= qty;
        if (it.modelName || it.model_name) models[c].name = it.modelName || it.model_name;
      }
    }
  } catch (e) { console.log('[inventory] salesReturns effect fail:', e); }

  // ─── اثر برگشت از خرید: کاهش موجودی ───
  try {
    const purchaseReturns = await getPurchaseReturns();
    for (const r of purchaseReturns || []) {
      for (const it of (r.items || [])) {
        const c = String(it.modelCode || it.model_code || '').trim();
        if (!c) continue;
        if (!models[c]) models[c] = { code: c, name: it.modelName || it.model_name || '', bought: 0, sold: 0, boughtValue: 0, lastPrice: 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
        const qty = Number(it.returnQty || it.quantity) || 0;
        const price = Number(it.priceUnit || it.price_unit) || 0;
        models[c].bought -= qty;
        models[c].boughtValue -= qty * price;
        if (it.modelName || it.model_name) models[c].name = it.modelName || it.model_name;
      }
    }
  } catch (e) { console.log('[inventory] purchaseReturns effect fail:', e); }

  products.forEach((p: any) => {
    const code = String(p.code || '').trim();
    if (!code) return;
    if (models[code]) return;
    const adj = adjustmentMap[code] || 0;
    if (adj === 0) return; // کالای بدون خرید/فروش/تعدیل در انبار نمایش داده نشود
    models[code] = { code: code, name: p.name, bought: 0, sold: 0, boughtValue: 0, lastPrice: p.price || 0, lastSalePrice: 0, lastPurchaseTime: 0, lastSaleTime: 0 };
  });
  const list = Object.values(models).map((m: any) => {
    const adj = adjustmentMap[m.code] || 0;
    const stock = m.bought - m.sold + adj;
    let status = 'ok';
    if (stock < 0) status = 'negative';
    else if (stock === 0) status = 'out';
    else if (stock < threshold) status = 'low';
    const _adjValue = adjustmentValueMap[m.code] || 0;
    const _posAdj = Math.max(0, adj);
    const _effBought = m.bought + _posAdj;
    const _effBoughtValue = m.boughtValue + _adjValue;
    const unitCost = _effBought > 0 ? Math.round(_effBoughtValue / _effBought) : 0;
    const totalValue = stock * unitCost;
    const potentialRevenue = stock * (m.lastSalePrice || 0);
    const lastPurchaseDate = m.lastPurchaseTime ? new Date(m.lastPurchaseTime) : null;
    const lastSaleDate = m.lastSaleTime ? new Date(m.lastSaleTime) : null;
    const daysSinceLastSale = lastSaleDate ? Math.floor((nowTs - m.lastSaleTime) / 86400000) : null;
    const daysSincePurchase = lastPurchaseDate ? Math.floor((nowTs - m.lastPurchaseTime) / 86400000) : null;
    return { ...m, currentQty: stock, adjustment: adj, shelf: productMap[m.code]?.shelf || '', status, unitCost, totalValue, potentialRevenue, lastPurchaseDate: lastPurchaseDate ? lastPurchaseDate.toISOString() : '', lastSaleDate: lastSaleDate ? lastSaleDate.toISOString() : '', daysSinceLastSale, daysSincePurchase };
  });
  const order: Record<string, number> = { negative: 0, out: 1, low: 2, ok: 3 };
  list.sort((a: any, b: any) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return String(a.name).localeCompare(String(b.name), 'fa');
  });
  const stats = {
    totalModels: list.length,
    totalQty: list.reduce((a: number, m: any) => a + m.currentQty, 0),
    lowStock: list.filter((m: any) => m.status === 'low').length,
    outOfStock: list.filter((m: any) => m.status === 'out').length,
    negative: list.filter((m: any) => m.status === 'negative').length,
    totalValue: list.reduce((a: number, m: any) => a + m.totalValue, 0),
    potentialRevenue: list.reduce((a: number, m: any) => a + m.potentialRevenue, 0),
    topByValue: list.slice().sort((a: any, b: any) => b.totalValue - a.totalValue).slice(0, 5).map((m: any) => ({ code: m.code, name: m.name, value: m.totalValue, qty: m.currentQty })),
    agingBuckets: {
      healthy: list.filter((m: any) => m.currentQty > 0 && m.daysSinceLastSale !== null && m.daysSinceLastSale <= 30).length,
      slow: list.filter((m: any) => m.currentQty > 0 && m.daysSinceLastSale !== null && m.daysSinceLastSale > 30 && m.daysSinceLastSale <= 60).length,
      verySlow: list.filter((m: any) => m.currentQty > 0 && m.daysSinceLastSale !== null && m.daysSinceLastSale > 60 && m.daysSinceLastSale <= 90).length,
      dead: list.filter((m: any) => m.currentQty > 0 && (m.daysSinceLastSale === null || m.daysSinceLastSale > 90)).length,
    },
  };
  return { list, stats, threshold };
}

export async function getInventory() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — انبار فقط محلی + صف
  try {
    return await computeLocalInventory();
  } catch (e) {
    console.log('[getInventory] error:', e);
    return { list: [], stats: {}, threshold: 5 };
  }
}
export async function getDashboardStats(r, f) {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — داشبورد فقط از داده محلی محاسبه می‌شود.
  try {
    return await computeLocalDashboardStats(r, f);
  } catch (e) {
    console.log("[getDashboardStats] local error:", e);
    var cached = await getLocal("stats_" + r + "_" + f);
    if (cached) return cached;
    return { totalSales: 0, totalPurchases: 0, customerPaid: 0, customerDebt: 0, supplierPaid: 0, supplierDebt: 0, profit: 0, models: [], estimatedCount: 0, defaultMargin: 0.1, rangeLabel: r };
  }
}

// ═══════════════════════════════════════════
//  wrappers اضافی — اینا رو هم کش کن
// ═══════════════════════════════════════════

export async function getUnpaidInvoices() {
  try {
    var grouped = await getSalesGrouped();
    var unpaid = grouped.filter(function(g) { return (g.paid || 0) === 0; });
    await setLocal("unpaid_invoices", unpaid);
    return unpaid;
  } catch (e) {
    console.log("[getUnpaidInvoices] err:", e);
    return (await getLocal("unpaid_invoices")) || [];
  }
}






// تابع کمکی: قبل از رفتن به آفلاین، همه‌چیز رو کش کن

// ═══════════════════════════════════════════
//  جستجو در cache محلی (بدون سرور)
// ═══════════════════════════════════════════



// ═══════════════════════════════════════════
//  بازنویسی lookup ها با cache
// ═══════════════════════════════════════════



// ═══════════════════════════════════════════
//  prepareOffline — همه‌چیز رو دانلود کن
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  Lookup های آفلاین
// ═══════════════════════════════════════════

async function getSupplierList() {
  let list = await getLocal<any[]>('all_purchases_for_lookup');
  if (!list || !list.length) {
    const grouped = await getLocal<any[]>('purchases_grouped') || [];
    list = [];
    for (const g of grouped) {
      if (g.phone) list.push({ supplier_phone: g.phone, supplier_name: g.name, supplier_code: g.supplierCode || '' });
    }
  }
  return list || [];
}


export async function findSupplierByNameOffline(name: string) {
  const list = await getSupplierList();
  for (const p of list) {
    if (p.supplier_name === name) return {
      supplier_name: p.supplier_name, supplier_code: p.supplier_code,
      supplier_phone: p.supplier_phone,
    };
  }
  return null;
}

export async function findCodeByNameOffline(name: string) {
  if (!name || name.length < 2) return '';
  const sales = await getCustomerList();
  const purchases = await getSupplierList();
  for (const s of sales) if (s.customer_name === name && s.customer_code) return s.customer_code;
  for (const p of purchases) if (p.supplier_name === name && p.supplier_code) return p.supplier_code;
  return '';
}


export async function lookupSupplierByName(name: string) {
  const _nm = String(name || '').trim();
  if (_nm) {
    const _dp = await _getDeletedParties();
    if (_dp.names.has(_nm)) return null;
  }
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupSupplierByName(name);
      if (fresh) await setLocal('sup_' + name, fresh);
      return fresh;
    } catch (e) { return await findSupplierByNameOffline(name); }
  }
  const cached = await getLocal<any>('sup_' + name);
  if (cached) return cached;
  return await findSupplierByNameOffline(name);
}

export async function lookupCodeByName(name: string) {
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupCodeByName(name);
      if (fresh) await setLocal('code_' + name, fresh);
      return fresh;
    } catch (e) { return await findCodeByNameOffline(name); }
  }
  const cached = await getLocal<string>('code_' + name);
  if (cached) return cached;
  return await findCodeByNameOffline(name);
}

// ═══════════════════════════════════════════
//  prepareOffline — کامل و مطمئن
// ═══════════════════════════════════════════
export async function prepareOffline(): Promise<boolean> {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — بخش تجاری از Supabase خوانده نمی‌شود.
  // حافظه محلی و صف دست‌نخورده می‌مانند.
  return true;
}

// ═══════════════════════════════════════════
//  شماره فاکتور و کد مشتری آفلاین
// ═══════════════════════════════════════════
export async function generateInvoiceNumber(): Promise<string> {
  try {
    const d = new Date();
    const ds = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const grouped = (await getLocal<any[]>('sales_grouped')) || [];
    const rows = (await getLocal<any[]>('sales')) || [];
    const q = await getQueue();
    const allInvs = new Set<string>();
    grouped.forEach((g: any) => { if (g.invoice) allInvs.add(String(g.invoice)); });
    rows.forEach((r: any) => { if (r.invoice_number) allInvs.add(String(r.invoice_number)); });
    q.forEach((item: any) => { if (item.op === 'createSale' && item.payload?.invoiceNumber) allInvs.add(String(item.payload.invoiceNumber)); });
    let maxN = 1000;
    for (const inv of allInvs) {
      const m = String(inv).match(/^(\d{6})-(\d+)$/);
      if (m && m[1] === ds) {
        const n = parseInt(m[2], 10);
        if (n > maxN) maxN = n;
      }
    }
    return ds + '-' + String(maxN + 1).padStart(4, '0');
  } catch {
    const d = new Date();
    return String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-1001';
  }
}

export async function generateCustomerCode(): Promise<string> {
  const salesGrouped = (await getLocal<any[]>('sales_grouped')) || [];
  const salesRaw = (await getLocal<any[]>('sales')) || [];
  const queue = await getQueue();
  let maxN = 1000;
  const all: string[] = [
    ...salesGrouped.map((g: any) => g.customerCode || ''),
    ...salesRaw.map((r: any) => r.customer_code || ''),
    ...queue.filter((q: any) => q.op === 'createSale').map((q: any) => q.payload?.customerCode || ''),
  ];
  for (const ccode of all) {
    const m = String(ccode).match(/^M_(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN) maxN = n; }
  }
  return 'M_' + (maxN + 1);
}


// ═══════════════════════════════════════════
//  getSalesGrouped — با ادغام صف
// ═══════════════════════════════════════════
function _groupSalesRows(rows: any[]) {
  const groups: Record<string, any> = {};
  for (const r of rows || []) {
    const inv = String(r.invoice_number || '').trim();
    if (!inv) continue;
    if (!groups[inv]) {
      groups[inv] = {
        invoice: inv,
        local_id: 'grp_sale_' + inv,
        name: r.customer_name || '',
        phone: r.customer_phone || '',
        customerCode: r.customer_code || '',
        manual: r.manual_invoice || '',
        bank: r.bank_name || '',
        holder: r.account_holder || '',
        holderCode: r.account_holder_code || '',
        depositDate: r.deposit_date || '',
        shipping: r.shipping || '',
        total: 0, paid: 0, items: [],
        date: r.date_reg || r.date_factor || r.created_at || '',
        updated_at: r.updated_at || r.updatedAt || '',
        device_id: r.device_id || '',
      };
    }
    const g = groups[inv];
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    g.total += qty * price;
    g.paid += Number(r.payment) || 0;
    g.items.push(r);
    if (r.customer_name) g.name = r.customer_name;
    if (r.customer_phone) g.phone = r.customer_phone;
    if (!g.customerCode && r.customer_code) g.customerCode = r.customer_code;
    if (!g.manual && r.manual_invoice) g.manual = r.manual_invoice;
    if (!g.bank && r.bank_name) g.bank = r.bank_name;
    if (!g.holder && r.account_holder) g.holder = r.account_holder;
    if (!g.holderCode && r.account_holder_code) g.holderCode = r.account_holder_code;
    if (!g.depositDate && r.deposit_date) g.depositDate = r.deposit_date;
    if (!g.shipping && r.shipping) g.shipping = r.shipping;
    const rUpd = String(r.updated_at || r.updatedAt || '');
    if (rUpd && (!g.updated_at || rUpd > g.updated_at)) g.updated_at = rUpd;
    if (r.device_id && !g.device_id) g.device_id = r.device_id;
  }
  return Object.values(groups);
}

function _groupPurchaseRows(rows: any[]) {
  const groups: Record<string, any> = {};
  for (const r of rows || []) {
    const inv = String(r.invoice_number || '').trim();
    if (!inv) continue;
    if (!groups[inv]) {
      groups[inv] = {
        invoice: inv,
        local_id: 'grp_purchase_' + inv,
        manual: r.manual_invoice || '',
        name: r.supplier_name || '',
        phone: r.supplier_phone || '',
        supplierCode: r.supplier_code || '',
        bank: r.bank_name || '',
        holder: r.account_holder || '',
        holderCode: r.payer_code || r.account_holder_code || '',
        depositDate: r.deposit_date || '',
        shipping: r.shipping || '',
        total: 0, paid: 0, items: [],
        date: r.date_reg || r.date_factor || r.created_at || '',
        updated_at: r.updated_at || r.updatedAt || '',
        device_id: r.device_id || '',
      };
    }
    const g = groups[inv];
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price_unit) || 0;
    g.total += qty * price;
    g.paid += Number(r.payment) || 0;
    g.items.push(r);
    if (r.supplier_name) g.name = r.supplier_name;
    if (r.supplier_phone) g.phone = r.supplier_phone;
    if (!g.supplierCode && r.supplier_code) g.supplierCode = r.supplier_code;
    if (!g.manual && r.manual_invoice) g.manual = r.manual_invoice;
    if (!g.bank && r.bank_name) g.bank = r.bank_name;
    if (!g.holder && r.account_holder) g.holder = r.account_holder;
    if (!g.holderCode && (r.payer_code || r.account_holder_code)) g.holderCode = r.payer_code || r.account_holder_code;
    if (!g.depositDate && r.deposit_date) g.depositDate = r.deposit_date;
    if (!g.shipping && r.shipping) g.shipping = r.shipping;
    const rUpdP = String(r.updated_at || r.updatedAt || '');
    if (rUpdP && (!g.updated_at || rUpdP > g.updated_at)) g.updated_at = rUpdP;
    if (r.device_id && !g.device_id) g.device_id = r.device_id;
  }
  return Object.values(groups);
}

function _tsLocal(v: any): number {
  const t = Date.parse(String(v || ''));
  return isNaN(t) ? 0 : t;
}

export async function getSalesGrouped() {
  let serverList: any[] = [];
  // BUSINESS_LOCAL_AND_SHEET_ONLY — فروش فقط محلی + صف
  serverList = (await getLocal<any[]>('sales_grouped')) || [];

  // ادغام فروش‌های محلی که هنوز گروه‌بندی نشده‌اند
  const localSalesRows = (await getLocal<any[]>('sales')) || [];
  if (localSalesRows.length) {
    const groupedFromSales = _groupSalesRows(localSalesRows);
    const localUpMap: Record<string, number> = {};
    for (const r of localSalesRows) {
      const inv = String(r.invoice_number || '').trim();
      if (!inv) continue;
      const up = _tsLocal(r.updated_at || r.updatedAt);
      if (!localUpMap[inv] || up > localUpMap[inv]) localUpMap[inv] = up;
    }
    const map: Record<string, any> = {};
    for (const g of serverList) map[String(g.invoice || '')] = g;
    for (const g of groupedFromSales) {
      const k = String(g.invoice || '');
      if (!k) continue;
      const existing = map[k];
      if (!existing) { map[k] = g; continue; }
      const exUp = _tsLocal(existing.updated_at || existing.updatedAt);
      const newUp = localUpMap[k] || 0;
      if (newUp > exUp) map[k] = g;
    }
    serverList = Object.values(map);
  }

  const queue = await getQueue();
  const deletedInvs = new Set<string>();
  for (const item of queue) {
    if (item.op === 'deleteSale') {
      const inv = String(item.payload || '').trim();
      if (inv) deletedInvs.add(inv);
    }
  }
  try {
    const raw = await AsyncStorage.getItem('@mizan_tombstones');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (!t) continue;
        if (String(t.table || '') !== 'sales') continue;
        const k = String(t.key || '').trim();
        if (k) deletedInvs.add(k);
      }
    }
  } catch {}

  const pendingByInv: Record<string, any> = {};
  for (const item of queue) {
    if (item.op === 'createSale') {
      const p = item.payload;
      const inv = p.invoiceNumber;
      if (deletedInvs.has(String(inv))) continue;
      if (!pendingByInv[inv]) {
        pendingByInv[inv] = {
          invoice: inv, name: p.customerName, phone: p.customerPhone,
          total: 0, paid: 0, items: [],
          date: new Date(item.ts).toISOString(),
          _pending: true,
        };
      }
      for (const it of p.items || []) {
        pendingByInv[inv].total += (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        pendingByInv[inv].paid += Number(it.payment) || 0;
        pendingByInv[inv].items.push(it);
      }
      if (!pendingByInv[inv].paid) {
        pendingByInv[inv].paid = Number(p.paymentAmount ?? p.payment ?? p.paid) || 0;
      }
    }
  }

  const cleanedServer = serverList.filter((g: any) => !deletedInvs.has(String(g.invoice || '')));
  const finalMap: Record<string, any> = {};
  for (const g of cleanedServer) {
    const k = String(g.invoice || '');
    if (k) finalMap[k] = g;
  }
  for (const g of Object.values(pendingByInv)) {
    const k = String((g as any).invoice || '');
    if (k) finalMap[k] = g;
  }
  return Object.values(finalMap);
}

// ═══════════════════════════════════════════
//  getPurchasesGrouped — با ادغام صف
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  searchAllInvoices — با ادغام صف آفلاین
// ═══════════════════════════════════════════
export async function searchAllInvoices(q: string) {
  const [sales, purchases] = await Promise.all([
    getSalesGrouped(),
    getPurchasesGrouped(),
  ]);
  const query = (q || '').toLowerCase().trim();
  const filt = (arr: any[], type: string) =>
    arr.map((r) => ({ ...r, type, sheetType: type }))
      .filter((r) => !query ||
        (String(r.invoice) + ' ' + String(r.name || '') + ' ' + String(r.phone || '')).toLowerCase().includes(query));
  return [...filt(sales, 'sales'), ...filt(purchases, 'purchases')];
}

// ═══════════════════════════════════════════
//  getInvoiceDetail — از صف یا سرور
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  deleteSale — اگه توی صف بود، از صف حذف کن
// ═══════════════════════════════════════════


// ═══════════════════════════════════════════
//  updateInvoiceInQueue — ویرایش فاکتور آفلاین
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  شماره فاکتور خرید آفلاین با P-
// ═══════════════════════════════════════════
async function genPurchaseInvoiceNumber() {
  const today = new Date();
  const ds = String(today.getFullYear()).slice(-2)
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const grouped = (await getLocal<any[]>('purchases_grouped')) || [];
  const queue = await getQueue();
  let maxN = 1000;
  for (const g of grouped) {
    const m = String(g.invoice || '').match(/^P-\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
  }
  for (const q of queue) {
    if (q.op === 'createPurchase') {
      const inv = q.payload?._pendingInvNumber || q.payload?.invoiceNumber || '';
      const m = String(inv).match(/^P-\d{6}-(\d+)$/);
      if (m) { const n = +m[1]; if (n > maxN && n < 1000000) maxN = n; }
    }
  }
  if (MODE === 'online') {
    try {
      const { bridgeNextNumber } = await import('./lib.sheets');
      const central = await bridgeNextNumber('purchase', maxN);
      if (central && central > maxN) {
        return 'P-' + ds + '-' + central;
      }
    } catch {}
  }
  return 'P-' + ds + '-' + (maxN + 1);
}

// ═══════════════════════════════════════════
//  createPurchase — با شماره P-
// ═══════════════════════════════════════════
export async function createPurchase(payload: any) {
  if (await serverBusinessAllowed()) {
    try {
      const r = await lib.createPurchase(payload);
      const inv = String(r || payload.invoiceNumber || '');
      if (inv) await _localUpsertPurchase({ ...payload, invoiceNumber: inv });
      try {
        await _pushAudit({ type: 'purchase_create', table: 'purchases', key: String(inv), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت فاکتور خرید' });
      } catch {}
      return r;
    } catch {}
  }

  const pInv = await genPurchaseInvoiceNumber();
  const newPayload = { ...payload, _pendingInvNumber: pInv, invoiceNumber: pInv };
  await _localUpsertPurchase(newPayload);
  await enqueue('createPurchase', newPayload);
  try {
    await _pushAudit({ type: 'purchase_create', table: 'purchases', key: String(pInv), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت فاکتور خرید' });
  } catch {}
  return pInv;
}

// ═══════════════════════════════════════════
//  getPurchasesGrouped — با شماره P-
// ═══════════════════════════════════════════
export async function getPurchasesGrouped() {
  let serverList: any[] = [];
  // BUSINESS_LOCAL_AND_SHEET_ONLY — خرید فقط محلی + صف
  serverList = (await getLocal<any[]>('purchases_grouped')) || [];

  const localPurchaseRows = (await getLocal<any[]>('purchases')) || [];
  if (localPurchaseRows.length) {
    const groupedFromPurchases = _groupPurchaseRows(localPurchaseRows);
    const localUpMapP: Record<string, number> = {};
    for (const r of localPurchaseRows) {
      const inv = String(r.invoice_number || '').trim();
      if (!inv) continue;
      const up = _tsLocal(r.updated_at || r.updatedAt);
      if (!localUpMapP[inv] || up > localUpMapP[inv]) localUpMapP[inv] = up;
    }
    const map: Record<string, any> = {};
    for (const g of serverList) map[String(g.invoice || '')] = g;
    for (const g of groupedFromPurchases) {
      const k = String(g.invoice || '');
      if (!k) continue;
      const existing = map[k];
      if (!existing) { map[k] = g; continue; }
      const exUp = _tsLocal(existing.updated_at || existing.updatedAt);
      const newUp = localUpMapP[k] || 0;
      if (newUp > exUp) map[k] = g;
    }
    serverList = Object.values(map);
  }

  const queue = await getQueue();
  const deletedInvs = new Set<string>();
  for (const item of queue) {
    if (item.op === 'deletePurchase') {
      const inv = String(item.payload || '').trim();
      if (inv) deletedInvs.add(inv);
    }
  }
  try {
    const raw = await AsyncStorage.getItem('@mizan_tombstones');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (!t) continue;
        if (String(t.table || '') !== 'purchases') continue;
        const k = String(t.key || '').trim();
        if (k) deletedInvs.add(k);
      }
    }
  } catch {}

  const pendingByInv: Record<string, any> = {};
  for (const item of queue) {
    if (item.op === 'createPurchase') {
      const p = item.payload;
      const inv = p._pendingInvNumber || p.invoiceNumber || 'P-PENDING';
      if (deletedInvs.has(String(inv))) continue;
      if (!pendingByInv[inv]) {
        pendingByInv[inv] = {
          invoice: inv,
          manual: p.manualInvoice || '',
          name: p.supplierName,
          phone: p.supplierPhone,
          total: 0, paid: 0, items: [],
          date: new Date(item.ts).toISOString(),
          _pending: true,
        };
      }
      const items = (p.items && p.items.length) ? p.items : [{ modelName: '—', quantity: 0, priceUnit: 0 }];
      for (const it of items) {
        pendingByInv[inv].total += (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        pendingByInv[inv].items.push(it);
      }
      pendingByInv[inv].paid += Number(p.paymentAmount) || 0;
    }
  }

  const cleanedServer = serverList.filter((g: any) => !deletedInvs.has(String(g.invoice || '')));
  const finalMap: Record<string, any> = {};
  for (const g of cleanedServer) {
    const k = String(g.invoice || '');
    if (k) finalMap[k] = g;
  }
  for (const g of Object.values(pendingByInv)) {
    const k = String((g as any).invoice || '');
    if (k) finalMap[k] = g;
  }
  return Object.values(finalMap);
}

// ═══════════════════════════════════════════
//  getInvoiceDetail — از صف یا سرور
// ═══════════════════════════════════════════
export async function getInvoiceDetail(invoiceNumber: string, type?: string) {
  // ۱. صف آفلاین
  const queue = await getQueue();
  for (const item of queue) {
    if (item.op === 'createSale' && item.payload?.invoiceNumber === invoiceNumber) {
      const p = item.payload;
      return (p.items || []).map((it: any, idx: number) => ({
        id: 'queued_' + idx,
        invoice_number: p.invoiceNumber,
        customer_code: p.customerCode,
        customer_name: p.customerName,
        customer_phone: p.customerPhone,
        customer_address: p.customerAddress,
        receiver_name: p.receiverName || '',
        receiver_code: p.receiverCode || '',
        receiver_bank: p.receiverBank || '',
        receiver_account: p.receiverAccount || '',
        shipping: p.shipping,
        model_code: it.modelCode,
        model_name: it.modelName,
        shelf: it.shelf || '',
        quantity: it.quantity,
        price_unit: it.priceUnit,
        payment: (() => {
          const rowPay = Number(it.payment) || 0;
          if (rowPay > 0) return rowPay;
          if (idx !== 0) return 0;
          return Number(p.paymentAmount ?? p.payment ?? p.paid) || 0;
        })(),
        deposit_date: idx === 0 ? (p.payDate || p.depositDate || p.paymentDate || it.depositDate || '') : '',
        bank_name: idx === 0 ? (p.receiverBank || p.bankName || p.bank || it.bankName || '') : '',
        account_holder: idx === 0 ? (p.receiverName || p.holderName || p.accountHolder || it.accountHolder || '') : '',
        account_holder_code: idx === 0 ? (p.receiverCode || p.holderCode || p.accountHolderCode || it.accountHolderCode || '') : '',
        description: idx === 0 ? (p.note || it.description || '') : (it.description || ''),
        date_factor: String(p.invoiceDate || p.date || new Date(item.ts).toISOString()).slice(0, 10).replace(/-/g, '/'),
        date_reg: String(p.invoiceDate || p.date || new Date(item.ts).toISOString()).slice(0, 19).replace('T', ' ').replace(/-/g, '/'),
        _pending: true,
      }));
    }
    if (item.op === 'createPurchase') {
      const pInv = item.payload?._pendingInvNumber || item.payload?.invoiceNumber;
      if (pInv === invoiceNumber) {
        const p = item.payload;
        const items = (p.items && p.items.length) ? p.items : [{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, description: '' }];
        return items.map((it: any, idx: number) => ({
          id: 'queued_' + idx,
          invoice_number: pInv,
          supplier_code: p.supplierCode,
          supplier_name: p.supplierName,
          supplier_phone: p.supplierPhone,
          payer_name: p.payerName || '',
          payer_code: p.payerCode || '',
          receiver_acc: p.receiverAcc || '',
          bank_name: p.bankAccount || '',
          model_code: it.modelCode,
          model_name: it.modelName,
          shelf: it.shelf || '',
          quantity: it.quantity,
          price_unit: it.priceUnit,
          payment: (() => {
            const rowPay = Number(it.payment) || 0;
            if (rowPay > 0) return rowPay;
            if (idx !== 0) return 0;
            return Number(p.paymentAmount ?? p.payment ?? p.paid) || 0;
          })(),
          deposit_date: idx === 0 ? (p.paymentDate || p.depositDate || it.depositDate || '') : '',
          description: it.description || '',
          date_factor: String(p.invoiceDate || p.purchaseDate || p.factorDate || p.date || new Date(item.ts).toISOString()).slice(0, 10).replace(/-/g, '/'),
          date_reg: String(p.invoiceDate || p.purchaseDate || p.factorDate || p.date || new Date(item.ts).toISOString()).slice(0, 19).replace('T', ' ').replace(/-/g, '/'),
          _pending: true,
        }));
      }
    }
  }

  // ۲. کش محلی
  const cacheKey = type === 'purchase' ? 'purchases' : (type === 'sales' ? 'sales' : 'sales');
  const cached = (await getLocal<any[]>(cacheKey)) || [];
  const filtered = cached.filter((r: any) => String(r.invoice_number || '') === invoiceNumber);
  if (filtered.length > 0) {
    const rows = filtered.map((r: any) => ({ ...r }));
    const paidSum = rows.reduce((a: number, r: any) => a + (Number(r.payment) || 0), 0);
    if (paidSum === 0) {
      try {
        const groupedKey = type === 'purchase' ? 'purchases_grouped' : 'sales_grouped';
        const grouped = (await getLocal<any[]>(groupedKey)) || [];
        const g = grouped.find((x: any) => String(x.invoice || '') === invoiceNumber);
        if (g && Number(g.paid)) rows[0].payment = Number(g.paid);
      } catch {}
    }
    return rows;
  }

  // fallback: اگر فاکتور از شیت در grouped آمده باشد
  try {
    const groupedKey = type === 'purchase' ? 'purchases_grouped' : 'sales_grouped';
    const grouped = (await getLocal<any[]>(groupedKey)) || [];
    const g = grouped.find((x: any) => String(x.invoice || '') === invoiceNumber);
    if (g) {
      const isPurchase = groupedKey === 'purchases_grouped';
      return (g.items || []).map((it: any, idx: number) => ({
        id: 'grouped_' + idx,
        invoice_number: invoiceNumber,
        customer_code: isPurchase ? '' : (g.customerCode || g.code || ''),
        customer_name: isPurchase ? '' : (g.name || ''),
        customer_phone: isPurchase ? '' : (g.phone || ''),
        supplier_code: isPurchase ? (g.supplierCode || g.code || '') : '',
        supplier_name: isPurchase ? (g.name || '') : '',
        supplier_phone: isPurchase ? (g.phone || '') : '',
        model_code: it.modelCode || it.model_code || '',
        model_name: it.modelName || it.model_name || '',
        shelf: it.shelf || '',
        quantity: Number(it.quantity) || 0,
        price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
        payment: idx === 0 ? (Number(g.paid) || 0) : 0,
        deposit_date: idx === 0 ? (g.depositDate || g.deposit_date || '') : '',
        bank_name: idx === 0 ? (g.bank || g.bank_name || '') : '',
        account_holder: idx === 0 ? (g.holder || g.account_holder || '') : '',
        account_holder_code: idx === 0 ? (g.holderCode || g.account_holder_code || g.customerCode || g.supplierCode || '') : '',
        payer_code: idx === 0 ? (g.holderCode || g.account_holder_code || g.payerCode || '') : '',
        payer_name: idx === 0 ? (g.holder || g.account_holder || g.payerName || '') : '',
        receiver_code: idx === 0 ? (g.holderCode || g.account_holder_code || '') : '',
        receiver_name: idx === 0 ? (g.holder || g.account_holder || '') : '',
        shipping: idx === 0 ? (() => {
          if (g.shipping) return g.shipping;
          if (g.shipping_name) return g.shipping_name;
          if (g.items && g.items[0] && g.items[0].shipping) return g.items[0].shipping;
          try {
            const rawKey = isPurchase ? 'purchases' : 'sales';
            // defensive: look in raw rows
            return '';
          } catch { return ''; }
        })() : '',
        manual_invoice: g.manual || g.manual_invoice || '',
        description: it.description || '',
        date_factor: g.date || '',
        date_reg: g.date || '',
        _grouped: true,
      }));
    }
  } catch {}

  // اگر type مشخص نبود، جدول دیگر را هم امتحان کن
  if (!type) {
    const otherKey = cacheKey === 'sales' ? 'purchases' : 'sales';
    const otherCached = (await getLocal<any[]>(otherKey)) || [];
    const otherFiltered = otherCached.filter((r: any) => String(r.invoice_number || '') === invoiceNumber);
    if (otherFiltered.length > 0) return otherFiltered;
  }

  // ۳. سرور (اگر آنلاین)
  if (MODE === 'online') {
    try {
      const fresh = await lib.getInvoiceDetail(invoiceNumber, type);
      if (fresh && fresh.length > 0) return fresh;
    } catch {}
  }

  return [];
}

// ═══════════════════════════════════════════
//  updateInvoiceInQueue — ویرایش آفلاین
// ═══════════════════════════════════════════
export async function updateInvoiceInQueue_original(invoiceNumber: string, type: 'sales' | 'purchases', rows: any[]) {
  const queue = await getQueue();
  const op = type === 'sales' ? 'createSale' : 'createPurchase';
  let found = false;

  for (const item of queue) {
    if (item.op !== op) continue;

    let match = false;
    if (type === 'sales') {
      match = item.payload?.invoiceNumber === invoiceNumber;
    } else {
      match = (item.payload?._pendingInvNumber === invoiceNumber)
        || (item.payload?.invoiceNumber === invoiceNumber);
    }

    if (match) {
      found = true;
      const validRows = rows.filter((r: any) => !r._deleted);
      if (type === 'sales') {
        item.payload.items = validRows.map((r: any) => ({
          modelCode: r.modelCode,
          modelName: r.modelName,
          quantity: r.quantity,
          priceUnit: r.priceUnit,
          payment: r.payment,
          depositDate: r.depositDate,
          bankName: r.bankName,
          accountHolder: r.accountHolder,
          accountHolderCode: r.accountHolderCode,
          description: r.description,
        }));
      } else {
        item.payload.items = validRows.map((r: any) => ({
          modelCode: r.modelCode,
          modelName: r.modelName,
          quantity: r.quantity,
          priceUnit: r.priceUnit,
          description: r.description,
        }));
        if (validRows[0]) {
          item.payload.paymentAmount = validRows[0].payment || 0;
          item.payload.paymentDate = validRows[0].depositDate || '';
          item.payload.bankAccount = validRows[0].bankName || '';
          item.payload.payerName = validRows[0].accountHolder || '';
          item.payload.payerCode = validRows[0].accountHolderCode || '';
        }
      }

      // BUSINESS_LOCAL_AND_SHEET_ONLY — به‌روزرسانی محلی تا دفتر معین فوراً تغییر را ببیند
      const key = type === 'sales' ? 'sales' : 'purchases';
      const list = (await getLocal<any[]>(key)) || [];
      const template = list.find((r: any) => String(r.invoice_number || '') === invoiceNumber) || {};
      const filtered = list.filter((r: any) => String(r.invoice_number || '') !== invoiceNumber);
      const newRows = validRows.map((r: any) => ({
        ...template,
        invoice_number: invoiceNumber,
        model_code: r.modelCode || '',
        model_name: r.modelName || '',
        quantity: Number(r.quantity) || 0,
        price_unit: Number(r.priceUnit) || 0,
        payment: Number(r.payment) || 0,
        description: r.description || '',
        deposit_date: r.depositDate || template.deposit_date || '',
        bank_name: r.bankName || template.bank_name || '',
        account_holder: r.accountHolder || template.account_holder || '',
        account_holder_code: r.accountHolderCode || template.account_holder_code || '',
      }));
      await setLocal(key, [...filtered, ...newRows]);
      break;
    }
  }

  if (found) {
    await AsyncStorage.setItem('@mizan_queue', JSON.stringify(queue));
  }
  return found;
}

// ═══════════════════════════════════════════
//  حذف از صف
// ═══════════════════════════════════════════
export async function deleteSaleFromQueue(invoiceNumber: string) {
  const queue = await getQueue();
  const filtered = queue.filter((item: any) =>
    !(item.op === 'createSale' && item.payload?.invoiceNumber === invoiceNumber)
  );
  await AsyncStorage.setItem('@mizan_queue', JSON.stringify(filtered));
}

export async function deletePurchaseFromQueue(invoiceNumber: string) {
  const queue = await getQueue();
  const filtered = queue.filter((item: any) => {
    if (item.op !== 'createPurchase') return true;
    const pInv = item.payload?._pendingInvNumber || item.payload?.invoiceNumber;
    return pInv !== invoiceNumber;
  });
  await AsyncStorage.setItem('@mizan_queue', JSON.stringify(filtered));
}

// ═══════════════════════════════════════════
//  جستجوی مشتری — چک cache + صف
// ═══════════════════════════════════════════
export async function findCustomerByPhoneOffline(phone: string) {
  const p = String(phone).replace(/[^0-9]/g, '');
  if (!p) return null;

  // ۱. جستجو در cache (sales_grouped + all_sales_for_lookup)
  const list = await getCustomerList();
  for (const s of list) {
    const sp = String(s.customer_phone || '').replace(/[^0-9]/g, '');
    if (sp === p) {
      return {
        customer_name: s.customer_name,
        customer_address: s.customer_address || '',
        customer_code: s.customer_code,
        found_as: 'customer',
      };
    }
  }

  // ۲. جستجو در صف (فاکتورهای آفلاین ثبت‌شده)
  const queue = await getQueue();
  for (const item of queue) {
    if (item.op === 'createSale') {
      const itemPhone = String(item.payload?.customerPhone || '').replace(/[^0-9]/g, '');
      if (itemPhone === p) {
        return {
          customer_name: item.payload?.customerName || '',
          customer_address: item.payload?.customerAddress || '',
          customer_code: item.payload?.customerCode || '',
          found_as: 'customer',
        };
      }
    }
    // فاکتورهای خرید — تأمین‌کننده‌ها رو هم چک کن
    if (item.op === 'createPurchase') {
      const sp = String(item.payload?.supplierPhone || '').replace(/[^0-9]/g, '');
      if (sp === p) {
        return {
          customer_name: item.payload?.supplierName || '',
          customer_address: '',
          customer_code: item.payload?.supplierCode || '',
          found_as: 'supplier',
        };
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════
//  lookupCustomerByPhone — با چک صف
// ═══════════════════════════════════════════
export async function lookupCustomerByPhone(phone: string) {
  // BUSINESS_LOCAL_ONLY — اول محلی، بعد اگر خالی بود Supabase
  const _p = String(phone || '').replace(/[^0-9]/g, '');
  if (_p) {
    const _dp = await _getDeletedParties();
    if (_dp.phones.has(_p)) return null;
  }
  const cached = await getLocal<any>('cust_' + phone);
  if (cached) return cached;
  const local = await findCustomerByPhoneOffline(phone);
  if (local) return local;
  if (MODE === 'online') {
    try {
      const fresh = await lib.lookupCustomerByPhone(phone);
      if (fresh) {
        await setLocal('cust_' + phone, fresh);
        return fresh;
      }
    } catch {}
  }
  return null;
}

// ═══════════════════════════════════════════
//  getCustomerList — با ادغام صف
// ═══════════════════════════════════════════
async function getCustomerList(): Promise<any[]> {
  const result: any[] = [];
  const seen = new Set<string>();
  const _dp = await _getDeletedParties();

  // از all_sales_for_lookup
  const all = (await getLocal<any[]>('all_sales_for_lookup')) || [];
  for (const s of all) {
    const p = String(s.customer_phone || '').replace(/[^0-9]/g, '');
    const c = String(s.customer_code || '').trim();
    if ((p && _dp.phones.has(p)) || (c && _dp.codes.has(c))) continue;
    const key = String(s.customer_phone || '') + '_' + String(s.customer_code || '');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }

  // از sales_grouped
  const grouped = (await getLocal<any[]>('sales_grouped')) || [];
  for (const g of grouped) {
    const p = String(g.phone || '').replace(/[^0-9]/g, '');
    const c = String(g.customerCode || g.code || '').trim();
    if ((p && _dp.phones.has(p)) || (c && _dp.codes.has(c))) continue;
    const key = String(g.phone || '') + '_' + String(g.customerCode || g.code || '');
    if (!seen.has(key) && g.phone) {
      seen.add(key);
      result.push({
        customer_phone: g.phone,
        customer_name: g.name,
        customer_address: g.address || '',
        customer_code: g.customerCode || g.code || '',
      });
    }
  }

  return result;
}


// ═══════════════════════════════════════════
//  صرافی (FX Trades)
// ═══════════════════════════════════════════
export async function getFxTrades(): Promise<any[]> {
  return cachedRead('fx_trades', async () => {
    const { data } = await lib.supabase.from('fx_trades').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createFxTrade(p: any): Promise<any> {
  const devE = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowE = new Date().toISOString();
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: nowE, updated_at: nowE, device_id: devE };
  const local = (await getLocal<any[]>('fx_trades')) || [];
  await setLocal('fx_trades', [item, ...local]);
  if (MODE === 'online') {
    try {
      const { error } = await lib.supabase.from('fx_trades').insert({
        from_currency: p.from_currency, to_currency: p.to_currency,
        from_qty: p.from_qty, to_qty: p.to_qty, rate: p.rate || 0,
        description: p.description || '', local_id: item.local_id,
      });
      if (error) throw error;
    } catch { await enqueue('createFxTrade', p); }
  } else { await enqueue('createFxTrade', p); }
  return item;
}
export async function deleteFxTrade(localId: string) {
  const local = (await getLocal<any[]>('fx_trades')) || [];
  await setLocal('fx_trades', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_trades').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}

// ═══════════════════════════════════════════
//  هزینه‌ها (Expenses)
// ═══════════════════════════════════════════
export async function getExpenses(): Promise<any[]> {
  // BUSINESS_LOCAL_ONLY — فقط حافظه محلی + صف، بدون Supabase
  const local = (await getLocal<any[]>('expenses')) || [];
  const map: Record<string, any> = {};
  for (const x of local) { const k = String(x.local_id || x.id || ''); if (k) map[k] = x; }
  try {
    const q = await getQueue();
    for (const it of q) {
      if (it.op === 'createExpense' || it.op === 'updateExpense') {
        const p = it.payload || {};
        const k = String(p.local_id || p.id || '');
        if (k) map[k] = { ...(map[k] || {}), ...p };
      } else if (it.op === 'deleteExpense') {
        const id = typeof it.payload === 'string' ? it.payload : (it.payload?.local_id || it.payload?.id);
        if (id) delete map[id];
      }
    }
  } catch {}
  return _applyTombstones('expenses', Object.values(map));
}
export async function createExpense(p: any): Promise<any> {
  const devEm = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowEm = new Date().toISOString();
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: nowEm, updated_at: nowEm, device_id: devEm };
  const local = (await getLocal<any[]>('expenses')) || [];
  await setLocal('expenses', [item, ...local]);
  try { await _pushAudit({ type: 'expense_create', table: 'expenses', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت هزینه' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      const { error } = await lib.supabase.from('expenses').insert({
        invoice_number: p.invoice_number || '',
        category: p.category || p.type || 'متفرقه',
        title: p.title || '',
        amount: Number(p.amount) || 0,
        payment_method: p.payment_method || '',
        bank: p.bank || '',
        account_number: p.account_number || '',
        payer_name: p.payer_name || '',
        payer_code: p.payer_code || '',
        receiver_name: p.receiver_name || p.receiverName || '',
        receiver_code: p.receiver_code || p.receiverCode || '',
        payment_date: p.payment_date || p.date || '',
        description: p.description || '',
        status: p.status || '',
        local_id: item.local_id,
        counterpart_type: p.counterpart_type || '',
        counterpart_code: p.counterpart_code || '',
      });
      if (error) throw error;
        try { await _pushAudit({ type: 'expense_create', table: 'expenses', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت هزینه' }); } catch {}
    } catch { await enqueue('createExpense', p); }
  } else { await enqueue('createExpense', p); }
  return item;
}
export async function deleteExpense(localId: string) {
  await recordTombstone('expenses', String(localId));
  const local = (await getLocal<any[]>('expenses')) || [];
  await setLocal('expenses', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'expense_delete', table: 'expenses', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف هزینه' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.supabase.from('expenses').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); }
    catch { await enqueue('deleteExpense', String(localId)); }
  } else {
    await enqueue('deleteExpense', String(localId));
  }
}

// ═══════════════════════════════════════════
//  کارمندان (Employees)
// ═══════════════════════════════════════════
export async function getEmployees(): Promise<any[]> {
  // BUSINESS_LOCAL_ONLY — فقط حافظه محلی
  return _applyTombstones('employees', (await getLocal<any[]>('employees')) || []);
}
export async function createEmployee(p: any): Promise<any> {
  const devAt = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowAt = new Date().toISOString();
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: nowAt, updated_at: nowAt, device_id: devAt };
  const local = (await getLocal<any[]>('employees')) || [];
  await setLocal('employees', [item, ...local]);
  try { await _pushAudit({ type: 'employee_create', table: 'employees', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت کارمند' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      const { error } = await lib.supabase.from('employees').insert({
        code: p.code, name: p.name, phone: p.phone || '', role: p.role || '',
        contract_type: p.contract_type, amount: p.amount || 0, overtime_rate: p.overtime_rate || 0,
        local_id: item.local_id,
      });
      if (error) throw error;
        try { await _pushAudit({ type: 'employee_create', table: 'employees', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت کارمند' }); } catch {}
    } catch { await enqueue('createEmployee', p); }
  } else { await enqueue('createEmployee', p); }
  return item;
}
export async function deleteEmployee(localId: string) {
  await recordTombstone('employees', String(localId));
  const local = (await getLocal<any[]>('employees')) || [];
  await setLocal('employees', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'employee_delete', table: 'employees', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف کارمند' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.supabase.from('employees').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); }
    catch { await enqueue('deleteEmployee', String(localId)); }
  } else {
    await enqueue('deleteEmployee', String(localId));
  }
}

// ═══════════════════════════════════════════
//  حضور (Attendance)
// ═══════════════════════════════════════════
export async function getAttendance(): Promise<any[]> {
  // BUSINESS_LOCAL_ONLY — فقط حافظه محلی
  return _applyTombstones('attendance', (await getLocal<any[]>('attendance')) || []);
}
export async function createAttendance(p: any): Promise<any> {
  const item = { ...p, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  const local = (await getLocal<any[]>('attendance')) || [];
  await setLocal('attendance', [item, ...local]);
  try { await _pushAudit({ type: 'attendance_create', table: 'attendance', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت حضور' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      const { error } = await lib.supabase.from('attendance').insert({
        employee_code: p.employee_code, employee_name: p.employee_name || '',
        date: p.date, status: p.status, hours: p.hours || 0, overtime: p.overtime || 0,
        local_id: item.local_id,
      });
      if (error) throw error;
        try { await _pushAudit({ type: 'attendance_create', table: 'attendance', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت حضور' }); } catch {}
    } catch { await enqueue('createAttendance', p); }
  } else { await enqueue('createAttendance', p); }
  return item;
}
export async function deleteSalaryPayment(localId: string) {
  await recordTombstone('salary_payments', String(localId));
  const local = (await getLocal<any[]>('salary_payments')) || [];
  await setLocal('salary_payments', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'salary_delete', table: 'salary_payments', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف پرداخت حقوق' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.deleteSalaryPayment(String(localId)); }
    catch { await enqueue('deleteSalaryPayment', String(localId)); }
  } else {
    await enqueue('deleteSalaryPayment', String(localId));
  }
}

export async function deleteLoan(localId: string) {
  await recordTombstone('employee_loans', String(localId));
  const local = (await getLocal<any[]>('employee_loans')) || [];
  await setLocal('employee_loans', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'loan_delete', table: 'employee_loans', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف وام' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.deleteLoan(String(localId)); }
    catch { await enqueue('deleteLoan', String(localId)); }
  } else {
    await enqueue('deleteLoan', String(localId));
  }
}

export async function deleteLeave(localId: string) {
  await recordTombstone('employee_leaves', String(localId));
  const local = (await getLocal<any[]>('employee_leaves')) || [];
  await setLocal('employee_leaves', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'leave_delete', table: 'employee_leaves', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف مرخصی' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.deleteLeave(String(localId)); }
    catch { await enqueue('deleteLeave', String(localId)); }
  } else {
    await enqueue('deleteLeave', String(localId));
  }
}

export async function deleteAttendance(localId: string) {
  await recordTombstone('attendance', String(localId));
  const local = (await getLocal<any[]>('attendance')) || [];
  await setLocal('attendance', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'attendance_delete', table: 'attendance', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف حضور' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.supabase.from('attendance').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); }
    catch { await enqueue('deleteAttendance', String(localId)); }
  } else {
    await enqueue('deleteAttendance', String(localId));
  }
}

export async function deleteBatch(localId: string) {
  await recordTombstone('payroll_batches', String(localId));
  const local = (await getLocal<any[]>('payroll_batches')) || [];
  await setLocal('payroll_batches', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try { await _pushAudit({ type: 'batch_delete', table: 'payroll_batches', key: String(localId), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف لیست حقوق' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.supabase.from('payroll_batches').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); }
    catch { await enqueue('deleteBatch', String(localId)); }
  } else {
    await enqueue('deleteBatch', String(localId));
  }
}


// ═══════════════════════════════════════════
//  مشتریان صرافی (X_)
// ═══════════════════════════════════════════
export async function getFxCustomers(): Promise<any[]> {
  return cachedRead('fx_customers', async () => {
    const { data } = await lib.supabase.from('fx_customers').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createFxCustomer(p: any): Promise<any> {
  const local = (await getLocal<any[]>('fx_customers')) || [];
  // تولید کد خودکار
  let code = p.code || '';
  if (!code) {
    let maxN = 1000;
    local.forEach((x: any) => { const m = String(x.code || '').match(/^X_(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
    code = 'X_' + (maxN + 1);
  }
  const item = { ...p, code, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  await setLocal('fx_customers', [item, ...local]);
  if (MODE === 'online') {
    try {
      await lib.supabase.from('fx_customers').insert({
        code, name: p.name, phone: p.phone || '', bank: p.bank || '',
        holder_name: p.holder_name || '', holder_code: p.holder_code || '',
        notes: p.notes || '', local_id: item.local_id,
      });
    } catch { await enqueue('createFxCustomer', { ...p, code }); }
  } else { await enqueue('createFxCustomer', { ...p, code }); }
  return item;
}
export async function updateFxCustomer(localId: string, p: any) {
  const local = (await getLocal<any[]>('fx_customers')) || [];
  const newList = local.map((x: any) => (x.local_id === localId || x.id === localId) ? { ...x, ...p } : x);
  await setLocal('fx_customers', newList);
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_customers').update(p).or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}
export async function deleteFxCustomer(localId: string) {
  const local = (await getLocal<any[]>('fx_customers')) || [];
  await setLocal('fx_customers', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_customers').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}

// ═══════════════════════════════════════════
//  شرکا (P_)
// ═══════════════════════════════════════════
export async function getFxPartners(): Promise<any[]> {
  return cachedRead('fx_partners', async () => {
    const { data } = await lib.supabase.from('fx_partners').select('*').order('created_at', { ascending: false });
    return data || [];
  });
}
export async function createFxPartner(p: any): Promise<any> {
  const local = (await getLocal<any[]>('fx_partners')) || [];
  let code = p.code || '';
  if (!code) {
    let maxN = 1000;
    local.forEach((x: any) => { const m = String(x.code || '').match(/^P_(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
    code = 'P_' + (maxN + 1);
  }
  const item = { ...p, code, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), created_at: new Date().toISOString() };
  await setLocal('fx_partners', [item, ...local]);
  if (MODE === 'online') {
    try {
      await lib.supabase.from('fx_partners').insert({
        code, name: p.name, phone: p.phone || '', notes: p.notes || '', local_id: item.local_id,
      });
    } catch { await enqueue('createFxPartner', { ...p, code }); }
  } else { await enqueue('createFxPartner', { ...p, code }); }
  return item;
}
export async function updateFxPartner(localId: string, p: any) {
  const local = (await getLocal<any[]>('fx_partners')) || [];
  const newList = local.map((x: any) => (x.local_id === localId || x.id === localId) ? { ...x, ...p } : x);
  await setLocal('fx_partners', newList);
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_partners').update(p).or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}
export async function deleteFxPartner(localId: string) {
  const local = (await getLocal<any[]>('fx_partners')) || [];
  await setLocal('fx_partners', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_partners').delete().or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}

// ═══════════════════════════════════════════
//  updateFxTrade
// ═══════════════════════════════════════════
export async function updateFxTrade(localId: string, p: any) {
  const local = (await getLocal<any[]>('fx_trades')) || [];
  const newList = local.map((x: any) => (x.local_id === localId || x.id === localId) ? { ...x, ...p } : x);
  await setLocal('fx_trades', newList);
  if (MODE === 'online') {
    try { await lib.supabase.from('fx_trades').update(p).or('local_id.eq.' + localId + ',id.eq.' + localId); } catch {}
  }
}


// ═══════════════════════════════════════════
//  updateInvoiceInQueue — wrapper با fallback برای synced
// ═══════════════════════════════════════════
export async function updateInvoiceInQueue(invoiceNumber: string, type: 'sales' | 'purchases', rows: any[]) {
  try {
    await updateInvoiceInQueue_original(invoiceNumber, type, rows);
  } catch (e) {
    console.log('updateInvoiceInQueue_original error:', e);
  }
  const q = await getQueue();
  const createOp = type === 'sales' ? 'createSale' : 'createPurchase';
  const updateOp = type === 'sales' ? 'updateSale' : 'updatePurchase';
  const hasCreate = q.some((item: any) => item.op === createOp && item.payload?.invoiceNumber === invoiceNumber);
  const hasUpdate = q.some((item: any) => item.op === updateOp && item.payload?.invoiceNumber === invoiceNumber);
  if (!hasCreate && !hasUpdate) {
    const newQ = [...q, { op: updateOp, payload: { invoiceNumber, rows }, ts: Date.now() }];
    await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));
  } else if (hasUpdate) {
    const newQ = q.map((item: any) => {
      if (item.op === updateOp && item.payload?.invoiceNumber === invoiceNumber) {
        return { ...item, payload: { invoiceNumber, rows } };
      }
      return item;
    });
    await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));
  }
}


// Queue details + retry + clear failed
export async function getQueueDetails() {
  var q = await getQueue();
  return q.map(function(item, i) {
    var p = item.payload;
    var label = "";
    if (typeof p === "string") { label = p; }
    else if (p && typeof p === "object") {
      label = p.invoiceNumber || p.invoice_number || p.code || p.name || p.id || p.local_id || "";
    }
    return { index: i, op: item.op, ts: item.ts || 0, attempts: item.attempts || 0, lastError: item.lastError || "", failed: !!item.failed, label: String(label).slice(0, 40) };
  });
}
export async function retryFailed() {
  var q = await getQueue();
  var count = 0;
  var newQ = q.map(function(item) {
    if (item.failed) { count++; return Object.assign({}, item, { failed: false, attempts: 0, lastError: "" }); }
    return item;
  });
  await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));
  return count;
}
export async function clearFailedItems() {
  var q = await getQueue();
  var before = q.length;
  var newQ = q.filter(function(item) { return !item.failed; });
  await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));
  return before - newQ.length;
}
// === Dashboard local compute (offline + queue merge) ===
function _localPad2(n) { return String(n).padStart(2, "0"); }

async function computeLocalDashboardStats(range, filter) {
  if (!range) range = "month";
  if (!filter) filter = "both";
  var settings = (await getLocal("settings")) || {};
  var margin = settings.profit_margin != null ? settings.profit_margin : 0.10;

  var localPurchases = (await getLocal("purchases")) || [];
  var localSales = (await getLocal("sales")) || [];

  // BUSINESS_LOCAL_ONLY — Merge grouped (device 2) + apply tombstones
  try {
    var _grpS2 = (await getLocal("sales_grouped")) || [];
    var _grpP2 = (await getLocal("purchases_grouped")) || [];
    var _haveS2 = {};
    for (var _si2 = 0; _si2 < localSales.length; _si2++) {
      var _iv2 = String(localSales[_si2].invoice_number || '').trim();
      if (_iv2) _haveS2[_iv2] = true;
    }
    var _haveP2 = {};
    for (var _pi2 = 0; _pi2 < localPurchases.length; _pi2++) {
      var _ivp2 = String(localPurchases[_pi2].invoice_number || '').trim();
      if (_ivp2) _haveP2[_ivp2] = true;
    }
    for (var _gs2 = 0; _gs2 < _grpS2.length; _gs2++) {
      var _gS2 = _grpS2[_gs2];
      var _invS2 = String(_gS2.invoice || '').trim();
      if (!_invS2 || _haveS2[_invS2]) continue;
      var _itemsS2 = _gS2.items || [];
      for (var _is2 = 0; _is2 < _itemsS2.length; _is2++) {
        var _itS2 = _itemsS2[_is2];
        localSales.push({
          invoice_number: _invS2,
          customer_code: _gS2.customerCode || '',
          customer_name: _gS2.name || '',
          model_code: _itS2.modelCode || _itS2.model_code || '',
          model_name: _itS2.modelName || _itS2.model_name || '',
          quantity: Number(_itS2.quantity) || 0,
          price_unit: Number(_itS2.priceUnit != null ? _itS2.priceUnit : _itS2.price_unit) || 0,
          payment: Number(_itS2.payment) || 0,
          date_factor: _gS2.date || '',
          date_reg: _gS2.date || '',
        });
      }
    }
    for (var _gp2 = 0; _gp2 < _grpP2.length; _gp2++) {
      var _gP2 = _grpP2[_gp2];
      var _invP2 = String(_gP2.invoice || '').trim();
      if (!_invP2 || _haveP2[_invP2]) continue;
      var _itemsP2 = _gP2.items || [];
      for (var _ip2 = 0; _ip2 < _itemsP2.length; _ip2++) {
        var _itP2 = _itemsP2[_ip2];
        localPurchases.push({
          invoice_number: _invP2,
          supplier_code: _gP2.supplierCode || '',
          supplier_name: _gP2.name || '',
          model_code: _itP2.modelCode || _itP2.model_code || '',
          model_name: _itP2.modelName || _itP2.model_name || '',
          quantity: Number(_itP2.quantity) || 0,
          price_unit: Number(_itP2.priceUnit != null ? _itP2.priceUnit : _itP2.price_unit) || 0,
          payment: Number(_itP2.payment) || 0,
          date_factor: _gP2.date || '',
          date_reg: _gP2.date || '',
        });
      }
    }
    var _tomb2 = await getTombstones();
    var _deadS2 = {}; var _deadP2 = {};
    for (var _ti2 = 0; _ti2 < _tomb2.length; _ti2++) {
      var _t2 = _tomb2[_ti2];
      if (String(_t2.table || '') === 'sales') _deadS2[String(_t2.key || '').trim()] = true;
      if (String(_t2.table || '') === 'purchases') _deadP2[String(_t2.key || '').trim()] = true;
    }
    if (Object.keys(_deadS2).length) localSales = localSales.filter(function(r) { return !_deadS2[String(r.invoice_number || '').trim()]; });
    if (Object.keys(_deadP2).length) localPurchases = localPurchases.filter(function(r) { return !_deadP2[String(r.invoice_number || '').trim()]; });
  } catch (e) { console.log('[dashboard] merge/tombstone fail:', e); }

  var q = await getQueue();
  var queuePurchases = [];
  var queueSales = [];
  for (var qi = 0; qi < q.length; qi++) {
    var item = q[qi];
    if (!item.payload || !item.payload.items) continue;
    if (item.op !== "createPurchase" && item.op !== "createSale") continue;
    var target = item.op === "createPurchase" ? queuePurchases : queueSales;
    var baseDate = item.payload.date || new Date(item.ts || Date.now()).toISOString();
    for (var ii = 0; ii < item.payload.items.length; ii++) {
      var it = item.payload.items[ii];
      var qty = Number(it.quantity) || 0;
      var pu = Number(it.price_unit != null ? it.price_unit : it.priceUnit) || 0;
      target.push({
        model_code: it.model_code != null ? it.model_code : (it.modelCode || ""),
        model_name: it.model_name != null ? it.model_name : (it.modelName || ""),
        quantity: qty,
        price_unit: pu,
        payment: Number(it.payment) || 0,
        date_factor: it.date_factor != null ? it.date_factor : (it.dateFactor || baseDate),
        date_reg: it.date_reg != null ? it.date_reg : (it.dateReg || baseDate),
        amount: qty * pu,
        balance: 0
      });
    }
  }
  var pData = queuePurchases.concat(localPurchases);
  var sData = queueSales.concat(localSales);

  var parseDateAny = (lib && lib.parseDateAny) ? lib.parseDateAny : function(d) { return d ? new Date(d) : null; };
  var DASH_LBL = (lib && lib.DASH_RANGE_LABELS) ? lib.DASH_RANGE_LABELS : {};

  var now = new Date();
  var startDate = null;
  var calType = (lib && lib.getCalType) ? lib.getCalType() : 'jalali';
  
  if (range === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "month") {
    try {
      if (calType === 'jalali' && lib.g2j && lib.j2g) {
        var j = lib.g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
        var g = lib.j2g(j[0], j[1], 1);
        startDate = new Date(g.y, g.m - 1, g.d);
      } else if (calType === 'hijri' && lib.g2h && lib.h2g) {
        var h = lib.g2h(now);
        var g = lib.h2g(h.y, h.m, 1);
        startDate = new Date(g.y, g.m - 1, g.d);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    } catch (e) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  } else if (range === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else if (range === "last6months") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  var inRange = function(d) {
    if (!startDate) return true;
    var dt = parseDateAny(d);
    return !!dt && dt >= startDate && dt <= now;
  };

  var purchaseByCode = {};
  var purchaseNames = {};
  var totalPurchases = 0, supplierPaid = 0, supplierDebt = 0;
  pData.forEach(function(r) {
    var pDate = parseDateAny(r.date_factor) || parseDateAny(r.date_reg);
    var code = String(r.model_code || "").trim();
    var name = String(r.model_name || "").trim();
    var price = Number(r.price_unit) || 0;
    if (code && pDate && price > 0) {
      if (!purchaseByCode[code]) purchaseByCode[code] = [];
      purchaseByCode[code].push({ date: pDate.getTime(), price: price });
    }
    if (code && name) purchaseNames[code] = name;
    if (filter !== "sales" && inRange(r.date_factor)) {
      totalPurchases += Number(r.amount || (r.quantity * r.price_unit)) || 0;
      supplierPaid += Number(r.payment) || 0;
      supplierDebt += (Number(r.amount || (r.quantity * r.price_unit)) || 0) - (Number(r.payment) || 0);
    }
  });
  Object.keys(purchaseByCode).forEach(function(k) {
    purchaseByCode[k].sort(function(a, b) { return a.date - b.date; });
  });

  var findPurchaseForSale = function(code, saleTime) {
    var arr = purchaseByCode[code];
    if (!arr || !arr.length) return { price: 0, source: "unknown" };
    var sd = new Date(saleTime);
    var saleYM = sd.getFullYear() + "/" + _localPad2(sd.getMonth() + 1);
    for (var k = arr.length - 1; k >= 0; k--) {
      var pd = new Date(arr[k].date);
      var ym = pd.getFullYear() + "/" + _localPad2(pd.getMonth() + 1);
      if (ym === saleYM && arr[k].date <= saleTime) return { price: arr[k].price, source: "same-month" };
    }
    var lastBefore = null;
    for (var k2 = 0; k2 < arr.length; k2++) {
      if (arr[k2].date <= saleTime) lastBefore = arr[k2];
      else break;
    }
    if (lastBefore) return { price: lastBefore.price, source: "historical" };
    return { price: 0, source: "unknown" };
  };

  var totalSales = 0, customerPaid = 0, totalProfit = 0;
  var modelProfits = {};
  sData.forEach(function(r) {
    var saleDate = parseDateAny(r.date_factor) || parseDateAny(r.date_reg);
    if (!saleDate) return;
    if (!inRange(r.date_factor)) return;
    var code = String(r.model_code || "").trim();
    var name = String(r.model_name || "").trim();
    var qty = Number(r.quantity) || 0;
    var price = Number(r.price_unit) || 0;
    var lineTotal = qty * price;
    var payment = Number(r.payment) || 0;
    if (filter !== "purchase") {
      totalSales += lineTotal;
      customerPaid += payment;
      var info = findPurchaseForSale(code, saleDate.getTime());
      var rowProfit = (info.price > 0 && qty > 0 && price > 0) ? (price - info.price) * qty : 0;
      totalProfit += rowProfit;
      if (code) {
        if (!modelProfits[code]) {
          modelProfits[code] = { code: code, name: name || purchaseNames[code] || "—", purchasePrice: info.price, priceSource: info.source, totalQty: 0, totalSales: 0, totalProfit: 0, estimated: false };
        }
        var m = modelProfits[code];
        m.totalQty += qty; m.totalSales += lineTotal; m.totalProfit += rowProfit;
        if (name) m.name = name;
        if (info.price > 0) { m.purchasePrice = info.price; m.priceSource = info.source; }
      }
    }
  });

  // ─── اثر برگشت از فروش و خرید روی داشبورد و سود ───
  var salesReturns = [];
  var purchaseReturns = [];
  try { salesReturns = await getSalesReturns(); } catch {}
  try { purchaseReturns = await getPurchaseReturns(); } catch {}

  // BUSINESS_LOCAL_ONLY — گزینه C: فقط تعدیل منفی روی سود اثر می‌گذارد
  var _adjLoss = 0;
  try {
    var _adjAll = (await getLocal('stock_adjustments')) || [];
    var _adjSeen: Record<string, boolean> = {};
    for (var _ai = 0; _ai < _adjAll.length; _ai++) {
      var _a = _adjAll[_ai];
      var _ak = String(_a.local_id || _a.id || '');
      if (_ak && _adjSeen[_ak]) continue;
      if (_ak) _adjSeen[_ak] = true;
      var _qty = Number(_a.adjustment) || 0;
      if (_qty >= 0) continue; // فقط منفی
      var _cost = Number(_a.unit_cost != null ? _a.unit_cost : (_a.unitCost != null ? _a.unitCost : _a.cost)) || 0;
      if (!_cost) {
        var _code = String(_a.model_code || '').trim();
        if (_code) {
          var _d = parseDateAny(_a.adjustment_date || _a.created_at) || now;
          var _info = findPurchaseForSale(_code, _d.getTime());
          _cost = _info.price || 0;
        }
      }
      if (_cost > 0) _adjLoss += Math.abs(_qty) * _cost;
    }
  } catch {}
  totalProfit -= _adjLoss;

  var customerDebtVar = totalSales - customerPaid;
  var supplierDebtVar = supplierDebt;

  salesReturns.forEach(function(r: any) {
    // BUSINESS_LOCAL_ONLY — فقط برگشت‌های داخل بازه
    var _rDateS = parseDateAny(r.date || r.created_at);
    if (startDate && (!_rDateS || _rDateS < startDate || _rDateS > now)) return;
    var items = r.items || [];
    var subtotal = 0;
    items.forEach(function(it: any) {
      var qty = Number(it.returnQty || it.quantity) || 0;
      var price = Number(it.priceUnit || it.price_unit) || 0;
      subtotal += qty * price;
    });
    if (!subtotal) subtotal = Number(r.subtotal) || 0;
    var settlement = Number(r.settlement_amount) || 0;
    totalSales -= subtotal;
    customerPaid -= settlement;
    customerDebtVar -= (subtotal - settlement);

    var returnDate = parseDateAny(r.date || r.created_at) || now;
    items.forEach(function(it: any) {
      var qty = Number(it.returnQty || it.quantity) || 0;
      if (!qty) return;
      var price = Number(it.priceUnit || it.price_unit) || 0;
      var code = String(it.modelCode || it.model_code || '').trim();
      if (!code) return;
      var info = findPurchaseForSale(code, returnDate.getTime());
      var profitReduction = (info.price > 0 && price > 0) ? (price - info.price) * qty : 0;
      totalProfit -= profitReduction;
      if (!modelProfits[code]) {
        modelProfits[code] = { code: code, name: it.modelName || it.model_name || purchaseNames[code] || '—', purchasePrice: info.price, priceSource: info.source, totalQty: 0, totalSales: 0, totalProfit: 0, estimated: false };
      }
      var m = modelProfits[code];
      m.totalQty -= qty;
      m.totalSales -= qty * price;
      m.totalProfit -= profitReduction;
    });
  });

  purchaseReturns.forEach(function(r: any) {
    // BUSINESS_LOCAL_ONLY — فقط برگشت‌های داخل بازه
    var _rDateP = parseDateAny(r.date || r.created_at);
    if (startDate && (!_rDateP || _rDateP < startDate || _rDateP > now)) return;
    var items = r.items || [];
    var subtotal = 0;
    items.forEach(function(it: any) {
      var qty = Number(it.returnQty || it.quantity) || 0;
      var price = Number(it.priceUnit || it.price_unit) || 0;
      subtotal += qty * price;
    });
    if (!subtotal) subtotal = Number(r.subtotal) || 0;
    var settlement = Number(r.settlement_amount) || 0;
    totalPurchases -= subtotal;
    supplierPaid -= settlement;
    supplierDebtVar -= (subtotal - settlement);
  });

  var models = Object.values(modelProfits);
  var estimatedCount = 0;
  if (filter !== "purchase") {
    models.forEach(function(m) {
      if ((!m.purchasePrice || m.purchasePrice <= 0) && m.totalQty > 0 && m.totalSales > 0) {
        var avgSale = m.totalSales / m.totalQty;
        var estUnit = avgSale * margin;
        m.purchasePrice = avgSale - estUnit;
        var _estProfit = estUnit * m.totalQty;
        m.totalProfit += _estProfit;
        m.priceSource = "estimated";
        m.estimated = true;
        totalProfit += _estProfit;
        estimatedCount++;
      }
    });
  }
  models.sort(function(a, b) { return b.totalProfit - a.totalProfit; });

  return {
    totalSales: totalSales, totalPurchases: totalPurchases, customerPaid: customerPaid,
    customerDebt: customerDebtVar,
    supplierPaid: supplierPaid, supplierDebt: supplierDebtVar,
    profit: totalProfit,
    adjustmentLoss: _adjLoss,
    models: models, estimatedCount: estimatedCount,
    defaultMargin: margin,
    rangeLabel: DASH_LBL[range] || range
  };
}
// ═══════════════════════════════════════════
//  getInventoryByModel — کاردکس مدل (آفلاین + آنلاین + صف)
// ═══════════════════════════════════════════
export async function getInventoryByModel(code: string) {
  await _runInventoryMigration(); // چک کردن مهاجرت
  try {
    const storageModule = require('./lib.storage').default || require('./lib.storage');
    const db = await storageModule.getDb();
    if (db) {
      const p = await db.getAllAsync('SELECT data_json FROM purchases_db WHERE model_code = ?', [code]);
      const s = await db.getAllAsync('SELECT data_json FROM sales_db WHERE model_code = ?', [code]);
      const a = await db.getAllAsync('SELECT data_json FROM adjustments_db WHERE model_code = ?', [code]);
      
      if (p.length > 0 || s.length > 0 || a.length > 0) {
        return {
          purchases: p.map((r: any) => JSON.parse(r.data_json)),
          sales: s.map((r: any) => JSON.parse(r.data_json)),
          salesReturns: [], 
          purchaseReturns: [],
          adjustments: a.map((r: any) => JSON.parse(r.data_json))
        };
      }
    }
  } catch (e) { console.log('Kardex SQLite err:', e); }
  
  // اگر دیتابیس آماده نبود، به روش قبلی (فیلتر کردن) برمی‌گردیم
  const allPurchases = (await getLocal<any[]>('purchases')) || [];
  const allSales = (await getLocal<any[]>('sales')) || [];
  const allAdj = (await getLocal<any[]>('stock_adjustments')) || [];
  return {
    purchases: allPurchases.filter((x: any) => String(x.model_code) === String(code)),
    sales: allSales.filter((x: any) => String(x.model_code) === String(code)),
    salesReturns: [],
    purchaseReturns: [],
    adjustments: allAdj.filter((x: any) => String(x.model_code) === String(code))
  };
}
// ═══════════════════════════════════════════
//  Stock Adjustments (offline + queue)
// ═══════════════════════════════════════════
export async function getStockAdjustments(code?: string) {
  // BUSINESS_LOCAL_ONLY — فقط محلی، بدون Supabase (رفع کندی)
  let list = (await getLocal<any[]>('stock_adjustments')) || [];
  const q = await getQueue();
  const pending: any[] = [];
  for (const item of q) {
    if (item.op === 'createStockAdjustment' && item.payload) pending.push(item.payload);
  }
  // Tombstones — فیلتر تعدیل‌های حذف‌شده
  const _deletedAdj = new Set<string>();
  try {
    const _rawT = await AsyncStorage.getItem('@mizan_tombstones');
    let _arrT: any[] = [];
    try { _arrT = _rawT ? JSON.parse(_rawT) : []; } catch { _arrT = []; }
    if (Array.isArray(_arrT)) {
      for (const _t of _arrT) {
        if (!_t) continue;
        if (String(_t.table || '') !== 'stock_adjustments') continue;
        const _k = String(_t.key || '').trim();
        if (_k) _deletedAdj.add(_k);
      }
    }
  } catch {}
  const _notDeletedAdj = (r: any) => {
    const k1 = String(r.local_id || '').trim();
    const k2 = String(r.id || '').trim();
    if (k1 && _deletedAdj.has(k1)) return false;
    if (k2 && _deletedAdj.has(k2)) return false;
    return true;
  };
  // Dedupe by local_id — جلوگیری از تکرار تعدیل
  const _seen = new Set<string>();
  const _merged: any[] = [];
  for (const r of list) {
    if (!_notDeletedAdj(r)) continue;
    const k = String(r.local_id || r.id || '');
    if (k && !_seen.has(k)) { _seen.add(k); _merged.push(r); }
  }
  for (const r of pending) {
    if (!_notDeletedAdj(r)) continue;
    const k = String(r.local_id || r.id || '');
    if (k && !_seen.has(k)) { _seen.add(k); _merged.push(r); }
  }
  let all = _merged;
  if (code) {
    const c = String(code).trim();
    all = all.filter(function(r: any) { return String(r.model_code || '').trim() === c; });
  }
  return all;
}
export async function createStockAdjustment(p: any) {
  const devA = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowA = new Date().toISOString();
  const item = { ...p, local_id: p.local_id || ('adj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)), created_at: p.created_at || nowA, updated_at: nowA, device_id: devA };
  const list = (await getLocal<any[]>('stock_adjustments')) || [];
  await setLocal('stock_adjustments', [item, ...list]);
  if (await serverBusinessAllowed()) {
    try {
      await lib.createStockAdjustment(item);
        try { await _pushAudit({ type: 'stock_create', table: 'stock_adjustments', key: String(item.local_id || item.id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت تعدیل انبار' }); } catch {}
    }
    catch { await enqueue('createStockAdjustment', item); }
  } else {
    await enqueue('createStockAdjustment', item);
  }
  return item;
}
export async function deleteStockAdjustment(id: string) {
  await recordTombstone('stock_adjustments', String(id));
  const list = (await getLocal<any[]>('stock_adjustments')) || [];
  await setLocal('stock_adjustments', list.filter(function(x: any) { return x.local_id !== id && x.id !== id; }));
  try { await _pushAudit({ type: 'stock_delete', table: 'stock_adjustments', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف تعدیل انبار' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.deleteStockAdjustment(id); }
    catch { await enqueue('deleteStockAdjustment', id); }
  } else {
    await enqueue('deleteStockAdjustment', id);
  }
}
// ═══════════════════════════════════════════
//  Report helpers (offline + queue merge)
// ═══════════════════════════════════════════
export async function getSalesRowsForReport(code: string) {
  const c2 = String(code || '').trim();
  if (!c2) return { customer: [], triang: [] };
  if (MODE === 'online') {
    try {
      const [r1, r2] = await Promise.all([
        lib.supabase.from('sales').select('*').eq('customer_code', c2).order('created_at'),
        lib.supabase.from('sales').select('*').eq('account_holder_code', c2).order('created_at'),
      ]);
      return { customer: r1.data || [], triang: r2.data || [] };
    } catch (e) { console.log('[getSalesRowsForReport] online fail:', e); }
  }
  const cachedSales = (await getLocal<any[]>('sales')) || [];
  const customer = cachedSales.filter(function(r: any) { return r.customer_code === c2; });
  const triang = cachedSales.filter(function(r: any) { return r.account_holder_code === c2; });
  const q = await getQueue();
  for (const item of q) {
    if (item.op !== 'createSale') continue;
    const rows = (item.payload && (item.payload.rows || item.payload.items)) || [];
    for (const r of rows) {
      const row = { ...r, invoice_number: item.payload.invoiceNumber || item.payload.invoice_number || '', customer_name: item.payload.customerName || '', customer_code: item.payload.customerCode || '', customer_phone: item.payload.customerPhone || '', account_holder: item.payload.holderName || '', account_holder_code: item.payload.holderCode || '', date_reg: r.date_reg || item.payload.date || new Date(item.ts || Date.now()).toISOString(), date_factor: r.date_factor || item.payload.date || new Date(item.ts || Date.now()).toISOString() };
      if (row.customer_code === c2) customer.push(row);
      if (row.account_holder_code === c2) triang.push(row);
    }
  }
  return { customer: customer, triang: triang };
}
export async function getPurchasesRowsForReport(code: string) {
  const c2 = String(code || '').trim();
  if (!c2) return { supplier: [] };
  if (MODE === 'online') {
    try {
      const r = await lib.supabase.from('purchases').select('*').eq('supplier_code', c2).order('created_at');
      return { supplier: r.data || [] };
    } catch (e) { console.log('[getPurchasesRowsForReport] online fail:', e); }
  }
  const cached = (await getLocal<any[]>('purchases')) || [];
  const supplier = cached.filter(function(r: any) { return r.supplier_code === c2; });
  const q = await getQueue();
  for (const item of q) {
    if (item.op !== 'createPurchase') continue;
    const rows = (item.payload && (item.payload.rows || item.payload.items)) || [];
    for (const r of rows) {
      const row = { ...r, invoice_number: item.payload.invoiceNumber || item.payload.invoice_number || '', supplier_name: item.payload.supplierName || '', supplier_code: item.payload.supplierCode || '', supplier_phone: item.payload.supplierPhone || '', date_reg: r.date_reg || item.payload.date || new Date(item.ts || Date.now()).toISOString(), date_factor: r.date_factor || item.payload.date || new Date(item.ts || Date.now()).toISOString() };
      if (row.supplier_code === c2) supplier.push(row);
    }
  }
  return { supplier: supplier };
}


// ═══════════════════════════════════════════
//  getLedgerData — ترازنامه یکپارچه با مثلثی
// ═══════════════════════════════════════════
export async function getLedgerData(): Promise<any[]> {
  const _pda = (lib && (lib as any).parseDateAny) ? (lib as any).parseDateAny : function(d: any) { return d ? new Date(d) : null; };
  let allSales: any[] = [];
  let allPurchases: any[] = [];

  // BUSINESS_LOCAL_AND_SHEET_ONLY — دفتر معین فقط محلی + صف

  if (!allSales.length) allSales = (await getLocal<any[]>('sales')) || [];
  if (!allPurchases.length) allPurchases = (await getLocal<any[]>('purchases')) || [];

  // BUSINESS_LOCAL_AND_SHEET_ONLY — اگر داده خام از pull نیامده، از grouped بساز
  try {
    const _salesHave = new Set(allSales.map((s: any) => String(s.invoice_number || '').trim()).filter(Boolean));
    const _sg = (await getLocal<any[]>('sales_grouped')) || [];
    for (const _g of _sg) {
      const _inv = String(_g.invoice || '').trim();
      if (!_inv) continue;
      if (_salesHave.has(_inv)) continue;
      for (const _it of (_g.items || [])) {
        allSales.push({
          invoice_number: _inv,
          customer_code: _g.customerCode || _g.code || '',
          customer_name: _g.name || '',
          customer_phone: _g.phone || '',
          account_holder: _g.holder || _g.account_holder || '',
          account_holder_code: _g.holderCode || _g.account_holder_code || '',
          quantity: Number(_it.quantity) || 0,
          price_unit: Number(_it.priceUnit != null ? _it.priceUnit : _it.price_unit) || 0,
          payment: Number(_it.payment) || 0,
          total: (Number(_it.quantity) || 0) * (Number(_it.priceUnit != null ? _it.priceUnit : _it.price_unit) || 0),
          model_code: _it.modelCode || _it.model_code || '',
          model_name: _it.modelName || _it.model_name || '',
          date_factor: _g.date || '',
          date_reg: _g.date || '',
          manual_invoice: _g.manual || _g.manual_invoice || '',
          bank_name: _g.bank || _g.bank_name || '',
          deposit_date: _g.depositDate || _g.deposit_date || '',
          shipping: _g.shipping || '',
          description: _it.description || '',
        });
      }
    }
  } catch {}

  try {
    const _purchHave = new Set(allPurchases.map((p: any) => String(p.invoice_number || '').trim()).filter(Boolean));
    const _pg = (await getLocal<any[]>('purchases_grouped')) || [];
    for (const _g of _pg) {
      const _inv = String(_g.invoice || '').trim();
      if (!_inv) continue;
      if (_purchHave.has(_inv)) continue;
      for (const _it of (_g.items || [])) {
        allPurchases.push({
          invoice_number: _inv,
          supplier_code: _g.supplierCode || _g.code || '',
          supplier_name: _g.name || '',
          supplier_phone: _g.phone || '',
          account_holder: _g.holder || _g.account_holder || _g.payerName || '',
          payer_code: _g.holderCode || _g.account_holder_code || _g.payerCode || '',
          quantity: Number(_it.quantity) || 0,
          price_unit: Number(_it.priceUnit != null ? _it.priceUnit : _it.price_unit) || 0,
          payment: Number(_it.payment) || 0,
          total: (Number(_it.quantity) || 0) * (Number(_it.priceUnit != null ? _it.priceUnit : _it.price_unit) || 0),
          model_code: _it.modelCode || _it.model_code || '',
          model_name: _it.modelName || _it.model_name || '',
          date_factor: _g.date || '',
          date_reg: _g.date || '',
          manual_invoice: _g.manual || _g.manual_invoice || '',
          bank_name: _g.bank || _g.bank_name || '',
          deposit_date: _g.depositDate || _g.deposit_date || '',
          shipping: _g.shipping || '',
          description: _it.description || '',
        });
      }
    }
  } catch {}

  // BUSINESS_LOCAL_ONLY — Apply tombstones (sales/purchases)
  try {
    const _tombL = await getTombstones();
    const _deadSL = new Set<string>();
    const _deadPL = new Set<string>();
    for (const _t of _tombL) {
      if (String(_t.table || '') === 'sales') _deadSL.add(String(_t.key || '').trim());
      if (String(_t.table || '') === 'purchases') _deadPL.add(String(_t.key || '').trim());
    }
    if (_deadSL.size) allSales = allSales.filter((s: any) => !_deadSL.has(String(s.invoice_number || '').trim()));
    if (_deadPL.size) allPurchases = allPurchases.filter((p: any) => !_deadPL.has(String(p.invoice_number || '').trim()));
  } catch {}

  const q = await getQueue();
  for (const item of q) {
    // حذف آفلاین فروش
    if (item.op === 'deleteSale' && item.payload) {
      const inv = typeof item.payload === 'string' ? item.payload : (item.payload.invoiceNumber || item.payload.invoice_number || '');
      if (inv) allSales = allSales.filter((s: any) => String(s.invoice_number || '') !== inv);
      continue;
    }
    // حذف آفلاین خرید
    if (item.op === 'deletePurchase' && item.payload) {
      const inv = typeof item.payload === 'string' ? item.payload : (item.payload.invoiceNumber || item.payload.invoice_number || '');
      if (inv) allPurchases = allPurchases.filter((p: any) => String(p.invoice_number || '') !== inv);
      continue;
    }
    // ویرایش آفلاین فروش سینک‌شده
    if (item.op === 'updateSale' && item.payload) {
      const inv = item.payload.invoiceNumber || item.payload.invoice_number || '';
      if (!inv) continue;
      const meta = item.payload.meta || {};
      const baseDate = item.payload.invoiceDate || meta.date || new Date(item.ts || Date.now()).toISOString();
      allSales = allSales.filter((s: any) => String(s.invoice_number || '') !== inv);
      for (const r of (item.payload.rows || [])) {
        if (r._deleted) continue;
        const qty = Number(r.quantity) || 0;
        const price = Number(r.priceUnit != null ? r.priceUnit : r.price_unit) || 0;
        allSales.push({
          customer_code: meta.code || '',
          customer_name: meta.name || '',
          customer_phone: meta.phone || '',
          account_holder_code: r.accountHolderCode || '',
          account_holder: r.accountHolder || '',
          quantity: qty,
          price_unit: price,
          payment: Number(r.payment) || 0,
          total: qty * price,
          model_code: r.modelCode || '',
          model_name: r.modelName || '',
          invoice_number: inv,
          manual_invoice: '',
          date_factor: r.dateFactor || r.depositDate || baseDate,
          date_reg: r.dateReg || baseDate,
          bank_name: r.bankName || '',
          deposit_date: r.depositDate || '',
          shipping: meta.shipping || '',
          description: r.description || '',
          payer_code: r.accountHolderCode || '',
          _pending: true,
        });
      }
      continue;
    }
    // ویرایش آفلاین خرید سینک‌شده
    if (item.op === 'updatePurchase' && item.payload) {
      const inv = item.payload.invoiceNumber || item.payload.invoice_number || '';
      if (!inv) continue;
      const meta = item.payload.meta || {};
      const baseDate = item.payload.invoiceDate || meta.date || new Date(item.ts || Date.now()).toISOString();
      allPurchases = allPurchases.filter((p: any) => String(p.invoice_number || '') !== inv);
      for (const r of (item.payload.rows || [])) {
        if (r._deleted) continue;
        const qty = Number(r.quantity) || 0;
        const price = Number(r.priceUnit != null ? r.priceUnit : r.price_unit) || 0;
        allPurchases.push({
          supplier_code: meta.code || '',
          supplier_name: meta.name || '',
          supplier_phone: meta.phone || '',
          quantity: qty,
          price_unit: price,
          payment: Number(r.payment) || 0,
          total: qty * price,
          model_code: r.modelCode || '',
          model_name: r.modelName || '',
          invoice_number: inv,
          manual_invoice: meta.manualInv || '',
          date_factor: r.dateFactor || r.depositDate || baseDate,
          date_reg: r.dateReg || baseDate,
          bank_name: r.bankName || '',
          deposit_date: r.depositDate || '',
          shipping: meta.shipping || '',
          description: r.description || '',
          payer_code: r.payerCode || r.accountHolderCode || '',
          _pending: true,
        });
      }
      continue;
    }
    if (item.op === 'createSale' && item.payload) {
      const inv = item.payload.invoiceNumber || item.payload.invoice_number || item.payload._pendingInvNumber || '';
      if (inv && allSales.some((s: any) => String(s.invoice_number || '') === String(inv))) continue;
      const rows = item.payload.rows || item.payload.items || [];
      const baseDate = item.payload.invoiceDate || item.payload.date || new Date(item.ts || Date.now()).toISOString();
      for (const r of rows) {
        allSales.push({
          customer_code: item.payload.customerCode || item.payload.customer_code || '',
          customer_name: item.payload.customerName || item.payload.customer_name || '',
          customer_phone: item.payload.customerPhone || item.payload.customer_phone || '',
          account_holder_code: item.payload.holderCode || item.payload.account_holder_code || item.payload.receiverCode || r.accountHolderCode || r.account_holder_code || '',
          account_holder: item.payload.holderName || item.payload.account_holder || item.payload.receiverName || r.accountHolder || r.account_holder || '',
          quantity: Number(r.quantity) || 0,
          price_unit: Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0,
          payment: Number(r.payment) || 0,
          total: (Number(r.quantity) || 0) * (Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0),
          model_code: r.model_code || r.modelCode || '',
          model_name: r.model_name || r.modelName || '',
          invoice_number: item.payload.invoiceNumber || item.payload.invoice_number || '',
          manual_invoice: '',
          date_factor: r.date_factor || r.dateFactor || baseDate,
          date_reg: r.date_reg || r.dateReg || baseDate,
          bank_name: item.payload.bank || item.payload.bankName || item.payload.bankAccount || r.bankName || r.bank_name || '',
          deposit_date: item.payload.depositDate || item.payload.paymentDate || r.depositDate || r.deposit_date || '',
          shipping: item.payload.shipping || r.shipping || '',
          description: r.description || '',
          payer_code: item.payload.holderCode || '',
          _pending: true,
        });
      }
    }
    if (item.op === 'createPurchase' && item.payload) {
      const inv = item.payload.invoiceNumber || item.payload.invoice_number || item.payload._pendingInvNumber || '';
      if (inv && allPurchases.some((p: any) => String(p.invoice_number || '') === String(inv))) continue;
      const rows = item.payload.rows || item.payload.items || [];
      const baseDate = item.payload.invoiceDate || item.payload.date || new Date(item.ts || Date.now()).toISOString();
      for (const r of rows) {
        allPurchases.push({
          supplier_code: item.payload.supplierCode || item.payload.supplier_code || '',
          supplier_name: item.payload.supplierName || item.payload.supplier_name || '',
          supplier_phone: item.payload.supplierPhone || item.payload.supplier_phone || '',
          quantity: Number(r.quantity) || 0,
          price_unit: Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0,
          payment: Number(r.payment) || 0,
          total: (Number(r.quantity) || 0) * (Number(r.price_unit != null ? r.price_unit : r.priceUnit) || 0),
          model_code: r.model_code || r.modelCode || '',
          model_name: r.model_name || r.modelName || '',
          invoice_number: item.payload.invoiceNumber || item.payload.invoice_number || '',
          manual_invoice: item.payload.manualInvoice || '',
          date_factor: r.date_factor || r.dateFactor || baseDate,
          date_reg: r.date_reg || r.dateReg || baseDate,
          bank_name: item.payload.bank || item.payload.bankName || item.payload.bankAccount || r.bankName || r.bank_name || '',
          deposit_date: item.payload.depositDate || item.payload.paymentDate || r.depositDate || r.deposit_date || '',
          shipping: item.payload.shipping || r.shipping || '',
          description: r.description || '',
          payer_code: item.payload.payerCode || '',
          _pending: true,
        });
      }
    }
  }

  const normPhone = function(p: any) { return String(p || '').replace(/[^\d]/g, ''); };
  const makeKey = function(name: string, code: string, phone: string): string | null {
    const np = normPhone(phone);
    if (np && np.length >= 7) return 'P:' + np;
    if (code) return 'C:' + String(code).trim();
    if (name) return 'N:' + String(name).trim();
    return null;
  };

  const accounts: Record<string, any> = {};
  const getOrCreate = function(name: string, code: string, phone: string) {
    const key = makeKey(name, code, phone);
    if (!key) return null;
    if (!accounts[key]) accounts[key] = { key: key, names: {}, codes: {}, phones: {}, transactions: [] };
    if (name) accounts[key].names[name] = true;
    if (code) accounts[key].codes[code] = true;
    if (phone) accounts[key].phones[phone] = true;
    return accounts[key];
  }

  const findExistingAccount = function(name: string, code: string) {
    const cn = String(code || '').trim();
    const nm = String(name || '').trim();
    if (cn) {
      for (const k of Object.keys(accounts)) {
        if (accounts[k].codes[cn]) return accounts[k];
      }
    }
    if (nm) {
      for (const k of Object.keys(accounts)) {
        if (accounts[k].names[nm]) return accounts[k];
      }
    }
    return null;
  };;

  allSales.forEach(function(s: any) {
    const code = String(s.customer_code || '').trim();
    const name = String(s.customer_name || '').trim();
    const phone = String(s.customer_phone || '').trim();
    const acc = getOrCreate(name, code, phone);
    if (!acc) return;

    const qty = Number(s.quantity) || 0;
    const price = Number(s.price_unit) || 0;
    const total = Number(s.total) || (qty * price);
    const payment = Number(s.payment) || 0;

    const common = {
      date: s.date_factor || s.date_reg || s.created_at || '',
      invoice: s.invoice_number || '',
      manualInvoice: s.manual_invoice || '',
      modelCode: s.model_code || '',
      modelName: s.model_name || '',
      bank: s.bank_name || '',
      holder: s.account_holder || '',
      holderCode: s.account_holder_code || '',
      depositDate: s.deposit_date || '',
      shipping: s.shipping || '',
      description: s.description || '',
    };

    if (total > 0) {
      acc.transactions.push({ ...common, type: 'sale', qty, priceUnit: price, lineTotal: total, debit: total, credit: 0 });
    }
    if (payment > 0) {
      acc.transactions.push({ ...common, type: 'payment_received', qty: 0, priceUnit: 0, lineTotal: payment, debit: 0, credit: payment, description: 'دریافت وجه' });

      const hCode = String(s.account_holder_code || '').trim();
      const hName = String(s.account_holder || '').trim();
      if (hCode && hCode !== code) {
        const hAcc = getOrCreate(hName, hCode, '');
        if (hAcc) {
          hAcc.transactions.push({
            ...common, type: 'triangular_received', qty: 0, priceUnit: 0, lineTotal: payment, debit: payment, credit: 0,
            description: 'دریافت مثلثی از طرف ' + name,
          });
        }
      }
    }
  });

  allPurchases.forEach(function(p: any) {
    const code = String(p.supplier_code || '').trim();
    const name = String(p.supplier_name || '').trim();
    const phone = String(p.supplier_phone || '').trim();
    const acc = getOrCreate(name, code, phone);
    if (!acc) return;

    const qty = Number(p.quantity) || 0;
    const price = Number(p.price_unit) || 0;
    const total = Number(p.total) || (qty * price);
    const payment = Number(p.payment) || 0;

    const common = {
      date: p.date_factor || p.date_reg || p.created_at || '',
      invoice: p.invoice_number || '',
      manualInvoice: p.manual_invoice || '',
      modelCode: p.model_code || '',
      modelName: p.model_name || '',
      bank: p.bank_name || '',
      holder: p.account_holder || '',
      holderCode: p.payer_code || '',
      depositDate: p.deposit_date || '',
      shipping: p.shipping || '',
      description: p.description || '',
    };

    if (total > 0) {
      acc.transactions.push({ ...common, type: 'purchase', qty, priceUnit: price, lineTotal: total, debit: 0, credit: total });
    }
    if (payment > 0) {
      acc.transactions.push({ ...common, type: 'payment_sent', qty: 0, priceUnit: 0, lineTotal: payment, debit: payment, credit: 0, description: 'پرداخت به تأمین‌کننده' });
    }
  });

  // ─── اثر برگشت از فروش روی دفتر معین: بستانکار مشتری ───
  try {
    const salesReturns = await getSalesReturns();
    for (const r of salesReturns || []) {
      const name = String(r.party_name || '').trim();
      const code = String(r.party_code || '').trim();
      const acc = findExistingAccount(name, code) || getOrCreate(name, code, '');
      if (!acc) continue;
      const total = Number(r.total) || 0;
      if (total <= 0) continue;
      acc.transactions.push({
        date: r.date || r.created_at || '',
        invoice: r.original_invoice_number || '',
        manualInvoice: '',
        modelCode: '',
        modelName: '',
        bank: r.bank || '',
        holder: r.account_holder || '',
        holderCode: '',
        depositDate: r.deposit_date || '',
        shipping: '',
        description: 'برگشت از فروش' + (r.reason ? ' — ' + r.reason : ''),
        type: 'sale_return',
        qty: 0, priceUnit: 0, lineTotal: total,
        debit: 0, credit: total,
      });
    }
  } catch (e) { console.log('[ledger] salesReturns effect fail:', e); }

  // ─── اثر برگشت از خرید روی دفتر معین: بدهکار تأمین‌کننده ───
  try {
    const purchaseReturns = await getPurchaseReturns();
    for (const r of purchaseReturns || []) {
      const name = String(r.party_name || '').trim();
      const code = String(r.party_code || '').trim();
      const acc = findExistingAccount(name, code) || getOrCreate(name, code, '');
      if (!acc) continue;
      const total = Number(r.total) || 0;
      if (total <= 0) continue;
      acc.transactions.push({
        date: r.date || r.created_at || '',
        invoice: r.original_invoice_number || '',
        manualInvoice: '',
        modelCode: '',
        modelName: '',
        bank: r.bank || '',
        holder: r.account_holder || '',
        holderCode: '',
        depositDate: r.deposit_date || '',
        shipping: '',
        description: 'برگشت از خرید' + (r.reason ? ' — ' + r.reason : ''),
        type: 'purchase_return',
        qty: 0, priceUnit: 0, lineTotal: total,
        debit: total, credit: 0,
      });
    }
  } catch (e) { console.log('[ledger] purchaseReturns effect fail:', e); }

  const result: any[] = [];
  const _partnerCodesWithTx = new Set<string>();
  const _partnerNamesWithTx = new Set<string>();
  try {
    const _partnersList = await getPartners();
    for (const _p of _partnersList) {
      const _txns = await getPartnerTransactions(_p.code);
      if (_txns && _txns.length) {
        if (_p.code) _partnerCodesWithTx.add(String(_p.code).trim());
        if (_p.name) _partnerNamesWithTx.add(String(_p.name).trim());
      }
    }
  } catch {}

  Object.keys(accounts).forEach(function(k) {
    const acc = accounts[k];
    let debit = 0, credit = 0;
    acc.transactions.forEach(function(t: any) { debit += (t.debit || 0); credit += (t.credit || 0); });
    const balance = debit - credit;
    const trans = acc.transactions.slice().sort(function(a: any, b: any) {
      const da = _pda(a.date), db = _pda(b.date);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
    let run = 0;
    trans.forEach(function(t: any) { run += (t.debit || 0) - (t.credit || 0); t.runningBalance = run; });
    let hasSale = false;
    let hasPurchase = false;
    trans.forEach(function(t: any) {
      if (t.type === 'sale') hasSale = true;
      if (t.type === 'purchase') hasPurchase = true;
    });
    const typeStr = (hasSale && hasPurchase) ? 'مشتری/تأمین‌کننده' : hasSale ? 'مشتری' : hasPurchase ? 'تأمین‌کننده' : '—';
    const _accCodes = Object.keys(acc.codes).map((x: any) => String(x).trim());
    const _accNames = Object.keys(acc.names).map((x: any) => String(x).trim());
    const _isPartnerWithTx = _accCodes.some((c: string) => _partnerCodesWithTx.has(c)) || _accNames.some((n: string) => _partnerNamesWithTx.has(n));
    if (_isPartnerWithTx) return;
    result.push({
      key: acc.key,
      name: Object.keys(acc.names)[0] || '—',
      code: Object.keys(acc.codes)[0] || '—',
      phone: Object.keys(acc.phones)[0] || '—',
      allNames: Object.keys(acc.names),
      allCodes: Object.keys(acc.codes),
      allPhones: Object.keys(acc.phones),
      transactions: trans,
      totalDebit: debit,
      totalCredit: credit,
      balance: balance,
      type: typeStr,
    });
  });
  // ═══ حساب شرکا در دفتر معین ═══
  // ═══ یک ردیف خلاصه برای هر شریک ═══
  // ═══ یک ردیف خلاصه برای هر شریک ═══
  // ═══ نقشه اسناد مبنا برای غنی‌سازی سطح ۳ ═══
  const _srcMaps: any = { sales: {}, purchases: {}, expenses: {}, salaries: {}, loans: {} };
  (allSales || []).forEach((s: any) => { const k = s.invoice_number || s.invoice; if (k) _srcMaps.sales[k] = s; });
  (allPurchases || []).forEach((p: any) => { const k = p.invoice_number || p.invoice; if (k) _srcMaps.purchases[k] = p; });
  let _allExpenses: any[] = [];
  let _allSalaries: any[] = [];
  let _allLoans: any[] = [];
  try { _allExpenses = await getExpenses(); } catch {}
  try { _allSalaries = await getSalaryPayments(); } catch {}
  try { _allLoans = await getLoans(); } catch {}
  _allExpenses.forEach((e: any) => { const k = e.local_id || e.id || e.invoice_number; if (k) _srcMaps.expenses[k] = e; });
  _allSalaries.forEach((s: any) => { const k = s.local_id || s.id || s.invoice_number; if (k) _srcMaps.salaries[k] = s; });
  _allLoans.forEach((l: any) => { const k = l.local_id || l.id; if (k) _srcMaps.loans[k] = l; });

  function _srcInfo(t: any) {
    const st = String(t.source_type || t.sourceType || '').toLowerCase();
    const sid = String(t.source_id || t.sourceId || t.invoice || '');
    if (!sid) return null;
    if (st === 'sale') {
      const s = _srcMaps.sales[sid]; if (!s) return null;
      return { kind: 'sale', invoice: s.invoice_number || sid, date: s.date_reg || s.date_factor || s.created_at || '', total: Number(s.total_amount || s.total || 0), paid: Number(s.payment || s.paid || 0), balance: Number(s.balance || 0) };
    }
    if (st === 'purchase') {
      const p = _srcMaps.purchases[sid]; if (!p) return null;
      return { kind: 'purchase', invoice: p.invoice_number || sid, date: p.date_reg || p.date_factor || p.created_at || '', total: Number(p.total_amount || p.total || 0), paid: Number(p.payment || p.paid || 0), balance: Number(p.balance || 0) };
    }
    if (st === 'expense') {
      const e = _srcMaps.expenses[sid]; if (!e) return null;
      return { kind: 'expense', invoice: e.invoice_number || sid, date: e.payment_date || e.created_at || '', total: Number(e.amount || 0), paid: Number(e.amount || 0), balance: 0, category: e.category || '', title: e.title || '', receiver: e.receiver_name || '', bank: e.bank || '', method: e.payment_method || '', status: e.status || '' };
    }
    if (st === 'salary') {
      const s = _srcMaps.salaries[sid]; if (!s) return null;
      return { kind: 'salary', invoice: s.invoice_number || sid, date: s.payment_date || s.created_at || '', total: Number(s.net_salary || 0), paid: Number(s.payment || 0), balance: Number(s.balance || 0), employee: s.employee_name || '', month: s.month || '', bank: s.bank || '' };
    }
    if (st === 'loan') {
      const l = _srcMaps.loans[sid]; if (!l) return null;
      return { kind: 'loan', invoice: sid, date: l.date || l.created_at || '', total: Number(l.amount || 0), paid: Number(l.paid || 0), balance: Number(l.balance || 0), employee: l.employee_name || '', installments: Number(l.installments || 0), monthly: Number(l.monthly_amount || 0), status: l.status || '' };
    }
    return null;
  }

  const partnerResult: any[] = [];
  try {
    const partnersList = await getPartners();
    const _partnerTxns = await Promise.all(
      partnersList.map((p: any) => getPartnerTransactions(p.code).catch(() => []))
    );
    for (let _pi = 0; _pi < partnersList.length; _pi++) {
      const p = partnersList[_pi];
      const txns = _partnerTxns[_pi];
      if (!txns || !txns.length) continue;

      let capital = 0, current = 0, drawings = 0;
      let totalCredit = 0, totalDebit = 0;
      const trans: any[] = [];

      txns.forEach(function(t: any) {
        const amt = Math.abs(Number(t.amount) || 0);
        const at = String(t.account_type || 'current');
        const type = String(t.type || '');
        let d = 0, c = 0;
        if (type === 'withdraw' || type === 'transfer_out' || type === 'drawing') d = amt;
        else if (type === 'deposit' || type === 'transfer_in') c = amt;

        if (at === 'capital') capital += (c - d);
        else if (at === 'drawings') drawings += (d - c);
        else current += (c - d);

        totalDebit += d;
        totalCredit += c;

        const descParts = [];
        if (t.note) descParts.push(String(t.note));
        if (t.counterpart_type) descParts.push('طرف: ' + t.counterpart_type + (t.counterpart_code ? ' (' + t.counterpart_code + ')' : ''));
        if (t.exchange_rate && Number(t.exchange_rate) !== 1) descParts.push('نرخ: ' + t.exchange_rate);

        trans.push({
          date: t.transaction_date || t.created_at || '',
          invoice: t.invoice_number || '',
          manualInvoice: '',
          modelCode: '',
          modelName: '',
          bank: t.bank_account_local_id ? ('کارت ' + t.bank_account_local_id) : '',
          holder: t.partner_name || p.name || '',
          holderCode: t.partner_code || p.code || '',
          depositDate: '',
          shipping: '',
          description: descParts.join(' | '),
          type: 'partner_' + type,
          accountType: at,
          counterpartType: t.counterpart_type || '',
          counterpartCode: t.counterpart_code || '',
          sourceType: t.source_type || '',
          sourceId: t.source_id || '',
          sourceInfo: _srcInfo(t),
          qty: 0,
          priceUnit: 0,
          lineTotal: amt,
          debit: d,
          credit: c,
        });
      });

      trans.sort(function(a: any, b: any) {
        const da = _pda(a.date), db = _pda(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
      let run = 0;
      trans.forEach(function(t: any) { run += (t.credit || 0) - (t.debit || 0); t.runningBalance = run; });

      const balance = totalCredit - totalDebit; // مثبت = شرکت بدهکار به شریک، منفی = شریک بدهکار به شرکت

      partnerResult.push({
        key: 'PARTNER:' + (p.code || p.name),
        name: p.name || '—',
        code: p.code || '—',
        phone: p.phone || '—',
        allNames: [p.name || '—'],
        allCodes: [p.code || '—'],
        allPhones: [p.phone || '—'],
        transactions: trans,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        balance: balance,
        capital: capital,
        current: current,
        drawings: drawings,
        type: 'شریک',
      });
    }
  } catch (e) { console.log('[getLedgerData] partners fail:', e); }

  // ═══ هزینه‌ها: یک ردیف برای هر دسته هزینه ═══
  const expenseResult: any[] = [];
  try {
    const expenses = await getExpenses();
    const groups: Record<string, any[]> = {};
    (expenses || []).forEach((e: any) => {
      const cat = String(e.category || e.type || 'متفرقه').trim() || 'متفرقه';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    for (const cat of Object.keys(groups)) {
      const list = groups[cat];
      let debit = 0, credit = 0;
      const trans: any[] = [];
      list.forEach((e: any) => {
        const amt = Math.abs(Number(e.amount) || 0);
        if (!amt) return;
        const date = e.date || e.created_at || '';
        const inv = e.invoice_number || e.local_id || '';
        const code = e.receiver_code || '';
        const title = e.title || '';
        const recv = e.receiver_name || '';
        const desc = 'هزینه ' + cat + (title ? ': ' + title : '') + (recv ? ' - به ' + recv : '');
        credit += amt;
        trans.push({
          date, invoice: inv, manualInvoice: '', modelCode: '', modelName: '',
          bank: e.bank || '', holder: cat, holderCode: code, depositDate: '', shipping: '',
          description: desc, type: 'expense', accountType: '',
          counterpartType: 'expense', counterpartCode: code,
          sourceType: 'expense', sourceId: e.local_id || '',
          qty: 0, priceUnit: 0, lineTotal: amt, debit: 0, credit: amt,
        });
      });
      trans.sort((a: any, b: any) => {
        const da = _pda(a.date), db = _pda(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
      let run = 0;
      trans.forEach((t: any) => { run += (t.debit || 0) - (t.credit || 0); t.runningBalance = run; });
      expenseResult.push({
        key: 'EXPENSE_CAT:' + cat,
        name: cat,
        code: '—',
        phone: '—',
        allNames: [cat],
        allCodes: ['—'],
        allPhones: ['—'],
        transactions: trans,
        totalDebit: debit,
        totalCredit: credit,
        balance: debit - credit,
        type: 'هزینه‌گیرنده',
        kind: 'expense_category',
      });
    }
  } catch (e) { console.log('[getLedgerData] expenses fail:', e); }

  // ═══ کارمندان: حقوق + وام، یک ردیف برای هر کارمند ═══
  const employeeResult: any[] = [];
  try {
    const salaries = await getSalaryPayments();
    const loans = await getLoans();
    const groups: Record<string, { name: string; code: string; txns: any[] }> = {};
    const ensure = (name: string, code: string) => {
      const key = code || name || 'UNKNOWN';
      if (!groups[key]) groups[key] = { name: name || 'کارمند نامشخص', code: code || '—', txns: [] };
      return groups[key];
    };

    (salaries || []).forEach((s: any) => {
      const nm = String(s.employee_name || s.employee_code || 'کارمند نامشخص').trim();
      const code = String(s.employee_code || '').trim();
      const g = ensure(nm, code);
      const net = Math.abs(Number(s.net_salary) || 0);
      const paid = Math.abs(Number(s.payment) || 0);
      const date = s.payment_date || s.created_at || '';
      const inv = s.local_id || s.id || '';
      const month = s.month || '';
      if (net > 0) {
        g.txns.push({
          date, invoice: inv, manualInvoice: '', modelCode: '', modelName: '',
          bank: s.bank || '', holder: nm, holderCode: code, depositDate: '', shipping: '',
          description: 'حقوق ' + nm + (month ? ' - ماه ' + month : ''),
          type: 'salary', accountType: '', counterpartType: 'employee', counterpartCode: code,
          sourceType: 'salary', sourceId: inv, qty: 0, priceUnit: 0, lineTotal: net, debit: 0, credit: net,
        });
      }
      if (paid > 0) {
        g.txns.push({
          date, invoice: inv, manualInvoice: '', modelCode: '', modelName: '',
          bank: s.bank || '', holder: nm, holderCode: code, depositDate: '', shipping: '',
          description: 'پرداخت حقوق ' + nm + (month ? ' - ماه ' + month : ''),
          type: 'salary_payment', accountType: '', counterpartType: 'employee', counterpartCode: code,
          sourceType: 'salary', sourceId: inv, qty: 0, priceUnit: 0, lineTotal: paid, debit: paid, credit: 0,
        });
      }
    });

    (loans || []).forEach((l: any) => {
      const nm = String(l.employee_name || l.employee_code || 'کارمند نامشخص').trim();
      const code = String(l.employee_code || '').trim();
      const g = ensure(nm, code);
      const amt = Math.abs(Number(l.amount) || 0);
      const paid = Math.abs(Number(l.paid) || 0);
      const date = l.date || l.created_at || '';
      const inv = l.local_id || l.id || '';
      if (amt > 0) {
        g.txns.push({
          date, invoice: inv, manualInvoice: '', modelCode: '', modelName: '',
          bank: l.bank || '', holder: nm, holderCode: code, depositDate: '', shipping: '',
          description: 'وام به ' + nm,
          type: 'loan', accountType: '', counterpartType: 'employee', counterpartCode: code,
          sourceType: 'loan', sourceId: inv, qty: 0, priceUnit: 0, lineTotal: amt, debit: amt, credit: 0,
        });
      }
      if (paid > 0) {
        g.txns.push({
          date, invoice: inv, manualInvoice: '', modelCode: '', modelName: '',
          bank: l.bank || '', holder: nm, holderCode: code, depositDate: '', shipping: '',
          description: 'بازپرداخت وام ' + nm,
          type: 'loan_payment', accountType: '', counterpartType: 'employee', counterpartCode: code,
          sourceType: 'loan', sourceId: inv, qty: 0, priceUnit: 0, lineTotal: paid, debit: 0, credit: paid,
        });
      }
    });

    for (const key of Object.keys(groups)) {
      const g = groups[key];
      let debit = 0, credit = 0;
      g.txns.sort((a: any, b: any) => {
        const da = _pda(a.date), db = _pda(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
      let run = 0;
      g.txns.forEach((t: any) => {
        debit += t.debit || 0;
        credit += t.credit || 0;
        run += (t.debit || 0) - (t.credit || 0);
        t.runningBalance = run;
      });
      employeeResult.push({
        key: 'EMPLOYEE:' + key,
        name: g.name,
        code: g.code,
        phone: '—',
        allNames: [g.name],
        allCodes: [g.code],
        allPhones: ['—'],
        transactions: g.txns,
        totalDebit: debit,
        totalCredit: credit,
        balance: debit - credit,
        type: 'کارمند',
      });
    }
  } catch (e) { console.log('[getLedgerData] salary/loan fail:', e); }

  const combined = result.concat(partnerResult, expenseResult, employeeResult);
  return combined.sort(function(a: any, b: any) { return Math.abs(b.balance) - Math.abs(a.balance); });
}

// ═══════════════════════════════════════════
//  Parties — آفلاین + صف
// ═══════════════════════════════════════════
export async function getParties(type?: string) {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — طرف‌حساب‌ها فقط محلی + صف
  const list = (await getLocal<any[]>('parties')) || [];
  const q = await getQueue();
  const result = [...list];
  for (const item of q) {
    if (item.op === 'createParty') {
      const lid = String(item.payload?.local_id || '');
      if (lid && result.some((x: any) => String(x.local_id || '') === lid)) continue;
      result.push(item.payload);
    } else if (item.op === 'updateParty') {
      const id = item.payload.local_id || item.payload.id;
      const idx = result.findIndex((x: any) => x.local_id === id || x.id === id);
      if (idx >= 0) result[idx] = { ...result[idx], ...item.payload };
    } else if (item.op === 'deleteParty') {
      const id = item.payload.local_id || item.payload.id || item.payload;
      const filtered = result.filter((x: any) => x.local_id !== id && x.id !== id);
      result.length = 0;
      result.push(...filtered);
    }
  }
  let out = result;
  if (type) out = out.filter((x: any) => x.type === type || x.type === 'both');
  return _applyTombstones('parties', out.sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''))));
}

export async function createParty(p: any) {
  const item = {
    ...p,
    local_id: p.local_id || ('party_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
    created_at: p.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '',
  };
  const list = (await getLocal<any[]>('parties')) || [];
  await setLocal('parties', [item, ...list]);
  try { await _pushAudit({ type: 'party_create', table: 'parties', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت طرف‌حساب' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      await lib.createParty(item);
        try { await _pushAudit({ type: 'party_create', table: 'parties', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت طرف‌حساب' }); } catch {}
    }
    catch { await enqueue('createParty', item); }
  } else {
    await enqueue('createParty', item);
  }
  return item;
}

export async function updateParty(idOrPayload: any, pArg?: any) {
  const payload: any = pArg ? { ...pArg } : { ...idOrPayload };
  const id = typeof idOrPayload === 'string' ? idOrPayload : (payload.local_id || payload.id);
  if (!id) throw new Error('شناسه طرف‌حساب لازم است');
  await recordTombstone('parties', String(id));
  const list = (await getLocal<any[]>('parties')) || [];
  const idx = list.findIndex((x: any) => x.local_id === id || x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '' };
    await setLocal('parties', list);
  }
  try { await _pushAudit({ type: 'party_update', table: 'parties', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ویرایش طرف‌حساب' }); } catch {}
  const q = await getQueue();
  const pendingCreate = q.find((it: any) => it.op === 'createParty' && (it.payload?.local_id === id || it.payload?.id === id));
  if (pendingCreate) {
    pendingCreate.payload = { ...pendingCreate.payload, ...payload };
    await AsyncStorage.setItem(QUEUE, JSON.stringify(q));
    return pendingCreate.payload;
  }
  const item = { ...payload, local_id: payload.local_id || id };
  if (await serverBusinessAllowed()) {
    try { await lib.updateParty(id, item); }
    catch { await enqueue('updateParty', item); }
  } else {
    await enqueue('updateParty', item);
  }
  return item;
}

export async function deleteParty(idOrPayload: any) {
  const id = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload?.local_id || idOrPayload?.id);
  if (!id) throw new Error('شناسه طرف‌حساب لازم است');
  const _list = (await getLocal<any[]>('parties')) || [];
  const _target = _list.find((x: any) => x.local_id === id || x.id === id);
  const _meta = _target ? { phone: String(_target.phone || '').replace(/[^0-9]/g, ''), code: String(_target.code || '').trim(), name: String(_target.name || '').trim() } : undefined;
  await recordTombstone('parties', String(id), _meta);
  try { _invalidateDeletedPartiesCache(); } catch {}
  const list = _list;
  await setLocal('parties', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await _pushAudit({ type: 'party_delete', table: 'parties', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف طرف‌حساب' }); } catch {}
  const q = await getQueue();
  const pendingCreate = q.some((it: any) => it.op === 'createParty' && (it.payload?.local_id === id || it.payload?.id === id));
  if (pendingCreate) {
    const newQ = q.filter((it: any) => !(it.op === 'createParty' && (it.payload?.local_id === id || it.payload?.id === id)));
    await AsyncStorage.setItem(QUEUE, JSON.stringify(newQ));
    return;
  }
  if (await serverBusinessAllowed()) {
    try { await lib.deleteParty(id); }
    catch { await enqueue('deleteParty', { local_id: id, id }); }
  } else {
    await enqueue('deleteParty', { local_id: id, id });
  }
}

export async function lookupPartyByPhone(phone: string) {
  if (MODE === 'online') {
    try { const r = await lib.lookupPartyByPhone(phone); if (r) return r; } catch {}
  }
  const list = await getParties();
  const p = String(phone || '').replace(/[^0-9]/g, '');
  return list.find((x: any) => String(x.phone || '').replace(/[^0-9]/g, '') === p) || null;
}

export async function lookupPartyByName(name: string) {
  if (MODE === 'online') {
    try { const r = await lib.lookupPartyByName(name); if (r) return r; } catch {}
  }
  const list = await getParties();
  const n = String(name || '').trim();
  return list.find((x: any) => String(x.name || '').trim() === n) || null;
}
// ═══════════════════════════════════════════
//  پیشنهاد کد خودکار طرف‌حساب و کالا
// ═══════════════════════════════════════════
function _normPhone(p: any) { return String(p || '').replace(/[^0-9]/g, ''); }





export async function suggestProductCode() {
  const list = await getProducts();
  if (!list.length) return '';
  const codes = list.map((x: any) => String(x.code || '')).filter(Boolean);
  let best: any = null;
  codes.forEach((c: string) => {
    const m = c.match(/^(.*?)(\d+)$/);
    if (m) {
      const n = parseInt(m[2], 10);
      if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length };
    }
  });
  if (best) {
    const next = best.n + 1;
    return best.prefix + String(next).padStart(best.width, '0');
  }
  const last = codes[codes.length - 1];
  return last ? last + '-2' : '';
}

// ═══════════════════════════════════════════
//  پیشنهاد کد خودکار طرف‌حساب (افزایشی + تلفن تکراری)
// ═══════════════════════════════════════════
function _nextCode(codes: any[], prefix: string, start: number) {
  let max = start - 1;
  let width = 3;
  (codes || []).forEach((c: any) => {
    const s = String(c || '');
    if (s.startsWith(prefix)) {
      const rest = s.slice(prefix.length);
      if (/^\d+$/.test(rest)) {
        const n = parseInt(rest, 10);
        if (n > max) { max = n; width = Math.max(width, rest.length); }
      }
    }
  });
  return prefix + String(max + 1).padStart(width, '0');
}

export async function suggestPartyCode(type: string, phone: string) {
  const p = _normPhone(phone);
  const list = await getParties();
  // ۱. اگر تلفن تکراری بود، کد قبلی برگردانده شود
  const existing = p ? list.find((x: any) => _normPhone(x.phone) === p) : null;
  if (existing && existing.code) return { code: existing.code, exists: true, party: existing };
  // ۲. اگر تلفن جدید بود، از آخرین کد عددی یکی اضافه شود
  const codes = list.map((x: any) => String(x.code || '')).filter(Boolean);
  let best: any = null;
  codes.forEach((c: string) => {
    const m = c.match(/^(.*?)(\d+)$/);
    if (m) {
      const n = parseInt(m[2], 10);
      if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length };
    }
  });
  if (best) {
    const next = best.n + 1;
    return { code: best.prefix + String(next).padStart(best.width, '0'), exists: false };
  }
  // ۳. اگر هیچ کد عددی وجود نداشت، خالی برگردانده شود تا کاربر اولی را دستی بزند
  return { code: '', exists: false };
}

// ═══════════════════════════════════════════
//  Partners Offline Wrappers
// ═══════════════════════════════════════════
export async function getPartners() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — شرکا فقط محلی
  const list = (await getLocal<any[]>('partners')) || [];
  const q = await getQueue();
  const result = [...list];
  for (const item of q) {
    if (item.op === 'createPartner') { const lid = String(item.payload?.local_id || ''); if (!lid || !result.some((x: any) => String(x.local_id || '') === lid)) result.push(item.payload); }
    else if (item.op === 'updatePartner') {
      const idx = result.findIndex((x: any) => x.local_id === item.payload.local_id || x.id === item.payload.id);
      if (idx >= 0) result[idx] = { ...result[idx], ...item.payload };
    } else if (item.op === 'deletePartner') {
      const idx = result.findIndex((x: any) => x.local_id === item.payload || x.id === item.payload);
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return _applyTombstones('partners', result.sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''))));
}
export async function createPartner(p: any) {
  const devPt = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowPt = new Date().toISOString();
  const item = { ...p, local_id: p.local_id || ('pt_' + Date.now()), created_at: nowPt, updated_at: nowPt, device_id: devPt };
  const list = (await getLocal<any[]>('partners')) || [];
  await setLocal('partners', [...list, item]);
  try { await _pushAudit({ type: 'partner_create', table: 'partners', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت شریک' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      await lib.createPartner(item);
        try { await _pushAudit({ type: 'partner_create', table: 'partners', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت شریک' }); } catch {}
    } catch { await enqueue('createPartner', item); }
  }
  else { await enqueue('createPartner', item); }
  return item;
}
export async function updatePartner(id: string, p: any) {
  const item = { ...p, local_id: p.local_id || id };
  const list = (await getLocal<any[]>('partners')) || [];
  const idx = list.findIndex((x: any) => x.local_id === id || x.id === id);
  const old = idx >= 0 ? list[idx] : null;
  const oldCode = String(old?.code || '').trim();
  const newCode = String(item.code || oldCode).trim();
  const localId = String(item.local_id || old?.local_id || old?.id || id);

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...item, code: newCode, local_id: localId, updated_at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '' };
    await setLocal('partners', list);
  }

  if (oldCode && newCode && oldCode !== newCode) {
    for (const prefix of ['ptx_', 'pba_']) {
      const oldKey = prefix + oldCode;
      const newKey = prefix + newCode;
      const oldRows = (await getLocal<any[]>(oldKey)) || [];
      const newRows = (await getLocal<any[]>(newKey)) || [];
      const migrated = oldRows.map((r: any) => ({ ...r, partner_code: newCode, partner_local_id: localId, updated_at: new Date().toISOString() }));
      const map: Record<string, any> = {};
      for (const r of newRows) map[String(r.local_id || r.id || JSON.stringify(r))] = r;
      for (const r of migrated) map[String(r.local_id || r.id || JSON.stringify(r))] = r;
      await setLocal(oldKey, []);
      await setLocal(newKey, Object.values(map));
      for (const r of migrated) {
        await enqueue(prefix === 'ptx_' ? 'createPTX' : 'createPBA', r);
      }
    }
  }

  try { await _pushAudit({ type: 'partner_update', table: 'partners', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ویرایش شریک' }); } catch {}
  if (await serverBusinessAllowed()) { try { await lib.updatePartner(id, item); } catch { await enqueue('updatePartner', item); } }
  else { await enqueue('updatePartner', item); }
  return item;
}
export async function deletePartner(id: string) {
  await recordTombstone('partners', String(id));
  const list = (await getLocal<any[]>('partners')) || [];
  await setLocal('partners', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await _pushAudit({ type: 'partner_delete', table: 'partners', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف شریک' }); } catch {}
  if (await serverBusinessAllowed()) { try { await lib.deletePartner(id); } catch { await enqueue('deletePartner', id); } }
  else { await enqueue('deletePartner', id); }
}

async function _resolvePartnerLocalId(code: string): Promise<string> {
  const c = String(code || '').trim();
  if (!c) return '';
  const list = (await getLocal<any[]>('partners')) || [];
  const found = list.find((p: any) => String(p.code || '').trim() === c);
  if (found && (found.local_id || found.id)) return String(found.local_id || found.id);
  const q = await getQueue();
  for (const item of q) {
    if (item.op === 'createPartner' && String(item.payload?.code || '').trim() === c) {
      return String(item.payload?.local_id || item.payload?.id || '');
    }
  }
  return '';
}

async function _readPartnerKeyUnion(prefix: string, code: string): Promise<any[]> {
  const result: any[] = [];
  const seen = new Set<string>();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const target = '_local_' + prefix + code;
    for (const k of allKeys) {
      if (k === '@mizan_local_' + prefix + code || k.includes(target)) {
        const v = await AsyncStorage.getItem(k);
        if (v) {
          try {
            const arr = JSON.parse(v);
            if (Array.isArray(arr)) {
              for (const x of arr) {
                const id = String(x.local_id || x.id || '');
                if (!id || !seen.has(id)) {
                  result.push(x);
                  if (id) seen.add(id);
                }
              }
            }
          } catch {}
        }
      }
    }
  } catch {}
  return result;
}

export async function getPartnerBankAccounts(partnerCode: string) {
  const code = String(partnerCode || '').trim();
  const result = await _readPartnerKeyUnion('pba_', code);
  const seen = new Set<string>(result.map((x: any) => String(x.local_id || x.id || '')));

  const q = await getQueue();
  for (const item of q) {
    if (item.op === 'createPBA' && String(item.payload?.partner_code || '').trim() === code) {
      const k = String(item.payload?.local_id || item.payload?.id || '');
      if (!k || !seen.has(k)) { result.push(item.payload); if (k) seen.add(k); }
    } else if (item.op === 'deletePBA') {
      const idx = result.findIndex((x: any) => x.local_id === item.payload || x.id === item.payload);
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return _applyTombstones('partner_bank_accounts', result);
}
export async function createPartnerBankAccount(p: any) {
  const code = String(p.partner_code || '').trim();
  const localId = String(p.partner_local_id || '') || await _resolvePartnerLocalId(code);
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const now = new Date().toISOString();
  const item = { ...p, partner_code: code, partner_local_id: localId, local_id: p.local_id || ('pba_' + Date.now()), created_at: p.created_at || now, updated_at: now, device_id: dev };
  const list = (await getLocal<any[]>('pba_' + code)) || [];
  await setLocal('pba_' + code, [...list, item]);
  try { await _pushAudit({ type: 'pba_create', table: 'partner_bank_accounts', key: String(item.local_id), at: now, device_id: dev, summary: 'ثبت بانک شریک' }); } catch {}
  await enqueue('createPBA', item);
  return item;
}
export async function deletePartnerBankAccount(id: string, partnerCode: string) {
  await recordTombstone('partner_bank_accounts', String(id));
  const list = (await getLocal<any[]>('pba_' + partnerCode)) || [];
  await setLocal('pba_' + partnerCode, list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await _pushAudit({ type: 'pba_delete', table: 'partner_bank_accounts', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف بانک شریک' }); } catch {}
  await enqueue('deletePBA', id);
}

export async function getPartnerTransactions(partnerCode: string) {
  const code = String(partnerCode || '').trim();
  const result = await _readPartnerKeyUnion('ptx_', code);
  const seen = new Set<string>(result.map((x: any) => String(x.local_id || x.id || '')));

  const q = await getQueue();
  for (const item of q) {
    if (item.op === 'createPTX' && String(item.payload?.partner_code || '').trim() === code) {
      const k = String(item.payload?.local_id || item.payload?.id || '');
      if (!k || !seen.has(k)) { result.push(item.payload); if (k) seen.add(k); }
    } else if (item.op === 'deletePTX') {
      const idx = result.findIndex((x: any) => x.local_id === item.payload || x.id === item.payload);
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return _applyTombstones('partner_transactions', result.sort((a, b) => String(a.transaction_date || '').localeCompare(String(b.transaction_date || ''))));
}
export async function createPartnerTransaction(p: any) {
  const code = String(p.partner_code || '').trim();
  const localId = String(p.partner_local_id || '') || await _resolvePartnerLocalId(code);
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const now = new Date().toISOString();
  const item = { ...p, partner_code: code, partner_local_id: localId, local_id: p.local_id || ('ptx_' + Date.now()), created_at: p.created_at || now, updated_at: now, device_id: dev };
  const list = (await getLocal<any[]>('ptx_' + code)) || [];
  await setLocal('ptx_' + code, [...list, item]);
  try { await _pushAudit({ type: 'ptx_create', table: 'partner_transactions', key: String(item.local_id), at: now, device_id: dev, summary: 'ثبت سرمایه شریک' }); } catch {}
  await enqueue('createPTX', item);
  return item;
}
export async function deletePartnerTransaction(id: string, partnerCode: string) {
  await recordTombstone('partner_transactions', String(id));
  const list = (await getLocal<any[]>('ptx_' + partnerCode)) || [];
  await setLocal('ptx_' + partnerCode, list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await _pushAudit({ type: 'ptx_delete', table: 'partner_transactions', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف سرمایه شریک' }); } catch {}
  await enqueue('deletePTX', id);
}
// ═══════════════════════════════════════════
//  Banks Offline
// ═══════════════════════════════════════════
export async function getBanks() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — بانک‌ها فقط محلی
  const list = (await getLocal<any[]>('banks')) || [];
  const q = await getQueue();
  const result = [...list];
  for (const item of q) {
    if (item.op === 'createBank') { const lid = String(item.payload?.local_id || ''); if (!lid || !result.some((x: any) => String(x.local_id || '') === lid)) result.push(item.payload); }
    else if (item.op === 'deleteBank') {
      const idx = result.findIndex((x: any) => x.local_id === item.payload);
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return _applyTombstones('banks', result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
}
export async function createBank(p: any) {
  const devB = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowB = new Date().toISOString();
  const item = { ...p, local_id: p.local_id || ('bank_' + Date.now()), created_at: nowB, updated_at: nowB, device_id: devB };
  const list = (await getLocal<any[]>('banks')) || [];
  await setLocal('banks', [...list, item]);
  try { await _pushAudit({ type: 'bank_create', table: 'banks', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت بانک' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      await lib.createBank(item);
        try { await _pushAudit({ type: 'bank_create', table: 'banks', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت بانک' }); } catch {}
    } catch { await enqueue('createBank', item); }
  }
  else { await enqueue('createBank', item); }
  return item;
}
export async function updateBank(id: string, p: any) {
  const item = { ...p, local_id: p.local_id || id };
  const list = (await getLocal<any[]>('banks')) || [];
  const idx = list.findIndex((x: any) => x.local_id === id || x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...item, updated_at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '' };
    await setLocal('banks', list);
  }
  try { await _pushAudit({ type: 'bank_update', table: 'banks', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ویرایش بانک' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.updateBank(id, item); }
    catch { await enqueue('updateBank', item); }
  } else {
    await enqueue('updateBank', item);
  }
  return item;
}

export async function deleteBank(id: string) {
  await recordTombstone('banks', String(id));
  const list = (await getLocal<any[]>('banks')) || [];
  await setLocal('banks', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await _pushAudit({ type: 'bank_delete', table: 'banks', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف بانک' }); } catch {}
  if (await serverBusinessAllowed()) { try { await lib.deleteBank(id); } catch { await enqueue('deleteBank', id); } }
  else { await enqueue('deleteBank', id); }
}

// ═══════════════════════════════════════════
//  Shippings Offline
// ═══════════════════════════════════════════
export async function getShippings() {
  // BUSINESS_LOCAL_AND_SHEET_ONLY — باربری‌ها فقط محلی
  const list = (await getLocal<any[]>('shippings')) || [];
  const q = await getQueue();
  const result = [...list];
  for (const item of q) {
    if (item.op === 'createShipping') {
      const lid = String(item.payload?.local_id || '');
      if (lid && result.some((x: any) => String(x.local_id || '') === lid)) continue;
      result.push(item.payload);
    } else if (item.op === 'deleteShipping') {
      const idx = result.findIndex((x: any) => x.local_id === item.payload);
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return _applyTombstones('shippings', result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
}
export async function createShipping(p: any) {
  const devS = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const nowS = new Date().toISOString();
  const item = { ...p, local_id: p.local_id || ('ship_' + Date.now()), created_at: nowS, updated_at: nowS, device_id: devS };
  const list = (await getLocal<any[]>('shippings')) || [];
  await setLocal('shippings', [...list, item]);
  try { await _pushAudit({ type: 'shipping_create', table: 'shippings', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت باربری' }); } catch {}
  if (await serverBusinessAllowed()) {
    try {
      await lib.createShipping(item);
        try { await _pushAudit({ type: 'shipping_create', table: 'shippings', key: String(item.local_id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ثبت باربری' }); } catch {}
    } catch { await enqueue('createShipping', item); }
  }
  else { await enqueue('createShipping', item); }
  return item;
}
export async function updateShipping(id: string, p: any) {
  const item = { ...p, local_id: p.local_id || id };
  const list = (await getLocal<any[]>('shippings')) || [];
  const idx = list.findIndex((x: any) => x.local_id === id || x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...item, updated_at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '' };
    await setLocal('shippings', list);
  }
  try { await _pushAudit({ type: 'shipping_update', table: 'shippings', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'ویرایش باربری' }); } catch {}
  if (await serverBusinessAllowed()) {
    try { await lib.updateShipping(id, item); }
    catch { await enqueue('updateShipping', item); }
  } else {
    await enqueue('updateShipping', item);
  }
  return item;
}

export async function deleteShipping(id: string) {
  await recordTombstone('shippings', String(id));
  const list = (await getLocal<any[]>('shippings')) || [];
  await setLocal('shippings', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await _pushAudit({ type: 'shipping_delete', table: 'shippings', key: String(id), at: new Date().toISOString(), device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '', summary: 'حذف باربری' }); } catch {}
  if (await serverBusinessAllowed()) { try { await lib.deleteShipping(id); } catch { await enqueue('deleteShipping', id); } }
  else { await enqueue('deleteShipping', id); }
}
// ═══════════════════════════════════════════
//  Universal Payer Lookup — طرف‌حساب‌ها + شرکا
// ═══════════════════════════════════════════
export async function lookupPayerUniversal(name: string) {
  const n = String(name || '').trim();
  if (!n) return null;

  // ۱. طرف‌حساب‌ها
  try {
    const parties = await getParties();
    const party = parties.find((x: any) => String(x.name || '').trim() === n);
    if (party) return { name: party.name, code: party.code, bank: '', account: '', source: 'parties' };
  } catch {}

  // ۲. شرکا
  try {
    const partners = await getPartners();
    const partner = partners.find((x: any) => String(x.name || '').trim() === n);
    if (partner) {
      let bank = '';
      let account = '';
      try {
        const banks = await getPartnerBankAccounts(partner.code);
        const b = banks && banks.length > 0 ? banks[0] : null;
        if (b) { bank = b.bank_name || ''; account = b.account_number || ''; }
      } catch {}
      return { name: partner.name, code: partner.code, bank, account, source: 'partners' };
    }
  } catch {}

  return null;
}
// ═══════════════════════════════════════════
//  Offline updateSale / updatePurchase
// ═══════════════════════════════════════════
const AUDIT_KEY = '@mizan_audit_events';
const AUDIT_MAX = 500;

async function _pushAudit(ev: any) {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const id = ev.id || ('aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const item = { ...ev, id };
    const nowMs = Date.now();
    const dedup = arr.some((x: any) => {
      if (!x || x.type !== item.type || String(x.key) !== String(item.key)) return false;
      const t = Date.parse(String(x.at || ''));
      return !isNaN(t) && (nowMs - t) < 5000;
    });
    if (!dedup) arr.push(item);
    if (arr.length > AUDIT_MAX) arr = arr.slice(arr.length - AUDIT_MAX);
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(arr));
  } catch {}
}

function _itemKey(r: any): string {
  return String(r?.model_code || r?.modelCode || '') + '|' + String(r?.shelf || '');
}

function _itemQty(r: any): number {
  return Number(r?.quantity) || 0;
}

function _itemPrice(r: any): number {
  return Number(r?.price_unit ?? r?.priceUnit) || 0;
}

function _diffInvoiceRows(oldRows: any[], newRows: any[]) {
  const oldMap = new Map<string, any>();
  const newMap = new Map<string, any>();
  for (const r of oldRows || []) oldMap.set(_itemKey(r), r);
  for (const r of newRows || []) newMap.set(_itemKey(r), r);
  const added: any[] = [];
  const removed: any[] = [];
  const changed: any[] = [];
  for (const [k, nr] of Array.from(newMap.entries())) {
    if (!oldMap.has(k)) { added.push({ key: k, qty: _itemQty(nr), price: _itemPrice(nr) }); continue; }
    const or = oldMap.get(k);
    const oq = _itemQty(or), nq = _itemQty(nr);
    const op = _itemPrice(or), np = _itemPrice(nr);
    if (oq !== nq || op !== np) changed.push({ key: k, fromQty: oq, toQty: nq, fromPrice: op, toPrice: np });
  }
  for (const [k, or] of Array.from(oldMap.entries())) {
    if (!newMap.has(k)) { removed.push({ key: k, qty: _itemQty(or), price: _itemPrice(or) }); }
  }
  return { added, removed, changed };
}

async function recordInvoiceAudit(table: 'sales' | 'purchases', invoiceNumber: string, oldRows: any[], newRows: any[]) {
  try {
    const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
    const diff = _diffInvoiceRows(oldRows, newRows);
    const beforeCount = (oldRows || []).length;
    const afterCount = (newRows || []).length;
    const beforeTotal = (oldRows || []).reduce((a: number, r: any) => a + _itemQty(r) * _itemPrice(r), 0);
    const afterTotal = (newRows || []).reduce((a: number, r: any) => a + _itemQty(r) * _itemPrice(r), 0);
    const summary = 'قلم: ' + beforeCount + '→' + afterCount +
      ' | مبلغ: ' + beforeTotal + '→' + afterTotal +
      ' | +' + diff.added.length + ' -' + diff.removed.length + ' ±' + diff.changed.length;
    await _pushAudit({
      type: 'invoice_update',
      table: table,
      key: String(invoiceNumber),
      at: new Date().toISOString(),
      device_id: dev,
      summary: summary,
      beforeCount: beforeCount,
      afterCount: afterCount,
      beforeTotal: beforeTotal,
      afterTotal: afterTotal,
      diff: diff,
    });
  } catch {}
}

export async function recordAuditEvent(ev: any) {
  await _pushAudit(ev);
}

export async function getAuditEvents(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function _auditAckKey(): Promise<string> {
  try {
    const dev = (await AsyncStorage.getItem('@mizan_device_id')) || 'nodev';
    return '@mizan_audit_ack_' + dev;
  } catch { return '@mizan_audit_ack_nodev'; }
}

export async function getUnseenAuditCount(): Promise<number> {
  try {
    const all = await getAuditEvents();
    const key = await _auditAckKey();
    const raw = await AsyncStorage.getItem(key);
    const seen = Number(raw || 0) || 0;
    return Math.max(0, (Array.isArray(all) ? all.length : 0) - seen);
  } catch { return 0; }
}

export async function markAuditSeen(): Promise<void> {
  try {
    const all = await getAuditEvents();
    const key = await _auditAckKey();
    await AsyncStorage.setItem(key, String(Array.isArray(all) ? all.length : 0));
  } catch {}
}

export async function clearAuditEvents(): Promise<void> {
  try { await AsyncStorage.setItem(AUDIT_KEY, '[]'); } catch {}
}

export async function updateSale(payload: { invoiceNumber: string; rows: any[]; meta?: any }) {
  if (await hasActiveReturns(payload.invoiceNumber, 'sales')) {
    throw new Error('برای این فاکتور برگشت فعال وجود دارد. ابتدا برگشت‌ها را حذف کنید.');
  }
  if (await serverBusinessAllowed()) {
    try { await lib.updateSale(payload); } catch { await enqueue('updateSale', payload); }
  } else {
    await enqueue('updateSale', payload);
  }
  const list = (await getLocal<any[]>('sales')) || [];
  const meta = payload.meta || {};
  const template = list.find((r: any) => String(r.invoice_number) === payload.invoiceNumber) || {};
  const filtered = list.filter((r: any) => String(r.invoice_number) !== payload.invoiceNumber);
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const now = new Date().toISOString();
  const newRows = payload.rows.filter((r: any) => !r._deleted).map((r: any) => ({
    ...template,
    invoice_number: payload.invoiceNumber,
    customer_name: meta.name || template.customer_name || '',
    customer_code: meta.code || template.customer_code || '',
    customer_phone: meta.phone || template.customer_phone || '',
    shipping: meta.shipping || template.shipping || '',
    model_code: r.modelCode || '',
    model_name: r.modelName || '',
    quantity: Number(r.quantity) || 0,
    price_unit: Number(r.priceUnit) || 0,
    payment: Number(r.payment) || 0,
    description: r.description || '',
    deposit_date: r.depositDate || '',
    bank_name: r.bankName || '',
    account_holder: r.accountHolder || '',
    account_holder_code: r.accountHolderCode || '',
    shelf: r.shelf || '',
    updated_at: now,
    device_id: dev,
  }));
  const oldRows = list.filter((r: any) => String(r.invoice_number) === payload.invoiceNumber);
  await recordInvoiceAudit('sales', payload.invoiceNumber, oldRows, newRows);
  await setLocal('sales', [...filtered, ...newRows]);
}

export async function updatePurchase(payload: { invoiceNumber: string; rows: any[]; meta?: any }) {
  if (await hasActiveReturns(payload.invoiceNumber, 'purchase')) {
    throw new Error('برای این فاکتور برگشت فعال وجود دارد. ابتدا برگشت‌ها را حذف کنید.');
  }
  if (await serverBusinessAllowed()) {
    try { await lib.updatePurchase(payload); } catch { await enqueue('updatePurchase', payload); }
  } else {
    await enqueue('updatePurchase', payload);
  }
  const list = (await getLocal<any[]>('purchases')) || [];
  const meta = payload.meta || {};
  const template = list.find((r: any) => String(r.invoice_number) === payload.invoiceNumber) || {};
  const filtered = list.filter((r: any) => String(r.invoice_number) !== payload.invoiceNumber);
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const now = new Date().toISOString();
  const newRows = payload.rows.filter((r: any) => !r._deleted).map((r: any) => ({
    ...template,
    invoice_number: payload.invoiceNumber,
    supplier_name: meta.name || template.supplier_name || '',
    supplier_code: meta.code || template.supplier_code || '',
    supplier_phone: meta.phone || template.supplier_phone || '',
    manual_invoice: meta.manualInv || template.manual_invoice || '',
    payer_name: meta.payerName || template.payer_name || '',
    payer_code: meta.payerCode || template.payer_code || '',
    model_code: r.modelCode || '',
    model_name: r.modelName || '',
    quantity: Number(r.quantity) || 0,
    price_unit: Number(r.priceUnit) || 0,
    payment: Number(r.payment) || 0,
    description: r.description || '',
    deposit_date: r.depositDate || '',
    bank_name: r.bankName || '',
    account_holder: r.accountHolder || '',
    account_holder_code: r.accountHolderCode || '',
    shelf: r.shelf || '',
    updated_at: now,
    device_id: dev,
  }));
  const oldRows = list.filter((r: any) => String(r.invoice_number) === payload.invoiceNumber);
  await recordInvoiceAudit('purchases', payload.invoiceNumber, oldRows, newRows);
  await setLocal('purchases', [...filtered, ...newRows]);

  // UPDATE_GROUPED_PURCHASES — همگام‌سازی purchases_grouped با ویرایش جدید
  try {
    const groupedList = (await getLocal<any[]>('purchases_grouped')) || [];
    const groupedFiltered = groupedList.filter((g: any) => String(g.invoice || '') !== payload.invoiceNumber);
    const total = newRows.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0);
    const paid = newRows.reduce((sum: number, r: any) => sum + (Number(r.payment) || 0), 0);
    const groupedObj: any = {
      invoice: payload.invoiceNumber,
      date: meta.date || template.date_factor || now,
      name: meta.name || template.supplier_name || '',
      phone: meta.phone || template.supplier_phone || '',
      supplierCode: meta.code || template.supplier_code || '',
      total,
      paid,
      manual: meta.manualInv || template.manual_invoice || '',
      bank: meta.bank || template.bank_name || '',
      holder: meta.holder || template.account_holder || '',
      holderCode: meta.holderCode || template.account_holder_code || '',
      depositDate: meta.depositDate || template.deposit_date || '',
      shipping: meta.shipping || template.shipping || '',
      local_id: 'grp_purchase_' + payload.invoiceNumber,
      updated_at: now,
      deleted_at: '',
      device_id: dev,
      items: newRows.map((r: any) => ({
        modelCode: r.model_code,
        modelName: r.model_name,
        quantity: Number(r.quantity) || 0,
        priceUnit: Number(r.price_unit) || 0,
        payment: Number(r.payment) || 0,
        description: r.description || '',
        shelf: r.shelf || '',
      })),
    };
    await setLocal('purchases_grouped', [...groupedFiltered, groupedObj]);
  } catch (e: any) {
    console.log('[updatePurchase] grouped update failed:', e?.message);
  }
}

// ═══════════════════════════════════════════
//  createPartnerAutoTx — ثبت خودکار حرکت شریک
//  (فقط اگر طرف مقابل یکی از شرکا باشد)
// ═══════════════════════════════════════════
export async function createPartnerAutoTx(p: {
  partner_code: string;
  partner_name?: string;
  type: 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out';
  amount: number;
  currency: string;
  account_type?: 'capital' | 'current' | 'drawings';
  counterpart_type?: string;
  counterpart_code?: string;
  source_type?: string;
  source_id?: string;
  transaction_date?: string;
  note?: string;
  bank_account_local_id?: string;
}) {
  if (!p.partner_code) return null;
  const amt = Number(p.amount) || 0;
  if (!amt) return null;

  // جلوگیری از ثبت تکراری برای همان فاکتور/هزینه
  if (p.source_type && p.source_id) {
    try {
      const existingList = await getPartnerTransactions(p.partner_code);
      const existing = existingList.find(
        (t: any) => String(t.source_type || '') === p.source_type &&
                   String(t.source_id || '') === p.source_id
      );
      if (existing) return existing;
    } catch {}
  }

  return createPartnerTransaction({
    partner_code: p.partner_code,
    partner_name: p.partner_name || '',
    type: p.type,
    amount: amt,
    currency: p.currency || 'AFN',
    account_type: p.account_type || 'current',
    counterpart_type: p.counterpart_type || 'none',
    counterpart_code: p.counterpart_code || '',
    source_type: p.source_type || '',
    source_id: p.source_id || '',
    transaction_date: p.transaction_date || new Date().toISOString(),
    note: p.note || '',
    bank_account_local_id: p.bank_account_local_id || '',
  });
}

// پیدا کردن شریک بر اساس نام یا کد
export async function findPartnerByNameOrCode(nameOrCode: string) {
  const v = String(nameOrCode || '').trim();
  if (!v) return null;
  const partners = await getPartners();
  return partners.find((p: any) =>
    String(p.name || '').trim() === v ||
    String(p.code || '').trim() === v
  ) || null;
}


// ═══════════════════════════════════════════
//  getSalaryPayments — خواندن حقوق‌ها (کش + صف)
// ═══════════════════════════════════════════
export async function getSalaryPayments(): Promise<any[]> {
  // BUSINESS_LOCAL_ONLY — فقط حافظه محلی + صف، بدون Supabase
  const local = (await getLocal<any[]>('salary_payments')) || [];
  const map: Record<string, any> = {};
  for (const x of local) { const k = String(x.local_id || x.id || ''); if (k) map[k] = x; }
  try {
    const q = await getQueue();
    for (const it of q) {
      if (it.op === 'createSalaryPayment' || it.op === 'updateSalaryPayment') {
        const p = it.payload || {};
        const k = String(p.local_id || p.id || '');
        if (k) map[k] = { ...(map[k] || {}), ...p };
      } else if (it.op === 'deleteSalaryPayment') {
        const id = typeof it.payload === 'string' ? it.payload : (it.payload?.local_id || it.payload?.id);
        if (id) delete map[id];
      }
    }
  } catch {}
  return _applyTombstones('salary_payments', Object.values(map));
}


// ═══════════════════════════════════════════
//  getLoans — خواندن وام‌ها (کش + صف)
// ═══════════════════════════════════════════
export async function getLoans(): Promise<any[]> {
  // BUSINESS_LOCAL_ONLY — فقط حافظه محلی + صف، بدون Supabase
  const local = (await getLocal<any[]>('employee_loans')) || [];
  const map: Record<string, any> = {};
  for (const x of local) { const k = String(x.local_id || x.id || ''); if (k) map[k] = x; }
  try {
    const q = await getQueue();
    for (const it of q) {
      if (it.op === 'createLoan' || it.op === 'updateLoan') {
        const p = it.payload || {};
        const k = String(p.local_id || p.id || '');
        if (k) map[k] = { ...(map[k] || {}), ...p };
      } else if (it.op === 'deleteLoan') {
        const id = typeof it.payload === 'string' ? it.payload : (it.payload?.local_id || it.payload?.id);
        if (id) delete map[id];
      }
    }
  } catch {}
  return _applyTombstones('employee_loans', Object.values(map));
}


// ═══════════════════════════════════════════
//  برگشت از فروش (Sales Returns)
// ═══════════════════════════════════════════
export async function createSalesReturn(payload: any) {
  const now = new Date().toISOString();
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const local = (await getLocal<any[]>('sales_returns')) || [];
  const item = {
    ...payload,
    local_id: payload.local_id || ('sr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
    created_at: payload.created_at || now,
    updated_at: now,
    device_id: dev,
  };
  await setLocal('sales_returns', [item, ...local]);
  try {
    await _pushAudit({
      type: 'sales_return_create',
      table: 'sales_returns',
      key: String(item.local_id),
      at: now,
      device_id: dev,
      summary: 'ثبت برگشت از فروش',
    });
  } catch {}
  await enqueue('createSalesReturn', item);
  return item;
}

export async function getSalesReturns() {
  const local = (await getLocal<any[]>('sales_returns')) || [];
  const q = await getQueue();

  const deletedIds = new Set<string>();
  for (const item of q) {
    if (item.op === 'deleteSalesReturn') {
      const id = String(item.payload || '').trim();
      if (id) deletedIds.add(id);
    }
  }
  try {
    const raw = await AsyncStorage.getItem('@mizan_tombstones');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (!t) continue;
        if (String(t.table || '') !== 'sales_returns') continue;
        const k = String(t.key || '').trim();
        if (k) deletedIds.add(k);
      }
    }
  } catch {}

  const pending = q
    .filter(x => x.op === 'createSalesReturn')
    .map(x => x.payload)
    .filter((p: any) => p && p.local_id && !deletedIds.has(String(p.local_id)));

  const cleaned = local.filter((x: any) => {
    const id = String(x.local_id || x.id || '');
    return id ? !deletedIds.has(id) : true;
  });

  const map = new Map<string, any>();
  for (const r of cleaned) {
    const key = String(r.local_id || r.id || r.return_number || '');
    if (key) map.set(key, r);
  }
  for (const p of pending) {
    const key = String(p.local_id || p.id || p.return_number || '');
    if (key) map.set(key, p);
  }
  return Array.from(map.values());
}

export async function updateSalesReturn(localId: string, payload: any) {
  const now = new Date().toISOString();
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const local = (await getLocal<any[]>('sales_returns')) || [];
  const idx = local.findIndex((x: any) => x.local_id === localId || x.id === localId);
  if (idx < 0) throw new Error('برگشت از فروش پیدا نشد');
  const item = {
    ...local[idx],
    ...payload,
    local_id: local[idx].local_id || localId,
    updated_at: now,
    device_id: dev,
  };
  const newList = local.slice();
  newList[idx] = item;
  await setLocal('sales_returns', newList);
  try {
    await _pushAudit({
      type: 'sales_return_update',
      table: 'sales_returns',
      key: String(item.local_id),
      at: now,
      device_id: dev,
      summary: 'ویرایش برگشت از فروش',
    });
  } catch {}
  await enqueue('updateSalesReturn', item);
  return item;
}

export async function deleteSalesReturn(localId: string) {
  await recordTombstone('sales_returns', String(localId));
  const local = (await getLocal<any[]>('sales_returns')) || [];
  await setLocal('sales_returns', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try {
    await _pushAudit({
      type: 'sales_return_delete',
      table: 'sales_returns',
      key: String(localId),
      at: new Date().toISOString(),
      device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '',
      summary: 'حذف برگشت از فروش',
    });
  } catch {}
  await enqueue('deleteSalesReturn', String(localId));
}

// ═══════════════════════════════════════════
//  برگشت از خرید (Purchase Returns)
// ═══════════════════════════════════════════
export async function createPurchaseReturn(payload: any) {
  const now = new Date().toISOString();
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const local = (await getLocal<any[]>('purchase_returns')) || [];
  const item = {
    ...payload,
    local_id: payload.local_id || ('pr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
    created_at: payload.created_at || now,
    updated_at: now,
    device_id: dev,
  };
  await setLocal('purchase_returns', [item, ...local]);
  try {
    await _pushAudit({
      type: 'purchase_return_create',
      table: 'purchase_returns',
      key: String(item.local_id),
      at: now,
      device_id: dev,
      summary: 'ثبت برگشت از خرید',
    });
  } catch {}
  await enqueue('createPurchaseReturn', item);
  return item;
}

export async function getPurchaseReturns() {
  const local = (await getLocal<any[]>('purchase_returns')) || [];
  const q = await getQueue();

  const deletedIds = new Set<string>();
  for (const item of q) {
    if (item.op === 'deletePurchaseReturn') {
      const id = String(item.payload || '').trim();
      if (id) deletedIds.add(id);
    }
  }
  try {
    const raw = await AsyncStorage.getItem('@mizan_tombstones');
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (!t) continue;
        if (String(t.table || '') !== 'purchase_returns') continue;
        const k = String(t.key || '').trim();
        if (k) deletedIds.add(k);
      }
    }
  } catch {}

  const pending = q
    .filter(x => x.op === 'createPurchaseReturn')
    .map(x => x.payload)
    .filter((p: any) => p && p.local_id && !deletedIds.has(String(p.local_id)));

  const cleaned = local.filter((x: any) => {
    const id = String(x.local_id || x.id || '');
    return id ? !deletedIds.has(id) : true;
  });

  const map = new Map<string, any>();
  for (const r of cleaned) {
    const key = String(r.local_id || r.id || r.return_number || '');
    if (key) map.set(key, r);
  }
  for (const p of pending) {
    const key = String(p.local_id || p.id || p.return_number || '');
    if (key) map.set(key, p);
  }
  return Array.from(map.values());
}

export async function updatePurchaseReturn(localId: string, payload: any) {
  const now = new Date().toISOString();
  const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
  const local = (await getLocal<any[]>('purchase_returns')) || [];
  const idx = local.findIndex((x: any) => x.local_id === localId || x.id === localId);
  if (idx < 0) throw new Error('برگشت از خرید پیدا نشد');
  const item = {
    ...local[idx],
    ...payload,
    local_id: local[idx].local_id || localId,
    updated_at: now,
    device_id: dev,
  };
  const newList = local.slice();
  newList[idx] = item;
  await setLocal('purchase_returns', newList);
  try {
    await _pushAudit({
      type: 'purchase_return_update',
      table: 'purchase_returns',
      key: String(item.local_id),
      at: now,
      device_id: dev,
      summary: 'ویرایش برگشت از خرید',
    });
  } catch {}
  await enqueue('updatePurchaseReturn', item);
  return item;
}

export async function deletePurchaseReturn(localId: string) {
  await recordTombstone('purchase_returns', String(localId));
  const local = (await getLocal<any[]>('purchase_returns')) || [];
  await setLocal('purchase_returns', local.filter((x: any) => x.local_id !== localId && x.id !== localId));
  try {
    await _pushAudit({
      type: 'purchase_return_delete',
      table: 'purchase_returns',
      key: String(localId),
      at: new Date().toISOString(),
      device_id: (await AsyncStorage.getItem('@mizan_device_id')) || '',
      summary: 'حذف برگشت از خرید',
    });
  } catch {}
  await enqueue('deletePurchaseReturn', String(localId));
}
