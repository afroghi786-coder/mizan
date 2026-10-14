const fs = require('fs');
const path = require('path');

console.log('🔧 Fix lib.datefield.tsx\n');

const bdir = 'backup-before-dffix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });

// ═══════════════════════════════════════════
// ۱. خوندن lib.datefield.tsx فعلی
// ═══════════════════════════════════════════
let df = fs.readFileSync('lib.datefield.tsx', 'utf8');
fs.copyFileSync('lib.datefield.tsx', path.join(bdir, 'lib.datefield.tsx'));

const crlf = df.includes('\r\n');
if (crlf) df = df.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۲. پیدا کردن تابع DateField
// ═══════════════════════════════════════════
const dfFuncRegex = /(export\s+function\s+DateField[\s\S]*?\n\})/;
const match = df.match(dfFuncRegex);

if (!match) {
  console.log('❌ DateField پیدا نشد');
  process.exit(1);
}

const dateFieldFunc = match[1];
console.log('✅ DateField پیدا شد (' + dateFieldFunc.length + ' بایت)');

// ═══════════════════════════════════════════
// ۳. پیدا کردن تابع genInvoiceNumber (که DateField ازش استفاده می‌کنه)
// ═══════════════════════════════════════════
// چک کن DateField از چه چیزهایی استفاده می‌کنه
const usesParse = dateFieldFunc.includes('parseDateAny');
const usesToStorage = dateFieldFunc.includes('toStorageDateFull');
const usesCal = dateFieldFunc.includes('getCalType') || dateFieldFunc.includes('CalType');
const usesDateFieldHelpers = dateFieldFunc.includes('pad2') || dateFieldFunc.includes('g2j');

console.log('📦 استفاده می‌کنه از:');
console.log('  parseDateAny: ' + usesParse);
console.log('  toStorageDateFull: ' + usesToStorage);
console.log('  getCalType/CalType: ' + usesCal);

// ═══════════════════════════════════════════
// ۴. ساخت فایل تمیز
// ═══════════════════════════════════════════
let imports = [
  "import React, { useState } from 'react';",
  "import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';",
];

// اگه از توابع lib.offline استفاده می‌کنه
const offlineImports = [];
if (usesParse) offlineImports.push('parseDateAny');
if (usesToStorage) offlineImports.push('toStorageDateFull');
if (offlineImports.length > 0) {
  imports.push("import { " + offlineImports.join(', ') + " } from './lib.offline';");
}

// getCalType
if (usesCal) {
  imports.push("import { getCalType } from './lib.offline';");
}

// اگه DateTimePicker داره
const usesDateTimePicker = dateFieldFunc.includes('DateTimePicker');
if (usesDateTimePicker) {
  imports.push("import DateTimePicker from '@react-native-community/datetimepicker';");
}

const cleanFile = `// lib.datefield.tsx — DateField component (جدا شده)
${imports.join('\n')}

export type CalType = 'jalali' | 'gregorian' | 'hijri';

${dateFieldFunc}

export default DateField;
`;

fs.writeFileSync('lib.datefield.tsx', cleanFile, 'utf8');
console.log('✅ lib.datefield.tsx تمیز بازنویسی شد');

// ═══════════════════════════════════════════
// ۵. چک نهایی
// ═══════════════════════════════════════════
const final = fs.readFileSync('lib.datefield.tsx', 'utf8');
const lines = final.split('\n');
console.log('');
console.log('═══ ۱۵ خط اول ═══');
lines.slice(0, 15).forEach((l, i) => console.log((i+1) + ': ' + l));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('الان بزن:');
console.log('  npx expo start --clear');