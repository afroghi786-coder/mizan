const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
console.log('=== App.tsx openEdit & editPayable (7699..7792) ===');
console.log(ap.slice(7698, 7792).map((l, i) => (7699 + i) + ': ' + l.trim()).join('\n'));