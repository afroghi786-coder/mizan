// lib.network.ts — شبکه صرافی (Supabase + Notifications)
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NET_CITIES: Record<string, string> = {
  KBL: 'کابل', HRT: 'هرات', MZR: 'مزار شریف', KDH: 'کندهار',
  JAL: 'جلال‌آباد', KDZ: 'قندوز', GHZ: 'غزنی', BAM: 'بامیان',
};

let _sb: any = null;
let _connected = false;
let _myEmail = '';
let _myName = '';
let _myCity = '';
let _myPhone = '';
let _polls: any = {};

export function emailToKey(email: string): string {
  return String(email || '').toLowerCase().trim();
}

async function getSB(): Promise<any> {
  if (_sb) return _sb;
  try {
    const mod: any = await import('./lib.offline');
    _sb = mod.supabase;
    return _sb;
  } catch { return null; }
}

export async function getCurrentEmail(): Promise<string> {
  try {
    const sb = await getSB();
    if (sb) { const { data } = await sb.auth.getSession(); return data?.session?.user?.email || ''; }
  } catch {}
  return '';
}

export function getMyNetInfo() { return { email: _myEmail, name: _myName, city: _myCity, phone: _myPhone, connected: _connected }; }
export function isNetReady() { return _sb !== null && _connected; }

export async function loadNetSettings(): Promise<void> {
  try {
    _myName = (await AsyncStorage.getItem('mz_net_name')) || '';
    _myCity = (await AsyncStorage.getItem('mz_net_city')) || '';
    _myPhone = (await AsyncStorage.getItem('mz_net_phone')) || '';
    _myEmail = await getCurrentEmail();
  } catch {}
}

export async function saveNetSettings(name: string, city: string, phone: string): Promise<void> {
  _myName = name; _myCity = city; _myPhone = phone;
  try {
    await AsyncStorage.setItem('mz_net_name', name);
    await AsyncStorage.setItem('mz_net_city', city);
    await AsyncStorage.setItem('mz_net_phone', phone);
  } catch {}
  if (_sb && _myEmail) await _registerAgent();
}

export async function initNetwork(): Promise<boolean> {
  if (_connected) return true;
  const sb = await getSB();
  if (!sb) return false;
  await loadNetSettings();
  if (!_myEmail) return false;
  try { await _registerAgent(); _connected = true; return true; }
  catch (e: any) { console.log('[NET] init:', e?.message); return false; }
}

async function _registerAgent(): Promise<void> {
  if (!_sb || !_myEmail) return;
  try {
    await _sb.from('net_agents').upsert({
      email: _myEmail, name: _myName || _myEmail.split('@')[0],
      city: _myCity || '', phone: _myPhone || '', online: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'email' });
  } catch (e: any) { console.log('register:', e?.message); }
}

// ═══════════════════════════════════════════════════════
//  نوتیفیکیشن داخلی
// ═══════════════════════════════════════════════════════
async function notify(toEmail: string, type: string, payload: any = {}): Promise<void> {
  if (!_sb || !toEmail) return;
  try {
    // چک تنظیمات کاربر
    const { data: pref } = await _sb.from('net_preferences').select('*').eq('email', toEmail).single();
    if (pref) {
      if (type === 'fx_taken' && !pref.notify_fx_claim) return;
      if (type === 'hawala_taken' && !pref.notify_hawala_claim) return;
      if (type === 'direct_hawala' && !pref.notify_direct) return;
      if ((type === 'fx_new') && !pref.notify_fx_new) return;
      if ((type === 'hawala_new') && !pref.notify_hawala_new) return;
    }
    const { error } = await _sb.from('net_notifications').insert({ to_email: toEmail, type, payload: payload || {} });
    if (error) console.log('[notify] insert error:', error.message);
    else console.log('[notify] sent', type, 'to', toEmail);
  } catch (e: any) { console.log('[notify] error:', e?.message); }
}

export async function fetchNotifications(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data } = await _sb.from('net_notifications').select('*').eq('to_email', _myEmail).order('created_at', { ascending: false }).limit(30);
    return data || [];
  } catch { return []; }
}

export async function markNotificationRead(id: number): Promise<void> {
  if (!_sb) return;
  try { await _sb.from('net_notifications').update({ is_read: true }).eq('id', id); } catch {}
}

// ═══════════════════════════════════════════════════════
//  بازار آزاد — حواله عمومی
// ═══════════════════════════════════════════════════════
export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const expiresAtH = new Date(Date.now() + (Number(h.expires || 15) * 60000)).toISOString();
  const { error } = await _sb.from('net_hawalas').insert({
    id: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    target_city: h.targetCity, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    max_fee: h.maxFee || 2, note: h.note || '', status: 'open',
    target_group_id: h.targetGroupId || null,
    expires_at: expiresAtH,
  });
  if (error) { console.log('sendBroadcastHawala error:', error.message); throw new Error(error.message); }
  console.log('✅ Hawala inserted:', h.id, 'expires:', expiresAtH);
  try {
    const { data: users } = await _sb.from('net_preferences').select('email, notify_hawala_new, watch_cities').eq('notify_hawala_new', true).neq('email', _myEmail);
    if (users && users.length) {
      const toNotify = users.filter((u: any) => !u.watch_cities || u.watch_cities.length === 0 || u.watch_cities.includes(h.targetCity));
      for (const u of toNotify) {
        await _sb.from('net_notifications').insert({
          to_email: u.email, type: 'hawala_new',
          payload: { hawalaId: h.id, from_name: _myName, currency: h.currency, amount: h.amount, targetCity: h.targetCity },
        });
      }
    }
  } catch (e: any) { console.log('hawala_new notify error:', e?.message); }
  return { success: true, id: h.id };
}

export async function claimHawala(taskId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: upd, error } = await _sb.from('net_hawalas')
    .update({ status: 'locked', claimed_by_email: _myEmail, claimed_by_name: _myName, claimed_at: new Date().toISOString() })
    .eq('id', taskId).eq('status', 'open').select();
  if (error) return { success: false, message: error.message };
  if (!upd || !upd.length) return { success: false, message: '⛔ دیر رسیدی — یکی دیگر قبول کرد' };
  const cur = upd[0];
  notify(cur.from_email, 'hawala_taken', { taskId, from_name: _myName, amount: cur.amount, currency: cur.currency }).catch(() => {});
  return { success: true, task: cur };
}

// ═══════════════════════════════════════════════════════
//  آگهی فروش ارز
// ═══════════════════════════════════════════════════════
export async function sendFXOffer(o: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const expiresAt = new Date(Date.now() + (Number(o.expires || 10) * 60000)).toISOString();
  const { error } = await _sb.from('net_fx_offers').insert({
    id: o.id, seller_email: _myEmail, seller_name: _myName, seller_city: _myCity,
    seller_city_manual: o.sellerCityManual || null,
    currency: o.currency, target_currency: o.targetCurrency || 'AFN',
    amount: o.amount, rate_type: o.rateType || 'fixed',
    rate: o.rate || 0, note: o.note || '', status: 'open',
    target_group_id: o.targetGroupId || null,
    expires_at: expiresAt,
  });
  if (error) { console.log('sendFXOffer error:', error.message); throw new Error(error.message); }
  // ⭐ نوتیف به کاربران مطابق با تنظیماتشون
  try {
    const { data: users } = await _sb.from('net_preferences').select('email, notify_fx_new, watch_currencies').eq('notify_fx_new', true).neq('email', _myEmail);
    if (users && users.length) {
      const toNotify = users.filter((u: any) => !u.watch_currencies || u.watch_currencies.length === 0 || u.watch_currencies.includes(o.currency));
      for (const u of toNotify) {
        await _sb.from('net_notifications').insert({
          to_email: u.email, type: 'fx_new',
          payload: { offerId: o.id, from_name: _myName, currency: o.currency, amount: o.amount, rate: o.rate },
        });
      }
    }
  } catch (e: any) { console.log('fx_new notify error:', e?.message); }
  return { success: true, id: o.id };
}

export async function claimFXOffer(offerId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: cur } = await _sb.from('net_fx_offers').select('*').eq('id', offerId).single();
  if (!cur) return { success: false, message: 'پیدا نشد' };
  if (cur.status !== 'open') return { success: false, message: 'دیر رسیدی' };
  if (cur.seller_email === _myEmail) return { success: false, message: 'خودتان فروشنده‌اید' };
  const { data: upd, error } = await _sb.from('net_fx_offers')
    .update({ status: 'locked', claimed_by_email: _myEmail, claimed_by_name: _myName, claimed_at: new Date().toISOString() })
    .eq('id', offerId).eq('status', 'open').select();
  if (error) return { success: false, message: error.message };
  if (!upd || !upd.length) return { success: false, message: 'دیر رسیدی' };
  // ⭐ نوتیف به فروشنده
  await notify(cur.seller_email, 'fx_taken', { offerId, from_name: _myName, amount: cur.amount, currency: cur.currency });
  return { success: true, offer: upd[0] };
}

export async function deleteFXOffer(offerId: string): Promise<void> {
  if (!_sb) return;
  try { await _sb.from('net_fx_offers').delete().eq('id', offerId).eq('seller_email', _myEmail); } catch {}
}

export async function extendFXOffer(offerId: string, newExpiresAt: number): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: cur } = await _sb.from('net_fx_offers').select('*').eq('id', offerId).single();
  if (!cur) throw new Error('پیدا نشد');
  const ext = (cur.extended_count || 0) + 1;
  if (ext > 3) throw new Error('حداکثر ۳ بار تمدید');
  const { error } = await _sb.from('net_fx_offers')
    .update({ expires_at: new Date(newExpiresAt).toISOString(), extended_count: ext, status: 'open' })
    .eq('id', offerId);
  if (error) throw new Error(error.message);
  return { success: true, extended: ext };
}

export async function fetchMyFXOffers(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data } = await _sb.from('net_fx_offers').select('*').eq('seller_email', _myEmail).order('created_at', { ascending: false }).limit(50);
    return data || [];
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════
//  حواله خصوصی
// ═══════════════════════════════════════════════════════
export async function sendDirectHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  if (!h.toEmail) throw new Error('مقصد انتخاب نشده');
  const { error } = await _sb.from('net_direct_hawalas').insert({
    id: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    to_email: h.toEmail, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    commission: h.commission || 0, note: h.note || '', status: 'pending',
  });
  if (error) throw new Error(error.message);
  await notify(h.toEmail, 'direct_hawala', { hawalaId: h.id, from_name: _myName, amount: h.amount, currency: h.currency });
  return { success: true, id: h.id };
}

export async function acceptDirectHawala(hawalaId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: cur } = await _sb.from('net_direct_hawalas').select('*').eq('id', hawalaId).single();
  if (!cur) throw new Error('پیدا نشد');
  if (cur.status !== 'pending') throw new Error('قبلاً قبول شده');
  const { error } = await _sb.from('net_direct_hawalas')
    .update({ status: 'accepted', accepted_by_name: _myName, accepted_at: new Date().toISOString() })
    .eq('id', hawalaId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  await notify(cur.from_email, 'direct_accepted', { hawalaId, from_name: _myName });
  return { success: true };
}

export async function deliverDirectHawala(hawalaId: string, toEmail: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: cur } = await _sb.from('net_direct_hawalas').select('*').eq('id', hawalaId).single();
  if (!cur) throw new Error('پیدا نشد');
  await _sb.from('net_direct_hawalas')
    .update({ status: 'delivered', delivered_by_name: _myName, delivered_at: new Date().toISOString() })
    .eq('id', hawalaId);
  await notify(cur.from_email, 'direct_delivered', { hawalaId, from_name: _myName });
  return { success: true };
}

// ═══════════════════════════════════════════════════════
//  گروه‌ها
// ═══════════════════════════════════════════════════════
export async function createGroup(name: string, city: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  if (!name || name.length < 3) throw new Error('نام حداقل ۳ کاراکتر');
  const groupId = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const inviteCode = 'INV-' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const { error } = await _sb.from('net_groups').insert({
    id: groupId, name, owner_email: _myEmail, owner_name: _myName,
    city, invite_code: inviteCode, member_count: 1, status: 'active',
  });
  if (error) throw new Error(error.message);
  await _sb.from('net_group_members').insert({ group_id: groupId, member_email: _myEmail, member_name: _myName, role: 'owner' });
  return { success: true, groupId, inviteCode };
}

export async function inviteToGroupByEmail(groupId: string, targetEmail: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const em = String(targetEmail || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('ایمیل نامعتبر');
  if (em === _myEmail) throw new Error('خودتان عضو هستید');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('گروه پیدا نشد');
  if (grp.owner_email !== _myEmail) throw new Error('فقط مالک');
  const { data: exist } = await _sb.from('net_group_members').select('*').eq('group_id', groupId).eq('member_email', em);
  if (exist && exist.length) throw new Error('قبلاً عضو است');
  const { data: agent } = await _sb.from('net_agents').select('*').eq('email', em).single();
  const name = agent?.name || em.split('@')[0];
  await _sb.from('net_group_members').insert({ group_id: groupId, member_email: em, member_name: name, role: 'member' });
  await _sb.from('net_groups').update({ member_count: (grp.member_count || 1) + 1 }).eq('id', groupId);
  await notify(em, 'group_invite', { groupId, groupName: grp.name, from_name: _myName });
  return { success: true };
}

export async function joinGroupByCode(inviteCode: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!/^INV-[A-Z0-9]{8}$/.test(code)) throw new Error('کد نامعتبر');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('invite_code', code).eq('status', 'active').single();
  if (!grp) throw new Error('گروهی پیدا نشد');
  const { data: exist } = await _sb.from('net_group_members').select('*').eq('group_id', grp.id).eq('member_email', _myEmail);
  if (exist && exist.length) throw new Error('قبلاً عضو');
  await _sb.from('net_group_members').insert({ group_id: grp.id, member_email: _myEmail, member_name: _myName, role: 'member' });
  await _sb.from('net_groups').update({ member_count: (grp.member_count || 1) + 1 }).eq('id', grp.id);
  await notify(grp.owner_email, 'group_join', { groupId: grp.id, groupName: grp.name, from_name: _myName });
  return { success: true, groupId: grp.id };
}

export async function leaveGroup(groupId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('پیدا نشد');
  if (grp.owner_email === _myEmail) throw new Error('مالک نمی‌تواند خارج شود');
  await _sb.from('net_group_members').delete().eq('group_id', groupId).eq('member_email', _myEmail);
  await _sb.from('net_groups').update({ member_count: Math.max(1, (grp.member_count || 1) - 1) }).eq('id', groupId);
  return { success: true };
}

export async function kickGroupMember(groupId: string, memberEmail: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('پیدا نشد');
  if (grp.owner_email !== _myEmail) throw new Error('فقط مالک');
  await _sb.from('net_group_members').delete().eq('group_id', groupId).eq('member_email', memberEmail);
  await _sb.from('net_groups').update({ member_count: Math.max(1, (grp.member_count || 1) - 1) }).eq('id', groupId);
  await notify(memberEmail, 'group_kick', { groupId, groupName: grp.name });
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('پیدا نشد');
  if (grp.owner_email !== _myEmail) throw new Error('فقط مالک');
  await _sb.from('net_group_members').delete().eq('group_id', groupId);
  await _sb.from('net_groups').delete().eq('id', groupId);
  return { success: true };
}

// ═══════════════════════════════════════════════════════
//  نرخ روزانه
// ═══════════════════════════════════════════════════════
export async function saveDailyRateWithBase(currency: string, rate: number, baseCurrency: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  await _sb.from('net_daily_rates').delete().eq('date_str', dateStr).eq('currency', currency).eq('by_email', _myEmail);
  const { error } = await _sb.from('net_daily_rates').insert({
    date_str: dateStr, currency, rate, base_currency: baseCurrency,
    by_email: _myEmail, by_name: _myName,
    rate_time: timeStr,
    valid_from: d.toISOString(),
    valid_until: new Date(d.getTime() + 24 * 3600 * 1000).toISOString(),
    updated_at: d.toISOString(),
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteMyRate(currency: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const { error } = await _sb.from('net_daily_rates').delete().eq('date_str', dateStr).eq('currency', currency).eq('by_email', _myEmail);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function fetchDailyRates(): Promise<any[]> {
  if (!_sb) return [];
  try {
    const d = new Date();
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const { data } = await _sb.from('net_daily_rates').select('*')
      .eq('date_str', dateStr).gt('valid_until', d.toISOString())
      .order('updated_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════
//  فچ‌های دیگر
// ═══════════════════════════════════════════════════════
export async function getAgents(): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data } = await _sb.from('net_agents').select('*').neq('email', _myEmail).order('last_seen', { ascending: false });
    return data || [];
  } catch { return []; }
}

export async function fetchOpenHawalas(city: string): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data: toCity, error: e1 } = await _sb
      .from('net_hawalas').select('*').eq('target_city', city)
      .order('created_at', { ascending: false });
    if (e1) console.log('fetchOpenHawalas toCity error:', e1.message);
    
    const { data: mine, error: e2 } = await _sb
      .from('net_hawalas').select('*').eq('from_email', _myEmail)
      .order('created_at', { ascending: false });
    if (e2) console.log('fetchOpenHawalas mine error:', e2.message);
    
    const all = [...(toCity || []), ...(mine || [])];
    const seen = new Set();
    const now = Date.now();
    return all.filter((h: any) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      // فیلتر expiry در JS
      if (h.expires_at) {
        const exp = new Date(h.expires_at).getTime();
        if (exp <= (now - 5 * 60 * 1000)) return false;
      }
      return h.status === 'open' || h.claimed_by_email === _myEmail || h.from_email === _myEmail;
    });
  } catch (e: any) { console.log('fetchOpenHawalas exception:', e?.message); return []; }
}

export async function fetchFXOffers(): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data, error } = await _sb
      .from('net_fx_offers')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) { console.log('fetchFXOffers error:', error.message); return []; }
    const now = Date.now();
    return (data || []).filter((f: any) => {
      if (!f.expires_at) return true;
      const exp = new Date(f.expires_at).getTime();
      return exp > (now - 5 * 60 * 1000);
    });
  } catch (e: any) { console.log('fetchFXOffers exception:', e?.message); return []; }
}

// ⚡ انقضای خودکار آگهی‌ها — هر ۳۰ ثانیه
export async function expireOldOffers(): Promise<{ fxExpired: number; hawalaExpired: number }> {
  if (!_sb || !_myEmail) return { fxExpired: 0, hawalaExpired: 0 };
  try {
    const now = new Date().toISOString();
    // آگهی‌های خودم که منقضی شده‌اند
    const { data: fx } = await _sb.from('net_fx_offers')
      .select('*').eq('seller_email', _myEmail).eq('status', 'open').lt('expires_at', now);
    let fxCount = 0;
    for (const f of (fx || [])) {
      await _sb.from('net_fx_offers').update({ status: 'expired' }).eq('id', f.id);
      await _sb.from('net_notifications').insert({
        to_email: _myEmail, type: 'fx_expired',
        payload: { offerId: f.id, currency: f.currency, amount: f.amount },
      });
      fxCount++;
    }
    // حواله‌های خودم که منقضی شده‌اند
    const { data: hw } = await _sb.from('net_hawalas')
      .select('*').eq('from_email', _myEmail).eq('status', 'open').lt('expires_at', now);
    let hwCount = 0;
    for (const h of (hw || [])) {
      await _sb.from('net_hawalas').update({ status: 'expired' }).eq('id', h.id);
      await _sb.from('net_notifications').insert({
        to_email: _myEmail, type: 'hawala_expired',
        payload: { hawalaId: h.id, currency: h.currency, amount: h.amount },
      });
      hwCount++;
    }
    return { fxExpired: fxCount, hawalaExpired: hwCount };
  } catch (e: any) { console.log('expireOldOffers error:', e?.message); return { fxExpired: 0, hawalaExpired: 0 }; }
}

// ⚡ فچ فعالیت‌های گروه — شبیه فید تلگرام
export async function fetchGroupFeed(groupId: string): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data: fx } = await _sb.from('net_fx_offers').select('*').eq('target_group_id', groupId).order('created_at', { ascending: false }).limit(30);
    const { data: hw } = await _sb.from('net_hawalas').select('*').eq('target_group_id', groupId).order('created_at', { ascending: false }).limit(30);
    const feed = [
      ...(fx || []).map((f: any) => ({ ...f, _kind: 'fx', _when: f.created_at })),
      ...(hw || []).map((h: any) => ({ ...h, _kind: 'hawala', _when: h.created_at })),
    ];
    feed.sort((a, b) => new Date(b._when).getTime() - new Date(a._when).getTime());
    return feed;
  } catch (e: any) { console.log('fetchGroupFeed error:', e?.message); return []; }
}

export async function fetchMyHawalas(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data } = await _sb.from('net_hawalas').select('*').eq('from_email', _myEmail).order('created_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

export async function fetchDirectInbox(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data } = await _sb.from('net_direct_hawalas').select('*').eq('to_email', _myEmail).order('created_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

export async function fetchMyGroups(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data: m } = await _sb.from('net_group_members').select('group_id, role').eq('member_email', _myEmail);
    if (!m || !m.length) return [];
    const ids = m.map((x: any) => x.group_id);
    const { data: g } = await _sb.from('net_groups').select('*').in('id', ids);
    return (g || []).map((x: any) => {
      const mem = m.find((y: any) => y.group_id === x.id);
      return { ...x, role: mem?.role || 'member', inviteCode: x.invite_code, memberCount: x.member_count };
    });
  } catch { return []; }
}

export async function getGroupDetails(groupId: string): Promise<any> {
  if (!_sb) return null;
  try {
    const [gR, mR] = await Promise.all([
      _sb.from('net_groups').select('*').eq('id', groupId).single(),
      _sb.from('net_group_members').select('*').eq('group_id', groupId).order('joined_at'),
    ]);
    const meta = gR.data ? { ...gR.data, inviteCode: gR.data.invite_code, ownerEmail: gR.data.owner_email, ownerName: gR.data.owner_name } : null;
    const members = (mR.data || []).map((m: any) => ({ key: m.member_email, email: m.member_email, name: m.member_name, role: m.role, joinedAt: m.joined_at }));
    return { meta, members };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════
//  Polling
// ═══════════════════════════════════════════════════════
function startPoll(key: string, fn: () => Promise<void>, ms: number = 2000) {
  stopPoll(key);
  fn();
  _polls[key] = setInterval(fn, ms);
}
export function stopPoll(key: string): void {
  if (_polls[key]) { clearInterval(_polls[key]); delete _polls[key]; }
}

export function listenOpenHawalas(city: string, cb: (l: any[]) => void): void { startPoll('h', async () => cb(await fetchOpenHawalas(city))); }
export function listenFXOffers(cb: (l: any[]) => void): void { startPoll('fx', async () => cb(await fetchFXOffers())); }
export function listenMyHawalas(cb: (l: any[]) => void): void { startPoll('mh', async () => cb(await fetchMyHawalas())); }
export function listenDirectInbox(cb: (l: any[]) => void): void { startPoll('di', async () => cb(await fetchDirectInbox())); }
export function listenMyGroups(cb: (l: any[]) => void): void { startPoll('mg', async () => cb(await fetchMyGroups())); }
export function listenDailyRates(cb: (l: any[]) => void): void { startPoll('r', async () => cb(await fetchDailyRates())); }
export function listenNotifications(cb: (l: any[]) => void): void { startPoll('n', async () => cb(await fetchNotifications()), 3000); }
export function listenMyFXOffers(cb: (l: any[]) => void): void { startPoll('mfx', async () => cb(await fetchMyFXOffers())); }

export function stopAllListeners(): void { Object.keys(_polls).forEach(stopPoll); }

export async function testFirebaseConnection(): Promise<{ ok: boolean; message: string }> {
  const sb = await getSB();
  if (!sb) return { ok: false, message: 'Supabase در دسترس نیست' };
  try {
    const { error } = await sb.from('net_agents').select('email').limit(1);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Supabase متصل' };
  } catch (e: any) { return { ok: false, message: e?.message || 'خطا' }; }
}


// ═══════════════════════════════════════════════════════
//  تنظیمات نوتیفیکیشن کاربر
// ═══════════════════════════════════════════════════════
const DEFAULT_PREFS = {
  notify_fx_claim: true,
  notify_hawala_claim: true,
  notify_direct: true,
  notify_fx_new: false,
  notify_hawala_new: false,
  notify_sound: true,
  notify_browser: true,
  notify_vibrate: true,
  watch_cities: ['KBL', 'HRT', 'MZR', 'KDH'],
  watch_currencies: ['USD', 'EUR'],
};

export async function fetchPreferences(): Promise<any> {
  if (!_sb || !_myEmail) return { ...DEFAULT_PREFS };
  try {
    const { data } = await _sb.from('net_preferences').select('*').eq('email', _myEmail).single();
    if (!data) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...data };
  } catch { return { ...DEFAULT_PREFS }; }
}

export async function savePreferences(prefs: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const payload = {
    email: _myEmail,
    notify_fx_claim: !!prefs.notify_fx_claim,
    notify_hawala_claim: !!prefs.notify_hawala_claim,
    notify_direct: !!prefs.notify_direct,
    notify_fx_new: !!prefs.notify_fx_new,
    notify_hawala_new: !!prefs.notify_hawala_new,
    notify_sound: !!prefs.notify_sound,
    notify_browser: !!prefs.notify_browser,
    notify_vibrate: !!prefs.notify_vibrate,
    watch_cities: prefs.watch_cities || DEFAULT_PREFS.watch_cities,
    watch_currencies: prefs.watch_currencies || DEFAULT_PREFS.watch_currencies,
    updated_at: new Date().toISOString(),
  };
  const { error } = await _sb.from('net_preferences').upsert(payload, { onConflict: 'email' });
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══ فچ تمام نوتیف (read + unread) ═══
export async function fetchAllNotifications(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data } = await _sb.from('net_notifications').select('*').eq('to_email', _myEmail).order('created_at', { ascending: false }).limit(50);
    return data || [];
  } catch { return []; }
}

export async function markAllRead(): Promise<void> {
  if (!_sb || !_myEmail) return;
  try { await _sb.from('net_notifications').update({ is_read: true }).eq('to_email', _myEmail); } catch {}
}

export async function deleteNotification(id: number): Promise<void> {
  if (!_sb) return;
  try { await _sb.from('net_notifications').delete().eq('id', id); } catch {}
}

// ═══════════════════════════════════════════════════════════
//  چت خصوصی — Messages
// ═══════════════════════════════════════════════════════════

export async function sendMessage(roomId: string, toEmail: string, text: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  if (!text || !text.trim()) throw new Error('پیام خالی');
  if (!roomId || !toEmail) throw new Error('اتاق یا مقصد نامشخص');
  const { error } = await _sb.from('net_messages').insert({
    room_id: roomId,
    from_email: _myEmail,
    from_name: _myName || _myEmail.split('@')[0],
    to_email: toEmail,
    text: text.trim().slice(0, 2000),
    is_read: false,
  });
  if (error) { console.log('sendMessage error:', error.message); throw new Error(error.message); }
  return { success: true };
}

export async function fetchMessages(roomId: string): Promise<any[]> {
  if (!_sb || !roomId) return [];
  try {
    const { data, error } = await _sb
      .from('net_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) { console.log('fetchMessages error:', error.message); return []; }
    return data || [];
  } catch (e: any) { console.log('fetchMessages exception:', e?.message); return []; }
}

export async function markRoomRead(roomId: string): Promise<void> {
  if (!_sb || !_myEmail || !roomId) return;
  try {
    await _sb.from('net_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .eq('to_email', _myEmail)
      .eq('is_read', false);
  } catch (e) {}
}

export async function fetchMyUnreadMessages(): Promise<any[]> {
  if (!_sb || !_myEmail) return [];
  try {
    const { data } = await _sb
      .from('net_messages')
      .select('*')
      .eq('to_email', _myEmail)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  } catch { return []; }
}

// ⚡ لیستنر چت — هر ۳ ثانیه پیام‌های جدید را می‌آورد
export function listenMessages(roomId: string, cb: (msgs: any[]) => void): void {
  startPoll('msg_' + roomId, async () => {
    try {
      const msgs = await fetchMessages(roomId);
      cb(msgs);
    } catch {}
  }, 3000);
}

export function stopMessagesListen(roomId: string): void {
  stopPoll('msg_' + roomId);
}
