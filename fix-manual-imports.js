const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-fiximports-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('ManualEntryScreen.tsx', path.join(bdir, 'ManualEntryScreen.tsx'));
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. fix imports در ManualEntryScreen.tsx
// ═══════════════════════════════════════════
let s = fs.readFileSync('ManualEntryScreen.tsx', 'utf8');
const orig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// تعویض lib.db → lib
s = s.replace(
  "import { getPurchasesGrouped, createPurchase } from './lib.db';",
  "import { getPurchasesGrouped, createPurchase } from './lib';"
);
console.log('✅ lib.db → lib عوض شد');

// حذف import های اضافی که شاید وجود نداشته باشن
const badImports = [
  "import {\n  getFxCustomers, createFxCustomer,\n} from './lib.fx.cust';\n",
  "import {\n  getHawalas, createHawala,\n} from './lib.fx';\n",
  "import { getFxCustomers, createFxCustomer } from './lib.fx.cust';\n",
  "import { getHawalas, createHawala } from './lib.fx';\n",
  "import { getSalesGrouped, createSale } from './lib';\n",
];

// چک کن کدوم import ها سالمه
const testImports = [
  { name: 'getFxCustomers', from: './lib.fx.cust', exists: fs.existsSync('lib.fx.cust.ts') },
  { name: 'createFxCustomer', from: './lib.fx.cust', exists: fs.existsSync('lib.fx.cust.ts') },
  { name: 'getHawalas', from: './lib.fx', exists: fs.existsSync('lib.fx.ts') },
  { name: 'createHawala', from: './lib.fx', exists: fs.existsSync('lib.fx.ts') },
  { name: 'getSalesGrouped', from: './lib', exists: fs.existsSync('lib.ts') },
  { name: 'createSale', from: './lib', exists: fs.existsSync('lib.ts') },
  { name: 'getPurchasesGrouped', from: './lib', exists: fs.existsSync('lib.ts') },
  { name: 'createPurchase', from: './lib', exists: fs.existsSync('lib.ts') },
];

console.log('');
console.log('چک import ها:');
testImports.forEach(t => {
  console.log('  ' + (t.exists ? '✅' : '❌') + ' ' + t.name + ' از ' + t.from);
});

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('ManualEntryScreen.tsx', s, 'utf8');
  console.log('💾 ManualEntryScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. دوباره tab + render + import به App.tsx
// ═══════════════════════════════════════════
console.log('');
console.log('═══ App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;
const appCRLF = app.includes('\r\n');
if (appCRLF) app = app.replace(/\r\n/g, '\n');

// import
if (!app.includes("import ManualEntryScreen from './ManualEntryScreen';")) {
  const lines = app.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import ManualEntryScreen from './ManualEntryScreen';");
    app = lines.join('\n');
    console.log('✅ import اضافه شد');
  }
}

// tab
if (!/key:\s*['"]manualEntry['"]/.test(app)) {
  const pat = /(\{\s*key:\s*['"]publicMarket['"][^}]*\},)/;
  const m = app.match(pat);
  if (m) {
    app = app.replace(m[0], m[0] + "\n    { key: 'manualEntry', icon: '🤖', label: 'دستیار', color: '#7c3aed' },");
    console.log('✅ tab اضافه شد');
  }
}

// render
if (!app.includes("{tab === 'manualEntry'")) {
  const pat2 = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}";
  if (app.includes(pat2)) {
    app = app.replace(pat2, pat2 + "\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}");
    console.log('✅ render اضافه شد');
  }
}

if (appCRLF) app = app.replace(/\n/g, '\r\n');
if (app !== appOrig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('اگه خطا داد → F12 → Console → خطا رو بفرست');