// lib.fx.ts — لایه داده صرافی
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
    const m: Record<string, any> = {};
    local.forEach(x => { m[x.local_id || x.id] = x; });
    data.forEach(x => { m[x.local_id || x.id] = x; });
    return Object.values(m);
  } catch { return local; }
}

async function saveItem(table: string, key: string, item: any): Promise<any> {
  const list = await readLocal(key);
  const idx = list.findIndex(x => (x.local_id || x.id) === (item.local_id || item.id));
  const newList = idx >= 0 ? list.map((x, i) => i === idx ? { ...x, ...item } : x) : [item, ...list];
  await writeLocal(key, newList);
  const clean: any = { ...item }; delete clean.user_id; delete clean.id;
  setTimeout(async () => { try { await supabase.from(table).upsert(clean, { onConflict: 'local_id' }); } catch {} }, 0);
  return item;
}

async function removeById(table: string, key: string, id: string) {
  const list = await readLocal(key);
  await writeLocal(key, list.filter(x => x.local_id !== id && x.id !== id));
  try { await supabase.from(table).delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  مشتریان / خریداران
// ═══════════════════════════════════════════
export const getFxCustomers = () => fetchAll('fx_customers', 'fx_customers');

export async function findFxCustomerByPhone(phone: string, type: string) {
  const list = await readLocal('fx_customers');
  const p = String(phone).replace(/[^\d]/g, '');
  return list.find((x: any) => String(x.phone || '').replace(/[^\d]/g, '') === p && (x.type || 'customer') === type) || null;
}

export async function createFxCustomer(p: any): Promise<any> {
  const list = await readLocal('fx_customers');
  const type = p.type || 'customer';
  const prefix = type === 'buyer' ? 'B_' : 'X_';
  let maxN = 1000;
  list.filter((x: any) => (x.type || 'customer') === type).forEach((x: any) => {
    const m = String(x.code || '').match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) { const n = +m[1]; if (n > maxN) maxN = n; }
  });
  const code = p.code || (prefix + (maxN + 1));
  const item = { ...p, code, type, local_id: gid(), created_at: new Date().toISOString() };
  return saveItem('fx_customers', 'fx_customers', item);
}
export const updateFxCustomer = (id: string, p: any) => saveItem('fx_customers', 'fx_customers', { ...p, local_id: id });
export const deleteFxCustomer = (id: string) => removeById('fx_customers', 'fx_customers', id);

// ═══════════════════════════════════════════
//  معاملات
// ═══════════════════════════════════════════
export const getFxTrades = () => fetchAll('fx_trades', 'fx_trades');

export async function createFxTrade(p: any): Promise<any> {
  const list = await readLocal('fx_trades');
  const d = new Date();
  const ds = String(d.getFullYear()).slice(-2) + pad(d.getMonth() + 1) + pad(d.getDate());
  let maxN = 1000;
  list.forEach((x: any) => {
    const m = String(x.invoice_number || '').match(/^FX-\d{6}-(\d+)$/);
    if (m) { const n = +m[1]; if (n > maxN && n < 9999999) maxN = n; }
  });
  const inv = p.invoice_number || ('FX-' + ds + '-' + (maxN + 1));
  const item = { ...p, invoice_number: inv, local_id: gid(), created_at: new Date().toISOString() };
  return saveItem('fx_trades', 'fx_trades', item);
}
export const updateFxTrade = (id: string, p: any) => saveItem('fx_trades', 'fx_trades', { ...p, local_id: id });
export const deleteFxTrade = (id: string) => removeById('fx_trades', 'fx_trades', id);
