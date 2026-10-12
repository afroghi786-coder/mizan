const fs = require('fs');
let a = fs.readFileSync('App.tsx', 'utf8');

// پیدا کردن خط LanguageModal
const idx = a.indexOf('<LanguageModal');
if (idx < 0) { console.log('❌ LanguageModal نیست'); process.exit(1); }

// پیدا کردن ابتدای خط
const lineStart = a.lastIndexOf('\n', idx) + 1;
const indent = a.substring(lineStart, idx);

// اضافه ExchangeBell قبل از LanguageModal
const bellCode = indent + "{tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n";

a = a.substring(0, lineStart) + bellCode + a.substring(lineStart);

fs.writeFileSync('App.tsx', a, 'utf8');
console.log('✅ ExchangeBell در render اضافه شد');
console.log('خط اضافه‌شده:', bellCode.trim());