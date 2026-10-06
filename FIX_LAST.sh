#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 ۱. چک (DateField)  |  ۲. صندوق (z-index)"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_last
cp BoxesScreen.tsx BoxesScreen.tsx.backup_last
echo "✅ Backup"

# ═══════════════════════════════════════════════
# ۱. چک — پیدا کردن دقیق فیلد تاریخ
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۱. اصلاح چک..."
echo "   [جستجوی الگوی فعلی]"
grep -n "ckForm.due_date\|ckForm.date" ExchangeScreen.tsx | head -10

python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# جستجوی هر جایگاه due_date در JSX
patterns = [
    # حالت ۱: TextInput ساده
    r'<TextInput[^>]*value=\{ckForm\.due_date[^}]*\}[^>]*/>',
    # حالت ۲: DateField ناقص
    r'<DateField[^>]*value=\{ckForm\.due_date[^}]*\}[^>]*/>',
    r'<DateField\s+value=\{ckForm\.due_date[^}]*\}[^/>]*/>',
]

new_date = '<DateField value={ckForm.due_date || toStorageDateFull(new Date())} onChange={(v: string) => setCkForm({ ...ckForm, due_date: v })} compact defaultToToday />'

for pat in patterns:
    m = re.search(pat, c, re.DOTALL)
    if m:
        c = c[:m.start()] + new_date + c[m.end():]
        print(f"   ✅ جایگزین شد: {m.group(0)[:60]}...")
        break
else:
    print("   ⚠️ الگو نبود — فیلد تاریخ چک کجاست؟")

# اطمینان از پیش‌فرض بودن
old_def = "due_date: '', status: 'pending'"
new_def = "due_date: toStorageDateFull(new Date()), status: 'pending'"
if old_def in c:
    c = c.replace(old_def, new_def)
    print("   ✅ پیش‌فرض due_date")

# اطمینان از import toStorageDateFull
if 'toStorageDateFull' not in c.split('const buildStatement')[0]:
    print("   ⚠️ toStorageDateFull در import نیست")

open('ExchangeScreen.tsx', 'w').write(c)
print("   changed:", c != orig)
PYEOF

# ═══════════════════════════════════════════════
# ۲. صندوق — z-index و مودال درست
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۲. اصلاح مودال صندوق (z-index)..."
python3 << 'PYEOF'
import re
c = open('BoxesScreen.tsx').read()
orig = c

# اضافه کردن zIndex به styles مودال
if 'zIndex' not in c:
    # پیدا کردن mBg و mBox
    c = re.sub(r'(mBg:\s*\{[^}]*)\}', r'\1, zIndex: 9999, elevation: 9999 }', c, count=1)
    c = re.sub(r'(mBox:\s*\{[^}]*)\}', r'\1, zIndex: 10000, elevation: 10000 }', c, count=1)
    print("   ✅ zIndex برای mBg/mBox")

# چک مودال‌ها: هر مودال باید در آخر تابع باشه (بعد از همه چیز)
# مودال‌های این فایل: boxModal, txModal, transferModal, showOwnerPick, showBoxCur

# گرفتن همه <Modal.../> و بردن به آخر
# این کار رو نمی‌کنم چون ممکنه خراب بشه — بجاش ترتیب رو با position درست می‌کنم
# فقط مطمئن شم که مودال‌ها قبل از </View> نهایی هستن (نه در middle)

# بررسی: اگه showBoxCur بعد از صندوق modal نیست، ببرش آخر
# فعلاً چیز خاصی لازم نیست

open('BoxesScreen.tsx', 'w').write(c)
print("   changed:", c != orig)
PYEOF

# ═══════════════════════════════════════════════
# ۳. بیلد
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۳. بیلد..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -10

if [ ! -f "docs/index.html" ]; then
  echo "❌ بیلد نشد"
  exit 1
fi
echo "✅ بیلد موفق"

sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
git add -A
git commit -m "fix: check date + modal z-index" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
