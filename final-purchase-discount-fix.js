const fs = require('fs');

function backupFile(file) {
  if (!fs.existsSync(file)) return;
  const prefix = file + '.bak-final-';
  if (!fs.readdirSync('.').some((f) => f.startsWith(prefix))) {
    fs.copyFileSync(file, prefix + Date.now());
  }
}

// 1) اصلاح lib.offline.ts: یکپارچه‌سازی invoiceDiscount در getPurchasesGrouped و کسر یک‌باره در searchAllInvoices
const loPath = 'lib.offline.ts';
if (fs.existsSync(loPath)) {
  backupFile(loPath);
  let loSrc = fs.readFileSync(loPath, 'utf8');
  const loLines = loSrc.split(/\r?\n/);

  // همگام‌سازی invoiceDiscount / invoice_discount در getPurchasesGrouped
  for (let i = 0; i < loLines.length; i++) {
    if (loLines[i].includes('const groupedFromPurchases = _groupPurchaseRows(localPurchaseRows);')) {
      const syncSnippet = [
        '      for (const _g of groupedFromPurchases) {',
        '        if (!_g) continue;',
        '        const _raw = localPurchaseRows.find((r: any) => String(r.invoice_number || \'\').trim() === String(_g.invoice || \'\').trim());',
        '        const _d = Number(_raw && (_raw.invoice_discount ?? _raw.invoiceDiscount)) || Number(_g.invoiceDiscount ?? _g.invoice_discount) || 0;',
        '        _g.invoiceDiscount = _d;',
        '        _g.invoice_discount = _d;',
        '      }'
      ];
      // اگر قبلاً تکرار شده بود، پاکسازی و جایگزین تمیز می‌کنیم
      let j = i + 1;
      while (j < loLines.length && loLines[j].includes('for (const _g of groupedFromPurchases)')) {
        loLines.splice(j, 1);
      }
      loLines.splice(i + 1, 0, ...syncSnippet);
      break;
    }
  }

  // اصلاح __applyDisc داخل searchAllInvoices به صورت دقیق و تمیز
  const applyStart = loLines.findIndex((l) => l.includes('const __applyDisc ='));
  const filtIdx = loLines.findIndex((l, idx) => idx > applyStart && l.includes('const filt ='));
  if (applyStart >= 0 && filtIdx > applyStart) {
    const cleanApply = [
      '  const __applyDisc = (r: any, type?: string) => {',
      '    const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;',
      '    const rowDisc = __rowDiscByInv[String(r && r.invoice || \'\').trim()] || 0;',
      '    const t = Number(r && r.total) || 0;',
      '    if (type === \'purchases\') {',
      '      const hasItemsGross = Array.isArray(r && r.items) && r.items.length > 0;',
      '      const gross = hasItemsGross',
      '        ? r.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.price_unit ?? it.priceUnit) || 0), 0)',
      '        : 0;',
      '      const net = gross > 0 ? Math.max(0, gross - inv - rowDisc) : Math.max(0, t);',
      '      return { ...r, total: net, invoiceDiscount: inv, invoice_discount: inv, rowDiscount: rowDisc };',
      '    }',
      '    const net = Math.max(0, t - inv - rowDisc);',
      '    if (!inv && !rowDisc) return r;',
      '    return { ...r, total: net, invoiceDiscount: inv, invoice_discount: inv, rowDiscount: rowDisc };',
      '  };',
      ''
    ];
    loLines.splice(applyStart, filtIdx - applyStart, ...cleanApply);
  }

  fs.writeFileSync(loPath, loLines.join('\n'), 'utf8');
  console.log('Updated lib.offline.ts cleanly.');
}

// 2) اصلاح App.tsx: خواندن مطمئن invoiceDiscount از هر دو کلید در openEdit
const apPath = 'App.tsx';
if (fs.existsSync(apPath)) {
  backupFile(apPath);
  let apSrc = fs.readFileSync(apPath, 'utf8');
  apSrc = apSrc.replace(
    /invoiceDiscount:\s*Math\.max\(0,\s*\.\.\.rows\.map\(\(r:\s*any\)\s*=>\s*Number\(r\.invoice_discount\)\s*\|\|\s*0\)\)/,
    'invoiceDiscount: Math.max(0, ...rows.map((r: any) => Number(r && (r.invoice_discount ?? r.invoiceDiscount)) || 0))'
  );
  fs.writeFileSync(apPath, apSrc, 'utf8');
  console.log('Updated App.tsx openEdit invoiceDiscount cleanly.');
}