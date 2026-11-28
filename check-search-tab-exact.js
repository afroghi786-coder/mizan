const fs = require('fs');
const ap = fs.readFileSync('App.tsx', 'utf8').replace(/\r/g, '').split('\n');

const out = [];
out.push('=== App.tsx (7650..7702) ===');
out.push(...ap.slice(7649, 7702).map((l, i) => (7650 + i) + ': ' + l.trim().slice(0, 100)));

out.push('\n=== App.tsx (7938..7980) ===');
out.push(...ap.slice(7937, 7980).map((l, i) => (7938 + i) + ': ' + l.trim().slice(0, 100)));

console.log(out.join('\n').split('\n').slice(0, 68).join('\n'));