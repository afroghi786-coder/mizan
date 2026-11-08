import AsyncStorage from './lib.storage';
import { supabase } from './lib';

const QUEUE_KEY = '@mizan_support_queue';
const TICKETS_CACHE = '@mizan_support_tickets_cache';
const MESSAGES_CACHE = '@mizan_support_messages_cache_';

async function _isOnline(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof (navigator as any).onLine === 'boolean') {
      return (navigator as any).onLine !== false;
    }
    return true;
  } catch { return true; }
}

async function _getUserId(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || '';
  } catch { return ''; }
}

async function _getDeviceId(): Promise<string> {
  try { return (await AsyncStorage.getItem('@mizan_device_id')) || ''; } catch { return ''; }
}

async function _enqueue(op: string, payload: any) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    let arr: any[] = [];
    try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    arr.push({ op, payload, ts: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch {}
}

export async function getSupportQueueCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.length : 0;
  } catch { return 0; }
}

export async function createSupportTicket(input: {
  type: 'issue' | 'feature' | 'contact' | 'license';
  subject?: string;
  message: string;
  appVersion?: string;
  licenseStatus?: string;
}): Promise<{ ok: boolean; queued?: boolean; id?: string; error?: string }> {
  const payload = {
    type: input.type,
    subject: String(input.subject || '').trim(),
    message: String(input.message || '').trim(),
    app_version: String(input.appVersion || ''),
    license_status: String(input.licenseStatus || ''),
  };
  if (!payload.message) return { ok: false, error: 'متن پیام خالی است' };

  if (await _isOnline()) {
    const uid = await _getUserId();
    if (!uid) return { ok: false, error: 'ابتدا وارد حساب شوید' };
    try {
      const dev = await _getDeviceId();
      let userEmail = '';
      let userName = '';
      let userPhone = '';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user;
        userEmail = u?.email || '';
        const meta = (u?.user_metadata || {}) as any;
        userName = meta.full_name || meta.name || meta.display_name || meta.username || (userEmail ? userEmail.split('@')[0] : '');
        userPhone = meta.phone || meta.phone_number || u?.phone || '';
      } catch {}
      const { data, error } = await supabase.from('support_tickets').insert({
        user_id: uid,
        user_email: userEmail,
        user_name: userName,
        user_phone: userPhone,
        device_id: dev,
        type: payload.type,
        subject: payload.subject,
        message: payload.message,
        app_version: payload.app_version,
        license_status: payload.license_status,
      }).select('id').single();
      if (error) throw error;
      return { ok: true, id: data?.id };
    } catch (e: any) {
      await _enqueue('createTicket', payload);
      return { ok: true, queued: true };
    }
  }
  await _enqueue('createTicket', payload);
  return { ok: true, queued: true };
}

export async function getMySupportTickets(): Promise<any[]> {
  const cacheKey = TICKETS_CACHE;
  if (await _isOnline()) {
    const uid = await _getUserId();
    if (uid) {
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && Array.isArray(data)) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }
      } catch {}
    }
  }
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function getSupportMessages(ticketId: string): Promise<any[]> {
  const cacheKey = MESSAGES_CACHE + ticketId;
  if (await _isOnline()) {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (!error && Array.isArray(data)) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
    } catch {}
  }
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function sendSupportReply(ticketId: string, message: string): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  const msg = String(message || '').trim();
  if (!msg) return { ok: false, error: 'متن پیام خالی است' };
  if (await _isOnline()) {
    const uid = await _getUserId();
    if (!uid) return { ok: false, error: 'ابتدا وارد حساب شوید' };
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        sender: 'user',
        sender_id: uid,
        message: msg,
        read_by_user: true,
      });
      if (error) throw error;
      return { ok: true };
    } catch {
      await _enqueue('sendMessage', { ticket_id: ticketId, message: msg });
      return { ok: true, queued: true };
    }
  }
  await _enqueue('sendMessage', { ticket_id: ticketId, message: msg });
  return { ok: true, queued: true };
}

export async function flushSupportQueue(): Promise<void> {
  if (!(await _isOnline())) return;
  const uid = await _getUserId();
  if (!uid) return;
  let arr: any[] = [];
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    arr = raw ? JSON.parse(raw) : [];
  } catch { arr = []; }
  if (!Array.isArray(arr) || !arr.length) return;

  const remaining: any[] = [];
  for (const item of arr) {
    try {
      if (item.op === 'createTicket') {
        const dev = await _getDeviceId();
        const p = item.payload || {};
        let userEmail = '';
        try { const { data: { session } } = await supabase.auth.getSession(); userEmail = session?.user?.email || ''; } catch {}
        const { error } = await supabase.from('support_tickets').insert({
          user_id: uid,
          user_email: userEmail,
          device_id: dev,
          type: p.type,
          subject: p.subject || '',
          message: p.message,
          app_version: p.app_version || '',
          license_status: p.license_status || '',
        });
        if (error) throw error;
      } else if (item.op === 'sendMessage') {
        const p = item.payload || {};
        const { error } = await supabase.from('support_messages').insert({
          ticket_id: p.ticket_id,
          sender: 'user',
          sender_id: uid,
          message: p.message,
          read_by_user: true,
        });
        if (error) throw error;
      }
    } catch {
      remaining.push(item);
    }
  }
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining)); } catch {}
}


export async function markSupportMessagesRead(ticketId: string): Promise<void> {
  try {
    if (!ticketId) return;
    if (!(await _isOnline())) return;
    await supabase.rpc('mark_support_messages_read', { p_ticket_id: ticketId });
  } catch {}
}

export async function getSupportUnreadCount(): Promise<number> {
  try {
    if (!(await _isOnline())) return 0;
    const { data, error } = await supabase.rpc('get_support_unread_count');
    if (error) return 0;
    return Number(data) || 0;
  } catch { return 0; }
}


export async function getSupportUnreadCountsByTicket(): Promise<Record<string, number>> {
  try {
    if (!(await _isOnline())) return {};
    const { data, error } = await supabase
      .from('support_messages')
      .select('ticket_id')
      .eq('sender', 'admin')
      .eq('read_by_user', false)
      .limit(1000);
    if (error || !Array.isArray(data)) return {};
    const map: Record<string, number> = {};
    for (const row of data as any[]) {
      const k = String(row.ticket_id || '');
      if (!k) continue;
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  } catch { return {}; }
}
