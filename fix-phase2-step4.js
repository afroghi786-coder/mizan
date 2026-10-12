const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-step4-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. LiveMarketScreen.tsx — submitDirect
// ═══════════════════════════════════════════
let lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lmOrig = lm;
const lmWasCRLF = lm.includes('\r\n');
if (lmWasCRLF) lm = lm.replace(/\r\n/g, '\n');

// ─── submitDirect: اضافه createHawala بعد از sendDirectHawala ───
const sdOld = `      await sendDirectHawala({
        id,
        toEmail: directForm.toEmail,
        toName: directForm.toName,
        currency: directForm.currency,
        targetCurrency: directForm.targetCurrency,
        rateMode: directForm.rateMode,
        amount: Number(directForm.amount),
        to_amount: Number(directForm.to_amount) || 0,
        rate: Number(directForm.rate) || 0,
        beneficiaryName: directForm.beneficiaryName,
        beneficiaryPhone: directForm.beneficiaryPhone,
        beneficiary_city: directForm.beneficiary_city,
        beneficiary_bank: directForm.beneficiary_bank,
        beneficiary_holder: directForm.beneficiary_holder,
        sender_name: directForm.sender_name,
        sender_phone: directForm.sender_phone,
        sender_city: directForm.sender_city,
        sender_address: directForm.sender_address,
        commission: Number(directForm.commission) || 0,
        commission_percent: Number(directForm.commission_percent) || 0,
        note: directForm.note,
      });`;

const sdNew = `      const _res = await sendDirectHawala({
        id,
        toEmail: directForm.toEmail,
        toName: directForm.toName,
        currency: directForm.currency,
        targetCurrency: directForm.targetCurrency,
        rateMode: directForm.rateMode,
        amount: Number(directForm.amount),
        to_amount: Number(directForm.to_amount) || 0,
        rate: Number(directForm.rate) || 0,
        beneficiaryName: directForm.beneficiaryName,
        beneficiaryPhone: directForm.beneficiaryPhone,
        beneficiary_city: directForm.beneficiary_city,
        beneficiary_bank: directForm.beneficiary_bank,
        beneficiary_holder: directForm.beneficiary_holder,
        sender_name: directForm.sender_name,
        sender_phone: directForm.sender_phone,
        sender_city: directForm.sender_city,
        sender_address: directForm.sender_address,
        commission: Number(directForm.commission) || 0,
        commission_percent: Number(directForm.commission_percent) || 0,
        note: directForm.note,
      });
      // 🪞 کپی توی fx_hawalas (تب حواله‌جات فرستنده)
      try {
        const fx = await import('./lib.fx');
        const _p2pCode = _res?.code || '';
        const _exists = (await fx.getHawalas()).find((h: any) => h._p2p_id === id);
        if (!_exists) {
          await fx.createHawala({
            code: _p2pCode,
            direction: 'send',
            partner_code: directForm.toEmail || '',
            partner_name: directForm.toName || directForm.toEmail || '',
            beneficiary_name: directForm.beneficiaryName || '',
            beneficiary_phone: directForm.beneficiaryPhone || '',
            beneficiary_city: directForm.beneficiary_city || '',
            amount: Number(directForm.amount) || 0,
            currency: directForm.currency || 'USD',
            commission: Number(directForm.commission) || 0,
            total: (Number(directForm.amount) || 0) + (Number(directForm.commission) || 0),
            status: 'pending',
            date: new Date().toISOString(),
            note: directForm.note || '',
            _p2p_id: id,
            _p2p_type: 'direct',
            _p2p_source: 'P2P صرافی خصوصی',
          });
          console.log('✅ fx_hawalas برای فرستنده ساخته شد');
        }
      } catch (e: any) { console.log('fx_hawalas direct insert:', e?.message); }`;

if (lm.includes(sdOld)) {
  lm = lm.replace(sdOld, sdNew);
  console.log('✅ submitDirect آپدیت شد');
} else {
  console.log('⚠️ submitDirect الگو پیدا نشد');
}

// ─── submitHawala ───
const shOld = `      await sendBroadcastHawala({
        id,
        targetCity: hawalaForm.targetCity,
        currency: hawalaForm.currency,
        amount: Number(hawalaForm.amount),
        to_amount: Number(hawalaForm.to_amount) || 0,
        beneficiaryName: hawalaForm.beneficiaryName,
        beneficiaryPhone: hawalaForm.beneficiaryPhone,
        beneficiary_city: hawalaForm.beneficiary_city,
        beneficiary_bank: hawalaForm.beneficiary_bank,
        beneficiary_holder: hawalaForm.beneficiary_holder,
        sender_name: hawalaForm.sender_name,
        sender_phone: hawalaForm.sender_phone,
        sender_city: hawalaForm.sender_city,
        sender_address: hawalaForm.sender_address,
        maxFee: Number(hawalaForm.maxFee) || 2,
        expires: hawalaForm.expires,
        note: hawalaForm.note,
      });`;

const shNew = `      const _res = await sendBroadcastHawala({
        id,
        targetCity: hawalaForm.targetCity,
        currency: hawalaForm.currency,
        amount: Number(hawalaForm.amount),
        to_amount: Number(hawalaForm.to_amount) || 0,
        beneficiaryName: hawalaForm.beneficiaryName,
        beneficiaryPhone: hawalaForm.beneficiaryPhone,
        beneficiary_city: hawalaForm.beneficiary_city,
        beneficiary_bank: hawalaForm.beneficiary_bank,
        beneficiary_holder: hawalaForm.beneficiary_holder,
        sender_name: hawalaForm.sender_name,
        sender_phone: hawalaForm.sender_phone,
        sender_city: hawalaForm.sender_city,
        sender_address: hawalaForm.sender_address,
        maxFee: Number(hawalaForm.maxFee) || 2,
        expires: hawalaForm.expires,
        note: hawalaForm.note,
      });
      // 🪞 کپی توی fx_hawalas (تب حواله‌جات فرستنده — عمومی)
      try {
        const fx = await import('./lib.fx');
        const _p2pCode = _res?.code || '';
        const _exists = (await fx.getHawalas()).find((h: any) => h._p2p_id === id);
        if (!_exists) {
          await fx.createHawala({
            code: _p2pCode,
            direction: 'send',
            partner_code: '',
            partner_name: 'بازار عمومی',
            beneficiary_name: hawalaForm.beneficiaryName || '',
            beneficiary_phone: hawalaForm.beneficiaryPhone || '',
            beneficiary_city: hawalaForm.beneficiary_city || hawalaForm.targetCity || '',
            amount: Number(hawalaForm.amount) || 0,
            currency: hawalaForm.currency || 'USD',
            commission: 0,
            total: Number(hawalaForm.amount) || 0,
            status: 'pending',
            date: new Date().toISOString(),
            note: hawalaForm.note || '',
            _p2p_id: id,
            _p2p_type: 'public',
            _p2p_source: 'P2P بازار عمومی',
          });
          console.log('✅ fx_hawalas برای فرستنده عمومی ساخته شد');
        }
      } catch (e: any) { console.log('fx_hawalas public insert:', e?.message); }`;

if (lm.includes(shOld)) {
  lm = lm.replace(shOld, shNew);
  console.log('✅ submitHawala آپدیت شد');
} else {
  console.log('⚠️ submitHawala الگو پیدا نشد');
}

// ─── doAcceptD (گیرنده خصوصی) ───
const adOld = `  const doAcceptD = async (id: string) => {
    try {
      const r = await acceptDirectHawala(id);`;

const adNew = `  const doAcceptD = async (id: string) => {
    try {
      const r = await acceptDirectHawala(id);
      // 🪞 کپی توی fx_hawalas (تب حواله‌جات گیرنده)
      try {
        if (r?.data) {
          const fx = await import('./lib.fx');
          const _d = r.data;
          const _exists = (await fx.getHawalas()).find((h: any) => h._p2p_id === id);
          if (!_exists) {
            await fx.createHawala({
              code: _d.code || '',
              direction: 'receive',
              partner_code: _d.from_email || '',
              partner_name: _d.from_name || _d.from_email || '',
              beneficiary_name: _d.beneficiary_name || '',
              beneficiary_phone: _d.beneficiary_phone || '',
              beneficiary_city: _d.beneficiary_city || '',
              amount: Number(_d.amount) || 0,
              currency: _d.currency || 'USD',
              commission: Number(_d.commission) || 0,
              total: Number(_d.amount) || 0,
              status: 'pending',
              date: new Date().toISOString(),
              note: _d.note || '',
              _p2p_id: id,
              _p2p_type: 'direct',
              _p2p_source: 'P2P صرافی خصوصی — دریافتی',
            });
            console.log('✅ fx_hawalas برای گیرنده ساخته شد');
          }
        }
      } catch (e: any) { console.log('fx_hawalas receiver insert:', e?.message); }`;

if (lm.includes(adOld)) {
  lm = lm.replace(adOld, adNew);
  console.log('✅ doAcceptD آپدیت شد');
} else {
  console.log('⚠️ doAcceptD الگو پیدا نشد');
}

if (lmWasCRLF) lm = lm.replace(/\n/g, '\r\n');
if (lm !== lmOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', lm, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. lib.network.ts — acceptDirectHawala باید data برگردونه
// ═══════════════════════════════════════════
console.log('');
console.log('═══ lib.network.ts ═══');
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const nWasCRLF = n.includes('\r\n');
if (nWasCRLF) n = n.replace(/\r\n/g, '\n');

const accOld = `export async function acceptDirectHawala(hawalaId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: cur } = await _sb.from('net_direct_hawalas').select('*').eq('id', hawalaId).single();
  if (!cur) throw new Error('پیدا نشد');
  if (cur.status !== 'pending') throw new Error('قبلاً قبول شده');
  const { error } = await _sb.from('net_direct_hawalas')
    .update({ status: 'accepted', accepted_by_name: _myName, accepted_at: new Date().toISOString() })
    .eq('id', hawalaId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  await notify(cur.from_email, 'direct_accepted', { hawalaId, code: cur.code, from_email: _myEmail, from_name: _myName, from_city: _myCity });
  return { success: true };
}`;

const accNew = `export async function acceptDirectHawala(hawalaId: string): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const { data: cur } = await _sb.from('net_direct_hawalas').select('*').eq('id', hawalaId).single();
  if (!cur) throw new Error('پیدا نشد');
  if (cur.status !== 'pending') throw new Error('قبلاً قبول شده');
  const { error } = await _sb.from('net_direct_hawalas')
    .update({ status: 'accepted', accepted_by_name: _myName, accepted_at: new Date().toISOString() })
    .eq('id', hawalaId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  await notify(cur.from_email, 'direct_accepted', { hawalaId, code: cur.code, from_email: _myEmail, from_name: _myName, from_city: _myCity });
  return { success: true, data: cur };
}`;

if (n.includes(accOld)) {
  n = n.replace(accOld, accNew);
  console.log('✅ acceptDirectHawala آپدیت شد (data return)');
} else {
  console.log('⚠️ acceptDirectHawala الگو پیدا نشد');
}

if (nWasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');
console.log('   copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');