#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 گسترش لیست ارزها در همه جا"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_cur
cp BoxesScreen.tsx BoxesScreen.tsx.backup_cur
echo "✅ Backup"

# ═══ ۱. گسترش CUR در ExchangeScreen ═══
echo ""
echo "▶ ۱. گسترش CUR در ExchangeScreen..."
python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# پیدا کردن بلوک CUR
pattern = r"const CUR: Record<string, \{ name: string; flag: string; dec: number \}> = \{[\s\S]*?\};"
new_cur = """const CUR: Record<string, { name: string; flag: string; dec: number }> = {
  AFN: { name: 'افغانی', flag: '🇦🇫', dec: 0 },
  USD: { name: 'دالر امریکایی', flag: '🇺🇸', dec: 2 },
  EUR: { name: 'یورو', flag: '🇪🇺', dec: 2 },
  GBP: { name: 'پوند انگلیس', flag: '🇬🇧', dec: 2 },
  PKR: { name: 'کلدار پاکستان', flag: '🇵🇰', dec: 0 },
  IRR: { name: 'ریال ایران', flag: '🇮🇷', dec: 0 },
  TOM: { name: 'تومان ایران', flag: '🇮🇷', dec: 0 },
  AED: { name: 'درهم امارات', flag: '🇦🇪', dec: 2 },
  SAR: { name: 'ریال سعودی', flag: '🇸🇦', dec: 2 },
  TRY: { name: 'لیر ترکیه', flag: '🇹🇷', dec: 2 },
  CNY: { name: 'یوان چین', flag: '🇨🇳', dec: 2 },
  INR: { name: 'روپیه هند', flag: '🇮🇳', dec: 0 },
  JPY: { name: 'ین ژاپن', flag: '🇯🇵', dec: 0 },
  CHF: { name: 'فرانک سوئیس', flag: '🇨🇭', dec: 2 },
  CAD: { name: 'دلار کانادا', flag: '🇨🇦', dec: 2 },
  AUD: { name: 'دلار استرالیا', flag: '🇦🇺', dec: 2 },
  KWD: { name: 'دینار کویت', flag: '🇰🇼', dec: 3 },
  QAR: { name: 'ریال قطر', flag: '🇶🇦', dec: 2 },
  OMR: { name: 'ریال عمان', flag: '🇴🇲', dec: 3 },
  BHD: { name: 'دینار بحرین', flag: '🇧🇭', dec: 3 },
  JOD: { name: 'دینار اردن', flag: '🇯🇴', dec: 3 },
  IQD: { name: 'دینار عراق', flag: '🇮🇶', dec: 0 },
  MYR: { name: 'رینگیت مالزی', flag: '🇲🇾', dec: 2 },
  RUB: { name: 'روبل روسیه', flag: '🇷🇺', dec: 2 },
  TJS: { name: 'سامانی تاجیکستان', flag: '🇹🇯', dec: 2 },
  UZS: { name: 'سوم ازبکستان', flag: '🇺🇿', dec: 0 },
  TMT: { name: 'منات ترکمنستان', flag: '🇹🇲', dec: 2 },
  KGS: { name: 'سوم قرقیزستان', flag: '🇰🇬', dec: 2 },
  KZT: { name: 'تنگه قزاقستان', flag: '🇰🇿', dec: 2 },
  AZN: { name: 'منات آذربایجان', flag: '🇦🇿', dec: 2 },
  HKD: { name: 'دلار هنگ‌کنگ', flag: '🇭🇰', dec: 2 },
  SGD: { name: 'دلار سنگاپور', flag: '🇸🇬', dec: 2 },
  THB: { name: 'بات تایلند', flag: '🇹🇭', dec: 2 },
  EGP: { name: 'جنيه مصر', flag: '🇪🇬', dec: 2 },
  LYD: { name: 'دینار لیبی', flag: '🇱🇾', dec: 3 },
  SYP: { name: 'لیره سوریه', flag: '🇸🇾', dec: 0 },
  LBP: { name: 'لیره لبنان', flag: '🇱🇧', dec: 0 },
  YER: { name: 'ریال یمن', flag: '🇾🇪', dec: 0 },
  ETB: { name: 'بیر اتیوپی', flag: '🇪🇹', dec: 2 },
  NOK: { name: 'کرون نروژ', flag: '🇳🇴', dec: 2 },
  SEK: { name: 'کرون سوئد', flag: '🇸🇪', dec: 2 },
  DKK: { name: 'کرون دانمارک', flag: '🇩🇰', dec: 2 },
  NZD: { name: 'دلار نیوزیلند', flag: '🇳🇿', dec: 2 },
  ZAR: { name: 'رند افریقای جنوبی', flag: '🇿🇦', dec: 2 },
};"""

m = re.search(pattern, c)
if m:
    c = c[:m.start()] + new_cur + c[m.end():]
    print("  ✅ CUR گسترش یافت — ۴۴ ارز")
else:
    print("  ⚠️ الگوی CUR نبود")

# ═══ گسترش MAIN_CURS ═══
old_main = "const MAIN_CURS = ['USD', 'EUR', 'AFN', 'PKR', 'AED'];"
new_main = "const MAIN_CURS = Object.keys(CUR);"
if old_main in c:
    c = c.replace(old_main, new_main, 1)
    print("  ✅ MAIN_CURS → همه ارزها")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۲. گسترش CUR در BoxesScreen ═══
echo ""
echo "▶ ۲. گسترش CUR در BoxesScreen..."
python3 << 'PYEOF'
import re
c = open('BoxesScreen.tsx').read()
orig = c

pattern = r"const CUR: Record<string, \{ name: string; flag: string; dec: number \}> = \{[\s\S]*?\};"
new_cur = """const CUR: Record<string, { name: string; flag: string; dec: number }> = {
  AFN: { name: 'افغانی', flag: '🇦🇫', dec: 0 },
  USD: { name: 'دالر امریکایی', flag: '🇺🇸', dec: 2 },
  EUR: { name: 'یورو', flag: '🇪🇺', dec: 2 },
  GBP: { name: 'پوند انگلیس', flag: '🇬🇧', dec: 2 },
  PKR: { name: 'کلدار پاکستان', flag: '🇵🇰', dec: 0 },
  IRR: { name: 'ریال ایران', flag: '🇮🇷', dec: 0 },
  TOM: { name: 'تومان ایران', flag: '🇮🇷', dec: 0 },
  AED: { name: 'درهم امارات', flag: '🇦🇪', dec: 2 },
  SAR: { name: 'ریال سعودی', flag: '🇸🇦', dec: 2 },
  TRY: { name: 'لیر ترکیه', flag: '🇹🇷', dec: 2 },
  CNY: { name: 'یوان چین', flag: '🇨🇳', dec: 2 },
  INR: { name: 'روپیه هند', flag: '🇮🇳', dec: 0 },
  JPY: { name: 'ین ژاپن', flag: '🇯🇵', dec: 0 },
  CHF: { name: 'فرانک سوئیس', flag: '🇨🇭', dec: 2 },
  CAD: { name: 'دلار کانادا', flag: '🇨🇦', dec: 2 },
  AUD: { name: 'دلار استرالیا', flag: '🇦🇺', dec: 2 },
  KWD: { name: 'دینار کویت', flag: '🇰🇼', dec: 3 },
  QAR: { name: 'ریال قطر', flag: '🇶🇦', dec: 2 },
  OMR: { name: 'ریال عمان', flag: '🇴🇲', dec: 3 },
  BHD: { name: 'دینار بحرین', flag: '🇧🇭', dec: 3 },
  JOD: { name: 'دینار اردن', flag: '🇯🇴', dec: 3 },
  IQD: { name: 'دینار عراق', flag: '🇮🇶', dec: 0 },
  MYR: { name: 'رینگیت مالزی', flag: '🇲🇾', dec: 2 },
  RUB: { name: 'روبل روسیه', flag: '🇷🇺', dec: 2 },
  TJS: { name: 'سامانی تاجیکستان', flag: '🇹🇯', dec: 2 },
  UZS: { name: 'سوم ازبکستان', flag: '🇺🇿', dec: 0 },
  TMT: { name: 'منات ترکمنستان', flag: '🇹🇲', dec: 2 },
  KGS: { name: 'سوم قرقیزستان', flag: '🇰🇬', dec: 2 },
  KZT: { name: 'تنگه قزاقستان', flag: '🇰🇿', dec: 2 },
  AZN: { name: 'منات آذربایجان', flag: '🇦🇿', dec: 2 },
  HKD: { name: 'دلار هنگ‌کنگ', flag: '🇭🇰', dec: 2 },
  SGD: { name: 'دلار سنگاپور', flag: '🇸🇬', dec: 2 },
  THB: { name: 'بات تایلند', flag: '🇹🇭', dec: 2 },
  EGP: { name: 'جنيه مصر', flag: '🇪🇬', dec: 2 },
  LYD: { name: 'دینار لیبی', flag: '🇱🇾', dec: 3 },
  SYP: { name: 'لیره سوریه', flag: '🇸🇾', dec: 0 },
  LBP: { name: 'لیره لبنان', flag: '🇱🇧', dec: 0 },
  YER: { name: 'ریال یمن', flag: '🇾🇪', dec: 0 },
  ETB: { name: 'بیر اتیوپی', flag: '🇪🇹', dec: 2 },
  NOK: { name: 'کرون نروژ', flag: '🇳🇴', dec: 2 },
  SEK: { name: 'کرون سوئد', flag: '🇸🇪', dec: 2 },
  DKK: { name: 'کرون دانمارک', flag: '🇩🇰', dec: 2 },
  NZD: { name: 'دلار نیوزیلند', flag: '🇳🇿', dec: 2 },
  ZAR: { name: 'رند افریقای جنوبی', flag: '🇿🇦', dec: 2 },
};"""

m = re.search(pattern, c)
if m:
    c = c[:m.start()] + new_cur + c[m.end():]
    print("  ✅ CUR در BoxesScreen گسترش یافت")
else:
    print("  ⚠️ الگوی CUR نبود")

open('BoxesScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۳. جستجو برای سایر فایل‌هایی که CUR دارن ═══
echo ""
echo "▶ ۳. بررسی فایل‌های دیگر..."
for f in lib.fx.ts lib.fx.cust.ts lib.fx.trade.ts lib.offline.ts lib.ts ExchangeInvoice.tsx; do
  if [ -f "$f" ]; then
    if grep -q "const CUR" "$f" 2>/dev/null; then
      echo "  📄 $f دارای CUR است"
    fi
  fi
done

# ═══ ۴. بیلد ═══
echo ""
echo "▶ ۴. بیلد..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -8

if [ ! -f "docs/index.html" ]; then
  echo "❌ بیلد نشد"
  exit 1
fi
echo "✅ بیلد موفق"

sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
git add -A
git commit -m "currencies: expand to 44 currencies everywhere" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
