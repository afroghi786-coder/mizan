// lib.db.ts — SQLite Wrapper
// 🎯 فقط لایه ذخیره‌سازی — UI دست نمی‌خوره

import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;
let _failed = false;

// ─── ساخت/باز کردن DB
export async function getDB(): Promise<SQLite.SQLiteDatabase | null> {
  if (_failed) return null;
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('mizan.db');

      // 🚀 WAL mode برای سرعت
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA synchronous = NORMAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA cache_size = 10000;');

      // ─── جداول
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
        CREATE INDEX IF NOT EXISTS idx_boxes_owner ON boxes(owner_code);
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

      _db = db;
      console.log('[db] ✅ SQLite آماده — WAL mode');
      return db;
    } catch (e) {
      console.log('[db] ❌ خطا:', e);
      _failed = true;
      return null;
    }
  })();

  return _initPromise;
}

// ─── migration flag
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

// ─── Reset (development only)
export async function resetDB(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.execAsync('DELETE FROM boxes; DELETE FROM box_transactions; DELETE FROM meta;');
    console.log('[db] 🔄 reset شد');
  } catch {}
}
