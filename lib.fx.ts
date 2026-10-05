// lib.fx.ts — ماژول کامل صرافی: حواله + صندوق + چک + کاردکس
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib';
import * as lib from './lib';

const MODE = () => (lib as any).__getMode?.() || 'online';
const getLocal = async (k: string) => {
  const raw = await AsyncStorage.getItem('@mizan_local_' + k);
  return raw ? JSON.parse(raw) : null;
};
const setLocal = async (k: string, v: any) => {
  await AsyncStorage.setItem('@mizan_local_' + k, JSON.stringify(v));
};

// ═══════════════════════════════════════════
//  حواله‌جات
// ═══════════════════════════════════════════
export async function getHawalas(): Promise<any[]> {
  try { const r = await getLocal('fx_hawalas'); return r || []; } catch { return []; }
}
export async function createHawala(p: any): Promise<any> {
  const list = await getHawalas();
  let maxN = 1000;
  list.forEach((x: any) => { const m = String(x.code || '').match(/^HW-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const code = p.code || 'HW-' + (maxN + 1);
  const item = { ...p, code, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString() };
  await setLocal('fx_hawalas', [item, ...list]);
  try { await supabase.from('fx_hawalas').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateHawala(id: string, p: any) {
  const list = await getHawalas();
  await setLocal('fx_hawalas', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('fx_hawalas').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteHawala(id: string) {
  const list = await getHawalas();
  await setLocal('fx_hawalas', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('fx_hawalas').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  صندوق‌ها
// ═══════════════════════════════════════════
export async function getBoxes(): Promise<any[]> {
  try { const r = await getLocal('fx_boxes'); return r || []; } catch { return []; }
}
export async function createBox(p: any): Promise<any> {
  const list = await getBoxes();
  let maxN = 100;
  list.forEach((x: any) => { const m = String(x.code || '').match(/^BX-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const code = p.code || 'BX-' + (maxN + 1);
  const item = { ...p, code, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString() };
  await setLocal('fx_boxes', [item, ...list]);
  try { await supabase.from('fx_boxes').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateBox(id: string, p: any) {
  const list = await getBoxes();
  await setLocal('fx_boxes', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('fx_boxes').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteBox(id: string) {
  const list = await getBoxes();
  await setLocal('fx_boxes', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('fx_boxes').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  انتقالات
// ═══════════════════════════════════════════
export async function getTransfers(): Promise<any[]> {
  try { const r = await getLocal('fx_transfers'); return r || []; } catch { return []; }
}
export async function createTransfer(p: any): Promise<any> {
  const list = await getTransfers();
  let maxN = 1000;
  list.forEach((x: any) => { const m = String(x.code || '').match(/^TR-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const code = p.code || 'TR-' + (maxN + 1);
  const item = { ...p, code, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString() };
  await setLocal('fx_transfers', [item, ...list]);
  try { await supabase.from('fx_transfers').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function deleteTransfer(id: string) {
  const list = await getTransfers();
  await setLocal('fx_transfers', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('fx_transfers').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}

// ═══════════════════════════════════════════
//  چک‌ها
// ═══════════════════════════════════════════
export async function getChecks(): Promise<any[]> {
  try { const r = await getLocal('fx_checks'); return r || []; } catch { return []; }
}
export async function createCheck(p: any): Promise<any> {
  const list = await getChecks();
  let maxN = 1000;
  list.forEach((x: any) => { const m = String(x.code || '').match(/^CK-(\d+)$/); if (m) { const n = +m[1]; if (n > maxN) maxN = n; } });
  const code = p.code || 'CK-' + (maxN + 1);
  const item = { ...p, code, local_id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString() };
  await setLocal('fx_checks', [item, ...list]);
  try { await supabase.from('fx_checks').insert({ ...item, user_id: undefined, id: undefined }); } catch {}
  return item;
}
export async function updateCheck(id: string, p: any) {
  const list = await getChecks();
  await setLocal('fx_checks', list.map((x: any) => (x.local_id === id || x.id === id) ? { ...x, ...p } : x));
  try { await supabase.from('fx_checks').update(p).or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
export async function deleteCheck(id: string) {
  const list = await getChecks();
  await setLocal('fx_checks', list.filter((x: any) => x.local_id !== id && x.id !== id));
  try { await supabase.from('fx_checks').delete().or('local_id.eq.' + id + ',id.eq.' + id); } catch {}
}
