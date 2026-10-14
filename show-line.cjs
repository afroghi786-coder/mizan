const fs = require('fs');
const lines = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);

console.log('═══ خطوط ۴۴۰ تا ۴۶۰ ═══\n');
for (let i = 439; i < 460 && i < lines.length; i++) {
  const marker = (i + 1) === 449 ? ' ❌' : '';
  console.log((i + 1) + ': ' + lines[i] + marker);
}

console.log('\n═══ خطوط ۲۰ تا ۴۰ (import ها) ═══\n');
for (let i = 19; i < 40 && i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}