const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx setList around 7895..7912 ===');
out.push(...ap.slice(7894, 7912).map((l, i) => (7895 + i) + ': ' + l.trim().slice(0, 110)));

out.push('\n=== lib.offline.ts setLocal purchases / purchases_grouped in updatePurchase ===');
const upIdx = lo.findIndex((l) => l.includes('export async function updatePurchase('));
if (upIdx >= 0) {
  for (let k = upIdx + 30; k < Math.min(lo.length, upIdx + 105); k++) {
    out.push('LO ' + (k + 1) + ': ' + lo[k].trim().slice(0, 110));
  }
}

console.log(out.join('\n').split('\n').slice(0, 68).join('\n'));