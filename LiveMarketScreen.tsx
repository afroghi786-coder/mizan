// LiveMarketScreen.tsx — بازار زنده صرافان (Clean v2)
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import {
  initNetwork, loadNetSettings, saveNetSettings, getMyNetInfo,
  sendBroadcastHawala, claimHawala,
  sendFXOffer, claimFXOffer, deleteFXOffer, extendFXOffer,
  sendDirectHawala, acceptDirectHawala, deliverDirectHawala,
  listenOpenHawalas, listenFXOffers, listenMyHawalas,
  listenDirectInbox, listenMyGroups, listenDailyRates,
  listenNotifications, listenMyFXOffers,
  saveDailyRateWithBase, deleteMyRate,
  fetchPreferences, savePreferences,
  fetchAllNotifications, markAllRead,
  stopAllListeners, getAgents, NET_CITIES,
} from './lib.network';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

const FLAG: Record<string, string> = {
  AFN: '🇦🇫', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', PKR: '🇵🇰', AED: '🇦🇪',
  SAR: '🇸🇦', TRY: '🇹🇷', IRR: '🇮🇷', TOM: '🇮🇷', INR: '🇮🇳', CNY: '🇨🇳',
  JPY: '🇯🇵', CHF: '🇨🇭', CAD: '🇨🇦', AUD: '🇦🇺', KWD: '🇰🇼', QAR: '🇶🇦',
  OMR: '🇴🇲', BHD: '🇧🇭', JOD: '🇯🇴', IQD: '🇮🇶', MYR: '🇲🇾', RUB: '🇷🇺',
  TJS: '🇹🇯', UZS: '🇺🇿', TMT: '🇹🇲', KGS: '🇰🇬', KZT: '🇰🇿', AZN: '🇦🇿',
  HKD: '🇭🇰', SGD: '🇸🇬', THB: '🇹🇭', EGP: '🇪🇬', LYD: '🇱🇾', SYP: '🇸🇾',
  LBP: '🇱🇧', YER: '🇾🇪', ETB: '🇪🇹', NOK: '🇳🇴', SEK: '🇸🇪', DKK: '🇩🇰',
  NZD: '🇳🇿', ZAR: '🇿🇦',
};

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

const DASH_CURS_KEY = 'mz_dash_currencies';
const loadDashCurs = (): string[] => {
  try {
    const r = localStorage.getItem(DASH_CURS_KEY);
    if (r) { const a = JSON.parse(r); if (Array.isArray(a) && a.length) return a; }
  } catch {}
  return ['USD', 'EUR', 'PKR', 'AED', 'GBP'];
};
const saveDashCurs = (a: string[]) => { try { localStorage.setItem(DASH_CURS_KEY, JSON.stringify(a)); } catch {} };

const DEFAULT_PREFS = {
  notify_fx_claim: true, notify_hawala_claim: true, notify_direct: true,
  notify_fx_new: false, notify_hawala_new: false,
  notify_sound: true, notify_browser: true, notify_vibrate: true,
  watch_cities: ['KBL', 'HRT', 'MZR', 'KDH'],
  watch_currencies: ['USD', 'EUR'],
};

function calcRateStats(arr: any[], cur: string) {
  const items = arr.filter((r: any) => r.currency === cur);
  if (!items.length) return null;
  const nums = items.map((r: any) => Number(r.rate) || 0).filter((n) => n > 0);
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return { avg: sum / nums.length, high: Math.max(...nums), low: Math.min(...nums), count: nums.length, last: nums[0] };
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return diff + ' ثانیه پیش';
  if (diff < 3600) return Math.floor(diff / 60) + ' دقیقه پیش';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
  return Math.floor(diff / 86400) + ' روز پیش';
}

// ═══ صدا + لرزش + نوتیف مرورگر ═══
let _audioCtx: any = null;
function playSound() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!_audioCtx) _audioCtx = new AC();
    const ctx = _audioCtx;
    const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
    o1.connect(g1); g1.connect(ctx.destination);
    o1.frequency.value = 880; o1.type = 'sine';
    g1.gain.setValueAtTime(0.25, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o1.start(); o1.stop(ctx.currentTime + 0.3);
    setTimeout(() => {
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.frequency.value = 1320; o2.type = 'sine';
      g2.gain.setValueAtTime(0.25, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o2.start(); o2.stop(ctx.currentTime + 0.3);
    }, 180);
  } catch {}
}
function vibrate() {
  try { (navigator as any).vibrate?.([200, 100, 200]); } catch {}
}
function requestBrowserPerm() {
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
}
function showBrowserNotif(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'mz-' + Date.now() });
    }
  } catch {}
}

export default function LiveMarketScreen({ showToast }: any) {
  const [net, setNet] = useState<any>({ connected: false, email: '', name: '', city: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [fxOffers, setFxOffers] = useState<any[]>([]);
  const [myFXOffers, setMyFXOffers] = useState<any[]>([]);
  const [myHawalas, setMyHawalas] = useState<any[]>([]);
  const [directInbox, setDirectInbox] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [notifList, setNotifList] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());
  const [prefs, setPrefs] = useState<any>(DEFAULT_PREFS);
  const [myDashCurs, setMyDashCurs] = useState<string[]>(loadDashCurs());

  // modals
  const [settingsModal, setSettingsModal] = useState(false);
  const [hawalaModal, setHawalaModal] = useState(false);
  const [fxModal, setFxModal] = useState(false);
  const [directModal, setDirectModal] = useState(false);
  const [rateModal, setRateModal] = useState(false);
  const [dashCursModal, setDashCursModal] = useState(false);
  const [notifModal, setNotifModal] = useState(false);
  const [prefsModal, setPrefsModal] = useState(false);
  const [expiredOffer, setExpiredOffer] = useState<any>(null);

  const [saving, setSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', city: 'KBL', phone: '' });
  const [hawalaForm, setHawalaForm] = useState<any>({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
  const [fxForm, setFxForm] = useState<any>({ currency: 'USD', targetCurrency: 'AFN', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });
  const [directForm, setDirectForm] = useState<any>({ toEmail: '', toName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });
  const [rateForm, setRateForm] = useState<any>(() => { const o: any = {}; ALL_CURS.forEach((k) => (o[k] = '')); return o; });
  const [rateBase, setRateBase] = useState('AFN');

  const lastNotifIdRef = useRef<number>(0);
  const notifReadyRef = useRef<boolean>(false);
  const expiredShownRef = useRef<Set<string>>(new Set());

  // ═══ Refresh ═══
  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    await initNetwork();
    setNet(getMyNetInfo());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); return () => stopAllListeners(); }, [refresh]);

  // ═══ ساعت ═══
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ═══ بارگذاری prefs + notifList ═══
  useEffect(() => {
    if (!net.connected || !net.email) return;
    (async () => {
      try {
        const p = await fetchPreferences();
        setPrefs({ ...DEFAULT_PREFS, ...p });
        if (p.notify_browser) requestBrowserPerm();
      } catch {}
    })();
    const t = setInterval(async () => {
      try { setNotifList(await fetchAllNotifications()); } catch {}
    }, 5000);
    (async () => { try { setNotifList(await fetchAllNotifications()); } catch {} })();
    return () => clearInterval(t);
  }, [net.connected, net.email]);

  // ═══ listeners ═══
  useEffect(() => {
    if (!net.connected || !net.email) return;
    listenDirectInbox(setDirectInbox);
    listenMyGroups(setMyGroups);
    listenDailyRates(setRates);
    listenNotifications(setNotifList);
    listenMyFXOffers(setMyFXOffers);
    (async () => { setAgents(await getAgents()); })();
  }, [net.connected, net.email]);

  useEffect(() => {
    if (!net.connected || !net.city) return;
    listenOpenHawalas(net.city, setHawalas);
    listenFXOffers(setFxOffers);
    listenMyHawalas(setMyHawalas);
  }, [net.connected, net.city, net.email]);

  // ═══ تشخیص نوتیف جدید → صدا/لرزش/مرورگر ═══
  useEffect(() => {
    if (!notifList || !notifList.length) return;
    const newestId = Math.max(...notifList.map((n: any) => Number(n.id) || 0));
    if (!notifReadyRef.current) {
      lastNotifIdRef.current = newestId;
      notifReadyRef.current = true;
      return;
    }
    if (newestId > lastNotifIdRef.current) {
      const newOnes = notifList.filter((n: any) => (Number(n.id) || 0) > lastNotifIdRef.current && !n.is_read);
      lastNotifIdRef.current = newestId;
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
          hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency}`,
        };
        const msg = texts[n.type] || '🔔 اعلان جدید';
        if (prefs.notify_sound) playSound();
        if (prefs.notify_vibrate) vibrate();
        if (prefs.notify_browser) showBrowserNotif('میزان | MIZAN', msg);
        showToast?.(msg);
      }
    }
  }, [notifList, prefs.notify_sound, prefs.notify_vibrate, prefs.notify_browser, showToast]);

  // ═══ چک انقضای آگهی‌های من ═══
  useEffect(() => {
    if (!myFXOffers.length) return;
    const nowTs = Date.now();
    for (const o of myFXOffers) {
      if (o.status === 'open' && new Date(o.expires_at).getTime() < nowTs && !expiredShownRef.current.has(o.id)) {
        expiredShownRef.current.add(o.id);
        setExpiredOffer(o);
        break;
      }
    }
  }, [myFXOffers, now]);

  // ═══════════════════════════════════════════════════
  //  عملیات
  // ═══════════════════════════════════════════════════
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
    if (!net.connected) return showToast?.('❌ اتصال نیست', true);
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
      showToast?.('✅ ارسال شد');
      setHawalaForm({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitFX = async () => {
    if (!net.connected) return showToast?.('❌ اتصال نیست', true);
    if (!fxForm.amount) return showToast?.('مقدار الزامی', true);
    if (fxForm.rateType === 'fixed' && !fxForm.rate) return showToast?.('نرخ الزامی', true);
    setSaving(true);
    try {
      const id = 'FX-' + Date.now().toString(36).toUpperCase();
      await sendFXOffer({
        id, currency: fxForm.currency, targetCurrency: fxForm.targetCurrency,
        amount: Number(fxForm.amount), rateType: fxForm.rateType,
        rate: Number(fxForm.rate) || 0,
        expiresAt: Date.now() + (Number(fxForm.expires) || 10) * 60000, note: fxForm.note,
      });
      setFxModal(false);
      showToast?.('✅ آگهی ثبت شد');
      setFxForm({ currency: 'USD', targetCurrency: 'AFN', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitDirect = async () => {
    if (!net.connected) return showToast?.('❌ اتصال نیست', true);
    if (!directForm.toEmail) return showToast?.('مقصد انتخاب کن', true);
    if (!directForm.amount || !directForm.beneficiaryName) return showToast?.('مبلغ و نام الزامی', true);
    setSaving(true);
    try {
      const id = 'DH-' + Date.now().toString(36).toUpperCase();
      await sendDirectHawala({
        id, toEmail: directForm.toEmail, currency: directForm.currency,
        amount: Number(directForm.amount), beneficiaryName: directForm.beneficiaryName,
        beneficiaryPhone: directForm.beneficiaryPhone,
        commission: Number(directForm.commission) || 0, note: directForm.note,
      });
      setDirectModal(false);
      showToast?.('✅ ارسال شد');
      setDirectForm({ toEmail: '', toName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitRates = async () => {
    if (!net.connected) return showToast?.('❌ اتصال نیست', true);
    let count = 0;
    setSaving(true);
    try {
      for (const cur of ALL_CURS) {
        if (cur === rateBase) continue;
        const v = Number(rateForm[cur]);
        if (v > 0) { await saveDailyRateWithBase(cur, v, rateBase); count++; }
      }
      if (count === 0) { setSaving(false); return showToast?.('حداقل یک نرخ', true); }
      setRateModal(false);
      showToast?.('✅ ' + count + ' نرخ ثبت شد');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const doClaimH = async (id: string) => { try { const r = await claimHawala(id); showToast?.(r.success ? '✅ گرفتی' : '⚠️ ' + r.message, !r.success); } catch (e: any) { showToast?.('❌', true); } };
  const doClaimF = async (id: string) => { try { const r = await claimFXOffer(id); showToast?.(r.success ? '✅ گرفتی' : '⚠️ ' + r.message, !r.success); } catch (e: any) { showToast?.('❌', true); } };
  const doAcceptD = async (id: string) => { try { await acceptDirectHawala(id); showToast?.('✅ قبول'); } catch (e: any) { showToast?.('❌ ' + e.message, true); } };
  const doDeliverD = async (id: string) => { try { await deliverDirectHawala(id, net.email); showToast?.('✅ تحویل'); } catch (e: any) { showToast?.('❌ ' + e.message, true); } };
  const doDeleteFX = async (id: string) => { try { await deleteFXOffer(id); setMyFXOffers(await (await import('./lib.network')).fetchMyFXOffers()); showToast?.('🗑'); } catch (e: any) { showToast?.('❌', true); } };
  const doExtendFX = async (id: string, min: number) => { try { await extendFXOffer(id, Date.now() + min * 60000); showToast?.('✅ تمدید'); } catch (e: any) { showToast?.('❌ ' + e.message, true); } };

  const pendingDirect = directInbox.filter((h: any) => h.status === 'pending');
  const acceptedDirect = directInbox.filter((h: any) => h.status === 'accepted');
  const deliveredDirect = directInbox.filter((h: any) => h.status === 'delivered');
  const unreadCount = notifList.filter((n: any) => !n.is_read).length;

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <View>
      {/* ═══ وضعیت پروفایل ═══ */}
      <View style={[s.statusBox, net.connected && net.name ? s.statusOn : s.statusOff]}>
        <View style={s.statusDot} />
        <View style={{ flex: 1 }}>
          <Text style={s.statusTitle}>{net.connected && net.name ? `🟢 ${net.name}` : '🔴 پروفایل را کامل کنید'}</Text>
          <Text style={s.statusSub} numberOfLines={1}>{net.email || '—'} {net.city ? '| ' + (NET_CITIES[net.city] || net.city) : ''}</Text>
        </View>
        <TouchableOpacity style={[s.smBtn, unreadCount > 0 && { backgroundColor: '#dc2626' }]} onPress={() => setNotifModal(true)}>
          <Text style={s.smBtnTxt}>🔔 {unreadCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.smBtn} onPress={() => { setSettingsForm({ name: net.name || '', city: net.city || 'KBL', phone: net.phone || '' }); setSettingsModal(true); }}>
          <Text style={s.smBtnTxt}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.smBtn, { backgroundColor: 'rgba(16,185,129,0.4)' }]} onPress={() => setPrefsModal(true)}>
          <Text style={s.smBtnTxt}>🔧</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ داشبورد ═══ */}
      <View style={s.dash}>
        <View style={s.dashHeader}>
          <View>
            <Text style={s.dashTitle}>📡 بازار زنده</Text>
            <Text style={s.dashSub}>{net.name || '—'} | {NET_CITIES[net.city] || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.dashClock}>{String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}</Text>
            <Text style={s.dashDate}>{now.toLocaleDateString('fa-IR')}</Text>
          </View>
        </View>

        {rates.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {myDashCurs.filter((cur) => rates.some((r: any) => r.currency === cur)).map((cur) => {
              const stats = calcRateStats(rates, cur);
              if (!stats) return null;
              return (
                <View key={cur} style={s.tickerItem}>
                  <Text style={s.tickerCur}>{FLAG[cur] || '💱'} {cur}</Text>
                  <Text style={s.tickerVal}>{fmt(stats.last, 2)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {rates.length > 0 && (
          <View style={s.statsBox}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={s.statsBoxTitle}>📊 آمار لحظه‌ای</Text>
              <TouchableOpacity onPress={() => setDashCursModal(true)} style={{ backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>⚙️ تنظیم</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {myDashCurs.filter((cur) => rates.some((r: any) => r.currency === cur)).map((cur) => {
                const stats = calcRateStats(rates, cur);
                if (!stats) return null;
                return (
                  <View key={cur} style={s.statCard}>
                    <Text style={s.statCardCur}>{FLAG[cur]} {cur}</Text>
                    <View style={s.statRow}><Text style={s.statLbl}>📊 میانگین</Text><Text style={s.statValAvg}>{fmt(stats.avg, 2)}</Text></View>
                    <View style={s.statRow}><Text style={s.statLbl}>🔺 سقف</Text><Text style={s.statValHigh}>{fmt(stats.high, 2)}</Text></View>
                    <View style={s.statRow}><Text style={s.statLbl}>🔻 کف</Text><Text style={s.statValLow}>{fmt(stats.low, 2)}</Text></View>
                    <Text style={s.statCount}>{stats.count} صراف</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={s.marketStats}>
          <View style={s.marketStatItem}><Text style={s.marketStatIcon}>📈</Text><Text style={s.marketStatVal}>{rates.length}</Text><Text style={s.marketStatLbl}>نرخ</Text></View>
          <View style={s.marketStatItem}><Text style={s.marketStatIcon}>📤</Text><Text style={s.marketStatVal}>{hawalas.filter((h: any) => h.status === 'open').length}</Text><Text style={s.marketStatLbl}>حواله</Text></View>
          <View style={s.marketStatItem}><Text style={s.marketStatIcon}>💱</Text><Text style={s.marketStatVal}>{fxOffers.length}</Text><Text style={s.marketStatLbl}>آگهی</Text></View>
          <View style={s.marketStatItem}><Text style={s.marketStatIcon}>👥</Text><Text style={s.marketStatVal}>{agents.length + 1}</Text><Text style={s.marketStatLbl}>صراف</Text></View>
        </View>
      </View>

      {/* ═══ دکمه‌ها ═══ */}
      {net.connected && net.name ? (
        <View style={{ flexDirection: 'row-reverse', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#f59e0b' }]} onPress={() => setHawalaModal(true)}><Text style={s.actBtnTxt}>📤 حواله</Text></TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#7c3aed' }]} onPress={() => setFxModal(true)}><Text style={s.actBtnTxt}>💱 فروش ارز</Text></TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#0891b2' }]} onPress={async () => { setAgents(await getAgents()); setDirectModal(true); }}><Text style={s.actBtnTxt}>🔒 خصوصی</Text></TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#059669' }]} onPress={() => { const o: any = {}; ALL_CURS.forEach((k) => o[k] = ''); setRateForm(o); setRateModal(true); }}><Text style={s.actBtnTxt}>📈 نرخ</Text></TouchableOpacity>
        </View>
      ) : null}

      {/* ═══ نرخ روز ═══ */}
      <Text style={s.secT}>📈 نرخ روز ({rates.length})</Text>
      {rates.length === 0 ? <Text style={s.empty}>نرخی ثبت نشده</Text> : (() => {
        const byCur: Record<string, any[]> = {};
        rates.forEach((r: any) => { if (!byCur[r.currency]) byCur[r.currency] = []; byCur[r.currency].push(r); });
        return Object.keys(byCur).map((cur) => (
          <View key={cur} style={s.rateCard}>
            <View style={s.rateCardHead}><Text style={s.rateCardTitle}>{FLAG[cur] || '💱'} {cur}</Text><Text style={s.rateCardCount}>{byCur[cur].length} نرخ</Text></View>
            {byCur[cur].map((r: any, i: number) => {
              const isMine = r.by_email === net.email;
              return (
                <View key={i} style={s.rateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rateVal}>1 {cur} = {fmt(r.rate, 2)} {r.base_currency || 'AFN'}</Text>
                    <Text style={s.rateBy}>👤 {r.by_name} 🕐 {r.rate_time || new Date(r.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                  </View>
                  {isMine ? (
                    <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                      <Text style={{ fontSize: 9, color: '#fbbf24' }}>شما</Text>
                      <TouchableOpacity onPress={async () => { if (typeof window !== 'undefined' && !window.confirm('حذف؟')) return; await deleteMyRate(r.currency); showToast?.('🗑'); }} style={{ backgroundColor: '#7f1d1d', padding: 4, borderRadius: 4 }}><Text style={{ color: '#fca5a5', fontSize: 12 }}>🗑</Text></TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ));
      })()}

      {/* ═══ آگهی‌های من ═══ */}
      {myFXOffers.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#7c3aed' }]}>💼 آگهی‌های من ({myFXOffers.length})</Text>
          {myFXOffers.map((f: any) => {
            const isExpired = new Date(f.expires_at).getTime() < Date.now() && f.status === 'open';
            const isLocked = f.status === 'locked';
            const stColor = isLocked ? '#10b981' : isExpired ? '#dc2626' : '#f59e0b';
            const stTxt = isLocked ? '🔒 فروخته شد' : isExpired ? '⏰ منقضی' : '🟢 فعال';
            return (
              <View key={f.id} style={[s.card, { borderColor: stColor }]}>
                <Text style={s.cardTitle}>{FLAG[f.currency]} {fmt(f.amount)} {f.currency} → {FLAG[f.target_currency || 'AFN']} {f.target_currency || 'AFN'}</Text>
                <Text style={s.cardRow}>💹 {fmt(f.rate, 2)}</Text>
                <Text style={[s.cardRow, { color: stColor, fontWeight: 'bold' }]}>{stTxt} {f.claimed_by_name ? '— ' + f.claimed_by_name : ''}</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
                  {!isLocked && <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626', flex: 1 }]} onPress={() => doDeleteFX(f.id)}><Text style={s.btnTxt}>🗑 حذف</Text></TouchableOpacity>}
                  {isExpired && <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 1 }]} onPress={() => doExtendFX(f.id, 10)}><Text style={s.btnTxt}>⏱ +۱۰ دقیقه</Text></TouchableOpacity>}
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* ═══ حواله خصوصی ═══ */}
      {pendingDirect.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#0891b2' }]}>🔒 حواله خصوصی دریافتی ({pendingDirect.length})</Text>
          {pendingDirect.map((h: any) => (
            <View key={h.id} style={[s.card, { borderColor: '#0891b2' }]}>
              <Text style={s.cardTitle}>🔒 {h.from_name}</Text>
              <Text style={s.cardAmt}>{FLAG[h.currency]} {fmt(h.amount)} {h.currency}</Text>
              <Text style={s.cardRow}>👤 {h.beneficiary_name} | 📞 {h.beneficiary_phone || '—'}</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doAcceptD(h.id)}><Text style={s.btnTxt}>✅ قبول</Text></TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {acceptedDirect.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#f59e0b' }]}>🔄 در حال انجام ({acceptedDirect.length})</Text>
          {acceptedDirect.map((h: any) => (
            <View key={h.id} style={[s.card, { borderColor: '#f59e0b' }]}>
              <Text style={s.cardTitle}>🔄 {h.from_name}</Text>
              <Text style={s.cardAmt}>{FLAG[h.currency]} {fmt(h.amount)} {h.currency}</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => doDeliverD(h.id)}><Text style={s.btnTxt}>📦 تحویل دادم</Text></TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {deliveredDirect.length > 0 && (
        <>
          <Text style={[s.secT, { color: '#10b981' }]}>✅ تحویل داده شده ({deliveredDirect.length})</Text>
          {deliveredDirect.slice(0, 10).map((h: any) => (
            <View key={h.id} style={[s.card, { borderColor: '#10b981', backgroundColor: '#052e16' }]}>
              <Text style={s.cardTitle}>✅ {h.from_name} → {h.beneficiary_name}</Text>
              <Text style={s.cardAmt}>{FLAG[h.currency]} {fmt(h.amount)} {h.currency}</Text>
              <Text style={s.cardRow}>📅 {new Date(h.delivered_at || h.created_at).toLocaleString('fa-IR')}</Text>
            </View>
          ))}
        </>
      )}

      {/* ═══ حواله‌های عمومی ═══ */}
      <Text style={s.secT}>📥 حواله عمومی ({hawalas.filter((h: any) => h.status === 'open').length})</Text>
      {hawalas.filter((h: any) => h.status === 'open').length === 0 ? <Text style={s.empty}>حواله‌ای نیست</Text> : hawalas.filter((h: any) => h.status === 'open').map((h: any) => {
        const mine = h.from_email === net.email;
        return (
          <View key={h.id} style={s.card}>
            <Text style={s.cardTitle}>{h.from_name}</Text>
            <Text style={s.cardAmt}>{FLAG[h.currency]} {fmt(h.amount)} {h.currency}</Text>
            <Text style={s.cardRow}>👤 {h.beneficiary_name} | 📍 {NET_CITIES[h.target_city]}</Text>
            {!mine ? <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doClaimH(h.id)}><Text style={s.btnTxt}>⚡ قبول</Text></TouchableOpacity> : <Text style={[s.cardRow, { color: '#f59e0b' }]}>⏳ منتظر</Text>}
          </View>
        );
      })}

      {/* ═══ آگهی‌های دیگران ═══ */}
      <Text style={s.secT}>💱 آگهی‌های بازار ({fxOffers.length})</Text>
      {fxOffers.length === 0 ? <Text style={s.empty}>آگهی نیست</Text> : fxOffers.map((f: any) => (
        <View key={f.id} style={s.card}>
          <Text style={s.cardTitle}>{f.seller_name}</Text>
          <Text style={s.cardAmt}>{FLAG[f.currency]} {fmt(f.amount)} {f.currency} → {FLAG[f.target_currency || 'AFN']} {f.target_currency || 'AFN'}</Text>
          <Text style={s.cardRow}>💹 {fmt(f.rate, 4)} {f.rate_type === 'auction' ? '(حراج)' : ''}</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doClaimF(f.id)}><Text style={s.btnTxt}>💰 قبول</Text></TouchableOpacity>
        </View>
      ))}

      {/* ═══ مودال پروفایل ═══ */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>⚙️ پروفایل</Text><TouchableOpacity onPress={() => setSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ایمیل</Text>
            <TextInput style={[s.inp, { backgroundColor: '#0a1628', color: '#94a3b8' }]} value={net.email} editable={false} />
            <Text style={s.lbl}>نام صرافی *</Text>
            <TextInput style={s.inp} value={settingsForm.name} onChangeText={(v) => setSettingsForm({ ...settingsForm, name: v })} placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>شهر *</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map((k) => (
                <TouchableOpacity key={k} onPress={() => setSettingsForm({ ...settingsForm, city: k })} style={[s.chip, settingsForm.city === k && s.chipAct]}>
                  <Text style={[s.chipTxt, settingsForm.city === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>تلفن</Text>
            <TextInput style={s.inp} value={settingsForm.phone} onChangeText={(v) => setSettingsForm({ ...settingsForm, phone: v })} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setSettingsModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={saveSettings} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال تنظیمات نوتیف ═══ */}
      <Modal visible={prefsModal} transparent animationType="slide" onRequestClose={() => setPrefsModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}><Text style={s.mTitle}>🔧 تنظیمات نوتیفیکیشن</Text><TouchableOpacity onPress={() => setPrefsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14, maxHeight: 600 }}>
            <Text style={s.prefSection}>📥 نوتیف‌های مهم (پیشنهاد: روشن)</Text>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_fx_claim: !prefs.notify_fx_claim })} style={s.prefRow}>
              <Text style={s.prefLbl}>💱 یکی آگهی من رو قبول کنه</Text><Text style={{ fontSize: 20 }}>{prefs.notify_fx_claim ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_hawala_claim: !prefs.notify_hawala_claim })} style={s.prefRow}>
              <Text style={s.prefLbl}>📤 یکی حواله‌ام رو بگیره</Text><Text style={{ fontSize: 20 }}>{prefs.notify_hawala_claim ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_direct: !prefs.notify_direct })} style={s.prefRow}>
              <Text style={s.prefLbl}>🔒 حواله خصوصی دریافتی</Text><Text style={{ fontSize: 20 }}>{prefs.notify_direct ? '✅' : '⬜'}</Text>
            </TouchableOpacity>

            <Text style={s.prefSection}>📣 نوتیف‌های بازار (ممکنه زیاد بشه)</Text>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_fx_new: !prefs.notify_fx_new })} style={s.prefRow}>
              <Text style={s.prefLbl}>💱 کسی آگهی فروش ارز بذاره</Text><Text style={{ fontSize: 20 }}>{prefs.notify_fx_new ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_hawala_new: !prefs.notify_hawala_new })} style={s.prefRow}>
              <Text style={s.prefLbl}>📤 حواله جدید در شهر من</Text><Text style={{ fontSize: 20 }}>{prefs.notify_hawala_new ? '✅' : '⬜'}</Text>
            </TouchableOpacity>

            <Text style={s.prefSection}>🔊 صدا و هشدار</Text>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_sound: !prefs.notify_sound })} style={s.prefRow}>
              <Text style={s.prefLbl}>🔊 صدای هشدار</Text><Text style={{ fontSize: 20 }}>{prefs.notify_sound ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_browser: !prefs.notify_browser })} style={s.prefRow}>
              <Text style={s.prefLbl}>💬 نوتیف سیستم</Text><Text style={{ fontSize: 20 }}>{prefs.notify_browser ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrefs({ ...prefs, notify_vibrate: !prefs.notify_vibrate })} style={s.prefRow}>
              <Text style={s.prefLbl}>📳 لرزش موبایل</Text><Text style={{ fontSize: 20 }}>{prefs.notify_vibrate ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { playSound(); vibrate(); showBrowserNotif('میزان | تست', 'این یک تست است'); }} style={[s.btn, { backgroundColor: '#0891b2', marginTop: 8 }]}>
              <Text style={s.btnTxt}>🧪 تست صدا و هشدار</Text>
            </TouchableOpacity>

            <Text style={s.prefSection}>💰 ارزهای مورد علاقه</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'EUR', 'GBP', 'PKR', 'AED', 'AFN', 'IRR', 'TOM', 'TRY'].map((cur) => {
                const sel = (prefs.watch_currencies || []).includes(cur);
                return (
                  <TouchableOpacity key={cur} onPress={() => {
                    const arr = prefs.watch_currencies || [];
                    const next = sel ? arr.filter((x: string) => x !== cur) : [...arr, cur];
                    setPrefs({ ...prefs, watch_currencies: next });
                  }} style={[s.chip, sel && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                    <Text style={[s.chipTxt, sel && { color: '#fff' }]}>{FLAG[cur]} {cur}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.prefSection}>🏙️ شهرهای مورد علاقه</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map((k) => {
                const sel = (prefs.watch_cities || []).includes(k);
                return (
                  <TouchableOpacity key={k} onPress={() => {
                    const arr = prefs.watch_cities || [];
                    const next = sel ? arr.filter((x: string) => x !== k) : [...arr, k];
                    setPrefs({ ...prefs, watch_cities: next });
                  }} style={[s.chip, sel && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}>
                    <Text style={[s.chipTxt, sel && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setPrefsModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={async () => { try { if (prefs.notify_browser) requestBrowserPerm(); await savePreferences(prefs); showToast?.('✅ ذخیره'); setPrefsModal(false); } catch (e: any) { showToast?.('❌ ' + e.message, true); } }}>
                <Text style={s.btnTxt}>💾 ذخیره</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال نرخ روز ═══ */}
      <Modal visible={rateModal} transparent animationType="slide" onRequestClose={() => setRateModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#059669' }]}><Text style={s.mTitle}>📈 نرخ روز</Text><TouchableOpacity onPress={() => setRateModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14 }}>
            <View style={s.baseBox}>
              <Text style={s.baseLbl}>🎯 نرخ بر اساس:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ALL_CURS.map((b) => (
                  <TouchableOpacity key={b} onPress={() => setRateBase(b)} style={[s.chip, rateBase === b && { backgroundColor: '#d4af37', borderColor: '#d4af37' }]}>
                    <Text style={[s.chipTxt, rateBase === b && { color: '#000', fontWeight: 'bold' }]}>{FLAG[b]} {b}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.baseHint}>۱ واحد از هر ارز = ? {rateBase}</Text>
            </View>
            {ALL_CURS.filter((x) => x !== rateBase).map((c) => (
              <View key={c}>
                <Text style={s.lbl}>{FLAG[c]} {curLabel(c)}</Text>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <TextInput style={[s.inp, { flex: 1 }]} value={rateForm[c]} onChangeText={(v) => setRateForm({ ...rateForm, [c]: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
                  <Text style={{ color: '#94a3b8', fontSize: 11, minWidth: 50 }}>{rateBase}</Text>
                </View>
              </View>
            ))}
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setRateModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submitRates} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال فروش ارز ═══ */}
      <Modal visible={fxModal} transparent animationType="slide" onRequestClose={() => setFxModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}><Text style={s.mTitle}>💱 فروش ارز</Text><TouchableOpacity onPress={() => setFxModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ارز مبدأ (می‌فروشم)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {ALL_CURS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setFxForm({ ...fxForm, currency: c })} style={[s.chip, fxForm.currency === c && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}>
                  <Text style={[s.chipTxt, fxForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>ارز مقصد (می‌گیرم)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {ALL_CURS.filter((x) => x !== fxForm.currency).map((c) => (
                <TouchableOpacity key={c} onPress={() => setFxForm({ ...fxForm, targetCurrency: c })} style={[s.chip, fxForm.targetCurrency === c && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}>
                  <Text style={[s.chipTxt, fxForm.targetCurrency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={fxForm.amount} onChangeText={(v) => setFxForm({ ...fxForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نوع قیمت</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={[s.chip, fxForm.rateType === 'fixed' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]} onPress={() => setFxForm({ ...fxForm, rateType: 'fixed' })}><Text style={[s.chipTxt, fxForm.rateType === 'fixed' && { color: '#fff' }]}>💰 نرخ ثابت</Text></TouchableOpacity>
              <TouchableOpacity style={[s.chip, fxForm.rateType === 'auction' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]} onPress={() => setFxForm({ ...fxForm, rateType: 'auction' })}><Text style={[s.chipTxt, fxForm.rateType === 'auction' && { color: '#fff' }]}>📊 حراج</Text></TouchableOpacity>
            </View>
            {fxForm.rateType === 'fixed' && (<><Text style={s.lbl}>نرخ *</Text><TextInput style={s.inp} value={fxForm.rate} onChangeText={(v) => setFxForm({ ...fxForm, rate: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" /></>)}
            <Text style={s.lbl}>مهلت (دقیقه)</Text>
            <TextInput style={s.inp} value={fxForm.expires} onChangeText={(v) => setFxForm({ ...fxForm, expires: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setFxModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitFX} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💱 ثبت</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال حواله عمومی ═══ */}
      <Modal visible={hawalaModal} transparent animationType="slide" onRequestClose={() => setHawalaModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#f59e0b' }]}><Text style={s.mTitle}>📤 حواله عمومی</Text><TouchableOpacity onPress={() => setHawalaModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>شهر مقصد</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(NET_CITIES).map((k) => (
                <TouchableOpacity key={k} onPress={() => setHawalaForm({ ...hawalaForm, targetCity: k })} style={[s.chip, hawalaForm.targetCity === k && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}><Text style={[s.chipTxt, hawalaForm.targetCity === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>ارز</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {ALL_CURS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setHawalaForm({ ...hawalaForm, currency: c })} style={[s.chip, hawalaForm.currency === c && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}><Text style={[s.chipTxt, hawalaForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={hawalaForm.amount} onChangeText={(v) => setHawalaForm({ ...hawalaForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نام ذی‌نفع *</Text>
            <TextInput style={s.inp} value={hawalaForm.beneficiaryName} onChangeText={(v) => setHawalaForm({ ...hawalaForm, beneficiaryName: v })} placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>تلفن ذی‌نفع</Text>
            <TextInput style={s.inp} value={hawalaForm.beneficiaryPhone} onChangeText={(v) => setHawalaForm({ ...hawalaForm, beneficiaryPhone: v.replace(/[^\d]/g, '') })} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lbl}>حداکثر کارمزد %</Text><TextInput style={s.inp} value={hawalaForm.maxFee} onChangeText={(v) => setHawalaForm({ ...hawalaForm, maxFee: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" /></View>
              <View style={{ flex: 1 }}><Text style={s.lbl}>مهلت (دقیقه)</Text><TextInput style={s.inp} value={hawalaForm.expires} onChangeText={(v) => setHawalaForm({ ...hawalaForm, expires: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" /></View>
            </View>
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setHawalaModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#f59e0b', flex: 2 }]} onPress={submitHawala} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>📤 ارسال</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال حواله خصوصی ═══ */}
      <Modal visible={directModal} transparent animationType="slide" onRequestClose={() => setDirectModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#0891b2' }]}><Text style={s.mTitle}>🔒 حواله خصوصی</Text><TouchableOpacity onPress={() => setDirectModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>صراف مقصد * ({agents.length})</Text>
            {agents.length === 0 ? <Text style={s.empty}>صرافی آنلاین نیست</Text> : (
              <ScrollView style={{ maxHeight: 180 }}>
                {agents.map((a: any) => (
                  <TouchableOpacity key={a.email} onPress={() => setDirectForm({ ...directForm, toEmail: a.email, toName: a.name })} style={[s.agentRow, directForm.toEmail === a.email && { backgroundColor: '#0891b2' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.agentName, directForm.toEmail === a.email && { color: '#fff' }]}>{a.name}</Text>
                      <Text style={[s.agentEmail, directForm.toEmail === a.email && { color: '#a7f3d0' }]} numberOfLines={1}>{a.email}</Text>
                    </View>
                    <Text style={[s.agentCity, directForm.toEmail === a.email && { color: '#fff' }]}>{NET_CITIES[a.city] || a.city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={s.lbl}>ارز</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {ALL_CURS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setDirectForm({ ...directForm, currency: c })} style={[s.chip, directForm.currency === c && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}><Text style={[s.chipTxt, directForm.currency === c && { color: '#fff' }]}>{FLAG[c]} {c}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={directForm.amount} onChangeText={(v) => setDirectForm({ ...directForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نام ذی‌نفع *</Text>
            <TextInput style={s.inp} value={directForm.beneficiaryName} onChangeText={(v) => setDirectForm({ ...directForm, beneficiaryName: v })} placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>تلفن ذی‌نفع</Text>
            <TextInput style={s.inp} value={directForm.beneficiaryPhone} onChangeText={(v) => setDirectForm({ ...directForm, beneficiaryPhone: v.replace(/[^\d]/g, '') })} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>کارمزد</Text>
            <TextInput style={s.inp} value={directForm.commission} onChangeText={(v) => setDirectForm({ ...directForm, commission: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setDirectModal(false)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2', flex: 2 }]} onPress={submitDirect} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔒 ارسال</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال انتخاب ارزهای داشبورد ═══ */}
      <Modal visible={dashCursModal} transparent animationType="slide" onRequestClose={() => setDashCursModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}><Text style={s.mTitle}>⚙️ ارزهای داشبورد</Text><TouchableOpacity onPress={() => setDashCursModal(false)}><Text style={s.x}>×</Text></TouchableOpacity></View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            {ALL_CURS.map((cur) => {
              const sel = myDashCurs.includes(cur);
              return (
                <TouchableOpacity key={cur} onPress={() => { const next = sel ? myDashCurs.filter((x) => x !== cur) : [...myDashCurs, cur]; setMyDashCurs(next); saveDashCurs(next); }} style={[s.curPickRow, sel && { backgroundColor: '#7c3aed', borderColor: '#a78bfa' }]}>
                  <Text style={[s.curPickName, sel && { color: '#fff', fontWeight: 'bold' }]}>{FLAG[cur] || '💱'} {curLabel(cur)}</Text>
                  <Text style={{ fontSize: 16 }}>{sel ? '✅' : '⬜'}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 10 }}>
              <TouchableOpacity onPress={() => { setMyDashCurs([]); saveDashCurs([]); }} style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]}><Text style={s.btnTxt}>پاک</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { const d = ['USD', 'EUR', 'PKR', 'AED', 'GBP']; setMyDashCurs(d); saveDashCurs(d); }} style={[s.btn, { backgroundColor: '#0891b2', flex: 1 }]}><Text style={s.btnTxt}>پیش‌فرض</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setDashCursModal(false)} style={[s.btn, { backgroundColor: '#059669', flex: 2 }]}><Text style={s.btnTxt}>✅ تمام</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال نوتیف‌ها ═══ */}
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={() => setNotifModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#dc2626' }]}>
            <Text style={s.mTitle}>🔔 اعلان‌ها ({notifList.length})</Text>
            <TouchableOpacity onPress={async () => { try { await markAllRead(); setNotifList(await fetchAllNotifications()); showToast?.('✅ همه خوانده'); } catch {} }} style={{ marginLeft: 8, padding: 4 }}><Text style={{ color: '#fff', fontSize: 12 }}>✓</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setNotifModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14, maxHeight: 500 }}>
            {notifList.length === 0 ? <Text style={s.empty}>اعلانی نیست</Text> : notifList.map((n: any) => {
              const p = n.payload || {};
              const icons: any = { fx_taken: '💱', hawala_taken: '📤', direct_hawala: '🔒', direct_accepted: '✅', direct_delivered: '📦', group_invite: '🌐', group_join: '👥', fx_new: '💱', hawala_new: '📤' };
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
              return (
                <View key={n.id} style={{ backgroundColor: n.is_read ? '#1a2332' : '#1e3a5f', padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>{icons[n.type] || '🔔'} {texts[n.type] || n.type}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('fa-IR')}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ مودال انقضا ═══ */}
      <Modal visible={!!expiredOffer} transparent animationType="fade" onRequestClose={() => setExpiredOffer(null)}>
        <View style={s.mBg}><View style={[s.mBox, { maxWidth: 400 }]}>
          <View style={[s.mHead, { backgroundColor: '#dc2626' }]}><Text style={s.mTitle}>⏰ آگهی منقضی شد</Text></View>
          <View style={{ padding: 20 }}>
            <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>
              آگهی {expiredOffer?.currency} {fmt(expiredOffer?.amount)} منقضی شد
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <TouchableOpacity onPress={async () => { await doDeleteFX(expiredOffer.id); setExpiredOffer(null); }} style={[s.btn, { backgroundColor: '#dc2626', flex: 1 }]}><Text style={s.btnTxt}>🗑 حذف</Text></TouchableOpacity>
              <TouchableOpacity onPress={async () => { await doExtendFX(expiredOffer.id, 10); setExpiredOffer(null); }} style={[s.btn, { backgroundColor: '#059669', flex: 1 }]}><Text style={s.btnTxt}>⏱ +۱۰ دقیقه</Text></TouchableOpacity>
            </View>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  statusBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1 },
  statusOn: { backgroundColor: '#065f46', borderColor: '#10b981' },
  statusOff: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  statusTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  statusSub: { color: '#e2e8f0', fontSize: 10, marginTop: 2, textAlign: 'right', fontFamily: 'monospace' },
  smBtn: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, marginLeft: 3 },
  smBtnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  dash: { backgroundColor: '#0a1628', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 2, borderColor: '#1f3a5f' },
  dashHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#d4af37', marginBottom: 12 },
  dashTitle: { color: '#d4af37', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  dashSub: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' },
  dashClock: { color: '#00ff88', fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 2 },
  dashDate: { color: '#4ade80', fontSize: 10, marginTop: 2 },
  tickerItem: { backgroundColor: '#0f2438', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 6, minWidth: 90, alignItems: 'center', borderWidth: 1, borderColor: '#1f3a5f' },
  tickerCur: { color: '#d4af37', fontSize: 10, fontWeight: 'bold' },
  tickerVal: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', marginTop: 2 },
  statsBox: { backgroundColor: '#0f2438', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#1f3a5f' },
  statsBoxTitle: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  statCard: { backgroundColor: '#1a2332', borderRadius: 10, padding: 10, marginLeft: 8, minWidth: 130, borderWidth: 1, borderColor: '#334155' },
  statCardCur: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  statRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 3 },
  statLbl: { color: '#94a3b8', fontSize: 10 },
  statValAvg: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  statValHigh: { color: '#10b981', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  statValLow: { color: '#ef4444', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  statCount: { color: '#64748b', fontSize: 9, textAlign: 'center', marginTop: 6, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 4 },
  marketStats: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  marketStatItem: { flex: 1, backgroundColor: '#0f2438', borderRadius: 8, paddingVertical: 10, marginLeft: 4, alignItems: 'center', borderWidth: 1, borderColor: '#1f3a5f' },
  marketStatIcon: { fontSize: 14 },
  marketStatVal: { color: '#00ff88', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' },
  marketStatLbl: { color: '#94a3b8', fontSize: 9, marginTop: 2 },
  actBtn: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginLeft: 4, marginTop: 4, flex: 1, minWidth: 90, alignItems: 'center' },
  actBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  secT: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8 },
  rateCard: { backgroundColor: '#0f2438', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  rateCardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  rateCardTitle: { color: '#d4af37', fontSize: 13, fontWeight: 'bold' },
  rateCardCount: { color: '#94a3b8', fontSize: 10, backgroundColor: '#1a2332', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rateRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  rateVal: { color: '#00ff88', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' },
  rateBy: { color: '#94a3b8', fontSize: 10, marginTop: 2, textAlign: 'right' },
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
  curPickRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#1a2332', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  curPickName: { color: '#e2e8f0', fontSize: 13, textAlign: 'right', flex: 1 },
  prefRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#1a2332', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  prefLbl: { color: '#e2e8f0', fontSize: 13, textAlign: 'right', flex: 1 },
  prefSection: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  mHead: { backgroundColor: '#1e3a8a', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  x: { color: '#fff', fontSize: 24, marginLeft: 6 },
  lbl: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 4, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332', marginLeft: 4, marginTop: 4 },
  chipAct: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  rowBtns: { flexDirection: 'row-reverse', gap: 8, marginTop: 16 },
  baseBox: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#d4af37' },
  baseLbl: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  baseHint: { color: '#cbd5e1', fontSize: 11, marginTop: 8, textAlign: 'right', fontStyle: 'italic' },
});
