// fix-market-notif.js — صدا APK + اعلان بازار + تنظیمات
const fs = require('fs');

// ═══════════════════════════════════════════════════════
// بخش ۱: بهبود lib.notifications.ts برای APK
// ═══════════════════════════════════════════════════════
console.log('═══ ۱. lib.notifications.ts ═══');
let notif = fs.readFileSync('lib.notifications.ts', 'utf8');
const notifOrig = notif;

// ۱. صدا در WebView هم کار کند (حذف block)
notif = notif.replace(
  /export function playNotifSound\(\) \{\s*\n\s*if \(_isWebView\) return;/g,
  'export function playNotifSound() {\n  // در WebView هم صدا پخش شود'
);

notif = notif.replace(
  /export function vibrateNotif\(\) \{\s*\n\s*if \(_isWebView\) return;/g,
  'export function vibrateNotif() {\n  // در WebView هم لرزش'
);

if (notif !== notifOrig) {
  fs.writeFileSync('lib.notifications.ts', notif, 'utf8');
  console.log('✅ صدا در APK فعال شد');
} else {
  console.log('ℹ️ تغییری نکرد یا الگو پیدا نشد');
}

// ═══════════════════════════════════════════════════════
// بخش ۲: بهبود App.tsx — polling پیام‌های بازار
// ═══════════════════════════════════════════════════════
console.log('\n═══ ۲. App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;

// چک: آیا polling پیام‌های نخوانده هست؟
if (app.includes('fetchMyUnreadMessages')) {
  console.log('✅ polling پیام‌ها هست');
  
  // چک: آیا interval کمتر از 3000 هست؟
  const msgPollMatch = app.match(/fetchMyUnreadMessages[\s\S]{0,500}setInterval\(tick,\s*(\d+)\)/);
  if (msgPollMatch) {
    const interval = msgPollMatch[1];
    console.log('   interval:', interval, 'ms');
    if (parseInt(interval) > 2000) {
      console.log('   ⚠️ کند است، باید < 2000 باشد');
    }
  }
} else {
  console.log('❌ polling پیام‌ها نیست — باید اضافه کنیم');
}

// چک: آیا unreadMsgs با صدای بازار هم trigger می‌شود؟
const hasNotifSound = app.includes('playNotifSound');
console.log('playNotifSound:', hasNotifSound ? '✅' : '❌');

// ═══════════════════════════════════════════════════════
// بخش ۳: اضافه کردن تنظیمات به PublicMarketScreen
// ═══════════════════════════════════════════════════════
console.log('\n═══ ۳. PublicMarketScreen — تنظیمات ═══');
let pms = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const pmsOrig = pms;

// اضافه کردن import
if (!pms.includes('savePreferences')) {
  pms = pms.replace(
    "import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';",
    "import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, RefreshControl, Switch } from 'react-native';"
  );
  console.log('✅ Switch import شد');
}

// اضافه state
if (!pms.includes('settingsModal')) {
  pms = pms.replace(
    "  const [refreshing, setRefreshing] = useState(false);",
    `  const [refreshing, setRefreshing] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [prefs, setPrefs] = useState<any>({});`
  );
  console.log('✅ State اضافه شد');
}

// اضافه load prefs در useEffect
if (!pms.includes('fetchPreferences')) {
  pms = pms.replace(
    "  useEffect(() => { load(); }, [load]);",
    `  useEffect(() => { load(); }, [load]);

  // load تنظیمات
  useEffect(() => {
    (async () => {
      try {
        const m = await import('./lib.network');
        const p = await (m as any).fetchPreferences?.();
        if (p) setPrefs(p);
      } catch {}
    })();
  }, []);`
  );
  console.log('✅ Load prefs اضافه شد');
}

if (pms !== pmsOrig) {
  fs.writeFileSync('PublicMarketScreen.tsx', pms, 'utf8');
  console.log('💾 ذخیره شد');
}

console.log('\n✅ تمام');