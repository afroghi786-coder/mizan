// lib.boxes.ts — صندوق استاندارد
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOX_KEY = '@mizan_local_fx_boxes';
const TX_KEY = '@mizan_local_fx_box_tx';
const OLD_TRANSFER_KEY = '@mizan_local_fx_transfers';

export const TYPE_LABEL: Record<string, string> = {
  opening: 'افتتاحیه', deposit: 'واریز نقدی', withdraw: 'برداشت نقدی',
  transfer_in: 'دریافت از صندوق', transfer_out: 'ارسال به صندوق',
  fee_in: 'کارمزد دریافتی', fee_out: 'کارمزد پرداختی',
  adjust_in: 'تعدیل افزایش', adjust_out: 'تعدیل کاهش',
};

export async function getBoxes(): Promise<any[]> {
  try { const r = await AsyncStorage.getItem(BOX_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

export async function saveBox(box: any): Promise<any> {
  const all = await getBoxes();
  const id = box.id || box.local_id || ('bx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  let code = box.code;
  if (!code) {
    let m = 100;
    all.forEach((x: any) => { const g = String(x.code || '').match(/^BX-(\d+)$/); if (g) m = Math.max(m, +g[1]); });
    code = 'BX-' + (m + 1);
  }
  const item = { ...box, id, local_id: id, code, updated_at: new Date().toISOString(), created_at: box.created_at || new Date().toISOString() };
  const idx = all.findIndex((x: any) => (x.id || x.local_id) === id);
  const next = idx >= 0 ? all.map((x: any, i: number) => i === idx ? item : x) : [item, ...all];
  await AsyncStorage.setItem(BOX_KEY, JSON.stringify(next));
  return item;
}

export async function deleteBox(id: string): Promise<void> {
  const all = await getBoxes();
  await AsyncStorage.setItem(BOX_KEY, JSON.stringify(all.filter((x: any) => (x.id || x.local_id) !== id)));
}

export async function getBoxTransactions(boxId?: string): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(TX_KEY);
    const all = r ? JSON.parse(r) : [];
    return boxId ? all.filter((t: any) => t.box_id === boxId) : all;
  } catch { return []; }
}

export async function addBoxTransaction(tx: any): Promise<any> {
  const all = await getBoxTransactions();
  const id = tx.id || ('tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  let m = 1000;
  all.forEach((x: any) => { const g = String(x.code || '').match(/^TX-(\d+)$/); if (g) m = Math.max(m, +g[1]); });
  const code = tx.code || ('TX-' + (m + 1));
  const item = { ...tx, id, code, local_id: id, created_at: tx.created_at || new Date().toISOString() };
  const idx = all.findIndex((x: any) => (x.id || x.local_id) === id);
  const next = idx >= 0 ? all.map((x: any, i: number) => i === idx ? item : x) : [item, ...all];
  await AsyncStorage.setItem(TX_KEY, JSON.stringify(next));
  return item;
}

export async function deleteBoxTransaction(id: string): Promise<void> {
  const all = await getBoxTransactions();
  await AsyncStorage.setItem(TX_KEY, JSON.stringify(all.filter((t: any) => (t.id || t.local_id) !== id)));
}

export async function getAllBalances(): Promise<Record<string, number>> {
  const boxes = await getBoxes();
  const txs = await getBoxTransactions();
  const result: Record<string, number> = {};
  boxes.forEach((b: any) => {
    const id = b.id || b.local_id;
    let bal = Number(b.opening) || 0;
    txs.filter((t: any) => t.box_id === id).forEach((t: any) => {
      bal += Number(t.in) || 0;
      bal -= Number(t.out) || 0;
    });
    result[id] = bal;
  });
  return result;
}

export async function getBoxKardex(boxId: string): Promise<any[]> {
  const box = (await getBoxes()).find((b: any) => (b.id || b.local_id) === boxId);
  if (!box) return [];
  const txs = await getBoxTransactions(boxId);
  const sorted = [...txs].sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  let running = Number(box.opening) || 0;
  const rows: any[] = [{
    id: '_opening_', code: '—', type: 'opening', type_label: TYPE_LABEL.opening,
    in: Number(box.opening) || 0, out: 0, running, date: box.created_at || '', description: 'موجودی افتتاحیه',
  }];
  sorted.forEach((t: any) => {
    running += (Number(t.in) || 0) - (Number(t.out) || 0);
    rows.push({ ...t, type_label: TYPE_LABEL[t.type] || t.type, running });
  });
  return rows;
}

export async function doTransfer(p: { from_box_code: string; to_box_code: string; amount: number; date: string; description?: string }): Promise<void> {
  const boxes = await getBoxes();
  const from = boxes.find((b: any) => b.code === p.from_box_code);
  const to = boxes.find((b: any) => b.code === p.to_box_code);
  if (!from || !to) throw new Error('صندوق پیدا نشد');
  if ((from.currency || '') !== (to.currency || '')) throw new Error('ارز دو صندوق یکسان نیست');
  const amt = Number(p.amount) || 0;
  const code = 'TX-' + Date.now();
  await addBoxTransaction({
    box_id: from.id || from.local_id, box_code: from.code, type: 'transfer_out',
    out: amt, in: 0, currency: from.currency, related_box_code: to.code,
    description: p.description || ('انتقال به ' + to.name), date: p.date, code: code + '-1',
  });
  await addBoxTransaction({
    box_id: to.id || to.local_id, box_code: to.code, type: 'transfer_in',
    in: amt, out: 0, currency: to.currency, related_box_code: from.code,
    description: p.description || ('دریافت از ' + from.name), date: p.date, code: code + '-2',
  });
}

export async function migrateOldTransfers(): Promise<void> {
  try {
    const r = await AsyncStorage.getItem(OLD_TRANSFER_KEY);
    if (!r) return;
    const old = JSON.parse(r);
    if (!Array.isArray(old) || !old.length) {
      await AsyncStorage.removeItem(OLD_TRANSFER_KEY);
      return;
    }
    const boxes = await getBoxes();
    const existing = await getBoxTransactions();
    if (existing.length) {
      await AsyncStorage.removeItem(OLD_TRANSFER_KEY);
      return;
    }
    for (const t of old) {
      const from = boxes.find((b: any) => b.code === t.from_box);
      const to = boxes.find((b: any) => b.code === t.to_box);
      const amt = Number(t.amount) || 0;
      if (from) await addBoxTransaction({
        box_id: from.id || from.local_id, box_code: from.code, type: 'transfer_out',
        out: amt, in: 0, currency: from.currency, related_box_code: t.to_box,
        description: 'انتقال قبلی → ' + t.to_box, date: t.date || '', code: t.code || '',
      });
      if (to) await addBoxTransaction({
        box_id: to.id || to.local_id, box_code: to.code, type: 'transfer_in',
        in: amt, out: 0, currency: to.currency, related_box_code: t.from_box,
        description: 'انتقال قبلی ← ' + t.from_box, date: t.date || '', code: t.code || '',
      });
    }
    await AsyncStorage.removeItem(OLD_TRANSFER_KEY);
    console.log('✅ Migration: ' + old.length + ' انتقال قدیمی منتقل شد');
  } catch (e) { console.log('migrate error:', e); }
}
