const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx around const load = ===');
const lIdx = ap.findIndex((l) => l.includes('const load =') || l.includes('async function load'));
if (lIdx >= 0) {
  for (let k = lIdx; k < Math.min(ap.length, lIdx + 42); k++) {
    out.push((k + 1) + ': ' + ap[k].trim().slice(0, 100));
  }
}

out.push('\n=== lib.offline.ts _groupPurchaseRows / purchases_grouped ===');
ap.forEach((l, i) => {
  if ((l.includes('_groupPurchaseRows') || l.includes('purchases_grouped') || l.includes('getInvoiceDetail')) && i > 7500 && i < 8200) {
    out.push('App ' + (i + 1) + ': ' + l.trim().slice(0, 100));
  }
});
lo.forEach((l, i) => {
  if (l.includes('_groupPurchaseRows') || l.includes('purchases_grouped')) {
    for (let k = Math.max(0, i - 2); k < Math.min(lo.length, i + 25); k++) {
      out.push('LO ' + (k + 1) + ': ' + lo[k].trim().slice(0, 100));
    }
    out.push('---');
  }
});

console.log(out.join('\n').split('\n').slice(0, 68).join('\n'));