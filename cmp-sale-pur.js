const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
const sIdx = lo.findIndex(l => l.includes('export async function updateSale'));
if (sIdx >= 0) {
  console.log('=== updateSale @ ' + (sIdx + 1) + ' ===');
  console.log(lo.slice(sIdx, Math.min(lo.length, sIdx + 55)).map((l, i) => (sIdx + 1 + i) + ': ' + l.trim()).join('\n'));
}