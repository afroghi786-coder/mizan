const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => 
  (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.startsWith('backup')
);

console.log('═══════════════════════════════════════════');
console.log('🔍 جستجوی کلمات کلیدی آفلاین / آپلود');
console.log('═══════════════════════════════════════════');
console.log('');

const keywords = [
  'آفلاین', 'offline', 'Offline', 'OFFLINE',
  'آپلود', 'upload', 'Upload', 'UPLOAD',
  'محلی', 'local', 'Local', 'LOCAL',
  'sync', 'Sync', 'SYNC',
  'push_', 'Push', 'pending', 'Pending',
  'queue', 'Queue', 'outbox', 'Outbox',
  '__getMode', 'setMode', 'Mode',
];

const results = {};

files.forEach(f => {
  try {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    const found = [];
    
    lines.forEach((line, i) => {
      for (const kw of keywords) {
        if (line.includes(kw)) {
          found.push({
            line: i + 1,
            keyword: kw,
            text: line.trim().substring(0, 120)
          });
          break;
        }
      }
    });
    
    if (found.length > 0) {
      results[f] = found;
    }
  } catch (e) {}
});

// چاپ
Object.entries(results).forEach(([file, lines]) => {
  console.log('📄 ' + file + ' (' + lines.length + ' تطابق)');
  console.log('───────────────────────────────────────');
  lines.slice(0, 30).forEach(l => {
    console.log('   خط ' + l.line + ' [' + l.keyword + ']: ' + l.text);
  });
  if (lines.length > 30) console.log('   ... و ' + (lines.length - 30) + ' خط دیگه');
  console.log('');
});

console.log('═══════════════════════════════════════════');
console.log('✅ تمام — ' + Object.keys(results).length + ' فایل');
console.log('═══════════════════════════════════════════');