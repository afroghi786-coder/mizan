const fs = require('fs');

const sb = fs.readFileSync('lib-supabase.ts', 'utf8');
console.log('═══════════════════════════════════════════');
console.log('📄 محتوای lib-supabase.ts:');
console.log('═══════════════════════════════════════════');
console.log(sb);
console.log('');

// هر چی شبیه key هست
const allKeys = sb.match(/['"]eyJ[A-Za-z0-9_\-\.]+['"]/g) || [];
console.log('🔑 کلیدهای پیدا شده: ' + allKeys.length);
allKeys.forEach((k, i) => console.log('   ' + (i+1) + '. ' + k.substring(0, 50) + '...'));