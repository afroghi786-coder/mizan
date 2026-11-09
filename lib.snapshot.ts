import AsyncStorage from './lib.storage';

const CACHE_MS = 5000;
const _cache: Record<string, { at: number; list: any[] }> = {};

async function _readAllKeys(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return Array.isArray(keys) ? keys : [];
  } catch { return []; }
}

async function _readTable(table: string): Promise<any[]> {
  const now = Date.now();
  const c = _cache[table];
  if (c && now - c.at < CACHE_MS) return c.list;
  try {
    const tableKeys: string[] = [table];
    if (table === 'sales') tableKeys.push('sales_grouped');
    if (table === 'purchases') tableKeys.push('purchases_grouped');
    if (table === 'sales_returns') tableKeys.push('sales_returns_grouped');
    if (table === 'purchase_returns') tableKeys.push('purchase_returns_grouped');

    const allKeys = await _readAllKeys();
    const result: any[] = [];
    for (const k of allKeys) {
      let matched = false;
      for (const tk of tableKeys) {
        if (k === '@mizan_local_' + tk) { matched = true; break; }
        if (k.endsWith('_local_' + tk)) { matched = true; break; }
      }
      if (!matched) continue;
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) result.push(...arr);
      } catch {}
    }
    _cache[table] = { at: now, list: result };
    return result;
  } catch { return []; }
}

function _rowKey(r: any): string {
  if (!r) return '';
  const fields = ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id'];
  for (const f of fields) {
    const v = r[f];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}

export type RowSnapshot = {
  primary: string;
  secondary?: string;
  phone?: string;
  amount?: number;
  date?: string;
  raw?: any;
};

export async function getRowSnapshot(table: string, key: string): Promise<RowSnapshot | null> {
  try {
    const k = String(key || '').trim();
    if (!k) return null;
    const list = await _readTable(table);
    const row = list.find((r) => _rowKey(r) === k);
    if (!row) return null;

    switch (table) {
      case 'sales':
      case 'purchases':
        return {
          primary: row.name || row.customer_name || row.supplier_name || '',
          secondary: row.invoice || row.invoice_number || '',
          phone: row.phone || '',
          amount: Number(row.total) || 0,
          date: row.date || '',
          raw: row,
        };
      case 'sales_returns':
      case 'purchase_returns':
        return {
          primary: row.name || row.customer_name || row.supplier_name || '',
          secondary: row.invoice || row.invoice_number || '',
          amount: Number(row.total) || 0,
          date: row.date || '',
          raw: row,
        };
      case 'products':
        return { primary: row.name || '', secondary: row.code || '', raw: row };
      case 'partners':
      case 'parties':
        return { primary: row.name || '', secondary: row.code || '', phone: row.phone || '', raw: row };
      case 'banks':
        return { primary: row.name || '', secondary: row.account_number || '', raw: row };
      case 'shippings':
        return { primary: row.name || '', phone: row.phone || '', raw: row };
      case 'expenses':
        return { primary: row.title || row.name || '', amount: Number(row.amount) || 0, date: row.date || '', raw: row };
      case 'employees':
        return { primary: row.name || '', secondary: row.code || '', phone: row.phone || '', raw: row };
      case 'salary_payments':
        return { primary: row.employee_name || row.name || '', amount: Number(row.amount) || 0, date: row.date || '', raw: row };
      case 'employee_loans':
        return { primary: row.employee_name || row.name || '', amount: Number(row.amount) || 0, date: row.date || '', raw: row };
      case 'attendance':
        return { primary: row.employee_name || '', date: row.date || '', raw: row };
      case 'employee_leaves':
        return { primary: row.employee_name || '', date: row.date || '', raw: row };
      case 'payroll_batches':
        return { primary: row.batch_number || row.title || '', amount: Number(row.total) || 0, raw: row };
      case 'stock_adjustments':
        return { primary: row.product_name || row.name || '', secondary: row.product_code || '', amount: Number(row.quantity) || 0, date: row.date || '', raw: row };
      case 'partner_transactions':
        return { primary: row.partner_name || '', secondary: row.description || '', amount: Number(row.amount) || 0, date: row.date || '', raw: row };
      case 'partner_bank_accounts':
        return { primary: row.bank_name || '', secondary: row.account_number || row.card_number || '', raw: row };
      default:
        return { primary: k, raw: row };
    }
  } catch (e: any) {
    console.log('[snapshot]', e?.message);
    return null;
  }
}

export function clearSnapshotCache(): void {
  for (const k of Object.keys(_cache)) delete _cache[k];
}

export function formatAmount(n: number): string {
  try {
    if (!n || isNaN(n)) return '';
    return Number(n).toLocaleString('fa-IR');
  } catch { return String(n); }
}
