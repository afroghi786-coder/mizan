const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-import-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('ExchangeScreen.tsx', path.join(bdir, 'ExchangeScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// چک کن import هست یا نه
if (s.includes("from './lib.events'")) {
  console.log('ℹ️ import از قبل هست');
} else {
  const lines = s.split('\n');
  let lastImport = -1;
  // فقط ۴۰ خط اول (ناحیه imports)
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].trim().startsWith('import ')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import { onHawalaUpdate } from './lib.events';");
    s = lines.join('\n');
    console.log('✅ import به ExchangeScreen اضافه شد (خط ' + (lastImport + 2) + ')');
  } else {
    console.log('❌ هیچ import پیدا نشد');
    process.exit(1);
  }
}

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

// چک کن lib.events.ts هست
if (!fs.existsSync('lib.events.ts')) {
  console.log('❌ lib.events.ts وجود نداره!');
  const evt = `// lib.events.ts — Event bus سراسری (وب + موبایل)
const _listeners: Set<Function> = new Set();

export function emitHawalaUpdate(): void {
  _listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.log('event listener err:', e); }
  });
}

export function onHawalaUpdate(fn: Function): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
`;
  fs.writeFileSync('lib.events.ts', evt, 'utf8');
  console.log('✅ lib.events.ts ساخته شد');
} else {
  console.log('✅ lib.events.ts هست');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\ExchangeScreen.tsx" ExchangeScreen.tsx');