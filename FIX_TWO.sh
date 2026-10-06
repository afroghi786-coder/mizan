#!/bin/bash
set +e
cd ~/mizan
cp ExchangeScreen.tsx ExchangeScreen.tsx.bak_two_$(date +%s)
cp BoxesScreen.tsx BoxesScreen.tsx.bak_two_$(date +%s)
echo "✅ Backup"

python3 << 'PYEOF'
import re

# ═══════════════════════════════════════════════════
# ۱. ExchangeScreen — حواله و چک: flag + name + code
# ═══════════════════════════════════════════════════
c = open('ExchangeScreen.tsx').read()
orig = c

# الگوی جدید: {flag} {name} ({code})
# پیدا کردن هر two جایگزین قبلی که فقط {CUR[k].flag} {k} داشت

# حواله — داخل بلوک حواله
haw_idx = c.find('setHawForm({ ...hawForm, currency: k })')
if haw_idx > 0:
    # پیدا کردن <Text> داخلش
    text_start = c.find('<Text', haw_idx)
    text_end = c.find('</Text>', text_start) + len('</Text>')
    old_text = c[text_start:text_end]
    new_text = '<Text style={[s.curPickTxt, hawForm.currency === k && { color: \'#fff\' }]}>{CUR[k].flag} {CUR[k].name} ({k})</Text>'
    if '{CUR[k].name}' not in old_text:
        c = c[:text_start] + new_text + c[text_end:]
        print("   ✅ حواله: flag + name + code")

# چک
ck_idx = c.find('setCkForm({ ...ckForm, currency: k })')
if ck_idx > 0:
    text_start = c.find('<Text', ck_idx)
    text_end = c.find('</Text>', text_start) + len('</Text>')
    old_text = c[text_start:text_end]
    new_text = '<Text style={[s.curPickTxt, ckForm.currency === k && { color: \'#fff\' }]}>{CUR[k].flag} {CUR[k].name} ({k})</Text>'
    if '{CUR[k].name}' not in old_text:
        c = c[:text_start] + new_text + c[text_end:]
        print("   ✅ چک: flag + name + code")

if c != orig:
    open('ExchangeScreen.tsx', 'w').write(c)
    print(f"ExchangeScreen changed: True")
else:
    print(f"ExchangeScreen: بدون تغییر")

# ═══════════════════════════════════════════════════
# ۲. BoxesScreen — z-index مودال
# ═══════════════════════════════════════════════════
c2 = open('BoxesScreen.tsx').read()
orig2 = c2

# حذف position:absolute از mBg و استفاده از zIndex صحیح
c2 = re.sub(
    r'mBg:\s*\{[^}]*\}',
    "mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14, zIndex: 99999 }",
    c2)

c2 = re.sub(
    r'mBox:\s*\{[^}]*\}',
    "mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '92%', overflow: 'hidden', zIndex: 100000 }",
    c2)

print("   ✅ BoxesScreen z-index")

if c2 != orig2:
    open('BoxesScreen.tsx', 'w').write(c2)
    print(f"BoxesScreen changed: True")
PYEOF

echo ""
echo "▶ بیلد..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -5

if [ ! -f "docs/index.html" ]; then
  echo "❌ بیلد نشد"
  exit 1
fi
echo "✅ بیلد موفق"

sed -i 's|"/_expo|"/mizan/_expo|g' docs/index.html
touch docs/.nojekyll
git add -A
git add -f docs/
git commit -m "hawala+check: flag+name+code, boxes: modal z-index" 2>&1 | tail -2
git push -f 2>&1 | tail -3
echo "═══════════════════════════════════"
echo "  ✅ تمام"
echo "═══════════════════════════════════"
