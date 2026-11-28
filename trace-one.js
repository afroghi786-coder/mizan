const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
const sIdx = ap.findIndex((l, i) => i > 7750 && /const save\s*=|async function save/.test(l));
if (sIdx >= 0) {
  console.log('--- App.tsx save @ ' + (sIdx + 1) + ' ---');
  console.log(ap.slice(sIdx, Math.min(ap.length, sIdx + 45)).map((l, i) => (sIdx + 1 + i) + ': ' + l.trim()).join('\n'));
}
const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
console.log('--- lib.offline.ts 1760..1786 ---');
console.log(lo.slice(1759, 1786).map((l, i) => (1760 + i) + ': ' + l.trim()).join('\n'));