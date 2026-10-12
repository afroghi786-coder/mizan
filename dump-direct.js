const fs = require('fs');
const s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lines = s.split('\n');

// پیدا کردن همه جاهایی که "حواله خصوصی" هست
console.log('═══════════════════════════════════════════');
console.log('📍 همه جاهایی که "حواله خصوصی" هست:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('حواله خصوصی')) {
    console.log('خط ' + (i + 1) + ': ' + l.trim().substring(0, 100));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 همه جاهایی که "Modal" هست:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('<Modal') || l.includes('</Modal>')) {
    console.log('خط ' + (i + 1) + ': ' + l.trim().substring(0, 100));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 همه جاهایی که "directModal" هست:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('directModal') || l.includes('hawalaModal')) {
    console.log('خط ' + (i + 1) + ': ' + l.trim().substring(0, 100));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 همه جاهایی که "submitDirect" یا "submitHawala" هست:');
console.log('═══════════════════════════════════════════');
lines.forEach((l, i) => {
  if (l.includes('submitDirect') || l.includes('submitHawala')) {
    console.log('خط ' + (i + 1) + ': ' + l.trim().substring(0, 100));
  }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📌 محدوده خطوط ۱۲۵۰ تا ۱۵۰۰ (مودال‌ها):');
console.log('═══════════════════════════════════════════');
for (let i = 1250; i < Math.min(1500, lines.length); i++) {
  const l = lines[i];
  if (l.includes('Modal') || l.includes('visible') || l.includes('حواله') || l.includes('directForm') || l.includes('hawalaForm')) {
    console.log('خط ' + (i + 1) + ': ' + l.trim().substring(0, 110));
  }
}