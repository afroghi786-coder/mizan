#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 ۱. ارزهای چک  |  ۲. z-index صندوق"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_2fix
cp BoxesScreen.tsx BoxesScreen.tsx.backup_2fix
echo "✅ Backup"

# ═══════════════════════════════════════════════
# ۱. چک — ارز با جستجو
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۱. ارز چک با جستجو..."
python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# state جدید
if 'showCkCur' not in c:
    c = c.replace(
        "const [showFromCur, setShowFromCur] = useState(false);",
        "const [showFromCur, setShowFromCur] = useState(false);\n  const [showCkCur, setShowCkCur] = useState(false);\n  const [ckCurSearch, setCkCurSearch] = useState('');",
        1)
    print("   ✅ state showCkCur")

# پیدا کردن chips ارز چک — الگوهای احتمالی
# در چک معمولاً این‌طوره:
# <Text style={s.lbl}>ارز</Text>
# <ScrollView horizontal>...{Object.keys(CUR).map...}</ScrollView>
# یا <TextInput value={ckForm.currency}>

patterns = [
    # الگوی chips
    r'<Text style=\{s\.lbl\}>ارز</Text>\s*<ScrollView horizontal[\s\S]*?</ScrollView>',
    r'<Text style=\{s\.lbl\}>💱 ارز</Text>\s*<ScrollView horizontal[\s\S]*?</ScrollView>',
]

new_btn = '''<Text style={s.lbl}>💱 ارز</Text>
            <TouchableOpacity style={s.inp} onPress={() => { setCkCurSearch(''); setShowCkCur(true); }}>
              <Text style={{ color: ckForm.currency ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {ckForm.currency ? `${CUR[ckForm.currency]?.flag} ${ckForm.currency} — ${CUR[ckForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>'''

done = False
for pat in patterns:
    m = re.search(pat, c)
    if m:
        c = c[:m.start()] + new_btn + c[m.end():]
        print("   ✅ chips → دکمه")
        done = True
        break

if not done:
    # جایگزینی مستقیم TextInput ارز چک
    old_inp = '<TextInput style={s.inp} value={ckForm.currency} onChangeText={v => setCkForm({ ...ckForm, currency: v })} />'
    if old_inp in c:
        c = c.replace(old_inp, new_btn, 1)
        print("   ✅ TextInput → دکمه")
        done = True
    else:
        print("   ⚠️ الگوی ارز چک نبود — چک دستی لازمه")

# مودال انتخاب ارز چک
if 'showCkCur' in c and 'CK_CUR_MODAL' not in c:
    modal = '''
      {/* CK_CUR_MODAL */}
      <Modal visible={showCkCur} transparent animationType="fade" onRequestClose={() => setShowCkCur(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,36,56,0.9)', justifyContent: 'center', padding: 14, zIndex: 99999, elevation: 99999 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
              <TouchableOpacity onPress={() => setShowCkCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <TextInput
                style={[s.inp, { textAlign: 'right', backgroundColor: '#1a2332', color: '#fff', borderColor: '#334155', borderWidth: 1, borderRadius: 8, padding: 10 }]}
                value={ckCurSearch}
                onChangeText={setCkCurSearch}
                placeholder="🔍 جستجو: USD یا دالر یا افغانی..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />
            </View>
            <ScrollView style={{ maxHeight: 400, padding: 10 }} keyboardShouldPersistTaps="handled">
              {Object.keys(CUR)
                .filter(k => {
                  const q = ckCurSearch.toLowerCase().trim();
                  if (!q) return true;
                  return k.toLowerCase().includes(q) || CUR[k].name.includes(ckCurSearch);
                })
                .map(k => (
                  <TouchableOpacity
                    key={k}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}
                    onPress={() => { setCkForm({ ...ckForm, currency: k }); setShowCkCur(false); }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, textAlign: 'right' }}>{CUR[k].flag} {CUR[k].name} ({k})</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
'''
    # اضافه به آخر تابع — قبل از آخرین </Modal>
    last_modal = c.rfind('</Modal>')
    if last_modal > 0:
        c = c[:last_modal + 8] + "\n" + modal + "\n" + c[last_modal + 8:]
        print("   ✅ Modal ارز چک اضافه شد")
    else:
        print("   ⚠️ آخرین </Modal> نبود")

open('ExchangeScreen.tsx', 'w').write(c)
print("   changed:", c != orig)
PYEOF

# ═══════════════════════════════════════════════
# ۲. z-index صندوق
# ═══════════════════════════════════════════════
echo ""
echo "▶ ۲. z-index مودال‌های صندوق..."
python3 << 'PYEOF'
import re
c = open('BoxesScreen.tsx').read()
orig = c

# اضافه کردن zIndex/elevation به همه mBg و mBox
# ابتدا استایل‌ها رو با zIndex بازنویسی می‌کنیم
if 'zIndex: 99999' not in c:
    # mBg
    c = re.sub(
        r'mBg:\s*\{[^}]*\}',
        'mBg: { flex: 1, backgroundColor: \'rgba(15,36,56,0.85)\', justifyContent: \'center\', padding: 14, zIndex: 99999, elevation: 99999 }',
        c)
    # mBox
    c = re.sub(
        r'mBox:\s*\{[^}]*\}',
        'mBox: { backgroundColor: \'#0f2438\', borderRadius: 14, maxHeight: \'92%\', overflow: \'hidden\', zIndex: 100000, elevation: 100000 }',
        c)
    print("   ✅ zIndex/elevation اضافه شد")

# اطمینان از اینکه همه مودال‌ها با position absolute نیستن و ترتیب درست دارن
# شمارش مودال‌ها
modal_count = c.count('<Modal visible=')
print(f"   📊 {modal_count} مودال در فایل")

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
git commit -m "check: currency search + box: z-index modal" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
