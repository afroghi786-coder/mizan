#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 ۱. چک  |  ۲. جستجوی ارز معامله  |  ۳. جستجوی ارز صندوق"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_3fix
cp BoxesScreen.tsx BoxesScreen.tsx.backup_3fix
echo "✅ Backup"

# ═══════════════════════════════════════════════
# ۱. اصلاح چک — DateField
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۱. اصلاح DateField چک..."
python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

patterns = [
    '<TextInput style={s.inp} value={ckForm.due_date} onChangeText={v => setCkForm({ ...ckForm, due_date: v })} placeholder="1405/09/15" />',
    '<DateField value={ckForm.due_date} onChange={(v: string) => setCkForm({ ...ckForm, due_date: v })} compact />',
    '<TextInput style={s.inp} value={ckForm.due_date || \'\'} onChangeText={v => setCkForm({ ...ckForm, due_date: v })} placeholder="1405/09/15" />',
]
new_date = '<DateField value={ckForm.due_date || toStorageDateFull(new Date())} onChange={(v: string) => setCkForm({ ...ckForm, due_date: v })} compact defaultToToday />'

done = False
for p in patterns:
    if p in c:
        c = c.replace(p, new_date, 1)
        print(f"  ✅ جایگزین")
        done = True
        break

if not done:
    m = re.search(r'<TextInput[^>]*value=\{ckForm\.due_date[^}]*\}[^>]*/>', c)
    if m:
        c = c[:m.start()] + new_date + c[m.end():]
        print("  ✅ (regex)")
    else:
        print("  ⚠️ الگو نبود")

# اطمینان از پر بودن when opening
c = c.replace(
    "due_date: '', status: 'pending', note: '' }); setCkModal(true);",
    "due_date: toStorageDateFull(new Date()), status: 'pending', note: '' }); setCkModal(true);",
    1)
print("  ✅ due_date پیش‌فرض")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══════════════════════════════════════════════
# ۲. جستجوی ارز در مودال معامله
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۲. جستجوی ارز در مودال معامله..."
python3 << 'PYEOF'
c = open('ExchangeScreen.tsx').read()
orig = c

# ۲.۱ state
if 'curSearch' not in c:
    c = c.replace(
        "const [showFromCur, setShowFromCur] = useState(false);",
        "const [showFromCur, setShowFromCur] = useState(false);\n  const [curSearch, setCurSearch] = useState('');",
        1)
    print("  ✅ state curSearch")

# ۲.۲ اضافه کردن TextInput قبل از ScrollView هر مودال
for modal in ['showFromCur', 'showToCur']:
    start = c.find(f'<Modal visible={{{modal}}}')
    if start < 0:
        print(f"  ⚠️ {modal} نبود")
        continue
    scroll_idx = c.find('<ScrollView', start)
    if scroll_idx < 0:
        print(f"  ⚠️ ScrollView {modal} نبود")
        continue
    # چک اگر از قبل search داره
    between = c[start:scroll_idx]
    if 'curSearch' in between:
        print(f"  ℹ️ {modal} از قبل search دارد")
        continue
    insert = '''<View style={{ padding: 10 }}>
          <TextInput
            style={[s.inp, { textAlign: 'right' }]}
            value={curSearch}
            onChangeText={setCurSearch}
            placeholder="🔍 جستجو: USD یا دالر یا افغانی..."
            placeholderTextColor="#94a3b8"
            autoFocus
          />
        </View>
        '''
    c = c[:scroll_idx] + insert + c[scroll_idx:]
    print(f"  ✅ search در {modal}")

# ۲.۳ فیلتر map ارزها
old_map = "{Object.keys(CUR).map(k => ("
new_map = "{Object.keys(CUR).filter(k => { const q = curSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(curSearch); }).map(k => ("
count = c.count(old_map)
if count > 0:
    c = c.replace(old_map, new_map)
    print(f"  ✅ {count} map فیلتر شد")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══════════════════════════════════════════════
# ۳. جستجوی ارز در صندوق (BoxesScreen)
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۳. انتخاب ارز صندوق با جستجو..."
python3 << 'PYEOF'
import re
c = open('BoxesScreen.tsx').read()
orig = c

# ۳.۱ state
if 'showBoxCur' not in c:
    c = c.replace(
        "const [showOwnerPick, setShowOwnerPick] = useState(false);",
        "const [showOwnerPick, setShowOwnerPick] = useState(false);\n  const [showBoxCur, setShowBoxCur] = useState(false);\n  const [boxCurSearch, setBoxCurSearch] = useState('');",
        1)
    print("  ✅ state showBoxCur + boxCurSearch")

# ۳.۲ جایگزینی chips
old_chips = '''<Text style={s.lbl}>ارز *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
              {Object.keys(CUR).map(c => (
                <TouchableOpacity key={c} onPress={() => setBoxForm((f: any) => ({ ...f, currency: c }))} style={[s.curPick, boxForm.currency === c && s.curPickActive]}>
                  <Text style={[s.curPickTxt, boxForm.currency === c && { color: '#fff' }]}>{CUR[c].flag} {c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>'''

new_chips = '''<Text style={s.lbl}>ارز *</Text>
            <TouchableOpacity
              style={s.inp}
              onPress={() => { setBoxCurSearch(''); setShowBoxCur(true); }}
            >
              <Text style={{ color: boxForm.currency ? '#fff' : '#94a3b8', textAlign: 'right' }}>
                {boxForm.currency ? `${CUR[boxForm.currency]?.flag} ${boxForm.currency} — ${CUR[boxForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>'''

if old_chips in c:
    c = c.replace(old_chips, new_chips, 1)
    print("  ✅ chips → دکمه")
else:
    pat = r'<Text style=\{s\.lbl\}>ارز \*</Text>\s*<ScrollView horizontal[\s\S]*?</ScrollView>'
    m = re.search(pat, c)
    if m:
        c = c[:m.start()] + new_chips + c[m.end():]
        print("  ✅ (regex)")
    else:
        print("  ❌ الگوی chips نبود")

# ۳.۳ مودال جستجوی ارز
if 'showBoxCur' in c and 'BOX_CUR_MODAL' not in c:
    modal = '''
      {/* BOX_CUR_MODAL */}
      <Modal visible={showBoxCur} transparent animationType="fade" onRequestClose={() => setShowBoxCur(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}>
            <Text style={s.mTitle}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
            <TouchableOpacity onPress={() => setShowBoxCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 10 }}>
            <TextInput
              style={[s.inp, { textAlign: 'right' }]}
              value={boxCurSearch}
              onChangeText={setBoxCurSearch}
              placeholder="🔍 جستجو: USD یا دالر یا افغانی..."
              placeholderTextColor="#94a3b8"
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 400, padding: 10 }}>
            {Object.keys(CUR)
              .filter(k => {
                const q = boxCurSearch.toLowerCase().trim();
                if (!q) return true;
                return k.toLowerCase().includes(q) || CUR[k].name.includes(boxCurSearch);
              })
              .map(k => (
                <TouchableOpacity key={k} style={s.pickRow} onPress={() => { setBoxForm((f: any) => ({ ...f, currency: k })); setShowBoxCur(false); }}>
                  <Text style={s.pickName}>{CUR[k].flag} {CUR[k].name} ({k})</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View></View>
      </Modal>
'''
    marker = "      {/* Modal صندوق جدید/ویرایش */}"
    if marker in c:
        c = c.replace(marker, modal + "\n" + marker, 1)
        print("  ✅ Modal اضافه شد")
    else:
        m2 = "    </View>\n  );\n}"
        if m2 in c:
            c = c.replace(m2, modal + "\n" + m2, 1)
            print("  ✅ Modal در آخر")

open('BoxesScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

echo ""
echo "▶ بیلد..."
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
git commit -m "3fix: check date + currency search (trade+box)" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
