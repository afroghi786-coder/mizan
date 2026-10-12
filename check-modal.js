const fs = require('fs');
const s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lines = s.split('\n');

// پیدا کردن مودال خصوصی (خط ۱۸۲۶ به بعد)
console.log('═══════════════════════════════════════════');
console.log('📍 مودال خصوصی — خطوط ۱۸۲۶ تا ۱۹۵۰');
console.log('═══════════════════════════════════════════');
for (let i = 1825; i < 1960 && i < lines.length; i++) {
  const L = lines[i];
  // فقط خطوط مهم
  if (L.includes('Modal') || L.includes('TouchableOpacity') || L.includes('TextInput') ||
      L.includes('ScrollView') || L.includes('View style') || L.includes('انصراف') ||
      L.includes('ثبت') || L.includes('submit') || L.includes('directForm') ||
      L.includes('Text style') || L.includes('style={s.')) {
    console.log('خط ' + (i + 1) + ': ' + L.trim().substring(0, 110));
  }
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📍 استایل‌های inp و lbl و btn');
console.log('═══════════════════════════════════════════');
const styleMatches = s.match(/^\s*(inp|lbl|btn|card|modal|mBox|mHead)\s*:\s*\{[^}]*\}/gm) || [];
styleMatches.forEach(m => console.log(m.trim().substring(0, 200)));