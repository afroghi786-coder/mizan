const fs = require('fs');

let df = fs.readFileSync('lib.datefield.tsx', 'utf8');
const orig = df;
const crlf = df.includes('\r\n');
if (crlf) df = df.replace(/\r\n/g, '\n');

// عوض کن import React
df = df.replace(
  /import React, \{ useState \} from 'react';/,
  "import React, { useState, useEffect, useMemo, useCallback } from 'react';"
);

// ادغام import های lib.offline
df = df.replace(
  /import \{ parseDateAny, toStorageDateFull \} from '\.\/lib\.offline';\nimport \{ getCalType \} from '\.\/lib\.offline';/,
  "import { parseDateAny, toStorageDateFull, getCalType } from './lib.offline';"
);

if (crlf) df = df.replace(/\n/g, '\r\n');
if (df !== orig) {
  fs.writeFileSync('lib.datefield.tsx', df, 'utf8');
  console.log('✅ fix شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('\nالان بزن:');
console.log('  npx expo start --clear');