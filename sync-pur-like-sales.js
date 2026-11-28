const fs = require('fs');

function backupOnce(file) {
  if (!fs.existsSync(file)) return;
  const tag = file + '.bak-pur-sales-';
  if (!fs.readdirSync('.').some((f) => f.startsWith(tag))) {
    fs.copyFileSync(file, tag + Date.now());
  }
}

const file = 'lib.offline.ts';
if (fs.existsSync(file)) {
  backupOnce(file);
  let src = fs.readFileSync(file, 'utf8');

  // 1) در searchAllInvoices: برای خرید (که در purchases_grouped ممکن است total قبلاً خالص شده باشد) کسر مضاعف انجام نشود
  src = src.replace(
    /const __applyDisc = \(r: any[\s\S]*?\n\};/,
    `const __applyDisc = (r: any, type?: string) => {
  const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;
  const rowDisc = __rowDiscByInv[String(r && r.invoice || '').trim()] || 0;
  const t = Number(r && r.total) || 0;
  if (type === 'purchases') {
    const gross = (Array.isArray(r && r.items) && r.items.length)
      ? r.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.price_unit ?? it.priceUnit) || 0), 0)
      : 0;
    const netFromGross = gross > 0 ? Math.max(0, gross - inv - rowDisc) : t;
    return { ...r, total: netFromGross, invoiceDiscount: inv, rowDiscount: rowDisc };
  }
  const net = Math.max(0, t - inv - rowDisc);
  if (!inv && !rowDisc) return r;
  return { ...r, total: net, invoiceDiscount: inv, rowDiscount: rowDisc };
};`
  );

  src = src.replace(
    'arr.map((r) => ({ ...__applyDisc(r), type, sheetType: type }))',
    'arr.map((r) => ({ ...__applyDisc(r, type), type, sheetType: type }))'
  );

  fs.writeFileSync(file, src, 'utf8');
  console.log('Synced purchase calculation in searchAllInvoices with sales pattern.');
}