const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');

const grpIdx = lo.findIndex((l) => l.includes('function _groupPurchaseRows'));
console.log('=== _groupPurchaseRows ===');
if (grpIdx >= 0) {
  console.log(lo.slice(grpIdx, grpIdx + 55).map((l, i) => (grpIdx + 1 + i) + ': ' + l).join('\n'));
}

console.log('\n=== App.tsx setEditing ===');
ap.forEach((l, i) => {
  if (l.includes('setEditing(')) {
    const from = Math.max(0, i - 5);
    const to = Math.min(ap.length, i + 25);
    console.log(ap.slice(from, to).map((x, j) => (from + 1 + j) + ': ' + x).join('\n'));
  }
});