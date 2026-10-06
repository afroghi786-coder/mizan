#!/bin/bash
set +e
cd ~/mizan
cp ExchangeScreen.tsx ExchangeScreen.tsx.bak_now_$(date +%s)
cp BoxesScreen.tsx BoxesScreen.tsx.bak_now_$(date +%s)
echo "✅ Backup"

python3 << 'PYEOF'
# ═══════════════════════════════════════════════════
# ExchangeScreen — حواله و چک
# ═══════════════════════════════════════════════════
c = open('ExchangeScreen.tsx').read()
orig = c

# ─── حواله ───
OLD_HAW = '''<Text style={s.lbl}>💱 ارز</Text>
            <TouchableOpacity style={s.inp} onPress={() => { setHawCurSearch(''); setShowHawCur(true); setHawModal(false); }}>
              <Text style={{ color: hawForm.currency ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {hawForm.currency ? `${CUR[hawForm.currency]?.flag} ${hawForm.currency} — ${CUR[hawForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>'''

NEW_HAW = '''<Text style={s.lbl}>💱 ارز</Text>
            <TextInput style={s.inp} value={hawCurSearch} onChangeText={setHawCurSearch} placeholder="🔍 جستجو: USD، دالر، افغانی..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = hawCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(hawCurSearch); }).map(k => (
                <TouchableOpacity key={k} style={[s.curPick, hawForm.currency === k && { backgroundColor: '#065f46', borderColor: '#065f46' }]} onPress={() => setHawForm({ ...hawForm, currency: k })}>
                  <Text style={[s.curPickTxt, hawForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

if OLD_HAW in c:
    c = c.replace(OLD_HAW, NEW_HAW, 1)
    print("   ✅ حواله جایگزین شد")
else:
    print("   ❌ الگوی حواله نبود")
    # جستجوی دقیق‌تر
    import re
    m = re.search(r'<TouchableOpacity style=\{s\.inp\} onPress=\{\(\) => \{ setHawCurSearch.*?setHawModal\(false\); \}\}>.*?</TouchableOpacity>', c, re.DOTALL)
    if m:
        c = c[:m.start()] + NEW_HAW.replace('<Text style={s.lbl}>💱 ارز</Text>\n            ', '') + c[m.end():]
        print("   ✅ حواله (regex)")

# ─── چک ───
OLD_CK = '''<Text style={s.lbl}>💱 ارز</Text>
            <TouchableOpacity style={s.inp} onPress={() => { setCkCurSearch(''); setShowCkCur(true); setCkModal(false); }}>
              <Text style={{ color: ckForm.currency ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {ckForm.currency ? `${CUR[ckForm.currency]?.flag} ${ckForm.currency} — ${CUR[ckForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>'''

NEW_CK = '''<Text style={s.lbl}>💱 ارز</Text>
            <TextInput style={s.inp} value={ckCurSearch} onChangeText={setCkCurSearch} placeholder="🔍 جستجو: USD، دالر، افغانی..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = ckCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(ckCurSearch); }).map(k => (
                <TouchableOpacity key={k} style={[s.curPick, ckForm.currency === k && { backgroundColor: '#065f46', borderColor: '#065f46' }]} onPress={() => setCkForm({ ...ckForm, currency: k })}>
                  <Text style={[s.curPickTxt, ckForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

if OLD_CK in c:
    c = c.replace(OLD_CK, NEW_CK, 1)
    print("   ✅ چک جایگزین شد")
else:
    print("   ❌ الگوی چک نبود")
    import re
    m = re.search(r'<TouchableOpacity style=\{s\.inp\} onPress=\{\(\) => \{ setCkCurSearch.*?setCkModal\(false\); \}\}>.*?</TouchableOpacity>', c, re.DOTALL)
    if m:
        c = c[:m.start()] + NEW_CK.replace('<Text style={s.lbl}>💱 ارز</Text>\n            ', '') + c[m.end():]
        print("   ✅ چک (regex)")

open('ExchangeScreen.tsx', 'w').write(c)
print(f"ExchangeScreen changed: {c != orig}")

# ═══════════════════════════════════════════════════
# BoxesScreen — صندوق
# ═══════════════════════════════════════════════════
c2 = open('BoxesScreen.tsx').read()
orig2 = c2

# پیدا کردن chips صندوق (الگوی قدیمی)
import re
# الگوی احتمالی ۱: chips با MAIN_CURS یا Object.keys(CUR)
patterns = [
    r'<Text style=\{s\.lbl\}>ارز \*</Text>\s*<ScrollView horizontal[^>]*>\s*\{[^}]*\.map\(c => \([\s\S]*?</ScrollView>',
    r'<Text style=\{s\.lbl\}>ارز \*</Text>[\s\S]{0,1500}?</ScrollView>',
]

NEW_BOX = '''<Text style={s.lbl}>ارز *</Text>
            <TextInput style={s.inp} value={boxCurSearch} onChangeText={setBoxCurSearch} placeholder="🔍 جستجو: USD، دالر..." placeholderTextColor="#94a3b8" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).filter(k => { const q = boxCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(boxCurSearch); }).map(k => (
                <TouchableOpacity key={k} onPress={() => setBoxForm((f: any) => ({ ...f, currency: k }))} style={[s.curPick, boxForm.currency === k && s.curPickActive]}>
                  <Text style={[s.curPickTxt, boxForm.currency === k && { color: '#fff' }]}>{CUR[k].flag} {k}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

done = False
for pat in patterns:
    m = re.search(pat, c2, re.DOTALL)
    if m:
        c2 = c2[:m.start()] + NEW_BOX + c2[m.end():]
        print("   ✅ صندوق جایگزین شد")
        done = True
        break

if not done:
    print("   ⚠️ chips صندوق نبود — شاید از MAIN_CURS با k استفاده می‌کنه")
    m = re.search(r'<Text style=\{s\.lbl\}>ارز \*</Text>[\s\S]{0,800}?boxForm\.currency[^>]*>[\s\S]{0,200}?</ScrollView>', c2, re.DOTALL)
    if m:
        c2 = c2[:m.start()] + NEW_BOX + c2[m.end():]
        print("   ✅ صندوق (regex ۲)")
        done = True

open('BoxesScreen.tsx', 'w').write(c2)
print(f"BoxesScreen changed: {c2 != orig2}")
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
git commit -m "inline currency search: hawala + check + box" 2>&1 | tail -2
git push -f 2>&1 | tail -3
echo "═══════════════════════════════════"
echo "  ✅ تمام"
echo "═══════════════════════════════════"
