// lib.storage.ts — آداپتر SQLite (گوشی) + AsyncStorage (وب)
// 📱 گوشی: SQLite (۱۰۰ برابر سریع‌تر)
// 💻 وب: AsyncStorage (سازگار با مرورگر)
// 🎯 همون API AsyncStorage — منطق اپ دست‌نخورده

import { Platform } from 'react-native';
import RealAS from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

if (isWeb) {
  console.log('[storage] 🌐 وب — فقط AsyncStorage');
}

// ═══════════════════════════════════════════
// گوشی → SQLite
// ═══════════════════════════════════════════
let _db: any = null;
let _initPromise: Promise<any> | null = null;
let _failed = false;

async function getDb(): Promise<any> {
  if (isWeb) return null;  // ← وب: هیچی
  if (_failed) return null;
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const SQLite = require('expo-sqlite');
      const db = await SQLite.openDatabaseAsync('mizan_kv.db');

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = 10000;
        PRAGMA temp_store = MEMORY;
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT,
          updated_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_kv_updated ON kv(updated_at);
      `);

      _db = db;
      console.log('[storage] 📱 SQLite آماده');
      return db;
    } catch (e) {
      console.log('[storage] ⚠️ SQLite خطا — fallback:', e);
      _failed = true;
      return null;
    }
  })();

  return _initPromise;
}

// ═══════════════════════════════════════════
// API (کاملاً مثل AsyncStorage)
// ═══════════════════════════════════════════
const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const db = await getDb();
    if (!db) return RealAS.getItem(key);
    try {
      const row: any = await db.getFirstAsync('SELECT value FROM kv WHERE key = ?', [key]);
      if (row && row.value !== null && row.value !== undefined) return String(row.value);

      // Lazy migration از AsyncStorage
      const v = await RealAS.getItem(key);
      if (v !== null) {
        await db.runAsync(
          'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
          [key, v, Date.now()]
        ).catch(() => {});
      }
      return v;
    } catch (e) {
      return RealAS.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const db = await getDb();
    if (!db) return RealAS.setItem(key, value);
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, Date.now()]
      );
      // بکاپ در AsyncStorage
      try { await RealAS.setItem(key, value); } catch {}
    } catch (e) {
      await RealAS.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    const db = await getDb();
    if (!db) return RealAS.removeItem(key);
    try {
      await db.runAsync('DELETE FROM kv WHERE key = ?', [key]);
      try { await RealAS.removeItem(key); } catch {}
    } catch (e) {
      await RealAS.removeItem(key);
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const db = await getDb();
    if (!db) return RealAS.multiGet(keys);
    try {
      if (keys.length === 0) return [];
      const placeholders = keys.map(() => '?').join(',');
      const rows: any[] = await db.getAllAsync(
        'SELECT key, value FROM kv WHERE key IN (' + placeholders + ')',
        keys
      );
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;

      const missing = keys.filter(k => map[k] === undefined);
      if (missing.length > 0) {
        const fallback = await RealAS.multiGet(missing);
        for (const [k, v] of fallback) {
          if (v !== null) {
            map[k] = v;
            await db.runAsync(
              'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
              [k, v, Date.now()]
            ).catch(() => {});
          }
        }
      }
      return keys.map(k => [k, map[k] !== undefined ? map[k] : null]);
    } catch (e) {
      return RealAS.multiGet(keys);
    }
  },

  async multiSet(pairs: [string, string][]): Promise<void> {
    const db = await getDb();
    if (!db) return RealAS.multiSet(pairs);
    try {
      await db.withTransactionAsync(async () => {
        for (const [k, v] of pairs) {
          await db.runAsync(
            'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
            [k, v, Date.now()]
          );
        }
      });
      try { await RealAS.multiSet(pairs); } catch {}
    } catch (e) {
      await RealAS.multiSet(pairs);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    const db = await getDb();
    if (!db) return RealAS.multiRemove(keys);
    try {
      await db.withTransactionAsync(async () => {
        for (const k of keys) {
          await db.runAsync('DELETE FROM kv WHERE key = ?', [k]);
        }
      });
      try { await RealAS.multiRemove(keys); } catch {}
    } catch (e) {
      await RealAS.multiRemove(keys);
    }
  },

  async getAllKeys(): Promise<string[]> {
    const db = await getDb();
    if (!db) return RealAS.getAllKeys();
    try {
      const rows: any[] = await db.getAllAsync('SELECT key FROM kv');
      const sqliteKeys = rows.map(r => r.key);
      const asKeys = await RealAS.getAllKeys();
      return Array.from(new Set([...sqliteKeys, ...asKeys]));
    } catch (e) {
      return RealAS.getAllKeys();
    }
  },

  async clear(): Promise<void> {
    const db = await getDb();
    if (!db) return RealAS.clear();
    try {
      await db.runAsync('DELETE FROM kv');
      try { await RealAS.clear(); } catch {}
    } catch (e) {
      await RealAS.clear();
    }
  },

  async flushGetRequests(): Promise<void> {},
};

export default AsyncStorage;
export { AsyncStorage };
