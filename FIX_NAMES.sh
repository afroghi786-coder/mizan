#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 اصلاح اسم state ها + ساخت مودال‌ها"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_names
echo "✅ Backup"

python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# ═══ ۱. اصلاح اسم‌های اشتباه ═══
fixes = [
    ('setHawformCurSearch', 'setHawCurSearch'),
    ('setShowHawformCur', 'setShowHawCur'),
    ('showHawformCur', 'showHawCur'),
    ('hawformCurSearch', 'hawCurSearch'),
    ('setCkformCurSearch', 'setCkCurSearch'),
    ('setShowCkformCur', 'setShowCkCur'),
    ('showCkformCur', 'showCkCur'),
    ('ckformCurSearch', 'ckCurSearch'),
]
for old, new in fixes:
    n = c.count(old)
    if n > 0:
        c = c.replace(old, new)
        print(f"✅ {old} → {new} ({n} بار)")

# ═══ ۲. اطمینان از state های درست ═══
if 'showHawCur' not in c.split('const [')[0:5].__str__() and 'const [showHawCur' not in c:
    c = c.replace(
        "const [showCkCur, setShowCkCur] = useState(false);",
        "const [showCkCur, setShowCkCur] = useState(false);\n  const [showHawCur, setShowHawCur] = useState(false);",
        1)
    print("✅ state showHawCur اضافه")

if 'hawCurSearch' not in c.split('const [')[0:10].__str__() and 'const [hawCurSearch' not in c:
    c = c.replace(
        "const [showHawCur, setShowHawCur] = useState(false);",
        "const [showHawCur, setShowHawCur] = useState(false);\n  const [hawCurSearch, setHawCurSearch] = useState('');",
        1)
    print("✅ state hawCurSearch اضافه")

if 'ckCurSearch' not in c.split('const [')[0:10].__str__() and 'const [ckCurSearch' not in c:
    c = c.replace(
        "const [showCkCur, setShowCkCur] = useState(false);",
        "const [showCkCur, setShowCkCur] = useState(false);\n  const [ckCurSearch, setCkCurSearch] = useState('');",
        1)
    print("✅ state ckCurSearch اضافه")

# ═══ ۳. اطمینان از مودال‌ها ═══
# مودال حواله
if 'HAW_CUR_MODAL' not in c and 'showHawCur' in c:
    haw_modal = '''
      {/* HAW_CUR_MODAL */}
      <Modal visible={showHawCur} transparent animationType="fade" onRequestClose={() => setShowHawCur(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14, zIndex: 999999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
              <TouchableOpacity onPress={() => setShowHawCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <TextInput style={{ backgroundColor: '#f5f7fa', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, textAlign: 'right' }} value={hawCurSearch} onChangeText={setHawCurSearch} placeholder="🔍 جستجو: USD یا دالر..." placeholderTextColor="#94a3b8" autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 450, padding: 10 }} keyboardShouldPersistTaps="handled">
              {Object.keys(CUR).filter(k => { const q = hawCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(hawCurSearch); }).map(k => (
                <TouchableOpacity key={k} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }} onPress={() => { setHawForm({ ...hawForm, currency: k }); setShowHawCur(false); }}>
                  <Text style={{ color: '#0f2438', fontSize: 14, textAlign: 'right' }}>{CUR[k].flag} {CUR[k].name} ({k})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
'''
    last_modal = c.rfind('</Modal>')
    if last_modal > 0:
        c = c[:last_modal + 8] + "\n" + haw_modal + "\n" + c[last_modal + 8:]
        print("✅ Modal حواله اضافه شد")

# مودال چک
if 'CK_CUR_MODAL' not in c and 'showCkCur' in c:
    ck_modal = '''
      {/* CK_CUR_MODAL */}
      <Modal visible={showCkCur} transparent animationType="fade" onRequestClose={() => setShowCkCur(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14, zIndex: 999999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
              <TouchableOpacity onPress={() => setShowCkCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <TextInput style={{ backgroundColor: '#f5f7fa', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, textAlign: 'right' }} value={ckCurSearch} onChangeText={setCkCurSearch} placeholder="🔍 جستجو: USD یا دالر..." placeholderTextColor="#94a3b8" autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 450, padding: 10 }} keyboardShouldPersistTaps="handled">
              {Object.keys(CUR).filter(k => { const q = ckCurSearch.toLowerCase().trim(); if (!q) return true; return k.toLowerCase().includes(q) || CUR[k].name.includes(ckCurSearch); }).map(k => (
                <TouchableOpacity key={k} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }} onPress={() => { setCkForm({ ...ckForm, currency: k }); setShowCkCur(false); }}>
                  <Text style={{ color: '#0f2438', fontSize: 14, textAlign: 'right' }}>{CUR[k].flag} {CUR[k].name} ({k})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
'''
    last_modal = c.rfind('</Modal>')
    if last_modal > 0:
        c = c[:last_modal + 8] + "\n" + ck_modal + "\n" + c[last_modal + 8:]
        print("✅ Modal چک اضافه شد")

open('ExchangeScreen.tsx', 'w').write(c)
print()
print("changed:", c != orig)
PYEOF

echo ""
echo "▶ بیلد..."
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
git commit -m "fix: hawala+check currency state names" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه  |  🌐 Incognito  |  Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
