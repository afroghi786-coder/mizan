const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const qIdx = lo.findIndex((l) => l.includes('function updateInvoiceInQueue') || l.includes('async function updateInvoiceInQueue'));
if (qIdx >= 0) {
  console.log('=== updateInvoiceInQueue ===');
  for (let k = qIdx; k < Math.min(lo.length, qIdx + 45); k++) {
    console.log((k + 1) + ': ' + lo[k].trim().slice(0, 105));
  }
}

console.log('\n=== around line 5256 ===');
for (let k = Math.max(0, 5240); k < Math.min(lo.length, 5270); k++) {
  console.log((k + 1) + ': ' + lo[k].trim().slice(0, 105));
}