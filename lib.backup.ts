// lib.backup.ts — بکاپ و بازیابی JSON
import AsyncStorage from './lib.storage';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

let FS: any = null;
try {
  const legacy = require('expo-file-system/legacy');
  FS = legacy?.default || legacy;
} catch {}
if (!FS) {
  try {
    const main = require('expo-file-system');
    FS = main?.default || main;
  } catch {}
}

function getDir(): string | null {
  if (!FS) return null;
  if (FS.documentDirectory) return FS.documentDirectory + 'backups/';
  if (FS.Paths?.document?.uri) return FS.Paths.document.uri + 'backups/';
  if (FS.cacheDirectory) return FS.cacheDirectory + 'backups/';
  return null;
}

const BACKUP_VERSION = 1;
const MAX_AUTO_BACKUPS = 7;

export type BackupPayload = {
  version: number;
  createdAt: string;
  app: 'mizan';
  keys: Record<string, string>;
};

async function ensureDir(): Promise<string | null> {
  const dir = getDir();
  if (!dir) return null;
  try {
    if (FS.getInfoAsync) {
      const info = await FS.getInfoAsync(dir);
      if (!info?.exists) await FS.makeDirectoryAsync(dir, { intermediates: true });
    } else if (FS.makeDirectoryAsync) {
      try { await FS.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    }
    return dir;
  } catch (e) {
    console.log('[backup] ensureDir err:', e);
    return null;
  }
}

export async function createBackup(): Promise<BackupPayload> {
  const allKeys = await AsyncStorage.getAllKeys();
  const mizanKeys = allKeys.filter((k: string) => k.startsWith('@mizan_'));
  const keys: Record<string, string> = {};
  for (const k of mizanKeys) {
    const v = await AsyncStorage.getItem(k);
    if (v !== null) keys[k] = v;
  }
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: 'mizan',
    keys,
  };
}

async function listAutoBackups(): Promise<Array<{ name: string; uri: string; mtime: number }>> {
  try {
    const dir = getDir();
    if (!dir) return [];
    const names = await FS.readDirectoryAsync(dir);
    const out: Array<{ name: string; uri: string; mtime: number }> = [];
    for (const n of names || []) {
      if (!n.endsWith('.json') || !n.startsWith('auto-')) continue;
      let mtime = 0;
      try {
        const info = FS.getInfoAsync ? await FS.getInfoAsync(dir + n) : null;
        mtime = info?.modificationTime || 0;
      } catch {}
      out.push({ name: n, uri: dir + n, mtime });
    }
    out.sort((a, b) => b.mtime - a.mtime);
    return out;
  } catch {
    return [];
  }
}

export async function getLastAutoBackup(): Promise<string | null> {
  const list = await listAutoBackups();
  if (!list.length) return null;
  const name = list[0].name;
  const m = name.match(/auto-(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : name;
}

export async function autoBackup(): Promise<void> {
  try {
    const dir = await ensureDir();
    if (!dir) return;
    const today = new Date().toISOString().slice(0, 10);
    const list = await listAutoBackups();
    if (list.length > 0) {
      const lastMatch = list[0].name.match(/auto-(\d{4}-\d{2}-\d{2})/);
      if (lastMatch && lastMatch[1] === today) return;
    }
    const b = await createBackup();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = dir + 'auto-' + stamp + '.json';
    await FS.writeAsStringAsync(filename, JSON.stringify(b), { encoding: 'utf8' });
    const all = await listAutoBackups();
    if (all.length > MAX_AUTO_BACKUPS) {
      for (const f of all.slice(MAX_AUTO_BACKUPS)) {
        try {
          if (FS.deleteAsync) await FS.deleteAsync(f.uri);
        } catch {}
      }
    }
  } catch (e) {
    console.log('[autoBackup] err:', e);
  }
}

export async function exportBackup(): Promise<{ ok: boolean; message: string }> {
  try {
    const dir = await ensureDir();
    const b = await createBackup();
    if (dir && FS.writeAsStringAsync) {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = dir + 'mizan-backup-' + stamp + '.json';
      await FS.writeAsStringAsync(filename, JSON.stringify(b, null, 2), { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename, {
          mimeType: 'application/json',
          dialogTitle: 'ذخیره بکاپ میزان',
          UTI: 'public.json',
        });
        return { ok: true, message: 'بکاپ ساخته و ارسال شد' };
      }
      return { ok: true, message: 'بکاپ ساخته شد' };
    }
    return { ok: false, message: 'FileSystem در دسترس نیست' };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}

export async function importBackup(): Promise<{ ok: boolean; message: string }> {
  try {
    const res: any = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (res?.canceled) return { ok: false, message: 'لغو شد' };
    if (res?.type === 'cancel') return { ok: false, message: 'لغو شد' };
    let uri: string | undefined;
    if (res?.assets && res.assets[0]) uri = res.assets[0].uri;
    else if (res?.uri) uri = res.uri;
    if (!uri) return { ok: false, message: 'فایلی انتخاب نشد' };
    if (!FS?.readAsStringAsync) return { ok: false, message: 'FileSystem خواندن ندارد' };
    const content = await FS.readAsStringAsync(uri, { encoding: 'utf8' });
    const data = JSON.parse(content) as BackupPayload;
    if (!data || data.app !== 'mizan' || typeof data.keys !== 'object') {
      return { ok: false, message: 'فایل بکاپ معتبر نیست' };
    }
    let count = 0;
    for (const [k, v] of Object.entries(data.keys)) {
      if (!k.startsWith('@mizan_')) continue;
      await AsyncStorage.setItem(k, v);
      count++;
    }
    return { ok: true, message: count + ' کلید بازیابی شد. برای اعمال، اپ را ببندید و باز کنید.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}
