const fs = require('fs');

const lo = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);

function showAround(lines, predicate, radius, title) {
  console.log('\n================ ' + title + ' ================');
  lines.forEach((l, idx) => {
    if (predicate(l)) {
      const from = Math.max(0, idx - radius);
      const to = Math.min(lines.length, idx + radius + 1);
      console.log(`\n--- خط ${idx + 1} ---`);
      console.log(lines.slice(from, to).map((x, i) => (from + 1 + i) + ': ' + x).join('\n'));
    }
  });
}

showAround(lo, (l) => l.includes('function searchAllInvoices'), 35, 'lib.offline searchAllInvoices');
showAround(ap, (l) => l.includes('accountHolder') && l.includes('editing'), 12, 'App.tsx accountHolder in editing');
showAround(ap, (l) => l.includes('openEdit') || l.includes('setEditing('), 15, 'App.tsx openEdit / setEditing');