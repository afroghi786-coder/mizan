const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx around updateInvoiceInQueue ===');
ap.forEach((l, i) => {
  if (l.includes('updateInvoiceInQueue(') && i > 7500) {
    for (let k = Math.max(0, i - 18); k < Math.min(ap.length, i + 25); k++) {
      out.push((k + 1) + ': ' + ap[k].trim().slice(0, 100));
    }
  }
});

out.push('\n=== lib.offline.ts updatePurchase ===');
const upIdx = lo.findIndex((l) => l.includes('updatePurchase('));
if (upIdx >= 0) {
  for (let k = upIdx; k < Math.min(lo.length, upIdx + 45); k++) {
    out.push((k + 1) + ': ' + lo[k].trim().slice(0, 100));
  }
}

console.log(out.join('\n').split('\n').slice(0, 65).join('\n'));