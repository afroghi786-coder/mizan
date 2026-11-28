const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').replace(/,/g, '').replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function safeWrite(filePath, content, plugins) {
  const backup = filePath + '.bak-allfix-' + Date.now();
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
  console.log('✅ Saved:', filePath, '| Backup:', backup);
}

// 1) اصلاح updatePurchase در lib.offline.ts
const loFile = 'lib.offline.ts';
if (fs.existsSync(loFile)) {
  const rawLo = fs.readFileSync(loFile, 'utf8');
  const crlfLo = rawLo.includes('\r\n');
  let lo = crlfLo ? rawLo.replace(/\r\n/g, '\n') : rawLo;

  const grpStart = lo.indexOf('// UPDATE_GROUPED_PURCHASES');
  const grpEnd = grpStart >= 0 ? lo.indexOf('} catch (e: any) {\n    console.log(\'[updatePurchase] grouped update failed:\'', grpStart) : -1;

  if (grpStart >= 0 && grpEnd > grpStart) {
    const catchLineEnd = lo.indexOf('\n', lo.indexOf('}', grpEnd)) + 1;
    const cleanGroupedBlock = [
      '// UPDATE_GROUPED_PURCHASES — همگام‌سازی purchases_grouped با ویرایش جدید',
      '  try {',
      '    const groupedList = (await getLocal<any[]>(\'purchases_grouped\')) || [];',
      '    const groupedFiltered = groupedList.filter((g: any) => String(g.invoice || \'\') !== payload.invoiceNumber);',
      '    const _num = (v: any) => {',
      '      if (typeof v === \'number\') return Number.isFinite(v) ? v : 0;',
      '      const n = Number(String(v ?? \'\').replace(/,/g, \'\').replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[^0-9.-]/g, \'\'));',
      '      return Number.isFinite(n) ? n : 0;',
      '    };',
      '    const invDiscVal = meta.invoiceDiscount !== undefined ? _num(meta.invoiceDiscount) : (meta.invoice_discount !== undefined ? _num(meta.invoice_discount) : _num(template.invoice_discount));',
      '    const rowDiscSum = newRows.reduce((sum: number, r: any) => sum + _num(r.quantity) * _num(r.discount), 0);',
      '    const grossTotal = newRows.reduce((sum: number, r: any) => sum + _num(r.quantity) * _num(r.price_unit), 0);',
      '    const total = Math.max(0, grossTotal - rowDiscSum - invDiscVal);',
      '    const paid = newRows.reduce((sum: number, r: any) => sum + _num(r.payment), 0);',
      '    const firstRowWithHolder = newRows.find((r: any) => String(r && r.account_holder || \'\').trim());',
      '    const resolvedHolder = String(meta.holder || meta.payerName || (firstRowWithHolder && firstRowWithHolder.account_holder) || template.account_holder || template.payer_name || \'\').trim();',
      '    const resolvedHolderCode = String(meta.holderCode || meta.payerCode || (firstRowWithHolder && firstRowWithHolder.account_holder_code) || template.account_holder_code || template.payer_code || \'\').trim();',
      '    const groupedObj: any = {',
      '      invoice: payload.invoiceNumber,',
      '      date: meta.date || template.date_factor || now,',
      '      name: meta.name || template.supplier_name || \'\',',
      '      phone: meta.phone || template.supplier_phone || \'\',',
      '      supplierCode: meta.code || template.supplier_code || \'\',',
      '      total,',
      '      paid,',
      '      invoiceDiscount: invDiscVal,',
      '      invoice_discount: invDiscVal,',
      '      rowDiscount: rowDiscSum,',
      '      discountTotal: rowDiscSum + invDiscVal,',
      '      manual: meta.manualInv || template.manual_invoice || \'\',',
      '      bank: meta.bank || template.bank_name || \'\',',
      '      holder: resolvedHolder,',
      '      accountHolder: resolvedHolder,',
      '      holderCode: resolvedHolderCode,',
      '      depositDate: meta.depositDate || template.deposit_date || \'\',',
      '      shipping: meta.shipping || template.shipping || \'\',',
      '      local_id: \'grp_purchase_\' + payload.invoiceNumber,',
      '      updated_at: now,',
      '      deleted_at: \'\',',
      '      device_id: dev,',
      '      items: newRows.map((r: any) => ({',
      '        modelCode: r.model_code,',
      '        modelName: r.model_name,',
      '        quantity: _num(r.quantity),',
      '        priceUnit: _num(r.price_unit),',
      '        discount: _num(r.discount),',
      '        discount_base_unit: _num(r.discount_base_unit),',
      '        discount_pack_unit: _num(r.discount_pack_unit),',
      '        invoice_discount: invDiscVal,',
      '        payment: _num(r.payment),',
      '        description: r.description || \'\',',
      '        accountHolder: r.account_holder || resolvedHolder,',
      '        shelf: r.shelf || \'\',',
      '      })),',
      '    };',
      '    await setLocal(\'purchases_grouped\', [...groupedFiltered, groupedObj]);',
      '  } catch (e: any) {',
      '    console.log(\'[updatePurchase] grouped update failed:\', e?.message);',
      '  }',
      ''
    ].join('\n');

    lo = lo.slice(0, grpStart) + cleanGroupedBlock + lo.slice(catchLineEnd);
  }

  safeWrite(loFile, crlfLo ? lo.replace(/\n/g, '\r\n') : lo, ['typescript']);
}

// 2) اصلاح ذخیره و آپدیت فوری لیست در App.tsx
const apFile = 'App.tsx';
if (fs.existsSync(apFile)) {
  const rawAp = fs.readFileSync(apFile, 'utf8');
  const crlfAp = rawAp.includes('\r\n');
  let ap = crlfAp ? rawAp.replace(/\r\n/g, '\n') : rawAp;

  ap = ap.replace(
    /setList\(\(prev:\s*any\[\]\)\s*=>\s*prev\.map\(\(x:\s*any\)\s*=>\s*x\.invoice\s*===\s*editing\.invoice\s*\?\s*\{\s*\.\.\.x,\s*total:\s*newTotal,\s*paid:\s*newPaid,\s*invoiceDiscount:\s*_invDisc,\s*invoice_discount:\s*_invDisc,\s*rowDiscount:\s*_rowDisc,\s*name:\s*editing\.name,\s*phone:\s*editing\.phone\s*\}\s*:\s*x\)\);/,
    'setList((prev: any[]) => prev.map((x: any) => x.invoice === editing.invoice ? { ...x, total: newTotal, paid: newPaid, invoiceDiscount: _invDisc, invoice_discount: _invDisc, rowDiscount: _rowDisc, holder: validRows[0]?.accountHolder || x.holder || \'\', accountHolder: validRows[0]?.accountHolder || x.accountHolder || \'\', name: editing.name, phone: editing.phone } : x));'
  );

  safeWrite(apFile, crlfAp ? ap.replace(/\n/g, '\r\n') : ap, ['jsx', 'typescript']);
}