const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');

console.log('=== searchAllInvoices (1751..1798) ===');
console.log(lo.slice(1750, 1798).map((l, i) => (1751 + i) + ': ' + l).join('\n'));

console.log('\n=== getPurchasesGrouped (1871..1915) ===');
console.log(lo.slice(1870, 1915).map((l, i) => (1871 + i) + ': ' + l).join('\n'));

console.log('\n=== App.tsx openEdit (2860..2905) ===');
console.log(ap.slice(2859, 2905).map((l, i) => (2860 + i) + ': ' + l).join('\n'));