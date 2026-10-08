// LiveMarketScreen.tsx — بازار عمومی صرافان
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import {
  initNetwork, loadNetSettings, saveNetSettings, getMyNetInfo,
  sendBroadcastHawala, claimHawala, sendFXOffer, claimFXOffer,
  sendDirectHawala, acceptDirectHawala, deliverDirectHawala,
  listenOpenHawalas, listenFXOffers, listenMyHawalas,
  listenDirectInbox, listenMyGroups,
  listenMyFXOffers, listenMyFXDeals, deliverHawalaByUser,
  saveDailyRateWithBase, listenDailyRates,
  stopAllListeners, getAgents, NET_CITIES, fetchPreferences, fetchAllNotifications, markRoomRead, listenMessages, sendMessage, fetchMessages} from './lib.network';


const _isWebView = (() => {
  try {
    if (typeof navigator === 'undefined') return true;
    const ua = navigator.userAgent || '';
    return /wv|WebView/i.test(ua) || typeof (window as any).ReactNativeWebView !== 'undefined';
  } catch { return false; }
})();

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const FLAG: Record<string, string> = { AFN: '🇦🇫', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', PKR: '🇵🇰', AED: '🇦🇪', SAR: '🇸🇦', TRY: '🇹🇷', IRR: '🇮🇷', TOM: '🇮🇷', INR: '🇮🇳', CNY: '🇨🇳', JPY: '🇯🇵', CHF: '🇨🇭', CAD: '🇨🇦', AUD: '🇦🇺', KWD: '🇰🇼', QAR: '🇶🇦', OMR: '🇴🇲', BHD: '🇧🇭', JOD: '🇯🇴', IQD: '🇮🇶', MYR: '🇲🇾', RUB: '🇷🇺', TJS: '🇹🇯', UZS: '🇺🇿', TMT: '🇹🇲', KGS: '🇰🇬', KZT: '🇰🇿', AZN: '🇦🇿', HKD: '🇭🇰', SGD: '🇸🇬', THB: '🇹🇭', EGP: '🇪🇬', LYD: '🇱🇾', SYP: '🇸🇾', LBP: '🇱🇧', YER: '🇾🇪', ETB: '🇪🇹', NOK: '🇳🇴', SEK: '🇸🇪', DKK: '🇩🇰', NZD: '🇳🇿', ZAR: '🇿🇦' };

const CUR_NAME: Record<string, string> = {
  AFN: 'افغانی', USD: 'دالر امریکایی', EUR: 'یورو', GBP: 'پوند انگلیس',
  PKR: 'کلدار پاکستان', AED: 'درهم امارات', SAR: 'ریال سعودی', TRY: 'لیر ترکیه',
  IRR: 'ریال ایران', TOM: 'تومان ایران', INR: 'روپیه هند', CNY: 'یوان چین',
  JPY: 'ین ژاپن', CHF: 'فرانک سوئیس', CAD: 'دالر کانادا', AUD: 'دالر استرالیا',
  KWD: 'دینار کویت', QAR: 'ریال قطر', OMR: 'ریال عمان', BHD: 'دینار بحرین',
  JOD: 'دینار اردن', IQD: 'دینار عراق', MYR: 'رینگیت مالزی', RUB: 'روبل روسیه',
  TJS: 'سامانی تاجیکستان', UZS: 'سوم ازبکستان', TMT: 'منات ترکمنستان',
  KGS: 'سوم قرقیزستان', KZT: 'تنگه قزاقستان', AZN: 'منات آذربایجان',
  HKD: 'دالر هنگ‌کنگ', SGD: 'دالر سنگاپور', THB: 'بات تایلند', EGP: 'جنيه مصر',
  LYD: 'دینار لیبی', SYP: 'لیره سوریه', LBP: 'لیره لبنان', YER: 'ریال یمن',
  ETB: 'بیر اتیوپی', NOK: 'کرون نروژ', SEK: 'کرون سوئد', DKK: 'کرون دانمارک',
  NZD: 'دالر نیوزیلند', ZAR: 'رند افریقای جنوبی',
};

const ALL_CURS = ['AFN', 'USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'TRY', 'IRR', 'TOM', 'INR', 'CNY', 'JPY', 'CHF', 'CAD', 'AUD', 'KWD', 'QAR', 'OMR', 'BHD', 'JOD', 'IQD', 'MYR', 'RUB', 'TJS', 'UZS', 'TMT', 'KGS', 'KZT', 'AZN', 'HKD', 'SGD', 'THB', 'EGP', 'LYD', 'SYP', 'LBP', 'YER', 'ETB', 'NOK', 'SEK', 'DKK', 'NZD', 'ZAR'];

const curLabel = (c: string) => (CUR_NAME[c] ? CUR_NAME[c] + ' (' + c + ')' : c);

// ═══ ذخیره/بازیابی ارزهای داشبورد ═══
const DASH_CURS_KEY = 'mz_dash_currencies';
function loadMyDashCurs(): string[] {
  try {
    const r = localStorage.getItem(DASH_CURS_KEY);
    if (r) {
      const arr = JSON.parse(r);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {}
  return ['USD', 'EUR', 'PKR', 'AED', 'GBP'];
}
function saveMyDashCurs(arr: string[]) {
  try { localStorage.setItem(DASH_CURS_KEY, JSON.stringify(arr)); } catch {}
}

// محاسبه آماری هر ارز
function calcRateStats(ratesArr: any[], cur: string) {
  const items = ratesArr.filter((r: any) => r.currency === cur);
  if (!items.length) return null;
  const nums = items.map((r: any) => Number(r.rate) || 0).filter(n => n > 0);
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    avg: sum / nums.length,
    high: Math.max(...nums),
    low: Math.min(...nums),
    count: nums.length,
    last: nums[nums.length - 1],
    byName: items[0]?.by_name || '',
  };
}

// زمان نسبی
// ═══ صدای نوتیف ═══
let _audioCtx: any = null;
// ═══ Audio Context مشترک (قفل WebView را باز می‌کند) ═══
function _getAudioCtx() {
  if (_audioCtx) return _audioCtx;
  try {
    const Ctx = (typeof window !== 'undefined') ? ((window as any).AudioContext || (window as any).webkitAudioContext) : null;
    if (Ctx) _audioCtx = new Ctx();
  } catch {}
  return _audioCtx;
}

// ═══ Unlock روی اولین کلیک/لمس کاربر ═══
function unlockAudio() {
  try {
    const ctx = _getAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
      // پخش صدا در حجم صفر برای unlock
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.01);
    }
  } catch {}
}


// 🔇 امن‌سازی صدا
const _safePlaySound = () => {
  try {
    if (_isWebView) return;
    if (typeof window === 'undefined') return;
    if (!('AudioContext' in window) && !('webkitAudioContext' in window)) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch {}
};

function playNotifSound() {
  if (_isWebView) return;
  try {
    const ctx = _getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    o.start(t); o.stop(t + 0.4);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.frequency.value = 1320;
    o2.type = 'sine';
    g2.gain.setValueAtTime(0.3, t + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    o2.start(t + 0.2); o2.stop(t + 0.5);
  } catch (e) { console.log('playNotifSound err', e); }
}

function vibrateNotif() {
  if (_isWebView) return;
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      (navigator as any).vibrate([200, 100, 200]);
    }
  } catch {}
}

function requestBrowserNotifPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
  } catch {}
}

function showBrowserNotif(title: string, body: string) {
  if (_isWebView) return;
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 192 192%27%3E%3Crect width=%27192%27 height=%27192%27 fill=%27%230f2438%27 rx=%2738%27/%3E%3Ctext x=%2796%27 y=%27140%27 font-size=%27130%27 font-family=%27serif%27 font-weight=%27bold%27 text-anchor=%27middle%27 fill=%27%23d4af37%27%3EM%3C/text%3E%3C/svg%3E',
        tag: 'mizan-notif-' + Date.now(),
      });
    }
  } catch {}
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return diff + ' ثانیه پیش';
  if (diff < 3600) return Math.floor(diff / 60) + ' دقیقه پیش';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
  return Math.floor(diff / 86400) + ' روز پیش';
}

export default function LiveMarketScreen({ showToast }: any) {
  // ═══ Unlock AudioContext روی اولین تعامل کاربر ═══
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => { try { unlockAudio(); } catch {} };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const [prefs, setPrefs] = useState<any>({});
  const [notifList, setNotifList] = useState<any[]>([]);
  const _notifReady = useRef<boolean>(false);
  const _lastNotifId = useRef<number>(0);
  const _notifPlaying = useRef<boolean>(false);

  const [net, setNet] = useState<any>({ connected: false, email: '', name: '', city: '' });
  const [loading, setLoading] = useState(true);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [fxOffers, setFxOffers] = useState<any[]>([]);
  const [myHawalas, setMyHawalas] = useState<any[]>([]);
  const [myFXOffers, setMyFXOffers] = useState<any[]>([]);
  const [myDeals, setMyDeals] = useState<any[]>([]);
  const [directInbox, setDirectInbox] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [createGroupModal, setCreateGroupModal] = useState(false);
  const [joinGroupModal, setJoinGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCity, setNewGroupCity] = useState('KBL');
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [rates, setRates] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [settingsModal, setSettingsModal] = useState(false);
  const [hawalaModal, setHawalaModal] = useState(false);
  const [fxModal, setFxModal] = useState(false);
  const [directModal, setDirectModal] = useState(false);
  const [chatModal, setChatModal] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadMsgs, setUnreadMsgs] = useState<any[]>([]);
  const _lastMsgId = useRef<number>(0);
  const _msgPlaying = useRef<boolean>(false);
  const [chatPeer, setChatPeer] = useState<any>(null);
  const [groupFeed, setGroupFeed] = useState<any[]>([]);
  const [openGroup, setOpenGroup] = useState<any>(null);
  const [rateModal, setRateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marketStats, setMarketStats] = useState<any>({ trades: 0, hawalas: 0, agents: 0, myTrades: 0, myHawalasSent: 0, myHawalasRecv: 0, myDirectPending: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [prevRates, setPrevRates] = useState<Record<string, number>>({});
  const [now, setNow] = useState(new Date());
  const [myDashCurs, setMyDashCurs] = useState<string[]>(() => loadMyDashCurs());
  const [dashCursModal, setDashCursModal] = useState(false);
  const [notifModal, setNotifModal] = useState(false);
  const [dirSearchCur, setDirSearchCur] = useState('');
  const [notifSettingsModal, setNotifSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', city: 'KBL', phone: '' });
  const [hawalaForm, setHawalaForm] = useState<any>({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
  const [fxForm, setFxForm] = useState<any>({ currency: 'USD', targetCurrency: 'AFN', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });
  const [directForm, setDirectForm] = useState<any>({ toEmail: '', toName: '', currency: 'USD', targetCurrency: 'AFN', rateMode: 'same', rate: '', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });
  const [dirSearchFrom, setDirSearchFrom] = useState('');
  const [dirSearchTo, setDirSearchTo] = useState('');
  const [rateForm, setRateForm] = useState<any>(() => {
    const obj: any = {};
    ['AFN', 'USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'TRY', 'IRR', 'TOM', 'INR', 'CNY', 'JPY', 'CHF', 'CAD', 'AUD', 'KWD', 'QAR', 'OMR', 'BHD', 'JOD', 'IQD', 'MYR', 'RUB', 'TJS', 'UZS', 'TMT', 'KGS', 'KZT', 'AZN', 'HKD', 'SGD', 'THB', 'EGP', 'LYD', 'SYP', 'LBP', 'YER', 'ETB', 'NOK', 'SEK', 'DKK', 'NZD', 'ZAR'].forEach(k => obj[k] = '');
    return obj;
  });
  const [rateBase, setRateBase] = useState('AFN');
  const [customRates, setCustomRates] = useState<any[]>([]);
  const [showAddCur, setShowAddCur] = useState(false);
  const [newCurCode, setNewCurCode] = useState('');
  const [newCurName, setNewCurName] = useState('');
  const [newCurRate, setNewCurRate] = useState('');
  const [hawSearchCur, setHawSearchCur] = useState('');
  const [fxSearchFrom, setFxSearchFrom] = useState('');
  const [fxSearchTo, setFxSearchTo] = useState('');
  const [claimingId, setClaimingId] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    const ok = await initNetwork();
    setNet(getMyNetInfo());
    setLoading(false);
    return ok;
  }, []);

  // ═══ محاسبه آمار لحظه‌ای ═══
  useEffect(() => {
    const agents = net.connected ? 1 : 0;
    const myH = myHawalas.length;
    const inH = hawalas.filter((h: any) => h.claimed_by_email === net.email).length;
    const dP = directInbox.filter((h: any) => h.status === 'pending').length;
    setMarketStats({
      trades: fxOffers.length + hawalas.length,
      hawalas: hawalas.length,
      agents: agents,
      myTrades: fxOffers.filter((f: any) => f.seller_email === net.email).length,
      myHawalasSent: myHawalas.length,
      myHawalasRecv: inH,
      myDirectPending: dP,
    });
  }, [fxOffers, hawalas, myHawalas, directInbox, net.connected, net.email]);

  // ═══ ساخت Activity Feed ═══
  useEffect(() => {
    const feed: any[] = [];
    rates.forEach((r: any) => {
      feed.push({ type: 'rate', icon: '📈', text: `${r.by_name} نرخ ${r.currency} = ${fmt(r.rate, 2)} ${r.base_currency || 'AFN'} ثبت کرد`, ts: new Date(r.updated_at).getTime(), color: '#059669' });
    });
    hawalas.forEach((h: any) => {
      feed.push({ type: 'hawala', icon: '📤', text: `${h.from_name} حواله ${fmt(h.amount)} ${h.currency} به ${NET_CITIES[h.target_city] || h.target_city}`, ts: new Date(h.created_at).getTime(), color: '#f59e0b' });
    });
    fxOffers.forEach((f: any) => {
      feed.push({ type: 'fx', icon: '💱', text: `${f.seller_name} فروش ${fmt(f.amount)} ${f.currency} @ ${fmt(f.rate, 2)}`, ts: new Date(f.created_at).getTime(), color: '#7c3aed' });
    });
    directInbox.slice(0, 5).forEach((h: any) => {
      feed.push({ type: 'direct', icon: '🔒', text: `${h.from_name} حواله خصوصی ${fmt(h.amount)} ${h.currency}`, ts: new Date(h.created_at).getTime(), color: '#0891b2' });
    });
    feed.sort((a, b) => b.ts - a.ts);
    setActivities(feed.slice(0, 8));
  }, [rates, hawalas, fxOffers, directInbox]);

  // 📌 بارگذاری ارزهای داشبورد از localStorage
  useEffect(() => {
    setMyDashCurs(loadMyDashCurs());
  }, []);

  // ⏰ تایمر ۱ ثانیه — برای ساعت
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 📸 ذخیره نرخ‌های قبلی — برای ▲▼
  useEffect(() => {
    const t = setInterval(() => {
      if (rates.length > 0) {
        const snap: Record<string, number> = {};
        rates.forEach((r: any) => { if (r.currency) snap[r.currency] = Number(r.rate) || 0; });
        setPrevRates(prev => ({ ...prev, ...snap }));
      }
    }, 10000); // هر ۱۰ ثانیه
    return () => clearInterval(t);
  }, [rates]);

  useEffect(() => { refresh(); return () => stopAllListeners(); }, [refresh]);

  useEffect(() => {
    if (!net.connected || !net.email) return;
    (async () => {
      const p = await fetchPreferences();
      setPrefs(p);
      if (!_isWebView && p.notify_browser) requestBrowserNotifPermission();
    })();
    const t = setInterval(async () => { setNotifList(await fetchAllNotifications()); }, 5000);
    (async () => { setNotifList(await fetchAllNotifications()); })();
    return () => clearInterval(t);
  }, [net.connected, net.email]);

  // ⭐ تشخیص نوتیف جدید و پخش صدا/لرزش/مرورگر
  /* ⚠️ غیرفعال — polling در App.tsx
useEffect(() => {
    if (!notifList || !notifList.length) return;
    const newestId = Math.max(...notifList.map((n: any) => n.id || 0));
    // بار اول، فقط مقدار رو ذخیره کن (نه صدا)
    if (!_notifReady.current) {
      _lastNotifId.current = newestId;
      _notifReady.current = true;
      return;
    }
    if (newestId > _lastNotifId.current && !_notifPlaying.current) {
      _notifPlaying.current = true;
      const newOnes = notifList.filter((n: any) => (n.id || 0) > _lastNotifId.current && !n.is_read);
      _lastNotifId.current = newestId;
      setTimeout(() => { _notifPlaying.current = false; }, 1500);
      if (newOnes.length > 0) {
        const n = newOnes[0];
        const p = n.payload || {};
        const texts: any = {
          fx_taken: `✅ ${p.from_name} آگهی شما را قبول کرد`,
          hawala_taken: `✅ ${p.from_name} حواله شما را قبول کرد`,
          direct_hawala: `🔒 حواله خصوصی از ${p.from_name}`,
          direct_accepted: `✅ ${p.from_name} حواله را قبول کرد`,
          direct_delivered: `📦 ${p.from_name} حواله را تحویل داد`,
          group_invite: `🌐 دعوت به گروه ${p.groupName || ''}`,
          group_join: `👥 ${p.from_name} به گروه پیوست`,
          fx_new: `💱 ${p.from_name} فروش ${fmt(p.amount)} ${p.currency}`,
          hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency} به ${NET_CITIES[p.targetCity] || p.targetCity}`,
        };
        const msg = texts[n.type] || '🔔 اعلان جدید';
        // ✅ صدا
        if (prefs.notify_sound) playNotifSound();
        // ✅ لرزش
        if (prefs.notify_vibrate) vibrateNotif();
        // ✅ نوتیف مرورگر
        if (!_isWebView && prefs.notify_browser) showBrowserNotif('میزان | MIZAN', msg);
        // ✅ toast
        showToast?.(msg);
      }
    }
  }, [notifList, prefs.notify_sound, prefs.notify_vibrate, prefs.notify_browser]);
*/

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
    listenMyFXOffers(setMyFXOffers);
    listenMyFXDeals(async () => {
      try {
        const m = await import('./lib.network');
        const [fxD, hwD] = await Promise.all([m.fetchMyFXDeals(), m.fetchMyHawalaDeals()]);
        const all = [
          ...(fxD || []).map((x: any) => ({ ...x, _kind: 'fx' })),
          ...(hwD || []).map((x: any) => ({ ...x, _kind: 'hawala' })),
        ];
        all.sort((a, b) => new Date(b.claimed_at || 0).getTime() - new Date(a.claimed_at || 0).getTime());
        setMyDeals(all);
      } catch {}
    });
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
    if (!net.connected) return showToast?.('❌ Firebase وصل نیست — VPN روشن کن', true);
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
    if (!net.connected) return showToast?.('❌ Firebase وصل نیست — VPN روشن کن', true);
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
    if (!net.connected) return showToast?.('❌ Firebase وصل نیست — VPN روشن کن', true);
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
    if (!rateBase) return showToast?.('ارز پایه انتخاب کنید', true);
    let count = 0;
    setSaving(true);
    try {
      for (const cur of ALL_CURS) {
        if (cur === rateBase) continue;
        const v = Number(rateForm[cur]);
        if (v > 0) { await saveDailyRateWithBase(cur, v, rateBase); count++; }
      }
      for (const cr of customRates) {
        const v = Number(cr.rate);
        if (v > 0) { await saveDailyRateWithBase(cr.code, v, rateBase); count++; }
      }
      if (count === 0) { setSaving(false); return showToast?.('حداقل یک نرخ وارد کنید', true); }
      setRateModal(false);
      showToast?.('✅ ' + count + ' نرخ ثبت شد');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const doClaimH = async (id: string) => {
    if (claimingId) return;
    setClaimingId(id);
    try {
      const r = await claimHawala(id);
      showToast?.(r.success ? '✅ قبول شد' : '⚠️ ' + r.message, !r.success);
      if (r.success) setTimeout(() => refresh(), 300);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    finally { setTimeout(() => setClaimingId(''), 500); }
  };
  const doClaimF = async (id: string) => {
    if (claimingId) return;
    setClaimingId(id);
    try {
      const r = await claimFXOffer(id);
      showToast?.(r.success ? '✅ قبول شد' : '⚠️ ' + r.message, !r.success);
      if (r.success) setTimeout(() => refresh(), 300);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    finally { setTimeout(() => setClaimingId(''), 500); }
  };
  const doAcceptD = async (id: string) => {
    try {
      await acceptDirectHawala(id);
      showToast?.('✅ قبول شد');
      setTimeout(() => refresh(), 300);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };
  const doDeliverD = async (id: string, toEmail: string) => {
    try {
      await deliverDirectHawala(id, toEmail);
      showToast?.('✅ تحویل شد');
      setTimeout(() => refresh(), 300);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };

  // ═══ auto-read وقتی مودال باز شد ═══
  useEffect(() => {
    if (!notifModal) return;
    (async () => {
      try {
        const { markAllRead } = await import('./lib.network');
        await markAllRead();
        setNotifList((prev: any[]) => prev.map((n: any) => ({ ...n, is_read: true })));
      } catch (e) {}
    })();
  }, [notifModal]);


  // ═══ چت — باز کردن روم ═══
  
  // ⚡ Listener چت — وقتی مودال باز است
  useEffect(() => {
    if (!chatModal || !chatRoom?.id) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        const msgs = await m.fetchMessages(chatRoom.id);
        if (alive) setChatMessages(msgs);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    // mark read
    markRoomRead(chatRoom.id).catch(() => {});
    return () => { alive = false; clearInterval(iv); };
  }, [chatModal, chatRoom?.id]);

const openChatWith = async (roomId: string, peerEmail: string, peerName: string, peerCity: string) => {
    setChatRoom({ id: roomId, type: 'private' });
    setChatPeer({ email: peerEmail, name: peerName, city: peerCity });
    setChatInput('');
    try {
      const m = await import('./lib.network');
      const msgs = await m.fetchMessages(roomId);
      setChatMessages(msgs);
    } catch (e: any) { console.log('openChatWith', e?.message); }
    setChatModal(true);
  };

  const sendChatMsg = async () => {
    if (!chatInput.trim() || !chatRoom) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      const m = await import('./lib.network');
      await m.sendMessage(chatRoom.id, chatPeer.email, text);
      const msgs = await m.fetchMessages(chatRoom.id);
      setChatMessages(msgs);
    } catch (e: any) { showToast?.('❌ ' + e?.message, true); }
  };

  // ═══ فید گروه ═══
  const openGroupFeed = async (g: any) => {
    setOpenGroup(g);
    try {
      const m = await import('./lib.network');
      const feed = await m.fetchGroupFeed(g.id);
      setGroupFeed(feed);
    } catch (e: any) { console.log('openGroupFeed', e?.message); }
  };


  // ═══ ایجاد گروه ═══
  const submitCreateGroup = async () => {
    if (!newGroupName || newGroupName.length < 3) return showToast?.('نام حداقل ۳ کاراکتر', true);
    setGroupSaving(true);
    try {
      const m = await import('./lib.network');
      const r = await (m as any).createGroup(newGroupName, newGroupCity);
      showToast?.('✅ گروه ساخته شد — کد دعوت: ' + (r.inviteCode || ''));
      setCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupCity('KBL');
      refresh();
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    setGroupSaving(false);
  };

  // ═══ پیوستن به گروه ═══
  const submitJoinGroup = async () => {
    if (!joinGroupCode || joinGroupCode.length < 5) return showToast?.('کد دعوت نامعتبر', true);
    setGroupSaving(true);
    try {
      const m = await import('./lib.network');
      await (m as any).joinGroupByCode(joinGroupCode.trim().toUpperCase());
      showToast?.('✅ به گروه پیوستید');
      setJoinGroupModal(false);
      setJoinGroupCode('');
      refresh();
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    setGroupSaving(false);
  };

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  // 🔎 DEBUG — چرا تب‌ها نیستند؟
  if (typeof window !== 'undefined') {
    console.log('🔎 LIVE_MARKET DEBUG:', {
      loading,
      connected: net?.connected,
      email: net?.email,
      name: net?.name,
      city: net?.city,
      hasName: !!net?.name,
      hasCity: !!net?.city,
      hasEmail: !!net?.email,
      ratesCount: rates?.length,
      hawalasCount: hawalas?.length,
      fxOffersCount: fxOffers?.length,
      notifCount: notifList?.length,
    });
  }


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
          {!net.connected && net.name ? (
            <Text style={{ color: '#fbbf24', fontSize: 10, marginTop: 4, textAlign: 'right' }}>
              ⚠️ Firebase وصل نیست — برای فعال‌سازی شبکه، VPN روشن کن
            </Text>
          ) : null}
          {!net.name ? (
            <Text style={{ color: '#f87171', fontSize: 11, marginTop: 6, textAlign: 'right', fontWeight: 'bold' }}>
              🚨 هنوز پروفایل شبکه نساخته‌اید — روی ⚙️ بزنید و «نام» + «شهر» را وارد کنید
            </Text>
          ) : null}
        </View>
        <TouchableOpacity style={s.smBtn} onPress={() => { setSettingsForm({ name: net.name || '', city: net.city || 'KBL', phone: net.phone || '' }); setSettingsModal(true); }}>
          <Text style={s.smBtnTxt}>⚙️</Text>
        </TouchableOpacity>
        {!net.connected && net.name ? (
          <TouchableOpacity style={[s.smBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]} onPress={refresh}>
            <Text style={s.smBtnTxt}>🔄</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 🚨 پیام تکمیل پروفایل */}
      {(!net.name || !net.city) ? (
        <View style={{ margin: 14, padding: 14, backgroundColor: '#7f1d1d', borderRadius: 10, borderWidth: 2, borderColor: '#dc2626' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'right', fontSize: 14, marginBottom: 6 }}>
            ⚠️ پروفایل شبکه ناقص است
          </Text>
          <Text style={{ color: '#fecaca', textAlign: 'right', fontSize: 12, marginBottom: 10 }}>
            برای دیدن حواله‌ها، فروش ارز و تب‌های بازار زنده، ابتدا نام و شهر خود را ثبت کنید.
          </Text>
          <TouchableOpacity
            onPress={() => { setSettingsForm({ name: net.name || '', city: net.city || 'KBL', phone: net.phone || '' }); setSettingsModal(true); }}
            style={{ backgroundColor: '#dc2626', padding: 10, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>⚙️ تکمیل پروفایل الان</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ═══════════════════════════════════════════ */}
      {/* 📊 داشبورد دیجیتال */}
      {/* ═══════════════════════════════════════════ */}
      <View style={s.dash}>

        {/* 🕐 ساعت و تاریخ */}
        <View style={s.dashHeader}>
          <View>
            <Text style={s.dashTitle}>📡 بازار زنده</Text>
            <Text style={s.dashSub}>{net.name || '—'} | {NET_CITIES[net.city] || '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 6, marginLeft: 8 }}>
            <TouchableOpacity onPress={() => setNotifSettingsModal(true)} style={{ backgroundColor: '#1e3a5f', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#7c3aed' }}>
              <Text style={{ fontSize: 16 }}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNotifModal(true)} style={{ backgroundColor: '#1e3a5f', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b', position: 'relative' }}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
              {(notifList.filter((n: any) => !n.is_read).length + unreadMsgs.length) > 0 ? (
                <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    {(notifList.filter((n: any) => !n.is_read).length + unreadMsgs.length)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.dashClock}>{String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}</Text>
            <Text style={s.dashDate}>{now.toLocaleDateString('fa-IR')}</Text>
          </View>
        </View>

        {/* 📈 Ticker نرخ‌ها */}
        {rates.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tickerScroll}>
            {['USD', 'EUR', 'GBP', 'AFN', 'PKR', 'AED', 'SAR', 'TRY'].filter(cur => rates.some((r: any) => r.currency === cur)).map(cur => {
              const stats = calcRateStats(rates, cur);
              if (!stats) return null;
              const prev = prevRates[cur] || stats.last;
              const diff = stats.last - prev;
              const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
              const color = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#94a3b8';
              return (
                <View key={cur} style={s.tickerItem}>
                  <Text style={s.tickerCur}>{FLAG[cur] || '💱'} {cur}</Text>
                  <Text style={s.tickerVal}>{fmt(stats.last, 2)}</Text>
                  <Text style={[s.tickerDiff, { color }]}>{arrow} {diff !== 0 ? fmt(Math.abs(diff), 0) : '0'}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* 📊 میانگین / سقف / کف */}
        {rates.length > 0 && (
          <View style={s.statsBox}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={s.statsBoxTitle}>📊 آمار لحظه‌ای</Text>
              <TouchableOpacity onPress={() => setDashCursModal(true)} style={{ backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>⚙️ تنظیم ارزها</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {myDashCurs.map(cur => {
                const stats = calcRateStats(rates, cur);
                if (!stats) return (
                  <View key={cur} style={s.statCard}>
                    <Text style={s.statCardCur}>{FLAG[cur] || '💱'} {cur}</Text>
                    <Text style={{ color: '#64748b', fontSize: 10, textAlign: 'center', paddingVertical: 8 }}>هنوز نرخی ثبت نشده</Text>
                  </View>
                );
                return (
                  <View key={cur} style={s.statCard}>
                    <Text style={s.statCardCur}>{FLAG[cur]} {cur}</Text>
                    <View style={s.statRow}>
                      <Text style={s.statLbl}>📊 میانگین</Text>
                      <Text style={s.statValAvg}>{fmt(stats.avg, 2)}</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLbl}>🔺 سقف</Text>
                      <Text style={s.statValHigh}>{fmt(stats.high, 2)}</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLbl}>🔻 کف</Text>
                      <Text style={s.statValLow}>{fmt(stats.low, 2)}</Text>
                    </View>
                    <Text style={s.statCount}>{stats.count} صراف ثبت کرد</Text>
                  </View>
                );
              })}
            </ScrollView>
            
          </View>
        )}

        {/* 📈 آمار بازار */}
        <View style={s.marketStats}>
          <View style={s.marketStatItem}>
            <Text style={s.marketStatIcon}>📈</Text>
            <Text style={s.marketStatVal}>{rates.length}</Text>
            <Text style={s.marketStatLbl}>نرخ</Text>
          </View>
          <View style={s.marketStatItem}>
            <Text style={s.marketStatIcon}>📤</Text>
            <Text style={s.marketStatVal}>{hawalas.filter((h: any) => h.status === 'open').length}</Text>
            <Text style={s.marketStatLbl}>حواله باز</Text>
          </View>
          <View style={s.marketStatItem}>
            <Text style={s.marketStatIcon}>💱</Text>
            <Text style={s.marketStatVal}>{fxOffers.length}</Text>
            <Text style={s.marketStatLbl}>آگهی ارز</Text>
          </View>
          <View style={s.marketStatItem}>
            <Text style={s.marketStatIcon}>👥</Text>
            <Text style={s.marketStatVal}>{agents.length + 1}</Text>
            <Text style={s.marketStatLbl}>صراف آنلاین</Text>
          </View>
        </View>

        {/* 💼 وضعیت من */}
        <View style={s.myStatus}>
          <Text style={s.myStatusTitle}>💼 وضعیت من</Text>
          <View style={s.myStatusGrid}>
            <View style={s.myStatusItem}>
              <Text style={s.myStatusLbl}>📤 ارسالی</Text>
              <Text style={s.myStatusVal}>{marketStats.myHawalasSent}</Text>
            </View>
            <View style={s.myStatusItem}>
              <Text style={s.myStatusLbl}>📥 قبولی</Text>
              <Text style={s.myStatusVal}>{marketStats.myHawalasRecv}</Text>
            </View>
            <View style={s.myStatusItem}>
              <Text style={s.myStatusLbl}>🔒 خصوصی</Text>
              <Text style={s.myStatusVal}>{marketStats.myDirectPending}</Text>
            </View>
            <View style={s.myStatusItem}>
              <Text style={s.myStatusLbl}>🌐 گروه</Text>
              <Text style={s.myStatusVal}>{myGroups.length}</Text>
            </View>
          </View>
        </View>

        {/* 🔔 فعالیت لحظه‌ای */}
        {activities.length > 0 && (
          <View style={s.activityBox}>
            <Text style={s.activityTitle}>🔔 فعالیت لحظه‌ای</Text>
            {activities.slice(0, 5).map((a: any, i: number) => (
              <View key={i} style={s.activityRow}>
                <Text style={[s.activityIcon, { color: a.color }]}>{a.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityText} numberOfLines={1}>{a.text}</Text>
                  <Text style={s.activityTime}>{timeAgo(a.ts)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </View>

      {/* دکمه‌های عملیات */}
      {(net.name && net.city) ? (
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
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#059669' }]} onPress={() => { const obj: any = {}; ALL_CURS.forEach(k => obj[k] = ''); setRateForm(obj); setCustomRates([]); setRateModal(true); }}>
            <Text style={s.actBtnTxt}>📈 نرخ روز</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* نرخ روز */}
      <Text style={s.secT}>📈 نرخ روز ({rates.length} نرخ)</Text>
      {rates.length === 0 ? (
        <Text style={s.empty}>نرخی ثبت نشده — از دکمه «📈 نرخ روز» ثبت کنید</Text>
      ) : (
        <View style={{ marginBottom: 8 }}>
          {(() => {
            // گروه‌بندی بر اساس ارز
            const byCur: Record<string, any[]> = {};
            rates.forEach((r: any) => {
              if (!byCur[r.currency]) byCur[r.currency] = [];
              byCur[r.currency].push(r);
            });
            const curList = ['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'TRY', 'IRR', 'TOM', 'AFN'];
            const others = Object.keys(byCur).filter(k => !curList.includes(k));
            return [...curList.filter(k => byCur[k]), ...others].map((cur: string) => (
              <View key={cur} style={s.rateCard}>
                <View style={s.rateCardHead}>
                  <Text style={s.rateCardTitle}>{FLAG[cur] || '💱'} {cur}</Text>
                  <Text style={s.rateCardCount}>{byCur[cur].length} نرخ</Text>
                </View>
                {byCur[cur].map((r: any, i: number) => (
                  <View key={i} style={s.rateRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rateVal}>
                        1 {cur} = {fmt(r.rate, 2)} {r.base_currency || 'AFN'}
                      </Text>
                      <Text style={s.rateBy}>👤 {r.by_name || '—'}  🕐 {new Date(r.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    {r.by_email === net.email ? <Text style={{ fontSize: 10, color: '#fbbf24' }}>شما</Text> : null}
                  </View>
                ))}
              </View>
            ));
          })()}
        </View>
      )}

      {/* حواله‌های خصوصی */}
      {pendingDirect.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#0891b2' }]}>🔒 حواله خصوصی دریافتی ({pendingDirect.length})</Text>
          {pendingDirect.map((h: any) => (
            <View key={h.id} style={[s.card, { borderColor: '#0891b2' }]}>
              <Text style={s.cardTitle}>🔒 {h.fromName || h.from_email?.split("@")[0]} {h.fromCity ? `— ${NET_CITIES[h.fromCity] || h.fromCity}` : ""}</Text>
              <Text style={s.cardAmt}>{FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
              <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📞 {h.beneficiaryPhone || '—'}</Text>
              <Text style={s.cardRow}>💰 کارمزد: {fmt(h.commission, 0)}</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPressIn={() => doAcceptD(h.id)} activeOpacity={0.6}>
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
              <Text style={s.cardTitle}>🔄 {h.fromName || h.from_email?.split("@")[0]} {h.fromCity ? `— ${NET_CITIES[h.fromCity] || h.fromCity}` : ""}</Text>
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
      {/* ═══ معاملات در حال انجام ═══ */}
      {myDeals.length > 0 ? (
        <>
          <Text style={[s.secT, { color: '#f59e0b' }]}>⚡ معاملات در حال انجام ({myDeals.length})</Text>
          {myDeals.map((d: any, i: number) => {
            const iAmSeller = (d.seller_email === net.email) || (d.from_email === net.email);
            const iAmBuyer = d.claimed_by_email === net.email;
            const peerEmail = iAmSeller ? d.claimed_by_email : (d.seller_email || d.from_email);
            const peerName = iAmSeller
              ? (d.claimed_by_name || d.claimed_by_email?.split('@')[0] || '—')
              : (d.seller_name || d.from_name || peerEmail?.split('@')[0] || '—');
            const peerCity = iAmSeller ? '' : (d.seller_city || d.from_city || '');
            const roomId = (d._kind === 'fx' ? 'fx_' : 'hw_') + d.id;
            const isFx = d._kind === 'fx';
            return (
              <View key={(isFx ? 'fxd_' : 'hwd_') + d.id + i} style={[s.card, { borderRightWidth: 4, borderRightColor: isFx ? '#7c3aed' : '#f59e0b' }]}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.cardTitle}>{isFx ? '💱' : '📤'} {isFx ? 'فروش ارز' : 'حواله'}</Text>
                  <Text style={{ color: iAmSeller ? '#fbbf24' : '#10b981', fontSize: 11, fontWeight: 'bold' }}>
                    {iAmSeller ? '👤 شما فروشنده/فرستنده' : '👤 شما خریدار/قبول‌کننده'}
                  </Text>
                </View>
                <Text style={s.cardAmt}>{FLAG[d.currency] || '💱'} {fmt(d.amount)} {d.currency}{isFx && d.target_currency && d.target_currency !== d.currency ? ` → ${d.target_currency}` : ''}</Text>
                {isFx ? (
                  <Text style={s.cardRow}>💹 نرخ: {fmt(d.rate, 4)}</Text>
                ) : (
                  <Text style={s.cardRow}>🎯 به {NET_CITIES[d.target_city] || d.target_city}</Text>
                )}
                <Text style={[s.cardRow, { color: '#a5f3fc', fontWeight: 'bold' }]}>
                  {iAmSeller ? '🛒 خریدار' : '🏢 فروشنده'}: {peerName}
                </Text>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: '#0891b2', flex: 1 }]}
                    onPress={() => openChatWith(roomId, peerEmail, peerName, peerCity)}
                  >
                    <Text style={s.btnTxt}>💬 چت</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: '#059669', flex: 1 }]}
                    onPress={async () => {
                      const ok = (typeof window !== 'undefined' && window.confirm) ? window.confirm('آیا تحویل انجام شد؟') : true;
                      if (!ok) return;
                      try {
                        const m = await import('./lib.network');
                        if (isFx) {
                          // برای FX فعلاً بی‌کار — بعداً کامل می‌کنیم
                          showToast?.('✅ معامله بسته شد');
                        } else {
                          await m.deliverHawalaByUser(d.id);
                          showToast?.('✅ تحویل تأیید شد');
                        }
                        refresh();
                      } catch (e: any) { showToast?.('❌ ' + e?.message, true); }
                    }}
                  >
                    <Text style={s.btnTxt}>✅ تحویل شد</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      <Text style={s.secT}>📥 حوالات عمومی برای من ({hawalas.filter((h: any) => h.status === 'open').length})</Text>
      {hawalas.filter((h: any) => h.status === 'open').length === 0 ? (
        <Text style={s.empty}>حواله‌ای نیست</Text>
      ) : hawalas.filter((h: any) => h.status === 'open').map((h: any) => {
        const mine = h.fromEmail === net.email;
        return (
          <View key={h.id} style={s.card}>
            <Text style={s.cardTitle}>{h.fromName}</Text>
            <Text style={[s.cardRow, { color: '#a78bfa', fontWeight: 'bold' }]}>📍 از {h.fromName || h.from_email?.split('@')[0] || '—'} در {NET_CITIES[h.fromCity || h.from_city] || h.fromCity || h.from_city || '—'}</Text>
            <Text style={s.cardAmt}>{FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
            <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📍 {NET_CITIES[h.targetCity] || h.targetCity}</Text>
            {!mine ? (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPressIn={() => doClaimH(h.id)} activeOpacity={0.6}>
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
      ) : (
        <>
          {/* آگهی‌های فروش ارز بازار */}
          {fxOffers.map((f: any) => (
            <View key={f.id} style={[s.card, { borderRightColor: '#7c3aed', borderRightWidth: 3 }]}>
              <Text style={s.cardTitle}>🏢 {f.sellerName} {f.sellerCity ? `— ${NET_CITIES[f.sellerCity] || f.sellerCity}` : ''}</Text>
              <Text style={s.cardAmt}>{FLAG[f.currency] || '💱'} {fmt(f.amount)} {f.currency}{f.targetCurrency && f.targetCurrency !== f.currency ? ` → ${FLAG[f.targetCurrency] || '💱'} ${f.targetCurrency}` : ''}</Text>
              <Text style={s.cardRow}>💹 نرخ: {fmt(f.rate, 4)} {f.rateType === 'auction' ? '(حراج)' : ''}</Text>
              {f.note ? <Text style={s.cardRow}>📝 {f.note}</Text> : null}
              {f.sellerEmail === net.email || f.seller_email === net.email ? (
                <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                  <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: 'bold', flex: 1, textAlign: 'right' }}>🔵 آگهی خودم</Text>
                  {f.claimed_by_email ? (
                    <TouchableOpacity
                      style={[s.btn, { backgroundColor: '#0891b2', paddingHorizontal: 12 }]}
                      onPress={() => openChatWith('fx_' + f.id, f.claimed_by_email, f.claimed_by_name || f.claimed_by_email?.split('@')[0] || '—', '')}
                    >
                      <Text style={s.btnTxt}>💬 چت</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', paddingHorizontal: 12 }]} onPress={async () => {
                    try { const m = await import('./lib.network'); await m.deleteFXOffer(f.id); showToast?.('🗑 حذف شد'); refresh(); } catch (e: any) { showToast?.('❌ ' + e.message, true); }
                  }}>
                    <Text style={s.btnTxt}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ) : f.claimed_by_email === net.email ? (
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: '#0891b2' }]}
                  onPress={() => openChatWith('fx_' + f.id, f.seller_email || f.sellerEmail, f.seller_name || f.sellerName || '—', f.seller_city || f.sellerCity || '')}
                >
                  <Text style={s.btnTxt}>💬 چت با فروشنده</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPressIn={() => doClaimF(f.id)} activeOpacity={0.6}>
                  <Text style={s.btnTxt}>💰 قبول</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {fxOffers.length === 0 && (myFXOffers.length === 0) ? (
            <Text style={s.empty}>آگهی فروش ارزی نیست</Text>
          ) : null}
        </>
      )}
      {/* ═══ مودال نوتیفیکیشن ═══ */}
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={() => setNotifModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#f59e0b' }]}>
            <Text style={s.mTitle}>🔔 اعلان‌ها ({notifList.length})</Text>
            <TouchableOpacity onPress={() => setNotifModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            {notifList.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>📭 اعلانی نیست</Text>
            ) : notifList.map((n: any, i: number) => {
              const p = n.payload || {};
              const texts: any = {
                fx_taken: `✅ ${p.from_name} آگهی شما را قبول کرد`,
                hawala_taken: `✅ ${p.from_name} حواله شما را قبول کرد`,
                direct_hawala: `🔒 حواله خصوصی از ${p.from_name}`,
                direct_accepted: `✅ ${p.from_name} حواله را قبول کرد`,
                direct_delivered: `📦 ${p.from_name} حواله را تحویل داد`,
                group_invite: `🌐 دعوت به گروه ${p.groupName || ''}`,
                group_join: `👥 ${p.from_name} به گروه پیوست`,
                fx_new: `💱 ${p.from_name} فروش ${fmt(p.amount)} ${p.currency}`,
                hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency}`,
              };
              const msg = texts[n.type] || '🔔 اعلان جدید';
              const isUnread = !n.is_read;
              return (
                <View key={n.id || i} style={{
                  backgroundColor: isUnread ? '#1e3a5f' : '#0f172a',
                  padding: 12, borderRadius: 8, marginBottom: 8,
                  borderRightWidth: 4,
                  borderRightColor: isUnread ? '#f59e0b' : '#334155',
                }}>
                  <Text style={{ color: '#fff', fontSize: 12, textAlign: 'right', fontWeight: isUnread ? 'bold' : 'normal' }}>
                    {msg}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          {notifList.length > 0 ? (
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const { markAllRead } = await import('./lib.network');
                      await markAllRead();
                      setNotifList(notifList.map((n: any) => ({ ...n, is_read: true })));
                      showToast?.('✅ همه خوانده شد');
                    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
                  }}
                  style={{ backgroundColor: '#059669', padding: 10, borderRadius: 8, alignItems: 'center', flex: 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✅ خواندن همه</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const { deleteNotification } = await import('./lib.network');
                      for (const n of notifList) {
                        if (n.id) await deleteNotification(n.id);
                      }
                      setNotifList([]);
                      showToast?.('🗑 همه پاک شد');
                    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
                  }}
                  style={{ backgroundColor: '#dc2626', padding: 10, borderRadius: 8, alignItems: 'center', flex: 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>🗑 پاک کردن همه</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View></View>
      </Modal>


      {/* مودال تنظیمات */}
      {/* ═══ مودال تنظیمات اعلان‌ها ═══ */}
      <Modal visible={notifSettingsModal} transparent animationType="slide" onRequestClose={() => setNotifSettingsModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}>⚙️ تنظیمات اعلان‌ها</Text>
            <TouchableOpacity onPress={() => setNotifSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 600 }}>

            {/* ═══ بخش ۱: نوتیف‌های مهم ═══ */}
            <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 8, marginTop: 4 }}>
              🔔 نوتیف‌های مهم
            </Text>
            {[
              { k: 'notify_hawala_claim', l: '✅ کسی حواله من را قبول کرد' },
              { k: 'notify_fx_claim',     l: '✅ کسی آگهی ارز من را خرید' },
              { k: 'notify_direct',       l: '🔒 حواله خصوصی جدید' },
              { k: 'notify_direct_deliver', l: '📦 حواله خصوصی من تحویل شد' },
            ].map(x => (
              <View key={x.k} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, textAlign: 'right', flex: 1 }}>{x.l}</Text>
                <Switch value={prefs[x.k] !== false} onValueChange={v => setPrefs({ ...prefs, [x.k]: v })} trackColor={{ false: '#334155', true: '#10b981' }} thumbColor="#fff" />
              </View>
            ))}

            {/* ═══ بخش ۲: نوتیف‌های بازار ═══ */}
            <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 8, marginTop: 16 }}>
              📊 نوتیف‌های بازار
            </Text>
            {[
              { k: 'notify_hawala_new', l: '📤 حواله جدید در شهر من' },
              { k: 'notify_fx_new',     l: '💱 آگهی فروش ارز جدید' },
              { k: 'notify_rate_change', l: '📈 تغییر نرخ ارز' },
            ].map(x => (
              <View key={x.k} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, textAlign: 'right', flex: 1 }}>{x.l}</Text>
                <Switch value={prefs[x.k] !== false} onValueChange={v => setPrefs({ ...prefs, [x.k]: v })} trackColor={{ false: '#334155', true: '#10b981' }} thumbColor="#fff" />
              </View>
            ))}

            {/* ═══ بخش ۳: صدا و هشدار ═══ */}
            <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 8, marginTop: 16 }}>
              🔊 صدا و هشدار
            </Text>
            {[
              { k: 'notify_sound',   l: '🔔 صدا هنگام اعلان' },
              { k: 'notify_vibrate', l: '📳 لرزش گوشی' },
              { k: 'notify_browser', l: '💬 نوتیف مرورگر / سیستم' },
            ].map(x => (
              <View key={x.k} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, textAlign: 'right', flex: 1 }}>{x.l}</Text>
                <Switch value={prefs[x.k] !== false} onValueChange={v => setPrefs({ ...prefs, [x.k]: v })} trackColor={{ false: '#334155', true: '#10b981' }} thumbColor="#fff" />
              </View>
            ))}

            {/* ═══ تست صدا و هشدار ═══ */}
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => { try { playNotifSound(); } catch (e) {} showToast?.('🔔 تست صدا'); }}
                style={{ flex: 1, backgroundColor: '#0ea5e9', padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>🔔 تست صدا</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { try { vibrateNotif(); } catch (e) {} showToast?.('📳 تست لرزش'); }}
                style={{ flex: 1, backgroundColor: '#0ea5e9', padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>📳 تست لرزش</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { try { showBrowserNotif('میزان | MIZAN', 'تست اعلان سیستم'); } catch (e) {} showToast?.('💬 تست نوتیف'); }}
                style={{ flex: 1, backgroundColor: '#0ea5e9', padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>💬 تست نوتیف</Text>
              </TouchableOpacity>
            </View>

            {/* ═══ بخش ۴: ارزهای مورد علاقه ═══ */}
            <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 8, marginTop: 16 }}>
              ⭐ ارزهای مورد علاقه
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginBottom: 6 }}>
              اعلان‌های ارزی فقط برای این ارزها می‌آید
            </Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'EUR', 'GBP', 'AFN', 'PKR', 'AED', 'SAR', 'TRY', 'IRR', 'TOM', 'INR', 'CNY', 'IQD', 'KWD', 'QAR', 'OMR'].map(c => {
                const watched = (prefs.watch_currencies || []).includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      const list = prefs.watch_currencies || [];
                      const next = watched ? list.filter((x: string) => x !== c) : [...list, c];
                      setPrefs({ ...prefs, watch_currencies: next });
                    }}
                    style={[s.chip, watched && { backgroundColor: '#10b981', borderColor: '#10b981' }]}
                  >
                    <Text style={[s.chipTxt, watched && { color: '#fff', fontWeight: 'bold' }]}>
                      {FLAG[c] || '💱'} {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══ بخش ۵: شهرهای مورد علاقه ═══ */}
            <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 8, marginTop: 16 }}>
              🏙️ شهرهای مورد علاقه
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginBottom: 6 }}>
              اعلان‌های حواله فقط برای این شهرها می‌آید
            </Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => {
                const watched = (prefs.watch_cities || []).includes(k);
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => {
                      const list = prefs.watch_cities || [];
                      const next = watched ? list.filter((x: string) => x !== k) : [...list, k];
                      setPrefs({ ...prefs, watch_cities: next });
                    }}
                    style={[s.chip, watched && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}
                  >
                    <Text style={[s.chipTxt, watched && { color: '#fff', fontWeight: 'bold' }]}>
                      {NET_CITIES[k]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══ دکمه ذخیره ═══ */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  const { savePreferences } = await import('./lib.network');
                  await savePreferences(prefs);
                  showToast?.('✅ تنظیمات ذخیره شد');
                  setNotifSettingsModal(false);
                } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
              }}
              style={{ backgroundColor: '#059669', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16, marginBottom: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>💾 ذخیره تنظیمات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPrefs({
                  notify_hawala_claim: true, notify_fx_claim: true, notify_direct: true, notify_direct_deliver: true,
                  notify_hawala_new: true, notify_fx_new: true, notify_rate_change: true,
                  notify_sound: true, notify_vibrate: true, notify_browser: true,
                  watch_currencies: ['USD', 'EUR', 'PKR', 'AED', 'GBP'],
                  watch_cities: ['KBL', 'HRT', 'MZR', 'KDH'],
                });
                showToast?.('↩️ پیش‌فرض شد');
              }}
              style={{ backgroundColor: '#64748b', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 12 }}>↩️ بازگشت به پیش‌فرض</Text>
            </TouchableOpacity>

          </ScrollView>
        </View></View>
      </Modal>

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
            <View style={{ backgroundColor: '#0f172a', padding: 10, borderRadius: 8, marginBottom: 8, borderRightWidth: 3, borderRightColor: '#0891b2' }}>
              <Text style={{ color: '#0891b2', fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>
                📍 ارسال از: {net.name || '—'} در {NET_CITIES[net.city] || net.city || '—'}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                (شهر شما از پروفایل گرفته می‌شود)
              </Text>
            </View>
            {/* 🎯 مقصد حواله */}
            <Text style={s.lbl}>🎯 مقصد حواله</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setHawalaForm({ ...hawalaForm, targetGroupId: '' })}
                style={[s.chip, hawalaForm.targetGroupId === '' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}
              >
                <Text style={[s.chipTxt, hawalaForm.targetGroupId === '' && { color: '#fff', fontWeight: 'bold' }]}>🌐 بازار عمومی</Text>
              </TouchableOpacity>
              {myGroups.map((g: any) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setHawalaForm({ ...hawalaForm, targetGroupId: g.id })}
                  style={[s.chip, hawalaForm.targetGroupId === g.id && { backgroundColor: '#10b981', borderColor: '#10b981' }]}
                >
                  <Text style={[s.chipTxt, hawalaForm.targetGroupId === g.id && { color: '#fff', fontWeight: 'bold' }]}>🔒 {g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {myGroups.length === 0 ? (
              <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginBottom: 8 }}>
                برای ارسال به گروه خصوصی، ابتدا در تب «گروه‌های من» گروه بسازید
              </Text>
            ) : null}
            <Text style={s.lbl}>شهر مقصد *</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setHawalaForm({ ...hawalaForm, targetCity: k })} style={[s.chip, hawalaForm.targetCity === k && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}>
                  <Text style={[s.chipTxt, hawalaForm.targetCity === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>ارز</Text>
            <TextInput style={s.inp} value={hawSearchCur} onChangeText={setHawSearchCur} placeholder="🔍 جستجو: USD یا دالر یا افغانی..." placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {ALL_CURS.filter(c => !hawSearchCur || c.toLowerCase().includes(hawSearchCur.toLowerCase()) || (CUR_NAME[c] || '').includes(hawSearchCur)).map(c => (
                <TouchableOpacity key={c} onPress={() => setHawalaForm({ ...hawalaForm, currency: c })} style={[s.chip, hawalaForm.currency === c && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}>
                  <Text style={[s.chipTxt, hawalaForm.currency === c && { color: '#fff' }]}>{FLAG[c] || '💱'} {c} - {CUR_NAME[c] || c}</Text>
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
            {/* 🎯 مقصد آگهی */}
            <Text style={s.lbl}>🎯 مقصد آگهی</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setFxForm({ ...fxForm, targetGroupId: '' })}
                style={[s.chip, fxForm.targetGroupId === '' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
              >
                <Text style={[s.chipTxt, fxForm.targetGroupId === '' && { color: '#fff', fontWeight: 'bold' }]}>🌐 بازار عمومی</Text>
              </TouchableOpacity>
              {myGroups.map((g: any) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setFxForm({ ...fxForm, targetGroupId: g.id })}
                  style={[s.chip, fxForm.targetGroupId === g.id && { backgroundColor: '#10b981', borderColor: '#10b981' }]}
                >
                  <Text style={[s.chipTxt, fxForm.targetGroupId === g.id && { color: '#fff', fontWeight: 'bold' }]}>🔒 {g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>ارز مبدأ (می‌فروشید) *</Text>
            <TextInput style={s.inp} value={fxSearchFrom} onChangeText={setFxSearchFrom} placeholder="🔍 جستجو: USD یا دالر یا افغانی..." placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {ALL_CURS.filter(c => !fxSearchFrom || c.toLowerCase().includes(fxSearchFrom.toLowerCase()) || (CUR_NAME[c] || '').includes(fxSearchFrom)).map(c => (
                <TouchableOpacity key={c} onPress={() => setFxForm({ ...fxForm, currency: c })} style={[s.chip, fxForm.currency === c && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}>
                  <Text style={[s.chipTxt, fxForm.currency === c && { color: '#fff' }]}>{FLAG[c] || '💱'} {c} - {CUR_NAME[c] || c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.lbl}>ارز مقصد (دریافت می‌کنید) *</Text>
            <TextInput style={s.inp} value={fxSearchTo} onChangeText={setFxSearchTo} placeholder="🔍 جستجو: AFN یا افغانی یا دالر..." placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {ALL_CURS.filter(c => c !== fxForm.currency).filter(c => !fxSearchTo || c.toLowerCase().includes(fxSearchTo.toLowerCase()) || (CUR_NAME[c] || '').includes(fxSearchTo)).map(c => (
                <TouchableOpacity key={c} onPress={() => setFxForm({ ...fxForm, targetCurrency: c })} style={[s.chip, fxForm.targetCurrency === c && { backgroundColor: '#10b981', borderColor: '#10b981' }]}>
                  <Text style={[s.chipTxt, fxForm.targetCurrency === c && { color: '#fff' }]}>{FLAG[c] || '💱'} {c} - {CUR_NAME[c] || c}</Text>
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
                <Text style={s.lbl}>نرخ (به {fxForm.targetCurrency || 'AFN'}) *</Text>
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
            <TextInput style={s.inp} value={dirSearchCur} onChangeText={setDirSearchCur} placeholder="🔍 جستجو: USD یا دالر یا افغانی..." placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {ALL_CURS.filter(c => !dirSearchCur || c.toLowerCase().includes(dirSearchCur.toLowerCase()) || (CUR_NAME[c] || '').includes(dirSearchCur)).map(c => (
                <TouchableOpacity key={c} onPress={() => setDirectForm({ ...directForm, currency: c })} style={[s.chip, directForm.currency === c && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}>
                  <Text style={[s.chipTxt, directForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* نوع تبدیل */}
            <Text style={s.lbl}>نوع تبدیل</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 4 }}>
              <TouchableOpacity style={[s.chip, directForm.rateMode === 'same' && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]} onPress={() => setDirectForm({ ...directForm, rateMode: 'same' })}>
                <Text style={[s.chipTxt, directForm.rateMode === 'same' && { color: '#fff' }]}>🔄 ارز به ارز</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, directForm.rateMode === 'different' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]} onPress={() => setDirectForm({ ...directForm, rateMode: 'different' })}>
                <Text style={[s.chipTxt, directForm.rateMode === 'different' && { color: '#fff' }]}>💱 ارز متفاوت</Text>
              </TouchableOpacity>
            </View>
            {directForm.rateMode === 'different' ? (
              <>
                <Text style={s.lbl}>ارز مقصد (گیرنده می‌گیرد) *</Text>
                <TextInput style={s.inp} value={dirSearchTo} onChangeText={setDirSearchTo} placeholder="🔍 جستجو: AFN یا افغانی یا دالر..." placeholderTextColor="#94a3b8" />
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {ALL_CURS.filter(c => c !== directForm.currency).filter(c => !dirSearchTo || c.toLowerCase().includes(dirSearchTo.toLowerCase()) || (CUR_NAME[c] || '').includes(dirSearchTo)).map(c => (
                    <TouchableOpacity key={c} onPress={() => setDirectForm({ ...directForm, targetCurrency: c })} style={[s.chip, directForm.targetCurrency === c && { backgroundColor: '#10b981', borderColor: '#10b981' }]}>
                      <Text style={[s.chipTxt, directForm.targetCurrency === c && { color: '#fff' }]}>{FLAG[c] || '💱'} {c} - {CUR_NAME[c] || c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.lbl}>نرخ تبدیل (۱ {directForm.currency} = ? {directForm.targetCurrency}) *</Text>
                <TextInput style={s.inp} value={directForm.rate} onChangeText={(v: string) => setDirectForm({ ...directForm, rate: v.replace(/[^0-9.]/g, '') })} keyboardType="numeric" placeholder="مثلاً 70500" placeholderTextColor="#94a3b8" />
              </>
            ) : null}
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
            {/* ارز پایه */}
            <View style={s.baseBox}>
              <Text style={s.baseLbl}>🎯 نرخ بر اساس:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ALL_CURS.map(b => (
                  <TouchableOpacity key={b} onPress={() => setRateBase(b)} style={[s.chip, rateBase === b && { backgroundColor: '#d4af37', borderColor: '#d4af37' }]}>
                    <Text style={[s.chipTxt, rateBase === b && { color: '#000', fontWeight: 'bold' }]}>{FLAG[b]} {b}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.baseHint}>
                ۱ واحد از هر ارز = ? {rateBase}
              </Text>
            </View>

            {/* فیلدهای نرخ */}
            {ALL_CURS.filter(x => x !== rateBase).map(c => (
              <View key={c}>
                <Text style={s.lbl}>{FLAG[c]} {curLabel(c)}</Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    style={[s.inp, { flex: 1 }]}
                    value={rateForm[c]}
                    onChangeText={v => setRateForm({ ...rateForm, [c]: v.replace(/[^\d.]/g, '') })}
                    keyboardType="numeric"
                    placeholder={'مثلاً برای ' + rateBase}
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={{ color: '#94a3b8', fontSize: 11, minWidth: 60, textAlign: 'left' }}>{rateBase}</Text>
                </View>
              </View>
            ))}

            {/* ارزهای دستی */}
            {customRates.map((cr: any, i: number) => (
              <View key={'custom_' + i}>
                <Text style={s.lbl}>{FLAG[cr.code] || '💱'} {cr.name} ({cr.code}) <Text style={{ color: '#f59e0b', fontSize: 10 }}>➕ دستی</Text></Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    style={[s.inp, { flex: 1 }]}
                    value={cr.rate}
                    onChangeText={v => { const n = [...customRates]; n[i].rate = v.replace(/[^\d.]/g, ''); setCustomRates(n); }}
                    keyboardType="numeric"
                    placeholder={'مثلاً برای ' + rateBase}
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={{ color: '#94a3b8', fontSize: 11, minWidth: 60, textAlign: 'left' }}>{rateBase}</Text>
                  <TouchableOpacity onPress={() => setCustomRates(customRates.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
                    <Text style={{ color: '#dc2626', fontSize: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* دکمه افزودن ارز دستی */}
            {!showAddCur ? (
              <TouchableOpacity onPress={() => setShowAddCur(true)} style={{ backgroundColor: '#1e3a5f', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center', borderWidth: 1, borderColor: '#7c3aed' }}>
                <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: 'bold' }}>➕ افزودن ارز دستی</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: '#1e1b4b', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#a78bfa' }}>
                <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>➕ ارز جدید</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                  <TextInput
                    style={[s.inp, { flex: 1 }]}
                    value={newCurCode}
                    onChangeText={v => setNewCurCode(v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
                    placeholder="کد (مثلاً BTC)"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={[s.inp, { flex: 1.5 }]}
                    value={newCurName}
                    onChangeText={setNewCurName}
                    placeholder="نام فارسی"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <TextInput
                  style={[s.inp, { marginTop: 6 }]}
                  value={newCurRate}
                  onChangeText={v => setNewCurRate(v.replace(/[^\d.]/g, ''))}
                  keyboardType="numeric"
                  placeholder={'نرخ برای ' + rateBase}
                  placeholderTextColor="#94a3b8"
                />
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => { setShowAddCur(false); setNewCurCode(''); setNewCurName(''); setNewCurRate(''); }} style={{ padding: 8, backgroundColor: '#64748b', borderRadius: 6, flex: 1 }}>
                    <Text style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>انصراف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!newCurCode || !newCurName) return showToast?.('کد و نام الزامی', true);
                      if (ALL_CURS.includes(newCurCode)) return showToast?.('این ارز از قبل هست', true);
                      setCustomRates([...customRates, { code: newCurCode, name: newCurName, rate: newCurRate }]);
                      if (!FLAG[newCurCode]) FLAG[newCurCode] = '💱';
                      if (!CUR_NAME[newCurCode]) CUR_NAME[newCurCode] = newCurName;
                      setShowAddCur(false); setNewCurCode(''); setNewCurName(''); setNewCurRate('');
                      showToast?.('✅ ارز اضافه شد');
                    }}
                    style={{ padding: 8, backgroundColor: '#7c3aed', borderRadius: 6, flex: 2 }}
                  >
                    <Text style={{ color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>✅ افزودن</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

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

      {/* مودال انتخاب ارزها برای داشبورد */}
      <Modal visible={dashCursModal} transparent animationType="slide" onRequestClose={() => setDashCursModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}>⚙️ ارزهای داشبورد</Text>
            <TouchableOpacity onPress={() => setDashCursModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            <Text style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 10, textAlign: 'right' }}>
              ارزهایی که می‌خواهید در داشبورد نمایش داده شود را انتخاب کنید:
            </Text>
            {ALL_CURS.map(cur => {
              const selected = myDashCurs.includes(cur);
              return (
                <TouchableOpacity
                  key={cur}
                  onPress={() => {
                    const next = selected ? myDashCurs.filter((x: string) => x !== cur) : [...myDashCurs, cur];
                    setMyDashCurs(next);
                    saveMyDashCurs(next);
                  }}
                  style={[s.curPickRow, selected && { backgroundColor: '#7c3aed', borderColor: '#a78bfa' }]}
                >
                  <Text style={[s.curPickName, selected && { color: '#fff', fontWeight: 'bold' }]}>
                    {FLAG[cur] || '💱'} {curLabel(cur)}
                  </Text>
                  <Text style={{ fontSize: 18 }}>{selected ? '✅' : '⬜'}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => { setMyDashCurs([]); saveMyDashCurs([]); }}
                style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]}
              >
                <Text style={s.btnTxt}>پاک همه</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMyDashCurs(['USD', 'EUR', 'PKR', 'AED', 'GBP']); saveMyDashCurs(['USD', 'EUR', 'PKR', 'AED', 'GBP']); }}
                style={[s.btn, { backgroundColor: '#0891b2', flex: 1 }]}
              >
                <Text style={s.btnTxt}>پیش‌فرض</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDashCursModal(false)}
                style={[s.btn, { backgroundColor: '#059669', flex: 2 }]}
              >
                <Text style={s.btnTxt}>✅ تمام</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال چت خصوصی ═══ */}
      <Modal visible={chatModal} transparent animationType="slide" onRequestClose={() => setChatModal(false)}>
        <View style={s.mBg}><View style={[s.mBox, { maxHeight: '92%' }]}>
          <View style={[s.mHead, { backgroundColor: '#0891b2' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.mTitle}>💬 چت با {chatPeer?.name || '—'}</Text>
              {chatPeer?.city ? <Text style={{ color: '#a5f3fc', fontSize: 10, textAlign: 'right' }}>🏙️ {NET_CITIES[chatPeer.city] || chatPeer.city}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setChatModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 400, backgroundColor: '#0a1628' }}>
            {chatMessages.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>هنوز پیامی نیست — شما شروع کنید</Text>
            ) : chatMessages.map((m: any, i: number) => {
              const mine = m.from_email === net.email;
              return (
                <View key={m.id || i} style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  backgroundColor: mine ? '#0891b2' : '#1e293b',
                  padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%',
                }}>
                  {!mine ? <Text style={{ color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>{m.from_name}</Text> : null}
                  <Text style={{ color: '#fff', fontSize: 12, textAlign: 'right' }}>{m.text}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row-reverse', gap: 6, padding: 10, borderTopWidth: 1, borderTopColor: '#334155' }}>
            <TextInput
              style={[s.inp, { flex: 1, textAlign: 'right' }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="پیام خود را بنویسید..."
              placeholderTextColor="#94a3b8"
              onSubmitEditing={sendChatMsg}
            />
            <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2', paddingHorizontal: 20 }]} onPress={sendChatMsg}>
              <Text style={s.btnTxt}>📤 ارسال</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ═══ مودال فید گروه ═══ */}
      <Modal visible={!!openGroup} transparent animationType="slide" onRequestClose={() => setOpenGroup(null)}>
        <View style={s.mBg}><View style={[s.mBox, { maxHeight: '92%' }]}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.mTitle}>🔒 {openGroup?.name || '—'}</Text>
              <Text style={{ color: '#a7f3d0', fontSize: 10, textAlign: 'right' }}>🏙️ {NET_CITIES[openGroup?.city] || openGroup?.city}</Text>
            </View>
            <TouchableOpacity onPress={() => setOpenGroup(null)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            {groupFeed.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>هیچ فعالیتی در این گروه نیست</Text>
            ) : groupFeed.map((item: any, i: number) => {
              if (item._kind === 'fx') {
                return (
                  <View key={'fx_' + item.id} style={[s.card, { borderRightWidth: 3, borderRightColor: '#7c3aed' }]}>
                    <Text style={s.cardTitle}>💱 {item.seller_name || item.sellerName} — {NET_CITIES[item.seller_city] || item.seller_city || '—'}</Text>
                    <Text style={s.cardAmt}>{FLAG[item.currency] || '💱'} {fmt(item.amount)} {item.currency}</Text>
                    <Text style={s.cardRow}>💹 نرخ: {fmt(item.rate, 4)}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString('fa-IR') : ''}
                    </Text>
                  </View>
                );
              } else {
                return (
                  <View key={'hw_' + item.id} style={[s.card, { borderRightWidth: 3, borderRightColor: '#f59e0b' }]}>
                    <Text style={s.cardTitle}>📤 {item.from_name || item.fromName} — {NET_CITIES[item.from_city] || item.from_city || '—'}</Text>
                    <Text style={s.cardAmt}>{FLAG[item.currency] || '💱'} {fmt(item.amount)} {item.currency} → {NET_CITIES[item.target_city] || item.target_city}</Text>
                    <Text style={s.cardRow}>👤 {item.beneficiary_name || item.beneficiaryName}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString('fa-IR') : ''}
                    </Text>
                  </View>
                );
              }
            })}
          </ScrollView>
        </View></View>
      </Modal>


    </View>
  );
}

const s = StyleSheet.create({
  // ═══ داشبورد ═══
  dash: { backgroundColor: '#0a1628', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 2, borderColor: '#1f3a5f', shadowColor: '#00ff88', shadowOpacity: 0.05, shadowRadius: 10 },
  dashHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#d4af37', marginBottom: 12 },
  dashTitle: { color: '#d4af37', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  dashSub: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' },
  dashClock: { color: '#00ff88', fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 2, textShadowColor: '#00ff88', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
  dashDate: { color: '#4ade80', fontSize: 10, marginTop: 2 },
  tickerScroll: { marginBottom: 12 },
  tickerItem: { backgroundColor: '#0f2438', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 6, minWidth: 90, alignItems: 'center', borderWidth: 1, borderColor: '#1f3a5f' },
  tickerCur: { color: '#d4af37', fontSize: 10, fontWeight: 'bold' },
  tickerVal: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', marginTop: 2 },
  tickerDiff: { fontSize: 9, fontWeight: 'bold', marginTop: 2 },
  statsBox: { backgroundColor: '#0f2438', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#1f3a5f' },
  statsBoxTitle: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  statCard: { backgroundColor: '#1a2332', borderRadius: 10, padding: 10, marginLeft: 8, minWidth: 130, borderWidth: 1, borderColor: '#334155' },
  statCardCur: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  statRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 3 },
  statLbl: { color: '#94a3b8', fontSize: 10 },
  statValAvg: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  statValHigh: { color: '#10b981', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  statValLow: { color: '#ef4444', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  statCount: { color: '#64748b', fontSize: 9, textAlign: 'center', marginTop: 6, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 4 },
  marketStats: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 },
  marketStatItem: { flex: 1, backgroundColor: '#0f2438', borderRadius: 8, paddingVertical: 10, marginLeft: 4, alignItems: 'center', borderWidth: 1, borderColor: '#1f3a5f' },
  marketStatIcon: { fontSize: 16, marginBottom: 2 },
  marketStatVal: { color: '#00ff88', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' },
  marketStatLbl: { color: '#94a3b8', fontSize: 9, marginTop: 2 },
  myStatus: { backgroundColor: '#0f2438', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#7c3aed' },
  myStatusTitle: { color: '#a78bfa', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  myStatusGrid: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  myStatusItem: { flex: 1, alignItems: 'center' },
  myStatusLbl: { color: '#94a3b8', fontSize: 9, marginBottom: 2 },
  myStatusVal: { color: '#a78bfa', fontSize: 14, fontWeight: 'bold' },
  prefRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#1a2332', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  prefLbl: { color: '#e2e8f0', fontSize: 13, textAlign: 'right', flex: 1 },
  prefSection: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8 },
  curPickRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#1a2332', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  curPickName: { color: '#e2e8f0', fontSize: 13, textAlign: 'right', flex: 1 },
  activityBox: { backgroundColor: '#0f2438', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#1f3a5f' },
  activityTitle: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  activityRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  activityIcon: { fontSize: 16, marginLeft: 8 },
  activityText: { color: '#e2e8f0', fontSize: 11, textAlign: 'right' },
  activityTime: { color: '#64748b', fontSize: 9, textAlign: 'right', marginTop: 2 },
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
  baseBox: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#d4af37' },
  baseLbl: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  baseHint: { color: '#cbd5e1', fontSize: 11, marginTop: 8, textAlign: 'right', fontStyle: 'italic' },
  rateCard: { backgroundColor: '#0f2438', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  rateCardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  rateCardTitle: { color: '#d4af37', fontSize: 13, fontWeight: 'bold' },
  rateCardCount: { color: '#94a3b8', fontSize: 10, backgroundColor: '#1a2332', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rateRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  rateVal: { color: '#00ff88', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' },
  rateBy: { color: '#94a3b8', fontSize: 10, marginTop: 2, textAlign: 'right' },
  rateItem: { backgroundColor: '#0f2438', borderRadius: 8, padding: 10, minWidth: 100, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  rateLbl: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
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
