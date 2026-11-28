const fs = require('fs');
const lo = fs.readFileSync('lib.offline.ts', 'utf8').replace(/\r/g, '').split('\n');

for (let k = 1878; k < Math.min(lo.length, 1935); k++) {
  console.log((k + 1) + ': ' + lo[k].trim().slice(0, 105));
}