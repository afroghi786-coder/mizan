const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx (7881..7925) ===');
out.push(...ap.slice(7880, 7925).map((l, i) => (7881 + i) + ': ' + l.trim().slice(0, 100)));

out.push('\n=== lib.offline.ts updatePurchase tail (4756..4805) ===');
out.push(...lo.slice(4755, 4805).map((l, i) => (4756 + i) + ': ' + l.trim().slice(0, 100)));

console.log(out.join('\n').split('\n').slice(0, 65).join('\n'));