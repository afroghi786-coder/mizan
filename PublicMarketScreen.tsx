// PublicMarketScreen.tsx — بازار عمومی (نسخه نهایی استاندارد)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, RefreshControl, Switch } from 'react-native';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

const CITIES: Record<string, string> = {
  KBL: 'کابل', HRT: 'هرات', MZR: 'مزار', KDH: 'کندز', JAL: 'جلال‌آباد',
  KDR: 'کندهار', GHA: 'غزنی', BAM: 'بامیان', TAK: 'تخار', BAD: 'بدخشان',
};
const CITY_KEYS = Object.keys(CITIES);

type Sub = 'jobs' | 'goods' | 'services' | 'property';

const SUBS: { k: Sub; l: string; i: string; c: string }[] = [
  { k: 'jobs',     l: 'استخدام',  i: '💼', c: '#0891b2' },
  { k: 'goods',    l: 'کالا',     i: '🛍️', c: '#7c3aed' },
  { k: 'services', l: 'خدمات',    i: '🛠️', c: '#059669' },
  { k: 'property', l: 'املاک',    i: '🏠', c: '#f59e0b' },
];

// ═══════ استخدام ═══════
const JOBS_CATS = [
  { k: 'admin',        l: 'اداری و دفتری' },
  { k: 'sales_job',    l: 'فروش و بازاریابی' },
  { k: 'it_job',       l: 'کامپیوتر و IT' },
  { k: 'teaching',     l: 'آموزش و تدریس' },
  { k: 'health',       l: 'صحت و درمان' },
  { k: 'technical',    l: 'فنی و مهندسی' },
  { k: 'restaurant',   l: 'رستوران و هتل' },
  { k: 'clean',        l: 'خدمات و نظافت' },
  { k: 'transport',    l: 'حمل و نقل' },
  { k: 'construction', l: 'ساختمانی' },
  { k: 'beauty_job',   l: 'زیبایی و آرایش' },
  { k: 'security',     l: 'نگهبانی و امنیت' },
];

// ═══════ کالا ═══════
const GOODS_CATS = [
  { k: 'mobile',    l: 'موبایل و تبلت' },
  { k: 'laptop',    l: 'لپ‌تاپ و کامپیوتر' },
  { k: 'vehicle',   l: 'وسایل نقلیه' },
  { k: 'home',      l: 'خانه و آشپزخانه' },
  { k: 'clothes',   l: 'پوشاک و کیف' },
  { k: 'electric',  l: 'لوازم برقی' },
  { k: 'books',     l: 'کتاب و لوازم' },
  { k: 'sports',    l: 'ورزش و سرگرمی' },
  { k: 'toys',      l: 'اسباب‌بازی' },
  { k: 'other_g',   l: 'سایر' },
];

// ═══════ خدمات ═══════
const SERVICES_CATS = [
  { k: 'repair',     l: 'تعمیرات' },
  { k: 'transport_s', l: 'حمل و نقل' },
  { k: 'teach_priv', l: 'آموزش خصوصی' },
  { k: 'beauty_s',   l: 'زیبایی و آرایش' },
  { k: 'clean_s',    l: 'نظافت' },
  { k: 'design',     l: 'برنامه‌نویسی و دیزاین' },
  { k: 'translate',  l: 'ترجمه و تایپ' },
  { k: 'other_s',    l: 'سایر' },
];

// ═══════ املاک ═══════
const PROPERTY_CATS = [
  { k: 'apartment',  l: 'آپارتمان' },
  { k: 'house',      l: 'خانه و ویلا' },
  { k: 'land',       l: 'زمین و ملک' },
  { k: 'shop',       l: 'مغازه و دفتر' },
  { k: 'warehouse',  l: 'انبار' },
  { k: 'parking',    l: 'جای پارک' },
];

const PROPERTY_DEALS = [
  { k: 'sale', l: 'فروش' },
  { k: 'rent', l: 'اجاره' },
];

export default function PublicMarketScreen({ showToast, userEmail, onBack }: any) {
  const [sub, setSub] = useState<Sub>('jobs');
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [subCat, setSubCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [prefs, setPrefs] = useState<any>({});
  const [marketPrefs, setMarketPrefs] = useState<any>({
    m_sound: true,
    m_vibrate: true,
    m_browser: true,
    m_new_ad_city: true,
    m_new_ad_cat: true,
    m_chat_msg: true,
    m_saved_ad: true,
  });
  const [favCities, setFavCities] = useState<string[]>(['KBL']);
  const [favCats, setFavCats] = useState<string[]>([]);
  const [notifModal, setNotifModal] = useState(false);
  const [notifList, setNotifList] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myAdsCount, setMyAdsCount] = useState(0);

  const [chatModal, setChatModal] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [chatPeer, setChatPeer] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const emptyForm = {
    title: '', description: '', price: '', currency: 'AFN',
    city: 'KBL', condition: 'new', phone: '',
    subcategory: '', job_type: 'full-time', deal_type: 'sale', rooms: '', size: '',
  };
  const [form, setForm] = useState<any>(emptyForm);

  const getCats = () => sub === 'jobs' ? JOBS_CATS : sub === 'goods' ? GOODS_CATS : sub === 'services' ? SERVICES_CATS : PROPERTY_CATS;
  const cats = getCats();
  const subColor = SUBS.find(x => x.k === sub)?.c || '#0891b2';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await import('./lib.network');
      // ⚡ initNetwork
      await (m as any).loadNetSettings?.();
      await (m as any).initNetwork?.();
      const fn = (m as any).fetchPublicAds;
      if (typeof fn === 'function') {
        const list = await fn({ category: sub, search, city: cityFilter, subcategory: '' });
        setAds(list || []);
      } else setAds([]);
    } catch { setAds([]); }
    setLoading(false);
  }, [sub, search, cityFilter, subCat]);

  useEffect(() => { load(); }, [load]);

  // polling پیام‌های نخوانده — هر ۳ ثانیه
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        await (m as any).initNetwork?.();
        const list = await (m as any).fetchMyUnreadMessages?.();
        if (!alive) return;
        setNotifList(list || []);
        setUnreadCount((list || []).length);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // load تنظیمات
  useEffect(() => {
    (async () => {
      try {
        const m = await import('./lib.network');
        const p = await (m as any).fetchPreferences?.();
        if (p) setPrefs(p);
      } catch {}
    })();
  }, []);

  // preselected subcategory when opening form
  useEffect(() => {
    if (showForm && subCat && !form.subcategory) {
      setForm(f => ({ ...f, subcategory: subCat }));
    }
  }, [showForm]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!chatModal || !chatRoom?.id) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        const msgs = await (m as any).fetchMessages(chatRoom.id);
        if (alive) setChatMessages(msgs || []);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    (async () => {
      try {
        const m = await import('./lib.network');
        await (m as any).markRoomRead(chatRoom.id);
      } catch {}
    })();
    return () => { alive = false; clearInterval(iv); };
  }, [chatModal, chatRoom?.id]);

  const submit = async () => {
    if (!form.title || form.title.trim().length < 3) return showToast?.('عنوان حداقل ۳ کاراکتر', true);
    if (!form.city) return showToast?.('شهر الزامی', true);
    
    setSaving(true);
    try {
      const m = await import('./lib.network');
      const fn = (m as any).createPublicAd;
      if (typeof fn !== 'function') throw new Error('تابع createPublicAd پیدا نشد');
      const payload: any = {
        category: sub,
        subcategory: form.subcategory || 'other',
        title: form.title.trim(),
        description: (form.description || '').trim(),
        price: Number(form.price) || 0,
        currency: form.currency || 'AFN',
        city: form.city,
        phone: (form.phone || '').trim(),
      };
      if (sub === 'jobs') payload.job_type = form.job_type || 'full-time';
      if (sub === 'goods') payload.condition = form.condition || 'new';
      if (sub === 'property') {
        payload.deal_type = form.deal_type || 'sale';
        payload.rooms = Number(form.rooms) || 0;
        payload.size = Number(form.size) || 0;
      }
      await fn(payload);
      showToast?.('✅ آگهی ثبت شد');
      setShowForm(false);
      setForm(emptyForm);
      // بعد از ثبت، فیلترها رو پاک کن تا آگهی جدید دیده شود
      setSubCat('');
      setCityFilter('');
      setSearch('');
      // کمی صبر بعد reload
      setTimeout(() => load(), 300);
    } catch (e: any) {
      console.log('createPublicAd error:', e);
      showToast?.('❌ ' + (e?.message || 'خطا در ثبت آگهی'), true);
    }
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

  const openChat = (ad: any) => {
    const peerEmail = ad.user_email;
    const peerName = ad.user_name || peerEmail?.split('@')[0] || '—';
    setChatRoom({ id: 'ad_' + ad.id, type: 'public_ad' });
    setChatPeer({ email: peerEmail, name: peerName, adId: ad.id, adTitle: ad.title });
    setChatInput('');
    setChatMessages([]);
    setChatModal(true);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !chatRoom || !chatPeer) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatSending(true);
    try {
      const m = await import('./lib.network');
      await (m as any).sendMessage(chatRoom.id, chatPeer.email, text);
      const msgs = await (m as any).fetchMessages(chatRoom.id);
      setChatMessages(msgs || []);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
    setChatSending(false);
  };

  return (
    <View style={st.root}>

      {/* هدر */}
      <View style={st.header}>
        <View style={st.headerTop}>
          {onBack ? (
            <TouchableOpacity accessibilityLabel="بازگشت" onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
              <Text style={st.backBtnTxt}>‹ بازگشت</Text>
            </TouchableOpacity>
          ) : <View style={st.backBtn} />}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={st.brandTitle}>🏛️ بازار عمومی</Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            <TouchableOpacity onPress={() => setNotifModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {unreadCount > 0 ? (
                <View style={st.badge}>
                  <Text style={st.badgeTxt}>{unreadCount > 9 ? '۹+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsModal(true)} style={st.settingsBtn} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={st.searchWrap}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput accessibilityLabel="جستجو..."
            style={st.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="جستجو..."
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      {/* تب‌های اصلی */}
      <View style={st.mainTabs}>
        {SUBS.map(x => (
          <TouchableOpacity
            key={x.k}
            onPress={() => { setSub(x.k); setSubCat(''); }}
            style={[st.mainTab, sub === x.k && { backgroundColor: x.c, borderColor: x.c }]}
            activeOpacity={0.7}
          >
            <Text style={st.mainTabIcon}>{x.i}</Text>
            <Text style={[st.mainTabTxt, sub === x.k && { color: '#fff', fontWeight: 'bold' }]}>{x.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* chips زیردسته */}
      <View style={st.chipsWrapOuter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsWrap}>
          <TouchableOpacity accessibilityLabel="همه"
            onPress={() => setSubCat('')}
            style={[st.chip, !subCat && { backgroundColor: subColor, borderColor: subColor }]}
          >
            <Text style={[st.chipTxt, !subCat && { color: '#fff', fontWeight: 'bold' }]}>همه</Text>
          </TouchableOpacity>
          {cats.map(c => (
            <TouchableOpacity
              key={c.k}
              onPress={() => setSubCat(c.k)}
              style={[st.chip, subCat === c.k && { backgroundColor: subColor, borderColor: subColor }]}
            >
              <Text style={[st.chipTxt, subCat === c.k && { color: '#fff', fontWeight: 'bold' }]}>{c.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* لیست آگهی‌ها */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 10, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#d4af37" />}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator color="#d4af37" style={{ marginTop: 40 }} size="large" />
        ) : ads.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 60, marginBottom: 12 }}>📭</Text>
            <Text style={st.emptyTxt}>هنوز آگهی‌ای نیست</Text>
            <Text style={st.emptyHint}>اولین نفر باش — روی «+» بزن</Text>
          </View>
        ) : ads.map((a: any) => (
          <View key={a.id} style={st.card}>
            <View style={st.cardTop}>
              <Text style={st.cardTitle} numberOfLines={2}>{a.title}</Text>
              {a.user_email === userEmail ? (
                <TouchableOpacity onPress={() => del(a.id)} style={st.delBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 14 }}>🗑</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {a.description ? <Text style={st.cardDesc} numberOfLines={3}>{a.description}</Text> : null}
            <View style={st.cardMeta}>
              <Text style={st.cardPrice}>
                {a.price > 0 ? `💰 ${fmt(a.price)} ${a.currency}` : a.category === 'jobs' ? '💰 توافقی' : '—'}
              </Text>
              <Text style={st.cardCity}>📍 {CITIES[a.city] || a.city}</Text>
            </View>
            {a.job_type ? (
              <Text style={st.cardJobType}>
                {a.job_type === 'full-time' ? '🏷️ تمام‌وقت' : a.job_type === 'part-time' ? '🏷️ پاره‌وقت' : '🏷️ روزمزد'}
              </Text>
            ) : null}
            {a.phone ? <Text style={st.cardPhone}>📞 {a.phone}</Text> : null}
            <View style={st.cardBottom}>
              <Text style={st.cardBy}>👤 {a.user_name || a.user_email?.split('@')[0] || '—'}</Text>
              {a.user_email && a.user_email !== userEmail ? (
                <TouchableOpacity accessibilityLabel="چت" onPress={() => openChat(a)} style={[st.chatBtn, { backgroundColor: subColor }]}>
                  <Text style={st.chatBtnTxt}>💬 چت</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#64748b', fontSize: 11 }}>آگهی خودم</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={[st.fab, { backgroundColor: subColor }]} onPress={() => setShowForm(true)} activeOpacity={0.85}>
        <Text style={st.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* مودال ثبت */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: subColor }]}>
            <Text style={st.mTitle}>➕ آگهی جدید در «{SUBS.find(x => x.k === sub)?.l}»</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

            <Text style={st.lbl}>دسته‌بندی *</Text>
            <View style={st.formChips}>
              {cats.map(c => (
                <TouchableOpacity
                  key={c.k}
                  onPress={() => setForm({ ...form, subcategory: c.k })}
                  style={[st.chip, form.subcategory === c.k && { backgroundColor: subColor, borderColor: subColor }]}
                >
                  <Text style={[st.chipTxt, form.subcategory === c.k && { color: '#fff', fontWeight: 'bold' }]}>{c.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={st.lbl}>عنوان *</Text>
            <TextInput accessibilityLabel="مثلاً: بنا با تجربه ۵ سال" style={st.inp} value={form.title} onChangeText={(v: string) => setForm({ ...form, title: v })} placeholder="مثلاً: بنا با تجربه ۵ سال" placeholderTextColor="#94a3b8" />

            <Text style={st.lbl}>شهر *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.formChips}>
              {CITY_KEYS.map(c => (
                <TouchableOpacity key={c} onPress={() => setForm({ ...form, city: c })} style={[st.chip, form.city === c && { backgroundColor: subColor, borderColor: subColor }]}>
                  <Text style={[st.chipTxt, form.city === c && { color: '#fff', fontWeight: 'bold' }]}>{CITIES[c]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {sub === 'jobs' && (
              <>
                <Text style={st.lbl}>نوع همکاری</Text>
                <View style={st.formChips}>
                  {[{ k: 'full-time', l: 'تمام‌وقت' }, { k: 'part-time', l: 'پاره‌وقت' }, { k: 'daily', l: 'روزمزد' }].map(t => (
                    <TouchableOpacity key={t.k} onPress={() => setForm({ ...form, job_type: t.k })} style={[st.chip, form.job_type === t.k && { backgroundColor: subColor, borderColor: subColor }]}>
                      <Text style={[st.chipTxt, form.job_type === t.k && { color: '#fff', fontWeight: 'bold' }]}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {sub === 'goods' && (
              <>
                <Text style={st.lbl}>وضعیت</Text>
                <View style={st.formChips}>
                  {[{ k: 'new', l: 'نو' }, { k: 'used', l: 'دست‌دوم' }].map(t => (
                    <TouchableOpacity key={t.k} onPress={() => setForm({ ...form, condition: t.k })} style={[st.chip, form.condition === t.k && { backgroundColor: subColor, borderColor: subColor }]}>
                      <Text style={[st.chipTxt, form.condition === t.k && { color: '#fff', fontWeight: 'bold' }]}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {sub === 'property' && (
              <>
                <Text style={st.lbl}>نوع معامله</Text>
                <View style={st.formChips}>
                  {PROPERTY_DEALS.map(t => (
                    <TouchableOpacity key={t.k} onPress={() => setForm({ ...form, deal_type: t.k })} style={[st.chip, form.deal_type === t.k && { backgroundColor: subColor, borderColor: subColor }]}>
                      <Text style={[st.chipTxt, form.deal_type === t.k && { color: '#fff', fontWeight: 'bold' }]}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.lbl}>تعداد اتاق</Text>
                    <TextInput style={st.inp} value={String(form.rooms || '')} onChangeText={(v: string) => setForm({ ...form, rooms: v.replace(/[^0-9]/g, '') })} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.lbl}>متراژ (متر)</Text>
                    <TextInput style={st.inp} value={String(form.size || '')} onChangeText={(v: string) => setForm({ ...form, size: v.replace(/[^0-9]/g, '') })} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
                  </View>
                </View>
              </>
            )}

            <Text style={st.lbl}>{sub === 'property' ? (form.deal_type === 'rent' ? 'اجاره ماهانه' : 'قیمت فروش') : 'قیمت'}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <TextInput style={[st.inp, { flex: 2, marginBottom: 0 }]} value={String(form.price || '')} onChangeText={(v: string) => setForm({ ...form, price: v.replace(/[^0-9]/g, '') })} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
              <TouchableOpacity onPress={() => setForm({ ...form, currency: form.currency === 'AFN' ? 'USD' : 'AFN' })} style={[st.inp, { flex: 1, marginBottom: 0, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{form.currency === 'AFN' ? 'افغانی' : 'دالر'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={st.lbl}>شماره تماس</Text>
            <TextInput accessibilityLabel="07..." style={st.inp} value={form.phone} onChangeText={(v: string) => setForm({ ...form, phone: v.replace(/[^0-9]/g, '') })} keyboardType="phone-pad" placeholder="07..." placeholderTextColor="#94a3b8" />

            <Text style={st.lbl}>توضیحات</Text>
            <TextInput accessibilityLabel="جزئیات..." style={[st.inp, { minHeight: 80, textAlignVertical: 'top' }]} value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} multiline placeholder="جزئیات..." placeholderTextColor="#94a3b8" />

            <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 18 }}>
              <TouchableOpacity accessibilityLabel="انصراف" style={[st.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setShowForm(false)}>
                <Text style={st.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btn, { backgroundColor: subColor, flex: 2 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>💾 ثبت آگهی</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

                  {/* ═══ 🔔 مودال اعلان‌ها ═══ */}
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={() => setNotifModal(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: '#f59e0b' }]}>
            <Text style={st.mTitle}>🔔 اعلان‌ها ({notifList.length})</Text>
            <TouchableOpacity onPress={() => setNotifModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 12, maxHeight: 480 }}>
            {notifList.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Text style={{ fontSize: 50, marginBottom: 10 }}>📭</Text>
                <Text style={{ color: '#94a3b8', fontSize: 14 }}>هنوز اعلانی نیست</Text>
                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>وقتی کسی به آگهی‌ات پیام بدهد، اینجا می‌بینی</Text>
              </View>
            ) : notifList.map((m: any, i: number) => {
              const sender = m.from_name || m.from_email?.split('@')[0] || 'کسی';
              const peerEmail = m.from_email;
              const adId = (m.room_id || '').replace('ad_', '');
              return (
                <TouchableOpacity
                  key={m.id || i}
                  onPress={() => {
                    setNotifModal(false);
                    // باز کردن چت
                    setChatRoom({ id: m.room_id, type: 'public_ad' });
                    setChatPeer({ email: peerEmail, name: sender, adId: adId, adTitle: '' });
                    setChatInput('');
                    setChatMessages([]);
                    setChatModal(true);
                  }}
                  style={st.notifRow}
                  activeOpacity={0.7}
                >
                  <View style={[st.notifIcon, { backgroundColor: subColor + '20' }]}>
                    <Text style={{ fontSize: 20 }}>💬</Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={st.notifTitle}>💬 {sender}</Text>
                    <Text style={st.notifText} numberOfLines={2}>{m.text || '...'}</Text>
                    <Text style={st.notifTime}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                  {!m.is_read ? <View style={st.notifDot} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View></View>
      </Modal>

      {/* ═══ ⚙️ مودال تنظیمات بازار ═══ */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={st.mBg}><View style={st.mBox}>
          <View style={[st.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={st.mTitle}>⚙️ تنظیمات بازار عمومی</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>

            <Text style={st.settingsSection}>🔔 صدا و هشدار</Text>
            {[
              { k: 'm_sound',   l: '🔊 صدا هنگام اعلان' },
              { k: 'm_vibrate', l: '📳 لرزش گوشی' },
              { k: 'm_browser', l: '💬 نوتیف مرورگر' },
            ].map((x: any) => (
              <View key={x.k} style={st.settingsRow}>
                <Text style={st.settingsLabel}>{x.l}</Text>
                <Switch
                  value={marketPrefs[x.k] !== false}
                  onValueChange={(v: boolean) => setMarketPrefs({ ...marketPrefs, [x.k]: v })}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            <Text style={st.settingsSection}>📢 اعلان‌های بازار</Text>
            {[
              { k: 'm_new_ad_city', l: '🆕 آگهی جدید در شهر من' },
              { k: 'm_new_ad_cat',  l: '🏷️ آگهی جدید در دسته‌های من' },
              { k: 'm_chat_msg',    l: '💬 پیام جدید در چت آگهی من' },
              { k: 'm_saved_ad',    l: '⭐ ذخیره آگهی من' },
            ].map((x: any) => (
              <View key={x.k} style={st.settingsRow}>
                <Text style={st.settingsLabel}>{x.l}</Text>
                <Switch
                  value={marketPrefs[x.k] !== false}
                  onValueChange={(v: boolean) => setMarketPrefs({ ...marketPrefs, [x.k]: v })}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            <Text style={st.settingsSection}>🏙️ شهرهای مورد علاقه</Text>
            <View style={st.settingsChipsWrap}>
              {CITY_KEYS.map(c => {
                const on = favCities.includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setFavCities(on ? favCities.filter(x => x !== c) : [...favCities, c])}
                    style={[st.chip, on && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                  >
                    <Text style={[st.chipTxt, on && { color: '#fff', fontWeight: 'bold' }]}>{CITIES[c]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.settingsSection}>🏷️ دسته‌های مورد علاقه</Text>
            <View style={st.settingsChipsWrap}>
              {SUBS.map(x => {
                const on = favCats.includes(x.k);
                return (
                  <TouchableOpacity
                    key={x.k}
                    onPress={() => setFavCats(on ? favCats.filter(y => y !== x.k) : [...favCats, x.k])}
                    style={[st.chip, on && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
                  >
                    <Text style={[st.chipTxt, on && { color: '#fff', fontWeight: 'bold' }]}>{x.i} {x.l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity accessibilityLabel="ذخیره تنظیمات"
              onPress={() => { saveMarketPrefs(); showToast?.('✅ ذخیره شد'); setSettingsModal(false); }}
              style={[st.btn, { backgroundColor: '#059669', marginTop: 18 }]}
            >
              <Text style={st.btnTxt}>💾 ذخیره تنظیمات</Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityLabel="تست صدا و لرزش"
              onPress={async () => {
                try {
                  const nt = await import('./lib.notifications');
                  (nt as any).playNotifSound?.();
                  (nt as any).vibrateNotif?.();
                  showToast?.('🔔 صدا + لرزش');
                } catch (e) { showToast?.('❌ خطا', true); }
              }}
              style={[st.btn, { backgroundColor: '#0ea5e9', marginTop: 8 }]}
            >
              <Text style={st.btnTxt}>🔔 تست صدا و لرزش</Text>
            </TouchableOpacity>

          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال چت */}
      <Modal visible={chatModal} transparent animationType="slide" onRequestClose={() => setChatModal(false)}>
        <View style={st.mBg}><View style={[st.mBox, { maxHeight: '92%' }]}>
          <View style={[st.mHead, { backgroundColor: '#0891b2' }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.mTitle}>💬 چت با {chatPeer?.name || '—'}</Text>
              {chatPeer?.adTitle ? <Text style={{ color: '#a5f3fc', fontSize: 10, textAlign: 'right' }} numberOfLines={1}>📋 {chatPeer.adTitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setChatModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#fff', fontSize: 26 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 14, maxHeight: 400, backgroundColor: '#0a1628' }}>
            {chatMessages.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>هنوز پیامی نیست — شما شروع کنید</Text>
            ) : chatMessages.map((m: any, i: number) => {
              const mine = m.from_email === userEmail;
              return (
                <View key={m.id || i} style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  backgroundColor: mine ? '#0891b2' : '#1e293b',
                  padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%',
                }}>
                  {!mine ? <Text style={{ color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 }}>{m.from_name || m.from_email?.split('@')[0]}</Text> : null}
                  <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right', lineHeight: 19 }}>{m.text}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, textAlign: 'right', marginTop: 3 }}>
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row-reverse', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
            <TextInput accessibilityLabel="پیام..."
              style={[st.inp, { flex: 1, marginBottom: 0 }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="پیام..."
              placeholderTextColor="#94a3b8"
              onSubmitEditing={sendChat}
            />
            <TouchableOpacity style={[st.btn, { backgroundColor: '#0891b2', paddingHorizontal: 18 }]} onPress={sendChat} disabled={chatSending}>
              {chatSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnTxt}>📤</Text>}
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628' },
  header: { backgroundColor: '#0f2438', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerTop: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  backBtn: { width: 90, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  backBtnTxt: { color: '#d4af37', fontSize: 14, fontWeight: 'bold' },
  brandTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center' },
  searchWrap: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0a1628', borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#334155' },
  searchIcon: { fontSize: 15, marginLeft: 8, color: '#94a3b8' },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, textAlign: 'right', paddingVertical: 0 },
  mainTabs: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingHorizontal: 8, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  mainTab: { flex: 1, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#334155', backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center', gap: 2 },
  mainTabIcon: { fontSize: 18 },
  mainTabTxt: { color: '#94a3b8', fontSize: 10.5, fontWeight: '600' },
  chipsWrapOuter: { height: 44, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  chipsWrap: { paddingHorizontal: 10, paddingVertical: 7, gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 14, height: 30, borderRadius: 15, backgroundColor: '#0a1628', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  chipTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', padding: 60 },
  emptyTxt: { color: '#cbd5e1', fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  emptyHint: { color: '#64748b', fontSize: 11 },
  card: { backgroundColor: '#0f2438', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8, lineHeight: 21 },
  delBtn: { backgroundColor: 'rgba(220,38,38,0.15)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  cardDesc: { color: '#94a3b8', fontSize: 12.5, textAlign: 'right', lineHeight: 19, marginBottom: 10 },
  cardMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardPrice: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  cardCity: { color: '#94a3b8', fontSize: 11.5 },
  cardJobType: { color: '#a78bfa', fontSize: 11.5, textAlign: 'right', marginBottom: 4 },
  cardPhone: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
  cardBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1e293b' },
  cardBy: { color: '#64748b', fontSize: 11 },
  chatBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  chatBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 22, right: 18, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 34, marginTop: -2 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 12 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 16, maxHeight: '92%', overflow: 'hidden' },
  mHead: { padding: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  lbl: { color: '#cbd5e1', fontSize: 12.5, marginTop: 14, marginBottom: 6, textAlign: 'right', fontWeight: 'bold' },
  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 1.5, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13.5, textAlign: 'right', marginBottom: 4 },
  formChips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  btn: { padding: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13.5, fontWeight: 'bold' },
});