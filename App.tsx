import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Orbitron_900Black, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { supabase } from './lib-supabase';
import * as DB from './lib-db';
import DateField from './components/DateField';
import { toFaNum } from './lib-jalali';

export default function App() {
  const [fontsLoaded] = useFonts({ Orbitron_900Black, Orbitron_700Bold, ShareTechMono_400Regular });
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || loading) return <View style={s.loading}><ActivityIndicator size="large" color="#d4af37" /></View>;
  if (!session) return <LoginScreen />;
  return <MainApp />;
}

function MainApp() {
  const [tab, setTab] = useState('order');
  const tabs = [
    { key: 'order', icon: '🛒', label: 'فروش' },
    { key: 'purchase', icon: '🛍️', label: 'خرید' },
    { key: 'profit', icon: '💹', label: 'سود' },
    { key: 'inventory', icon: '📦', label: 'انبار' },
    { key: 'mgr', icon: '📋', label: 'مدیریت' },
    { key: 'more', icon: '⚙️', label: 'بیشتر' },
  ];
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={s.header}>
          <Text style={s.hTitle}>⚖️ میزان</Text>
          <Text style={s.hSub}>حساب‌ها دقیق، معاملات امن، ذهن آسوده</Text>
        </View>
        <View style={s.tabsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsCont}>
            {tabs.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.7}
                style={[s.tab, tab === t.key && s.tabActive]}>
                <Text style={s.tabIcon}>{t.icon}</Text>
                <Text style={[s.tabLbl, tab === t.key && s.tabLblActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {tab === 'order' && <SalesTab />}
        {tab === 'purchase' && <PurchaseTab />}
        {tab === 'profit' && <ProfitTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'mgr' && <ManagementTab />}
        {tab === 'more' && <MoreTab />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Dashboard() {
  const [t, setT] = useState(new Date());
  const [st, setSt] = useState<any>({ totalSales: 0, totalPurchases: 0, customerPaid: 0, customerDebt: 0, supplierPaid: 0, supplierDebt: 0, profit: 0 });
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    DB.getDashboardStats('month', 'both').then(setSt).catch(() => {});
    return () => clearInterval(i);
  }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
  const date = DB.formatDate(t.toISOString());
  return (
    <View style={s.dash}>
      <View style={s.clock}>
        <Text style={s.time}>{time}</Text>
        <Text style={s.date}>{toFaNum(date)}</Text>
      </View>
      <View style={s.profitBox}>
        <Text style={s.profitLbl}>💰 سود خالص ماه</Text>
        <Text style={[s.profitVal, { color: st.profit >= 0 ? '#00ff88' : '#ff3355' }]}>{toFaNum(DB.formatPrice(st.profit))}</Text>
        <Text style={s.profitUnit}>تومان</Text>
      </View>
      <View style={s.grid}>
        <DCard i="🛒" l="کل فروش" v={DB.formatPrice(st.totalSales)} c="#60a5fa" />
        <DCard i="📦" l="کل خرید" v={DB.formatPrice(st.totalPurchases)} c="#fb923c" />
        <DCard i="💳" l="پرداخت مشتری" v={DB.formatPrice(st.customerPaid)} c="#34d399" />
        <DCard i="📌" l="بدهی مشتری" v={DB.formatPrice(st.customerDebt)} c="#fb923c" />
      </View>
    </View>
  );
}
function DCard({ i, l, v, c }: any) {
  return <View style={s.dItem}><Text style={s.dLbl}>{i} {l}</Text><Text style={[s.dVal, { color: c }]} numberOfLines={1}>{v}</Text></View>;
}

function SalesTab() {
  const [list, setList] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [shipping, setShipping] = useState('');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { load(); DB.getProducts().then(setProds); }, []);
  async function load() { setLoading(true); try { setList(await DB.getSalesGrouped() as any[]); } catch (e: any) { Alert.alert('خطا', e.message); } finally { setLoading(false); } }

  async function onPhone(v: string) {
    const d = v.replace(/[^\d]/g, '').slice(0, 11); setPhone(d);
    if (d.length === 11) {
      const f = await DB.lookupCustomerByPhone(d);
      if (f) { if (f.customer_name) setName(f.customer_name); if (f.customer_address) setAddress(f.customer_address); }
    }
  }
  function addItem() { setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', description: '' }]); }
  function updItem(i: number, f: string, v: any) { const n = [...items]; n[i][f] = v; setItems(n); }
  function delItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!/^09\d{9}$/.test(phone)) return Alert.alert('خطا', 'شماره معتبر نیست');
    if (!name || name.length < 2) return Alert.alert('خطا', 'نام الزامی');
    if (!shipping) return Alert.alert('خطا', 'باربری الزامی');
    const valid = items.filter(it => it.modelName && it.quantity > 0);
    if (!valid.length) return Alert.alert('خطا', 'حداقل یک مدل');
    try {
      const inv = DB.generateInvoiceNumber();
      await DB.createSale({ invoiceNumber: inv, customerCode: DB.generateCustomerCode(), customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid });
      Alert.alert('✅ ثبت شد', 'فاکتور ' + inv);
      setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setShowForm(false); load();
    } catch (e: any) { Alert.alert('خطا', e.message); }
  }
  function remove(inv: string) {
    Alert.alert('حذف', 'مطمئنی؟', [{ text: 'لغو', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { await DB.deleteSale(inv); load(); } }]);
  }

  if (!showForm) return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <TouchableOpacity style={s.addBtn} onPress={() => { setShowForm(true); if (!items.length) addItem(); }}>
        <Text style={s.addBtnTxt}>➕ ثبت فاکتور فروش جدید</Text>
      </TouchableOpacity>
      <Text style={s.secT}>📄 فاکتورها ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((inv: any) => (
        <View key={inv.invoice} style={s.invCard}>
          <View style={s.invH}><Text style={s.invNum}>{inv.invoice}</Text>
            <TouchableOpacity onPress={() => remove(inv.invoice)}><Text style={s.del}>🗑</Text></TouchableOpacity></View>
          <Text style={s.invCust}>👤 {inv.name} — {inv.phone}</Text>
          <Text style={s.invStat}>💰 {toFaNum(DB.formatPrice(inv.total))} | 💳 {toFaNum(DB.formatPrice(inv.paid))}</Text>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0f2438' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formT}>🛒 فاکتور فروش جدید</Text>
        <Text style={s.lbl}>📞 تلفن *</Text>
        <TextInput style={s.inp} value={phone} onChangeText={onPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>👤 نام *</Text>
        <TextInput style={s.inp} value={name} onChangeText={setName} placeholder="نام" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>📍 آدرس</Text>
        <TextInput style={s.inp} value={address} onChangeText={setAddress} placeholder="اختیاری" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>🚚 باربری *</Text>
        <TextInput style={s.inp} value={shipping} onChangeText={setShipping} placeholder="نام باربری" placeholderTextColor="#64748b" />
        <Text style={s.secT}>📦 اقلام ({toFaNum(items.length)})</Text>
        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <View style={s.itemH}><Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delItem(i)}><Text style={s.del}>🗑</Text></TouchableOpacity></View>
            <Text style={s.lblS}>نام مدل</Text>
            <TextInput style={s.inp} value={it.modelName} onChangeText={v => {
              const n = [...items]; n[i].modelName = v;
              const p = prods.find(p => p.name === v);
              if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; }
              setItems(n);
            }} placeholder="نام مدل..." placeholderTextColor="#64748b" />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lblS}>تعداد</Text>
                <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={v => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>قیمت</Text>
                <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={v => updItem(i, 'priceUnit', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>پرداخت</Text>
                <TextInput style={s.inp} value={String(it.payment || '')} onChangeText={v => updItem(i, 'payment', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" /></View>
            </View>
            <Text style={s.lblS}>تاریخ واریز</Text>
            <DateField value={it.depositDate} onChange={(v) => updItem(i, 'depositDate', v)} compact />
          </View>
        ))}
        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.addBtnTxt}>➕ افزودن مدل</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setShowForm(false)}><Text style={s.btnT}>↩️ برگشت</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={submit}><Text style={s.btnT}>✅ ثبت</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PurchaseTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sName, setSName] = useState('');
  const [invNum, setInvNum] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [payAmt, setPayAmt] = useState('');

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); try { setList(await DB.getPurchasesGrouped() as any[]); } catch (e: any) { Alert.alert('خطا', e.message); } finally { setLoading(false); } }
  function addItem() { setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0 }]); }
  function updItem(i: number, f: string, v: any) { const n = [...items]; n[i][f] = v; setItems(n); }
  function delItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!sName || sName.length < 2) return Alert.alert('خطا', 'نام تأمین‌کننده الزامی');
    if (!invNum) return Alert.alert('خطا', 'شماره فاکتور الزامی');
    const valid = items.filter(it => it.modelName && it.quantity > 0);
    const amt = parseFloat(payAmt) || 0;
    if (!valid.length && amt <= 0) return Alert.alert('خطا', 'حداقل یک مدل یا مبلغ پرداخت');
    try {
      const inv = DB.generateInvoiceNumber();
      await DB.createPurchase({ invoiceNumber: inv, supplierName: sName, paymentAmount: amt, items: valid });
      Alert.alert('✅ ثبت شد', 'فاکتور ' + inv);
      setSName(''); setInvNum(''); setItems([]); setPayAmt(''); setShowForm(false); load();
    } catch (e: any) { Alert.alert('خطا', e.message); }
  }

  if (!showForm) return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#166534' }]} onPress={() => { setShowForm(true); if (!items.length) addItem(); }}>
        <Text style={s.addBtnTxt}>➕ ثبت فاکتور خرید جدید</Text>
      </TouchableOpacity>
      <Text style={s.secT}>📄 خریدها ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#34d399" /> : list.map((inv: any) => (
        <View key={inv.invoice} style={[s.invCard, { borderRightColor: '#166534' }]}>
          <Text style={s.invNum}>{inv.invoice}</Text>
          <Text style={s.invCust}>🏭 {inv.name}</Text>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0f2438' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formT}>🛍️ فاکتور خرید</Text>
        <Text style={s.lbl}>🏭 نام تأمین‌کننده *</Text>
        <TextInput style={s.inp} value={sName} onChangeText={setSName} placeholder="نام" placeholderTextColor="#64748b" />
        <Text style={s.lbl}>🧾 شماره فاکتور *</Text>
        <TextInput style={s.inp} value={invNum} onChangeText={setInvNum} placeholder="شماره" placeholderTextColor="#64748b" />
        <Text style={s.secT}>📦 اقلام (اختیاری)</Text>
        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <Text style={s.lblS}>نام مدل</Text>
            <TextInput style={s.inp} value={it.modelName} onChangeText={v => updItem(i, 'modelName', v)} placeholder="نام مدل..." placeholderTextColor="#64748b" />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1 }}><Text style={s.lblS}>تعداد</Text>
                <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={v => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" /></View>
              <View style={{ flex: 1 }}><Text style={s.lblS}>قیمت</Text>
                <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={v => updItem(i, 'priceUnit', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.addBtnTxt}>➕ افزودن مدل</Text></TouchableOpacity>
        <Text style={s.secT}>💳 پرداخت</Text>
        <Text style={s.lbl}>مبلغ پرداخت</Text>
        <TextInput style={s.inp} value={payAmt} onChangeText={setPayAmt} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setShowForm(false)}><Text style={s.btnT}>↩️ برگشت</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#166534' }]} onPress={submit}><Text style={s.btnT}>✅ ثبت</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfitTab() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { DB.getProfitByModel().then(setList).catch(() => {}); }, []);
  const total = list.reduce((a, m) => a + (m.totalProfit || 0), 0);
  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <View style={s.statsCard}>
        <Text style={s.statsLbl}>💰 سود کل</Text>
        <Text style={s.statsVal}>{toFaNum(DB.formatPrice(total))}</Text>
        <Text style={s.statsUnit}>تومان</Text>
      </View>
      {list.map((m: any, i: number) => (
        <View key={i} style={s.pCard}>
          <Text style={s.pName}>{m.name}</Text>
          <Text style={s.pStat}>فروش: {toFaNum(DB.formatPrice(m.totalSales))} | سود: {toFaNum(DB.formatPrice(m.totalProfit))}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function InventoryTab() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { DB.getInventory().then(setList).catch(() => {}); }, []);
  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <Text style={s.secT}>📦 موجودی ({toFaNum(list.length)})</Text>
      {list.map((it: any, i: number) => (
        <View key={i} style={s.invItem}>
          <View style={s.invRowH}>
            <Text style={s.invName}>{it.name}</Text>
            <Text style={[s.invQty, { color: it.currentQty < 0 ? '#dc2626' : '#059669' }]}>{toFaNum(it.currentQty)}</Text>
          </View>
          <Text style={s.invStat}>کد: {it.code} | خرید: {toFaNum(it.bought)} | فروش: {toFaNum(it.sold)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ManagementTab() {
  const [all, setAll] = useState<any[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { DB.searchAllInvoices().then(setAll).catch(() => {}); }, []);
  const filtered = q ? all.filter(i => String(i.invoice).includes(q) || String(i.name || '').includes(q)) : all;
  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <TextInput style={s.inp} value={q} onChangeText={setQ} placeholder="🔍 جستجو..." placeholderTextColor="#64748b" />
      <Text style={s.secT}>📄 فاکتورها ({toFaNum(filtered.length)})</Text>
      {filtered.slice(0, 50).map((inv: any, i: number) => (
        <View key={i} style={s.invCard}>
          <Text style={s.invNum}>{inv.invoice}</Text>
          <Text style={s.invCust}>👤 {inv.name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function MoreTab() {
  const [email, setEmail] = useState('');
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || '')); }, []);
  function logout() { Alert.alert('خروج', 'مطمئنی؟', [{ text: 'لغو', style: 'cancel' }, { text: 'خروج', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); } }]); }
  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <View style={s.menuCard}>
        <Text style={s.menuItem}>👤 {email || '—'}</Text>
      </View>
      <TouchableOpacity style={s.logoutBtn} onPress={logout}><Text style={s.logoutTxt}>🚪 خروج</Text></TouchableOpacity>
    </ScrollView>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  async function submit() {
    if (!email || !pass) return Alert.alert('خطا', 'ایمیل و رمز را وارد کن');
    setLoading(true);
    try {
      const fn = isLogin ? supabase.auth.signInWithPassword({ email, password: pass }) : supabase.auth.signUp({ email, password: pass });
      const { error } = await fn;
      if (error) throw error;
      if (!isLogin) Alert.alert('✅ ثبت‌نام موفق', 'حالا وارد شو');
    } catch (e: any) { Alert.alert('خطا', e.message); } finally { setLoading(false); }
  }
  return (
    <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.loginCard}>
        <Text style={s.loginLogo}>⚖️</Text>
        <Text style={s.loginTitle}>میزان</Text>
        <Text style={s.loginSub}>{isLogin ? 'ورود' : 'ثبت‌نام'}</Text>
        <TextInput style={s.loginInp} value={email} onChangeText={setEmail} placeholder="ایمیل" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={s.loginInp} value={pass} onChangeText={setPass} placeholder="رمز" placeholderTextColor="#94a3b8" secureTextEntry />
        <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>{isLogin ? 'ورود' : 'ثبت‌نام'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}><Text style={s.loginSwitch}>{isLogin ? 'حساب نداری؟ ثبت‌نام' : 'حساب داری؟ ورود'}</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f2438' },
  loading: { flex: 1, backgroundColor: '#0f2438', alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#0f2438', padding: 14, paddingTop: 8, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  hTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  hSub: { color: '#d1d5db', fontSize: 10, marginTop: 4, textAlign: 'right' },
  tabsBar: { backgroundColor: '#1a2332' },
  tabsCont: { paddingHorizontal: 6, paddingVertical: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 3, borderRadius: 10, alignItems: 'center', minWidth: 68 },
  tabActive: { backgroundColor: '#1e3a8a', borderWidth: 1, borderColor: '#d4af37' },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLbl: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold' },
  tabLblActive: { color: '#fff' },
  content: { flex: 1, backgroundColor: '#0f2438' },
  dash: { margin: 10, padding: 12, borderRadius: 14, backgroundColor: '#080b13', borderWidth: 2, borderColor: '#1f3a5f' },
  clock: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8, marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8 },
  time: { color: '#00ff88', fontSize: 22, fontFamily: 'Orbitron_900Black' },
  date: { color: '#4ade80', fontSize: 12, fontFamily: 'ShareTechMono_400Regular' },
  profitBox: { alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  profitLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  profitVal: { fontSize: 32, fontFamily: 'Orbitron_900Black' },
  profitUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dItem: { width: '48%', padding: 8, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.18)', alignItems: 'center' },
  dLbl: { color: '#94a3b8', fontSize: 9, marginBottom: 4 },
  dVal: { fontSize: 12, fontFamily: 'Orbitron_700Bold' },
  addBtn: { backgroundColor: '#1e3a8a', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#d4af37' },
  addBtn2: { backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  addBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  secT: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginTop: 8, textAlign: 'right' },
  formT: { color: '#d4af37', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  lbl: { color: '#94a3b8', fontSize: 11, marginBottom: 4, marginTop: 8, textAlign: 'right' },
  lblS: { color: '#94a3b8', fontSize: 10, marginBottom: 3, marginTop: 6, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, color: '#fff', textAlign: 'right' },
  btn: { padding: 14, borderRadius: 10, alignItems: 'center' },
  btnT: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  itemCard: { backgroundColor: '#1a2332', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  itemH: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemN: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
  del: { fontSize: 18 },
  invCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#1e3a8a' },
  invH: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  invNum: { color: '#1e3a5f', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' },
  invCust: { color: '#64748b', fontSize: 11, marginBottom: 6, textAlign: 'right' },
  invStat: { color: '#1a2332', fontSize: 11, fontFamily: 'monospace' },
  statsCard: { backgroundColor: '#080b13', borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: '#1f3a5f' },
  statsLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  statsVal: { color: '#00ff88', fontSize: 28, fontFamily: 'Orbitron_900Black' },
  statsUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  pCard: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, borderRightWidth: 4, borderRightColor: '#059669' },
  pName: { color: '#0f2438', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  pStat: { color: '#64748b', fontSize: 10, fontFamily: 'monospace', textAlign: 'right' },
  invItem: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 6, borderRightWidth: 4, borderRightColor: '#1e3a8a' },
  invRowH: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  invName: { color: '#0f2438', fontSize: 13, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  invQty: { fontSize: 18, fontWeight: 'bold', fontFamily: 'Orbitron_900Black' },
  menuCard: { backgroundColor: '#fff', borderRadius: 12, padding: 6, marginBottom: 16 },
  menuItem: { fontSize: 13, color: '#0f2438', padding: 12, textAlign: 'right' },
  logoutBtn: { backgroundColor: '#dc2626', borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  loginWrap: { flex: 1, backgroundColor: '#0f2438', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 18, padding: 24 },
  loginLogo: { fontSize: 54, textAlign: 'center', marginBottom: 8 },
  loginTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#0f2438', marginBottom: 4 },
  loginSub: { fontSize: 13, textAlign: 'center', color: '#64748b', marginBottom: 24 },
  loginInp: { backgroundColor: '#f5f7fa', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 10, color: '#1a2332', textAlign: 'right' },
  loginSwitch: { textAlign: 'center', color: '#1e3a5f', fontSize: 12, paddingVertical: 8 },
});
