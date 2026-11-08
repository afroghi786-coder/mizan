import AsyncStorage from './lib.storage';
import { supabase } from './lib';
import { unlockAudio } from './lib.notifications';

const LAST_USER_KEY = '@mizan_support_last_notif_user';
const LAST_ADMIN_KEY = '@mizan_support_last_notif_admin';
let _audioReady = false;

async function _ensureAudio() {
  if (_audioReady) return;
  _audioReady = true;
  try { await unlockAudio?.(); } catch {}
}
async function _email(): Promise<string> {
  try { const { data: { session } } = await supabase.auth.getSession(); return session?.user?.email || ''; } catch { return ''; }
}
async function _poll(type: 'support_reply' | 'support_new', key: string, title: string, body: string): Promise<number> {
  try {
    await _ensureAudio();
    const em = await _email();
    if (!em) return 0;
    const last = Number((await AsyncStorage.getItem(key)) || 0);
    const { data, error } = await supabase
      .from('net_notifications')
      .select('id,type,payload,is_read,created_at')
      .eq('to_email', em)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return 0;
    const maxId = data.reduce((m: number, n: any) => Math.max(m, Number(n.id) || 0), 0);
    const fresh = data.filter((n: any) => (Number(n.id) || 0) > last);
    if (maxId > last) { try { await AsyncStorage.setItem(key, String(maxId)); } catch {} }
    // صدا/نوتیف فقط از App.tsx پخش می‌شود تا تکراری نشود
    return fresh.length;
  } catch { return 0; }
}

export async function pollSupportUserNotifications(): Promise<number> {
  return _poll('support_reply', LAST_USER_KEY, 'پشتیبانی میزان', 'پاسخ جدید از پشتیبانی');
}
export async function pollSupportAdminNotifications(): Promise<number> {
  return _poll('support_new', LAST_ADMIN_KEY, 'پشتیبانی میزان', 'پیام جدید از کاربر');
}
