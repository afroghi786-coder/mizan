import { getBridgeConfig } from './lib.sheets';

const SHEET_TAB = 'audit_lock';

export type SheetPin = {
  salt: string;
  hash: string;
  setAt: string;
  v: number;
  isOwner: boolean;
};

type BridgeResult = {
  ok: boolean;
  data?: any;
  offline?: boolean;
  noConfig?: boolean;
};

async function callBridge(action: string, extra: any): Promise<BridgeResult> {
  const bc = await getBridgeConfig();
  if (!bc?.url || !bc?.key) return { ok: false, noConfig: true };
  try {
    const res = await fetch(bc.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, key: bc.key, ...extra }),
    });
    if (!res.ok) return { ok: false, offline: true };
    const data = await res.json();
    return { ok: true, data };
  } catch (e: any) {
    console.log('[auditSync] callBridge:', e?.message);
    return { ok: false, offline: true };
  }
}

export async function pushPinToSheet(cfg: { salt: string; hash: string; setAt: string; v: number; isOwner: boolean }): Promise<boolean> {
  try {
    const r = await callBridge('upsert', {
      table: SHEET_TAB,
      rows: [{
        id: 'singleton',
        salt: cfg.salt,
        hash: cfg.hash,
        set_at: cfg.setAt || new Date().toISOString(),
        v: String(cfg.v || 2),
        is_owner: cfg.isOwner ? 'true' : 'false',
        updated_at: new Date().toISOString(),
      }],
    });
    if (r.noConfig) return false;
    if (!r.ok) return false;
    return !!(r.data && r.data.ok);
  } catch (e: any) {
    console.log('[auditSync] push:', e?.message);
    return false;
  }
}

export async function pullPinFromSheet(): Promise<SheetPin | null | undefined> {
  // null = no bridge or empty sheet
  // undefined = offline/error
  // SheetPin = has PIN
  try {
    const r = await callBridge('pull', {});
    if (r.noConfig) return null;
    if (!r.ok) return undefined;
    const rows = r.data?.tables?.[SHEET_TAB] || [];
    const row = rows[0];
    if (!row || !row.salt || !row.hash) return null;
    const isOwnerRaw = row.is_owner;
    const isOwner = isOwnerRaw === 'true' || isOwnerRaw === true || isOwnerRaw === 1 || isOwnerRaw === '1';
    return {
      salt: String(row.salt),
      hash: String(row.hash),
      setAt: String(row.set_at || ''),
      v: Number(row.v || 0),
      isOwner,
    };
  } catch (e: any) {
    console.log('[auditSync] pull:', e?.message);
    return undefined;
  }
}

export async function deletePinFromSheet(): Promise<boolean> {
  try {
    const r = await callBridge('delete', { table: SHEET_TAB, keys: ['singleton'] });
    if (!r.ok) return false;
    return !!(r.data && r.data.ok);
  } catch { return false; }
}
