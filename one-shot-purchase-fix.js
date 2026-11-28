const fs = require('fs');
let parser = null;
try { parser = require('@babel/parser'); } catch {}

function writeSafe(filePath, content, plugins) {
  const backup = filePath + '.bak-oneshot-' + Date.now();
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
  console.log('✅ Updated:', filePath, '| Backup:', backup);
}

const numHelper = [
  'const __toNum = (v: any) => {',
  '  if (typeof v === \'number\') return Number.isFinite(v) ? v : 0;',
  '  const s = String(v ?? \'\')',
  '    .replace(/,/g, \'\')',
  '    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))',
  '    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));',
  '  const n = Number(s.replace(/[^0-9.-]/g, \'\'));',
  '  return Number.isFinite(n) ? n : 0;',
  '};'
].join('\n');

// 1) تکمیل getInvoiceDetail برای خرید در lib.offline.ts
const loPath = 'lib.offline.ts';
if (fs.existsSync(loPath)) {
  const raw = fs.readFileSync(loPath, 'utf8');
  const crlf = raw.includes('\r\n');
  let lo = crlf ? raw.replace(/\r\n/g, '\n') : raw;

  const gdStart = lo.indexOf('export async function getInvoiceDetail');
  const gdEnd = gdStart >= 0 ? lo.indexOf('\n// ═══', gdStart + 20) : -1;

  if (gdStart >= 0 && gdEnd > gdStart) {
    const cleanGetDetail = [
      'export async function getInvoiceDetail(invoiceNumber: string, type?: string) {',
      '  ' + numHelper.replace(/\n/g, '\n  '),
      '  const targetInv = String(invoiceNumber || \'\').trim();',
      '  const isPurchase = type === \'purchase\' || type === \'purchases\' || targetInv.toUpperCase().startsWith(\'P-\');',
      '  const queue = await getQueue();',
      '  for (const item of queue) {',
      '    if ((item.op === \'updatePurchase\' || item.op === \'createPurchase\') && String(item.payload?.invoiceNumber || \'\').trim() === targetInv) {',
      '      const p = item.payload || {};',
      '      const m = p.meta || {};',
      '      const invDisc = __toNum(m.invoiceDiscount ?? m.invoice_discount ?? p.invoiceDiscount ?? p.invoice_discount);',
      '      const holder = String(m.holder ?? m.payerName ?? m.accountHolder ?? p.payerName ?? p.accountHolder ?? \'\').trim();',
      '      const holderCode = String(m.holderCode ?? m.payerCode ?? m.accountHolderCode ?? p.payerCode ?? \'\').trim();',
      '      if (Array.isArray(p.rows) && p.rows.length) {',
      '        return p.rows.filter((r: any) => !r._deleted).map((r: any, idx: number) => ({',
      '          id: r.rowId || r.id || (\'q_pur_\' + idx),',
      '          invoice_number: targetInv,',
      '          supplier_code: _normCode(m.code ?? p.supplierCode),',
      '          supplier_name: m.name ?? p.supplierName ?? \'\',',
      '          supplier_phone: m.phone ?? p.supplierPhone ?? \'\',',
      '          manual_invoice: m.manualInv ?? p.manualInvoice ?? \'\',',
      '          model_code: r.modelCode || r.model_code || \'\',',
      '          model_name: r.modelName || r.model_name || \'\',',
      '          quantity: __toNum(r.quantity),',
      '          price_unit: __toNum(r.priceUnit ?? r.price_unit),',
      '          payment: __toNum(r.payment),',
      '          discount: __toNum(r.discount),',
      '          discount_enabled: r.discountEnabled || __toNum(r.discount) > 0 ? 1 : 0,',
      '          discount_base_unit: __toNum(r.discount_base_unit ?? r.discount),',
      '          discount_pack_unit: __toNum(r.discount_pack_unit),',
      '          invoice_discount: invDisc,',
      '          description: r.description || \'\',',
      '          deposit_date: r.depositDate || r.deposit_date || \'\',',
      '          bank_name: r.bankName || r.bank_name || \'\',',
      '          account_holder: String(r.accountHolder || r.account_holder || holder || \'\').trim(),',
      '          account_holder_code: String(r.accountHolderCode || r.account_holder_code || holderCode || \'\').trim(),',
      '          payer_code: String(r.accountHolderCode || r.payer_code || holderCode || \'\').trim(),',
      '          shelf: r.shelf || \'\',',
      '        }));',
      '      }',
      '      if (Array.isArray(p.items) && p.items.length) {',
      '        return p.items.map((it: any, idx: number) => ({',
      '          id: \'q_pitem_\' + idx,',
      '          invoice_number: targetInv,',
      '          supplier_code: _normCode(p.supplierCode),',
      '          supplier_name: p.supplierName || \'\',',
      '          supplier_phone: p.supplierPhone || \'\',',
      '          manual_invoice: p.manualInvoice || \'\',',
      '          model_code: it.modelCode || it.model_code || \'\',',
      '          model_name: it.modelName || it.model_name || \'\',',
      '          quantity: __toNum(it.quantity),',
      '          price_unit: __toNum(it.priceUnit ?? it.price_unit),',
      '          payment: __toNum(it.payment),',
      '          discount: __toNum(it.discount),',
      '          discount_enabled: it.discountEnabled || __toNum(it.discount) > 0 ? 1 : 0,',
      '          discount_base_unit: __toNum(it.discount_base_unit ?? it.discount),',
      '          discount_pack_unit: __toNum(it.discount_pack_unit),',
      '          invoice_discount: invDisc,',
      '          description: it.description || \'\',',
      '          deposit_date: it.depositDate || it.deposit_date || p.depositDate || \'\',',
      '          bank_name: it.bankName || it.bank_name || p.bankName || \'\',',
      '          account_holder: String(it.accountHolder || it.account_holder || holder || \'\').trim(),',
      '          account_holder_code: String(it.accountHolderCode || it.account_holder_code || holderCode || \'\').trim(),',
      '          payer_code: String(it.accountHolderCode || it.payer_code || holderCode || \'\').trim(),',
      '          shelf: it.shelf || \'\',',
      '        }));',
      '      }',
      '    }',
      '  }',
      '  if (isPurchase) {',
      '    const pRows = ((await getLocal<any[]>(\'purchases\')) || []).filter((r: any) => String(r && r.invoice_number || \'\').trim() === targetInv);',
      '    const gList = (await getLocal<any[]>(\'purchases_grouped\')) || [];',
      '    const grp = gList.find((g: any) => String(g && g.invoice || \'\').trim() === targetInv);',
      '    if (pRows.length) {',
      '      const grpInvDisc = __toNum(grp && (grp.invoiceDiscount ?? grp.invoice_discount));',
      '      const grpHolder = String((grp && (grp.holder ?? grp.accountHolder)) || \'\').trim();',
      '      const grpHolderCode = String((grp && (grp.holderCode ?? grp.accountHolderCode)) || \'\').trim();',
      '      return pRows.map((r: any, idx: number) => {',
      '        const rowDisc = __toNum(r.discount ?? r.discount_base_unit);',
      '        const invDisc = __toNum(r.invoice_discount ?? r.invoiceDiscount) || grpInvDisc;',
      '        const h = String(r.account_holder || r.accountHolder || grpHolder || \'\').trim();',
      '        const hc = String(r.account_holder_code || r.payer_code || grpHolderCode || \'\').trim();',
      '        return {',
      '          ...r,',
      '          id: r.id || (\'p_row_\' + idx),',
      '          invoice_number: targetInv,',
      '          discount: rowDisc,',
      '          discount_enabled: r.discount_enabled || rowDisc > 0 ? 1 : 0,',
      '          invoice_discount: invDisc,',
      '          account_holder: h,',
      '          account_holder_code: hc,',
      '          payer_code: hc,',
      '        };',
      '      });',
      '    }',
      '  }',
      '  const baseDetail = await (async () => {',
      '    for (const item of queue) {',
      '      if (item.op === \'createSale\' && String(item.payload?.invoiceNumber || \'\').trim() === targetInv) {',
      '        const p = item.payload;',
      '        return (p.items || []).map((it: any, idx: number) => ({',
      '          id: \'queued_\' + idx,',
      '          invoice_number: p.invoiceNumber,',
      '          customer_code: _normCode(p.customerCode),',
      '          customer_name: p.customerName,',
      '          customer_phone: p.customerPhone,',
      '          customer_address: p.customerAddress,',
      '          receiver_name: p.receiverName || \'\',',
      '          receiver_code: p.receiverCode || \'\',',
      '          receiver_bank: p.receiverBank || \'\',',
      '          receiver_account: p.receiverAccount || \'\',',
      '          model_code: it.modelCode,',
      '          model_name: it.modelName,',
      '          quantity: it.quantity,',
      '          price_unit: it.priceUnit,',
      '          payment: it.payment,',
      '          discount: it.discount || 0,',
      '          invoice_discount: p.invoiceDiscount || 0,',
      '          description: it.description || \'\',',
      '        }));',
      '      }',
      '    }',
      '    const sRows = ((await getLocal<any[]>(\'sales\')) || []).filter((r: any) => String(r && r.invoice_number || \'\').trim() === targetInv);',
      '    if (sRows.length) return sRows;',
      '    const allPur = ((await getLocal<any[]>(\'purchases\')) || []).filter((r: any) => String(r && r.invoice_number || \'\').trim() === targetInv);',
      '    return allPur;',
      '  })();',
      '  return baseDetail;',
      '}'
    ].join('\n');

    lo = lo.slice(0, gdStart) + cleanGetDetail + lo.slice(gdEnd);
  }

  writeSafe(loPath, crlf ? lo.replace(/\n/g, '\r\n') : lo, ['typescript']);
}

// 2) همگام‌سازی openEdit و ذخیره در App.tsx
const apPath = 'App.tsx';
if (fs.existsSync(apPath)) {
  const rawAp = fs.readFileSync(apPath, 'utf8');
  const crlfAp = rawAp.includes('\r\n');
  let ap = crlfAp ? rawAp.replace(/\r\n/g, '\n') : rawAp;

  ap = ap.replace(
    /accountHolder:\s*r\.account_holder\s*\|\|\s*r\.receiver_name\s*\|\|\s*''\s*,/,
    'accountHolder: String(r.account_holder || r.accountHolder || r.receiver_name || \'\').trim(),'
  );

  ap = ap.replace(
    /setList\(\(prev:\s*any\[\]\)\s*=>\s*prev\.map\(\(x:\s*any\)\s*=>\s*x\.invoice\s*===[\s\S]*?\)\);/,
    'setList((prev: any[]) => prev.map((x: any) => x.invoice === editing.invoice ? { ...x, total: newTotal, paid: newPaid, invoiceDiscount: _invDisc, invoice_discount: _invDisc, rowDiscount: _rowDisc, holder: validRows[0]?.accountHolder || editing.holder || x.holder || \'\', accountHolder: validRows[0]?.accountHolder || editing.accountHolder || x.accountHolder || \'\', name: editing.name, phone: editing.phone } : x));'
  );

  writeSafe(apPath, crlfAp ? ap.replace(/\n/g, '\r\n') : ap, ['jsx', 'typescript']);
}