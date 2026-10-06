#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 اصلاح کامل — صندوق‌ها + پرینت حساب جامع"
echo "═══════════════════════════════════════════════════"

# ═══ ۱. اصلاح lib.box-auto.ts (ذخیره counterparty) ═══
echo ""
echo "▶ ۱. اصلاح box-auto..."
python3 << 'PYEOF'
import re
try:
    c = open('lib.box-auto.ts').read()
    old = """  await addBoxTransaction({
    box_id: boxId, box_code: box.code, type: p.type,
    in: p.inAmt, out: p.outAmt, currency: p.currency,
    related_box_code: p.related,
    description: p.description, date: p.date,
  });"""
    new = """  await addBoxTransaction({
    box_id: boxId, box_code: box.code, type: p.type,
    in: p.inAmt, out: p.outAmt, currency: p.currency,
    related_box_code: p.related,
    counterparty_code: p.ownerCode,
    counterparty_name: p.ownerName,
    owner_code: p.ownerCode,
    owner_name: p.ownerName,
    description: p.description, date: p.date,
  });"""
    if old in c:
        c = c.replace(old, new, 1)
        open('lib.box-auto.ts', 'w').write(c)
        print("  ✅ counterparty_code اضافه شد")
    else:
        print("  ℹ️ الگو نبود (شاید قبلاً)")
except Exception as e:
    print("  ⚠️", e)
PYEOF

# ═══ ۲. اصلاح getBoxTxsByCounterparty (lenient + backfill خودکار) ═══
echo ""
echo "▶ ۲. اصلاح lib.boxes.ts..."
python3 << 'PYEOF'
import re
c = open('lib.boxes.ts').read()
orig = c

# پیدا کردن و جایگزینی getBoxTxsByCounterparty
old_pat = r'export async function getBoxTxsByCounterparty\([^)]*\)[^{]*\{[\s\S]*?\n\}'
new_fn = '''export async function getBoxTxsByCounterparty(code: string): Promise<any[]> {
  if (!code) return [];
  const k = String(code).toLowerCase();
  const txs = await getBoxTransactions();
  const boxes = await getBoxes();
  const boxMap: Record<string, any> = {};
  boxes.forEach((b: any) => { boxMap[String(b.id || b.local_id)] = b; });
  return txs.filter((t: any) => {
    // ۱. مستقیم
    if (String(t.counterparty_code || '').toLowerCase() === k) return true;
    if (String(t.owner_code || '').toLowerCase() === k) return true;
    if (String(t.box_code || '').toLowerCase() === k) return true;
    // ۲. از طریق صندوق (fallback برای تراکنش‌های قدیمی)
    const box = boxMap[String(t.box_id || '')];
    if (box && String(box.owner_code || '').toLowerCase() === k) return true;
    return false;
  });
}

// ═══ auto-backfill: هر بار که getBoxTxsByCounterparty صدا زده شد، قدیمی‌ها رو اصلاح کن ═══
async function backfillBoxTxs(): Promise<void> {
  try {
    const boxes = await getBoxes();
    const txs = await getBoxTransactions();
    const boxMap: Record<string, any> = {};
    boxes.forEach((b: any) => { boxMap[String(b.id || b.local_id)] = b; });
    let changed = false;
    const next = txs.map((t: any) => {
      const box = boxMap[String(t.box_id || '')];
      if (box && box.owner_code && !t.counterparty_code) {
        changed = true;
        return { ...t, counterparty_code: box.owner_code, counterparty_name: box.owner_name, owner_code: box.owner_code, owner_name: box.owner_name };
      }
      return t;
    });
    if (changed) {
      await AsyncStorage.setItem(TX_KEY, JSON.stringify(next));
      console.log('[backfillBoxTxs] ✅ اصلاح شد');
    }
  } catch (e) { console.log('backfill error:', e); }
}
export { backfillBoxTxs };'''

m = re.search(old_pat, c)
if m:
    c = c[:m.start()] + new_fn + c[m.end():]
    print("  ✅ getBoxTxsByCounterparty + backfill")
else:
    print("  ⚠️ الگو نبود")

# اطمینان از import AsyncStorage
if 'import AsyncStorage' not in c:
    c = "import AsyncStorage from '@react-native-async-storage/async-storage';\n" + c
    print("  ✅ AsyncStorage import اضافه شد")

open('lib.boxes.ts', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۳. اصلاح buildStatement: backfill قبل از fetch + جستجوی واقعی‌تر ═══
echo ""
echo "▶ ۳. اصلاح buildStatement..."
python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
orig = c

# افزودن backfillBoxTxs به import
if 'backfillBoxTxs' not in c.split('const buildStatement')[0]:
    c = c.replace(
        "import { getBoxTxsByCounterparty, getBoxSummaryForPerson } from './lib.boxes';",
        "import { getBoxTxsByCounterparty, getBoxSummaryForPerson, backfillBoxTxs } from './lib.boxes';",
        1)
    if 'backfillBoxTxs' not in c:
        # شاید import نبود، اضافه کن
        c = "import { getBoxTxsByCounterparty, getBoxSummaryForPerson, backfillBoxTxs } from './lib.boxes';\n" + c
    print("  ✅ import backfillBoxTxs")

# در buildStatement، قبل از getBoxTxsByCounterparty، backfill رو صدا بزن
old_call = """    let myBoxTxs: any[] = []; let boxSummary: any = { given: {}, received: {}, txCount: 0 };
    try { myBoxTxs = await getBoxTxsByCounterparty(cust.code); boxSummary = await getBoxSummaryForPerson(cust.code); } catch (e) { console.log('box err:', e); }"""
new_call = """    let myBoxTxs: any[] = []; let boxSummary: any = { given: {}, received: {}, txCount: 0 };
    try {
      await backfillBoxTxs();
      myBoxTxs = await getBoxTxsByCounterparty(cust.code);
      boxSummary = await getBoxSummaryForPerson(cust.code);
      console.log('[stmt] boxTxs:', myBoxTxs.length, 'for', cust.code);
    } catch (e) { console.log('box err:', e); }"""

if old_call in c:
    c = c.replace(old_call, new_call, 1)
    print("  ✅ backfill در buildStatement")
else:
    print("  ⚠️ الگوی fetch صندوق نبود")

open('ExchangeScreen.tsx', 'w').write(c)
print("  changed:", c != orig)
PYEOF

# ═══ ۴. پاک کردن و fresh build ═══
echo ""
echo "▶ ۴. پاک کردن build قدیمی..."
rm -rf docs .expo node_modules/.cache
echo "  ✅"

echo ""
echo "▶ ۵. بیلد fresh..."
npx expo export --platform web --output-dir docs 2>&1 | tail -8

if [ ! -f "docs/index.html" ]; then
  echo "  ❌ بیلد موفق نشد"
  exit 1
fi
echo "  ✅ بیلد موفق"

# ═══ ۶. تنظیم مسیر ═══
sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
echo "  ✅ مسیر تنظیم شد"

# ═══ ۷. کامیت و پوش ═══
echo ""
echo "▶ ۶. کامیت و پوش..."
git add -A
git commit -m "box tx: auto-backfill + comprehensive statement" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام شد"
echo "  ⏱️ صبر کن ۲ دقیقه"
echo "  🌐 Incognito باز کن"
echo "  🔄 Ctrl+Shift+R"
echo "  🖨️ پرینت حساب → کد خریدار → همه بخش‌ها میاد"
echo "═══════════════════════════════════════════════════"
