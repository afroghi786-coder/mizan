
# ═══════════════════════════════════════════════════════
# ۱) lib.network.ts — کامل از صفر با ایمیل
# ═══════════════════════════════════════════════════════
cat > lib.network.ts << 'END_NET'
// lib.network.ts — شبکه صرافی (Firebase + ایمیل Supabase)
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAJ3zAb9uxnoauZi2N4JeeiwB1jxsAloN0',
  authDomain: 'mizan-network.firebaseapp.com',
  databaseURL: 'https://mizan-network-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'mizan-network',
  storageBucket: 'mizan-network.firebasestorage.app',
  messagingSenderId: '573462235315',
  appId: '1:573462235315:web:abba55e2fc382b37bcc8c6',
};

export const NET_CITIES: Record<string, string> = {
  KBL: 'کابل', HRT: 'هرات', MZR: 'مزار شریف', KDH: 'کندهار',
  JAL: 'جلال‌آباد', KDZ: 'قندوز', GHZ: 'غزنی', BAM: 'بامیان',
};

let _fb: any = null;
let _db: any = null;
let _init = false;
let _connected = false;
let _myEmail = '';
let _myName = '';
let _myCity = '';
let _myPhone = '';
let _listeners: any = {};

export function emailToKey(email: string): string {
  return String(email || '').toLowerCase().trim()
    .replace(/\./g, '_dot_')
    .replace(/[#$\[\]]/g, '_')
    .replace(/\//g, '_');
}

export async function getCurrentEmail(): Promise<string> {
  try {
    const mod: any = await import('./lib.offline');
    const sb = mod.supabase;
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
export function isNetReady() { return _init && _db !== null; }

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
  if (_db && _myEmail) await _registerAgent();
}

export async function initNetwork(): Promise<boolean> {
  if (_init) return true;
  try {
    const firebase = require('firebase/compat/app');
    require('firebase/compat/database');
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _fb = firebase;
    _db = firebase.database();
    _init = true;
    await loadNetSettings();
    _db.ref('.info/connected').on('value', (snap: any) => {
      const was = _connected;
      _connected = !!snap.val();
      if (_connected && !was && _myEmail) { _registerAgent(); _registerPresence(); }
    });
    if (_myEmail) await _registerAgent();
    return true;
  } catch (e: any) { console.log('[NET] init:', e?.message); return false; }
}

async function _registerAgent(): Promise<void> {
  if (!_db || !_myEmail) return;
  try {
    await _db.ref('agents/' + emailToKey(_myEmail)).update({
      email: _myEmail, name: _myName, city: _myCity, phone: _myPhone,
      lastSeen: _fb.database.ServerValue.TIMESTAMP, online: true,
    });
  } catch {}
}

async function _registerPresence(): Promise<void> {
  if (!_db || !_myEmail) return;
  try {
    const ref = _db.ref('presence/' + emailToKey(_myEmail));
    await ref.onDisconnect().remove();
    await ref.set({ email: _myEmail, name: _myName, city: _myCity, timestamp: _fb.database.ServerValue.TIMESTAMP });
  } catch {}
}

async function notifyAgentByEmail(targetEmail: string, notif: any): Promise<void> {
  if (!_db || !targetEmail) return;
  const nid = 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try { await _db.ref('inbox/' + emailToKey(targetEmail) + '/' + nid).set({ ...notif, read: false }); } catch {}
}

// ═══ بازار عمومی — فروش ارز ═══
export async function sendFXOffer(o: any): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const ref = _db.ref('fx_offers/' + o.id);
  await ref.set({
    sellerEmail: _myEmail, sellerKey: emailToKey(_myEmail), sellerName: _myName, sellerCity: _myCity,
    currency: o.currency, amount: o.amount, rateType: o.rateType,
    rate: o.rate || 0, note: o.note || '',
    status: 'open', claimedByEmail: null, claimedByName: null, claimedAt: null,
    createdAt: _fb.database.ServerValue.TIMESTAMP,
    expiresAt: o.expiresAt || Date.now() + 10 * 60 * 1000,
  });
  return { success: true, id: o.id };
}

export async function claimFXOffer(offerId: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const ref = _db.ref('fx_offers/' + offerId);
  return new Promise((resolve) => {
    ref.transaction((cur: any) => {
      if (cur === null) return;
      if (cur.status !== 'open') return;
      if (cur.sellerEmail === _myEmail) return;
      cur.status = 'locked';
      cur.claimedByEmail = _myEmail;
      cur.claimedByName = _myName;
      cur.claimedAt = Date.now();
      return cur;
    }, (err: any, committed: boolean, snap: any) => {
      if (err) return resolve({ success: false, message: 'خطا' });
      if (!committed) { const c = snap ? snap.val() : {}; return resolve({ success: false, message: 'دیر رسیدی — ' + (c.claimedByName || 'صراف دیگری') }); }
      const offer = snap.val();
      notifyAgentByEmail(offer.sellerEmail, { type: 'fx_taken', offerId, claimedByName: _myName, timestamp: Date.now() });
      resolve({ success: true, offer });
    });
  });
}

// ═══ بازار عمومی — حواله ═══
export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const ref = _db.ref('tasks/' + h.id);
  await ref.set({
    fromEmail: _myEmail, fromKey: emailToKey(_myEmail), fromName: _myName, fromCity: _myCity,
    targetCity: h.targetCity, currency: h.currency, amount: h.amount,
    beneficiaryName: h.beneficiaryName, beneficiaryPhone: h.beneficiaryPhone || '',
    maxFee: h.maxFee || 2, note: h.note || '',
    status: 'open', claimedByEmail: null, claimedByName: null, claimedAt: null,
    createdAt: _fb.database.ServerValue.TIMESTAMP,
    expiresAt: h.expiresAt || Date.now() + 15 * 60 * 1000,
  });
  return { success: true, id: h.id };
}

export async function claimHawala(taskId: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const ref = _db.ref('tasks/' + taskId);
  return new Promise((resolve) => {
    ref.transaction((cur: any) => {
      if (cur === null) return;
      if (cur.status !== 'open') return;
      if (cur.fromEmail === _myEmail) return;
      cur.status = 'locked';
      cur.claimedByEmail = _myEmail;
      cur.claimedByName = _myName;
      cur.claimedAt = Date.now();
      return cur;
    }, (err: any, committed: boolean, snap: any) => {
      if (err) return resolve({ success: false, message: 'خطا' });
      if (!committed) { const c = snap ? snap.val() : {}; return resolve({ success: false, message: 'دیر رسیدی — ' + (c.claimedByName || 'صرافی دیگر') }); }
      const task = snap.val();
      notifyAgentByEmail(task.fromEmail, { type: 'hawala_taken', taskId, claimedByName: _myName, timestamp: Date.now() });
      resolve({ success: true, task });
    });
  });
}

// ═══ حواله خصوصی — به ایمیل خاص ═══
export async function sendDirectHawala(h: any): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  if (!h.toEmail) throw new Error('صراف مقصد انتخاب نشده');
  const ref = _db.ref('direct_hawalas/' + emailToKey(h.toEmail) + '/' + h.id);
  await ref.set({
    fromEmail: _myEmail, fromKey: emailToKey(_myEmail), fromName: _myName, fromCity: _myCity,
    toEmail: h.toEmail, toKey: emailToKey(h.toEmail),
    currency: h.currency, amount: h.amount,
    beneficiaryName: h.beneficiaryName, beneficiaryPhone: h.beneficiaryPhone || '',
    commission: h.commission || 0, note: h.note || '',
    status: 'pending', acceptedByName: null, acceptedAt: null, deliveredAt: null,
    createdAt: _fb.database.ServerValue.TIMESTAMP,
  });
  notifyAgentByEmail(h.toEmail, { type: 'direct_hawala', hawalaId: h.id, fromEmail: _myEmail, fromName: _myName, amount: h.amount, currency: h.currency, timestamp: Date.now() });
  return { success: true, id: h.id };
}

export async function acceptDirectHawala(hawalaId: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const ref = _db.ref('direct_hawalas/' + emailToKey(_myEmail) + '/' + hawalaId);
  const snap = await ref.once('value');
  const v = snap.val();
  if (!v) throw new Error('حواله پیدا نشد');
  if (v.status !== 'pending') throw new Error('قبلاً قبول شده');
  await ref.update({ status: 'accepted', acceptedByName: _myName, acceptedAt: Date.now() });
  notifyAgentByEmail(v.fromEmail, { type: 'direct_hawala_accepted', hawalaId, acceptedByName: _myName, timestamp: Date.now() });
  return { success: true };
}

export async function deliverDirectHawala(hawalaId: string, toEmail: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const ref = _db.ref('direct_hawalas/' + emailToKey(toEmail) + '/' + hawalaId);
  await ref.update({ status: 'delivered', deliveredAt: Date.now() });
  const snap = await ref.once('value');
  const v = snap.val();
  if (v) notifyAgentByEmail(v.fromEmail, { type: 'direct_hawala_delivered', hawalaId, timestamp: Date.now() });
  return { success: true };
}

// ═══ گروه‌های خصوصی ═══
export async function createGroup(name: string, city: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  if (!name || name.length < 3) throw new Error('نام حداقل ۳ کاراکتر');
  const groupId = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const inviteCode = 'INV-' + Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const now = Date.now();
  const updates: any = {};
  updates['groups/' + groupId + '/meta'] = { name, ownerEmail: _myEmail, ownerKey: emailToKey(_myEmail), ownerName: _myName, city, inviteCode, createdAt: now, memberCount: 1, status: 'active' };
  updates['groups/' + groupId + '/members/' + emailToKey(_myEmail)] = { email: _myEmail, name: _myName, role: 'owner', joinedAt: now };
  updates['agents/' + emailToKey(_myEmail) + '/groups/' + groupId] = { role: 'owner', joinedAt: now };
  await _db.ref().update(updates);
  return { success: true, groupId, inviteCode };
}

export async function inviteToGroupByEmail(groupId: string, targetEmail: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const em = String(targetEmail || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('ایمیل نامعتبر');
  if (em === _myEmail) throw new Error('خودتان عضو هستید');
  const metaSnap = await _db.ref('groups/' + groupId + '/meta').once('value');
  const meta = metaSnap.val();
  if (!meta) throw new Error('گروه پیدا نشد');
  if (meta.ownerEmail !== _myEmail) throw new Error('فقط مالک می‌تواند دعوت کند');
  const memberSnap = await _db.ref('groups/' + groupId + '/members/' + emailToKey(em)).once('value');
  if (memberSnap.exists()) throw new Error('قبلاً عضو است');
  // پیدا کردن نام از agents
  const agentSnap = await _db.ref('agents/' + emailToKey(em)).once('value');
  const agent = agentSnap.val() || {};
  const name = agent.name || em.split('@')[0];
  const now = Date.now();
  const updates: any = {};
  updates['groups/' + groupId + '/members/' + emailToKey(em)] = { email: em, name, role: 'member', joinedAt: now };
  updates['agents/' + emailToKey(em) + '/groups/' + groupId] = { role: 'member', joinedAt: now };
  updates['groups/' + groupId + '/meta/memberCount'] = (meta.memberCount || 1) + 1;
  await _db.ref().update(updates);
  notifyAgentByEmail(em, { type: 'group_invite', groupId, groupName: meta.name, fromEmail: _myEmail, fromName: _myName, timestamp: now });
  return { success: true };
}

export async function joinGroupByCode(inviteCode: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!/^INV-[A-Z0-9]{8}$/.test(code)) throw new Error('کد نامعتبر');
  const snap = await _db.ref('groups').once('value');
  let foundId = '', found: any = null;
  snap.forEach((c: any) => {
    const v = c.val();
    if (v && v.meta && v.meta.inviteCode === code && v.meta.status === 'active') { foundId = c.key; found = v; }
  });
  if (!foundId) throw new Error('گروهی با این کد پیدا نشد');
  if (found.members && found.members[emailToKey(_myEmail)]) throw new Error('قبلاً عضو هستید');
  const now = Date.now();
  const updates: any = {};
  updates['groups/' + foundId + '/members/' + emailToKey(_myEmail)] = { email: _myEmail, name: _myName, role: 'member', joinedAt: now };
  updates['agents/' + emailToKey(_myEmail) + '/groups/' + foundId] = { role: 'member', joinedAt: now };
  updates['groups/' + foundId + '/meta/memberCount'] = (found.meta.memberCount || 1) + 1;
  await _db.ref().update(updates);
  notifyAgentByEmail(found.meta.ownerEmail, { type: 'group_join', groupId: foundId, groupName: found.meta.name, fromName: _myName, timestamp: now });
  return { success: true, groupId: foundId };
}

export async function leaveGroup(groupId: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const metaSnap = await _db.ref('groups/' + groupId + '/meta').once('value');
  const meta = metaSnap.val();
  if (!meta) throw new Error('گروه پیدا نشد');
  if (meta.ownerEmail === _myEmail) throw new Error('مالک نمی‌تواند خارج شود');
  const updates: any = {};
  updates['groups/' + groupId + '/members/' + emailToKey(_myEmail)] = null;
  updates['agents/' + emailToKey(_myEmail) + '/groups/' + groupId] = null;
  await _db.ref().update(updates);
  return { success: true };
}

export async function kickGroupMember(groupId: string, memberEmail: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const metaSnap = await _db.ref('groups/' + groupId + '/meta').once('value');
  const meta = metaSnap.val();
  if (!meta) throw new Error('گروه پیدا نشد');
  if (meta.ownerEmail !== _myEmail) throw new Error('فقط مالک');
  const updates: any = {};
  updates['groups/' + groupId + '/members/' + emailToKey(memberEmail)] = null;
  updates['agents/' + emailToKey(memberEmail) + '/groups/' + groupId] = null;
  await _db.ref().update(updates);
  notifyAgentByEmail(memberEmail, { type: 'group_kick', groupId, groupName: meta.name, timestamp: Date.now() });
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const metaSnap = await _db.ref('groups/' + groupId + '/meta').once('value');
  const meta = metaSnap.val();
  if (!meta) throw new Error('گروه پیدا نشد');
  if (meta.ownerEmail !== _myEmail) throw new Error('فقط مالک');
  const membersSnap = await _db.ref('groups/' + groupId + '/members').once('value');
  const updates: any = {};
  updates['groups/' + groupId] = null;
  membersSnap.forEach((c: any) => { updates['agents/' + c.key + '/groups/' + groupId] = null; });
  await _db.ref().update(updates);
  return { success: true };
}

// ═══ نرخ روزانه ═══
export async function saveDailyRate(currency: string, rate: number): Promise<any> {
  if (!_db || !_myEmail) throw new Error('متصل نیست');
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await _db.ref('daily_rates/' + dateStr + '/' + currency).set({
    rate, byEmail: _myEmail, byName: _myName, at: Date.now(),
  });
  return { success: true };
}

export function listenDailyRates(cb: (rates: any) => void): void {
  if (!_db) return;
  stopListener('rates');
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ref = _db.ref('daily_rates/' + dateStr);
  const cbFn = ref.on('value', (snap: any) => cb(snap.val() || {}));
  _listeners.rates = { ref, event: 'value', cb: cbFn };
}

// ═══ Listeners ═══
export function listenOpenHawalas(city: string, cb: (list: any[]) => void): void {
  if (!_db) return;
  stopListener('hawalas');
  const ref = _db.ref('tasks').orderByChild('targetCity').equalTo(city);
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((child: any) => {
      const v = child.val();
      if (v && (v.status === 'open' || v.claimedByEmail === _myEmail)) list.push({ id: child.key, ...v });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.hawalas = { ref, event: 'value', cb: cbFn };
}

export function listenFXOffers(cb: (list: any[]) => void): void {
  if (!_db) return;
  stopListener('fx');
  const ref = _db.ref('fx_offers').orderByChild('status').equalTo('open');
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((child: any) => {
      const v = child.val();
      if (v && v.sellerEmail !== _myEmail) list.push({ id: child.key, ...v });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.fx = { ref, event: 'value', cb: cbFn };
}

export function listenMyHawalas(cb: (list: any[]) => void): void {
  if (!_db || !_myEmail) return;
  stopListener('myHawalas');
  const ref = _db.ref('tasks').orderByChild('fromEmail').equalTo(_myEmail);
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((child: any) => { const v = child.val(); if (v) list.push({ id: child.key, ...v }); });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.myHawalas = { ref, event: 'value', cb: cbFn };
}

export function listenDirectInbox(cb: (list: any[]) => void): void {
  if (!_db || !_myEmail) return;
  stopListener('directInbox');
  const ref = _db.ref('direct_hawalas/' + emailToKey(_myEmail));
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((child: any) => { const v = child.val(); if (v) list.push({ id: child.key, ...v }); });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.directInbox = { ref, event: 'value', cb: cbFn };
}

export function listenMyGroups(cb: (list: any[]) => void): void {
  if (!_db || !_myEmail) return;
  stopListener('myGroups');
  const ref = _db.ref('agents/' + emailToKey(_myEmail) + '/groups');
  const cbFn = ref.on('value', async (snap: any) => {
    const ids: any[] = [];
    snap.forEach((c: any) => ids.push({ id: c.key, ...c.val() }));
    if (!ids.length) return cb([]);
    const metas = await Promise.all(ids.map((i: any) => _db.ref('groups/' + i.id + '/meta').once('value')));
    const result: any[] = [];
    metas.forEach((m: any, i: number) => { const v = m.val(); if (v) result.push({ id: ids[i].id, role: ids[i].role, ...v }); });
    result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(result);
  });
  _listeners.myGroups = { ref, event: 'value', cb: cbFn };
}

export async function getGroupDetails(groupId: string): Promise<any> {
  if (!_db) return null;
  try {
    const [mS, memS] = await Promise.all([
      _db.ref('groups/' + groupId + '/meta').once('value'),
      _db.ref('groups/' + groupId + '/members').once('value'),
    ]);
    const meta = mS.val();
    const members: any[] = [];
    memS.forEach((c: any) => { const v = c.val(); if (v) members.push({ key: c.key, ...v }); });
    members.sort((a: any, b: any) => (a.role === 'owner' ? -1 : (b.role === 'owner' ? 1 : (a.joinedAt || 0) - (b.joinedAt || 0))));
    return { meta, members };
  } catch { return null; }
}

export async function getAgents(): Promise<any[]> {
  if (!_db) return [];
  try {
    const snap = await _db.ref('agents').once('value');
    const list: any[] = [];
    snap.forEach((child: any) => {
      const v = child.val();
      if (v && v.email && v.email !== _myEmail) list.push(v);
    });
    return list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  } catch { return []; }
}

export function stopListener(key: string): void {
  const l = _listeners[key];
  if (l && l.ref) { try { l.ref.off(l.event, l.cb); } catch {} }
  delete _listeners[key];
}

export function stopAllListeners(): void {
  Object.keys(_listeners).forEach(stopListener);
}
END_NET
echo "✅ lib.network.ts"

# ═══════════════════════════════════════════════════════
# ۲) LiveMarketScreen.tsx
# ═══════════════════════════════════════════════════════
cat > LiveMarketScreen.tsx << 'END_LM'
// LiveMarketScreen.tsx — بازار عمومی صرافان
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import {
  initNetwork, loadNetSettings, saveNetSettings, getMyNetInfo,
  sendBroadcastHawala, claimHawala, sendFXOffer, claimFXOffer,
  sendDirectHawala, acceptDirectHawala, deliverDirectHawala,
  listenOpenHawalas, listenFXOffers, listenMyHawalas,
  listenDirectInbox, listenMyGroups,
  saveDailyRate, listenDailyRates,
  stopAllListeners, getAgents, NET_CITIES,
} from './lib.network';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const FLAG: Record<string, string> = { AFN: '🇦🇫', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', PKR: '🇵🇰', AED: '🇦🇪', SAR: '🇸🇦', TRY: '🇹🇷', IRR: '🇮🇷', TOM: '🇮🇷' };

export default function LiveMarketScreen({ showToast }: any) {
  const [net, setNet] = useState<any>({ connected: false, email: '', name: '', city: '' });
  const [loading, setLoading] = useState(true);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [fxOffers, setFxOffers] = useState<any[]>([]);
  const [myHawalas, setMyHawalas] = useState<any[]>([]);
  const [directInbox, setDirectInbox] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [rates, setRates] = useState<any>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [settingsModal, setSettingsModal] = useState(false);
  const [hawalaModal, setHawalaModal] = useState(false);
  const [fxModal, setFxModal] = useState(false);
  const [directModal, setDirectModal] = useState(false);
  const [rateModal, setRateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', city: 'KBL', phone: '' });
  const [hawalaForm, setHawalaForm] = useState<any>({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
  const [fxForm, setFxForm] = useState<any>({ currency: 'USD', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });
  const [directForm, setDirectForm] = useState<any>({ toEmail: '', toName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });
  const [rateForm, setRateForm] = useState<any>({ USD: '', EUR: '', AFN: '', PKR: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    const ok = await initNetwork();
    setNet(getMyNetInfo());
    setLoading(false);
    return ok;
  }, []);

  useEffect(() => { refresh(); return () => stopAllListeners(); }, [refresh]);

  useEffect(() => {
    if (!net.connected || !net.email) return;
    listenDirectInbox(setDirectInbox);
    listenMyGroups(setMyGroups);
    listenDailyRates(setRates);
    (async () => { setAgents(await getAgents()); })();
  }, [net.connected, net.email]);

  useEffect(() => {
    if (!net.connected || !net.city) return;
    listenOpenHawalas(net.city, setHawalas);
    listenFXOffers(setFxOffers);
    listenMyHawalas(setMyHawalas);
  }, [net.connected, net.city, net.email]);

  const saveSettings = async () => {
    if (!settingsForm.name || !settingsForm.city) return showToast?.('نام و شهر الزامی', true);
    setSaving(true);
    await saveNetSettings(settingsForm.name, settingsForm.city, settingsForm.phone);
    await refresh();
    setSaving(false);
    setSettingsModal(false);
    showToast?.('✅ ذخیره شد');
  };

  const submitHawala = async () => {
    if (!hawalaForm.amount || !hawalaForm.beneficiaryName) return showToast?.('مبلغ و نام الزامی', true);
    setSaving(true);
    try {
      const id = 'H-' + Date.now().toString(36).toUpperCase();
      await sendBroadcastHawala({
        id, targetCity: hawalaForm.targetCity, currency: hawalaForm.currency,
        amount: Number(hawalaForm.amount), beneficiaryName: hawalaForm.beneficiaryName,
        beneficiaryPhone: hawalaForm.beneficiaryPhone, maxFee: Number(hawalaForm.maxFee) || 2,
        expiresAt: Date.now() + (Number(hawalaForm.expires) || 15) * 60000, note: hawalaForm.note,
      });
      setHawalaModal(false);
      showToast?.('✅ حواله ارسال شد');
      setHawalaForm({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitFX = async () => {
    if (!fxForm.amount) return showToast?.('مقدار الزامی', true);
    if (fxForm.rateType === 'fixed' && !fxForm.rate) return showToast?.('نرخ الزامی', true);
    setSaving(true);
    try {
      const id = 'FX-' + Date.now().toString(36).toUpperCase();
      await sendFXOffer({ id, currency: fxForm.currency, amount: Number(fxForm.amount), rateType: fxForm.rateType, rate: Number(fxForm.rate) || 0, expiresAt: Date.now() + (Number(fxForm.expires) || 10) * 60000, note: fxForm.note });
      setFxModal(false);
      showToast?.('✅ آگهی ثبت شد');
      setFxForm({ currency: 'USD', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitDirect = async () => {
    if (!directForm.toEmail) return showToast?.('صراف مقصد انتخاب کن', true);
    if (!directForm.amount || !directForm.beneficiaryName) return showToast?.('مبلغ و نام الزامی', true);
    setSaving(true);
    try {
      const id = 'DH-' + Date.now().toString(36).toUpperCase();
      await sendDirectHawala({ id, toEmail: directForm.toEmail, currency: directForm.currency, amount: Number(directForm.amount), beneficiaryName: directForm.beneficiaryName, beneficiaryPhone: directForm.beneficiaryPhone, commission: Number(directForm.commission) || 0, note: directForm.note });
      setDirectModal(false);
      showToast?.('✅ حواله خصوصی ارسال شد');
      setDirectForm({ toEmail: '', toName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitRates = async () => {
    setSaving(true);
    try {
      for (const cur of ['USD', 'EUR', 'AFN', 'PKR']) {
        const v = Number(rateForm[cur]);
        if (v > 0) await saveDailyRate(cur, v);
      }
      setRateModal(false);
      showToast?.('✅ نرخ‌ها ثبت شد');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const doClaimH = async (id: string) => { const r = await claimHawala(id); showToast?.(r.success ? '✅ گرفتی' : '⚠️ ' + r.message, !r.success); };
  const doClaimF = async (id: string) => { const r = await claimFXOffer(id); showToast?.(r.success ? '✅ گرفتی' : '⚠️ ' + r.message, !r.success); };
  const doAcceptD = async (id: string) => { try { await acceptDirectHawala(id); showToast?.('✅ قبول شد'); } catch (e: any) { showToast?.('❌ ' + e.message, true); } };
  const doDeliverD = async (id: string, toEmail: string) => { try { await deliverDirectHawala(id, toEmail); showToast?.('✅ تحویل شد'); } catch (e: any) { showToast?.('❌ ' + e.message, true); } };

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  const pendingDirect = directInbox.filter((h: any) => h.status === 'pending');
  const acceptedDirect = directInbox.filter((h: any) => h.status === 'accepted');

  return (
    <View>
      {/* وضعیت */}
      <View style={[s.statusBox, net.connected && net.name ? s.statusOn : s.statusOff]}>
        <View style={s.statusDot} />
        <View style={{ flex: 1 }}>
          <Text style={s.statusTitle}>
            {net.connected && net.name ? `🟢 ${net.name}` : '🔴 پروفایل شبکه را کامل کنید'}
          </Text>
          <Text style={s.statusSub}>{net.email || '—'} {net.city ? `| ${NET_CITIES[net.city] || net.city}` : ''}</Text>
        </View>
        <TouchableOpacity style={s.smBtn} onPress={() => { setSettingsForm({ name: net.name || '', city: net.city || 'KBL', phone: net.phone || '' }); setSettingsModal(true); }}>
          <Text style={s.smBtnTxt}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* دکمه‌های عملیات */}
      {net.connected && net.name ? (
        <View style={{ flexDirection: 'row-reverse', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#f59e0b' }]} onPress={() => setHawalaModal(true)}>
            <Text style={s.actBtnTxt}>📤 حواله عمومی</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#7c3aed' }]} onPress={() => setFxModal(true)}>
            <Text style={s.actBtnTxt}>💱 فروش ارز</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#0891b2' }]} onPress={async () => { setAgents(await getAgents()); setDirectModal(true); }}>
            <Text style={s.actBtnTxt}>🔒 حواله خصوصی</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#059669' }]} onPress={() => setRateModal(true)}>
            <Text style={s.actBtnTxt}>📈 نرخ روز</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* نرخ روز */}
      <Text style={s.secT}>📈 نرخ روز</Text>
      {Object.keys(rates).length === 0 ? (
        <Text style={s.empty}>نرخی ثبت نشده</Text>
      ) : (
        <View style={s.rateBox}>
          {Object.keys(rates).map((cur: string) => (
            <View key={cur} style={s.rateItem}>
              <Text style={s.rateLbl}>{FLAG[cur] || '💱'} {cur}</Text>
              <Text style={s.rateVal}>{fmt(rates[cur]?.rate, 2)}</Text>
              <Text style={s.rateBy}>{rates[cur]?.byName || '—'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* حواله‌های خصوصی */}
      {pendingDirect.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#0891b2' }]}>🔒 حواله خصوصی دریافتی ({pendingDirect.length})</Text>
          {pendingDirect.map((h: any) => (
            <View key={h.id} style={[s.card, { borderColor: '#0891b2' }]}>
              <Text style={s.cardTitle}>🔒 {h.fromName}</Text>
              <Text style={s.cardAmt}>{FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
              <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📞 {h.beneficiaryPhone || '—'}</Text>
              <Text style={s.cardRow}>💰 کارمزد: {fmt(h.commission, 0)}</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doAcceptD(h.id)}>
                <Text style={s.btnTxt}>✅ قبول</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {acceptedDirect.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#f59e0b' }]}>🔄 در حال انجام ({acceptedDirect.length})</Text>
          {acceptedDirect.map((h: any) => (
            <View key={h.id} style={[s.card, { borderColor: '#f59e0b' }]}>
              <Text style={s.cardTitle}>🔄 {h.fromName}</Text>
              <Text style={s.cardAmt}>{FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
              <Text style={s.cardRow}>👤 {h.beneficiaryName}</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => doDeliverD(h.id, net.email)}>
                <Text style={s.btnTxt}>📦 تحویل دادم</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* حوالات عمومی */}
      <Text style={s.secT}>📥 حوالات عمومی برای من ({hawalas.filter((h: any) => h.status === 'open').length})</Text>
      {hawalas.filter((h: any) => h.status === 'open').length === 0 ? (
        <Text style={s.empty}>حواله‌ای نیست</Text>
      ) : hawalas.filter((h: any) => h.status === 'open').map((h: any) => {
        const mine = h.fromEmail === net.email;
        return (
          <View key={h.id} style={s.card}>
            <Text style={s.cardTitle}>{h.fromName}</Text>
            <Text style={s.cardAmt}>{FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
            <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📍 {NET_CITIES[h.targetCity] || h.targetCity}</Text>
            {!mine ? (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doClaimH(h.id)}>
                <Text style={s.btnTxt}>⚡ قبول</Text>
              </TouchableOpacity>
            ) : <Text style={[s.cardRow, { color: '#f59e0b' }]}>⏳ منتظر قبول</Text>}
          </View>
        );
      })}

      {/* فروش ارز */}
      <Text style={s.secT}>💱 فروش ارز در بازار ({fxOffers.length})</Text>
      {fxOffers.length === 0 ? (
        <Text style={s.empty}>آگهی نیست</Text>
      ) : fxOffers.map((f: any) => (
        <View key={f.id} style={s.card}>
          <Text style={s.cardTitle}>{f.sellerName}</Text>
          <Text style={s.cardAmt}>{FLAG[f.currency] || '💱'} {fmt(f.amount)} {f.currency}</Text>
          <Text style={s.cardRow}>💹 {fmt(f.rate, 4)} {f.rateType === 'auction' ? '(حراج)' : ''}</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doClaimF(f.id)}>
            <Text style={s.btnTxt}>💰 قبول</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* مودال تنظیمات */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>⚙️ پروفایل شبکه</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ایمیل (هویت شما)</Text>
            <TextInput style={[s.inp, { backgroundColor: '#0a1628', color: '#94a3b8' }]} value={net.email} editable={false} />
            <Text style={s.lbl}>نام صرافی *</Text>
            <TextInput style={s.inp} value={settingsForm.name} onChangeText={v => setSettingsForm({ ...settingsForm, name: v })} placeholder="مثلاً صرافی میزان" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>شهر *</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setSettingsForm({ ...settingsForm, city: k })} style={[s.chip, settingsForm.city === k && s.chipAct]}>
                  <Text style={[s.chipTxt, settingsForm.city === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>تلفن</Text>
            <TextInput style={s.inp} value={settingsForm.phone} onChangeText={v => setSettingsForm({ ...settingsForm, phone: v })} keyboardType="phone-pad" placeholder="07..." placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setSettingsModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={saveSettings} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال حواله عمومی */}
      <Modal visible={hawalaModal} transparent animationType="slide" onRequestClose={() => setHawalaModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#f59e0b' }]}><Text style={s.mTitle}>📤 حواله به شهر</Text>
            <TouchableOpacity onPress={() => setHawalaModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>شهر مقصد *</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setHawalaForm({ ...hawalaForm, targetCity: k })} style={[s.chip, hawalaForm.targetCity === k && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}>
                  <Text style={[s.chipTxt, hawalaForm.targetCity === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>ارز</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'AFN', 'EUR', 'PKR', 'AED'].map(c => (
                <TouchableOpacity key={c} onPress={() => setHawalaForm({ ...hawalaForm, currency: c })} style={[s.chip, hawalaForm.currency === c && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}>
                  <Text style={[s.chipTxt, hawalaForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={hawalaForm.amount} onChangeText={v => setHawalaForm({ ...hawalaForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="1000" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نام ذی‌نفع *</Text>
            <TextInput style={s.inp} value={hawalaForm.beneficiaryName} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiaryName: v })} placeholder="نام گیرنده" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>تلفن ذی‌نفع</Text>
            <TextInput style={s.inp} value={hawalaForm.beneficiaryPhone} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiaryPhone: v.replace(/[^\d]/g, '') })} keyboardType="phone-pad" placeholder="07..." placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>حداکثر کارمزد %</Text>
                <TextInput style={s.inp} value={hawalaForm.maxFee} onChangeText={v => setHawalaForm({ ...hawalaForm, maxFee: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholder="2" placeholderTextColor="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>مهلت (دقیقه)</Text>
                <TextInput style={s.inp} value={hawalaForm.expires} onChangeText={v => setHawalaForm({ ...hawalaForm, expires: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="15" placeholderTextColor="#94a3b8" />
              </View>
            </View>
            <Text style={s.lbl}>توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={hawalaForm.note} onChangeText={v => setHawalaForm({ ...hawalaForm, note: v })} multiline placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setHawalaModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#f59e0b', flex: 2 }]} onPress={submitHawala} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>📤 ارسال</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال فروش ارز */}
      <Modal visible={fxModal} transparent animationType="slide" onRequestClose={() => setFxModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}><Text style={s.mTitle}>💱 فروش ارز</Text>
            <TouchableOpacity onPress={() => setFxModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ارز</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'EUR', 'PKR', 'AED', 'AFN'].map(c => (
                <TouchableOpacity key={c} onPress={() => setFxForm({ ...fxForm, currency: c })} style={[s.chip, fxForm.currency === c && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}>
                  <Text style={[s.chipTxt, fxForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={fxForm.amount} onChangeText={v => setFxForm({ ...fxForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="100" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نوع قیمت</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={[s.chip, fxForm.rateType === 'fixed' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]} onPress={() => setFxForm({ ...fxForm, rateType: 'fixed' })}>
                <Text style={[s.chipTxt, fxForm.rateType === 'fixed' && { color: '#fff' }]}>💰 نرخ ثابت</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, fxForm.rateType === 'auction' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]} onPress={() => setFxForm({ ...fxForm, rateType: 'auction' })}>
                <Text style={[s.chipTxt, fxForm.rateType === 'auction' && { color: '#fff' }]}>📊 حراج</Text>
              </TouchableOpacity>
            </View>
            {fxForm.rateType === 'fixed' && (
              <>
                <Text style={s.lbl}>نرخ (به افغانی) *</Text>
                <TextInput style={s.inp} value={fxForm.rate} onChangeText={v => setFxForm({ ...fxForm, rate: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholder="70500" placeholderTextColor="#94a3b8" />
              </>
            )}
            <Text style={s.lbl}>مهلت (دقیقه)</Text>
            <TextInput style={s.inp} value={fxForm.expires} onChangeText={v => setFxForm({ ...fxForm, expires: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="10" placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setFxModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitFX} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💱 ثبت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال حواله خصوصی */}
      <Modal visible={directModal} transparent animationType="slide" onRequestClose={() => setDirectModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#0891b2' }]}><Text style={s.mTitle}>🔒 حواله خصوصی</Text>
            <TouchableOpacity onPress={() => setDirectModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>صراف مقصد * ({agents.length} نفر)</Text>
            {agents.length === 0 ? (
              <Text style={s.empty}>صراف دیگری آنلاین نیست</Text>
            ) : (
              <ScrollView style={{ maxHeight: 200 }}>
                {agents.map((a: any) => (
                  <TouchableOpacity key={a.email} onPress={() => setDirectForm({ ...directForm, toEmail: a.email, toName: a.name })} style={[s.agentRow, directForm.toEmail === a.email && { backgroundColor: '#0891b2' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.agentName, directForm.toEmail === a.email && { color: '#fff' }]}>{a.name}</Text>
                      <Text style={[s.agentEmail, directForm.toEmail === a.email && { color: '#a7f3d0' }]}>{a.email}</Text>
                    </View>
                    <Text style={[s.agentCity, directForm.toEmail === a.email && { color: '#fff' }]}>{NET_CITIES[a.city] || a.city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={s.lbl}>ارز</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'AFN', 'EUR', 'PKR', 'AED'].map(c => (
                <TouchableOpacity key={c} onPress={() => setDirectForm({ ...directForm, currency: c })} style={[s.chip, directForm.currency === c && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}>
                  <Text style={[s.chipTxt, directForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={directForm.amount} onChangeText={v => setDirectForm({ ...directForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نام ذی‌نفع *</Text>
            <TextInput style={s.inp} value={directForm.beneficiaryName} onChangeText={v => setDirectForm({ ...directForm, beneficiaryName: v })} placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>تلفن ذی‌نفع</Text>
            <TextInput style={s.inp} value={directForm.beneficiaryPhone} onChangeText={v => setDirectForm({ ...directForm, beneficiaryPhone: v.replace(/[^\d]/g, '') })} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>کارمزد</Text>
            <TextInput style={s.inp} value={directForm.commission} onChangeText={v => setDirectForm({ ...directForm, commission: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={directForm.note} onChangeText={v => setDirectForm({ ...directForm, note: v })} multiline placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setDirectModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2', flex: 2 }]} onPress={submitDirect} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔒 ارسال</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال نرخ روز */}
      <Modal visible={rateModal} transparent animationType="slide" onRequestClose={() => setRateModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}><Text style={s.mTitle}>📈 نرخ روز</Text>
            <TouchableOpacity onPress={() => setRateModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            {['USD', 'EUR', 'AFN', 'PKR'].map(c => (
              <View key={c}>
                <Text style={s.lbl}>{FLAG[c]} {c} {rates[c]?.rate ? `(فعلی: ${fmt(rates[c].rate)})` : ''}</Text>
                <TextInput style={s.inp} value={rateForm[c]} onChangeText={v => setRateForm({ ...rateForm, [c]: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholder="نرخ" placeholderTextColor="#94a3b8" />
              </View>
            ))}
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setRateModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submitRates} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  statusBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1 },
  statusOn: { backgroundColor: '#065f46', borderColor: '#10b981' },
  statusOff: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  statusTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  statusSub: { color: '#e2e8f0', fontSize: 10, marginTop: 2, textAlign: 'right', fontFamily: 'monospace' },
  smBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6 },
  smBtnTxt: { color: '#fff', fontSize: 14 },
  actBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginLeft: 4, marginTop: 4, flex: 1, minWidth: 100, alignItems: 'center' },
  actBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  secT: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8 },
  rateBox: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  rateItem: { backgroundColor: '#0f2438', borderRadius: 8, padding: 10, minWidth: 100, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  rateLbl: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
  rateVal: { color: '#00ff88', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace', marginTop: 4 },
  rateBy: { color: '#64748b', fontSize: 9, marginTop: 2 },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  cardAmt: { color: '#00ff88', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6, fontFamily: 'monospace' },
  cardRow: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 3 },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 12 },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  agentRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: '#1a2332', marginBottom: 4, borderWidth: 1, borderColor: '#334155' },
  agentName: { color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'right' },
  agentEmail: { color: '#94a3b8', fontSize: 9, fontFamily: 'monospace', textAlign: 'right', marginTop: 2 },
  agentCity: { color: '#cbd5e1', fontSize: 11, marginRight: 8 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  mHead: { backgroundColor: '#1e3a8a', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  x: { color: '#fff', fontSize: 24 },
  lbl: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 4, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332', marginLeft: 4, marginTop: 4 },
  chipAct: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  rowBtns: { flexDirection: 'row-reverse', gap: 8, marginTop: 16 },
});
END_LM
echo "✅ LiveMarketScreen.tsx"

# ═══════════════════════════════════════════════════════
# ۳) GroupsScreen.tsx
# ═══════════════════════════════════════════════════════
cat > GroupsScreen.tsx << 'END_GR'
// GroupsScreen.tsx — گروه‌های خصوصی صرافان
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import {
  initNetwork, loadNetSettings, getMyNetInfo,
  createGroup, inviteToGroupByEmail, joinGroupByCode, leaveGroup,
  kickGroupMember, deleteGroup, getGroupDetails, listenMyGroups, NET_CITIES,
} from './lib.network';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

export default function GroupsScreen({ showToast }: any) {
  const [net, setNet] = useState<any>({ connected: false, email: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [inviteModal, setInviteModal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', city: 'KBL' });
  const [joinCode, setJoinCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    await initNetwork();
    setNet(getMyNetInfo());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!net.connected || !net.email) return;
    listenMyGroups(setGroups);
  }, [net.connected, net.email]);

  const submitCreate = async () => {
    if (!createForm.name || createForm.name.length < 3) return showToast?.('نام حداقل ۳ کاراکتر', true);
    setSaving(true);
    try {
      const r = await createGroup(createForm.name, createForm.city);
      showToast?.('✅ گروه ساخته شد — کد دعوت: ' + r.inviteCode);
      setCreateModal(false);
      setCreateForm({ name: '', city: 'KBL' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitJoin = async () => {
    setSaving(true);
    try {
      await joinGroupByCode(joinCode);
      showToast?.('✅ پیوستید');
      setJoinModal(false);
      setJoinCode('');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitInvite = async () => {
    if (!inviteModal) return;
    setSaving(true);
    try {
      await inviteToGroupByEmail(inviteModal.id, inviteEmail);
      showToast?.('✅ دعوت ارسال شد');
      setInviteModal(null);
      setInviteEmail('');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const viewDetail = async (gid: string) => {
    try {
      const d = await getGroupDetails(gid);
      if (d) setDetailModal({ id: gid, ...d });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doLeave = async (gid: string, gname: string) => {
    if (typeof window !== 'undefined' && !window.confirm('از «' + gname + '» خارج می‌شوید؟')) return;
    try { await leaveGroup(gid); showToast?.('✅ خارج شدید'); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doKick = async (gid: string, email: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm('اخراج «' + name + '»؟')) return;
    try { await kickGroupMember(gid, email); showToast?.('✅ اخراج شد'); viewDetail(gid); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doDelete = async (gid: string) => {
    if (typeof window !== 'undefined' && !window.confirm('حذف گروه؟ قابل بازگشت نیست.')) return;
    try { await deleteGroup(gid); showToast?.('✅ حذف شد'); setDetailModal(null); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const copyCode = (code: string) => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(code); } catch {}
    showToast?.('✅ کپی شد');
  };

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  if (!net.connected || !net.name) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>🌐</Text>
        <Text style={s.emptyTxt}>ابتدا در بازار زنده پروفایل خود را کامل کنید</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
        <TouchableOpacity style={[s.actBtn, { backgroundColor: '#059669' }]} onPress={() => setCreateModal(true)}>
          <Text style={s.actBtnTxt}>➕ ساخت گروه</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actBtn, { backgroundColor: '#1e40af' }]} onPress={() => setJoinModal(true)}>
          <Text style={s.actBtnTxt}>🔑 پیوستن با کد</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.secT}>📋 گروه‌های من ({groups.length})</Text>
      {groups.length === 0 ? (
        <Text style={s.empty2}>هنوز در گروهی نیستید</Text>
      ) : groups.map((g: any) => (
        <View key={g.id} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>🌐 {g.name}</Text>
            <Text style={[s.role, g.role === 'owner' ? s.roleOwner : s.roleMember]}>
              {g.role === 'owner' ? '👑 مالک' : '👤 عضو'}
            </Text>
          </View>
          <Text style={s.cardSub}>📍 {NET_CITIES[g.city] || g.city} | 👥 {g.memberCount || 1} عضو</Text>
          {g.role === 'owner' && (
            <TouchableOpacity style={s.inviteBox} onPress={() => copyCode(g.inviteCode)}>
              <Text style={s.inviteLbl}>🔑 کد دعوت (لمس کن کپی)</Text>
              <Text style={s.inviteCode}>{g.inviteCode}</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#1e40af', flex: 1 }]} onPress={() => viewDetail(g.id)}>
              <Text style={s.btnTxt}>👁️ مشاهده</Text>
            </TouchableOpacity>
            {g.role === 'owner' && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 1 }]} onPress={() => { setInviteModal(g); setInviteEmail(''); }}>
                <Text style={s.btnTxt}>➕ دعوت</Text>
              </TouchableOpacity>
            )}
            {g.role !== 'owner' && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 1 }]} onPress={() => doLeave(g.id, g.name)}>
                <Text style={s.btnTxt}>🚪 خروج</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* ساخت گروه */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}>
            <Text style={s.mTitle}>➕ ساخت گروه جدید</Text>
            <TouchableOpacity onPress={() => setCreateModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>نام گروه *</Text>
            <TextInput style={s.inp} value={createForm.name} onChangeText={v => setCreateForm({ ...createForm, name: v })} placeholder="مثلاً صرافان مورد اعتماد" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>شهر</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setCreateForm({ ...createForm, city: k })} style={[s.chip, createForm.city === k && s.chipAct]}>
                  <Text style={[s.chipTxt, createForm.city === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setCreateModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submitCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ساخت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* پیوستن */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#1e40af' }]}>
            <Text style={s.mTitle}>🔑 پیوستن به گروه</Text>
            <TouchableOpacity onPress={() => setJoinModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>کد دعوت (INV-XXXXXXXX)</Text>
            <TextInput style={s.inp} value={joinCode} onChangeText={v => setJoinCode(v.toUpperCase())} placeholder="INV-ABCD1234" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setJoinModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#1e40af', flex: 2 }]} onPress={submitJoin} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ پیوستن</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* دعوت با ایمیل */}
      <Modal visible={!!inviteModal} transparent animationType="slide" onRequestClose={() => setInviteModal(null)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}>➕ دعوت به «{inviteModal?.name}»</Text>
            <TouchableOpacity onPress={() => setInviteModal(null)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ایمیل صراف مورد اعتماد</Text>
            <TextInput style={s.inp} value={inviteEmail} onChangeText={setInviteEmail} placeholder="ahmed@gmail.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
            <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 6, textAlign: 'right' }}>
              💡 اگر صراف در شبکه نصب نکرده باشد، عضویتش بعداً ثبت می‌شود.
            </Text>
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setInviteModal(null)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitInvite} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>📧 دعوت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* جزئیات */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#1e3a8a' }]}>
            <Text style={s.mTitle}>👁️ {detailModal?.meta?.name}</Text>
            <TouchableOpacity onPress={() => setDetailModal(null)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          {detailModal && (
            <ScrollView style={{ padding: 14 }}>
              <Text style={s.detailSub}>📍 {NET_CITIES[detailModal.meta?.city] || '—'} | 👑 {detailModal.meta?.ownerName}</Text>
              {detailModal.meta?.ownerEmail === net.email && (
                <TouchableOpacity style={s.inviteBox} onPress={() => copyCode(detailModal.meta.inviteCode)}>
                  <Text style={s.inviteLbl}>🔑 کد دعوت (لمس کن کپی)</Text>
                  <Text style={s.inviteCode}>{detailModal.meta.inviteCode}</Text>
                </TouchableOpacity>
              )}
              <Text style={s.secT}>👥 اعضا ({detailModal.members?.length || 0})</Text>
              {(detailModal.members || []).map((m: any) => (
                <View key={m.key} style={s.memberRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName}>{m.name} {m.email === net.email ? '(شما)' : ''}</Text>
                    <Text style={s.memberEmail}>{m.email}</Text>
                  </View>
                  {m.role === 'owner' ? (
                    <Text style={s.roleOwner}>👑</Text>
                  ) : detailModal.meta?.ownerEmail === net.email ? (
                    <TouchableOpacity onPress={() => doKick(detailModal.id, m.email, m.name)}>
                      <Text style={{ fontSize: 16 }}>👢</Text>
                    </TouchableOpacity>
                  ) : <Text style={s.roleMember}>👤</Text>}
                </View>
              ))}
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setDetailModal(null)}>
                  <Text style={s.btnTxt}>بستن</Text>
                </TouchableOpacity>
                {detailModal.meta?.ownerEmail === net.email && (
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 1 }]} onPress={() => doDelete(detailModal.id)}>
                    <Text style={s.btnTxt}>🗑 حذف</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  actBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  secT: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  cardSub: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 6 },
  role: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleOwner: { backgroundColor: '#fef3c7', color: '#92400e', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleMember: { backgroundColor: '#dbeafe', color: '#1e40af', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inviteBox: { backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 6 },
  inviteLbl: { color: '#94a3b8', fontSize: 10, textAlign: 'right' },
  inviteCode: { color: '#00ff88', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', marginTop: 2, letterSpacing: 2 },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  empty: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyTxt: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  empty2: { color: '#94a3b8', textAlign: 'center', padding: 30, fontSize: 13 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  mHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  x: { color: '#fff', fontSize: 24 },
  lbl: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 4, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332', marginLeft: 4, marginTop: 4 },
  chipAct: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  rowBtns: { flexDirection: 'row-reverse', gap: 8, marginTop: 16 },
  detailSub: { color: '#cbd5e1', fontSize: 12, textAlign: 'right', marginTop: 4 },
  memberRow: { backgroundColor: '#1a2332', padding: 10, borderRadius: 6, marginBottom: 6, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  memberEmail: { color: '#94a3b8', fontSize: 10, fontFamily: 'monospace', textAlign: 'right', marginTop: 2 },
});

END_GR
echo "✅ GroupsScreen.tsx"

# ═══════════════════════════════════════════════════════
# ۴) ExchangeScreen — اتصال
# ═══════════════════════════════════════════════════════
python3 << 'END_PY'
c = open('ExchangeScreen.tsx').read()
orig = c

if 'LiveMarketScreen' not in c:
    c = "import LiveMarketScreen from './LiveMarketScreen';\nimport GroupsScreen from './GroupsScreen';\n" + c
    print("✅ import")

old_type = "useState<'list' | 'form' | 'customers' | 'partners' | 'hawalas' | 'boxes' | 'checks' | 'ledger' | 'statement'>"
new_type = "useState<'list' | 'form' | 'customers' | 'partners' | 'hawalas' | 'boxes' | 'checks' | 'ledger' | 'statement' | 'liveMarket' | 'myGroups'>"
if old_type in c:
    c = c.replace(old_type, new_type, 1)
    print("✅ sub type")

old_subs = "{ k: 'partners', l: '🏢 خریداران' },"
new_subs = "{ k: 'partners', l: '🏢 خریداران' },\n            { k: 'liveMarket', l: '📡 بازار زنده' },\n            { k: 'myGroups', l: '🌐 شبکه‌های من' },"
if old_subs in c and 'liveMarket' not in c.split('subsBar')[0][-2000:]:
    c = c.replace(old_subs, new_subs, 1)
    print("✅ زیرتب‌ها")

old_render = "        {sub === 'partners' && (\n          <PartyList type=\"buyer\" showToast={showToast} />\n        )}"
new_render = old_render + "\n\n        {sub === 'liveMarket' && (<LiveMarketScreen showToast={showToast} />)}\n\n        {sub === 'myGroups' && (<GroupsScreen showToast={showToast} />)}"
if old_render in c and 'LiveMarketScreen showToast' not in c:
    c = c.replace(old_render, new_render, 1)
    print("✅ رندر")

open('ExchangeScreen.tsx', 'w').write(c)
print("changed:", c != orig)
END_PY

echo "═══════════════════════════════════"
echo "  ✅ همه فایل‌ها ساخته شد"
echo "═══════════════════════════════════"

