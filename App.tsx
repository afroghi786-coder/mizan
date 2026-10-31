import { __clearSeen } from "./lib.storage";
import { startGlobalBotWorker } from './lib.bot.worker';
import DashboardScreen from './components/DashboardScreen';

import PlusMenu from './components/PlusMenu';

import React from 'react';





import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StatusBar } from 'expo-status-bar';

import SyncControl from './SyncControl';

import ExchangeScreen from './ExchangeScreen';

import PublicMarketScreen from './PublicMarketScreen';

import { unlockAudio, playNotifSound, vibrateNotif, showBrowserNotif, showNotifWithDetails } from './lib.notifications';

import ExpensesScreen from './ExpensesScreen';

import EmployeesScreen from './EmployeesScreen';

import LanguageModal from './LanguageModal';

import { t, loadLang, getLang, isFirstTime } from './i18n';

import { cl, loadCustomLabels, setCustomLabel, resetCustomLabel, subscribe as subscribeLabels } from './customLabels';

import { loadPreset, getPreset, setPreset, term, PRESETS } from './presets';

import LicenseGate from './LicenseGate';

import LicenseNotification from './LicenseNotification';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Switch } from 'react-native';

import { useFonts, Orbitron_900Black, Orbitron_700Bold } from '@expo-google-fonts/orbitron';

import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';

import * as Print from 'expo-print';

import * as Sharing from 'expo-sharing';

import { captureRef } from 'react-native-view-shot';

import * as XLSX from 'xlsx';

import * as FileSystem from 'expo-file-system';

import SmsMatchScreen from './SmsMatchScreen';

import ManualEntryScreen from './ManualEntryScreen';

import LocalBotScreen from './LocalBotScreen';

import LearningScreen from './LearningScreen';

import DateField from './lib.datefield';



import {              supabase, fmt, parseNum, toFaNum, pad2, setCalType, loadCalType, saveCalType, CalType, toStorageDate, displayDate, displayDateOnly, jalaliDisplay, g2j, j2g, g2h, h2g, BANKS, SHIPPINGS, DASH_RANGE_LABELS, getProducts, createProduct, updateProduct, deleteProduct, lookupCustomerByPhone, generateCustomerCode, generateInvoiceNumber, createSale, getSalesGrouped, deleteSale, getUnpaidInvoices, searchAllInvoices, getInvoiceDetail, lookupSupplierByName, lookupCodeByName, createPurchase, getPurchasesGrouped, deletePurchase, getDashboardStats, getInventory, getSettings, updateSettings, loadMode, getMode, deleteSaleFromQueue, deletePurchaseFromQueue, updateInvoiceInQueue, Product, SaleItem, PurchaseItem, Settings, getInventoryByModel, getStockAdjustments, createStockAdjustment, deleteStockAdjustment, getSalesRowsForReport, getPurchasesRowsForReport , getParties, createParty, updateParty, deleteParty , lookupPartyByName , suggestPartyCode, suggestProductCode , getPartners, createPartner, updatePartner, deletePartner, getPartnerBankAccounts, createPartnerBankAccount, deletePartnerBankAccount , getPartnerTransactions, createPartnerTransaction, deletePartnerTransaction , getBanks, createBank, deleteBank, getShippings, createShipping, deleteShipping   , lookupPayerUniversal  , updateSale, updatePurchase  , createPartnerAutoTx, findPartnerByNameOrCode, isBusinessLocked } from './lib.offline';

import { getCalType, parseDateAny, toStorageDateFull } from './lib';;

import SuperAssistant from './SuperAssistant';

import BotUI from './BotUI';

import GlobalVoice from './GlobalVoice';

import { registerCommands } from './CommandBus';

import ResetPasswordScreen from './ResetPasswordScreen';

import { ErrorBoundary } from './components/ErrorBoundary';

import { exportBackup, importBackup, autoBackup, getLastAutoBackup } from './lib.backup';
import SettingsSheets from './SettingsSheets';
import SettingsAssistant from './SettingsAssistant';
import AssistantHome from './AssistantHome';
import { syncByDestination } from './lib.sheets';

import { buildStandardHtml, shareHtmlAsPdf, printHtml, exportExcel, numToWords, currencyLabel, mizanSignaturesHtml, mizanComputerNoteHtml } from './lib.share';

import CurrencyField from './lib.currencyfield';
import { setStorageUserId, canUseDevice, setDeviceLock } from './lib.storage';
import Storage from './lib.storage';// Safely load expo-notifications (fix for Expo Go)

import { hydrateFromSettings, getCurrencySync } from './lib.currency';let Notifications: any = null;

try {

  Notifications = require('expo-notifications');

} catch (e) {

  console.warn('⚠️ expo-notifications native module not found (Expo Go). Using mock.');

  Notifications = {

    setNotificationHandler: () => {},

    getPermissionsAsync: async () => ({ status: 'undetermined' }),

    requestPermissionsAsync: async () => ({ status: 'denied' }),

    getExpoPushTokenAsync: async () => ({ data: '' }),

    addNotificationReceivedListener: () => ({ remove: () => {} }),

    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),

    setNotificationChannelAsync: async () => {},

    scheduleNotificationAsync: async () => {},

    dismissAllNotificationsAsync: async () => {},

    cancelAllScheduledNotificationsAsync: async () => {},

  };

}



// ADMINSCREEN_WEB_ONLY — پنل ادمین فقط روی وب

let AdminScreen: any = null;

if (Platform.OS === 'web') {

  try {

    AdminScreen = require('./AdminScreen').default;

    console.log('🖥️ AdminScreen loaded (web only)');

  } catch (e: any) {

    console.log('AdminScreen load failed:', e?.message || e);

  }

} else {

  console.log('📱 AdminScreen skipped on mobile');

}





// ADMIN_WEB_ONLY_LOADER — پنل ادمین فقط روی وب بارگذاری می‌شود

// روی گوشی (iOS/Android) این ماژول هرگز اجرا نمی‌شود

let AdminPanel: any = null;

if (Platform.OS === 'web') {

  try {

    AdminPanel = require('./AdminPanel').default;

    console.log('🖥️ AdminPanel loaded (web only)');

  } catch (e: any) {

    console.log('AdminPanel load failed:', e?.message || e);

  }

} else {

  console.log('📱 AdminPanel skipped on mobile — panel is web-only');

}





// ══════════════════════════════════════════════════════════

//  Theme Mode: 🌙 dark | ☀️ light | ⚪ simple

// ══════════════════════════════════════════════════════════

export type ThemeMode = 'dark' | 'light' | 'simple';

let THEME_MODE: ThemeMode = 'light';

(globalThis as any).__getThemeMode = () => THEME_MODE;

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

    const AsyncStorage = Storage;



    // ═══ ۱. تلاش آنلاین ═══

    let allSales: any[] = [];
    const locked = await isBusinessLocked();
    if (!locked) {
      try {
        const { data } = await supabase.from('sales').select('*').eq('customer_code', customerCode);
        if (data && data.length) allSales = data;
      } catch {}
    }



    // ═══ ۲. اگه آفلاین یا سرور خالی بود، از cache ═══

    if (!allSales.length) {

      const raw = await AsyncStorage.getItem('@mizan_local_all_sales_full');

      if (raw) {

        const local = JSON.parse(raw);

        allSales = local.filter((s: any) => s.customer_code === customerCode);

      }

    }



    // ═══ ۳. اگه بازم خالی بود، از sales_grouped ═══

    if (!allSales.length) {

      const groupedRaw = await AsyncStorage.getItem('@mizan_local_sales_grouped');

      if (groupedRaw) {

        const grouped = JSON.parse(groupedRaw);

        const matched = grouped.filter((g: any) =>

          g.customerCode === customerCode || g.code === customerCode

        );

        for (const g of matched) {

          allSales.push({

            invoice_number: g.invoice,

            customer_code: customerCode,

            quantity: 1,

            price_unit: g.total || 0,

            payment: g.paid || 0,

            _synthetic: true,

          });

        }

      }

    }



    // ═══ ۴. فاکتورهای آفلاین توی صف ═══

    const queueRaw = await AsyncStorage.getItem('@mizan_queue');

    if (queueRaw) {

      const queue = JSON.parse(queueRaw);

      for (const item of queue) {

        if (item.op === 'createSale' && item.payload?.customerCode === customerCode) {

          const p = item.payload;

          for (const it of (p.items || [])) {

            allSales.push({

              invoice_number: p.invoiceNumber,

              customer_code: customerCode,

              quantity: Number(it.quantity) || 0,

              price_unit: Number(it.priceUnit) || 0,

              payment: Number(it.payment) || 0,

              _fromQueue: true,

            });

          }

        }

      }

    }



    // ═══ ۵. محاسبه ═══

    if (!allSales.length) return { sales: 0, payments: 0, balance: 0, invoiceCount: 0 };



    const grouped: Record<string, { sales: number; payments: number }> = {};

    allSales.forEach((r: any) => {

      if (r.invoice_number === currentInvoiceNumber) return;

      if (!grouped[r.invoice_number]) grouped[r.invoice_number] = { sales: 0, payments: 0 };

      const qty = Number(r.quantity) || 0;

      const price = Number(r.price_unit) || 0;

      grouped[r.invoice_number].sales += qty * price;

      grouped[r.invoice_number].payments += Number(r.payment) || 0;

    });



    let sales = 0, payments = 0, invoiceCount = 0;

    Object.values(grouped).forEach((g: any) => {

      sales += g.sales;

      payments += g.payments;

      invoiceCount++;

    });



    return { sales, payments, balance: sales - payments, invoiceCount };

  } catch (e) {

    console.log('getCustomerPreviousBalance error:', e);

    return { sales: 0, payments: 0, balance: 0, invoiceCount: 0 };

  }

}

  // 🔐 تابع بازیابی رمز

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

  // 🔐 حالت بازیابی رمز

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);



  useEffect(() => {
    // استارت خودکار ربات در پس‌زمینه به محض باز شدن اپ
    startGlobalBotWorker();
    __clearSeen().catch(()=>{});


    if (typeof window === 'undefined') return;

    

    const check = () => {

      const hash = ((window as any)?.location?.hash) || '';

      const search = ((window as any)?.location?.search || '') || '';

      if (

        hash.includes('type=recovery') ||

        search.includes('type=recovery') ||

        hash.includes('access_token=') ||

        (hash.includes('error=') && hash.includes('recovery'))

      ) {

        console.log('🔐 Recovery mode detected');

        setIsRecoveryMode(true);

      }

    };

    

    check();

    

    try {

      const { data: sub } = supabase.auth.onAuthStateChange((event: any) => {

        if (event === 'PASSWORD_RECOVERY') {

          console.log('🔐 PASSWORD_RECOVERY event');

          setIsRecoveryMode(true);

        }

      });

      return () => { try { sub?.subscription?.unsubscribe?.(); } catch {} };

    } catch {}

  }, []);



  // 🔐 اگه بازیابی رمز بود، فقط صفحه بازیابی نشون بده

  if (isRecoveryMode) {

    return <ResetPasswordScreen />;

  }





  const [fontsLoaded] = useFonts({ Orbitron_900Black, Orbitron_700Bold, ShareTechMono_400Regular });

  const [fontTimeout, setFontTimeout] = useState(false);

  // 🔐 Password Reset States

          



    // 📢 درخواست مجوز نوتیفیکیشن

    useEffect(() => {

    // 🔔 تنظیم صدای اعلان (کانال اندروید)

    try {

      Notifications?.setNotificationHandler({

        handleNotification: async () => ({

          shouldShowAlert: true,

          shouldPlaySound: true,

          shouldSetBadge: true,

        }),

      });



      if (Platform.OS === 'android') {

        Notifications?.setNotificationChannelAsync('default', {

          name: 'اعلان‌های میزان',

          importance: Notifications?.AndroidImportance.MAX,

          sound: 'default',

          vibrationPattern: [0, 250, 250, 250],

          lightColor: '#7c3aed',

          enableVibrate: true,

        }).catch(e => console.log('channel err', e));



        // کانال اضافه برای پیام‌های مهم

        Notifications?.setNotificationChannelAsync('messages', {

          name: 'پیام‌های جدید',

          importance: Notifications?.AndroidImportance.HIGH,

          sound: 'default',

          vibrationPattern: [0, 250, 250, 250],

          enableVibrate: true,

        }).catch(e => console.log('msg channel err', e));

      }

    } catch (e) { console.log('notif setup err', e); }



    // 📢 درخواست مجوز

    (async () => {

      try {

        const { status } = await Notifications?.requestPermissionsAsync();

        if (status !== 'granted') console.log('Notification permission not granted');

      } catch (e) { console.log('perm err', e); }

    })();

  }, []);

  // 🔐 تشخیص لینک بازیابی رمز (هم وب هم گوشی)

  useEffect(() => {

    if (typeof window !== 'undefined') {

      const hash = ((window as any)?.location?.hash) || '';

      const search = ((window as any)?.location?.search || '') || '';

      if (hash.includes('type=recovery') || search.includes('type=recovery') || hash.includes('access_token=')) {

        console.log('🔐 لینک بازیابی از طریق URL تشخیص داده شد');

        setShowResetModal(true);

      }

    }



    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {

      if (event === 'PASSWORD_RECOVERY') {

        console.log('🔐 PASSWORD_RECOVERY event received');

        setShowResetModal(true);

      }

    });



    return () => {

      authListener?.subscription?.unsubscribe();

    };

  }, []);





  useEffect(() => { const t = setTimeout(() => setFontTimeout(true), 3000); return () => clearTimeout(t); }, []);

  const fontsReady = fontsLoaded || fontTimeout;



  const [session, setSession] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [themeTick, setThemeTick] = useState(0);

  const [langTick, setLangTick] = useState(0);

  const [labelTick, setLabelTick] = useState(0);

  const [presetVersion, setPresetVersion] = useState(0);

  const [presetTick, setPresetTick] = useState(0);

  const [showLangFirst, setShowLangFirst] = useState(false);

  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);



  (globalThis as any).__changePreset = async (k: string) => {

    await setPreset(k as any);

    setPresetTick((v: number) => v + 1);

    setLangTick((v: number) => v + 1);

  };



  (globalThis as any).__reloadPreset = () => {

    setPresetVersion((v: number) => v + 1);

    setLangTick((v: number) => v + 1);

  };



  useEffect(() => { const unsub = subscribeLabels(() => setLabelTick(v => v + 1)); return unsub; }, []);

  const showToast = useCallback((msg: string, error = false) => {

    setToast({ msg, error });

    setTimeout(() => setToast(null), 3000);

  }, []);



  // چک URL مخفی ادمین

  useEffect(() => {

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const checkAdminUrl = () => {

      if (window && window.location) {

        const hash = ((window as any)?.location?.hash) || '';

        const path = ((window as any)?.location?.pathname || '') || '';

        if (hash === '#admin' || hash === '#admin-panel' || path.endsWith('/admin')) {

          setIsAdmin(true);

        }

      }

    };

    checkAdminUrl();

    if (typeof window !== 'undefined') {

      window.addEventListener('hashchange', checkAdminUrl);

      return () => window.removeEventListener('hashchange', checkAdminUrl);

    }

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

      .then(async ({ data: { session } }) => {
        if (session?.user?.id) {
          const chk = await canUseDevice(session.user.id);
          if (!chk.ok) {
            try { await supabase.auth.signOut(); } catch {}
            setStorageUserId('');
            setSession(null);
            setLoading(false);
            clearTimeout(failsafe);
            const msg = 'این دستگاه به حساب فروشگاه دیگری قفل است.\n\n' +
              'برای تغییر حساب باید برنامه را حذف و دوباره نصب کنی.\n\n' +
              'قبل از حذف نصب:\n' +
              '۱) با حساب فعلی سینک کن.\n' +
              '۲) از تنظیمات، بکاپ محلی بگیر و فایل را نگه دار.\n\n' +
              'اگر این کارها را نکنی، اطلاعات محلی از دست می‌رود.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('قفل دستگاه', msg);
            return;
          }
          await setDeviceLock(session.user.id);
        }
        setStorageUserId(session?.user?.id || '');
        setSession(session);
        setLoading(false);
        clearTimeout(failsafe);
      })

      .catch(() => { setLoading(false); clearTimeout(failsafe); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (s?.user?.id) {
        const chk = await canUseDevice(s.user.id);
        if (!chk.ok) {
          try { await supabase.auth.signOut(); } catch {}
          setStorageUserId('');
          setSession(null);
          const msg = 'این دستگاه به حساب فروشگاه دیگری قفل است.\n\n' +
            'برای تغییر حساب باید برنامه را حذف و دوباره نصب کنی.\n\n' +
            'قبل از حذف نصب:\n' +
            '۱) با حساب فعلی سینک کن.\n' +
            '۲) از تنظیمات، بکاپ محلی بگیر و فایل را نگه دار.\n\n' +
            'اگر این کارها را نکنی، اطلاعات محلی از دست می‌رود.';
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('قفل دستگاه', msg);
          return;
        }
        await setDeviceLock(s.user.id);
      }
      setStorageUserId(s?.user?.id || '');
      setSession(s);
    });

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

      <LanguageModal

        visible={showLangFirst}

        current={getLang()}

        firstTime={true}

        onClose={() => setShowLangFirst(false)}

        onSelect={() => { setShowLangFirst(false); setLangTick(v => v + 1); }}

      />

      <View key={themeTick + '-' + langTick + '-' + presetTick} style={{ flex: 1 }}>

        {isAdmin

          ? ((Platform.OS === 'web' && AdminScreen) ? <AdminScreen showToast={showToast} /> : <View style={{ flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>🖥️ پنل ادمین فقط روی وب</Text><Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>برای دسترسی به پنل ادمین، از مرورگر روی کامپیوتر وارد شوید</Text></View>)

          : !session

          ? <LoginScreen showToast={showToast} />

          : <LicenseGate showToast={showToast}>

              <LicenseNotification showToast={showToast} />

              <MainApp showToast={showToast} onCycleTheme={cycleTheme} langTick={langTick} />

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



function MainApp({ showToast, onCycleTheme, langTick }: any) {

  const [showLang, setShowLang] = useState(false);

  const [curLang, setCurLang] = useState(getLang());

  const [tab, setTab] = useState('dashboard');

  const [plus, setPlus] = useState(false);

  useEffect(() => { (globalThis as any).__newFormHandlers = (globalThis as any).__newFormHandlers || {}; }, []);

  useEffect(() => { console.log('TAB_NOW:', tab); }, [tab]);



  useEffect(() => {

    (globalThis as any).__nav = { setTab };

    console.warn('NAV_BRIDGE_READY');

  }, []);

  useEffect(() => {

    (globalThis as any).__nav = { setTab: (t: string) => { console.warn('NAV_SET', t); setTab(t as any); } };

    console.warn('NAV_READY');

    setTimeout(() => { try { require('./lib.voice').speakText('سیستم آماده است', 'fa-IR'); } catch(e) { console.warn('TTS_STARTUP_ERR', e); } }, 1500);

  }, []);





  // 📖 دفترچه فرمان‌های تب‌های اصلی

  useEffect(() => {

    registerCommands('main', {

      'صرافی':        () => setTab('exchange'),

      'صراف':         () => setTab('exchange'),

      'بازار عمومی':  () => setTab('publicMarket'),

      'بازار':        () => setTab('publicMarket'),

      'سفارش':        () => setTab('order'),

      'فروش':         () => setTab('order'),

      'خانه':         () => setTab('order'),

      'داشبورد':      () => setTab('order'),

      'خرید':         () => setTab('purchase'),

      'انبار':        () => setTab('inventory'),

      'موجودی':       () => setTab('inventory'),

      'هزینه‌ها':     () => setTab('expenses'),

      'هزینه':        () => setTab('expenses'),

      'کارمندان':     () => setTab('employees'),

      'کارمند':       () => setTab('employees'),

      'سود':          () => setTab('profit'),

      'درآمد':        () => setTab('profit'),

      'بانک':         () => setTab('bankMatch'),

      'پیامک':        () => setTab('bankMatch'),

      'آموزش':        () => setTab('botLearning'),

      'دستیار':       () => setTab('manualEntry'),

      'ربات':         () => setTab('aiAssistant'),

      'مدیریت':       () => setTab('mgr'),

      'پرینت':        () => setTab('print'),

    });

  }, []);

  const [botInnerView, setBotInnerView] = useState<string>('bot');



  // 🌉 ثبت Navigator برای ربات

  useEffect(() => {

    try {

      

    } catch {}

    /* cleanup __nav حذف شد */

  }, [tab]);



  const navRef = React.useMemo(() => ({

    setTab: (t: string) => setTab(t as any),

    setSub: (s: string) => { try { (globalThis as any).__exchangeSetSub?.(s); } catch {} },

    openModal: (name: string, data?: any) => { try { (globalThis as any).__openModal?.(name, data); } catch {} },

    getState: () => ({ tab }),

  }), [tab]);

  const [unlockedTabs, setUnlockedTabs] = useState<Set<string>>(new Set());

  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>({});

  React.useEffect(function() { hydrateFromSettings(settings); }, [settings]);


  const reloadSettings = useCallback(() => {

    getSettings().then(setSettings).catch(() => {});

  }, []);



  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  useEffect(() => { (globalThis as any).__openLang = () => setShowLang(true); }, []);

  // 🔍 WebView detection

  const _isWebView = (() => {

    try {

      if (typeof navigator === 'undefined') return true;

      const ua = navigator.userAgent || '';

      return /wv|WebView/i.test(ua) || typeof (window as any).ReactNativeWebView !== 'undefined';

    } catch { return false; }

  })();

  // ═══ SAFE_GLOBAL_POLLING — صدا در همه تب‌ها، امن برای APK ═══

  const [gPrefs, setGPrefs] = useState<any>({});

  const _gLastId = useRef<number>(0);

  const _gReady = useRef<boolean>(false);

  const _gPlaying = useRef<boolean>(false);

  const _gLastMsgId = useRef<number>(0);

  const _gMsgReady = useRef<boolean>(false);



  // Unlock audio در اولین کلیک (ایمن شده)

  useEffect(() => {

    try {

      if (_isWebView) return;

      if (typeof window === 'undefined') return;

      if (!window || typeof window.addEventListener !== 'function') return;

      const unlock = () => { try { if (typeof unlockAudio === 'function') unlockAudio(); } catch {} };

      window.addEventListener('click', unlock, { once: true });

      window.addEventListener('touchstart', unlock, { once: true });

      return () => {

        try {

          if (window && typeof window.removeEventListener === 'function') {

            window.removeEventListener('click', unlock);

            window.removeEventListener('touchstart', unlock);

          }

        } catch {}

      };

    } catch (e) {

      console.log('audio unlock err:', e);

      return;

    }

  }, []);



  // لود preferences

  useEffect(() => {

    let alive = true;

    const load = async () => {

      try {

        const m = await import('./lib.network');

        const p = await m.fetchPreferences();

        if (alive) setGPrefs(p);

      } catch {}

    };

    load();

    const iv = setInterval(load, 120000);

    return () => { alive = false; clearInterval(iv); };

  }, []);



  // Poll اعلان‌ها

  useEffect(() => {

    let alive = true;

    const tick = async () => {

      if (!alive) return;

      if (typeof document !== 'undefined' && document.hidden) return;

      try {

        const m = await import('./lib.network');

        const list = await m.fetchAllNotifications();

        if (!alive || !list?.length) return;

        const newest = Math.max(...list.map((x: any) => x.id || 0));

        if (!_gReady.current) { _gLastId.current = newest; _gReady.current = true; return; }

        if (newest > _gLastId.current && !_gPlaying.current) {

          _gPlaying.current = true;

          const newOnes = list.filter((x: any) => (x.id || 0) > _gLastId.current && !x.is_read);

          _gLastId.current = newest;

          if (newOnes.length > 0) {

            const n = newOnes[0];

            const p = n.payload || {};

            const texts: any = {

              fx_taken: `✅ ${p.from_name || ''} آگهی شما را قبول کرد`,

              hawala_taken: `✅ ${p.from_name || ''} حواله شما را قبول کرد`,

              direct_hawala: `🔒 حواله خصوصی از ${p.from_name || ''}`,

              direct_accepted: `✅ ${p.from_name || ''} حواله را قبول کرد`,

              direct_delivered: `📦 ${p.from_name || ''} حواله را تحویل داد`,

              fx_new: `💱 ${p.from_name || ''} فروش ${p.amount || 0} ${p.currency || ''}`,

              hawala_new: `📤 ${p.from_name || ''} حواله ${p.amount || 0} ${p.currency || ''}`,

              fx_expired: `⌛ آگهی شما منقضی شد`,

              hawala_expired: `⌛ حواله شما منقضی شد`,

            };

            const msg = texts[n.type] || '🔔 اعلان جدید';

            if (gPrefs.notify_sound !== false || gPrefs.notify_vibrate !== false) {

              try {

                const nType = n.type || '';

                let title = '🔔 میزان';

                if (nType.includes('direct')) title = '🔒 حواله خصوصی';

                else if (nType.includes('hawala')) title = '📤 حواله جدید';

                else if (nType.includes('fx')) title = '💱 معامله ارز';

                else if (nType.includes('group')) title = '🌐 گروه';

                showNotifWithDetails(title, msg, {

                  sound: gPrefs.notify_sound !== false,

                  vibrate: gPrefs.notify_vibrate !== false,

                  channelId: 'default',

                });

              } catch {}

            }

            showToast?.(msg);

          }

          setTimeout(() => { _gPlaying.current = false; }, 1500);

        }

      } catch {}

    };

    tick();

    const iv = setInterval(tick, 2000);

    return () => { alive = false; clearInterval(iv); };

  }, [gPrefs.notify_sound, gPrefs.notify_vibrate, gPrefs.notify_browser]);



  // Poll پیام‌های چت

  useEffect(() => {

    let alive = true;

    const tick = async () => {

      if (!alive) return;

      if (typeof document !== 'undefined' && document.hidden) return;

      try {

        const m = await import('./lib.network');

        const list = await m.fetchMyUnreadMessages();

        if (!alive || !list?.length) return;

        const newest = Math.max(...list.map((x: any) => x.id || 0));

        if (!_gMsgReady.current) { _gLastMsgId.current = newest; _gMsgReady.current = true; return; }

        if (newest > _gLastMsgId.current && !_gPlaying.current) {

          _gPlaying.current = true;

          const nw = list.find((x: any) => x.id === newest);

          _gLastMsgId.current = newest;

          const sender = nw?.from_name || nw?.from_email?.split('@')[0] || 'کسی';

          const preview = (nw?.text || '').slice(0, 60);

          const msg = `💬 ${sender}: ${preview}`;

          if (gPrefs.notify_sound !== false || gPrefs.notify_vibrate !== false) {

            try {

              showNotifWithDetails('💬 پیام جدید', msg, {

                sound: gPrefs.notify_sound !== false,

                vibrate: gPrefs.notify_vibrate !== false,

                channelId: 'messages',

              });

            } catch {}

          }

          showToast?.(msg);

          setTimeout(() => { _gPlaying.current = false; }, 1500);

        }

      } catch {}

    };

    const iv = setInterval(tick, 1500);

    return () => { alive = false; clearInterval(iv); };

  }, [gPrefs.notify_sound, gPrefs.notify_vibrate, gPrefs.notify_browser]);

















    const tabs = [

    { key: 'dashboard', icon: '🏠', label: t('داشبورد'), color: '#0e7490' },

    { key: 'exchange', icon: '💱', label: t('صرافی'), color: '#065f46' },

    { key: 'publicMarket', icon: '🛒', label: t('بازار عمومی'), color: '#7c3aed' },

    { key: 'employees', icon: '👥', label: t('کارمندان'), color: '#4c1d95' },

    { key: 'expenses', icon: '💸', label: t('هزینه‌ها'), color: '#7f1d1d' },

  
    { key: 'assistant', icon: '🤝', label: t('دستیار میزان'), color: '#7c3aed' },];



  const tabPins = getTabPins(settings);

  const isLocked = (t: string) => !!tabPins[t] && !unlockedTabs.has(t);

  const requestTab = (t: string) => {

    if (t === 'order' || !isLocked(t)) { setTab(t); return; }

    setPendingTab(t);

  };



  return (

    <View style={[s.safe, { backgroundColor: C.bg }]}>

        <StatusBar style={C.isDark ? 'light' : 'dark'} />

      <View style={[s.header, {

        backgroundColor:

          C.isSimple ? '#64748b' :

          tab === 'purchase' ? '#0f5132' :

          tab === 'print' ? '#4a235a' :

          tab === 'mgr' ? '#334155' :

          tab === 'profit' ? '#4a235a' :

          tab === 'inventory' ? '#0f5132' :

          tab === 'exchange' ? '#065f46' :

          tab === 'expenses' ? '#7f1d1d' :

          tab === 'employees' ? '#4c1d95' :

          '#0f2438',

      }]}>

        <View style={{

          height: 4,

          backgroundColor: '#d4af37',

          marginLeft: -14, marginRight: -14, marginTop: -14, marginBottom: 12,

        }} />



        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>

                 <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>

            <TouchableOpacity onPress={() => setShowLang(true)} style={[s.themeBtn, { borderColor: "#d4af37" }]}><Text style={{ fontSize: 20 }}>🌍</Text></TouchableOpacity>

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

              <Text style={s.hTitle}>{t('میزان')}</Text>

            </View>

            <Text style={s.hSub}>{t('حساب‌ها دقیق، معاملات امن، ذهن آسوده')} [v3]</Text>

          </View>

        </View>

      </View>

      {tab !== 'exchange' && tab !== 'publicMarket' && tab !== 'aiAssistant' && tab !== 'settings' && (

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabsBar, { backgroundColor: C.card }]} contentContainerStyle={s.tabsCont}>

        {tabs.map((t) => (

                   <TouchableOpacity key={t.key} accessibilityLabel={String(t.label)} accessibilityRole="button" onPress={() => requestTab(t.key)} activeOpacity={0.7} style={[s.tab, tab === t.key && { backgroundColor: C.isSimple ? '#64748b' : t.color, borderColor: '#d4af37' }]}>

            <Text style={s.tabIcon}>{t.icon}</Text>

            <Text style={[s.tabLbl, { color: C.textMut }, tab === t.key && s.tabLblActive]}>{t.label}</Text>

            {isLocked(t.key) && <Text style={s.lock}>🔒</Text>}

          </TouchableOpacity>

        ))}

      

            <TouchableOpacity 

              key="plus_tab" 

              accessibilityLabel="ایجاد سریع" 

              accessibilityRole="button" 

              onPress={() => setPlus(true)} 

              activeOpacity={0.7} 

              style={s.tab}

            >

              <Text style={s.tabIcon}>➕</Text>

              <Text style={[s.tabLbl, { color: '#fff' }]}>ایجاد</Text>

            </TouchableOpacity>

          </ScrollView>

      )}

      <View key={`tab-${tab}-${langTick || 0}`} style={{ flex: 1 }}>

      {tab === 'dashboard' && <DashboardScreen lang={curLang === 'ps' ? 'ps' : 'fa'} onOpen={(n: any) => { const k = String(n.key); if (k.includes(':')) { const [tabKey, sub] = k.split(':'); requestTab(tabKey); setTimeout(() => { try { (globalThis as any).__exchangeSetSub?.(sub); } catch {} }, 200); } else { requestTab(k); } }} />}

      {tab === 'order' && <SalesScreen showToast={showToast} />}

      {tab === 'purchase' && <PurchaseScreen showToast={showToast} />}

      {tab === 'print' && <PrintScreen showToast={showToast} />}

      {tab === 'mgr' && <ManagementScreen showToast={showToast} settings={settings} setSettings={setSettings} reload={reloadSettings} tabPins={tabPins} />}

      {tab === 'assistant' && (
        <ScrollView style={{ flex: 1, backgroundColor: '#0a1628' }} contentContainerStyle={{ padding: 12, paddingBottom: 120 }}>
          <AssistantHome showToast={showToast} />
        </ScrollView>
      )}

      {tab === 'settings' && (
        <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#1f3a5f', backgroundColor: '#0f2438' }}>
            <TouchableOpacity onPress={() => setTab('dashboard')} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#334155' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>→ بازگشت</Text>
            </TouchableOpacity>
            <Text style={{ color: '#f4d47a', fontSize: 16, fontWeight: 'bold' }}>⚙️ تنظیمات</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 120 }}>
            <SettingsSection showToast={showToast} settings={settings} setSettings={setSettings} reload={reloadSettings} />
          </ScrollView>
        </View>
      )}

      {tab === 'profit' && <ProfitScreen showToast={showToast} settings={settings} />}

      {tab === 'inventory' && <InventoryScreen showToast={showToast} />}

      {tab === 'exchange' && <ExchangeScreen showToast={showToast} />}

      {tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}

      {tab === 'aiAssistant' && <BotUI showToast={showToast} onExit={() => setTab('dashboard')} onNavigate={Platform.OS !== 'web' ? setTab : undefined} />}

      {tab === 'botLearning' && <LearningScreen showToast={showToast} />}

      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}

      {tab === 'bankMatch' && <SmsMatchScreen showToast={showToast} />}

      {tab === 'expenses' && <ExpensesScreen showToast={showToast} />}

      {tab === 'employees' && <EmployeesScreen showToast={showToast} settings={settings} />}

      <TouchableOpacity

        activeOpacity={0.85}

        onPress={() => setPlus(true)}

        style={{ display: 'none' }}

      >

        <Text style={{ color: '#e2e8f0', fontSize: 32, fontWeight: 'bold', lineHeight: 34 }}>+</Text>

      </TouchableOpacity>

      <PlusMenu visible={plus} onClose={() => setPlus(false)} lang={curLang === 'ps' ? 'ps' : 'fa'} onPick={(n: any) => { 

          setPlus(false); 

          const k = String(n.key); 

          const [tabKey, sub] = k.includes(':') ? k.split(':') : [k, undefined]; 

          (globalThis as any).__openNewPending = tabKey; 

          requestTab(tabKey); 

          if (sub) setTimeout(() => { try { (globalThis as any).__exchangeSetSub?.(sub); } catch {} }, 200); 

          setTimeout(() => { 

            try { 

              const h = (globalThis as any).__newFormHandlers?.[tabKey]; 

              if (typeof h === 'function') h(); 

            } catch {} 

          }, 400); 

        }} />

            <GlobalVoice

        showToast={showToast}

        renderScreen={(name: string) => {

          if (name === 'exchange') return <ExchangeScreen showToast={showToast} />;

          if (name === 'publicMarket') return <PublicMarketScreen showToast={showToast} />;

          if (name === 'order') return <SalesScreen showToast={showToast} />;

          if (name === 'purchase') return <PurchaseScreen showToast={showToast} />;

          if (name === 'inventory') return <InventoryScreen showToast={showToast} />;

          if (name === 'expenses') return <ExpensesScreen showToast={showToast} />;

          if (name === 'employees') return <EmployeesScreen showToast={showToast} settings={settings} />;

          if (name === 'profit') return <ProfitScreen showToast={showToast} settings={settings} />;

          if (name === 'bankMatch') return <SmsMatchScreen showToast={showToast} />;

          return null;

        }}

      />

      </View>

      <LanguageModal

        visible={showLang}

        current={curLang}

        firstTime={false}

        onClose={() => setShowLang(false)}

        onSelect={(l: any) => { setCurLang(l); setShowLang(false); }}

      />

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

      

      

      {/* دکمه برگشت صرافی (کپی از بازار عمومی) */}

      {tab === 'exchange' && (

        <TouchableOpacity

          onPress={() => setTab('order')}

          style={{ position: 'absolute', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}

        >

          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 }}>←</Text>

        </TouchableOpacity>

      )}





      {tab === 'publicMarket' && (

        <TouchableOpacity

          onPress={() => setTab('order')}

          style={{ position: 'absolute', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}

        >

          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 }}>←</Text>

        </TouchableOpacity>

      )}

    </View>

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

        <View style={[s.modalHead, { backgroundColor: '#6c3483' }]}><EL textKey="🔒 رمز ورود" style={s.modalHeadTxt} /></View>

        <View style={{ padding: 20 }}>

          <EL text="{t('رمز را وارد کنید')}" style={[s.lbl, { color: C.textMut }]} />

          <TextInput accessibilityLabel="••••" style={s.pinInp} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" secureTextEntry placeholder="••••" placeholderTextColor="#64748b" />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>

            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onClose}><Text style={s.btnTxt}>{t('انصراف')}</Text></TouchableOpacity>

            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={verify}><Text style={s.btnTxt}>{t('تأیید')}</Text></TouchableOpacity>

          </View>

        </View>

      </View></View>

    </Modal>

  );

}

// ══════════════════════════════════════════════════════════

//  AUTOCOMPLETE (inline - بدون Modal)

// ══════════════════════════════════════════════════════════

function Autocomplete({ value, onChange, onSelect, options, placeholder, label, containerStyle }) {

  const [show, setShow] = useState(false);

  const filtered = useMemo(() => {

    const q = String(value || '').toLowerCase().trim();

    const list = q ? options.filter((x: string) => String(x).toLowerCase().includes(q)) : options;

    const seen = new Set<string>();

    return list.filter((x: string) => { if (seen.has(x)) return false; seen.add(x); return true; }).slice(0, 100);

  }, [value, options]);

  return (

    <View style={[{ marginBottom: 8 }, containerStyle]}>

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

          <TouchableOpacity style={[s.btn, { backgroundColor: '#475569', margin: 4, paddingVertical: 6 }]} onPress={() => setShow(false)}><Text style={[s.btnTxt, { fontSize: 11 }]}>{t('بستن')}</Text></TouchableOpacity>

        </View>

      )}

    </View>

  );

}

// ══════════════════════════════════════════════════════════

//  CellAutocomplete — برای استفاده توی جدول‌ها (compact)

// ══════════════════════════════════════════════════════════

function CellAutocomplete({ value, onChange, onSelect, options, placeholder, containerStyle, inputStyle }: any) {

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

              <TextInput accessibilityLabel="🔍 جستجو..."

                style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border, marginBottom: 8 }]}

                value={query}

                onChangeText={setQuery}

                placeholder="🔍 جستجو..."

                placeholderTextColor={C.textMut}

                autoFocus

              />

              <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>

                {filtered.length === 0 && (

                  <EL textKey="موردی یافت نشد" style={{ textAlign: 'center', color: C.textMut, padding: 20 }} />

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

// DateField به lib.datefield.tsx منتقل شد



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

        <EL text="💰 سود خالص" style={dash.profitLbl}>{rangeLabel}</EL>

        <Text style={[dash.profitVal, { color: profit < 0 ? '#ff3355' : profit === 0 ? '#fbbf24' : '#00ff88', textShadowColor: profit < 0 ? '#ff3355' : profit === 0 ? '#fbbf24' : '#00ff88' }]}>

          {fmt(profit)}

        </Text>

        <Text style={dash.profitUnit}>{typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : ''}</Text>

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
  const [shippingsList, setShippingsList] = useState<any[]>([]);
  useEffect(() => { getShippings().then(setShippingsList).catch(()=>{}); }, []);


  const S = getS();

  const [view, setView] = useState<'list' | 'form' | 'invoice' | 'reprint'>('list');

  useEffect(() => {

    const g = globalThis as any;

    const h = () => setView('form');

    g.__newFormHandlers = g.__newFormHandlers || {};

    g.__newFormHandlers['order'] = h;

    if (g.__openNewPending === 'order') { g.__openNewPending = null; h(); }

    return () => { try { delete g.__newFormHandlers['order']; } catch {} };

  }, []);

  useEffect(() => {

    const g = globalThis as any;

    const h = () => setView('form');

    g.__newFormHandlers = g.__newFormHandlers || {};

    g.__newFormHandlers.order = h;

    if (g.__openNewPending === 'order') { g.__openNewPending = null; h(); }

    return () => { try { delete g.__newFormHandlers.order; } catch {} };

  }, []);

  useEffect(() => {

    const open = (t: string) => { if (t === 'order') setView('form'); };

    (globalThis as any).__openNewForm = open;

    const pending = (globalThis as any).__openNewPending;

    if (pending === 'order') { (globalThis as any).__openNewPending = null; setView('form'); }

    return () => { try { delete (globalThis as any).__openNewForm; } catch {} };

  }, []);



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
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(toStorageDateFull(new Date()));
  const [payDate, setPayDate] = useState(toStorageDateFull(new Date()));
  const [note, setNote] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverCode, setReceiverCode] = useState('');
  const [receiverBank, setReceiverBank] = useState('');
  const [receiverAccount, setReceiverAccount] = useState('');
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [partiesList, setPartiesList] = useState<any[]>([]);
  const [banksList, setBanksList] = useState<any[]>([]);
  useEffect(() => {
    getPartners().then(setPartnersList).catch(()=>{});
    getParties().then(setPartiesList).catch(()=>{});
    getBanks().then(setBanksList).catch(()=>{});
  }, []);

  const onReceiverPick = async (v: string) => {
    try {
      const f = await lookupPayerUniversal(v);
      if (f) {
        setReceiverCode(f.code || '');
        if (f.bank) setReceiverBank(f.bank);
        if (f.account) setReceiverAccount(f.account);
      }
    } catch {}
  };

  const [items, setItems] = useState<SaleItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<any>(null);

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



  const addItem = () => setItems([...items, { modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', accountHolderCode: '', description: '' , shelf: '' }]);

  const updItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };

  const delItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const setModel = (i: number, v: string) => { const n = [...items]; n[i].modelName = v; const p = prods.find((x) => x.name === v); if (p) { n[i].modelCode = p.code || ''; n[i].priceUnit = p.price || 0; n[i].shelf = p.shelf || ''; if (p.shipping_name && !shipping) setShipping(p.shipping_name); } setItems(n); };



  const grandTotal = items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);

  const grandQty = items.reduce((a, it) => a + (Number(it.quantity) || 0), 0);



  const resetForm = () => {
    setPhone('');
    setName('');
    setAddress('');
    setShipping('');
    setPaymentAmount(0);
    setInvoiceDate(toStorageDateFull(new Date()));
    setPayDate(toStorageDateFull(new Date()));
    setNote('');
    setReceiverName('');
    setReceiverCode('');
    setReceiverBank('');
    setReceiverAccount('');
    setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', accountHolderCode: '', description: '', shelf: '' }]);
    setView('form');
  };

  const submit = async () => {
    if (!/^09\d{9}$/.test(phone)) return alertMsg('⚠️ خطا', 'شماره معتبر نیست');
    if (!name || name.length < 2) return alertMsg('⚠️ خطا', 'نام الزامی است');
    
    const invalidItem = items.find(it => it.modelName && (!it.quantity || !it.priceUnit));
    if (invalidItem) {
      return alertMsg('⚠️ خطا', 'مدل «' + invalidItem.modelName + '» تعداد یا قیمت ندارد. لطفاً تکمیل کنید.');
    }

    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    const total = valid.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);
    
    setPendingConfirm({ name, phone, count: valid.length, total, paymentAmount, valid, note });
    return;

    if (!mode) return;
    if (mode === 'full' && !valid.length) {
      return alertMsg('⚠️ خطا', 'برای ثبت فاکتور، حداقل یک مدل با تعداد معتبر وارد کنید.');
    }

    let finalItems = valid;
    if (mode === 'payment') {
      finalItems = [{ modelName: 'پرداخت مشتری', modelCode: '', quantity: 0, priceUnit: 0, description: note }];
    }

    setSaving(true);
    try {
      let customerCode = '';
      const found = await lookupCustomerByPhone(phone);
      if (found?.customer_code && /^M_\d+$/.test(found.customer_code)) customerCode = found.customer_code;
      else customerCode = await generateCustomerCode();
      const inv = await generateInvoiceNumber();
      
      await createSale({ 
        invoiceNumber: inv, 
        customerCode, 
        customerName: name, 
        customerPhone: phone, 
        customerAddress: address, 
        shipping, 
        items: finalItems, 
        paymentAmount, 
        invoiceDate, 
        payDate, 
        note, 
        receiverName, 
        receiverCode, 
        receiverBank, 
        receiverAccount 
      });

      await new Promise(r => setTimeout(r, 100));

      const rows = await getInvoiceDetail(inv, 'sales');
      if (rows.length > 0) {
        const r = rows[0];
        const its = rows.map((x: any) => ({ modelName: x.model_name, modelCode: x.model_code, quantity: x.quantity, priceUnit: x.price_unit, total: x.quantity * x.price_unit }));
        const tot = its.reduce((a: number, it: any) => a + it.total, 0);
        const paid = rows.reduce((a: number, x: any) => a + (Number(x.payment) || 0), 0);
        const prev = await getCustomerPreviousBalance(r.customer_code, r.invoice_number);
        setInvoice({
          customer: { code: r.customer_code, name: r.customer_name, phone: r.customer_phone, address: r.customer_address, shipping: r.shipping },
          current: { invoiceNumber: r.invoice_number, items: its, sales: tot, payments: paid, balance: tot - paid },
          previous: prev,
          totals: { sales: prev.sales + tot, payments: prev.payments + paid, balance: prev.balance + (tot - paid) },
          timeString: displayDate(r.date_reg),
        });
        setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]);
        setPaymentAmount(0); setInvoiceDate(toStorageDateFull(new Date())); setPayDate(toStorageDateFull(new Date()));
        setNote(''); setReceiverName(''); setReceiverCode(''); setReceiverBank(''); setReceiverAccount('');
        setView('invoice');
      } else {
        showToast('✅ فروش ثبت شد');
        setPhone(''); setName(''); setAddress(''); setShipping(''); setItems([]); setView('list'); load();
      }
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  }
  const confirmSubmit = async (mode: string) => {
    if (!pendingConfirm) return;
    const { valid, total, name: n, phone: p, paymentAmount: payAmt, note: n2 } = pendingConfirm;
    setPendingConfirm(null);
    setSaving(true);
    try {
      let customerCode = '';
      const found = await lookupCustomerByPhone(p);
      if (found?.customer_code && /^M_\d+$/.test(found.customer_code)) customerCode = found.customer_code;
      else customerCode = await generateCustomerCode();
      const inv = await generateInvoiceNumber();

      let finalItems = valid;
      if (mode === 'payment') {
        finalItems = [{ modelName: 'پرداخت مشتری', modelCode: '', quantity: 0, priceUnit: 0, description: n2, shelf: '' }];
      }

      await createSale({
        invoiceNumber: inv, customerCode, customerName: n, customerPhone: p,
        customerAddress: address, shipping, items: finalItems,
        paymentAmount: payAmt, invoiceDate, payDate, note: n2,
        receiverName, receiverCode, receiverBank, receiverAccount
      });

      // ═══ اگر دریافت‌کننده یکی از شرکا بود، حرکت شریک ثبت شود ═══
      try {
        const partner = await findPartnerByNameOrCode(receiverName || receiverCode);
        if (partner && payAmt > 0) {
          const cur = (typeof getCurrencySync === 'function' ? ((getCurrencySync() as any).code || 'AFN') : 'AFN');
          await createPartnerAutoTx({
            partner_code: partner.code,
            partner_name: partner.name,
            type: 'deposit',
            amount: payAmt,
            currency: cur,
            account_type: 'current',
            counterpart_type: 'customer',
            counterpart_code: customerCode,
            source_type: 'sales',
            source_id: inv,
            transaction_date: invoiceDate || new Date().toISOString(),
            note: 'فروش به ' + n + ' - فاکتور ' + inv,
            bank_account_local_id: '',
          });
          console.log('[partner auto] sales deposit ثبت شد:', partner.name, payAmt);
        }
      } catch (e) { console.log('[partner auto sales]', e); }

      await new Promise(r => setTimeout(r, 100));
      const rows = await getInvoiceDetail(inv, 'sales');
      if (rows.length > 0) {
        const r = rows[0];
        const its = rows.map((x: any) => ({ modelName: x.model_name, modelCode: x.model_code, shelf: x.shelf, quantity: x.quantity, priceUnit: x.price_unit, total: x.quantity * x.price_unit }));
        const tot = its.reduce((a: number, it: any) => a + it.total, 0);
        const paid = rows.reduce((a: number, x: any) => a + (Number(x.payment) || 0), 0);
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
  };;



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



  if (view === 'invoice' && invoice) return <View style={{ flex: 1, overflow: 'hidden' }}><InvoiceView invoice={invoice} onBack={() => { setView('list'); setInvoice(null); load(); }} showToast={showToast} onNew={resetForm} /></View>;



  // ═══════════════ حالت پرینت مجدد ═══════════════

  if (view === 'reprint') return (

    <ScrollView style={S.page} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>

      {/* کارت پرینت مجدد */}

      <View style={S.card}>

        <View style={S.cardHeader}>

          <Text style={S.cardHeaderIcon}>🖨️</Text>

          <EL textKey="پرینت مجدد فاکتور" style={[S.cardHeaderTitle, { color: S.order }]} />

        </View>

        <View style={{ padding: 16 }}>

          <EL text="{t('شماره فاکتور قدیمی')}" style={S.label} />

          <TextInput accessibilityLabel="مثلاً 14050612-1001"

            style={S.input}

            value={reprintInv}

            onChangeText={setReprintInv}

            placeholder="مثلاً 14050612-1001"

            placeholderTextColor="#94a3b8"

          />

          <TouchableOpacity style={[S.btnPrimary, { marginTop: 10 }]} onPress={doReprint}>

            <Text style={S.btnPrimaryTxt}>{t('🔍 نمایش فاکتور')}</Text>

          </TouchableOpacity>

        </View>

      </View>



      {/* دکمه برگشت */}

      <TouchableOpacity style={[S.btnSecondary, { marginTop: 12 }]} onPress={() => setView('list')}>

        <Text style={S.btnSecondaryTxt}>{t('↩️ برگشت به لیست')}</Text>

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

            <EL textKey="اطلاعات مشتری" style={[S.cardHeaderTitle, { color: S.order }]} />

          </View>

          <View style={{ padding: 16 }}>

            <Text style={S.label}>

              تلفن همراه <Text style={S.required}>*</Text>

              {customerStatus ? <Text style={S.statusBadge}> {customerStatus}</Text> : null}

            </Text>

            <TextInput accessibilityLabel="09121234567"

              style={S.input}

              value={phone}

              onChangeText={onPhone}

              keyboardType="phone-pad"

              maxLength={11}

              placeholder="09121234567"

              placeholderTextColor="#94a3b8"

            />



            <EL text="{t('نام و نام خانوادگی')}" style={S.label}><Text style={S.required}>*</Text></EL>

            <TextInput

              style={S.input}

              value={name}

              onChangeText={setName}

              placeholder={term('customer')}

              placeholderTextColor="#94a3b8"

            />



            <EL text="{t('آدرس')}" style={S.label} />

            <TextInput accessibilityLabel="اختیاری"

              style={S.input}

              value={address}

              onChangeText={setAddress}

              placeholder="اختیاری"

              placeholderTextColor="#94a3b8"

            />



            <EL text="{t('باربری')}" style={S.label}><Text style={S.required}>*</Text></EL>

            <Autocomplete

              value={shipping}

              onChange={setShipping}

              options={[...new Set([...shippingsList.map((s:any)=>s.name), ...prods.map(p => p.shipping_name || '').filter(Boolean)])]}

              placeholder="تایپ یا انتخاب..."

            />
        
        


          </View>

        </View>



        {/* ─── کارت اقلام ─── */}

        <View style={S.card}>

          <View style={S.cardHeader}>

            <Text style={S.cardHeaderIcon}>📦</Text>

            <EL textKey="اقلام فروش" style={[S.cardHeaderTitle, { color: S.order }]} />

          </View>

          <View style={{ padding: 16 }}>

            {items.map((it, i) => {

              const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);

              return (

                <View key={i} style={S.itemRow}>

                  {/* هدر کارت کوچیک */}

                  <View style={S.itemRowHeader}>

                    <View style={S.itemRowNumBadge}>

                      <Text style={S.itemRowNumTxt}>#{i + 1}</Text>

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

                    placeholder={term('product') + '...'}

                  />



                  {/* ردیف ۳ ستونه */}

                  <View style={S.threeColRow}>

                    <View style={S.threeColCell}>

                      <EL textKey={"کد مدل" + (it.shelf ? ' | 📍 قفسه: ' + it.shelf : '')} style={S.miniLabel} />

                      <View style={S.miniValue}>

                        <Text style={S.miniValueTxt}>{it.modelCode || '—'}</Text>

                      </View>

                    </View>

                    <View style={S.threeColCell}>

                      <EL text="{t('تعداد')}" style={S.miniLabel}><Text style={S.required}>*</Text></EL>

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

                      <EL text="{t('قیمت')}" style={S.miniLabel}><Text style={S.required}>*</Text></EL>

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

                      <EL textKey="مبلغ کل" style={S.miniLabel} />

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

              <EL textKey="➕ افزودن مدل" style={S.addModelBtnTxt} />

            </TouchableOpacity>

          </View>

        </View>



        <View style={[s.customerCard, { backgroundColor: C.card, borderColor: C.border, marginTop: 12 }]}>
          <EL textKey="💳 اطلاعات پرداخت" style={[s.customerCardTitle, { color: C.text }]} />
          <EL text={t('📅 تاریخ فاکتور')} style={[s.lbl, { color: C.textMut }]} />
          <DateField value={invoiceDate} onChange={setInvoiceDate} compact defaultToToday />
          <EL text={t('📅 تاریخ پرداخت')} style={[s.lbl, { color: C.textMut }]} />
          <DateField value={payDate} onChange={setPayDate} compact defaultToToday />
          <EL text={t('💵 مبلغ پرداخت‌شده')} style={[s.lbl, { color: C.textMut }]} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(paymentAmount || '')} onChangeText={(v) => setPaymentAmount(parseNum(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10, padding: 8, backgroundColor: C.cardAlt, borderRadius: 6 }}>
            <Text style={{ color: C.text, fontSize: 12 }}>جمع کل: {fmt(grandTotal)}</Text>
            <Text style={{ color: C.text, fontSize: 12 }}>پرداخت: {fmt(paymentAmount)}</Text>
            <Text style={{ color: grandTotal - paymentAmount > 0 ? '#dc2626' : '#059669', fontSize: 12, fontWeight: 'bold' }}>مانده: {fmt(grandTotal - paymentAmount)}</Text>
          </View>
          <EL text={t('📝 شرح')} style={[s.lbl, { color: C.textMut }]} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border, minHeight: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} multiline placeholder="توضیحات..." placeholderTextColor={C.textMut} />
        </View>

        {/* --- بلوک اطلاعات دریافت‌کننده --- */}
        <View style={[s.customerCard, { backgroundColor: C.card, borderColor: C.border, marginTop: 12 }]}>
          <EL textKey="👤 اطلاعات دریافت‌کننده" style={[s.customerCardTitle, { color: C.text }]} />
          <Autocomplete
            label="👤 نام دریافت‌کننده"
            value={receiverName}
            onChange={setReceiverName}
            onSelect={onReceiverPick}
            options={Array.from(new Set([
              ...partiesList.map((p: any) => p.name || '').filter(Boolean),
              ...partnersList.map((p: any) => p.name || '').filter(Boolean),
            ]))}
            placeholder="تایپ یا انتخاب..."
          />
          <EL text="{t('🆔 کد دریافت‌کننده')}" style={[s.lbl, { color: C.textMut }]} />
          <TextInput style={[s.inp, { backgroundColor: C.cardAlt, color: C.textMut, borderColor: C.border }]} value={receiverCode} editable={false} placeholder="خودکار" placeholderTextColor={C.textMut} />
          <EL text="🏦 حساب دریافت‌کننده (بانک)" style={[s.lbl, { color: C.textMut }]} />
          <Autocomplete value={receiverBank} onChange={setReceiverBank} options={banksList.map((b: any) => b.name)} placeholder="انتخاب بانک..." />
          <EL text="{t('🏦 شماره حساب دریافت‌کننده')}" style={[s.lbl, { color: C.textMut }]} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={receiverAccount} onChangeText={setReceiverAccount} placeholder="اختیاری" placeholderTextColor={C.textMut} />
        </View>

      {/* ─── خلاصه کل ─── */}

        <View style={S.summaryCard}>

          <View style={{ flex: 1, alignItems: 'flex-end' }}>

            <EL textKey="💰 جمع مبلغ کل" style={S.summaryLbl} />

            <Text style={S.summaryVal}>{fmt(grandTotal)}</Text>

          </View>

          <View style={{ alignItems: 'flex-start' }}>

            <EL textKey="📦 تعداد اقلام" style={S.summaryLbl} />

            <Text style={S.summaryCnt}>{String(grandQty).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])} مدل</Text>

          </View>

        </View>



        {/* ─── دکمه‌های ثبت/برگشت ─── */}

        <View style={S.btnRowBottom}>

          <TouchableOpacity style={[S.btnSecondary, { flex: 1 }]} onPress={() => setView('list')}>

            <Text style={S.btnSecondaryTxt}>{t('↩️ برگشت')}</Text>

          </TouchableOpacity>

          <TouchableOpacity style={[S.btnSubmit, { flex: 2 }]} onPress={submit} disabled={saving}>

            {saving ? <ActivityIndicator color="#fff" /> : <Text style={S.btnSubmitTxt}>{t('✅ ثبت نهایی فروش')}</Text>}

          </TouchableOpacity>

        </View>

      
      {pendingConfirm && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPendingConfirm(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 20, maxWidth: 500, alignSelf: 'center', width: '100%' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: C.text, textAlign: 'center', marginBottom: 16 }}>📋 تأیید فاکتور فروش</Text>
              
              <View style={{ backgroundColor: C.cardAlt, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>👤 مشتری:</Text>
                  <Text style={{ color: C.text, fontWeight: 'bold' }}>{pendingConfirm.name}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>📞 تلفن:</Text>
                  <Text style={{ color: C.text }}>{pendingConfirm.phone}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>📦 تعداد اقلام:</Text>
                  <Text style={{ color: C.text, fontWeight: 'bold' }}>{toFaNum(pendingConfirm.count)} مدل</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>💰 جمع کل:</Text>
                  <Text style={{ color: '#00ff88', fontWeight: 'bold' }}>{fmt(pendingConfirm.total)}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>💵 پرداخت:</Text>
                  <Text style={{ color: '#059669', fontWeight: 'bold' }}>{fmt(pendingConfirm.paymentAmount)}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.textMut }}>📉 مانده:</Text>
                  <Text style={{ color: pendingConfirm.total - pendingConfirm.paymentAmount > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{fmt(pendingConfirm.total - pendingConfirm.paymentAmount)}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => confirmSubmit('full')} style={{ backgroundColor: '#059669', padding: 14, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>✅ ثبت کامل فاکتور</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmSubmit('payment')} style={{ backgroundColor: '#d97706', padding: 14, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>💵 ثبت فقط پرداخت</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPendingConfirm(null)} style={{ backgroundColor: '#64748b', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>لغو</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
</ScrollView>

    </KeyboardAvoidingView>

  );



  // ═══════════════ حالت لیست ═══════════════

  return (

    <ScrollView style={S.page} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>

      <View style={{ flexDirection: 'row-reverse', gap: 8, marginVertical: 8 }}>

        <TouchableOpacity style={[S.btnPrimary, { flex: 1 }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}>

          <Text style={S.btnPrimaryTxt}>{t('➕ فاکتور جدید')}</Text>

        </TouchableOpacity>

        <TouchableOpacity style={[S.btnSecondary, { flex: 1 }]} onPress={() => setView('reprint')}>

          <Text style={S.btnSecondaryTxt}>{t('🖨️ پرینت مجدد')}</Text>

        </TouchableOpacity>

      </View>



      <Text style={S.sectionTitle}>📄 فاکتورها ({list.length})</Text>



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
  const [pendingConfirm, setPendingConfirm] = useState<any>(null);
  const [banksList, setBanksList] = useState<any[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  useEffect(() => { getPartners().then(setPartnersList).catch(()=>{}); }, []);
  useEffect(() => { getBanks().then(setBanksList).catch(()=>{}); }, []);


  const [view, setView] = useState<'list' | 'form'>('list');

  useEffect(() => {

    const g = globalThis as any;

    const h = () => setView('form');

    g.__newFormHandlers = g.__newFormHandlers || {};

    g.__newFormHandlers['purchase'] = h;

    if (g.__openNewPending === 'purchase') { g.__openNewPending = null; h(); }

    return () => { try { delete g.__newFormHandlers['purchase']; } catch {} };

  }, []);

  useEffect(() => {

    const g = globalThis as any;

    const h = () => setView('form');

    g.__newFormHandlers = g.__newFormHandlers || {};

    g.__newFormHandlers.purchase = h;

    if (g.__openNewPending === 'purchase') { g.__openNewPending = null; h(); }

    return () => { try { delete g.__newFormHandlers.purchase; } catch {} };

  }, []);

  useEffect(() => {

    const open = (t: string) => { if (t === 'purchase') setView('form'); };

    (globalThis as any).__openNewForm = open;

    const pending = (globalThis as any).__openNewPending;

    if (pending === 'purchase') { (globalThis as any).__openNewPending = null; setView('form'); }

    return () => { try { delete (globalThis as any).__openNewForm; } catch {} };

  }, []);



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
  const [invoiceDate, setInvoiceDate] = useState(toStorageDateFull(new Date()));

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

  const [partySuppliers, setPartySuppliers] = useState<any[]>([]);
  const loadParties = async () => { try { setPartySuppliers(await getParties('supplier')); } catch {} };
  useEffect(() => { loadParties(); }, []);

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

    try { const party = await lookupPartyByName(v); if (party) { if (party.code && !sCode) setSCode(party.code); if (party.phone && !sPhone) setSPhone(party.phone); } else { const f = await lookupSupplierByName(v); if (f) { if (f.supplier_code && !sCode) setSCode(f.supplier_code); if (f.supplier_phone && !sPhone) setSPhone(f.supplier_phone); } } } catch {}

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
    for (const it of items) {
      if (it.modelName && (!it.quantity || !it.priceUnit)) {
        return alertMsg('⚠️ خطا', 'مدل «' + it.modelName + '» تعداد یا قیمت ندارد.');
      }
    }
    const total = valid.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0), 0);
    setPendingConfirm({ name: sName, inv: manualInv, count: valid.length, total, payAmt: amt });
  };

  const confirmSubmit = async (mode: string) => {
    if (!pendingConfirm) return;
    setPendingConfirm(null);
    const valid = items.filter((it) => it.modelName && it.quantity > 0);
    const amt = parseNum(payAmt);
    setSaving(true);
    try {
      let finalItems = valid;
      if (mode === 'payment') {
        finalItems = [{ modelCode: '', modelName: 'پرداخت به تأمین‌کننده', quantity: 0, priceUnit: 0, payment: 0, depositDate: '', bankName: '', accountHolder: '', accountHolderCode: '', description: note, shelf: '' }];
      }
      const inv = await createPurchase({ invoiceNumber: '', manualInvoice: manualInv, supplierName: sName, supplierCode: sCode, supplierPhone: sPhone, items: finalItems, paymentAmount: amt, paymentDate: payDate, invoiceDate: invoiceDate, bankAccount: bankAcc, payerName, payerCode, receiverAccount: receiverAcc, note });

      // ═══ اگر پرداخت‌کننده یکی از شرکا بود، حرکت شریک ثبت شود ═══
      try {
        const partner = await findPartnerByNameOrCode(payerName || payerCode);
        if (partner && amt > 0) {
          const cur = (typeof getCurrencySync === 'function' ? ((getCurrencySync() as any).code || 'AFN') : 'AFN');
          await createPartnerAutoTx({
            partner_code: partner.code,
            partner_name: partner.name,
            type: 'withdraw',
            amount: amt,
            currency: cur,
            account_type: 'current',
            counterpart_type: 'supplier',
            counterpart_code: sCode || sPhone || '',
            source_type: 'purchase',
            source_id: inv,
            transaction_date: payDate || invoiceDate || new Date().toISOString(),
            note: 'خرید از ' + sName + ' - فاکتور ' + inv,
            bank_account_local_id: '',
          });
          console.log('[partner auto] purchase withdraw ثبت شد:', partner.name, amt);
        }
      } catch (e) { console.log('[partner auto purchase]', e); }

      const isPending = typeof inv === 'string' && inv.startsWith('P-') && !/^\d{6}-/.test(inv);
      alertMsg('✅ موفق', 'فاکتور خرید ثبت شد' + (isPending ? '\n(در انتظار آپلود)' : ''));
      setSName(''); setSCode(''); setSPhone(''); setManualInv(''); setItems([]);
      setPayAmt(''); setBankAcc(''); setPayerName(''); setPayerCode(''); setReceiverAcc(''); setNote('');
      setInvoiceDate(toStorageDateFull(new Date())); setPayDate(toStorageDateFull(new Date()));
      setView('list'); load();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };



  if (view === 'form') return (

    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

        <EL text="{t('🛍️ فاکتور خرید')}" style={s.formTitle} />



        <View style={[s.customerCard, { backgroundColor: C.card, borderColor: C.border }]}>

          <EL textKey="🏭 اطلاعات تأمین‌کننده" style={[s.customerCardTitle, { color: C.text }]} />

          <Autocomplete label="🏭 نام تأمین‌کننده *" value={sName} onChange={setSName} onSelect={onSupplierPick} options={[...new Set([...partySuppliers.map((p: any) => p.name || '').filter(Boolean), ...prods.map(p => p.supplier_name || '').filter(Boolean)])]} placeholder="تایپ یا انتخاب..." />

          <EL text="{t('🆔 کد تأمین‌کننده')}" style={[s.lbl, { color: C.textMut }]} />

          <TextInput accessibilityLabel="خودکار" style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={sCode} onChangeText={setSCode} placeholder="خودکار" placeholderTextColor={C.textMut} />

          <EL text="{t('📞 تلفن')}" style={[s.lbl, { color: C.textMut }]} />

          <TextInput accessibilityLabel="09..." style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={sPhone} onChangeText={setSPhone} keyboardType="phone-pad" maxLength={11} placeholder="09..." placeholderTextColor={C.textMut} />

          <EL text="{t('🧾 شماره فاکتور دستی *')}" style={[s.lbl, { color: C.textMut }]} />

          <TextInput accessibilityLabel="شماره روی فاکتور" style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={manualInv} onChangeText={setManualInv} placeholder="شماره روی فاکتور" placeholderTextColor={C.textMut} />

        </View>



        <EL text="📦 اقلام خرید ({toFaNum(items.length)})" style={s.secT} />



        {items.map((it, i) => {

          const lineTotal = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);

          return (

            <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>

              <View style={[s.itemHeader, { backgroundColor: C.cardAlt }]}>

                <Text style={s.itemN}>#{i + 1}</Text>

                <TouchableOpacity onPress={() => delItem(i)} style={s.delBtnRound}>

                  <Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>🗑</Text>

                </TouchableOpacity>

              </View>

              <View style={{ padding: 10 }}>

                <Autocomplete value={it.modelName} onChange={(v) => updItem(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder={term('product') + '...'} />

                <View style={{ flexDirection: 'row-reverse', gap: 6 }}>

                  <View style={{ flex: 1 }}>

                    <EL textKey="کد مدل" style={[s.miniLbl, { color: C.textMut }]} />

                    <View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>

                      <Text style={[s.miniValueTxt, { color: C.text }]}>{it.modelCode || '—'}</Text>

                    </View>

                  </View>

                  <View style={{ flex: 1 }}>

                    <EL textKey="تعداد" style={[s.miniLbl, { color: C.textMut }]} />

                    <TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => updItem(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />

                  </View>

                  <View style={{ flex: 1 }}>

                    <EL textKey="قیمت" style={[s.miniLbl, { color: C.textMut }]} />

                    <TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => updItem(i, 'priceUnit', parseNum(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />

                  </View>

                </View>

                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>

                  <View style={{ flex: 1 }}>

                    <EL textKey="مبلغ کل" style={[s.miniLbl, { color: C.textMut }]} />

                    <View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: lineTotal ? '#00ff88' : C.border }]}>

                      <Text style={[s.miniValueTxt, { color: lineTotal ? '#00ff88' : C.textMut }]}>{lineTotal ? fmt(lineTotal) : '—'}</Text>

                    </View>

                  </View>

                  <View style={{ flex: 1 }}>

                    <EL textKey="شرح" style={[s.miniLbl, { color: C.textMut }]} />

                    <TextInput accessibilityLabel="اختیاری" style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={it.description} onChangeText={(v) => updItem(i, 'description', v)} placeholder="اختیاری" placeholderTextColor={C.textMut} />

                  </View>

                </View>

              </View>

            </View>

          );

        })}



        <TouchableOpacity style={s.addBtn2} onPress={addItem}><Text style={s.btnTxt}>{t('➕ افزودن مدل')}</Text></TouchableOpacity>



        <View style={s.grandSummary}>

          <View style={{ flex: 1 }}><EL textKey="💰 جمع مبلغ کل" style={s.gsLbl} /><Text style={s.gsVal}>{fmt(grandTotal)}</Text></View>

          <View style={{ alignItems: 'center' }}><EL textKey="📦 تعداد اقلام" style={s.gsLbl} /><Text style={s.gsQty}>{String(grandQty)}</Text></View>

        </View>



        <EL text="{t('💳 اطلاعات پرداخت')}" style={s.secT} />

        <EL text="{t('مبلغ پرداخت نقدی')}" style={[s.lbl, { color: C.textMut }]} />

        <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={payAmt} onChangeText={setPayAmt} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textMut} />



        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>

          <View style={{ flex: 1 }}><EL textKey="💵 پرداخت" style={[s.miniLbl, { color: C.textMut }]} /><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: '#059669' }]}><Text style={[s.miniValueTxt, { color: '#059669' }]}>{paidAmt ? fmt(paidAmt) : '—'}</Text></View></View>

          <View style={{ flex: 1 }}><EL textKey="📌 مانده" style={[s.miniLbl, { color: C.textMut }]} /><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: remaining > 0 ? '#dc2626' : '#059669' }]}><Text style={[s.miniValueTxt, { color: remaining > 0 ? '#dc2626' : '#059669' }]}>{grandTotal ? fmt(remaining) : '—'}</Text></View></View>

        </View>



        <EL text="{t('📅 تاریخ فاکتور')}" style={[s.lbl, { color: C.textMut }]} />
      <DateField value={invoiceDate} onChange={setInvoiceDate} compact defaultToToday />
      <EL text="{t('📅 تاریخ پرداخت')}" style={[s.lbl, { color: C.textMut }]} />

        <DateField value={payDate} onChange={setPayDate} compact defaultToToday />

        <Autocomplete
          label="👤 نام پرداخت‌کننده"
          value={payerName}
          onChange={setPayerName}
          onSelect={async (v: string) => {
            try {
              const f = await lookupPayerUniversal(v);
              if (f) {
                setPayerCode(f.code || '');
                if (f.bank) setBankAcc(f.bank);
                if (f.account) setReceiverAcc(f.account);
              } else {
                const c = await lookupCodeByName(v);
                setPayerCode(c);
              }
            } catch {
              const c = await lookupCodeByName(v);
              setPayerCode(c);
            }
          }}
          options={Array.from(new Set([
            ...partySuppliers.map((p: any) => p.name || '').filter(Boolean),
            ...partnersList.map((p: any) => p.name || '').filter(Boolean),
            ...prods.map((p: any) => p.payer_name || '').filter(Boolean),
            ...prods.map((p: any) => p.supplier_name || '').filter(Boolean),
          ]))}
          placeholder="تایپ یا انتخاب..."
        />

        <EL text="{t('🆔 کد پرداخت‌کننده')}" style={[s.lbl, { color: C.textMut }]} />

        <TextInput accessibilityLabel="خودکار" style={[s.inp, { backgroundColor: C.cardAlt, color: C.textMut, borderColor: C.border }]} value={payerCode} editable={false} placeholder="خودکار" placeholderTextColor={C.textMut} />

        <EL text="🏦 حساب پرداخت‌کننده (بانک)" style={[s.lbl, { color: C.textMut }]} />

        <Autocomplete value={bankAcc} onChange={setBankAcc} options={banksList.map((b: any) => b.name)} placeholder="انتخاب بانک..." />

        <EL text="{t('🏦 حساب دریافت‌کننده')}" style={[s.lbl, { color: C.textMut }]} />

        <TextInput accessibilityLabel="اختیاری" style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={receiverAcc} onChangeText={setReceiverAcc} placeholder="اختیاری" placeholderTextColor={C.textMut} />

        <EL text="{t('📝 شرح')}" style={[s.lbl, { color: C.textMut }]} />

        <TextInput accessibilityLabel="توضیحات..." style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border, minHeight: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} multiline placeholder="توضیحات..." placeholderTextColor={C.textMut} />



        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>

          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setView('list')}><Text style={s.btnTxt}>{t('↩️ برگشت')}</Text></TouchableOpacity>

          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#166534' }]} onPress={submit} disabled={saving}>

            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{t('✅ ثبت نهایی خرید')}</Text>}

          </TouchableOpacity>

        </View>
      {pendingConfirm && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPendingConfirm(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 20, maxWidth: 500, alignSelf: 'center', width: '100%' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: C.text, textAlign: 'center', marginBottom: 16 }}>📋 تأیید فاکتور خرید</Text>
              <View style={{ backgroundColor: C.cardAlt, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>🏭 تأمین‌کننده:</Text>
                  <Text style={{ color: C.text, fontWeight: 'bold' }}>{pendingConfirm.name}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>🧾 فاکتور دستی:</Text>
                  <Text style={{ color: C.text }}>{pendingConfirm.inv}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>📦 تعداد اقلام:</Text>
                  <Text style={{ color: C.text, fontWeight: 'bold' }}>{toFaNum(pendingConfirm.count)} مدل</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>💰 جمع کل:</Text>
                  <Text style={{ color: '#00ff88', fontWeight: 'bold' }}>{fmt(pendingConfirm.total)}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.textMut }}>💵 پرداخت:</Text>
                  <Text style={{ color: '#059669', fontWeight: 'bold' }}>{fmt(pendingConfirm.payAmt)}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.textMut }}>📉 مانده:</Text>
                  <Text style={{ color: pendingConfirm.total - pendingConfirm.payAmt > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{fmt(pendingConfirm.total - pendingConfirm.payAmt)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => confirmSubmit('full')} style={{ backgroundColor: '#059669', padding: 14, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>✅ ثبت کامل فاکتور</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmSubmit('payment')} style={{ backgroundColor: '#d97706', padding: 14, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>💵 ثبت فقط پرداخت</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPendingConfirm(null)} style={{ backgroundColor: '#64748b', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>لغو</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}


      </ScrollView>

    </KeyboardAvoidingView>

  );



   return (

    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>

      <TouchableOpacity style={[s.addBtn, { backgroundColor: '#166534', marginTop: 8 }]} onPress={() => { setView('form'); if (!items.length) addItem(); }}>

        <Text style={s.btnTxt}>{t('➕ فاکتور خرید جدید')}</Text>

      </TouchableOpacity>

      <EL text="📄 خریدها ({toFaNum(list.length)})" style={s.secT} />

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

      const [_salesRpt, _purchRpt] = await Promise.all([
        getSalesRowsForReport(c2),
        getPurchasesRowsForReport(c2),
      ]);
      const salesAsCustomer = _salesRpt.customer || [];
      const purchasesAsSupplier = _purchRpt.supplier || [];
      const triangRecv = _salesRpt.triang || [];



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



      const _serial = 'STMT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + c2;
      const _tracking = 'TRK-' + c2.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-8).padStart(8, '0');
      const _curLabel = (typeof currencyLabel === 'function' ? currencyLabel() : '') || 'افغانی';
      const _amountInWords = numToWords(Math.abs(net)) + ' ' + _curLabel;
      setReport({
        code: c2, name, phone,
        salesRows, purchaseRows, triangRows,
        totals: { totalSales, paidByCustomer, customerOwes, totalPurchases, paidToSupplier, weOwe, totalTriang, net },
        timeString: displayDate(new Date()),
        serial: _serial,
        tracking: _tracking,
        currency: _curLabel,
        amountInWords: _amountInWords,
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

        data.push({ 'نام مدل': 'جمع فروش', 'جمع': totals.totalSales, 'پرداخت': totals.paidByCustomer, 'مانده': totals.customerOwes } as any);

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

        data.push({ 'نام مدل': 'جمع خرید', 'جمع': totals.totalPurchases, 'پرداخت': totals.paidToSupplier, 'مانده': totals.weOwe + totals.totalTriang } as any);

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'خرید');

      }



      if (report.triangRows.length) {

        const data = report.triangRows.map((r: any, i: number) => ({

          '#': i + 1, 'تاریخ': displayDateOnly(r.date), 'فاکتور فروش': r.invoice,

          'فرستنده': r.fromName, 'کد فرستنده': r.fromCode, 'تلفن فرستنده': r.fromPhone,

          'مبلغ': r.amount, 'بانک': r.bank, 'گیرنده': r.holder,

          'تاریخ واریز': displayDateOnly(r.depositDate),

        }));

        data.push({ 'فرستنده': 'جمع مثلثی', 'مبلغ': totals.totalTriang } as any);

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'مثلثی');

      }



      const summary = [

        { 'شرح': 'نام', 'مقدار': report.name },

        { 'شرح': 'کد', 'مقدار': report.code },

        { 'شرح': 'تلفن', 'مقدار': report.phone },

        { 'شرح': 'جمع فروش ما به ایشان', 'مقدار': totals.totalSales },

        { 'شرح': 'دریافت از ایشان', 'مقدار': totals.paidByCustomer },

        { 'شرح': 'بدهی ایشان به ما', 'مقدار': totals.customerOwes },

        { 'شرح': 'جمع خرید ما از ایشان', 'مقدار': totals.totalPurchases },

        { 'شرح': 'پرداخت ما به ایشان', 'مقدار': totals.paidToSupplier },

        { 'شرح': 'دریافت مثلثی به نیابت', 'مقدار': totals.totalTriang },

        { 'شرح': 'بدهی ما به ایشان', 'مقدار': totals.weOwe },

        { 'شرح': totals.net > 0 ? 'بدهی نهایی ایشان' : totals.net < 0 ? 'بدهی نهایی ما' : 'تسویه', 'مقدار': Math.abs(totals.net) },

      ];

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'خلاصه');



      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const path = (FileSystem as any).cacheDirectory + 'report-' + report.code + '-' + Date.now() + '.xlsx';

      await FileSystem.writeAsStringAsync(path, wbout, { encoding: 'base64' });

      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);

      showToast('✅ اکسل آماده شد');

    } catch (e: any) { showToast(e.message, true); }

  }

  const exportBrandedPdf = async () => {
    if (!report) return;
    try {
      const t = report.totals;
      const curLabel = report.currency || 'افغانی';

      let runS = 0;
      const sRows = report.salesRows.map((r, i) => {
        const debit = Number(r.total) || 0;
        const credit = Number(r.payment) || 0;
        runS += debit - credit;
        const balAbs = Math.abs(runS);
        const status = runS > 0 ? 'بدهکار' : runS < 0 ? 'بستانکار' : 'تسویه';
        const statusColor = runS > 0 ? '#dc2626' : runS < 0 ? '#059669' : '#64748b';
        return `<tr>
          <td>${i + 1}</td>
          <td>${displayDate(r.date)}</td>
          <td>${r.invoice || '-'}</td>
          <td>${r.modelCode || '-'}</td>
          <td style="text-align:right">${r.modelName || '-'}</td>
          <td>${toFaNum(r.qty)}</td>
          <td>${fmt(r.priceUnit)}</td>
          <td>${fmt(r.total)}</td>
          <td style="color:#1e40af;font-weight:bold">${debit ? fmt(debit) : '-'}</td>
          <td style="color:#059669;font-weight:bold">${credit ? fmt(credit) : '-'}</td>
          <td style="font-weight:bold">${fmt(balAbs)}</td>
          <td>${r.bank || '-'}</td>
          <td>${r.holder || '-'}</td>
          <td>${r.depositDate ? displayDate(r.depositDate) : '-'}</td>
          <td style="text-align:right">${r.desc || '-'}</td>
          <td style="color:${statusColor};font-weight:bold">${status}</td>
        </tr>`;
      }).join('');

      let runP = 0;
      const pRows = report.purchaseRows.map((r, i) => {
        const credit = Number(r.total) || 0;
        const debit = Number(r.payment) || 0;
        runP += credit - debit;
        const balAbs = Math.abs(runP);
        const status = runP > 0 ? 'بستانکار' : runP < 0 ? 'بدهکار' : 'تسویه';
        const statusColor = runP > 0 ? '#059669' : runP < 0 ? '#dc2626' : '#64748b';
        return `<tr>
          <td>${i + 1}</td>
          <td>${displayDate(r.date)}</td>
          <td>${r.invoice || '-'}</td>
          <td>${r.modelCode || '-'}</td>
          <td style="text-align:right">${r.modelName || '-'}</td>
          <td>${toFaNum(r.qty)}</td>
          <td>${fmt(r.priceUnit)}</td>
          <td>${fmt(r.total)}</td>
          <td style="color:#1e40af;font-weight:bold">${debit ? fmt(debit) : '-'}</td>
          <td style="color:#059669;font-weight:bold">${credit ? fmt(credit) : '-'}</td>
          <td style="font-weight:bold">${fmt(balAbs)}</td>
          <td>${r.bank || '-'}</td>
          <td>${r.holder || '-'}</td>
          <td>${r.depositDate ? displayDate(r.depositDate) : '-'}</td>
          <td style="text-align:right">${r.desc || '-'}</td>
          <td style="color:${statusColor};font-weight:bold">${status}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Tahoma, Arial, sans-serif; font-size: 11px; color: #0f2438; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px double #0f2438; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { margin: 0; font-size: 20px; color: #0f2438; }
  .header .meta { text-align: left; font-size: 10px; color: #475569; line-height: 1.6; }
  .info-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-bottom: 15px; }
  .info-box div { flex: 1; font-size: 12px; }
  h3 { color: #1e40af; text-align: right; margin: 15px 0 5px 0; font-size: 13px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; }
  th { background-color: #0f2438; color: #fff; font-weight: bold; font-size: 10px; }
  tr:nth-child(even) { background-color: #f8fafc; }
  .total-row { background-color: #e2e8f0 !important; font-weight: bold; font-size: 11px; }
  .total-row td { border-top: 2px solid #0f2438; }
  .footer { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px; page-break-inside: avoid; }
  .sign-box { text-align: center; width: 30%; font-size: 11px; font-weight: bold; }
  .sign-line { border-bottom: 1px dashed #64748b; height: 40px; margin-bottom: 8px; }
  .summary-box { background: #f8fafc; border: 2px solid #0f2438; border-radius: 8px; padding: 12px; margin-top: 15px; font-size: 12px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #cbd5e1; }
  .summary-row:last-child { border-bottom: none; font-size: 15px; font-weight: bold; color: #dc2626; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>⚖️ میزان</h1>
      <div style="font-size: 11px; color: #475569; margin-top: 4px;">گزارش جامع حساب (صورت‌حساب)</div>
    </div>
    <div class="meta">
      <div>📅 تاریخ: ${report.timeString}</div>
      <div>🆔 شماره سند: <b>${report.serial}</b></div>
      <div>🔑 کد رهگیری: <b>${report.tracking}</b></div>
    </div>
  </div>

  <div class="info-box">
    <div><b>👤 طرف حساب:</b> ${report.name}</div>
    <div><b>🆔 کد حساب:</b> ${report.code}</div>
    <div><b>📞 تلفن:</b> ${report.phone}</div>
  </div>

  ${report.salesRows.length > 0 ? `
    <h3>🛒 بخش فروش</h3>
    <table>
      <thead>
        <tr>
          <th>#</th><th>تاریخ و زمان</th><th>فاکتور</th><th>کد مدل</th><th>نام مدل</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>بانک</th><th>صاحب حساب</th><th>تاریخ واریز</th><th>شرح</th><th>وضعیت</th>
        </tr>
      </thead>
      <tbody>
        ${sRows}
        <tr class="total-row">
          <td colspan="7" style="text-align: left;">جمع کل فروش:</td>
          <td>${fmt(t.totalSales)}</td>
          <td>${fmt(t.totalSales)}</td>
          <td>${fmt(t.paidByCustomer)}</td>
          <td>${fmt(Math.abs(t.customerOwes))}</td>
          <td>-</td><td>-</td><td>-</td><td>-</td>
          <td style="color:${t.customerOwes < 0 ? '#dc2626' : '#059669'}">${t.customerOwes > 0 ? 'بدهکار' : t.customerOwes < 0 ? 'بستانکار' : 'تسویه'}</td>
        </tr>
      </tbody>
    </table>
  ` : ''}

  ${report.purchaseRows.length > 0 ? `
    <h3>🛍️ بخش خرید</h3>
    <table>
      <thead>
        <tr>
          <th>#</th><th>تاریخ و زمان</th><th>فاکتور</th><th>کد مدل</th><th>نام مدل</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>بانک</th><th>صاحب حساب</th><th>تاریخ واریز</th><th>شرح</th><th>وضعیت</th>
        </tr>
      </thead>
      <tbody>
        ${pRows}
        <tr class="total-row">
          <td colspan="7" style="text-align: left;">جمع کل خرید:</td>
          <td>${fmt(t.totalPurchases)}</td>
          <td>${fmt(t.paidToSupplier)}</td>
          <td>${fmt(t.totalPurchases)}</td>
          <td>${fmt(Math.abs(t.weOwe))}</td>
          <td>-</td><td>-</td><td>-</td><td>-</td>
          <td style="color:${t.weOwe < 0 ? '#dc2626' : '#059669'}">${t.weOwe > 0 ? 'بستانکار' : t.weOwe < 0 ? 'بدهکار' : 'تسویه'}</td>
        </tr>
      </tbody>
    </table>
  ` : ''}

  <div class="summary-box">
    <div class="summary-row"><span>جمع بدهی ایشان به ما:</span><span>${fmt(t.customerOwes)} ${curLabel}</span></div>
    <div class="summary-row"><span>جمع بدهی ما به ایشان:</span><span>${fmt(t.weOwe + t.totalTriang)} ${curLabel}</span></div>
    <div class="summary-row">
      <span>مانده نهایی:</span>
      <span>${t.net > 0 ? 'ایشان بدهکارند' : t.net < 0 ? 'ما بدهکاریم' : 'تسویه'} - ${fmt(Math.abs(t.net))} ${curLabel}</span>
    </div>
  </div>

  <div class="footer">
    <div class="sign-box"><div class="sign-line"></div>امضای طرف حساب</div>
    <div class="sign-box"><div class="sign-line"></div>مدیر مالی</div>
    <div class="sign-box"><div class="sign-line"></div>مهر و امضای شرکت</div>
  </div>
</body>
</html>`;

      const r = await shareHtmlAsPdf(html, 'statement-' + report.code + '.pdf');
      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast(e.message, true); }
  };;;;;



  const totals = report?.totals;



  return (

    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">

      <EL text="{t('🖨️ گزارش جامع حساب')}" style={s.formTitle} />

      <EL text="{t('کد طرف حساب')}" style={[s.lbl, { color: C.textMut }]} />

      <TextInput accessibilityLabel="M_1001" style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={code} onChangeText={setCode} placeholder="M_1001" placeholderTextColor={C.textMut} />

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={loadReport} disabled={loading}>

        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{t('🔍 نمایش گزارش کامل')}</Text>}

      </TouchableOpacity>



      {report && t && (

        <>

          <View ref={ref} collapsable={false} style={{ backgroundColor: '#ffffff', flex: 1, padding: 8, marginTop: 8 }}>

            <View style={{ borderBottomWidth: 2, borderBottomColor: '#d4af37', paddingBottom: 6, marginBottom: 10 }}>

              <EL textKey="⚖️ گزارش جامع — میزان" style={{ fontSize: 15, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' }} />

              <Text style={{ fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 3 }}>📅 {report.timeString}</Text>
              <Text style={{ fontSize: 9, color: '#0891b2', textAlign: 'right', marginTop: 2, fontWeight: 'bold' }}>🆔 {report.serial}  |  🔑 {report.tracking}</Text>

            </View>



            <View style={{ backgroundColor: '#f8fafc', borderRadius: 6, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>

              <Text style={{ fontSize: 11, color: '#1e3a5f', fontWeight: 'bold', textAlign: 'right' }}>👤 {report.name}</Text>

              <Text style={{ fontSize: 10, color: '#475569', textAlign: 'right', marginTop: 2 }}>🆔 {report.code}   📞 {report.phone}</Text>

            </View>



            {report.salesRows.length > 0 && (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 14, color: '#1e40af', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#eff6ff', padding: 8, borderRadius: 6, marginBottom: 6 }}>
      🛒 فروش — {toFaNum(report.salesRows.length)} ردیف
    </Text>
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row-reverse', backgroundColor: '#1e3a8a', paddingVertical: 8 }}>
          <Text style={{ width: 30, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>#</Text>
          <Text style={{ width: 120, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تاریخ و زمان</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>
          <Text style={{ width: 70, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>کد مدل</Text>
          <Text style={{ width: 130, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>نام مدل</Text>
          <Text style={{ width: 40, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تعداد</Text>
          <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>قیمت</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>جمع</Text>
          <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بدهکار</Text>
          <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بستانکار</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>مانده</Text>
          <Text style={{ width: 70, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بانک</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>صاحب حساب</Text>
          <Text style={{ width: 120, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تاریخ واریز</Text>
          <Text style={{ width: 100, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>شرح</Text>
          <Text style={{ width: 70, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>وضعیت</Text>
        </View>
        {(() => {
          let runS = 0;
          return report.salesRows.map((r: any, i: number) => {
            const debit = r.total || 0;
            const credit = r.payment || 0;
            runS += debit - credit;
            const balAbs = Math.abs(runS);
            const status = runS > 0 ? 'بدهکار' : runS < 0 ? 'بستانکار' : 'تسویه';
            const statusColor = runS > 0 ? '#dc2626' : runS < 0 ? '#059669' : '#64748b';
            return (
              <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ width: 30, color: '#d4af37', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{i + 1}</Text>
                <Text style={{ width: 120, color: '#1e3a5f', fontSize: 10, textAlign: 'center' }}>{displayDate(r.date) || '—'}</Text>
                <Text style={{ width: 90, color: '#7c3aed', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{r.invoice || '—'}</Text>
                <Text style={{ width: 70, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{r.modelCode || '—'}</Text>
                <Text style={{ width: 130, color: '#1e3a5f', fontSize: 11, textAlign: 'right' }} numberOfLines={1}>{r.modelName || '—'}</Text>
                <Text style={{ width: 40, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{toFaNum(r.qty)}</Text>
                <Text style={{ width: 80, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{fmt(r.priceUnit)}</Text>
                <Text style={{ width: 90, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{fmt(r.total)}</Text>
                <Text style={{ width: 80, color: '#1e40af', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{debit ? fmt(debit) : '—'}</Text>
                <Text style={{ width: 80, color: '#059669', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{credit ? fmt(credit) : '—'}</Text>
                <Text style={{ width: 90, color: '#475569', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{fmt(balAbs)}</Text>
                <Text style={{ width: 70, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.bank || '—'}</Text>
                <Text style={{ width: 90, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.holder || '—'}</Text>
                <Text style={{ width: 120, color: '#475569', fontSize: 10, textAlign: 'center' }}>{r.depositDate ? displayDate(r.depositDate) : '—'}</Text>
                <Text style={{ width: 100, color: '#475569', fontSize: 11, textAlign: 'right' }} numberOfLines={1}>{r.desc || '—'}</Text>
                <Text style={{ width: 70, color: statusColor, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{status}</Text>
              </View>
            );
          });
        })()}
        <View style={{ flexDirection: 'row-reverse', backgroundColor: '#eff6ff', paddingVertical: 10, borderTopWidth: 2, borderTopColor: '#1e3a8a', alignItems: 'center' }}>
          <Text style={{ width: 30 }}></Text>
          <Text style={{ width: 120 }}></Text>
          <Text style={{ width: 90 }}></Text>
          <Text style={{ width: 70 }}></Text>
          <Text style={{ width: 130, fontSize: 12, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right', paddingRight: 10 }}>جمع کل:</Text>
          <Text style={{ width: 40 }}></Text>
          <Text style={{ width: 80 }}></Text>
          <Text style={{ width: 90, fontSize: 12, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'center' }}>{fmt(totals.totalSales)}</Text>
          <Text style={{ width: 80, fontSize: 12, fontWeight: 'bold', color: '#1e40af', textAlign: 'center' }}>{fmt(totals.totalSales)}</Text>
          <Text style={{ width: 80, fontSize: 12, fontWeight: 'bold', color: '#059669', textAlign: 'center' }}>{fmt(totals.paidByCustomer)}</Text>
          <Text style={{ width: 90, fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>{fmt(Math.abs(totals.customerOwes))}</Text>
          <Text style={{ width: 70 }}></Text>
          <Text style={{ width: 90 }}></Text>
          <Text style={{ width: 120 }}></Text>
          <Text style={{ width: 100 }}></Text>
          <Text style={{ width: 70, fontSize: 12, fontWeight: 'bold', color: totals.customerOwes < 0 ? '#dc2626' : '#059669', textAlign: 'center' }}>{totals.customerOwes > 0 ? 'بدهکار' : totals.customerOwes < 0 ? 'بستانکار' : 'تسویه'}</Text>
        </View>
      </View>
    </ScrollView>
  </View>
)}



            {report.purchaseRows.length > 0 && (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 14, color: '#9a3412', fontWeight: 'bold', textAlign: 'right', backgroundColor: '#fff7ed', padding: 8, borderRadius: 6, marginBottom: 6 }}>
      🛍️ خرید — {toFaNum(report.purchaseRows.length)} ردیف
    </Text>
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ borderWidth: 1, borderColor: '#fed7aa', borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row-reverse', backgroundColor: '#9a3412', paddingVertical: 8 }}>
          <Text style={{ width: 30, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>#</Text>
          <Text style={{ width: 120, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تاریخ و زمان</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>
          <Text style={{ width: 70, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>کد مدل</Text>
          <Text style={{ width: 130, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>نام مدل</Text>
          <Text style={{ width: 40, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تعداد</Text>
          <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>قیمت</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>جمع</Text>
          <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بدهکار</Text>
          <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بستانکار</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>مانده</Text>
          <Text style={{ width: 70, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بانک</Text>
          <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>صاحب حساب</Text>
          <Text style={{ width: 120, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تاریخ واریز</Text>
          <Text style={{ width: 100, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>شرح</Text>
          <Text style={{ width: 70, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>وضعیت</Text>
        </View>
        {(() => {
          let runP = 0;
          return report.purchaseRows.map((r: any, i: number) => {
            const credit = r.total || 0;
            const debit = r.payment || 0;
            runP += credit - debit;
            const balAbs = Math.abs(runP);
            const status = runP > 0 ? 'بستانکار' : runP < 0 ? 'بدهکار' : 'تسویه';
            const statusColor = runP > 0 ? '#059669' : runP < 0 ? '#dc2626' : '#64748b';
            return (
              <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#fff7ed' : '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#fed7aa', alignItems: 'center' }}>
                <Text style={{ width: 30, color: '#d4af37', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{i + 1}</Text>
                <Text style={{ width: 120, color: '#1e3a5f', fontSize: 10, textAlign: 'center' }}>{displayDate(r.date) || '—'}</Text>
                <Text style={{ width: 90, color: '#7c3aed', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{r.invoice || '—'}</Text>
                <Text style={{ width: 70, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{r.modelCode || '—'}</Text>
                <Text style={{ width: 130, color: '#1e3a5f', fontSize: 11, textAlign: 'right' }} numberOfLines={1}>{r.modelName || '—'}</Text>
                <Text style={{ width: 40, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{toFaNum(r.qty)}</Text>
                <Text style={{ width: 80, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{fmt(r.priceUnit)}</Text>
                <Text style={{ width: 90, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{fmt(r.total)}</Text>
                <Text style={{ width: 80, color: '#1e40af', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{debit ? fmt(debit) : '—'}</Text>
                <Text style={{ width: 80, color: '#059669', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{credit ? fmt(credit) : '—'}</Text>
                <Text style={{ width: 90, color: '#475569', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{fmt(balAbs)}</Text>
                <Text style={{ width: 70, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.bank || '—'}</Text>
                <Text style={{ width: 90, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.holder || '—'}</Text>
                <Text style={{ width: 120, color: '#475569', fontSize: 10, textAlign: 'center' }}>{r.depositDate ? displayDate(r.depositDate) : '—'}</Text>
                <Text style={{ width: 100, color: '#475569', fontSize: 11, textAlign: 'right' }} numberOfLines={1}>{r.desc || '—'}</Text>
                <Text style={{ width: 70, color: statusColor, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{status}</Text>
              </View>
            );
          });
        })()}
        <View style={{ flexDirection: 'row-reverse', backgroundColor: '#fff7ed', paddingVertical: 10, borderTopWidth: 2, borderTopColor: '#9a3412', alignItems: 'center' }}>
          <Text style={{ width: 30 }}></Text>
          <Text style={{ width: 120 }}></Text>
          <Text style={{ width: 90 }}></Text>
          <Text style={{ width: 70 }}></Text>
          <Text style={{ width: 130, fontSize: 12, fontWeight: 'bold', color: '#9a3412', textAlign: 'right', paddingRight: 10 }}>جمع کل:</Text>
          <Text style={{ width: 40 }}></Text>
          <Text style={{ width: 80 }}></Text>
          <Text style={{ width: 90, fontSize: 12, fontWeight: 'bold', color: '#9a3412', textAlign: 'center' }}>{fmt(totals.totalPurchases)}</Text>
          <Text style={{ width: 80, fontSize: 12, fontWeight: 'bold', color: '#1e40af', textAlign: 'center' }}>{fmt(totals.paidToSupplier)}</Text>
          <Text style={{ width: 80, fontSize: 12, fontWeight: 'bold', color: '#059669', textAlign: 'center' }}>{fmt(totals.totalPurchases)}</Text>
          <Text style={{ width: 90, fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>{fmt(Math.abs(totals.weOwe))}</Text>
          <Text style={{ width: 70 }}></Text>
          <Text style={{ width: 90 }}></Text>
          <Text style={{ width: 120 }}></Text>
          <Text style={{ width: 100 }}></Text>
          <Text style={{ width: 70, fontSize: 12, fontWeight: 'bold', color: totals.weOwe < 0 ? '#dc2626' : '#059669', textAlign: 'center' }}>{totals.weOwe > 0 ? 'بستانکار' : totals.weOwe < 0 ? 'بدهکار' : 'تسویه'}</Text>
        </View>
      </View>
    </ScrollView>
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

                      <Text style={{ width: 28, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>#</Text>

                      <Text style={{ width: 75, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>

                      <Text style={{ width: 95, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>

                      <Text style={{ width: 130, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>فرستنده</Text>

                      <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>کد فرستنده</Text>

                      <Text style={{ width: 100, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تلفن</Text>

                      <Text style={{ width: 100, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>مبلغ</Text>

                      <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>بانک</Text>

                      <Text style={{ width: 90, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>گیرنده</Text>

                      <Text style={{ width: 80, color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>تاریخ واریز</Text>

                    </View>

                    {report.triangRows.map((r: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f0fdf4' : '#fff', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#d1fae5', alignItems: 'center' }}>
              <Text style={{ width: 28, color: '#d4af37', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{i + 1}</Text>
              <Text style={{ width: 75, color: '#1e3a5f', fontSize: 11, textAlign: 'center' }}>{displayDateOnly(r.date) || '—'}</Text>
              <Text style={{ width: 95, color: '#7c3aed', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{r.invoice || '—'}</Text>
              <Text style={{ width: 130, color: '#1e3a5f', fontSize: 11, textAlign: 'right' }}>{r.fromName || '—'}</Text>
              <Text style={{ width: 80, color: '#7c3aed', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{r.fromCode || '—'}</Text>
              <Text style={{ width: 100, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.fromPhone || '—'}</Text>
              <Text style={{ width: 100, color: '#065f46', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>{fmt(r.amount)}</Text>
              <Text style={{ width: 80, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.bank || '—'}</Text>
              <Text style={{ width: 90, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.holder || '—'}</Text>
              <Text style={{ width: 80, color: '#475569', fontSize: 11, textAlign: 'center' }}>{r.depositDate ? displayDateOnly(r.depositDate) : '—'}</Text>
            </View>
          ))}

                  </View>

                </ScrollView>

                <Text style={{ fontSize: 10, color: '#065f46', fontWeight: 'bold', textAlign: 'right', marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#10b981' }}>

                  جمع دریافتی مثلثی: {fmt(totals.totalTriang)} {(typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '')}

                </Text>

              </View>

            )}



            <View style={{ backgroundColor: totals.net > 0 ? '#fef2f2' : totals.net < 0 ? '#f0fdf4' : '#f3f4f6', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 2, borderColor: totals.net > 0 ? '#dc2626' : totals.net < 0 ? '#059669' : '#94a3b8' }}>

              <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6, color: totals.net > 0 ? '#991b1b' : totals.net < 0 ? '#065f46' : '#475569' }}>

                {totals.net > 0 ? '⚖️ مانده نهایی — ایشان بدهکارند' : totals.net < 0 ? '💰 مانده نهایی — ما بدهکاریم' : '✅ تسویه کامل'}

              </Text>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 2 }}>

                <EL textKey="بدهی ایشان به ما:" style={{ fontSize: 10, color: '#64748b' }} />

                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e3a5f' }}>{fmt(Math.max(0, totals.customerOwes) + Math.max(0, -totals.weOwe))}</Text>

              </View>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 2 }}>

                <EL textKey="بدهی ما به ایشان:" style={{ fontSize: 10, color: '#64748b' }} />

                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e3a5f' }}>{fmt(Math.max(0, totals.weOwe) + Math.max(0, -totals.customerOwes))}</Text>

              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4, paddingTop: 4 }}>

                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: totals.net > 0 ? '#dc2626' : totals.net < 0 ? '#059669' : '#475569' }}>

                  {fmt(Math.abs(totals.net))} {(typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '')}

                </Text>

              </View>

            </View>



            <EL textKey="میزان — حساب‌ها دقیق، معاملات امن، ذهن آسوده" style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 8 }} />

          </View>



          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>

            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#c0392b' }]} onPress={exportExcel}><Text style={s.btnTxt}>{t('📥 اکسل')}</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#8e44ad' }]} onPress={exportBrandedPdf}><Text style={s.btnTxt}>📄 PDF برنددار</Text></TouchableOpacity>

            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#0ea5e9' }]} onPress={() => capture('share')}><Text style={s.btnTxt}>{t('📤 اشتراک')}</Text></TouchableOpacity>

            <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 100, backgroundColor: '#8e44ad' }]} onPress={() => capture('print')}><Text style={s.btnTxt}>{t('🖨️ پرینت')}</Text></TouchableOpacity>

          </View>

        </>

      )}

    </ScrollView>

  );

}



function ProfitScreen({ showToast, settings }: any) {
  const profitRef = useRef<View>(null);

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

  const exportProfitPdf = async () => {
    if (!models.length) return showToast('داده‌ای برای خروجی نیست', true);
    try {
      var _p = [];
      var curLabel = (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : 'افغانی');
      var _serial = 'PRF-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + (settings?.dashboard_range || 'month');
      var _tracking = 'TRK-PRF-' + String(Date.now()).slice(-6);

      _p.push('<div class="info"><b>🆔 شماره سند:</b> ' + _serial + ' &nbsp;|&nbsp; <b>🔑 کد رهگیری:</b> ' + _tracking + '<br><b>📅 تاریخ گزارش:</b> ' + displayDate(new Date()) + ' &nbsp;|&nbsp; <b>📊 بازه:</b> ' + (stats?.rangeLabel || 'ماه جاری') + '</div>');

      _p.push('<div class="title">💹 گزارش سود به تفکیک مدل</div>');
      _p.push('<table><tr><th>#</th><th>کد مدل</th><th>نام مدل</th><th>خرید (میانگین)</th><th>فروش (میانگین)</th><th>سود هر واحد</th><th>تعداد فروش</th><th>جمع سود کل</th></tr>');

      var rows = models.map(function(m, i) {
        var avgSale = m.totalQty ? (m.totalSales / m.totalQty) : 0;
        var unitProfit = m.purchasePrice > 0 ? (avgSale - m.purchasePrice) : 0;
        return '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + (m.code || '—') + '</td>' +
          '<td style="text-align:right">' + (m.name || '—') + '</td>' +
          '<td>' + (m.purchasePrice > 0 ? fmt(Math.round(m.purchasePrice)) : '—') + '</td>' +
          '<td>' + (avgSale ? fmt(Math.round(avgSale)) : '—') + '</td>' +
          '<td style="color:' + (unitProfit > 0 ? '#059669' : '#dc2626') + ';font-weight:bold">' + (unitProfit ? fmt(Math.round(unitProfit)) : '—') + '</td>' +
          '<td>' + fmt(m.totalQty) + '</td>' +
          '<td style="color:' + (m.totalProfit >= 0 ? '#059669' : '#dc2626') + ';font-weight:bold">' + fmt(m.totalProfit) + '</td>' +
          '</tr>';
      }).join('');

      _p.push(rows);
      _p.push('<tr class="total"><td colspan="7" style="text-align:left;font-weight:bold">جمع کل سود:</td><td style="font-weight:bold;color:#059669;font-size:14px">' + fmt(total) + ' ' + curLabel + '</td></tr>');
      _p.push('</table>');

      _p.push('<div class="net-words">💵 جمع سود کل به حروف: ' + numToWords(total) + ' ' + curLabel + '</div>');

      if (stats?.estimatedCount > 0) {
        _p.push('<div style="font-size:10px;color:#dc2626;margin-top:10px;">📌 توجه: سود ' + stats.estimatedCount + ' مدل به دلیل عدم ثبت خرید، تخمینی محاسبه شده است.</div>');
      }

      _p.push(mizanSignaturesHtml(['امضای مدیر فروش', 'امضای مدیر مالی', 'مهر شرکت']));
      _p.push(mizanComputerNoteHtml());

      var html = buildStandardHtml('گزارش سود و زیان — میزان', _p.join(''), '💹 گزارش سود');
      html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');

      var r = await shareHtmlAsPdf(html, 'profit-report-' + Date.now() + '.pdf');
      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast(e.message, true); }
  };

  const exportProfitExcel = async () => {
    if (!models.length) return showToast('داده‌ای برای خروجی نیست', true);
    try {
      var rows = models.map(function(m, i) {
        var avgSale = m.totalQty ? (m.totalSales / m.totalQty) : 0;
        var unitProfit = m.purchasePrice > 0 ? (avgSale - m.purchasePrice) : 0;
        return {
          '#': i + 1, 'کد مدل': m.code, 'نام مدل': m.name,
          'خرید (میانگین)': Math.round(m.purchasePrice), 'فروش (میانگین)': Math.round(avgSale),
          'سود هر واحد': Math.round(unitProfit), 'تعداد فروش': m.totalQty, 'جمع سود': m.totalProfit
        };
      });
      rows.push({ '#': '', 'کد مدل': '', 'نام مدل': 'جمع کل سود', 'خرید (میانگین)': 0, 'فروش (میانگین)': 0, 'سود هر واحد': 0, 'تعداد فروش': 0, 'جمع سود': total } as any);
      var r = await exportExcel([{ name: 'سود', data: rows }], 'profit-report-' + Date.now() + '.xlsx');
      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast(e.message, true); }
  };

  const printProfit = async () => {
    if (!models.length) return showToast('داده‌ای برای خروجی نیست', true);
    try {
      var curLabel = (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : 'افغانی');
      var _p = [];
      _p.push('<div class="info"><b>📅 تاریخ گزارش:</b> ' + displayDate(new Date()) + ' &nbsp;|&nbsp; <b>📊 بازه:</b> ' + (stats?.rangeLabel || 'ماه جاری') + '</div>');
      _p.push('<div class="title">💹 گزارش سود به تفکیک مدل</div>');
      _p.push('<table><tr><th>#</th><th>کد مدل</th><th>نام مدل</th><th>خرید (میانگین)</th><th>فروش (میانگین)</th><th>سود هر واحد</th><th>تعداد فروش</th><th>جمع سود کل</th></tr>');
      var rows = models.map(function(m, i) {
        var avgSale = m.totalQty ? (m.totalSales / m.totalQty) : 0;
        var unitProfit = m.purchasePrice > 0 ? (avgSale - m.purchasePrice) : 0;
        return '<tr><td>' + (i + 1) + '</td><td>' + (m.code || '—') + '</td><td style="text-align:right">' + (m.name || '—') + '</td><td>' + (m.purchasePrice > 0 ? fmt(Math.round(m.purchasePrice)) : '—') + '</td><td>' + (avgSale ? fmt(Math.round(avgSale)) : '—') + '</td><td style="color:' + (unitProfit > 0 ? '#059669' : '#dc2626') + ';font-weight:bold">' + (unitProfit ? fmt(Math.round(unitProfit)) : '—') + '</td><td>' + fmt(m.totalQty) + '</td><td style="color:' + (m.totalProfit >= 0 ? '#059669' : '#dc2626') + ';font-weight:bold">' + fmt(m.totalProfit) + '</td></tr>';
      }).join('');
      _p.push(rows);
      _p.push('<tr class="total"><td colspan="7" style="text-align:left;font-weight:bold">جمع کل سود:</td><td style="font-weight:bold;color:#059669;font-size:14px">' + fmt(total) + ' ' + curLabel + '</td></tr></table>');
      _p.push('<div class="net-words">💵 جمع سود کل به حروف: ' + numToWords(total) + ' ' + curLabel + '</div>');
      if (stats?.estimatedCount > 0) _p.push('<div style="font-size:10px;color:#dc2626;margin-top:10px;">📌 توجه: سود ' + stats.estimatedCount + ' مدل تخمینی است.</div>');
      _p.push(mizanSignaturesHtml(['امضای مدیر فروش', 'امضای مدیر مالی', 'مهر شرکت']));
      _p.push(mizanComputerNoteHtml());
      var html = buildStandardHtml('گزارش سود و زیان — میزان', _p.join(''), '💹 گزارش سود');
      html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
      var r = await printHtml(html);
      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { showToast(e.message, true); }
  };

  const shareProfitImage = async () => {
    try {
      if (!profitRef.current) return showToast('آماده‌سازی تصویر...', false);
      const uri = await captureRef(profitRef, { format: 'jpg', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
        showToast('✅ تصویر آماده شد');
      } else {
        showToast('اشتراک‌گذاری پشتیبانی نمی‌شود', true);
      }
    } catch (e: any) { showToast(e.message, true); }
  };

  ;




  return (

    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>

      <DigitalDashboard refreshKey={0} settings={settings} />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10, gap: 8, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10, marginTop: 8, justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={exportProfitPdf} style={{ backgroundColor: '#8e44ad', padding: 10, borderRadius: 8, flex: 1, minWidth: 80, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>📄 PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={printProfit} style={{ backgroundColor: '#0ea5e9', padding: 10, borderRadius: 8, flex: 1, minWidth: 80, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>🖨️ پرینت</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareProfitImage} style={{ backgroundColor: '#f59e0b', padding: 10, borderRadius: 8, flex: 1, minWidth: 80, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>📤 تصویر</Text>
          </TouchableOpacity>
        </View>
      </View>

      

      {stats?.estimatedCount > 0 && (<View style={s.warnBox}><Text style={s.warnTxt}>📊 {stats.estimatedCount} مدل بدون خرید — سود {Math.round((stats.defaultMargin || 0.1) * 100)}٪ تخمین زده شد</Text></View>)}

      <EL text="💹 سود به تفکیک مدل ({toFaNum(models.length)})" style={s.secT} />



      <ScrollView horizontal showsHorizontalScrollIndicator>

        <View>

          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>

            <Text style={HDR.cell}>#</Text>

            <EL textKey="کد" style={[s.thCell, { width: 90 }]} />

            <Text style={[HDR.cell, { width: 180 }]}>نام مدل</Text>

            <EL textKey="خرید" style={[s.thCell, { width: 120 }]} />

            <EL textKey="فروش" style={[s.thCell, { width: 120 }]} />

            <EL textKey="سود/واحد" style={[s.thCell, { width: 110 }]} />

            <EL textKey="تعداد فروش" style={[s.thCell, { width: 90 }]} />

            <EL textKey="جمع سود" style={[s.thCell, { width: 130 }]} />

            <EL textKey="منبع قیمت" style={[s.thCell, { width: 140 }]} />

          </View>

          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : models.map((m: any, i: number) => {

            const avgSale = m.totalQty ? (m.totalSales / m.totalQty) : 0;

            const unitProfit = m.purchasePrice > 0 ? (avgSale - m.purchasePrice) : 0;

            return (

              <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, m.estimated && { backgroundColor: C.isDark ? '#1e1b4b' : '#f5f3ff' }]}>

                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>

                <Text style={[s.tdCell, { width: 90, fontSize: 12, color: '#7c3aed', fontWeight: 'bold' }]}>{m.code}</Text>

                <Text style={[s.tdCell, { width: 180, fontSize: 12, color: C.text, textAlign: 'right', fontWeight: 'bold' }]} numberOfLines={1}>{m.name}</Text>

                <Text style={[s.tdCell, { width: 120, fontSize: 12, color: C.text }]}>{m.purchasePrice > 0 ? fmt(Math.round(m.purchasePrice)) : '—'}</Text>

                <Text style={[s.tdCell, { width: 120, fontSize: 12, color: C.text }]}>{avgSale ? fmt(Math.round(avgSale)) : '—'}</Text>

                <Text style={[s.tdCell, { width: 110, fontSize: 12, color: unitProfit > 0 ? '#059669' : '#dc2626', fontWeight: 'bold' }]}>{unitProfit ? fmt(Math.round(unitProfit)) : '—'}</Text>

                <Text style={[s.tdCell, { width: 90, fontSize: 12, color: C.text }]}>{fmt(m.totalQty)}</Text>

                <Text style={[s.tdCell, { width: 130, fontSize: 12, color: m.totalProfit >= 0 ? '#00ff88' : '#ff3355', fontWeight: 'bold' }]}>{fmt(m.totalProfit)}</Text>

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

      {!loading && !models.length && <EL textKey="💹 در این بازه فروشی ثبت نشده" style={s.empty} />}

      {/* Adjustment Modal */}

      

      

    </ScrollView>

  );

}



// ══════════════════════════════════════════════════════════

//  INVENTORY SCREEN — جدول ردیفی مثل وب

// ══════════════════════════════════════════════════════════


const HDR = StyleSheet.create({
  cell: { width: 40, paddingHorizontal: 4, paddingVertical: 8, textAlign: 'center', fontSize: 11, color: '#d4af37', fontWeight: 'bold',
    // ensure same padding/alignment as td cells
  },
});

function InventoryScreen({ showToast }: any) {

  const [list, setList] = useState<any[]>([]);

  const [stats, setStats] = useState<any>({});

  const [thresholdInput, setThresholdInput] = useState('5');

  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');

  const [filter, setFilter] = useState('all');

  const [agingFilter, setAgingFilter] = useState('');

  const [editItem, setEditItem] = useState<any>(null);

  const [shelfVal, setShelfVal] = useState('');

  const [invRef] = useState({ current: null as any });



  const _buildInvHtml = (rows: any[], st: any) => {

    var cur = getCurrencySync().label || 'افغانی';

    var head = '<tr><th>#</th><th>کد</th><th>نام</th><th>خرید</th><th>فروش</th><th>موجودی</th><th>بهای واحد</th><th>ارزش کل</th><th>قفسه</th><th>وضعیت</th></tr>';

    var body = rows.map(function(m: any, i: number) {

      return '<tr><td>' + (i + 1) + '</td><td>' + m.code + '</td><td style="text-align:right">' + (m.name || '—') + '</td><td>' + fmt(m.bought) + '</td><td>' + fmt(m.sold) + '</td><td style="font-weight:bold;color:#0891b2">' + fmt(m.currentQty) + '</td><td>' + fmt(m.unitCost || 0) + '</td><td style="font-weight:bold;color:#059669">' + fmt(m.totalValue || 0) + '</td><td>' + (m.shelf || '—') + '</td><td>' + (m.status === 'negative' ? '⚫ منفی' : m.status === 'out' ? '🔴 ناموجود' : m.status === 'low' ? '⚠️ کمبود' : '✅ سالم') + '</td></tr>';

    }).join('');

    var summary = '<div class="info"><b>📦 مدل‌ها:</b> ' + (st.totalModels || 0) + ' &nbsp;|&nbsp; <b>💰 ارزش کل:</b> ' + fmt(st.totalValue || 0) + ' ' + cur + ' &nbsp;|&nbsp; <b>💵 درآمد بالقوه:</b> ' + fmt(st.potentialRevenue || 0) + ' ' + cur + ' &nbsp;|&nbsp; <b>⚠️ کمبود:</b> ' + (st.lowStock || 0) + ' &nbsp;|&nbsp; <b>🔴 ناموجود:</b> ' + (st.outOfStock || 0) + ' &nbsp;|&nbsp; <b>⏸ راکد:</b> ' + ((st.agingBuckets && st.agingBuckets.dead) || 0) + '</div>';

    var words = '<div class="net-words">ارزش کل انبار به حروف: ' + numToWords(st.totalValue || 0) + ' ' + cur + '</div>';

    var serial = 'INV-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + rows.length;

    var meta = '<div class="info"><b>📄 شماره سند:</b> ' + serial + ' &nbsp;|&nbsp; <b>📅 تاریخ:</b> ' + new Date().toLocaleDateString('fa-IR') + '</div>';

    var table = '<table>' + head + body + '</table>';

    var signs = mizanSignaturesHtml(['امضای انباردار', 'امضای مدیر مالی', 'مهر شرکت']);

    var note = mizanComputerNoteHtml();

    return buildStandardHtml('گزارش موجودی انبار', meta + summary + table + words + signs + note, '📦 انبار');

  };



  const _invSharePdf = async () => {

    try {

      const html = _buildInvHtml(filtered, stats);

      const r = await shareHtmlAsPdf(html, 'inventory-' + Date.now() + '.pdf');

      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);

    } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };

  const _invPrint = async () => {

    try {

      const html = _buildInvHtml(filtered, stats);

      const r = await printHtml(html);

      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);

    } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };

  const _invExcel = async () => {

    try {

      const data = filtered.map(function(m: any, i: number) {

        return { '#': i + 1, 'کد': m.code, 'نام': m.name, 'خرید': m.bought, 'فروش': m.sold, 'موجودی': m.currentQty, 'بهای واحد': m.unitCost || 0, 'ارزش کل': m.totalValue || 0, 'آخرین فروش': m.lastSaleDate || '', 'روز از فروش': m.daysSinceLastSale, 'قفسه': m.shelf, 'وضعیت': m.status };

      });

      const r = await exportExcel([{ name: 'انبار', data }], 'inventory-' + Date.now() + '.xlsx');

      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);

    } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };

  const invExportMenu = () => {

    if (Platform.OS === 'web') { _invPrint(); return; }

    Alert.alert('خروجی انبار', 'نوع خروجی:', [

      { text: '📄 PDF / اشتراک', onPress: _invSharePdf },

      { text: '🖨️ چاپ', onPress: _invPrint },

      { text: '📊 اکسل', onPress: _invExcel },

      { text: 'لغو', style: 'cancel' },

    ]);

  };



  // ═══ کاردکس مدل ═══

  const [modelKardexModal, setModelKardexModal] = useState(false);

  const [modelKardexData, setModelKardexData] = useState<any>(null);

  const [modelKardexLoading, setModelKardexLoading] = useState(false);

  const [modelKardexCode, setModelKardexCode] = useState('');



  const openModelKardex = async (m: any) => {

    setModelKardexCode(m.code);

    setModelKardexModal(true);

    setModelKardexLoading(true);

    setModelKardexData(null);

    try {

      const d = await getInventoryByModel(m.code);

      // enrich with display

      const name = m.name || (d.purchases[0] && d.purchases[0].model_name) || (d.sales[0] && d.sales[0].model_name) || m.code;

      setModelKardexData({ ...d, name, model: m });

    } catch (e: any) {

      showToast('خطا: ' + (e?.message || ''), true);

    } finally {

      setModelKardexLoading(false);

    }

  };



  const _mkHtml = (data: any) => {

    var cur = getCurrencySync().label || 'افغانی';

    var pRows = (data.purchases || []).map(function(r: any, i: number) {

      var d = r.date_factor || r.date_reg || r.created_at || '';

      var dt = displayDateOnly ? displayDateOnly(d) : String(d).slice(0, 10);

      var qty = Number(r.quantity) || 0;

      var price = Number(r.price_unit) || 0;

      return '<tr><td>' + (i + 1) + '</td><td>' + dt + '</td><td>' + (r.invoice_number || '—') + '</td><td style="text-align:right">' + (r.supplier_name || r.payer_name || '—') + '</td><td>' + fmt(qty) + '</td><td>' + fmt(price) + '</td><td style="font-weight:bold">' + fmt(qty * price) + '</td></tr>';

    }).join('');

    var sRows = (data.sales || []).map(function(r: any, i: number) {

      var d = r.date_factor || r.date_reg || r.created_at || '';

      var dt = displayDateOnly ? displayDateOnly(d) : String(d).slice(0, 10);

      var qty = Number(r.quantity) || 0;

      var price = Number(r.price_unit) || 0;

      return '<tr><td>' + (i + 1) + '</td><td>' + dt + '</td><td>' + (r.invoice_number || '—') + '</td><td style="text-align:right">' + (r.customer_name || '—') + '</td><td>' + fmt(qty) + '</td><td>' + fmt(price) + '</td><td style="font-weight:bold">' + fmt(qty * price) + '</td></tr>';

    }).join('');

    var totalP = (data.purchases || []).reduce(function(a: number, r: any) { return a + ((Number(r.quantity) || 0) * (Number(r.price_unit) || 0)); }, 0);

    var totalS = (data.sales || []).reduce(function(a: number, r: any) { return a + ((Number(r.quantity) || 0) * (Number(r.price_unit) || 0)); }, 0);

    var totalBoughtQty = (data.purchases || []).reduce(function(a: number, r: any) { return a + (Number(r.quantity) || 0); }, 0);

    var totalSoldQty = (data.sales || []).reduce(function(a: number, r: any) { return a + (Number(r.quantity) || 0); }, 0);

    var stock = totalBoughtQty - totalSoldQty;

    var summary = '<div class="info"><b>📦 موجودی:</b> ' + fmt(stock) + ' &nbsp;|&nbsp; <b>🛒 خرید:</b> ' + fmt(totalBoughtQty) + ' &nbsp;|&nbsp; <b>🛍️ فروش:</b> ' + fmt(totalSoldQty) + ' &nbsp;|&nbsp; <b>💵 جمع خرید:</b> ' + fmt(totalP) + ' ' + cur + ' &nbsp;|&nbsp; <b>💰 جمع فروش:</b> ' + fmt(totalS) + ' ' + cur + '</div>';

    var serial = 'MK-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + (data.model && data.model.code || '');

    var meta = '<div class="info"><b>📄 شماره سند:</b> ' + serial + ' &nbsp;|&nbsp; <b>📅 تاریخ:</b> ' + new Date().toLocaleDateString('fa-IR') + '</div>';

    var pTable = data.purchases.length > 0 ? '<h3 style="margin:8px 0;color:#0f2438">🛒 خریدها</h3><table><tr><th>#</th><th>تاریخ</th><th>فاکتور</th><th>تأمین‌کننده</th><th>تعداد</th><th>قیمت</th><th>جمع</th></tr>' + pRows + '</table>' : '';

    var sTable = data.sales.length > 0 ? '<h3 style="margin:8px 0;color:#0f2438">🛍️ فروش‌ها</h3><table><tr><th>#</th><th>تاریخ</th><th>فاکتور</th><th>مشتری</th><th>تعداد</th><th>قیمت</th><th>جمع</th></tr>' + sRows + '</table>' : '';

    var signs = mizanSignaturesHtml(['امضای انباردار', 'امضای مدیر مالی', 'مهر شرکت']);

    var note = mizanComputerNoteHtml();

    return buildStandardHtml('کاردکس مدل: ' + data.name, meta + summary + pTable + sTable + signs + note, '📦 ' + (data.model && data.model.code || ''));

  };



  const _mkSharePdf = async () => {

    try { const r = await shareHtmlAsPdf(_mkHtml(modelKardexData), 'model-kardex-' + modelKardexCode + '-' + Date.now() + '.pdf'); showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };

  const _mkPrint = async () => {

    try { const r = await printHtml(_mkHtml(modelKardexData)); showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };

  const _mkExcel = async () => {

    try {

      var pData = (modelKardexData.purchases || []).map(function(r: any, i: number) { return { 'نوع': 'خرید', '#': i + 1, 'تاریخ': r.date_factor || r.date_reg || '', 'فاکتور': r.invoice_number || '', 'طرف': r.supplier_name || r.payer_name || '', 'تعداد': Number(r.quantity) || 0, 'قیمت': Number(r.price_unit) || 0, 'جمع': (Number(r.quantity) || 0) * (Number(r.price_unit) || 0) }; });

      var sData = (modelKardexData.sales || []).map(function(r: any, i: number) { return { 'نوع': 'فروش', '#': i + 1, 'تاریخ': r.date_factor || r.date_reg || '', 'فاکتور': r.invoice_number || '', 'طرف': r.customer_name || '', 'تعداد': Number(r.quantity) || 0, 'قیمت': Number(r.price_unit) || 0, 'جمع': (Number(r.quantity) || 0) * (Number(r.price_unit) || 0) }; });

      var r = await exportExcel([{ name: 'خرید', data: pData }, { name: 'فروش', data: sData }], 'model-kardex-' + modelKardexCode + '-' + Date.now() + '.xlsx');

      showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);

    } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };

  const modelKardexMenu = () => {

    if (Platform.OS === 'web') { _mkPrint(); return; }

    Alert.alert('خروجی کاردکس مدل', 'نوع خروجی:', [

      { text: '📄 PDF / اشتراک', onPress: _mkSharePdf },

      { text: '🖨️ چاپ', onPress: _mkPrint },

      { text: '📊 اکسل', onPress: _mkExcel },

      { text: 'لغو', style: 'cancel' },

    ]);

  };



  // ═══ تعدیل موجودی ═══

  const [adjModal, setAdjModal] = useState(false);

  const [adjModel, setAdjModel] = useState<any>(null);

  const [adjForm, setAdjForm] = useState<any>({ type: 'in', amount: '', reason: 'شمارش فیزیکی', adjustment_date: toStorageDateFull(new Date()), note: '' });

  const [adjList, setAdjList] = useState<any[]>([]);

  const [adjLoading, setAdjLoading] = useState(false);



  const openAdjustment = async (m: any) => {

    setAdjModel(m);

    setAdjForm({ type: 'in', amount: '', reason: 'شمارش فیزیکی', adjustment_date: toStorageDateFull(new Date()), note: '' });

    setAdjModal(true);

    setAdjLoading(true);

    try {

      const list = await getStockAdjustments(m.code);

      setAdjList(list || []);

    } catch (e) { console.log('adj load err:', e); }

    finally { setAdjLoading(false); }

  };



  const submitAdjustment = async () => {

    if (!adjModel) return;

    const amt = parseFloat(String(adjForm.amount).replace(/[^\d.]/g, '')) || 0;

    if (!amt || amt <= 0) { showToast('مقدار معتبر وارد کن', true); return; }

    const signed = adjForm.type === 'out' ? -amt : amt;

    try {

      await createStockAdjustment({

        model_code: adjModel.code,

        model_name: adjModel.name || adjModel.code,

        adjustment: signed,

        reason: adjForm.reason || 'سایر',

        adjustment_date: adjForm.adjustment_date || toStorageDateFull(new Date()),

        note: adjForm.note || '',

      });

      showToast('✅ تعدیل ثبت شد');

      setAdjForm({ type: 'in', amount: '', reason: adjForm.reason, adjustment_date: toStorageDateFull(new Date()), note: '' });

      const list = await getStockAdjustments(adjModel.code);

      setAdjList(list || []);

      load();

    } catch (e: any) {

      showToast('خطا: ' + (e?.message || ''), true);

    }

  };



  const removeAdjustment = async (id: string) => {

    if (!id) return;

    if (Platform.OS !== 'web' && !(await new Promise<boolean>(res => { Alert.alert('حذف تعدیل', 'مطمئنی؟', [{ text: 'لغو', style: 'cancel', onPress: () => res(false) }, { text: 'حذف', style: 'destructive', onPress: () => res(true) }]); }))) return;

    try {

      await deleteStockAdjustment(id);

      showToast('✅ حذف شد');

      const list = await getStockAdjustments(adjModel?.code);

      setAdjList(list || []);

      load();

    } catch (e: any) { showToast('خطا: ' + (e?.message || ''), true); }

  };



  const load = async () => {

    setLoading(true);

    try { const d = await getInventory(); setList(d.list); setStats(d.stats); setThresholdInput(String(d.threshold)); }

    catch (e: any) { showToast(e.message, true); } finally { setLoading(false); }

  };

  useEffect(() => { load(); }, []);



  const saveShelf = async () => {

    if (!editItem) return;

    try {

      const _prods = await getProducts();

      const _found = _prods.find((x: any) => x.code === editItem.code);

      if (_found && (_found.id || _found._localId || _found.local_id)) {

        await updateProduct(_found.id || _found._localId || _found.local_id, { shelf: shelfVal });

      } else {

        await createProduct({ code: editItem.code, name: editItem.name, price: editItem.lastPrice || 0, shelf: shelfVal });

      }

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

    if (agingFilter) {

      const d = m.daysSinceLastSale;

      if (agingFilter === 'healthy' && !(d !== null && d <= 30)) return false;

      if (agingFilter === 'slow' && !(d !== null && d > 30 && d <= 60)) return false;

      if (agingFilter === 'verySlow' && !(d !== null && d > 60 && d <= 90)) return false;

      if (agingFilter === 'dead' && !(d === null || d > 90)) return false;

    }

    if (q) { const h = `${m.code} ${m.name} ${m.shelf || ''}`.toLowerCase(); if (!h.includes(q.toLowerCase())) return false; }

    return true;

  });



  const statusLabel = (st: string) => st === 'negative' ? '⚫ منفی' : st === 'out' ? '🔴 ناموجود' : st === 'low' ? '⚠️ کمبود' : '✅ سالم';

  const statusColor = (st: string) => st === 'negative' ? '#94a3b8' : st === 'out' ? '#dc2626' : st === 'low' ? '#d97706' : '#059669';



  return (

    <ScrollView style={[s.content, { backgroundColor: C.bg }]} contentContainerStyle={{ padding: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

      {/* آمار */}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>

        {[

          { l: '📊 مدل‌ها', v: stats.totalModels || 0, c: '#60a5fa' },

          { l: '📦 جمع موجودی', v: stats.totalQty || 0, c: '#34d399' },

          { l: '💰 ارزش کل', v: stats.totalValue || 0, c: '#d4af37', money: true },

          { l: '💵 درآمد بالقوه', v: stats.potentialRevenue || 0, c: '#a78bfa', money: true },

          { l: '⚠️ کمبود', v: stats.lowStock || 0, c: '#fb923c' },

          { l: '🔴 ناموجود', v: stats.outOfStock || 0, c: '#f87171' },

          { l: '⏸ راکد (۹۰+ روز)', v: (stats.agingBuckets && stats.agingBuckets.dead) || 0, c: '#94a3b8' },

        ].map((b, i) => (

          <View key={i} style={[s.sBox, { backgroundColor: C.card }]}><Text style={s.sBoxL}>{b.l}</Text><Text style={[s.sBoxV, { color: b.c }]}>{fmt(b.v)}</Text></View>

        ))}

      </View>



      {stats.agingBuckets && (

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 8, padding: 8, backgroundColor: C.card, borderRadius: 6 }}>

          <Text style={{ color: C.textMut, fontSize: 10, fontWeight: 'bold', marginLeft: 'auto' }}>🌡 کهنگی موجودی:</Text>

          {agingFilter ? (<TouchableOpacity onPress={() => setAgingFilter('')} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#334155' }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>✕ پاک فیلتر</Text></TouchableOpacity>) : null}

          <TouchableOpacity onPress={() => setAgingFilter(agingFilter === 'healthy' ? '' : 'healthy')} style={{ backgroundColor: agingFilter === 'healthy' ? '#059669' : '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}><Text style={{ color: agingFilter === 'healthy' ? '#fff' : '#065f46', fontSize: 10, fontWeight: 'bold' }}>🟢 سالم {toFaNum(stats.agingBuckets.healthy || 0)}</Text></TouchableOpacity>

          <TouchableOpacity onPress={() => setAgingFilter(agingFilter === 'slow' ? '' : 'slow')} style={{ backgroundColor: agingFilter === 'slow' ? '#f59e0b' : '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}><Text style={{ color: agingFilter === 'slow' ? '#fff' : '#78350f', fontSize: 10, fontWeight: 'bold' }}>🟡 کند {toFaNum(stats.agingBuckets.slow || 0)}</Text></TouchableOpacity>

          <TouchableOpacity onPress={() => setAgingFilter(agingFilter === 'verySlow' ? '' : 'verySlow')} style={{ backgroundColor: agingFilter === 'verySlow' ? '#ea580c' : '#fed7aa', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}><Text style={{ color: agingFilter === 'verySlow' ? '#fff' : '#7c2d12', fontSize: 10, fontWeight: 'bold' }}>🟠 خیلی کند {toFaNum(stats.agingBuckets.verySlow || 0)}</Text></TouchableOpacity>

          <TouchableOpacity onPress={() => setAgingFilter(agingFilter === 'dead' ? '' : 'dead')} style={{ backgroundColor: agingFilter === 'dead' ? '#dc2626' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}><Text style={{ color: agingFilter === 'dead' ? '#fff' : '#991b1b', fontSize: 10, fontWeight: 'bold' }}>🔴 راکد {toFaNum(stats.agingBuckets.dead || 0)}</Text></TouchableOpacity>

        </View>

      )}



      {/* آستانه */}

      <View style={[s.thresholdBox, { backgroundColor: C.card, borderColor: C.border }]}>

        <EL text="{t('⚙️ آستانه کمبود')}" style={[s.lbl, { color: C.textMut }]} />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>

          <TextInput style={[s.inp, { flex: 1, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={thresholdInput} onChangeText={setThresholdInput} keyboardType="numeric" />

          <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#059669' }]} onPress={saveThreshold}><Text style={s.btnTxt}>💾</Text></TouchableOpacity>

          <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#8e44ad' }]} onPress={invExportMenu}><Text style={s.btnTxt}>📤</Text></TouchableOpacity>

        </View>

      </View>



      {/* جستجو و فیلتر */}

      <TextInput accessibilityLabel="🔍 جستجو: کد، نام، قفسه..." style={[s.inp, { marginTop: 10, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو: کد، نام، قفسه..." placeholderTextColor={C.textMut} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>

        {[{ k: 'all', l: '📋 همه' }, { k: 'negative', l: '⚫ منفی' }, { k: 'out', l: '🔴 ناموجود' }, { k: 'low', l: '⚠️ کمبود' }, { k: 'ok', l: '✅ سالم' }].map((f) => (

          <TouchableOpacity key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}><Text style={[s.chipTxt, filter === f.k && s.chipTxtActive]}>{f.l}</Text></TouchableOpacity>

        ))}

      </ScrollView>



      <EL text="📦 موجودی ({toFaNum(filtered.length)})" style={s.secT} />



      {/* ⭐ جدول ردیفی */}

      <ScrollView horizontal showsHorizontalScrollIndicator>

        <View>

          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>

            <Text style={[s.thCell, { width: 40, fontSize: 12, fontWeight: 'bold' }]}>#</Text>

            <Text style={[HDR.cell, { width: 100 }]}>کد</Text>

            <EL textKey="نام مدل" style={[s.thCell, { width: 180 }]} />

            <Text style={[HDR.cell, { width: 80 }]}>خرید</Text>

            <Text style={[HDR.cell, { width: 80 }]}>فروش</Text>

            <Text style={[HDR.cell, { width: 90 }]}>موجودی</Text>

            <Text style={[HDR.cell, { width: 110 }]}>بهای واحد</Text>

            <Text style={[HDR.cell, { width: 130 }]}>ارزش کل</Text>

            <View style={[s.thCell, { width: 110, alignItems: 'center' }]}><Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 11 }}>⚖️ تعدیل</Text></View>

            <Text style={[HDR.cell, { width: 110 }]}>آخرین فروش</Text>

            <Text style={[HDR.cell, { width: 100 }]}>روز از فروش</Text>

            <Text style={[HDR.cell, { width: 120 }]}>قفسه</Text>

            <Text style={[HDR.cell, { width: 110 }]}>وضعیت</Text>

            <Text style={[HDR.cell, { width: 140 }]}>عملیات</Text>

          </View>

          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((m: any, i: number) => {

            const rowBg = m.status === 'negative' ? (C.isDark ? '#1e293b' : '#f1f5f9') : m.status === 'out' ? (C.isDark ? '#3b1219' : '#fef2f2') : m.status === 'low' ? (C.isDark ? '#3b2a12' : '#fffbeb') : (i % 2 === 0 ? C.cardAlt : 'transparent');

            return (<>

              <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: rowBg, borderRightWidth: 3, borderRightColor: statusColor(m.status) }]}>

                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>

                <TouchableOpacity onPress={() => openModelKardex(m)} style={[s.tdCell, { width: 100 }]}><Text style={{ color: '#7c3aed', fontWeight: 'bold', textDecorationLine: 'underline' }}>{m.code}</Text></TouchableOpacity>

                <Text style={[s.tdCell, { width: 180, fontSize: 12, color: C.text, textAlign: 'right', fontWeight: 'bold' }]} numberOfLines={1}>{m.name}</Text>

                <Text style={[s.tdCell, { width: 80, fontSize: 12, color: C.text }]}>{fmt(m.bought)}</Text>

                <Text style={[s.tdCell, { width: 80, fontSize: 12, color: C.text }]}>{fmt(m.sold)}</Text>

                <Text style={[s.tdCell, { width: 90, fontSize: 12, color: statusColor(m.status), fontWeight: 'bold', fontSize: 15 }]}>{fmt(m.currentQty)}</Text>

                <Text style={[s.tdCell, { width: 110, fontSize: 12, color: '#0891b2', fontSize: 11 }]}>{fmt(m.unitCost || 0)}</Text>

                <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#059669', fontWeight: 'bold', fontSize: 11 }]}>{fmt(m.totalValue || 0)}</Text>

                <TouchableOpacity onPress={() => openAdjustment(m)} style={[s.tdCell, { width: 110, alignItems: 'center' }]}>

                  <View style={{ backgroundColor: (m.adjustment || 0) === 0 ? '#fef3c7' : (m.adjustment || 0) > 0 ? '#d1fae5' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: (m.adjustment || 0) === 0 ? '#f59e0b' : (m.adjustment || 0) > 0 ? '#059669' : '#dc2626', minWidth: 50, alignItems: 'center' }}>

                    <Text style={{ color: (m.adjustment || 0) === 0 ? '#92400e' : (m.adjustment || 0) > 0 ? '#065f46' : '#991b1b', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>

                      {(m.adjustment || 0) === 0 ? '➕' : ((m.adjustment || 0) > 0 ? '+' : '') + fmt(m.adjustment)}

                    </Text>

                  </View>

                </TouchableOpacity>

                <Text style={[s.tdCell, { width: 110, fontSize: 12, color: '#64748b', fontSize: 10 }]}>{m.lastSaleDate ? (displayDateOnly ? displayDateOnly(m.lastSaleDate) : m.lastSaleDate.slice(0,10)) : '—'}</Text>

                <Text style={[s.tdCell, { width: 100, fontSize: 12, color: (m.daysSinceLastSale !== null && m.daysSinceLastSale > 90) ? '#dc2626' : (m.daysSinceLastSale !== null && m.daysSinceLastSale > 60) ? '#f59e0b' : '#059669', fontWeight: 'bold', fontSize: 11 }]}>{m.daysSinceLastSale !== null ? toFaNum(m.daysSinceLastSale) : '—'}</Text>

                <TouchableOpacity style={{ width: 120, alignItems: 'center', paddingVertical: 4 }} onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }}>

                  <View style={{ backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>

                    <Text style={{ color: '#075985', fontSize: 11, fontWeight: 'bold' }}>📍 {m.shelf || 'ثبت نشده'}</Text>

                  </View>

                </TouchableOpacity>

                <View style={[s.tdCell, { width: 110, alignItems: 'center' }]}>

                  <Text style={{ color: statusColor(m.status), fontSize: 11, fontWeight: 'bold' }}>{statusLabel(m.status)}</Text>

                </View>

                <TouchableOpacity onPress={() => openAdjustment(m)} style={[s.tdCell, { width: 40, alignItems: 'center' }]}><Text style={{ fontSize: 18 }}>⚖️</Text></TouchableOpacity>

                <TouchableOpacity onPress={() => { setEditItem(m); setShelfVal(m.shelf || ''); }} style={[s.tdCell, { width: 100, alignItems: 'center' }]}>

                  <View style={{ backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>

                    <EL textKey="📍 قفسه" style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }} />

                  </View>

                </TouchableOpacity>

              </View>

            

      <Modal visible={adjModal} transparent animationType="slide" onRequestClose={() => setAdjModal(false)}>

        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 12 }}>

          <View style={{ backgroundColor: '#ffffff', borderRadius: 12, maxHeight: '92%', overflow: 'hidden' }}>

            <View style={{ backgroundColor: '#0f2438', padding: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>

              <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>⚖️ تعدیل موجودی — {adjModel?.name || adjModel?.code || ''}</Text>

              <TouchableOpacity onPress={() => setAdjModal(false)}><Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>×</Text></TouchableOpacity>

            </View>

            <ScrollView style={{ padding: 12 }}>

              {/* Info */}

              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, padding: 8, backgroundColor: '#f8fafc', borderRadius: 6, marginBottom: 10 }}>

                <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 11 }}>📦 موجودی فعلی: {fmt(adjModel?.currentQty || 0)}</Text>

                <Text style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: 11 }}>📊 مجموع تعدیلات: {(adjModel?.adjustment || 0) > 0 ? '+' : ''}{fmt(adjModel?.adjustment || 0)}</Text>

              </View>

              {/* Form */}

              <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 12, textAlign: 'right', marginBottom: 4 }}>نوع تعدیل</Text>

              <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 8 }}>

                <TouchableOpacity onPress={() => setAdjForm({ ...adjForm, type: 'in' })} style={{ flex: 1, padding: 10, borderRadius: 6, backgroundColor: adjForm.type === 'in' ? '#059669' : '#e2e8f0', alignItems: 'center' }}>

                  <Text style={{ color: adjForm.type === 'in' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 12 }}>➕ افزایشی</Text>

                </TouchableOpacity>

                <TouchableOpacity onPress={() => setAdjForm({ ...adjForm, type: 'out' })} style={{ flex: 1, padding: 10, borderRadius: 6, backgroundColor: adjForm.type === 'out' ? '#dc2626' : '#e2e8f0', alignItems: 'center' }}>

                  <Text style={{ color: adjForm.type === 'out' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 12 }}>➖ کاهشی</Text>

                </TouchableOpacity>

              </View>

              <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 12, textAlign: 'right', marginBottom: 4 }}>مقدار تعدیل</Text>

              <TextInput style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10, fontSize: 13, textAlign: 'right', marginBottom: 8 }} value={String(adjForm.amount)} onChangeText={(v: string) => setAdjForm({ ...adjForm, amount: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholder="مثلاً 5" placeholderTextColor="#94a3b8" />

              <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 12, textAlign: 'right', marginBottom: 4 }}>دلیل</Text>

              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>

                {['شمارش فیزیکی', 'شکستگی', 'گم شدن', 'خرابی', 'برگشت از مشتری', 'سایر'].map((r: string) => (

                  <TouchableOpacity key={r} onPress={() => setAdjForm({ ...adjForm, reason: r })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: adjForm.reason === r ? '#7c3aed' : '#ffffff' }}>

                    <Text style={{ color: adjForm.reason === r ? '#fff' : '#475569', fontSize: 11, fontWeight: 'bold' }}>{r}</Text>

                  </TouchableOpacity>

                ))}

              </View>

              <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 12, textAlign: 'right', marginBottom: 4 }}>تاریخ</Text>

              <DateField value={adjForm.adjustment_date || ''} onChange={(v: string) => setAdjForm({ ...adjForm, adjustment_date: v })} compact />

              <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 12, textAlign: 'right', marginTop: 8, marginBottom: 4 }}>یادداشت</Text>

              <TextInput style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10, fontSize: 12, textAlign: 'right', minHeight: 50, marginBottom: 10 }} value={adjForm.note || ''} onChangeText={(v: string) => setAdjForm({ ...adjForm, note: v })} multiline placeholder="اختیاری" placeholderTextColor="#94a3b8" />

              <TouchableOpacity onPress={submitAdjustment} style={{ backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}>

                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>💾 ثبت تعدیل</Text>

              </TouchableOpacity>

              {/* Recent adjustments */}

              <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 12, textAlign: 'right', marginBottom: 6 }}>📋 تعدیلات اخیر ({adjList.length})</Text>

              {adjLoading ? (

                <ActivityIndicator color="#d4af37" style={{ marginVertical: 20 }} />

              ) : adjList.length === 0 ? (

                <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>تعدیلی ثبت نشده</Text>

              ) : (

                <View>

                  <View style={{ flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6 }}>

                    <Text style={{ width: 30, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>#</Text>

                    <Text style={{ width: 90, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>

                    <Text style={{ width: 90, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>مقدار</Text>

                    <Text style={{ flex: 1, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'right', paddingRight: 4 }}>دلیل</Text>

                    <Text style={{ width: 50, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>حذف</Text>

                  </View>

                  {adjList.map((r: any, i: number) => (

                    <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f8fafc' : '#ffffff', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center' }}>

                      <Text style={{ width: 30, fontSize: 10, textAlign: 'center' }}>{i + 1}</Text>

                      <Text style={{ width: 90, fontSize: 10, textAlign: 'center' }}>{displayDateOnly ? displayDateOnly(r.adjustment_date || r.created_at) : '—'}</Text>

                      <Text style={{ width: 90, fontSize: 11, textAlign: 'center', fontWeight: 'bold', color: (Number(r.adjustment) || 0) > 0 ? '#059669' : '#dc2626' }}>{(Number(r.adjustment) || 0) > 0 ? '+' : ''}{fmt(Number(r.adjustment) || 0)}</Text>

                      <Text style={{ flex: 1, fontSize: 10, textAlign: 'right', paddingRight: 4, color: '#475569' }} numberOfLines={1}>{r.reason || '—'}{r.note ? ' — ' + r.note : ''}</Text>

                      <TouchableOpacity onPress={() => removeAdjustment(r.local_id || r.id)} style={{ width: 50, alignItems: 'center' }}><Text style={{ fontSize: 14 }}>🗑️</Text></TouchableOpacity>

                    </View>

                  ))}

                </View>

              )}

            </ScrollView>

          </View>

        </View>

      </Modal>

      <Modal visible={modelKardexModal} transparent animationType="slide" onRequestClose={() => setModelKardexModal(false)}>

        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 }}>

          <View style={{ backgroundColor: '#ffffff', borderRadius: 12, maxHeight: '92%', overflow: 'hidden' }}>

            <View style={{ backgroundColor: '#0f2438', padding: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>

              <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>📋 کاردکس مدل: {modelKardexData?.name || modelKardexCode}</Text>

              <TouchableOpacity onPress={() => setModelKardexModal(false)}><Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>×</Text></TouchableOpacity>

            </View>

            {modelKardexLoading ? (

              <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" size="large" /></View>

            ) : modelKardexData ? (

              <ScrollView style={{ padding: 10 }}>

                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, padding: 8, backgroundColor: '#f8fafc', borderRadius: 6, marginBottom: 8 }}>

                  <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 11 }}>📦 موجودی: {fmt((modelKardexData.purchases || []).reduce((a: number, r: any) => a + (Number(r.quantity) || 0), 0) - (modelKardexData.sales || []).reduce((a: number, r: any) => a + (Number(r.quantity) || 0), 0))}</Text>

                  <Text style={{ color: '#0891b2', fontWeight: 'bold', fontSize: 11 }}>🛒 خرید: {fmt((modelKardexData.purchases || []).reduce((a: number, r: any) => a + (Number(r.quantity) || 0), 0))}</Text>

                  <Text style={{ color: '#059669', fontWeight: 'bold', fontSize: 11 }}>🛍️ فروش: {fmt((modelKardexData.sales || []).reduce((a: number, r: any) => a + (Number(r.quantity) || 0), 0))}</Text>

                  <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 11 }}>💰 جمع فروش: {fmt((modelKardexData.sales || []).reduce((a: number, r: any) => a + ((Number(r.quantity) || 0) * (Number(r.price_unit) || 0)), 0))}</Text>

                </View>

                <TouchableOpacity onPress={modelKardexMenu} style={{ backgroundColor: '#8e44ad', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}>

                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>📤 خروجی (PDF / چاپ / اکسل)</Text>

                </TouchableOpacity>

                {(modelKardexData.purchases || []).length > 0 && (

                  <View style={{ marginBottom: 12 }}>

                    <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 13, textAlign: 'right', backgroundColor: '#eff6ff', padding: 6, borderRadius: 4, marginBottom: 4 }}>🛒 خریدها ({modelKardexData.purchases.length})</Text>

                    <ScrollView horizontal>

                      <View>

                        <View style={{ flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6 }}>

                          <Text style={{ width: 30, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>#</Text>

                          <Text style={{ width: 80, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>

                          <Text style={{ width: 90, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>

                          <Text style={{ width: 130, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>تأمین‌کننده</Text>

                          <Text style={{ width: 60, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>تعداد</Text>

                          <Text style={{ width: 80, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>قیمت</Text>

                          <Text style={{ width: 90, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>جمع</Text>

                        </View>

                        {modelKardexData.purchases.map((r: any, i: number) => (

                          <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f8fafc' : '#ffffff', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>

                            <Text style={{ width: 30, fontSize: 10, textAlign: 'center' }}>{i + 1}</Text>

                            <Text style={{ width: 80, fontSize: 10, textAlign: 'center' }}>{displayDateOnly ? displayDateOnly(r.date_factor || r.date_reg || r.created_at) : '—'}</Text>

                            <Text style={{ width: 90, fontSize: 10, textAlign: 'center', color: '#7c3aed' }}>{r.invoice_number || '—'}</Text>

                            <Text style={{ width: 130, fontSize: 10, textAlign: 'right', fontWeight: 'bold' }}>{r.supplier_name || r.payer_name || '—'}</Text>

                            <Text style={{ width: 60, fontSize: 10, textAlign: 'center' }}>{fmt(Number(r.quantity) || 0)}</Text>

                            <Text style={{ width: 80, fontSize: 10, textAlign: 'center' }}>{fmt(Number(r.price_unit) || 0)}</Text>

                            <Text style={{ width: 90, fontSize: 10, textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{fmt((Number(r.quantity) || 0) * (Number(r.price_unit) || 0))}</Text>

                          </View>

                        ))}

                      </View>

                    </ScrollView>

                  </View>

                )}

                {(modelKardexData.sales || []).length > 0 && (

                  <View>

                    <Text style={{ color: '#0f2438', fontWeight: 'bold', fontSize: 13, textAlign: 'right', backgroundColor: '#fef3c7', padding: 6, borderRadius: 4, marginBottom: 4 }}>🛍️ فروش‌ها ({modelKardexData.sales.length})</Text>

                    <ScrollView horizontal>

                      <View>

                        <View style={{ flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6 }}>

                          <Text style={{ width: 30, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>#</Text>

                          <Text style={{ width: 80, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>تاریخ</Text>

                          <Text style={{ width: 90, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>فاکتور</Text>

                          <Text style={{ width: 130, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>مشتری</Text>

                          <Text style={{ width: 60, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>تعداد</Text>

                          <Text style={{ width: 80, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>قیمت</Text>

                          <Text style={{ width: 90, color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>جمع</Text>

                        </View>

                        {modelKardexData.sales.map((r: any, i: number) => (

                          <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f8fafc' : '#ffffff', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>

                            <Text style={{ width: 30, fontSize: 10, textAlign: 'center' }}>{i + 1}</Text>

                            <Text style={{ width: 80, fontSize: 10, textAlign: 'center' }}>{displayDateOnly ? displayDateOnly(r.date_factor || r.date_reg || r.created_at) : '—'}</Text>

                            <Text style={{ width: 90, fontSize: 10, textAlign: 'center', color: '#7c3aed' }}>{r.invoice_number || '—'}</Text>

                            <Text style={{ width: 130, fontSize: 10, textAlign: 'right', fontWeight: 'bold' }}>{r.customer_name || '—'}</Text>

                            <Text style={{ width: 60, fontSize: 10, textAlign: 'center' }}>{fmt(Number(r.quantity) || 0)}</Text>

                            <Text style={{ width: 80, fontSize: 10, textAlign: 'center' }}>{fmt(Number(r.price_unit) || 0)}</Text>

                            <Text style={{ width: 90, fontSize: 10, textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{fmt((Number(r.quantity) || 0) * (Number(r.price_unit) || 0))}</Text>

                          </View>

                        ))}

                      </View>

                    </ScrollView>

                  </View>

                )}

                {(modelKardexData.purchases || []).length === 0 && (modelKardexData.sales || []).length === 0 && (

                  <Text style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>هیچ تراکنشی برای این مدل ثبت نشده</Text>

                )}

              </ScrollView>

            ) : null}

          </View>

        </View>

      </Modal>

    </>);

          })}

        </View>

      </ScrollView>



      {/* Modal قفسه */}

      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>

        <View style={s.modalBg}><View style={[s.modalBox, { backgroundColor: C.card }]}>

          <View style={[s.modalHead, { backgroundColor: '#7c3aed' }]}><EL text="📍 قفسه —" style={s.modalHeadTxt}>{editItem?.name}</EL><TouchableOpacity onPress={() => setEditItem(null)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity></View>

          <View style={{ padding: 16 }}>

            <Text style={[s.modalLbl, { color: C.textMut }]}>{t('کد:')} <Text style={[s.modalVal, { color: C.text }]}>{editItem?.code}</Text></Text>

            <Text style={[s.modalLbl, { color: C.textMut }]}>{t('موجودی:')} <Text style={[s.modalVal, { color: C.text }]}>{fmt(editItem?.currentQty || 0)} عدد</Text></Text>

            <EL textKey="موقعیت قفسه:" style={[s.modalLbl, { color: C.textMut }]} />

            <TextInput accessibilityLabel="مثلاً A-12" style={[s.modalInp, { color: C.text, borderColor: '#a78bfa' }]} value={shelfVal} onChangeText={setShelfVal} placeholder="مثلاً A-12" placeholderTextColor={C.textMut} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>

              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setEditItem(null)}><Text style={s.btnTxt}>{t('انصراف')}</Text></TouchableOpacity>

              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={saveShelf}><Text style={s.btnTxt}>{t('💾 ذخیره')}</Text></TouchableOpacity>

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

    { k: 'preset', l: '🎨 نوع کسب‌وکار' },

    

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

      {/* Settings moved to main tab */}

      {sub === 'preset' && <PresetSection showToast={showToast} />}

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

        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#334155' }]} onPress={load}><Text style={s.btnTxt}>{t('🔄 بروزرسانی')}</Text></TouchableOpacity>

        <TouchableOpacity accessibilityLabel="حذف" style={[s.btn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={del} disabled={!selected.size}><Text style={s.btnTxt}>🗑️ حذف ({toFaNum(selected.size)})</Text></TouchableOpacity>

      </View>

      <EL text="📄 پرداخت‌نشده ({toFaNum(list.length)})" style={s.secT} />



      {/* جدول ۸ ستونه */}

      <ScrollView horizontal showsHorizontalScrollIndicator>

        <View>

          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>

            <TouchableOpacity onPress={toggleAll} style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>

              <Text style={{ fontSize: 18 }}>{selected.size === list.length && list.length > 0 ? '✅' : '⬜'}</Text>

            </TouchableOpacity>

            <Text style={[s.thCell, { width: 40, fontSize: 12, fontWeight: 'bold' }]}>#</Text>

            <EL textKey="فاکتور" style={[s.thCell, { width: 150 }]} />

            <EL textKey="نام" style={[s.thCell, { width: 160 }]} />

            <EL textKey="تلفن" style={[s.thCell, { width: 120 }]} />

            <EL textKey="مبلغ کل" style={[s.thCell, { width: 130 }]} />

            <EL textKey="پرداخت" style={[s.thCell, { width: 130 }]} />

            <EL textKey="وضعیت" style={[s.thCell, { width: 120 }]} />

          </View>

          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : list.map((inv: any, i: number) => (

            <TouchableOpacity key={inv.invoice} onPress={() => toggle(inv.invoice)} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, selected.has(inv.invoice) && { backgroundColor: '#fee2e2' }]}>

              <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>

                <Text style={{ fontSize: 18 }}>{selected.has(inv.invoice) ? '✅' : '⬜'}</Text>

              </View>

              <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>

              <Text style={[s.tdCell, { width: 150, fontSize: 12, color: '#1e3a5f', fontWeight: 'bold', fontSize: 12 }]}>{inv.invoice}</Text>

              <Text style={[s.tdCell, { width: 160, fontSize: 12, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{inv.name || '—'}</Text>

              <Text style={[s.tdCell, { width: 120, fontSize: 12, color: C.textMut, fontSize: 11 }]}>{inv.phone || '—'}</Text>

              <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(inv.total)}</Text>

              <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(inv.paid)}</Text>

              <View style={[s.tdCell, { width: 120, alignItems: 'center' }]}>

                <EL textKey="❌ پرداخت‌نشده" style={{ backgroundColor: '#f8d7da', color: '#721c24', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 10, fontWeight: 'bold' }} />

              </View>

            </TouchableOpacity>

          ))}

        </View>

      </ScrollView>

      {!loading && !list.length && <EL textKey="✅ پرداخت‌نشده‌ای نیست" style={s.empty} />}

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

      await createSale({ invoiceNumber: inv, customerCode: code, customerName: name, customerPhone: phone, customerAddress: address, shipping, items: valid, receiverName, receiverCode, receiverBank, receiverAccount });

      alertMsg('✅ موفق', 'ثبت شد: ' + inv);

      setPhone(''); setName(''); setAddress(''); setShipping('');

      setItems([{ modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: toStorageDateFull(new Date()), bankName: '', accountHolder: '', accountHolderCode: '' }]);

      setInvoice(await generateInvoiceNumber());

    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); } finally { setSaving(false); }

  };



  return (

    <View>

      <EL text="{t('➕ سفارش جدید')}" style={s.formTitle} />

      <EL text="📞 تلفن {status}" style={[s.lbl, { color: C.textMut }]} />

      <TextInput accessibilityLabel="09121234567" style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={phone} onChangeText={onPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor={C.textMut} />

      <EL text="{t('👤 نام')}" style={[s.lbl, { color: C.textMut }]} />

      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={name} onChangeText={setName} placeholder={term('customer')} placeholderTextColor={C.textMut} />

      <EL text="{t('📍 آدرس')}" style={[s.lbl, { color: C.textMut }]} />

      <TextInput accessibilityLabel="اختیاری" style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={address} onChangeText={setAddress} placeholder="اختیاری" placeholderTextColor={C.textMut} />

      <Autocomplete label="🚚 باربری" value={shipping} onChange={setShipping} options={SHIPPINGS} placeholder="تایپ..." />

      <EL text="🧾 شماره فاکتور (خودکار)" style={[s.lbl, { color: C.textMut }]} />

      <TextInput style={[s.inp, { backgroundColor: C.cardAlt, color: C.textMut, borderColor: C.border }]} value={invoice} editable={false} />



      <EL text="{t('📦 اقلام')}" style={s.secT} />



      {items.map((it, i) => {

        const lt = (Number(it.quantity) || 0) * (Number(it.priceUnit) || 0);

        const lb = lt - (Number(it.payment) || 0);

        return (

          <View key={i} style={[s.itemCard, { backgroundColor: C.card, borderColor: C.border }]}>

            <View style={[s.itemHeader, { backgroundColor: C.cardAlt }]}>

              <Text style={s.itemN}>#{i + 1}</Text>

              <TouchableOpacity onPress={() => del(i)} style={s.delBtnRound}><Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>🗑</Text></TouchableOpacity>

            </View>

            <View style={{ padding: 10 }}>

              <Autocomplete value={it.modelName} onChange={(v) => upd(i, 'modelName', v)} onSelect={(v) => setModel(i, v)} options={prods.map(p => p.name)} placeholder={term('product') + '...'} />

              <View style={{ flexDirection: 'row-reverse', gap: 6 }}>

                <View style={{ flex: 1 }}><EL textKey="کد" style={[s.miniLbl, { color: C.textMut }]} /><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}><Text style={[s.miniValueTxt, { color: C.text }]}>{it.modelCode || '—'}</Text></View></View>

                <View style={{ flex: 1 }}><EL textKey="تعداد" style={[s.miniLbl, { color: C.textMut }]} /><TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.quantity || '')} onChangeText={(v) => upd(i, 'quantity', parseInt(v) || 0)} keyboardType="numeric" /></View>

                <View style={{ flex: 1 }}><EL textKey="قیمت" style={[s.miniLbl, { color: C.textMut }]} /><TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.priceUnit || '')} onChangeText={(v) => upd(i, 'priceUnit', parseNum(v))} keyboardType="numeric" /></View>

              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>

                <View style={{ flex: 1 }}><EL textKey="💰 مبلغ" style={[s.miniLbl, { color: C.textMut }]} /><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: lt ? '#00ff88' : C.border }]}><Text style={[s.miniValueTxt, { color: lt ? '#00ff88' : C.textMut }]}>{lt ? fmt(lt) : '—'}</Text></View></View>

                <View style={{ flex: 1 }}><EL textKey="پرداخت" style={[s.miniLbl, { color: C.textMut }]} /><TextInput style={[s.miniInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(it.payment || '')} onChangeText={(v) => upd(i, 'payment', parseNum(v))} keyboardType="numeric" /></View>

                <View style={{ flex: 1 }}><EL textKey="⚖️ مانده" style={[s.miniLbl, { color: C.textMut }]} /><View style={[s.miniValueBox, { backgroundColor: C.cardAlt, borderColor: lb > 0 ? '#dc2626' : '#059669' }]}><Text style={[s.miniValueTxt, { color: lb > 0 ? '#dc2626' : '#059669' }]}>{lt ? fmt(lb) : '—'}</Text></View></View>

              </View>

            </View>

          </View>

        );

      })}



      <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>{t('➕ افزودن ردیف')}</Text></TouchableOpacity>

      <View style={s.grandSummary}>

        <View style={{ flex: 1 }}><EL textKey="💰 جمع کل" style={s.gsLbl} /><Text style={s.gsVal}>{fmt(grandTotal)}</Text></View>

        <View style={{ alignItems: 'center' }}><EL textKey="📦 تعداد" style={s.gsLbl} /><Text style={s.gsQty}>{toFaNum(grandQty)}</Text></View>

      </View>

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]} onPress={submit} disabled={saving}>

        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{t('✅ ثبت سفارش')}</Text>}

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
  const [showInvoice, setShowInvoice] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [banksList, setBanksList] = useState<any[]>([]);
  const [shippingsList, setShippingsList] = useState<any[]>([]);
  const [partiesList, setPartiesList] = useState<any[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  useEffect(() => {
    getBanks().then(setBanksList).catch(()=>{});
    getShippings().then(setShippingsList).catch(()=>{});
    getParties().then(setPartiesList).catch(()=>{});
    getPartners().then(setPartnersList).catch(()=>{});
  }, []);

  const onHolderPick = async (i: number, v: string) => {
    updRow(i, 'accountHolder', v);
    try {
      const f = await lookupPayerUniversal(v);
      if (f) {
        updRow(i, 'accountHolderCode', f.code || '');
        if (f.bank) updRow(i, 'bankName', f.bank);
      }
    } catch {}
  };



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

      const rows = await getInvoiceDetail(inv, type === 'sales' ? 'sales' : 'purchase');

      if (!rows.length) { showToast('فاکتور پیدا نشد', true); return; }

      const isSales = type === 'sales';

      setEditRows(rows.map((r: any) => ({

        rowId: r.id,

        modelCode: r.model_code || '',

        modelName: r.model_name || '',

        quantity: r.quantity || 0,

        priceUnit: r.price_unit || 0,

        payment: r.payment || 0,

        description: r.description || '',

        depositDate: r.deposit_date || '',

        bankName: r.bank_name || r.receiver_bank || '',
        accountHolder: r.account_holder || r.receiver_name || '',
        accountHolderCode: isSales ? (r.account_holder_code || r.receiver_code || '') : (r.payer_code || ''),

        shipping: isSales ? (r.shipping || '') : '',

        _deleted: false,

      })));

      setEditing({
        invoice: inv,
        type,
        name: isSales ? rows[0].customer_name : rows[0].supplier_name,
        code: isSales ? rows[0].customer_code : rows[0].supplier_code,
        phone: isSales ? (rows[0].customer_phone || '') : (rows[0].supplier_phone || ''),
        manualInv: isSales ? '' : (rows[0].manual_invoice || ''),
      });

      setDirty(false);

    } catch (e: any) { showToast(e.message || 'خطا در باز کردن فاکتور', true); }

  };



  const delRow = (i: number) => { const n = [...editRows]; n[i]._deleted = !n[i]._deleted; setEditRows(n); setDirty(true); };

  const addRow = () => { setEditRows([...editRows, { rowId: null, modelCode: '', modelName: '', quantity: 0, priceUnit: 0, payment: 0, description: '', depositDate: toStorageDateFull(new Date()), bankName: '', accountHolder: '', accountHolderCode: '', shipping: '', _deleted: false, _new: true }]); setDirty(true); };

  const updRow = (i: number, f: string, v: any) => { const n = [...editRows]; (n[i] as any)[f] = v; setEditRows(n); setDirty(true); };



  const previewInvoice = async () => {
    const validRows = editRows.filter((r: any) => !r._deleted);
    if (!validRows.length) { showToast('هیچ ردیفی برای نمایش نیست', true); return; }
    const items = validRows.map((r: any) => ({
      modelName: r.modelName || '',
      modelCode: r.modelCode || '',
      quantity: Number(r.quantity) || 0,
      priceUnit: Number(r.priceUnit) || 0,
      total: (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0),
    }));
    const sales = items.reduce((a: number, it: any) => a + it.total, 0);
    const payments = validRows.reduce((a: number, r: any) => a + (Number(r.payment) || 0), 0);
    let prev: any = { sales: 0, payments: 0, balance: 0, invoiceCount: 0 };
    try { prev = await getCustomerPreviousBalance(editing.code, editing.invoice); } catch {}
    setShowInvoice({
      customer: {
        code: editing.code,
        name: editing.name,
        phone: editing.phone || '',
        address: '',
        shipping: validRows[0]?.shipping || '',
      },
      current: {
        invoiceNumber: editing.invoice,
        items,
        sales,
        payments,
        balance: sales - payments,
      },
      previous: prev,
      totals: {
        sales: (prev.sales || 0) + sales,
        payments: (prev.payments || 0) + payments,
        balance: (prev.balance || 0) + (sales - payments),
      },
      timeString: displayDate(new Date().toISOString()),
    });
  };

  const save = async () => {

    if (!dirty) return showToast('تغییری نیست', true);

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {

      const tbl = editing.type === 'sales' ? 'sales' : 'purchases';

      

      // چک کن اگه فاکتور توی صف آفلاین هست

      const anyPending = editRows.some((r: any) => r.rowId && String(r.rowId).startsWith('queued_'));

      

      if (anyPending) {

        const ok = await updateInvoiceInQueue(editing.invoice, editing.type, editRows);

        if (!ok) throw new Error('فاکتور آفلاین پیدا نشد');

        alertMsg('✅ موفق', 'تغییرات روی فاکتور آفلاین ذخیره شد');

        setEditing(null); setEditRows([]); setDirty(false); load();

        return;

      }

      // ═══ ذخیره فاکتور سینک‌شده (آفلاین یا آنلاین) ═══
      const validRows = editRows.filter((r: any) => !r._deleted);
      const newTotal = validRows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0), 0);
      const newPaid = validRows.reduce((a: number, r: any) => a + (Number(r.payment) || 0), 0);
      const meta: any = editing.type === 'sales'
        ? { name: editing.name, code: editing.code, phone: editing.phone, shipping: editRows[0]?.shipping || '' }
        : { name: editing.name, code: editing.code, phone: editing.phone, manualInv: editing.manualInv, payerName: editRows[0]?.accountHolder || '', payerCode: editRows[0]?.accountHolderCode || '' };

      if (editing.type === 'sales') {
        await updateSale({ invoiceNumber: editing.invoice, rows: editRows, meta });
      } else {
        await updatePurchase({ invoiceNumber: editing.invoice, rows: editRows, meta });
      }

      // آپدیت فوری لیست محلی
      setList((prev: any[]) => prev.map((x: any) => x.invoice === editing.invoice
        ? { ...x, total: newTotal, paid: newPaid, name: editing.name, phone: editing.phone }
        : x));

      

      

      alertMsg('✅ موفق', 'تغییرات ذخیره شد');

      setEditing(null); setEditRows([]); setDirty(false); load();

    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { savingRef.current = false; setSaving(false); }

  };



  const remove = async (inv: string, type: string) => {
    const ok = await confirmMsg('حذف', 'فاکتور ' + inv + ' حذف شود؟');
    if (!ok) return;
    try {
      if (type === 'sales') {
        await deleteSale(inv);
      } else {
        await deletePurchase(inv);
      }
      showToast('✅ حذف شد');
      load();
    } catch (e: any) { showToast(e.message || 'خطا در حذف', true); }
  };



  // ═══ حالت ویرایش ═══

    if (showInvoice) return (
    <View style={{ flex: 1, overflow: 'hidden' }}><InvoiceView
      invoice={showInvoice}
      onBack={() => { setShowInvoice(null); load(); }}
      onNew={() => { setShowInvoice(null); setEditing(null); setEditRows([]); setDirty(false); }}
      showToast={showToast}
    /></View>
  );

  if (editing) return (

    <View>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        <View style={[s.mgrHead, { backgroundColor: '#c0392b' }]}>

          <TouchableOpacity onPress={async () => { if (dirty) { const ok = await confirmMsg('خروج', 'تغییرات ذخیره نشده — خارج شوی؟'); if (!ok) return; } setEditing(null); setEditRows([]); setDirty(false); }}>

            <EL textKey="← بازگشت" style={{ color: '#fff', fontSize: 16 }} />

          </TouchableOpacity>

          <View style={{ flex: 1, marginRight: 10 }}>

            <Text style={s.mgrHeadTxt}>✏️ {editing.invoice}</Text>

            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.9 }}>{editing.name} | {editing.code} | {toFaNum(editRows.length)} ردیف</Text>

          </View>

        </View>



        <ScrollView horizontal showsHorizontalScrollIndicator>

          <View>

            <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>

              <Text style={[s.thCell, { width: 36, fontSize: 12, fontWeight: 'bold', textAlign: 'center' }]}>#</Text>

              <EL textKey="کد" style={[s.thCell, { width: 90, textAlign: 'center' }]} />

              <EL textKey="نام مدل" style={[s.thCell, { width: 180, textAlign: 'center' }]} />

              <EL textKey="تعداد" style={[s.thCell, { width: 80, textAlign: 'center' }]} />

              <EL textKey="قیمت" style={[s.thCell, { width: 110, textAlign: 'center' }]} />

              <EL textKey="مبلغ" style={[s.thCell, { width: 100, textAlign: 'center' }]} />

              <EL textKey="پرداخت" style={[s.thCell, { width: 100, textAlign: 'center' }]} />

              <EL textKey="مانده" style={[s.thCell, { width: 100, textAlign: 'center' }]} />

             <EL textKey="تاریخ واریز" style={[s.thCell, { width: 340, textAlign: 'center' }]} />

              <EL textKey="بانک" style={[s.thCell, { width: 100, textAlign: 'center' }]} />

              <EL textKey="صاحب حساب" style={[s.thCell, { width: 130, textAlign: 'center' }]} />

              <EL textKey="کد صاحب حساب" style={[s.thCell, { width: 110, textAlign: 'center' }]} />

              <EL textKey="شرح" style={[s.thCell, { width: 140, textAlign: 'center' }]} />

              {editing.type === 'sales' && <EL textKey="باربری" style={[s.thCell, { width: 130, textAlign: 'center' }]} />}

              <EL textKey="حذف" style={[s.thCell, { width: 56, textAlign: 'center' }]} />

            </View>

            {editRows.map((r, i) => {

              const lt = (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0);

              const lb = lt - (Number(r.payment) || 0);

              return (

                <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }, r._deleted && { opacity: 0.4 }, r._new && { backgroundColor: C.isDark ? '#2e1065' : '#f5f3ff' }]}>

                  <Text style={[s.tdCell, { width: 36, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>

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

                      placeholder={term('product') + '...'}

                    />

                  </View>

                  <View style={{ width: 80, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.quantity || '')} onChangeText={(v) => updRow(i, 'quantity', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>

                  <View style={{ width: 110, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.priceUnit || '')} onChangeText={(v) => updRow(i, 'priceUnit', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>

                  <Text style={[s.tdCell, { width: 100, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{lt ? fmt(lt) : '—'}</Text>

                  <View style={{ width: 100, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(r.payment || '')} onChangeText={(v) => updRow(i, 'payment', parseNum(v))} keyboardType="numeric" editable={!r._deleted} /></View>

                  <Text style={[s.tdCell, { width: 100, fontSize: 12, color: lb > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{lt ? fmt(lb) : '—'}</Text>

                                  <View style={{ width: 340, paddingHorizontal: 3 }}><DateField value={r.depositDate} onChange={(v: string) => updRow(i, 'depositDate', v)} compact /></View>

                                                     <View style={{ width: 100, paddingHorizontal: 2 }}>
                    <CellAutocomplete
                      value={r.bankName}
                      onChange={(v: string) => updRow(i, 'bankName', v)}
                      options={banksList.map((b: any) => b.name)}
                      placeholder="بانک"
                    />
                  </View>

                                  <View style={{ width: 130, paddingHorizontal: 2 }}>
                    <CellAutocomplete
                      value={r.accountHolder}
                      onChange={(v: string) => updRow(i, 'accountHolder', v)}
                      onSelect={async (v: string) => {
                        try {
                          const f = await lookupPayerUniversal(v);
                          if (f) {
                            updRow(i, 'accountHolderCode', f.code || '');
                            if (f.bank) updRow(i, 'bankName', f.bank);
                          } else {
                            const code = await lookupCodeByName(v);
                            updRow(i, 'accountHolderCode', code);
                          }
                        } catch {}
                      }}
                      options={Array.from(new Set([
                        ...partiesList.map((p:any)=>p.name).filter(Boolean),
                        ...partnersList.map((p:any)=>p.name).filter(Boolean),
                        ...prods.map((p: any) => p.supplier_name || '').filter(Boolean)
                      ]))}
                      placeholder="صاحب حساب"
                    />
                  </View>

                  <View style={{ width: 110, paddingHorizontal: 2 }}>
                    <TextInput accessibilityLabel="خودکار"
                      style={[s.tdInput, { backgroundColor: C.cardAlt, color: '#059669', borderColor: C.border, fontWeight: 'bold', textAlign: 'center', height: 34, fontSize: 11, paddingVertical: 0 }]}
                      value={r.accountHolderCode || ''}
                      editable={false}
                      placeholder="خودکار"
                    />
                  </View>

                  <View style={{ width: 140, paddingHorizontal: 3 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={r.description} onChangeText={(v) => updRow(i, 'description', v)} editable={!r._deleted} /></View>

                  {editing.type === 'sales' && (

                                      <View style={{ width: 130, paddingHorizontal: 2 }}>
                    <CellAutocomplete
                      value={r.shipping}
                      onChange={(v: string) => updRow(i, 'shipping', v)}
                      options={shippingsList.map((s: any) => s.name)}
                      placeholder="باربری"
                    />
                  </View>

                  )}

                  <TouchableOpacity onPress={() => delRow(i)} style={[s.tdCell, { width: 56, alignItems: 'center' }]}><Text style={{ fontSize: 18 }}>{r._deleted ? '↺' : '🗑'}</Text></TouchableOpacity>

                </View>

              );

            })}

          </View>

        </ScrollView>



        <TouchableOpacity style={s.addBtn2} onPress={addRow}><Text style={s.btnTxt}>{t('➕ افزودن ردیف')}</Text></TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>

          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => { setEditing(null); setEditRows([]); }}><Text style={s.btnTxt}>{t('↩️ برگشت')}</Text></TouchableOpacity>

          <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#8e44ad' }]} onPress={previewInvoice}><Text style={s.btnTxt}>{t('🖨️ صدور مجدد')}</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { flex: 2, backgroundColor: '#059669' }]} onPress={save} disabled={saving}><Text style={s.btnTxt}>{t('💾 ذخیره')}</Text></TouchableOpacity>

        </View>

      </ScrollView>

    </View>

  );



  // ═══ حالت لیست ═══

  const typeLabel = (t: string) => t === 'purchases' ? '🛍️ خرید' : '🛒 فروش';

  const statusLabel = (total: number, paid: number) => paid >= total && total > 0 ? '✅ پرداخت‌شده' : paid > 0 ? '⏳ جزئی' : '❌ پرداخت‌نشده';

  const statusColorFn = (total: number, paid: number) => paid >= total && total > 0 ? '#059669' : paid > 0 ? '#f39c12' : '#dc2626';



  return (

    <View>

      <TextInput accessibilityLabel="🔍 فاکتور، نام، تلفن..." style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 فاکتور، نام، تلفن..." placeholderTextColor={C.textMut} />

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

      <EL text="📄 نتایج ({toFaNum(filtered.length)})" style={s.secT} />



      {/* جدول ۱۲ ستونه */}

      <ScrollView horizontal showsHorizontalScrollIndicator>

        <View>

          <View style={[s.tblHeader, { flexDirection: 'row-reverse' }]}>

            <Text style={[s.thCell, { width: 40, fontSize: 12, fontWeight: 'bold' }]}>#</Text>

            <EL textKey="فاکتور" style={[s.thCell, { width: 150 }]} />

            <EL textKey="نوع" style={[s.thCell, { width: 100 }]} />

            <EL textKey="نام" style={[s.thCell, { width: 150 }]} />

            <EL textKey="تلفن" style={[s.thCell, { width: 120 }]} />

            <EL textKey="تاریخ" style={[s.thCell, { width: 130 }]} />

            <EL textKey="ردیف" style={[s.thCell, { width: 70 }]} />

            <EL textKey="مبلغ" style={[s.thCell, { width: 130 }]} />

            <EL textKey="پرداخت" style={[s.thCell, { width: 130 }]} />

            <EL textKey="مانده" style={[s.thCell, { width: 130 }]} />

            <EL textKey="وضعیت" style={[s.thCell, { width: 130 }]} />

            <EL textKey="عملیات" style={[s.thCell, { width: 120 }]} />

          </View>

          {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.slice(0, 200).map((r: any, i: number) => (

            <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>

              <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>

              <Text style={[s.tdCell, { width: 150, fontSize: 12, color: '#1e3a5f', fontWeight: 'bold', fontSize: 12 }]}>{r.invoice}</Text>

              <View style={[s.tdCell, { width: 100, alignItems: 'center' }]}>

                <Text style={{ backgroundColor: r.type === 'purchases' ? '#fce7f3' : '#dbeafe', color: r.type === 'purchases' ? '#9d174d' : '#1e40af', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 10, fontWeight: 'bold' }}>{typeLabel(r.type)}</Text>

              </View>

              <Text style={[s.tdCell, { width: 150, fontSize: 12, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name || '—'}</Text>

              <Text style={[s.tdCell, { width: 120, fontSize: 12, color: C.textMut, fontSize: 11 }]}>{r.phone || '—'}</Text>

              <Text style={[s.tdCell, { width: 130, fontSize: 12, color: C.text, fontSize: 11 }]}>{displayDateOnly(r.date)}</Text>

              <Text style={[s.tdCell, { width: 70, fontSize: 12, color: C.text }]}>{toFaNum(r.rowCount || r.items?.length || 0)}</Text>

              <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(r.total)}</Text>

              <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.paid)}</Text>

              <Text style={[s.tdCell, { width: 130, fontSize: 12, color: r.total - r.paid > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{fmt(r.total - r.paid)}</Text>

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

      {!loading && !filtered.length && (<View style={s.emptyState}><Text style={{ fontSize: 48, opacity: 0.5 }}>🔍</Text><EL textKey="نتیجه‌ای یافت نشد" style={s.emptyStateTxt} /></View>)}

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

      const locked = await isBusinessLocked();
      let sales: any[] = [];
      let purchases: any[] = [];
      if (locked) {
        sales = (await getSalesGrouped().catch(() => [])) || [];
        purchases = (await getPurchasesGrouped().catch(() => [])) || [];
      } else {
        const [sRes, pRes] = await Promise.all([
          supabase.from('sales').select('*'),
          supabase.from('purchases').select('*'),
        ]);
        sales = sRes.data || [];
        purchases = pRes.data || [];
      }



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

      <EL text="{t('📊 نوع گزارش')}" style={s.secT} />

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

                <Text style={[s.thCell, { width: 40, fontSize: 12, fontWeight: 'bold' }]}>#</Text>

                {data.columns.map((c: string, j: number) => (

                  <Text key={j} style={[s.thCell, { width: 140 }]}>{c}</Text>

                ))}

              </View>

              {data.rows.slice(0, 200).map((r: any, i: number) => (

                <View key={i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>

                  <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>

                  {type === 'debtors' && <>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#7c3aed', fontWeight: 'bold' }]}>{r.code}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.textMut }]}>{r.phone || '—'}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(r.total)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.paid)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(r.balance)}</Text>

                  </>}

                  {type === 'creditors' && <>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#7c3aed', fontWeight: 'bold' }]}>{r.code}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.textMut }]}>{r.phone || '—'}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(r.total)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.paid)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(r.balance)}</Text>

                  </>}

                  {(type === 'sales24h' || type === 'purchases24h') && <>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#7c3aed', fontWeight: 'bold' }]}>{r.invoice_number}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.customer_name || r.supplier_name}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.textMut }]}>{r.customer_phone || r.supplier_phone || '—'}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt((Number(r.quantity) || 0) * (Number(r.price_unit) || 0))}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.payment || 0)}</Text>

                  </>}

                  {type === 'inventory' && <>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: '#7c3aed', fontWeight: 'bold' }]}>{r.code}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.text, textAlign: 'right' }]} numberOfLines={1}>{r.name}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.text }]}>{fmt(r.bought)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.text }]}>{fmt(r.sold)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: r.currentQty < 0 ? '#dc2626' : '#00ff88', fontWeight: 'bold' }]}>{fmt(r.currentQty)}</Text>

                    <Text style={[s.tdCell, { width: 140, fontSize: 12, color: C.textMut }]}>{r.shelf || '—'}</Text>

                  </>}

                </View>

              ))}

            </View>

          </ScrollView>



          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>

            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#c0392b' }]} onPress={exportExcel}><Text style={s.btnTxt}>{t('📥 اکسل')}</Text></TouchableOpacity>

            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#059669' }]} onPress={load}><Text style={s.btnTxt}>{t('🔄 بروزرسانی')}</Text></TouchableOpacity>

          </View>

        </View>

      )}

    </View>

  );

}



// ══════════════════════════════════════════════════════════

//  SETTINGS SECTION

// ══════════════════════════════════════════════════════════

//  PRESET SECTION — انتخاب نوع کسب‌وکار

// ══════════════════════════════════════════════════════════

function PresetSection({ showToast }: any) {

  const [current, setCurrent] = useState<string>(getPreset());



  const applyPreset = async (k: string) => {

    try {

      await setPreset(k as any);

      setCurrent(k);

      showToast('✅ ' + (PRESETS as any)[k].name);

      if ((globalThis as any).__reloadPreset) (globalThis as any).__reloadPreset();

    } catch (e: any) {

      showToast(e?.message || 'خطا', true);

    }

  };



  return (

    <View>

      <EL text="🎨 نوع کسب‌وکار" style={s.formTitle} />

      <Text style={[s.lbl, { color: C.textMut, textAlign: 'center', marginBottom: 16 }]}>

        با انتخاب هرکدام، واژه‌های برنامه تغییر می‌کنند

      </Text>



      {Object.values(PRESETS).map((p: any) => {

        const active = current === p.key;

        return (

          <TouchableOpacity

            key={p.key}

            onPress={() => applyPreset(p.key)}

            style={[s.customerCard, {

              backgroundColor: active ? (C.isDark ? '#064e3b' : '#ecfdf5') : C.card,

              borderColor: active ? '#059669' : C.border,

              borderWidth: 2,

              marginBottom: 10,

            }]}

          >

            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>

              <Text style={{ fontSize: 34 }}>{p.icon}</Text>

              <View style={{ flex: 1 }}>

                <Text style={[s.customerCardTitle, {

                  color: C.text,

                  borderBottomWidth: 0,

                  marginBottom: 0,

                  paddingBottom: 0,

                }]}>

                  {p.name}

                </Text>

                <Text style={{ color: C.textMut, fontSize: 11, marginTop: 4, textAlign: 'right' }}>

                  {p.terms.product} • {p.terms.customer} • {p.terms.sale}

                </Text>

              </View>

              {active ? <Text style={{ color: '#059669', fontSize: 22 }}>✅</Text> : null}

            </View>

          </TouchableOpacity>

        );

      })}



      <Text style={[s.lblS, { color: C.textMut, textAlign: 'center', marginTop: 12 }]}>

        💡 پس از انتخاب، برنامه خودکار دوباره بارگذاری می‌شود

      </Text>

    </View>

  );

}



// ══════════════════════════════════════════════════════════

function SettingsSection({ showToast, settings, setSettings, reload }: any) {
  const [saving, setSaving] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

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

  const [lastBackupLabel, setLastBackupLabel] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const last = await getLastAutoBackup();
        setLastBackupLabel(last);
      } catch (e) { console.log('[backup] read last err:', e); }
      try {
        await autoBackup();
        const last2 = await getLastAutoBackup();
        setLastBackupLabel(last2);
      } catch (e) { console.log('[backup] auto err:', e); }
    })();
  }, []);

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
      const _sMode = getMode();
      alertMsg('✅ موفق', _sMode === 'offline' ? 'تنظیمات ذخیره شد و در صف آپلود قرار گرفت' : 'تنظیمات ذخیره شد');
      reload && reload();
    } catch (e: any) { alertMsg('❌ خطا', e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const emails: string[] = settings.emails || [];
  const addEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) return showToast('ایمیل معتبر نیست', true);
    setSettings({ ...settings, emails: [...emails, emailInput] });
    setEmailInput('');
  };
  const removeEmail = (i: number) => setSettings({ ...settings, emails: emails.filter((_, idx) => idx !== i) });
  const toggleDay = (d: string) => setSchedDailyDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const settingsTabs = [
    { k: 'general', l: '⚙️ عمومی' },
    { k: 'calendar', l: '📅 تقویم و نمایش' },
    { k: 'connection', l: '☁️ اتصال و فضای اختصاصی' },
    { k: 'security', l: '🔐 امنیت و قفل' },
    { k: 'payroll', l: '💼 حقوق و دستمزد' },
    { k: 'assistant', l: '🤝 دستیار میزان' },
    { k: 'backup', l: '💾 پشتیبان‌گیری و نگهداری' },
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {settingsTabs.map((tb) => (
          <TouchableOpacity key={tb.k} onPress={() => setSettingsTab(tb.k)} style={[s.chip, settingsTab === tb.k && s.chipActive]}>
            <Text style={[s.chipTxt, settingsTab === tb.k && s.chipTxtActive]}>{tb.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {settingsTab === 'general' && (
        <View>
          <EL text="{t('🌐 زبان برنامه')}" style={s.secT} />
          <TouchableOpacity style={[s.btn, { backgroundColor: '#0ea5e9', marginBottom: 12 }]} onPress={() => { (globalThis as any).__openLang?.(); }}>
            <Text style={s.btnTxt}>{t('🌐 تغییر زبان / Change Language')}</Text>
          </TouchableOpacity>

          <EL text="💱 واحد پول" style={s.secT} />
          <Text style={{ color: C.textMut, fontSize: 11, textAlign: 'right', marginBottom: 6 }}>
            واحد پول پیش‌فرض برنامه را انتخاب کنید. در همه بخش‌ها اعمال می‌شود.
          </Text>
          <CurrencyField
            value={settings.currency_code || 'AFN'}
            onChange={(code: string, cur: any) => {
              setSettings({
                ...settings,
                currency_code: cur.code,
                currency_label: cur.label,
                currency_symbol: cur.symbol,
                currency_decimals: cur.decimals,
                currency_custom: cur.custom,
              });
            }}
          />

          <EL text="{t('📊 بازه پیش‌فرض داشبورد')}" style={s.secT} />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(DASH_RANGE_LABELS).map(([k, l]) => (
              <TouchableOpacity key={k} onPress={() => setSettings({ ...settings, dashboard_range: k })} style={[s.chip, settings.dashboard_range === k && s.chipActive]}>
                <Text style={[s.chipTxt, settings.dashboard_range === k && s.chipTxtActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <EL text="{t('🔎 فیلتر پیش‌فرض داشبورد')}" style={s.secT} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[{ k: 'both', l: '🔵 هر دو' }, { k: 'sales', l: '🟢 فروش' }, { k: 'purchase', l: '🟠 خرید' }].map((f) => (
              <TouchableOpacity key={f.k} onPress={() => setSettings({ ...settings, dashboard_filter: f.k })} style={[s.chip, settings.dashboard_filter === f.k && s.chipActive]}>
                <Text style={[s.chipTxt, settings.dashboard_filter === f.k && s.chipTxtActive]}>{f.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <EL text="{t('📈 درصد سود پیش‌فرض')}" style={s.secT} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(Math.round((settings.profit_margin || 0.1) * 100))} onChangeText={(v) => setSettings({ ...settings, profit_margin: (parseFloat(v) || 0) / 100 })} keyboardType="numeric" />

          <EL text="{t('📦 آستانه موجودی')}" style={s.secT} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.inventory_threshold || 5)} onChangeText={(v) => setSettings({ ...settings, inventory_threshold: parseInt(v) || 5 })} keyboardType="numeric" />

          <EL text="{t('📧 ایمیل‌های اعلان')}" style={s.secT} />
          {emails.map((e, i) => (
            <View key={i} style={[s.emailRow, { backgroundColor: C.cardAlt }]}>
              <Text style={[s.emailTxt, { color: C.text }]} numberOfLines={1}>{e}</Text>
              <TouchableOpacity onPress={() => removeEmail(i)}><Text>❌</Text></TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput accessibilityLabel="ایمیل معتبر..." style={[s.inp, { flex: 1, backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={emailInput} onChangeText={setEmailInput} placeholder="ایمیل معتبر..." placeholderTextColor={C.textMut} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={[s.btn, { paddingHorizontal: 20, backgroundColor: '#7c3aed' }]} onPress={addEmail}><Text style={s.btnTxt}>＋</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {settingsTab === 'calendar' && (
        <View>
          <EL text="{t('📅 نوع تقویم')}" style={s.secT} />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {[{ k: 'jalali', l: '☀️ شمسی' }, { k: 'gregorian', l: '🌍 میلادی' }, { k: 'hijri', l: '🌙 قمری' }].map((f) => (
              <TouchableOpacity key={f.k} onPress={() => { setSettings({ ...settings, cal_type: f.k as CalType }); saveCalType(f.k as CalType); }} style={[s.chip, settings.cal_type === f.k && s.chipActive]}>
                <Text style={[s.chipTxt, settings.cal_type === f.k && s.chipTxtActive]}>{f.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {settingsTab === 'connection' && (
        <View>
          <SettingsSheets showToast={showToast} />
        </View>
      )}

      {settingsTab === 'security' && (
        <View>
          <EL text="{t('🔐 پین تب‌ها')}" style={s.secT} />
          <EL textKey="مثال: پین پیش‌فرض = 4242. برای غیرفعال کردن، خالی بگذارید." style={[s.lblS, { color: C.textMut, marginBottom: 8 }]} />
          {[
            { k: 'purchase', l: '🛒 خرید' },
            { k: 'print', l: '🖨 چاپ فاکتور' },
            { k: 'mgr', l: '📁 مدیریت' },
            { k: 'profit', l: '📈 سود' },
            { k: 'inventory', l: '📦 موجودی' },
            { k: 'settings', l: '⚙️ تنظیمات' },
          ].map((t) => (
            <View key={t.k} style={{ marginBottom: 8 }}>
              <Text style={[s.lblS, { color: C.textMut }]}>{t.l}</Text>
              <TextInput accessibilityLabel="4242"
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
                showToast('✅ پین تب‌ها ذخیره شد');
                reload && reload();
              } catch (e: any) { showToast(e?.message || 'خطا', true); }
            }}
          >
            <Text style={s.btnTxt}>{t('💾 ذخیره پین‌های تب‌ها')}</Text>
          </TouchableOpacity>

          <EL text="{t('🚪 خروج امن از حساب')}" style={s.secT} />
          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#dc2626', marginTop: 8 }]}
            onPress={async () => {
              const ok = await confirmMsg('خروج', 'از حساب خارج می‌شوی؟');
              if (!ok) return;
              const warn = '⚠️ قبل از خروج توجه کن:\n\n' +
                'اگر می‌خواهی روی این دستگاه حساب دیگری باز کنی، باید برنامه را حذف و دوباره نصب کنی.\n\n' +
                'قبل از حذف نصب:\n' +
                '۱) با حساب فعلی سینک کن.\n' +
                '۲) از تنظیمات، بکاپ محلی بگیر.\n\n' +
                'اگر این کارها را نکنی، اطلاعات محلی از دست می‌رود.\n\n' +
                'آیا می‌خواهی خارج شوی؟';
              const ok2 = await confirmMsg('هشدار خروج', warn);
              if (!ok2) return;
              await supabase.auth.signOut();
              setStorageUserId('');
            }}
          >
            <Text style={s.btnTxt}>{t('🚪 خروج از حساب')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {settingsTab === 'payroll' && (
        <View>
          <EL text="💼 تنظیمات حقوق و دستمزد" style={s.secT} />
          <Text style={{ color: C.textMut, fontSize: 11, textAlign: 'right', marginBottom: 8 }}>
            این تنظیمات در محاسبه حقوق و دستمزد کارمندان اعمال می‌شود.
          </Text>

          <View style={s.rowBetween}>
            <Text style={[s.lbl, { color: C.textMut }]}>➖ کسر غیبت</Text>
            <Switch value={!!settings.payroll_deduct_absence} onValueChange={(v) => setSettings({ ...settings, payroll_deduct_absence: v })} />
          </View>
          <Text style={[s.lblS, { color: C.textMut }]}>ضریب کسر غیبت (پیش‌فرض: ۱.۰)</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_absence_rate ?? 1)} onChangeText={(v) => setSettings({ ...settings, payroll_absence_rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />

          <View style={s.rowBetween}>
            <Text style={[s.lbl, { color: C.textMut }]}>➖ کسر مرخصی بدون حقوق</Text>
            <Switch value={!!settings.payroll_deduct_unpaid_leave} onValueChange={(v) => setSettings({ ...settings, payroll_deduct_unpaid_leave: v })} />
          </View>
          <Text style={[s.lblS, { color: C.textMut }]}>ضریب کسر مرخصی بدون حقوق</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_unpaid_leave_rate ?? 1)} onChangeText={(v) => setSettings({ ...settings, payroll_unpaid_leave_rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />

          <View style={s.rowBetween}>
            <Text style={[s.lbl, { color: C.textMut }]}>➖ کسر مرخصی استحقاقی (استفاده‌شده: کسر نمی‌شود)</Text>
            <Switch value={!!settings.payroll_deduct_paid_leave} onValueChange={(v) => setSettings({ ...settings, payroll_deduct_paid_leave: v })} />
          </View>
          <Text style={[s.lblS, { color: C.textMut }]}>ضریب کسر مرخصی استحقاقی</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_paid_leave_rate ?? 1)} onChangeText={(v) => setSettings({ ...settings, payroll_paid_leave_rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />

          <View style={s.rowBetween}>
            <Text style={[s.lbl, { color: C.textMut }]}>➖ کسر مرخصی استعلاجی (استفاده‌شده: ۰.۵)</Text>
            <Switch value={!!settings.payroll_deduct_sick_leave} onValueChange={(v) => setSettings({ ...settings, payroll_deduct_sick_leave: v })} />
          </View>
          <Text style={[s.lblS, { color: C.textMut }]}>ضریب کسر مرخصی استعلاجی</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_sick_leave_rate ?? 0.5)} onChangeText={(v) => setSettings({ ...settings, payroll_sick_leave_rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />

          <Text style={[s.lbl, { color: C.textMut, marginTop: 12 }]}>🏥 بیمه سهم کارمند</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_insurance_rate ?? 7)} onChangeText={(v) => setSettings({ ...settings, payroll_insurance_rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
          <Text style={[s.lblS, { color: C.textMut }]}>سهم بیمه کارفرما</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_employer_insurance_rate ?? 23)} onChangeText={(v) => setSettings({ ...settings, payroll_employer_insurance_rate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />

          <View style={s.rowBetween}>
            <Text style={[s.lbl, { color: C.textMut }]}>🧾 محاسبه خودکار مالیات</Text>
            <Switch value={!!settings.payroll_auto_tax} onValueChange={(v) => setSettings({ ...settings, payroll_auto_tax: v })} />
          </View>

          <View style={s.rowBetween}>
            <Text style={[s.lbl, { color: C.textMut }]}>💸 کسر اقساط وام</Text>
            <Switch value={!!settings.payroll_loan_deduction} onValueChange={(v) => setSettings({ ...settings, payroll_loan_deduction: v })} />
          </View>
          <Text style={[s.lblS, { color: C.textMut }]}>ضریب اضافه‌کاری (پیش‌فرض: ۱.۴)</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_overtime_rate_multiplier ?? 1.4)} onChangeText={(v) => setSettings({ ...settings, payroll_overtime_rate_multiplier: parseFloat(v) || 0 })} keyboardType="decimal-pad" />

          <Text style={[s.lblS, { color: C.textMut }]}>تعداد روزهای کاری ماه (پیش‌فرض: ۳۰)</Text>
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(settings.payroll_work_days_per_month ?? 30)} onChangeText={(v) => setSettings({ ...settings, payroll_work_days_per_month: parseInt(v) || 30 })} keyboardType="numeric" />
        </View>
      )}

      {settingsTab === 'assistant' && (
        <View>
          <SettingsAssistant showToast={showToast} />
        </View>
      )}

      {settingsTab === 'backup' && (
        <View>
          <Text style={s.secT}>{t('💾 بکاپ و بازیابی')}</Text>
          <Text style={[s.lblS, { color: C.textMut, marginBottom: 6 }]}>
            آخرین بکاپ خودکار: {lastBackupLabel || 'امروز گرفته نشده'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              style={[s.btn, { flex: 1, backgroundColor: '#059669' }]}
              onPress={async () => {
                showToast('⏳ در حال ساخت بکاپ...');
                const r = await exportBackup();
                showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
              }}
            >
              <Text style={s.btnTxt}>{t('📤 ساخت بکاپ')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, { flex: 1, backgroundColor: '#0ea5e9' }]}
              onPress={async () => {
                const r = await importBackup();
                showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
              }}
            >
              <Text style={s.btnTxt}>{t('📥 بازیابی از بکاپ')}</Text>
            </TouchableOpacity>
          </View>

          <EL text="{t('🗑 حذف خودکار')}" style={s.secT} />
          <View style={s.rowBetween}>
            <EL text="{t('فعال')}" style={[s.lbl, { color: C.textMut }]} />
            <Switch value={autoDelEnabled} onValueChange={setAutoDelEnabled} />
          </View>
          <EL textKey="حذف قدیمی‌تر از (روز)" style={[s.lblS, { color: C.textMut }]} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={autoDelHours} onChangeText={setAutoDelHours} keyboardType="numeric" />

          <EL text="{t('📨 گزارش روزانه')}" style={s.secT} />
          <View style={s.rowBetween}><EL text="{t('فعال')}" style={[s.lbl, { color: C.textMut }]} /><Switch value={schedDailyEnabled} onValueChange={setSchedDailyEnabled} /></View>
          <EL textKey="ساعت ارسال" style={[s.lblS, { color: C.textMut }]} />
          <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={schedDailyHour} onChangeText={setSchedDailyHour} keyboardType="numeric" />
          <EL textKey="روزها" style={[s.lblS, { color: C.textMut }]} />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((d, i) => (
              <TouchableOpacity key={i} onPress={() => toggleDay(String(i))} style={[s.chip, schedDailyDays.includes(String(i)) && s.chipActive]}>
                <Text style={[s.chipTxt, schedDailyDays.includes(String(i)) && s.chipTxtActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <EL text="{t('📬 گزارش هفتگی')}" style={s.secT} />
          <View style={s.rowBetween}><EL text="{t('فعال')}" style={[s.lbl, { color: C.textMut }]} /><Switch value={schedWeeklyEnabled} onValueChange={setSchedWeeklyEnabled} /></View>
          <EL textKey="روز ارسال" style={[s.lblS, { color: C.textMut }]} />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((d, i) => (
              <TouchableOpacity key={i} onPress={() => setSchedWeeklyDay(String(i))} style={[s.chip, schedWeeklyDay === String(i) && s.chipActive]}>
                <Text style={[s.chipTxt, schedWeeklyDay === String(i) && s.chipTxtActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{t('💾 ذخیره تنظیمات')}</Text>}
      </TouchableOpacity>
    </View>
  );
}



// ══════════════════════════════════════════════════════════

//  SOURCES SECTION — جدول ۹ ستونه قابل ویرایش

// ══════════════════════════════════════════════════════════


function PartiesSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getParties();
      const sorted = [...(data || [])].sort((a: any, b: any) => {
        const ca = String(a.code || '');
        const cb = String(b.code || '');
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
      });
      setList(sorted);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = q
    ? list.filter((p: any) => (String(p.code || '') + ' ' + String(p.name || '') + ' ' + String(p.phone || '')).toLowerCase().includes(q.toLowerCase()))
    : list;

  const typeLabel = (t: string) => t === 'supplier' ? 'تأمین‌کننده' : t === 'customer' ? 'مشتری' : 'هر دو';
  const typeColor = (t: string) => t === 'supplier' ? '#ea580c' : t === 'customer' ? '#059669' : '#7c3aed';

  const getNextPartyCode = (listData: any[], draftData: any[], excludeIdx: number = -1) => {
    const codes = [
      ...listData.map(x => String(x.code || '')),
      ...draftData.filter((_, i) => i !== excludeIdx).map(x => String(x.code || ''))
    ].filter(Boolean);
    if (!codes.length) return '';
    let best: any = null;
    codes.forEach(c => {
      const m = c.match(/^(.*?)(\d+)$/);
      if (m) {
        const n = parseInt(m[2], 10);
        if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length };
      }
    });
    if (best) return best.prefix + String(best.n + 1).padStart(best.width, '0');
    return codes[codes.length - 1] + '-2';
  };

  const autoPartyCode = async (phoneArg?: string) => {
    if (!editing) return;
    const phone = phoneArg !== undefined ? phoneArg : (editing.phone || '');
    const p = String(phone).replace(/[^0-9]/g, '');
    if (!p) return;
    const existing = list.find((x: any) => String(x.phone || '').replace(/[^0-9]/g, '') === p);
    if (existing && existing.code) {
      setEditing((prev: any) => prev ? { ...prev, code: existing.code, phone } : prev);
      showToast('⚠️ شماره قبلاً برای «' + (existing.name || '') + '» ثبت شده؛ کد قبلی درج شد', true);
      return;
    }
    const next = getNextPartyCode(list, [], -1);
    if (next) setEditing((prev: any) => prev ? { ...prev, code: next, phone } : prev);
    else setEditing((prev: any) => prev ? { ...prev, phone } : prev);
  };

  const autoDraftCode = (idx: number, phoneArg?: string) => {
    const d = drafts[idx];
    if (!d) return;
    const phone = phoneArg !== undefined ? phoneArg : (d.phone || '');
    const p = String(phone).replace(/[^0-9]/g, '');
    if (!p) return;
    const existing = list.find((x: any) => String(x.phone || '').replace(/[^0-9]/g, '') === p);
    if (existing && existing.code) {
      updateDraft(idx, 'code', existing.code);
      showToast('⚠️ شماره قبلاً برای «' + (existing.name || '') + '» ثبت شده؛ کد قبلی درج شد', true);
      return;
    }
    const draftDup = drafts.find((x: any, i: number) => i !== idx && String(x.phone || '').replace(/[^0-9]/g, '') === p);
    if (draftDup && draftDup.code) {
      updateDraft(idx, 'code', draftDup.code);
      showToast('⚠️ این شماره در ردیف دیگری ثبت شده؛ همان کد درج شد', true);
      return;
    }
    const next = getNextPartyCode(list, drafts, idx);
    if (next) updateDraft(idx, 'code', next);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name) { showToast('نام الزامی است', true); return; }
    const dupName = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.name || '').trim() === String(editing.name || '').trim());
    if (dupName) { showToast('⚠️ این نام قبلاً ثبت شده', true); return; }
    const phoneNorm = String(editing.phone || '').replace(/[^0-9]/g, '');
    if (phoneNorm) {
      const dupPhone = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.phone || '').replace(/[^0-9]/g, '') === phoneNorm);
      if (dupPhone) {
        setEditing({ ...editing, code: dupPhone.code || editing.code });
        showToast('⚠️ این شماره قبلاً ثبت شده؛ کد قبلی درج شد', true);
        return;
      }
    }
    try {
      const payload: any = { ...editing };
      delete payload.id;
      if (editing.id || editing.local_id) await updateParty(editing.local_id || editing.id, payload);
      else await createParty(payload);
      showToast('✅ طرف‌حساب ذخیره شد');
      setEditing(null);
      load();
    } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const remove = async (p: any) => {
    const ok = await confirmMsg('حذف طرف‌حساب', '«' + (p.name || '') + '» حذف شود؟');
    if (!ok) return;
    try { await deleteParty(p.local_id || p.id); load(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const startNew = () => {
    setDrafts((prev: any[]) => [...prev, { local_id: '', code: '', name: '', type: 'supplier', phone: '', address: '', contact_name: '', note: '', status: 'active', opening_balance: 0 }]);
  };

  const updateDraft = (idx: number, field: string, value: any) => {
    setDrafts((prev: any[]) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const removeDraft = (idx: number) => {
    setDrafts((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  const saveDrafts = async () => {
    if (!drafts.length) return;
    for (const d of drafts) if (!d.name) { showToast('نام در همه ردیف‌ها الزامی است', true); return; }

    // چک تلفن تکراری
    for (let i = 0; i < drafts.length; i++) {
      const p = String(drafts[i].phone || '').replace(/[^0-9]/g, '');
      if (!p) continue;
      const existing = list.find((x: any) => String(x.phone || '').replace(/[^0-9]/g, '') === p);
      if (existing) {
        showToast('⚠️ شماره «' + p + '» قبلاً برای «' + (existing.name || '') + '» ثبت شده است', true);
        return;
      }
      const otherDraft = drafts.find((x: any, j: number) => j !== i && String(x.phone || '').replace(/[^0-9]/g, '') === p);
      if (otherDraft) {
        showToast('⚠️ شماره «' + p + '» در ردیف‌های دیگر تکراری است', true);
        return;
      }
    }

    const newDrafts = [...drafts];
    for (let i = 0; i < newDrafts.length; i++) {
      let d = newDrafts[i];
      const p = String(d.phone || '').replace(/[^0-9]/g, '');
      if (p) {
        const existing = list.find((x: any) => String(x.phone || '').replace(/[^0-9]/g, '') === p);
        if (existing && existing.code) d.code = existing.code;
      }
      if (!d.code) d.code = getNextPartyCode(list, newDrafts, i);
    }

    let success = 0;
    for (const d of newDrafts) {
      try { await createParty(d); success++; }
      catch (e: any) { showToast('خطا: ' + (e?.message || String(e)), true); }
    }
    if (success) {
      showToast('✅ ' + success + ' طرف‌حساب ذخیره شد');
      setDrafts([]);
      load();
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={startNew}>
          <Text style={s.btnTxt}>➕ افزودن ردیف</Text>
        </TouchableOpacity>
        {drafts.length > 0 && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={saveDrafts}>
            <Text style={s.btnTxt}>💾 ذخیره همه ({drafts.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در طرف‌حساب‌ها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>👥 طرف‌حساب‌ها ({toFaNum(filtered.length)})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse', position: 'relative', zIndex: 10 }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 180 }]}>نام</Text>
            <Text style={[s.thCell, { width: 130 }]}>تلفن</Text>
            <Text style={[s.thCell, { width: 120 }]}>کد</Text>
            <Text style={[s.thCell, { width: 110 }]}>نوع</Text>
            <Text style={[s.thCell, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.thCell, { width: 200 }]}>آدرس</Text>
            <Text style={[s.thCell, { width: 130 }]}>شخص تماس</Text>
            <Text style={[s.thCell, { width: 160 }]}>یادداشت</Text>
            <Text style={[s.thCell, { width: 100 }]}>عملیات</Text>
          </View>

          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {drafts.map((d, idx) => (
              <View key={'draft-' + idx} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }]}>D{idx + 1}</Text>
                <View style={{ width: 180, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.name || '')} onChangeText={(v: string) => updateDraft(idx, 'name', v)} placeholder="نام *" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 130, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.phone || '')} onChangeText={(v: string) => updateDraft(idx, 'phone', v)} onEndEditing={(e: any) => autoDraftCode(idx, e?.nativeEvent?.text)} onBlur={() => autoDraftCode(idx)} keyboardType="phone-pad" placeholder="تلفن" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 120, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.code || '')} onChangeText={(v: string) => updateDraft(idx, 'code', v)} placeholder="کد" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 110, flexDirection: 'row-reverse', gap: 2 }}>
                  {['supplier','customer','both'].map((t: string) => (
                    <TouchableOpacity key={t} onPress={() => updateDraft(idx, 'type', t)} style={{ flex: 1, padding: 4, borderRadius: 4, backgroundColor: d.type === t ? typeColor(t) : '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ color: d.type === t ? '#fff' : '#475569', fontSize: 8 }}>{typeLabel(t)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ width: 90, flexDirection: 'row-reverse', gap: 2 }}>
                  {['active','inactive'].map((st: string) => (
                    <TouchableOpacity key={st} onPress={() => updateDraft(idx, 'status', st)} style={{ flex: 1, padding: 4, borderRadius: 4, backgroundColor: d.status === st ? (st === 'active' ? '#059669' : '#dc2626') : '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ color: d.status === st ? '#fff' : '#475569', fontSize: 8 }}>{st === 'active' ? 'فعال' : 'غیرفعال'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ width: 200, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.address || '')} onChangeText={(v: string) => updateDraft(idx, 'address', v)} placeholder="آدرس" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 130, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.contact_name || '')} onChangeText={(v: string) => updateDraft(idx, 'contact_name', v)} placeholder="شخص تماس" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 160, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.note || '')} onChangeText={(v: string) => updateDraft(idx, 'note', v)} placeholder="یادداشت" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={() => removeDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>✕</Text></TouchableOpacity>
                </View>
              </View>
            ))}

            {editing && (
              <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40 }]}>✏️</Text>
                <View style={{ width: 180, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.name || '')} onChangeText={(v: string) => setEditing({ ...editing, name: v })} placeholder="نام *" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 130, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.phone || '')} onChangeText={(v: string) => setEditing({ ...editing, phone: v })} onEndEditing={() => autoPartyCode()} onBlur={() => autoPartyCode()} keyboardType="phone-pad" placeholder="تلفن" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 120, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.code || '')} onChangeText={(v: string) => setEditing({ ...editing, code: v })} placeholder="کد" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 110, flexDirection: 'row-reverse', gap: 2 }}>
                  {['supplier','customer','both'].map((t: string) => (
                    <TouchableOpacity key={t} onPress={() => setEditing({ ...editing, type: t })} style={{ flex: 1, padding: 4, borderRadius: 4, backgroundColor: editing.type === t ? typeColor(t) : '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ color: editing.type === t ? '#fff' : '#475569', fontSize: 8 }}>{typeLabel(t)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ width: 90, flexDirection: 'row-reverse', gap: 2 }}>
                  {['active','inactive'].map((st: string) => (
                    <TouchableOpacity key={st} onPress={() => setEditing({ ...editing, status: st })} style={{ flex: 1, padding: 4, borderRadius: 4, backgroundColor: editing.status === st ? (st === 'active' ? '#059669' : '#dc2626') : '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ color: editing.status === st ? '#fff' : '#475569', fontSize: 8 }}>{st === 'active' ? 'فعال' : 'غیرفعال'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ width: 200, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.address || '')} onChangeText={(v: string) => setEditing({ ...editing, address: v })} placeholder="آدرس" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 130, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.contact_name || '')} onChangeText={(v: string) => setEditing({ ...editing, contact_name: v })} placeholder="شخص تماس" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 160, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.note || '')} onChangeText={(v: string) => setEditing({ ...editing, note: v })} placeholder="یادداشت" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={save} style={{ backgroundColor: '#059669', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>💾</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={{ backgroundColor: '#64748b', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>✕</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((p: any, i: number) => (
              <View key={p.local_id || p.id || i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.tdCell, { width: 180, fontSize: 12, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name || '—'}</Text>
                <Text style={[s.tdCell, { width: 130, fontSize: 11, color: C.text }]}>{p.phone || '—'}</Text>
                <Text style={[s.tdCell, { width: 120, fontSize: 11, color: '#7c3aed' }]}>{p.code || '—'}</Text>
                <Text style={[s.tdCell, { width: 110, fontSize: 11, color: typeColor(p.type), fontWeight: 'bold' }]}>{typeLabel(p.type)}</Text>
                <Text style={[s.tdCell, { width: 90, fontSize: 11, color: p.status === 'inactive' ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{p.status === 'inactive' ? 'غیرفعال' : 'فعال'}</Text>
                <Text style={[s.tdCell, { width: 200, fontSize: 10, color: C.textMut, textAlign: 'right' }]} numberOfLines={1}>{p.address || '—'}</Text>
                <Text style={[s.tdCell, { width: 130, fontSize: 10, color: C.text }]}>{p.contact_name || '—'}</Text>
                <Text style={[s.tdCell, { width: 160, fontSize: 10, color: C.textMut, textAlign: 'right' }]} numberOfLines={1}>{p.note || '—'}</Text>
                <View style={[s.tdCell, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={() => setEditing({ ...p })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(p)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function PartnersSection({ showToast }: any) {
  const [banksList, setBanksList] = useState<any[]>([]);
  useEffect(() => { getBanks().then(setBanksList).catch(()=>{}); }, []);

  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [bankPartner, setBankPartner] = useState<any>(null);
  const [bankList, setBankList] = useState<any[]>([]);
  const [bankDrafts, setBankDrafts] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);

  const [txnPartner, setTxnPartner] = useState<any>(null);
  const [txnList, setTxnList] = useState<any[]>([]);
  const [txnBanks, setTxnBanks] = useState<any[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnForm, setTxnForm] = useState<any>({
    type: 'deposit', currency: 'AFN', amount: '', bank_account_local_id: '',
    box_effect: 'none', box_id: '', box_currency: '', exchange_rate: 1,
    to_partner_code: '', to_currency: 'AFN', to_amount: '', transaction_date: new Date().toISOString(), note: '',
    account_type: 'current', counterpart_type: 'none', counterpart_code: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPartners();
      const sorted = [...(data || [])].sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
      setList(sorted);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = q ? list.filter((p: any) => (String(p.code || '') + ' ' + String(p.name || '')).toLowerCase().includes(q.toLowerCase())) : list;

  const getNextPartnerCode = (listData: any[], draftData: any[], excludeIdx: number = -1) => {
    const codes = [...listData.map(x => String(x.code || '')), ...draftData.filter((_, i) => i !== excludeIdx).map(x => String(x.code || ''))].filter(Boolean);
    if (!codes.length) return '';
    let best: any = null;
    codes.forEach(c => {
      const m = c.match(/^(.*?)(\d+)$/);
      if (m) { const n = parseInt(m[2], 10); if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length }; }
    });
    if (best) return best.prefix + String(best.n + 1).padStart(best.width, '0');
    return codes[codes.length - 1] + '-2';
  };

  const autoPartnerCode = () => {
    if (!editing || editing.id || editing.local_id) return;
    if (String(editing.code || '').trim()) return;
    const next = getNextPartnerCode(list, [], -1);
    if (next) setEditing({ ...editing, code: next });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name) { showToast('نام الزامی است', true); return; }
    const dupName = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.name || '').trim() === String(editing.name || '').trim());
    if (dupName) { showToast('⚠️ این نام قبلاً ثبت شده', true); return; }
    let finalCode = editing.code;
    if (!finalCode) finalCode = getNextPartnerCode(list, [], -1);
    try {
      const payload: any = { ...editing, code: finalCode };
      delete payload.id;
      if (editing.id || editing.local_id) await updatePartner(editing.local_id || editing.id, payload);
      else await createPartner(payload);
      showToast('✅ شریک ذخیره شد');
      setEditing(null);
      load();
    } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const remove = async (p: any) => {
    const ok = await confirmMsg('حذف شریک', '«' + (p.name || '') + '» حذف شود؟');
    if (!ok) return;
    try { await deletePartner(p.local_id || p.id); load(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const startNew = () => {
    const nextCode = getNextPartnerCode(list, drafts);
    setDrafts((prev: any[]) => [...prev, { local_id: '', code: nextCode, name: '', phone: '', share_percent: 0, status: 'active', note: '' }]);
  };
  const updateDraft = (idx: number, field: string, value: any) => setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  const removeDraft = (idx: number) => setDrafts(prev => prev.filter((_, i) => i !== idx));

  const saveDrafts = async () => {
    if (!drafts.length) return;
    for (const d of drafts) if (!d.name) { showToast('نام در همه ردیف‌ها الزامی است', true); return; }
    for (let i = 0; i < drafts.length; i++) {
      const name = String(drafts[i].name || '').trim();
      if (list.find((x: any) => String(x.name || '').trim() === name)) { showToast('⚠️ نام «' + name + '» قبلاً ثبت شده', true); return; }
      if (drafts.find((x: any, j: number) => j !== i && String(x.name || '').trim() === name)) { showToast('⚠️ نام «' + name + '» در ردیف‌های دیگر تکراری است', true); return; }
    }
    const newDrafts = [...drafts];
    for (let i = 0; i < newDrafts.length; i++) if (!newDrafts[i].code) newDrafts[i].code = getNextPartnerCode(list, newDrafts, i);
    let success = 0;
    for (const d of newDrafts) {
      try { await createPartner(d); success++; } catch (e: any) { showToast('خطا: ' + (e?.message || String(e)), true); }
    }
    if (success) { showToast('✅ ' + success + ' شریک ذخیره شد'); setDrafts([]); load(); }
  };

  const loadBanks = async (partner: any) => {
    setBankLoading(true);
    try { const data = await getPartnerBankAccounts(partner.code); setBankList(data || []); } catch {}
    finally { setBankLoading(false); }
  };
  const openBanks = async (partner: any) => { setBankPartner(partner); setBankDrafts([]); await loadBanks(partner); };
  const addBankDraft = () => setBankDrafts(prev => [...prev, { local_id: '', bank_name: '', currency: 'AFN', account_number: '', card_number: '', iban: '', holder_name: bankPartner?.name || '', is_default: false, status: 'active', note: '' }]);
  const updateBankDraft = (idx: number, field: string, value: any) => setBankDrafts(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  const removeBankDraft = (idx: number) => setBankDrafts(prev => prev.filter((_, i) => i !== idx));
  const saveBankDrafts = async () => {
    if (!bankPartner || !bankDrafts.length) return;
    let success = 0;
    for (const d of bankDrafts) {
      try { await createPartnerBankAccount({ ...d, partner_code: bankPartner.code, partner_name: bankPartner.name }); success++; } catch (e: any) { showToast('خطا: ' + (e?.message || String(e)), true); }
    }
    if (success) { showToast('✅ ' + success + ' کارت ذخیره شد'); setBankDrafts([]); await loadBanks(bankPartner); }
  };
  const removeBank = async (b: any) => {
    const ok = await confirmMsg('حذف کارت', 'حذف شود؟');
    if (!ok) return;
    try { await deletePartnerBankAccount(b.local_id || b.id, bankPartner.code); await loadBanks(bankPartner); showToast('✅ حذف شد'); } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const openTransactions = async (partner: any) => {
    setTxnPartner(partner);
    setTxnLoading(true);
    try {
      const txns = await getPartnerTransactions(partner.code);
      setTxnList(txns || []);
      const banks = await getPartnerBankAccounts(partner.code);
      setTxnBanks(banks || []);
      setTxnForm({ type: 'deposit', currency: 'AFN', amount: '', bank_account_local_id: banks?.[0]?.local_id || '', box_effect: 'none', box_id: '', box_currency: '', exchange_rate: 1, to_partner_code: '', to_currency: 'AFN', to_amount: '', transaction_date: new Date().toISOString(), note: '', account_type: 'current', counterpart_type: 'none', counterpart_code: '' });
    } catch {}
    finally { setTxnLoading(false); }
  };

  const reloadTransactions = async () => {
    if (!txnPartner) return;
    const txns = await getPartnerTransactions(txnPartner.code);
    setTxnList(txns || []);
  };

  const submitTxn = async () => {
    if (!txnPartner) return;
    const amt = parseFloat(String(txnForm.amount).replace(/[^0-9.]/g, '')) || 0;
    if (!amt || amt <= 0) { showToast('مبلغ معتبر وارد کن', true); return; }
    const type = txnForm.type;
    const base: any = {
      partner_code: txnPartner.code,
      partner_name: txnPartner.name,
      currency: txnForm.currency || 'AFN',
      amount: amt,
      bank_account_local_id: txnForm.bank_account_local_id || '',
      box_effect: txnForm.box_effect || 'none',
      box_id: txnForm.box_id || '',
      box_currency: txnForm.box_currency || txnForm.currency,
      exchange_rate: parseFloat(String(txnForm.exchange_rate)) || 1,
      transaction_date: txnForm.transaction_date || new Date().toISOString(),
      note: txnForm.note || '',
      account_type: txnForm.account_type || 'current',
      counterpart_type: txnForm.counterpart_type || 'none',
      counterpart_code: txnForm.counterpart_code || '',
    };
    try {
      if (type === 'transfer_out') {
        if (!txnForm.to_partner_code) { showToast('شریک مقصد را انتخاب کن', true); return; }
        const toPartner = list.find((x: any) => x.code === txnForm.to_partner_code);
        if (!toPartner) { showToast('شریک مقصد پیدا نشد', true); return; }
        const toAmt = parseFloat(String(txnForm.to_amount).replace(/[^0-9.]/g, '')) || amt;
        const group = 'tr_' + Date.now();
        await createPartnerTransaction({ ...base, type: 'transfer_out', to_partner_code: toPartner.code, to_currency: txnForm.to_currency || base.currency, to_amount: toAmt, transfer_group: group, box_effect: 'none' });
        await createPartnerTransaction({ ...base, partner_code: toPartner.code, partner_name: toPartner.name, type: 'transfer_in', currency: txnForm.to_currency || base.currency, amount: toAmt, to_partner_code: txnPartner.code, to_currency: base.currency, to_amount: amt, transfer_group: group, box_effect: 'none' });
        showToast('✅ انتقال ثبت شد');
      } else {
        await createPartnerTransaction({ ...base, type });
        showToast(type === 'deposit' ? '✅ واریز ثبت شد' : '✅ برداشت ثبت شد');
      }
      setTxnForm({ ...txnForm, amount: '', to_amount: '', note: '' });
      await reloadTransactions();
      load();
    } catch (e: any) { showToast('خطا: ' + (e?.message || String(e)), true); }
  };

  const removeTxn = async (t: any) => {
    const ok = await confirmMsg('حذف حرکت', 'حذف شود؟');
    if (!ok) return;
    try { await deletePartnerTransaction(t.local_id || t.id, txnPartner.code); await reloadTransactions(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const currencies = ['AFN', 'USD', 'EUR', 'PKR', 'IRR'];

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={startNew}>
          <Text style={s.btnTxt}>➕ افزودن ردیف</Text>
        </TouchableOpacity>
        {drafts.length > 0 && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={saveDrafts}>
            <Text style={s.btnTxt}>💾 ذخیره همه ({drafts.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در شرکا..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>👥 شرکا ({toFaNum(filtered.length)})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse', position: 'relative', zIndex: 10 }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 110 }]}>کد</Text>
            <Text style={[s.thCell, { width: 200 }]}>نام</Text>
            <Text style={[s.thCell, { width: 130 }]}>تلفن</Text>
            <Text style={[s.thCell, { width: 100 }]}>درصد سهم</Text>
            <Text style={[s.thCell, { width: 90 }]}>وضعیت</Text>
            <Text style={[s.thCell, { width: 150 }]}>عملیات</Text>
          </View>
          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {drafts.map((d, idx) => (
              <View key={'draft-' + idx} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }]}>D{idx + 1}</Text>
                <View style={{ width: 110, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.code || '')} onChangeText={(v: string) => updateDraft(idx, 'code', v)} placeholder="کد" /></View>
                <View style={{ width: 200, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.name || '')} onChangeText={(v: string) => updateDraft(idx, 'name', v)} placeholder="نام *" /></View>
                <View style={{ width: 130, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.phone || '')} onChangeText={(v: string) => updateDraft(idx, 'phone', v)} placeholder="تلفن" /></View>
                <View style={{ width: 100, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.share_percent || '')} onChangeText={(v: string) => updateDraft(idx, 'share_percent', parseFloat(v) || 0)} keyboardType="numeric" placeholder="0" /></View>
                <View style={{ width: 90, paddingHorizontal: 2 }}><TouchableOpacity onPress={() => updateDraft(idx, 'status', d.status === 'active' ? 'inactive' : 'active')} style={{ backgroundColor: d.status === 'active' ? '#059669' : '#dc2626', padding: 6, borderRadius: 4, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 9 }}>{d.status === 'active' ? 'فعال' : 'غیرفعال'}</Text></TouchableOpacity></View>
                <View style={{ width: 150, alignItems: 'center' }}><TouchableOpacity onPress={() => removeDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>✕</Text></TouchableOpacity></View>
              </View>
            ))}
            {editing && (
              <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40 }]}>✏️</Text>
                <View style={{ width: 110, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.code || '')} onChangeText={(v: string) => setEditing({ ...editing, code: v })} placeholder="کد" /></View>
                <View style={{ width: 200, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.name || '')} onChangeText={(v: string) => setEditing({ ...editing, name: v })} onEndEditing={autoPartnerCode} placeholder="نام *" /></View>
                <View style={{ width: 130, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.phone || '')} onChangeText={(v: string) => setEditing({ ...editing, phone: v })} placeholder="تلفن" /></View>
                <View style={{ width: 100, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.share_percent || '')} onChangeText={(v: string) => setEditing({ ...editing, share_percent: parseFloat(v) || 0 })} keyboardType="numeric" placeholder="0" /></View>
                <View style={{ width: 90, paddingHorizontal: 2 }}><TouchableOpacity onPress={() => setEditing({ ...editing, status: editing.status === 'active' ? 'inactive' : 'active' })} style={{ backgroundColor: editing.status === 'active' ? '#059669' : '#dc2626', padding: 6, borderRadius: 4, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 9 }}>{editing.status === 'active' ? 'فعال' : 'غیرفعال'}</Text></TouchableOpacity></View>
                <View style={{ width: 150, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={save} style={{ backgroundColor: '#059669', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff' }}>💾</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={{ backgroundColor: '#64748b', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff' }}>✕</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((p: any, i: number) => (
              <View key={p.local_id || p.id || i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.tdCell, { width: 110, fontSize: 11, color: '#7c3aed' }]}>{p.code || '—'}</Text>
                <Text style={[s.tdCell, { width: 200, fontSize: 12, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name || '—'}</Text>
                <Text style={[s.tdCell, { width: 130, fontSize: 11, color: C.text }]}>{p.phone || '—'}</Text>
                <Text style={[s.tdCell, { width: 100, fontSize: 11, color: '#d4af37', fontWeight: 'bold', textAlign: 'center' }]}>{toFaNum(Number(p.share_percent) || 0)}٪</Text>
                <Text style={[s.tdCell, { width: 90, fontSize: 11, color: p.status === 'inactive' ? '#dc2626' : '#059669', fontWeight: 'bold' }]}>{p.status === 'inactive' ? 'غیرفعال' : 'فعال'}</Text>
                <View style={[s.tdCell, { width: 150, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={() => openTransactions(p)} style={{ backgroundColor: '#d1fae5', padding: 6, borderRadius: 6 }}><Text>💰</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => openBanks(p)} style={{ backgroundColor: '#fef3c7', padding: 6, borderRadius: 6 }}><Text>🏦</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing({ ...p })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(p)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <Modal visible={!!bankPartner} transparent animationType="slide" onRequestClose={() => setBankPartner(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 12, maxHeight: '92%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#0f2438', padding: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>🏦 کارت‌ها — {bankPartner?.name || ''}</Text>
              <TouchableOpacity onPress={() => setBankPartner(null)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 10 }}>
              <TouchableOpacity onPress={addBankDraft} style={{ backgroundColor: '#7c3aed', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>➕ افزودن کارت</Text></TouchableOpacity>
              {bankDrafts.length > 0 && (
                <TouchableOpacity onPress={saveBankDrafts} style={{ backgroundColor: '#059669', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>💾 ذخیره {bankDrafts.length} کارت</Text></TouchableOpacity>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={{ flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6 }}>
                    <Text style={{ width: 150, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>بانک</Text>
                    <Text style={{ width: 80, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>ارز</Text>
                    <Text style={{ width: 160, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>شماره حساب</Text>
                    <Text style={{ width: 160, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>شماره کارت</Text>
                    <Text style={{ width: 160, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>صاحب حساب</Text>
                    <Text style={{ width: 80, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>حذف</Text>
                  </View>
                  {bankDrafts.map((d, idx) => (
                    <View key={'bd-' + idx} style={{ flexDirection: 'row-reverse', backgroundColor: '#f8fafc', paddingVertical: 4 }}>
                      <View style={{ width: 150, paddingHorizontal: 2 }}>
  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.bank_name || '')} onChangeText={(v: string) => updateBankDraft(idx, 'bank_name', v)} placeholder="بانک" />
  <ScrollView horizontal style={{ marginTop: 4 }}>
    {banksList.map((b: any) => (
      <TouchableOpacity key={b.local_id || b.id} onPress={() => updateBankDraft(idx, 'bank_name', b.name)} style={{ paddingHorizontal: 4, paddingVertical: 2, backgroundColor: '#e2e8f0', borderRadius: 4, marginLeft: 2 }}>
        <Text style={{ fontSize: 8 }}>{b.name}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>
                      <View style={{ width: 80, paddingHorizontal: 2 }}><TouchableOpacity onPress={() => updateBankDraft(idx, 'currency', currencies[(currencies.indexOf(d.currency) + 1) % currencies.length])} style={{ backgroundColor: '#dbeafe', padding: 8, borderRadius: 4, alignItems: 'center' }}><Text style={{ fontSize: 11, fontWeight: 'bold' }}>{d.currency}</Text></TouchableOpacity></View>
                      <View style={{ width: 160, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.account_number || '')} onChangeText={(v: string) => updateBankDraft(idx, 'account_number', v)} placeholder="شماره حساب" /></View>
                      <View style={{ width: 160, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.card_number || '')} onChangeText={(v: string) => updateBankDraft(idx, 'card_number', v)} placeholder="شماره کارت" /></View>
                      <View style={{ width: 160, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.holder_name || '')} onChangeText={(v: string) => updateBankDraft(idx, 'holder_name', v)} placeholder="صاحب حساب" /></View>
                      <View style={{ width: 80, alignItems: 'center' }}><TouchableOpacity onPress={() => removeBankDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>✕</Text></TouchableOpacity></View>
                    </View>
                  ))}
                  {bankLoading ? <ActivityIndicator color="#d4af37" /> : bankList.map((b: any, i: number) => (
                    <View key={b.local_id || b.id || i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f1f5f9', paddingVertical: 6 }}>
                      <Text style={{ width: 150, fontSize: 11, textAlign: 'center' }}>{b.bank_name || '—'}</Text>
                      <Text style={{ width: 80, fontSize: 11, textAlign: 'center', color: '#7c3aed' }}>{b.currency || 'AFN'}</Text>
                      <Text style={{ width: 160, fontSize: 11, textAlign: 'center' }}>{b.account_number || '—'}</Text>
                      <Text style={{ width: 160, fontSize: 11, textAlign: 'center' }}>{b.card_number || '—'}</Text>
                      <Text style={{ width: 160, fontSize: 11, textAlign: 'center' }}>{b.holder_name || '—'}</Text>
                      <View style={{ width: 80, alignItems: 'center' }}><TouchableOpacity onPress={() => removeBank(b)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>🗑</Text></TouchableOpacity></View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!txnPartner} transparent animationType="slide" onRequestClose={() => setTxnPartner(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 10 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 12, maxHeight: '94%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#0f2438', padding: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💰 حرکات — {txnPartner?.name || ''}</Text>
              <TouchableOpacity onPress={() => setTxnPartner(null)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 10 }}>
              <View style={{ flexDirection: 'row-reverse', gap: 4, marginBottom: 8 }}>
                {[{ v: 'deposit', l: '➕ واریز' }, { v: 'withdraw', l: '➖ برداشت' }, { v: 'transfer_out', l: '🔄 انتقال' }].map(t => (
                  <TouchableOpacity key={t.v} onPress={() => setTxnForm({ ...txnForm, type: t.v })} style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: txnForm.type === t.v ? '#7c3aed' : '#e2e8f0', alignItems: 'center' }}>
                    <Text style={{ color: txnForm.type === t.v ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 11 }}>{t.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
                <View style={{ width: '30%' }}>
                  <Text style={{ fontSize: 10 }}>ارز</Text>
                  <TouchableOpacity onPress={() => setTxnForm({ ...txnForm, currency: currencies[(currencies.indexOf(txnForm.currency) + 1) % currencies.length] })} style={{ backgroundColor: '#dbeafe', padding: 8, borderRadius: 4, alignItems: 'center' }}><Text style={{ fontWeight: 'bold' }}>{txnForm.currency}</Text></TouchableOpacity>
                </View>
                <View style={{ width: '30%' }}>
                  <Text style={{ fontSize: 10 }}>مبلغ</Text>
                  <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(txnForm.amount)} onChangeText={(v) => setTxnForm({ ...txnForm, amount: v })} keyboardType="numeric" placeholder="0" />
                </View>
                <View style={{ width: '34%' }}>
                  <Text style={{ fontSize: 10 }}>کارت بانکی</Text>
                  <ScrollView horizontal>
                    {txnBanks.map((b: any) => (
                      <TouchableOpacity key={b.local_id || b.id} onPress={() => setTxnForm({ ...txnForm, bank_account_local_id: b.local_id || b.id })} style={{ padding: 6, marginLeft: 4, borderRadius: 4, backgroundColor: txnForm.bank_account_local_id === (b.local_id || b.id) ? '#059669' : '#e2e8f0' }}>
                        <Text style={{ fontSize: 9, color: txnForm.bank_account_local_id === (b.local_id || b.id) ? '#fff' : '#475569' }}>{b.bank_name || 'کارت'} ({b.currency})</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {/* نوع حساب */}
              <View style={{ width: '100%', marginTop: 6 }}>
                <Text style={{ fontSize: 10 }}>نوع حساب</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                  {[{ v: 'capital', l: '💰 سرمایه' }, { v: 'current', l: '📊 جاری' }, { v: 'drawings', l: '📤 برداشت' }].map(a => (
                    <TouchableOpacity key={a.v} onPress={() => setTxnForm({ ...txnForm, account_type: a.v })} style={{ flex: 1, padding: 8, borderRadius: 4, backgroundColor: txnForm.account_type === a.v ? '#7c3aed' : '#e2e8f0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: txnForm.account_type === a.v ? '#fff' : '#475569', fontWeight: 'bold' }}>{a.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* طرف مقابل */}
              <View style={{ width: '100%', marginTop: 6 }}>
                <Text style={{ fontSize: 10 }}>طرف مقابل</Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
                  {[{ v: 'none', l: 'بدون طرف' }, { v: 'box', l: 'صندوق' }, { v: 'bank', l: 'بانک/کارت' }, { v: 'customer', l: 'مشتری' }, { v: 'supplier', l: 'تأمین‌کننده' }, { v: 'partner', l: 'شریک دیگر' }].map(c => (
                    <TouchableOpacity key={c.v} onPress={() => setTxnForm({ ...txnForm, counterpart_type: c.v, counterpart_code: '' })} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, backgroundColor: txnForm.counterpart_type === c.v ? '#0891b2' : '#e2e8f0' }}>
                      <Text style={{ fontSize: 9, color: txnForm.counterpart_type === c.v ? '#fff' : '#475569', fontWeight: 'bold' }}>{c.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* کد طرف مقابل (متن آزاد/خودکار) */}
              {txnForm.counterpart_type !== 'none' && (
                <View style={{ width: '100%', marginTop: 6 }}>
                  <Text style={{ fontSize: 10 }}>کد طرف مقابل</Text>
                  <TextInput
                    style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]}
                    value={txnForm.counterpart_code}
                    onChangeText={(v) => setTxnForm({ ...txnForm, counterpart_code: v })}
                    placeholder="اختیاری / خودکار"
                  />
                </View>
              )}

              {txnForm.type === 'transfer_out' && (
                  <>
                    <View style={{ width: '48%' }}>
                      <Text style={{ fontSize: 10 }}>شریک مقصد</Text>
                      <ScrollView horizontal>
                        {list.filter(p => p.code !== txnPartner.code).map((p: any) => (
                          <TouchableOpacity key={p.code} onPress={() => setTxnForm({ ...txnForm, to_partner_code: p.code })} style={{ padding: 6, marginLeft: 4, borderRadius: 4, backgroundColor: txnForm.to_partner_code === p.code ? '#7c3aed' : '#e2e8f0' }}>
                            <Text style={{ fontSize: 9, color: txnForm.to_partner_code === p.code ? '#fff' : '#475569' }}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={{ width: '24%' }}>
                      <Text style={{ fontSize: 10 }}>ارز مقصد</Text>
                      <TouchableOpacity onPress={() => setTxnForm({ ...txnForm, to_currency: currencies[(currencies.indexOf(txnForm.to_currency) + 1) % currencies.length] })} style={{ backgroundColor: '#dbeafe', padding: 8, borderRadius: 4, alignItems: 'center' }}><Text style={{ fontWeight: 'bold' }}>{txnForm.to_currency}</Text></TouchableOpacity>
                    </View>
                    <View style={{ width: '24%' }}>
                      <Text style={{ fontSize: 10 }}>مبلغ مقصد</Text>
                      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(txnForm.to_amount)} onChangeText={(v) => setTxnForm({ ...txnForm, to_amount: v })} keyboardType="numeric" placeholder="0" />
                    </View>
                  </>
                )}
                {txnForm.type !== 'transfer_out' && (
                  <View style={{ width: '100%', marginTop: 6 }}>
                    <Text style={{ fontSize: 10 }}>اثر روی صندوق</Text>
                    <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                      {[{ v: 'none', l: 'بدون اثر' }, { v: 'in', l: 'ورود به صندوق' }, { v: 'out', l: 'خروج از صندوق' }].map(x => (
                        <TouchableOpacity key={x.v} onPress={() => setTxnForm({ ...txnForm, box_effect: x.v })} style={{ flex: 1, padding: 8, borderRadius: 4, backgroundColor: txnForm.box_effect === x.v ? '#059669' : '#e2e8f0', alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, color: txnForm.box_effect === x.v ? '#fff' : '#475569' }}>{x.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <View style={{ width: '100%', marginTop: 6 }}>
                  <Text style={{ fontSize: 10 }}>یادداشت</Text>
                  <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={txnForm.note} onChangeText={(v) => setTxnForm({ ...txnForm, note: v })} placeholder="اختیاری" />
                </View>
              </View>
              <TouchableOpacity onPress={submitTxn} style={{ backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 10 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>💾 ثبت حرکت</Text>
              </TouchableOpacity>

              <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>📋 کاردکس</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={{ flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6 }}>
                    <Text style={{ width: 40, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>#</Text>
                    <Text style={{ width: 100, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>تاریخ</Text>
                    <Text style={{ width: 60, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>نوع</Text>
                    <Text style={{ width: 70, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>حساب</Text>
                    <Text style={{ width: 70, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>طرف</Text>
                    <Text style={{ width: 70, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>ارز</Text>
                    <Text style={{ width: 110, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>مبلغ</Text>
                    <Text style={{ width: 120, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>کارت</Text>
                    <Text style={{ width: 80, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>صندوق</Text>
                    <Text style={{ width: 150, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>یادداشت</Text>
                    <Text style={{ width: 60, color: '#d4af37', fontSize: 10, textAlign: 'center' }}>حذف</Text>
                  </View>
                  {txnLoading ? <ActivityIndicator color="#d4af37" /> : txnList.map((t: any, i: number) => (
                    <View key={t.local_id || t.id || i} style={{ flexDirection: 'row-reverse', backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff', paddingVertical: 4 }}>
                      <Text style={{ width: 40, fontSize: 10, textAlign: 'center' }}>{i + 1}</Text>
                      <Text style={{ width: 100, fontSize: 10, textAlign: 'center' }}>{displayDateOnly ? displayDateOnly(t.transaction_date) : String(t.transaction_date || '').slice(0, 10)}</Text>
                      <Text style={{ width: 60, fontSize: 10, textAlign: 'center', color: t.type === 'deposit' ? '#059669' : t.type === 'withdraw' ? '#dc2626' : '#7c3aed', fontWeight: 'bold' }}>{t.type === 'deposit' ? 'واریز' : t.type === 'withdraw' ? 'برداشت' : t.type === 'transfer_out' ? 'انتقال' : 'دریافت'}</Text>
                      <Text style={{ width: 70, fontSize: 9, textAlign: 'center', color: '#7c3aed' }}>{t.account_type === 'capital' ? 'سرمایه' : t.account_type === 'drawings' ? 'برداشت' : 'جاری'}</Text>
                      <Text style={{ width: 70, fontSize: 9, textAlign: 'center', color: '#0891b2' }}>{t.counterpart_type === 'box' ? 'صندوق' : t.counterpart_type === 'bank' ? 'بانک' : t.counterpart_type === 'customer' ? 'مشتری' : t.counterpart_type === 'supplier' ? 'تأمین‌کننده' : t.counterpart_type === 'partner' ? 'شریک' : '—'}</Text>
                      <Text style={{ width: 70, fontSize: 10, textAlign: 'center' }}>{t.currency}</Text>
                      <Text style={{ width: 110, fontSize: 10, textAlign: 'center', fontWeight: 'bold' }}>{fmt(t.amount)}</Text>
                      <Text style={{ width: 120, fontSize: 9, textAlign: 'center' }}>{txnBanks.find(b => (b.local_id || b.id) === t.bank_account_local_id)?.bank_name || '—'}</Text>
                      <Text style={{ width: 80, fontSize: 9, textAlign: 'center' }}>{t.box_effect === 'in' ? 'ورود' : t.box_effect === 'out' ? 'خروج' : '—'}</Text>
                      <Text style={{ width: 150, fontSize: 9, textAlign: 'center' }} numberOfLines={1}>{t.note || '—'}</Text>
                      <View style={{ width: 60, alignItems: 'center' }}><TouchableOpacity onPress={() => removeTxn(t)} style={{ backgroundColor: '#fee2e2', padding: 4, borderRadius: 4 }}><Text style={{ fontSize: 10 }}>🗑</Text></TouchableOpacity></View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BanksSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try { setList(await getBanks()); } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = q ? list.filter((p: any) => (String(p.name || '') + ' ' + String(p.code || '')).toLowerCase().includes(q.toLowerCase())) : list;

  const save = async () => {
    if (!editing) return;
    if (!editing.name) { showToast('نام بانک الزامی است', true); return; }
    const dup = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.name || '').trim() === String(editing.name || '').trim());
    if (dup) { showToast('⚠️ این نام بانک قبلاً ثبت شده', true); return; }
    try {
      const payload = { ...editing }; delete payload.id;
      if (editing.id || editing.local_id) await updateBank(editing.local_id || editing.id, payload);
      else await createBank(payload);
      showToast('✅ بانک ذخیره شد'); setEditing(null); load();
    } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const remove = async (p: any) => {
    const ok = await confirmMsg('حذف بانک', '«' + (p.name || '') + '» حذف شود؟');
    if (!ok) return;
    try { await deleteBank(p.local_id || p.id); load(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const startNew = () => setDrafts(prev => [...prev, { local_id: '', name: '', code: '', note: '' }]);
  const updateDraft = (idx: number, field: string, value: any) => setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  const removeDraft = (idx: number) => setDrafts(prev => prev.filter((_, i) => i !== idx));

  const saveDrafts = async () => {
    if (!drafts.length) return;
    for (const d of drafts) if (!d.name) { showToast('نام در همه ردیف‌ها الزامی است', true); return; }
    for (let i = 0; i < drafts.length; i++) {
      const name = String(drafts[i].name || '').trim();
      if (list.find((x: any) => String(x.name || '').trim() === name)) { showToast('⚠️ نام «' + name + '» قبلاً ثبت شده', true); return; }
      if (drafts.find((x: any, j: number) => j !== i && String(x.name || '').trim() === name)) { showToast('⚠️ نام «' + name + '» در ردیف‌ها تکراری است', true); return; }
    }
    let success = 0;
    for (const d of drafts) { try { await createBank(d); success++; } catch (e: any) { showToast(e?.message || String(e), true); } }
    if (success) { showToast('✅ ' + success + ' بانک ذخیره شد'); setDrafts([]); load(); }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={startNew}><Text style={s.btnTxt}>➕ افزودن بانک</Text></TouchableOpacity>
        {drafts.length > 0 && <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={saveDrafts}><Text style={s.btnTxt}>💾 ذخیره ({drafts.length})</Text></TouchableOpacity>}
      </View>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در بانک‌ها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>🏦 بانک‌ها ({toFaNum(filtered.length)})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse', position: 'relative', zIndex: 10 }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 250 }]}>نام بانک</Text>
            <Text style={[s.thCell, { width: 120 }]}>کد</Text>
            <Text style={[s.thCell, { width: 200 }]}>یادداشت</Text>
            <Text style={[s.thCell, { width: 100 }]}>عملیات</Text>
          </View>
          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {drafts.map((d, idx) => (
              <View key={'bd-' + idx} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }]}>D{idx + 1}</Text>
                <View style={{ width: 250, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.name || '')} onChangeText={(v) => updateDraft(idx, 'name', v)} placeholder="نام بانک *" /></View>
                <View style={{ width: 120, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.code || '')} onChangeText={(v) => updateDraft(idx, 'code', v)} placeholder="کد" /></View>
                <View style={{ width: 200, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.note || '')} onChangeText={(v) => updateDraft(idx, 'note', v)} placeholder="یادداشت" /></View>
                <View style={{ width: 100, alignItems: 'center' }}><TouchableOpacity onPress={() => removeDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>✕</Text></TouchableOpacity></View>
              </View>
            ))}
            {editing && (
              <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40 }]}>✏️</Text>
                <View style={{ width: 250, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.name || '')} onChangeText={(v) => setEditing({ ...editing, name: v })} placeholder="نام بانک *" /></View>
                <View style={{ width: 120, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.code || '')} onChangeText={(v) => setEditing({ ...editing, code: v })} placeholder="کد" /></View>
                <View style={{ width: 200, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.note || '')} onChangeText={(v) => setEditing({ ...editing, note: v })} placeholder="یادداشت" /></View>
                <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={save} style={{ backgroundColor: '#059669', padding: 6, borderRadius: 6 }}><Text>💾</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={{ backgroundColor: '#64748b', padding: 6, borderRadius: 6 }}><Text>✕</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((p: any, i: number) => (
              <View key={p.local_id || p.id || i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.tdCell, { width: 250, fontSize: 12, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name || '—'}</Text>
                <Text style={[s.tdCell, { width: 120, fontSize: 11, color: '#7c3aed' }]}>{p.code || '—'}</Text>
                <Text style={[s.tdCell, { width: 200, fontSize: 10, color: C.textMut, textAlign: 'right' }]} numberOfLines={1}>{p.note || '—'}</Text>
                <View style={[s.tdCell, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={() => setEditing({ ...p })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(p)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function ShippingsSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try { setList(await getShippings()); } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = q ? list.filter((p: any) => (String(p.name || '') + ' ' + String(p.phone || '')).toLowerCase().includes(q.toLowerCase())) : list;

  const save = async () => {
    if (!editing) return;
    if (!editing.name) { showToast('نام باربری الزامی است', true); return; }
    const dup = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.name || '').trim() === String(editing.name || '').trim());
    if (dup) { showToast('⚠️ این نام باربری قبلاً ثبت شده', true); return; }
    try {
      const payload = { ...editing }; delete payload.id;
      if (editing.id || editing.local_id) await updateShipping(editing.local_id || editing.id, payload);
      else await createShipping(payload);
      showToast('✅ باربری ذخیره شد'); setEditing(null); load();
    } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const remove = async (p: any) => {
    const ok = await confirmMsg('حذف باربری', '«' + (p.name || '') + '» حذف شود؟');
    if (!ok) return;
    try { await deleteShipping(p.local_id || p.id); load(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const startNew = () => setDrafts(prev => [...prev, { local_id: '', name: '', phone: '', note: '' }]);
  const updateDraft = (idx: number, field: string, value: any) => setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  const removeDraft = (idx: number) => setDrafts(prev => prev.filter((_, i) => i !== idx));

  const saveDrafts = async () => {
    if (!drafts.length) return;
    for (const d of drafts) if (!d.name) { showToast('نام در همه ردیف‌ها الزامی است', true); return; }
    for (let i = 0; i < drafts.length; i++) {
      const name = String(drafts[i].name || '').trim();
      if (list.find((x: any) => String(x.name || '').trim() === name)) { showToast('⚠️ نام «' + name + '» قبلاً ثبت شده', true); return; }
      if (drafts.find((x: any, j: number) => j !== i && String(x.name || '').trim() === name)) { showToast('⚠️ نام «' + name + '» در ردیف‌ها تکراری است', true); return; }
    }
    let success = 0;
    for (const d of drafts) { try { await createShipping(d); success++; } catch (e: any) { showToast(e?.message || String(e), true); } }
    if (success) { showToast('✅ ' + success + ' باربری ذخیره شد'); setDrafts([]); load(); }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={startNew}><Text style={s.btnTxt}>➕ افزودن باربری</Text></TouchableOpacity>
        {drafts.length > 0 && <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={saveDrafts}><Text style={s.btnTxt}>💾 ذخیره ({drafts.length})</Text></TouchableOpacity>}
      </View>
      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در باربری‌ها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>🚚 باربری‌ها ({toFaNum(filtered.length)})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse', position: 'relative', zIndex: 10 }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 250 }]}>نام باربری</Text>
            <Text style={[s.thCell, { width: 150 }]}>تلفن</Text>
            <Text style={[s.thCell, { width: 200 }]}>یادداشت</Text>
            <Text style={[s.thCell, { width: 100 }]}>عملیات</Text>
          </View>
          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {drafts.map((d, idx) => (
              <View key={'sd-' + idx} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }]}>D{idx + 1}</Text>
                <View style={{ width: 250, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.name || '')} onChangeText={(v) => updateDraft(idx, 'name', v)} placeholder="نام باربری *" /></View>
                <View style={{ width: 150, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.phone || '')} onChangeText={(v) => updateDraft(idx, 'phone', v)} keyboardType="phone-pad" placeholder="تلفن" /></View>
                <View style={{ width: 200, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.note || '')} onChangeText={(v) => updateDraft(idx, 'note', v)} placeholder="یادداشت" /></View>
                <View style={{ width: 100, alignItems: 'center' }}><TouchableOpacity onPress={() => removeDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>✕</Text></TouchableOpacity></View>
              </View>
            ))}
            {editing && (
              <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40 }]}>✏️</Text>
                <View style={{ width: 250, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.name || '')} onChangeText={(v) => setEditing({ ...editing, name: v })} placeholder="نام باربری *" /></View>
                <View style={{ width: 150, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.phone || '')} onChangeText={(v) => setEditing({ ...editing, phone: v })} keyboardType="phone-pad" placeholder="تلفن" /></View>
                <View style={{ width: 200, paddingHorizontal: 2 }}><TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.note || '')} onChangeText={(v) => setEditing({ ...editing, note: v })} placeholder="یادداشت" /></View>
                <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={save} style={{ backgroundColor: '#059669', padding: 6, borderRadius: 6 }}><Text>💾</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={{ backgroundColor: '#64748b', padding: 6, borderRadius: 6 }}><Text>✕</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((p: any, i: number) => (
              <View key={p.local_id || p.id || i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.tdCell, { width: 250, fontSize: 12, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name || '—'}</Text>
                <Text style={[s.tdCell, { width: 150, fontSize: 11, color: C.text }]}>{p.phone || '—'}</Text>
                <Text style={[s.tdCell, { width: 200, fontSize: 10, color: C.textMut, textAlign: 'right' }]} numberOfLines={1}>{p.note || '—'}</Text>
                <View style={[s.tdCell, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={() => setEditing({ ...p })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(p)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function SourcesSection({ showToast }: any) {
  const [sub, setSub] = useState<'parties' | 'products' | 'partners' | 'banks' | 'shippings'>('parties');
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
          <TouchableOpacity onPress={() => setSub('parties')} style={[s.btn, { backgroundColor: sub === 'parties' ? '#7c3aed' : '#334155', paddingHorizontal: 12 }]}><Text style={s.btnTxt}>👥 طرف‌حساب‌ها</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSub('products')} style={[s.btn, { backgroundColor: sub === 'products' ? '#7c3aed' : '#334155', paddingHorizontal: 12 }]}><Text style={s.btnTxt}>📦 کالاها</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSub('partners')} style={[s.btn, { backgroundColor: sub === 'partners' ? '#7c3aed' : '#334155', paddingHorizontal: 12 }]}><Text style={s.btnTxt}>👥 شرکا</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSub('banks')} style={[s.btn, { backgroundColor: sub === 'banks' ? '#7c3aed' : '#334155', paddingHorizontal: 12 }]}><Text style={s.btnTxt}>🏦 بانک‌ها</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSub('shippings')} style={[s.btn, { backgroundColor: sub === 'shippings' ? '#7c3aed' : '#334155', paddingHorizontal: 12 }]}><Text style={s.btnTxt}>🚚 باربری‌ها</Text></TouchableOpacity>
        </View>
      </ScrollView>
      {sub === 'parties' ? <PartiesSection showToast={showToast} /> : sub === 'products' ? <ProductsSection showToast={showToast} /> : sub === 'partners' ? <PartnersSection showToast={showToast} /> : sub === 'banks' ? <BanksSection showToast={showToast} /> : <ShippingsSection showToast={showToast} />}
    </View>
  );
}

function ProductsSection({ showToast }: any) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      const sorted = [...(data || [])].sort((a: any, b: any) => {
        const ca = String(a.code || '');
        const cb = String(b.code || '');
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
      });
      setList(sorted);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = q
    ? list.filter((p: any) => (String(p.code || '') + ' ' + String(p.name || '') + ' ' + String(p.shelf || '')).toLowerCase().includes(q.toLowerCase()))
    : list;

  const getNextProductCode = (listData: any[], draftData: any[], excludeIdx: number = -1) => {
    const codes = [
      ...listData.map(x => String(x.code || '')),
      ...draftData.filter((_, i) => i !== excludeIdx).map(x => String(x.code || ''))
    ].filter(Boolean);
    if (!codes.length) return '';
    let best: any = null;
    codes.forEach(c => {
      const m = c.match(/^(.*?)(\d+)$/);
      if (m) {
        const n = parseInt(m[2], 10);
        if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length };
      }
    });
    if (best) return best.prefix + String(best.n + 1).padStart(best.width, '0');
    return codes[codes.length - 1] + '-2';
  };

  const autoProductCode = () => {
    if (!editing || editing.id || editing.local_id) return;
    if (String(editing.code || '').trim()) return;
    const next = getNextProductCode(list, [], -1);
    if (next) setEditing({ ...editing, code: next });
  };

  const checkDuplicateName = (name: string, excludeLocalId?: string, excludeId?: string) => {
    const n = String(name || '').trim();
    if (!n) return null;
    return list.find((x: any) => (x.local_id !== excludeLocalId) && (x.id !== excludeId) && String(x.name || '').trim() === n) || null;
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name) { showToast('نام الزامی است', true); return; }
    const dupName = checkDuplicateName(editing.name, editing.local_id, editing.id);
    if (dupName) { showToast('⚠️ این نام کالا قبلاً ثبت شده', true); return; }
    const dupCode = list.find((x: any) => (x.local_id !== editing.local_id) && (x.id !== editing.id) && String(x.code || '').trim() === String(editing.code || '').trim());
    if (dupCode && editing.code) { showToast('⚠️ این کد کالا قبلاً ثبت شده', true); return; }
    let finalCode = editing.code;
    if (!finalCode) finalCode = getNextProductCode(list, [], -1);
    try {
      const payload: any = { ...editing, code: finalCode };
      delete payload.id;
      if (editing.id || editing.local_id) await updateProduct(editing.local_id || editing.id, payload);
      else await createProduct(payload);
      showToast('✅ کالا ذخیره شد');
      setEditing(null);
      load();
    } catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const remove = async (p: any) => {
    const ok = await confirmMsg('حذف کالا', '«' + (p.name || '') + '» حذف شود؟');
    if (!ok) return;
    try { await deleteProduct(p.local_id || p.id); load(); showToast('✅ حذف شد'); }
    catch (e: any) { showToast(e?.message || String(e), true); }
  };

  const startNew = () => {
    const nextCode = getNextProductCode(list, drafts);
    setDrafts((prev: any[]) => [...prev, { id: null, code: nextCode, name: '', price: 0, shelf: '' }]);
  };

  const updateDraft = (idx: number, field: string, value: any) => {
    setDrafts((prev: any[]) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const removeDraft = (idx: number) => {
    setDrafts((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  const saveDrafts = async () => {
    if (!drafts.length) return;
    for (const d of drafts) if (!d.name) { showToast('نام در همه ردیف‌ها الزامی است', true); return; }

    // چک نام تکراری
    for (let i = 0; i < drafts.length; i++) {
      const name = String(drafts[i].name || '').trim();
      const existing = list.find((x: any) => String(x.name || '').trim() === name);
      if (existing) {
        showToast('⚠️ نام «' + name + '» قبلاً ثبت شده است', true);
        return;
      }
      const otherDraft = drafts.find((x: any, j: number) => j !== i && String(x.name || '').trim() === name);
      if (otherDraft) {
        showToast('⚠️ نام «' + name + '» در ردیف‌های دیگر تکراری است', true);
        return;
      }
    }

    const newDrafts = [...drafts];
    for (let i = 0; i < newDrafts.length; i++) {
      let d = newDrafts[i];
      if (!d.code) d.code = getNextProductCode(list, newDrafts, i);
    }

    let success = 0;
    for (const d of newDrafts) {
      try { await createProduct(d); success++; }
      catch (e: any) { showToast('خطا: ' + (e?.message || String(e)), true); }
    }
    if (success) {
      showToast('✅ ' + success + ' کالا ذخیره شد');
      setDrafts([]);
      load();
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10 }}>
        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#7c3aed' }]} onPress={startNew}>
          <Text style={s.btnTxt}>➕ افزودن ردیف</Text>
        </TouchableOpacity>
        {drafts.length > 0 && (
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={saveDrafts}>
            <Text style={s.btnTxt}>💾 ذخیره همه ({drafts.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput style={[s.inp, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={q} onChangeText={setQ} placeholder="🔍 جستجو در کالاها..." placeholderTextColor={C.textMut} />
      <Text style={s.secT}>📦 کالاها ({toFaNum(filtered.length)})</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[s.tblHeader, { flexDirection: 'row-reverse', position: 'relative', zIndex: 10 }]}>
            <Text style={[s.thCell, { width: 40 }]}>#</Text>
            <Text style={[s.thCell, { width: 200 }]}>نام</Text>
            <Text style={[s.thCell, { width: 130 }]}>قیمت</Text>
            <Text style={[s.thCell, { width: 120 }]}>قفسه</Text>
            <Text style={[s.thCell, { width: 140 }]}>کد</Text>
            <Text style={[s.thCell, { width: 100 }]}>عملیات</Text>
          </View>

          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {drafts.map((d, idx) => (
              <View key={'draft-' + idx} style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }]}>D{idx + 1}</Text>
                <View style={{ width: 200, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.name || '')} onChangeText={(v: string) => updateDraft(idx, 'name', v)} placeholder="نام *" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 130, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.price || '')} onChangeText={(v: string) => updateDraft(idx, 'price', parseFloat(v) || 0)} keyboardType="numeric" placeholder="قیمت" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 120, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.shelf || '')} onChangeText={(v: string) => updateDraft(idx, 'shelf', v)} placeholder="قفسه" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 140, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(d.code || '')} onChangeText={(v: string) => updateDraft(idx, 'code', v)} placeholder="کد" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={() => removeDraft(idx)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>✕</Text></TouchableOpacity>
                </View>
              </View>
            ))}

            {editing && (
              <View style={[s.tblRow, { flexDirection: 'row-reverse', backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40 }]}>✏️</Text>
                <View style={{ width: 200, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.name || '')} onChangeText={(v: string) => setEditing({ ...editing, name: v })} onEndEditing={autoProductCode} placeholder="نام *" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 130, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.price || '')} onChangeText={(v: string) => setEditing({ ...editing, price: parseFloat(v) || 0 })} keyboardType="numeric" placeholder="قیمت" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 120, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.shelf || '')} onChangeText={(v: string) => setEditing({ ...editing, shelf: v })} placeholder="قفسه" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 140, paddingHorizontal: 2 }}>
                  <TextInput style={[s.tdInput, { backgroundColor: C.input, color: C.text, borderColor: C.border }]} value={String(editing.code || '')} onChangeText={(v: string) => setEditing({ ...editing, code: v })} placeholder="کد" placeholderTextColor={C.textMut} />
                </View>
                <View style={{ width: 100, flexDirection: 'row-reverse', gap: 4, justifyContent: 'center' }}>
                  <TouchableOpacity onPress={save} style={{ backgroundColor: '#059669', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>💾</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={{ backgroundColor: '#64748b', padding: 6, borderRadius: 6 }}><Text style={{ color: '#fff', fontSize: 12 }}>✕</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {loading ? <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} /> : filtered.map((p: any, i: number) => (
              <View key={p.local_id || p.id || i} style={[s.tblRow, { flexDirection: 'row-reverse' }, i % 2 === 0 && { backgroundColor: C.cardAlt }]}>
                <Text style={[s.tdCell, { width: 40, fontSize: 12, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                <Text style={[s.tdCell, { width: 200, fontSize: 12, color: C.text, fontWeight: 'bold', textAlign: 'right' }]} numberOfLines={1}>{p.name || '—'}</Text>
                <Text style={[s.tdCell, { width: 130, fontSize: 12, color: '#00ff88', fontWeight: 'bold' }]}>{fmt(p.price || 0)}</Text>
                <Text style={[s.tdCell, { width: 120, fontSize: 12, color: C.text }]}>{p.shelf || '—'}</Text>
                <Text style={[s.tdCell, { width: 140, fontSize: 11, color: '#7c3aed' }]}>{p.code || '—'}</Text>
                <View style={[s.tdCell, { width: 100, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                  <TouchableOpacity onPress={() => setEditing({ ...p })} style={{ backgroundColor: '#dbeafe', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(p)} style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 }}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
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
      
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (!w) {
          showToast('پنجره چاپ باز نشد. لطفاً پاپ‌آپ را اجازه دهید.', true);
          return;
        }
        w.document.open();
        w.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>چاپ فاکتور</title><style>body{margin:0;padding:0;background:#fff} img{width:100%;max-width:100%;height:auto;display:block} @page{size:A4;margin:8mm}</style></head><body><img id="inv" src="' + uri + '" /></body></html>');
        w.document.close();
        const img = w.document.getElementById('inv');
        if (img) {
          img.onload = () => {
            w.focus();
            w.print();
          };
        } else {
          setTimeout(() => { w.focus(); w.print(); }, 800);
        }
        showToast('✅ پنجره چاپ آماده شد');
        return;
      }
      
      if (mode === 'print') await Print.printAsync({ uri });
      else if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); if (mode === 'save') showToast('✅ ذخیره شد'); }
      else showToast('اشتراک پشتیبانی نمی‌شود', true);
    } catch (e: any) { showToast(e.message, true); }
  };



  return (

    <View style={{ flex: 1, overflow: 'hidden' }}>
    <ScrollView style={[s.content, { backgroundColor: C.bg, flex: 1 }]} contentContainerStyle={{ padding: 10, paddingBottom: 60 }}>

      <View ref={ref} collapsable={false} style={s.invoiceContainer}>

        <View style={s.invHeader}>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>

            <Text style={{ fontSize: 20 }}>⚖️</Text>

            <View>

              <EL textKey="میزان" style={s.invBrand} />

                       <EL textKey="حساب‌ها دقیق، معاملات امن، ذهن آسوده." style={s.invSlogan} />

            </View>

          </View>

          <View style={{ alignItems: 'flex-end' }}>

            <Text style={s.invSmall}>📞 ________________</Text>

            <Text style={s.invSmall}>📧 ________________</Text>

          </View>

        </View>



        <EL textKey="پیش فروش کفش تاج" style={s.invTitle} />

        <Text style={s.invDateTxt}>📅 {invoice.timeString}</Text>



        <View style={s.invSection}>

          <EL textKey="👤 اطلاعات مشتری" style={s.invSectionTitle} />

          <View style={s.invCGrid}>

            <View style={s.invCell}><EL textKey="نام" style={s.invCellL} /><Text style={s.invCellV}>{c.name}</Text></View>

            <View style={s.invCell}><EL textKey="تلفن" style={s.invCellL} /><Text style={s.invCellV}>{c.phone}</Text></View>

            <View style={s.invCell}><EL textKey="کد مشتری" style={s.invCellL} /><Text style={s.invCellV}>{c.code}</Text></View>

            <View style={s.invCell}><EL textKey="شماره فاکتور" style={s.invCellL} /><Text style={s.invCellV}>{cur.invoiceNumber}</Text></View>

            {c.address ? <View style={[s.invCell, { width: '100%' }]}><EL textKey="📍 آدرس" style={s.invCellL} /><Text style={s.invCellV}>{c.address}</Text></View> : null}

            {c.shipping ? <View style={s.invCell}><EL textKey="🚚 باربری" style={s.invCellL} /><Text style={s.invCellV}>{c.shipping}</Text></View> : null}

          </View>

        </View>



        <View style={s.invSection}>

          <EL textKey="📦 اقلام" style={s.invSectionTitle} />

          <View style={s.invTableHead}>
            <Text style={[s.invTh, { flex: 0.4, textAlign: 'center' }]}>#</Text>
            <Text style={[s.invTh, { flex: 1.2, textAlign: 'center' }]}>کد مدل</Text>
            <Text style={[s.invTh, { flex: 2, textAlign: 'right' }]}>نام مدل</Text>
            <Text style={[s.invTh, { flex: 0.8, textAlign: 'center' }]}>قفسه</Text>
            <Text style={[s.invTh, { flex: 0.6, textAlign: 'center' }]}>تعداد</Text>
            <Text style={[s.invTh, { flex: 1, textAlign: 'center' }]}>قیمت</Text>
            <Text style={[s.invTh, { flex: 1.2, textAlign: 'center' }]}>مبلغ</Text>
          </View>
          {cur.items.map((it: any, i: number) => (
            <View key={i} style={[s.invRow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
              <Text style={[s.invTd, { flex: 0.4, textAlign: 'center' }]}>{i + 1}</Text>
              <Text style={[s.invTd, { flex: 1.2, textAlign: 'center', fontSize: 11 }]}>{it.modelCode || '—'}</Text>
              <Text style={[s.invTd, { flex: 2, textAlign: 'right', fontWeight: 'bold' }]}>{it.modelName}</Text>
              <Text style={[s.invTd, { flex: 0.8, textAlign: 'center' }]}>{it.shelf || '—'}</Text>
              <Text style={[s.invTd, { flex: 0.6, textAlign: 'center' }]}>{it.quantity}</Text>
              <Text style={[s.invTd, { flex: 1, textAlign: 'center' }]}>{fmt(it.priceUnit)}</Text>
              <Text style={[s.invTd, { flex: 1.2, textAlign: 'center', fontWeight: 'bold' }]}>{fmt(it.total)}</Text>
            </View>
          ))}

        </View>



              <View style={s.invSection}>

          <EL textKey="💰 خلاصه مالی" style={s.invSectionTitle} />



          {/* این سفارش */}

          <SumRow l="🛍️ مبلغ این سفارش" v={fmt(cur.sales) + ' ' + (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '')} />

          <SumRow l="💳 پرداخت این سفارش" v={fmt(cur.payments) + ' ' + (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '')} green />



          {/* فاکتورهای قبلی */}

          {invoice.previous && invoice.previous.invoiceCount > 0 && (

            <>

              <SumRow l="📁 تعداد فاکتورهای قبلی" v={toFaNum(invoice.previous.invoiceCount) + ' فاکتور'} />

              <SumRow l="💰 جمع خریدهای قبلی" v={fmt(invoice.previous.sales) + ' ' + (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '')} />

              <SumRow l="💳 جمع پرداخت‌های قبلی" v={fmt(invoice.previous.payments) + ' ' + (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '')} green />

              <SumRow

                l={invoice.previous.balance > 0 ? '⚖️ بدهی از قبل' : invoice.previous.balance < 0 ? '💰 بستانکاری از قبل' : '✅ تسویه شده از قبل'}

                v={invoice.previous.balance !== 0 ? fmt(Math.abs(invoice.previous.balance)) + ' ' + (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '') : 'بدون بدهی'}

                prev

              />

            </>

          )}



          {/* مانده نهایی */}

          <SumRow

            l={tot.balance > 0 ? '⚖️ مانده نهایی قابل پرداخت' : tot.balance < 0 ? '💰 بستانکاری نهایی' : '✅ تسویه کامل'}

            v={tot.balance !== 0 ? fmt(Math.abs(tot.balance)) + ' ' + (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : '') : 'بدون بدهی'}

            highlight

          />

        </View>



        <View style={s.invFooter}>

          <EL textKey="📞 کفش تاج: ________________" style={s.invFooterTxt} />

          <EL textKey="با تشکر از اعتماد شما 🙏" style={s.invFooterThanks} />

        </View>

      </View>



      {/* دکمه‌های عملیات */}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>

        <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 90, backgroundColor: '#fff', borderWidth: 2, borderColor: '#1e3a5f' }]} onPress={() => captureAndShare('print')}>

          <Text style={[s.btnTxt, { color: '#1e3a5f' }]}>{t('🖨️ پرینت')}</Text>

        </TouchableOpacity>

        <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 90, backgroundColor: '#0ea5e9' }]} onPress={() => captureAndShare('share')}>

          <Text style={s.btnTxt}>{t('📤 اشتراک')}</Text>

        </TouchableOpacity>

        <TouchableOpacity style={[s.btn, { flex: 1, minWidth: 90, backgroundColor: '#8e44ad' }]} onPress={() => captureAndShare('save')}>

          <Text style={s.btnTxt}>{t('💾 ذخیره')}</Text>

        </TouchableOpacity>

      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>

        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#64748b' }]} onPress={onBack}><Text style={s.btnTxt}>{t('↩️ برگشت')}</Text></TouchableOpacity>

        <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#1e3a8a' }]} onPress={onNew}><Text style={s.btnTxt}>{t('🛒 فاکتور جدید')}</Text></TouchableOpacity>

      </View>

    </ScrollView>
    </View>

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

//  EL — Editable Label (ویرایش‌پذیر)

// ══════════════════════════════════════════════════════════

function EL({ text, textKey, style, showIcon = true, children }: any) {

  const _raw = text || textKey || '';

  const [showEdit, setShowEdit] = useState(false);

  const [tmp, setTmp] = useState('');

  const lbl = cl(_raw);

  const openEditor = () => { setTmp(lbl); setShowEdit(true); };

  return (

    <>

      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>

        <Text style={style}>{lbl}{children}</Text>

        {showIcon && (

          <TouchableOpacity onPress={openEditor} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>

            <Text style={{ fontSize: 9, opacity: 0.3 }}>✏️</Text>

          </TouchableOpacity>

        )}

      </View>

      

    </>

  );

}



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

      // 📱 چک: آیا ایمیل زده یا شماره؟

      let loginEmail = email.trim();

      

      if (!loginEmail.includes('@')) {

        // شماره زده — تبدیل به ایمیل

        const { data: fetchedEmail } = await supabase.rpc('get_email_by_phone', { p_phone: loginEmail });

        if (!fetchedEmail) {

          return showToast('❌ کاربری با این شماره یافت نشد. لطفاً با ایمیل وارد شوید.', true);

        }

        loginEmail = fetchedEmail;

      }



      const { error: e1 } = await supabase.auth.signInWithPassword({ email: loginEmail, password: pass });

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

        <Text style={s.loginTitle}>{t('میزان')}</Text>

        <Text style={s.loginSub}>{t('ورود یا ثبت‌نام')}</Text>

        <TextInput accessibilityLabel="ایمیل" style={s.loginInp} value={email} onChangeText={setEmail} placeholder="ایمیل" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />

        <TextInput accessibilityLabel="رمز (حداقل ۶ کاراکتر)" style={s.loginInp} value={pass} onChangeText={setPass} placeholder="رمز (حداقل ۶ کاراکتر)" placeholderTextColor="#94a3b8" secureTextEntry />

        <TouchableOpacity style={[s.btn, { backgroundColor: '#1e3a8a', marginTop: 6 }]} onPress={submit} disabled={loading}>

          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{t('ورود / ثبت‌نام')}</Text>}

        </TouchableOpacity>

        <EL textKey="اگر حساب ندارید، خودکار ساخته می‌شود" style={s.loginNote} />

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

  invTh: { color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

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

