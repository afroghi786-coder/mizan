const fs=require('fs');
const file='lib.offline.ts';
const baks=fs.readdirSync('.').filter(f=>f.startsWith(file+'.bak-purfix-')).sort();
if(baks.length){const latest=baks[baks.length-1];fs.copyFileSync(latest,file);console.log('Restored from:',latest);}
let src=fs.readFileSync(file,'utf8');
src=src.replace(/(\{\s*\.\.\.r,\s*total:\s*[^,}]+,\s*invoiceDiscount:\s*inv,\s*invoice_discount:\s*inv,\s*)rowDiscount(\s*\})/g,'$1rowDiscount: rowDisc$2');
fs.writeFileSync(file,src,'utf8');
console.log('Fixed rowDiscount: rowDisc cleanly.');