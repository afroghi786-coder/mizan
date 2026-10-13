const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-custfix2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['lib.assistant.core.ts', 'AssistantScreen.tsx', 'lib.manual.ts'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

const cust = fs.readFileSync('lib.fx.cust.ts', 'utf8');
console.log('═══ توابع lib.fx.cust.ts ═══');
const fns = [...cust.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map(m => m[1]);
fns.forEach(e => console.log('  ✅ ' + e));

const correctName = fns.find(e => /get.*[Cc]ust/i.test(e)) || 'getAllCust';
console.log('');
console.log('🔧 تابع درست: ' + correctName);

['lib.assistant.core.ts', 'AssistantScreen.tsx', 'lib.manual.ts'].forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  const orig = c;
  c = c.replace(/\bgetFxCustomers\b/g, correctName);
  if (c !== orig) {
    fs.writeFileSync(f, c, 'utf8');
    console.log('✅ ' + f + ' fix شد');
  } else {
    console.log('ℹ️ ' + f);
  }
});

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');