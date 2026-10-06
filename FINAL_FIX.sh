#!/bin/bash
set +e

echo "═══════════════════════════════════════════════════"
echo "  🎯 پرینت حساب جامع — یک اسکریپت، همه کار"
echo "═══════════════════════════════════════════════════"

# ═══ ۱. اطمینان از import ═══
echo ""
echo "▶ ۱. بررسی import lib.boxes..."
if ! grep -q "from './lib.boxes'" ExchangeScreen.tsx; then
  sed -i "1i import { getBoxTxsByCounterparty, getBoxSummaryForPerson } from './lib.boxes';" ExchangeScreen.tsx
  echo "  ✅ import اضافه شد"
else
  echo "  ✅ import هست"
fi

# ═══ ۲. اطمینان از تابع buildStatement جامع ═══
echo ""
echo "▶ ۲. بررسی buildStatement..."
if grep -q "boxTxs: myBoxTxs" ExchangeScreen.tsx; then
  echo "  ✅ buildStatement جامع هست"
else
  echo "  🔧 نیاز به بازنویسی"
  python3 << 'PYEOF'
import re
c = open('ExchangeScreen.tsx').read()
m = re.search(r'const buildStatement = (?:async )?\([^)]*\)\s*=>\s*\{', c)
if not m:
    print("  ❌ buildStatement پیدا نشد")
    exit(1)
start = m.start()
brace_start = c.find('{', m.end() - 1)
depth = 0
i = brace_start
while i < len(c):
    if c[i] == '{': depth += 1
    elif c[i] == '}':
        depth -= 1
        if depth == 0: break
    i += 1
end = i + 1
new_fn = '''const buildStatement = async (q: string) => {
    const key = String(q || '').trim().toLowerCase();
    if (!key) return;
    const allPeople = [...(customers || []), ...(fxCustomers || []), ...(fxBuyers || [])];
    const seen = new Set();
    const uniquePeople: any[] = [];
    allPeople.forEach((p: any) => { const k = p.code || p.id || p.phone; if (k && !seen.has(k)) { seen.add(k); uniquePeople.push(p); } });
    const cust = uniquePeople.find((c: any) =>
      String(c.code || '').toLowerCase() === key ||
      String(c.phone || '').replace(/[^\\d]/g, '') === key.replace(/[^\\d]/g, '') ||
      String(c.name || '').toLowerCase().includes(key));
    if (!cust) { showToast('❌ پیدا نشد', true); setStmtCustomer(null); setStmtData(null); return; }
    setStmtCustomer(cust);
    const myTrades = trades.filter((t: any) => t.customer_code === cust.code || t.buyer_code === cust.code || t.partner_code === cust.code);
    const myHawalas = hawalas.filter((h: any) => String(h.beneficiary_name || '').includes(cust.name) || String(h.beneficiary_phone || '').replace(/[^\\d]/g, '') === String(cust.phone || '').replace(/[^\\d]/g, '') || h.partner_code === cust.code);
    const myChecks = checks.filter((c2: any) => c2.partner_name === cust.name || c2.partner_code === cust.code);
    let myBoxTxs: any[] = []; let boxSummary: any = { given: {}, received: {}, txCount: 0 };
    try { myBoxTxs = await getBoxTxsByCounterparty(cust.code); boxSummary = await getBoxSummaryForPerson(cust.code); } catch (e) { console.log('box err:', e); }
    const pos: Record<string, any> = {};
    myTrades.forEach((t: any) => {
      const f = t.from_currency, to = t.to_currency, fq = Number(t.from_qty) || 0, tq = Number(t.to_qty) || 0;
      if (f) { if (!pos[f]) pos[f] = { bought: 0, sold: 0, net: 0 }; pos[f].sold += fq; pos[f].net -= fq; }
      if (to) { if (!pos[to]) pos[to] = { bought: 0, sold: 0, net: 0 }; pos[to].bought += tq; pos[to].net += tq; }
    });
    const totalProfit = myTrades.reduce((a: number, t: any) => a + (Number(t.profit) || 0), 0);
    const totalHawalaFees = myHawalas.reduce((a: number, h: any) => a + (Number(h.commission) || 0), 0);
    const boxGivenTotal = Object.values(boxSummary.given || {}).reduce((a: number, v: any) => a + Number(v || 0), 0);
    const boxReceivedTotal = Object.values(boxSummary.received || {}).reduce((a: number, v: any) => a + Number(v || 0), 0);
    setStmtData({
      trades: myTrades, hawalas: myHawalas, checks: myChecks,
      boxTxs: myBoxTxs, boxSummary,
      tradeCount: myTrades.length, hawalaCount: myHawalas.length,
      checkCount: myChecks.length, boxTxCount: myBoxTxs.length,
      positions: pos, totalProfit, totalHawalaFees,
      boxGivenTotal, boxReceivedTotal,
    });
  };'''
c = c[:start] + new_fn + c[end:]
open('ExchangeScreen.tsx', 'w').write(c)
print("  ✅ buildStatement بازنویسی شد")
PYEOF
fi

# ═══ ۳. اطمینان از UI صندوق‌ها ═══
echo ""
echo "▶ ۳. بررسی UI صندوق‌ها..."
if grep -q "BOX_TXS_SECTION\|📦 صندوق‌ها (" ExchangeScreen.tsx; then
  echo "  ✅ UI صندوق‌ها هست"
else
  echo "  🔧 اضافه می‌کنم..."
  python3 << 'PYEOF'
c = open('ExchangeScreen.tsx').read()
# پیدا کردن خلاصه نهایی
marker = "📊 خلاصه نهایی با {stmtCustomer.name}"
if marker not in c:
    print("  ⚠️ خلاصه نهایی پیدا نشد")
    exit(0)
idx = c.find(marker)
view_start = c.rfind('<View', 0, idx)
section = '''{/* BOX_TXS_SECTION */}
                {stmtData.boxTxCount > 0 && (
                  <>
                    <Text style={[s.secT, { marginTop: 16 }]}>📦 صندوق‌ها ({stmtData.boxTxCount})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <View>
                        <View style={s.tblHeader}>
                          <Text style={[s.th, { width: 36 }]}>#</Text>
                          <Text style={[s.th, { width: 85 }]}>تاریخ</Text>
                          <Text style={[s.th, { width: 90 }]}>سند</Text>
                          <Text style={[s.th, { width: 110 }]}>صندوق</Text>
                          <Text style={[s.th, { width: 110 }]}>نوع</Text>
                          <Text style={[s.th, { width: 160 }]}>طرف حساب</Text>
                          <Text style={[s.th, { width: 100 }]}>ارز</Text>
                          <Text style={[s.th, { width: 100 }]}>ورودی</Text>
                          <Text style={[s.th, { width: 100 }]}>خروجی</Text>
                          <Text style={[s.th, { width: 180 }]}>شرح</Text>
                        </View>
                        {stmtData.boxTxs.map((b: any, i: number) => {
                          const box = boxes.find((x: any) => (x.id || x.local_id) === b.box_id);
                          return (
                            <View key={b.id || b.local_id || i} style={[s.tblRow, i % 2 === 0 && { backgroundColor: '#0a1628' }]}>
                              <Text style={[s.td, { width: 36, color: '#d4af37', fontWeight: 'bold' }]}>{i + 1}</Text>
                              <Text style={[s.td, { width: 85, color: '#94a3b8', fontSize: 10 }]}>{b.date || '—'}</Text>
                              <Text style={[s.td, { width: 90, color: '#7c3aed', fontWeight: 'bold', fontSize: 10 }]}>{b.code || '—'}</Text>
                              <Text style={[s.td, { width: 110, color: '#e2e8f0', fontSize: 10 }]}>{box?.name || b.box_code || '—'}</Text>
                              <Text style={[s.td, { width: 110, color: '#60a5fa', fontSize: 10 }]}>{b.type === 'transfer_in' ? '📥 ورودی' : b.type === 'transfer_out' ? '📤 خروجی' : b.type === 'trade_in' ? '🛒 از معامله' : b.type === 'trade_out' ? '💸 به معامله' : (b.type || '—')}</Text>
                              <Text style={[s.td, { width: 160, color: '#00ff88', fontSize: 10 }]}>{b.counterparty_code ? '🆔 ' + b.counterparty_code : '—'}</Text>
                              <Text style={[s.td, { width: 100, color: '#fbbf24', fontSize: 11, fontWeight: 'bold' }]}>{b.currency || '—'}</Text>
                              <Text style={[s.td, { width: 100, color: '#00ff88', fontWeight: 'bold', fontSize: 11 }]}>{b.in ? fmt(b.in, 0) : '—'}</Text>
                              <Text style={[s.td, { width: 100, color: '#ff3355', fontWeight: 'bold', fontSize: 11 }]}>{b.out ? fmt(b.out, 0) : '—'}</Text>
                              <Text style={[s.td, { width: 180, color: '#cbd5e1', fontSize: 10 }]} numberOfLines={2}>{b.description || '—'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#0f2438', borderRadius: 8 }}>
                      <Text style={{ color: '#d4af37', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 }}>💰 خلاصه ارزی صندوق</Text>
                      {Object.entries(stmtData.boxSummary?.given || {}).map(([cur, v]: any) => (
                        <Text key={'g'+cur} style={{ color: '#ff3355', fontSize: 11, textAlign: 'right' }}>📤 دادیم: {fmt(v, 0)} {cur}</Text>
                      ))}
                      {Object.entries(stmtData.boxSummary?.received || {}).map(([cur, v]: any) => (
                        <Text key={'r'+cur} style={{ color: '#00ff88', fontSize: 11, textAlign: 'right' }}>📥 گرفتیم: {fmt(v, 0)} {cur}</Text>
                      ))}
                    </View>
                  </>
                )}
                '''
c = c[:view_start] + section + c[view_start:]
open('ExchangeScreen.tsx', 'w').write(c)
print("  ✅ UI صندوق‌ها اضافه شد")
PYEOF
fi

# ═══ ۴. پاک کردن build قدیمی و fresh build ═══
echo ""
echo "▶ ۴. پاک کردن build قدیمی..."
rm -rf docs .expo node_modules/.cache
echo "  ✅ پاک شد"

echo ""
echo "▶ ۵. بیلد fresh..."
npx expo export --platform web --output-dir docs 2>&1 | tail -8

if [ ! -f "docs/index.html" ]; then
  echo "  ❌ بیلد موفق نشد"
  exit 1
fi
echo "  ✅ بیلد موفق"

# ═══ ۶. تنظیم مسیر GitHub Pages ═══
echo ""
echo "▶ ۶. تنظیم مسیر..."
sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
echo "  ✅"

# ═══ ۷. حذف docs از gitignore اگر هست ═══
if [ -f .gitignore ]; then
  if grep -qE "^docs/?$" .gitignore; then
    sed -i '/^docs\/\?$/d' .gitignore
    echo "  ✅ docs از gitignore حذف شد"
  fi
fi

# ═══ ۸. بررسی فایل بیلد ═══
echo ""
echo "▶ ۷. فایل بیلد جدید:"
NEW_JS=$(ls -t docs/_expo/static/js/web/index-*.js 2>/dev/null | head -1)
if [ -f "$NEW_JS" ]; then
  SIZE=$(stat -c%s "$NEW_JS")
  echo "  📦 $NEW_JS"
  echo "  📏 $SIZE bytes"
else
  echo "  ❌ فایل JS پیدا نشد"
fi

# ═══ ۹. کامیت و پوش ═══
echo ""
echo "▶ ۸. کامیت و پوش..."
git add -A
git commit -m "print statement: comprehensive (trades + hawalas + checks + boxes)" 2>&1 | tail -3
git push -f 2>&1 | tail -5

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تمام شد"
echo "  ⏱️ صبر کن ۲ دقیقه"
echo "  🌐 در حالت Incognito باز کن"
echo "  🔄 Ctrl+Shift+R"
echo "═══════════════════════════════════════════════════"
