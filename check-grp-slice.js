const fs = require('fs');
const lines = fs.readFileSync('lib.offline.ts', 'utf8').split(/\r?\n/);
console.log(lines.slice(4940, 5020).map((l, i) => (4941 + i) + ': ' + l).join('\n'));