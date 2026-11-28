const fs = require('fs');

const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
console.log('=== App.tsx save (7845..7910) ===');
console.log(ap.slice(7844, 7910).map((l, i) => (7845 + i) + ': ' + l).join('\n'));

const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
console.log('\n=== updatePurchase (4935..4995) ===');
console.log(lo.slice(4934, 4995).map((l, i) => (4935 + i) + ': ' + l).join('\n'));

const us = lo.findIndex((l) => l.includes('export async function updateSale'));
if (us >= 0) {
  console.log('\n=== updateSale head ===');
  console.log(lo.slice(us, us + 40).map((l, i) => (us + 1 + i) + ': ' + l).join('\n'));
}