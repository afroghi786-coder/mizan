const fs = require('fs');
const s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const lines = s.split(/\r?\n/);

console.log('═══════════════════════════════════════════');
console.log('📍 خطوطی که boxes.map دارن:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('boxes.map')) {
    console.log('خط ' + (i+1) + ': ' + l.trim().substring(0, 120));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 خطوطی که sub === \'boxes\' دارن:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes("sub === 'boxes'")) {
    console.log('خط ' + (i+1) + ': ' + l.trim().substring(0, 120));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 خطوطی که boxDeepSearch دارن:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('boxDeepSearch')) {
    console.log('خط ' + (i+1) + ': ' + l.trim().substring(0, 120));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 خطوطی که setSub دارن:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('setSub')) {
    console.log('خط ' + (i+1) + ': ' + l.trim().substring(0, 120));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 خطوطی که 💰 یا 📦 یا box دارن (UI صندوق):');
console.log('═══════════════════════════════════════════');
let found = 0;
lines.forEach((l, i) => {
  if (found < 20 && (l.includes('📦') || (l.includes('box') && l.includes('style')))) {
    console.log('خط ' + (i+1) + ': ' + l.trim().substring(0, 120));
    found++;
  }
});