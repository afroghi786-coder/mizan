const fs = require('fs');
const lines = fs.readFileSync('App.tsx', 'utf8').split('\n');

let fixed = false;
for (let i = 0; i < lines.length; i++) {
  // اگه این خط دو تا key: 'exchange' داره
  const idx1 = lines[i].indexOf("{ key: 'exchange'");
  const idx2 = lines[i].indexOf("{ key: 'exchange'", idx1 + 1);
  if (idx1 >= 0 && idx2 >= 0) {
    console.log('خط ' + (i+1) + ' قبل:');
    console.log(lines[i]);
    // فقط تا قبل از دومی نگه دار
    lines[i] = lines[i].substring(0, idx2).trimEnd();
    if (lines[i].endsWith(',')) {
      // ok
    } else {
      lines[i] = lines[i] + ',';
    }
    console.log('');
    console.log('خط ' + (i+1) + ' بعد:');
    console.log(lines[i]);
    fixed = true;
  }
}

if (fixed) {
  fs.writeFileSync('App.tsx', lines.join('\n'), 'utf8');
  console.log('');
  console.log('✅ ذخیره شد');
} else {
  console.log('ℹ️ تب تکراری پیدا نشد');
}