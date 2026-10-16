// lib.boxes.sqlite.ts — صندوق‌ها با SQLite
// 🎯 همون توابع قبلی، فقط سریع‌تر

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from './lib.db';

function genId(prefix: string): string {
  return prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ═══════════════════════════════════════════
// getBoxes — همه صندوق‌ها
// ═══════════════════════════════════════════
export async function getBoxes(): Promise<any[]> {
  try {
    const db = await getDB();
    if (!db) return _fallbackGetBoxes();

    const rows = await db.getAllAsync('SELECT data FROM boxes ORDER BY created_at DESC');
    return rows.map((r: any) => {
      try { return JSON.parse(r.data); } catch { return null; }
    }).filter(Boolean);
  } catch (e) {
    console.log('[boxes] getBoxes err:', e);
    return _fallbackGetBoxes();
  }
}

// ═══════════════════════════════════════════
// saveBox — ذخیره صندوق
// ═══════════════════════════════════════════
export async function saveBox(box: any): Promise<any> {
  try {
    const db = await getDB();
    if (!db) return _fallbackSaveBox(box);

    const id = box.id || box.local_id || genId('bx_');
    const code = box.code || ('BX-' + Date.now().toString(36).toUpperCase());
    const item = {
      ...box,
      id,
      local_id: id,
      code,
      updated_at: new Date().toISOString(),
      created_at: box.created_at || new Date().toISOString(),
    };

    await db.runAsync(
      'INSERT OR REPLACE INTO boxes (id, code, name, currency, owner_name, owner_code, opening, note, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        code,
        item.name || '',
        item.currency || 'AFN',
        item.owner_name || '',
        item.owner_code || '',
        Number(item.opening) || 0,
        item.note || '',
        item.created_at,
        item.updated_at,
        JSON.stringify(item),
      ]
    );

    return item;
  } catch (e) {
    console.log('[boxes] saveBox err:', e);
    return _fallbackSaveBox(box);
  }
}

// ═══════════════════════════════════════════
// deleteBox
// ═══════════════════════════════════════════
export async function deleteBox(id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return _fallbackDeleteBox(id);

    await db.runAsync('DELETE FROM boxes WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM box_transactions WHERE box_id = ?', [id]);
  } catch (e) {
    console.log('[boxes] deleteBox err:', e);
    return _fallbackDeleteBox(id);
  }
}

// ═══════════════════════════════════════════
// getBoxTransactions
// ═══════════════════════════════════════════
export async function getBoxTransactions(boxId?: string): Promise<any[]> {
  try {
    const db = await getDB();
    if (!db) return _fallbackGetTxs(boxId);

    let rows;
    if (boxId) {
      rows = await db.getAllAsync(
        'SELECT data FROM box_transactions WHERE box_id = ? ORDER BY created_at DESC',
        [boxId]
      );
    } else {
      rows = await db.getAllAsync('SELECT data FROM box_transactions ORDER BY created_at DESC');
    }

    return rows.map((r: any) => {
      try { return JSON.parse(r.data); } catch { return null; }
    }).filter(Boolean);
  } catch (e) {
    console.log('[boxes] getTxs err:', e);
    return _fallbackGetTxs(boxId);
  }
}

// ═══════════════════════════════════════════
// addBoxTransaction
// ═══════════════════════════════════════════
export async function addBoxTransaction(tx: any): Promise<any> {
  try {
    const db = await getDB();
    if (!db) return _fallbackAddTx(tx);

    const id = tx.id || tx.local_id || genId('tx_');
    const code = tx.code || ('TX-' + Date.now().toString(36).toUpperCase());
    const item = {
      ...tx,
      id,
      local_id: id,
      code,
      created_at: tx.created_at || new Date().toISOString(),
    };

    await db.runAsync(
      'INSERT OR REPLACE INTO box_transactions (id, code, box_id, box_code, type, amount, currency, description, date, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        code,
        tx.box_id || '',
        tx.box_code || '',
        tx.type || 'deposit',
        Number(tx.amount) || 0,
        tx.currency || 'AFN',
        tx.description || '',
        tx.date || '',
        item.created_at,
        JSON.stringify(item),
      ]
    );

    return item;
  } catch (e) {
    console.log('[boxes] addTx err:', e);
    return _fallbackAddTx(tx);
  }
}

// ═══════════════════════════════════════════
// deleteBoxTransaction
// ═══════════════════════════════════════════
export async function deleteBoxTransaction(id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return _fallbackDeleteTx(id);
    await db.runAsync('DELETE FROM box_transactions WHERE id = ?', [id]);
  } catch (e) {
    return _fallbackDeleteTx(id);
  }
}

// ═══════════════════════════════════════════
// getAllBalances — محاسبه موجودی
// 🚀 اینجا با SQL حساب می‌کنیم نه JS
// ═══════════════════════════════════════════
export async function getAllBalances(): Promise<Record<string, number>> {
  try {
    const db = await getDB();
    if (!db) return _fallbackGetBalances();

    const boxes = await db.getAllAsync('SELECT id, opening FROM boxes') as any[];
    const result: Record<string, number> = {};

    // ─── تک تک با کوئری سریع SQL
    for (const b of boxes) {
      const row: any = await db.getFirstAsync(
        `SELECT 
          COALESCE(SUM(CASE WHEN type IN ('deposit','in','transfer_in') THEN amount ELSE 0 END), 0) as deposits,
          COALESCE(SUM(CASE WHEN type IN ('withdraw','out','transfer_out') THEN amount ELSE 0 END), 0) as withdrawals
        FROM box_transactions WHERE box_id = ?`,
        [b.id]
      );
      const opening = Number(b.opening) || 0;
      const deposits = Number(row?.deposits) || 0;
      const withdrawals = Number(row?.withdrawals) || 0;
      result[b.id] = opening + deposits - withdrawals;
    }

    return result;
  } catch (e) {
    console.log('[boxes] balances err:', e);
    return _fallbackGetBalances();
  }
}

// ═══════════════════════════════════════════
// getBoxKardex
// ═══════════════════════════════════════════
export async function getBoxKardex(boxId: string): Promise<any[]> {
  try {
    const db = await getDB();
    if (!db) return _fallbackKardex(boxId);

    const rows = await db.getAllAsync(
      'SELECT data FROM box_transactions WHERE box_id = ? ORDER BY created_at ASC',
      [boxId]
    );
    return rows.map((r: any) => {
      try { return JSON.parse(r.data); } catch { return null; }
    }).filter(Boolean);
  } catch (e) {
    return _fallbackKardex(boxId);
  }
}

// ═══════════════════════════════════════════
// Fallback — اگه SQLite خراب شد
// ═══════════════════════════════════════════
const BOX_KEY = '@mizan_local_fx_boxes';
const TX_KEY = '@mizan_local_fx_box_tx';

async function _fallbackGetBoxes(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(BOX_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

async function _fallbackSaveBox(box: any): Promise<any> {
  try {
    const r = await AsyncStorage.getItem(BOX_KEY);
    const all = r ? JSON.parse(r) : [];
    const id = box.id || box.local_id || genId('bx_');
    const code = box.code || ('BX-' + Date.now().toString(36).toUpperCase());
    const item = { ...box, id, local_id: id, code, created_at: box.created_at || new Date().toISOString() };
    const next = [item, ...all.filter((x: any) => (x.id || x.local_id) !== id)];
    await AsyncStorage.setItem(BOX_KEY, JSON.stringify(next));
    return item;
  } catch { return box; }
}

async function _fallbackDeleteBox(id: string): Promise<void> {
  try {
    const r = await AsyncStorage.getItem(BOX_KEY);
    const all = r ? JSON.parse(r) : [];
    await AsyncStorage.setItem(BOX_KEY, JSON.stringify(all.filter((x: any) => (x.id || x.local_id) !== id)));
  } catch {}
}

async function _fallbackGetTxs(boxId?: string): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(TX_KEY);
    const all = r ? JSON.parse(r) : [];
    return boxId ? all.filter((x: any) => x.box_id === boxId) : all;
  } catch { return []; }
}

async function _fallbackAddTx(tx: any): Promise<any> {
  try {
    const r = await AsyncStorage.getItem(TX_KEY);
    const all = r ? JSON.parse(r) : [];
    const id = tx.id || tx.local_id || genId('tx_');
    const item = { ...tx, id, local_id: id, created_at: tx.created_at || new Date().toISOString() };
    const next = [item, ...all];
    await AsyncStorage.setItem(TX_KEY, JSON.stringify(next));
    return item;
  } catch { return tx; }
}

async function _fallbackDeleteTx(id: string): Promise<void> {
  try {
    const r = await AsyncStorage.getItem(TX_KEY);
    const all = r ? JSON.parse(r) : [];
    await AsyncStorage.setItem(TX_KEY, JSON.stringify(all.filter((x: any) => (x.id || x.local_id) !== id)));
  } catch {}
}

async function _fallbackGetBalances(): Promise<Record<string, number>> {
  try {
    const boxes = await _fallbackGetBoxes();
    const txs = await _fallbackGetTxs();
    const result: Record<string, number> = {};
    for (const b of boxes) {
      const id = b.id || b.local_id;
      let bal = Number(b.opening) || 0;
      for (const t of txs) {
        if (t.box_id !== id) continue;
        const amt = Number(t.amount) || 0;
        if (t.type === 'deposit' || t.type === 'in' || t.type === 'transfer_in') bal += amt;
        else if (t.type === 'withdraw' || t.type === 'out' || t.type === 'transfer_out') bal -= amt;
      }
      result[id] = bal;
    }
    return result;
  } catch { return {}; }
}

async function _fallbackKardex(boxId: string): Promise<any[]> {
  return _fallbackGetTxs(boxId);
}
