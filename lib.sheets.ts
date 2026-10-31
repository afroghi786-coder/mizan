import { Platform, Linking } from 'react-native';
import { supabase } from './lib';
import AsyncStorage from './lib.storage';
import { syncToServer, getQueue, getDirtyTables, removeDirtyTables, setDirtyTables } from './lib.offline';

const FN_BASE = 'https://paslxvwlbojdzflbmyoh.supabase.co/functions/v1';
const DEST_KEY = '@mizan_sync_destination';

const TAB_TASKS: { tab: string; keys: string[] }[] = [
  { tab: 'sales', keys: ['@mizan_local_sales_grouped'] },
  { tab: 'purchases', keys: ['@mizan_local_purchases_grouped'] },
  { tab: 'expenses', keys: ['@mizan_local_expenses'] },
  { tab: 'employees', keys: ['@mizan_local_employees'] },
  { tab: 'salary_payments', keys: ['@mizan_local_salary_payments'] },
  { tab: 'employee_loans', keys: ['@mizan_local_employee_loans'] },
  { tab: 'attendance', keys: ['@mizan_local_attendance'] },
  { tab: 'employee_leaves', keys: ['@mizan_local_employee_leaves'] },
  { tab: 'payroll_batches', keys: ['@mizan_local_payroll_batches'] },
  { tab: 'parties', keys: ['@mizan_local_parties'] },
  { tab: 'partners', keys: ['@mizan_local_partners'] },
  { tab: 'partner_transactions', keys: ['@mizan_local_ptx_'] },
  { tab: 'partner_bank_accounts', keys: ['@mizan_local_pba_'] },
  { tab: 'products', keys: ['@mizan_local_products'] },
  { tab: 'settings', keys: ['@mizan_local_settings'] },
  { tab: 'banks', keys: ['@mizan_local_banks'] },
  { tab: 'shippings', keys: ['@mizan_local_shippings'] },
  { tab: 'stock_adjustments', keys: ['@mizan_local_stock_adjustments'] },
  { tab: '_deleted', keys: ['@mizan_tombstones'] },
  { tab: '_audit', keys: ['@mizan_audit_events'] },
];

export type SyncDestination = 'server' | 'private' | 'both';

export async function getSyncDestination(): Promise<SyncDestination> {
  const v = await AsyncStorage.getItem(DEST_KEY);
  if (v === 'server' || v === 'private' || v === 'both') return v;
  return 'private';
}

export async function setSyncDestination(v: SyncDestination) {
  await AsyncStorage.setItem(DEST_KEY, v);
}

const BRIDGE_URL_KEY = '@mizan_bridge_url';
const BRIDGE_SECRET_KEY = '@mizan_bridge_key';

export async function getBridgeConfig() {
  let url = (await AsyncStorage.getItem(BRIDGE_URL_KEY)) || '';
  let key = (await AsyncStorage.getItem(BRIDGE_SECRET_KEY)) || '';

  if (url && key) return { url, key };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await supabase
        .from('google_sheet_connections')
        .select('bridge_url, bridge_key')
        .eq('user_id', user.id)
        .maybeSingle();
      const su = String(data?.bridge_url || '').trim();
      const sk = String(data?.bridge_key || '').trim();
      if (su && sk) {
        await AsyncStorage.setItem(BRIDGE_URL_KEY, su);
        await AsyncStorage.setItem(BRIDGE_SECRET_KEY, sk);
        url = su;
        key = sk;
      } else {
        if (!url && su) { url = su; await AsyncStorage.setItem(BRIDGE_URL_KEY, su); }
        if (!key && sk) { key = sk; await AsyncStorage.setItem(BRIDGE_SECRET_KEY, sk); }
      }
    }
  } catch {}

  return { url, key };
}

export async function setBridgeConfig(url: string, key: string) {
  const u = String(url || '').trim();
  const k = String(key || '').trim();

  await AsyncStorage.setItem(BRIDGE_URL_KEY, u);
  await AsyncStorage.setItem(BRIDGE_SECRET_KEY, k);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: existing } = await supabase
        .from('google_sheet_connections')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('google_sheet_connections')
          .update({
            bridge_url: u || null,
            bridge_key: k || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('google_sheet_connections')
          .insert({
            user_id: user.id,
            refresh_token: '',
            bridge_url: u || null,
            bridge_key: k || null,
            updated_at: new Date().toISOString(),
          });
      }
    }
  } catch {}
}

export async function bridgePing() {
  const cfg = await getBridgeConfig();
  if (!cfg.url) throw new Error('آدرس واسط امن وارد نشده است');
  if (!cfg.key) throw new Error('کلید امن واسط وارد نشده است');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'ping', key: cfg.key }),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error('خطای واسط: ' + (data?.error || res.status));
  if (!data || data.ok !== true) throw new Error('پاسخ نامعتبر: ' + (data?.error || txt.slice(0, 120)));
  return data;
}

export async function bridgePull() {
  const cfg = await getBridgeConfig();
  if (!cfg.url) throw new Error('آدرس واسط امن وارد نشده است');
  if (!cfg.key) throw new Error('کلید امن واسط وارد نشده است');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'pull', key: cfg.key }),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error('خطای واسط: ' + (data?.error || res.status));
  if (!data || data.ok !== true) throw new Error('پاسخ نامعتبر: ' + (data?.error || txt.slice(0, 120)));
  return data;
}

export async function bridgeSaveTest() {
  const cfg = await getBridgeConfig();
  if (!cfg.url) throw new Error('آدرس واسط امن وارد نشده است');
  if (!cfg.key) throw new Error('کلید امن واسط وارد نشده است');
  const row = { test: 'ok', at: new Date().toISOString(), device: (await AsyncStorage.getItem('@mizan_device_id')) || '' };
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'save', key: cfg.key, table: '_bridge_test', rows: [row] }),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error('خطای واسط: ' + (data?.error || res.status));
  if (!data || data.ok !== true) throw new Error('پاسخ نامعتبر: ' + (data?.error || txt.slice(0, 120)));
  return data;
}

export async function bridgeSaveTable(table: string, rows: any[]) {
  const cfg = await getBridgeConfig();
  if (!cfg.url) throw new Error('آدرس واسط امن وارد نشده است');
  if (!cfg.key) throw new Error('کلید امن واسط وارد نشده است');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'save', key: cfg.key, table: table, rows: rows || [] }),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error('خطای واسط: ' + (data?.error || res.status));
  if (!data || data.ok !== true) throw new Error('پاسخ نامعتبر: ' + (data?.error || txt.slice(0, 120)));
  return data;
}

export async function bridgeUpsertTable(table: string, rows: any[]) {
  const cfg = await getBridgeConfig();
  if (!cfg.url) throw new Error('آدرس واسط امن وارد نشده است');
  if (!cfg.key) throw new Error('کلید امن واسط وارد نشده است');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'upsert', key: cfg.key, table: table, rows: rows || [] }),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!res.ok) throw new Error('خطای واسط: ' + (data?.error || res.status));
  if (!data || data.ok !== true) throw new Error('پاسخ نامعتبر: ' + (data?.error || txt.slice(0, 120)));
  return data;
}

export async function bridgeSaveAll() {
  const cfg = await getBridgeConfig();
  if (!cfg.url) throw new Error('آدرس واسط امن وارد نشده است');
  if (!cfg.key) throw new Error('کلید امن واسط وارد نشده است');
  const allKeys = await getAllMizanKeys();
  const summary: any[] = [];
  for (const t of TAB_TASKS) {
    const rows: any[] = [];
    for (const key of t.keys) {
      if (key.endsWith('_')) {
        for (const k of allKeys) {
          if (k.startsWith(key)) {
            const v = await AsyncStorage.getItem(k);
            if (v) {
              try {
                const arr = JSON.parse(v);
                if (Array.isArray(arr)) rows.push(...arr);
              } catch {}
            }
          }
        }
      } else {
        const v = await AsyncStorage.getItem(key);
        if (v) {
          try {
            const arr = JSON.parse(v);
            if (Array.isArray(arr)) rows.push(...arr);
            else if (arr && typeof arr === 'object') rows.push(arr);
          } catch {}
        }
      }
    }
    await bridgeSaveTable(t.tab, rows);
    summary.push({ tab: t.tab, rows: rows.length });
  }
  return { ok: true, summary };
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function getAllMizanKeys(): Promise<string[]> {
  if (Platform.OS === 'web') {
    try { return Object.keys(localStorage).filter(k => k.startsWith('@mizan_')); } catch { return []; }
  }
  try {
    const anyAS: any = AsyncStorage as any;
    if (typeof anyAS.getAllKeys === 'function') {
      const keys = await anyAS.getAllKeys();
      return (keys || []).filter((k: string) => k.startsWith('@mizan_'));
    }
  } catch {}
  return [];
}

export async function getPrivateConnection() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('google_sheet_connections')
    .select('email, spreadsheet_id, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  return data || null;
}

export async function startPrivateOAuth() {
  const token = await getToken();
  if (!token) throw new Error('لطفاً وارد شوید');
  const res = await fetch(FN_BASE + '/google-oauth-start', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  const data: any = await res.json();
  if (!res.ok || !data.authUrl) throw new Error(data.error || 'خطا در شروع اتصال');
  if (Platform.OS === 'web') window.open(data.authUrl, '_blank');
  else await Linking.openURL(data.authUrl);
  return true;
}

export async function syncPrivateTables(onProgress?: (done: number, total: number, tab: string) => void) {
  const token = await getToken();
  if (!token) throw new Error('لطفاً وارد شوید');
  const rawDirty = await AsyncStorage.getItem('@mizan_dirty_tables');
  const hasDirtyKey = rawDirty !== null;
  let dirty: string[] = [];
  if (hasDirtyKey) { try { dirty = JSON.parse(rawDirty as string); } catch { dirty = []; } }
  if (!Array.isArray(dirty)) dirty = [];

  const always = ['_deleted', '_audit'];
  let tablesToSync: { tab: string; keys: string[] }[] = [];
  if (!hasDirtyKey) {
    tablesToSync = TAB_TASKS;
  } else {
    const set = new Set([...dirty.map(String), ...always]);
    tablesToSync = TAB_TASKS.filter(t => set.has(t.tab));
  }

  if (!tablesToSync.length) {
    return [];
  }

  const total = tablesToSync.length;
  let done = 0;
  const results: any[] = [];
  const allKeys = await getAllMizanKeys();
  for (const t of tablesToSync) {
    const miniBackup: any = { app: 'mizan', keys: {} };
    for (const key of t.keys) {
      if (key.endsWith('_')) {
        for (const k of allKeys) {
          if (k.startsWith(key)) {
            const v = await AsyncStorage.getItem(k);
            if (v) miniBackup.keys[k] = v;
          }
        }
      } else {
        const v = await AsyncStorage.getItem(key);
        if (v) miniBackup.keys[key] = v;
      }
    }
    const res = await fetch(FN_BASE + '/google-sheets-sync', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: miniBackup, tables: [t.tab] }),
    });
    const data: any = await res.json();
    const ok = res.ok && data && data.ok !== false;
    results.push({ tab: t.tab, ok, data });
    done++;
    if (onProgress) onProgress(done, total, t.tab);
  }

  const successful = results.filter(r => r.ok).map(r => r.tab);
  if (!hasDirtyKey) {
    const failed = tablesToSync.filter(t => !successful.includes(t.tab)).map(t => t.tab);
    await setDirtyTables(failed);
  } else if (successful.length) {
    await removeDirtyTables(successful);
  }
  return results;
}

export async function pullBridgeTables(onProgress?: (done: number, total: number, tab: string) => void) {
  const cfg = await getBridgeConfig();
  if (!cfg.url || !cfg.key) throw new Error('واسط امن تنظیم نشده است');
  const data = await bridgePull();
  const tables = data?.tables || {};
  const total = PULL_TABLES.length;
  let done = 0;
  let added = 0, updated = 0, removed = 0;

  for (const tab of PULL_TABLES) {
    const rows = tables[tab] || [];
    let r = { added: 0, updated: 0, removed: 0 };
    if (tab === '_deleted') r = await mergeTombstones(rows);
    else if (tab === '_audit') r = await mergeAuditEvents(rows);
    else if (tab === 'sales') r = await mergeGroupedInvoices('@mizan_local_sales_grouped', rows);
    else if (tab === 'purchases') r = await mergeGroupedInvoices('@mizan_local_purchases_grouped', rows);
    else if (tab === 'partner_transactions') r = await mergePartnerPrefixed('@mizan_local_ptx_', rows);
    else if (tab === 'partner_bank_accounts') r = await mergePartnerPrefixed('@mizan_local_pba_', rows);
    else if (PULL_LOCAL_KEYS[tab]) r = await mergeList(PULL_LOCAL_KEYS[tab], rows);

    added += r.added; updated += r.updated; removed += r.removed;
    done++;
    if (onProgress) onProgress(done, total, tab);
  }

  return { ok: true, added, updated, removed, totalTables: total };
}

export async function syncBridgeTables(onProgress?: (done: number, total: number, tab: string) => void) {
  const cfg = await getBridgeConfig();
  if (!cfg.url || !cfg.key) throw new Error('واسط امن تنظیم نشده است');

  const rawDirty = await AsyncStorage.getItem('@mizan_dirty_tables');
  const hasDirtyKey = rawDirty !== null;
  let dirty: string[] = [];
  if (hasDirtyKey) { try { dirty = JSON.parse(rawDirty as string); } catch { dirty = []; } }
  if (!Array.isArray(dirty)) dirty = [];

  const always = ['_deleted', '_audit'];
  let tablesToSync: { tab: string; keys: string[] }[] = [];
  if (!hasDirtyKey) {
    tablesToSync = TAB_TASKS;
  } else {
    const set = new Set([...dirty.map(String), ...always]);
    tablesToSync = TAB_TASKS.filter(t => set.has(t.tab));
  }

  if (!tablesToSync.length) return [];

  const allKeys = await getAllMizanKeys();
  const total = tablesToSync.length;
  let done = 0;
  const results: any[] = [];

  for (const t of tablesToSync) {
    const rows: any[] = [];
    for (const key of t.keys) {
      if (key.endsWith('_')) {
        for (const k of allKeys) {
          if (k.startsWith(key)) {
            const v = await AsyncStorage.getItem(k);
            if (v) {
              try {
                const arr = JSON.parse(v);
                if (Array.isArray(arr)) rows.push(...arr);
              } catch {}
            }
          }
        }
      } else {
        const v = await AsyncStorage.getItem(key);
        if (v) {
          try {
            const arr = JSON.parse(v);
            if (Array.isArray(arr)) rows.push(...arr);
            else if (arr && typeof arr === 'object') rows.push(arr);
          } catch {}
        }
      }
    }
    try {
      const useSave = (t.tab === '_deleted' || t.tab === '_audit');
      if (!hasDirtyKey || useSave) {
        await bridgeSaveTable(t.tab, rows);
      } else {
        await bridgeUpsertTable(t.tab, rows);
      }
      results.push({ tab: t.tab, ok: true, rows: rows.length });
    } catch (e: any) {
      results.push({ tab: t.tab, ok: false, error: e?.message || String(e) });
    }
    done++;
    if (onProgress) onProgress(done, total, t.tab);
  }

  const successful = results.filter(r => r.ok).map(r => r.tab);
  if (!hasDirtyKey) {
    const failed = tablesToSync.filter(t => !successful.includes(t.tab)).map(t => t.tab);
    await setDirtyTables(failed);
  } else if (successful.length) {
    await removeDirtyTables(successful);
  }

  return results;
}

export async function syncByDestination(onProgress?: (done: number, total: number) => void) {
  const dest = await getSyncDestination();
  const cfg = await getBridgeConfig();
  const useBridge = !!(cfg.url && cfg.key);

  if (dest === 'server') {
    return await syncToServer(onProgress);
  }

  if (dest === 'private') {
    if (useBridge) {
      await pullBridgeTables((d, t) => onProgress?.(d, t));
      const rows = await syncBridgeTables((d, t) => onProgress?.(d, t));
      const ok = rows.filter(r => r.ok).length;
      return { ok, fail: rows.length - ok };
    }
    await pullPrivateTables((d, t) => onProgress?.(d, t));
    const rows = await syncPrivateTables((d, t) => onProgress?.(d, t));
    const ok = rows.filter(r => r.ok).length;
    return { ok, fail: rows.length - ok };
  }

  const serverRes = await syncToServer(onProgress);
  if (useBridge) {
    await pullBridgeTables((d, t) => onProgress?.(d, t));
    const rows = await syncBridgeTables((d, t) => onProgress?.(d, t));
    const pOk = rows.filter(r => r.ok).length;
    return { ok: serverRes.ok + pOk, fail: serverRes.fail + (rows.length - pOk) };
  }
  await pullPrivateTables((d, t) => onProgress?.(d, t));
  const rows = await syncPrivateTables((d, t) => onProgress?.(d, t));
  const pOk = rows.filter(r => r.ok).length;
  return { ok: serverRes.ok + pOk, fail: serverRes.fail + (rows.length - pOk) };
}

export async function clearAuditInSheet() {
  const token = await getToken();
  if (!token) throw new Error('لطفاً وارد شوید');
  const res = await fetch(FN_BASE + '/google-sheets-clear-audit', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data: any = await res.json();
  if (!res.ok || data?.ok !== true) {
    throw new Error(data?.error || data?.detail || 'خطا در پاک کردن تاریخچه شیت');
  }
  return true;
}

export async function disconnectPrivate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('google_sheet_connections').delete().eq('user_id', user.id);
}


const PULL_TABLES = [
  '_deleted','_audit','sales','purchases',
  'expenses','employees','salary_payments','employee_loans','attendance',
  'employee_leaves','payroll_batches','parties','partners','partner_transactions',
  'partner_bank_accounts','products','settings','banks','shippings','stock_adjustments',
];

const PULL_LOCAL_KEYS: Record<string, string> = {
  expenses: '@mizan_local_expenses',
  employees: '@mizan_local_employees',
  salary_payments: '@mizan_local_salary_payments',
  employee_loans: '@mizan_local_employee_loans',
  attendance: '@mizan_local_attendance',
  employee_leaves: '@mizan_local_employee_leaves',
  payroll_batches: '@mizan_local_payroll_batches',
  parties: '@mizan_local_parties',
  partners: '@mizan_local_partners',
  products: '@mizan_local_products',
  settings: '@mizan_local_settings',
  banks: '@mizan_local_banks',
  shippings: '@mizan_local_shippings',
  stock_adjustments: '@mizan_local_stock_adjustments',
};

function keyOfRow(r: any): string {
  return String(r?.local_id || r?.id || r?.code || r?.name || '');
}

function tsOf(v: any): number {
  const t = Date.parse(String(v || ''));
  return isNaN(t) ? 0 : t;
}

async function getTombstones(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem('@mizan_tombstones');
  let arr: any[] = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  const map: Record<string, string> = {};
  if (Array.isArray(arr)) {
    for (const t of arr) {
      if (t && t.key) map[String(t.key)] = String(t.deleted_at || t.deletedAt || '');
    }
  }
  return map;
}

async function saveTombstones(map: Record<string, string>) {
  const arr = Object.keys(map).map(k => ({ key: k, deleted_at: map[k] }));
  await AsyncStorage.setItem('@mizan_tombstones', JSON.stringify(arr));
}

async function getTombstonesForTable(table: string): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem('@mizan_tombstones');
  let arr: any[] = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  const map: Record<string, string> = {};
  if (Array.isArray(arr)) {
    for (const t of arr) {
      if (t && t.table === table && t.key) {
        map[String(t.key)] = String(t.deleted_at || t.deletedAt || '');
      }
    }
  }
  return map;
}

async function saveTombstonesForTable(table: string, map: Record<string, string>) {
  const raw = await AsyncStorage.getItem('@mizan_tombstones');
  let arr: any[] = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const others = arr.filter((t: any) => !(t && t.table === table));
  const mine = Object.keys(map).map(k => ({ table: table, key: k, deleted_at: map[k] }));
  await AsyncStorage.setItem('@mizan_tombstones', JSON.stringify([...others, ...mine]));
}


// ═══ گزارش تضاد ═══
const CONFLICTS_KEY = '@mizan_conflicts';
const CONFLICTS_MAX = 200;

const OP_TABLE: Record<string, string> = {
  createProduct: 'products', updateProduct: 'products', deleteProduct: 'products',
  createSale: 'sales', updateSale: 'sales', deleteSale: 'sales',
  createPurchase: 'purchases', updatePurchase: 'purchases', deletePurchase: 'purchases',
  createExpense: 'expenses', updateExpense: 'expenses', deleteExpense: 'expenses',
  createEmployee: 'employees', updateEmployee: 'employees', deleteEmployee: 'employees',
  createAttendance: 'attendance', updateAttendance: 'attendance', deleteAttendance: 'attendance',
  createSalaryPayment: 'salary_payments', updateSalaryPayment: 'salary_payments', deleteSalaryPayment: 'salary_payments',
  createLoan: 'employee_loans', updateLoan: 'employee_loans', deleteLoan: 'employee_loans',
  createLeave: 'employee_leaves', updateLeave: 'employee_leaves', deleteLeave: 'employee_leaves',
  createBatch: 'payroll_batches', updateBatch: 'payroll_batches', deleteBatch: 'payroll_batches',
  createParty: 'parties', updateParty: 'parties', deleteParty: 'parties',
  createPartner: 'partners', updatePartner: 'partners', deletePartner: 'partners',
  createPBA: 'partner_bank_accounts', deletePBA: 'partner_bank_accounts',
  createPTX: 'partner_transactions', deletePTX: 'partner_transactions',
  createBank: 'banks', updateBank: 'banks', deleteBank: 'banks',
  createShipping: 'shippings', updateShipping: 'shippings', deleteShipping: 'shippings',
  createStockAdjustment: 'stock_adjustments', deleteStockAdjustment: 'stock_adjustments',
  updateSettings: 'settings',
};

function extractKeys(payload: any): string[] {
  const out = new Set<string>();
  if (typeof payload === 'string') { if (payload) out.add(payload); return Array.from(out); }
  if (payload && typeof payload === 'object') {
    const fields = ['local_id','id','code','_localId','invoice','invoiceNumber','invoice_number','employee_code','partner_code','source_id'];
    for (const f of fields) {
      const v = (payload as any)[f];
      if (v !== undefined && v !== null && v !== '') out.add(String(v));
    }
    const p = (payload as any).p;
    if (p && typeof p === 'object') {
      if (p.local_id) out.add(String(p.local_id));
      if (p.code) out.add(String(p.code));
    }
  }
  return Array.from(out);
}

async function getPendingKeysByTable(): Promise<Record<string, Set<string>>> {
  const map: Record<string, Set<string>> = {};
  try {
    const q = await getQueue();
    for (const item of q || []) {
      const t = OP_TABLE[item?.op];
      if (!t) continue;
      const keys = extractKeys(item?.payload);
      if (!keys.length) continue;
      if (!map[t]) map[t] = new Set();
      for (const k of keys) map[t].add(k);
    }
  } catch {}
  return map;
}

async function recordConflict(table: string, key: string, local: any, sheet: any) {
  try {
    const raw = await AsyncStorage.getItem(CONFLICTS_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const dedup = String(table) + '|' + String(key) + '|' + String((sheet as any)?.updated_at || (sheet as any)?.updatedAt || '');
    if (arr.some((x: any) => x && x.dedup === dedup)) return;
    const dev = (await AsyncStorage.getItem('@mizan_device_id')) || '';
    arr.push({
      table: String(table),
      key: String(key),
      local: local || null,
      sheet: sheet || null,
      at: new Date().toISOString(),
      device_id: dev,
      resolved: false,
      dedup: dedup,
    });
    if (arr.length > CONFLICTS_MAX) arr = arr.slice(arr.length - CONFLICTS_MAX);
    await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(arr));
  } catch {}
}

function _conflictLocalKey(table: string): string {
  if (table === 'partner_transactions') return '@mizan_local_ptx_';
  if (table === 'partner_bank_accounts') return '@mizan_local_pba_';
  if (table === 'sales') return '@mizan_local_sales_grouped';
  if (table === 'purchases') return '@mizan_local_purchases_grouped';
  return '@mizan_local_' + table;
}

async function _removeQueueFor(table: string, key: string) {
  try {
    const raw = await AsyncStorage.getItem('@mizan_queue');
    let q: any[] = [];
    try { q = raw ? JSON.parse(raw) : []; } catch { q = []; }
    if (!Array.isArray(q)) q = [];
    const k = String(key);
    const filtered = q.filter((it: any) => {
      const p = it?.payload;
      if (!p) return true;
      const fields = ['local_id','id','code','_localId','invoice','invoiceNumber','invoice_number','employee_code','partner_code','source_id'];
      for (const f of fields) {
        if (p[f] !== undefined && String(p[f]) === k) return false;
      }
      if (p.p && typeof p.p === 'object') {
        if (p.p.local_id && String(p.p.local_id) === k) return false;
        if (p.p.code && String(p.p.code) === k) return false;
      }
      return true;
    });
    await AsyncStorage.setItem('@mizan_queue', JSON.stringify(filtered));
  } catch {}
}

async function _writeLocalRow(table: string, key: string, value: any, mode: 'replace' | 'delete') {
  const localKey = _conflictLocalKey(table);

  if (table === 'partner_transactions') {
    const pc = String(value?.partner_code || '').trim();
    if (!pc) return;
    const realKey = localKey + pc;
    const raw = await AsyncStorage.getItem(realKey);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const filtered = arr.filter((x: any) => String(x.local_id || x.id || '') !== String(key));
    if (mode === 'replace' && value) filtered.push(value);
    await AsyncStorage.setItem(realKey, JSON.stringify(filtered));
    return;
  }

  if (table === 'partner_bank_accounts') {
    const pc = String(value?.partner_code || '').trim();
    if (!pc) return;
    const realKey = localKey + pc;
    const raw = await AsyncStorage.getItem(realKey);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const filtered = arr.filter((x: any) => String(x.local_id || x.id || '') !== String(key));
    if (mode === 'replace' && value) filtered.push(value);
    await AsyncStorage.setItem(realKey, JSON.stringify(filtered));
    return;
  }

  if (table === 'settings') {
    if (mode === 'replace' && value) await AsyncStorage.setItem(localKey, JSON.stringify(value));
    return;
  }

  const raw = await AsyncStorage.getItem(localKey);
  let arr: any[] = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const filtered = arr.filter((x: any) => String(x.local_id || x.id || x.code || x.invoice || x.invoice_number || '') !== String(key));
  if (mode === 'replace' && value) filtered.push(value);
  await AsyncStorage.setItem(localKey, JSON.stringify(filtered));
}

async function _markConflictResolved(index: number) {
  try {
    const raw = await AsyncStorage.getItem(CONFLICTS_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    if (index >= 0 && index < arr.length) {
      arr[index] = { ...arr[index], resolved: true, resolved_at: new Date().toISOString() };
    }
    await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(arr));
  } catch {}
}

export async function applyConflictSheet(index: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICTS_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const c = arr[index];
    if (!c || !c.table || !c.key || !c.sheet) return false;

    await _writeLocalRow(c.table, c.key, c.sheet, 'replace');
    await _removeQueueFor(c.table, c.key);
    await _markConflictResolved(index);
    return true;
  } catch { return false; }
}

export async function keepLocalConflict(index: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICTS_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const c = arr[index];
    if (!c) return false;
    await _markConflictResolved(index);
    return true;
  } catch { return false; }
}

export async function getConflicts(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function clearConflicts(): Promise<void> {
  try { await AsyncStorage.setItem(CONFLICTS_KEY, '[]'); } catch {}
}

async function mergeList(localKey: string, sheetRows: any[]) {
  const table = localKey.replace('@mizan_local_', '');

  if (localKey === '@mizan_local_settings') {
    const rawS = await AsyncStorage.getItem(localKey);
    let existing: any = null;
    try { existing = rawS ? JSON.parse(rawS) : null; } catch { existing = null; }
    if (existing && typeof existing === 'object' && !Array.isArray(existing) && Object.keys(existing).length > 0) {
      return { added: 0, updated: 0, removed: 0 };
    }
    const first = (sheetRows || [])[0];
    if (!first) return { added: 0, updated: 0, removed: 0 };
    await AsyncStorage.setItem(localKey, JSON.stringify(first));
    return { added: 1, updated: 0, removed: 0 };
  }

  const raw = await AsyncStorage.getItem(localKey);
  let localArr: any[] = [];
  try { localArr = raw ? JSON.parse(raw) : []; } catch { localArr = []; }
  if (!Array.isArray(localArr)) localArr = [];

  const localMap = new Map<string, any>();
  for (const r of localArr) {
    const k = keyOfRow(r);
    if (k) localMap.set(k, r);
  }

  const tombstones = await getTombstonesForTable(table);
  const pendingByTable = await getPendingKeysByTable();
  const pending = pendingByTable[table] || new Set<string>();
  let added = 0, updated = 0, removed = 0;

  for (const [k, r] of Array.from(localMap.entries())) {
    const tombAt = tombstones[k] || '';
    if (tombAt) {
      const localUp = (r as any)?.updated_at || (r as any)?.updatedAt || '';
      if (!localUp || tsOf(tombAt) >= tsOf(localUp)) {
        localMap.delete(k);
        removed++;
      }
    }
  }

  for (const row of sheetRows || []) {
    const k = keyOfRow(row);
    if (!k) continue;

    const sheetDel = row.deleted_at || row.deletedAt || '';
    if (sheetDel) {
      const old = tombstones[k] || '';
      if (!old || tsOf(sheetDel) > tsOf(old)) tombstones[k] = sheetDel;
      if (localMap.has(k)) { localMap.delete(k); removed++; }
      continue;
    }

    const tombAt = tombstones[k] || '';
    if (tombAt) {
      const sheetUp = row.updated_at || row.updatedAt || '';
      if (!sheetUp || tsOf(tombAt) >= tsOf(sheetUp)) continue;
    }

    const existing = localMap.get(k);
    if (!existing) {
      localMap.set(k, row);
      added++;
      continue;
    }

    const localUp = existing.updated_at || existing.updatedAt || '';
    const sheetUp = row.updated_at || row.updatedAt || '';
    const sheetIsNewer = sheetUp && (!localUp || tsOf(sheetUp) > tsOf(localUp));

    if (pending.has(k)) {
      if (sheetIsNewer) {
        await recordConflict(table, k, existing, row);
        console.log('[mergeList] conflict kept local for', table, k);
      }
      continue;
    }

    if (sheetIsNewer) {
      localMap.set(k, { ...existing, ...row });
      updated++;
    }
  }

  await saveTombstonesForTable(table, tombstones);
  if (added || updated || removed) {
    await AsyncStorage.setItem(localKey, JSON.stringify(Array.from(localMap.values())));
  }
  return { added, updated, removed };
}

async function mergePartnerPrefixed(prefix: string, rows: any[]) {
  const byPartner: Record<string, any[]> = {};
  for (const r of rows || []) {
    const pc = String(r.partner_code || '').trim();
    if (!pc) continue;
    if (!byPartner[pc]) byPartner[pc] = [];
    byPartner[pc].push(r);
  }
  let added = 0, updated = 0, removed = 0;
  for (const pc of Object.keys(byPartner)) {
    const res = await mergeList(prefix + pc, byPartner[pc]);
    added += res.added; updated += res.updated; removed += res.removed;
  }
  return { added, updated, removed };
}

function invoiceKeyOf(r: any): string {
  return String(r?.local_id || r?.invoice || r?.invoice_number || '');
}

async function getPendingInvoiceKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  try {
    const q = await getQueue();
    for (const it of q || []) {
      const p = it?.payload;
      if (!p) continue;
      const inv = String(p.invoiceNumber || p.invoice_number || p.invoice || '');
      if (inv) keys.add(inv);
      if (p.local_id) keys.add(String(p.local_id));
    }
  } catch {}
  return keys;
}

function buildGroupedFromSheet(rows: any[]): any[] {
  const map: Record<string, any> = {};
  for (const r of rows || []) {
    const inv = String(r.invoice || '').trim();
    if (!inv) continue;
    const key = String(r.local_id || inv);
    if (!map[key]) {
      map[key] = {
        invoice: inv,
        date: r.date || '',
        name: r.name || '',
        phone: r.phone || '',
        total: Number(r.total) || 0,
        paid: Number(r.paid) || 0,
        manual: r.manual || '',
        local_id: r.local_id || inv,
        updated_at: r.updated_at || '',
        deleted_at: r.deleted_at || '',
        device_id: r.device_id || '',
        items: [],
      };
    }
    const it = {
      modelCode: r.model_code || '',
      modelName: r.model_name || '',
      quantity: Number(r.quantity) || 0,
      priceUnit: Number(r.price_unit) || 0,
      payment: Number(r.payment) || 0,
      description: r.description || '',
      shelf: r.shelf || '',
    };
    if (it.modelCode || it.modelName || it.quantity || it.priceUnit) {
      map[key].items.push(it);
    }
  }
  return Object.values(map);
}

async function mergeGroupedInvoices(localKey: string, rows: any[]) {
  const table = localKey.includes('purchases') ? 'purchases' : 'sales';
  const sheetGroups = buildGroupedFromSheet(rows);
  const raw = await AsyncStorage.getItem(localKey);
  let localArr: any[] = [];
  try { localArr = raw ? JSON.parse(raw) : []; } catch { localArr = []; }
  if (!Array.isArray(localArr)) localArr = [];

  const pendingInvoices = await getPendingInvoiceKeys();
  const localMap = new Map<string, any>();
  for (const r of localArr) {
    const k = invoiceKeyOf(r);
    if (k) localMap.set(k, r);
  }

  const tombstones = await getTombstonesForTable(table);
  let added = 0, updated = 0, removed = 0;

  for (const [k, r] of Array.from(localMap.entries())) {
    const tombAt = tombstones[k] || '';
    if (tombAt) {
      const localUp = (r as any)?.updated_at || (r as any)?.updatedAt || '';
      if (!localUp || tsOf(tombAt) >= tsOf(localUp)) {
        localMap.delete(k);
        removed++;
      }
    }
  }

  for (const g of sheetGroups) {
    const k = invoiceKeyOf(g);
    if (!k) continue;
    const isPending = pendingInvoices.has(String(g.invoice || '')) || pendingInvoices.has(k);

    const sheetDel = g.deleted_at || '';
    if (sheetDel) {
      const old = tombstones[k] || '';
      if (!old || tsOf(sheetDel) > tsOf(old)) tombstones[k] = sheetDel;
      if (!isPending && localMap.has(k)) { localMap.delete(k); removed++; }
      continue;
    }

    const tombAt = tombstones[k] || '';
    if (tombAt) {
      const sheetUp = g.updated_at || g.updatedAt || '';
      if (!sheetUp || tsOf(tombAt) >= tsOf(sheetUp)) continue;
    }

    const existing = localMap.get(k);
    if (!existing) {
      localMap.set(k, g);
      added++;
      continue;
    }

    const localUp = tsOf(existing.updated_at || existing.updatedAt);
    const sheetUp = tsOf(g.updated_at || g.updatedAt);
    const sheetIsNewer = sheetUp > localUp;

    if (isPending) {
      if (sheetIsNewer) {
        await recordConflict(table, k, existing, g);
        console.log('[mergeGroupedInvoices] conflict kept local for', table, k);
      }
      continue;
    }

    if (sheetIsNewer) {
      localMap.set(k, { ...existing, ...g });
      updated++;
    }
  }

  await saveTombstonesForTable(table, tombstones);
  if (added || updated || removed) {
    await AsyncStorage.setItem(localKey, JSON.stringify(Array.from(localMap.values())));
  }
  return { added, updated, removed };
}

async function mergeTombstones(rows: any[]) {
  const raw = await AsyncStorage.getItem('@mizan_tombstones');
  let local: any[] = [];
  try { local = raw ? JSON.parse(raw) : []; } catch { local = []; }
  if (!Array.isArray(local)) local = [];

  const map: Record<string, any> = {};
  for (const t of local) {
    if (t && t.table && t.key) map[String(t.table) + '|' + String(t.key)] = t;
  }

  let added = 0, updated = 0;

  for (const r of rows || []) {
    if (!r || !r.table || !r.key) continue;
    const k = String(r.table) + '|' + String(r.key);
    const old = map[k];
    const oldTs = old ? Date.parse(String(old.deleted_at || '')) : 0;
    const newTs = Date.parse(String(r.deleted_at || ''));
    if (!old || (newTs && newTs > oldTs)) {
      map[k] = {
        table: String(r.table),
        key: String(r.key),
        deleted_at: r.deleted_at || new Date().toISOString(),
        device_id: r.device_id || '',
      };
      if (old) updated++; else added++;
    }
  }

  await AsyncStorage.setItem('@mizan_tombstones', JSON.stringify(Object.values(map)));
  return { added, updated, removed: 0 };
}

async function mergeAuditEvents(rows: any[]) {
  const raw = await AsyncStorage.getItem('@mizan_audit_events');
  let local: any[] = [];
  try { local = raw ? JSON.parse(raw) : []; } catch { local = []; }
  if (!Array.isArray(local)) local = [];

  const map = new Map<string, any>();
  for (const ev of local) {
    const id = String(ev?.id || '');
    if (!id) continue;
    map.set(id, ev);
  }

  let added = 0, updated = 0;

  for (const r of rows || []) {
    if (!r || !r.id) continue;
    const id = String(r.id);
    const existing = map.get(id);
    if (!existing) { map.set(id, r); added++; continue; }
    const oldAt = String(existing.at || '');
    const newAt = String(r.at || '');
    if (newAt && (!oldAt || newAt > oldAt)) {
      map.set(id, { ...existing, ...r });
      updated++;
    }
  }

  const merged = Array.from(map.values()).sort((a: any, b: any) => String(a.at || '').localeCompare(String(b.at || '')));
  const trimmed = merged.length > 500 ? merged.slice(merged.length - 500) : merged;
  await AsyncStorage.setItem('@mizan_audit_events', JSON.stringify(trimmed));
  return { added, updated, removed: 0 };
}

export async function pullPrivateTables(onProgress?: (done: number, total: number, tab: string) => void) {
  const token = await getToken();
  if (!token) throw new Error('لطفاً وارد شوید');
  const res = await fetch(FN_BASE + '/google-sheets-pull', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tables: PULL_TABLES }),
  });
  const data: any = await res.json();
  if (!res.ok || !data?.tables) throw new Error(data?.error || 'خطا در دریافت');

  let added = 0, updated = 0, removed = 0;
  let done = 0;
  const total = PULL_TABLES.length;

  for (const tab of PULL_TABLES) {
    const rows = data.tables[tab] || [];
    let r = { added: 0, updated: 0, removed: 0 };
    if (tab === '_deleted') r = await mergeTombstones(rows);
    else if (tab === '_audit') r = await mergeAuditEvents(rows);
    else if (tab === 'sales') r = await mergeGroupedInvoices('@mizan_local_sales_grouped', rows);
    else if (tab === 'purchases') r = await mergeGroupedInvoices('@mizan_local_purchases_grouped', rows);
    else if (tab === 'partner_transactions') r = await mergePartnerPrefixed('@mizan_local_ptx_', rows);
    else if (tab === 'partner_bank_accounts') r = await mergePartnerPrefixed('@mizan_local_pba_', rows);
    else if (PULL_LOCAL_KEYS[tab]) r = await mergeList(PULL_LOCAL_KEYS[tab], rows);
    added += r.added; updated += r.updated; removed += r.removed;
    done++;
    if (onProgress) onProgress(done, total, tab);
  }

  return { ok: true, added, updated, removed, totalTables: total };
}
