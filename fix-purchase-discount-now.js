const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

function safeWriteTs(filePath, content, plugins) {
  const backup = filePath + '.bak-purfix-' + Date.now();
  fs.copyFileSync(filePath, backup);
  if (parser) {
    try {
      parser.parse(content, { sourceType: 'module', plugins });
    } catch (err) {
      fs.copyFileSync(backup, filePath);
      throw new Error('Syntax check failed for ' + filePath + ': ' + err.message);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Saved & verified:', filePath, '(backup:', backup + ')');
}

// 1) اصلاح lib.offline.ts
const loPath = 'lib.offline.ts';
if (fs.existsSync(loPath)) {
  const raw = fs.readFileSync(loPath, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  const lines = s.split('\n');

  // همگام‌سازی invoiceDiscount و invoice_discount در getPurchasesGrouped
  const grpIdx = lines.findIndex((l) => l.includes('const groupedFromPurchases = _groupPurchaseRows(localPurchaseRows);'));
  if (grpIdx >= 0 && !lines.slice(grpIdx, grpIdx + 12).some((l) => l.includes('__syncPurDisc'))) {
    const syncBlock = [
      '      // __syncPurDisc: هم‌ترازی تخفیف فاکتور و ردیفی خرید با الگوی فروش',
      '      for (const _g of groupedFromPurchases) {',
      '        if (!_g) continue;',
      '        const _invKey = String(_g.invoice || \'\').trim();',
      '        const _matched = localPurchaseRows.filter((r: any) => String(r && r.invoice_number || \'\').trim() === _invKey);',
      '        const _invDisc = _matched.reduce((m: number, r: any) => Math.max(m, Number(r && (r.invoice_discount ?? r.invoiceDiscount)) || 0), Number(_g.invoiceDiscount ?? _g.invoice_discount) || 0);',
      '        const _rowDisc = _matched.reduce((sum: number, r: any) => {',
      '          const qty = Number(r && r.quantity) || 0;',
      '          const per = Number(r && (r.discount ?? r.discount_base_unit)) || 0;',
      '          return sum + Math.abs(qty * per);',
      '        }, 0);',
      '        const _gross = _matched.reduce((sum: number, r: any) => sum + (Number(r && r.quantity) || 0) * (Number(r && r.price_unit) || 0), 0);',
      '        _g.invoiceDiscount = _invDisc;',
      '        _g.invoice_discount = _invDisc;',
      '        _g.rowDiscount = _rowDisc;',
      '        _g.discountTotal = _rowDisc + _invDisc;',
      '        if (_gross > 0) _g.total = Math.max(0, _gross - _rowDisc - _invDisc);',
      '      }'
    ];
    lines.splice(grpIdx + 1, 0, ...syncBlock);
  }

  // اصلاح __applyDisc در searchAllInvoices تا برای خرید روی gross خالص‌سازی کند و تخفیف‌ها را برگرداند
  const applyIdx = lines.findIndex((l) => l.includes('const __applyDisc ='));
  const filtIdx = lines.findIndex((l, i) => i > applyIdx && l.includes('const filt ='));
  if (applyIdx >= 0 && filtIdx > applyIdx) {
    const replacementApply = [
      '  const __applyDisc = (r: any, type?: string) => {',
      '    const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;',
      '    const rowDisc = __rowDiscByInv[String(r && r.invoice || \'\').trim()] || Number(r && r.rowDiscount) || 0;',
      '    const t = Number(r && r.total) || 0;',
      '    if (type === \'purchases\') {',
      '      const grossFromItems = (Array.isArray(r && r.items) && r.items.length)',
      '        ? r.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.price_unit ?? it.priceUnit) || 0), 0)',
      '        : 0;',
      '      const baseGross = grossFromItems > 0 ? grossFromItems : (t + inv + rowDisc);',
      '      const netPur = Math.max(0, baseGross - inv - rowDisc);',
      '      return { ...r, total: netPur, invoiceDiscount: inv, invoice_discount: inv, rowDiscount };',
      '    }',
      '    const net = Math.max(0, t - inv - rowDisc);',
      '    if (!inv && !rowDisc) return r;',
      '    return { ...r, total: net, invoiceDiscount: inv, invoice_discount: inv, rowDiscount };',
      '  };',
      ''
    ];
    lines.splice(applyIdx, filtIdx - applyIdx, ...replacementApply);
  }

  const outLo = lines.join('\n');
  safeWriteTs(loPath, crlf ? outLo.replace(/\n/g, '\r\n') : outLo, ['typescript']);
}

// 2) اصلاح App.tsx در openEdit برای خواندن مطمئن تخفیف فاکتور خرید و فروش
const apPath = 'App.tsx';
if (fs.existsSync(apPath)) {
  const rawAp = fs.readFileSync(apPath, 'utf8');
  const crlfAp = rawAp.includes('\r\n');
  let ap = crlfAp ? rawAp.replace(/\r\n/g, '\n') : rawAp;

  ap = ap.replace(
    /invoiceDiscount:\s*Math\.max\(0,\s*\.\.\.rows\.map\(\(r:\s*any\)\s*=>\s*Number\(r\.invoice_discount\)\s*\|\|\s*0\)\)/,
    'invoiceDiscount: Math.max(0, ...rows.map((r: any) => Number(r && (r.invoice_discount ?? r.invoiceDiscount)) || 0), __firstInvDisc || 0)'
  );

  safeWriteTs(apPath, crlfAp ? ap.replace(/\n/g, '\r\n') : ap, ['jsx', 'typescript']);
}