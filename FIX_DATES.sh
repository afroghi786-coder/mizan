#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 اصلاح تاریخ‌ها در تب صرافی"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_dates
cp App.tsx App.tsx.backup_dates
echo "✅ Backup گرفته شد"

python3 << 'PYEOF'
import re

# ═══ App.tsx: Export DateField ═══
c = open('App.tsx').read()
if 'export function DateField' not in c:
    c = c.replace('function DateField(', 'export function DateField(', 1)
    open('App.tsx', 'w').write(c)
    print("✅ App.tsx: DateField export شد")

# ═══ ExchangeScreen.tsx ═══
c = open('ExchangeScreen.tsx').read()
orig = c

# ۱. imports
needed = ['getCalType', 'parseDateAny', 'g2j', 'g2h', 'pad2', 'j2g', 'h2g', 'toStorageDateFull']
m = re.search(r"import \{([^}]+)\} from '\./lib\.offline';", c)
if m:
    inner = m.group(1).strip()
    additions = [n for n in needed if n not in inner]
    if additions:
        new_inner = inner + ', ' + ', '.join(additions)
        c = c[:m.start()] + "import {" + new_inner + "} from './lib.offline';" + c[m.end():]
        print(f"✅ import: {', '.join(additions)}")

# ۲. DateField
if 'function DateField(' not in c:
    df = '''function DateField({ value, onChange, compact, defaultToToday }: any) {
  const [type, setType] = useState<any>(getCalType());
  const [g, setG] = useState<Date | null>(value ? parseDateAny(value) : (defaultToToday ? new Date() : null));
  const [fields, setFields] = useState({ y: '', m: '', d: '', h: '00', n: '00', s: '00' });
  useEffect(() => {
    if (!g) { setFields({ y: '', m: '', d: '', h: '00', n: '00', s: '00' }); return; }
    let y = 0, mo = 0, d = 0;
    if (type === 'jalali') { [y, mo, d] = g2j(g.getFullYear(), g.getMonth() + 1, g.getDate()); }
    else if (type === 'hijri') { const h = g2h(g); y = h.y; mo = h.m; d = h.d; }
    else { y = g.getFullYear(); mo = g.getMonth() + 1; d = g.getDate(); }
    setFields({ y: String(y), m: pad2(mo), d: pad2(d), h: pad2(g.getHours()), n: pad2(g.getMinutes()), s: pad2(g.getSeconds()) });
  }, [g, type]);
  const apply = (f: any) => {
    setFields(f);
    const y = parseInt(f.y, 10), m = parseInt(f.m, 10), d = parseInt(f.d, 10);
    if (!y || !m || !d) { setG(null); onChange(''); return; }
    const h = parseInt(f.h, 10) || 0, n = parseInt(f.n, 10) || 0, sec = parseInt(f.s, 10) || 0;
    let gg: Date;
    if (type === 'jalali') { const r = j2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else if (type === 'hijri') { const r = h2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else { gg = new Date(y, m - 1, d, h, n, sec); }
    setG(gg); onChange(toStorageDateFull(gg));
  };
  const F = ({ v, k, w, ph }: any) => (
    <TextInput style={[s.dateInp, { width: w || 44 }, compact && { fontSize: 11 }]} value={v} onChangeText={(t) => apply({ ...fields, [k]: t.replace(/\\D/g, '').slice(0, k === 'y' ? 4 : 2) })} keyboardType="numeric" placeholder={ph} placeholderTextColor="#94a3b8" />
  );
  return (
    <View style={[s.dateBox, compact && { paddingVertical: 3 }]}>
      <F v={fields.y} k="y" w={compact ? 52 : 60} ph="YYYY" />
      <Text style={s.dateSep}>/</Text><F v={fields.m} k="m" ph="MM" />
      <Text style={s.dateSep}>/</Text><F v={fields.d} k="d" ph="DD" />
      <Text style={[s.dateSep, { width: 8 }]}> </Text>
      <F v={fields.h} k="h" ph="HH" />
      <Text style={s.dateSep}>:</Text><F v={fields.n} k="n" ph="MM" />
      <Text style={s.dateSep}>:</Text><F v={fields.s} k="s" ph="SS" />
      <TouchableOpacity style={s.typeBtn} onPress={() => { const next = type === 'jalali' ? 'gregorian' : type === 'gregorian' ? 'hijri' : 'jalali'; setType(next); }}>
        <Text style={s.typeBtnTxt}>{type === 'jalali' ? 'شمسی' : type === 'gregorian' ? 'میلادی' : 'قمری'}</Text>
      </TouchableOpacity>
    </View>
  );
}

'''
    idx = c.find('export default function ExchangeScreen')
    if idx > 0:
        c = c[:idx] + df + c[idx:]
        print("✅ DateField اضافه شد")

# ۳. styles
if 'dateBox:' not in c:
    idx = c.find('const s = StyleSheet.create({')
    if idx > 0:
        ins = c.find('\n', idx) + 1
        st = """  dateBox: { flexDirection: 'row', alignItems: 'center', padding: 6, borderWidth: 2, borderRadius: 8, gap: 1, backgroundColor: '#1a2332', borderColor: '#334155' },
  dateInp: { padding: 4, textAlign: 'center', fontSize: 13, color: '#fff', backgroundColor: 'transparent' },
  dateSep: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  typeBtn: { marginLeft: 'auto', padding: 4, borderRadius: 6, backgroundColor: '#334155' },
  typeBtnTxt: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
"""
        c = c[:ins] + st + c[ins:]
        print("✅ styles اضافه شد")

# ۴. defaults
c = c.replace("date: new Date().toLocaleDateString('fa-IR')", "date: toStorageDateFull(new Date())")
c = c.replace("const [fDate, setFDate] = useState(new Date().toLocaleDateString('fa-IR'))",
              "const [fDate, setFDate] = useState(toStorageDateFull(new Date()))")
c = c.replace("setFDate(new Date().toLocaleDateString('fa-IR'))", "setFDate(toStorageDateFull(new Date()))")
c = c.replace("setFDate(t.date || new Date().toLocaleDateString('fa-IR'))",
              "setFDate(t.date || toStorageDateFull(new Date()))")
print("✅ مقادیر پیش‌فرض")

# ۵. Replace TextInputs
repls = [
    ('<TextInput style={s.inp} value={fDate} onChangeText={setFDate} />',
     '<DateField value={fDate} onChange={setFDate} defaultToToday />'),
    ('<TextInput style={s.inp} value={hawForm.date} onChangeText={v => setHawForm({ ...hawForm, date: v })} />',
     '<DateField value={hawForm.date} onChange={(v: string) => setHawForm({ ...hawForm, date: v })} compact defaultToToday />'),
    ('<TextInput style={s.inp} value={trForm.date} onChangeText={v => setTrForm({ ...trForm, date: v })} />',
     '<DateField value={trForm.date} onChange={(v: string) => setTrForm({ ...trForm, date: v })} compact defaultToToday />'),
    ('<TextInput style={s.inp} value={ckForm.due_date} onChangeText={v => setCkForm({ ...ckForm, due_date: v })} placeholder="1405/09/15" />',
     '<DateField value={ckForm.due_date} onChange={(v: string) => setCkForm({ ...ckForm, due_date: v })} compact />'),
]
for old, new in repls:
    if old in c:
        c = c.replace(old, new)
        print("✅ فیلد جایگزین شد")

open('ExchangeScreen.tsx', 'w').write(c)
print("changed:", c != orig)
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
git commit -m "exchange: full DateField for all dates" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام شد"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
