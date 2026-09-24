// App.tsx
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Orbitron_900Black, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { supabase } from './lib-supabase';
import * as DB from './lib-db';
import DateField from './components/DateField';
import Autocomplete from './components/Autocomplete';
import { toFaNum } from './lib-jalali';
import { displayDate } from './lib-date';

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

// ═══════════════ Dashboard ═══════════════
function Dashboard() {
  const [t, setT] = useState(new Date());
  const [st, setSt] = useState<any>(null);

  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    load();
    const r = setInterval(load, 60000);
    return () => { clearInterval(i); clearInterval(r); };
  }, []);

  async function load() {
    try { setSt(await DB.getDashboardStats('month', 'both')); } catch { /* ignore */ }
  }

  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
  const date = displayDate(t, 'jalali').split(' ')[0] || '';
  const profit = st?.profit || 0;

  return (
    <View style={s.dash}>
      <View style={s.clock}>
        <Text style={s.time}>{time}</Text>
        <Text style={s.date}>{toFaNum(date)}</Text>
      </View>
      <View style={s.profitBox}>
        <Text style={s.profitLbl}>💰 سود خالص ماه</Text>
        <Text style={[s.profitVal, { color: profit >= 0 ? '#00ff88' : '#ff3355' }]}>
          {toFaNum(DB.formatPrice(profit))}
        </Text>
        <Text style={s.profitUnit}>تومان</Text>
      </View>
      <View style={s.grid}>
        <DCard i="🛒" l="کل فروش" v={DB.formatPrice(st?.totalSales || 0)} c="#60a5fa" />
        <DCard i="📦" l="کل خرید" v={DB.formatPrice(st?.totalPurchases || 0)} c="#fb923c" />
        <DCard i="💳" l="پرداخت مشتری" v={DB.formatPrice(st?.customerPaid || 0)} c="#34d399" />
        <DCard i="📌" l="بدهی مشتری" v={DB.formatPrice(st?.customerDebt || 0)} c="#fb923c" />
        <DCard i="💵" l="پرداخت تأمین‌کننده" v={DB.formatPrice(st?.supplierPaid || 0)} c="#34d399" />
        <DCard i="📌" l="بدهی تأمین‌کننده" v={DB.formatPrice(st?.supplierDebt || 0)} c="#f87171" />
      </View>
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

// ═══════════════ SalesTab ═══════════════
function SalesTab() {
  const [list, setList] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [shippings, setShippings] = useState<string[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [holders, setHolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [shipping, setShipping] = useState('');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { load(); loadProds(); }, []);

  async function loadProds() {
    try {
      const p = await DB.getProducts();
      setProds(p);
      const shipSet = new Set<string>();
      const bankSet = new Set<string>();
      const holdSet = new Set<string>();
      p.forEach((x: any) => {
        if (x.shipping_name) shipSet.add(x.shipping_name);
        if (x.payer_name) holdSet.add(x.payer_name);
      });
      ['پست پیشتاز','تیپاکس','چاپار','پست','باربری','هما','ماهان'].forEach(v => shipSet.add(v));
      ['ملت','ملی','صادرات','تجارت','سپه','پاسارگاد','پارسیان','سامان','رفاه','کشاورزی','مسکن','اقتصاد نوین','سینا','شهر','آینده','دی','کارآفرین','مهر ایران','قوامین','صنعت و معدن','بلوبانک','رسالت','حکمت'].forEach(b => bankSet.add(b));
      setShippings(Array.from(shipSet).sort((a, b) => a.localeCompare(b, 'fa')));
      setBanks(Array.from(bankSet).sort((a, b) => a.localeCompare(b, 'fa')));
      setHolders(Array.from(holdSet).sort((a, b) => a.localeCompare(b, 'fa')));
    } catch { /* ignore */ }
  }

  async function load() {
    setLoading(true);
    try { setList(await DB.getSalesGrouped() as any[]); }
    catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setLoading(false); }
  }

  async function onPhone(v: string) {
    const d = v.replace(/[^\d]/g, '').slice(0, 11);
    setPhone(d);
    if (d.length === 11) {
      try {
        const f = await DB.lookupCustomerByPhone(d);
        if (f) {
          if (f.customer_name && !name) setName(f.customer_name);
          if (f.customer_address && !address) setAddress(f.customer_address);
        }
      } catch { /* ignore */ }
    }
  }

  function addItem() {
    setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', description: '' }]);
  }
  function updItem(i: number, f: string, v: any) { const n = [...items]; n[i][f] = v; setItems(n); }
  function delItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function setModel(i: number, v: string) {
    const n = [...items]; n[i].modelName = v;
    const p = prods.find((x: any) => x.name === v);
    if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; }
    setItems(n);
  }

  async function submit() {
    if (!/^09\d{9}$/.test(phone)) return Alert.alert('خطا', 'شماره معتبر نیست');
    if (!name || name.length < 2) return Alert.alert('خطا', 'نام الزامی');
    if (!shipping) return Alert.alert('خطا', 'باربری الزامی');
    const valid = items.filter(it => it.modelName && it.quantity > 0);
    if (!valid.length) return Alert.alert('خطا', 'حداقل یک مدل');
    for (const v of valid) if (!v.priceUnit) return Alert.alert('خطا', `قیمت «${v.modelName}» را وارد کن`);

    setSaving(true);
    try {
      let customerCode = '';
      const found = await DB.lookupCustomerByPhone(phone);
      if (found?.customer_code && /^M_\d+$/.test(found.customer_code)) customerCode = found.customer_code;
      else customerCode = await DB.generateCustomerCode();
      const inv = await DB.generateInvoiceNumber();
      await DB.createSale({ invoiceNumber: inv, customerCode, customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid });
      Alert.alert('✅ ثبت شد', 'فاکتور ' + inv);
      setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setShowForm(false); load();
    } catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setSaving(false); }
  }

  function remove(inv: string) {
    Alert.alert('حذف', `فاکتور ${inv} حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { try { await DB.deleteSale(inv); load(); } catch (e: any) { Alert.alert('خطا', e.message); } } },
    ]);
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
          <View style={s.invH}>
            <Text style={s.invNum}>{inv.invoice}</Text>
            <TouchableOpacity onPress={() => remove(inv.invoice)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
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

        <Autocomplete label="🚚 باربری *" value={shipping} onChange={setShipping} options={shippings} placeholder="انتخاب یا تایپ..." />

        <Text style={s.secT}>📦 اقلام ({toFaNum(items.length)})</Text>

        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <View style={s.itemH}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delItem(i)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
            </View>

            <Autocomplete label="نام مدل *" value={it.modelName}
              onChange={(v) => updItem(i, 'modelName', v)}
              onSelect={(v) => setModel(i, v)}
              options={prods.map((p: any) => p.name)}
              placeholder="کلیک یا تایپ..." />

            <Text style={s.lblS}>کد مدل</Text>
            <TextInput style={s.inp} value={it.modelCode} editable={false} />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.lblS}>تعداد *</Text>
                <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lblS}>قیمت *</Text>
                <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lblS}>پرداخت</Text>
                <TextInput style={s.inp} value={String(it.payment || '')} onChangeText={(v) => updItem(i, 'payment', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
              </View>
            </View>

            <Text style={s.lblS}>تاریخ واریز</Text>
            <DateField value={it.depositDate} onChange={(v) => updItem(i, 'depositDate', v)} compact />

            <Autocomplete label="بانک" value={it.bankName} onChange={(v) => updItem(i, 'bankName', v)} options={banks} placeholder="کلیک..." />

            <Autocomplete label="صاحب حساب" value={it.accountHolder} onChange={(v) => updItem(i, 'accountHolder', v)} options={holders} placeholder="کلیک..." />

            <Text style={s.lblS}>شرح</Text>
            <TextInput style={s.inp} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor="#64748b" />
          </View>
        ))}

        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.addBtnTxt}>➕ افزودن مدل</Text></TouchableOpacity>

        <View style={s.btnRow}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setShowForm(false)} disabled={saving}>
            <Text style={s.btnT}>↩️ برگشت</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>✅ ثبت</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════ PurchaseTab ═══════════════
function PurchaseTab() {
  const [list, setList] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [payers, setPayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sName, setSName] = useState('');
  const [sCode, setSCode] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [manualInv, setManualInv] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [payAmt, setPayAmt] = useState('');
  const [payDate, setPayDate] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [payerName, setPayerName] = useState('');
  const [receiverAcc, setReceiverAcc] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { load(); loadProds(); }, []);

  async function loadProds() {
    try {
      const p = await DB.getProducts();
      setProds(p);
      const supSet = new Set<string>();
      const payerSet = new Set<string>();
      p.forEach((x: any) => {
        if (x.supplier_name) supSet.add(x.supplier_name);
        if (x.payer_name) payerSet.add(x.payer_name);
      });
      setSuppliers(Array.from(supSet).sort((a, b) => a.localeCompare(b, 'fa')));
      setPayers(Array.from(payerSet).sort((a, b) => a.localeCompare(b, 'fa')));
    } catch { /* ignore */ }
  }

  async function load() {
    setLoading(true);
    try { setList(await DB.getPurchasesGrouped() as any[]); }
    catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setLoading(false); }
  }

  function addItem() { setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, description: '' }]); }
  function updItem(i: number, f: string, v: any) { const n = [...items]; n[i][f] = v; setItems(n); }
  function delItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function setModel(i: number, v: string) {
    const n = [...items]; n[i].modelName = v;
    const p = prods.find((x: any) => x.name === v);
    if (p) {
      n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0;
      if (!sName && p.supplier_name) setSName(p.supplier_name);
      if (!sPhone && p.supplier_phone) setSPhone(p.supplier_phone);
      if (!sCode && p.supplier_code) setSCode(p.supplier_code);
    }
    setItems(n);
  }

  async function onSupplierPick(v: string) {
    setSName(v);
    try {
      const found = await DB.lookupSupplierByName(v);
      if (found) {
        if (found.supplier_code && !sCode) setSCode(found.supplier_code);
        if (found.supplier_phone && !sPhone) setSPhone(found.supplier_phone);
      }
    } catch { /* ignore */ }
  }

  async function submit() {
    if (!sName || sName.length < 2) return Alert.alert('خطا', 'نام تأمین‌کننده الزامی');
    if (!manualInv) return Alert.alert('خطا', 'شماره فاکتور دستی الزامی');
    const valid = items.filter(it => it.modelName && it.quantity > 0);
    const amt = parseFloat(payAmt) || 0;
    if (!valid.length && amt <= 0) return Alert.alert('خطا', 'حداقل یک مدل یا مبلغ پرداخت');
    setSaving(true);
    try {
      const inv = await DB.generateInvoiceNumber();
      await DB.createPurchase({
        invoiceNumber: inv, manualInvoice: manualInv, supplierName: sName,
        supplierCode: sCode, supplierPhone: sPhone, items: valid,
        paymentAmount: amt, paymentDate: payDate || new Date().toISOString(),
        bankAccount: bankAcc, payerName, receiverAccount: receiverAcc, note,
      });
      Alert.alert('✅ ثبت شد', 'شماره داخلی: ' + inv);
      setSName(''); setSCode(''); setSPhone(''); setManualInv('');
      setItems([]); setPayAmt(''); setPayDate(''); setBankAcc('');
      setPayerName(''); setReceiverAcc(''); setNote('');
      setShowForm(false); load();
    } catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setSaving(false); }
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
          <Text style={s.invStat}>💰 {toFaNum(DB.formatPrice(inv.total))} | 💳 {toFaNum(DB.formatPrice(inv.paid))}</Text>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0f2438' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <Text style={s.formT}>🛍️ فاکتور خرید</Text>

        <Autocomplete label="🏭 نام تأمین‌کننده *" value={sName} onChange={setSName} onSelect={onSupplierPick} options={suppliers} placeholder="انتخاب یا تایپ..." />

        <Text style={s.lbl}>🆔 کد تأمین‌کننده</Text>
        <TextInput style={s.inp} value={sCode} onChangeText={setSCode} placeholder="خودکار" placeholderTextColor="#64748b" />

        <Text style={s.lbl}>📞 تلفن</Text>
        <TextInput style={s.inp} value={sPhone} onChangeText={setSPhone} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor="#64748b" />

        <Text style={s.lbl}>🧾 شماره فاکتور دستی *</Text>
        <TextInput style={s.inp} value={manualInv} onChangeText={setManualInv} placeholder="شماره روی فاکتور" placeholderTextColor="#64748b" />

        <Text style={s.secT}>📦 اقلام (اختیاری)</Text>

        {items.map((it, i) => (
          <View key={i} style={s.itemCard}>
            <View style={s.itemH}>
              <Text style={s.itemN}>#{toFaNum(i + 1)}</Text>
              <TouchableOpacity onPress={() => delItem(i)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
            </View>
            <Autocomplete label="نام مدل" value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map((p: any) => p.name)} placeholder="کلیک..." />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.lblS}>تعداد</Text>
                <TextInput style={s.inp} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lblS}>قیمت</Text>
                <TextInput style={s.inp} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />
              </View>
            </View>
            <Text style={s.lblS}>شرح</Text>
            <TextInput style={s.inp} value={it.description || ''} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor="#64748b" />
          </View>
        ))}

        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.addBtnTxt}>➕ افزودن مدل</Text></TouchableOpacity>

        <Text style={s.secT}>💳 پرداخت</Text>
        <Text style={s.lbl}>مبلغ پرداخت نقدی</Text>
        <TextInput style={s.inp} value={payAmt} onChangeText={setPayAmt} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" />

        <Text style={s.lbl}>تاریخ پرداخت</Text>
        <DateField value={payDate} onChange={(v) => setPayDate(v)} defaultToToday compact />

        <Text style={s.lbl}>حساب پرداخت‌کننده</Text>
        <TextInput style={s.inp} value={bankAcc} onChangeText={setBankAcc} placeholder="اختیاری" placeholderTextColor="#64748b" />

        <Autocomplete label="نام پرداخت‌کننده" value={payerName} onChange={setPayerName} options={payers} placeholder="کلیک..." />

        <Text style={s.lbl}>حساب دریافت‌کننده</Text>
        <TextInput style={s.inp} value={receiverAcc} onChangeText={setReceiverAcc} placeholder="اختیاری" placeholderTextColor="#64748b" />

        <Text style={s.lbl}>شرح</Text>
        <TextInput style={[s.inp, { minHeight: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} multiline placeholder="توضیحات..." placeholderTextColor="#64748b" />

        <View style={s.btnRow}>
          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setShowForm(false)} disabled={saving}>
            <Text style={s.btnT}>↩️ برگشت</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#166534' }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>✅ ثبت</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════ ProfitTab ═══════════════
function ProfitTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setList(await DB.getProfitByModel() as any[]); } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const total = list.reduce((a, m) => a + (m.totalProfit || 0), 0);

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <View style={s.statsCard}>
        <Text style={s.statsLbl}>💰 سود کل</Text>
        <Text style={[s.statsVal, { color: total >= 0 ? '#00ff88' : '#ff3355' }]}>{toFaNum(DB.formatPrice(total))}</Text>
        <Text style={s.statsUnit}>تومان</Text>
      </View>
      <Text style={s.secT}>💹 سود به تفکیک مدل ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((m: any, i: number) => (
        <View key={i} style={s.pCard}>
          <Text style={s.pName}>{m.name}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={s.pStat}>📦 فروش: {toFaNum(m.totalQty)}</Text>
            <Text style={s.pStat}>💰 {toFaNum(DB.formatPrice(m.totalSales))}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.pStat}>🛒 خرید: {m.purchasePrice ? toFaNum(DB.formatPrice(Math.round(m.purchasePrice))) : '—'}</Text>
            <Text style={[s.pStat, { color: m.totalProfit >= 0 ? '#059669' : '#dc2626', fontWeight: 'bold' }]}>💹 سود: {toFaNum(DB.formatPrice(m.totalProfit))}</Text>
          </View>
          <Text style={s.badge}>
            {m.priceSource === 'same-month' ? '✅ خرید هم‌ماه' :
             m.priceSource === 'historical' ? '📜 خرید تاریخی' :
             m.priceSource === 'estimated' ? '📊 تخمینی ۱۰٪' : '—'}
          </Text>
        </View>
      ))}
      {!loading && !list.length && <Text style={s.empty}>💹 در این بازه فروشی ثبت نشده</Text>}
    </ScrollView>
  );
}

// ═══════════════ InventoryTab ═══════════════
function InventoryTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState<any>(null);
  const [shelfVal, setShelfVal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setList(await DB.getInventory() as any[]); }
    catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setLoading(false); }
  }

  const stats = (() => {
    const st = { totalModels: 0, totalQty: 0, low: 0, out: 0, negative: 0 };
    list.forEach((m: any) => {
      st.totalModels++; st.totalQty += m.currentQty;
      if (m.status === 'negative') st.negative++;
      else if (m.status === 'out') st.out++;
      else if (m.status === 'low') st.low++;
    });
    return st;
  })();

  const filtered = list.filter((m: any) => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (q) {
      const hay = `${m.code} ${m.name} ${m.shelf || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  async function saveShelf() {
    if (!editItem) return;
    setSaving(true);
    try {
      const prods = await DB.getProducts();
      const found = prods.find((p: any) => p.code === editItem.code);
      if (found) await DB.updateProduct(found.id, { shelf: shelfVal });
      else await DB.createProduct({ code: editItem.code, name: editItem.name, price: editItem.lastPrice || 0, shelf: shelfVal });
      Alert.alert('✅ ذخیره شد');
      setEditItem(null); load();
    } catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setSaving(false); }
  }

  const statusLabel = (st: string) => st === 'negative' ? '⚫ منفی' : st === 'out' ? '🔴 ناموجود' : st === 'low' ? '⚠️ کمبود' : '✅ سالم';
  const statusColor = (st: string) => st === 'negative' ? '#1e293b' : st === 'out' ? '#dc2626' : st === 'low' ? '#d97706' : '#059669';

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[
          { l: '📊 مدل‌ها', v: stats.totalModels, c: '#60a5fa' },
          { l: '📦 جمع', v: stats.totalQty, c: '#34d399' },
          { l: '⚠️ کمبود', v: stats.low, c: '#fb923c' },
          { l: '🔴 ناموجود', v: stats.out, c: '#f87171' },
          { l: '⚫ منفی', v: stats.negative, c: '#94a3b8' },
        ].map((b, i) => (
          <View key={i} style={s.sBox}>
            <Text style={s.sBoxL}>{b.l}</Text>
            <Text style={[s.sBoxV, { color: b.c }]}>{toFaNum(b.v)}</Text>
          </View>
        ))}
      </View>

      <TextInput style={[s.inp, { marginTop: 10 }]} value={q} onChangeText={setQ}
        placeholder="🔍 جستجو: کد، نام، قفسه..." placeholderTextColor="#64748b" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'negative', l: '⚫ منفی' }, { k: 'out', l: '🔴 ناموجود' }, { k: 'low', l: '⚠️ کمبود' }, { k: 'ok', l: '✅ سالم' }].map(f => (
          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.secT}>📦 موجودی ({toFaNum(filtered.length)})</Text>

      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.map((m: any, i: number) => (
        <View key={i} style={[s.invItem, m.status === 'negative' && { backgroundColor: '#f1f5f9', borderRightColor: '#475569' }, m.status === 'out' && { backgroundColor: '#fef2f2', borderRightColor: '#dc2626' }, m.status === 'low' && { backgroundColor: '#fffbeb', borderRightColor: '#f59e0b' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#7c3aed', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' }}>{m.code}</Text>
              <Text style={s.invName}>{m.name}</Text>
            </View>
            <Text style={[s.invQty, { color: statusColor(m.status) }]}>{toFaNum(m.currentQty)}</Text>
          </View>
          <Text style={s.invStat}>📥 {toFaNum(m.bought)} | 📤 {toFaNum(m.sold)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <TouchableOpacity onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }} style={s.shelfBtn}>
              <Text style={s.shelfTxt}>📍 {m.shelf || 'قفسه ثبت نشده'}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: statusColor(m.status) }}>{statusLabel(m.status)}</Text>
          </View>
        </View>
      ))}

      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>
        <View style={s.modalBg}>
          <View style={[s.modalBox, { backgroundColor: '#fff' }]}>
            <View style={s.modalH}>
              <Text style={s.modalHTxt}>📍 قفسه — {editItem?.name}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}><Text style={s.modalClose}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.modalLbl}>کد:</Text>
              <Text style={s.modalVal}>{editItem?.code}</Text>
              <Text style={s.modalLbl}>موجودی:</Text>
              <Text style={s.modalVal}>{toFaNum(editItem?.currentQty || 0)} عدد</Text>
              <Text style={s.modalLbl}>موقعیت قفسه:</Text>
              <TextInput style={s.modalInp} value={shelfVal} onChangeText={setShelfVal} placeholder="مثلاً A-12" placeholderTextColor="#64748b" />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.mBtn, { backgroundColor: '#64748b' }]} onPress={() => setEditItem(null)}>
                  <Text style={s.mBtnTxt}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.mBtn, { backgroundColor: '#7c3aed' }]} onPress={saveShelf} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.mBtnTxt}>💾 ذخیره</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ═══════════════ ManagementTab ═══════════════
function ManagementTab() {
  const [sub, setSub] = useState('unpaid');
  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
        {[
          { k: 'unpaid', l: '🗑️ پرداخت‌نشده' },
          { k: 'search', l: '🔍 جستجو' },
          { k: 'sources', l: '📦 منابع' },
          { k: 'settings', l: '⚙️ تنظیمات' },
        ].map(t => (
          <TouchableOpacity key={t.k} onPress={() => setSub(t.k)} style={[s.subTab, sub === t.k && s.subTabActive]}>
            <Text style={[s.subTabTxt, sub === t.k && s.subTabTxtActive]}>{t.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {sub === 'unpaid' && <UnpaidSection />}
      {sub === 'search' && <SearchSection />}
      {sub === 'sources' && <SourcesSection />}
      {sub === 'settings' && <SettingsSection />}
    </ScrollView>
  );
}

function UnpaidSection() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setList(await DB.getUnpaidInvoices() as any[]); } catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setLoading(false); }
  }

  function toggle(inv: string) { const n = new Set(selected); n.has(inv) ? n.delete(inv) : n.add(inv); setSelected(n); }

  async function deleteSelected() {
    if (!selected.size) return;
    Alert.alert('حذف', `${selected.size} فاکتور حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { for (const inv of Array.from(selected)) await DB.deleteSale(inv); Alert.alert('✅ حذف شد'); setSelected(new Set()); load(); }
        catch (e: any) { Alert.alert('خطا', e.message); }
      }},
    ]);
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity style={s.toolBtn} onPress={load}><Text style={s.toolBtnTxt}>🔄 بروزرسانی</Text></TouchableOpacity>
        <TouchableOpacity style={[s.toolBtn, { backgroundColor: '#dc2626' }]} onPress={deleteSelected} disabled={!selected.size}>
          <Text style={s.toolBtnTxt}>🗑️ حذف ({selected.size})</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.secT}>📄 پرداخت‌نشده ({toFaNum(list.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : list.map((inv: any) => (
        <TouchableOpacity key={inv.invoice} onPress={() => toggle(inv.invoice)} style={[s.invCard, selected.has(inv.invoice) && { backgroundColor: '#fee2e2', borderRightColor: '#dc2626' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>{selected.has(inv.invoice) ? '✅' : '⬜'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.invNum}>{inv.invoice}</Text>
              <Text style={s.invCust}>👤 {inv.name} — {inv.phone}</Text>
              <Text style={s.invStat}>💰 {toFaNum(DB.formatPrice(inv.total))} | 💳 {toFaNum(DB.formatPrice(inv.paid))}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {!loading && !list.length && <Text style={s.empty}>✅ پرداخت‌نشده‌ای نیست</Text>}
    </View>
  );
}

function SearchSection() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setList(await DB.searchAllInvoices('') as any[]); } catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setLoading(false); }
  }

  const filtered = list.filter((r: any) => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (q) {
      const hay = `${r.invoice} ${r.name || ''} ${r.phone || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  function remove(inv: string, type: string) {
    Alert.alert('حذف', `فاکتور ${inv} حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { type === 'purchases' ? await DB.deletePurchase(inv) : await DB.deleteSale(inv); load(); }
        catch (e: any) { Alert.alert('خطا', e.message); }
      }},
    ]);
  }

  return (
    <View>
      <TextInput style={s.inp} value={q} onChangeText={setQ} placeholder="🔍 فاکتور، نام، تلفن..." placeholderTextColor="#64748b" />
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
        {[{ k: 'all', l: '📋 همه' }, { k: 'sales', l: '🛒 فروش' }, { k: 'purchases', l: '🛍️ خرید' }].map(f => (
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
              <Text style={s.invStat}>💰 {toFaNum(DB.formatPrice(r.total))} | 💳 {toFaNum(DB.formatPrice(r.paid))}</Text>
              <Text style={s.badge}>{r.type === 'purchases' ? '🛍️ خرید' : '🛒 فروش'}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(r.invoice, r.type)} style={s.delBtn}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

function SourcesSection() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setList(await DB.getProducts() as any[]); } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const filtered = q ? list.filter((p: any) => `${p.code} ${p.name} ${p.supplier_name || ''} ${p.shelf || ''}`.toLowerCase().includes(q.toLowerCase())) : list;

  function addNew() { setEditing({ id: null, code: '', name: '', price: 0, shelf: '', supplier_name: '', supplier_code: '', supplier_phone: '', payer_name: '', shipping_name: '' }); }

  async function save() {
    try {
      if (editing.id) await DB.updateProduct(editing.id, editing);
      else await DB.createProduct(editing);
      Alert.alert('✅ ذخیره شد');
      setEditing(null); load();
    } catch (e: any) { Alert.alert('خطا', e.message); }
  }

  function remove(id: string) {
    Alert.alert('حذف', 'این کالا حذف شود؟', [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { try { await DB.deleteProduct(id); load(); } catch (e: any) { Alert.alert('خطا', e.message); } } },
    ]);
  }

  return (
    <View>
      <TouchableOpacity style={[s.toolBtn, { backgroundColor: '#7c3aed', marginBottom: 10 }]} onPress={addNew}>
        <Text style={s.toolBtnTxt}>➕ افزودن کالا</Text>
      </TouchableOpacity>
      <TextInput style={s.inp} value={q} onChangeText={setQ} placeholder="🔍 جستجو در کالاها..." placeholderTextColor="#64748b" />
      <Text style={s.secT}>📦 کالاها ({toFaNum(filtered.length)})</Text>
      {loading ? <ActivityIndicator color="#d4af37" /> : filtered.map((p: any) => (
        <View key={p.id} style={s.invCard}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.invNum}>{p.code} — {p.name}</Text>
              <Text style={s.invStat}>💰 {toFaNum(DB.formatPrice(p.price || 0))} | 📍 {p.shelf || '—'}</Text>
              {p.supplier_name ? <Text style={s.invCust}>🏭 {p.supplier_name}</Text> : null}
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => setEditing({ ...p })} style={[s.delBtn, { backgroundColor: '#dbeafe' }]}><Text style={{ fontSize: 14 }}>✏️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(p.id)} style={s.delBtn}><Text style={{ fontSize: 14 }}>🗑</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.modalBg}>
          <ScrollView style={[s.modalBox, { backgroundColor: '#fff' }]}>
            <View style={s.modalH}>
              <Text style={s.modalHTxt}>{editing?.id ? '✏️ ویرایش کالا' : '➕ کالای جدید'}</Text>
              <TouchableOpacity onPress={() => setEditing(null)}><Text style={s.modalClose}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 14 }}>
              {[
                { k: 'code', l: 'کد *' }, { k: 'name', l: 'نام *' },
                { k: 'price', l: 'قیمت', num: true }, { k: 'shelf', l: '📍 قفسه' },
                { k: 'supplier_name', l: '🏭 تأمین‌کننده' }, { k: 'supplier_code', l: 'کد تأمین‌کننده' },
                { k: 'supplier_phone', l: '📞 تلفن' }, { k: 'payer_name', l: 'نام پرداخت‌کننده' },
                { k: 'shipping_name', l: '🚚 باربری' },
              ].map(f => (
                <View key={f.k}>
                  <Text style={s.lbl}>{f.l}</Text>
                  <TextInput style={s.inp} value={String(editing?.[f.k] || '')}
                    onChangeText={(v) => setEditing({ ...editing, [f.k]: f.num ? (parseFloat(v) || 0) : v })}
                    keyboardType={f.num ? 'numeric' : 'default'} placeholderTextColor="#64748b" />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity style={[s.mBtn, { backgroundColor: '#64748b' }]} onPress={() => setEditing(null)}><Text style={s.mBtnTxt}>انصراف</Text></TouchableOpacity>
                <TouchableOpacity style={[s.mBtn, { backgroundColor: '#059669' }]} onPress={save}><Text style={s.mBtnTxt}>💾 ذخیره</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SettingsSection() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => { load(); }, []);
  async function load() { try { setSettings(await DB.getSettings()); } catch { /* ignore */ } }

  async function save() {
    setSaving(true);
    try { await DB.updateSettings(settings || {}); Alert.alert('✅ ذخیره شد'); }
    catch (e: any) { Alert.alert('خطا', e.message); }
    finally { setSaving(false); }
  }

  const emails: string[] = settings?.emails || [];

  function addEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) return Alert.alert('خطا', 'ایمیل معتبر وارد کن');
    setSettings({ ...settings, emails: [...emails, emailInput] });
    setEmailInput('');
  }

  return (
    <View>
      <Text style={s.secT}>📅 نوع تقویم</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[{ k: 'jalali', l: '🌙 شمسی' }, { k: 'gregorian', l: '🌍 میلادی' }, { k: 'hijri', l: '🕋 قمری' }].map(f => (
          <TouchableOpacity key={f.k} onPress={() => setSettings({ ...settings, cal_type: f.k })} style={[s.chip, settings?.cal_type === f.k && s.chipActive]}>
            <Text style={[s.chipTxt, settings?.cal_type === f.k && s.chipTxtActive]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.secT}>💹 درصد سود تخمینی</Text>
      <TextInput style={s.inp} value={String(Math.round((settings?.profit_margin || 0.10) * 100))}
        onChangeText={(v) => setSettings({ ...settings, profit_margin: (parseFloat(v) || 0) / 100 })}
        keyboardType="numeric" placeholderTextColor="#64748b" />
      <Text style={s.secT}>📦 آستانه کمبود</Text>
      <TextInput style={s.inp} value={String(settings?.inventory_threshold || 5)}
        onChangeText={(v) => setSettings({ ...settings, inventory_threshold: parseInt(v) || 5 })}
        keyboardType="numeric" placeholderTextColor="#64748b" />
      <Text style={s.secT}>📧 ایمیل‌های گزارش</Text>
      {emails.map((e, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 6 }}>
          <Text style={{ flex: 1, color: '#fff', fontSize: 12 }} numberOfLines={1}>{e}</Text>
          <TouchableOpacity onPress={() => setSettings({ ...settings, emails: emails.filter((_, idx) => idx !== i) })} style={s.delBtn}><Text style={{ fontSize: 16 }}>🗑</Text></TouchableOpacity>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput style={[s.inp, { flex: 1 }]} value={emailInput} onChangeText={setEmailInput}
          placeholder="ایمیل جدید..." placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none" />
        <TouchableOpacity style={[s.toolBtn, { backgroundColor: '#7c3aed' }]} onPress={addEmail}><Text style={s.toolBtnTxt}>➕</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={[s.toolBtn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.toolBtnTxt}>💾 ذخیره همه</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════ MoreTab ═══════════════
function MoreTab() {
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '');
      setUserId(data.user?.id || '');
    });
  }, []);

  function logout() {
    Alert.alert('خروج', 'مطمئنی؟', [
      { text: 'لغو', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  }

  return (
    <ScrollView style={s.content} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <Dashboard />
      <Text style={s.secT}>👤 حساب کاربری</Text>
      <View style={s.invCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
          <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold' }}>📧 ایمیل:</Text>
          <Text style={{ color: '#0f2438', fontSize: 12, fontWeight: 'bold', flex: 1, marginLeft: 8 }}>{email || '—'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
          <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold' }}>🆔 شناسه:</Text>
          <Text style={{ color: '#7c3aed', fontSize: 11, marginLeft: 8 }}>{userId ? userId.slice(0, 12) + '...' : '—'}</Text>
        </View>
      </View>
      <TouchableOpacity style={{ backgroundColor: '#dc2626', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 }} onPress={logout}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🚪 خروج از حساب</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ═══════════════ LoginScreen ═══════════════
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !pass) return Alert.alert('خطا', 'ایمیل و رمز را وارد کن');
    if (pass.length < 6) return Alert.alert('خطا', 'رمز باید حداقل ۶ کاراکتر باشد');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Alert.alert('خطا', 'ایمیل معتبر وارد کن');
    setLoading(true);
    try {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (e1) {
        const { error: e2 } = await supabase.auth.signUp({ email, password: pass });
        if (e2) throw e2;
        const { error: e3 } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (e3) throw e3;
      }
    } catch (e: any) { Alert.alert('خطا', e.message || 'مشکلی پیش آمد'); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.loginWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.loginCard}>
        <Text style={s.loginLogo}>⚖️</Text>
        <Text style={s.loginTitle}>میزان</Text>
        <Text style={s.loginSub}>ورود یا ثبت‌نام</Text>
        <TextInput style={s.loginInp} value={email} onChangeText={setEmail} placeholder="ایمیل" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={s.loginInp} value={pass} onChangeText={setPass} placeholder="رمز (حداقل ۶ کاراکتر)" placeholderTextColor="#94a3b8" secureTextEntry />
        <TouchableOpacity style={{ backgroundColor: '#1e3a8a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 6 }} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>ورود / ثبت‌نام</Text>}
        </TouchableOpacity>
        <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 11, marginTop: 12, lineHeight: 18 }}>اگر حساب ندارید، خودکار ساخته می‌شود</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// ═══════════════ Styles ═══════════════
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
  secT: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginTop: 12, textAlign: 'right' },
  formT: { color: '#d4af37', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  lbl: { color: '#94a3b8', fontSize: 11, marginBottom: 4, marginTop: 8, textAlign: 'right' },
  lblS: { color: '#94a3b8', fontSize: 10, marginBottom: 3, marginTop: 6, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, color: '#fff', textAlign: 'right' },
  btn: { padding: 14, borderRadius: 10, alignItems: 'center' },
  btnT: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  row: { flexDirection: 'row', gap: 6 },
  itemCard: { backgroundColor: '#1a2332', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  itemH: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemN: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
  invCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#1e3a8a' },
  invH: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  invNum: { color: '#1e3a5f', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' },
  invCust: { color: '#64748b', fontSize: 11, marginBottom: 6, textAlign: 'right' },
  invStat: { color: '#1a2332', fontSize: 11, fontFamily: 'monospace' },
  statsCard: { backgroundColor: '#080b13', borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: '#1f3a5f' },
  statsLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 6 },
  statsVal: { fontSize: 28, fontFamily: 'Orbitron_900Black' },
  statsUnit: { color: '#64748b', fontSize: 10, marginTop: 3 },
  pCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#059669' },
  pName: { color: '#0f2438', fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  pStat: { color: '#475569', fontSize: 11, fontFamily: 'monospace', textAlign: 'right' },
  badge: { marginTop: 6, fontSize: 10, color: '#6d28d9', backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, textAlign: 'right', alignSelf: 'flex-end' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },
  invItem: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderRightWidth: 4, borderRightColor: '#10b981' },
  invName: { color: '#0f2438', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  invQty: { fontSize: 22, fontWeight: 'bold', fontFamily: 'Orbitron_900Black' },
  shelfBtn: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
  shelfTxt: { color: '#075985', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' },
  sBox: { width: '31%', marginHorizontal: '1.16%', marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderRightWidth: 3, borderRightColor: '#10b981' },
  sBoxL: { color: '#64748b', fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  sBoxV: { fontSize: 16, fontFamily: 'Orbitron_700Bold' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipTxt: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  chipTxtActive: { color: '#fff' },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332' },
  subTabActive: { backgroundColor: '#c0392b', borderColor: '#c0392b' },
  subTabTxt: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  subTabTxtActive: { color: '#fff' },
  toolBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' },
  toolBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  delBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 6 },
  modalBg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.85)', justifyContent: 'center', padding: 16 },
  modalBox: { borderRadius: 14, maxHeight: '92%', overflow: 'hidden' },
  modalH: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  modalClose: { color: '#fff', fontSize: 26, lineHeight: 26, paddingHorizontal: 6 },
  modalLbl: { color: '#94a3b8', fontSize: 11, marginBottom: 4, marginTop: 8, textAlign: 'right' },
  modalVal: { color: '#0f2438', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  modalInp: { borderWidth: 2, borderColor: '#a78bfa', borderRadius: 8, padding: 12, fontSize: 14, fontFamily: 'monospace', textAlign: 'center', color: '#0f2438' },
  mBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  mBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  loginWrap: { flex: 1, backgroundColor: '#0f2438', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 18, padding: 24 },
  loginLogo: { fontSize: 54, textAlign: 'center', marginBottom: 8 },
  loginTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#0f2438', marginBottom: 4 },
  loginSub: { fontSize: 13, textAlign: 'center', color: '#64748b', marginBottom: 24 },
  loginInp: { backgroundColor: '#f5f7fa', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 10, color: '#1a2332', textAlign: 'right' },
});
