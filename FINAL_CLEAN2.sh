#!/bin/bash
set +e
cd ~/mizan

cp ExchangeScreen.tsx ExchangeScreen.tsx.bak_final2_$(date +%s)
cp BoxesScreen.tsx BoxesScreen.tsx.bak_final2_$(date +%s)
echo "✅ Backup"

python3 << 'PYEOF'
import re

c = open('ExchangeScreen.tsx').read()
orig = c

# ═══ ۱. حذف مودال‌های قبلی که خراب بودن ═══
for marker in ['CK_CUR_MODAL', 'HAW_CUR_MODAL']:
    while True:
        idx = c.find(f'{{/* {marker} */}}')
        if idx < 0: break
        start = c.find('<Modal', idx)
        if start < 0: break
        # پیدا کردن بسته شدن
        depth = 0
        i = start
        while i < len(c):
            if c[i:i+6] == '<Modal': depth += 1
            elif c[i:i+8] == '</Modal>':
                depth -= 1
                if depth == 0:
                    i += 8
                    break
            i += 1
        c = c[:idx] + c[i:]
        print(f"   ✅ حذف {marker}")

# ═══ ۲. حذف state های قبلی ═══
for name in ['showHawCur', 'showCkCur', 'hawCurSearch', 'ckCurSearch',
             'showHawformCur', 'showCkformCur', 'hawformCurSearch', 'ckformCurSearch']:
    pattern = rf"^\s*const \[{name}[^\n]*\n"
    m = re.search(pattern, c, re.MULTILINE)
    if m:
        c = c[:m.start()] + c[m.end():]
        print(f"   ✅ حذف state {name}")

# ═══ ۳. تصحیح MAIN_CURS ═══
c = re.sub(r'const MAIN_CURS = \[[^\]]*\]', 'const MAIN_CURS = Object.keys(CUR)', c)
print("   ✅ MAIN_CURS")

# ═══ ۴. جایگزینی chips حواله ═══
HAW_BLOCK = '''<TextInput style={s.inp} value={hawCurSearch} onChangeText={setHawCurSearch} placeholder="🔍 جستجو: USD، دالر، افغانی..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = hawCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(hawCurSearch); }).map(k => (
                <TouchableOpacity key={k} style={[s.curPick, hawForm.currency === k && { backgroundColor: '#065f46', borderColor: '#065f46' }]} onPress={() => setHawForm({ ...hawForm, currency: k })}>
                  <Text style={[s.curPickTxt, hawForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

idx = c.find('hawForm.currency === c')
if idx > 0:
    scroll_idx = c.rfind('<ScrollView horizontal', 0, idx)
    close_idx = c.find('</ScrollView>', idx) + len('</ScrollView>')
    if scroll_idx > 0 and close_idx > scroll_idx:
        c = c[:scroll_idx] + HAW_BLOCK + c[close_idx:]
        print("   ✅ حواله جایگزین شد")
else:
    idx = c.find('hawForm.currency === k')
    if idx > 0:
        scroll_idx = c.rfind('<ScrollView horizontal', 0, idx)
        close_idx = c.find('</ScrollView>', idx) + len('</ScrollView>')
        if scroll_idx > 0 and close_idx > scroll_idx:
            c = c[:scroll_idx] + HAW_BLOCK + c[close_idx:]
            print("   ✅ حواله (k)")

# ═══ ۵. جایگزینی chips چک ═══
CK_BLOCK = '''<TextInput style={s.inp} value={ckCurSearch} onChangeText={setCkCurSearch} placeholder="🔍 جستجو: USD، دالر، افغانی..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = ckCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(ckCurSearch); }).map(k => (
                <TouchableOpacity key={k} style={[s.curPick, ckForm.currency === k && { backgroundColor: '#065f46', borderColor: '#065f46' }]} onPress={() => setCkForm({ ...ckForm, currency: k })}>
                  <Text style={[s.curPickTxt, ckForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

idx = c.find('ckForm.currency === c')
if idx > 0:
    scroll_idx = c.rfind('<ScrollView horizontal', 0, idx)
    close_idx = c.find('</ScrollView>', idx) + len('</ScrollView>')
    if scroll_idx > 0 and close_idx > scroll_idx:
        c = c[:scroll_idx] + CK_BLOCK + c[close_idx:]
        print("   ✅ چک جایگزین شد")

# ═══ ۶. اضافه کردن state های جدید ═══
if 'hawCurSearch' not in c:
    c = c.replace(
        "const [hawModal, setHawModal] = useState(false);",
        "const [hawModal, setHawModal] = useState(false);\n  const [hawCurSearch, setHawCurSearch] = useState('');",
        1)
    print("   ✅ hawCurSearch state")

if 'ckCurSearch' not in c:
    c = c.replace(
        "const [ckModal, setCkModal] = useState(false);",
        "const [ckModal, setCkModal] = useState(false);\n  const [ckCurSearch, setCkCurSearch] = useState('');",
        1)
    print("   ✅ ckCurSearch state")

# ═══ ۷. اطمینان از نیست ═══
if 'hawCurSearch' not in c:
    c = c.replace(
        "const [showFromCur, setShowFromCur] = useState(false);",
        "const [showFromCur, setShowFromCur] = useState(false);\n  const [hawCurSearch, setHawCurSearch] = useState('');\n  const [ckCurSearch, setCkCurSearch] = useState('');",
        1)
    print("   ✅ states (روش ۲)")

if c != orig:
    open('ExchangeScreen.tsx', 'w').write(c)
    print("✅ ExchangeScreen ذخیره")
else:
    print("⚠️ هیچ تغییری")

# ═══════════════════════════════════════════════
# BoxesScreen
# ═══════════════════════════════════════════════
c2 = open('BoxesScreen.tsx').read()
orig2 = c2

BOX_BLOCK = '''<TextInput style={s.inp} value={boxCurSearch} onChangeText={setBoxCurSearch} placeholder="🔍 جستجو: USD، دالر..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = boxCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(boxCurSearch); }).map(k => (
                <TouchableOpacity key={k} onPress={() => setBoxForm((f: any) => ({ ...f, currency: k }))} style={[s.curPick, boxForm.currency === k && s.curPickActive]}>
                  <Text style={[s.curPickTxt, boxForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

idx2 = c2.find('boxForm.currency === c')
if idx2 > 0:
    scroll_idx = c2.rfind('<ScrollView horizontal', 0, idx2)
    close_idx = c2.find('</ScrollView>', idx2) + len('</ScrollView>')
    if scroll_idx > 0 and close_idx > scroll_idx:
        c2 = c2[:scroll_idx] + BOX_BLOCK + c2[close_idx:]
        print("   ✅ صندوق جایگزین شد")

if 'boxCurSearch' not in c2:
    c2 = c2.replace(
        "const [boxForm, setBoxForm] = useState<any>({});",
        "const [boxForm, setBoxForm] = useState<any>({});\n  const [boxCurSearch, setBoxCurSearch] = useState('');",
        1)
    print("   ✅ boxCurSearch state")

if c2 != orig2:
    open('BoxesScreen.tsx', 'w').write(c2)
    print("✅ BoxesScreen ذخیره")

PYEOF

echo ""
echo "▶ بیلد..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -6

if [ ! -f "docs/index.html" ]; then
  echo "❌ بیلد نشد"
  exit 1
fi
echo "✅ بیلد موفق"

sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
git add -A
git add -f docs/
git commit -m "currency search: hawala + check + box" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ تمام"
echo "═══════════════════════════════════════════"
