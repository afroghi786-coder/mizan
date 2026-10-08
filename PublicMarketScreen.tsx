// PublicMarketScreen.tsx — بازار عمومی (مستقل، بدون وابستگی به App)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

const CITIES: Record<string, string> = {
  KBL: 'کابل', HRT: 'هرات', MZR: 'مزار', KDH: 'کندز', JAL: 'جلال‌آباد',
  KDR: 'کندهار', GHA: 'غزنی', BAM: 'بامیان', TAK: 'تخار', BAD: 'بدخشان',
};
const CITY_KEYS = Object.keys(CITIES);

type Sub = 'jobs' | 'goods' | 'services' | 'property';

const SUBS: { k: Sub; l: string; i: string; c: string }[] = [
  { k: 'jobs',     l: 'استخدام',     i: '💼', c: '#0891b2' },
  { k: 'goods',    l: 'خرید و فروش', i: '🛍️', c: '#7c3aed' },
  { k: 'services', l: 'خدمات',       i: '🛠️', c: '#059669' },
  { k: 'property', l: 'املاک',       i: '🏠', c: '#f59e0b' },
];

const JOB_CATS = [
  { k: 'construction', l: 'ساختمانی و فنی',    i: '🏗️' },
  { k: 'transport',    l: 'حمل و نقل',         i: '🚗' },
  { k: 'sales',        l: 'فروش و بازاریابی',  i: '🛒' },
  { k: 'restaurant',   l: 'رستوران و هتل',     i: '🍽️' },
  { k: 'office',       l: 'اداری و دفتری',     i: '💼' },
  { k: 'it',           l: 'کامپیوتر و IT',     i: '💻' },
  { k: 'teaching',     l: 'آموزش و تدریس',     i: '📚' },
  { k: 'health',       l: 'صحت و درمان',       i: '🩺' },
  { k: 'clean',        l: 'خدمات و نظافت',     i: '🧹' },
  { k: 'beauty',       l: 'زیبایی و خیاطی',     i: '✂️' },
];

const GOODS_CATS = [
  { k: 'mobile',  l: 'موبایل',  i: '📱' },
  { k: 'vehicle', l: 'وسیله',   i: '🚗' },
  { k: 'laptop',  l: 'لپ‌تاپ',  i: '💻' },
  { k: 'home',    l: 'خانه',    i: '🏠' },
  { k: 'clothes', l: 'پوشاک',   i: '👕' },
  { k: 'other',   l: 'سایر',    i: '📦' },
];

const SERVICE_CATS = [
  { k: 'repair',    l: 'تعمیرات',      i: '🔧' },
  { k: 'transport', l: 'حمل و نقل',    i: '🚚' },
  { k: 'teach',     l: 'آموزش خصوصی',  i: '📚' },
  { k: 'beauty',    l: 'زیبایی',        i: '💅' },
  { k: 'clean',     l: 'نظافت',         i: '🧹' },
];

export default function PublicMarketScreen({ showToast, userEmail }: any) {
  const [sub, setSub] = useState<Sub>('jobs');
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [subCat, setSubCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState<any>({
    title: '', description: '', price: '', currency: 'AFN',
    city: 'KBL', condition: 'new', phone: '',
    subcategory: '', job_type: 'full-time',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await import('./lib.network');
      const fn = (m as any).fetchPublicAds;
      if (typeof fn === 'function') {
        const list = await fn({ category: sub, search, city: cityFilter, subcategory: subCat });
        setAds(list || []);
      } else setAds([]);
    } catch { setAds([]); }
    setLoading(false);
  }, [sub, search, cityFilter, subCat]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const submit = async () => {
    if (!form.title || form.title.length < 3) return showToast?.('عنوان الزامی', true);
    if (!form.city) return showToast?.('شهر الزامی', true);
    setSaving(true);
    try {
      const m = await import('./lib.network');
      const fn = (m as any).createPublicAd;
      if (typeof fn !== 'function') throw new Error('تابع پیدا نشد');
      await fn({
        category: sub,
        subcategory: form.subcategory || '',
        title: form.title,
        description: form.description || '',
        price: Number(form.price) || 0,
        currency: form.currency,
        city: form.city,
        condition: sub === 'goods' ? form.condition : null,
        job_type: sub === 'jobs' ? form.job_type : null,
        phone: form.phone || '',
      });
      showToast?.('✅ آگهی ثبت شد');
      setShowForm(false);
      setForm({ title: '', description: '', price: '', currency: 'AFN', city: 'KBL', condition: 'new', phone: '', subcategory: '', job_type: 'full-time' });
      load();
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    setSaving(false);
  };

  const del = async (id: any) => {
    try {
      const m = await import('./lib.network');
      const fn = (m as any).deletePublicAd;
      if (typeof fn !== 'function') return;
      await fn(id);
      showToast?.('🗑 حذف شد');
      load();
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };

  const cats = sub === 'jobs' ? JOB_CATS : sub === 'goods' ? GOODS_CATS : sub === 'services' ? SERVICE_CATS : [];
  const subColor = SUBS.find(x => x.k === sub)?.c || '#0891b2';

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.head}>
        <Text style={st.headTitle}>🏛️ بازار عمومی</Text>
        <Text style={st.headSub}>خرید، فروش، استخدام و خدمات</Text>
      </View>

      {/* Sub tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsRow}>
        {SUBS.map(x => (
          <TouchableOpacity
            key={x.k}
            onPress={() => { setSub(x.k); setSubCat(''); }}
            style={[st.subTab, sub === x.k && { backgroundColor: x.c, borderColor: x.c }]}
          >
            <Text style={[st.subTabTxt, sub === x.k && { color: '#fff', fontWeight: 'bold' }]}>{x.i} {x.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <TextInput
        style={st.search}
        value={search}
        onChangeText={setSearch}
        placeholder="🔍 جستجو..."
        placeholderTextColor="#94a3b8"
      />

      {/* City filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
        <TouchableOpacity onPress={() => setCityFilter('')} style={[st.chip, !cityFilter && st.chipActive]}>
          <Text style={[st.chipTxt, !cityFilter && { color: '#fff' }]}>همه</Text>
        </TouchableOpacity>
        {CITY_KEYS.map(c => (
          <TouchableOpacity key={c} onPress={() => setCityFilter(c)} style={[st.chip, cityFilter === c && st.chipActive]}>
            <Text style={[st.chipTxt, cityFilter === c && { color: '#fff' }]}>{CITIES[c]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sub-categories */}
      {cats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
          <TouchableOpacity onPress={() => setSubCat('')} style={[st.chip, !subCat && { backgroundColor: '#1e3a5f', borderColor: subColor }]}>
            <Text style={[st.chipTxt, !subCat && { color: subColor }]}>همه</Text>
          </TouchableOpacity>
          {cats.map(c => (
            <TouchableOpacity key={c.k} onPress={() => setSubCat(c.k)} style={[st.chip, subCat === c.k && { backgroundColor: '#1e3a5f', borderColor: subColor }]}>
              <Text style={[st.chipTxt, subCat === c.k && { color: subColor }]}>{c.i} {c.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#d4af37" />}
      >
        {loading ? (
          <ActivityIndicator color="#d4af37" style={{ marginTop: 40 }} />
        ) : ads.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 50, marginBottom: 10 }}>📭</Text>
            <Text style={st.emptyTxt}>هنوز آگهی‌ای نیست</Text>
            <Text style={st.emptyHint}>اولین نفر باش — روی «ثبت آگهی» بزن</Text>
          </View>
        ) : ads.map((a: any) => (
          <View key={a.id} style={[st.card, { borderRightColor: subColor }]}>
            <View style={st.cardTop}>
              <Text style={st.cardTitle} numberOfLines={2}>{a.title}</Text>
              {a.user_email === userEmail ? (
                <TouchableOpacity onPress={() => del(a.id)}>
                  <Text style={{ fontSize: 16 }}>🗑</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {a.description ? <Text style={st.cardDesc} numberOfLines={3}>{a.description}</Text> : null}
            {a.price > 0 ? (
              <Text style={st.cardPrice}>💰 {fmt(a.price)} {a.currency}</Text>
            ) : a.category === 'jobs' ? (
              <Text style={st.cardPrice}>💰 توافقی</Text>
            ) : null}
            <View style={st.cardFoot}>
              <Text style={st.cardCity}>📍 {CITIES[a.city] || a.city}</Text>
              {a.phone ? <Text style={st.cardPhone}>📞 {a.phone}</Text> : null}
            </View>
            <Text style={st.cardBy}>👤 {a.user_name || a.user_email?.split('@')[0] || '—'}</Text>
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[st.fab, { backgroundColor: subColor }]} onPress={() => setShowForm(true)}>
        <Text style={st.fabTxt}>➕</Text>
        <Text style={st.fabLbl}>ثبت آگهی</Text>
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: subColor }]}>
            <Text style={st.mTitle}>➕ آگهی جدید</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={st.lbl}>عنوان *</Text>
            <TextInput style={st.inp} value={form.title} onChangeText={(v: string) => setForm({ ...form, title: v })} placeholder="مثلاً: بنا با تجربه" placeholderTextColor="#94a3b8" />

            {cats.length > 0 && (
              <>
                <Text style={st.lbl}>دسته</Text>
                <View style={st.chipsWrap}>
                  {cats.map(c => (
                    <TouchableOpacity key={c.k} onPress={() => setForm({ ...form, subcategory: c.k })} style={[st.chip, form.subcategory === c.k && { backgroundColor: subColor, borderColor: subColor }]}>
                      <Text style={[st.chipTxt, form.subcategory === c.k && { color: '#fff' }]}>{c.i} {c.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={st.lbl}>شهر *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
              {CITY_KEYS.map(c => (
                <TouchableOpacity key={c} onPress={() => setForm({ ...form, city: c })} style={[st.chip, form.city === c && { backgroundColor: subColor, borderColor: subColor }]}>
                  <Text style={[st.chipTxt, form.city === c && { color: '#fff' }]}>{CITIES[c]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {sub === 'jobs' && (
              <>
                <Text style={st.lbl}>نوع همکاری</Text>
                <View style={st.chipsWrap}>
                  {[{ k: 'full-time', l: 'تمام‌وقت' }, { k: 'part-time', l: 'پاره‌وقت' }, { k: 'daily', l: 'روزمزد' }].map(t => (
                    <TouchableOpacity key={t.k} onPress={() => setForm({ ...form, job_type: t.k })} style={[st.chip, form.job_type === t.k && { backgroundColor: subColor, borderColor: subColor }]}>
                      <Text style={[st.chipTxt, form.job_type === t.k && { color: '#fff' }]}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {sub === 'goods' && (
              <>
                <Text style={st.lbl}>وضعیت</Text>
                <View style={st.chipsWrap}>
                  {[{ k: 'new', l: 'نو' }, { k: 'used', l: 'دست‌دوم' }].map(t => (
                    <TouchableOpacity key={t.k} onPress={() => setForm({ ...form, condition: t.k })} style={[st.chip, form.condition === t.k && { backgroundColor: subColor, borderColor: subColor }]}>
                      <Text style={[st.chipTxt, form.condition === t.k && { color: '#fff' }]}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={st.lbl}>قیمت (اختیاری)</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TextInput style={[st.inp, { flex: 2 }]} value={form.price} onChangeText={(v: string) => setForm({ ...form, price: v.replace(/[^0-9]/g, '') })} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
              <TouchableOpacity onPress={() => setForm({ ...form, currency: form.currency === 'AFN' ? 'USD' : 'AFN' })} style={[st.inp, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{form.currency === 'AFN' ? 'افغانی' : 'دالر'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={st.lbl}>شماره تماس</Text>
            <TextInput style={st.inp} value={form.phone} onChangeText={(v: string) => setForm({ ...form, phone: v.replace(/[^0-9]/g, '') })} keyboardType="phone-pad" placeholder="07..." placeholderTextColor="#94a3b8" />

            <Text style={st.lbl}>توضیحات</Text>
            <TextInput style={[st.inp, { minHeight: 70 }]} value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} multiline placeholder="جزئیات..." placeholderTextColor="#94a3b8" />

            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[st.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setShowForm(false)}>
                <Text style={st.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btn, { backgroundColor: subColor, flex: 2 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>💾 ثبت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628' },
  head: { backgroundColor: '#0f2438', padding: 14, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  headTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  headSub: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 4 },
  tabsRow: { padding: 8, gap: 6, flexDirection: 'row-reverse' },
  subTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f2438', borderWidth: 1, borderColor: '#334155' },
  subTabTxt: { color: '#94a3b8', fontSize: 12 },
  search: { backgroundColor: '#0f2438', color: '#fff', margin: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155', textAlign: 'right' },
  chipsRow: { paddingHorizontal: 8, paddingVertical: 4, gap: 6, flexDirection: 'row-reverse' },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#0f2438', borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  chipTxt: { color: '#94a3b8', fontSize: 11 },
  empty: { alignItems: 'center', padding: 60 },
  emptyTxt: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  emptyHint: { color: '#64748b', fontSize: 11 },
  card: { backgroundColor: '#0f2438', padding: 12, borderRadius: 10, marginBottom: 8, borderRightWidth: 3 },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8 },
  cardDesc: { color: '#cbd5e1', fontSize: 12, marginTop: 6, textAlign: 'right' },
  cardPrice: { color: '#10b981', fontSize: 13, fontWeight: 'bold', marginTop: 6, textAlign: 'right' },
  cardFoot: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  cardCity: { color: '#94a3b8', fontSize: 11 },
  cardPhone: { color: '#60a5fa', fontSize: 11, fontWeight: 'bold' },
  cardBy: { color: '#64748b', fontSize: 10, marginTop: 4, textAlign: 'right' },
  fab: { position: 'absolute', bottom: 20, right: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, elevation: 5 },
  fabTxt: { fontSize: 20 },
  fabLbl: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 12 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '92%', overflow: 'hidden' },
  mHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  lbl: { color: '#94a3b8', fontSize: 11, marginTop: 10, marginBottom: 4, textAlign: 'right', fontWeight: 'bold' },
  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
