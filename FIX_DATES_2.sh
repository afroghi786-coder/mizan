#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 اصلاح ۳ مورد تاریخ"
echo "═══════════════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.backup_dates2
cp BoxesScreen.tsx BoxesScreen.tsx.backup_dates
echo "✅ Backup"

# ═══ ۱. اصلاح چک: value خالی + defaultToToday ═══
echo ""
echo "▶ ۱. اصلاح چک..."
python3 << 'PYEOF'
c = open('ExchangeScreen.tsx').read()
orig = c

# ۱.۱: when opening check modal — date پر باشه
old1 = """setCkEditId(null); setCkForm({ direction: 'in', check_number: '', bank: '', amount: '', currency: 'AFN', partner_code: '', partner_name: '', due_date: '', status: 'pending', note: '' }); setCkModal(true);"""
new1 = """setCkEditId(null); setCkForm({ direction: 'in', check_number: '', bank: '', amount: '', currency: 'AFN', partner_code: '', partner_name: '', due_date: toStorageDateFull(new Date()), status: 'pending', note: '' }); setCkModal(true);"""
if old1 in c:
    c = c.replace(old1, new1, 1)
    print("  ✅ چک: date پیش‌فرض پر")
else:
    print("  ⚠️ الگوی open check نبود")

# ۱.۲: defaultToToday در DateField
old2 = '<DateField value={ckForm.due_date} onChange={(v: string) => setCkForm({ ...ckForm, due_date: v })} compact />'
new2 = '<DateField value={ckForm.due_date} onChange={(v: string) => setCkForm({ ...ckForm, due_date: v })} compact defaultToToday />'
if old2 in c:
    c = c.replace(old2, new2, 1)
    print("  ✅ چک: defaultToToday")
else:
    print("  ⚠️ الگوی DateField چک نبود")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۲ + ۳. اصلاح BoxesScreen — انتقال و ایجاد صندوق ═══
echo ""
echo "▶ ۲. اصلاح BoxesScreen..."
python3 << 'PYEOF'
c = open('BoxesScreen.tsx').read()
orig = c

# ═══ ۲.۱: import DateField from App ═══
if 'import { DateField' not in c:
    c = "import { DateField } from './App';\n" + c
    print("  ✅ import DateField")
else:
    print("  ℹ️ DateField از قبل import شده")

# ═══ ۲.۲: import toStorageDateFull ═══
if 'toStorageDateFull' not in c.split('\n')[0:10].__str__():
    if "from './lib.offline'" in c:
        # اگه import داره
        import re
        m = re.search(r"import \{([^}]*)\} from '\./lib\.offline';", c)
        if m:
            inner = m.group(1).strip()
            if 'toStorageDateFull' not in inner:
                c = c[:m.start()] + "import {" + inner + ", toStorageDateFull } from './lib.offline';" + c[m.end():]
                print("  ✅ toStorageDateFull اضافه شد")
    else:
        c = "import { toStorageDateFull } from './lib.offline';\n" + c
        print("  ✅ toStorageDateFull import جدید")

# ═══ ۲.۳: تغییر date پیش‌فرض در انتقال و صندوق جدید ═══
c = c.replace("date: new Date().toLocaleDateString('fa-IR')", "date: toStorageDateFull(new Date())")
print("  ✅ مقادیر پیش‌فرض date")

# ═══ ۲.۴: افزودن فیلد date به فرم ایجاد صندوق ═══
# در فرم صندوق جدید، فیلد تاریخ افتتاحیه اضافه کن
old_box = """<Text style={s.lbl}>موجودی افتتاحیه</Text>
            <TextInput style={s.inp} value={String(boxForm.opening || '')} onChangeText={v => setBoxForm((f: any) => ({ ...f, opening: v.replace(/[^\\d.-]/g, '') }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />"""

new_box = """<Text style={s.lbl}>موجودی افتتاحیه</Text>
            <TextInput style={s.inp} value={String(boxForm.opening || '')} onChangeText={v => setBoxForm((f: any) => ({ ...f, opening: v.replace(/[^\\d.-]/g, '') }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>📅 تاریخ افتتاحیه</Text>
            <DateField value={boxForm.opening_date || toStorageDateFull(new Date())} onChange={(v: string) => setBoxForm((f: any) => ({ ...f, opening_date: v }))} compact defaultToToday />"""

if old_box in c:
    c = c.replace(old_box, new_box, 1)
    print("  ✅ فیلد تاریخ افتتاحیه در فرم صندوق")
else:
    print("  ⚠️ الگوی موجودی افتتاحیه نبود")

# ═══ ۲.۵: جایگزینی DateField در فرم انتقال ═══
# فرم انتقال الان:
# <Text style={s.lbl}>تاریخ</Text>
# <TextInput style={s.inp} value={transferForm.date || ''} onChangeText={v => setTransferForm((f: any) => ({ ...f, date: v }))} placeholderTextColor="#94a3b8" />

old_tr = """<Text style={s.lbl}>تاریخ</Text>
            <TextInput style={s.inp} value={transferForm.date || ''} onChangeText={v => setTransferForm((f: any) => ({ ...f, date: v }))} placeholderTextColor="#94a3b8" />"""

new_tr = """<Text style={s.lbl}>📅 تاریخ</Text>
            <DateField value={transferForm.date || toStorageDateFull(new Date())} onChange={(v: string) => setTransferForm((f: any) => ({ ...f, date: v }))} compact defaultToToday />"""

if old_tr in c:
    c = c.replace(old_tr, new_tr, 1)
    print("  ✅ DateField در فرم انتقال")
else:
    print("  ⚠️ الگوی فرم انتقال نبود")

# ═══ ۲.۶: اطمینان از styles DateField در BoxesScreen ═══
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
        print("  ✅ styles DateField اضافه شد")

open('BoxesScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۳. اطمینان از export DateField در App.tsx ═══
echo ""
echo "▶ ۳. اطمینان از export DateField..."
if ! grep -q "export function DateField" App.tsx; then
  sed -i 's/^function DateField/export function DateField/' App.tsx
  echo "  ✅ DateField export شد"
else
  echo "  ℹ️ از قبل export شده"
fi

# ═══ ۴. بیلد و پوش ═══
echo ""
echo "▶ ۴. بیلد..."
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
git commit -m "dates: fix check + box create + transfer date" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ صبر ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
