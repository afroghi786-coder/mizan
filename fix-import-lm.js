const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-importlm-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

if (s.includes("from './lib.events'")) {
  console.log('ℹ️ import از قبل هست');
} else {
  const lines = s.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].trim().startsWith('import ')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import { emitHawalaUpdate } from './lib.events';");
    s = lines.join('\n');
    console.log('✅ import به LiveMarketScreen اضافه شد (خط ' + (lastImport + 2) + ')');
  } else {
    console.log('❌ هیچ import پیدا نشد');
    process.exit(1);
  }
}

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');