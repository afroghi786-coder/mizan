const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

const filePath = 'lib.offline.ts';
const raw = fs.readFileSync(filePath, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const fnStart = src.indexOf('function _groupPurchaseRows(rows: any[])');
if (fnStart < 0) {
  throw new Error('Could not find _groupPurchaseRows');
}

const nextFn = src.indexOf('\n// ═══', fnStart + 10);
if (nextFn < 0) {
  throw new Error('Could not find end of _groupPurchaseRows');
}

const cleanFn = [
  'function _groupPurchaseRows(rows: any[]) {',
  '  const groups: Record<string, any> = {};',
  '  const _num = (v: any) => {',
  '    if (typeof v === \'number\') return Number.isFinite(v) ? v : 0;',
  '    const cleaned = String(v ?? \'\')',
  '      .replace(/,/g, \'\')',
  '      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))',
  '      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));',
  '    const n = Number(cleaned.replace(/[^0-9.-]/g, \'\'));',
  '    return Number.isFinite(n) ? n : 0;',
  '  };',
  '  for (const r of rows || []) {',
  '    const inv = String((r && r.invoice_number) || \'\').trim();',
  '    if (!inv) continue;',
  '    const rowHolder = String((r && (r.account_holder ?? r.accountHolder)) || \'\').trim();',
  '    const rowHolderCode = String((r && (r.payer_code ?? r.account_holder_code ?? r.accountHolderCode)) || \'\').trim();',
  '    if (!groups[inv]) {',
  '      groups[inv] = {',
  '        invoice: inv,',
  '        local_id: \'grp_purchase_\' + inv,',
  '        manual: (r && r.manual_invoice) || \'\',',
  '        name: (r && r.supplier_name) || \'\',',
  '        phone: (r && r.supplier_phone) || \'\',',
  '        supplierCode: (r && r.supplier_code) || \'\',',
  '        bank: (r && r.bank_name) || \'\',',
  '        holder: rowHolder,',
  '        accountHolder: rowHolder,',
  '        holderCode: rowHolderCode,',
  '        depositDate: (r && r.deposit_date) || \'\',',
  '        shipping: (r && r.shipping) || \'\',',
  '        total: 0,',
  '        paid: 0,',
  '        rowDiscount: 0,',
  '        invoiceDiscount: _num(r && (r.invoice_discount ?? r.invoiceDiscount)),',
  '        invoice_discount: _num(r && (r.invoice_discount ?? r.invoiceDiscount)),',
  '        items: [],',
  '        date: (r && (r.date_reg || r.date_factor || r.created_at)) || \'\',',
  '        updated_at: (r && (r.updated_at || r.updatedAt)) || \'\',',
  '        device_id: (r && r.device_id) || \'\',',
  '      };',
  '    }',
  '    const g = groups[inv];',
  '    const qty = _num(r && r.quantity);',
  '    const price = _num(r && r.price_unit);',
  '    const discPer = _num(r && (r.discount ?? r.discount_base_unit));',
  '    const rowDiscAmt = Math.abs(qty * discPer);',
  '    const invDiscAmt = _num(r && (r.invoice_discount ?? r.invoiceDiscount));',
  '    g.rowDiscount = (_num(g.rowDiscount) + rowDiscAmt);',
  '    if (invDiscAmt) {',
  '      g.invoiceDiscount = invDiscAmt;',
  '      g.invoice_discount = invDiscAmt;',
  '    }',
  '    g.total = Math.max(0, _num(g.total) + qty * price - rowDiscAmt);',
  '    g.paid = _num(g.paid) + _num(r && r.payment);',
  '    g.items.push(r);',
  '    if (r && r.supplier_name) g.name = r.supplier_name;',
  '    if (r && r.supplier_phone) g.phone = r.supplier_phone;',
  '    if (!g.supplierCode && r && r.supplier_code) g.supplierCode = r.supplier_code;',
  '    if (!g.manual && r && r.manual_invoice) g.manual = r.manual_invoice;',
  '    if (rowHolder) {',
  '      g.holder = rowHolder;',
  '      g.accountHolder = rowHolder;',
  '    }',
  '    if (rowHolderCode) g.holderCode = rowHolderCode;',
  '    const rUp = (r && (r.updated_at || r.updatedAt)) || \'\';',
  '    if (rUp && String(rUp) > String(g.updated_at || \'\')) g.updated_at = rUp;',
  '  }',
  '  return Object.values(groups);',
  '}'
].join('\n');

const updated = src.slice(0, fnStart) + cleanFn + src.slice(nextFn);
const backup = filePath + '.bak-grp-' + Date.now();
fs.copyFileSync(filePath, backup);

if (parser) {
  try {
    parser.parse(updated, { sourceType: 'module', plugins: ['typescript'] });
  } catch (err) {
    fs.copyFileSync(backup, filePath);
    throw new Error('Syntax check failed: ' + err.message);
  }
}

fs.writeFileSync(filePath, crlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
console.log('✅ _groupPurchaseRows updated cleanly. Backup:', backup);