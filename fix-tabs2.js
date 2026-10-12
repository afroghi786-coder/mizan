const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;

// فیکس اصلی — فقط این یک خط تغییر
const old = `<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsRow}>`;
const nw = `<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 58, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={st.tabsRow}>`;

if (s.includes(old)) {
  s = s.replace(old, nw);
  console.log('✅ ارتفاع ScrollView محدود شد');
} else {
  console.log('⚠️ الگو پیدا نشد');
}

if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ تغییری نکرد');
}