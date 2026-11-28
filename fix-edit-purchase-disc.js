const fs = require('fs');

// 1) lib.offline.ts: انتقال discount و invoice_discount در fallback گروهی getInvoiceDetail
{
  const f = 'lib.offline.ts';
  if (!fs.readdirSync('.').some(x => x.startsWith(f + '.bak-eddisc-'))) {
    fs.copyFileSync(f, f + '.bak-eddisc-' + Date.now());
  }
  let s = fs.readFileSync(f, 'utf8');
  const target = `        price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
        payment: idx === 0 ? (Number(g.paid) || 0) : 0,`;
  const repl = `        price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
        discount: Number(it.discount) || 0,
        discount_enabled: it.discount_enabled ? 1 : (it.discountEnabled ? 1 : 0),
        discount_base_unit: Number(it.discount_base_unit) || 0,
        discount_pack_unit: Number(it.discount_pack_unit) || 0,
        invoice_discount: Number(it.invoice_discount ?? it.invoiceDiscount ?? g.invoice_discount ?? g.invoiceDiscount) || 0,
        payment: idx === 0 ? (Number(g.paid) || 0) : 0,`;
  if (s.includes(target) && !s.includes('invoice_discount: Number(it.invoice_discount')) {
    s = s.replace(target, repl);
    fs.writeFileSync(f, s, 'utf8');
  }
}

// 2) App.tsx: تضمین مقداردهی invoiceDiscount در setEditing داخل openEdit
{
  const f = 'App.tsx';
  if (!fs.readdirSync('.').some(x => x.startsWith(f + '.bak-eddisc-'))) {
    fs.copyFileSync(f, f + '.bak-eddisc-' + Date.now());
  }
  let s = fs.readFileSync(f, 'utf8');
  const marker = '        discountEnabled: r.discount_enabled ? true : false,';
  const invTarget = '      setEditing({';
  const invRepl = '      const __firstInvDisc = rows.reduce((m: number, x: any) => Math.max(m, Number(x && (x.invoice_discount ?? x.invoiceDiscount)) || 0), 0);\n      setEditing({';
  const edLine = '        invoiceDiscount: Number(invObj && (invObj.invoiceDiscount ?? invObj.invoice_discount)) || __firstInvDisc || 0,';
  if (s.includes(marker) && s.includes(invTarget) && !s.includes('__firstInvDisc')) {
    s = s.replace(invTarget, invRepl);
    if (s.includes('invoiceDiscount:')) {
      s = s.replace(/invoiceDiscount:[^\n]+\n/, edLine + '\n');
    }
    fs.writeFileSync(f, s, 'utf8');
  }
}

console.log('Applied edit discount fix safely.');