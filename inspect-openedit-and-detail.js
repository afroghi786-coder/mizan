const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx openEdit tail (7750..7788) ===');
out.push(...ap.slice(7749, 7788).map((l, i) => (7750 + i) + ': ' + l.trim().slice(0, 100)));

out.push('\n=== lib.offline.ts getInvoiceDetail ===');
const dIdx = lo.findIndex((l) => l.includes('async function getInvoiceDetail') || l.includes('export async function getInvoiceDetail'));
if (dIdx >= 0) {
  for (let k = dIdx; k < Math.min(lo.length, dIdx + 32); k++) {
    out.push('LO ' + (k + 1) + ': ' + lo[k].trim().slice(0, 100));
  }
}

console.log(out.join('\n').split('\n').slice(0, 68).join('\n'));