const fs = require('fs');
const path = require('path');

console.log('🔧 Fix SafeAreaProvider\n');

const bdir = 'backup-before-provider-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));

let app = fs.readFileSync('App.tsx', 'utf8');
const orig = app;
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. عوض کردن import
// ═══════════════════════════════════════════
app = app.replace(
  /import\s*\{\s*SafeAreaView\s*\}\s*from\s*'react-native-safe-area-context';/,
  "import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';"
);
console.log('✅ import SafeAreaProvider اضافه شد');

// ═══════════════════════════════════════════
// ۲. پیدا کردن تابع App
// ═══════════════════════════════════════════
// الگو: function App() { ... return (...); }
// یا: export default function App() { ... }

// چک کن App چطوریه
if (app.includes('export default function App()')) {
  // ساده — فقط دور return رو wrap کن
  console.log('📍 الگو: export default function App()');
} else if (app.match(/function App\s*\(\s*\)/)) {
  console.log('📍 الگو: function App()');
} else {
  console.log('⚠️ تابع App پیدا نشد');
}

// ═══════════════════════════════════════════
// ۳. پیدا کردن آخرین return که main render هست
// ═══════════════════════════════════════════
// دنبال MainApp بگرد که معمولاً آخرین کامپوننت هست
const mainAppMatch = app.match(/function MainApp[\s\S]*?return\s*\(([\s\S]*?)\n\s*\);\s*\n\}/);
if (mainAppMatch) {
  console.log('✅ MainApp پیدا شد');
}

// ═══════════════════════════════════════════
// ۴. پیدا کردن SafeAreaView که خطا می‌ده
// ═══════════════════════════════════════════
const errorLine = '<SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>';

if (app.includes(errorLine)) {
  console.log('✅ SafeAreaView مشکل‌دار پیدا شد');
  
  // راه‌حل: کل تابع App رو wrap کن
  // یا SafeAreaView رو از react-native استفاده کن
  
  // راه ساده: SafeAreaView رو از react-native import کن
  app = app.replace(
    "import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';",
    "import { SafeAreaProvider } from 'react-native-safe-area-context';\nimport { SafeAreaView } from 'react-native';"
  );
  console.log('✅ SafeAreaView از react-native برگشت (پایدار)');
  
  // حذف SafeAreaProvider از import (چون استفاده نمی‌شه)
  // ولی نگهش می‌داریم برای فایل‌های دیگه
  
  // اگه SafeAreaProvider جایی استفاده نشده، import رو حذف کن
  // ولی فعلاً نگه دار
  
  // چک کن react-native قبلاً import داره
  const rnImport = app.match(/import\s*\{([^}]+)\}\s*from\s*'react-native';/);
  if (rnImport) {
    if (!rnImport[1].includes('SafeAreaView')) {
      const newImport = "import { " + rnImport[1].trim() + ", SafeAreaView } from 'react-native';";
      app = app.replace(rnImport[0], newImport);
      console.log('✅ SafeAreaView به import react-native اضافه شد');
    }
  }
  
  // حذف خط اضافی
  app = app.replace(
    "import { SafeAreaProvider } from 'react-native-safe-area-context';\nimport { SafeAreaView } from 'react-native';\n",
    "import { SafeAreaView } from 'react-native';\nimport { SafeAreaProvider } from 'react-native-safe-area-context';\n"
  );
}

if (crlf) app = app.replace(/\n/g, '\r\n');
if (app !== orig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('الان بزن:');
console.log('  npx expo start --clear');
console.log('');
console.log('🛡 بکاپ: ' + bdir);