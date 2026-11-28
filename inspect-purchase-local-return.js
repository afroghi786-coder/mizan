const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

for (let k = 1934; k < Math.min(lo.length, 1972); k++) {
  console.log((k + 1) + ': ' + lo[k].trim().slice(0, 105));
}