const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
console.log('--- updatePurchase tail (4921..4955) ---');
console.log(lo.slice(4920, 4955).map((l, i) => (4921 + i) + ': ' + l.trim()).join('\n'));
const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
const ld = ap.findIndex((l, i) => i > 7600 && /const load\s*=|async function load/.test(l));
if (ld >= 0) {
  console.log('--- App.tsx load @ ' + (ld + 1) + ' ---');
  console.log(ap.slice(ld, Math.min(ap.length, ld + 30)).map((l, i) => (ld + 1 + i) + ': ' + l.trim()).join('\n'));
}