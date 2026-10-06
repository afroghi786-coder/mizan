#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 حواله + چک (اسم‌های درست) + z-index صندوق"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_final3
cp BoxesScreen.tsx BoxesScreen.tsx.backup_final3
echo "✅ Backup"

python3 << 'PYEOF'
import re

# ═══════════════════════════════════════════════
# ExchangeScreen.tsx
# ═══════════════════════════════════════════════
c = open('ExchangeScreen.tsx').read()
orig = c

# ═══ ۱. تصحیح اسم‌های اشتباه در کد موجود ═══
fixes = [
    ('HawformCurSearch', 'HawCurSearch'),
    ('ShowHawformCur', 'ShowHawCur'),
    ('CkformCurSearch', 'CkCurSearch'),
    ('ShowCkformCur', 'ShowCkCur'),
    ('hawformCurSearch', 'hawCurSearch'),
    ('ckformCurSearch', 'ckCurSearch'),
    ('showHawformCur', 'showHawCur'),
    ('showCkformCur', 'showCkCur'),
]
for old, new in fixes:
    n = c.count(old)
    if n > 0:
        c = c.replace(old, new)
        print(f"✅ تصحیح {old} ({n} بار)")

# ═══ ۲. اطمینان از state‌ها ═══
need_states = [
    ('showHawCur', 'const [showHawCur, setShowHawCur] = useState(false);',
     'const [showCkCur, setShowCkCur] = useState(false);'),
    ('hawCurSearch', "const [hawCurSearch, setHawCurSearch] = useState('');",
     'const [showHawCur, setShowHawCur] = useState(false);'),
    ('ckCurSearch', "const [ckCurSearch, setCkCurSearch] = useState('');",
     'const [showCkCur, setShowCkCur] = useState(false);'),
]
for name, decl, anchor in need_states:
    if decl not in c:
        if anchor in c:
            c = c.replace(anchor, anchor + "\n  " + decl, 1)
            print(f"✅ state {name}")
        else:
            # بعد از اولین useState بذار
            m = re.search(r'(const \[showCkCur[^\n]*\n)', c)
            if m:
                c = c[:m.end()] + "  " + decl + "\n" + c[m.end():]
                print(f"✅ state {name} (روش ۲)")
            else:
                print(f"⚠️ anchor برای {name} نبود")

# ═══ ۳. مودال حواله با اسم درست ═══
if 'HAW_CUR_MODAL' not in c:
    haw = '''
      {/* HAW_CUR_MODAL */}
      <Modal visible={showHawCur} transparent animationType="fade" onRequestClose={() => setShowHawCur(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14, zIndex: 999999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
              <TouchableOpacity onPress={() => setShowHawCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <TextInput style={[s.inp, { backgroundColor: '#f5f7fa', color: '#0f2438' }]} value={hawCurSearch} onChangeText={setHawCurSearch} placeholder="🔍 جستجو: USD یا دالر..." placeholderTextColor="#94a3b8" autoFocus />
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
    last = c.rfind('</Modal>')
    if last > 0:
        c = c[:last + 8] + "\n" + haw + "\n" + c[last + 8:]
        print("✅ Modal حواله")

# ═══ ۴. مودال چک ═══
if 'CK_CUR_MODAL' not in c:
    ck = '''
      {/* CK_CUR_MODAL */}
      <Modal visible={showCkCur} transparent animationType="fade" onRequestClose={() => setShowCkCur(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14, zIndex: 999999 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
              <TouchableOpacity onPress={() => setShowCkCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <TextInput style={[s.inp, { backgroundColor: '#f5f7fa', color: '#0f2438' }]} value={ckCurSearch} onChangeText={setCkCurSearch} placeholder="🔍 جستجو: USD یا دالر..." placeholderTextColor="#94a3b8" autoFocus />
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
    last = c.rfind('</Modal>')
    if last > 0:
        c = c[:last + 8] + "\n" + ck + "\n" + c[last + 8:]
        print("✅ Modal چک")

open('ExchangeScreen.tsx', 'w').write(c)
print("ExchangeScreen changed:", c != orig)

# ═══════════════════════════════════════════════
# BoxesScreen — z-index
# ═══════════════════════════════════════════════
c2 = open('BoxesScreen.tsx').read()
orig2 = c2
# اطمینان از z-index در mBg/mBox
if 'zIndex' not in c2:
    c2 = re.sub(
        r'mBg:\s*\{[^}]*\}',
        "mBg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.85)', justifyContent: 'center', padding: 14, zIndex: 99999, elevation: 99999 }",
        c2)
    c2 = re.sub(
        r'mBox:\s*\{[^}]*\}',
        "mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '92%', overflow: 'hidden', zIndex: 100000, elevation: 100000 }",
        c2)
    print("✅ BoxesScreen z-index")
open('BoxesScreen.tsx', 'w').write(c2)
print("BoxesScreen changed:", c2 != orig2)
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
git commit -m "final: hawala + check currency modal + box z-index" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "═══════════════════════════════════════════════════"
