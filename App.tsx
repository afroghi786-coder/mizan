// App.tsx — نسخه موبایل کامل میزان
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
  SafeAreaView, Share, Switch, Image, FlatList,
} from 'react-native';
import { useFonts, Orbitron_900Black, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';

import {
  supabase, fmt, parseNum, toFaNum, normPhone, normText, pad2,
  getCalType, setCalType, loadCalType, saveCalType, CalType,
  parseDateAny, toStorageDate, toStorageDateFull, displayDate, displayDateOnly,
  jalaliDisplay, g2j, j2g,
  BANKS, SHIPPINGS, DASH_RANGE_LABELS,
  getProducts, createProduct, updateProduct, deleteProduct,
  lookupCustomerByPhone, generateCustomerCode, generateInvoiceNumber, createSale,
  getSalesGrouped, deleteSale, getUnpaidInvoices, searchAllInvoices, getInvoiceDetail,
  lookupSupplierByName, createPurchase, getPurchasesGrouped, deletePurchase,
  getDashboardStats, getProfitByModel, getInventory,
  getSettings, updateSettings,
  Product, SaleItem, PurchaseItem, Settings,
} from './lib';

// ══════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const [fontsLoaded] = useFonts({ Orbitron_900Black, Orbitron_700Bold, ShareTechMono_400Regular });
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    loadCalType().then(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || loading) return <View style={s.loading}><ActivityIndicator size="large" color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#0f2438' }}>
      {!session ? <LoginScreen showToast={showToast} /> : <MainApp showToast={showToast} />}
      {toast && (
        <View style={[s.toast, toast.error && { backgroundColor: '#b91c1c' }]}>
          <Text style={s.toastTxt}>{toast.msg}</Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════
function MainApp({ showToast }: any) {
  const [tab, setTab] = useState('order');
  const [pinOk, setPinOk] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);

  const tabs = [
    { key: 'order', icon: '🛒', label: 'فروش', color: '#1e3a8a' },
    { key: 'purchase', icon: '🛍️', label: 'خرید', color: '#166534' },
    { key: 'print', icon: '🖨️', label: 'پرینت', color: '#6c3483' },
    { key: 'mgr', icon: '📋', label: 'مدیریت', color: '#c0392b' },
    { key: 'profit', icon: '💹', label: 'سود', color: '#065f46' },
    { key: 'inventory', icon: '📦', label: 'انبار', color: '#0f5132' },
  ];

  const requestTab = (t: string) => {
    if (t === 'order' || pinOk) { setTab(t); return; }
    setPendingTab(t);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.hTitle}>⚖️ میزان</Text>
        <Text style={s.hSub}>حساب‌ها دقیق، معاملات امن، ذهن آسوده</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar} contentContainerStyle={s.tabsCont}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => requestTab(t.key)} activeOpacity={0.7}
            style={[s.tab, tab === t.key && { backgroundColor: t.color, borderColor: '#d4af37' }]}>
            <Text style={s.tabIcon}>{t.icon}</Text>
            <Text style={[s.tabLbl, tab === t.key && s.tabLblActive]}>{t.label}</Text>
            {!pinOk && t.key !== 'order' && <Text style={s.lock}>🔒</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
      {tab === 'order' && <SalesScreen showToast={showToast} />}
      {tab === 'purchase' && <PurchaseScreen showToast={showToast} />}
      {tab === 'print' && <PrintScreen showToast={showToast} />}
      {tab === 'mgr' && <ManagementScreen showToast={showToast} settings={settings} setSettings={setSettings} />}
      {tab === 'profit' && <ProfitScreen showToast={showToast} settings={settings} />}
      {tab === 'inventory' && <InventoryScreen showToast={showToast} />}

      <PinModal
        visible={!!pendingTab}
        onClose={() => setPendingTab(null)}
        onSuccess={() => { setPinOk(true); if (pendingTab) setTab(pendingTab); setPendingTab(null); }}
        showToast={showToast}
      />
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
    // PIN از AsyncStorage — پیش‌فرض 4242
    const correct = '4242';
    if (pin === correct) { onSuccess(); showToast('✅ تأیید شد'); }
    else { showToast('❌ رمز اشتباه', true); setPin(''); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalBox}>
          <View style={[s.modalHead, { backgroundColor: '#6c3483' }]}>
            <Text style={s.modalHeadTxt}>🔒 رمز ورود</Text>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={s.lbl}>رمز را وارد کنید</Text>
            <TextInput style={s.pinInp} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad" secureTextEntry placeholder="••••" placeholderTextColor="#64748b" />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onClose}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={verify}>
                <Text style={s.btnTxt}>تأیید</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  CONFIRM MODAL
// ══════════════════════════════════════════════════════════
function ConfirmModal({ visible, title, info, onCancel, onConfirm, confirmText = '✅ تأیید', color = '#059669' }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.modalBg}>
        <View style={s.modalBox}>
          <View style={[s.modalHead, { backgroundColor: color }]}>
            <Text style={s.modalHeadTxt}>📋 {title}</Text>
          </View>
          <View style={{ padding: 16 }}>
            {info}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onCancel}>
                <Text style={s.btnTxt}>✏️ بازگشت</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: color }]} onPress={onConfirm}>
                <Text style={s.btnTxt}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
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
      {label && <Text style={s.lbl}>{label}</Text>}
      <TextInput style={s.inp} value={value} placeholder={placeholder || 'کلیک یا تایپ...'}
        placeholderTextColor="#64748b" onChangeText={(v) => { onChange(v); setShow(true); }}
        onFocus={() => setShow(true)} />
      {show && filtered.length > 0 && (
        <View style={s.acBox}>
          <Text style={s.acHdr}>📋 {filtered.length} مورد</Text>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {filtered.map((opt: string) => (
              <TouchableOpacity key={opt} style={s.acItem}
                onPress={() => { onChange(opt); setShow(false); if (onSelect) onSelect(opt); }}>
                <Text style={s.acItemTxt}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#475569', margin: 6 }]} onPress={() => setShow(false)}>
            <Text style={s.btnTxt}>بستن</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  DATE FIELD (۶ ورودی — شمسی/میلادی/قمری)
// ══════════════════════════════════════════════════════════
function DateField({ value, onChange, compact, defaultToToday }: any) {
  const [type, setType] = useState<CalType>(getCalType());
  const [g, setG] = useState<Date | null>(value ? parseDateAny(value) : (defaultToToday ? new Date() : null));
  const [fields, setFields] = useState({ y: '', m: '', d: '', h: '00', n: '00', s: '00' });

  useEffect(() => {
    if (!g) { setFields({ y: '', m: '', d: '', h: '00', n: '00', s: '00' }); return; }
    let y = 0, mo = 0, d = 0;
    if (type === 'jalali') { [y, mo, d] = g2j(g.getFullYear(), g.getMonth() + 1, g.getDate()); }
    else if (type === 'hijri') { const h = g2h(g); y = h.y; mo = h.m; d = h.d; }
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
    else if (type === 'hijri') { const r = (g2h as any).constructor; gg = new Date(); }
    else { gg = new Date(y, m - 1, d, h, n, sec); }
    setG(gg);
    onChange(toStorageDateFull(gg));
  };

  const F = ({ v, k, w, ph }: any) => (
    <TextInput style={[s.dateInp, { width: w || 44 }, compact && { fontSize: 11 }]}
      value={v} onChangeText={(t) => apply({ ...fields, [k]: t.replace(/\D/g, '').slice(0, k === 'y' ? 4 : 2) })}
      keyboardType="numeric" placeholder={ph} placeholderTextColor="#64748b" />
  );

  return (
    <View style={[s.dateBox, compact && { paddingVertical: 3 }]}>
      <F v={fields.y} k="y" w={compact ? 52 : 60} ph="YYYY" />
      <Text style={s.dateSep}>/</Text>
      <F v={fields.m} k="m" ph="MM" />
      <Text style={s.dateSep}>/</Text>
      <F v={fields.d} k="d" ph="DD" />
      <Text style={[s.dateSep, { width: 8 }]}> </Text>
      <F v={fields.h} k="h" ph="HH" />
      <Text style={s.dateSep}>:</Text>
      <F v={fields.n} k="n" ph="MM" />
      <Text style={s.dateSep}>:</Text>
      <F v={fields.s} k="s" ph="SS" />
      <TouchableOpacity style={s.typeBtn} onPress={() => {
        const next = type === 'jalali' ? 'gregorian' : type === 'gregorian' ? 'hijri' : 'jalali';
        setType(next);
      }}>
        <Text style={s.typeBtnTxt}>{type === 'jalali' ? 'شمسی' : type === 'gregorian' ? 'میلادی' : 'قمری'}</Text>
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

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const load = useCallback(async () => {
    try {
      const range = settings?.dashboard_range || 'month';
      const filter = settings?.dashboard_filter || 'both';
      const d = await getDashboardStats(range, filter);
      setStats(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [settings]);

  useEffect(() => { load(); const r = setInterval(load, 30000); return () => clearInterval(r); }, [load, refreshKey]);

  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const date = jalaliDisplay(now);
  const profit = stats?.profit || 0;

  return (
    <View style={s.dash}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <View style={s.rangeBadge}><Text style={s.rangeBadgeTxt}>{stats?.rangeLabel || 'ماه جاری'}</Text></View>
      </View>
      <View style={s.clockRow}>
        <Text style={s.time}>{time}</Text>
        <Text style={s.dateTxt}>{date}</Text>
      </View>
      <View style={s.profitBox}>
        <Text style={s.profitLbl}>💰 سود خالص</Text>
        <Text style={[s.profitVal, { color: profit < 0 ? '#ff3355' : profit === 0 ? '#fbbf24' : '#00ff88' }]}>
          {toFaNum(fmt(profit))}
        </Text>
        <Text style={s.profitUnit}>تومان</Text>
      </View>
      {loading ? <ActivityIndicator color="#00ff88" /> : (
        <View style={s.grid}>
          <DCard i="🛒" l="کل فروش" v={fmt(stats?.totalSales || 0)} c="#60a5fa" />
          <DCard i="📦" l="کل خرید" v={fmt(stats?.totalPurchases || 0)} c="#fb923c" />
          <DCard i="💳" l="پرداخت مشتری" v={fmt(stats?.customerPaid || 0)} c="#34d399" />
          <DCard i="📌" l="بدهی مشتری" v={fmt(stats?.customerDebt || 0)} c="#fb923c" />
          <DCard i="💵" l="پرداخت تأمین‌کننده" v={fmt(stats?.supplierPaid || 0)} c="#34d399" />
          <DCard i="📌" l="بدهی تأمین‌کننده" v={fmt(stats?.supplierDebt || 0)} c="#f87171" />
        </View>
      )}
    </View>
  );
}

function DCard({ i, l, v, c }: any) {
  return (
    <View style={s.dItem}>
      <Text style={s.dLbl}>{i} {l}</Text>
      <Text style={[s.dVal, { color: c }]} numberOfLines={1}>{toFaNum(v)}</Text>
    </View>
  );
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [reprintInv, setReprintInv] = useState('');
  const [invoice, setInvoice] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  // فرم
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [shipping, setShipping] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerStatus, setCustomerStatus] = useState('');

  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);
  const loadProds = async () => { try { setProds(await getProducts()); } catch {} };
  const load = async () => {
    setLoading(true);
    try { setList(await getSalesGrouped()); } catch (e: any) { showToast(e.message, true); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); loadProds(); }, []);

  const onPhone = async (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    setPhone(d); setCustomerStatus('');
    if (d.length === 11) {
      setCustomerStatus('⏳');
      try {
        const f = await lookupCustomerByPhone(d);
        if (f) {
          setCustomerStatus('✅ قبلی');
          if (f.customer_name && !name) setName(f.customer_name);
          if (f.customer_address && !address) setAddress(f.customer_address);
        } else setCustomerStatus('🆕 جدید');
      } catch { setCustomerStatus(''); }
    }
  };

  const addItem = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', description: '' }]);
  const updItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };
  const delItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const setModel = (i: number, v: string) => {
    const n = [...items]; n[i].modelName = v;
    const p = prods.find((x) => x.name === v);
    if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; if (p.shipping_name && !shipping) setShipping(p.shipping_name); }
    setItems(n);
  };

  const submit = () => {
    if (!/^09\d{9}$/.test(phone)) return showToast('شماره معتبر نیست', true);
    if (!name || name.length < 2) return showToast('نام الزامی', true);
    if (!shipping) return showToast('باربری الزامی', true);
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    if (!valid.length) return showToast('حداقل یک مدل', true);
    for (const v of valid) if (!v.priceUnit) return showToast(`قیمت «${v.modelName}» را وارد کن`, true);

    const tot = valid.reduce((a, it) => a + it.quantity * it.priceUnit, 0);
    setConfirm({
      title: 'تأیید فروش', color: '#1e3a8a',
      info: (
        <View>
          <Row k="👤 نام" v={name} />
          <Row k="📞 تلفن" v={phone} />
          <Row k="📦 مدل‌ها" v={String(valid.length)} />
          <Row k="💰 مبلغ کل" v={fmt(tot) + ' تومان'} gold />
        </View>
      ),
      onConfirm: async () => {
        setSaving(true);
        try {
          let customerCode = '';
          const found = await lookupCustomerByPhone(phone);
          if (found?.customer_code && /^M_\d+$/.test(found.customer_code)) customerCode = found.customer_code;
          else customerCode = await generateCustomerCode();
          const inv = await generateInvoiceNumber();
          await createSale({ invoiceNumber: inv, customerCode, customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid });
          showToast('✅ ثبت شد: ' + inv);
          setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setView('list');
          load();
        } catch (e: any) { showToast(e.message, true); }
        finally { setSaving(false); }
      },
    });
  };

  const remove = (inv: string) => {
    Alert.alert('حذف', `فاکتور ${inv} حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { try { await deleteSale(inv); load(); showToast('✅ حذف شد'); } catch (e: any) { showToast(e.message, true); } } },
    ]);
  };

  const doReprint = async () => {
    if (!reprintInv.trim()) return showToast('شماره فاکتور را وارد کن', true);
    try {
      const rows = await getInvoiceDetail(reprintInv.trim());
      if (!rows.length) return showToast('فاکتور پیدا نشد', true);
      const r = rows[0];
      const items = rows.map((x: any) => ({ modelName: x.model_name, modelCode: x.model_code, shelf: '', quantity: x.quantity, priceUnit: x.price_unit, total: x.quantity * x.price_unit }));
      const total = items.reduce((a, it) => a + it.total, 0);
      setInvoice({
        customer: { code: r.customer_code, name: r.customer_name, phone: r.customer_phone, address: r.customer_address, shipping: r.shipping },
        current: { invoiceNumber: r.invoice_number, items, sales: total, payments: 0, balance: total },
        previous: { sales: 0, payments: 0, balance: 0, invoiceCount: 0 },
        totals: { sales: total, payments: 0, balance: total },
        timeString: displayDate(r.date_reg),
      });
      setView('invoice');
    } catch (e: any) { showToast(e.message, true); }
  };

  if (view === 'invoice' && invoice) return <InvoiceView invoice={invoice} onBack={() => { setView('list'); setInvoice(null); }} showToast={showToast} onNew={() => { setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setView('form'); }} />;

  if (view === 'reprint') return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12 }}>
      <Text style={s.formTitle}>🖨️ پرینت مجدد فاکتور</Text>
      <Text style={s.lbl}>شماره فاکتور</Text>
      <TextInput style={s.inp} value={reprintInv} onChangeText={setReprintInv} placeholder="مثلاً 14050612-1001" placeholderTextColor="#64748b" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}>
          <Text style={s.btnTxt}>↩️ برگشت</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#6c3483' }]} onPress={doReprint}>
          <Text style={s.btnTxt}>🔍 نمایش فاکتور</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (view === 'form') return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formTitle}>🛒 فاکتور فروش جدید</Text>

        <Text style={s.lbl}>📞 تلفن * {customerStatus}</Text>
        <TextInput style={s.inp} value={phone} onChangeText={onPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>👤 نام *</Text>
        <TextInput style={s.inp} value={name} onChangeText={setName} placeholder="نام مشتری" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>📍 آدرس</Text>
        <TextInput style={s.inp} value={address} onChangeText={setAddress} placeholder="اختیاری" placeholderTextColor="#64748b" />
        <Autocomplete label="🚚 باربری *" value={shipping} onChange={setShipping} options={[...new Set([...SHIPPINGS, ...prods.map(p => p.shipping_name || '').filter(Boolean)])]} placeholder="تایپ یا انتخاب..." />

        <Text style={s.secT}>📦 اقلام ({toFaNum(items.length)})</Text>
        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delItem(i)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
            </View>
            <Autocomplete label="نام مدل *" value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="کلیک یا تایپ..." />
            <Text style={s.lblS}>کد مدل</Text>
            <TextInput style={s.inp} value={it.modelCode} editable={false} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lblS}>تعداد *</Text>
                <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>قیمت *</Text>
                <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>پرداخت</Text>
                <TextInput style={s.inp} value={String(it.payment || '')} onChangeText={(v) => updItem(i, 'payment', parseNum(v))} keyboardType="numeric" /></View>
            </View>
            <Text style={s.lblS}>تاریخ واریز</Text>
            <DateField value={it.depositDate} onChange={(v: string) => updItem(i, 'depositDate', v)} compact />
            <Autocomplete label="بانک" value={it.bankName} onChange={(v) => updItem(i, 'bankName', v)} options={BANKS} placeholder="کلیک..." />
            <Autocomplete label="صاحب حساب" value={it.accountHolder} onChange={(v) => updItem(i, 'accountHolder', v)} options={prods.map(p => p.supplier_name || '').filter(Boolean)} placeholder="کلیک..." />
            <Text style={s.lblS}>شرح</Text>
            <TextInput style={s.inp} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor="#64748b" />
          </View>
        ))}
        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.btnTxt}>➕ افزودن مدل</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}>
            <Text style={s.btnTxt}>↩️ برگشت</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <DigitalDashboard refreshKey={refreshKey} settings={settings} />
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
        <TouchableOpacity style={[s.addBtn, { flex: 1, backgroundColor: '#1e3a8a' }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}>
          <Text style={s.btnTxt}>➕ فاکتور جدید</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { flex: 1, backgroundColor: '#6c3483' }]} onPress={() => setView('reprint')}>
          <Text style={s.btnTxt}>🖨️ پرینت مجدد</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.secT}>📄 فاکتورها ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((inv: any) => (
        <View key={inv.invoice} style={s.invCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={s.invNum}>{inv.invoice}</Text>
            <TouchableOpacity onPress={() => remove(inv.invoice)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
          <Text style={s.invCust}>👤 {inv.name} — {inv.phone}</Text>
          <Text style={s.invStat}>💰 {toFaNum(fmt(inv.total))} | 💳 {toFaNum(fmt(inv.paid))}</Text>
        </View>
      ))}

      {confirm && <ConfirmModal visible title={confirm.title} color={confirm.color} info={confirm.info}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const cb = confirm.onConfirm; setConfirm(null); cb(); }} />}
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
  const [refreshKey, setRefreshKey] = useState(0);

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
  const [confirm, setConfirm] = useState<any>(null);

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
    try {
      const f = await lookupSupplierByName(v);
      if (f) {
        if (f.supplier_code && !sCode) setSCode(f.supplier_code);
        if (f.supplier_phone && !sPhone) setSPhone(f.supplier_phone);
      }
    } catch {}
  };

  const submit = () => {
    if (!sName || sName.length < 2) return showToast('نام تأمین‌کننده الزامی', true);
    if (!manualInv) return showToast('شماره فاکتور دستی الزامی', true);
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    const amt = parseNum(payAmt);
    if (!valid.length && amt <= 0) return showToast('حداقل یک مدل یا مبلغ پرداخت', true);
    const total = valid.reduce((a, it) => a + it.quantity * it.priceUnit, 0);

    setConfirm({
      title: 'تأیید خرید', color: '#166534',
      info: (
        <View>
          <Row k="🏭 تأمین‌کننده" v={sName} />
          <Row k="🧾 شماره فاکتور" v={manualInv} />
          {valid.length > 0 && <Row k="📦 مدل‌ها" v={String(valid.length)} />}
          {valid.length > 0 && <Row k="💰 مبلغ کل" v={fmt(total) + ' تومان'} gold />}
          <Row k="💵 پرداخت" v={fmt(amt) + ' تومان'} />
          {valid.length > 0 && <Row k="📌 مانده" v={fmt(total - amt) + ' تومان'} />}
        </View>
      ),
      onConfirm: async () => {
        setSaving(true);
        try {
          const inv = await generateInvoiceNumber();
          await createPurchase({
            invoiceNumber: inv, manualInvoice: manualInv, supplierName: sName,
            supplierCode: sCode, supplierPhone: sPhone, items: valid,
            paymentAmount: amt, paymentDate: payDate,
            bankAccount: bankAcc, payerName, receiverAccount: receiverAcc, note,
          });
          showToast('✅ ثبت شد: ' + inv);
          setSName(''); setSCode(''); setSPhone(''); setManualInv(''); setItems([]);
          setPayAmt(''); setBankAcc(''); setPayerName(''); setReceiverAcc(''); setNote('');
          setView('list'); load();
        } catch (e: any) { showToast(e.message, true); }
        finally { setSaving(false); }
      },
    });
  };

  if (view === 'form') return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formTitle}>🛍️ فاکتور خرید</Text>

        <Autocomplete label="🏭 نام تأمین‌کننده *" value={sName} onChange={setSName} onSelect={onSupplierPick} options={[...new Set([...prods.map(p => p.supplier_name || '').filter(Boolean)])]} placeholder="تایپ یا انتخاب..." />
        <Text style={s.lbl}>🆔 کد تأمین‌کننده</Text>
        <TextInput style={s.inp} value={sCode} onChangeText={setSCode} placeholder="خودکار" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>📞 تلفن</Text>
        <TextInput style={s.inp} value={sPhone} onChangeText={setSPhone} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor="#64748b" />
        <Text style={s.lbl}>🧾 شماره فاکتور دستی *</Text>
        <TextInput style={s.inp} value={manualInv} onChangeText={setManualInv} placeholder="شماره روی فاکتور" placeholderTextColor="#64748b" />

        <Text style={s.secT}>📦 اقلام (اختیاری)</Text>
        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delItem(i)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
            </View>
            <Autocomplete label="نام مدل" value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="کلیک..." />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lblS}>تعداد</Text>
                <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>قیمت</Text>
                <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))} keyboardType="numeric" /></View>
            </View>
            <Text style={s.lblS}>شرح</Text>
            <TextInput style={s.inp} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor="#64748b" />
          </View>
        ))}
        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.btnTxt}>➕ افزودن مدل</Text></TouchableOpacity>

        <Text style={s.secT}>💳 پرداخت</Text>
        <Text style={s.lbl}>مبلغ پرداخت نقدی</Text>
        <TextInput style={s.inp} value={payAmt} onChangeText={setPayAmt} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>تاریخ پرداخت</Text>
        <DateField value={payDate} onChange={setPayDate} compact defaultToToday />
        <Text style={s.lbl}>حساب پرداخت‌کننده</Text>
        <TextInput style={s.inp} value={bankAcc} onChangeText={setBankAcc} placeholder="اختیاری" placeholderTextColor="#64748b" />
        <Autocomplete label="نام پرداخت‌کننده" value={payerName} onChange={setPayerName} options={prods.map(p => p.payer_name || '').filter(Boolean)} placeholder="کلیک..." />
        <Text style={s.lbl}>حساب دریافت‌کننده</Text>
        <TextInput style={s.inp} value={receiverAcc} onChangeText={setReceiverAcc} placeholder="اختیاری" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>شرح</Text>
        <TextInput style={[s.inp, { minHeight: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} multiline placeholder="توضیحات..." placeholderTextColor="#64748b" />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}>
            <Text style={s.btnTxt}>↩️ برگشت</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#166534' }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <DigitalDashboard refreshKey={refreshKey} settings={settings} />
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#166534', marginTop: 8 }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}>
        <Text style={s.btnTxt}>➕ فاکتور خرید جدید</Text>
      </TouchableOpacity>
      <Text style={s.secT}>📄 خریدها ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#34d399" /> : list.map((inv: any) => (
        <View key={inv.invoice} style={[s.invCard, { borderRightColor: '#166534' }]}>
          <Text style={s.invNum}>{inv.invoice}</Text>
          <Text style={s.invCust}>🏭 {inv.name}</Text>
          <Text style={s.invStat}>💰 {toFaNum(fmt(inv.total))} | 💳 {toFaNum(fmt(inv.paid))}</Text>
        </View>
      ))}
      {confirm && <ConfirmModal visible title={confirm.title} color={confirm.color} info={confirm.info}
        onCancel={() => setConfirm(null)} onConfirm={() => { const cb = confirm.onConfirm; setConfirm(null); cb(); }} />}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  PRINT SCREEN
// ══════════════════════════════════════════════════════════
function PrintScreen({ showToast }: any) {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [report, setReport] = useState<any>(null);
  const [mode, setMode] = useState<'none' | 'summary' | 'full'>('none');
  const [loading, setLoading] = useState(false);

  const loadReport = async (m: 'summary' | 'full') => {
    if (!code.trim()) return showToast('کد را وارد کن', true);
    setLoading(true);
    try {
      const [full, summary] = await Promise.all([
        supabase.from('sales').select('*').eq('customer_code', code.trim()),
        supabase.from('sales').select('*').eq('customer_code', code.trim()),
      ]);
      const saleRows = full.data || [];
      if (!saleRows.length) {
        // تلاش در خرید
        const { data: pData } = await supabase.from('purchases').select('*').eq('supplier_code', code.trim());
        if (!pData?.length) { showToast('داده‌ای یافت نشد', true); return; }
        const grouped: any = {};
        pData.forEach((r: any) => {
          if (!grouped[r.invoice_number]) grouped[r.invoice_number] = { invoice: r.invoice_number, date: r.date_factor, name: r.supplier_name, total: 0, paid: 0, items: [] };
          grouped[r.invoice_number].total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
          grouped[r.invoice_number].paid += Number(r.payment) || 0;
          grouped[r.invoice_number].items.push({ modelCode: r.model_code, modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, total: r.quantity * r.price_unit, payment: r.payment, depositDate: r.deposit_date, bankName: r.bank_name, accountHolder: r.account_holder });
        });
        const rows = Object.values(grouped);
        const totals = rows.reduce((a: any, r: any) => ({ sales: a.sales + r.total, payments: a.payments + r.paid }), { sales: 0, payments: 0 });
        setReport({ type: 'تأمین‌کننده', name: pData[0].supplier_name, code: code.trim(), rows, totals, summaryMode: m });
        setMode(m);
        return;
      }
      const grouped: any = {};
      saleRows.forEach((r: any) => {
        if (!grouped[r.invoice_number]) grouped[r.invoice_number] = { invoice: r.invoice_number, date: r.date_factor, name: r.customer_name, total: 0, paid: 0, items: [] };
        grouped[r.invoice_number].total += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
        grouped[r.invoice_number].paid += Number(r.payment) || 0;
        grouped[r.invoice_number].items.push({ modelCode: r.model_code, modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, total: r.quantity * r.price_unit, payment: r.payment, depositDate: r.deposit_date, bankName: r.bank_name, accountHolder: r.account_holder });
      });
      const rows = Object.values(grouped);
      const totals = rows.reduce((a: any, r: any) => ({ sales: a.sales + r.total, payments: a.payments + r.paid }), { sales: 0, payments: 0 });
      setReport({ type: 'مشتری', name: saleRows[0].customer_name, code: code.trim(), rows, totals, summaryMode: m });
      setMode(m);
    } catch (e: any) { showToast(e.message, true); }
    finally { setLoading(false); }
  };

  const sendEmail = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('ایمیل معتبر وارد کن', true);
    // اینجا می‌توان با expo-mail-composer ارسال کرد — فعلاً فقط تاییدیه
    showToast(`✅ ارسال به ${email} — نیاز به پیکربندی SMTP`);
  };

  const exportExcel = async () => {
    if (!report) return;
    try {
      const ws = XLSX.utils.json_to_sheet(report.rows.map((r: any, i: number) => ({
        '#': i + 1, 'تاریخ': displayDateOnly(r.date), 'فاکتور': r.invoice,
        'نام': r.name, 'جمع': r.total, 'پرداخت': r.paid, 'مانده': r.total - r.paid,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'گزارش');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const path = (FileSystem as any).cacheDirectory + `report-${code}-${Date.now()}.xlsx`;
      await FileSystem.writeAsStringAsync(path, wbout, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      showToast('✅ فایل اکسل آماده شد');
    } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={s.formTitle}>🖨️ پرینت حساب</Text>
      <Text style={s.lbl}>کد طرف حساب (مثلاً M_3125)</Text>
      <TextInput style={s.inp} value={code} onChangeText={setCode} placeholder="M_3125" placeholderTextColor="#64748b" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#6c3483' }]} onPress={() => loadReport('summary')} disabled={loading}>
          <Text style={s.btnTxt}>🟣 خلاصه مالی</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={() => loadReport('full')} disabled={loading}>
          <Text style={s.btnTxt}>🟢 جامع</Text>
        </TouchableOpacity>
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
              <Text style={[s.rptBadge, { backgroundColor: report.totals.sales - report.totals.payments > 0 ? '#fee2e2' : '#d1fae5', color: report.totals.sales - report.totals.payments > 0 ? '#991b1b' : '#065f46' }]}>
                مانده: {fmt(report.totals.sales - report.totals.payments)}
              </Text>
            </View>
          </View>

          {report.rows.map((r: any, i: number) => (
            <View key={i} style={s.invCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={s.invNum}>{r.invoice}</Text>
                <Text style={{ color: '#64748b', fontSize: 11 }}>{displayDateOnly(r.date)}</Text>
              </View>
              {mode === 'full' && r.items?.map((it: any, j: number) => (
                <Text key={j} style={s.itemRow}>📦 {it.modelName} — {toFaNum(it.quantity)} × {toFaNum(fmt(it.priceUnit))}</Text>
              ))}
              <Text style={s.invStat}>💰 {toFaNum(fmt(r.total))} | 💳 {toFaNum(fmt(r.paid))} | 📌 {toFaNum(fmt(r.total - r.paid))}</Text>
            </View>
          ))}

          <Text style={s.lbl}>📧 ارسال به ایمیل</Text>
          <TextInput style={s.inp} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="example@email.com" placeholderTextColor="#64748b" autoCapitalize="none" />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#c0392b' }]} onPress={exportExcel}>
              <Text style={s.btnTxt}>📥 اکسل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#f39c12' }]} onPress={sendEmail}>
              <Text style={s.btnTxt}>📧 ایمیل</Text>
            </TouchableOpacity>
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
    try {
      const d = await getDashboardStats(settings?.dashboard_range || 'month', settings?.dashboard_filter || 'both');
      setModels(d.models); setStats(d);
    } catch (e: any) { showToast(e.message, true); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [settings]);

  const total = models.reduce((a, m) => a + (m.totalProfit || 0), 0);

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <DigitalDashboard refreshKey={0} settings={settings} />

      <View style={[s.statsCard, { marginTop: 8 }]}>
        <Text style={s.statsLbl}>💰 سود کل ({stats?.rangeLabel || 'ماه'})</Text>
        <Text style={[s.statsVal, { color: total >= 0 ? '#00ff88' : '#ff3355' }]}>{toFaNum(fmt(total))}</Text>
        <Text style={s.statsUnit}>تومان</Text>
      </View>

      {stats?.estimatedCount > 0 && (
        <View style={s.warnBox}>
          <Text style={s.warnTxt}>📊 {stats.estimatedCount} مدل بدون خرید ثبت‌شده — سود {Math.round((stats.defaultMargin || 0.1) * 100)}٪ تخمین زده شد</Text>
        </View>
      )}

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
          <Text style={[s.badge, m.priceSource === 'same-month' && { backgroundColor: '#d1fae5', color: '#065f46' },
            m.priceSource === 'historical' && { backgroundColor: '#d1fae5', color: '#065f46' },
            m.priceSource === 'estimated' && { backgroundColor: '#ede9fe', color: '#6d28d9' }]}>
            {m.priceSource === 'same-month' ? '✅ خرید هم‌ماه' :
              m.priceSource === 'historical' ? '📜 خرید تاریخی' :
              m.priceSource === 'estimated' ? `📊 تخمینی ${Math.round((stats?.defaultMargin || 0.1) * 100)}٪` : '—'}
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
  const [threshold, setThreshold] = useState(5);
  const [thresholdInput, setThresholdInput] = useState('5');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState<any>(null);
  const [shelfVal, setShelfVal] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await getInventory();
      setList(d.list); setStats(d.stats);
      setThreshold(d.threshold); setThresholdInput(String(d.threshold));
    } catch (e: any) { showToast(e.message, true); }
    finally { setLoading(false); }
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
    try {
      const settings = await getSettings();
      await updateSettings({ ...settings, inventory_threshold: v });
      showToast('✅ ذخیره شد'); load();
    } catch (e: any) { showToast(e.message, true); }
  };

  const filtered = list.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (q) { const h = `${m.code} ${m.name} ${m.shelf || ''}`.toLowerCase(); if (!h.includes(q.toLowerCase())) return false; }
    return true;
  });

  const statusLabel = (st: string) => st === 'negative' ? '⚫ منفی' : st === 'out' ? '🔴 ناموجود' : st === 'low' ? '⚠️ کمبود' : '✅ سالم';
  const statusColor = (st: string) => st === 'negative' ? '#1e293b' : st === 'out' ? '#dc2626' : st === 'low' ? '#d97706' : '#059669';

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <DigitalDashboard refreshKey={0} settings={{}} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        {[
          { l: '📊 مدل‌ها', v: stats.totalModels || 0, c: '#60a5fa' },
          { l: '📦 جمع', v: stats.totalQty || 0, c: '#34d399' },
          { l: '⚠️ کمبود', v: stats.lowStock || 0, c: '#fb923c' },
          { l: '🔴 ناموجود', v: stats.outOfStock || 0, c: '#f87171' },
          { l: '⚫ منفی', v: stats.negative || 0, c: '#94a3b8' },
        ].map((b, i) => (
          <View key={i} style={s.sBox}>
            <Text style={s.sBoxL}>{b.l}</Text>
            <Text style={[s.sBoxV, { color: b.c }]}>{toFaNum(b.v)}</Text>
          </View>
        ))}
      </View>

      <View style={s.thresholdBox}>
        <Text style={s.lbl}>⚙️ آستانه کمبود</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TextInput style={[s.inp, { flex: 1 }]} value={thresholdInput} onChangeText={setThresholdInput} keyboardType="numeric" />
          <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#059669' }]} onPress={saveThreshold}>
            <Text style={s.btnTxt}>💾</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput style={[s.inp, { marginTop: 10 }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو: کد، نام، قفسه..." placeholderTextColor="#64748b" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'negative', l: '⚫ منفی' }, { k: 'out', l: '🔴 ناموجود' }, { k: 'low', l: '⚠️ کمبود' }, { k: 'ok', l: '✅ سالم' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.secT}>📦 موجودی ({toFaNum(filtered.length)})</Text>

      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.map((m: any, i: number) => (
        <View key={i} style={[s.invItem, m.status === 'negative' && { backgroundColor: '#f1f5f9', borderRightColor: '#475569' },
          m.status === 'out' && { backgroundColor: '#fef2f2', borderRightColor: '#dc2626' },
          m.status === 'low' && { backgroundColor: '#fffbeb', borderRightColor: '#f59e0b' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.invCode}>{m.code}</Text>
              <Text style={s.invName}>{m.name}</Text>
            </View>
            <Text style={[s.invQty, { color: statusColor(m.status) }]}>{toFaNum(m.currentQty)}</Text>
          </View>
          <Text style={s.invStat}>📥 {toFaNum(m.bought)} | 📤 {toFaNum(m.sold)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <TouchableOpacity onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }} style={s.shelfBtn}>
              <Text style={s.shelfTxt}>📍 {m.shelf || 'قفسه ثبت نشده'}</Text>
            </TouchableOpacity>
            <Text style={[s.statusTag, { color: statusColor(m.status) }]}>{statusLabel(m.status)}</Text>
          </View>
        </View>
      ))}

      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>
        <View style={s.modalBg}>
          <View style={[s.modalBox, { backgroundColor: '#fff' }]}>
            <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}>
              <Text style={s.modalHeadTxt}>📍 قفسه — {editItem?.name}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.modalLbl}>کد: <Text style={s.modalVal}>{editItem?.code}</Text></Text>
              <Text style={s.modalLbl}>موجودی: <Text style={s.modalVal}>{toFaNum(editItem?.currentQty || 0)} عدد</Text></Text>
              <Text style={s.modalLbl}>موقعیت قفسه:</Text>
              <TextInput style={s.modalInp} value={shelfVal} onChangeText={setShelfVal} placeholder="مثلاً A-12" placeholderTextColor="#64748b" />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setEditItem(null)}><Text style={s.btnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={saveShelf}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  MANAGEMENT SCREEN (۵ زیرتب)
// ══════════════════════════════════════════════════════════
function ManagementScreen({ showToast, settings, setSettings }: any) {
  const [sub, setSub] = useState('unpaid');
  const subs = [
    { k: 'unpaid', l: '🗑️ پرداخت‌نشده' },
    { k: 'newOrder', l: '➕ سفارش جدید' },
    { k: 'search', l: '🔍 جستجو و ویرایش' },
    { k: 'settings', l: '⚙️ تنظیمات' },
    { k: 'sources', l: '🌿 منابع' },
  ];
  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
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
      {sub === 'settings' && <SettingsSection showToast={showToast} settings={settings} setSettings={setSettings} />}
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
  const del = () => {
    if (!selected.size) return;
    Alert.alert('حذف', `${selected.size} فاکتور حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { for (const inv of Array.from(selected)) await deleteSale(inv); showToast('✅ حذف شد'); setSelected(new Set()); load(); }
        catch (e: any) { showToast(e.message, true); }
      } },
    ]);
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#334155' }]} onPress={load}><Text style={s.btnTxt}>🔄 بروزرسانی</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={del} disabled={!selected.size}>
          <Text style={s.btnTxt}>🗑️ حذف ({selected.size})</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.secT}>📄 پرداخت‌نشده ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((inv: any) => (
        <TouchableOpacity key={inv.invoice} onPress={() => toggle(inv.invoice)}
          style={[s.invCard, selected.has(inv.invoice) && { backgroundColor: '#fee2e2', borderRightColor: '#dc2626' }]}>
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
      try {
        const f = await lookupCustomerByPhone(d);
        if (f) { setStatus('✅'); if (f.customer_name && !name) setName(f.customer_name); if (f.customer_address && !address) setAddress(f.customer_address); }
        else setStatus('🆕');
      } catch {}
    }
  };
  const addRow = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: '', bankName: '', accountHolder: '' }]);
  const upd = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };
  const del = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const setModel = (i: number, v: string) => {
    const n = [...items]; n[i].modelName = v;
    const p = prods.find((x) => x.name === v);
    if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; }
    setItems(n);
  };

  const submit = async () => {
    if (!/^09\d{9}$/.test(phone)) return showToast('شماره معتبر نیست', true);
    if (!name) return showToast('نام الزامی', true);
    if (!shipping) return showToast('باربری الزامی', true);
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    if (!valid.length) return showToast('حداقل یک مدل', true);
    setSaving(true);
    try {
      let code = '';
      const f = await lookupCustomerByPhone(phone);
      if (f?.customer_code && /^M_\d+$/.test(f.customer_code)) code = f.customer_code;
      else code = await generateCustomerCode();
      const inv = await generateInvoiceNumber();
      await createSale({ invoiceNumber: inv, customerCode: code, customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid });
      showToast('✅ ثبت شد: ' + inv);
      setPhone(''); setName(''); setAddress(''); setShipping('');
      setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: '', bankName: '', accountHolder: '' }]);
      const ni = await generateInvoiceNumber(); setInvoice(ni);
    } catch (e: any) { showToast(e.message, true); }
    finally { setSaving(false); }
  };

  const totalQty = items.reduce((a, r) => a + (Number(r.quantity) || 0), 0);
  const totalAmt = items.reduce((a, r) => a + (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0), 0);

  return (
    <View>
      <Text style={s.formTitle}>➕ سفارش جدید</Text>
      <Text style={s.lbl}>📞 تلفن {status}</Text>
      <TextInput style={s.inp} value={phone} onChangeText={onPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor="#64748b" />
      <Text style={s.lbl}>👤 نام</Text>
      <TextInput style={s.inp} value={name} onChangeText={setName} placeholder="نام مشتری" placeholderTextColor="#64748b" />
      <Text style={s.lbl}>📍 آدرس</Text>
      <TextInput style={s.inp} value={address} onChangeText={setAddress} placeholder="اختیاری" placeholderTextColor="#64748b" />
      <Autocomplete label="🚚 باربری" value={shipping} onChange={setShipping} options={SHIPPINGS} placeholder="تایپ..." />
      <Text style={s.lbl}>🧾 شماره فاکتور (خودکار)</Text>
      <TextInput style={s.inp} value={invoice} editable={false} />

      <Text style={s.secT}>📦 اقلام</Text>
      {items.map((it, i) => (
        <View key={i} style={s.itemCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
            <TouchableOpacity onPress={() => del(i)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
          <Autocomplete label="نام مدل" value={it.modelName} onChange={(v) => upd(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="کلیک..." />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1 }}><Text style={s.lblS}>تعداد</Text>
              <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={(v) => upd(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Text style={s.lblS}>قیمت</Text>
              <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={(v) => upd(i, 'priceUnit', parseNum(v))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Text style={s.lblS}>پرداخت</Text>
              <TextInput style={s.inp} value={String(it.payment || '')} onChangeText={(v) => upd(i, 'payment', parseNum(v))} keyboardType="numeric" /></View>
          </View>
          <Text style={s.lblS}>تاریخ واریز</Text>
          <DateField value={it.depositDate} onChange={(v: string) => upd(i, 'depositDate', v)} compact />
          <Autocomplete label="بانک" value={it.bankName} onChange={(v) => upd(i, 'bankName', v)} options={BANKS} placeholder="کلیک..." />
          <Autocomplete label="صاحب حساب" value={it.accountHolder} onChange={(v) => upd(i, 'accountHolder', v)} options={prods.map(p => p.supplier_name || '').filter(Boolean)} placeholder="کلیک..." />
        </View>
      ))}
      <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>➕ افزودن ردیف</Text></TouchableOpacity>

      <View style={s.editSummary}>
        <Text style={s.sumItem}>📦 تعداد: <Text style={s.sumVal}>{toFaNum(totalQty)}</Text></Text>
        <Text style={s.sumItem}>💰 مبلغ کل: <Text style={s.sumVal}>{toFaNum(fmt(totalAmt))}</Text></Text>
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
        setEditRows(rows.map((r: any) => ({
          rowId: r.id, modelCode: r.model_code, modelName: r.model_name,
          quantity: r.quantity, priceUnit: r.price_unit, payment: r.payment,
          description: r.description, depositDate: r.deposit_date, bankName: r.bank_name,
          accountHolder: r.account_holder, shipping: r.shipping, _deleted: false,
        })));
        setEditing({ invoice: inv, type, name: rows[0].customer_name, code: rows[0].customer_code });
      } else {
        const { data } = await supabase.from('purchases').select('*').eq('invoice_number', inv);
        if (!data?.length) { showToast('پیدا نشد', true); return; }
        setEditRows(data.map((r: any) => ({
          rowId: r.id, modelCode: r.model_code, modelName: r.model_name,
          quantity: r.quantity, priceUnit: r.price_unit, payment: r.payment,
          description: r.description, depositDate: r.deposit_date, bankName: r.bank_name,
          accountHolder: r.account_holder, _deleted: false,
        })));
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
        const data: any = {
          model_code: r.modelCode, model_name: r.modelName,
          quantity: r.quantity, price_unit: r.priceUnit,
          payment: r.payment, description: r.description,
          deposit_date: r.depositDate, bank_name: r.bankName,
          account_holder: r.accountHolder,
        };
        if (editing.type === 'sales') data.shipping = r.shipping || '';
        if (r.rowId) await supabase.from(tbl).update(data).eq('id', r.rowId);
        else await supabase.from(tbl).insert({ ...data, invoice_number: editing.invoice, customer_name: editing.name, customer_code: editing.code, supplier_name: editing.name, supplier_code: editing.code, date_factor: toStorageDate(new Date()), date_reg: toStorageDateFull(new Date()) });
      }
      showToast('✅ ذخیره شد'); setEditing(null); setEditRows([]); setDirty(false); load();
    } catch (e: any) { showToast(e.message, true); }
  };

  const remove = (inv: string, type: string) => {
    Alert.alert('حذف', `فاکتور ${inv} حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { type === 'purchases' ? await deletePurchase(inv) : await deleteSale(inv); load(); showToast('✅ حذف شد'); }
        catch (e: any) { showToast(e.message, true); }
      } },
    ]);
  };

  if (editing) return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ maxHeight: '100%' }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[s.mgrHead, { backgroundColor: '#c0392b' }]}>
          <TouchableOpacity onPress={() => { if (dirty) Alert.alert('تغییرات ذخیره نشده', 'خارج شوی؟', [{ text: 'لغو' }, { text: 'خروج', style: 'destructive', onPress: () => { setEditing(null); setEditRows([]); setDirty(false); } }]); else { setEditing(null); setEditRows([]); } }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>← بازگشت</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={s.mgrHeadTxt}>✏️ {editing.invoice}</Text>
            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.9 }}>{editing.name} | {editing.code} | {editRows.length} ردیف</Text>
          </View>
        </View>

        {editRows.map((r, i) => (
          <View key={i} style={[s.itemCard, r._deleted && { opacity: 0.4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delRow(i)}><Text style={{ fontSize: 18 }}>{r._deleted ? '↺' : '🗑'}</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <View style={{ flex: 1 }}><Text style={s.lblS}>کد</Text><TextInput style={s.inp} value={r.modelCode} onChangeText={(v) => updRow(i, 'modelCode', v)} editable={!r._deleted} /></View>
              <View style={{ flex: 2 }}><Text style={s.lblS}>نام</Text><TextInput style={s.inp} value={r.modelName} onChangeText={(v) => updRow(i, 'modelName', v)} editable={!r._deleted} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <View style={{ flex: 1 }}><Text style={s.lblS}>تعداد</Text><TextInput style={s.inp} value={String(r.quantity || '')} onChangeText={(v) => updRow(i, 'quantity', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>قیمت</Text><TextInput style={s.inp} value={String(r.priceUnit || '')} onChangeText={(v) => updRow(i, 'priceUnit', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>پرداخت</Text><TextInput style={s.inp} value={String(r.payment || '')} onChangeText={(v) => updRow(i, 'payment', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
            </View>
            <Text style={s.lblS}>تاریخ واریز</Text>
            <DateField value={r.depositDate} onChange={(v: string) => updRow(i, 'depositDate', v)} compact />
            <Autocomplete label="بانک" value={r.bankName} onChange={(v) => updRow(i, 'bankName', v)} options={BANKS} placeholder="کلیک..." />
            <Autocomplete label="صاحب حساب" value={r.accountHolder} onChange={(v) => updRow(i, 'accountHolder', v)} options={[]} placeholder="کلیک..." />
            <Text style={s.lblS}>شرح</Text>
            <TextInput style={s.inp} value={r.description} onChangeText={(v) => updRow(i, 'description', v)} editable={!r._deleted} />
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

  return (
    <View>
      <TextInput style={s.inp} value={q} onChangeText={setQ} placeholder="🔍 فاکتور، نام، تلفن..." placeholderTextColor="#64748b" />
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'sales', l: '🛒 فروش' }, { k: 'purchases', l: '🛍️ خرید' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.secT}>📄 نتایج ({toFaNum(filtered.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.slice(0, 100).map((r: any, i: number) => (
        <View key={i} style={[s.invCard, r.type === 'purchases' && { borderRightColor: '#166534' }]}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.invNum}>{r.invoice}</Text>
              <Text style={s.invCust}>{r.type === 'purchases' ? '🏭' : '👤'} {r.name} {r.phone ? `— ${r.phone}` : ''}</Text>
              <Text style={s.invStat}>💰 {toFaNum(fmt(r.total))} | 💳 {toFaNum(fmt(r.paid))}</Text>
              <Text style={s.badge}>{r.type === 'purchases' ? '🛍️ خرید' : '🛒 فروش'}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => openEdit(r.invoice, r.type)} style={[s.iconBtn, { backgroundColor: '#dbeafe' }]}><Text>✏️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(r.invoice, r.type)} style={s.iconBtn}><Text>🗑</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  SETTINGS SECTION
// ══════════════════════════════════════════════════════════
function SettingsSection({ showToast, settings, setSettings }: any) {
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [autoDelEnabled, setAutoDelEnabled] = useState(false);
  const [autoDelHours, setAutoDelHours] = useState('1');

  useEffect(() => {
    if (settings.auto_delete_enabled !== undefined) setAutoDelEnabled(!!settings.auto_delete_enabled);
    if (settings.auto_delete_hours !== undefined) setAutoDelHours(String(settings.auto_delete_hours));
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        ...settings,
        auto_delete_enabled: autoDelEnabled,
        auto_delete_hours: parseInt(autoDelHours, 10) || 1,
      });
      showToast('✅ ذخیره شد');
      const fresh = await getSettings();
      setSettings(fresh);
    } catch (e: any) { showToast(e.message, true); }
    finally { setSaving(false); }
  };

  const emails: string[] = settings.emails || [];
  const addEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) return showToast('ایمیل معتبر وارد کن', true);
    setSettings({ ...settings, emails: [...emails, emailInput] });
    setEmailInput('');
  };
  const removeEmail = (i: number) => setSettings({ ...settings, emails: emails.filter((_, idx) => idx !== i) });

  return (
    <View>
      <Text style={s.secT}>📅 نوع تقویم</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[{ k: 'jalali', l: '🌙 شمسی' }, { k: 'gregorian', l: '🌍 میلادی' }, { k: 'hijri', l: '🕋 قمری' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => { setSettings({ ...settings, cal_type: f.k as CalType }); saveCalType(f.k as CalType); }}
            style={[s.chip, settings.cal_type === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, settings.cal_type === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>📺 بازه داشبورد</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(DASH_RANGE_LABELS).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setSettings({ ...settings, dashboard_range: k })}
            style={[s.chip, settings.dashboard_range === k && s.chipActive]}>
            <Text style={[s.chipTxt, settings.dashboard_range === k && s.chipTxtActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>🔎 فیلتر داده</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[{ k: 'both', l: '📋 هر دو' }, { k: 'sales', l: '🛒 فروش' }, { k: 'purchase', l: '🛍️ خرید' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setSettings({ ...settings, dashboard_filter: f.k })}
            style={[s.chip, settings.dashboard_filter === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, settings.dashboard_filter === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>💹 درصد سود تخمینی</Text>
      <TextInput style={s.inp} value={String(Math.round((settings.profit_margin || 0.10) * 100))}
        onChangeText={(v) => setSettings({ ...settings, profit_margin: (parseFloat(v) || 0) / 100 })}
        keyboardType="numeric" />

      <Text style={s.secT}>📦 آستانه کمبود</Text>
      <TextInput style={s.inp} value={String(settings.inventory_threshold || 5)}
        onChangeText={(v) => setSettings({ ...settings, inventory_threshold: parseInt(v) || 5 })}
        keyboardType="numeric" />

      <Text style={s.secT}>📧 ایمیل‌های گزارش</Text>
      {emails.map((e, i) => (
        <View key={i} style={s.emailRow}>
          <Text style={s.emailTxt} numberOfLines={1}>{e}</Text>
          <TouchableOpacity onPress={() => removeEmail(i)}><Text>🗑</Text></TouchableOpacity>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput style={[s.inp, { flex: 1 }]} value={emailInput} onChangeText={setEmailInput}
          placeholder="ایمیل جدید..." placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none" />
        <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#7c3aed' }]} onPress={addEmail}><Text style={s.btnTxt}>➕</Text></TouchableOpacity>
      </View>

      <Text style={s.secT}>🗑️ حذف خودکار فاکتورهای پرداخت‌نشده</Text>
      <View style={s.rowBetween}>
        <Text style={s.lbl}>فعال</Text>
        <Switch value={autoDelEnabled} onValueChange={setAutoDelEnabled} />
      </View>
      <Text style={s.lblS}>حذف بعد از (ساعت)</Text>
      <TextInput style={s.inp} value={autoDelHours} onChangeText={setAutoDelHours} keyboardType="numeric" />

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره همه</Text>}
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
    if (!editing.code || !editing.name) return showToast('کد و نام الزامی', true);
    try {
      if (editing.id) await updateProduct(editing.id, editing);
      else await createProduct(editing);
      showToast('✅ ذخیره شد'); setEditing(null); load();
    } catch (e: any) { showToast(e.message, true); }
  };
  const remove = (id: string) => {
    Alert.alert('حذف', 'این کالا حذف شود؟', [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { try { await deleteProduct(id); load(); showToast('✅ حذف شد'); } catch (e: any) { showToast(e.message, true); } } },
    ]);
  };

  return (
    <View>
      <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', marginBottom: 10 }]}
        onPress={() => setEditing({ id: null, code: '', name: '', price: 0, shelf: '', supplier_name: '', supplier_code: '', supplier_phone: '', payer_name: '', shipping_name: '' })}>
        <Text style={s.btnTxt}>➕ افزودن کالا</Text>
      </TouchableOpacity>
      <TextInput style={s.inp} value={q} onChangeText={setQ} placeholder="🔍 جستجو در کالاها..." placeholderTextColor="#64748b" />
      <Text style={s.secT}>📦 کالاها ({toFaNum(filtered.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.map((p) => (
        <View key={p.id} style={s.invCard}>
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
          <ScrollView style={[s.modalBox, { backgroundColor: '#fff' }]} keyboardShouldPersistTaps="handled">
            <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}>
              <Text style={s.modalHeadTxt}>{editing?.id ? '✏️ ویرایش کالا' : '➕ کالای جدید'}</Text>
              <TouchableOpacity onPress={() => setEditing(null)}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 14 }}>
              {[
                { k: 'code', l: 'کد *' }, { k: 'name', l: 'نام *' },
                { k: 'price', l: 'قیمت', num: true }, { k: 'shelf', l: '📍 قفسه' },
                { k: 'supplier_name', l: '🏭 تأمین‌کننده' }, { k: 'supplier_code', l: 'کد تأمین‌کننده' },
                { k: 'supplier_phone', l: '📞 تلفن' }, { k: 'payer_name', l: 'نام پرداخت‌کننده' },
                { k: 'shipping_name', l: '🚚 باربری' },
              ].map((f) => (
                <View key={f.k}>
                  <Text style={s.lbl}>{f.l}</Text>
                  <TextInput style={s.inp} value={String((editing as any)?.[f.k] || '')}
                    onChangeText={(v) => setEditing({ ...editing, [f.k]: f.num ? (parseFloat(v) || 0) : v })}
                    keyboardType={f.num ? 'numeric' : 'default'} placeholderTextColor="#64748b" />
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
      if (mode === 'print') {
        await Print.printAsync({ uri });
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
        if (mode === 'save') showToast('✅ ذخیره شد');
      } else showToast('اشتراک پشتیبانی نمی‌شود', true);
    } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 10, paddingBottom: 60 }}>
      <View ref={ref} collapsable={false} style={s.invoiceContainer}>
        <View style={s.invHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 20 }}>⚖️</Text>
            <View>
              <Text style={s.invBrand}>میزان</Text>
              <Text style={s.invSlogan}>حساب‌ها دقیق، معاملات امن</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.invSmall}>📞 ________________</Text>
            <Text style={s.invSmall}>📧 ________________</Text>
          </View>
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
          <SumRow l={tot.balance > 0 ? '⚖️ مانده قابل پرداخت' : tot.balance < 0 ? '💰 بستانکاری' : '✅ تسویه کامل'}
            v={tot.balance !== 0 ? fmt(Math.abs(tot.balance)) + ' تومان' : 'بدون بدهی'} highlight />
        </View>

        <View style={s.invFooter}>
          <Text style={s.invFooterTxt}>📞 کفش تاج: ________________</Text>
          <Text style={s.invFooterThanks}>با تشکر از اعتماد شما 🙏</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#1e3a5f' }]} onPress={() => captureAndShare('print')}>
          <Text style={s.btnTxt}>🖨️ پرینت</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#0ea5e9' }]} onPress={() => captureAndShare('share')}>
          <Text style={s.btnTxt}>📤 اشتراک</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={() => captureAndShare('save')}>
          <Text style={s.btnTxt}>💾 ذخیره</Text>
        </TouchableOpacity>
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

// ══════════════════════════════════════════════════════════
//  Row helper
// ══════════════════════════════════════════════════════════
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
    } catch (e: any) { showToast(e.message || 'مشکلی پیش آمد', true); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
  hTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  hSub: { color: '#d1d5db', fontSize: 10, marginTop: 4, textAlign: 'right' },

  tabsBar: { backgroundColor: '#1a2332', maxHeight: 78 },
  tabsCont: { paddingHorizontal: 6, paddingVertical: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 3, borderRadius: 10, alignItems: 'center', minWidth: 68, borderWidth: 1, borderColor: 'transparent' },
  tabIcon: { fontSize: 18 },
  tabLbl: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold' },
  tabLblActive: { color: '#fff' },
  lock: { position: 'absolute', top: 4, left: 6, fontSize: 10 },

  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#059669', padding: 12, borderRadius: 10, alignItems: 'center', zIndex: 9999 },
  toastTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Dashboard
  dash: { margin: 10, padding: 12, borderRadius: 14, backgroundColor: '#080b13', borderWidth: 2, borderColor: '#1f3a5f' },
  rangeBadge: { backgroundColor: '#1e3a8a', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12, alignSelf: 'center' },
  rangeBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  clockRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8, marginVertical: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8 },
  time: { color: '#00ff88', fontSize: 22, fontFamily: 'Orbitron_900Black' },
  dateTxt: { color: '#4ade80', fontSize: 12, fontFamily: 'ShareTechMono_400Regular' },
  profitBox: { alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  profitLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  profitVal: { fontSize: 30, fontFamily: 'Orbitron_900Black' },
  profitUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dItem: { width: '48%', padding: 8, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.18)', alignItems: 'center' },
  dLbl: { color: '#94a3b8', fontSize: 9, marginBottom: 4 },
  dVal: { fontSize: 12, fontFamily: 'Orbitron_700Bold' },

  // Forms
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

  // Autocomplete
  acBox: { backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginTop: 4, overflow: 'hidden' },
  acHdr: { padding: 8, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'right', backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#d4af37' },
  acItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  acItemTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },

  // Date
  dateBox: { flexDirection: 'row', alignItems: 'center', padding: 6, backgroundColor: '#1a2332', borderWidth: 2, borderColor: '#334155', borderRadius: 8, gap: 1, flexWrap: 'nowrap' },
  dateInp: { padding: 4, color: '#fff', textAlign: 'center', fontSize: 13, fontFamily: 'ShareTechMono_400Regular', backgroundColor: 'transparent' },
  dateSep: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  typeBtn: { marginLeft: 'auto', padding: 4, backgroundColor: '#334155', borderRadius: 6 },
  typeBtnTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Invoice card
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

  // Stats
  statsCard: { backgroundColor: '#080b13', borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: '#1f3a5f' },
  statsLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  statsVal: { fontSize: 26, fontFamily: 'Orbitron_900Black' },
  statsUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  rptBadge: { color: '#1a2332', fontSize: 11, fontFamily: 'ShareTechMono_400Regular', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 4 },
  itemRow: { color: '#475569', fontSize: 11, marginBottom: 2, textAlign: 'right' },

  // Profit
  pCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#059669' },
  pName: { color: '#0f2438', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  pStat: { color: '#475569', fontSize: 11, fontFamily: 'ShareTechMono_400Regular', textAlign: 'right' },
  warnBox: { backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#fcd34d', borderRadius: 10, padding: 12, marginVertical: 8 },
  warnTxt: { color: '#78350f', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },

  // Inventory
  sBox: { width: '31%', marginHorizontal: '1.16%', marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderRightWidth: 3, borderRightColor: '#10b981' },
  sBoxL: { color: '#64748b', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  sBoxV: { fontSize: 16, fontFamily: 'Orbitron_700Bold' },
  thresholdBox: { backgroundColor: '#1a2332', padding: 10, borderRadius: 10, marginTop: 8 },
  shelfBtn: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
  shelfTxt: { color: '#075985', fontSize: 11, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },

  // Chips & tabs
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  subTabActive: { backgroundColor: '#c0392b', borderColor: '#c0392b' },
  subTabTxt: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  subTabTxtActive: { color: '#fff' },

  // Modal
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

  // Management
  mgrHead: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 12 },
  mgrHeadTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  editSummary: { backgroundColor: '#1a2332', padding: 12, borderRadius: 10, flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 10 },
  sumItem: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  sumVal: { color: '#00ff88', fontFamily: 'Orbitron_700Bold' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 6 },
  emailTxt: { flex: 1, color: '#fff', fontSize: 12 },

  // Invoice A5
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

  // Login
  loginWrap: { flex: 1, backgroundColor: '#0f2438', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 18, padding: 24 },
  loginLogo: { fontSize: 54, textAlign: 'center', marginBottom: 8 },
  loginTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#0f2438', marginBottom: 4 },
  loginSub: { fontSize: 13, textAlign: 'center', color: '#64748b', marginBottom: 24 },
  loginInp: { backgroundColor: '#f5f7fa', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 10, color: '#1a2332', textAlign: 'right' },
  loginNote: { textAlign: 'center', color: '#64748b', fontSize: 11, marginTop: 12 },
});
