// PublicMarketScreen.tsx — بازار عمومی (نمای دو حالته: دسته‌ها + لیست)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

const CITIES: Record<string, string> = {
  KBL: 'کابل', HRT: 'هرات', MZR: 'مزار', KDH: 'کندز', JAL: 'جلال‌آباد',
  KDR: 'کندهار', GHA: 'غزنی', BAM: 'بامیان', TAK: 'تخار', BAD: 'بدخشان',
};
const CITY_KEYS = Object.keys(CITIES);

type Sub = 'jobs' | 'goods' | 'services' | 'property';
type ViewMode = 'categories' | 'list';

const SUBS: { k: Sub; l: string; i: string; c: string }[] = [
  { k: 'jobs',     l: 'استخدام',     i: '💼', c: '#0891b2' },
  { k: 'goods',    l: 'خرید و فروش', i: '🛍️', c: '#7c3aed' },
  { k: 'services', l: 'خدمات',       i: '🛠️', c: '#059669' },
  { k: 'property', l: 'املاک',       i: '🏠', c: '#f59e0b' },
];

const JOB_CATS = [
  { k: 'construction', l: 'ساختمانی',    i: '🏗️' },
  { k: 'transport',    l: 'حمل و نقل',   i: '🚗' },
  { k: 'sales',        l: 'فروش',        i: '🛒' },
  { k: 'restaurant',   l: 'رستوران',     i: '🍽️' },
  { k: 'office',       l: 'اداری',       i: '💼' },
  { k: 'it',           l: 'کامپیوتر',    i: '💻' },
  { k: 'teaching',     l: 'آموزش',       i: '📚' },
  { k: 'health',       l: 'صحت',         i: '🩺' },
  { k: 'clean',        l: 'نظافت',       i: '🧹' },
  { k: 'beauty',       l: 'زیبایی',      i: '✂️' },
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
  { k: 'teach',     l: 'آموزش',        i: '📚' },
  { k: 'beauty',    l: 'زیبایی',        i: '💅' },
  { k: 'clean',     l: 'نظافت',         i: '🧹' },
];

export default function PublicMarketScreen({ showToast, userEmail }: any) {
  const [sub, setSub] = useState<Sub>('jobs');
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [subCat, setSubCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // چت
  const [chatModal, setChatModal] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [chatPeer, setChatPeer] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [form, setForm] = useState<any>({
    title: '', description: '', price: '', currency: 'AFN',
    city: 'KBL', condition: 'new', phone: '',
    subcategory: '', job_type: 'full-time',
  });

  // ═══ LOAD ═══
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

  // ═══ CHAT LISTENER ═══
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

  // ═══ NAVIGATION ═══
  const openCategoryView = (catKey: string) => {
    setSubCat(catKey);
    setViewMode('list');
  };

  const backToCategories = () => {
    setViewMode('categories');
    setSubCat('');
    setSearch('');
    setCityFilter('');
  };

  // ═══ SUBMIT AD ═══
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

  // ═══ DELETE AD ═══
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

  // ═══ CHAT OPEN ═══
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

  const cats = sub === 'jobs' ? JOB_CATS : sub === 'goods' ? GOODS_CATS : sub === 'services' ? SERVICE_CATS : [];
  const subColor = SUBS.find(x => x.k === sub)?.c || '#0891b2';

  // ═══════════════════════════════════════════
  //  MODALS (مشترک بین دو نما)
  // ═══════════════════════════════════════════
  const renderModals = () => (
    <>
      {/* ═══ مودال فرم ثبت ═══ */}
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

      {/* ═══ مودال چت ═══ */}
      <Modal visible={chatModal} transparent animationType="slide" onRequestClose={() => setChatModal(false)}>
        <View style={st.mBg}><View style={[st.mBox, { maxHeight: '92%' }]}>
          <View style={[st.mHead, { backgroundColor: '#0891b2' }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.mTitle}>💬 چت با {chatPeer?.name || '—'}</Text>
              {chatPeer?.adTitle ? <Text style={{ color: '#a5f3fc', fontSize: 10, textAlign: 'right' }} numberOfLines={1}>📋 {chatPeer.adTitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setChatModal(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 14, maxHeight: 380, backgroundColor: '#0a1628' }}>
            {chatMessages.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>هنوز پیامی نیست — شما شروع کنید</Text>
            ) : chatMessages.map((m: any, i: number) => {
              const mine = m.from_email === userEmail;
              return (
                <View key={m.id || i} style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  backgroundColor: mine ? '#0891b2' : '#1e293b',
                  padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '80%',
                }}>
                  {!mine ? <Text style={{ color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>{m.from_name || m.from_email?.split('@')[0]}</Text> : null}
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
              style={[st.inp, { flex: 1 }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="پیام خود را بنویسید..."
              placeholderTextColor="#94a3b8"
              onSubmitEditing={sendChat}
            />
            <TouchableOpacity
              style={[st.btn, { backgroundColor: '#0891b2', paddingHorizontal: 20 }]}
              onPress={sendChat}
              disabled={chatSending}
            >
              {chatSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnTxt}>📤 ارسال</Text>}
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </>
  );

  // ═══════════════════════════════════════════
  //  نمای لیست آگهی‌ها (تمام‌صفحه)
  // ═══════════════════════════════════════════
  if (viewMode === 'list') {
    const catInfo = subCat ? cats.find(c => c.k === subCat) : null;
    const headerTitle = catInfo ? `${catInfo.i} ${catInfo.l}` : `${SUBS.find(x => x.k === sub)?.i} همه آگهی‌ها`;
    return (
      <View style={st.root}>
        {/* Header با دکمه برگشت */}
        <View style={[st.head, { backgroundColor: subColor, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }]}>
          <TouchableOpacity onPress={backToCategories} style={st.backBtn}>
            <Text style={st.backBtnTxt}>← برگشت</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[st.headTitle, { fontSize: 16 }]} numberOfLines={1}>{headerTitle}</Text>
            <Text style={st.headSub}>{ads.length} آگهی</Text>
          </View>
        </View>

        {/* Search */}
        <TextInput
          style={st.search}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 جستجو در این دسته..."
          placeholderTextColor="#94a3b8"
        />

        {/* City filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
          <TouchableOpacity onPress={() => setCityFilter('')} style={[st.chip, !cityFilter && st.chipActive]}>
            <Text style={[st.chipTxt, !cityFilter && { color: '#fff' }]}>همه شهرها</Text>
          </TouchableOpacity>
          {CITY_KEYS.map(c => (
            <TouchableOpacity key={c} onPress={() => setCityFilter(c)} style={[st.chip, cityFilter === c && st.chipActive]}>
              <Text style={[st.chipTxt, cityFilter === c && { color: '#fff' }]}>{CITIES[c]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* لیست تمام‌صفحه */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#d4af37" />}
        >
          {loading ? (
            <ActivityIndicator color="#d4af37" style={{ marginTop: 60 }} />
          ) : ads.length === 0 ? (
            <View style={st.empty}>
              <Text style={{ fontSize: 60, marginBottom: 10 }}>📭</Text>
              <Text style={st.emptyTxt}>هنوز آگهی‌ای در این دسته نیست</Text>
              <Text style={st.emptyHint}>اولین نفر باش — روی «➕ ثبت» بزن</Text>
            </View>
          ) : ads.map((a: any) => (
            <View key={a.id} style={[st.card, { borderRightColor: subColor }]}>
              <View style={st.cardTop}>
                <Text style={st.cardTitle} numberOfLines={2}>{a.title}</Text>
                {a.user_email === userEmail ? (
                  <TouchableOpacity onPress={() => del(a.id)}>
                    <Text style={{ fontSize: 18 }}>🗑</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {a.description ? <Text style={st.cardDesc} numberOfLines={4}>{a.description}</Text> : null}
              {a.price > 0 ? (
                <Text style={st.cardPrice}>💰 {fmt(a.price)} {a.currency}</Text>
              ) : a.category === 'jobs' ? (
                <Text style={st.cardPrice}>💰 توافقی</Text>
              ) : null}
              {a.job_type ? (
                <Text style={st.cardJobType}>🏷️ {a.job_type === 'full-time' ? 'تمام‌وقت' : a.job_type === 'part-time' ? 'پاره‌وقت' : 'روزمزد'}</Text>
              ) : null}
              <View style={st.cardFoot}>
                <Text style={st.cardCity}>📍 {CITIES[a.city] || a.city}</Text>
                {a.phone ? <Text style={st.cardPhone}>📞 {a.phone}</Text> : null}
              </View>
              <Text style={st.cardBy}>👤 {a.user_name || a.user_email?.split('@')[0] || '—'}</Text>
              {a.user_email && a.user_email !== userEmail ? (
                <TouchableOpacity
                  onPress={() => openChat(a)}
                  style={[st.chatBtn, { backgroundColor: subColor }]}
                >
                  <Text style={st.chatBtnTxt}>💬 چت با فروشنده</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity style={[st.fab, { backgroundColor: subColor }]} onPress={() => setShowForm(true)}>
          <Text style={st.fabTxt}>➕</Text>
          <Text style={st.fabLbl}>ثبت آگهی</Text>
        </TouchableOpacity>

        {renderModals()}
      </View>
    );
  }

  // ═══════════════════════════════════════════
  //  نمای کارت‌های دسته (صفحه اصلی)
  // ═══════════════════════════════════════════
  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.head}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#d4af37' + '20', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 22 }}>🏛️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.headTitle}>بازار عمومی</Text>
            <Text style={st.headSub}>دسته مورد نظر را انتخاب کنید</Text>
          </View>
        </View>
      </View>

      {/* Sub tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsRow}>
        {SUBS.map(x => (
          <TouchableOpacity
            key={x.k}
            onPress={() => { setSub(x.k); setSubCat(''); setViewMode('categories'); }}
            style={[st.subTab, sub === x.k && { backgroundColor: x.c, borderColor: x.c }]}
          >
            <Text style={[st.subTabTxt, sub === x.k && { color: '#fff', fontWeight: 'bold' }]}>{x.i} {x.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* کارت‌های دسته */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
        {sub === 'property' ? (
          <View style={{ alignItems: 'center', padding: 60 }}>
            <Text style={{ fontSize: 60, marginBottom: 12 }}>🏠</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>بخش املاک به‌زودی</Text>
          </View>
        ) : cats.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 60 }}>
            <Text style={{ fontSize: 60, marginBottom: 12 }}>📭</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>دسته‌ای نیست</Text>
          </View>
        ) : (
          <>
            {cats.map(c => {
              const catCount = ads.filter((a: any) => a.subcategory === c.k).length;
              return (
                <TouchableOpacity
                  key={c.k}
                  onPress={() => openCategoryView(c.k)}
                  style={[st.bigCard, { borderRightColor: subColor }]}
                  activeOpacity={0.7}
                >
                  <View style={[st.bigCardIconBox, { backgroundColor: subColor + '20' }]}>
                    <Text style={st.bigCardIcon}>{c.i}</Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={st.bigCardTitle}>{c.l}</Text>
                    <Text style={st.bigCardSub}>{catCount} آگهی فعال</Text>
                  </View>
                  <View style={[st.bigCardArrowBox, { backgroundColor: subColor + '20' }]}>
                    <Text style={[st.bigCardArrow, { color: subColor }]}>‹</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* کارت «همه آگهی‌ها» */}
            <TouchableOpacity
              onPress={() => openCategoryView('')}
              style={[st.bigCard, { borderRightColor: '#d4af37', marginTop: 12 }]}
              activeOpacity={0.7}
            >
              <Text style={st.bigCardIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={[st.bigCardTitle, { color: '#d4af37' }]}>همه آگهی‌ها</Text>
                <Text style={st.bigCardSub}>{ads.length} آگهی</Text>
              </View>
              <Text style={[st.bigCardArrow, { color: '#d4af37' }]}>‹</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[st.fab, { backgroundColor: subColor }]} onPress={() => setShowForm(true)}>
        <Text style={st.fabTxt}>➕</Text>
        <Text style={st.fabLbl}>ثبت آگهی</Text>
      </TouchableOpacity>

      {renderModals()}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628' },
  head: { backgroundColor: '#0f2438', padding: 16, paddingTop: 18, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  headTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  headSub: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 4 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  backBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  tabsRow: { padding: 8, gap: 6, flexDirection: 'row-reverse' },
  subTab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: '#0f2438', borderWidth: 1.5, borderColor: '#334155', minWidth: 100, alignItems: 'center' },
  subTabTxt: { color: '#94a3b8', fontSize: 12.5, fontWeight: '600' },
  search: { backgroundColor: '#0f2438', color: '#fff', margin: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155', textAlign: 'right' },
  chipsRow: { paddingHorizontal: 8, paddingVertical: 4, gap: 6, flexDirection: 'row-reverse' },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#0f2438', borderWidth: 1.5, borderColor: '#334155' },
  chipActive: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  chipTxt: { color: '#94a3b8', fontSize: 11 },
  empty: { alignItems: 'center', padding: 60 },
  emptyTxt: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  emptyHint: { color: '#64748b', fontSize: 11 },
  // کارت بزرگ دسته
  bigCard: { 
    backgroundColor: '#0f2438', 
    padding: 14, 
    borderRadius: 14, 
    marginBottom: 10, 
    borderRightWidth: 4, 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    gap: 10, 
    minHeight: 82,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bigCardIconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  bigCardIcon: { fontSize: 26 },
  bigCardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  bigCardSub: { color: '#94a3b8', fontSize: 11, textAlign: 'right', marginTop: 4 },
  bigCardArrowBox: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  bigCardArrow: { fontSize: 22, fontWeight: 'bold', lineHeight: 24 },
  // کارت آگهی
  card: { 
    backgroundColor: '#0f2438', 
    padding: 14, 
    borderRadius: 12, 
    marginBottom: 10, 
    borderRightWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'right', marginRight: 8 },
  cardDesc: { color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'right', lineHeight: 20 },
  cardPrice: { color: '#10b981', fontSize: 14, fontWeight: 'bold', marginTop: 8, textAlign: 'right' },
  cardJobType: { color: '#a78bfa', fontSize: 11, marginTop: 4, textAlign: 'right' },
  cardFoot: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  cardCity: { color: '#94a3b8', fontSize: 11 },
  cardPhone: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold' },
  cardBy: { color: '#64748b', fontSize: 10, marginTop: 6, textAlign: 'right' },
  chatBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  chatBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 24, right: 20, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabTxt: { fontSize: 20 },
  fabLbl: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 12 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '92%', overflow: 'hidden' },
  mHead: { padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  lbl: { color: '#94a3b8', fontSize: 11, marginTop: 10, marginBottom: 4, textAlign: 'right', fontWeight: 'bold' },
  inp: { backgroundColor: '#0a1628', color: '#fff', borderWidth: 1.5, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 13, textAlign: 'right', marginBottom: 4 },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
