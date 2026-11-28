const fs = require('fs');

const file = 'lib.offline.ts';
let src = fs.readFileSync(file, 'utf8');

const marker = 'for (const _g of groupedFromPurchases) { if (_g && _g.invoiceDiscount === undefined) { const _raw = localPurchaseRows.find((r: any) => String(r.invoice_number || \'\') === String(_g.invoice || \'\')); if (_raw) _g.invoiceDiscount = Number(_raw.invoice_discount) || 0; } }';
if (src.includes(marker)) {
  src = src.replace(
    marker,
    marker + '\n      for (const _g of groupedFromPurchases) { if (_g) { const _raw = localPurchaseRows.find((r: any) => String(r.invoice_number || \'\') === String(_g.invoice || \'\')); const _d = Number(_raw && (_raw.invoice_discount ?? _raw.invoiceDiscount)) || Number(_g.invoiceDiscount) || 0; _g.invoiceDiscount = _d; _g.invoice_discount = _d; } }'
  );
  fs.writeFileSync(file, src, 'utf8');
  console.log('Updated getPurchasesGrouped invoiceDiscount sync.');
} else {
  console.log('Marker not found, checking file state.');
}