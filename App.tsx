// App.tsx — نسخه کامل میزان با همه قابلیت‌ها
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
  SafeAreaView, Switch,
} from 'react-native';
import { useFonts, Orbitron_900Black, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';

import {
  supabase, fmt, parseNum, toFaNum, pad2,
  getCalType, setCalType, loadCalType, saveCalType, CalType,
  parseDateAny, toStorageDate, toStorageDateFull, displayDate, displayDateOnly,
  jalaliDisplay, g2j, j2g,
  BANKS, SHIPPINGS, DASH_RANGE_LABELS,
  getProducts, createProduct, updateProduct, deleteProduct,
  lookupCustomerByPhone, generateCustomerCode, generateInvoiceNumber, createSale,
  getSalesGrouped, deleteSale, getUnpaidInvoices, searchAllInvoices, getInvoiceDetail,
  lookupSupplierByName, createPurchase, getPurchasesGrouped, deletePurchase,
  getDashboardStats, getInventory,
  getSettings, updateSettings,
  Product, SaleItem, PurchaseItem, Settings,
} from './lib';

// ══════════════════════════════════════════════════════════
//  Theme
// ══════════════════════════════════════════════════════════
let IS_DARK = true;
export const setDark = (d: boolean) => { IS_DARK = d; };

const C = {
  get bg()      { return IS_DARK ? '#0f2438' : '#f5f7fa'; },
  get card()    { return IS_DARK ? '#1a2332' : '#ffffff'; },
  get cardAlt() { return IS_DARK ? '#0a1628' : '#f8fafc'; },
  get text()    { return IS_DARK ? '#ffffff' : '#1a2332'; },
  get textMut() { return IS_DARK ? '#94a3b8' : '#64748b'; },
  get border()  { return IS_DARK ? '#334155' : '#e2e8f0'; },
  get input()   { return IS_DARK ? '#1a2332' : '#ffffff'; },
};

// ══════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const [fontsLoaded] = useFonts({ Orbitron_900Black, Orbitron_700Bold, ShareTechMono_400Regular });
  const fontsReady = Platform.OS === 'web' ? true : fontsLoaded;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    setDark(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const failsafe = setTimeout(() => setLoading(false), 5000);
    loadCalType().then(() => getSettings()).then((s: any) => {
      if (s?.theme === 'light' || s?.theme === 'dark') setTheme(s.theme);
    }).catch(() => {});
    supabase.auth.getSession()
      .then(({ data: { session } }) => { setSession(session); setLoading(false); clearTimeout(failsafe); })
      .catch(() => { setLoading(false); clearTimeout(failsafe); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { subscription.unsubscribe(); clearTimeout(failsafe); };
  }, []);

  if (!fontsReady || loading) return <View style={s.loading}><ActivityIndicator size="large" color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {!session ? <LoginScreen showToast={showToast} /> : <MainApp showToast={showToast} theme={theme} setTheme={setTheme} />}
      {toast && <View style={[s.toast, toast.error && { backgroundColor: '#b91c1c' }]}><Text style={s.toastTxt}>{toast.msg}</Text></View>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  Web alert helpers
// ══════════════════════════════════════════════════════════
const alertMsg = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(title + '\n\n' + msg);
  else Alert.alert(title, msg);
};
const confirmMsg = (title: string, msg: string): Promise<boolean> => {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(title + '\n\n' + msg));
  return new Promise((resolve) => {
    Alert.alert(title, msg, [
      { text: 'انصراف', style: 'cancel', onPress: () => resolve(false) },
      { text: 'تأیید', onPress: () => resolve(true) },
    ]);
  });
};

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════
function MainApp({ showToast, theme, setTheme }: any) {
  const [tab, setTab] = useState('order');
  const [pinOk, setPinOk] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({});

  const reloadSettings = useCallback(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setDark(newTheme === 'dark');
    if (settings) updateSettings({ ...settings, theme: newTheme }).catch(() => {});
  };

  const tabs = [
    { key: 'order', icon: '🛒', label: 'فروش', color: '#1e3a8a' },
    { key: 'purchase', icon: '🛍️', label: 'خرید', color: '#166534' },
    { key: 'print', icon: '🖨️', label: 'پرینت', color: '#6c3483' },
    { key: 'mgr', icon: '📋', label: 'مدیریت', color: '#c0392b' },
    { key: 'profit', icon: '💹', label: 'سود', color: '#065f46' },
    { key: 'inventory', icon: '📦', label: 'انبار', color: '#0f5132' },
  ];

  const requestTab = (t: string) => { if (t === 'order' || pinOk) { setTab(t); return; } setPendingTab(t); };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={[s.header, { backgroundColor: C.bg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.hTitle, { color: C.text }]}>⚖️ میزان</Text>
            <Text style={[s.hSub, { color: C.textMut }]}>حساب‌ها دقیق، معاملات امن، ذهن آسوده</Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={[s.themeBtn, { borderColor: '#d4af37' }]}>
            <Text style={{ fontSize: 20 }}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabsBar, { backgroundColor: C.card }]} contentContainerStyle={s.tabsCont}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => requestTab(t.key)} activeOpacity={0.7} style={[s.tab, tab === t.key && { backgroundColor: t.color, borderColor: '#d4af37' }]}>
            <Text style={s.tabIcon}>{t.icon}</Text>
            <Text style={[s.tabLbl, { color: C.textMut }, tab === t.key && s.tabLblActive]}>{t.label}</Text>
            {!pinOk && t.key !== 'order' && <Text style={s.lock}>🔒</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
      {tab === 'order' && <SalesScreen showToast={showToast} />}
      {tab === 'purchase' && <PurchaseScreen showToast={showToast} />}
      {tab === 'print' && <PrintScreen showToast={showToast} />}
      {tab === 'mgr' && <ManagementScreen showToast={showToast} settings={settings} setSettings={setSettings} reload={reloadSettings} />}
      {tab === 'profit' && <ProfitScreen showToast={showToast} settings={settings} />}
      {tab === 'inventory' && <InventoryScreen showToast={showToast} />}
      <PinModal visible={!!pendingTab} onClose={() => setPendingTab(null)} onSuccess={() => { setPinOk(true); if (pendingTab) setTab(pendingTab); setPendingTab(null); }} showToast={showToast} />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  PIN MODAL
// ══════════════════════════════════════════════════════════
function PinModal({ visible, onClose, onSuccess, showToast }: any) {
  const [pin, setPin] = useState('');
  useEffect(() => { if (visible) setPin(''); }, [visible]);
  const verify = () => {
    if (pin === '4242') { onSuccess(); showToast('✅ تأیید شد'); }
    else { showToast('❌ رمز اشتباه', true); setPin(''); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBg}><View style={[s.modalBox, { backgroundColor: C.card }]}>
        <View style={[s.modalHead, { backgroundColor: '#6c3483' }]}><Text style={s.modalHeadTxt}>🔒 رمز ورود</Text></View>
        <View style={{ padding: 20 }}>
          <Text style={[s.lbl, { color: C.textMut }]}>رمز را وارد کنید</Text>
          <TextInput style={s.pinInp} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" secureTextEntry placeholder="••••" placeholderTextColor="#64748b" />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onClose}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={verify}><Text style={s.btnTxt}>تأیید</Text></TouchableOpacity>
          </View>
        </View>
      </View></View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  AUTOCOMPLETE
// ══════════════════════════════════════════════════════════
function Autocomplete({ value, onChange, onSelect, options, placeholder, label }: any) {
  const [show, setShow] = useState(false);
  const filtered = useMemo(() => {
    const q = String(value || '').toLowerCase().trim();
    const list = q ? options.filter((x: string) => String(x).toLowerCase().includes(q)) : options;
    const seen = new Set<string>();
    return list.filter((x: string) => { if (seen.has(x)) return false; seen.add(x); return true; }).slice(0, 200);
  }, [value, options]);
  return (
    <View style={{ marginBottom: 8 }}>
      {label && <Text style={[s.lbl, { color: C.textMut }]}>{label}</Text>}
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={value} placeholder={placeholder || 'کلیک یا تایپ...'} placeholderTextColor={C.textMut} onChangeText={(v) => { onChange(v); setShow(true); }} onFocus={() => setShow(true)} />
      {show && filtered.length > 0 && (
        <View style={[s.acBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
          <Text style={s.acHdr}>📋 {filtered.length} مورد</Text>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {filtered.map((opt: string) => (
              <TouchableOpacity key={opt} style={[s.acItem, { borderBottomColor: C.border }]} onPress={() => { onChange(opt); setShow(false); if (onSelect) onSelect(opt); }}>
                <Text style={[s.acItemTxt, { color: C.text }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#475569', margin: 6 }]} onPress={() => setShow(false)}><Text style={s.btnTxt}>بستن</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  DATE FIELD
// ══════════════════════════════════════════════════════════
function DateField({ value, onChange, compact, defaultToToday }: any) {
  const [type, setType] = useState<CalType>(getCalType());
  const [g, setG] = useState<Date | null>(value ? parseDateAny(value) : (defaultToToday ? new Date() : null));
  const [fields, setFields] = useState({ y: '', m: '', d: '', h: '00', n: '00', s: '00' });

  useEffect(() => {
    if (!g) { setFields({ y: '', m: '', d: '', h: '00', n: '00', s: '00' }); return; }
    let y = 0, mo = 0, d = 0;
    if (type === 'jalali') { [y, mo, d] = g2j(g.getFullYear(), g.getMonth() + 1, g.getDate()); }
    else { y = g.getFullYear(); mo = g.getMonth() + 1; d = g.getDate(); }
    setFields({ y: String(y), m: pad2(mo), d: pad2(d), h: pad2(g.getHours()), n: pad2(g.getMinutes()), s: pad2(g.getSeconds()) });
  }, [g, type]);

  const apply = (f: any) => {
    setFields(f);
    const y = parseInt(f.y, 10), m = parseInt(f.m, 10), d = parseInt(f.d, 10);
    if (!y || !m || !d) { setG(null); onChange(''); return; }
    const h = parseInt(f.h, 10) || 0, n = parseInt(f.n, 10) || 0, sec = parseInt(f.s, 10) || 0;
    let gg: Date;
    if (type === 'jalali') { const r = j2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else { gg = new Date(y, m - 1, d, h, n, sec); }
    setG(gg); onChange(toStorageDateFull(gg));
  };

  const F = ({ v, k, w, ph }: any) => (
    <TextInput style={[s.dateInp, { width: w || 44, color: C.text }, compact && { fontSize: 11 }]} value={v} onChangeText={(t) => apply({ ...fields, [k]: t.replace(/\D/g, '').slice(0, k === 'y' ? 4 : 2) })} keyboardType="numeric" placeholder={ph} placeholderTextColor={C.textMut} />
  );

  return (
    <View style={[s.dateBox, { backgroundColor: C.input, borderColor: C.border }, compact && { paddingVertical: 3 }]}>
      <F v={fields.y} k="y" w={compact ? 52 : 60} ph="YYYY" />
      <Text style={[s.dateSep, { color: C.textMut }]}>/</Text><F v={fields.m} k="m" ph="MM" />
      <Text style={[s.dateSep, { color: C.textMut }]}>/</Text><F v={fields.d} k="d" ph="DD" />
      <Text style={[s.dateSep, { width: 8, color: C.textMut }]}> </Text>
      <F v={fields.h} k="h" ph="HH" />
      <Text style={[s.dateSep, { color: C.textMut }]}>:</Text><F v={fields.n} k="n" ph="MM" />
      <Text style={[s.dateSep, { color: C.textMut }]}>:</Text><F v={fields.s} k="s" ph="SS" />
      <TouchableOpacity style={[s.typeBtn, { backgroundColor: C.border }]} onPress={() => { const next = type === 'jalali' ? 'gregorian' : type === 'gregorian' ? 'hijri' : 'jalali'; setType(next); }}>
        <Text style={[s.typeBtnTxt, { color: C.text }]}>{type === 'jalali' ? 'شمسی' : type === 'gregorian' ? 'میلادی' : 'قمری'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  DIGITAL DASHBOARD
// ══════════════════════════════════════════════════════════
function DigitalDashboard({ refreshKey, settings }: any) {
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  const load = useCallback(async () => {
    try { setStats(await getDashboardStats(settings?.dashboard_range || 'month', settings?.dashboard_filter || 'both')); }
    catch {} finally { setLoading(false); }
  }, [settings]);

  useEffect(() => { load(); const r = setInterval(load, 30000); return () => clearInterval(r); }, [load, refreshKey]);

  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const date = jalaliDisplay(now);
  const profit = stats?.profit || 0;
  const filter = settings?.dashboard_filter || 'both';

  return (
    <View style={s.dash}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}><View style={s.rangeBadge}><Text style={s.rangeBadgeTxt}>{stats?.rangeLabel || 'ماه جاری'}</Text></View></View>
      <View style={s.clockRow}><Text style={s.time}>{time}</Text><Text style={s.dateTxt}>{date}</Text></View>
      <View style={s.profitBox}>
        <Text style={s.profitLbl}>💰 سود خالص</Text>
        <Text style={[s.profitVal, { color: profit < 0 ? '#ff3355' : profit === 0 ? '#fbbf24' : '#00ff88' }]}>{toFaNum(fmt(profit))}</Text>
        <Text style={s.profitUnit}>تومان</Text>
      </View>
      {loading ? <ActivityIndicator color="#00ff88" /> : (
        <View style={s.grid}>
          {filter !== 'purchase' && <DCard i="🛒" l="کل فروش" v={fmt(stats?.totalSales || 0)} c="#60a5fa" />}
          {filter !== 'sales' && <DCard i="📦" l="کل خرید" v={fmt(stats?.totalPurchases || 0)} c="#fb923c" />}
          {filter !== 'purchase' && <DCard i="💳" l="پرداخت مشتری" v={fmt(stats?.customerPaid || 0)} c="#34d399" />}
          {filter !== 'purchase' && <DCard i="📌" l="بدهی مشتری" v={fmt(stats?.customerDebt || 0)} c="#fb923c" />}
          {filter !== 'sales' && <DCard i="💵" l="پرداخت تأمین‌کننده" v={fmt(stats?.supplierPaid || 0)} c="#34d399" />}
          {filter !== 'sales' && <DCard i="📌" l="بدهی تأمین‌کننده" v={fmt(stats?.supplierDebt || 0)} c="#f87171" />}
        </View>
      )}
    </View>
  );
}
function DCard({ i, l, v, c }: any) {
  return (<View style={s.dItem}><Text style={s.dLbl}>{i} {l}</Text><Text style={[s.dVal, { color: c }]} numberOfLines={1}>{toFaNum(v)}</Text></View>);
}

// ══════════════════════════════════════════════════════════
//  SALES SCREEN
// ══════════════════════════════════════════════════════════
function SalesScreen({ showToast }: any) {
  const [view, setView] = useState<'list' | 'form' | 'invoice' | 'reprint'>('list');
  const [settings, setSettings] = useState<Settings>({});
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [prods, setProds] = useState<Product[]>([]);
  const [reprintInv, setReprintInv] = useState('');
  const [invoice, setInvoice] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [shipping, setShipping] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerStatus, setCustomerStatus] = useState('');

  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);
  const loadProds = async () => { try { setProds(await getProducts()); } catch {} };
  const load = async () => { setLoading(true); try { setList(await getSalesGrouped()); } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); } };
  useEffect(() => { load(); loadProds(); }, []);

  const onPhone = async (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    setPhone(d); setCustomerStatus('');
    if (d.length === 11) {
      setCustomerStatus('⏳');
      try {
        const f = await lookupCustomerByPhone(d);
        if (f) { setCustomerStatus('✅ قبلی'); if (f.customer_name && !name) setName(f.customer_name); if (f.customer_address && !address) setAddress(f.customer_address); }
        else setCustomerStatus('🆕 جدید');
      } catch { setCustomerStatus(''); }
    }
  };

  const addItem = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', description: '' }]);
  const updItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };
  const delItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const setModel = (i: number, v: string) => { const n = [...items]; n[i].modelName = v; const p = prods.find((x) => x.name === v); if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; if (p.shipping_name && !shipping) setShipping(p.shipping_name); } setItems(n); };

  const grandTotal = items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);
  const grandQty = items.reduce((a, it) => a + (Number(it.quantity) || 0), 0);

  const submit = async () => {
    if (!/^09\d{9}$/.test(phone)) return alertMsg('⚠️ خطا', 'شماره معتبر نیست');
    if (!name || name.length < 2) return alertMsg('⚠️ خطا', 'نام الزامی است');
    if (!shipping) return alertMsg('⚠️ خطا', 'باربری الزامی است');
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    if (!valid.length) return alertMsg('⚠️ خطا', 'حداقل یک مدل وارد کن');
    for (const v of valid) if (!v.priceUnit) return alertMsg('⚠️ خطا', `قیمت «${v.modelName}» را وارد کن`);
    const total = valid.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);
    const ok = await confirmMsg('📋 تأیید فروش', `👤 ${name}\n📞 ${phone}\n📦 ${valid.length} مدل\n💰 ${fmt(total)} تومان\n\nثبت شود؟`);
    if (!ok) return;
    setSaving(true);
    try {
      let customerCode = '';
      const found = await lookupCustomerByPhone(phone);
      if (found?.customer_code && /^M_\d+$/.test(found.customer_code)) customerCode = found.customer_code;
      else customerCode = await generateCustomerCode();
      const inv = await generateInvoiceNumber();
      await createSale({ invoiceNumber: inv, customerCode, customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid });
      alertMsg('✅ موفق', 'فاکتور فروش ثبت شد:\n' + inv);
      setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setView('list'); load();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const remove = async (inv: string) => {
    const ok = await confirmMsg('حذف', `فاکتور ${inv} حذف شود؟`);
    if (!ok) return;
    try { await deleteSale(inv); load(); showToast('✅ حذف شد'); } catch (e: any) { showToast(e.message, true); }
  };

  const doReprint = async () => {
    if (!reprintInv.trim()) return showToast('شماره فاکتور را وارد کن', true);
    try {
      const rows = await getInvoiceDetail(reprintInv.trim());
      if (!rows.length) return showToast('فاکتور پیدا نشد', true);
      const r = rows[0];
      const its = rows.map((x: any) => ({ modelName: x.model_name, modelCode: x.model_code, quantity: x.quantity, priceUnit: x.price_unit, total: x.quantity * x.price_unit }));
      const total = its.reduce((a: number, it: any) => a + it.total, 0);
      setInvoice({ customer: { code: r.customer_code, name: r.customer_name, phone: r.customer_phone, address: r.customer_address, shipping: r.shipping }, current: { invoiceNumber: r.invoice_number, items: its, sales: total, payments: 0, balance: total }, previous: { sales: 0, payments: 0, balance: 0, invoiceCount: 0 }, totals: { sales: total, payments: 0, balance: total }, timeString: displayDate(r.date_reg) });
      setView('invoice');
    } catch (e: any) { showToast(e.message, true); }
  };

  if (view === 'invoice' && invoice) return <InvoiceView invoice={invoice} onBack={() => { setView('list'); setInvoice(null); }} showToast={showToast} onNew={() => { setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setView('form'); }} />;

  if (view === 'reprint') return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12 }}>
      <Text style={s.formTitle}>🖨️ پرینت مجدد فاکتور</Text>
      <Text style={[s.lbl, { color: C.textMut }]}>شماره فاکتور</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={reprintInv} onChangeText={setReprintInv} placeholder="مثلاً 241007-1001" placeholderTextColor={C.textMut} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#6c3483' }]} onPress={doReprint}><Text style={s.btnTxt}>🔍 نمایش فاکتور</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (view === 'form') return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formTitle}>🛒 فاکتور فروش جدید</Text>
        <Text style={[s.lbl, { color: C.textMut }]}>📞 تلفن * {customerStatus}</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={phone} onChangeText={onPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor={C.textMut} />
        <Text style={[s.lbl, { color: C.textMut }]}>👤 نام *</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={name} onChangeText={setName} placeholder="نام مشتری" placeholderTextColor={C.textMut} />
        <Text style={[s.lbl, { color: C.textMut }]}>📍 آدرس</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={address} onChangeText={setAddress} placeholder="اختیاری" placeholderTextColor={C.textMut} />
        <Autocomplete label="🚚 باربری *" value={shipping} onChange={setShipping} options={[...new Set([...SHIPPINGS, ...prods.map(p => p.shipping_name || '').filter(Boolean)])]} placeholder="تایپ یا انتخاب..." />

        <Text style={s.secT}>📦 اقلام فروش ({toFaNum(items.length)})</Text>
        {items.map((it, i) => {
          const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
          const lineBalance = lineTotal - (Number(it.payment) || 0);
          return (
            <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
                <TouchableOpacity onPress={() => delItem(i)} style={s.delBtnRound}><Text style={{ fontSize: 14, color: '#fff' }}>🗑</Text></TouchableOpacity>
              </View>
              <Autocomplete label="نام مدل *" value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="کلیک یا تایپ..." />
              <Text style={[s.lblS, { color: C.textMut }]}>کد مدل</Text>
              <View style={[s.readonlyBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={s.readonlyTxt}>{it.modelCode || '—'}</Text></View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>تعداد *</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} /></View>
                <View style={{ flex: 1.3 }}><Text style={[s.lblS, { color: C.textMut }]}>قیمت *</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} /></View>
                <View style={{ flex: 1.3 }}><Text style={[s.lblS, { color: C.textMut }]}>پرداخت</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.payment || '')} onChangeText={(v) => updItem(i, 'payment', parseNum(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>💰 مبلغ کل</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={s.autoCalcTxt}>{lineTotal ? toFaNum(fmt(lineTotal)) : '—'}</Text></View></View>
                <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>⚖️ مانده</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: lineBalance > 0 ? '#dc2626' : lineBalance < 0 ? '#059669' : C.border }]}><Text style={[s.autoCalcTxt, { color: lineBalance > 0 ? '#dc2626' : lineBalance < 0 ? '#059669' : '#94a3b8' }]}>{lineTotal ? toFaNum(fmt(lineBalance)) : '—'}</Text></View></View>
              </View>
              <Text style={[s.lblS, { color: C.textMut }]}>📅 تاریخ واریز</Text>
              <DateField value={it.depositDate} onChange={(v: string) => updItem(i, 'depositDate', v)} compact />
              <Autocomplete label="🏦 بانک" value={it.bankName} onChange={(v) => updItem(i, 'bankName', v)} options={BANKS} placeholder="کلیک..." />
              <Autocomplete label="👤 صاحب حساب" value={it.accountHolder} onChange={(v) => updItem(i, 'accountHolder', v)} options={prods.map(p => p.supplier_name || '').filter(Boolean)} placeholder="کلیک..." />
              <Text style={[s.lblS, { color: C.textMut }]}>📝 شرح</Text>
              <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor={C.textMut} />
            </View>
          );
        })}
        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.btnTxt}>➕ افزودن مدل</Text></TouchableOpacity>
        <View style={s.grandSummary}>
          <View style={{ flex: 1 }}><Text style={s.gsLbl}>💰 جمع مبلغ کل</Text><Text style={s.gsVal}>{toFaNum(fmt(grandTotal))}</Text></View>
          <View style={{ alignItems: 'center' }}><Text style={s.gsLbl}>📦 تعداد اقلام</Text><Text style={s.gsQty}>{toFaNum(grandQty)}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت نهایی فروش</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <DigitalDashboard refreshKey={0} settings={settings} />
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
        <TouchableOpacity style={[s.addBtn, { flex: 1, backgroundColor: '#1e3a8a' }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}><Text style={s.btnTxt}>➕ فاکتور جدید</Text></TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { flex: 1, backgroundColor: '#6c3483' }]} onPress={() => setView('reprint')}><Text style={s.btnTxt}>🖨️ پرینت مجدد</Text></TouchableOpacity>
      </View>
      <Text style={s.secT}>📄 فاکتورها ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((inv: any) => (
        <View key={inv.invoice} style={[s.invCard, { backgroundColor: C.card }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={s.invNum}>{inv.invoice}</Text>
            <TouchableOpacity onPress={() => remove(inv.invoice)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
          <Text style={s.invCust}>👤 {inv.name} — {inv.phone}</Text>
          <Text style={s.invStat}>💰 {toFaNum(fmt(inv.total))} | 💳 {toFaNum(fmt(inv.paid))}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  PURCHASE SCREEN
// ══════════════════════════════════════════════════════════
function PurchaseScreen({ showToast }: any) {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [list, setList] = useState<any[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [sName, setSName] = useState('');
  const [sCode, setSCode] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [manualInv, setManualInv] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [payAmt, setPayAmt] = useState('');
  const [payDate, setPayDate] = useState(toStorageDateFull(new Date()));
  const [bankAcc, setBankAcc] = useState('');
  const [payerName, setPayerName] = useState('');
  const [receiverAcc, setReceiverAcc] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);
  const load = async () => { setLoading(true); try { setList(await getPurchasesGrouped()); } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); } };
  const loadProds = async () => { try { setProds(await getProducts()); } catch {} };
  useEffect(() => { load(); loadProds(); }, []);

  const addItem = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, description: '' }]);
  const updItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };
  const delItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const setModel = (i: number, v: string) => {
    const n = [...items]; n[i].modelName = v;
    const p = prods.find((x) => x.name === v);
    if (p) {
      n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0;
      if (!sName && p.supplier_name) setSName(p.supplier_name);
      if (!sPhone && p.supplier_phone) setSPhone(p.supplier_phone);
      if (!sCode && p.supplier_code) setSCode(p.supplier_code);
    }
    setItems(n);
  };
  const onSupplierPick = async (v: string) => {
    setSName(v);
    try { const f = await lookupSupplierByName(v); if (f) { if (f.supplier_code && !sCode) setSCode(f.supplier_code); if (f.supplier_phone && !sPhone) setSPhone(f.supplier_phone); } } catch {}
  };

  const grandTotal = items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);
  const grandQty = items.reduce((a, it) => a + (Number(it.quantity) || 0), 0);
  const paidAmt = parseNum(payAmt);
  const remaining = grandTotal - paidAmt;

  const submit = async () => {
    if (!sName || sName.length < 2) return alertMsg('⚠️ خطا', 'نام تأمین‌کننده الزامی است');
    if (!manualInv) return alertMsg('⚠️ خطا', 'شماره فاکتور دستی الزامی است');
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    const amt = parseNum(payAmt);
    if (!valid.length && amt <= 0) return alertMsg('⚠️ خطا', 'حداقل یک مدل یا مبلغ پرداخت وارد کن');
    const total = valid.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);
    const ok = await confirmMsg('📋 تأیید خرید', `🏭 ${sName}\n🧾 ${manualInv}\n📦 ${valid.length} مدل\n💰 ${fmt(total)} تومان\n💵 پرداخت: ${fmt(amt)}\n\nثبت شود؟`);
    if (!ok) return;
    setSaving(true);
    try {
      const inv = await generateInvoiceNumber();
      await createPurchase({ invoiceNumber: inv, manualInvoice: manualInv, supplierName: sName, supplierCode: sCode, supplierPhone: sPhone, items: valid, paymentAmount: amt, paymentDate: payDate, bankAccount: bankAcc, payerName, receiverAccount: receiverAcc, note });
      alertMsg('✅ موفق', 'فاکتور خرید ثبت شد:\n' + inv);
      setSName(''); setSCode(''); setSPhone(''); setManualInv(''); setItems([]);
      setPayAmt(''); setBankAcc(''); setPayerName(''); setReceiverAcc(''); setNote('');
      setView('list'); load();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };

  if (view === 'form') return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formTitle}>🛍️ فاکتور خرید</Text>
        <Autocomplete label="🏭 نام تأمین‌کننده *" value={sName} onChange={setSName} onSelect={onSupplierPick} options={[...new Set([...prods.map(p => p.supplier_name || '').filter(Boolean)])]} placeholder="تایپ یا انتخاب..." />
        <Text style={[s.lbl, { color: C.textMut }]}>🆔 کد تأمین‌کننده</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={sCode} onChangeText={setSCode} placeholder="خودکار" placeholderTextColor={C.textMut} />
        <Text style={[s.lbl, { color: C.textMut }]}>📞 تلفن</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={sPhone} onChangeText={setSPhone} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor={C.textMut} />
        <Text style={[s.lbl, { color: C.textMut }]}>🧾 شماره فاکتور دستی *</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={manualInv} onChangeText={setManualInv} placeholder="شماره روی فاکتور" placeholderTextColor={C.textMut} />
        <Text style={s.secT}>📦 اقلام خرید ({toFaNum(items.length)})</Text>
        {items.map((it, i) => {
          const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
          return (
            <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
                <TouchableOpacity onPress={() => delItem(i)} style={s.delBtnRound}><Text style={{ fontSize: 14, color: '#fff' }}>🗑</Text></TouchableOpacity>
              </View>
              <Autocomplete label="نام مدل" value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="کلیک..." />
              <Text style={[s.lblS, { color: C.textMut }]}>کد مدل</Text>
              <View style={[s.readonlyBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={s.readonlyTxt}>{it.modelCode || '—'}</Text></View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>تعداد</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} /></View>
                <View style={{ flex: 1.3 }}><Text style={[s.lblS, { color: C.textMut }]}>قیمت خرید</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} /></View>
              </View>
              <View style={{ marginTop: 8 }}><Text style={[s.lblS, { color: C.textMut }]}>💰 مبلغ کل</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={s.autoCalcTxt}>{lineTotal ? toFaNum(fmt(lineTotal)) : '—'}</Text></View></View>
              <Text style={[s.lblS, { color: C.textMut }]}>📝 شرح</Text>
              <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor={C.textMut} />
            </View>
          );
        })}
        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.btnTxt}>➕ افزودن مدل</Text></TouchableOpacity>
        <View style={s.grandSummary}>
          <View style={{ flex: 1 }}><Text style={s.gsLbl}>💰 جمع مبلغ کل</Text><Text style={s.gsVal}>{toFaNum(fmt(grandTotal))}</Text></View>
          <View style={{ alignItems: 'center' }}><Text style={s.gsLbl}>📦 تعداد اقلام</Text><Text style={s.gsQty}>{toFaNum(grandQty)}</Text></View>
        </View>
        <Text style={s.secT}>💳 اطلاعات پرداخت</Text>
        <Text style={[s.lbl, { color: C.textMut }]}>مبلغ پرداخت نقدی</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={payAmt} onChangeText={setPayAmt} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>💵 پرداخت</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: '#059669' }]}><Text style={[s.autoCalcTxt, { color: '#059669' }]}>{paidAmt ? toFaNum(fmt(paidAmt)) : '—'}</Text></View></View>
          <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>📌 مانده</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: remaining > 0 ? '#dc2626' : '#059669' }]}><Text style={[s.autoCalcTxt, { color: remaining > 0 ? '#dc2626' : '#059669' }]}>{grandTotal ? toFaNum(fmt(remaining)) : '—'}</Text></View></View>
        </View>
        <Text style={[s.lbl, { color: C.textMut }]}>📅 تاریخ پرداخت</Text>
        <DateField value={payDate} onChange={setPayDate} compact defaultToToday />
        <Text style={[s.lbl, { color: C.textMut }]}>🏦 حساب پرداخت‌کننده</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={bankAcc} onChangeText={setBankAcc} placeholder="اختیاری" placeholderTextColor={C.textMut} />
        <Autocomplete label="👤 نام پرداخت‌کننده" value={payerName} onChange={setPayerName} options={prods.map(p => p.payer_name || '').filter(Boolean)} placeholder="کلیک..." />
        <Text style={[s.lbl, { color: C.textMut }]}>🏦 حساب دریافت‌کننده</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={receiverAcc} onChangeText={setReceiverAcc} placeholder="اختیاری" placeholderTextColor={C.textMut} />
        <Text style={[s.lbl, { color: C.textMut }]}>📝 شرح</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border, minHeight: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} multiline placeholder="توضیحات..." placeholderTextColor={C.textMut} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#166534' }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت نهایی خرید</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <DigitalDashboard refreshKey={0} settings={settings} />
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#166534', marginTop: 8 }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}><Text style={s.btnTxt}>➕ فاکتور خرید جدید</Text></TouchableOpacity>
      <Text style={s.secT}>📄 خریدها ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#34d399" /> : list.map((inv: any) => (
        <View key={inv.invoice} style={[s.invCard, { backgroundColor: C.card, borderRightColor: '#166534' }]}>
          <Text style={s.invNum}>{inv.invoice}</Text>
          <Text style={s.invCust}>🏭 {inv.name}</Text>
          <Text style={s.invStat}>💰 {toFaNum(fmt(inv.total))} | 💳 {toFaNum(fmt(inv.paid))}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  PRINT SCREEN
// ══════════════════════════════════════════════════════════
function PrintScreen({ showToast }: any) {
  const [code, setCode] = useState('');
  const [report, setReport] = useState<any>(null);
  const [mode, setMode] = useState<'none' | 'summary' | 'full'>('none');
  const [loading, setLoading] = useState(false);

  const loadReport = async (m: 'summary' | 'full') => {
    if (!code.trim()) return showToast('کد را وارد کن', true);
    setLoading(true);
    try {
      const { data: saleRows } = await supabase.from('sales').select('*').eq('customer_code', code.trim());
      if (!saleRows?.length) {
        const { data: pData } = await supabase.from('purchases').select('*').eq('supplier_code', code.trim());
        if (!pData?.length) { showToast('داده‌ای یافت نشد', true); return; }
        const grouped: any = {};
        pData.forEach((r: any) => {
          if (!grouped[r.invoice_number]) grouped[r.invoice_number] = { invoice: r.invoice_number, date: r.date_factor, name: r.supplier_name, total: 0, paid: 0, items: [] };
          grouped[r.invoice_number].total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
          grouped[r.invoice_number].paid += Number(r.payment) || 0;
          grouped[r.invoice_number].items.push({ modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, total: r.quantity * r.price_unit });
        });
        const rows = Object.values(grouped);
        const totals = rows.reduce((a: any, r: any) => ({ sales: a.sales + r.total, payments: a.payments + r.paid }), { sales: 0, payments: 0 });
        setReport({ type: 'تأمین‌کننده', name: pData[0].supplier_name, code: code.trim(), rows, totals });
        setMode(m); return;
      }
      const grouped: any = {};
      saleRows.forEach((r: any) => {
        if (!grouped[r.invoice_number]) grouped[r.invoice_number] = { invoice: r.invoice_number, date: r.date_factor, name: r.customer_name, total: 0, paid: 0, items: [] };
        grouped[r.invoice_number].total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
        grouped[r.invoice_number].paid += Number(r.payment) || 0;
        grouped[r.invoice_number].items.push({ modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, total: r.quantity * r.price_unit });
      });
      const rows = Object.values(grouped);
      const totals = rows.reduce((a: any, r: any) => ({ sales: a.sales + r.total, payments: a.payments + r.paid }), { sales: 0, payments: 0 });
      setReport({ type: 'مشتری', name: saleRows[0].customer_name, code: code.trim(), rows, totals });
      setMode(m);
    } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    if (!report) return;
    try {
      const ws = XLSX.utils.json_to_sheet(report.rows.map((r: any, i: number) => ({ '#': i + 1, 'تاریخ': displayDateOnly(r.date), 'فاکتور': r.invoice, 'نام': r.name, 'جمع': r.total, 'پرداخت': r.paid, 'مانده': r.total - r.paid })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'گزارش');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const path = (FileSystem as any).cacheDirectory + `report-${code}-${Date.now()}.xlsx`;
      await FileSystem.writeAsStringAsync(path, wbout, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      showToast('✅ فایل اکسل آماده شد');
    } catch (e: any) { showToast(e.message, true); }
  };

  const exportPDF = async () => {
    if (!report) return;
    try {
      const html = `<html dir="rtl"><body style="font-family:Tahoma"><h1>گزارش ${report.type}</h1><h3>${report.name} — ${report.code}</h3><table border="1" cellpadding="6" style="width:100%;border-collapse:collapse"><tr style="background:#333;color:#fff"><th>#</th><th>تاریخ</th><th>فاکتور</th><th>جمع</th><th>پرداخت</th><th>مانده</th></tr>${report.rows.map((r: any, i: number) => `<tr><td>${i + 1}</td><td>${displayDateOnly(r.date)}</td><td>${r.invoice}</td><td>${fmt(r.total)}</td><td>${fmt(r.paid)}</td><td>${fmt(r.total - r.paid)}</td></tr>`).join('')}</table></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      showToast('✅ PDF آماده شد');
    } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={s.formTitle}>🖨️ پرینت حساب</Text>
      <Text style={[s.lbl, { color: C.textMut }]}>کد طرف حساب</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={code} onChangeText={setCode} placeholder="M_1001" placeholderTextColor={C.textMut} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#6c3483' }]} onPress={() => loadReport('summary')} disabled={loading}><Text style={s.btnTxt}>🟣 خلاصه مالی</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={() => loadReport('full')} disabled={loading}><Text style={s.btnTxt}>🟢 جامع</Text></TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} />}
      {report && mode !== 'none' && (
        <View style={{ marginTop: 16 }}>
          <View style={s.statsCard}>
            <Text style={s.statsLbl}>👤 {report.name} — {report.type}</Text>
            <Text style={s.statsLbl}>🆔 {report.code}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Text style={s.rptBadge}>جمع: {fmt(report.totals.sales)}</Text>
              <Text style={s.rptBadge}>پرداخت: {fmt(report.totals.payments)}</Text>
              <Text style={[s.rptBadge, { backgroundColor: report.totals.sales - report.totals.payments > 0 ? '#fee2e2' : '#d1fae5', color: report.totals.sales - report.totals.payments > 0 ? '#991b1b' : '#065f46' }]}>مانده: {fmt(report.totals.sales - report.totals.payments)}</Text>
            </View>
          </View>
          {report.rows.map((r: any, i: number) => (
            <View key={i} style={[s.invCard, { backgroundColor: C.card }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={s.invNum}>{r.invoice}</Text>
                <Text style={{ color: C.textMut, fontSize: 11 }}>{displayDateOnly(r.date)}</Text>
              </View>
              {mode === 'full' && r.items?.map((it: any, j: number) => (<Text key={j} style={s.itemRow}>📦 {it.modelName} — {toFaNum(it.quantity)} × {toFaNum(fmt(it.priceUnit))}</Text>))}
              <Text style={s.invStat}>💰 {toFaNum(fmt(r.total))} | 💳 {toFaNum(fmt(r.paid))} | 📌 {toFaNum(fmt(r.total - r.paid))}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#c0392b' }]} onPress={exportExcel}><Text style={s.btnTxt}>📥 اکسل</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#8e44ad' }]} onPress={exportPDF}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
// ══════════════════════════════════════════════════════════
//  PROFIT SCREEN
// ══════════════════════════════════════════════════════════
function ProfitScreen({ showToast, settings }: any) {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try { const d = await getDashboardStats(settings?.dashboard_range || 'month', settings?.dashboard_filter || 'both'); setModels(d.models); setStats(d); }
    catch (e: any) { showToast(e.message, true); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [settings]);

  const total = models.reduce((a, m) => a + (m.totalProfit || 0), 0);

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <DigitalDashboard refreshKey={0} settings={settings} />
      <View style={[s.statsCard, { marginTop: 8 }]}>
        <Text style={s.statsLbl}>💰 سود کل ({stats?.rangeLabel || 'ماه'})</Text>
        <Text style={[s.statsVal, { color: total >= 0 ? '#00ff88' : '#ff3355' }]}>{toFaNum(fmt(total))}</Text>
        <Text style={s.statsUnit}>تومان</Text>
      </View>
      {stats?.estimatedCount > 0 && (<View style={s.warnBox}><Text style={s.warnTxt}>📊 {stats.estimatedCount} مدل بدون خرید — سود {Math.round((stats.defaultMargin || 0.1) * 100)}٪ تخمین زده شد</Text></View>)}
      <Text style={s.secT}>💹 سود به تفکیک مدل ({toFaNum(models.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : models.map((m: any, i: number) => (
        <View key={i} style={[s.pCard, m.estimated && { backgroundColor: '#f5f3ff' }]}>
          <Text style={s.pName}>{m.name}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={s.pStat}>📦 فروش: {toFaNum(m.totalQty)}</Text>
            <Text style={s.pStat}>💰 {toFaNum(fmt(m.totalSales))}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={s.pStat}>🛒 خرید: {m.purchasePrice ? toFaNum(fmt(Math.round(m.purchasePrice))) : '—'}</Text>
            <Text style={[s.pStat, { color: m.totalProfit >= 0 ? '#059669' : '#dc2626', fontWeight: 'bold' }]}>💹 سود: {toFaNum(fmt(m.totalProfit))}</Text>
          </View>
          <Text style={[s.badge, m.priceSource === 'same-month' && { backgroundColor: '#d1fae5', color: '#065f46' }, m.priceSource === 'historical' && { backgroundColor: '#d1fae5', color: '#065f46' }, m.priceSource === 'estimated' && { backgroundColor: '#ede9fe', color: '#6d28d9' }]}>
            {m.priceSource === 'same-month' ? '✅ خرید هم‌ماه' : m.priceSource === 'historical' ? '📜 خرید تاریخی' : m.priceSource === 'estimated' ? `📊 تخمینی ${Math.round((stats?.defaultMargin || 0.1) * 100)}٪` : '—'}
          </Text>
        </View>
      ))}
      {!loading && !models.length && <Text style={s.empty}>💹 در این بازه فروشی ثبت نشده</Text>}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  INVENTORY SCREEN
// ══════════════════════════════════════════════════════════
function InventoryScreen({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [thresholdInput, setThresholdInput] = useState('5');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState<any>(null);
  const [shelfVal, setShelfVal] = useState('');

  const load = async () => {
    setLoading(true);
    try { const d = await getInventory(); setList(d.list); setStats(d.stats); setThresholdInput(String(d.threshold)); }
    catch (e: any) { showToast(e.message, true); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveShelf = async () => {
    if (!editItem) return;
    try {
      const { data } = await supabase.from('products').select('id').eq('code', editItem.code).limit(1);
      if (data && data[0]) await updateProduct(data[0].id, { shelf: shelfVal });
      else await createProduct({ code: editItem.code, name: editItem.name, price: editItem.lastPrice || 0, shelf: shelfVal });
      showToast('✅ ذخیره شد'); setEditItem(null); load();
    } catch (e: any) { showToast(e.message, true); }
  };

  const saveThreshold = async () => {
    const v = parseInt(thresholdInput, 10) || 5;
    try { const settings = await getSettings(); await updateSettings({ ...settings, inventory_threshold: v }); showToast('✅ ذخیره شد'); load(); }
    catch (e: any) { showToast(e.message, true); }
  };

  const filtered = list.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (q) { const h = `${m.code} ${m.name} ${m.shelf || ''}`.toLowerCase(); if (!h.includes(q.toLowerCase())) return false; }
    return true;
  });

  const statusLabel = (st: string) => st === 'negative' ? '⚫ منفی' : st === 'out' ? '🔴 ناموجود' : st === 'low' ? '⚠️ کمبود' : '✅ سالم';
  const statusColor = (st: string) => st === 'negative' ? '#1e293b' : st === 'out' ? '#dc2626' : st === 'low' ? '#d97706' : '#059669';

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <DigitalDashboard refreshKey={0} settings={{}} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        {[{ l: '📊 مدل‌ها', v: stats.totalModels || 0, c: '#60a5fa' }, { l: '📦 جمع', v: stats.totalQty || 0, c: '#34d399' }, { l: '⚠️ کمبود', v: stats.lowStock || 0, c: '#fb923c' }, { l: '🔴 ناموجود', v: stats.outOfStock || 0, c: '#f87171' }, { l: '⚫ منفی', v: stats.negative || 0, c: '#94a3b8' }].map((b, i) => (
          <View key={i} style={s.sBox}><Text style={s.sBoxL}>{b.l}</Text><Text style={[s.sBoxV, { color: b.c }]}>{toFaNum(b.v)}</Text></View>
        ))}
      </View>
      <View style={[s.thresholdBox, { backgroundColor: C.card }]}>
        <Text style={[s.lbl, { color: C.textMut }]}>⚙️ آستانه کمبود</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TextInput style={[s.inp, { flex: 1, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={thresholdInput} onChangeText={setThresholdInput} keyboardType="numeric" />
          <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#059669' }]} onPress={saveThreshold}><Text style={s.btnTxt}>💾</Text></TouchableOpacity>
        </View>
      </View>
      <TextInput style={[s.inp, { marginTop: 10, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو: کد، نام، قفسه..." placeholderTextColor={C.textMut} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'negative', l: '⚫ منفی' }, { k: 'out', l: '🔴 ناموجود' }, { k: 'low', l: '⚠️ کمبود' }, { k: 'ok', l: '✅ سالم' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}><Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text></TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={s.secT}>📦 موجودی ({toFaNum(filtered.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.map((m: any, i: number) => (
        <View key={i} style={[s.invItem, { backgroundColor: C.card }, m.status === 'negative' && { backgroundColor: '#f1f5f9', borderRightColor: '#475569' }, m.status === 'out' && { backgroundColor: '#fef2f2', borderRightColor: '#dc2626' }, m.status === 'low' && { backgroundColor: '#fffbeb', borderRightColor: '#f59e0b' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flex: 1 }}><Text style={s.invCode}>{m.code}</Text><Text style={[s.invName, { color: C.text }]}>{m.name}</Text></View>
            <Text style={[s.invQty, { color: statusColor(m.status) }]}>{toFaNum(m.currentQty)}</Text>
          </View>
          <Text style={s.invStat}>📥 {toFaNum(m.bought)} | 📤 {toFaNum(m.sold)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <TouchableOpacity onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }} style={s.shelfBtn}><Text style={s.shelfTxt}>📍 {m.shelf || 'قفسه ثبت نشده'}</Text></TouchableOpacity>
            <Text style={[s.statusTag, { color: statusColor(m.status) }]}>{statusLabel(m.status)}</Text>
          </View>
        </View>
      ))}
      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>
        <View style={s.modalBg}><View style={[s.modalBox, { backgroundColor: C.card }]}>
          <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}><Text style={s.modalHeadTxt}>📍 قفسه — {editItem?.name}</Text><TouchableOpacity onPress={() => setEditItem(null)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={[s.modalLbl, { color: C.textMut }]}>کد: <Text style={s.modalVal}>{editItem?.code}</Text></Text>
            <Text style={[s.modalLbl, { color: C.textMut }]}>موجودی: <Text style={s.modalVal}>{toFaNum(editItem?.currentQty || 0)} عدد</Text></Text>
            <Text style={[s.modalLbl, { color: C.textMut }]}>موقعیت قفسه:</Text>
            <TextInput style={[s.modalInp, { color: C.text, borderColor: '#a78bfa' }]} value={shelfVal} onChangeText={setShelfVal} placeholder="مثلاً A-12" placeholderTextColor={C.textMut} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setEditItem(null)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={saveShelf}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
            </View>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  MANAGEMENT SCREEN (۶ زیرتب)
// ══════════════════════════════════════════════════════════
function ManagementScreen({ showToast, settings, setSettings, reload }: any) {
  const [sub, setSub] = useState('unpaid');
  const subs = [
    { k: 'unpaid', l: '🗑️ پرداخت‌نشده' },
    { k: 'newOrder', l: '➕ سفارش جدید' },
    { k: 'search', l: '🔍 جستجو و ویرایش' },
    { k: 'reports', l: '📊 گزارشات' },
    { k: 'settings', l: '⚙️ تنظیمات' },
    { k: 'sources', l: '🌿 منابع' },
  ];
  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
        {subs.map((t) => (
          <TouchableOpacity key={t.k} onPress={() => setSub(t.k)} style={[s.subTab, sub === t.k && s.subTabActive]}>
            <Text style={[s.subTabTxt, sub === t.k && s.subTabTxtActive]}>{t.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {sub === 'unpaid' && <UnpaidSection showToast={showToast} />}
      {sub === 'newOrder' && <NewOrderSection showToast={showToast} />}
      {sub === 'search' && <SearchSection showToast={showToast} />}
      {sub === 'reports' && <ReportsSection showToast={showToast} />}
      {sub === 'settings' && <SettingsSection showToast={showToast} settings={settings} setSettings={setSettings} reload={reload} />}
      {sub === 'sources' && <SourcesSection showToast={showToast} />}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  UNPAID SECTION
// ══════════════════════════════════════════════════════════
function UnpaidSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => { setLoading(true); try { setList(await getUnpaidInvoices()); } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const toggle = (inv: string) => { const n = new Set(selected); n.has(inv) ? n.delete(inv) : n.add(inv); setSelected(n); };
  const del = async () => {
    if (!selected.size) return;
    const ok = await confirmMsg('حذف', `${selected.size} فاکتور حذف شود؟`);
    if (!ok) return;
    try { for (const inv of Array.from(selected)) await deleteSale(inv); showToast('✅ حذف شد'); setSelected(new Set()); load(); }
    catch (e: any) { showToast(e.message, true); }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#334155' }]} onPress={load}><Text style={s.btnTxt}>🔄 بروزرسانی</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={del} disabled={!selected.size}><Text style={s.btnTxt}>🗑️ حذف ({selected.size})</Text></TouchableOpacity>
      </View>
      <Text style={s.secT}>📄 پرداخت‌نشده ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((inv: any) => (
        <TouchableOpacity key={inv.invoice} onPress={() => toggle(inv.invoice)} style={[s.invCard, { backgroundColor: C.card }, selected.has(inv.invoice) && { backgroundColor: '#fee2e2', borderRightColor: '#dc2626' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>{selected.has(inv.invoice) ? '✅' : '⬜'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.invNum}>{inv.invoice}</Text>
              <Text style={s.invCust}>👤 {inv.name} — {inv.phone}</Text>
              <Text style={s.invStat}>💰 {toFaNum(fmt(inv.total))} | 💳 {toFaNum(fmt(inv.paid))}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {!loading && !list.length && <Text style={s.empty}>✅ پرداخت‌نشده‌ای نیست</Text>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  NEW ORDER SECTION
// ══════════════════════════════════════════════════════════
function NewOrderSection({ showToast }: any) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [shipping, setShipping] = useState('');
  const [invoice, setInvoice] = useState('');
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProducts().then(setProds);
    generateInvoiceNumber().then(setInvoice);
    setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: '', bankName: '', accountHolder: '' }]);
  }, []);

  const onPhone = async (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    setPhone(d); setStatus('');
    if (d.length === 11) {
      setStatus('⏳');
      try { const f = await lookupCustomerByPhone(d); if (f) { setStatus('✅'); if (f.customer_name && !name) setName(f.customer_name); if (f.customer_address && !address) setAddress(f.customer_address); } else setStatus('🆕'); } catch {}
    }
  };
  const addRow = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: '', bankName: '', accountHolder: '' }]);
  const upd = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };
  const del = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const setModel = (i: number, v: string) => { const n = [...items]; n[i].modelName = v; const p = prods.find((x) => x.name === v); if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; } setItems(n); };

  const grandTotal = items.reduce((a, r) => a + (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0), 0);
  const grandQty = items.reduce((a, r) => a + (Number(r.quantity) || 0), 0);

  const submit = async () => {
    if (!/^09\d{9}$/.test(phone)) return alertMsg('⚠️ خطا', 'شماره معتبر نیست');
    if (!name) return alertMsg('⚠️ خطا', 'نام الزامی است');
    if (!shipping) return alertMsg('⚠️ خطا', 'باربری الزامی است');
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    if (!valid.length) return alertMsg('⚠️ خطا', 'حداقل یک مدل');
    const ok = await confirmMsg('📋 تأیید', `👤 ${name}\n📞 ${phone}\n📦 ${valid.length} مدل\n💰 ${fmt(grandTotal)}\n\nثبت شود؟`);
    if (!ok) return;
    setSaving(true);
    try {
      let code = '';
      const f = await lookupCustomerByPhone(phone);
      if (f?.customer_code && /^M_\d+$/.test(f.customer_code)) code = f.customer_code;
      else code = await generateCustomerCode();
      const inv = await generateInvoiceNumber();
      await createSale({ invoiceNumber: inv, customerCode: code, customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid });
      alertMsg('✅ موفق', 'ثبت شد: ' + inv);
      setPhone(''); setName(''); setAddress(''); setShipping('');
      setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: '', bankName: '', accountHolder: '' }]);
      setInvoice(await generateInvoiceNumber());
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); } finally { setSaving(false); }
  };

  return (
    <View>
      <Text style={s.formTitle}>➕ سفارش جدید</Text>
      <Text style={[s.lbl, { color: C.textMut }]}>📞 تلفن {status}</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={phone} onChangeText={onPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor={C.textMut} />
      <Text style={[s.lbl, { color: C.textMut }]}>👤 نام</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={name} onChangeText={setName} placeholder="نام مشتری" placeholderTextColor={C.textMut} />
      <Text style={[s.lbl, { color: C.textMut }]}>📍 آدرس</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={address} onChangeText={setAddress} placeholder="اختیاری" placeholderTextColor={C.textMut} />
      <Autocomplete label="🚚 باربری" value={shipping} onChange={setShipping} options={SHIPPINGS} placeholder="تایپ..." />
      <Text style={[s.lbl, { color: C.textMut }]}>🧾 شماره فاکتور (خودکار)</Text>
      <TextInput style={[s.inp, { backgroundColor: C.cardAlt, color: C.textMut, borderColor: C.border }]} value={invoice} editable={false} />
      <Text style={s.secT}>📦 اقلام</Text>
      {items.map((it, i) => {
        const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        const lineBalance = lineTotal - (Number(it.payment) || 0);
        return (
          <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => del(i)} style={s.delBtnRound}><Text style={{ fontSize: 14, color: '#fff' }}>🗑</Text></TouchableOpacity>
            </View>
            <Autocomplete label="نام مدل" value={it.modelName} onChange={(v) => upd(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="کلیک..." />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>تعداد</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => upd(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>قیمت</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => upd(i, 'priceUnit', parseNum(v))} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>پرداخت</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.payment || '')} onChangeText={(v) => upd(i, 'payment', parseNum(v))} keyboardType="numeric" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>💰 مبلغ کل</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={s.autoCalcTxt}>{lineTotal ? toFaNum(fmt(lineTotal)) : '—'}</Text></View></View>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>⚖️ مانده</Text><View style={[s.autoCalcBox, { backgroundColor: C.cardAlt, borderColor: lineBalance > 0 ? '#dc2626' : '#059669' }]}><Text style={[s.autoCalcTxt, { color: lineBalance > 0 ? '#dc2626' : '#059669' }]}>{lineTotal ? toFaNum(fmt(lineBalance)) : '—'}</Text></View></View>
            </View>
            <Text style={[s.lblS, { color: C.textMut }]}>📅 تاریخ واریز</Text>
            <DateField value={it.depositDate} onChange={(v: string) => upd(i, 'depositDate', v)} compact />
            <Autocomplete label="🏦 بانک" value={it.bankName} onChange={(v) => upd(i, 'bankName', v)} options={BANKS} placeholder="کلیک..." />
            <Autocomplete label="👤 صاحب حساب" value={it.accountHolder} onChange={(v) => upd(i, 'accountHolder', v)} options={prods.map(p => p.supplier_name || '').filter(Boolean)} placeholder="کلیک..." />
          </View>
        );
      })}
      <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>➕ افزودن ردیف</Text></TouchableOpacity>
      <View style={s.grandSummary}>
        <View style={{ flex: 1 }}><Text style={s.gsLbl}>💰 جمع کل</Text><Text style={s.gsVal}>{toFaNum(fmt(grandTotal))}</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={s.gsLbl}>📦 تعداد</Text><Text style={s.gsQty}>{toFaNum(grandQty)}</Text></View>
      </View>
      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت سفارش</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  SEARCH SECTION
// ══════════════════════════════════════════════════════════
function SearchSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [editRows, setEditRows] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);

  const load = async () => { setLoading(true); try { setList(await searchAllInvoices('')); } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = list.filter((r) => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (q) { const h = `${r.invoice} ${r.name || ''} ${r.phone || ''}`.toLowerCase(); if (!h.includes(q.toLowerCase())) return false; }
    return true;
  });

  const openEdit = async (inv: string, type: string) => {
    try {
      if (type === 'sales') {
        const rows = await getInvoiceDetail(inv);
        if (!rows.length) { showToast('فاکتور پیدا نشد', true); return; }
        setEditRows(rows.map((r: any) => ({ rowId: r.id, modelCode: r.model_code, modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, payment: r.payment, description: r.description, depositDate: r.deposit_date, bankName: r.bank_name, accountHolder: r.account_holder, shipping: r.shipping, _deleted: false })));
        setEditing({ invoice: inv, type, name: rows[0].customer_name, code: rows[0].customer_code });
      } else {
        const { data } = await supabase.from('purchases').select('*').eq('invoice_number', inv);
        if (!data?.length) { showToast('پیدا نشد', true); return; }
        setEditRows(data.map((r: any) => ({ rowId: r.id, modelCode: r.model_code, modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, payment: r.payment, description: r.description, depositDate: r.deposit_date, bankName: r.bank_name, accountHolder: r.account_holder, _deleted: false })));
        setEditing({ invoice: inv, type, name: data[0].supplier_name, code: data[0].supplier_code });
      }
      setDirty(false);
    } catch (e: any) { showToast(e.message, true); }
  };

  const delRow = (i: number) => { const n = [...editRows]; n[i]._deleted = !n[i]._deleted; setEditRows(n); setDirty(true); };
  const addRow = () => { setEditRows([...editRows, { rowId: null, modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: '', bankName: '', accountHolder: '', _deleted: false, _new: true }]); setDirty(true); };
  const updRow = (i: number, f: string, v: any) => { const n = [...editRows]; (n[i] as any)[f] = v; setEditRows(n); setDirty(true); };

  const save = async () => {
    if (!dirty) return showToast('تغییری نیست', true);
    try {
      const tbl = editing.type === 'sales' ? 'sales' : 'purchases';
      for (let i = 0; i < editRows.length; i++) {
        const r = editRows[i];
        if (r._deleted && r.rowId) { await supabase.from(tbl).delete().eq('id', r.rowId); continue; }
        if (r._deleted) continue;
        const data: any = { model_code: r.modelCode, model_name: r.modelName, quantity: r.quantity, price_unit: r.priceUnit, payment: r.payment, description: r.description, deposit_date: r.depositDate, bank_name: r.bankName, account_holder: r.accountHolder };
        if (editing.type === 'sales') data.shipping = r.shipping || '';
        if (r.rowId) await supabase.from(tbl).update(data).eq('id', r.rowId);
        else await supabase.from(tbl).insert({ ...data, invoice_number: editing.invoice, customer_name: editing.name, customer_code: editing.code, supplier_name: editing.name, supplier_code: editing.code, date_factor: toStorageDate(new Date()), date_reg: toStorageDateFull(new Date()) });
      }
      alertMsg('✅ موفق', 'تغییرات ذخیره شد');
      setEditing(null); setEditRows([]); setDirty(false); load();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
  };

  const remove = async (inv: string, type: string) => {
    const ok = await confirmMsg('حذف', `فاکتور ${inv} حذف شود؟`);
    if (!ok) return;
    try { type === 'purchases' ? await deletePurchase(inv) : await deleteSale(inv); load(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e.message, true); }
  };

  if (editing) return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ maxHeight: '100%' }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[s.mgrHead, { backgroundColor: '#c0392b' }]}>
          <TouchableOpacity onPress={async () => { if (dirty) { const ok = await confirmMsg('خروج', 'تغییرات ذخیره نشده — خارج شوی؟'); if (!ok) return; } setEditing(null); setEditRows([]); setDirty(false); }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>← بازگشت</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={s.mgrHeadTxt}>✏️ {editing.invoice}</Text>
            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.9 }}>{editing.name} | {editing.code} | {editRows.length} ردیف</Text>
          </View>
        </View>
        {editRows.map((r, i) => (
          <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }, r._deleted && { opacity: 0.4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delRow(i)}><Text style={{ fontSize: 18 }}>{r._deleted ? '↺' : '🗑'}</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>کد</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={r.modelCode} onChangeText={(v) => updRow(i, 'modelCode', v)} editable={!r._deleted} /></View>
              <View style={{ flex: 2 }}><Text style={[s.lblS, { color: C.textMut }]}>نام</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={r.modelName} onChangeText={(v) => updRow(i, 'modelName', v)} editable={!r._deleted} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>تعداد</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.quantity || '')} onChangeText={(v) => updRow(i, 'quantity', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>قیمت</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.priceUnit || '')} onChangeText={(v) => updRow(i, 'priceUnit', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
              <View style={{ flex: 1 }}><Text style={[s.lblS, { color: C.textMut }]}>پرداخت</Text><TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.payment || '')} onChangeText={(v) => updRow(i, 'payment', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
            </View>
            <Text style={[s.lblS, { color: C.textMut }]}>تاریخ واریز</Text>
            <DateField value={r.depositDate} onChange={(v: string) => updRow(i, 'depositDate', v)} compact />
            <Autocomplete label="بانک" value={r.bankName} onChange={(v) => updRow(i, 'bankName', v)} options={BANKS} placeholder="کلیک..." />
            <Text style={[s.lblS, { color: C.textMut }]}>شرح</Text>
            <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={r.description} onChangeText={(v) => updRow(i, 'description', v)} editable={!r._deleted} />
          </View>
        ))}
        <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>➕ افزودن ردیف</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => { setEditing(null); setEditRows([]); }}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={save}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const typeLabel = (t: string) => t === 'purchases' ? '🛍️ خرید' : '🛒 فروش';
  const statusLabel = (total: number, paid: number) => {
    if (paid >= total && total > 0) return '✅ پرداخت‌شده';
    if (paid > 0) return '⏳ جزئی';
    return '❌ پرداخت‌نشده';
  };
  const statusColor = (total: number, paid: number) => {
    if (paid >= total && total > 0) return '#059669';
    if (paid > 0) return '#f39c12';
    return '#dc2626';
  };

  return (
    <View>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 فاکتور، نام، تلفن..." placeholderTextColor={C.textMut} />
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'sales', l: '🛒 فروش' }, { k: 'purchases', l: '🛍️ خرید' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}><Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text></TouchableOpacity>
        ))}
      </View>
      <Text style={s.secT}>📄 نتایج ({toFaNum(filtered.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.slice(0, 100).map((r: any, i: number) => (
        <View key={i} style={[s.searchCard, { backgroundColor: C.card }, r.type === 'purchases' && { borderRightColor: '#166534' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.searchRowNum}>#{toFaNum(i + 1)}</Text>
              <Text style={s.searchInvoice}>{r.invoice}</Text>
            </View>
            <View style={[s.searchTypeBadge, { backgroundColor: r.type === 'purchases' ? '#d1fae5' : '#dbeafe' }]}>
              <Text style={[s.searchTypeTxt, { color: r.type === 'purchases' ? '#065f46' : '#1e40af' }]}>{typeLabel(r.type)}</Text>
            </View>
          </View>
          <View style={s.searchInfoGrid}>
            <View style={s.searchInfoCell}><Text style={s.searchInfoLbl}>👤 نام</Text><Text style={[s.searchInfoVal, { color: C.text }]} numberOfLines={1}>{r.name || '—'}</Text></View>
            <View style={s.searchInfoCell}><Text style={s.searchInfoLbl}>📞 تلفن</Text><Text style={[s.searchInfoVal, { color: C.text }]} numberOfLines={1}>{r.phone || '—'}</Text></View>
            <View style={s.searchInfoCell}><Text style={s.searchInfoLbl}>📅 تاریخ</Text><Text style={[s.searchInfoVal, { color: C.text }]} numberOfLines={1}>{displayDateOnly(r.date)}</Text></View>
            <View style={s.searchInfoCell}><Text style={s.searchInfoLbl}>📋 ردیف</Text><Text style={[s.searchInfoVal, { color: C.text }]} numberOfLines={1}>{toFaNum(r.rowCount || r.items?.length || 0)}</Text></View>
          </View>
          <View style={[s.searchMoneyBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
            <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.searchMoneyLbl}>💰 جمع</Text><Text style={s.searchMoneyVal}>{toFaNum(fmt(r.total))}</Text></View>
            <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.searchMoneyLbl}>💳 پرداخت</Text><Text style={[s.searchMoneyVal, { color: '#059669' }]}>{toFaNum(fmt(r.paid))}</Text></View>
            <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.searchMoneyLbl}>📌 مانده</Text><Text style={[s.searchMoneyVal, { color: r.total - r.paid > 0 ? '#dc2626' : '#059669' }]}>{toFaNum(fmt(r.total - r.paid))}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={[s.searchStatusBadge, { backgroundColor: statusColor(r.total, r.paid) + '20' }]}><Text style={[s.searchStatusTxt, { color: statusColor(r.total, r.paid) }]}>{statusLabel(r.total, r.paid)}</Text></View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => openEdit(r.invoice, r.type)} style={s.searchActionBtn}><Text style={s.searchActionTxt}>✏️ ویرایش</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(r.invoice, r.type)} style={[s.searchActionBtn, { backgroundColor: '#fee2e2' }]}><Text style={[s.searchActionTxt, { color: '#991b1b' }]}>🗑</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
      {!loading && !filtered.length && (<View style={s.emptyState}><Text style={{ fontSize: 48, opacity: 0.5 }}>🔍</Text><Text style={s.emptyStateTxt}>نتیجه‌ای یافت نشد</Text><Text style={s.emptyStateSub}>جستجو یا فیلتر را تغییر بده</Text></View>)}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  REPORTS SECTION (بدهکاران، طلبکاران، ۲۴ ساعت، انبار)
// ══════════════════════════════════════════════════════════
function ReportsSection({ showToast }: any) {
  const [type, setType] = useState('debtors');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: sales }, { data: purchases }, { data: products }] = await Promise.all([
        supabase.from('sales').select('*'),
        supabase.from('purchases').select('*'),
        supabase.from('products').select('*'),
      ]);

      if (type === 'debtors') {
        const map: any = {};
        (sales || []).forEach((r: any) => {
          const code = r.customer_code || r.customer_phone;
          if (!code) return;
          if (!map[code]) map[code] = { code, name: r.customer_name, phone: r.customer_phone, total: 0, paid: 0 };
          map[code].total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
          map[code].paid += Number(r.payment) || 0;
        });
        const rows = Object.values(map).map((m: any) => ({ ...m, balance: m.total - m.paid })).filter((r: any) => r.balance > 0);
        rows.sort((a: any, b: any) => b.balance - a.balance);
        setData({ rows, total: rows.reduce((a: number, r: any) => a + r.balance, 0), title: 'بدهکاران' });
      } else if (type === 'creditors') {
        const map: any = {};
        (purchases || []).forEach((r: any) => {
          const code = r.supplier_code || r.supplier_phone;
          if (!code) return;
          if (!map[code]) map[code] = { code, name: r.supplier_name, phone: r.supplier_phone, total: 0, paid: 0 };
          map[code].total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
          map[code].paid += Number(r.payment) || 0;
        });
        const rows = Object.values(map).map((m: any) => ({ ...m, balance: m.total - m.paid })).filter((r: any) => r.balance > 0);
        rows.sort((a: any, b: any) => b.balance - a.balance);
        setData({ rows, total: rows.reduce((a: number, r: any) => a + r.balance, 0), title: 'طلبکاران' });
      } else if (type === 'sales24h') {
        const now = Date.now();
        const cutoff = now - 24 * 3600 * 1000;
        const rows = (sales || []).filter((r: any) => {
          const d = parseDateAny(r.date_reg || r.date_factor);
          return d && d.getTime() >= cutoff;
        });
        setData({ rows, total: rows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0), title: 'فروش ۲۴ ساعت' });
      } else if (type === 'purchases24h') {
        const now = Date.now();
        const cutoff = now - 24 * 3600 * 1000;
        const rows = (purchases || []).filter((r: any) => {
          const d = parseDateAny(r.date_reg || r.date_factor);
          return d && d.getTime() >= cutoff;
        });
        setData({ rows, total: rows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0), title: 'خرید ۲۴ ساعت' });
      } else if (type === 'inventory') {
        const d = await getInventory();
        const rows = d.list.filter((m: any) => m.currentQty !== 0);
        setData({ rows, total: rows.reduce((a: number, r: any) => a + r.currentQty, 0), title: 'موجودی انبار' });
      }
    } catch (e: any) { showToast(e.message, true); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [type]);

  const exportExcel = async () => {
    if (!data?.rows?.length) return;
    try {
      const ws = XLSX.utils.json_to_sheet(data.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'گزارش');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const path = (FileSystem as any).cacheDirectory + `report-${type}-${Date.now()}.xlsx`;
      await FileSystem.writeAsStringAsync(path, wbout, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      showToast('✅ اکسل آماده شد');
    } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <View>
      <Text style={s.secT}>📊 نوع گزارش</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[
          { k: 'debtors', l: '📊 بدهکاران' },
          { k: 'creditors', l: '📊 طلبکاران' },
          { k: 'sales24h', l: '📈 فروش ۲۴ ساعت' },
          { k: 'purchases24h', l: '📉 خرید ۲۴ ساعت' },
          { k: 'inventory', l: '📦 موجودی' },
        ].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setType(f.k)} style={[s.chip, type === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, type === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : data && (
        <View style={{ marginTop: 16 }}>
          <View style={s.statsCard}>
            <Text style={s.statsLbl}>{data.title}</Text>
            <Text style={s.statsVal}>{toFaNum(fmt(data.total))}</Text>
            <Text style={s.statsUnit}>{data.rows.length} مورد</Text>
          </View>

          {data.rows.slice(0, 100).map((r: any, i: number) => (
            <View key={i} style={[s.invCard, { backgroundColor: C.card }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={s.invNum}>#{i + 1} {r.code || r.invoice || ''}</Text>
                <Text style={[s.invStat, { fontWeight: 'bold' }]}>{r.name || r.model_name || ''}</Text>
              </View>
              <Text style={s.invStat}>📞 {r.phone || '—'}</Text>
              {r.balance !== undefined && <Text style={[s.invStat, { color: '#dc2626', fontWeight: 'bold' }]}>📌 بدهی: {toFaNum(fmt(r.balance))}</Text>}
              {r.currentQty !== undefined && <Text style={s.invStat}>📦 موجودی: {toFaNum(r.currentQty)}</Text>}
              {r.total !== undefined && r.balance === undefined && r.currentQty === undefined && <Text style={s.invStat}>💰 {toFaNum(fmt(r.total))} | 💳 {toFaNum(fmt(r.paid))}</Text>}
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#c0392b' }]} onPress={exportExcel}><Text style={s.btnTxt}>📥 اکسل</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={load}><Text style={s.btnTxt}>🔄 بروزرسانی</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  SETTINGS SECTION (کامل با ایمیل، حذف خودکار، گزارش‌های زمان‌بندی)
// ══════════════════════════════════════════════════════════
function SettingsSection({ showToast, settings, setSettings, reload }: any) {
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [autoDelEnabled, setAutoDelEnabled] = useState(false);
  const [autoDelHours, setAutoDelHours] = useState('1');
  const [schedDailyEnabled, setSchedDailyEnabled] = useState(false);
  const [schedDailyHour, setSchedDailyHour] = useState('21');
  const [schedDailyDays, setSchedDailyDays] = useState<string[]>([]);
  const [schedDailyType, setSchedDailyType] = useState('daily-combined');
  const [schedWeeklyEnabled, setSchedWeeklyEnabled] = useState(false);
  const [schedWeeklyDay, setSchedWeeklyDay] = useState('6');
  const [schedWeeklyHour, setSchedWeeklyHour] = useState('21');
  const [schedWeeklyType, setSchedWeeklyType] = useState('weekly-combined');

  useEffect(() => {
    if (!settings) return;
    setAutoDelEnabled(!!settings.auto_delete_enabled);
    setAutoDelHours(String(settings.auto_delete_hours || 1));
    const sd = settings.sched_daily || {};
    setSchedDailyEnabled(!!sd.enabled);
    setSchedDailyHour(String(sd.hour ?? 21));
    setSchedDailyDays(sd.days || []);
    setSchedDailyType(sd.type || 'daily-combined');
    const sw = settings.sched_weekly || {};
    setSchedWeeklyEnabled(!!sw.enabled);
    setSchedWeeklyDay(String(sw.day ?? 6));
    setSchedWeeklyHour(String(sw.hour ?? 21));
    setSchedWeeklyType(sw.type || 'weekly-combined');
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        ...settings,
        auto_delete_enabled: autoDelEnabled,
        auto_delete_hours: parseInt(autoDelHours, 10) || 1,
        sched_daily: { enabled: schedDailyEnabled, hour: parseInt(schedDailyHour, 10), days: schedDailyDays, type: schedDailyType },
        sched_weekly: { enabled: schedWeeklyEnabled, day: parseInt(schedWeeklyDay, 10), hour: parseInt(schedWeeklyHour, 10), type: schedWeeklyType },
      });
      alertMsg('✅ موفق', 'تنظیمات ذخیره شد');
      reload && reload();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const emails: string[] = settings.emails || [];
  const addEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) return showToast('ایمیل معتبر وارد کن', true);
    setSettings({ ...settings, emails: [...emails, emailInput] });
    setEmailInput('');
  };
  const removeEmail = (i: number) => setSettings({ ...settings, emails: emails.filter((_, idx) => idx !== i) });

  const toggleDay = (d: string) => {
    setSchedDailyDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  return (
    <View>
      <Text style={s.secT}>📅 نوع تقویم</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[{ k: 'jalali', l: '🌙 شمسی' }, { k: 'gregorian', l: '🌍 میلادی' }, { k: 'hijri', l: '🕋 قمری' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => { setSettings({ ...settings, cal_type: f.k as CalType }); saveCalType(f.k as CalType); }} style={[s.chip, settings.cal_type === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, settings.cal_type === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>📺 بازه داشبورد</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(DASH_RANGE_LABELS).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setSettings({ ...settings, dashboard_range: k })} style={[s.chip, settings.dashboard_range === k && s.chipActive]}>
            <Text style={[s.chipTxt, settings.dashboard_range === k && s.chipTxtActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>🔎 فیلتر داده</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[{ k: 'both', l: '📋 هر دو' }, { k: 'sales', l: '🛒 فروش' }, { k: 'purchase', l: '🛍️ خرید' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setSettings({ ...settings, dashboard_filter: f.k })} style={[s.chip, settings.dashboard_filter === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, settings.dashboard_filter === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>💹 درصد سود تخمینی</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(Math.round((settings.profit_margin || 0.1) * 100))} onChangeText={(v) => setSettings({ ...settings, profit_margin: (parseFloat(v) || 0) / 100 })} keyboardType="numeric" />

      <Text style={s.secT}>📦 آستانه کمبود</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.inventory_threshold || 5)} onChangeText={(v) => setSettings({ ...settings, inventory_threshold: parseInt(v) || 5 })} keyboardType="numeric" />

      <Text style={s.secT}>📧 ایمیل‌های گزارش</Text>
      {emails.map((e, i) => (
        <View key={i} style={[s.emailRow, { backgroundColor: C.cardAlt }]}>
          <Text style={[s.emailTxt, { color: C.text }]} numberOfLines={1}>{e}</Text>
          <TouchableOpacity onPress={() => removeEmail(i)}><Text>🗑</Text></TouchableOpacity>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput style={[s.inp, { flex: 1, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={emailInput} onChangeText={setEmailInput} placeholder="ایمیل جدید..." placeholderTextColor={C.textMut} keyboardType="email-address" autoCapitalize="none" />
        <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#7c3aed' }]} onPress={addEmail}><Text style={s.btnTxt}>➕</Text></TouchableOpacity>
      </View>

      <Text style={s.secT}>🗑️ حذف خودکار فاکتورهای پرداخت‌نشده</Text>
      <View style={s.rowBetween}>
        <Text style={[s.lbl, { color: C.textMut }]}>فعال</Text>
        <Switch value={autoDelEnabled} onValueChange={setAutoDelEnabled} />
      </View>
      <Text style={[s.lblS, { color: C.textMut }]}>حذف بعد از (ساعت)</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={autoDelHours} onChangeText={setAutoDelHours} keyboardType="numeric" />

      <Text style={s.secT}>📊 گزارش روزانه</Text>
      <View style={s.rowBetween}>
        <Text style={[s.lbl, { color: C.textMut }]}>فعال</Text>
        <Switch value={schedDailyEnabled} onValueChange={setSchedDailyEnabled} />
      </View>
      <Text style={[s.lblS, { color: C.textMut }]}>ساعت ارسال (0-23)</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={schedDailyHour} onChangeText={setSchedDailyHour} keyboardType="numeric" />
      <Text style={[s.lblS, { color: C.textMut }]}>روزهای هفته (خالی=هر روز)</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((d, i) => (
          <TouchableOpacity key={i} onPress={() => toggleDay(String(i))} style={[s.chip, schedDailyDays.includes(String(i)) && s.chipActive]}>
            <Text style={[s.chipTxt, schedDailyDays.includes(String(i)) && s.chipTxtActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[s.lblS, { color: C.textMut }]}>نوع گزارش</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[{ k: 'daily-combined', l: '🗂️ ترکیبی' }, { k: 'inventory', l: '📦 انبار' }, { k: 'sales-today', l: '📈 فروش' }, { k: 'purchases-today', l: '📉 خرید' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setSchedDailyType(f.k)} style={[s.chip, schedDailyType === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, schedDailyType === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>📅 گزارش هفتگی</Text>
      <View style={s.rowBetween}>
        <Text style={[s.lbl, { color: C.textMut }]}>فعال</Text>
        <Switch value={schedWeeklyEnabled} onValueChange={setSchedWeeklyEnabled} />
      </View>
      <Text style={[s.lblS, { color: C.textMut }]}>روز هفته</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((d, i) => (
          <TouchableOpacity key={i} onPress={() => setSchedWeeklyDay(String(i))} style={[s.chip, schedWeeklyDay === String(i) && s.chipActive]}>
            <Text style={[s.chipTxt, schedWeeklyDay === String(i) && s.chipTxtActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[s.lblS, { color: C.textMut }]}>ساعت ارسال</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={schedWeeklyHour} onChangeText={setSchedWeeklyHour} keyboardType="numeric" />
      <Text style={[s.lblS, { color: C.textMut }]}>نوع گزارش</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[{ k: 'weekly-combined', l: '🗂️ ترکیبی' }, { k: 'debtors', l: '📊 بدهکاران' }, { k: 'creditors', l: '📊 طلبکاران' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setSchedWeeklyType(f.k)} style={[s.chip, schedWeeklyType === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, schedWeeklyType === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.warnTxt, { marginTop: 12, color: '#f59e0b', fontSize: 11, lineHeight: 18 }]}>
        ⚠️ توجه: گزارش‌های زمان‌بندی نیاز به Cron Job سمت سرور دارن. اگه فعال باشه، فقط توی تنظیمات ذخیره می‌شه. برای اجرای خودکار، باید یه سرویس جدا (Vercel Cron / GitHub Actions) راه‌اندازی کنیم.
      </Text>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره همه تنظیمات</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  SOURCES SECTION (کالاها)
// ══════════════════════════════════════════════════════════
function SourcesSection({ showToast }: any) {
  const [list, setList] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => { setLoading(true); try { setList(await getProducts()); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = q ? list.filter((p) => `${p.code} ${p.name} ${p.supplier_name || ''} ${p.shelf || ''}`.toLowerCase().includes(q.toLowerCase())) : list;

  const save = async () => {
    if (!editing) return;
    if (!editing.code || !editing.name) { alertMsg('⚠️ خطا', 'کد و نام الزامی'); return; }
    try {
      const payload: any = { ...editing };
      delete payload.id;
      if (editing.id) await updateProduct(editing.id, payload);
      else await createProduct(payload);
      alertMsg('✅ موفق', `کالا «${editing.name}» ذخیره شد`);
      setEditing(null); load();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
  };
  const remove = async (id: string) => {
    const ok = await confirmMsg('حذف', 'حذف شود؟');
    if (!ok) return;
    try { await deleteProduct(id); load(); showToast('✅ حذف شد'); } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <View>
      <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', marginBottom: 10 }]} onPress={() => setEditing({ id: null, code: '', name: '', price: 0, shelf: '', supplier_name: '', supplier_code: '', supplier_phone: '', payer_name: '', shipping_name: '' })}>
        <Text style={s.btnTxt}>➕ افزودن کالا</Text>
      </TouchableOpacity>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در کالاها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>📦 کالاها ({toFaNum(filtered.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.map((p) => (
        <View key={p.id} style={[s.invCard, { backgroundColor: C.card }]}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.invNum}>{p.code} — {p.name}</Text>
              <Text style={s.invStat}>💰 {toFaNum(fmt(p.price || 0))} | 📍 {p.shelf || '—'}</Text>
              {p.supplier_name ? <Text style={s.invCust}>🏭 {p.supplier_name}</Text> : null}
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => setEditing({ ...p })} style={[s.iconBtn, { backgroundColor: '#dbeafe' }]}><Text>✏️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => p.id && remove(p.id)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.modalBg}>
          <ScrollView style={[s.modalBox, { backgroundColor: C.card }]} keyboardShouldPersistTaps="handled">
            <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}>
              <Text style={s.modalHeadTxt}>{editing?.id ? '✏️ ویرایش کالا' : '➕ کالای جدید'}</Text>
              <TouchableOpacity onPress={() => setEditing(null)}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 14 }}>
              {[{ k: 'code', l: 'کد *' }, { k: 'name', l: 'نام *' }, { k: 'price', l: 'قیمت', num: true }, { k: 'shelf', l: '📍 قفسه' }, { k: 'supplier_name', l: '🏭 تأمین‌کننده' }, { k: 'supplier_code', l: 'کد تأمین‌کننده' }, { k: 'supplier_phone', l: '📞 تلفن' }, { k: 'payer_name', l: 'نام پرداخت‌کننده' }, { k: 'shipping_name', l: '🚚 باربری' }].map((f) => (
                <View key={f.k}>
                  <Text style={[s.lbl, { color: C.textMut }]}>{f.l}</Text>
                  <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String((editing as any)?.[f.k] || '')} onChangeText={(v) => setEditing({ ...editing, [f.k]: f.num ? (parseFloat(v) || 0) : v })} keyboardType={f.num ? 'numeric' : 'default'} placeholderTextColor={C.textMut} />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setEditing(null)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={save}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
// ══════════════════════════════════════════════════════════
//  INVOICE A5 VIEW
// ══════════════════════════════════════════════════════════
function InvoiceView({ invoice, onBack, onNew, showToast }: any) {
  const ref = useRef<View>(null);
  const c = invoice.customer, cur = invoice.current, tot = invoice.totals;

  const captureAndShare = async (mode: 'share' | 'save' | 'print') => {
    try {
      const uri = await captureRef(ref, { format: 'jpg', quality: 0.92 });
      if (mode === 'print') await Print.printAsync({ uri });
      else if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); if (mode === 'save') showToast('✅ ذخیره شد'); }
      else showToast('اشتراک پشتیبانی نمی‌شود', true);
    } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 10, paddingBottom: 60 }}>
      <View ref={ref} collapsable={false} style={s.invoiceContainer}>
        <View style={s.invHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 20 }}>⚖️</Text>
            <View><Text style={s.invBrand}>میزان</Text><Text style={s.invSlogan}>حساب‌ها دقیق، معاملات امن</Text></View>
          </View>
          <View style={{ alignItems: 'flex-end' }}><Text style={s.invSmall}>📞 ________________</Text><Text style={s.invSmall}>📧 ________________</Text></View>
        </View>
        <Text style={s.invTitle}>پیش فروش کفش تاج</Text>
        <Text style={s.invDateTxt}>📅 {invoice.timeString}</Text>
        <View style={s.invSection}>
          <Text style={s.invSectionTitle}>👤 اطلاعات مشتری</Text>
          <View style={s.invCGrid}>
            <View style={s.invCell}><Text style={s.invCellL}>نام</Text><Text style={s.invCellV}>{c.name}</Text></View>
            <View style={s.invCell}><Text style={s.invCellL}>تلفن</Text><Text style={s.invCellV}>{c.phone}</Text></View>
            <View style={s.invCell}><Text style={s.invCellL}>کد مشتری</Text><Text style={s.invCellV}>{c.code}</Text></View>
            <View style={s.invCell}><Text style={s.invCellL}>شماره فاکتور</Text><Text style={s.invCellV}>{cur.invoiceNumber}</Text></View>
            {c.address ? <View style={[s.invCell, { width: '100%' }]}><Text style={s.invCellL}>📍 آدرس</Text><Text style={s.invCellV}>{c.address}</Text></View> : null}
            {c.shipping ? <View style={s.invCell}><Text style={s.invCellL}>🚚 باربری</Text><Text style={s.invCellV}>{c.shipping}</Text></View> : null}
          </View>
        </View>
        <View style={s.invSection}>
          <Text style={s.invSectionTitle}>📦 اقلام</Text>
          <View style={s.invTableHead}>
            <Text style={[s.invTh, { flex: 0.4 }]}>#</Text>
            <Text style={[s.invTh, { flex: 2.5 }]}>نام مدل</Text>
            <Text style={[s.invTh, { flex: 0.8 }]}>تعداد</Text>
            <Text style={[s.invTh, { flex: 1 }]}>قیمت</Text>
            <Text style={[s.invTh, { flex: 1.2 }]}>مبلغ</Text>
          </View>
          {cur.items.map((it: any, i: number) => (
            <View key={i} style={[s.invRow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
              <Text style={[s.invTd, { flex: 0.4 }]}>{i + 1}</Text>
              <Text style={[s.invTd, { flex: 2.5, textAlign: 'right', fontWeight: 'bold' }]}>{it.modelName}</Text>
              <Text style={[s.invTd, { flex: 0.8 }]}>{toFaNum(it.quantity)}</Text>
              <Text style={[s.invTd, { flex: 1 }]}>{toFaNum(fmt(it.priceUnit))}</Text>
              <Text style={[s.invTd, { flex: 1.2, fontWeight: 'bold' }]}>{toFaNum(fmt(it.total))}</Text>
            </View>
          ))}
        </View>
        <View style={s.invSection}>
          <Text style={s.invSectionTitle}>💰 خلاصه مالی</Text>
          <SumRow l="🛍️ مبلغ این سفارش" v={fmt(cur.sales) + ' تومان'} />
          <SumRow l="💳 پرداخت این سفارش" v={fmt(cur.payments) + ' تومان'} green />
          <SumRow l={tot.balance > 0 ? '⚖️ مانده قابل پرداخت' : tot.balance < 0 ? '💰 بستانکاری' : '✅ تسویه کامل'} v={tot.balance !== 0 ? fmt(Math.abs(tot.balance)) + ' تومان' : 'بدون بدهی'} highlight />
        </View>
        <View style={s.invFooter}>
          <Text style={s.invFooterTxt}>📞 کفش تاج: ________________</Text>
          <Text style={s.invFooterThanks}>با تشکر از اعتماد شما 🙏</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#1e3a5f' }]} onPress={() => captureAndShare('print')}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#0ea5e9' }]} onPress={() => captureAndShare('share')}><Text style={s.btnTxt}>📤 اشتراک</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={() => captureAndShare('save')}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onBack}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={onNew}><Text style={s.btnTxt}>🛒 جدید</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const SumRow = ({ l, v, green, highlight }: any) => (
  <View style={[s.sumRow, highlight && { backgroundColor: '#fef3c7', borderTopWidth: 1, borderTopColor: '#d4af37' }]}>
    <Text style={[s.sumLbl, highlight && { fontWeight: 'bold', color: '#422006' }]}>{l}</Text>
    <Text style={[s.sumValTxt, green && { color: '#059669' }, highlight && { fontSize: 14, fontWeight: 'bold' }]}>{v}</Text>
  </View>
);

const Row = ({ k, v, gold }: any) => (
  <View style={[s.infoRow, gold && { backgroundColor: '#fef3c7' }]}>
    <Text style={[s.infoK, gold && { color: '#422006', fontWeight: 'bold' }]}>{k}:</Text>
    <Text style={[s.infoV, gold && { color: '#422006', fontSize: 15 }]}>{v}</Text>
  </View>
);

// ══════════════════════════════════════════════════════════
//  LOGIN SCREEN
// ══════════════════════════════════════════════════════════
function LoginScreen({ showToast }: any) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !pass) return showToast('ایمیل و رمز را وارد کن', true);
    if (pass.length < 6) return showToast('رمز باید حداقل ۶ کاراکتر باشد', true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('ایمیل معتبر وارد کن', true);
    setLoading(true);
    try {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (e1) {
        const { error: e2 } = await supabase.auth.signUp({ email, password: pass });
        if (e2) throw e2;
        const { error: e3 } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (e3) throw e3;
      }
    } catch (e: any) { showToast(e.message || 'مشکلی پیش آمد', true); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={[s.loginWrap, { backgroundColor: C.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.loginCard}>
        <Text style={s.loginLogo}>⚖️</Text>
        <Text style={s.loginTitle}>میزان</Text>
        <Text style={s.loginSub}>ورود یا ثبت‌نام</Text>
        <TextInput style={s.loginInp} value={email} onChangeText={setEmail} placeholder="ایمیل" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={s.loginInp} value={pass} onChangeText={setPass} placeholder="رمز (حداقل ۶ کاراکتر)" placeholderTextColor="#94a3b8" secureTextEntry />
        <TouchableOpacity style={[s.btn, { backgroundColor: '#1e3a8a', marginTop: 6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>ورود / ثبت‌نام</Text>}
        </TouchableOpacity>
        <Text style={s.loginNote}>اگر حساب ندارید، خودکار ساخته می‌شود</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f2438' },
  content: { flex: 1, backgroundColor: '#0f2438' },
  loading: { flex: 1, backgroundColor: '#0f2438', alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#0f2438', padding: 14, paddingTop: 8, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  hTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'right' },
  hSub: { color: '#d1d5db', fontSize: 12, marginTop: 4, textAlign: 'right' },
  themeBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tabsBar: { backgroundColor: '#1a2332', maxHeight: 100 },
  tabsCont: { paddingHorizontal: 8, paddingVertical: 8 },
  tab: { paddingHorizontal: 18, paddingVertical: 12, marginHorizontal: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 95, borderWidth: 2, borderColor: 'transparent' },
  tabIcon: { fontSize: 26, marginBottom: 2 },
  tabLbl: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  tabLblActive: { color: '#fff' },
  lock: { position: 'absolute', top: 4, left: 6, fontSize: 10 },
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#059669', padding: 12, borderRadius: 10, alignItems: 'center', zIndex: 9999 },
  toastTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  dash: { margin: 10, padding: 12, borderRadius: 14, backgroundColor: '#080b13', borderWidth: 2, borderColor: '#1f3a5f' },
  rangeBadge: { backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14, alignSelf: 'center' },
  rangeBadgeTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  clockRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, marginVertical: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10 },
  time: { color: '#00ff88', fontSize: 36, fontFamily: 'Orbitron_900Black', letterSpacing: 5 },
  dateTxt: { color: '#4ade80', fontSize: 18, fontFamily: 'ShareTechMono_400Regular', letterSpacing: 2 },
  profitBox: { alignItems: 'center', paddingVertical: 14, marginBottom: 14 },
  profitLbl: { color: '#94a3b8', fontSize: 14, marginBottom: 10, fontWeight: 'bold' },
  profitVal: { fontSize: 52, fontFamily: 'Orbitron_900Black', letterSpacing: 4 },
  profitUnit: { color: '#64748b', fontSize: 13, marginTop: 6, letterSpacing: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dItem: { width: '48%', padding: 12, marginBottom: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,255,136,0.18)', alignItems: 'center' },
  dLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6, fontWeight: 'bold' },
  dVal: { fontSize: 19, fontFamily: 'Orbitron_700Bold', letterSpacing: 2 },
  formTitle: { color: '#d4af37', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  secT: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginTop: 12, textAlign: 'right' },
  lbl: { color: '#94a3b8', fontSize: 11, marginBottom: 4, marginTop: 8, textAlign: 'right' },
  lblS: { color: '#94a3b8', fontSize: 10, marginBottom: 3, marginTop: 6, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, color: '#fff', textAlign: 'right' },
  addBtn: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 4 },
  addBtn2: { backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  itemCard: { backgroundColor: '#1a2332', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  itemN: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
  delBtnRound: { backgroundColor: '#dc2626', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  readonlyBox: { backgroundColor: '#0a1628', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, alignItems: 'center' },
  readonlyTxt: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  autoCalcBox: { backgroundColor: '#0a1628', borderWidth: 2, borderColor: '#334155', borderRadius: 8, padding: 10, alignItems: 'center' },
  autoCalcTxt: { color: '#00ff88', fontSize: 15, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  grandSummary: { backgroundColor: '#0f2438', borderRadius: 12, padding: 14, marginTop: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#d4af37' },
  gsLbl: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  gsVal: { color: '#00ff88', fontSize: 22, fontWeight: 'bold', fontFamily: 'Orbitron_900Black' },
  gsQty: { color: '#60a5fa', fontSize: 22, fontWeight: 'bold', fontFamily: 'Orbitron_900Black' },
  acBox: { backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginTop: 4, overflow: 'hidden' },
  acHdr: { padding: 8, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'right', backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#d4af37' },
  acItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  acItemTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },
  dateBox: { flexDirection: 'row', alignItems: 'center', padding: 6, backgroundColor: '#1a2332', borderWidth: 2, borderColor: '#334155', borderRadius: 8, gap: 1, flexWrap: 'nowrap' },
  dateInp: { padding: 4, color: '#fff', textAlign: 'center', fontSize: 13, fontFamily: 'ShareTechMono_400Regular', backgroundColor: 'transparent' },
  dateSep: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  typeBtn: { marginLeft: 'auto', padding: 4, backgroundColor: '#334155', borderRadius: 6 },
  typeBtnTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  invCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#1e3a8a' },
  invNum: { color: '#1e3a5f', fontSize: 13, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  invCust: { color: '#64748b', fontSize: 11, marginBottom: 6, textAlign: 'right' },
  invStat: { color: '#1a2332', fontSize: 11, fontFamily: 'ShareTechMono_400Regular' },
  invCode: { color: '#7c3aed', fontSize: 11, fontFamily: 'ShareTechMono_400Regular', fontWeight: 'bold' },
  invName: { color: '#0f2438', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  invQty: { fontSize: 22, fontWeight: 'bold', fontFamily: 'Orbitron_900Black' },
  invItem: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#10b981' },
  statusTag: { fontSize: 11, fontWeight: 'bold' },
  badge: { marginTop: 6, fontSize: 10, color: '#6d28d9', backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, textAlign: 'right', alignSelf: 'flex-end' },
  iconBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 6, alignItems: 'center' },
  statsCard: { backgroundColor: '#080b13', borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: '#1f3a5f' },
  statsLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  statsVal: { fontSize: 26, fontFamily: 'Orbitron_900Black' },
  statsUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  rptBadge: { color: '#1a2332', fontSize: 11, fontFamily: 'ShareTechMono_400Regular', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 4 },
  itemRow: { color: '#475569', fontSize: 11, marginBottom: 2, textAlign: 'right' },
  pCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#059669' },
  pName: { color: '#0f2438', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  pStat: { color: '#475569', fontSize: 11, fontFamily: 'ShareTechMono_400Regular', textAlign: 'right' },
  warnBox: { backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#fcd34d', borderRadius: 10, padding: 12, marginVertical: 8 },
  warnTxt: { color: '#78350f', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },
  sBox: { width: '31%', marginHorizontal: '1.16%', marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderRightWidth: 3, borderRightColor: '#10b981' },
  sBoxL: { color: '#64748b', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  sBoxV: { fontSize: 16, fontFamily: 'Orbitron_700Bold' },
  thresholdBox: { backgroundColor: '#1a2332', padding: 10, borderRadius: 10, marginTop: 8 },
  shelfBtn: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
  shelfTxt: { color: '#075985', fontSize: 11, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  subTabActive: { backgroundColor: '#c0392b', borderColor: '#c0392b' },
  subTabTxt: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  subTabTxtActive: { color: '#fff' },
  modalBg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.85)', justifyContent: 'center', padding: 16 },
  modalBox: { borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  modalHead: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeadTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  modalLbl: { color: '#64748b', fontSize: 12, marginBottom: 4, textAlign: 'right' },
  modalVal: { color: '#0f2438', fontWeight: 'bold' },
  modalInp: { borderWidth: 2, borderColor: '#a78bfa', borderRadius: 8, padding: 12, fontSize: 14, textAlign: 'center', color: '#0f2438' },
  pinInp: { borderWidth: 3, borderColor: '#d4af37', borderRadius: 12, padding: 16, fontSize: 24, textAlign: 'center', backgroundColor: '#fdfbf4', color: '#0f2438', letterSpacing: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  infoK: { color: '#64748b', fontSize: 12 },
  infoV: { color: '#1e3a5f', fontSize: 13, fontWeight: 'bold' },
  mgrHead: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 12 },
  mgrHeadTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  invoiceContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  invHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  invBrand: { fontSize: 16, fontWeight: 'bold', color: '#0f2438' },
  invSlogan: { fontSize: 9, color: '#1e3a5f' },
  invSmall: { fontSize: 9, color: '#475569', fontFamily: 'ShareTechMono_400Regular' },
  invTitle: { textAlign: 'center', fontSize: 15, fontWeight: 'bold', color: '#0f2438', marginTop: 8 },
  invDateTxt: { textAlign: 'center', fontSize: 9, color: '#64748b', marginBottom: 6 },
  invSection: { marginTop: 8 },
  invSectionTitle: { fontSize: 10, color: '#1e3a5f', fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 3, marginBottom: 5, textAlign: 'right' },
  invCGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  invCell: { backgroundColor: '#f8fafc', borderRadius: 5, padding: 4, borderWidth: 1, borderColor: '#e2e8f0', width: '48%' },
  invCellL: { fontSize: 8, color: '#64748b', marginBottom: 1, textAlign: 'right' },
  invCellV: { fontSize: 10, color: '#1e3a5f', fontWeight: 'bold', textAlign: 'right' },
  invTableHead: { flexDirection: 'row', backgroundColor: '#0f2438', padding: 4 },
  invTh: { color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  invRow: { flexDirection: 'row', padding: 3, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  invTd: { fontSize: 10, color: '#1e3a5f', textAlign: 'center' },
  invFooter: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#d4af37', alignItems: 'center' },
  invFooterTxt: { fontSize: 10, color: '#1e3a5f', fontFamily: 'ShareTechMono_400Regular', marginBottom: 3 },
  invFooterThanks: { fontSize: 10, color: '#78350f', fontWeight: 'bold' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sumLbl: { fontSize: 11, color: '#64748b' },
  sumValTxt: { fontSize: 11, color: '#1e3a5f', fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  loginWrap: { flex: 1, backgroundColor: '#0f2438', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 18, padding: 24 },
  loginLogo: { fontSize: 54, textAlign: 'center', marginBottom: 8 },
  loginTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#0f2438', marginBottom: 4 },
  loginSub: { fontSize: 13, textAlign: 'center', color: '#64748b', marginBottom: 24 },
  loginInp: { backgroundColor: '#f5f7fa', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 10, color: '#1a2332', textAlign: 'right' },
  loginNote: { textAlign: 'center', color: '#64748b', fontSize: 11, marginTop: 12 },
  searchCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderRightWidth: 4, borderRightColor: '#1e3a8a', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchRowNum: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  searchInvoice: { color: '#1e3a5f', fontSize: 15, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  searchTypeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  searchTypeTxt: { fontSize: 11, fontWeight: 'bold' },
  searchInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  searchInfoCell: { width: '50%', paddingVertical: 4 },
  searchInfoLbl: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  searchInfoVal: { color: '#1a2332', fontSize: 12, fontWeight: 'bold' },
  searchMoneyBox: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  searchMoneyLbl: { color: '#64748b', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  searchMoneyVal: { color: '#1e3a5f', fontSize: 14, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  searchStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  searchStatusTxt: { fontSize: 11, fontWeight: 'bold' },
  searchActionBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#dbeafe', borderRadius: 8 },
  searchActionTxt: { color: '#1e40af', fontSize: 12, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff', borderRadius: 12, marginTop: 12 },
  emptyStateTxt: { color: '#1a2332', fontSize: 15, fontWeight: 'bold', marginTop: 12 },
  emptyStateSub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 6 },
  emailTxt: { flex: 1, color: '#fff', fontSize: 12 },
});
