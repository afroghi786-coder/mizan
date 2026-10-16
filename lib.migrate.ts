// lib.migrate.ts — Migration همه Entity ها از AsyncStorage به SQLite
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB, isMigrated, setMigrated } from './libsqlite';

const ENTITIES = [
  { table: 'boxes',       oldKey: '@mizan_local_fx_boxes',     fields: ['name','currency','owner_name','owner_code'] },
  { table: 'customers',   oldKey: '@mizan_local_fx_cust',      fields: ['name','phone','code'] },
  { table: 'trades',      oldKey: '@mizan_local_fx_trades',    fields: ['from','to','amount'] },
  { table: 'partners',    oldKey: '@mizan_local_fx_partners',  fields: ['name','phone'] },
  { table: 'hawalas',     oldKey: '@mizan_local_fx_hawalas',   fields: ['code','sender_name','beneficiary_name'] },
  { table: 'checks',      oldKey: '@mizan_local_fx_checks',    fields: ['check_number','bank','amount'] },
  { table: 'transfers',   oldKey: '@mizan_local_fx_transfers', fields: ['from_box_code','to_box_code'] },
  { table: 'employees',   oldKey: '@mizan_local_employees',    fields: ['name','phone','role'] },
  { table: 'attendance',  oldKey: '@mizan_local_attendance',   fields: ['employee_id','date'] },
  { table: 'loans',       oldKey: '@mizan_local_loans',        fields: ['employee_id','amount'] },
  { table: 'leaves',      oldKey: '@mizan_local_leaves',       fields: ['employee_id','type'] },
  { table: 'salaries',    oldKey: '@mizan_local_salaries',     fields: ['employee_id','month'] },
  { table: 'expenses',    oldKey: '@mizan_local_expenses',     fields: ['title','amount'] },
  { table: 'products',    oldKey: '@mizan_local_products',     fields: ['name','code'] },
  { table: 'sales',       oldKey: '@mizan_local_sales',        fields: ['invoice','name','total'] },
  { table: 'purchases',   oldKey: '@mizan_local_purchases',    fields: ['invoice','name','total'] },
];

// ─── Migration یک entity
async function migrateOne(entity: any): Promise<{ ok: boolean; count: number }> {
  try {
    if (await isMigrated(entity.table)) {
      return { ok: true, count: 0 };
    }

    const db = await getDB();
    if (!db) return { ok: false, count: 0 };

    // خواندن از AsyncStorage
    const raw = await AsyncStorage.getItem(entity.oldKey);
    let items: any[] = [];
    try { items = raw ? JSON.parse(raw) : []; } catch { items = []; }
    if (!Array.isArray(items)) items = [];

    if (items.length === 0) {
      await setMigrated(entity.table);
      return { ok: true, count: 0 };
    }

    // درج در SQLite با transaction
    let count = 0;
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        const id = item.id || item.local_id;
        if (!id) continue;
        const code = item.code || '';
        const now = new Date().toISOString();

        const cols = ['id', 'code', ...entity.fields, 'created_at', 'updated_at', 'data'];
        const placeholders = cols.map(() => '?').join(', ');
        const values = [
          id,
          code,
          ...entity.fields.map((f: string) => {
            const v = item[f];
            return v === undefined || v === null ? null : String(v);
          }),
          item.created_at || now,
          item.updated_at || now,
          JSON.stringify(item),
        ];

        await db.runAsync(
          'INSERT OR REPLACE INTO ' + entity.table + ' (' + cols.join(', ') + ') VALUES (' + placeholders + ')',
          values
        );
        count++;
      }
    });

    await setMigrated(entity.table);
    return { ok: true, count };
  } catch (e: any) {
    console.log('[migrate] ' + entity.table + ' err:', e?.message);
    return { ok: false, count: 0 };
  }
}

// ─── Migration صندوق‌ها (special: با تراکنش‌ها)
async function migrateBoxes(): Promise<{ ok: boolean; count: number }> {
  try {
    if (await isMigrated('boxes_full')) return { ok: true, count: 0 };

    const db = await getDB();
    if (!db) return { ok: false, count: 0 };

    // خواندن صندوق‌ها
    const boxesRaw = await AsyncStorage.getItem('@mizan_local_fx_boxes');
    const txsRaw = await AsyncStorage.getItem('@mizan_local_fx_box_tx');
    let boxes: any[] = [];
    let txs: any[] = [];
    try { boxes = boxesRaw ? JSON.parse(boxesRaw) : []; } catch {}
    try { txs = txsRaw ? JSON.parse(txsRaw) : []; } catch {}
    if (!Array.isArray(boxes)) boxes = [];
    if (!Array.isArray(txs)) txs = [];

    let count = 0;
    await db.withTransactionAsync(async () => {
      for (const b of boxes) {
        const id = b.id || b.local_id;
        if (!id) continue;
        const now = new Date().toISOString();
        await db.runAsync(
          'INSERT OR REPLACE INTO boxes (id, code, name, currency, owner_name, owner_code, opening, note, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, b.code || '', b.name || '', b.currency || 'AFN', b.owner_name || '', b.owner_code || '', Number(b.opening) || 0, b.note || '', b.created_at || now, now, JSON.stringify(b)]
        );
        count++;
      }
      for (const t of txs) {
        const id = t.id || t.local_id;
        const boxId = t.box_id || t.box_code;
        if (!id || !boxId) continue;
        const now = new Date().toISOString();
        await db.runAsync(
          'INSERT OR REPLACE INTO box_transactions (id, code, box_id, box_code, type, amount, currency, description, date, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, t.code || '', boxId, t.box_code || '', t.type || 'deposit', Number(t.amount) || 0, t.currency || 'AFN', t.description || '', t.date || '', t.created_at || now, JSON.stringify(t)]
        );
        count++;
      }
    });

    await setMigrated('boxes');
    await setMigrated('boxes_full');
    return { ok: true, count };
  } catch (e: any) {
    console.log('[migrate] boxes err:', e?.message);
    return { ok: false, count: 0 };
  }
}

// ═══════════════════════════════════════════
// migrateAll
// ═══════════════════════════════════════════
export async function migrateAll(): Promise<void> {
  try {
    console.log('[migrate] 🚀 شروع...');

    const r1 = await migrateBoxes();
    if (r1.ok) console.log('[migrate] boxes: ' + r1.count);

    let total = 0;
    for (const e of ENTITIES) {
      const r = await migrateOne(e);
      if (r.ok && r.count > 0) {
        console.log('[migrate] ' + e.table + ': ' + r.count);
        total += r.count;
      }
    }

    console.log('[migrate] ✅ تمام — ' + total + ' رکورد منتقل شد');
  } catch (e) {
    console.log('[migrate] خطا:', e);
  }
}
