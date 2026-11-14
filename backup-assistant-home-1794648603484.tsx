import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { getProducts } from './lib.offline';
import { processRubikaUpdatesSimple } from './lib.assistant.bot.simple';
import { rubikaSendMessage, buildChannelPostText, rubikaSendPhoto, resetBotOffset, rubikaRemoveWebhook, forceFixBot, getBotLastError } from './lib.assistant.rubika';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from './lib.storage';
import {
  getBotConfig, getWatcherConfig, getWatcherSources, getAdsConfig,
  getOrders, getRateSnapshots, getRateSummary, getAdsQueue, getAdsHistory,
  getAssistantInvoices, approveAssistantInvoice, deleteAssistantInvoice, transferAssistantInvoice, issueAssistantInvoice,
} from './lib.assistant';

const AUDIT_KEY = '@mizan_audit_events';

export default function AssistantHome({ showToast }: any) {
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('dashboard');

  const [bot, setBot] = useState<any>({});
  const [watcher, setWatcher] = useState<any>({});
  const [sources, setSources] = useState<any[]>([]);
  const [ads, setAds] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [assistantInvoices, setAssistantInvoices] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [rateSummary, setRateSummary] = useState<any>({});
  const [adsQueue, setAdsQueue] = useState<any[]>([]);
  const [adsHistory, setAdsHistory] = useState<any[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productQty, setProductQty] = useState('');
  const [productColor, setProductColor] = useState('');
  const [productMaterial, setProductMaterial] = useState('');
  const [productSize, setProductSize] = useState('');
  const [productNote, setProductNote] = useState('');
  const [productImageUris, setProductImageUris] = useState<string[]>([]);
  const [productSending, setProductSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, w, s, a, o, r, rs, q, h] = await Promise.all([
          getBotConfig(), getWatcherConfig(), getWatcherSources(), getAdsConfig(),
          getAssistantInvoices(), getRateSnapshots(), getRateSummary(), getAdsQueue(), getAdsHistory(),
        ]);
        setBot(b || {});
        setWatcher(w || {});
        setSources(Array.isArray(s) ? s : []);
        setAds(a || {});
        setAssistantInvoices(Array.isArray(o) ? o : []);
        setSnapshots(Array.isArray(r) ? r : []);
        setRateSummary(rs || {});
        setAdsQueue(Array.isArray(q) ? q : []);
        setAdsHistory(Array.isArray(h) ? h : []);
        const au = await AsyncStorage.getItem(AUDIT_KEY);
        if (au) { const arr = JSON.parse(au); setAuditCount(Array.isArray(arr) ? arr.length : 0); }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const addTestInvoice = async () => {
    try {
      const inv = await issueAssistantInvoice({
        platform: 'test',
        invoice_number: '',
        customer_name: 'مشتری آزمایشی',
        phone: '0700000000',
        address: 'آدرس آزمایشی',
        shipping: 'باربری آزمایشی',
        items: [
          { code: 'TEST-001', name: 'کالای آزمایشی', color: 'مشکی', qty_pairs: 1, qty_cartons: 1, price_unit: 1000, shelf: 'A1' },
        ],
        total: 1000,
        paid: 0,
      });
      setAssistantInvoices(await getAssistantInvoices());
      showToast?.('🧪 فاکتور آزمایشی ثبت شد — ' + (inv?.id || ''));
    } catch (e: any) {
      showToast?.(e?.message || 'خطا در ثبت آزمایشی', true);
    }
  };

  const PRODUCT_POST_QUEUE = '@mizan_product_post_queue';

  const enqueueProductPost = async (payload: any) => {
    try {
      const raw = await AsyncStorage.getItem(PRODUCT_POST_QUEUE);
      let arr: any[] = [];
      try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.push({ id: 'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), payload, at: new Date().toISOString() });
      await AsyncStorage.setItem(PRODUCT_POST_QUEUE, JSON.stringify(arr));
    } catch {}
  };

  const flushProductPostQueue = async () => {
    try {
      if (!bot.rubika_token || !bot.rubika_channel_id) return 0;
      const raw = await AsyncStorage.getItem(PRODUCT_POST_QUEUE);
      let arr: any[] = [];
      try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
      if (!Array.isArray(arr) || !arr.length) return 0;
      const remaining: any[] = [];
      let sent = 0;
      for (const item of arr) {
        let ok = false;
        const imgs = item.imageUris || item.payload?.imageUris || [];
        if (imgs.length > 0) {
          ok = true;
          for (let i = 0; i < imgs.length; i++) {
            const r = await rubikaSendPhoto(bot.rubika_token, bot.rubika_channel_id, imgs[i], i === 0 ? item.payload.caption : '');
            if (!r.ok) { ok = false; break; }
          }
        } else {
          const r = await rubikaSendMessage(bot.rubika_token, bot.rubika_channel_id, item.payload.caption);
          ok = !!r.ok;
        }
        if (ok) sent++; else remaining.push(item);
      }
      await AsyncStorage.setItem(PRODUCT_POST_QUEUE, JSON.stringify(remaining));
      return sent;
    } catch { return 0; }
  };;

  const openProductModal = () => {
    setProductSearch('');
    setProductResults([]);
    setSelectedProduct(null);
    setProductQty('');
    setProductColor('');
    setProductMaterial('');
    setProductSize('');
    setProductNote('');
    setProductImageUris([]);
    setShowProductModal(true);
  };

  const pickProductImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showToast?.('اجازه دسترسی به گالری داده نشد', true); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });
      if (!res.canceled && res.assets && res.assets.length) {
        setProductImageUris(res.assets.map((a: any) => a.uri));
      }
    } catch (e: any) {
      showToast?.(e?.message || 'خطا در انتخاب عکس', true);
    }
  };

  const searchProductList = async (q: string) => {
    setProductSearch(q);
    if (!q || q.trim().length < 1) { setProductResults([]); return; }
    try {
      const list = await getProducts();
      const key = q.trim().toLowerCase();
      const filtered = (Array.isArray(list) ? list : []).filter((p: any) =>
        String(p.name || '').toLowerCase().includes(key) ||
        String(p.code || '').toLowerCase().includes(key)
      ).slice(0, 8);
      setProductResults(filtered);
    } catch {
      setProductResults([]);
    }
  };

  const selectProductItem = (p: any) => {
    setSelectedProduct(p);
    setProductResults([]);
    setProductSearch(p.name || p.code || '');
  };

  const sendProductPost = async () => {
    if (!selectedProduct) { showToast?.('اول یک محصول انتخاب کن', true); return; }
    setProductSending(true);
    try {
      const payload = {
        ...selectedProduct,
        name: selectedProduct.name,
        qty: productQty,
        color: productColor || selectedProduct.color || '',
        material: productMaterial,
        size: productSize,
        note: productNote,
        imageUris: productImageUris,
      };
      const caption = buildChannelPostText(payload, 'TamaddonBOT');

      if (bot.rubika_token && bot.rubika_channel_id) {
        let allOk = true;
        let errMsg = '';
        if (productImageUris.length > 0) {
          for (let i = 0; i < productImageUris.length; i++) {
            const r = await rubikaSendPhoto(bot.rubika_token, bot.rubika_channel_id, productImageUris[i], i === 0 ? caption : '');
            if (!r.ok) { allOk = false; errMsg = r.error || 'خطای ارسال عکس'; break; }
          }
        } else {
          const r = await rubikaSendMessage(bot.rubika_token, bot.rubika_channel_id, caption);
          if (!r.ok) { allOk = false; errMsg = r.error || 'خطای ارسال متن'; }
        }
        if (allOk) {
          showToast?.('✅ پست محصول به کانال ارسال شد');
          setShowProductModal(false);
          return;
        } else {
          // نمایش خطای دقیق به جای رفتن به صف
          showToast?.('❌ خطا: ' + errMsg, true);
          setProductSending(false);
          return; 
        }
      }

      await enqueueProductPost({ caption, product: payload, imageUris: productImageUris, createdAt: new Date().toISOString() });
      showToast?.('📥 پست در صف ذخیره شد و به‌محض آنلاین شدن ارسال می‌شود');
      setShowProductModal(false);
    } catch (e: any) {
      showToast?.(e?.message || 'خطای غیرمنتظره', true);
    } finally {
      setProductSending(false);
    }
  };;;;

  useEffect(() => {
    flushProductPostQueue();
    const t = setInterval(() => { flushProductPostQueue(); }, 30000);
    return () => clearInterval(t);
  }, [bot.rubika_token, bot.rubika_channel_id]);

  if (loading) return <ActivityIndicator color="#0ea5e9" style={{ marginTop: 20 }} />;

  const checkMessages = async () => {
    showToast?.('⏳ در حال بررسی پیام‌های جدید چت خصوصی...');
    const r = await processRubikaUpdatesSimple(bot.rubika_token);
    if (r.ok) {
      showToast?.('✅ ' + r.processed + ' پیام پردازش شد');
    } else {
      showToast?.('❌ ' + (r.error || 'خطا در دریافت'), true);
    }
  };


  const cardStyle = { padding: 14, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 12 };
  const titleStyle = { fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 };
  const rowStyle = { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 };
  const labelStyle = { fontSize: 11, color: '#64748b', textAlign: 'right' };
  const valueStyle = { fontSize: 11, fontWeight: 'bold', textAlign: 'left', color: '#0f2438' };
  const btnStyle = { marginTop: 10, padding: 8, borderRadius: 6, alignItems: 'center' };
  const tabBtn = (active) => ({ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: active ? '#7c3aed' : '#1e293b', alignItems: 'center' });

  const online = (v) => v ? '✅ فعال' : '❌ غیرفعال';
  const money = (n) => (Number(n) || 0).toLocaleString('en-US');
  const short = (s, n) => String(s || '').slice(0, n || 60);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0a1628' }} contentContainerStyle={{ padding: 12, paddingBottom: 120 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f4d47a', textAlign: 'right', marginBottom: 4 }}>🤝 دستیار میزان</Text>
      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginBottom: 12 }}>
        داشبورد سه دستیار. برای پیکربندی، از تنظیمات → دستیار میزان استفاده کنید.
      </Text>

      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setSection('dashboard')} style={tabBtn(section === 'dashboard')}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>📊 داشبورد</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSection('orders')} style={tabBtn(section === 'orders')}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>🛒 سفارش‌ها</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSection('rates')} style={tabBtn(section === 'rates')}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>📈 نرخ‌ها</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSection('ads')} style={tabBtn(section === 'ads')}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>📣 تبلیغات</Text>
        </TouchableOpacity>
      </View>

      {section === 'dashboard' && (
        <View>
          <View style={cardStyle}>
            <Text style={titleStyle}>🤝 دستیار فروش</Text>
            <View style={rowStyle}><Text style={labelStyle}>تلگرام</Text><Text style={valueStyle}>{online(bot.telegram_enabled)}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>روبیکا</Text><Text style={valueStyle}>{online(bot.rubika_enabled)}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>واتساپ</Text><Text style={valueStyle}>{online(bot.whatsapp_enabled)}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>فاکتورهای دستیار فروش</Text><Text style={valueStyle}>{assistantInvoices.length}</Text></View>
            <TouchableOpacity onPress={async () => { const n = await flushProductPostQueue(); showToast?.(n > 0 ? '✅ ' + n + ' پست از صف ارسال شد' : 'صف خالی است یا هنوز آفلاین هستی'); }} style={[btnStyle, { backgroundColor: '#0ea5e9' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>📤 ارسال صف پست‌ها</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { await resetBotOffset(); showToast?.('✅ offset ریست شد'); }} style={[btnStyle, { backgroundColor: '#ef4444' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔄 ریست ربات (اگر جواب نداد)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              if (!bot.rubika_token) return showToast?.('❌ توکن ربات خالی است', true);
              showToast?.('⏳ در حال حذف Webhook...');
              const r = await rubikaRemoveWebhook(bot.rubika_token);
              if (r.ok) showToast?.('✅ Webhook با موفقیت حذف شد. حالا ریست ربات را بزنید.');
              else showToast?.('❌ خطا: ' + r.error, true);
            }} style={[btnStyle, { backgroundColor: '#dc2626' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔗 حذف Webhook (برای فعال شدن ربات)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              if (!bot.rubika_token) return showToast?.('❌ توکن ربات خالی است', true);
              showToast?.('⏳ در حال تعمیر کامل ربات...');
              const r = await forceFixBot(bot.rubika_token);
              if (r.ok) showToast?.('✅ ربات با موفقیت تعمیر شد! حالا در چت خصوصی /start بفرستید.');
              else showToast?.('❌ خطا: ' + r.error, true);
            }} style={[btnStyle, { backgroundColor: '#dc2626', marginBottom: 8 }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔧 تعمیر کامل و راه‌اندازی ربات</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={async () => {
              const err = await getBotLastError();
              showToast?.('خطای آخر ربات: ' + err, true);
            }} style={[btnStyle, { backgroundColor: '#475569', marginBottom: 8 }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔍 مشاهده خطای آخر ربات</Text>
            </TouchableOpacity>
            
            
            
            
            
            <TouchableOpacity onPress={openProductModal} style={[btnStyle, { backgroundColor: '#f59e0b' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>📝 پست محصول جدید</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => showToast?.('از تنظیمات → دستیار میزان → دستیار فروش پیکربندی کنید')} style={[btnStyle, { backgroundColor: '#7c3aed' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>⚙️ تنظیمات دستیار فروش</Text>
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <Text style={titleStyle}>👁️ دستیار دیده‌بان</Text>
            <View style={rowStyle}><Text style={labelStyle}>وضعیت</Text><Text style={valueStyle}>{online(watcher.enabled)}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>دسترسی Accessibility</Text><Text style={valueStyle}>{watcher.accessibility_granted ? '✅ فعال' : '❌ غیرفعال'}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>کانال‌های مجاز</Text><Text style={valueStyle}>{sources.length}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>نرخ‌های ثبت‌شده</Text><Text style={valueStyle}>{snapshots.length}</Text></View>
            <TouchableOpacity onPress={() => showToast?.('از تنظیمات → دستیار میزان → دستیار دیده‌بان پیکربندی کنید')} style={[btnStyle, { backgroundColor: '#0ea5e9' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>⚙️ تنظیمات دستیار دیده‌بان</Text>
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <Text style={titleStyle}>📣 دستیار تبلیغات</Text>
            <View style={rowStyle}><Text style={labelStyle}>وضعیت</Text><Text style={valueStyle}>{online(ads.enabled)}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>کانال مقصد</Text><Text style={valueStyle}>{ads.channel_name || '—'}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>در صف</Text><Text style={valueStyle}>{adsQueue.length}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>ارسال‌شده</Text><Text style={valueStyle}>{adsHistory.length}</Text></View>
            <TouchableOpacity onPress={() => showToast?.('از تنظیمات → دستیار میزان → دستیار تبلیغات پیکربندی کنید')} style={[btnStyle, { backgroundColor: '#f59e0b' }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>⚙️ تنظیمات دستیار تبلیغات</Text>
            </TouchableOpacity>
          </View>

          <View style={cardStyle}>
            <Text style={titleStyle}>📊 خلاصه سریع</Text>
            <View style={rowStyle}><Text style={labelStyle}>رویدادهای تاریخچه</Text><Text style={valueStyle}>{auditCount}</Text></View>
            <View style={rowStyle}><Text style={labelStyle}>دستیارهای فعال</Text><Text style={valueStyle}>{(bot.telegram_enabled || bot.rubika_enabled || bot.whatsapp_enabled ? 1 : 0) + (watcher.enabled ? 1 : 0) + (ads.enabled ? 1 : 0)}</Text></View>
          </View>
        </View>
      )}

      {section === 'orders' && (
        <View>
          <Text style={titleStyle}>🛒 فاکتورهای دستیار فروش ({assistantInvoices.length})</Text>
          <TouchableOpacity onPress={addTestInvoice} style={{ backgroundColor: '#0ea5e9', padding: 8, borderRadius: 6, marginBottom: 10 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 11 }}>🧪 ثبت فاکتور آزمایشی</Text>
          </TouchableOpacity>
          {assistantInvoices.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>هیچ فاکتوری ثبت نشده.</Text>}
          {assistantInvoices.filter((x: any) => x.status !== 'transferred').slice().reverse().map((inv: any) => (
            <View key={inv.id} style={cardStyle}>
              <View style={rowStyle}><Text style={labelStyle}>شماره فاکتور</Text><Text style={valueStyle}>{inv.invoice_number || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>مشتری</Text><Text style={valueStyle}>{inv.customer_name || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>تلفن</Text><Text style={valueStyle}>{inv.phone || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>تعداد اقلام</Text><Text style={valueStyle}>{Array.isArray(inv.items) ? inv.items.length : 0}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>جمع کل</Text><Text style={valueStyle}>{money(inv.total)}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>پرداخت‌شده</Text><Text style={valueStyle}>{money(inv.paid)}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>وضعیت</Text><Text style={valueStyle}>{inv.status === 'issued' ? '📤 صادرشده' : inv.status === 'edited' ? '✏️ ویرایش‌شده' : inv.status === 'approved' ? '✅ تأییدشده' : inv.status === 'transferred' ? '📦 منتقل‌شده' : inv.status === 'rejected' ? '❌ ردشده' : inv.status}</Text></View>

              {inv.status !== 'transferred' && inv.status !== 'rejected' && (
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 10 }}>
                  {inv.status === 'approved' ? (
                    <TouchableOpacity onPress={async () => {
                      try {
                        await transferAssistantInvoice(inv.id);
                        setAssistantInvoices(await getAssistantInvoices());
                        showToast?.('📦 فاکتور به سیستم اصلی منتقل شد');
                      } catch (e: any) {
                        showToast?.(e?.message || 'خطا در انتقال', true);
                      }
                    }} style={{ flex: 2, backgroundColor: '#0ea5e9', padding: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 11 }}>📦 انتقال به سیستم اصلی</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={async () => {
                      await approveAssistantInvoice(inv.id);
                      setAssistantInvoices(await getAssistantInvoices());
                      showToast?.('✅ فاکتور تأیید شد');
                    }} style={{ flex: 1, backgroundColor: '#059669', padding: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 11 }}>✅ تأیید</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => showToast?.('✏️ ویرایش در فاز بعدی فعال می‌شود')} style={{ flex: 1, backgroundColor: '#7c3aed', padding: 8, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 11 }}>✏️ ویرایش</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                    await deleteAssistantInvoice(inv.id);
                    setAssistantInvoices(await getAssistantInvoices());
                    showToast?.('🗑 فاکتور حذف شد');
                  }} style={{ flex: 1, backgroundColor: '#dc2626', padding: 8, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 11 }}>🗑 حذف</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {section === 'rates' && (
        <View>
          <Text style={titleStyle}>📈 نرخ‌های تحلیل‌شده</Text>
          {Object.keys(rateSummary || {}).length > 0 && (
            <View style={cardStyle}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>خلاصه</Text>
              {Object.keys(rateSummary).slice(0, 10).map((k) => (
                <View key={k} style={rowStyle}>
                  <Text style={labelStyle}>{k}</Text>
                  <Text style={valueStyle}>{typeof rateSummary[k] === 'object' ? short(JSON.stringify(rateSummary[k]), 50) : String(rateSummary[k])}</Text>
                </View>
              ))}
            </View>
          )}
          {snapshots.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>هیچ نرخی ثبت نشده.</Text>}
          {snapshots.slice().reverse().slice(0, 50).map((s: any, i: number) => (
            <View key={i} style={cardStyle}>
              <View style={rowStyle}><Text style={labelStyle}>منبع</Text><Text style={valueStyle}>{s.source_name || s.source || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>ارز</Text><Text style={valueStyle}>{s.currency || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>خرید</Text><Text style={valueStyle}>{money(s.buy)}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>فروش</Text><Text style={valueStyle}>{money(s.sell)}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>میانگین</Text><Text style={valueStyle}>{money(s.avg)}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>زمان</Text><Text style={valueStyle}>{s.at || '—'}</Text></View>
            </View>
          ))}
        </View>
      )}

      {section === 'ads' && (
        <View>
          <Text style={titleStyle}>📣 صف تبلیغات ({adsQueue.length})</Text>
          {adsQueue.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>صف خالی است.</Text>}
          {adsQueue.map((q: any) => (
            <View key={q.id} style={cardStyle}>
              <View style={rowStyle}><Text style={labelStyle}>شناسه</Text><Text style={valueStyle}>{short(q.id, 18)}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>نوع</Text><Text style={valueStyle}>{q.kind || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>مقصد</Text><Text style={valueStyle}>{q.destination || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>وضعیت</Text><Text style={valueStyle}>{q.status || 'queued'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>زمان</Text><Text style={valueStyle}>{q.scheduled_at || q.created_at || '—'}</Text></View>
            </View>
          ))}

          <Text style={[titleStyle, { marginTop: 16 }]}>📜 تاریخچه ارسال ({adsHistory.length})</Text>
          {adsHistory.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>تاریچه‌ای نیست.</Text>}
          {adsHistory.slice().reverse().slice(0, 30).map((h: any) => (
            <View key={h.id} style={cardStyle}>
              <View style={rowStyle}><Text style={labelStyle}>مقصد</Text><Text style={valueStyle}>{h.destination || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>نتیجه</Text><Text style={valueStyle}>{h.result || '—'}</Text></View>
              <View style={rowStyle}><Text style={labelStyle}>زمان</Text><Text style={valueStyle}>{h.sent_at || '—'}</Text></View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={showProductModal} transparent animationType="slide" onRequestClose={() => setShowProductModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 }}>📝 پست محصول جدید</Text>

              <TouchableOpacity onPress={pickProductImage} style={{ backgroundColor: '#f1f5f9', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#cbd5e1' }}>
                <Text style={{ color: '#475569' }}>🖼️ انتخاب عکس محصول (چند عکس مجاز است)</Text>
              </TouchableOpacity>

              {productImageUris.length > 0 && (
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {productImageUris.map((uri, idx) => (
                    <View key={idx} style={{ width: 70, height: 70 }}>
                      <Image source={{ uri }} style={{ width: 70, height: 70, borderRadius: 6 }} resizeMode="cover" />
                      <TouchableOpacity
                        onPress={() => setProductImageUris(productImageUris.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: -6, left: -6, backgroundColor: '#dc2626', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 4 }}>جستجوی نام یا کد مدل</Text>
              <TextInput
                value={productSearch}
                onChangeText={searchProductList}
                placeholder="مثلاً کفش اسپرت یا TEST-001"
                style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 8, textAlign: 'right' }}
              />

              {productResults.length > 0 && (
                <View style={{ maxHeight: 180, marginBottom: 8 }}>
                  {productResults.map((p: any, i: number) => (
                    <TouchableOpacity key={i} onPress={() => selectProductItem(p)} style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                      <Text style={{ textAlign: 'right', fontWeight: 'bold' }}>{p.name || p.model_name}</Text>
                      <Text style={{ textAlign: 'right', fontSize: 10, color: '#64748b' }}>کد: {p.code || p.model_code} — قیمت: {Number(p.price || 0).toLocaleString('en-US')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedProduct && (
                <View style={{ backgroundColor: '#ecfdf5', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#10b981' }}>
                  <Text style={{ textAlign: 'right', fontWeight: 'bold' }}>✅ {selectedProduct.name || selectedProduct.model_name}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 6 }}>کد مدل (خودکار)</Text>
                  <TextInput value={String(selectedProduct.code || selectedProduct.model_code || '')} editable={false} style={{ borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#fff', borderRadius: 6, padding: 6, marginBottom: 6, textAlign: 'right', color: '#065f46' }} />
                  <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 4 }}>قیمت (خودکار)</Text>
                  <TextInput value={String(selectedProduct.price || '')} editable={false} style={{ borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#fff', borderRadius: 6, padding: 6, textAlign: 'right', color: '#065f46' }} />
                </View>
              )}

              {[
                { label: 'تعداد (اختیاری)', value: productQty, set: setProductQty, ph: 'مثلاً 12 جفت' },
                { label: 'رنگ (اختیاری)', value: productColor, set: setProductColor, ph: 'مثلاً مشکی' },
                { label: 'جنس (اختیاری)', value: productMaterial, set: setProductMaterial, ph: 'مثلاً چرم' },
                { label: 'سایز (اختیاری)', value: productSize, set: setProductSize, ph: 'مثلاً 42' },
              ].map((f, i) => (
                <View key={i}>
                  <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 4 }}>{f.label}</Text>
                  <TextInput value={f.value} onChangeText={f.set} placeholder={f.ph} style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 8, textAlign: 'right' }} />
                </View>
              ))}

              <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 4 }}>یادداشت (اختیاری)</Text>
              <TextInput value={productNote} onChangeText={setProductNote} placeholder="توضیح کوتاه" multiline style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 10, textAlign: 'right', minHeight: 60 }} />

              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowProductModal(false)} style={{ flex: 1, backgroundColor: '#64748b', padding: 10, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={productSending || !selectedProduct} onPress={sendProductPost} style={{ flex: 2, backgroundColor: (productSending || !selectedProduct) ? '#94a3b8' : '#059669', padding: 10, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>{productSending ? '⏳...' : '📤 ارسال پست به کانال'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
