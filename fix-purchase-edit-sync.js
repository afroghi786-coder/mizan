const fs = require('fs');

function backupFile(file) {
  if (!fs.existsSync(file)) return;
  const prefix = file + '.bak-pur-sync-';
  if (!fs.readdirSync('.').some((f) => f.startsWith(prefix))) {
    fs.copyFileSync(file, prefix + Date.now());
  }
}

// 1) lib.offline.ts: جلوگیری از کسر مضاعف تخفیف در searchAllInvoices برای فاکتورهای خریدِ ازپیش‌خالص‌شده
{
  const file = 'lib.offline.ts';
  if (fs.existsSync(file)) {
    backupFile(file);
    let src = fs.readFileSync(file, 'utf8');

    const oldApply = `const __applyDisc = (r: any) => {
  const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;
  const rowDisc = __rowDiscByInv[String(r && r.invoice || '').trim()] || 0;
  const t = Number(r.total) || 0;
  const net = t - inv - rowDisc;
  if (!inv && !rowDisc) return r;
  return { ...r, total: net, invoiceDiscount: inv, rowDiscount: rowDisc };
};`;

    const newApply = `const __applyDisc = (r: any, type?: string) => {
  const inv = Number(r && (r.invoiceDiscount ?? r.invoice_discount)) || 0;
  const rowDisc = __rowDiscByInv[String(r && r.invoice || '').trim()] || 0;
  const t = Number(r.total) || 0;
  const alreadyNet = type === 'purchases' && r && r.discountTotal !== undefined;
  const net = alreadyNet ? t : Math.max(0, t - inv - rowDisc);
  if (!inv && !rowDisc && !alreadyNet) return r;
  return { ...r, total: net, invoiceDiscount: inv, rowDiscount: rowDisc };
};`;

    if (src.includes(oldApply)) {
      src = src.replace(oldApply, newApply);
      src = src.replace(
        'arr.map((r) => ({ ...__applyDisc(r), type, sheetType: type }))',
        'arr.map((r) => ({ ...__applyDisc(r, type), type, sheetType: type }))'
      );
      fs.writeFileSync(file, src, 'utf8');
      console.log('Updated searchAllInvoices discount calculation in lib.offline.ts');
    }
  }
}

// 2) App.tsx: تضمین هم‌خوانی invoiceDiscount و تخفیف ردیفی در openEdit و آپدیت لیست پس از save
{
  const file = 'App.tsx';
  if (fs.existsSync(file)) {
    backupFile(file);
    let src = fs.readFileSync(file, 'utf8');

    const oldListMap = `      setList((prev: any[]) => prev.map((x: any) => x.invoice === editing.invoice
        ? { ...x, total: newTotal, paid: newPaid, name: editing.name, phone: editing.phone }
        : x));`;

    const newListMap = `      setList((prev: any[]) => prev.map((x: any) => x.invoice === editing.invoice
        ? { ...x, total: newTotal, paid: newPaid, invoiceDiscount: _invDisc, invoice_discount: _invDisc, rowDiscount: _rowDisc, name: editing.name, phone: editing.phone }
        : x));`;

    if (src.includes(oldListMap)) {
      src = src.replace(oldListMap, newListMap);
      fs.writeFileSync(file, src, 'utf8');
      console.log('Updated local list sync in App.tsx');
    }
  }
}