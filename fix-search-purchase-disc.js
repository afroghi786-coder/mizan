const fs = require('fs');
const file = 'lib.offline.ts';
if (!fs.readdirSync('.').some(f => f.startsWith(file + '.bak-searchp-'))) {
  fs.copyFileSync(file, file + '.bak-searchp-' + Date.now());
}
let s = fs.readFileSync(file, 'utf8');

const target1 = `  const [sales, purchases, salesRowsRaw] = await Promise.all([
    getSalesGrouped(),
    getPurchasesGrouped(),
    getLocal<any[]>('sales'),
  ]);`;

const repl1 = `  const [sales, purchases, salesRowsRaw, purchaseRowsRaw] = await Promise.all([
    getSalesGrouped(),
    getPurchasesGrouped(),
    getLocal<any[]>('sales'),
    getLocal<any[]>('purchases'),
  ]);`;

const target2 = `  // مجموع تخفیف ردیفی هر فاکتور (از ردیف‌های محلی)
  const __rowDiscByInv: Record<string, number> = {};
  for (const r of (salesRowsRaw || [])) {
    const inv = String(r && r.invoice_number || '').trim();
    if (!inv) continue;
    const qty = Number(r.quantity) || 0;
    let per = Number(r.discount) || 0;
    if (!per) per = Number(r.discount_base_unit) || 0;
    const d = Math.abs(qty * per);
    if (d) __rowDiscByInv[inv] = (__rowDiscByInv[inv] || 0) + d;
  }`;

const repl2 = `  // مجموع تخفیف ردیفی هر فاکتور (از ردیف‌های محلی فروش و خرید)
  const __rowDiscByInv: Record<string, number> = {};
  for (const r of [...(salesRowsRaw || []), ...(purchaseRowsRaw || [])]) {
    const inv = String(r && r.invoice_number || '').trim();
    if (!inv) continue;
    const qty = Number(r.quantity) || 0;
    let per = Number(r.discount) || 0;
    if (!per) per = Number(r.discount_base_unit) || 0;
    const d = Math.abs(qty * per);
    if (d) __rowDiscByInv[inv] = (__rowDiscByInv[inv] || 0) + d;
  }`;

if (!s.includes(target1) || !s.includes(target2)) {
  console.error('Target block not found in lib.offline.ts');
  process.exit(1);
}
s = s.replace(target1, repl1).replace(target2, repl2);
fs.writeFileSync(file, s, 'utf8');
console.log('Updated searchAllInvoices for purchase discounts.');