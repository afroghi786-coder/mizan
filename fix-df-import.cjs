const fs = require('fs');

console.log('🔍 جستجوی توابع...\n');

const files = ['lib.ts', 'lib.offline.ts', 'lib.aux.ts', 'lib.date.ts'];
const targets = ['parseDateAny', 'toStorageDateFull', 'getCalType'];
const found = {};

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const c = fs.readFileSync(f, 'utf8');
  targets.forEach(t => {
    if (c.includes('export function ' + t) || c.includes('export const ' + t) || c.includes('export async function ' + t)) {
      if (!found[t]) found[t] = f;
    }
  });
});

// اگه توی همه فایل‌ها نبود، دنبال همه .ts/.tsx بگرد
if (Object.keys(found).length < targets.length) {
  const allFiles = fs.readdirSync('.').filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.startsWith('backup'));
  allFiles.forEach(f => {
    if (found[targets[0]] === f) return;
    try {
      const c = fs.readFileSync(f, 'utf8');
      targets.forEach(t => {
        if (!found[t] && (c.includes('export function ' + t) || c.includes('export const ' + t) || c.includes('export async function ' + t))) {
          found[t] = f;
        }
      });
    } catch {}
  });
}

console.log('═══ نتیجه جستجو ═══');
targets.forEach(t => {
  console.log((found[t] ? '✅' : '❌') + ' ' + t + ' → ' + (found[t] || 'پیدا نشد'));
});

// ═══════════════════════════════════════════
// fix lib.datefield.tsx
// ═══════════════════════════════════════════
if (Object.keys(found).length > 0) {
  let df = fs.readFileSync('lib.datefield.tsx', 'utf8');
  const orig = df;
  const crlf = df.includes('\r\n');
  if (crlf) df = df.replace(/\r\n/g, '\n');
  
  // پیدا کردن import فعلی lib.offline
  const oldImport = `import { parseDateAny, toStorageDateFull, getCalType } from './lib.offline';`;
  
  // گروه‌بندی توابع بر اساس فایل
  const byFile = {};
  targets.forEach(t => {
    const f = found[t];
    if (f) {
      if (!byFile[f]) byFile[f] = [];
      byFile[f].push(t);
    }
  });
  
  const newImports = Object.entries(byFile)
    .map(([f, fns]) => `import { ${fns.join(', ')} } from './${f.replace('.ts', '').replace('.tsx', '')}';`)
    .join('\n');
  
  if (df.includes(oldImport)) {
    df = df.replace(oldImport, newImports);
    console.log('\n✅ import های lib.datefield.tsx اصلاح شد:');
    console.log(newImports);
  } else {
    console.log('\n⚠️ import قدیمی پیدا نشد');
  }
  
  if (crlf) df = df.replace(/\n/g, '\r\n');
  if (df !== orig) {
    fs.writeFileSync('lib.datefield.tsx', df, 'utf8');
    console.log('💾 lib.datefield.tsx ذخیره شد');
  }
}

// ═══════════════════════════════════════════
// چک App.tsx — همون توابع رو از کجا import می‌کنه
// ═══════════════════════════════════════════
console.log('\n═══ App.tsx — import های این توابع ═══');
const app = fs.readFileSync('App.tsx', 'utf8');
targets.forEach(t => {
  const regex = new RegExp('import\\s*\\{[^}]*\\b' + t + '\\b[^}]*\\}\\s*from\\s*[\'"]([^\'"]+)[\'"]', 'g');
  let m;
  while ((m = regex.exec(app)) !== null) {
    console.log('  ' + t + ' from ' + m[1]);
  }
});

console.log('\nالان بزن:');
console.log('  npx expo start --clear');