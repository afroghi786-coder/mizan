// lib.migrate.ts — Migration از AsyncStorage به SQLite
// 🎯 فقط یک بار اجرا می‌شه
// 🎯 اگه خطا داد، AsyncStorage دست‌نخورده می‌مونه

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, isMigrated, setMigrated } from './lib.db';

// ═══════════════════════════════════════════
// Migration صندوق‌ها
// ═══════════════════════════════════════════
export async function migrateBoxes(): Promise<{ ok: boolean; count: number }> {
  const KEY = 'boxes';
  try {
    if (await isMigrated(KEY)) {
      console.log('[migrate] boxes: از قبل انجام شده');
      return { ok: true, count: 0 };
    }

    const db = await getDB();
    if (!db) return { ok: false, count: 0 };

    console.log('[migrate] boxes: شروع...');

    // ─── خواندن از AsyncStorage
    const boxesRaw = await AsyncStorage.getItem('@mizan_local_fx_boxes');
    const txsRaw = await AsyncStorage.getItem('@mizan_local_fx_box_tx');

    const boxes = boxesRaw ? JSON.parse(boxesRaw) : [];
    const txs = txsRaw ? JSON.parse(txsRaw) : [];

    if (!Array.isArray(boxes)) boxes = [];
    if (!Array.isArray(txs)) txs = [];

    console.log('[migrate] boxes: ' + boxes.length + ' صندوق، ' + txs.length + ' تراکنش');

    // ─── نوشتن در SQLite با transaction
    let count = 0;
    await db.withTransactionAsync(async () => {
      for (const b of boxes) {
        const id = b.id || b.local_id;
        if (!id) continue;
        await db.runAsync(
          'INSERT OR REPLACE INTO boxes (id, code, name, currency, owner_name, owner_code, opening, note, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            b.code || '',
            b.name || '',
            b.currency || 'AFN',
            b.owner_name || '',
            b.owner_code || '',
            Number(b.opening) || 0,
            b.note || '',
            b.created_at || new Date().toISOString(),
            b.updated_at || new Date().toISOString(),
            JSON.stringify(b),
          ]
        );
        count++;
      }

      for (const t of txs) {
        const id = t.id || t.local_id;
        const boxId = t.box_id || t.box_code;
        if (!id || !boxId) continue;
        await db.runAsync(
          'INSERT OR REPLACE INTO box_transactions (id, code, box_id, box_code, type, amount, currency, description, date, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            t.code || '',
            boxId,
            t.box_code || '',
            t.type || 'deposit',
            Number(t.amount) || 0,
            t.currency || 'AFN',
            t.description || '',
            t.date || '',
            t.created_at || new Date().toISOString(),
            JSON.stringify(t),
          ]
        );
        count++;
      }
    });

    await setMigrated(KEY);
    console.log('[migrate] boxes: ✅ ' + count + ' رکورد منتقل شد');
    return { ok: true, count };
  } catch (e: any) {
    console.log('[migrate] boxes: ❌ خطا:', e?.message);
    return { ok: false, count: 0 };
  }
}

// ═══════════════════════════════════════════
// Migration همه ماژول‌ها
// ═══════════════════════════════════════════
export async function migrateAll(): Promise<void> {
  try {
    console.log('[migrate] 🚀 شروع...');
    await migrateBoxes();
    // بعداً: migrateCustomers, migrateTrades, migrateHawalas, ...
    console.log('[migrate] ✅ تمام');
  } catch (e) {
    console.log('[migrate] خطا:', e);
  }
}
