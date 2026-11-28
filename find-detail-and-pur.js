const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);

for (let i = 0; i < lo.length; i++) {
  if (/function getInvoiceDetail|export async function updatePurchase/.test(lo[i])) {
    console.log('=== @ ' + (i + 1) + ' : ' + lo[i].trim() + ' ===');
    console.log(lo.slice(i, Math.min(lo.length, i + 45)).map((l, k) => (i + 1 + k) + ': ' + l.trim()).join('\n'));
  }
}