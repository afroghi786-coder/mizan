const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

function saveSafe(filePath, content, plugins) {
  const backup = filePath + '.bak-fix2-' + Date.now();
  fs.copyFileSync(filePath, backup);
  if (parser) {
    try {
      parser.parse(content, { sourceType: 'module', plugins });
    } catch (e) {
      fs.copyFileSync(backup, filePath);
      throw new Error('Syntax error in ' + filePath + ': ' + e.message);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Saved:', filePath, '| Backup:', backup);
}

// 1) رفع __invDisc در NewOrderSection داخل App.tsx
const apPath = 'App.tsx';
if (fs.existsSync(apPath)) {
  const rawAp = fs.readFileSync(apPath, 'utf8');
  const crlfAp = rawAp.includes('\r\n');
  let ap = crlfAp ? rawAp.replace(/\r\n/g, '\n') : rawAp;

  const lines = ap.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('__invDisc') && i < 7600) {
      const windowText = lines.slice(Math.max(0, i - 10), i + 1).join('\n');
      if (!windowText.includes('const __invDisc')) {
        const guard = [
          'const __invDisc = Number(typeof invoiceDiscount !== "undefined" ? invoiceDiscount : 0) || 0;',
          'const __listLen = Math.max(1, Array.isArray(items) ? items.filter((x: any) => !x || !x._deleted).length : 1);',
          'const __share = 1 / __listLen;'
        ].join('\n');
        lines[i] = guard + '\n' + lines[i];
      }
    }
  }
  ap = lines.join('\n');
  saveSafe(apPath, crlfAp ? ap.replace(/\n/g, '\r\n') : ap, ['jsx', 'typescript']);
}

// 2) تکمیل فیلدهای خرید در updateInvoiceInQueue_original داخل lib.offline.ts
const loPath = 'lib.offline.ts';
if (fs.existsSync(loPath)) {
  const rawLo = fs.readFileSync(loPath, 'utf8');
  const crlfLo = rawLo.includes('\r\n');
  let lo = crlfLo ? rawLo.replace(/\r\n/g, '\n') : rawLo;

  const oldPurchaseItemsBlock = [
    '        } else {',
    '          item.payload.items = validRows.map((r: any) => ({',
    '            modelCode: r.modelCode,',
    '            modelName: r.modelName,',
    '            quantity: r.quantity,',
    '            priceUnit: r.priceUnit,',
    '            description: r.description,',
    '          }));',
    '        }'
  ].join('\n');

  const newPurchaseItemsBlock = [
    '        } else {',
    '          const _invDisc = Number((rows[0] && (rows[0].invoiceDiscount ?? rows[0].invoice_discount)) ?? item.payload.invoiceDiscount ?? item.payload.invoice_discount) || 0;',
    '          item.payload.invoiceDiscount = _invDisc;',
    '          item.payload.invoice_discount = _invDisc;',
    '          const _holder = String((rows[0] && (rows[0].accountHolder ?? rows[0].account_holder)) ?? item.payload.payerName ?? item.payload.accountHolder ?? \'\').trim();',
    '          const _holderCode = String((rows[0] && (rows[0].accountHolderCode ?? rows[0].payer_code)) ?? item.payload.payerCode ?? \'\').trim();',
    '          if (_holder) { item.payload.payerName = _holder; item.payload.accountHolder = _holder; }',
    '          if (_holderCode) { item.payload.payerCode = _holderCode; item.payload.accountHolderCode = _holderCode; }',
    '          item.payload.items = validRows.map((r: any) => ({',
    '            modelCode: r.modelCode,',
    '            modelName: r.modelName,',
    '            quantity: r.quantity,',
    '            priceUnit: r.priceUnit,',
    '            payment: r.payment,',
    '            discount: Number(r.discount) || 0,',
    '            discountEnabled: !!(r.discountEnabled || Number(r.discount) > 0),',
    '            discount_base_unit: Number(r.discount_base_unit ?? r.discount) || 0,',
    '            discount_pack_unit: Number(r.discount_pack_unit) || 0,',
    '            invoiceDiscount: _invDisc,',
    '            invoice_discount: _invDisc,',
    '            depositDate: r.depositDate || r.deposit_date || \'\',',
    '            bankName: r.bankName || r.bank_name || \'\',',
    '            accountHolder: String(r.accountHolder || r.account_holder || _holder || \'\').trim(),',
    '            accountHolderCode: String(r.accountHolderCode || r.payer_code || _holderCode || \'\').trim(),',
    '            payer_code: String(r.accountHolderCode || r.payer_code || _holderCode || \'\').trim(),',
    '            description: r.description,',
    '          }));',
    '        }'
  ].join('\n');

  if (lo.includes(oldPurchaseItemsBlock)) {
    lo = lo.replace(oldPurchaseItemsBlock, newPurchaseItemsBlock);
  }

  saveSafe(loPath, crlfLo ? lo.replace(/\n/g, '\r\n') : lo, ['typescript']);
}