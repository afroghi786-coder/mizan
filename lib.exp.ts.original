// lib.exp.ts — هزینه‌ها (استاندارد)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib';

const K = (k: string) => '@mizan_local_' + k;
const gid = () => 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
const pad = (n: number) => String(n).padStart(2, '0');

async function readLocal(key: string): Promise<any[]> {
  try { const r = await AsyncStorage.getItem(K(key)); if (!r) return []; const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function writeLocal(key: string, list: any[]) { await AsyncStorage.setItem(K(key), JSON.stringify(list)); }

async function fetchAll(table: string, key: string): Promise<any[]> {
  const local = await readLocal(key);
  try {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error || !data || !data.length) return local;
    const merged: Record<string, any> = {};
    local.forEach(x => { merged[x.local_id || x.id] = x; });
    data.forEach(x => { merged[x.local_id || x.id] = x; });
    return Object.values(merged);
  } catch { return local; }
}

async function saveItem(table: string, key: string, item: any): Promise<any> {
  const list = await readLocal(key);
  const idx = list.findIndex(x => (x.local_id || x.id) === (item.local_id || item.id));
  const newList = idx >= 0 ? list.map((x, i) => i === idx ? { ...x, ...item } : x) : [item, ...list];
  await writeLocal(key, newList);
  const clean: any = { ...item };
  delete clean.user_id; delete clean.id;
  setTimeout(async () => {
    try { await supabase.from(table).upsert(clean, { onConflict: 'local_id' }); } catch {}
  }, 0);
  return item;
}

async function removeById(table: string, key: string, id: string) {
  const list = await readLocal(key);
  await writeLocal(key, list.filter(x => x.local_id !== id && x.id !== id));
  try { await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
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
  return saveItem('expenses', 'expenses', item);
}
export const updateExpense = (id: string, p: any) => saveItem('expenses', 'expenses', { ...p, local_id: id });
export const deleteExpense = (id: string) => removeById('expenses', 'expenses', id);
