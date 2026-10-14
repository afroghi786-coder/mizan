const fs = require('fs');

console.log('🔧 fix App.tsx imports\n');

let app = fs.readFileSync('App.tsx', 'utf8');
const orig = app;
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// پیدا کردن import هایی که این سه تابع رو از lib.offline می‌گیرن
const fixes = [];

// روش ۱: import { ...parseDateAny... } from './lib.offline';
const patterns = [
  { fn: 'parseDateAny', from: "'./lib.offline'", to: "'./lib'" },
  { fn: 'toStorageDateFull', from: "'./lib.offline'", to: "'./lib'" },
  { fn: 'getCalType', from: "'./lib.offline'", to: "'./lib'" },
];

// به جای جدا جدا، کل import رو عوض کن اگه شامل این توابع بود
app = app.replace(
  /import\s*\{([^}]*)\}\s*from\s*['"]\.\/lib\.offline['"]/g,
  (match, imports) => {
    const items = imports.split(',').map(x => x.trim()).filter(Boolean);
    const targets = ['parseDateAny', 'toStorageDateFull', 'getCalType'];
    const toMove = items.filter(i => targets.includes(i));
    const toKeep = items.filter(i => !targets.includes(i));
    
    if (toMove.length === 0) return match; // چیزی برای انتقال نیست
    
    console.log('📦 انتقال از lib.offline به lib: ' + toMove.join(', '));
    fixes.push(...toMove);
    
    const lines = [];
    if (toKeep.length > 0) {
      lines.push(`import { ${toKeep.join(', ')} } from './lib.offline';`);
    }
    lines.push(`import { ${toMove.join(', ')} } from './lib';`);
    return lines.join('\n');
  }
);

if (crlf) app = app.replace(/\n/g, '\r\n');

if (app !== orig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('\n✅ App.tsx ذخیره شد');
  console.log('📊 مجموع: ' + fixes.length + ' تابع منتقل شد');
} else {
  console.log('\nℹ️ تغییری نکرد — شاید قبلاً fix شده');
}

// چک کن کدوم فایل‌های دیگه هم این مشکل رو دارن
console.log('\n═══ چک فایل‌های دیگه ═══');
const files = fs.readdirSync('.').filter(f => 
  (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.startsWith('backup') && f !== 'App.tsx'
);

let fixedCount = 0;
files.forEach(f => {
  try {
    let c = fs.readFileSync(f, 'utf8');
    const cOrig = c;
    const ccrlf = c.includes('\r\n');
    if (ccrlf) c = c.replace(/\r\n/g, '\n');
    
    c = c.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\/lib\.offline['"]/g,
      (match, imports) => {
        const items = imports.split(',').map(x => x.trim()).filter(Boolean);
        const targets = ['parseDateAny', 'toStorageDateFull', 'getCalType'];
        const toMove = items.filter(i => targets.includes(i));
        const toKeep = items.filter(i => !targets.includes(i));
        
        if (toMove.length === 0) return match;
        
        const lines = [];
        if (toKeep.length > 0) {
          lines.push(`import { ${toKeep.join(', ')} } from './lib.offline';`);
        }
        lines.push(`import { ${toMove.join(', ')} } from './lib';`);
        return lines.join('\n');
      }
    );
    
    if (ccrlf) c = c.replace(/\n/g, '\r\n');
    if (c !== cOrig) {
      fs.writeFileSync(f, c, 'utf8');
      console.log('✅ ' + f);
      fixedCount++;
    }
  } catch {}
});

console.log('\n📊 فایل‌های اصلاح شده اضافی: ' + fixedCount);
console.log('\nالان بزن:');
console.log('  npx expo start --clear');