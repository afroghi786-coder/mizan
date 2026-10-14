const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════');
console.log('🔧 Fix Require Cycle — DateField');
console.log('═══════════════════════════════════════════\n');

const bdir = 'backup-before-cyclefix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));

// ═══════════════════════════════════════════
// ۱. پیدا کردن DateField توی App.tsx
// ═══════════════════════════════════════════
let app = fs.readFileSync('App.tsx', 'utf8');
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// پیدا کردن function DateField
const dateFieldRegex = /(export\s+)?function\s+DateField\s*\([^)]*\)\s*\{[\s\S]*?\n\}/;
const match = app.match(dateFieldRegex);

if (!match) {
  console.log('❌ DateField توی App.tsx پیدا نشد');
  process.exit(1);
}

const dateFieldCode = match[0];
const isExported = dateFieldCode.startsWith('export');
console.log('✅ DateField پیدا شد (' + (isExported ? 'exported' : 'not exported') + ')');

// ═══════════════════════════════════════════
// ۲. پیدا کردن import های موردنیاز DateField
// ═══════════════════════════════════════════
const neededImports = [];
const importLines = app.match(/^import .*$/gm) || [];
importLines.forEach(imp => {
  // فقط import هایی که شامل DateField یا DatePicker هستن
  if (imp.includes('DateTimePicker') ||
      imp.includes('Modal') ||
      imp.includes('useState') ||
      imp.includes('View') ||
      imp.includes('Text') ||
      imp.includes('TouchableOpacity') ||
      imp.includes('StyleSheet')) {
    neededImports.push(imp);
  }
});

console.log('📦 import های موردنیاز: ' + neededImports.length);

// ═══════════════════════════════════════════
// ۳. ساخت lib.datefield.tsx
// ═══════════════════════════════════════════
const dateFieldFile = `// lib.datefield.tsx — کامپوننت DateField (جدا شده برای حل circular dependency)
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
${neededImports.filter(i => !i.includes('useState') && !i.includes("'react'")).join('\n')}

${dateFieldCode.replace(/^export\s+/, 'export ')}

export default DateField;
`;

fs.writeFileSync('lib.datefield.tsx', dateFieldFile, 'utf8');
console.log('✅ lib.datefield.tsx ساخته شد');

// ═══════════════════════════════════════════
// ۴. حذف DateField از App.tsx
// ═══════════════════════════════════════════
app = app.replace(dateFieldRegex, '// DateField به lib.datefield.tsx منتقل شد');
console.log('✅ DateField از App.tsx حذف شد');

// ═══════════════════════════════════════════
// ۵. اضافه کردن import در App.tsx (اگه خودش استفاده می‌کنه)
// ═══════════════════════════════════════════
const appUsesDateField = /<DateField/.test(app);
if (appUsesDateField && !app.includes("from './lib.datefield'")) {
  // اضافه کن
  const lines = app.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    if (lines[i].trim().startsWith('import ') && lines[i].trim().endsWith(';')) {
      lastImport = i;
    }
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import DateField from './lib.datefield';");
    app = lines.join('\n');
    console.log('✅ import DateField به App.tsx اضافه شد');
  }
}

if (crlf) app = app.replace(/\n/g, '\r\n');
fs.writeFileSync('App.tsx', app, 'utf8');
console.log('✅ App.tsx ذخیره شد');

// ═══════════════════════════════════════════
// ۶. آپدیت همه فایل‌های که از App import می‌کنن
// ═══════════════════════════════════════════
const allFiles = fs.readdirSync('.').filter(f =>
  (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.startsWith('backup')
);

let updatedCount = 0;
allFiles.forEach(f => {
  if (f === 'App.tsx' || f === 'lib.datefield.tsx') return;
  let content = fs.readFileSync(f, 'utf8');
  const orig = content;
  const fcrlf = content.includes('\r\n');
  if (fcrlf) content = content.replace(/\r\n/g, '\n');

  // اگه از App import می‌کنه و شامل DateField
  if (/import\s*\{[^}]*DateField[^}]*\}\s*from\s*['"]\.\/App['"]/.test(content)) {
    content = content.replace(
      /import\s*\{([^}]*?)DateField([^}]*?)\}\s*from\s*['"]\.\/App['"]/g,
      (match, before, after) => {
        const remaining = (before + after).split(',').map(x => x.trim()).filter(x => x && x !== 'DateField');
        const newImport = "import DateField from './lib.datefield';";
        if (remaining.length > 0) {
          return "import { " + remaining.join(', ') + " } from './App';\n" + newImport;
        }
        return newImport;
      }
    );
    if (fcrlf) content = content.replace(/\n/g, '\r\n');
    if (content !== orig) {
      fs.writeFileSync(f, content, 'utf8');
      console.log('✅ ' + f + ' آپدیت شد');
      updatedCount++;
    }
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('🛡 بکاپ: ' + bdir);
console.log('📊 فایل‌های آپدیت شده: ' + updatedCount);
console.log('');
console.log('الان بزن:');
console.log('  npx expo start --clear');