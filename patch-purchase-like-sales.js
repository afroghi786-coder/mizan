const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '')
    .replace(/,/g, '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function writeVerified(filePath, content, plugins) {
  const backup = filePath + '.bak-salesparity-' + Date.now();
  fs.copyFileSync(filePath, backup);
  if (parser) {
    try {
      parser.parse(content, { sourceType: 'module', plugins });
    } catch (err) {
      fs.copyFileSync(backup, filePath);
      throw new Error('Syntax error in ' + filePath + ': ' + err.message);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('OK:', filePath, '| Backup:', backup);
}

// 1) lib.offline.ts: همگام‌سازی purchases_grouped با الگوی فروش
const loPath = 'lib.offline.ts';
if (fs.existsSync(loPath)) {
  const raw = fs.readFileSync(loPath, 'utf8');
  const crlf = raw.includes('\r\n');
  let lo = crlf ? raw.replace(/\r\n/g, '\n') : raw;

  const startAnchor = '// UPDATE_GROUPED_PURCHASES';
  const endAnchor = "await setLocal('purchases_grouped', [...groupedFiltered, groupedObj]);";
  const sIdx = lo.indexOf(startAnchor);
  const eLineIdx = sIdx >= 0 ? lo.indexOf(endAnchor, sIdx) : -1;

  if (sIdx >= 0 && eLineIdx >= 0) {
    const afterSetLocal = lo.indexOf('\n', eLineIdx);
    const replacement = [
      '// UPDATE_GROUPED_PURCHASES — همگام‌سازی کامل با الگوی فروش',
      '  try {',
      '    const groupedList = (await getLocal<any[]>(\'purchases_grouped\')) || [];',
      '    const groupedFiltered = groupedList.filter((g: any) => String(g && g.invoice || \'\') !== String(payload.invoiceNumber));',
      '    const _n = (v: any) => {',
      '      if (typeof v === \'number\') return Number.isFinite(v) ? v : 0;',
      '      const cleaned = String(v ?? \'\')',
      '        .replace(/,/g, \'\')',
      '        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))',
      '        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));',
      '      const num = Number(cleaned.replace(/[^0-9.-]/g, \'\'));',
      '      return Number.isFinite(num) ? num : 0;',
      '    };',
      '    const invDiscVal = meta && meta.invoiceDiscount !== undefined',
      '      ? _n(meta.invoiceDiscount)',
      '      : (meta && meta.invoice_discount !== undefined ? _n(meta.invoice_discount) : _n(template.invoice_discount));',
      '    const rowDiscSum = newRows.reduce((sum: number, r: any) => sum + _n(r.quantity) * _n(r.discount), 0);',
      '    const grossTotal = newRows.reduce((sum: number, r: any) => sum + _n(r.quantity) * _n(r.price_unit), 0);',
      '    const total = Math.max(0, grossTotal - rowDiscSum - invDiscVal);',
      '    const paid = newRows.reduce((sum: number, r: any) => sum + _n(r.payment), 0);',
      '    const rowHolder = newRows.map((r: any) => String((r && (r.account_holder ?? r.accountHolder)) || \'\').trim()).find(Boolean) || \'\';',
      '    const rowHolderCode = newRows.map((r: any) => String((r && (r.account_holder_code ?? r.accountHolderCode)) || \'\').trim()).find(Boolean) || \'\';',
      '    const resolvedHolder = String((meta && (meta.holder ?? meta.payerName ?? meta.accountHolder)) || rowHolder || template.account_holder || template.payer_name || \'\').trim();',
      '    const resolvedHolderCode = String((meta && (meta.holderCode ?? meta.payerCode ?? meta.accountHolderCode)) || rowHolderCode || template.account_holder_code || template.payer_code || \'\').trim();',
      '    const groupedObj: any = {',
      '      invoice: payload.invoiceNumber,',
      '      date: (meta && meta.date) || template.date_factor || now,',
      '      name: (meta && meta.name) || template.supplier_name || \'\',',
      '      phone: (meta && meta.phone) || template.supplier_phone || \'\',',
      '      supplierCode: (meta && meta.code) || template.supplier_code || \'\',',
      '      total,',
      '      paid,',
      '      invoiceDiscount: invDiscVal,',
      '      invoice_discount: invDiscVal,',
      '      rowDiscount: rowDiscSum,',
      '      discountTotal: rowDiscSum + invDiscVal,',
      '      manual: (meta && meta.manualInv) || template.manual_invoice || \'\',',
      '      bank: (meta && meta.bank) || template.bank_name || \'\',',
      '      holder: resolvedHolder,',
      '      accountHolder: resolvedHolder,',
      '      holderCode: resolvedHolderCode,',
      '      depositDate: (meta && meta.depositDate) || template.deposit_date || \'\',',
      '      shipping: (meta && meta.shipping) || template.shipping || \'\',',
      '      local_id: \'grp_purchase_\' + payload.invoiceNumber,',
      '      updated_at: now,',
      '      deleted_at: \'\',',
      '      device_id: dev,',
      '      items: newRows.map((r: any) => ({',
      '        modelCode: r.model_code,',
      '        modelName: r.model_name,',
      '        quantity: _n(r.quantity),',
      '        priceUnit: _n(r.price_unit),',
      '        discount: _n(r.discount),',
      '        discount_base_unit: _n(r.discount_base_unit),',
      '        discount_pack_unit: _n(r.discount_pack_unit),',
      '        invoice_discount: invDiscVal,',
      '        payment: _n(r.payment),',
      '        description: r.description || \'\',',
      '        accountHolder: String((r && (r.account_holder ?? r.accountHolder)) || resolvedHolder).trim(),',
      '        shelf: r.shelf || \'\',',
      '      })),',
      '    };',
      '    await setLocal(\'purchases_grouped\', [...groupedFiltered, groupedObj]);'
    ].join('\n');

    lo = lo.slice(0, sIdx) + replacement + lo.slice(afterSetLocal >= 0 ? afterSetLocal : eLineIdx + endAnchor.length);
  }

  writeVerified(loPath, crlf ? lo.replace(/\n/g, '\r\n') : lo, ['typescript']);
}

// 2) App.tsx: همگام‌سازی فوری لیست و خواندن صاحب حساب/تخفیف هنگام ویرایش
const apPath = 'App.tsx';
if (fs.existsSync(apPath)) {
  const rawAp = fs.readFileSync(apPath, 'utf8');
  const crlfAp = rawAp.includes('\r\n');
  let ap = crlfAp ? rawAp.replace(/\r\n/g, '\n') : rawAp;

  ap = ap.replace(
    /setList\(\(prev:\s*any\[\]\)\s*=>\s*prev\.map\(\(x:\s*any\)\s*=>\s*x\.invoice\s*===\s*editing\.invoice[\s\S]*?\)\);/,
    'setList((prev: any[]) => prev.map((x: any) => x.invoice === editing.invoice ? { ...x, total: newTotal, paid: newPaid, invoiceDiscount: _invDisc, invoice_discount: _invDisc, rowDiscount: _rowDisc, holder: validRows[0]?.accountHolder || editing.holder || x.holder || \'\', accountHolder: validRows[0]?.accountHolder || editing.accountHolder || x.accountHolder || \'\', name: editing.name, phone: editing.phone } : x));'
  );

  writeVerified(apPath, crlfAp ? ap.replace(/\n/g, '\r\n') : ap, ['jsx', 'typescript']);
}