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

export async function doTransfer(p: { from_box_code: string; to_box_code: string; amount: number; to_amount?: number; rate?: number; from_currency?: string; to_currency?: string; date: string; description?: string; counterparty_code?: string; counterparty_name?: string }): Promise<void> {
  const boxes = await getBoxes();
  const from = boxes.find((b: any) => b.code === p.from_box_code);
  const to = boxes.find((b: any) => b.code === p.to_box_code);
  if (!from || !to) throw new Error('صندوق پیدا نشد');
  const amt = Number(p.amount) || 0;
  const sameCur = (from.currency || '') === (to.currency || '');
  const rate = sameCur ? 1 : (Number(p.rate) || 0);
  const toAmt = sameCur ? amt : (Number(p.to_amount) || (amt * rate));
  if (!sameCur && rate <= 0) throw new Error('نرخ تبدیل الزامی');
  if (amt <= 0) throw new Error('مبلغ نامعتبر');
  const ts = Date.now();
  const codeBase = 'TX-' + ts;
  const typeLabel = sameCur ? 'انتقال' : 'تبدیل';

  // ⭐ طرف حساب: از پارامتر یا از صاحب صندوق مبدأ/مقصد
  const fromOwnerCode = from.owner_code || '';
  const fromOwnerName = from.owner_name || '';
  const toOwnerCode = to.owner_code || '';
  const toOwnerName = to.owner_name || '';

  // ═══ تراکنش خروج از مبدأ: طرف حساب = صاحب مقصد ═══
  await addBoxTransaction({
    box_id: from.id || from.local_id, box_code: from.code, type: 'transfer_out',
    out: amt, in: 0, currency: from.currency, related_box_code: to.code,
    rate: sameCur ? 0 : rate,
    counterparty_code: p.counterparty_code || toOwnerCode,
    counterparty_name: p.counterparty_name || toOwnerName,
    owner_code: fromOwnerCode, owner_name: fromOwnerName,
    description: p.description || (typeLabel + ' به ' + to.name + (sameCur ? '' : ' — نرخ ' + rate)),
    date: p.date, code: codeBase + '-1',
  });

  // ═══ تراکنش ورود به مقصد: طرف حساب = صاحب مبدأ ═══
  await addBoxTransaction({
    box_id: to.id || to.local_id, box_code: to.code, type: 'transfer_in',
    in: toAmt, out: 0, currency: to.currency, related_box_code: from.code,
    rate: sameCur ? 0 : rate,
    counterparty_code: p.counterparty_code || fromOwnerCode,
    counterparty_name: p.counterparty_name || fromOwnerName,
    owner_code: toOwnerCode, owner_name: toOwnerName,
    description: p.description || (typeLabel + ' از ' + from.name + (sameCur ? '' : ' — نرخ ' + rate)),
    date: p.date, code: codeBase + '-2',
  });
  console.log('[doTransfer] DONE — from owner:', fromOwnerCode, 'to owner:', toOwnerCode);
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


// ═══ تراکنش‌های مرتبط با یک کد طرف حساب ═══
export async function getBoxTxsByCounterparty(code: string): Promise<any[]> {
  if (!code) return [];
  const k = String(code).toLowerCase();
  const txs = await getBoxTransactions();
  const boxes = await getBoxes();
  const boxMap: Record<string, any> = {};
  boxes.forEach((b: any) => { boxMap[String(b.id || b.local_id)] = b; });
  return txs.filter((t: any) => {
    // ۱. مستقیم
    if (String(t.counterparty_code || '').toLowerCase() === k) return true;
    if (String(t.owner_code || '').toLowerCase() === k) return true;
    if (String(t.box_code || '').toLowerCase() === k) return true;
    // ۲. از طریق صندوق (fallback برای تراکنش‌های قدیمی)
    const box = boxMap[String(t.box_id || '')];
    if (box && String(box.owner_code || '').toLowerCase() === k) return true;
    return false;
  });
}

// ═══ auto-backfill: هر بار که getBoxTxsByCounterparty صدا زده شد، قدیمی‌ها رو اصلاح کن ═══
async function backfillBoxTxs(): Promise<void> {
  try {
    const boxes = await getBoxes();
    const txs = await getBoxTransactions();
    const boxMap: Record<string, any> = {};
    boxes.forEach((b: any) => { boxMap[String(b.id || b.local_id)] = b; });
    let changed = false;
    const next = txs.map((t: any) => {
      const box = boxMap[String(t.box_id || '')];
      if (box && box.owner_code && !t.counterparty_code) {
        changed = true;
        return { ...t, counterparty_code: box.owner_code, counterparty_name: box.owner_name, owner_code: box.owner_code, owner_name: box.owner_name };
      }
      return t;
    });
    if (changed) {
      await AsyncStorage.setItem(TX_KEY, JSON.stringify(next));
      console.log('[backfillBoxTxs] ✅ اصلاح شد');
    }
  } catch (e) { console.log('backfill error:', e); }
}
export { backfillBoxTxs };

// ═══ خلاصه صندوق برای یک شخص ═══
export async function getBoxSummaryForPerson(code: string): Promise<{ given: Record<string, number>; received: Record<string, number>; txCount: number }> {
  const txs = await getBoxTxsByCounterparty(code);
  const given: Record<string, number> = {};
  const received: Record<string, number> = {};
  txs.forEach((t: any) => {
    const cur = t.currency || '';
    if (Number(t.out) > 0) given[cur] = (given[cur] || 0) + Number(t.out);
    if (Number(t.in) > 0) received[cur] = (received[cur] || 0) + Number(t.in);
  });
  return { given, received, txCount: txs.length };
}
