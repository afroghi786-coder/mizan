const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx openEdit (7702..7750) ===');
out.push(...ap.slice(7701, 7750).map((l, i) => (7702 + i) + ': ' + l.trim().slice(0, 100)));

out.push('\n=== lib.offline.ts getPurchasesGrouped ===');
const gIdx = lo.findIndex((l) => l.includes('function getPurchasesGrouped') || l.includes('async function getPurchasesGrouped') || l.includes('getPurchasesGrouped('));
if (gIdx >= 0) {
  for (let k = Math.max(0, gIdx - 1); k < Math.min(lo.length, gIdx + 45); k++) {
    out.push('LO ' + (k + 1) + ': ' + lo[k].trim().slice(0, 100));
  }
}

console.log(out.join('\n').split('\n').slice(0, 68).join('\n'));