const fs = require('fs');

function backupFile(filePath, tag) {
  const baks = fs.readdirSync('.').filter((f) => f.startsWith(filePath + '.bak-' + tag + '-'));
  if (baks.length === 0) {
    fs.copyFileSync(filePath, filePath + '.bak-' + tag + '-' + Date.now());
  }
}

backupFile('lib.offline.ts', 'pdisc');
backupFile('App.tsx', 'pdisc');

let lo = fs.readFileSync('lib.offline.ts', 'utf8');

const qPurchaseTarget = `          price_unit: it.priceUnit,
          payment: (() => {`;
const qPurchaseReplacement = `          price_unit: it.priceUnit,
          discount: Number(it.discount) || 0,
          discount_enabled: it.discountEnabled ? 1 : 0,
          discount_base_unit: Number(it.discount_base_unit) || 0,
          discount_pack_unit: Number(it.discount_pack_unit) || 0,
          invoice_discount: Number(p.invoiceDiscount || p.invoice_discount) || 0,
          payment: (() => {`;

if (!lo.includes(qPurchaseTarget)) {
  console.error('Could not find createPurchase block in lib.offline.ts');
  process.exit(1);
}
lo = lo.replace(qPurchaseTarget, qPurchaseReplacement);

const updPurchaseTarget = `    const total = newRows.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0);
    const paid = newRows.reduce((sum: number, r: any) => sum + (Number(r.payment) || 0), 0);
    const groupedObj: any = {
      invoice: payload.invoiceNumber,
      date: meta.date || template.date_factor || now,
      name: meta.name || template.supplier_name || '',
      phone: meta.phone || template.supplier_phone || '',
      supplierCode: meta.code || template.supplier_code || '',
      total,
      paid,
      manual: meta.manualInv || template.manual_invoice || '',
      bank: meta.bank || template.bank_name || '',
      holder: meta.holder || template.account_holder || '',
      holderCode: meta.holderCode || template.account_holder_code || '',
      depositDate: meta.depositDate || template.deposit_date || '',
      shipping: meta.shipping || template.shipping || '',
      local_id: 'grp_purchase_' + payload.invoiceNumber,
      updated_at: now,
      deleted_at: '',
      device_id: dev,
      items: newRows.map((r: any) => ({
        modelCode: r.model_code,
        modelName: r.model_name,
        quantity: Number(r.quantity) || 0,
        priceUnit: Number(r.price_unit) || 0,
        payment: Number(r.payment) || 0,
        description: r.description || '',
        shelf: r.shelf || '',
      })),
    };`;

const updPurchaseReplacement = `    const invDiscVal = meta.invoiceDiscount !== undefined ? Number(meta.invoiceDiscount) || 0 : (Number(template.invoice_discount) || 0);
    const rowDiscSum = newRows.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0) * (Number(r.discount) || 0), 0);
    const grossTotal = newRows.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0) * (Number(r.price_unit) || 0), 0);
    const total = Math.max(0, grossTotal - rowDiscSum - invDiscVal);
    const paid = newRows.reduce((sum: number, r: any) => sum + (Number(r.payment) || 0), 0);
    const groupedObj: any = {
      invoice: payload.invoiceNumber,
      date: meta.date || template.date_factor || now,
      name: meta.name || template.supplier_name || '',
      phone: meta.phone || template.supplier_phone || '',
      supplierCode: meta.code || template.supplier_code || '',
      total,
      paid,
      invoiceDiscount: invDiscVal,
      invoice_discount: invDiscVal,
      discountTotal: rowDiscSum + invDiscVal,
      manual: meta.manualInv || template.manual_invoice || '',
      bank: meta.bank || template.bank_name || '',
      holder: meta.holder || template.account_holder || '',
      holderCode: meta.holderCode || template.account_holder_code || '',
      depositDate: meta.depositDate || template.deposit_date || '',
      shipping: meta.shipping || template.shipping || '',
      local_id: 'grp_purchase_' + payload.invoiceNumber,
      updated_at: now,
      deleted_at: '',
      device_id: dev,
      items: newRows.map((r: any) => ({
        modelCode: r.model_code,
        modelName: r.model_name,
        quantity: Number(r.quantity) || 0,
        priceUnit: Number(r.price_unit) || 0,
        discount: Number(r.discount) || 0,
        discount_base_unit: Number(r.discount_base_unit) || 0,
        discount_pack_unit: Number(r.discount_pack_unit) || 0,
        invoice_discount: invDiscVal,
        payment: Number(r.payment) || 0,
        description: r.description || '',
        shelf: r.shelf || '',
      })),
    };`;

if (!lo.includes(updPurchaseTarget)) {
  console.error('Could not find updatePurchase grouped block in lib.offline.ts');
  process.exit(1);
}
lo = lo.replace(updPurchaseTarget, updPurchaseReplacement);
fs.writeFileSync('lib.offline.ts', lo, 'utf8');

let ap = fs.readFileSync('App.tsx', 'utf8');
const appTarget = `      const validRows = editRows.filter((r: any) => !r._deleted);
      const newTotal = validRows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0), 0);`;
const appReplacement = `      const validRows = editRows.filter((r: any) => !r._deleted);
      const _rowDisc = validRows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.discount) || 0), 0);
      const _invDisc = Number(editing.invoiceDiscount) || 0;
      const newTotal = Math.max(0, validRows.reduce((a: number, r: any) => a + (Number(r.quantity) || 0) * (Number(r.priceUnit) || 0), 0) - _rowDisc - _invDisc);`;

if (!ap.includes(appTarget)) {
  console.error('Could not find newTotal block in App.tsx');
  process.exit(1);
}
ap = ap.replace(appTarget, appReplacement);
fs.writeFileSync('App.tsx', ap, 'utf8');

console.log('Purchase discount fix applied safely with backups.');