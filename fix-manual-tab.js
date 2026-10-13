const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-fixmanualtab-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('App.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. حذف خط خراب (با \\n خام)
// ═══════════════════════════════════════════
const badLine1 = `      {tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}\\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`;
const badLine2 = `{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}\\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`;

if (s.includes(badLine1)) {
  s = s.replace(badLine1, `      {tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`);
  console.log('✅ خط خراب (badLine1) fix شد');
} else if (s.includes(badLine2)) {
  s = s.replace(badLine2, `{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}`);
  console.log('✅ خط خراب (badLine2) fix شد');
} else {
  // regex fallback
  const regex = /(\{tab === 'publicMarket' && <PublicMarketScreen showToast=\{showToast\} \/>\})\\n(\s*)(\{tab === 'manualEntry' && <ManualEntryScreen showToast=\{showToast\} \/>\})/;
  if (regex.test(s)) {
    s = s.replace(regex, '$1\n      $3');
    console.log('✅ خط خراب (regex) fix شد');
  } else {
    console.log('⚠️ خط خراب پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ۲. اضافه import اگه نیست
// ═══════════════════════════════════════════
if (!s.includes("import ManualEntryScreen from './ManualEntryScreen'")) {
  const lines = s.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import ManualEntryScreen from './ManualEntryScreen';");
    s = lines.join('\n');
    console.log('✅ import اضافه شد (خط ' + (lastImport + 2) + ')');
  } else {
    console.log('❌ محل import پیدا نشد');
  }
} else {
  console.log('ℹ️ import از قبل هست');
}

// ═══════════════════════════════════════════
// ۳. اضافه tab به tabs array
// ═══════════════════════════════════════════
if (!/key:\s*['"]manualEntry['"]/.test(s)) {
  // الگوی tab: { key: 'publicMarket', icon: '🏛️', label: 'بازار', color: '#0891b2' },
  const tabRegex = /(\{\s*key:\s*['"]publicMarket['"][^}]*\},)/;
  const match = s.match(tabRegex);
  if (match) {
    s = s.replace(match[0], match[0] + "\n    { key: 'manualEntry', icon: '🤖', label: 'دستیار', color: '#7c3aed' },");
    console.log('✅ tab اضافه شد');
  } else {
    console.log('❌ الگوی tabs پیدا نشد — نیاز به بررسی دستی');
    // چاپ خطوط اطراف
    const lines = s.split('\n');
    lines.forEach((l, i) => {
      if (l.includes("key: 'publicMarket'") || l.includes("key: 'bankMatch'")) {
        console.log('   خط ' + (i+1) + ': ' + l.trim());
      }
    });
  }
} else {
  console.log('ℹ️ tab از قبل هست');
}

// ═══════════════════════════════════════════
// ۴. چک render
// ═══════════════════════════════════════════
if (!s.includes("{tab === 'manualEntry' && <ManualEntryScreen")) {
  console.log('⚠️ render پیدا نشد — دوباره اضافه می‌کنم');
  const pat = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}";
  if (s.includes(pat)) {
    s = s.replace(pat, pat + "\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}");
    console.log('✅ render اضافه شد');
  }
}

// ═══════════════════════════════════════════
// ذخیره
// ═══════════════════════════════════════════
if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('App.tsx', s, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// چک نهایی
// ═══════════════════════════════════════════
console.log('');
console.log('═══ چک نهایی ═══');
const finalApp = fs.readFileSync('App.tsx', 'utf8');
console.log('import: ' + (finalApp.includes("import ManualEntryScreen") ? '✅' : '❌'));
console.log('tab: ' + (/key:\s*['"]manualEntry['"]/.test(finalApp) ? '✅' : '❌'));
console.log('render: ' + (finalApp.includes("{tab === 'manualEntry'") ? '✅' : '❌'));

// نمایش خطوط اطراف
console.log('');
console.log('─── خطوط اطراف tab ───');
const finalLines = finalApp.split(/\r?\n/);
finalLines.forEach((l, i) => {
  if (l.includes("key: 'manualEntry'") || l.includes("key: 'publicMarket'") || l.includes("key: 'bankMatch'")) {
    console.log((i + 1) + ': ' + l.trim());
  }
});

console.log('');
console.log('─── خطوط render ───');
finalLines.forEach((l, i) => {
  if (l.includes("ManualEntryScreen") || l.includes("PublicMarketScreen showToast")) {
    console.log((i + 1) + ': ' + l.trim().substring(0, 100));
  }
});

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\App.tsx" App.tsx');