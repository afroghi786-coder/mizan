const fs = require('fs');

console.log('🔧 حذف کامل SafeAreaView\n');

let count = 0;

// ═══════════════════════════════════════════
// همه فایل‌های .tsx که SafeAreaView دارن
// ═══════════════════════════════════════════
const files = fs.readdirSync('.').filter(f =>
  (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.startsWith('backup')
);

files.forEach(f => {
  try {
    let c = fs.readFileSync(f, 'utf8');
    const orig = c;
    const crlf = c.includes('\r\n');
    if (crlf) c = c.replace(/\r\n/g, '\n');

    // اگه SafeAreaView داره
    if (!c.includes('SafeAreaView')) return;

    // ۱. حذف SafeAreaView از import react-native
    c = c.replace(/import\s*\{([^}]*)\}\s*from\s*'react-native';?/g, (m, imports) => {
      const parts = imports.split(',').map(x => x.trim()).filter(x => x && x !== 'SafeAreaView');
      if (parts.length === 0) return '';
      if (!parts.includes('View') && m.includes('SafeAreaView')) parts.push('View');
      return `import { ${parts.join(', ')} } from 'react-native';`;
    });

    // ۲. حذف SafeAreaView از import react-native-safe-area-context
    c = c.replace(/import\s*\{([^}]*)\}\s*from\s*'react-native-safe-area-context';?/g, (m, imports) => {
      const parts = imports.split(',').map(x => x.trim()).filter(x => x && x !== 'SafeAreaView');
      if (parts.length === 0) return '';
      return `import { ${parts.join(', ')} } from 'react-native-safe-area-context';`;
    });

    // ۳. تبدیل SafeAreaView به View
    c = c.replace(/<SafeAreaView/g, '<View');
    c = c.replace(/<\/SafeAreaView>/g, '</View>');

    if (crlf) c = c.replace(/\n/g, '\r\n');
    if (c !== orig) {
      fs.writeFileSync(f, c, 'utf8');
      console.log('✅ ' + f);
      count++;
    }
  } catch (e) {
    console.log('❌ ' + f + ': ' + e.message);
  }
});

console.log('\n📊 ' + count + ' فایل اصلاح شد');
console.log('\nالان بزن:');
console.log('  npx expo start --clear');