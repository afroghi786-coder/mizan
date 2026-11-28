const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('--- searchAllInvoices ---');
lo.forEach((l, i) => {
  if (/searchAllInvoices|__applyDisc|__rowDiscByInv|getPurchasesGrouped/.test(l)) {
    out.push((i + 1) + ': ' + l.trim().slice(0, 120));
  }
});

out.push('\n--- App.tsx edit/save/holder ---');
ap.forEach((l, i) => {
  if (/openEdit|updatePurchase|updateInvoiceInQueue|accountHolder|holder|payerName|invoiceDiscount/.test(l)) {
    out.push((i + 1) + ': ' + l.trim().slice(0, 120));
  }
});

const text = out.join('\n');
fs.writeFileSync('diag-short.txt', text, 'utf8');
console.log('Lines:', out.length);
console.log(text.split('\n').slice(0, 45).join('\n'));