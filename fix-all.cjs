const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════');
console.log('🔧 Fix کامل — TypeError + SafeAreaView');
console.log('═══════════════════════════════════════════\n');

const bdir = 'backup-before-allfix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });

// ═══════════════════════════════════════════
// ۱. package.json — main → index.js
// ═══════════════════════════════════════════
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.copyFileSync('package.json', path.join(bdir, 'package.json'));

if (pkg.main !== 'index.js') {
  console.log('📝 main: ' + pkg.main + ' → index.js');
  pkg.main = 'index.js';
}

// چک کن safe-area-context توی dependencies هست
if (!pkg.dependencies['react-native-safe-area-context']) {
  console.log('➕ react-native-safe-area-context اضافه شد');
  pkg.dependencies['react-native-safe-area-context'] = '~5.7.0';
}
if (!pkg.dependencies['react-native-screens']) {
  console.log('➕ react-native-screens اضافه شد');
  pkg.dependencies['react-native-screens'] = '~4.26.0';
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2), 'utf8');
console.log('✅ package.json ذخیره شد');

// ═══════════════════════════════════════════
// ۲. index.js — entry point
// ═══════════════════════════════════════════
const indexJs = `import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
`;

if (fs.existsSync('index.js')) fs.copyFileSync('index.js', path.join(bdir, 'index.js.old'));
fs.writeFileSync('index.js', indexJs, 'utf8');
console.log('✅ index.js ساخته شد');

// ═══════════════════════════════════════════
// ۳. App.tsx — SafeAreaView از پکیج درست
// ═══════════════════════════════════════════
let app = fs.readFileSync('App.tsx', 'utf8');
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));

const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// چک کن import از react-native-safe-area-context هست یا نه
if (!app.includes("from 'react-native-safe-area-context'")) {
  // اضافه کن در بالای فایل
  const lines = app.split('\n');
  let firstImport = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].trim().startsWith('import ')) {
      firstImport = i;
      break;
    }
  }
  if (firstImport >= 0) {
    lines.splice(firstImport, 0, "import { SafeAreaView } from 'react-native-safe-area-context';");
    app = lines.join('\n');
    console.log('✅ SafeAreaView از safe-area-context اضافه شد');
  }
}

// حذف SafeAreaView از react-native (اگه هست)
app = app.replace(
  /import\s*\{([^}]*),?\s*SafeAreaView\s*,?([^}]*)\}\s*from\s*'react-native';/g,
  (match, before, after) => {
    const parts = [before, after].filter(x => x.trim()).map(x => x.trim().replace(/^,|,$/g, ''));
    if (parts.length === 0 || parts.every(x => !x)) {
      return '';
    }
    return `import { ${parts.join(', ')} } from 'react-native';`;
  }
);

if (crlf) app = app.replace(/\n/g, '\r\n');
fs.writeFileSync('App.tsx', app, 'utf8');
console.log('✅ App.tsx — SafeAreaView fix شد');

// ═══════════════════════════════════════════
// ۴. lib.voice.ts — غیرفعال کردن Native
// ═══════════════════════════════════════════
if (fs.existsSync('lib.voice.ts')) {
  fs.copyFileSync('lib.voice.ts', path.join(bdir, 'lib.voice.ts'));
  let v = fs.readFileSync('lib.voice.ts', 'utf8');
  const vcrlf = v.includes('\r\n');
  if (vcrlf) v = v.replace(/\r\n/g, '\n');
  
  v = v.replace(/export const hasNativeSpeech = [^;]+;/, 'export const hasNativeSpeech = false;');
  
  if (vcrlf) v = v.replace(/\n/g, '\r\n');
  fs.writeFileSync('lib.voice.ts', v, 'utf8');
  console.log('✅ lib.voice.ts — Native غیرفعال');
}

// ═══════════════════════════════════════════
// ۵. چک فایل‌های dynamic import
// ═══════════════════════════════════════════
const checkFiles = [
  'lib.local.nlu.ts',
  'lib.local.exec.ts',
  'lib.learning.ts',
  'lib.learning.intents.ts',
  'LocalBotScreen.tsx',
  'LearningScreen.tsx',
  'AssistantScreen.tsx',
  'TrueAIScreen.tsx',
  'HybridAssistantScreen.tsx',
  'AIAssistantScreen.tsx',
];

console.log('');
console.log('═══ فایل‌های موجود ═══');
checkFiles.forEach(f => {
  console.log((fs.existsSync(f) ? '✅' : '❌') + ' ' + f);
});

// ═══════════════════════════════════════════
// ۶. App.tsx — چک import های مشکل‌دار
// ═══════════════════════════════════════════
console.log('');
console.log('═══ چک import های App.tsx ═══');
const appContent = fs.readFileSync('App.tsx', 'utf8');
const imports = appContent.match(/import\s+[^;]+from\s+['"][^'"]+['"]/g) || [];
const missingImports = [];

imports.forEach(imp => {
  const m = imp.match(/from\s+['"]\.\/([^'"]+)['"]/);
  if (m) {
    const fname = m[1];
    const possible = [fname + '.tsx', fname + '.ts', fname + '/index.tsx', fname + '/index.ts'];
    const exists = possible.some(p => fs.existsSync(p));
    if (!exists) {
      missingImports.push(fname);
      console.log('❌ import ناموجود: ./' + fname);
    }
  }
});

if (missingImports.length === 0) {
  console.log('✅ همه import ها موجودن');
}

// ═══════════════════════════════════════════
// ۷. راهنما
// ═══════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('🛡 بکاپ: ' + bdir);
console.log('');
console.log('═'.repeat(50));
console.log('الان این دستورات رو به ترتیب بزن:');
console.log('═'.repeat(50));
console.log('');
console.log('۱. حذف node_modules و نصب دوباره:');
console.log('   rmdir /s /q node_modules');
console.log('   rmdir /s /q .expo');
console.log('   npm install');
console.log('');
console.log('۲. اجرا:');
console.log('   npx expo start --clear');
console.log('');
console.log('═'.repeat(50));