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
let currentUserId = '';

export function setStorageUserId(uid: string | null | undefined) {
  currentUserId = String(uid || '').trim();
}
export function getStorageUserId() {
  return currentUserId;
}

const EXEMPT_KEYS = new Set<string>([
  '@mizan_license_data',
  '@mizan_last_license_check',
  '@mizan_lang',
  '@mizan_lang_set',
  '@mizan_voice_lang',
  '@mizan_currency_cache',
  '@mizan_device_id',
  '@mizan_device_lock_user',
]);

function _nsKey(key: string): string {
  if (!key) return key;
  if (!currentUserId) return key;
  if (key.startsWith('@mizan_u_')) return key;
  if (!key.startsWith('@mizan_')) return key;
  if (EXEMPT_KEYS.has(key)) return key;
  return '@mizan_u_' + currentUserId + '_' + key.slice(7);
}

function _logicalKey(key: string): string {
  if (!currentUserId) return key;
  const prefix = '@mizan_u_' + currentUserId + '_';
  if (key.startsWith(prefix)) return '@mizan_' + key.slice(prefix.length);
  return key;
}

function _belongsToCurrentOrGlobal(key: string): boolean {
  if (!key.startsWith('@mizan_u_')) return true;
  return key.startsWith('@mizan_u_' + currentUserId + '_');
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = _nsKey(key);
    const db = await getDb();
    if (!db) return RealAS.getItem(k);
    try {
      const row: any = await db.getFirstAsync('SELECT value FROM kv WHERE key = ?', [k]);
      if (row && row.value !== null && row.value !== undefined) return String(row.value);
      const v = await RealAS.getItem(k);
      if (v !== null) {
        await db.runAsync(
          'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
          [k, v, Date.now()]
        ).catch(() => {});
      }
      return v;
    } catch (e) {
      return RealAS.getItem(k);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = _nsKey(key);
    const db = await getDb();
    if (!db) return RealAS.setItem(k, value);
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
        [k, value, Date.now()]
      );
      try { await RealAS.setItem(k, value); } catch {}
    } catch (e) {
      await RealAS.setItem(k, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    const k = _nsKey(key);
    const db = await getDb();
    if (!db) return RealAS.removeItem(k);
    try {
      await db.runAsync('DELETE FROM kv WHERE key = ?', [k]);
      try { await RealAS.removeItem(k); } catch {}
    } catch (e) {
      await RealAS.removeItem(k);
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const out: [string, string | null][] = [];
    for (const k of keys) {
      out.push([k, await AsyncStorage.getItem(k)]);
    }
    return out;
  },

  async multiSet(pairs: [string, string][]): Promise<void> {
    for (const [k, v] of pairs) {
      await AsyncStorage.setItem(k, v);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    for (const k of keys) {
      await AsyncStorage.removeItem(k);
    }
  },

  async getAllKeys(): Promise<string[]> {
    const db = await getDb();
    let physical: string[] = [];
    if (db) {
      try {
        const rows: any[] = await db.getAllAsync('SELECT key FROM kv');
        physical = physical.concat(rows.map(r => String(r.key)));
      } catch {}
    }
    try {
      const asKeys = await RealAS.getAllKeys();
      physical = physical.concat(asKeys);
    } catch {}
    const uniq = Array.from(new Set(physical));
    return uniq
      .filter(_belongsToCurrentOrGlobal)
      .map(_logicalKey);
  },

  async clear(): Promise<void> {
    const db = await getDb();
    let physical: string[] = [];
    if (db) {
      try {
        const rows: any[] = await db.getAllAsync('SELECT key FROM kv');
        physical = physical.concat(rows.map(r => String(r.key)));
      } catch {}
    }
    try {
      const asKeys = await RealAS.getAllKeys();
      physical = physical.concat(asKeys);
    } catch {}
    const uniq = Array.from(new Set(physical)).filter(_belongsToCurrentOrGlobal);
    for (const k of uniq) {
      await AsyncStorage.removeItem(k);
    }
  },

  async flushGetRequests(): Promise<void> {},
};


// ═══ قفل دستگاه ═══
// یک دستگاه فقط یک حساب. کلید سراسری است و بین حساب‌ها مشترک.
const DEVICE_LOCK_KEY = '@mizan_device_lock_user';

export async function getDeviceLock(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(DEVICE_LOCK_KEY);
    return String(v || '').trim();
  } catch { return ''; }
}

export async function setDeviceLock(userId: string): Promise<void> {
  try {
    const v = String(userId || '').trim();
    if (!v) return;
    await AsyncStorage.setItem(DEVICE_LOCK_KEY, v);
  } catch {}
}

export async function canUseDevice(userId: string): Promise<{ ok: boolean; lockedTo: string }> {
  const current = String(userId || '').trim();
  const lockedTo = await getDeviceLock();
  if (!lockedTo) return { ok: true, lockedTo: '' };
  if (!current) return { ok: false, lockedTo };
  return { ok: lockedTo === current, lockedTo };
}

export default AsyncStorage;
export { AsyncStorage };


// تست: پاک کردن seen
export async function __clearSeen(){const A=(await import("./lib.storage")).default;await A.removeItem("@mizan_bot_seen_msgs_v2");await A.removeItem("@mizan_bot_seen_msgs");console.log("[CLEAR] seen cleared");}
