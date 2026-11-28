const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== __invDisc in App.tsx ===');
ap.forEach((l, i) => {
  if (l.includes('__invDisc')) {
    const s = Math.max(0, i - 3);
    const e = Math.min(ap.length, i + 4);
    for (let k = s; k < e; k++) {
      out.push((k + 1) + ': ' + ap[k].trim().slice(0, 100));
    }
    out.push('---');
  }
});

out.push('=== updateInvoiceInQueue in lib.offline.ts ===');
const uIdx = lo.findIndex((l) => l.includes('function updateInvoiceInQueue') || l.includes('export async function updateInvoiceInQueue'));
if (uIdx >= 0) {
  out.push(...lo.slice(uIdx, uIdx + 45).map((l, i) => (uIdx + 1 + i) + ': ' + l.trim().slice(0, 100)));
}

console.log(out.join('\n').split('\n').slice(0, 65).join('\n'));