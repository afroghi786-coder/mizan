#!/bin/bash
set +e
cd ~/mizan
cp BoxesScreen.tsx BoxesScreen.tsx.bak_box_$(date +%s)
echo "✅ Backup"

python3 << 'PYEOF'
import re
c = open('BoxesScreen.tsx').read()
orig = c

# چاپ محدوده‌ی chips برای دیباگ
matches = list(re.finditer(r'boxForm\.currency\s*===', c))
print(f"📊 پیدا شد {len(matches)} ارجاع به boxForm.currency")
for m in matches[:3]:
    line = c[:m.start()].count('\n') + 1
    print(f"   خط {line}")

# الگوی ۱: chips با c
NEW_BOX = '''<Text style={s.lbl}>ارز *</Text>
            <TextInput style={s.inp} value={boxCurSearch} onChangeText={setBoxCurSearch} placeholder="🔍 جستجو: USD، دالر..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = boxCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(boxCurSearch); }).map(k => (
                <TouchableOpacity key={k} onPress={() => setBoxForm((f: any) => ({ ...f, currency: k }))} style={[s.curPick, boxForm.currency === k && s.curPickActive]}>
                  <Text style={[s.curPickTxt, boxForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

# پیدا کردن با براکت شمارش
def find_block(text, anchor_pat):
    """از anchor تا </ScrollView> رو برمی‌گردونه"""
    m = re.search(anchor_pat, text)
    if not m: return None
    start = m.start()
    end_idx = text.find('</ScrollView>', m.end())
    if end_idx < 0: return None
    return (start, end_idx + len('</ScrollView>'))

# الگوها به ترتیب
patterns = [
    r'<Text style=\{s\.lbl\}>ارز\s*\*?</Text>',
    r'<Text style=\{s\.lbl\}>💱 ارز</Text>',
]

done = False
for pat in patterns:
    result = find_block(c, pat)
    if result:
        c = c[:result[0]] + NEW_BOX + c[result[1]:]
        print(f"   ✅ صندوق جایگزین شد با الگو: {pat[:40]}")
        done = True
        break

if not done:
    print("   ❌ هیچ الگویی پیدا نشد")
    # چاپ ۲۰ خط اطراف اولین boxForm.currency
    if matches:
        pos = matches[0].start()
        start = c.rfind('<Text', 0, pos - 200) if pos > 200 else 0
        end = c.find('</ScrollView>', pos)
        if end < 0: end = pos + 500
        print("\n=== محدوده فعلی ===")
        print(c[start:end + 15])
else:
    # state اضافه کن
    if 'boxCurSearch' not in c:
        c = c.replace(
            "const [boxForm, setBoxForm] = useState<any>({});",
            "const [boxForm, setBoxForm] = useState<any>({});\n  const [boxCurSearch, setBoxCurSearch] = useState('');",
            1)
        print("   ✅ boxCurSearch state")

open('BoxesScreen.tsx', 'w').write(c)
print(f"BoxesScreen changed: {c != orig}")
PYEOF

echo ""
echo "▶ بیلد..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -5

if [ ! -f "docs/index.html" ]; then echo "❌ بیلد نشد"; exit 1; fi
echo "✅ بیلد موفق"

sed -i 's|"/_expo|"/mizan/_expo|g' docs/index.html
touch docs/.nojekyll
git add -A
git add -f docs/
git commit -m "box: currency search" 2>&1 | tail -2
git push -f 2>&1 | tail -3
echo "═══════════════════════════════════"
echo "  ✅ تمام"
echo "═══════════════════════════════════"
