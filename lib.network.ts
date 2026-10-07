// lib.network.ts — شبکه صرافی (Supabase Realtime)
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
let _channels: any = {};

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
    if (sb) {
      const { data } = await sb.auth.getSession();
      return data?.session?.user?.email || '';
    }
  } catch {}
  return '';
}

export function getMyNetInfo() {
  return { email: _myEmail, name: _myName, city: _myCity, phone: _myPhone, connected: _connected };
}

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
  try {
    await _registerAgent();
    _connected = true;
    return true;
  } catch (e: any) {
    console.log('[NET] init:', e?.message);
    return false;
  }
}

async function _registerAgent(): Promise<void> {
  if (!_sb || !_myEmail) return;
  try {
    await _sb.from('net_agents').upsert({
      email: _myEmail, name: _myName || _myEmail.split('@')[0],
      city: _myCity || '', phone: _myPhone || '', online: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'email' });
  } catch (e: any) { console.log('register agent:', e?.message); }
}

// ═══════════════════════════════════════════
//  نوتیفیکیشن (داخلی)
// ═══════════════════════════════════════════
async function notify(toEmail: string, type: string, payload: any = {}): Promise<void> {
  if (!_sb || !toEmail) return;
  try {
    await _sb.from('net_notifications').insert({
      to_email: toEmail, type, payload: payload || {},
    });
  } catch {}
}

// ═══════════════════════════════════════════
//  بازار آزاد — حواله عمومی
// ═══════════════════════════════════════════
export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { error } = await _sb.from('net_hawalas').insert({
    id: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    target_city: h.targetCity, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    max_fee: h.maxFee || 2, note: h.note || '',
    status: 'open',
    expires_at: new Date(h.expiresAt || Date.now() + 15 * 60000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { success: true, id: h.id };
}

export async function claimHawala(taskId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  // خواندن + قفل کردن اتمی
  const { data: cur } = await _sb.from('net_hawalas').select('*').eq('id', taskId).single();
  if (!cur) return { success: false, message: 'حواله پیدا نشد' };
  if (cur.status !== 'open') return { success: false, message: 'دیر رسیدی — ' + (cur.claimed_by_name || 'صراف دیگری') };
  if (cur.from_email === _myEmail) return { success: false, message: 'خودتان فرستادید' };
  // UPDATE شرطی — فقط اگه هنوز open باشه
  const { data: upd, error } = await _sb.from('net_hawalas')
    .update({ status: 'locked', claimed_by_email: _myEmail, claimed_by_name: _myName, claimed_at: new Date().toISOString() })
    .eq('id', taskId).eq('status', 'open').select();
  if (error) return { success: false, message: error.message };
  if (!upd || !upd.length) return { success: false, message: 'دیر رسیدی' };
  await notify(cur.from_email, 'hawala_taken', { taskId, claimed_by_name: _myName });
  return { success: true, task: upd[0] };
}

// ═══════════════════════════════════════════
//  بازار آزاد — فروش ارز
// ═══════════════════════════════════════════
export async function sendFXOffer(o: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { error } = await _sb.from('net_fx_offers').insert({
    id: o.id, seller_email: _myEmail, seller_name: _myName, seller_city: _myCity,
    currency: o.currency, amount: o.amount, rate_type: o.rateType || 'fixed',
    rate: o.rate || 0, note: o.note || '', status: 'open',
    expires_at: new Date(o.expiresAt || Date.now() + 10 * 60000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { success: true, id: o.id };
}

export async function claimFXOffer(offerId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { data: cur } = await _sb.from('net_fx_offers').select('*').eq('id', offerId).single();
  if (!cur) return { success: false, message: 'آگهی پیدا نشد' };
  if (cur.status !== 'open') return { success: false, message: 'دیر رسیدی' };
  if (cur.seller_email === _myEmail) return { success: false, message: 'خودتان فروشنده‌اید' };
  const { data: upd, error } = await _sb.from('net_fx_offers')
    .update({ status: 'locked', claimed_by_email: _myEmail, claimed_by_name: _myName, claimed_at: new Date().toISOString() })
    .eq('id', offerId).eq('status', 'open').select();
  if (error) return { success: false, message: error.message };
  if (!upd || !upd.length) return { success: false, message: 'دیر رسیدی' };
  await notify(cur.seller_email, 'fx_taken', { offerId, claimed_by_name: _myName });
  return { success: true, offer: upd[0] };
}

// ═══════════════════════════════════════════
//  حواله خصوصی (به یک نفر)
// ═══════════════════════════════════════════
export async function sendDirectHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  if (!h.toEmail) throw new Error('صراف مقصد انتخاب نشده');
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
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { data: cur } = await _sb.from('net_direct_hawalas').select('*').eq('id', hawalaId).single();
  if (!cur) throw new Error('حواله پیدا نشد');
  if (cur.status !== 'pending') throw new Error('قبلاً قبول شده');
  const { error } = await _sb.from('net_direct_hawalas')
    .update({ status: 'accepted', accepted_by_name: _myName, accepted_at: new Date().toISOString() })
    .eq('id', hawalaId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  await notify(cur.from_email, 'direct_hawala_accepted', { hawalaId, accepted_by_name: _myName });
  return { success: true };
}

export async function deliverDirectHawala(hawalaId: string, toEmail: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { data: cur } = await _sb.from('net_direct_hawalas').select('*').eq('id', hawalaId).single();
  if (!cur) throw new Error('حواله پیدا نشد');
  await _sb.from('net_direct_hawalas')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', hawalaId);
  await notify(cur.from_email, 'direct_hawala_delivered', { hawalaId });
  return { success: true };
}

// ═══════════════════════════════════════════
//  گروه‌های خصوصی
// ═══════════════════════════════════════════
export async function createGroup(name: string, city: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  if (!name || name.length < 3) throw new Error('نام حداقل ۳ کاراکتر');
  const groupId = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const inviteCode = 'INV-' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const { error } = await _sb.from('net_groups').insert({
    id: groupId, name, owner_email: _myEmail, owner_name: _myName,
    city, invite_code: inviteCode, member_count: 1, status: 'active',
  });
  if (error) throw new Error(error.message);
  await _sb.from('net_group_members').insert({
    group_id: groupId, member_email: _myEmail, member_name: _myName, role: 'owner',
  });
  return { success: true, groupId, inviteCode };
}

export async function inviteToGroupByEmail(groupId: string, targetEmail: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const em = String(targetEmail || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('ایمیل نامعتبر');
  if (em === _myEmail) throw new Error('خودتان عضو هستید');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('گروه پیدا نشد');
  if (grp.owner_email !== _myEmail) throw new Error('فقط مالک می‌تواند دعوت کند');
  const { data: exist } = await _sb.from('net_group_members').select('*').eq('group_id', groupId).eq('member_email', em);
  if (exist && exist.length) throw new Error('قبلاً عضو است');
  // پیدا کردن نام از agents
  const { data: agent } = await _sb.from('net_agents').select('*').eq('email', em).single();
  const name = agent?.name || em.split('@')[0];
  await _sb.from('net_group_members').insert({
    group_id: groupId, member_email: em, member_name: name, role: 'member',
  });
  await _sb.from('net_groups').update({ member_count: (grp.member_count || 1) + 1 }).eq('id', groupId);
  await notify(em, 'group_invite', { groupId, groupName: grp.name, from_name: _myName });
  return { success: true };
}

export async function joinGroupByCode(inviteCode: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!/^INV-[A-Z0-9]{8}$/.test(code)) throw new Error('کد نامعتبر');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('invite_code', code).eq('status', 'active').single();
  if (!grp) throw new Error('گروهی با این کد پیدا نشد');
  const { data: exist } = await _sb.from('net_group_members').select('*').eq('group_id', grp.id).eq('member_email', _myEmail);
  if (exist && exist.length) throw new Error('قبلاً عضو هستید');
  await _sb.from('net_group_members').insert({
    group_id: grp.id, member_email: _myEmail, member_name: _myName, role: 'member',
  });
  await _sb.from('net_groups').update({ member_count: (grp.member_count || 1) + 1 }).eq('id', grp.id);
  await notify(grp.owner_email, 'group_join', { groupId: grp.id, groupName: grp.name, from_name: _myName });
  return { success: true, groupId: grp.id };
}

export async function leaveGroup(groupId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('گروه پیدا نشد');
  if (grp.owner_email === _myEmail) throw new Error('مالک نمی‌تواند خارج شود');
  await _sb.from('net_group_members').delete().eq('group_id', groupId).eq('member_email', _myEmail);
  await _sb.from('net_groups').update({ member_count: Math.max(1, (grp.member_count || 1) - 1) }).eq('id', groupId);
  return { success: true };
}

export async function kickGroupMember(groupId: string, memberEmail: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('گروه پیدا نشد');
  if (grp.owner_email !== _myEmail) throw new Error('فقط مالک');
  await _sb.from('net_group_members').delete().eq('group_id', groupId).eq('member_email', memberEmail);
  await _sb.from('net_groups').update({ member_count: Math.max(1, (grp.member_count || 1) - 1) }).eq('id', groupId);
  await notify(memberEmail, 'group_kick', { groupId, groupName: grp.name });
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const { data: grp } = await _sb.from('net_groups').select('*').eq('id', groupId).single();
  if (!grp) throw new Error('گروه پیدا نشد');
  if (grp.owner_email !== _myEmail) throw new Error('فقط مالک');
  await _sb.from('net_group_members').delete().eq('group_id', groupId);
  await _sb.from('net_groups').delete().eq('id', groupId);
  return { success: true };
}

// ═══════════════════════════════════════════
//  نرخ روزانه
// ═══════════════════════════════════════════
export async function saveDailyRate(currency: string, rate: number): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('شبکه متصل نیست');
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const { error } = await _sb.from('net_daily_rates').upsert({
    date_str: dateStr, currency, rate, by_email: _myEmail, by_name: _myName,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'date_str,currency' });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function fetchDailyRates(): Promise<any> {
  if (!_sb) return {};
  try {
    const d = new Date();
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const { data } = await _sb.from('net_daily_rates').select('*').eq('date_str', dateStr);
    const result: any = {};
    (data || []).forEach((r: any) => { result[r.currency] = { rate: r.rate, byName: r.by_name, byEmail: r.by_email }; });
    return result;
  } catch { return {}; }
}

// ═══════════════════════════════════════════
//  لیست صرافان
// ═══════════════════════════════════════════
export async function getAgents(): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data } = await _sb.from('net_agents').select('*').neq('email', _myEmail).order('last_seen', { ascending: false });
    return data || [];
  } catch { return []; }
}

// ═══════════════════════════════════════════
//  Fetch — خواندن داده‌ها
// ═══════════════════════════════════════════
export async function fetchOpenHawalas(city: string): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data } = await _sb.from('net_hawalas').select('*').eq('target_city', city).order('created_at', { ascending: false });
    return (data || []).filter((h: any) => h.status === 'open' || h.claimed_by_email === _myEmail);
  } catch { return []; }
}

export async function fetchFXOffers(): Promise<any[]> {
  if (!_sb) return [];
  try {
    const { data } = await _sb.from('net_fx_offers').select('*').eq('status', 'open').neq('seller_email', _myEmail).order('created_at', { ascending: false });
    return data || [];
  } catch { return []; }
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
    const { data: memberships } = await _sb.from('net_group_members').select('group_id, role').eq('member_email', _myEmail);
    if (!memberships || !memberships.length) return [];
    const ids = memberships.map((m: any) => m.group_id);
    const { data: groups } = await _sb.from('net_groups').select('*').in('id', ids);
    return (groups || []).map((g: any) => {
      const mem = memberships.find((m: any) => m.group_id === g.id);
      return { ...g, id: g.id, role: mem?.role || 'member', inviteCode: g.invite_code, memberCount: g.member_count };
    });
  } catch { return []; }
}

export async function getGroupDetails(groupId: string): Promise<any> {
  if (!_sb) return null;
  try {
    const [gRes, mRes] = await Promise.all([
      _sb.from('net_groups').select('*').eq('id', groupId).single(),
      _sb.from('net_group_members').select('*').eq('group_id', groupId).order('joined_at'),
    ]);
    const meta = gRes.data ? { ...gRes.data, inviteCode: gRes.data.invite_code, ownerEmail: gRes.data.owner_email, ownerName: gRes.data.owner_name } : null;
    const members = (mRes.data || []).map((m: any) => ({ key: m.member_email, email: m.member_email, name: m.member_name, role: m.role, joinedAt: m.joined_at }));
    return { meta, members };
  } catch { return null; }
}

// ═══════════════════════════════════════════
//  Realtime Listeners (Polling-based)
// ═══════════════════════════════════════════
let _polls: any = {};

function startPoll(key: string, fn: () => Promise<void>, intervalMs: number = 3000) {
  stopPoll(key);
  fn();
  _polls[key] = setInterval(fn, intervalMs);
}

export function stopPoll(key: string): void {
  if (_polls[key]) { clearInterval(_polls[key]); delete _polls[key]; }
}

export function listenOpenHawalas(city: string, cb: (list: any[]) => void): void {
  startPoll('hawalas', async () => { cb(await fetchOpenHawalas(city)); });
}

export function listenFXOffers(cb: (list: any[]) => void): void {
  startPoll('fx', async () => { cb(await fetchFXOffers()); });
}

export function listenMyHawalas(cb: (list: any[]) => void): void {
  startPoll('myHawalas', async () => { cb(await fetchMyHawalas()); });
}

export function listenDirectInbox(cb: (list: any[]) => void): void {
  startPoll('directInbox', async () => { cb(await fetchDirectInbox()); });
}

export function listenMyGroups(cb: (list: any[]) => void): void {
  startPoll('myGroups', async () => { cb(await fetchMyGroups()); });
}

export function listenDailyRates(cb: (rates: any) => void): void {
  startPoll('rates', async () => { cb(await fetchDailyRates()); });
}

export function stopAllListeners(): void {
  Object.keys(_polls).forEach(stopPoll);
}

export async function testFirebaseConnection(): Promise<{ ok: boolean; message: string }> {
  const sb = await getSB();
  if (!sb) return { ok: false, message: 'Supabase در دسترس نیست' };
  try {
    const { error } = await sb.from('net_agents').select('email').limit(1);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Supabase متصل' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'خطا' };
  }
}
