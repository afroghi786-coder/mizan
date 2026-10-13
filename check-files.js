const fs = require('fs');

console.log('═══ چک فایل‌ها ═══');
['lib.assistant.core.ts', 'AssistantScreen.tsx', 'lib.assistant.ts', 'lib.boxes.ts', 'lib.fx.ts', 'lib.fx.cust.ts'].forEach(f => {
  if (fs.existsSync(f)) {
    const size = fs.statSync(f).size;
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    console.log('✅ ' + f + ' — ' + lines + ' خط، ' + (size/1024).toFixed(1) + ' KB');
  } else {
    console.log('❌ ' + f + ' — نیست!');
  }
});

console.log('');
console.log('═══ چک توابع core ═══');
const core = fs.readFileSync('lib.assistant.core.ts', 'utf8');
['deepSearch', 'resolveBox', 'resolvePerson', 'extractCurrency', 'extractAmount', 'boxDeposit', 'boxWithdraw', 'setContext', 'getContext', 'clearContext', 'norm'].forEach(fn => {
  console.log((core.includes('export function ' + fn) || core.includes('export async function ' + fn) ? '✅ ' : '❌ ') + fn);
});

console.log('');
console.log('═══ چک توابع boxes ═══');
const bx = fs.readFileSync('lib.boxes.ts', 'utf8');
['getBoxes', 'getAllBalances', 'addBoxTransaction', 'getBoxTransactions', 'saveBox'].forEach(fn => {
  console.log((bx.includes('export function ' + fn) || bx.includes('export async function ' + fn) || bx.includes('export const ' + fn) ? '✅ ' : '❌ ') + fn);
});

console.log('');
console.log('═══ چک import در AssistantScreen ═══');
const sc = fs.readFileSync('AssistantScreen.tsx', 'utf8');
['deepSearch', 'resolveBox', 'boxDeposit', 'extractCurrency', 'extractAmount'].forEach(fn => {
  console.log((sc.includes(fn) ? '✅ ' : '❌ ') + fn);
});

console.log('');
console.log('═══ ۱۰ خط اول AssistantScreen ═══');
const lines = sc.split('\n');
lines.slice(0, 15).forEach((l, i) => console.log((i+1) + ': ' + l));