const fs = require('fs');
let s = fs.readFileSync('ExchangeBell.tsx', 'utf8');
const orig = s;

// جایگزینی position
s = s.replace("position: 'absolute', top: 80, left: 14", "position: 'fixed', bottom: 90, left: 14");

if (s !== orig) {
  fs.writeFileSync('ExchangeBell.tsx', s, 'utf8');
  console.log('✅ position به fixed تغییر یافت');
} else {
  console.log('⚠️ الگو پیدا نشد — چاپ خطوط position:');
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('position:')) {
      console.log('خط ' + (i+1) + ': ' + lines[i].trim());
    }
  }
}