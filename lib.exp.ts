// lib.exp.ts — هزینه‌ها (استاندارد آفلاین/آنلاین)
import AsyncStorage from './lib.storage';
import { supabase } from './lib';
import { getMode, enqueue, getQueue } from './lib.offline';

const K = (k: string) => '@mizan_local_' + k;
const gid = () => 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
const pad = (n: number) => String(n).padStart(2, '0');

async function readLocal(key: string): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(K(key));
    if (!r) return [];
    const p = JSON.parse(r);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
async function writeLocal(key: string, list: any[]) {
  await AsyncStorage.setItem(K(key), JSON.stringify(list));
}

const EXP_COLS = [
  'invoice_number','category','title','amount','payment_method','bank','account_number',
  'payer_name','payer_code','receiver_name','receiver_code','payment_date',
  'description','status','local_id','counterpart_type','counterpart_code'
];
function sanitizeExpense(p: any) {
  const out: any = {};
  EXP_COLS.forEach(k => { if (p[k] !== undefined) out[k] = p[k]; });
  if (!out.category) out.category = p.type || 'متفرقه';
  if (!out.payment_date) out.payment_date = p.date || '';
  if (out.amount !== undefined) out.amount = Number(out.amount) || 0;
  return out;
}

async function fetchAll(table: string, key: string): Promise<any[]> {
  const local = await readLocal(key);
  if (getMode() === 'offline') return local;
  try {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    const merged: Record<string, any> = {};
    local.forEach(x => { merged[x.local_id || x.id] = x; });
    (data || []).forEach(x => { merged[x.local_id || x.id] = x; });
    try {
      const q = await getQueue();
      q.forEach((it: any) => {
        if (it.op === 'createExpense' && it.payload) {
          const p = it.payload;
          const id = p.local_id || p.id;
          if (id) merged[id] = p;
        }
        if (it.op === 'deleteExpense') {
          const id = typeof it.payload === 'string' ? it.payload : (it.payload?.local_id || it.payload?.id);
          if (id) delete merged[id];
        }
      });
    } catch {}
    return Object.values(merged);
  } catch { return local; }
}

async function saveItem(table: string, key: string, item: any, op: 'createExpense' | 'updateExpense'): Promise<any> {
  const list = await readLocal(key);
  const idx = list.findIndex(x => (x.local_id || x.id) === (item.local_id || item.id));
  const newList = idx >= 0 ? list.map((x, i) => i === idx ? { ...x, ...item } : x) : [item, ...list];
  await writeLocal(key, newList);

  const clean: any = sanitizeExpense(item);
  delete clean.user_id;
  delete clean.id;

  if (getMode() === 'online') {
    try {
      await supabase.from(table).upsert(clean, { onConflict: 'local_id' });
    } catch {
      await enqueue(op, item);
    }
  } else {
    await enqueue(op, item);
  }
  return item;
}

async function removeById(table: string, key: string, id: string) {
  const list = await readLocal(key);
  await writeLocal(key, list.filter(x => x.local_id !== id && x.id !== id));

  if (getMode() === 'online') {
    try {
      await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id);
    } catch {
      await enqueue('deleteExpense', id);
    }
  } else {
    await enqueue('deleteExpense', id);
  }
}

export const getExpenses = () => fetchAll('expenses', 'expenses');

export async function createExpense(p: any): Promise<any> {
  const list = await readLocal('expenses');
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + pad(d.getMonth() + 1) + pad(d.getDate());
  let maxN = 1000;
  list.forEach(x => {
    const m = String(x.invoice_number || '').match(/^EX-\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 9999999) maxN = n; }
  });
  const inv = p.invoice_number || ('EX-' + ds + '-' + (maxN + 1));
  const item = { ...p, invoice_number: inv, local_id: gid(), created_at: new Date().toISOString() };
  return saveItem('expenses', 'expenses', item, 'createExpense');
}

export const updateExpense = (id: string, p: any) => saveItem('expenses', 'expenses', { ...p, local_id: id }, 'updateExpense');
export const deleteExpense = (id: string) => removeById('expenses', 'expenses', id);
