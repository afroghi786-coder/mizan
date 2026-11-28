const fs = require('fs');

function backupOnce(file) {
  if (!fs.existsSync(file)) return;
  const tag = file + '.bak-pur-grp-';
  if (!fs.readdirSync('.').some((f) => f.startsWith(tag))) {
    fs.copyFileSync(file, tag + Date.now());
  }
}

// 1) lib.offline.ts: هم‌تراز کردن _groupPurchaseRows با _groupSalesRows برای invoiceDiscount
{
  const file = 'lib.offline.ts';
  if (fs.existsSync(file)) {
    backupOnce(file);
    let src = fs.readFileSync(file, 'utf8');

    const targetInit = `        depositDate: r.deposit_date || '',
        shipping: r.shipping || '',
        total: 0, paid: 0, items: [],`;

    const replInit = `        depositDate: r.deposit_date || '',
        shipping: r.shipping || '',
        invoiceDiscount: 0, invoice_discount: 0,
        total: 0, paid: 0, items: [],`;

    if (src.includes(targetInit) && !src.includes('invoiceDiscount: 0, invoice_discount: 0,\n        total: 0, paid: 0, items: [],')) {
      src = src.replace(targetInit, replInit);
    }

    const targetLoop = `      if (!g.depositDate && r.deposit_date) g.depositDate = r.deposit_date;
      if (!g.shipping && r.shipping) g.shipping = r.shipping;
      const rUpdP = String(r.updated_at || r.updatedAt || '');`;

    const replLoop = `      if (!g.depositDate && r.deposit_date) g.depositDate = r.deposit_date;
      if (!g.shipping && r.shipping) g.shipping = r.shipping;
      const _pInvD = Number(r.invoice_discount ?? r.invoiceDiscount) || 0;
      if (_pInvD > (Number(g.invoiceDiscount) || 0)) {
        g.invoiceDiscount = _pInvD;
        g.invoice_discount = _pInvD;
      }
      const rUpdP = String(r.updated_at || r.updatedAt || '');`;

    if (src.includes(targetLoop) && !src.includes('_pInvD')) {
      src = src.replace(targetLoop, replLoop);
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('Updated _groupPurchaseRows in lib.offline.ts');
  }
}