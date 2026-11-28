const fs = require('fs');

const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
const dIdx = lo.findIndex((l) => l.includes('getInvoiceDetail'));
if (dIdx >= 0) {
  console.log('=== getInvoiceDetail @ ' + (dIdx + 1) + ' ===');
  console.log(lo.slice(dIdx, Math.min(lo.length, dIdx + 55)).map((l, i) => (dIdx + 1 + i) + ': ' + l.trim()).join('\n'));
}

const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
console.log('\n=== App.tsx list render around searchAllInvoices (7650..7705) ===');
console.log(ap.slice(7649, 7705).map((l, i) => (7650 + i) + ': ' + l.trim()).join('\n'));