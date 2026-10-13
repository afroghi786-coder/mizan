const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-boxnav-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['ExchangeScreen.tsx', 'BoxesScreen.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. ExchangeScreen — state + pass filter
// ═══════════════════════════════════════════
console.log('═══ ExchangeScreen.tsx ═══');
let ex = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const exOrig = ex;
const exCRLF = ex.includes('\r\n');
if (exCRLF) ex = ex.replace(/\r\n/g, '\n');

// ۱.۱ اضافه state بعد از sub
if (!ex.includes('boxDeepSearch')) {
  const subStateMatch = ex.match(/(const \[sub, setSub\] = useState<[^>]*>\([^)]*\);)/);
  if (subStateMatch) {
    // اضافه بعد از کل تعریف state (چند خطی)
    // پیدا کردن انتهای state
    const startIdx = ex.indexOf(subStateMatch[0]);
    const endIdx = ex.indexOf(');', startIdx);
    if (endIdx > 0) {
      const insertPos = endIdx + 2;
      ex = ex.substring(0, insertPos) + "\n  const [boxDeepSearch, setBoxDeepSearch] = useState<string>('');" + ex.substring(insertPos);
      console.log('✅ boxDeepSearch state اضافه شد');
    }
  } else {
    console.log('⚠️ sub state پیدا نشد');
  }
} else {
  console.log('ℹ️ boxDeepSearch از قبل هست');
}

// ۱.۲ آپدیت render BoxesScreen برای پاس دادن filter
const boxesRenderOld = `{sub === 'boxes' && (<BoxesScreen showToast={showToast} buyers={fxBuyers} />)}`;
const boxesRenderNew = `{sub === 'boxes' && (<BoxesScreen showToast={showToast} buyers={fxBuyers} filterName={boxDeepSearch} />)}`;

if (ex.includes(boxesRenderOld)) {
  ex = ex.replace(boxesRenderOld, boxesRenderNew);
  console.log('✅ BoxesScreen — filterName پاس داده شد');
} else {
  console.log('⚠️ الگوی BoxesScreen پیدا نشد');
}

// ۱.۳ آپدیت deep link handler
const dlOld = `if (dl.params?.name && dl.sub === 'boxes') {
            // جستجو در صندوق‌ها — بذار برای فاز بعد
          }`;
const dlNew = `if (dl.params?.name) {
            setBoxDeepSearch(dl.params.name);
            console.log('🤖 فیلتر صندوق با: ' + dl.params.name);
            setTimeout(() => setBoxDeepSearch(''), 15000);
          }`;

if (ex.includes(dlOld)) {
  ex = ex.replace(dlOld, dlNew);
  console.log('✅ Deep link → setBoxDeepSearch');
} else {
  console.log('⚠️ الگوی deep link پیدا نشد');
  // اگه deep link handler اصلاً نیست، اضافه کن
  if (!ex.includes('consumeDeepLink')) {
    console.log('⚠️ deep link handler اصلاً نیست');
  }
}

if (exCRLF) ex = ex.replace(/\n/g, '\r\n');
if (ex !== exOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', ex, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. BoxesScreen — accept filterName + filter + highlight
// ═══════════════════════════════════════════
console.log('');
console.log('═══ BoxesScreen.tsx ═══');

if (!fs.existsSync('BoxesScreen.tsx')) {
  console.log('❌ BoxesScreen.tsx پیدا نشد');
  process.exit(1);
}

let bx = fs.readFileSync('BoxesScreen.tsx', 'utf8');
const bxOrig = bx;
const bxCRLF = bx.includes('\r\n');
if (bxCRLF) bx = bx.replace(/\r\n/g, '\r\n').replace(/\r\n/g, '\n');

// ۲.۱ اضافه filterName به props
// الگو: export default function BoxesScreen({ showToast, buyers }: any) {
const propMatch = bx.match(/export default function BoxesScreen\(\{\s*([^}]+)\s*\}\s*:\s*any\)/);
if (propMatch) {
  const existing = propMatch[1].trim();
  if (!existing.includes('filterName')) {
    bx = bx.replace(propMatch[0], `export default function BoxesScreen({ ${existing}, filterName }: any)`);
    console.log('✅ filterName به props اضافه شد');
  } else {
    console.log('ℹ️ filterName از قبل هست');
  }
} else {
  console.log('⚠️ الگوی props پیدا نشد');
  // تلاش دیگه
  const alt = bx.match(/export default function BoxesScreen\(([^)]+)\)/);
  if (alt) {
    console.log('   الگوی فعلی: ' + alt[0].substring(0, 100));
  }
}

// ۲.۲ اضافه filter state
if (!bx.includes('deepFilter')) {
  // پیدا کردن اولین useState
  const useStateIdx = bx.indexOf('useState');
  if (useStateIdx > 0) {
    const lineStart = bx.lastIndexOf('\n', useStateIdx);
    // اضافه قبل از اولین useState
    bx = bx.substring(0, lineStart + 1) + 
         "  const [deepFilter, setDeepFilter] = React.useState<string>('');\n" +
         bx.substring(lineStart + 1);
    console.log('✅ deepFilter state اضافه شد');
  }
}

// ۲.۳ اضافه useEffect برای sync filterName
if (!bx.includes('setDeepFilter(filterName')) {
  // پیدا کردن اولین useEffect
  const ueIdx = bx.indexOf('useEffect(');
  if (ueIdx > 0) {
    // پیدا کردن انتهای useEffect
    let braceCount = 0;
    let endPos = -1;
    for (let i = ueIdx; i < bx.length; i++) {
      if (bx[i] === '{') braceCount++;
      else if (bx[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          const semi = bx.indexOf(';', i);
          if (semi > 0 && semi < i + 30) {
            endPos = semi + 1;
            break;
          }
        }
      }
    }
    if (endPos > 0) {
      const newEffect = `\n\n  React.useEffect(() => {\n    if (filterName && String(filterName).trim()) {\n      setDeepFilter(String(filterName).trim());\n    }\n  }, [filterName]);`;
      bx = bx.substring(0, endPos) + newEffect + bx.substring(endPos);
      console.log('✅ useEffect برای sync filter اضافه شد');
    }
  } else {
    // اگه useEffect نداریم، مستقیم بعد از import اضافه کن
    console.log('⚠️ useEffect پیدا نشد');
  }
}

// ۲.۴ اضافه import React اگه نیست
if (!bx.includes("import React") && !bx.includes("from 'react'")) {
  console.log('⚠️ React import نیست — با React.useState مشکل داره');
}

if (bxCRLF) bx = bx.replace(/\n/g, '\r\n');
if (bx !== bxOrig) {
  fs.writeFileSync('BoxesScreen.tsx', bx, 'utf8');
  console.log('💾 BoxesScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const finEx = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
console.log('boxDeepSearch در ExchangeScreen: ' + (finEx.includes('boxDeepSearch') ? '✅' : '❌'));
console.log('filterName پاس داده شد: ' + (finEx.includes('filterName={boxDeepSearch}') ? '✅' : '❌'));

const finBx = fs.readFileSync('BoxesScreen.tsx', 'utf8');
console.log('filterName در BoxesScreen: ' + (finBx.includes('filterName') ? '✅' : '❌'));
console.log('deepFilter state: ' + (finBx.includes('deepFilter') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\ExchangeScreen.tsx" ExchangeScreen.tsx');
console.log('   copy /Y "' + bdir + '\\BoxesScreen.tsx" BoxesScreen.tsx');