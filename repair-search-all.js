const fs = require('fs');

const file = 'lib.offline.ts';
const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);

const startIdx = lines.findIndex((l) => l.includes('const __applyDisc ='));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l.trim() === '}' && lines[idx + 1] && lines[idx + 1].includes('getInvoiceDetail'));

if (startIdx >= 0 && endIdx > startIdx) {
  const cleanBlock = [
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

  lines.splice(startIdx, endIdx - startIdx + 1, ...cleanBlock);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('Repaired searchAllInvoices block cleanly.');
} else {
  console.log('Could not locate exact block bounds:', startIdx, endIdx);
}