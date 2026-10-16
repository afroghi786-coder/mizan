// libsqlite.ts — SQLite Wrapper کامل
// 🎯 همه Entity ها در یک فایل
// 🎯 Fallback به AsyncStorage اگه خراب شد

import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;
let _failed = false;

export async function getDB(): Promise<SQLite.SQLiteDatabase | null> {
  if (_failed) return null;
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('mizan.db');

      // 🚀 تنظیمات سرعت
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA synchronous = NORMAL;');
      await db.execAsync('PRAGMA cache_size = 10000;');
      await db.execAsync('PRAGMA temp_store = MEMORY;');

      // ─── جداول صندوق
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS boxes (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          name TEXT,
          currency TEXT,
          owner_name TEXT,
          owner_code TEXT,
          opening REAL DEFAULT 0,
          note TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_boxes_name ON boxes(name);
        CREATE INDEX IF NOT EXISTS idx_boxes_currency ON boxes(currency);

        CREATE TABLE IF NOT EXISTS box_transactions (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          box_id TEXT NOT NULL,
          box_code TEXT,
          type TEXT,
          amount REAL DEFAULT 0,
          currency TEXT,
          description TEXT,
          date TEXT,
          created_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_bt_box ON box_transactions(box_id);
        CREATE INDEX IF NOT EXISTS idx_bt_date ON box_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_bt_type ON box_transactions(type);

        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);

      // ─── جداول همه Entity ها
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          name TEXT, phone TEXT, code TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
        CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);

        CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          from TEXT, to TEXT, amount TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_trades_from ON trades(from);
        CREATE INDEX IF NOT EXISTS idx_trades_to ON trades(to);
        CREATE INDEX IF NOT EXISTS idx_trades_amount ON trades(amount);

        CREATE TABLE IF NOT EXISTS partners (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          name TEXT, phone TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);
        CREATE INDEX IF NOT EXISTS idx_partners_phone ON partners(phone);

        CREATE TABLE IF NOT EXISTS hawalas (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          code TEXT, sender_name TEXT, beneficiary_name TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_hawalas_code ON hawalas(code);
        CREATE INDEX IF NOT EXISTS idx_hawalas_sender_name ON hawalas(sender_name);
        CREATE INDEX IF NOT EXISTS idx_hawalas_beneficiary_name ON hawalas(beneficiary_name);

        CREATE TABLE IF NOT EXISTS checks (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          check_number TEXT, bank TEXT, amount TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_checks_check_number ON checks(check_number);
        CREATE INDEX IF NOT EXISTS idx_checks_bank ON checks(bank);
        CREATE INDEX IF NOT EXISTS idx_checks_amount ON checks(amount);

        CREATE TABLE IF NOT EXISTS transfers (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          from_box_code TEXT, to_box_code TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_transfers_from_box_code ON transfers(from_box_code);
        CREATE INDEX IF NOT EXISTS idx_transfers_to_box_code ON transfers(to_box_code);

        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          name TEXT, phone TEXT, role TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
        CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
        CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

        CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          employee_id TEXT, date TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

        CREATE TABLE IF NOT EXISTS loans (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          employee_id TEXT, amount TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_loans_employee_id ON loans(employee_id);
        CREATE INDEX IF NOT EXISTS idx_loans_amount ON loans(amount);

        CREATE TABLE IF NOT EXISTS leaves (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          employee_id TEXT, type TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id);
        CREATE INDEX IF NOT EXISTS idx_leaves_type ON leaves(type);

        CREATE TABLE IF NOT EXISTS salaries (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          employee_id TEXT, month TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_salaries_employee_id ON salaries(employee_id);
        CREATE INDEX IF NOT EXISTS idx_salaries_month ON salaries(month);

        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          title TEXT, amount TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_title ON expenses(title);
        CREATE INDEX IF NOT EXISTS idx_expenses_amount ON expenses(amount);

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          name TEXT, code TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          invoice TEXT, name TEXT, total TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice);
        CREATE INDEX IF NOT EXISTS idx_sales_name ON sales(name);
        CREATE INDEX IF NOT EXISTS idx_sales_total ON sales(total);

        CREATE TABLE IF NOT EXISTS purchases (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT,
          invoice TEXT, name TEXT, total TEXT,
          created_at TEXT,
          updated_at TEXT,
          data TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoice);
        CREATE INDEX IF NOT EXISTS idx_purchases_name ON purchases(name);
        CREATE INDEX IF NOT EXISTS idx_purchases_total ON purchases(total);
      `);

      _db = db;
      console.log('[sqlite] ✅ آماده — WAL mode — ' + (15 + 2) + ' جدول');
      return db;
    } catch (e) {
      console.log('[sqlite] ❌ خطا:', e);
      _failed = true;
      return null;
    }
  })();

  return _initPromise;
}

// ─── Migration flags
export async function isMigrated(key: string): Promise<boolean> {
  try {
    const db = await getDB();
    if (!db) return false;
    const row: any = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['migrated_' + key]);
    return row && row.value === 'yes';
  } catch { return false; }
}

export async function setMigrated(key: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['migrated_' + key, 'yes']);
  } catch {}
}

// ─── Health check
export async function isHealthy(): Promise<boolean> {
  try {
    const db = await getDB();
    if (!db) return false;
    await db.getFirstAsync('SELECT 1 as ok');
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════
// Generic CRUD برای همه Entity ها
// ═══════════════════════════════════════════

export async function dbGetAll(table: string): Promise<any[]> {
  try {
    const db = await getDB();
    if (!db) return [];
    const rows = await db.getAllAsync('SELECT data FROM ' + table + ' ORDER BY created_at DESC');
    return rows.map((r: any) => {
      try { return JSON.parse(r.data); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

export async function dbGetById(table: string, id: string): Promise<any | null> {
  try {
    const db = await getDB();
    if (!db) return null;
    const row: any = await db.getFirstAsync('SELECT data FROM ' + table + ' WHERE id = ?', [id]);
    return row ? JSON.parse(row.data) : null;
  } catch { return null; }
}

export async function dbUpsert(table: string, item: any, fields: string[] = []): Promise<any> {
  try {
    const db = await getDB();
    if (!db) return item;

    const id = item.id || item.local_id || ('x_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    const code = item.code || ('C-' + Date.now().toString(36).toUpperCase());
    const now = new Date().toISOString();
    const enriched = { ...item, id, local_id: id, code, updated_at: now, created_at: item.created_at || now };

    // ساخت ستون‌های داینامیک
    const cols = ['id', 'code', ...fields, 'created_at', 'updated_at', 'data'];
    const placeholders = cols.map(() => '?').join(', ');
    const values = [
      id,
      code,
      ...fields.map(f => {
        const v = enriched[f];
        return v === undefined || v === null ? null : String(v);
      }),
      enriched.created_at,
      enriched.updated_at,
      JSON.stringify(enriched),
    ];

    await db.runAsync(
      'INSERT OR REPLACE INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + placeholders + ')',
      values
    );

    return enriched;
  } catch (e) {
    console.log('[sqlite] upsert ' + table + ' err:', e);
    return item;
  }
}

export async function dbDelete(table: string, id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.runAsync('DELETE FROM ' + table + ' WHERE id = ?', [id]);
  } catch {}
}

export async function dbCount(table: string): Promise<number> {
  try {
    const db = await getDB();
    if (!db) return 0;
    const row: any = await db.getFirstAsync('SELECT COUNT(*) as c FROM ' + table);
    return Number(row?.c) || 0;
  } catch { return 0; }
}

export async function dbBulkUpsert(table: string, items: any[], fields: string[] = []): Promise<number> {
  let count = 0;
  try {
    const db = await getDB();
    if (!db) return 0;

    await db.withTransactionAsync(async () => {
      for (const item of items) {
        const id = item.id || item.local_id || ('x_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
        const code = item.code || ('C-' + Date.now().toString(36).toUpperCase());
        const now = new Date().toISOString();
        const enriched = { ...item, id, local_id: id, code, updated_at: now, created_at: item.created_at || now };

        const cols = ['id', 'code', ...fields, 'created_at', 'updated_at', 'data'];
        const placeholders = cols.map(() => '?').join(', ');
        const values = [
          id, code,
          ...fields.map(f => {
            const v = enriched[f];
            return v === undefined || v === null ? null : String(v);
          }),
          enriched.created_at, enriched.updated_at,
          JSON.stringify(enriched),
        ];

        await db.runAsync(
          'INSERT OR REPLACE INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + placeholders + ')',
          values
        );
        count++;
      }
    });
  } catch (e) {
    console.log('[sqlite] bulkUpsert ' + table + ' err:', e);
  }
  return count;
}

// ─── Config بر اساس table
export function getFieldsFor(table: string): string[] {
  const map: Record<string, string[]> = {
    'customers': ['name', 'phone', 'code'],
    'trades': ['from', 'to', 'amount'],
    'partners': ['name', 'phone'],
    'hawalas': ['code', 'sender_name', 'beneficiary_name'],
    'checks': ['check_number', 'bank', 'amount'],
    'transfers': ['from_box_code', 'to_box_code'],
    'employees': ['name', 'phone', 'role'],
    'attendance': ['employee_id', 'date'],
    'loans': ['employee_id', 'amount'],
    'leaves': ['employee_id', 'type'],
    'salaries': ['employee_id', 'month'],
    'expenses': ['title', 'amount'],
    'products': ['name', 'code'],
    'sales': ['invoice', 'name', 'total'],
    'purchases': ['invoice', 'name', 'total'],
  };
  return map[table] || [];
}
