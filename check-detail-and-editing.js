const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx openEdit tail (7744..7775) ===');
out.push(...ap.slice(7743, 7775).map((l, i) => (7744 + i) + ': ' + l.trim().slice(0, 100)));

const gdIdx = lo.findIndex((l) => l.includes('function getInvoiceDetail') || l.includes('async function getInvoiceDetail'));
if (gdIdx >= 0) {
  out.push('\n=== getInvoiceDetail ===');
  out.push(...lo.slice(gdIdx, gdIdx + 45).map((l, i) => (gdIdx + 1 + i) + ': ' + l.trim().slice(0, 100)));
}

console.log(out.join('\n').split('\n').slice(0, 50).join('\n'));