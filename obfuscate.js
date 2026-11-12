const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const dir = path.join(__dirname, 'dist', '_expo', 'static', 'js', 'web');
if (!fs.existsSync(dir)) {
  console.error('❌ پوشه باندل پیدا نشد. اول npx expo export -p web را بزنید.');
  process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.startsWith('index-') && f.endsWith('.js'));
if (files.length === 0) { console.error('❌ فایل اصلی پیدا نشد.'); process.exit(1); }

files.forEach(file => {
  const filePath = path.join(dir, file);
  console.log('🔒 مبهم‌سازی: ' + file);
  const code = fs.readFileSync(filePath, 'utf8');
  const obfuscated = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.9,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.5,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    selfDefending: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.85,
    transformObjectKeys: true,
    unicodeEscapeSequence: true,
  }).getObfuscatedCode();
  fs.writeFileSync(filePath, obfuscated, 'utf8');
  console.log('✅ شد: ' + file);
});
console.log('🎉 همه کدها مبهم شدند.');