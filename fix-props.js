const fs = require('fs');
let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const orig = s;

// پیدا کردن تعریف ExchangeScreen
const patterns = [
  /export default function ExchangeScreen\(([^)]*)\)/,
  /export function ExchangeScreen\(([^)]*)\)/,
  /function ExchangeScreen\(([^)]*)\)/,
  /const ExchangeScreen = \(([^)]*)\)/,
  /export default function ExchangeScreen\(\{([^}]*)\}/,
];

let found = false;
for (const p of patterns) {
  const m = s.match(p);
  if (m) {
    console.log('الگو پیدا شد:', p.toString().substring(0, 50));
    console.log('متن match:', m[0]);
    found = true;
    break;
  }
}

if (!found) {
  console.log('❌ هیچ الگویی پیدا نشد — چاپ ۵ خط اول فایل:');
  const lines = s.split('\n');
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].includes('ExchangeScreen')) {
      console.log('خط ' + (i+1) + ': ' + lines[i]);
    }
  }
} else {
  // جایگزین: اضافه onBack
  // روش ۱: props object
  const re1 = /export default function ExchangeScreen\(\{([^}]+)\}\)/;
  if (re1.test(s)) {
    s = s.replace(re1, (match, props) => {
      let p = props.trim();
      if (p.endsWith(',')) p = p.slice(0, -1);
      if (p.includes('onBack')) return match; // از قبل
      return `export default function ExchangeScreen({${p}, onBack})`;
    });
    console.log('✅ onBack اضافه شد (روش props)');
  } else {
    // روش ۲: پارامتر تکی
    const re2 = /export default function ExchangeScreen\(([^)]+)\)/;
    if (re2.test(s)) {
      s = s.replace(re2, (match, params) => {
        if (params.includes('onBack')) return match;
        return `export default function ExchangeScreen(${params}, { onBack }: any)`;
      });
      console.log('✅ onBack اضافه شد (روش دوم)');
    }
  }
}

if (s !== orig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ تغییری اعمال نشد');
}