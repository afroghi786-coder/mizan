const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const idx = lo.findIndex((l) => l.includes('searchAllInvoices'));
if (idx >= 0) {
  for (let k = Math.max(0, idx - 2); k < Math.min(lo.length, idx + 65); k++) {
    console.log((k + 1) + ': ' + lo[k].trim().slice(0, 100));
  }
} else {
  console.log('searchAllInvoices not found');
}