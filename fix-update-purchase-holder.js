const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

const loPath = 'lib.offline.ts';
const raw = fs.readFileSync(loPath, 'utf8');
const crlf = raw.includes('\r\n');
let lo = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const targetStart = lo.indexOf('export async function updatePurchase(');
if (targetStart < 0) throw new Error('updatePurchase not found');

const blockStart = lo.indexOf('const newRows = payload.rows.filter', targetStart);
const blockEnd = lo.indexOf('await setLocal(\'purchases\'', blockStart);
if (blockStart < 0 || blockEnd < 0) throw new Error('newRows block not found');

const replacement = [
  'const _invDiscVal = meta.invoiceDiscount !== undefined ? Number(meta.invoiceDiscount) || 0 : (Number(template.invoice_discount ?? template.invoiceDiscount) || 0);',
  'const newRows = payload.rows.filter((r: any) => !r._deleted).map((r: any) => {',
  '  const _holder = String((r && (r.accountHolder ?? r.account_holder)) ?? meta.payerName ?? meta.holder ?? meta.accountHolder ?? template.account_holder ?? template.payer_name ?? \'\').trim();',
  '  const _holderCode = String((r && (r.accountHolderCode ?? r.payer_code)) ?? meta.payerCode ?? meta.holderCode ?? template.account_holder_code ?? template.payer_code ?? \'\').trim();',
  '  const _discVal = Number(r.discount ?? r.discount_base_unit) || 0;',
  '  return {',
  '    ...template,',
  '    invoice_number: payload.invoiceNumber,',
  '    invoice_discount: _invDiscVal,',
  '    invoiceDiscount: _invDiscVal,',
  '    supplier_name: meta.name || template.supplier_name || \'\',',
  '    supplier_code: meta.code || template.supplier_code || \'\',',
  '    supplier_phone: meta.phone || template.supplier_phone || \'\',',
  '    manual_invoice: meta.manualInv || template.manual_invoice || \'\',',
  '    account_holder: _holder,',
  '    accountHolder: _holder,',
  '    payer_name: _holder,',
  '    account_holder_code: _holderCode,',
  '    payer_code: _holderCode,',
  '    model_code: r.modelCode || \'\',',
  '    model_name: r.modelName || \'\',',
  '    quantity: Number(r.quantity) || 0,',
  '    price_unit: Number(r.priceUnit) || 0,',
  '    payment: Number(r.payment) || 0,',
  '    discount: _discVal,',
  '    discount_base_unit: Number(r.discount_base_unit ?? _discVal) || 0,',
  '    discount_pack_unit: Number(r.discount_pack_unit) || 0,',
  '    discount_enabled: r.discountEnabled || _discVal > 0 ? 1 : 0,',
  '    description: r.description || \'\',',
  '    deposit_date: r.depositDate || r.deposit_date || template.deposit_date || \'\',',
  '    bank_name: r.bankName || r.bank_name || template.bank_name || \'\',',
  '    updated_at: now,',
  '    device_id: dev || template.device_id || \'\',',
  '  };',
  '});\n'
].join('\n');

const updated = lo.slice(0, blockStart) + replacement + lo.slice(blockEnd);
const backup = loPath + '.bak-holder-' + Date.now();
fs.copyFileSync(loPath, backup);

if (parser) {
  try {
    parser.parse(updated, { sourceType: 'module', plugins: ['typescript'] });
  } catch (e) {
    fs.copyFileSync(backup, loPath);
    throw new Error('Syntax check failed: ' + e.message);
  }
}

fs.writeFileSync(loPath, crlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
console.log('✅ updatePurchase holder & discounts fixed. Backup:', backup);