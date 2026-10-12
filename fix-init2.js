const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;

// الگوی دقیق load — با هر فاصله‌ای
const re = /(const load = useCallback\(async \(\) => \{\s*\n\s*setLoading\(true\);\s*\n\s*try \{\s*\n\s*const m = await import\('\.\/lib\.network'\);\s*\n)(\s*const fn = \(m as any\)\.fetchPublicAds;)/;

if (re.test(s)) {
  s = s.replace(re, `$1      // ⚡ initNetwork
      await (m as any).loadNetSettings?.();
      await (m as any).initNetwork?.();
$2`);
  console.log('✅ initNetwork اضافه شد به load');
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ regex پیدا نشد — روش مستقیم:');

  // روش مستقیم — فقط اضافه کن قبل از const fn
  const target = "const fn = (m as any).fetchPublicAds;";
  if (s.includes(target)) {
    s = s.replace(target, `await (m as any).loadNetSettings?.();
      await (m as any).initNetwork?.();
      ${target}`);
    fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
    console.log('✅ initNetwork اضافه شد (روش مستقیم)');
    console.log('💾 ذخیره شد');
  } else {
    console.log('❌ target پیدا نشد');
  }
}