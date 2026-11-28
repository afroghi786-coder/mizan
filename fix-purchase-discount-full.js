const fs = require('fs');

function backupOnce(file) {
  if (!fs.existsSync(file)) return;
  const hasBak = fs.readdirSync('.').some((f) => f.startsWith(file + '.bak-fullfix-'));
  if (!hasBak) {
    fs.copyFileSync(file, file + '.bak-fullfix-' + Date.now());
  }
}

// 1) lib.offline.ts: اطمینان از انتقال discount و invoice_discount در getInvoiceDetail و searchAllInvoices
{
  const file = 'lib.offline.ts';
  if (fs.existsSync(file)) {
    backupOnce(file);
    let src = fs.readFileSync(file, 'utf8');
    let changed = false;

    // در fallback گروهی getInvoiceDetail: اگر discount و invoice_discount نبود اضافه شود
    const gTarget = `        price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
        payment: idx === 0 ? (Number(g.paid) || 0) : 0,`;
    const gRepl = `        price_unit: Number(it.priceUnit != null ? it.priceUnit : it.price_unit) || 0,
        discount: Number(it.discount) || 0,
        discount_enabled: it.discount_enabled ? 1 : (it.discountEnabled ? 1 : 0),
        discount_base_unit: Number(it.discount_base_unit) || 0,
        discount_pack_unit: Number(it.discount_pack_unit) || 0,
        invoice_discount: Number(it.invoice_discount ?? it.invoiceDiscount ?? g.invoice_discount ?? g.invoiceDiscount) || 0,
        payment: idx === 0 ? (Number(g.paid) || 0) : 0,`;
    if (src.includes(gTarget) && !src.includes('invoice_discount: Number(it.invoice_discount')) {
      src = src.replace(gTarget, gRepl);
      changed = true;
    }

    // چاپ خلاصه خطوط کلیدی searchAllInvoices برای اطمینان
    const lines = src.split(/\r?\n/);
    const sIdx = lines.findIndex((l) => l.includes('searchAllInvoices'));
    if (sIdx >= 0) {
      console.log('--- searchAllInvoices snippet ---');
      for (let i = sIdx; i < Math.min(lines.length, sIdx + 90); i++) {
        if (/discount|Discount|total|purchases|grouped/i.test(lines[i])) {
          console.log((i + 1) + ': ' + lines[i].trim());
        }
      }
    }

    if (changed) {
      fs.writeFileSync(file, src, 'utf8');
      console.log('Updated lib.offline.ts');
    }
  }
}

// 2) App.tsx: اطمینان از مقداردهی invoiceDiscount در openEdit
{
  const file = 'App.tsx';
  if (fs.existsSync(file)) {
    backupOnce(file);
    let src = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (!src.includes('__firstInvDisc') && src.includes('setEditing({')) {
      src = src.replace(
        '      setEditing({',
        '      const __firstInvDisc = rows.reduce((m: number, x: any) => Math.max(m, Number(x && (x.invoice_discount ?? x.invoiceDiscount)) || 0), 0);\n      setEditing({'
      );
      changed = true;
    }

    if (src.includes('invoiceDiscount:') && !src.includes('__firstInvDisc || 0')) {
      src = src.replace(
        /invoiceDiscount:[^\n]+\n/,
        '        invoiceDiscount: Number(invObj && (invObj.invoiceDiscount ?? invObj.invoice_discount)) || __firstInvDisc || 0,\n'
      );
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, src, 'utf8');
      console.log('Updated App.tsx');
    }
  }
}