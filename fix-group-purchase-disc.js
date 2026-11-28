const fs = require('fs');
const file = 'lib.offline.ts';
if (!fs.readdirSync('.').some(f => f.startsWith(file + '.bak-gpdisc-'))) {
  fs.copyFileSync(file, file + '.bak-gpdisc-' + Date.now());
}
let s = fs.readFileSync(file, 'utf8');

const target = `        depositDate: r.deposit_date || '',
        shipping: r.shipping || '',
        total: 0, paid: 0, items: [],`;

const repl = `        depositDate: r.deposit_date || '',
        shipping: r.shipping || '',
        invoiceDiscount: 0, invoice_discount: 0,
        total: 0, paid: 0, items: [],`;

const target2 = `    if (!g.depositDate && r.deposit_date) g.depositDate = r.deposit_date;
    if (!g.shipping && r.shipping) g.shipping = r.shipping;`;

const repl2 = `    if (!g.depositDate && r.deposit_date) g.depositDate = r.deposit_date;
    if (!g.shipping && r.shipping) g.shipping = r.shipping;
    const _invD = Number(r.invoice_discount ?? r.invoiceDiscount) || 0;
    if (_invD > (Number(g.invoiceDiscount) || 0)) {
      g.invoiceDiscount = _invD;
      g.invoice_discount = _invD;
    }`;

if (!s.includes(target) || !s.includes(target2)) {
  console.error('Target block not found in _groupPurchaseRows');
  process.exit(1);
}
s = s.replace(target, repl).replace(target2, repl2);
fs.writeFileSync(file, s, 'utf8');
console.log('Added invoiceDiscount to _groupPurchaseRows safely.');