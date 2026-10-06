#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 ارز حواله + چک با جستجو"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_hawck
echo "✅ Backup"

python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# ═══ ۱. states جدید ═══
if 'showHawCur' not in c:
    c = c.replace(
        "const [showCkCur, setShowCkCur] = useState(false);",
        "const [showCkCur, setShowCkCur] = useState(false);\n  const [showHawCur, setShowHawCur] = useState(false);\n  const [hawCurSearch, setHawCurSearch] = useState('');",
        1)
    print("   ✅ state showHawCur")

# ═══ ۲. تابع کمکی برای جایگزینی chips ═══
def replace_chips(c, form_name, setter_name):
    """جایگزینی chips با دکمه"""
    anchor = f'onPress={{() => {setter_name}({{ ...{form_name}, currency: c }})}}'
    idx = c.find(anchor)
    if idx < 0:
        return c, False
    
    # label ارز قبل از این
    label_marker = '<Text style={s.lbl}>ارز</Text>'
    start = c.rfind(label_marker, 0, idx)
    if start < 0:
        return c, False
    
    # label بعدی
    next_label = c.find('<Text style={s.lbl}>', idx)
    if next_label < 0:
        return c, False
    
    new_block = f'''<Text style={{s.lbl}}>💱 ارز</Text>
            <TouchableOpacity style={{s.inp}} onPress={{() => {{ set{form_name.capitalize()}CurSearch(''); setShow{form_name.capitalize()}Cur(true); }}}}>
              <Text style={{{{ color: {form_name}.currency ? '#0f2438' : '#94a3b8', textAlign: 'right' }}}}>
                {{{form_name}.currency ? `${{CUR[{form_name}.currency]?.flag}} ${{{form_name}.currency}} — ${{CUR[{form_name}.currency]?.name}}` : '🔍 انتخاب ارز...'}}
              </Text>
            </TouchableOpacity>
            '''
    return c[:start] + new_block + c[next_label:], True

# حواله
c, ok1 = replace_chips(c, 'hawForm', 'setHawForm')
print(f"   {'✅' if ok1 else '❌'} حواله chips → دکمه")

# چک
c, ok2 = replace_chips(c, 'ckForm', 'setCkForm')
print(f"   {'✅' if ok2 else '❌'} چک chips → دکمه")

# ═══ ۳. مودال حواله (اگر نیست) ═══
if 'HAW_CUR_MODAL' not in c:
    modal = '''
      {/* HAW_CUR_MODAL */}
      <Modal visible={showHawCur} transparent animationType="fade" onRequestClose={() => setShowHawCur(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,36,56,0.95)', justifyContent: 'center', padding: 14, zIndex: 999999, elevation: 999999 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#065f46', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' }}>💱 انتخاب ارز ({Object.keys(CUR).length})</Text>
              <TouchableOpacity onPress={() => setShowHawCur(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 10 }}>
              <TextInput
                style={{ backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, textAlign: 'right' }}
                value={hawCurSearch}
                onChangeText={setHawCurSearch}
                placeholder="🔍 جستجو: USD یا دالر..."
                placeholderTextColor="#94a3b8"
                autoFocus
              />
            </View>
            <ScrollView style={{ maxHeight: 400, padding: 10 }} keyboardShouldPersistTaps="handled">
              {Object.keys(CUR)
                .filter(k => {
                  const q = hawCurSearch.toLowerCase().trim();
                  if (!q) return true;
                  return k.toLowerCase().includes(q) || CUR[k].name.includes(hawCurSearch);
                })
                .map(k => (
                  <TouchableOpacity
                    key={k}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}
                    onPress={() => { setHawForm({ ...hawForm, currency: k }); setShowHawCur(false); }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, textAlign: 'right' }}>{CUR[k].flag} {CUR[k].name} ({k})</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
'''
    # اضافه به آخر — قبل از آخرین </Modal> یا در آخر return
    last_modal = c.rfind('</Modal>')
    if last_modal > 0:
        c = c[:last_modal + 8] + "\n" + modal + "\n" + c[last_modal + 8:]
        print("   ✅ Modal حواله اضافه شد")

# ═══ ۴. اطمینان از اینکه مودال چک با z-index هست ═══
if 'showCkCur' in c and 'CK_CUR_MODAL' in c:
    # چک اگر z-index نداره اضافه کن
    m = re.search(r'visible=\{showCkCur\}([\s\S]{0,500}?)<View style=\{\{([^}]+)\}\}', c)
    if m and 'zIndex' not in m.group(2):
        old = m.group(0)
        new = old.replace(
            f'<View style={{{{{m.group(2)}}}}}',
            f'<View style={{{{ {m.group(2)}, zIndex: 999999, elevation: 999999 }}}}'
        )
        c = c.replace(old, new, 1)
        print("   ✅ z-index چک")

open('ExchangeScreen.tsx', 'w').write(c)
print("   changed:", c != orig)
PYEOF

# ═══ ۵. بیلد ═══
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
git commit -m "hawala+check: currency search modal" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
