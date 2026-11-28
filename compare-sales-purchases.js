const fs = require('fs');

const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
console.log('=== 1) lib.offline.ts lines 1750..1800 ===');
for (let i = 1749; i < Math.min(lo.length, 1800); i++) {
  console.log((i + 1) + ': ' + lo[i]);
}

console.log('\n=== 2) searchAllInvoices & sales vs purchases keys in lib.offline.ts ===');
for (let i = 1748; i < Math.min(lo.length, 1965); i++) {
  if (/invoiceDiscount|invoice_discount|rowDiscount|total|paid|items|_groupSalesRows|_groupPurchaseRows|getSalesGrouped|getPurchasesGrouped/.test(lo[i])) {
    console.log((i + 1) + ': ' + lo[i].trim());
  }
}

const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
console.log('\n=== 3) Search & Edit tab in App.tsx (sales vs purchases) ===');
for (let i = 0; i < ap.length; i++) {
  if (/searchAllInvoices|invoiceDiscount|rowDiscount|editPayable|openEdit|updateSale|updatePurchase/.test(ap[i])) {
    if (i > 7650 && i < 8350) {
      console.log((i + 1) + ': ' + ap[i].trim());
    }
  }
}