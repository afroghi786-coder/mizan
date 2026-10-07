// lib.network.ts — شبکه صرافی (Firebase Realtime)
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
let _myCode = '';
let _myName = '';
let _myCity = '';
let _myPhone = '';
let _listeners: any = {};

export function getMyNetInfo() {
  return { code: _myCode, name: _myName, city: _myCity, phone: _myPhone, connected: _connected };
}

export function isNetReady() {
  return _init && _db !== null;
}

export async function loadNetSettings(): Promise<void> {
  try {
    _myCode = (await AsyncStorage.getItem('mz_net_code')) || '';
    _myName = (await AsyncStorage.getItem('mz_net_name')) || '';
    _myCity = (await AsyncStorage.getItem('mz_net_city')) || '';
    _myPhone = (await AsyncStorage.getItem('mz_net_phone')) || '';
  } catch {}
}

export async function saveNetSettings(code: string, name: string, city: string, phone: string): Promise<void> {
  _myCode = code;
  _myName = name;
  _myCity = city;
  _myPhone = phone;
  try {
    await AsyncStorage.setItem('mz_net_code', code);
    await AsyncStorage.setItem('mz_net_name', name);
    await AsyncStorage.setItem('mz_net_city', city);
    await AsyncStorage.setItem('mz_net_phone', phone);
  } catch {}
  if (_db) await _registerAgent();
}

export async function initNetwork(): Promise<boolean> {
  if (_init) return true;
  try {
    const firebase = require('firebase/compat/app');
    require('firebase/compat/database');
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _fb = firebase;
    _db = firebase.database();
    _init = true;

    await loadNetSettings();

    _db.ref('.info/connected').on('value', (snap: any) => {
      const wasConnected = _connected;
      _connected = !!snap.val();
      if (_connected && !wasConnected) {
        _registerAgent();
        _registerPresence();
      }
    });

    if (_myCode) await _registerAgent();
    return true;
  } catch (e: any) {
    console.log('[NET] init error:', e?.message);
    return false;
  }
}

async function _registerAgent(): Promise<void> {
  if (!_db || !_myCode) return;
  try {
    await _db.ref('agents/' + _myCode).update({
      code: _myCode, name: _myName, city: _myCity, phone: _myPhone,
      lastSeen: _fb.database.ServerValue.TIMESTAMP, online: true,
    });
  } catch {}
}

async function _registerPresence(): Promise<void> {
  if (!_db || !_myCode) return;
  try {
    const ref = _db.ref('presence/' + _myCode);
    await ref.onDisconnect().remove();
    await ref.set({
      code: _myCode, name: _myName, city: _myCity,
      timestamp: _fb.database.ServerValue.TIMESTAMP,
    });
  } catch {}
}

// ═══ حواله ═══
export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  const ref = _db.ref('tasks/' + h.id);
  await ref.set({
    type: 'hawala_broadcast',
    fromCode: _myCode, fromName: _myName, fromCity: _myCity,
    targetCity: h.targetCity, currency: h.currency, amount: h.amount,
    beneficiaryName: h.beneficiaryName, beneficiaryPhone: h.beneficiaryPhone || '',
    maxFee: h.maxFee || 2, note: h.note || '',
    status: 'open', claimedBy: null, claimedByName: null, claimedAt: null,
    createdAt: _fb.database.ServerValue.TIMESTAMP,
    expiresAt: h.expiresAt || Date.now() + 15 * 60 * 1000,
  });
  return { success: true, id: h.id };
}

export async function claimHawala(taskId: string): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  const ref = _db.ref('tasks/' + taskId);
  return new Promise((resolve) => {
    ref.transaction((cur: any) => {
      if (cur === null) return;
      if (cur.status !== 'open') return;
      if (cur.fromCode === _myCode) return;
      cur.status = 'locked';
      cur.claimedBy = _myCode;
      cur.claimedByName = _myName;
      cur.claimedAt = Date.now();
      return cur;
    }, (err: any, committed: boolean, snap: any) => {
      if (err) return resolve({ success: false, message: 'خطا: ' + err.message });
      if (!committed) {
        const cur = snap ? snap.val() : {};
        return resolve({ success: false, message: 'دیر رسیدی — ' + (cur.claimedByName || 'صراف دیگری') });
      }
      const task = snap.val();
      notifyAgent(task.fromCode, {
        type: 'hawala_taken', taskId,
        claimedBy: _myCode, claimedByName: _myName,
        amount: task.amount, currency: task.currency, timestamp: Date.now(),
      });
      resolve({ success: true, task, message: '✅ حواله را گرفتی' });
    });
  });
}

// ═══ ارز ═══
export async function sendFXOffer(o: any): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  const ref = _db.ref('fx_offers/' + o.id);
  await ref.set({
    sellerCode: _myCode, sellerName: _myName,
    currency: o.currency, amount: o.amount, rateType: o.rateType,
    rate: o.rate || 0, bids: {}, note: o.note || '',
    status: 'open', claimedBy: null, claimedByName: null, claimedAt: null,
    createdAt: _fb.database.ServerValue.TIMESTAMP,
    expiresAt: o.expiresAt || Date.now() + 10 * 60 * 1000,
  });
  return { success: true, id: o.id };
}

export async function claimFXOffer(offerId: string): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  const ref = _db.ref('fx_offers/' + offerId);
  return new Promise((resolve) => {
    ref.transaction((cur: any) => {
      if (cur === null) return;
      if (cur.status !== 'open') return;
      if (cur.sellerCode === _myCode) return;
      cur.status = 'locked';
      cur.claimedBy = _myCode;
      cur.claimedByName = _myName;
      cur.claimedAt = Date.now();
      return cur;
    }, (err: any, committed: boolean, snap: any) => {
      if (err) return resolve({ success: false, message: 'خطا: ' + err.message });
      if (!committed) return resolve({ success: false, message: 'دیر رسیدی' });
      const offer = snap.val();
      notifyAgent(offer.sellerCode, {
        type: 'fx_taken', offerId,
        claimedBy: _myCode, claimedByName: _myName, timestamp: Date.now(),
      });
      resolve({ success: true, offer, message: '✅ گرفتی' });
    });
  });
}

export async function notifyAgent(agentCode: string, notif: any): Promise<void> {
  if (!_db || !agentCode) return;
  const nid = 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    await _db.ref('inbox/' + agentCode + '/' + nid).set({ ...notif, read: false });
  } catch {}
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
      if (v && (v.status === 'open' || v.claimedBy === _myCode)) {
        list.push({ id: child.key, ...v });
      }
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
      if (v && v.sellerCode !== _myCode) list.push({ id: child.key, ...v });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.fx = { ref, event: 'value', cb: cbFn };
}

export function listenMyHawalas(cb: (list: any[]) => void): void {
  if (!_db || !_myCode) return;
  stopListener('myHawalas');
  const ref = _db.ref('tasks').orderByChild('fromCode').equalTo(_myCode);
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((child: any) => {
      const v = child.val();
      if (v) list.push({ id: child.key, ...v });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.myHawalas = { ref, event: 'value', cb: cbFn };
}

export async function getAgents(): Promise<any[]> {
  if (!_db) return [];
  try {
    const snap = await _db.ref('agents').once('value');
    const list: any[] = [];
    snap.forEach((child: any) => {
      const v = child.val();
      if (v && v.code && v.code !== _myCode) list.push(v);
    });
    return list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  } catch { return []; }
}

export function stopListener(key: string): void {
  const l = _listeners[key];
  if (l && l.ref) {
    try { l.ref.off(l.event, l.cb); } catch {}
  }
  delete _listeners[key];
}

export function stopAllListeners(): void {
  Object.keys(_listeners).forEach(stopListener);
}
