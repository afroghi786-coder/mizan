const fs = require('fs');
let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const orig = s;

// فیکس props دوتیکه
s = s.replace(
  "export default function ExchangeScreen({ showToast }: any, { onBack }: any)",
  "export default function ExchangeScreen({ showToast, onBack }: any)"
);

if (s !== orig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('✅ props یکپارچه شد');
} else {
  // جستجو
  const line = s.split('\n').find(l => l.includes('export default function ExchangeScreen'));
  console.log('خط فعلی:', line);
}