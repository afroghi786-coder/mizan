const fs = require('fs');

const file = 'lib.offline.ts';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const start = lines.findIndex((l) => l.includes('const __applyDisc ='));
const retIdx = lines.findIndex((l, i) => i > start && l.includes('return [...filt(sales'));

if (start >= 0 && retIdx > start) {
  let end = retIdx;
  if (lines[retIdx + 1] && lines[retIdx + 1].trim() === '}') {
    end = retIdx + 1;
  }

  const fixed = [
    '  const __applyDisc = (r: any, type?: string) => {',
    '    const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;',
    '    const rowDisc = __rowDiscByInv[String(r && r.invoice || \'\').trim()] || 0;',
    '    const t = Number(r && r.total) || 0;',
    '    if (type === \'purchases\') {',
    '      const gross = (Array.isArray(r && r.items) && r.items.length)',
    '        ? r.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.price_unit ?? it.priceUnit) || 0), 0)',
    '        : 0;',
    '      const netFromGross = gross > 0 ? Math.max(0, gross - inv - rowDisc) : t;',
    '      return { ...r, total: netFromGross, invoiceDiscount: inv, rowDiscount: rowDisc };',
    '    }',
    '    const net = Math.max(0, t - inv - rowDisc);',
    '    if (!inv && !rowDisc) return r;',
    '    return { ...r, total: net, invoiceDiscount: inv, rowDiscount: rowDisc };',
    '  };',
    '',
    '  const filt = (arr: any[], type: string) =>',
    '    arr.map((r) => ({ ...__applyDisc(r, type), type, sheetType: type }))',
    '      .filter((r) => !query ||',
    '        (String(r.invoice) + \' \' + String(r.name || \'\') + \' \' + String(r.phone || \'\')).toLowerCase().includes(query));',
    '  return [...filt(sales, \'sales\'), ...filt(purchases, \'purchases\')];',
    '}'
  ];

  lines.splice(start, end - start + 1, ...fixed);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('FIXED lines ' + (start + 1) + '..' + (end + 1));
} else {
  console.log('Not found:', start, retIdx);
}