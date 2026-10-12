const fs = require('fs');
const s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lines = s.split('\n');

console.log('═══════════════════════════════════════════');
console.log('📍 submitHawala (خط ۵۴۲)');
console.log('═══════════════════════════════════════════');
for (let i = 541; i < 585 && i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 submitDirect (خط ۵۸۴)');
console.log('═══════════════════════════════════════════');
for (let i = 583; i < 625 && i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}