#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 ارز حواله + چک دقیقاً مثل معامله جدید"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_allmodal
echo "✅ Backup"

python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# ═══ ۱. State ها ═══
if 'showHawCur' not in c:
    c = c.replace(
        "const [showCkCur, setShowCkCur] = useState(false);",
        "const [showCkCur, setShowCkCur] = useState(false);\n  const [showHawCur, setShowHawCur] = useState(false);\n  const [hawCurSearch, setHawCurSearch] = useState('');",
        1)
    print("✅ state showHawCur")
if 'ckCurSearch' not in c:
    c = c.replace(
        "const [showCkCur, setShowCkCur] = useState(false);",
        "const [showCkCur, setShowCkCur] = useState(false);\n  const [ckCurSearch, setCkCurSearch] = useState('');",
        1)
    print("✅ state ckCurSearch")

# ═══ ۲. حذف blocks قدیمی (chips) — الگوی دقیق ═══
# حواله: از <Text style={s.lbl}>ارز</Text> تا </ScrollView> بعدش
def replace_chips_block(c, form_var, setter):
    # چک: کل block از <Text style={s.lbl}>ارز</Text> تا اولین </ScrollView> بعدش
    # پیدا کردن با form_var
    anchor = f'{form_var}.currency === c'
    idx = c.find(anchor)
    if idx < 0:
        return c, False
    # جستجوی شروع بلوک
    start = c.rfind('<Text style={s.lbl}>ارز</Text>', 0, idx)
    if start < 0:
        return c, False
    # جستجوی پایان بلوک: اولین </ScrollView> بعد از idx
    end_scroll = c.find('</ScrollView>', idx)
    if end_scroll < 0:
        return c, False
    end = end_scroll + len('</ScrollView>')
    
    return c[:start] + c[end:], True

c, ok1 = replace_chips_block(c, 'hawForm', 'setHawForm')
print(f"{'✅' if ok1 else '❌'} حذف chips حواله")

c, ok2 = replace_chips_block(c, 'ckForm', 'setCkForm')
print(f"{'✅' if ok2 else '❌'} حذف chips چک")

# ═══ ۳. insert دکمه‌های جدید قبل از label بعدی ═══
# الان جای chip خالی شد، باید دکمه بذاریم

# پیدا کردن محل «نام ذی‌نفع» در حواله
haw_target = c.find('<Text style={s.lbl}>👤 نام ذی‌نفع')
if haw_target > 0:
    # قبلش دکمه ارز رو بذار
    btn = '''<Text style={s.lbl}>💱 ارز</Text>
            <TouchableOpacity style={s.inp} onPress={() => { setHawCurSearch(''); setShowHawCur(true); }}>
              <Text style={{ color: hawForm.currency ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {hawForm.currency ? `${CUR[hawForm.currency]?.flag} ${hawForm.currency} — ${CUR[hawForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>
            '''
    c = c[:haw_target] + btn + c[haw_target:]
    print("✅ دکمه ارز حواله اضافه شد")

# چک
ck_target = c.find('<Text style={s.lbl}>💳 شماره چک')
if ck_target > 0:
    btn = '''<Text style={s.lbl}>💱 ارز</Text>
            <TouchableOpacity style={s.inp} onPress={() => { setCkCurSearch(''); setShowCkCur(true); }}>
              <Text style={{ color: ckForm.currency ? '#0f2438' : '#94a3b8', textAlign: 'right' }}>
                {ckForm.currency ? `${CUR[ckForm.currency]?.flag} ${ckForm.currency} — ${CUR[ckForm.currency]?.name}` : '🔍 انتخاب ارز...'}
              </Text>
            </TouchableOpacity>
            '''
    c = c[:ck_target] + btn + c[ck_target:]
    print("✅ دکمه ارز چک اضافه شد")

# ═══ ۴. مودال حواله (اگر نیست) ═══
if 'HAW_CUR_MODAL' not in c:
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
    last_modal = c.rfind('</Modal>')
    if last_modal > 0:
        c = c[:last_modal + 8] + "\n" + haw_modal + "\n" + c[last_modal + 8:]
        print("✅ Modal حواله")

# ═══ ۵. مودال چک (اگر نیست) ═══
if 'CK_CUR_MODAL' not in c:
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
    last_modal = c.rfind('</Modal>')
    if last_modal > 0:
        c = c[:last_modal + 8] + "\n" + ck_modal + "\n" + c[last_modal + 8:]
        print("✅ Modal چک")

open('ExchangeScreen.tsx', 'w').write(c)
print("changed:", c != orig)
PYEOF

# ═══ ۶. بیلد ═══
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
git commit -m "hawala + check: currency search modal (like trade)" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه  |  🌐 Incognito  |  Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
