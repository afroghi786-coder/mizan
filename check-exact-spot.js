const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);

console.log('--- openEdit rows (7715..7755) ---');
console.log(ap.slice(7714, 7755).map((l, i) => (7715 + i) + ': ' + l.trim()).join('\n'));

console.log('--- edit row discount UI (8095..8258) ---');
for (let i = 8094; i < 8258; i++) {
  if (/discount|Discount|تخفیف|updRow|editRows/i.test(ap[i])) {
    console.log((i + 1) + ': ' + ap[i].trim());
  }
}

const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
const gIdx = lo.findIndex(l => l.includes('function _groupPurchaseRows'));
if (gIdx >= 0) {
  console.log('--- _groupPurchaseRows @ ' + (gIdx + 1) + ' ---');
  console.log(lo.slice(gIdx, Math.min(lo.length, gIdx + 40)).map((l, i) => (gIdx + 1 + i) + ': ' + l.trim()).join('\n'));
}