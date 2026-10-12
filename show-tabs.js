const fs = require('fs');
const s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');

// پیدا کردن بخش زیرتب‌ها
const idx = s.indexOf('st.tabsRow');
if (idx > 0) {
  console.log('═══ بخش زیرتب‌ها (خط ' + s.substring(0, idx).split('\n').length + ') ═══');
  console.log(s.substring(idx - 300, idx + 900));
  console.log('═══ پایان ═══');
} else {
  console.log('❌ st.tabsRow پیدا نشد');
}