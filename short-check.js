const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
const gIdx = lo.findIndex((l) => l.includes('function _groupPurchaseRows'));
if (gIdx >= 0) {
  out.push('=== _groupPurchaseRows ===');
  out.push(...lo.slice(gIdx, gIdx + 35).map((l, i) => (gIdx + 1 + i) + ': ' + l.trim().slice(0, 100)));
}

const eIdx = ap.findIndex((l) => l.includes('setEditing(') && l.includes('invoice'));
if (eIdx >= 0) {
  out.push('\n=== App.tsx edit modal ===');
  out.push(...ap.slice(Math.max(0, eIdx - 3), eIdx + 20).map((l, i) => (Math.max(1, eIdx - 2) + i) + ': ' + l.trim().slice(0, 100)));
}

const txt = out.join('\n');
fs.writeFileSync('out.txt', txt, 'utf8');
console.log(txt.split('\n').slice(0, 35).join('\n'));