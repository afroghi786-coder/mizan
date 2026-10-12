const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-phase2data-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. LiveMarketScreen — submitDirect و submitHawala
// ═══════════════════════════════════════════
console.log('═══ LiveMarketScreen.tsx ═══');
let lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lmOrig = lm;
const lmWasCRLF = lm.includes('\r\n');
if (lmWasCRLF) lm = lm.replace(/\r\n/g, '\n');

// submitDirect — جایگزینی فراخوانی sendDirectHawala
const sdOldPattern = /await sendDirectHawala\(\{[^}]+\}\);/;
if (sdOldPattern.test(lm)) {
  const sdNew = `await sendDirectHawala({
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
  lm = lm.replace(sdOldPattern, sdNew);
  console.log('✅ submitDirect آپدیت شد');
} else {
  console.log('⚠️ submitDirect — الگو پیدا نشد');
}

// submitHawala
const shOldPattern = /await sendBroadcastHawala\(\{[\s\S]*?\n\s*\}\);/;
if (shOldPattern.test(lm)) {
  const shNew = `await sendBroadcastHawala({
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
  lm = lm.replace(shOldPattern, shNew);
  console.log('✅ submitHawala آپدیت شد');
} else {
  console.log('⚠️ submitHawala — الگو پیدا نشد');
}

if (lmWasCRLF) lm = lm.replace(/\n/g, '\r\n');
if (lm !== lmOrig) fs.writeFileSync('LiveMarketScreen.tsx', lm, 'utf8');

// ═══════════════════════════════════════════
// ۲. lib.network.ts
// ═══════════════════════════════════════════
console.log('');
console.log('═══ lib.network.ts ═══');
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const nWasCRLF = n.includes('\r\n');
if (nWasCRLF) n = n.replace(/\r\n/g, '\n');

// helper: پیدا کردن انتهای تابع
function findFuncEnd(str, startIdx) {
  const nextExport = str.indexOf('\nexport ', startIdx + 1);
  if (nextExport > 0) {
    // عقب برو تا خط خالی
    let end = nextExport;
    while (end > startIdx && /\s/.test(str[end - 1])) end--;
    return end;
  }
  return str.length;
}

// sendDirectHawala
const dhStartMarker = 'export async function sendDirectHawala(h: any): Promise<any> {';
const dhStart = n.indexOf(dhStartMarker);
if (dhStart > 0) {
  const dhEnd = findFuncEnd(n, dhStart);
  const dhOld = n.substring(dhStart, dhEnd);
  
  const dhNew = `export async function sendDirectHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  if (!h.toEmail) throw new Error('مقصد انتخاب نشده');
  const _code = h.code || generateHawalaCode();
  const { error } = await _sb.from('net_direct_hawalas').insert({
    id: h.id, code: _code,
    from_email: _myEmail, from_name: _myName, from_city: _myCity,
    sender_name: h.sender_name || _myName,
    sender_phone: h.sender_phone || '',
    sender_city: h.sender_city || _myCity,
    sender_address: h.sender_address || '',
    to_email: h.toEmail,
    currency: h.currency,
    target_currency: h.targetCurrency || h.currency,
    amount: h.amount,
    to_amount: h.to_amount || 0,
    rate: h.rate || 0,
    beneficiary_name: h.beneficiaryName,
    beneficiary_phone: h.beneficiaryPhone || '',
    beneficiary_city: h.beneficiary_city || '',
    beneficiary_bank: h.beneficiary_bank || '',
    beneficiary_holder: h.beneficiary_holder || '',
    commission: h.commission || 0,
    commission_percent: h.commission_percent || 0,
    note: h.note || '',
    status: 'pending',
  });
  if (error) throw new Error(error.message);
  await notify(h.toEmail, 'direct_hawala', {
    hawalaId: h.id, code: _code,
    from_email: _myEmail, from_name: _myName, from_city: _myCity,
    amount: h.amount, currency: h.currency,
    targetCurrency: h.targetCurrency,
    beneficiaryName: h.beneficiaryName,
    to_amount: h.to_amount,
  });
  return { success: true, id: h.id, code: _code };
}`;
  
  n = n.substring(0, dhStart) + dhNew + n.substring(dhEnd);
  console.log('✅ sendDirectHawala آپدیت شد');
} else {
  console.log('⚠️ sendDirectHawala پیدا نشد');
}

// sendBroadcastHawala
const bhStartMarker = 'export async function sendBroadcastHawala(h: any): Promise<any> {';
const bhStart = n.indexOf(bhStartMarker);
if (bhStart > 0) {
  const bhEnd = findFuncEnd(n, bhStart);
  const bhOld = n.substring(bhStart, bhEnd);
  
  const bhNew = `export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const _code = h.code || generateHawalaCode();
  const expiresAtH = new Date(Date.now() + (Number(h.expires || 15) * 60000)).toISOString();
  const { error } = await _sb.from('net_hawalas').insert({
    id: h.id, code: _code,
    from_email: _myEmail, from_name: _myName, from_city: _myCity,
    sender_name: h.sender_name || _myName,
    sender_phone: h.sender_phone || '',
    sender_city: h.sender_city || _myCity,
    sender_address: h.sender_address || '',
    target_city: h.targetCity,
    currency: h.currency,
    amount: h.amount,
    to_amount: h.to_amount || 0,
    beneficiary_name: h.beneficiaryName,
    beneficiary_phone: h.beneficiaryPhone || '',
    beneficiary_city: h.beneficiary_city || '',
    beneficiary_bank: h.beneficiary_bank || '',
    beneficiary_holder: h.beneficiary_holder || '',
    max_fee: h.maxFee || 2,
    note: h.note || '',
    status: 'open',
    target_group_id: h.targetGroupId || null,
    expires_at: expiresAtH,
  });
  if (error) { console.log('sendBroadcastHawala error:', error.message); throw new Error(error.message); }
  console.log('✅ Hawala inserted:', h.id, 'code:', _code, 'expires:', expiresAtH);
  try {
    const { data: users } = await _sb.from('net_preferences').select('email, notify_hawala_new, watch_cities').eq('notify_hawala_new', true).neq('email', _myEmail);
    if (users && users.length) {
      const toNotify = users.filter((u: any) => !u.watch_cities || u.watch_cities.length === 0 || u.watch_cities.includes(h.targetCity));
      for (const u of toNotify) {
        await _sb.from('net_notifications').insert({
          to_email: u.email, type: 'hawala_new',
          payload: { hawalaId: h.id, code: _code, from_email: _myEmail, from_name: _myName, from_city: _myCity, currency: h.currency, amount: h.amount, targetCity: h.targetCity },
        });
      }
    }
  } catch (e: any) { console.log('hawala_new notify error:', e?.message); }
  return { success: true, id: h.id, code: _code };
}`;
  
  n = n.substring(0, bhStart) + bhNew + n.substring(bhEnd);
  console.log('✅ sendBroadcastHawala آپدیت شد');
} else {
  console.log('⚠️ sendBroadcastHawala پیدا نشد');
}

if (nWasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) fs.writeFileSync('lib.network.ts', n, 'utf8');

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');