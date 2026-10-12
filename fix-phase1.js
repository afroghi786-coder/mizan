const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-phase1-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
let lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lmOrig = lm;

// ═══════════════════════════════════════════
// ۱. lib.network.ts — اضافه تابع generateHawalaCode
// ═══════════════════════════════════════════
console.log('═══ lib.network.ts ═══');

if (!n.includes('function generateHawalaCode')) {
  // اضافه کنار تابع notify
  const notifyIdx = n.indexOf('async function notify(');
  if (notifyIdx > 0) {
    const before = n.substring(0, notifyIdx);
    const after = n.substring(notifyIdx);
    const func = `// 🎫 تولید کد یکتای حواله P2P
function generateHawalaCode(): string {
  return 'P2P-' + Math.floor(100000 + Math.random() * 900000);
}

`;
    n = before + func + after;
    console.log('✅ تابع generateHawalaCode اضافه شد');
  }
}

// ═══════════════════════════════════════════
// ۲. sendBroadcastHawala
// ═══════════════════════════════════════════
const bhOld = `export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const expiresAtH = new Date(Date.now() + (Number(h.expires || 15) * 60000)).toISOString();
  const { error } = await _sb.from('net_hawalas').insert({
    id: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    target_city: h.targetCity, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    max_fee: h.maxFee || 2, note: h.note || '', status: 'open',
    target_group_id: h.targetGroupId || null,
    expires_at: expiresAtH,
  });
  if (error) { console.log('sendBroadcastHawala error:', error.message); throw new Error(error.message); }
  console.log('✅ Hawala inserted:', h.id, 'expires:', expiresAtH);
  try {
    const { data: users } = await _sb.from('net_preferences').select('email, notify_hawala_new, watch_cities').eq('notify_hawala_new', true).neq('email', _myEmail);
    if (users && users.length) {
      const toNotify = users.filter((u: any) => !u.watch_cities || u.watch_cities.length === 0 || u.watch_cities.includes(h.targetCity));
      for (const u of toNotify) {
        await _sb.from('net_notifications').insert({
          to_email: u.email, type: 'hawala_new',
          payload: { hawalaId: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity, currency: h.currency, amount: h.amount, targetCity: h.targetCity },
        });
      }
    }
  } catch (e: any) { console.log('hawala_new notify error:', e?.message); }
  return { success: true, id: h.id };
}`;

const bhNew = `export async function sendBroadcastHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  const _code = h.code || generateHawalaCode();
  const expiresAtH = new Date(Date.now() + (Number(h.expires || 15) * 60000)).toISOString();
  const { error } = await _sb.from('net_hawalas').insert({
    id: h.id, code: _code, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    target_city: h.targetCity, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    max_fee: h.maxFee || 2, note: h.note || '', status: 'open',
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

if (n.includes(bhOld)) {
  n = n.replace(bhOld, bhNew);
  console.log('✅ sendBroadcastHawala آپدیت شد');
} else {
  console.log('⚠️ sendBroadcastHawala — الگو پیدا نشد');
}

// ═══════════════════════════════════════════
// ۳. sendDirectHawala
// ═══════════════════════════════════════════
const dhOld = `export async function sendDirectHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  if (!h.toEmail) throw new Error('مقصد انتخاب نشده');
  const { error } = await _sb.from('net_direct_hawalas').insert({
    id: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    to_email: h.toEmail, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    commission: h.commission || 0, note: h.note || '', status: 'pending',
  });
  if (error) throw new Error(error.message);
  await notify(h.toEmail, 'direct_hawala', { hawalaId: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: h.amount, currency: h.currency });
  return { success: true, id: h.id };
}`;

const dhNew = `export async function sendDirectHawala(h: any): Promise<any> {
  if (!_sb || !_myEmail) throw new Error('متصل نیست');
  if (!h.toEmail) throw new Error('مقصد انتخاب نشده');
  const _code = h.code || generateHawalaCode();
  const { error } = await _sb.from('net_direct_hawalas').insert({
    id: h.id, code: _code, from_email: _myEmail, from_name: _myName, from_city: _myCity,
    to_email: h.toEmail, currency: h.currency, amount: h.amount,
    beneficiary_name: h.beneficiaryName, beneficiary_phone: h.beneficiaryPhone || '',
    commission: h.commission || 0, note: h.note || '', status: 'pending',
  });
  if (error) throw new Error(error.message);
  await notify(h.toEmail, 'direct_hawala', { hawalaId: h.id, code: _code, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: h.amount, currency: h.currency });
  return { success: true, id: h.id, code: _code };
}`;

if (n.includes(dhOld)) {
  n = n.replace(dhOld, dhNew);
  console.log('✅ sendDirectHawala آپدیت شد');
} else {
  console.log('⚠️ sendDirectHawala — الگو پیدا نشد');
}

// ═══════════════════════════════════════════
// ۴. acceptDirectHawala
// ═══════════════════════════════════════════
const adOld = `  await notify(cur.from_email, 'direct_accepted', { hawalaId, from_email: _myEmail, from_name: _myName, from_city: _myCity });`;
const adNew = `  await notify(cur.from_email, 'direct_accepted', { hawalaId, code: cur.code, from_email: _myEmail, from_name: _myName, from_city: _myCity });`;
if (n.includes(adOld)) {
  n = n.replace(adOld, adNew);
  console.log('✅ acceptDirectHawala آپدیت شد');
}

// ═══════════════════════════════════════════
// ۵. deliverDirectHawala
// ═══════════════════════════════════════════
const ddOld = `  await notify(cur.from_email, 'direct_delivered', { hawalaId, from_email: _myEmail, from_name: _myName, from_city: _myCity });`;
const ddNew = `  await notify(cur.from_email, 'direct_delivered', { hawalaId, code: cur.code, from_email: _myEmail, from_name: _myName, from_city: _myCity });`;
if (n.includes(ddOld)) {
  n = n.replace(ddOld, ddNew);
  console.log('✅ deliverDirectHawala آپدیت شد');
}

// ═══════════════════════════════════════════
// ۶. claimHawala
// ═══════════════════════════════════════════
const chOld = `  notify(cur.from_email, 'hawala_taken', { taskId, from_name: _myName, amount: cur.amount, currency: cur.currency }).catch(() => {});`;
const chNew = `  notify(cur.from_email, 'hawala_taken', { taskId, code: cur.code, from_name: _myName, amount: cur.amount, currency: cur.currency }).catch(() => {});`;
if (n.includes(chOld)) {
  n = n.replace(chOld, chNew);
  console.log('✅ claimHawala آپدیت شد');
}

if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

// ═══════════════════════════════════════════
// ۷. LiveMarketScreen.tsx — نمایش کد در اعلان‌ها
// ═══════════════════════════════════════════
console.log('');
console.log('═══ LiveMarketScreen.tsx ═══');

const textsOld = `const texts: any = {
                fx_taken: \`✅ \${p.from_name} آگهی شما را قبول کرد\`,
                hawala_taken: \`✅ \${p.from_name} حواله شما را قبول کرد\`,
                direct_hawala: \`🔒 حواله خصوصی از \${p.from_name}\`,
                direct_accepted: \`✅ \${p.from_name} حواله را قبول کرد\`,
                direct_delivered: \`📦 \${p.from_name} حواله را تحویل داد\`,
                group_invite: \`🌐 دعوت به گروه \${p.groupName || ''}\`,
                group_join: \`👥 \${p.from_name} به گروه پیوست\`,
                fx_new: \`💱 \${p.from_name} فروش \${fmt(p.amount)} \${p.currency}\`,
                hawala_new: \`📤 \${p.from_name} حواله \${fmt(p.amount)} \${p.currency}\`,
                new_message: \`💬 پیام جدید از \${p.from_name || p.from_email || "کاربر"}\`,
                virtual_message: \`💬 پیام جدید از \${p.from || "کاربر"}\`,
              };`;

const textsNew = `const _c = p.code ? \` [\${p.code}]\` : '';
              const texts: any = {
                fx_taken: \`✅ \${p.from_name} آگهی شما را قبول کرد\`,
                hawala_taken: \`✅ \${p.from_name} حواله شما را قبول کرد\${_c}\`,
                direct_hawala: \`🔒 حواله خصوصی از \${p.from_name}\${_c}\`,
                direct_accepted: \`✅ \${p.from_name} حواله را قبول کرد\${_c}\`,
                direct_delivered: \`📦 \${p.from_name} حواله را تحویل داد\${_c}\`,
                group_invite: \`🌐 دعوت به گروه \${p.groupName || ''}\`,
                group_join: \`👥 \${p.from_name} به گروه پیوست\`,
                fx_new: \`💱 \${p.from_name} فروش \${fmt(p.amount)} \${p.currency}\`,
                hawala_new: \`📤 \${p.from_name} حواله \${fmt(p.amount)} \${p.currency}\${_c}\`,
                new_message: \`💬 پیام جدید از \${p.from_name || p.from_email || "کاربر"}\`,
                virtual_message: \`💬 پیام جدید از \${p.from || "کاربر"}\`,
              };`;

if (lm.includes(textsOld)) {
  lm = lm.replace(textsOld, textsNew);
  console.log('✅ texts آپدیت شد (کد در اعلان‌ها)');
} else {
  // نسخه ساده‌تر (بدون new_message و virtual_message)
  const simpleOld = `const texts: any = {
                fx_taken: \`✅ \${p.from_name} آگهی شما را قبول کرد\`,
                hawala_taken: \`✅ \${p.from_name} حواله شما را قبول کرد\`,
                direct_hawala: \`🔒 حواله خصوصی از \${p.from_name}\`,
                direct_accepted: \`✅ \${p.from_name} حواله را قبول کرد\`,
                direct_delivered: \`📦 \${p.from_name} حواله را تحویل داد\`,
                group_invite: \`🌐 دعوت به گروه \${p.groupName || ''}\`,
                group_join: \`👥 \${p.from_name} به گروه پیوست\`,
                fx_new: \`💱 \${p.from_name} فروش \${fmt(p.amount)} \${p.currency}\`,
                hawala_new: \`📤 \${p.from_name} حواله \${fmt(p.amount)} \${p.currency}\`,
              };`;
  const simpleNew = `const _c = p.code ? \` [\${p.code}]\` : '';
              const texts: any = {
                fx_taken: \`✅ \${p.from_name} آگهی شما را قبول کرد\`,
                hawala_taken: \`✅ \${p.from_name} حواله شما را قبول کرد\${_c}\`,
                direct_hawala: \`🔒 حواله خصوصی از \${p.from_name}\${_c}\`,
                direct_accepted: \`✅ \${p.from_name} حواله را قبول کرد\${_c}\`,
                direct_delivered: \`📦 \${p.from_name} حواله را تحویل داد\${_c}\`,
                group_invite: \`🌐 دعوت به گروه \${p.groupName || ''}\`,
                group_join: \`👥 \${p.from_name} به گروه پیوست\`,
                fx_new: \`💱 \${p.from_name} فروش \${fmt(p.amount)} \${p.currency}\`,
                hawala_new: \`📤 \${p.from_name} حواله \${fmt(p.amount)} \${p.currency}\${_c}\`,
              };`;
  if (lm.includes(simpleOld)) {
    lm = lm.replace(simpleOld, simpleNew);
    console.log('✅ texts آپدیت شد (نسخه ساده)');
  } else {
    console.log('⚠️ texts پیدا نشد');
  }
}

if (lm !== lmOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', lm, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ فاز ۱ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');