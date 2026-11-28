const fs = require('fs');

// 1) نمایش ادامه save برای دیدن دقیق مسیر ذخیره فاکتور خرید
const apLines = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
console.log('--- App.tsx save (7880..7925) ---');
console.log(apLines.slice(7879, Math.min(apLines.length, 7925)).map((l, i) => (7880 + i) + ': ' + l.trim()).join('\n'));

// 2) اصلاح قطعی __applyDisc در lib.offline.ts (با تطبیق دقیق خط‌به‌خط)
const loFile = 'lib.offline.ts';
let loSrc = fs.readFileSync(loFile, 'utf8');
const lines = loSrc.split(/\r?\n/);
const startIdx = lines.findIndex((l) => l.includes('const __applyDisc = (r: any) => {'));
if (startIdx >= 0 && lines[startIdx + 6] && lines[startIdx + 6].includes('return { ...r, total: net, invoiceDiscount: inv, rowDiscount: rowDisc };')) {
  const replacement = [
    'const __applyDisc = (r: any, type?: string) => {',
    '  const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;',
    '  const rowDisc = __rowDiscByInv[String(r && r.invoice || \'\').trim()] || 0;',
    '  const t = Number(r && r.total) || 0;',
    '  if (type === \'purchases\') {',
    '    const gross = (Array.isArray(r && r.items) && r.items.length)',
    '      ? r.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.price_unit ?? it.priceUnit) || 0), 0)',
    '      : 0;',
    '    const netFromGross = gross > 0 ? Math.max(0, gross - inv - rowDisc) : t;',
    '    return { ...r, total: netFromGross, invoiceDiscount: inv, rowDiscount: rowDisc };',
    '  }',
    '  const net = Math.max(0, t - inv - rowDisc);',
    '  if (!inv && !rowDisc) return r;',
    '  return { ...r, total: net, invoiceDiscount: inv, rowDiscount: rowDisc };',
    '};'
  ];
  lines.splice(startIdx, 7, ...replacement);
  fs.writeFileSync(loFile, lines.join('\n'), 'utf8');
  console.log('SUCCESS: Replaced __applyDisc at line ' + (startIdx + 1));
} else {
  console.log('WARN: __applyDisc block did not match expected lines.');
}