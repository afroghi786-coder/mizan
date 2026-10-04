import { StatusBar } from 'expo-status-bar';
import SyncControl from './SyncControl';
import LicenseGate from './LicenseGate';
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
    jalaliDisplay, g2j, j2g, g2h, h2g,
  BANKS, SHIPPINGS, DASH_RANGE_LABELS,
  getProducts, createProduct, updateProduct, deleteProduct,
  lookupCustomerByPhone, generateCustomerCode, generateInvoiceNumber, createSale,
  getSalesGrouped, deleteSale, getUnpaidInvoices, searchAllInvoices, getInvoiceDetail,
  lookupSupplierByName, lookupCodeByName, createPurchase, getPurchasesGrouped, deletePurchase,
  getDashboardStats, getInventory,
  getSettings, updateSettings, loadMode,
  Product, SaleItem, PurchaseItem, Settings,
} from './lib.offline';

// ══════════════════════════════════════════════════════════
//  Theme Mode: 🌙 dark | ☀️ light | ⚪ simple
// ══════════════════════════════════════════════════════════
export type ThemeMode = 'dark' | 'light' | 'simple';
let THEME_MODE: ThemeMode = 'light';
export const setThemeMode = (m: ThemeMode) => { THEME_MODE = m; };
export const getThemeMode = () => THEME_MODE;

const C = {
  get mode() { return THEME_MODE; },
  get isDark() { return THEME_MODE === 'dark'; },
  get isSimple() { return THEME_MODE === 'simple'; },
  get bg()      { return THEME_MODE === 'dark' ? '#0f2438' : '#f5f7fa'; },
  get card()    { return THEME_MODE === 'dark' ? '#1a2332' : '#ffffff'; },
  get cardAlt() { return THEME_MODE === 'dark' ? '#0a1628' : '#f8fafc'; },
  get text()    { return THEME_MODE === 'dark' ? '#ffffff' : '#1a2332'; },
  get textMut() { return THEME_MODE === 'dark' ? '#94a3b8' : '#64748b'; },
  get border()  { return THEME_MODE === 'dark' ? '#334155' : '#e2e8f0'; },
  get input()   { return THEME_MODE === 'dark' ? '#1a2332' : '#ffffff'; },
};

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
// ⭐ محاسبه موجودی قبلی مشتری
async function getCustomerPreviousBalance(customerCode: string, currentInvoiceNumber: string) {
  try {
    const { data } = await supabase.from('sales').select('*').eq('customer_code', customerCode);
    if (!data || !data.length) return { sales: 0, payments: 0, balance: 0, invoiceCount: 0 };
    const grouped: Record<string, { sales: number; payments: number }> = {};
    data.forEach((r: any) => {
      if (r.invoice_number === currentInvoiceNumber) return;  // فاکتور جدید رو رد کن
      if (!grouped[r.invoice_number]) grouped[r.invoice_number] = { sales: 0, payments: 0 };
      grouped[r.invoice_number].sales += (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
      grouped[r.invoice_number].payments += Number(r.payment) || 0;
    });
    let sales = 0, payments = 0, invoiceCount = 0;
    Object.values(grouped).forEach((g: any) => {
      sales += g.sales;
      payments += g.payments;
      invoiceCount++;
    });
    return { sales, payments, balance: sales - payments, invoiceCount };
  } catch {
    return { sales: 0, payments: 0, balance: 0, invoiceCount: 0 };
  }
}
// ══════════════════════════════════════════════════════════
//  Dashboard Styles (دقیقاً مثل تصویر)
// ══════════════════════════════════════════════════════════
const dash = {
  page: {
    backgroundColor: '#080b13',
    borderRadius: 18,
    padding: 14,
    margin: 10,
    borderWidth: 2,
    borderColor: '#1f3a5f',
    shadowColor: '#00ff88',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  } as any,

  rangeBadge: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
  } as any,

  rangeBadgeTxt: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' } as any,

  clockRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.15)',
  } as any,

  time: {
    color: '#00ff88',
    fontSize: 34,
    fontFamily: 'Orbitron_900Black',
    letterSpacing: 4,
    textShadowColor: '#00ff88',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  } as any,

  dateSmall: {
    color: '#4ade80',
    fontSize: 14,
    fontFamily: 'ShareTechMono_400Regular',
    letterSpacing: 1,
    textShadowColor: 'rgba(74,222,128,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  } as any,

  dateElapsed: {
    color: '#4ade80',
    fontSize: 11,
    fontFamily: 'ShareTechMono_400Regular',
    textShadowColor: 'rgba(74,222,128,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  } as any,

  profitBox: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 14,
    backgroundColor: 'radial-gradient(ellipse, rgba(0,255,136,0.06), transparent)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,255,136,0.15)',
  } as any,

  profitLbl: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  } as any,

  profitVal: {
    fontSize: 52,
    fontFamily: 'Orbitron_900Black',
    letterSpacing: 3,
    lineHeight: 60,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  } as any,

  profitUnit: { color: '#64748b', fontSize: 12, marginTop: 8, letterSpacing: 3 } as any,

  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  } as any,

  dItem: {
    width: '32%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
  } as any,

  dLbl: {
    color: '#94a3b8',
    fontSize: 9,
    marginBottom: 6,
    textAlign: 'center',
  } as any,

  dVal: {
    fontSize: 13,
    fontFamily: 'Orbitron_700Bold',
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  } as any,
};
// ══════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const [fontsLoaded] = useFonts({ Orbitron_900Black, Orbitron_700Bold, ShareTechMono_400Regular });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFontTimeout(true), 3000); return () => clearTimeout(t); }, []);
  const fontsReady = fontsLoaded || fontTimeout;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [themeTick, setThemeTick] = useState(0);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    // چک خودکار لایسنس هر ۱۲ ساعت
    const licTimer = setInterval(() => {
      import('./license').then(m => m.checkLicense()).catch(() => {});
    }, 12 * 3600 * 1000);
    const failsafe = setTimeout(() => setLoading(false), 5000);
    loadMode().then(() => loadCalType()).then(() => getSettings()).then((s: any) => {
      const saved = s?.theme_mode || s?.theme;
      if (saved === 'dark' || saved === 'light' || saved === 'simple') {
        setThemeMode(saved);
        setThemeTick(v => v + 1);
      }
    }).catch(() => {});
    supabase.auth.getSession()
      .then(({ data: { session } }) => { setSession(session); setLoading(false); clearTimeout(failsafe); })
      .catch(() => { setLoading(false); clearTimeout(failsafe); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { subscription.unsubscribe(); clearTimeout(failsafe); clearInterval(licTimer); };
  }, []);
  const cycleTheme = useCallback(() => {
    const next: ThemeMode =
      THEME_MODE === 'dark' ? 'light' :
      THEME_MODE === 'light' ? 'simple' : 'dark';
    setThemeMode(next);
    setThemeTick(v => v + 1);
    getSettings().then((st: any) => {
      updateSettings({ ...st, theme_mode: next }).catch(() => {});
    }).catch(() => {});
  }, []);
   if (!fontsReady || loading) return <View style={[s.loading, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color="#d4af37" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View key={themeTick} style={{ flex: 1 }}>
        {!session
          ? <LoginScreen showToast={showToast} />
          : <LicenseGate showToast={showToast}>
              <MainApp showToast={showToast} onCycleTheme={cycleTheme} />
            </LicenseGate>}
      </View>
      {toast && <View style={[s.toast, toast.error && { backgroundColor: '#b91c1c' }]}><Text style={s.toastTxt}>{toast.msg}</Text></View>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════
const DEFAULT_TAB_PINS: Record<string, string> = {
  purchase: '4242', print: '4242', mgr: '4242', profit: '4242', inventory: '4242', settings: '4242',
};
function getTabPins(settings: any): Record<string, string> {
  const p = settings?.tab_pins;
  if (!p || typeof p !== 'object') return DEFAULT_TAB_PINS;
  return { ...DEFAULT_TAB_PINS, ...p };
}

function MainApp({ showToast, onCycleTheme }: any) {
  const [tab, setTab] = useState('order');
  const [unlockedTabs, setUnlockedTabs] = useState<Set<string>>(new Set());
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({});

  const reloadSettings = useCallback(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  const tabs = [
    { key: 'order', icon: '🛒', label: 'فروش', color: '#1e3a8a' },
    { key: 'purchase', icon: '🛍️', label: 'خرید', color: '#166534' },
    { key: 'print', icon: '🖨️', label: 'پرینت', color: '#6c3483' },
    { key: 'mgr', icon: '📋', label: 'مدیریت', color: '#c0392b' },
    { key: 'profit', icon: '💹', label: 'سود', color: '#065f46' },
    { key: 'inventory', icon: '📦', label: 'انبار', color: '#0f5132' },
  ];

  const tabPins = getTabPins(settings);
  const isLocked = (t: string) => !!tabPins[t] && !unlockedTabs.has(t);
  const requestTab = (t: string) => {
    if (t === 'order' || !isLocked(t)) { setTab(t); return; }
    setPendingTab(t);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar style={C.isDark ? 'light' : 'dark'} />
      <View style={[s.header, {
        backgroundColor:
          C.isSimple ? '#64748b' :
          tab === 'purchase' ? '#0f5132' :
          tab === 'print' ? '#4a235a' :
          tab === 'mgr' ? '#334155' :
          tab === 'profit' ? '#4a235a' :
          tab === 'inventory' ? '#0f5132' :
          '#0f2438',
      }]}>
        <View style={{
          height: 4,
          backgroundColor: '#d4af37',
          marginLeft: -14, marginRight: -14, marginTop: -14, marginBottom: 12,
        }} />

        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                 <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={onCycleTheme} style={[s.themeBtn, { borderColor: '#d4af37' }]}>
              <Text style={{ fontSize: 20 }}>
                {THEME_MODE === 'dark' ? '🌙' : THEME_MODE === 'light' ? '☀️' : '⚪'}
              </Text>
            </TouchableOpacity>
            <SyncControl showToast={showToast} compact />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 12 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 24, color: '#f4d47a' }}>⚖️</Text>
              <Text style={s.hTitle}>میزان</Text>
            </View>
            <Text style={s.hSub}>حساب‌ها دقیق، معاملات امن، ذهن آسوده</Text>
          </View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabsBar, { backgroundColor: C.card }]} contentContainerStyle={s.tabsCont}>
        {tabs.map((t) => (
                   <TouchableOpacity key={t.key} onPress={() => requestTab(t.key)} activeOpacity={0.7} style={[s.tab, tab === t.key && { backgroundColor: C.isSimple ? '#64748b' : t.color, borderColor: '#d4af37' }]}>
            <Text style={s.tabIcon}>{t.icon}</Text>
            <Text style={[s.tabLbl, { color: C.textMut }, tab === t.key && s.tabLblActive]}>{t.label}</Text>
            {isLocked(t.key) && <Text style={s.lock}>🔒</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
      {tab === 'order' && <SalesScreen showToast={showToast} />}
      {tab === 'purchase' && <PurchaseScreen showToast={showToast} />}
      {tab === 'print' && <PrintScreen showToast={showToast} />}
      {tab === 'mgr' && <ManagementScreen showToast={showToast} settings={settings} setSettings={setSettings} reload={reloadSettings} tabPins={tabPins} />}
      {tab === 'profit' && <ProfitScreen showToast={showToast} settings={settings} />}
      {tab === 'inventory' && <InventoryScreen showToast={showToast} />}
      <PinModal
        visible={!!pendingTab}
        correctPin={pendingTab ? (tabPins[pendingTab] || '') : ''}
        onClose={() => setPendingTab(null)}
        onSuccess={() => {
          if (pendingTab) {
            setUnlockedTabs(prev => new Set(prev).add(pendingTab));
            setTab(pendingTab);
          }
          setPendingTab(null);
        }}
        showToast={showToast}
      />
    </SafeAreaView>
  );
}
// ══════════════════════════════════════════════════════════
//  PIN MODAL
// ══════════════════════════════════════════════════════════
function PinModal({ visible, correctPin, onClose, onSuccess, showToast }: any) {
  const [pin, setPin] = useState('');
  useEffect(() => { if (visible) setPin(''); }, [visible]);
  const verify = () => {
    if (pin === correctPin) { onSuccess(); showToast('✅ تأیید شد'); }
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
//  AUTOCOMPLETE (inline - بدون Modal)
// ══════════════════════════════════════════════════════════
function Autocomplete({ value, onChange, onSelect, options, placeholder, label }: any) {
  const [show, setShow] = useState(false);
  const filtered = useMemo(() => {
    const q = String(value || '').toLowerCase().trim();
    const list = q ? options.filter((x: string) => String(x).toLowerCase().includes(q)) : options;
    const seen = new Set<string>();
    return list.filter((x: string) => { if (seen.has(x)) return false; seen.add(x); return true; }).slice(0, 100);
  }, [value, options]);
  return (
    <View style={{ marginBottom: 8 }}>
      {label && <Text style={[s.lbl, { color: C.textMut }]}>{label}</Text>}
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={value} placeholder={placeholder || 'کلیک یا تایپ...'} placeholderTextColor={C.textMut} onChangeText={(v) => { onChange(v); setShow(true); }} onFocus={() => setShow(true)} />
      {show && filtered.length > 0 && (
        <View style={[s.acBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.map((opt: string) => (
              <TouchableOpacity key={opt} style={[s.acItem, { borderBottomColor: C.border }]} onPress={() => { onChange(opt); setShow(false); if (onSelect) onSelect(opt); }}>
                <Text style={[s.acItemTxt, { color: C.text }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#475569', margin: 4, paddingVertical: 6 }]} onPress={() => setShow(false)}><Text style={[s.btnTxt, { fontSize: 11 }]}>بستن</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}
// ══════════════════════════════════════════════════════════
//  CellAutocomplete — برای استفاده توی جدول‌ها (compact)
// ══════════════════════════════════════════════════════════
function CellAutocomplete({ value, onChange, onSelect, options, placeholder }: any) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q ? options.filter((x: string) => String(x).toLowerCase().includes(q)) : options;
    const seen = new Set<string>();
    return list.filter((x: string) => { if (seen.has(x)) return false; seen.add(x); return true; }).slice(0, 100);
  }, [query, options]);

  const open = () => { setQuery(''); setShow(true); };
  const pick = (v: string) => { onChange(v); if (onSelect) onSelect(v); setShow(false); };

  return (
    <>
      <TouchableOpacity
        style={{
          backgroundColor: C.input,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 8,
          minHeight: 34,
          justifyContent: 'center',
        }}
        onPress={open}
      >
        <Text
          style={{ color: value ? C.text : C.textMut, fontSize: 11, textAlign: 'right' }}
          numberOfLines={1}
        >
          {value || placeholder || 'انتخاب...'}
        </Text>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <View style={s.modalBg}>
          <View style={[s.modalBox, { backgroundColor: C.card, maxWidth: 500 }]}>
            <View style={[s.modalHead, { backgroundColor: '#1e3a8a' }]}>
              <Text style={s.modalHeadTxt}>{placeholder || 'انتخاب'}</Text>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 12 }}>
              <TextInput
                style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border, marginBottom: 8 }]}
                value={query}
                onChangeText={setQuery}
                placeholder="🔍 جستجو..."
                placeholderTextColor={C.textMut}
                autoFocus
              />
              <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {filtered.length === 0 && (
                  <Text style={{ textAlign: 'center', color: C.textMut, padding: 20 }}>موردی یافت نشد</Text>
                )}
                {filtered.map((opt: string) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => pick(opt)}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
                  >
                    <Text style={{ color: C.text, textAlign: 'right', fontSize: 14 }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    else if (type === 'hijri') { const r = h2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
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
//  DASHBOARD
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
  const rangeLabel = stats?.rangeLabel || 'ماه جاری';

  // متن elapsed
  const j = g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const elapsed = `امروز: ${j[0]}/${pad2(j[1])}/${pad2(j[2])}`;

  const cards = [
    { i: '🛒', l: 'کل فروش', v: stats?.totalSales || 0, c: '#60a5fa', show: filter !== 'purchase' },
    { i: '📦', l: 'کل خرید', v: stats?.totalPurchases || 0, c: '#fb923c', show: filter !== 'sales' },
    { i: '💳', l: 'پرداخت مشتری', v: stats?.customerPaid || 0, c: '#34d399', show: filter !== 'purchase' },
    { i: '📌', l: 'بدهی مشتری', v: stats?.customerDebt || 0, c: '#fb923c', show: filter !== 'purchase' },
    { i: '💵', l: 'پرداخت به تأمین‌کننده', v: stats?.supplierPaid || 0, c: '#34d399', show: filter !== 'sales' },
    { i: '📌', l: 'بدهی به تأمین‌کننده', v: stats?.supplierDebt || 0, c: '#f87171', show: filter !== 'sales' },
  ].filter(c => c.show);

  return (
    <View style={dash.page}>
      {/* Badge بازه */}
      <View style={{ alignItems: 'center', marginBottom: 10 }}>
        <View style={dash.rangeBadge}>
          <Text style={dash.rangeBadgeTxt}>{rangeLabel}</Text>
        </View>
      </View>

      {/* ساعت + تاریخ */}
      <View style={dash.clockRow}>
        <Text style={dash.time}>{time}</Text>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={dash.dateSmall}>{date}</Text>
          <Text style={dash.dateElapsed}>{elapsed}</Text>
        </View>
      </View>

      {/* سود خالص */}
      <View style={dash.profitBox}>
        <Text style={dash.profitLbl}>💰 سود خالص {rangeLabel}</Text>
        <Text style={[dash.profitVal, { color: profit < 0 ? '#ff3355' : profit === 0 ? '#fbbf24' : '#00ff88', textShadowColor: profit < 0 ? '#ff3355' : profit === 0 ? '#fbbf24' : '#00ff88' }]}>
          {fmt(profit)}
        </Text>
        <Text style={dash.profitUnit}>تومان</Text>
      </View>

      {/* کارت‌ها */}
      {loading ? <ActivityIndicator color="#00ff88" /> : (
        <View style={dash.grid}>
          {cards.map((c, i) => (
            <View key={i} style={dash.dItem}>
              <Text style={dash.dLbl}>{c.i} {c.l}</Text>
              <Text style={[dash.dVal, { color: c.c, textShadowColor: c.c }]} numberOfLines={1}>{fmt(c.v)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
function DCard({ i, l, v, c }: any) {
  return (<View style={s.dItem}><Text style={s.dLbl}>{i} {l}</Text><Text style={[s.dVal, { color: c, textShadowColor: c }]} numberOfLines={1}>{v}</Text></View>);
}

// ══════════════════════════════════════════════════════════
//  SALES SCREEN — فرم با کارت‌های عمودی مثل وب
// ══════════════════════════════════════════════════════════
function SalesScreen({ showToast }: any) {
  const S = getS();
  const [view, setView] = useState<'list' | 'form' | 'invoice' | 'reprint'>('list');
  const [settings, setSettings] = useState<Settings>({});
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hiddenSales, setHiddenSales] = useState<string[]>([]);
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

  const addItem = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', accountHolderCode: '', description: '' }]);
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
        const rows = await getInvoiceDetail(inv);
      if (rows.length > 0) {
        const r = rows[0];
        const its = rows.map((x: any) => ({ modelName: x.model_name, modelCode: x.model_code, quantity: x.quantity, priceUnit: x.price_unit, total: x.quantity * x.price_unit }));
        const tot = its.reduce((a: number, it: any) => a + it.total, 0);
        const paid = rows.reduce((a: number, x: any) => a + (Number(x.payment) || 0), 0);
        // ⭐ fetch فاکتورهای قبلی
        const prev = await getCustomerPreviousBalance(r.customer_code, r.invoice_number);
        setInvoice({
          customer: { code: r.customer_code, name: r.customer_name, phone: r.customer_phone, address: r.customer_address, shipping: r.shipping },
          current: { invoiceNumber: r.invoice_number, items: its, sales: tot, payments: paid, balance: tot - paid },
          previous: prev,
          totals: { sales: prev.sales + tot, payments: prev.payments + paid, balance: prev.balance + (tot - paid) },
          timeString: displayDate(r.date_reg),
        });
        setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]);
        setView('invoice');
      } else {
        alertMsg('✅ موفق', 'فاکتور فروش ثبت شد:\n' + inv);
        setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setView('list'); load();
      }
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const remove = async (inv: string) => {
    const ok = await confirmMsg('پنهان کردن', `فاکتور ${inv} از لیست پنهان شود؟\n\n(در دیتابیس باقی می‌ماند)`);
    if (!ok) return;
    setHiddenSales([...hiddenSales, inv]);
    showToast('✅ از لیست پنهان شد');
  };

  const doReprint = async () => {
    if (!reprintInv.trim()) return showToast('شماره فاکتور را وارد کن', true);
    try {
      const rows = await getInvoiceDetail(reprintInv.trim());
      if (!rows.length) return showToast('فاکتور پیدا نشد', true);
      const r = rows[0];
      const its = rows.map((x: any) => ({ modelName: x.model_name, modelCode: x.model_code, quantity: x.quantity, priceUnit: x.price_unit, total: x.quantity * x.price_unit }));
      const total = its.reduce((a: number, it: any) => a + it.total, 0);
      const paid = rows.reduce((a: number, x: any) => a + (Number(x.payment) || 0), 0);
      setInvoice({
        customer: { code: r.customer_code, name: r.customer_name, phone: r.customer_phone, address: r.customer_address, shipping: r.shipping },
        current: { invoiceNumber: r.invoice_number, items: its, sales: total, payments: paid, balance: total - paid },
        previous: { sales: 0, payments: 0, balance: 0, invoiceCount: 0 },
        totals: { sales: total, payments: paid, balance: total - paid },
        timeString: displayDate(r.date_reg),
      });
      setView('invoice');
    } catch (e: any) { showToast(e.message, true); }
  };

  if (view === 'invoice' && invoice) return <InvoiceView invoice={invoice} onBack={() => { setView('list'); setInvoice(null); load(); }} showToast={showToast} onNew={() => { setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setInvoice(null); setView('form'); }} />;

  // ═══════════════ حالت پرینت مجدد ═══════════════
  if (view === 'reprint') return (
    <ScrollView style={S.page} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      {/* کارت پرینت مجدد */}
      <View style={S.card}>
        <View style={S.cardHeader}>
          <Text style={S.cardHeaderIcon}>🖨️</Text>
          <Text style={[S.cardHeaderTitle, { color: S.order }]}>پرینت مجدد فاکتور</Text>
        </View>
        <View style={{ padding: 16 }}>
          <Text style={S.label}>شماره فاکتور قدیمی</Text>
          <TextInput
            style={S.input}
            value={reprintInv}
            onChangeText={setReprintInv}
            placeholder="مثلاً 14050612-1001"
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity style={[S.btnPrimary, { marginTop: 10 }]} onPress={doReprint}>
            <Text style={S.btnPrimaryTxt}>🔍 نمایش فاکتور</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* دکمه برگشت */}
      <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setView('list')}>
        <Text style={S.btnSecondaryTxt}>↩️ برگشت به لیست</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ═══════════════ حالت فرم ═══════════════
  if (view === 'form') return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={S.page} contentContainerStyle={{ padding: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {/* ─── کارت اطلاعات مشتری ─── */}
        <View style={S.card}>
          <View style={S.cardHeader}>
            <Text style={S.cardHeaderIcon}>📞</Text>
            <Text style={[S.cardHeaderTitle, { color: S.order }]}>اطلاعات مشتری</Text>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={S.label}>
              تلفن همراه <Text style={S.required}>*</Text>
              {customerStatus ? <Text style={S.statusBadge}> {customerStatus}</Text> : null}
            </Text>
            <TextInput
              style={S.input}
              value={phone}
              onChangeText={onPhone}
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="09121234567"
              placeholderTextColor="#94a3b8"
            />

            <Text style={S.label}>نام و نام خانوادگی <Text style={S.required}>*</Text></Text>
            <TextInput
              style={S.input}
              value={name}
              onChangeText={setName}
              placeholder="نام مشتری"
              placeholderTextColor="#94a3b8"
            />

            <Text style={S.label}>آدرس</Text>
            <TextInput
              style={S.input}
              value={address}
              onChangeText={setAddress}
              placeholder="اختیاری"
              placeholderTextColor="#94a3b8"
            />

            <Text style={S.label}>باربری <Text style={S.required}>*</Text></Text>
            <Autocomplete
              value={shipping}
              onChange={setShipping}
              options={[...new Set([...SHIPPINGS, ...prods.map(p => p.shipping_name || '').filter(Boolean)])]}
              placeholder="تایپ یا انتخاب..."
            />
          </View>
        </View>

        {/* ─── کارت اقلام ─── */}
        <View style={S.card}>
          <View style={S.cardHeader}>
            <Text style={S.cardHeaderIcon}>📦</Text>
            <Text style={[S.cardHeaderTitle, { color: S.order }]}>اقلام فروش</Text>
          </View>
          <View style={{ padding: 16 }}>
            {items.map((it, i) => {
              const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
              return (
                <View key={i} style={S.itemRow}>
                  {/* هدر کارت کوچیک */}
                  <View style={S.itemRowHeader}>
                    <View style={S.itemRowNumBadge}>
                      <Text style={S.itemRowNumTxt}>#{toFaNum(i + 1)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => delItem(i)} style={S.itemRemoveBtn}>
                      <Text style={S.itemRemoveTxt}>🗑</Text>
                    </TouchableOpacity>
                  </View>

                  {/* نام مدل */}
                  <Autocomplete
                    value={it.modelName}
                    onChange={(v) => updItem(i, 'modelName', v)}
                    onSelect={(v) => setModel(i, v)}
                    options={prods.map(p => p.name)}
                    placeholder="نام مدل..."
                  />

                  {/* ردیف ۳ ستونه */}
                  <View style={S.threeColRow}>
                    <View style={S.threeColCell}>
                      <Text style={S.miniLabel}>کد مدل</Text>
                      <View style={S.miniValue}>
                        <Text style={S.miniValueTxt}>{it.modelCode || '—'}</Text>
                      </View>
                    </View>
                    <View style={S.threeColCell}>
                      <Text style={S.miniLabel}>تعداد <Text style={S.required}>*</Text></Text>
                      <TextInput
                        style={S.miniInput}
                        value={String(it.quantity || '')}
                        onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                    <View style={S.threeColCell}>
                      <Text style={S.miniLabel}>قیمت <Text style={S.required}>*</Text></Text>
                      <TextInput
                        style={S.miniInput}
                        value={String(it.priceUnit || '')}
                        onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>

                  {/* مبلغ کل */}
                  <View style={S.threeColRow}>
                    <View style={S.threeColCell}>
                      <Text style={S.miniLabel}>مبلغ کل</Text>
                      <View style={S.miniValue}>
                        <Text style={[S.miniValueTxt, { color: lineTotal ? S.order : '#94a3b8' }]}>
                          {lineTotal ? fmt(lineTotal) : '—'}
                        </Text>
                      </View>
                    </View>
                    <View style={S.threeColCell} />
                    <View style={S.threeColCell} />
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={S.addModelBtn} onPress={addItem}>
              <Text style={S.addModelBtnTxt}>➕ افزودن مدل</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── خلاصه کل ─── */}
        <View style={S.summaryCard}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={S.summaryLbl}>💰 جمع مبلغ کل</Text>
            <Text style={S.summaryVal}>{toFaNum(fmt(grandTotal))}</Text>
          </View>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={S.summaryLbl}>📦 تعداد اقلام</Text>
            <Text style={S.summaryCnt}>{toFaNum(grandQty)} مدل</Text>
          </View>
        </View>

        {/* ─── دکمه‌های ثبت/برگشت ─── */}
        <View style={S.btnRowBottom}>
          <TouchableOpacity style={[S.btnSecondary, { flex: 1 }]} onPress={() => setView('list')}>
            <Text style={S.btnSecondaryTxt}>↩️ برگشت</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btnSubmit, { flex: 2 }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={S.btnSubmitTxt}>✅ ثبت نهایی فروش</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ═══════════════ حالت لیست ═══════════════
  return (
    <ScrollView style={S.page} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginVertical: 8 }}>
        <TouchableOpacity style={[S.btnPrimary, { flex: 1 }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}>
          <Text style={S.btnPrimaryTxt}>➕ فاکتور جدید</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.btnSecondary, { flex: 1 }]} onPress={() => setView('reprint')}>
          <Text style={S.btnSecondaryTxt}>🖨️ پرینت مجدد</Text>
        </TouchableOpacity>
      </View>

      <Text style={S.sectionTitle}>📄 فاکتورها ({toFaNum(list.length)})</Text>

                   {loading ? <ActivityIndicator color={S.order} /> : list.filter((inv: any) => !hiddenSales.includes(inv.invoice)).map((inv: any) => (
        <View key={inv.invoice} style={S.listCard}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={S.listCardInvoice}>{inv.invoice}</Text>
            <TouchableOpacity onPress={() => remove(inv.invoice)}>
              <Text style={{ fontSize: 18 }}>🗑</Text>
            </TouchableOpacity>
          </View>
          <Text style={S.listCardCust}>👤 {inv.name} — {inv.phone}</Text>
          <Text style={S.listCardStat}>💰 {fmt(inv.total)} | 💳 {fmt(inv.paid)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}


// ══════════════════════════════════════════════════════════
//  استایل‌های صفحه فروش (داینامیک بر اساس تم)
// ══════════════════════════════════════════════════════════
function getS() {
  const dark = THEME_MODE === 'dark';
  const pageBg = dark ? '#0f2438' : '#f5f7fa';
  const cardBg = dark ? '#1a2332' : '#ffffff';
  const cardAltBg = dark ? '#0a1628' : '#fafbfc';
  const textClr = dark ? '#ffffff' : '#1a2332';
  const textMutClr = dark ? '#94a3b8' : '#64748b';
  const borderClr = dark ? '#334155' : '#e2e8f0';
  const inputBg = dark ? '#1a2332' : '#fafbfc';
  const badgeBg = dark ? '#334155' : '#e8eef5';
  const badgeTxt = dark ? '#e2e8f0' : '#1e3a5f';
  const valueBg = dark ? '#0a1628' : '#f0f4f8';
  const valueTxt = dark ? '#93c5fd' : '#1e3a5f';
  const removeBg = dark ? '#3b1219' : '#fef2f2';
  const removeBrd = dark ? '#7f1d1d' : '#fecaca';
  const removeTxt = dark ? '#fca5a5' : '#b91c1c';
  const btnSecBg = dark ? '#334155' : '#f1f5f9';
  const btnSecBrd = dark ? '#475569' : '#cbd5e1';
  const addModelBrd = dark ? '#475569' : '#cbd2d8';

  return {
    bg: pageBg,
    card: cardBg,
    text: textClr,
    muted: textMutClr,
    border: borderClr,
    inputBg,
    inputBorder: borderClr,
    primary: '#1e3a5f',
    order: '#1d4ed8',
    orderDark: '#1e3a8a',
    orderLight: '#3b82f6',
    gold: '#d4af37',
    goldLight: '#f4d47a',
    itemBg: cardAltBg,
    badgeBg,
    badgeText: badgeTxt,
    removeBg,
    removeText: removeTxt,
    valueBg,
    valueText: valueTxt,

    page: { flex: 1, backgroundColor: pageBg } as any,
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: borderClr,
      shadowColor: '#0f2438',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      overflow: 'hidden',
    } as any,
    cardHeader: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: borderClr,
      backgroundColor: cardBg,
    } as any,
    cardHeaderIcon: { fontSize: 18 } as any,
    cardHeaderTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'right' } as any,
    label: {
      fontSize: 12,
      fontWeight: 'bold',
      color: textClr,
      marginBottom: 5,
      marginTop: 10,
      textAlign: 'right',
    } as any,
    required: { color: '#d4af37', fontWeight: 'bold' } as any,
    input: {
      backgroundColor: inputBg,
      borderWidth: 2,
      borderColor: borderClr,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: textClr,
      textAlign: 'right',
    } as any,
    statusBadge: { fontSize: 11, color: '#059669', fontWeight: 'bold' } as any,
    itemRow: {
      backgroundColor: cardAltBg,
      borderWidth: 1.5,
      borderColor: borderClr,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    } as any,
    itemRowHeader: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    } as any,
    itemRowNumBadge: {
      backgroundColor: badgeBg,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
    } as any,
    itemRowNumTxt: { color: badgeTxt, fontSize: 11, fontWeight: 'bold' } as any,
    itemRemoveBtn: {
      backgroundColor: removeBg,
      borderWidth: 1,
      borderColor: removeBrd,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
    } as any,
    itemRemoveTxt: { color: removeTxt, fontSize: 12, fontWeight: 'bold' } as any,
    threeColRow: { flexDirection: 'row-reverse', gap: 6, marginTop: 6 } as any,
    threeColCell: { flex: 1 } as any,
    miniLabel: {
      fontSize: 10,
      color: textMutClr,
      marginBottom: 3,
      fontWeight: 'bold',
      textAlign: 'right',
    } as any,
    miniInput: {
      backgroundColor: cardBg,
      borderWidth: 1.5,
      borderColor: borderClr,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
      fontSize: 12,
      color: textClr,
      textAlign: 'center',
    } as any,
    miniValue: {
      backgroundColor: valueBg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 34,
    } as any,
    miniValueTxt: { color: valueTxt, fontSize: 12, fontWeight: 'bold' } as any,
    addModelBtn: {
      backgroundColor: cardBg,
      borderWidth: 2,
      borderColor: addModelBrd,
      borderStyle: 'dashed',
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 8,
    } as any,
    addModelBtnTxt: { color: textClr, fontSize: 13, fontWeight: 'bold' } as any,
    summaryCard: {
      backgroundColor: '#1e3a8a',
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 12,
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRightWidth: 4,
      borderRightColor: '#d4af37',
    } as any,
    summaryLbl: { color: '#cbd5e1', fontSize: 12, marginBottom: 4, textAlign: 'right' } as any,
    summaryVal: { color: '#f4d47a', fontSize: 22, fontWeight: 'bold' } as any,
    summaryCnt: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' } as any,
    btnRowBottom: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 } as any,
    btnSubmit: {
      backgroundColor: '#1e3a8a',
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    } as any,
    btnSubmitTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' } as any,
    btnPrimary: {
      backgroundColor: '#1e3a8a',
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    } as any,
    btnPrimaryTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' } as any,
    btnSecondary: {
      backgroundColor: btnSecBg,
      borderWidth: 1,
      borderColor: btnSecBrd,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    } as any,
    btnSecondaryTxt: { color: textClr, fontSize: 14, fontWeight: 'bold' } as any,
    sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: textClr,
      marginTop: 12,
      marginBottom: 8,
      textAlign: 'right',
    } as any,
    listCard: {
      backgroundColor: cardBg,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderRightWidth: 4,
      borderRightColor: '#1e3a8a',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderLeftWidth: 1,
      borderTopColor: borderClr,
      borderBottomColor: borderClr,
      borderLeftColor: borderClr,
    } as any,
    listCardInvoice: { fontSize: 13, fontWeight: 'bold', color: textClr } as any,
    listCardCust: { fontSize: 11, color: textMutClr, marginBottom: 6, textAlign: 'right' } as any,
    listCardStat: { fontSize: 11, color: textClr } as any,
  };
}
// ══════════════════════════════════════════════════════════
//  PURCHASE SCREEN — کارت‌های عمودی
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
  const [payerCode, setPayerCode] = useState('');
  const [receiverAcc, setReceiverAcc] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [hiddenPurchases, setHiddenPurchases] = useState<string[]>([]);

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
    const remove = async (inv: string) => {
    const ok = await confirmMsg('پنهان کردن', `فاکتور ${inv} از لیست پنهان شود؟\n\n(در دیتابیس باقی می‌ماند)`);
    if (!ok) return;
    setHiddenPurchases([...hiddenPurchases, inv]);
    showToast('✅ از لیست پنهان شد');
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
      await createPurchase({ invoiceNumber: inv, manualInvoice: manualInv, supplierName: sName, supplierCode: sCode, supplierPhone: sPhone, items: valid, paymentAmount: amt, paymentDate: payDate, bankAccount: bankAcc, payerName, payerCode, receiverAccount: receiverAcc, note });
      alertMsg('✅ موفق', 'فاکتور خرید ثبت شد');
      setSName(''); setSCode(''); setSPhone(''); setManualInv(''); setItems([]);
      setPayAmt(''); setBankAcc(''); setPayerName(''); setPayerCode(''); setReceiverAcc(''); setNote('');
      setView('list'); load();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };

  if (view === 'form') return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formTitle}>🛍️ فاکتور خرید</Text>

        <View style={[s.customerCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.customerCardTitle, { color: C.text }]}>🏭 اطلاعات تأمین‌کننده</Text>
          <Autocomplete label="🏭 نام تأمین‌کننده *" value={sName} onChange={setSName} onSelect={onSupplierPick} options={[...new Set([...prods.map(p => p.supplier_name || '').filter(Boolean)])]} placeholder="تایپ یا انتخاب..." />
          <Text style={[s.lbl, { color: C.textMut }]}>🆔 کد تأمین‌کننده</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={sCode} onChangeText={setSCode} placeholder="خودکار" placeholderTextColor={C.textMut} />
          <Text style={[s.lbl, { color: C.textMut }]}>📞 تلفن</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={sPhone} onChangeText={setSPhone} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor={C.textMut} />
          <Text style={[s.lbl, { color: C.textMut }]}>🧾 شماره فاکتور دستی *</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={manualInv} onChangeText={setManualInv} placeholder="شماره روی فاکتور" placeholderTextColor={C.textMut} />
        </View>

        <Text style={s.secT}>📦 اقلام خرید ({toFaNum(items.length)})</Text>

        {items.map((it, i) => {
          const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
          return (
            <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={[s.itemHeader, { backgroundColor: C.cardAlt }]}>
                <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
                <TouchableOpacity onPress={() => delItem(i)} style={s.delBtnRound}>
                  <Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>🗑</Text>
                </TouchableOpacity>
              </View>
              <View style={{ padding: 10 }}>
                <Autocomplete value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="نام مدل..." />
                <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.miniLbl, { color: C.textMut }]}>کد مدل</Text>
                    <View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
                      <Text style={[s.miniValueTxt, { color: C.text }]}>{it.modelCode || '—'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.miniLbl, { color: C.textMut }]}>تعداد</Text>
                    <TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.miniLbl, { color: C.textMut }]}>قیمت</Text>
                    <TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.miniLbl, { color: C.textMut }]}>مبلغ کل</Text>
                    <View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: lineTotal ? '#00ff88' : C.border }]}>
                      <Text style={[s.miniValueTxt, { color: lineTotal ? '#00ff88' : C.textMut }]}>{lineTotal ? fmt(lineTotal) : '—'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.miniLbl, { color: C.textMut }]}>شرح</Text>
                    <TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor={C.textMut} />
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.btnTxt}>➕ افزودن مدل</Text></TouchableOpacity>

        <View style={s.grandSummary}>
          <View style={{ flex: 1 }}><Text style={s.gsLbl}>💰 جمع مبلغ کل</Text><Text style={s.gsVal}>{fmt(grandTotal)}</Text></View>
          <View style={{ alignItems: 'center' }}><Text style={s.gsLbl}>📦 تعداد اقلام</Text><Text style={s.gsQty}>{toFaNum(grandQty)}</Text></View>
        </View>

        <Text style={s.secT}>💳 اطلاعات پرداخت</Text>
        <Text style={[s.lbl, { color: C.textMut }]}>مبلغ پرداخت نقدی</Text>
        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={payAmt} onChangeText={setPayAmt} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>💵 پرداخت</Text><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: '#059669' }]}><Text style={[s.miniValueTxt, { color: '#059669' }]}>{paidAmt ? fmt(paidAmt) : '—'}</Text></View></View>
          <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>📌 مانده</Text><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: remaining > 0 ? '#dc2626' : '#059669' }]}><Text style={[s.miniValueTxt, { color: remaining > 0 ? '#dc2626' : '#059669' }]}>{grandTotal ? fmt(remaining) : '—'}</Text></View></View>
        </View>

        <Text style={[s.lbl, { color: C.textMut }]}>📅 تاریخ پرداخت</Text>
        <DateField value={payDate} onChange={setPayDate} compact defaultToToday />
        <Autocomplete
          label="👤 نام پرداخت‌کننده"
          value={payerName}
          onChange={setPayerName}
          onSelect={async (v: string) => {
            const c = await lookupCodeByName(v);
            setPayerCode(c);
          }}
          options={Array.from(new Set([
            ...prods.map((p: any) => p.payer_name || '').filter(Boolean),
            ...prods.map((p: any) => p.supplier_name || '').filter(Boolean),
          ]))}
          placeholder="کلیک..."
        />
        <Text style={[s.lbl, { color: C.textMut }]}>🆔 کد پرداخت‌کننده</Text>
        <TextInput style={[s.inp, { backgroundColor: C.cardAlt, color: C.textMut, borderColor: C.border }]} value={payerCode} editable={false} placeholder="خودکار" placeholderTextColor={C.textMut} />
        <Text style={[s.lbl, { color: C.textMut }]}>🏦 حساب پرداخت‌کننده (بانک)</Text>
        <Autocomplete value={bankAcc} onChange={setBankAcc} options={BANKS} placeholder="انتخاب بانک..." />
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
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#166534', marginTop: 8 }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}>
        <Text style={s.btnTxt}>➕ فاکتور خرید جدید</Text>
      </TouchableOpacity>
      <Text style={s.secT}>📄 خریدها ({toFaNum(list.length)})</Text>
            {loading ? <ActivityIndicator color="#34d399" /> : list.filter((inv: any) => !hiddenPurchases.includes(inv.invoice)).map((inv: any) => (
              <View key={inv.invoice} style={[s.invCard, { backgroundColor: C.card, borderRightColor: '#166534' }]}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={s.invNum}>{inv.invoice}</Text>
            <TouchableOpacity onPress={() => remove(inv.invoice)}>
              <Text style={{ fontSize: 18 }}>👁️</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.invCust}>🏭 {inv.name}</Text>
          <Text style={s.invStat}>💰 {fmt(inv.total)} | 💳 {fmt(inv.paid)}</Text>
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
  const [loading, setLoading] = useState(false);
  const ref = useRef<View>(null);

  const loadReport = async () => {
    if (!code.trim()) return showToast('کد را وارد کن', true);
    setLoading(true);
    try {
      const c2 = code.trim();
      const [
        { data: salesAsCustomer },
        { data: purchasesAsSupplier },
        { data: triangRecv },
      ] = await Promise.all([
        supabase.from('sales').select('*').eq('customer_code', c2).order('created_at'),
        supabase.from('purchases').select('*').eq('supplier_code', c2).order('created_at'),
        supabase.from('sales').select('*').eq('account_holder_code', c2).order('created_at'),
      ]);

      const hasAny = (salesAsCustomer?.length || 0) + (purchasesAsSupplier?.length || 0) + (triangRecv?.length || 0);
      if (!hasAny) { showToast('داده‌ای برای این کد یافت نشد', true); setReport(null); return; }

      const name = salesAsCustomer?.[0]?.customer_name
        || purchasesAsSupplier?.[0]?.supplier_name
        || triangRecv?.[0]?.account_holder || '—';
      const phone = salesAsCustomer?.[0]?.customer_phone
        || purchasesAsSupplier?.[0]?.supplier_phone || '—';

      const salesRows = (salesAsCustomer || []).map((r: any) => ({
        date: r.date_reg || r.date_factor, invoice: r.invoice_number,
        modelCode: r.model_code, modelName: r.model_name,
        qty: Number(r.quantity) || 0, priceUnit: Number(r.price_unit) || 0,
        total: (Number(r.quantity) || 0) * (Number(r.price_unit) || 0),
        payment: Number(r.payment) || 0,
        bank: r.bank_name || '', holder: r.account_holder || '',
        holderCode: r.account_holder_code || '',
        depositDate: r.deposit_date || '', shipping: r.shipping || '',
        desc: r.description || '',
      }));

      const purchaseRows = (purchasesAsSupplier || []).map((r: any) => ({
        date: r.date_reg || r.date_factor, invoice: r.invoice_number,
        manualInv: r.manual_invoice || '',
        modelCode: r.model_code, modelName: r.model_name,
        qty: Number(r.quantity) || 0, priceUnit: Number(r.price_unit) || 0,
        total: (Number(r.quantity) || 0) * (Number(r.price_unit) || 0),
        payment: Number(r.payment) || 0,
        bank: r.bank_name || '', holder: r.account_holder || '',
        payerCode: r.payer_code || '',
        depositDate: r.deposit_date || '',
        desc: r.description || '',
      }));

      const triangRows = (triangRecv || []).map((r: any) => ({
        date: r.date_reg || r.date_factor, invoice: r.invoice_number,
        fromName: r.customer_name, fromCode: r.customer_code, fromPhone: r.customer_phone,
        amount: Number(r.payment) || 0,
        bank: r.bank_name || '', holder: r.account_holder || '',
        depositDate: r.deposit_date || '',
      }));

      const totalSales = salesRows.reduce((a: number, r: any) => a + r.total, 0);
      const paidByCustomer = salesRows.reduce((a: number, r: any) => a + r.payment, 0);
      const totalPurchases = purchaseRows.reduce((a: number, r: any) => a + r.total, 0);
      const paidToSupplier = purchaseRows.reduce((a: number, r: any) => a + r.payment, 0);
      const totalTriang = triangRows.reduce((a: number, r: any) => a + r.amount, 0);

      const customerOwes = totalSales - paidByCustomer;
      const weOwe = totalPurchases - paidToSupplier - totalTriang;
      const net = customerOwes - weOwe;

      setReport({
        code: c2, name, phone,
        salesRows, purchaseRows, triangRows,
        totals: { totalSales, paidByCustomer, customerOwes, totalPurchases, paidToSupplier, weOwe, totalTriang, net },
        timeString: displayDate(new Date()),
      });
    } catch (e: any) { showToast(e.message, true); }
    finally { setLoading(false); }
  };

  const capture = async (mode: 'share' | 'print') => {
    try {
      const uri = await captureRef(ref, { format: 'jpg', quality: 0.95 });
      if (mode === 'print') await Print.printAsync({ uri });
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch (e: any) { showToast(e.message, true); }
  };

  const exportExcel = async () => {
    if (!report) return;
    try {
      const wb = XLSX.utils.book_new();
      const t = report.totals;

      if (report.salesRows.length) {
        const data = report.salesRows.map((r: any, i: number) => ({
          '#': i + 1, 'تاریخ': displayDateOnly(r.date), 'فاکتور': r.invoice,
          'کد مدل': r.modelCode, 'نام مدل': r.modelName,
          'تعداد': r.qty, 'قیمت واحد': r.priceUnit, 'جمع': r.total,
          'پرداخت': r.payment, 'مانده': r.total - r.payment,
          'بانک': r.bank, 'صاحب حساب': r.holder, 'کد صاحب حساب': r.holderCode,
          'تاریخ واریز': displayDateOnly(r.depositDate), 'باربری': r.shipping, 'شرح': r.desc,
        }));
        data.push({ 'نام مدل': 'جمع فروش', 'جمع': t.totalSales, 'پرداخت': t.paidByCustomer, 'مانده': t.customerOwes } as any);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'فروش');
      }

      if (report.purchaseRows.length) {
        const data = report.purchaseRows.map((r: any, i: number) => ({
          '#': i + 1, 'تاریخ': displayDateOnly(r.date), 'فاکتور': r.invoice, 'فاکتور دستی': r.manualInv,
          'کد مدل': r.modelCode, 'نام مدل': r.modelName,
          'تعداد': r.qty, 'قیمت واحد': r.priceUnit, 'جمع': r.total,
          'پرداخت': r.payment, 'مانده': r.total - r.payment,
          'بانک': r.bank, 'صاحب حساب': r.holder, 'کد پرداخت‌کننده': r.payerCode,
          'تاریخ واریز': displayDateOnly(r.depositDate), 'شرح': r.desc,
        }));
        data.push({ 'نام مدل': 'جمع خرید', 'جمع': t.totalPurchases, 'پرداخت': t.paidToSupplier, 'مانده': t.weOwe + t.totalTriang } as any);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'خرید');
      }

      if (report.triangRows.length) {
        const data = report.triangRows.map((r: any, i: number) => ({
          '#': i + 1, 'تاریخ': displayDateOnly(r.date), 'فاکتور فروش': r.invoice,
          'فرستنده': r.fromName, 'کد فرستنده': r.fromCode, 'تلفن فرستنده': r.fromPhone,
          'مبلغ': r.amount, 'بانک': r.bank, 'گیرنده': r.holder,
          'تاریخ واریز': displayDateOnly(r.depositDate),
        }));
        data.push({ 'فرستنده': 'جمع مثلثی', 'مبلغ': t.totalTriang } as any);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'مثلثی');
      }

      const summary = [
        { 'شرح': 'نام', 'مقدار': report.name },
        { 'شرح': 'کد', 'مقدار': report.code },
        { 'شرح': 'تلفن', 'مقدار': report.phone },
        { 'شرح': 'جمع فروش ما به ایشان', 'مقدار': t.totalSales },
        { 'شرح': 'دریافت از ایشان', 'مقدار': t.paidByCustomer },
        { 'شرح': 'بدهی ایشان به ما', 'مقدار': t.customerOwes },
        { 'شرح': 'جمع خرید ما از ایشان', 'مقدار': t.totalPurchases },
        { 'شرح': 'پرداخت ما به ایشان', 'مقدار': t.paidToSupplier },
        { 'شرح': 'دریافت مثلثی به نیابت', 'مقدار': t.totalTriang },
        { 'شرح': 'بدهی ما به ایشان', 'مقدار': t.weOwe },
        { 'شرح': t.net > 0 ? 'بدهی نهایی ایشان' : t.net < 0 ? 'بدهی نهایی ما' : 'تسویه', 'مقدار': Math.abs(t.net) },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'خلاصه');

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const path = (FileSystem as any).cacheDirectory + 'report-' + report.code + '-' + Date.now() + '.xlsx';
      await FileSystem.writeAsStringAsync(path, wbout, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      showToast('✅ اکسل آماده شد');
    } catch (e: any) { showToast(e.message, true); }
  };

  const t = report?.totals;

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Text style={s.formTitle}>🖨️ گزارش جامع حساب</Text>
      <Text style={[s.lbl, { color: C.textMut }]}>کد طرف حساب</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={code} onChangeText={setCode} placeholder="M_1001" placeholderTextColor={C.textMut} />
      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={loadReport} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔍 نمایش گزارش کامل</Text>}
      </TouchableOpacity>

      {report && t && (
        <>
          <View ref={ref} collapsable={false} style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginTop: 16 }}>
            <View style={{ borderBottomWidth: 2, borderBottomColor: '#d4af37', paddingBottom: 6, marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' }}>⚖️ گزارش جامع — میزان</Text>
              <Text style={{ fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 3 }}>📅 {report.timeString}</Text>
            </View>

            <View style={{ backgroundColor: '#f8fafc', borderRadius: 6, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 11, color: '#1e3a5f', fontWeight: 'bold', textAlign: 'right' }}>👤 {report.name}</Text>
              <Text style={{ fontSize: 10, color: '#475569', textAlign: 'right', marginTop: 2 }}>🆔 {report.code}   📞 {report.phone}</Text>
            </View>

            {report.salesRows.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#1e40af', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#eff6ff', padding: 6, borderRadius: 6, marginBottom: 4 }}>
                  🛒 فروش — {toFaNum(report.salesRows.length)} ردیف
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={{ flexDirection: 'row-reverse', backgroundColor: '#1e3a8a', paddingVertical: 4 }}>
                      <Text style={{ width: 28, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>#</Text>
                      <Text style={{ width: 75, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>
                      <Text style={{ width: 95, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>
                      <Text style={{ width: 75, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>کد مدل</Text>
                      <Text style={{ width: 140, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>نام مدل</Text>
                      <Text style={{ width: 40, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تعداد</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>قیمت</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>جمع</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>پرداخت</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>مانده</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>بانک</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>صاحب حساب</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>کد صاحب</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تاریخ واریز</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>باربری</Text>
                      <Text style={{ width: 110, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>شرح</Text>
                    </View>
                    {report.salesRows.map((r: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                        <Text style={{ width: 28, color: '#d4af37', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{toFaNum(i + 1)}</Text>
                        <Text style={{ width: 75, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{displayDateOnly(r.date)}</Text>
                        <Text style={{ width: 95, color: '#7c3aed', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.invoice}</Text>
                        <Text style={{ width: 75, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{r.modelCode || '—'}</Text>
                        <Text style={{ width: 140, color: '#1e3a5f', fontSize: 9, textAlign: 'right' }} numberOfLines={2}>{r.modelName || '—'}</Text>
                        <Text style={{ width: 40, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{toFaNum(r.qty)}</Text>
                        <Text style={{ width: 80, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{fmt(r.priceUnit)}</Text>
                        <Text style={{ width: 90, color: '#1e40af', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{fmt(r.total)}</Text>
                        <Text style={{ width: 80, color: '#059669', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.payment ? fmt(r.payment) : '—'}</Text>
                        <Text style={{ width: 90, color: r.total - r.payment > 0 ? '#dc2626' : '#059669', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{fmt(r.total - r.payment)}</Text>
                        <Text style={{ width: 80, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.bank || '—'}</Text>
                        <Text style={{ width: 90, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.holder || '—'}</Text>
                        <Text style={{ width: 80, color: '#7c3aed', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.holderCode || '—'}</Text>
                        <Text style={{ width: 80, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.depositDate ? displayDateOnly(r.depositDate) : '—'}</Text>
                        <Text style={{ width: 90, color: '#6d28d9', fontSize: 9, textAlign: 'center' }}>{r.shipping || '—'}</Text>
                        <Text style={{ width: 110, color: '#475569', fontSize: 9, textAlign: 'right' }} numberOfLines={2}>{r.desc || '—'}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#3b82f6', paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 10, color: '#1e3a5f', fontWeight: 'bold' }}>جمع: {fmt(t.totalSales)}</Text>
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>دریافت: {fmt(t.paidByCustomer)}</Text>
                  <Text style={{ fontSize: 10, color: '#dc2626', fontWeight: 'bold' }}>بدهی ایشان: {fmt(t.customerOwes)}</Text>
                </View>
              </View>
            )}

            {report.purchaseRows.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#9a3412', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#fff7ed', padding: 6, borderRadius: 6, marginBottom: 4 }}>
                  🛍️ خرید — {toFaNum(report.purchaseRows.length)} ردیف
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={{ flexDirection: 'row-reverse', backgroundColor: '#9a3412', paddingVertical: 4 }}>
                      <Text style={{ width: 28, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>#</Text>
                      <Text style={{ width: 75, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>
                      <Text style={{ width: 95, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>
                      <Text style={{ width: 75, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>کد مدل</Text>
                      <Text style={{ width: 140, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>نام مدل</Text>
                      <Text style={{ width: 40, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تعداد</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>قیمت</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>جمع</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>پرداخت</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>مانده</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>بانک</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>صاحب حساب</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>کد پرداخت</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تاریخ واریز</Text>
                      <Text style={{ width: 110, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>شرح</Text>
                    </View>
                    {report.purchaseRows.map((r: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#fff7ed' : '#fff', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#fed7aa' }}>
                        <Text style={{ width: 28, color: '#d4af37', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{toFaNum(i + 1)}</Text>
                        <Text style={{ width: 75, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{displayDateOnly(r.date)}</Text>
                        <Text style={{ width: 95, color: '#7c3aed', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.invoice}</Text>
                        <Text style={{ width: 75, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{r.modelCode || '—'}</Text>
                        <Text style={{ width: 140, color: '#1e3a5f', fontSize: 9, textAlign: 'right' }} numberOfLines={2}>{r.modelName || '—'}</Text>
                        <Text style={{ width: 40, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{toFaNum(r.qty)}</Text>
                        <Text style={{ width: 80, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{fmt(r.priceUnit)}</Text>
                        <Text style={{ width: 90, color: '#9a3412', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{fmt(r.total)}</Text>
                        <Text style={{ width: 80, color: '#059669', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.payment ? fmt(r.payment) : '—'}</Text>
                        <Text style={{ width: 90, color: r.total - r.payment > 0 ? '#dc2626' : '#059669', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{fmt(r.total - r.payment)}</Text>
                        <Text style={{ width: 80, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.bank || '—'}</Text>
                        <Text style={{ width: 90, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.holder || '—'}</Text>
                        <Text style={{ width: 80, color: '#7c3aed', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.payerCode || '—'}</Text>
                        <Text style={{ width: 80, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.depositDate ? displayDateOnly(r.depositDate) : '—'}</Text>
                        <Text style={{ width: 110, color: '#475569', fontSize: 9, textAlign: 'right' }} numberOfLines={2}>{r.desc || '—'}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#f97316', paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 10, color: '#1e3a5f', fontWeight: 'bold' }}>جمع: {fmt(t.totalPurchases)}</Text>
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>پرداخت: {fmt(t.paidToSupplier)}</Text>
                  <Text style={{ fontSize: 10, color: '#dc2626', fontWeight: 'bold' }}>بدهی ما: {fmt(t.weOwe + t.totalTriang)}</Text>
                </View>
              </View>
            )}

            {report.triangRows.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#065f46', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6, marginBottom: 4 }}>
                  🔺 پرداخت مشتریان ما — {toFaNum(report.triangRows.length)} ردیف
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={{ flexDirection: 'row-reverse', backgroundColor: '#065f46', paddingVertical: 4 }}>
                      <Text style={{ width: 28, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>#</Text>
                      <Text style={{ width: 75, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>
                      <Text style={{ width: 95, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>
                      <Text style={{ width: 130, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>فرستنده</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>کد فرستنده</Text>
                      <Text style={{ width: 100, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تلفن</Text>
                      <Text style={{ width: 100, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>مبلغ</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>بانک</Text>
                      <Text style={{ width: 90, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>گیرنده</Text>
                      <Text style={{ width: 80, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>تاریخ واریز</Text>
                    </View>
                    {report.triangRows.map((r: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f0fdf4' : '#fff', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#d1fae5' }}>
                        <Text style={{ width: 28, color: '#d4af37', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{toFaNum(i + 1)}</Text>
                        <Text style={{ width: 75, color: '#1e3a5f', fontSize: 9, textAlign: 'center' }}>{displayDateOnly(r.date)}</Text>
                        <Text style={{ width: 95, color: '#7c3aed', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.invoice}</Text>
                        <Text style={{ width: 130, color: '#1e3a5f', fontSize: 9, textAlign: 'right' }}>{r.fromName}</Text>
                        <Text style={{ width: 80, color: '#7c3aed', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{r.fromCode}</Text>
                        <Text style={{ width: 100, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.fromPhone || '—'}</Text>
                        <Text style={{ width: 100, color: '#065f46', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>{fmt(r.amount)}</Text>
                        <Text style={{ width: 80, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.bank || '—'}</Text>
                        <Text style={{ width: 90, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.holder || '—'}</Text>
                        <Text style={{ width: 80, color: '#475569', fontSize: 9, textAlign: 'center' }}>{r.depositDate ? displayDateOnly(r.depositDate) : '—'}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <Text style={{ fontSize: 10, color: '#065f46', fontWeight: 'bold', textAlign: 'right', marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#10b981' }}>
                  جمع دریافتی مثلثی: {fmt(t.totalTriang)} تومان
                </Text>
              </View>
            )}

            <View style={{ backgroundColor: t.net > 0 ? '#fef2f2' : t.net < 0 ? '#f0fdf4' : '#f3f4f6', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 2, borderColor: t.net > 0 ? '#dc2626' : t.net < 0 ? '#059669' : '#94a3b8' }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6, color: t.net > 0 ? '#991b1b' : t.net < 0 ? '#065f46' : '#475569' }}>
                {t.net > 0 ? '⚖️ مانده نهایی — ایشان بدهکارند' : t.net < 0 ? '💰 مانده نهایی — ما بدهکاریم' : '✅ تسویه کامل'}
              </Text>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: '#64748b' }}>بدهی ایشان به ما:</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e3a5f' }}>{fmt(t.customerOwes)}</Text>
              </View>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: '#64748b' }}>بدهی ما به ایشان:</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e3a5f' }}>{fmt(t.weOwe + t.totalTriang)}</Text>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4, paddingTop: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: t.net > 0 ? '#dc2626' : t.net < 0 ? '#059669' : '#475569' }}>
                  {fmt(Math.abs(t.net))} تومان
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>میزان — حساب‌ها دقیق، معاملات امن، ذهن آسوده</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#c0392b' }]} onPress={exportExcel}><Text style={s.btnTxt}>📥 اکسل</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#0ea5e9' }]} onPress={() => capture('share')}><Text style={s.btnTxt}>📤 اشتراک</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#8e44ad' }]} onPress={() => capture('print')}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

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
        <Text style={[s.statsVal, { color: total >= 0 ? '#00ff88' : '#ff3355' }]}>{fmt(total)}</Text>
        <Text style={s.statsUnit}>تومان</Text>
      </View>
      {stats?.estimatedCount > 0 && (<View style={s.warnBox}><Text style={s.warnTxt}>📊 {stats.estimatedCount} مدل بدون خرید — سود {Math.round((stats.defaultMargin || 0.1) * 100)}٪ تخمین زده شد</Text></View>)}
      <Text style={s.secT}>💹 سود به تفکیک مدل ({toFaNum(models.length)})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 90 }]}>کد</Text>
            <Text style={[s.thCell, { width: 180 }]}>نام مدل</Text>
            <Text style={[s.thCell, { width: 120 }]}>خرید</Text>
            <Text style={[s.thCell, { width: 120 }]}>فروش</Text>
            <Text style={[s.thCell, { width: 110 }]}>سود/واحد</Text>
            <Text style={[s.thCell, { width: 90 }]}>تعداد فروش</Text>
            <Text style={[s.thCell, { width: 130 }]}>جمع سود</Text>
            <Text style={[s.thCell, { width: 140 }]}>منبع قیمت</Text>
          </View>
          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : models.map((m: any, i: number) => {
            const avgSale = m.totalQty ? (m.totalSales / m.totalQty) : 0;
            const unitProfit = m.purchasePrice > 0 ? (avgSale - m.purchasePrice) : 0;
            return (
              <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, m.estimated && { backgroundColor: C.isDark ? '#1e1b4b' : '#f5f3ff' }]}>
                <Text style={[s.tdCell, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
                <Text style={[s.tdCell, { width: 90, color: '#7c3aed', fontWeight: 'bold' }]}>{m.code}</Text>
                <Text style={[s.tdCell, { width: 180, color: C.text, textAlign: 'right', fontWeight: 'bold' }]} numberOfLines={1}>{m.name}</Text>
                <Text style={[s.tdCell, { width: 120, color: C.text }]}>{m.purchasePrice > 0 ? fmt(Math.round(m.purchasePrice)) : '—'}</Text>
                <Text style={[s.tdCell, { width: 120, color: C.text }]}>{avgSale ? fmt(Math.round(avgSale)) : '—'}</Text>
                <Text style={[s.tdCell, { width: 110, color: unitProfit > 0 ? '#059669' : '#dc2626', fontWeight: 'bold' }]}>{unitProfit ? fmt(Math.round(unitProfit)) : '—'}</Text>
                <Text style={[s.tdCell, { width: 90, color: C.text }]}>{fmt(m.totalQty)}</Text>
                <Text style={[s.tdCell, { width: 130, color: m.totalProfit >= 0 ? '#00ff88' : '#ff3355', fontWeight: 'bold' }]}>{fmt(m.totalProfit)}</Text>
                <View style={[s.tdCell, { width: 140, alignItems: 'center' }]}>
                  <Text style={[s.badge, m.priceSource === 'same-month' && { backgroundColor: '#d1fae5', color: '#065f46' }, m.priceSource === 'historical' && { backgroundColor: '#d1fae5', color: '#065f46' }, m.priceSource === 'estimated' && { backgroundColor: '#ede9fe', color: '#6d28d9' }, { fontSize: 9, paddingHorizontal: 6, paddingVertical: 2 }]}>
                    {m.priceSource === 'same-month' ? '✅ خرید هم‌ماه' : m.priceSource === 'historical' ? '📜 خرید تاریخی' : m.priceSource === 'estimated' ? `📊 تخمینی ${Math.round((stats?.defaultMargin || 0.1) * 100)}٪` : '—'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {!loading && !models.length && <Text style={s.empty}>💹 در این بازه فروشی ثبت نشده</Text>}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  INVENTORY SCREEN — جدول ردیفی مثل وب
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
  const statusColor = (st: string) => st === 'negative' ? '#94a3b8' : st === 'out' ? '#dc2626' : st === 'low' ? '#d97706' : '#059669';

  return (
    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {/* آمار */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        {[{ l: '📊 مدل‌ها', v: stats.totalModels || 0, c: '#60a5fa' }, { l: '📦 جمع', v: stats.totalQty || 0, c: '#34d399' }, { l: '⚠️ کمبود', v: stats.lowStock || 0, c: '#fb923c' }, { l: '🔴 ناموجود', v: stats.outOfStock || 0, c: '#f87171' }, { l: '⚫ منفی', v: stats.negative || 0, c: '#94a3b8' }].map((b, i) => (
          <View key={i} style={[s.sBox, { backgroundColor: C.card }]}><Text style={s.sBoxL}>{b.l}</Text><Text style={[s.sBoxV, { color: b.c }]}>{fmt(b.v)}</Text></View>
        ))}
      </View>

      {/* آستانه */}
      <View style={[s.thresholdBox, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.lbl, { color: C.textMut }]}>⚙️ آستانه کمبود</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TextInput style={[s.inp, { flex: 1, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={thresholdInput} onChangeText={setThresholdInput} keyboardType="numeric" />
          <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#059669' }]} onPress={saveThreshold}><Text style={s.btnTxt}>💾</Text></TouchableOpacity>
        </View>
      </View>

      {/* جستجو و فیلتر */}
      <TextInput style={[s.inp, { marginTop: 10, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو: کد، نام، قفسه..." placeholderTextColor={C.textMut} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'negative', l: '⚫ منفی' }, { k: 'out', l: '🔴 ناموجود' }, { k: 'low', l: '⚠️ کمبود' }, { k: 'ok', l: '✅ سالم' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}><Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text></TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.secT}>📦 موجودی ({toFaNum(filtered.length)})</Text>

      {/* ⭐ جدول ردیفی */}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 100 }]}>کد</Text>
            <Text style={[s.thCell, { width: 180 }]}>نام مدل</Text>
            <Text style={[s.thCell, { width: 90 }]}>خرید</Text>
            <Text style={[s.thCell, { width: 90 }]}>فروش</Text>
            <Text style={[s.thCell, { width: 100 }]}>موجودی</Text>
            <Text style={[s.thCell, { width: 140 }]}>موقعیت قفسه</Text>
            <Text style={[s.thCell, { width: 120 }]}>وضعیت</Text>
            <Text style={[s.thCell, { width: 100 }]}>عملیات</Text>
          </View>
          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((m: any, i: number) => {
            const rowBg = m.status === 'negative' ? (C.isDark ? '#1e293b' : '#f1f5f9') : m.status === 'out' ? (C.isDark ? '#3b1219' : '#fef2f2') : m.status === 'low' ? (C.isDark ? '#3b2a12' : '#fffbeb') : (i % 2 === 0 ? C.cardAlt : 'transparent');
            return (
              <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: rowBg, borderRightWidth: 3, borderRightColor: statusColor(m.status) }]}>
                <Text style={[s.tdCell, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
                <Text style={[s.tdCell, { width: 100, color: '#7c3aed', fontWeight: 'bold' }]}>{m.code}</Text>
                <Text style={[s.tdCell, { width: 180, color: C.text, textAlign: 'right', fontWeight: 'bold' }]} numberOfLines={1}>{m.name}</Text>
                <Text style={[s.tdCell, { width: 90, color: C.text }]}>{fmt(m.bought)}</Text>
                <Text style={[s.tdCell, { width: 90, color: C.text }]}>{fmt(m.sold)}</Text>
                <Text style={[s.tdCell, { width: 100, color: statusColor(m.status), fontWeight: 'bold', fontSize: 15 }]}>{fmt(m.currentQty)}</Text>
                <TouchableOpacity style={{ width: 140, alignItems: 'center', paddingVertical: 4 }} onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }}>
                  <View style={{ backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ color: '#075985', fontSize: 11, fontWeight: 'bold' }}>📍 {m.shelf || 'ثبت نشده'}</Text>
                  </View>
                </TouchableOpacity>
                <View style={[s.tdCell, { width: 120, alignItems: 'center' }]}>
                  <Text style={{ color: statusColor(m.status), fontSize: 11, fontWeight: 'bold' }}>{statusLabel(m.status)}</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }} style={[s.tdCell, { width: 100, alignItems: 'center' }]}>
                  <View style={{ backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>📍 قفسه</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal قفسه */}
      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>
        <View style={s.modalBg}><View style={[s.modalBox, { backgroundColor: C.card }]}>
          <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}><Text style={s.modalHeadTxt}>📍 قفسه — {editItem?.name}</Text><TouchableOpacity onPress={() => setEditItem(null)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>
          <View style={{ padding: 16 }}>
            <Text style={[s.modalLbl, { color: C.textMut }]}>کد: <Text style={[s.modalVal, { color: C.text }]}>{editItem?.code}</Text></Text>
            <Text style={[s.modalLbl, { color: C.textMut }]}>موجودی: <Text style={[s.modalVal, { color: C.text }]}>{fmt(editItem?.currentQty || 0)} عدد</Text></Text>
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
//  MANAGEMENT SCREEN — ۶ زیرتب
// ══════════════════════════════════════════════════════════
function ManagementScreen({ showToast, settings, setSettings, reload, tabPins }: any) {
  const [sub, setSub] = useState('unpaid');
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [pendingSettingsUnlock, setPendingSettingsUnlock] = useState(false);
  const openSub = (k: string) => {
    if (k === 'settings' && tabPins?.settings && !settingsUnlocked) { setPendingSettingsUnlock(true); return; }
    setSub(k);
  };
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
          <TouchableOpacity key={t.k} onPress={() => openSub(t.k)} style={[s.subTab, sub === t.k && s.subTabActive]}>
            <Text style={[s.subTabTxt, sub === t.k && s.subTabTxtActive]}>{t.l}{t.k === 'settings' && tabPins?.settings && !settingsUnlocked ? ' 🔒' : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {sub === 'unpaid' && <UnpaidSection showToast={showToast} />}
      {sub === 'newOrder' && <NewOrderSection showToast={showToast} />}
      {sub === 'search' && <SearchSection showToast={showToast} />}
      {sub === 'reports' && <ReportsSection showToast={showToast} />}
      {sub === 'settings' && <SettingsSection showToast={showToast} settings={settings} setSettings={setSettings} reload={reload} />}
      {sub === 'sources' && <SourcesSection showToast={showToast} />}
      <PinModal
        visible={pendingSettingsUnlock}
        correctPin={tabPins?.settings || ''}
        onClose={() => setPendingSettingsUnlock(false)}
        onSuccess={() => {
          setSettingsUnlocked(true);
          setSub('settings');
          setPendingSettingsUnlock(false);
        }}
        showToast={showToast}
      />
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════
//  UNPAID SECTION — جدول ۸ ستونه
// ══════════════════════════════════════════════════════════
function UnpaidSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => { setLoading(true); try { setList(await getUnpaidInvoices()); } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const toggle = (inv: string) => { const n = new Set(selected); n.has(inv) ? n.delete(inv) : n.add(inv); setSelected(n); };
  const toggleAll = () => {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map((x: any) => x.invoice)));
  };
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
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={del} disabled={!selected.size}><Text style={s.btnTxt}>🗑️ حذف ({toFaNum(selected.size)})</Text></TouchableOpacity>
      </View>
      <Text style={s.secT}>📄 پرداخت‌نشده ({toFaNum(list.length)})</Text>

      {/* جدول ۸ ستونه */}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity onPress={toggleAll} style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{selected.size === list.length && list.length > 0 ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 150 }]}>فاکتور</Text>
            <Text style={[s.thCell, { width: 160 }]}>نام</Text>
            <Text style={[s.thCell, { width: 120 }]}>تلفن</Text>
            <Text style={[s.thCell, { width: 130 }]}>مبلغ کل</Text>
            <Text style={[s.thCell, { width: 130 }]}>پرداخت</Text>
            <Text style={[s.thCell, { width: 120 }]}>وضعیت</Text>
          </View>
          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : list.map((inv: any, i: number) => (
            <TouchableOpacity key={inv.invoice} onPress={() => toggle(inv.invoice)} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, selected.has(inv.invoice) && { backgroundColor: '#fee2e2' }]}>
              <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{selected.has(inv.invoice) ? '✅' : '⬜'}</Text>
              </View>
              <Text style={[s.tdCell, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
              <Text style={[s.tdCell, { width: 150, color: '#1e3a5f', fontWeight: 'bold', fontSize: 12 }]}>{inv.invoice}</Text>
              <Text style={[s.tdCell, { width: 160, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{inv.name || '—'}</Text>
              <Text style={[s.tdCell, { width: 120, color: C.textMut, fontSize: 11 }]}>{inv.phone || '—'}</Text>
              <Text style={[s.tdCell, { width: 130, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(inv.total)}</Text>
              <Text style={[s.tdCell, { width: 130, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(inv.paid)}</Text>
              <View style={[s.tdCell, { width: 120, alignItems: 'center' }]}>
                <Text style={{ backgroundColor: '#f8d7da', color: '#721c24', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 10, fontWeight: 'bold' }}>❌ پرداخت‌نشده</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {!loading && !list.length && <Text style={s.empty}>✅ پرداخت‌نشده‌ای نیست</Text>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  NEW ORDER SECTION — کارت فرم سریع
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
    setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: toStorageDateFull(new Date()), bankName: '', accountHolder: '', accountHolderCode: '' }]);
  }, []);

  const onPhone = async (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    setPhone(d); setStatus('');
    if (d.length === 11) {
      setStatus('⏳');
      try { const f = await lookupCustomerByPhone(d); if (f) { setStatus('✅'); if (f.customer_name && !name) setName(f.customer_name); if (f.customer_address && !address) setAddress(f.customer_address); } else setStatus('🆕'); } catch {}
    }
  };
  const addRow = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: toStorageDateFull(new Date()), bankName: '', accountHolder: '', accountHolderCode: '' }]);
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
      setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: toStorageDateFull(new Date()), bankName: '', accountHolder: '', accountHolderCode: '' }]);
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
        const lt = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);
        const lb = lt - (Number(it.payment) || 0);
        return (
          <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[s.itemHeader, { backgroundColor: C.cardAlt }]}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => del(i)} style={s.delBtnRound}><Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>🗑</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <Autocomplete value={it.modelName} onChange={(v) => upd(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder="نام مدل..." />
              <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>کد</Text><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={[s.miniValueTxt, { color: C.text }]}>{it.modelCode || '—'}</Text></View></View>
                <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>تعداد</Text><TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => upd(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>قیمت</Text><TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => upd(i, 'priceUnit', parseNum(v))} keyboardType="numeric" /></View>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
                <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>💰 مبلغ</Text><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: lt ? '#00ff88' : C.border }]}><Text style={[s.miniValueTxt, { color: lt ? '#00ff88' : C.textMut }]}>{lt ? fmt(lt) : '—'}</Text></View></View>
                <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>پرداخت</Text><TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.payment || '')} onChangeText={(v) => upd(i, 'payment', parseNum(v))} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Text style={[s.miniLbl, { color: C.textMut }]}>⚖️ مانده</Text><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: lb > 0 ? '#dc2626' : '#059669' }]}><Text style={[s.miniValueTxt, { color: lb > 0 ? '#dc2626' : '#059669' }]}>{lt ? fmt(lb) : '—'}</Text></View></View>
              </View>
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>➕ افزودن ردیف</Text></TouchableOpacity>
      <View style={s.grandSummary}>
        <View style={{ flex: 1 }}><Text style={s.gsLbl}>💰 جمع کل</Text><Text style={s.gsVal}>{fmt(grandTotal)}</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={s.gsLbl}>📦 تعداد</Text><Text style={s.gsQty}>{toFaNum(grandQty)}</Text></View>
      </View>
      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ ثبت سفارش</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  SEARCH SECTION — جدول ۱۲ ستونه (مثل وب)
// ══════════════════════════════════════════════════════════
function SearchSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [editRows, setEditRows] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);

  const load = async () => { setLoading(true); try { setList(await searchAllInvoices('')); } catch (e: any) { showToast(e.message, true); } finally { setLoading(false); } };
  const loadProds = async () => { try { setProds(await getProducts()); } catch {} };
  useEffect(() => { load(); loadProds(); }, []);

  const filtered = list.filter((r) => {
    if (filter !== 'all' && r.type !== filter) return false;
    const balance = (r.total || 0) - (r.paid || 0);
    let st = 'unpaid';
    if (r.paid >= r.total && r.total > 0) st = 'paid';
    else if (r.paid > 0) st = 'partial';
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    if (q) { const h = `${r.invoice} ${r.name || ''} ${r.phone || ''}`.toLowerCase(); if (!h.includes(q.toLowerCase())) return false; }
    return true;
  });

  const openEdit = async (inv: string, type: string) => {
    try {
      if (type === 'sales') {
        const rows = await getInvoiceDetail(inv);
        if (!rows.length) { showToast('فاکتور پیدا نشد', true); return; }
        setEditRows(rows.map((r: any) => ({ rowId: r.id, modelCode: r.model_code, modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, payment: r.payment, description: r.description, depositDate: r.deposit_date, bankName: r.bank_name, accountHolder: r.account_holder, accountHolderCode: r.account_holder_code || '', shipping: r.shipping || '', _deleted: false })));
        setEditing({ invoice: inv, type, name: rows[0].customer_name, code: rows[0].customer_code });
      } else {
        const { data } = await supabase.from('purchases').select('*').eq('invoice_number', inv);
        if (!data?.length) { showToast('پیدا نشد', true); return; }
        setEditRows(data.map((r: any) => ({ rowId: r.id, modelCode: r.model_code, modelName: r.model_name, quantity: r.quantity, priceUnit: r.price_unit, payment: r.payment, description: r.description, depositDate: r.deposit_date, bankName: r.bank_name, accountHolder: r.account_holder, accountHolderCode: r.payer_code || '', shipping: '', _deleted: false })));
        setEditing({ invoice: inv, type, name: data[0].supplier_name, code: data[0].supplier_code });
      }
      setDirty(false);
    } catch (e: any) { showToast(e.message, true); }
  };

  const delRow = (i: number) => { const n = [...editRows]; n[i]._deleted = !n[i]._deleted; setEditRows(n); setDirty(true); };
  const addRow = () => { setEditRows([...editRows, { rowId: null, modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: toStorageDateFull(new Date()), bankName: '', accountHolder: '', accountHolderCode: '', shipping: '', _deleted: false, _new: true }]); setDirty(true); };
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
        if (editing.type === 'sales') { data.shipping = r.shipping || ''; data.account_holder_code = r.accountHolderCode || ''; } else { data.payer_code = r.accountHolderCode || ''; }
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

  // ═══ حالت ویرایش ═══
  if (editing) return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[s.mgrHead, { backgroundColor: '#c0392b' }]}>
          <TouchableOpacity onPress={async () => { if (dirty) { const ok = await confirmMsg('خروج', 'تغییرات ذخیره نشده — خارج شوی؟'); if (!ok) return; } setEditing(null); setEditRows([]); setDirty(false); }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>← بازگشت</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={s.mgrHeadTxt}>✏️ {editing.invoice}</Text>
            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.9 }}>{editing.name} | {editing.code} | {toFaNum(editRows.length)} ردیف</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
              <Text style={[s.thCell, { width: 36 }]}>#</Text>
              <Text style={[s.thCell, { width: 90 }]}>کد</Text>
              <Text style={[s.thCell, { width: 180 }]}>نام مدل</Text>
              <Text style={[s.thCell, { width: 80 }]}>تعداد</Text>
              <Text style={[s.thCell, { width: 110 }]}>قیمت</Text>
              <Text style={[s.thCell, { width: 100 }]}>مبلغ</Text>
              <Text style={[s.thCell, { width: 100 }]}>پرداخت</Text>
              <Text style={[s.thCell, { width: 100 }]}>مانده</Text>
             <Text style={[s.thCell, { width: 340 }]}>تاریخ واریز</Text>
              <Text style={[s.thCell, { width: 100 }]}>بانک</Text>
              <Text style={[s.thCell, { width: 130 }]}>صاحب حساب</Text>
              <Text style={[s.thCell, { width: 110 }]}>کد صاحب حساب</Text>
              <Text style={[s.thCell, { width: 140 }]}>شرح</Text>
              {editing.type === 'sales' && <Text style={[s.thCell, { width: 130 }]}>باربری</Text>}
              <Text style={[s.thCell, { width: 56 }]}>حذف</Text>
            </View>
            {editRows.map((r, i) => {
              const lt = (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0);
              const lb = lt - (Number(r.payment) || 0);
              return (
                <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, r._deleted && { opacity: 0.4 }, r._new && { backgroundColor: C.isDark ? '#2e1065' : '#f5f3ff' }]}>
                  <Text style={[s.tdCell, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
                  <View style={{ width: 90, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={r.modelCode} onChangeText={(v) => updRow(i, 'modelCode', v)} editable={!r._deleted} /></View>
                                  <View style={{ width: 180, paddingHorizontal: 3 }}>
                    <CellAutocomplete
                      value={r.modelName}
                      onChange={(v: string) => updRow(i, 'modelName', v)}
                      onSelect={(v: string) => {
                        const p = prods.find((x: any) => x.name === v);
                        if (p) {
                          updRow(i, 'modelCode', p.code || '');
                          updRow(i, 'priceUnit', p.price || 0);
                        }
                      }}
                      options={prods.map(p => p.name).filter(Boolean)}
                      placeholder="نام مدل..."
                    />
                  </View>
                  <View style={{ width: 80, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.quantity || '')} onChangeText={(v) => updRow(i, 'quantity', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
                  <View style={{ width: 110, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.priceUnit || '')} onChangeText={(v) => updRow(i, 'priceUnit', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
                  <Text style={[s.tdCell, { width: 100, color: '#00ff88', fontWeight: 'bold' }]}>{lt ? fmt(lt) : '—'}</Text>
                  <View style={{ width: 100, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.payment || '')} onChangeText={(v) => updRow(i, 'payment', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>
                  <Text style={[s.tdCell, { width: 100, color: lb > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{lt ? fmt(lb) : '—'}</Text>
                                  <View style={{ width: 340, paddingHorizontal: 3 }}><DateField value={r.depositDate} onChange={(v: string) => updRow(i, 'depositDate', v)} compact /></View>
                                   <View style={{ width: 110, paddingHorizontal: 3 }}>
                    <CellAutocomplete
                      value={r.bankName}
                      onChange={(v: string) => updRow(i, 'bankName', v)}
                      options={BANKS}
                      placeholder="بانک..."
                    />
                  </View>
                                  <View style={{ width: 130, paddingHorizontal: 3 }}>
                    <CellAutocomplete
                      value={r.accountHolder}
                      onChange={(v: string) => { updRow(i, 'accountHolder', v); updRow(i, 'accountHolderCode', ''); }}
                      onSelect={async (v: string) => {
                        const code = await lookupCodeByName(v);
                        updRow(i, 'accountHolderCode', code);
                      }}
                      options={Array.from(new Set(prods.map((p: any) => p.supplier_name || '').filter(Boolean)))}
                      placeholder="صاحب حساب..."
                    />
                  </View>
                  <View style={{ width: 110, paddingHorizontal: 3 }}>
                    <TextInput
                      style={[s.tdInput, { backgroundColor: C.cardAlt, color: '#059669', borderColor: C.border, fontWeight: 'bold' }]}
                      value={r.accountHolderCode || ''}
                      editable={false}
                      placeholder="خودکار"
                    />
                  </View>
                  <View style={{ width: 140, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={r.description} onChangeText={(v) => updRow(i, 'description', v)} editable={!r._deleted} /></View>
                  {editing.type === 'sales' && (
                    <View style={{ width: 130, paddingHorizontal: 3 }}>
                      <CellAutocomplete
                        value={r.shipping}
                        onChange={(v: string) => updRow(i, 'shipping', v)}
                        options={SHIPPINGS}
                        placeholder="باربری..."
                      />
                    </View>
                  )}
                  <TouchableOpacity onPress={() => delRow(i)} style={[s.tdCell, { width: 56, alignItems: 'center' }]}><Text style={{ fontSize: 18 }}>{r._deleted ? '↺' : '🗑'}</Text></TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>➕ افزودن ردیف</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => { setEditing(null); setEditRows([]); }}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={save}><Text style={s.btnTxt}>💾 ذخیره</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ═══ حالت لیست ═══
  const typeLabel = (t: string) => t === 'purchases' ? '🛍️ خرید' : '🛒 فروش';
  const statusLabel = (total: number, paid: number) => paid >= total && total > 0 ? '✅ پرداخت‌شده' : paid > 0 ? '⏳ جزئی' : '❌ پرداخت‌نشده';
  const statusColorFn = (total: number, paid: number) => paid >= total && total > 0 ? '#059669' : paid > 0 ? '#f39c12' : '#dc2626';

  return (
    <View>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 فاکتور، نام، تلفن..." placeholderTextColor={C.textMut} />
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8, flexWrap: 'wrap' }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'sales', l: '🛒 فروش' }, { k: 'purchases', l: '🛍️ خرید' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}><Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text></TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {[{ k: 'all', l: 'همه وضعیت' }, { k: 'paid', l: '✅ پرداخت‌شده' }, { k: 'unpaid', l: '❌ نشده' }, { k: 'partial', l: '⏳ جزئی' }].map((f) => (
          <TouchableOpacity key={f.k} onPress={() => setStatusFilter(f.k)} style={[s.chip, statusFilter === f.k && { backgroundColor: '#6c3483', borderColor: '#6c3483' }]}><Text style={[s.chipTxt, statusFilter === f.k && s.chipTxtActive]}>{f.l}</Text></TouchableOpacity>
        ))}
      </View>
      <Text style={s.secT}>📄 نتایج ({toFaNum(filtered.length)})</Text>

      {/* جدول ۱۲ ستونه */}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 150 }]}>فاکتور</Text>
            <Text style={[s.thCell, { width: 100 }]}>نوع</Text>
            <Text style={[s.thCell, { width: 150 }]}>نام</Text>
            <Text style={[s.thCell, { width: 120 }]}>تلفن</Text>
            <Text style={[s.thCell, { width: 130 }]}>تاریخ</Text>
            <Text style={[s.thCell, { width: 70 }]}>ردیف</Text>
            <Text style={[s.thCell, { width: 130 }]}>مبلغ</Text>
            <Text style={[s.thCell, { width: 130 }]}>پرداخت</Text>
            <Text style={[s.thCell, { width: 130 }]}>مانده</Text>
            <Text style={[s.thCell, { width: 130 }]}>وضعیت</Text>
            <Text style={[s.thCell, { width: 120 }]}>عملیات</Text>
          </View>
          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.slice(0, 200).map((r: any, i: number) => (
            <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
              <Text style={[s.tdCell, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
              <Text style={[s.tdCell, { width: 150, color: '#1e3a5f', fontWeight: 'bold', fontSize: 12 }]}>{r.invoice}</Text>
              <View style={[s.tdCell, { width: 100, alignItems: 'center' }]}>
                <Text style={{ backgroundColor: r.type === 'purchases' ? '#fce7f3' : '#dbeafe', color: r.type === 'purchases' ? '#9d174d' : '#1e40af', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 10, fontWeight: 'bold' }}>{typeLabel(r.type)}</Text>
              </View>
              <Text style={[s.tdCell, { width: 150, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name || '—'}</Text>
              <Text style={[s.tdCell, { width: 120, color: C.textMut, fontSize: 11 }]}>{r.phone || '—'}</Text>
              <Text style={[s.tdCell, { width: 130, color: C.text, fontSize: 11 }]}>{displayDateOnly(r.date)}</Text>
              <Text style={[s.tdCell, { width: 70, color: C.text }]}>{toFaNum(r.rowCount || r.items?.length || 0)}</Text>
              <Text style={[s.tdCell, { width: 130, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(r.total)}</Text>
              <Text style={[s.tdCell, { width: 130, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.paid)}</Text>
              <Text style={[s.tdCell, { width: 130, color: r.total - r.paid > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{fmt(r.total - r.paid)}</Text>
              <View style={[s.tdCell, { width: 130, alignItems: 'center' }]}>
                <Text style={{ backgroundColor: statusColorFn(r.total, r.paid) + '20', color: statusColorFn(r.total, r.paid), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 10, fontWeight: 'bold' }}>{statusLabel(r.total, r.paid)}</Text>
              </View>
              <View style={[s.tdCell, { width: 120, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={() => openEdit(r.invoice, r.type)} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(r.invoice, r.type)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      {!loading && !filtered.length && (<View style={s.emptyState}><Text style={{ fontSize: 48, opacity: 0.5 }}>🔍</Text><Text style={s.emptyStateTxt}>نتیجه‌ای یافت نشد</Text></View>)}
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  REPORTS SECTION
// ══════════════════════════════════════════════════════════
function ReportsSection({ showToast }: any) {
  const [type, setType] = useState('debtors');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: sales }, { data: purchases }] = await Promise.all([
        supabase.from('sales').select('*'),
        supabase.from('purchases').select('*'),
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
        setData({ rows, total: rows.reduce((a: number, r: any) => a + r.balance, 0), title: 'بدهکاران', columns: ['کد', 'نام', 'تلفن', 'جمع', 'پرداخت', 'بدهی'] });
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
        setData({ rows, total: rows.reduce((a: number, r: any) => a + r.balance, 0), title: 'طلبکاران', columns: ['کد', 'نام', 'تلفن', 'جمع', 'پرداخت', 'طلب'] });
      } else if (type === 'sales24h') {
        const cutoff = Date.now() - 24 * 3600 * 1000;
        const rows = (sales || []).filter((r: any) => { const d = parseDateAny(r.date_reg || r.date_factor); return d && d.getTime() >= cutoff; });
        setData({ rows, total: rows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0), title: 'فروش ۲۴ ساعت', columns: ['فاکتور', 'نام', 'تلفن', 'مبلغ', 'پرداخت'] });
      } else if (type === 'purchases24h') {
        const cutoff = Date.now() - 24 * 3600 * 1000;
        const rows = (purchases || []).filter((r: any) => { const d = parseDateAny(r.date_reg || r.date_factor); return d && d.getTime() >= cutoff; });
        setData({ rows, total: rows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0), title: 'خرید ۲۴ ساعت', columns: ['فاکتور', 'نام', 'تلفن', 'مبلغ', 'پرداخت'] });
      } else if (type === 'inventory') {
        const d = await getInventory();
        const rows = d.list.filter((m: any) => m.currentQty !== 0);
        setData({ rows, total: rows.reduce((a: number, r: any) => a + r.currentQty, 0), title: 'موجودی انبار', columns: ['کد', 'نام', 'خرید', 'فروش', 'موجودی', 'قفسه'] });
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
          { k: 'sales24h', l: '📈 فروش ۲۴س' },
          { k: 'purchases24h', l: '📉 خرید ۲۴س' },
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
            <Text style={s.statsVal}>{fmt(data.total)}</Text>
            <Text style={s.statsUnit}>{toFaNum(data.rows.length)} مورد</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
                <Text style={[s.thCell, { width: 40 }]}>#</Text>
                {data.columns.map((c: string, j: number) => (
                  <Text key={j} style={[s.thCell, { width: 140 }]}>{c}</Text>
                ))}
              </View>
              {data.rows.slice(0, 200).map((r: any, i: number) => (
                <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
                  <Text style={[s.tdCell, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
                  {type === 'debtors' && <>
                    <Text style={[s.tdCell, { width: 140, color: '#7c3aed', fontWeight: 'bold' }]}>{r.code}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.textMut }]}>{r.phone || '—'}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(r.total)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.paid)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(r.balance)}</Text>
                  </>}
                  {type === 'creditors' && <>
                    <Text style={[s.tdCell, { width: 140, color: '#7c3aed', fontWeight: 'bold' }]}>{r.code}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.textMut }]}>{r.phone || '—'}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(r.total)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.paid)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(r.balance)}</Text>
                  </>}
                  {(type === 'sales24h' || type === 'purchases24h') && <>
                    <Text style={[s.tdCell, { width: 140, color: '#7c3aed', fontWeight: 'bold' }]}>{r.invoice_number}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.customer_name || r.supplier_name}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.textMut }]}>{r.customer_phone || r.supplier_phone || '—'}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#00ff88', fontWeight: 'bold' }]}>{fmt((Number(r.quantity) || 0) * (Number(r.price_unit) || 0))}</Text>
                    <Text style={[s.tdCell, { width: 140, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.payment || 0)}</Text>
                  </>}
                  {type === 'inventory' && <>
                    <Text style={[s.tdCell, { width: 140, color: '#7c3aed', fontWeight: 'bold' }]}>{r.code}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.text }]}>{fmt(r.bought)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.text }]}>{fmt(r.sold)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: r.currentQty < 0 ? '#dc2626' : '#00ff88', fontWeight: 'bold' }]}>{fmt(r.currentQty)}</Text>
                    <Text style={[s.tdCell, { width: 140, color: C.textMut }]}>{r.shelf || '—'}</Text>
                  </>}
                </View>
              ))}
            </View>
          </ScrollView>

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
//  SETTINGS SECTION
// ══════════════════════════════════════════════════════════
function SettingsSection({ showToast, settings, setSettings, reload }: any) {
  const [saving, setSaving] = useState(false);
  const pins = settings.tab_pins || {};
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
  const toggleDay = (d: string) => setSchedDailyDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
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

      <Text style={s.secT}>🗑️ حذف خودکار</Text>
      <View style={s.rowBetween}>
        <Text style={[s.lbl, { color: C.textMut }]}>فعال</Text>
        <Switch value={autoDelEnabled} onValueChange={setAutoDelEnabled} />
      </View>
      <Text style={[s.lblS, { color: C.textMut }]}>حذف بعد از (ساعت)</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={autoDelHours} onChangeText={setAutoDelHours} keyboardType="numeric" />

      <Text style={s.secT}>📊 گزارش روزانه</Text>
      <View style={s.rowBetween}><Text style={[s.lbl, { color: C.textMut }]}>فعال</Text><Switch value={schedDailyEnabled} onValueChange={setSchedDailyEnabled} /></View>
      <Text style={[s.lblS, { color: C.textMut }]}>ساعت ارسال</Text>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={schedDailyHour} onChangeText={setSchedDailyHour} keyboardType="numeric" />
      <Text style={[s.lblS, { color: C.textMut }]}>روزها</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((d, i) => (
          <TouchableOpacity key={i} onPress={() => toggleDay(String(i))} style={[s.chip, schedDailyDays.includes(String(i)) && s.chipActive]}>
            <Text style={[s.chipTxt, schedDailyDays.includes(String(i)) && s.chipTxtActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.secT}>📅 گزارش هفتگی</Text>
      <View style={s.rowBetween}><Text style={[s.lbl, { color: C.textMut }]}>فعال</Text><Switch value={schedWeeklyEnabled} onValueChange={setSchedWeeklyEnabled} /></View>
      <Text style={[s.lblS, { color: C.textMut }]}>روز هفته</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((d, i) => (
          <TouchableOpacity key={i} onPress={() => setSchedWeeklyDay(String(i))} style={[s.chip, schedWeeklyDay === String(i) && s.chipActive]}>
            <Text style={[s.chipTxt, schedWeeklyDay === String(i) && s.chipTxtActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره همه تنظیمات</Text>}
      </TouchableOpacity>
      <Text style={s.secT}>🔐 رمز عبور تب‌ها</Text>
      <Text style={[s.lblS, { color: C.textMut, marginBottom: 8 }]}>خالی بگذاری = بدون رمز. مقدار پیش‌فرض: 4242</Text>
      {[
        { k: 'purchase', l: '🛍️ خرید' },
        { k: 'print', l: '🖨️ پرینت' },
        { k: 'mgr', l: '📋 مدیریت' },
        { k: 'profit', l: '💹 سود' },
        { k: 'inventory', l: '📦 انبار' },
        { k: 'settings', l: '⚙️ تنظیمات' },
      ].map((t) => (
        <View key={t.k} style={{ marginBottom: 8 }}>
          <Text style={[s.lblS, { color: C.textMut }]}>{t.l}</Text>
          <TextInput
            style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]}
            value={String(pins[t.k] ?? '4242')}
            onChangeText={(v) =>
              setSettings({ ...settings, tab_pins: { ...pins, [t.k]: v.replace(/\D/g, '').slice(0, 10) } })
            }
            keyboardType="phone-pad"
            secureTextEntry
            placeholder="4242"
            placeholderTextColor={C.textMut}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[s.btn, { backgroundColor: '#7c3aed', marginTop: 8 }]}
        onPress={async () => {
          try {
            await updateSettings({ ...settings, tab_pins: pins });
            showToast('✅ رمزها ذخیره شد');
            reload && reload();
          } catch (e: any) { showToast(e?.message || 'خطا', true); }
        }}
      >
        <Text style={s.btnTxt}>💾 ذخیره رمزهای تب‌ها</Text>
      </TouchableOpacity>

      <Text style={s.secT}>🚪 خروج از حساب</Text>
      <TouchableOpacity
        style={[s.btn, { backgroundColor: '#dc2626', marginTop: 8 }]}
        onPress={async () => {
          const ok = await confirmMsg('خروج', 'از حساب خارج می‌شوی؟');
          if (!ok) return;
          await supabase.auth.signOut();
        }}
      >
        <Text style={s.btnTxt}>🚪 خروج از حساب</Text>
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
//  SOURCES SECTION — جدول ۹ ستونه قابل ویرایش
// ══════════════════════════════════════════════════════════
function SourcesSection({ showToast }: any) {
  const [list, setList] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [inlineMode, setInlineMode] = useState(false);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());

  const load = async () => { setLoading(true); try { setList(await getProducts()); } catch {} finally { setLoading(false); setDirtyRows(new Set()); } };
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

  // ویرایش inline
  const updCell = (id: string | undefined, f: string, v: any, idx: number) => {
    const n = [...list];
    (n[idx] as any)[f] = v;
    setList(n);
    if (id) { const s = new Set(dirtyRows); s.add(id); setDirtyRows(s); }
  };
  const saveInline = async () => {
    try {
      for (const p of list) {
        if (p.id && dirtyRows.has(p.id)) {
          const { id, ...rest } = p as any;
          await updateProduct(p.id, rest);
        }
      }
      showToast('✅ تغییرات ذخیره شد');
      load();
    } catch (e: any) { showToast(e.message, true); }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={() => setEditing({ id: null, code: '', name: '', price: 0, shelf: '', supplier_name: '', supplier_code: '', supplier_phone: '', payer_name: '', shipping_name: '' })}>
          <Text style={s.btnTxt}>➕ افزودن کالا</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: inlineMode ? '#059669' : '#334155' }]} onPress={() => setInlineMode(!inlineMode)}>
          <Text style={s.btnTxt}>{inlineMode ? '✅ حالت ویرایش' : '✏️ ویرایش جدولی'}</Text>
        </TouchableOpacity>
      </View>

      {inlineMode && dirtyRows.size > 0 && (
        <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginBottom: 10 }]} onPress={saveInline}>
          <Text style={s.btnTxt}>💾 ذخیره {toFaNum(dirtyRows.size)} تغییر</Text>
        </TouchableOpacity>
      )}

      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در کالاها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>📦 کالاها ({toFaNum(filtered.length)})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 100 }]}>کد</Text>
            <Text style={[s.thCell, { width: 180 }]}>نام</Text>
            <Text style={[s.thCell, { width: 120 }]}>قیمت</Text>
            <Text style={[s.thCell, { width: 100 }]}>قفسه</Text>
            <Text style={[s.thCell, { width: 160 }]}>تأمین‌کننده</Text>
            <Text style={[s.thCell, { width: 120 }]}>تلفن</Text>
            <Text style={[s.thCell, { width: 120 }]}>باربری</Text>
            <Text style={[s.thCell, { width: 120 }]}>عملیات</Text>
          </View>
          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((p, i) => (
            <View key={p.id || i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, p.id && dirtyRows.has(p.id) && { backgroundColor: C.isDark ? '#2e1065' : '#f5f3ff' }]}>
              <Text style={[s.tdCell, { width: 40, color: '#d4af37', fontWeight: 'bold' }]}>{toFaNum(i + 1)}</Text>
              {inlineMode ? (
                <View style={{ width: 100, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={p.code} onChangeText={(v) => updCell(p.id, 'code', v, list.indexOf(p))} /></View>
              ) : (
                <Text style={[s.tdCell, { width: 100, color: '#7c3aed', fontWeight: 'bold' }]}>{p.code}</Text>
              )}
              {inlineMode ? (
                <View style={{ width: 180, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={p.name} onChangeText={(v) => updCell(p.id, 'name', v, list.indexOf(p))} /></View>
              ) : (
                <Text style={[s.tdCell, { width: 180, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name}</Text>
              )}
              {inlineMode ? (
                <View style={{ width: 120, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(p.price || '')} onChangeText={(v) => updCell(p.id, 'price', parseNum(v), list.indexOf(p))} keyboardType="numeric" /></View>
              ) : (
                <Text style={[s.tdCell, { width: 120, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(p.price || 0)}</Text>
              )}
              {inlineMode ? (
                <View style={{ width: 100, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={p.shelf || ''} onChangeText={(v) => updCell(p.id, 'shelf', v, list.indexOf(p))} /></View>
              ) : (
                <Text style={[s.tdCell, { width: 100, color: C.text }]}>{p.shelf || '—'}</Text>
              )}
              <Text style={[s.tdCell, { width: 160, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{p.supplier_name || '—'}</Text>
              <Text style={[s.tdCell, { width: 120, color: C.textMut, fontSize: 11 }]}>{p.supplier_phone || '—'}</Text>
              <Text style={[s.tdCell, { width: 120, color: C.text }]}>{p.shipping_name || '—'}</Text>
              <View style={[s.tdCell, { width: 120, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                <TouchableOpacity onPress={() => setEditing({ ...p })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => p.id && remove(p.id)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal ویرایش کامل */}
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
            <View>
              <Text style={s.invBrand}>میزان</Text>
                       <Text style={s.invSlogan}>حساب‌ها دقیق، معاملات امن، ذهن آسوده.</Text>
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
              <Text style={[s.invTd, { flex: 0.8 }]}>{it.quantity}</Text>
              <Text style={[s.invTd, { flex: 1 }]}>{fmt(it.priceUnit)}</Text>
              <Text style={[s.invTd, { flex: 1.2, fontWeight: 'bold' }]}>{fmt(it.total)}</Text>
            </View>
          ))}
        </View>

              <View style={s.invSection}>
          <Text style={s.invSectionTitle}>💰 خلاصه مالی</Text>

          {/* این سفارش */}
          <SumRow l="🛍️ مبلغ این سفارش" v={fmt(cur.sales) + ' تومان'} />
          <SumRow l="💳 پرداخت این سفارش" v={fmt(cur.payments) + ' تومان'} green />

          {/* فاکتورهای قبلی */}
          {invoice.previous && invoice.previous.invoiceCount > 0 && (
            <>
              <SumRow l="📁 تعداد فاکتورهای قبلی" v={toFaNum(invoice.previous.invoiceCount) + ' فاکتور'} />
              <SumRow l="💰 جمع خریدهای قبلی" v={fmt(invoice.previous.sales) + ' تومان'} />
              <SumRow l="💳 جمع پرداخت‌های قبلی" v={fmt(invoice.previous.payments) + ' تومان'} green />
              <SumRow
                l={invoice.previous.balance > 0 ? '⚖️ بدهی از قبل' : invoice.previous.balance < 0 ? '💰 بستانکاری از قبل' : '✅ تسویه شده از قبل'}
                v={invoice.previous.balance !== 0 ? fmt(Math.abs(invoice.previous.balance)) + ' تومان' : 'بدون بدهی'}
                prev
              />
            </>
          )}

          {/* مانده نهایی */}
          <SumRow
            l={tot.balance > 0 ? '⚖️ مانده نهایی قابل پرداخت' : tot.balance < 0 ? '💰 بستانکاری نهایی' : '✅ تسویه کامل'}
            v={tot.balance !== 0 ? fmt(Math.abs(tot.balance)) + ' تومان' : 'بدون بدهی'}
            highlight
          />
        </View>

        <View style={s.invFooter}>
          <Text style={s.invFooterTxt}>📞 کفش تاج: ________________</Text>
          <Text style={s.invFooterThanks}>با تشکر از اعتماد شما 🙏</Text>
        </View>
      </View>

      {/* دکمه‌های عملیات */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 90, backgroundColor: '#fff', borderWidth: 2, borderColor: '#1e3a5f' }]} onPress={() => captureAndShare('print')}>
          <Text style={[s.btnTxt, { color: '#1e3a5f' }]}>🖨️ پرینت</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 90, backgroundColor: '#0ea5e9' }]} onPress={() => captureAndShare('share')}>
          <Text style={s.btnTxt}>📤 اشتراک</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 90, backgroundColor: '#8e44ad' }]} onPress={() => captureAndShare('save')}>
          <Text style={s.btnTxt}>💾 ذخیره</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onBack}><Text style={s.btnTxt}>↩️ برگشت</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#1e3a8a' }]} onPress={onNew}><Text style={s.btnTxt}>🛒 فاکتور جدید</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const SumRow = ({ l, v, green, highlight, prev }: any) => (
  <View style={[s.sumRow, highlight && { backgroundColor: '#fef3c7', borderTopWidth: 1, borderTopColor: '#d4af37' }, prev && { backgroundColor: '#fff7ed', borderRightWidth: 3, borderRightColor: '#f97316' }]}>
    <Text style={[s.sumLbl, highlight && { fontWeight: 'bold', color: '#422006' }, prev && { color: '#9a3412', fontWeight: 'bold' }]}>{l}</Text>
    <Text style={[s.sumValTxt, green && { color: '#059669' }, highlight && { fontSize: 14, fontWeight: 'bold' }, prev && { color: '#9a3412' }]}>{v}</Text>
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

  // Header
  header: {
    padding: 16,
    margin: 8,
    marginBottom: 0,
    borderRadius: 16,
    shadowColor: '#0f2438',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  hTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', textAlign: 'right' },
  hSub: { fontSize: 11, color: '#d1d5db', marginTop: 6, textAlign: 'right', opacity: 0.9 },
  themeBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabsBar: { maxHeight: 110, marginHorizontal: 8, marginTop: 8, borderRadius: 14 },
  tabsCont: { paddingHorizontal: 6, paddingVertical: 6 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    maxWidth: 90,
    height: 78,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabIcon: { fontSize: 22, marginBottom: 4 },
  tabLbl: { fontSize: 11, fontWeight: 'bold' },
  tabLblActive: { color: '#fff' },
  lock: { position: 'absolute', top: 4, left: 6, fontSize: 10 },

  // Toast
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#059669', padding: 12, borderRadius: 10, alignItems: 'center', zIndex: 9999 },
  toastTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Dashboard
  dash: { margin: 10, padding: 14, borderRadius: 16, backgroundColor: '#080b13', borderWidth: 2, borderColor: '#1f3a5f' },
  rangeBadge: { backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14, alignSelf: 'center' },
  rangeBadgeTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  clockRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, marginVertical: 12, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  time: { color: '#00ff88', fontSize: 32, fontFamily: 'Orbitron_900Black', letterSpacing: 6, textShadowColor: '#00ff88', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  dateTxt: { color: '#4ade80', fontSize: 16, fontFamily: 'ShareTechMono_400Regular', letterSpacing: 2, textShadowColor: 'rgba(74,222,128,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  profitBox: { alignItems: 'center', paddingVertical: 16, marginBottom: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  profitLbl: { color: '#94a3b8', fontSize: 13, marginBottom: 10, fontWeight: 'bold', letterSpacing: 1 },
  profitVal: { fontSize: 48, fontFamily: 'Orbitron_900Black', letterSpacing: 4, lineHeight: 56, textShadowColor: '#00ff88', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  profitUnit: { color: '#64748b', fontSize: 12, marginTop: 8, letterSpacing: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dItem: { width: '48%', padding: 11, marginBottom: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.18)', alignItems: 'center' },
  dLbl: { color: '#94a3b8', fontSize: 10, marginBottom: 5 },
  dVal: { fontSize: 17, fontFamily: 'Orbitron_700Bold', letterSpacing: 1.5, textShadowColor: 'rgba(0,255,136,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },

  // Forms
  formTitle: { color: '#d4af37', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  secT: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginTop: 12, textAlign: 'right' },
  lbl: { fontSize: 11, marginBottom: 4, marginTop: 8, textAlign: 'right' },
  lblS: { fontSize: 10, marginBottom: 3, marginTop: 6, textAlign: 'right' },
  inp: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  addBtn: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 4 },
  addBtn2: { backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Customer card (در فرم فروش و خرید)
  customerCard: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  customerCardTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 6, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 8 },

  // Item card (کارت‌های عمودی — مثل وب)
  itemCard: { borderRadius: 12, marginBottom: 10, borderWidth: 1, overflow: 'hidden' },
  itemHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  itemN: { color: '#d4af37', fontSize: 13, fontWeight: 'bold' },
  delBtnRound: { backgroundColor: '#dc2626', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  miniLbl: { fontSize: 10, marginBottom: 3, textAlign: 'right', fontWeight: 'bold' },
  miniInput: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 12, textAlign: 'center' },
  miniValueBox: { borderWidth: 1, borderRadius: 6, padding: 8, alignItems: 'center', justifyContent: 'center', minHeight: 34 },
  miniValueTxt: { fontSize: 12, fontWeight: 'bold' },

  // Summary
  autoCalcBox: { borderWidth: 2, borderRadius: 8, padding: 10, alignItems: 'center' },
  autoCalcTxt: { color: '#00ff88', fontSize: 15, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  grandSummary: { backgroundColor: '#0f2438', borderRadius: 12, padding: 14, marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 2, borderColor: '#d4af37' },
  gsLbl: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  gsVal: { color: '#00ff88', fontSize: 22, fontWeight: 'bold', fontFamily: 'Orbitron_900Black', textAlign: 'right' },
  gsQty: { color: '#60a5fa', fontSize: 22, fontWeight: 'bold', fontFamily: 'Orbitron_900Black' },

  // Table (برای جدول‌های ردیفی)
  tblHeader: { backgroundColor: '#0f2438', paddingVertical: 8, borderRadius: 8, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  tblRow: { borderBottomWidth: 1, borderBottomColor: '#334155', paddingVertical: 4, alignItems: 'center' },
  thCell: { color: '#d4af37', fontSize: 11, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 4 },
  tdCell: { fontSize: 12, textAlign: 'center', paddingHorizontal: 4 },
  tdInput: { borderWidth: 1, borderRadius: 6, padding: 6, fontSize: 12, textAlign: 'center', minHeight: 34 },

  // Autocomplete
  acBox: { borderRadius: 8, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  acItem: { padding: 10, borderBottomWidth: 1 },
  acItemTxt: { fontSize: 13, textAlign: 'right' },

  // Date
  dateBox: { flexDirection: 'row', alignItems: 'center', padding: 6, borderWidth: 2, borderRadius: 8, gap: 1, flexWrap: 'nowrap' },
  dateInp: { padding: 4, textAlign: 'center', fontSize: 13, fontFamily: 'ShareTechMono_400Regular', backgroundColor: 'transparent' },
  dateSep: { fontSize: 13, fontWeight: 'bold' },
  typeBtn: { marginLeft: 'auto', padding: 4, borderRadius: 6 },
  typeBtnTxt: { fontSize: 10, fontWeight: 'bold' },

  // Invoice card
  invCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#1e3a8a' },
  invNum: { color: '#1e3a5f', fontSize: 13, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  invCust: { color: '#64748b', fontSize: 11, marginBottom: 6, textAlign: 'right' },
  invStat: { color: '#1a2332', fontSize: 11, fontFamily: 'ShareTechMono_400Regular' },

  // Stats
  statsCard: { backgroundColor: '#080b13', borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: '#1f3a5f' },
  statsLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  statsVal: { fontSize: 26, fontFamily: 'Orbitron_900Black' },
  statsUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  rptBadge: { color: '#1a2332', fontSize: 11, fontFamily: 'ShareTechMono_400Regular', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 4 },

  // Badge
  badge: { fontSize: 10, color: '#6d28d9', backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, textAlign: 'center', alignSelf: 'center' },

  // Warn
  warnBox: { backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#fcd34d', borderRadius: 10, padding: 12, marginVertical: 8 },
  warnTxt: { color: '#78350f', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },

  // Inventory Stats Box
  sBox: { width: '31%', marginHorizontal: '1.16%', marginBottom: 8, borderRadius: 10, padding: 10, alignItems: 'center', borderRightWidth: 3, borderRightColor: '#10b981' },
  sBoxL: { color: '#94a3b8', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  sBoxV: { fontSize: 16, fontFamily: 'Orbitron_700Bold' },
  thresholdBox: { padding: 10, borderRadius: 10, marginTop: 8, borderWidth: 1 },
  shelfBtn: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  shelfTxt: { color: '#075985', fontSize: 11, fontWeight: 'bold' },

  // Chips
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
   subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  subTabActive: { backgroundColor: '#475569', borderColor: '#475569' },
  subTabTxt: { color: '#475569', fontSize: 12, fontWeight: 'bold' },
  subTabTxtActive: { color: '#fff' },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.85)', justifyContent: 'center', padding: 16 },
  modalBox: { borderRadius: 14, maxHeight: '92%', overflow: 'hidden' },
  modalHead: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeadTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  modalLbl: { fontSize: 12, marginBottom: 4, textAlign: 'right' },
  modalVal: { fontWeight: 'bold' },
  modalInp: { borderWidth: 2, borderColor: '#a78bfa', borderRadius: 8, padding: 12, fontSize: 14, textAlign: 'center' },
  pinInp: { borderWidth: 3, borderColor: '#d4af37', borderRadius: 12, padding: 16, fontSize: 24, textAlign: 'center', backgroundColor: '#fdfbf4', color: '#0f2438', letterSpacing: 10 },

  // Info
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  infoK: { color: '#64748b', fontSize: 12 },
  infoV: { color: '#1e3a5f', fontSize: 13, fontWeight: 'bold' },

  // Manager
  mgrHead: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 12 },
  mgrHeadTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  rowBetween: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  emailRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, marginBottom: 6 },
  emailTxt: { flex: 1, fontSize: 12, textAlign: 'right' },

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
  invTableHead: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', padding: 4 },
  invTh: { color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  invRow: { flexDirection: 'row-reverse', padding: 3, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  invTd: { fontSize: 10, color: '#1e3a5f', textAlign: 'center' },
  invFooter: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#d4af37', alignItems: 'center' },
  invFooterTxt: { fontSize: 10, color: '#1e3a5f', fontFamily: 'ShareTechMono_400Regular', marginBottom: 3 },
  invFooterThanks: { fontSize: 10, color: '#78350f', fontWeight: 'bold' },
  sumRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sumLbl: { fontSize: 11, color: '#64748b' },
  sumValTxt: { fontSize: 11, color: '#1e3a5f', fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },

  // Login
  loginWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 18, padding: 24 },
  loginLogo: { fontSize: 54, textAlign: 'center', marginBottom: 8 },
  loginTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#0f2438', marginBottom: 4 },
  loginSub: { fontSize: 13, textAlign: 'center', color: '#64748b', marginBottom: 24 },
  loginInp: { backgroundColor: '#f5f7fa', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 10, color: '#1a2332', textAlign: 'right' },
  loginNote: { textAlign: 'center', color: '#64748b', fontSize: 11, marginTop: 12 },

  // Search
  searchCard: { borderRadius: 12, padding: 12, marginBottom: 10, borderRightWidth: 4, borderRightColor: '#1e3a8a' },
  searchRowNum: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  searchInvoice: { color: '#1e3a5f', fontSize: 15, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  searchTypeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  searchTypeTxt: { fontSize: 11, fontWeight: 'bold' },
  searchInfoGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginBottom: 8 },
  searchInfoCell: { width: '50%', paddingVertical: 4 },
  searchInfoLbl: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginBottom: 2, textAlign: 'right' },
  searchInfoVal: { color: '#1a2332', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  searchMoneyBox: { flexDirection: 'row-reverse', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1 },
  searchMoneyLbl: { color: '#64748b', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  searchMoneyVal: { color: '#1e3a5f', fontSize: 14, fontWeight: 'bold', fontFamily: 'ShareTechMono_400Regular' },
  searchStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  searchStatusTxt: { fontSize: 11, fontWeight: 'bold' },
  searchActionBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#dbeafe', borderRadius: 8 },
  searchActionTxt: { color: '#1e40af', fontSize: 12, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff', borderRadius: 12, marginTop: 12 },
  emptyStateTxt: { color: '#1a2332', fontSize: 15, fontWeight: 'bold', marginTop: 12 },
  emptyStateSub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
});
