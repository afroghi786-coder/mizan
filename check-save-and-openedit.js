const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
const oeIdx = ap.findIndex((l) => l.includes('const openEdit') || l.includes('async function openEdit') || l.includes('function openEdit'));
if (oeIdx >= 0) {
  out.push('=== openEdit ===');
  out.push(...ap.slice(oeIdx, oeIdx + 45).map((l, i) => (oeIdx + 1 + i) + ': ' + l.trim().slice(0, 100)));
}

const svIdx = ap.findIndex((l) => l.includes('updatePurchase(') && l.includes('invoiceNumber'));
if (svIdx >= 0) {
  out.push('\n=== save around updatePurchase ===');
  out.push(...ap.slice(Math.max(0, svIdx - 12), svIdx + 20).map((l, i) => (Math.max(1, svIdx - 11) + i) + ': ' + l.trim().slice(0, 100)));
}

console.log(out.join('\n').split('\n').slice(0, 50).join('\n'));