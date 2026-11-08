import { supabase } from './lib';

export async function adminFetchSupportTickets(status?: string): Promise<any[]> {
  try {
    let q = supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(200);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) { console.log('adminFetchSupportTickets:', error.message); return []; }
    return Array.isArray(data) ? data : [];
  } catch (e: any) { console.log('adminFetchSupportTickets ex:', e?.message); return []; }
}

export async function adminFetchSupportMessages(ticketId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) { console.log('adminFetchSupportMessages:', error.message); return []; }
    return Array.isArray(data) ? data : [];
  } catch (e: any) { console.log('adminFetchSupportMessages ex:', e?.message); return []; }
}

export async function adminSendSupportReply(ticketId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const msg = String(message || '').trim();
  if (!msg) return { ok: false, error: 'متن پیام خالی است' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || null;
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender: 'admin',
      sender_id: uid,
      message: msg,
      read_by_admin: true,
      read_by_user: false,
    });
    if (error) throw error;

    // SUPPORT_REPLY_NOTIFY — نوتیف امن برای همان کاربر، بدون تغییر net_messages
    try {
      const { data: t } = await supabase
        .from('support_tickets')
        .select('user_email, subject')
        .eq('id', ticketId)
        .maybeSingle();
      const toEmail = String(t?.user_email || '').trim();
      if (toEmail) {
        await supabase.from('net_notifications').insert({
          to_email: toEmail,
          type: 'support_reply',
          payload: {
            ticket_id: ticketId,
            subject: t?.subject || '',
            message: msg.slice(0, 120),
            from_name: 'پشتیبانی میزان',
          },
        });
      }
    } catch (e: any) {
      console.log('support_reply notify skip:', e?.message);
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'ارسال نشد' };
  }
}

export async function adminUpdateSupportStatus(ticketId: string, status: 'open' | 'in_progress' | 'closed'): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'به‌روزرسانی نشد' };
  }
}

export async function adminMarkSupportReadByAdmin(ticketId: string): Promise<void> {
  try {
    await supabase.from('support_messages').update({ read_by_admin: true }).eq('ticket_id', ticketId).eq('sender', 'user').eq('read_by_admin', false);
  } catch {}
}

export async function adminGetOpenSupportCount(): Promise<number> {
  try {
    const { count, error } = await supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open');
    if (error) return 0;
    return Number(count) || 0;
  } catch { return 0; }
}


export async function adminGetUnreadMessagesCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender', 'user')
      .eq('read_by_admin', false);
    if (error) return 0;
    return Number(count) || 0;
  } catch { return 0; }
}


export async function adminGetUnreadCountsByTicket(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('support_messages')
      .select('ticket_id')
      .eq('sender', 'user')
      .eq('read_by_admin', false)
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
