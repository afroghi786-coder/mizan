const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);

console.log('=== updatePurchase tail (4935..4965) ===');
console.log(lo.slice(4934, 4965).map((l, i) => (4935 + i) + ': ' + l.trim()).join('\n'));

console.log('\n=== getPurchasesGrouped (1872..1920) ===');
console.log(lo.slice(1871, 1920).map((l, i) => (1872 + i) + ': ' + l.trim()).join('\n'));