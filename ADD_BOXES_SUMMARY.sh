#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 اضافه کردن خلاصه صندوق‌ها به پرینت حساب"
echo "═══════════════════════════════════════════════════"

# ═══ ۱. اضافه کردن getBoxesForPerson به lib.boxes.ts ═══
echo ""
echo "▶ ۱. افزودن getBoxesForPerson به lib.boxes.ts..."
python3 << 'PYEOF'
c = open('lib.boxes.ts').read()
orig = c

if 'getBoxesForPerson' in c:
    print("  ℹ️ از قبل هست")
else:
    add_fn = '''

// ═══ صندوق‌های یک شخص + موجودی هر کدام ═══
export async function getBoxesForPerson(code: string): Promise<any[]> {
  if (!code) return [];
  const k = String(code).toLowerCase();
  const boxes = await getBoxes();
  const txs = await getBoxTransactions();
  const mine = boxes.filter((b: any) => String(b.owner_code || '').toLowerCase() === k);
  return mine.map((b: any) => {
    const id = String(b.id || b.local_id || '');
    let bal = Number(b.opening) || 0;
    let totalIn = 0, totalOut = 0;
    txs.filter((t: any) => String(t.box_id || '') === id).forEach((t: any) => {
      const inAmt = Number(t.in) || 0;
      const outAmt = Number(t.out) || 0;
      bal += inAmt - outAmt;
      totalIn += inAmt;
      totalOut += outAmt;
    });
    return {
      ...b,
      current_balance: bal,
      total_in: totalIn,
      total_out: totalOut,
      opening: Number(b.opening) || 0,
    };
  });
}
'''
    c = c + add_fn
    open('lib.boxes.ts', 'w').write(c)
    print("  ✅ getBoxesForPerson اضافه شد")

# اطمینان از import
if 'getBoxesForPerson' not in c.split('const buildStatement')[0] if 'const buildStatement' in c else True:
    pass
PYEOF

# ═══ ۲. import + استفاده در buildStatement ═══
echo ""
echo "▶ ۲. اصلاح ExchangeScreen.tsx..."
python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# اصلاح import
old_imp = "import { getBoxTxsByCounterparty, getBoxSummaryForPerson, backfillBoxTxs } from './lib.boxes';"
new_imp = "import { getBoxTxsByCounterparty, getBoxSummaryForPerson, backfillBoxTxs, getBoxesForPerson } from './lib.boxes';"
if old_imp in c:
    c = c.replace(old_imp, new_imp, 1)
    print("  ✅ import اصلاح شد")
elif 'getBoxesForPerson' not in c.split('const buildStatement')[0]:
    # اگه import قدیمی متفاوته
    c = re.sub(
        r"import \{([^}]*)\} from '\./lib\.boxes';",
        lambda m: "import {" + m.group(1).rstrip() + ", getBoxesForPerson } from './lib.boxes';",
        c, count=1)
    print("  ✅ import (regex)")

# در buildStatement: fetch boxesForPerson
old_fetch = """      await backfillBoxTxs();
      myBoxTxs = await getBoxTxsByCounterparty(cust.code);
      boxSummary = await getBoxSummaryForPerson(cust.code);
      console.log('[stmt] boxTxs:', myBoxTxs.length, 'for', cust.code);"""
new_fetch = """      await backfillBoxTxs();
      myBoxTxs = await getBoxTxsByCounterparty(cust.code);
      boxSummary = await getBoxSummaryForPerson(cust.code);
      myBoxes = await getBoxesForPerson(cust.code);
      console.log('[stmt] boxTxs:', myBoxTxs.length, 'boxes:', myBoxes.length, 'for', cust.code);"""

if old_fetch in c:
    c = c.replace(old_fetch, new_fetch, 1)
    print("  ✅ fetch boxesForPerson")
else:
    print("  ⚠️ الگوی fetch نبود")

# اعلان myBoxes قبل از try
old_decl = "    let myBoxTxs: any[] = []; let boxSummary: any = { given: {}, received: {}, txCount: 0 };"
new_decl = "    let myBoxTxs: any[] = []; let boxSummary: any = { given: {}, received: {}, txCount: 0 }; let myBoxes: any[] = [];"
if old_decl in c:
    c = c.replace(old_decl, new_decl, 1)
    print("  ✅ اعلان myBoxes")

# افزودن به setStmtData
old_set = """      boxTxs: myBoxTxs, boxSummary,"""
new_set = """      boxTxs: myBoxTxs, boxSummary, boxes_for_person: myBoxes,"""
if old_set in c:
    c = c.replace(old_set, new_set, 1)
    print("  ✅ setStmtData.boxes_for_person")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۳. افزودن بخش UI «صندوق‌های طرف حساب» در پرینت ═══
echo ""
echo "▶ ۳. افزودن UI «صندوق‌های طرف»..."
python3 << 'PYEOF'
c = open('ExchangeScreen.tsx').read()
orig = c

# جستجو برای محل درج — قبل از بخش معاملات
marker = "{/* ═══ معاملات کامل ═══ */}"
if marker in c and 'BOXES_FOR_PERSON_SECTION' not in c:
    idx = c.find(marker)
    section = '''{/* BOXES_FOR_PERSON_SECTION */}
                {(stmtData.boxes_for_person || []).length > 0 && (
                  <>
                    <Text style={[s.secT, { marginTop: 16 }]}>📦 صندوق‌های طرف حساب ({stmtData.boxes_for_person.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <View>
                        <View style={s.tblHeader}>
                          <Text style={[s.th, { width: 36 }]}>#</Text>
                          <Text style={[s.th, { width: 100 }]}>کد صندوق</Text>
                          <Text style={[s.th, { width: 180 }]}>نام صندوق</Text>
                          <Text style={[s.th, { width: 80 }]}>ارز</Text>
                          <Text style={[s.th, { width: 130 }]}>موجودی اولیه</Text>
                          <Text style={[s.th, { width: 130 }]}>جمع ورودی</Text>
                          <Text style={[s.th, { width: 130 }]}>جمع خروجی</Text>
                          <Text style={[s.th, { width: 130 }]}>موجودی فعلی</Text>
                        </View>
                        {(stmtData.boxes_for_person || []).map((b: any, i: number) => {
                          const dec = CUR[b.currency]?.dec || 0;
                          const bal = Number(b.current_balance) || 0;
                          const col = bal > 0 ? '#00ff88' : bal < 0 ? '#ff3355' : '#94a3b8';
                          return (
                            <View key={b.id || b.local_id || i} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#0a1628' }]}>
                              <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                              <Text style={[s.td, { width: 100, color: '#7c3aed', fontWeight: 'bold', fontSize: 11 }]}>{b.code || '—'}</Text>
                              <Text style={[s.td, { width: 180, color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'right' }]} numberOfLines={1}>{b.name || '—'}</Text>
                              <Text style={[s.td, { width: 80, color: '#60a5fa', fontSize: 11 }]}>{CUR[b.currency]?.flag} {b.currency}</Text>
                              <Text style={[s.td, { width: 130, color: '#cbd5e1', fontSize: 11 }]}>{fmt(b.opening, dec)}</Text>
                              <Text style={[s.td, { width: 130, color: '#00ff88', fontWeight: 'bold', fontSize: 11 }]}>{fmt(b.total_in, dec)}</Text>
                              <Text style={[s.td, { width: 130, color: '#ff3355', fontWeight: 'bold', fontSize: 11 }]}>{fmt(b.total_out, dec)}</Text>
                              <Text style={[s.td, { width: 130, color: col, fontWeight: 'bold', fontSize: 13 }]}>{fmt(bal, dec)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {/* جمع کل صندوق‌های طرف بر اساس ارز */}
                    <View style={{ marginTop: 8, padding: 10, backgroundColor: '#0f2438', borderRadius: 8, borderWidth: 1, borderColor: '#334155' }}>
                      <Text style={{ color: '#d4af37', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>💰 جمع کل موجودی صندوق‌های {stmtCustomer.name} بر اساس ارز</Text>
                      {(() => {
                        const totals: Record<string, number> = {};
                        (stmtData.boxes_for_person || []).forEach((b: any) => {
                          const cur = b.currency || '';
                          totals[cur] = (totals[cur] || 0) + (Number(b.current_balance) || 0);
                        });
                        const entries = Object.entries(totals);
                        if (entries.length === 0) return <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right' }}>—</Text>;
                        return entries.map(([cur, v]) => (
                          <View key={cur} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                            <Text style={{ color: '#e2e8f0', fontSize: 12 }}>{CUR[cur]?.flag || '💱'} {cur}</Text>
                            <Text style={{ color: v > 0 ? '#00ff88' : v < 0 ? '#ff3355' : '#94a3b8', fontWeight: 'bold', fontSize: 13, fontFamily: 'monospace' }}>{fmt(v, CUR[cur]?.dec || 0)}</Text>
                          </View>
                        ));
                      })()}
                    </View>
                  </>
                )}

                '''
    c = c[:idx] + section + c[idx:]
    print("  ✅ UI «صندوق‌های طرف» اضافه شد")
else:
    if 'BOXES_FOR_PERSON_SECTION' in c:
        print("  ℹ️ از قبل هست")
    else:
        print("  ⚠️ marker پیدا نشد")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۴. بیلد ═══
echo ""
echo "▶ ۴. پاک کردن و fresh build..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -6

if [ ! -f "docs/index.html" ]; then
  echo "  ❌ بیلد موفق نشد"
  exit 1
fi
echo "  ✅ بیلد موفق"

# ═══ ۵. تنظیم مسیر + پوش ═══
sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
git add -A
git commit -m "statement: add boxes summary for counterparty" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام شد"
echo "  ⏱️ صبر کن ۲ دقیقه"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
