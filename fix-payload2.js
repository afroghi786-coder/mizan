// fix-payload2.js — فیکس claimHawala + fallback برای اعلان‌های قدیمی
const fs = require('fs');

// ═══════════════════════════════════════════
// بخش ۱: فیکس claimHawala در lib.network.ts
// ═══════════════════════════════════════════
console.log('═══ ۱. lib.network.ts ═══');
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;

// پیدا کردن خط claimHawala notify با regex
const re = /await notify\(cur\.from_email,\s*'hawala_taken',\s*\{\s*taskId,[^}]+\}\);/;
if (re.test(n)) {
  n = n.replace(re, "await notify(cur.from_email, 'hawala_taken', { taskId, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: cur.amount, currency: cur.currency });");
  console.log('✅ claimHawala payload به‌روز شد');
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
} else {
  console.log('⚠️ regex پیدا نشد');
}

// ═══════════════════════════════════════════
// بخش ۲: بهبود openChatFromNotif در LiveMarketScreen
// ═══════════════════════════════════════════
console.log('\n═══ ۲. LiveMarketScreen.tsx ═══');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// پیدا کردن openChatFromNotif
const oldFn = `  const openChatFromNotif = (nt: any) => {`;
const newFn = `  const openChatFromNotif = async (nt: any) => {`;

if (s.includes(oldFn)) {
  s = s.replace(oldFn, newFn);
  console.log('✅ openChatFromNotif → async شد');
}

// حالا باید داخل تابع، از DB بخونه اگر from_email نداره
// پیدا کردن انتهای تابع openChatFromNotif
const fnIdx = s.indexOf('const openChatFromNotif = async');
if (fnIdx > 0) {
  // پیدا کردن انتهای تابع
  let depth = 0;
  let end = fnIdx;
  let started = false;
  for (let i = fnIdx; i < s.length; i++) {
    if (s[i] === '{') { depth++; started = true; }
    else if (s[i] === '}') {
      depth--;
      if (started && depth === 0) {
        end = i + 1;
        if (s[end] === ';') end++;
        break;
      }
    }
  }
  
  const fnContent = s.substring(fnIdx, end);
  
  // چک کن قبلاً از DB می‌خونه
  if (!fnContent.includes('net_direct_hawalas') && !fnContent.includes('_sb')) {
    // اضافه کردن fallback — داخل تابع
    const newFnBody = `
  const openChatFromNotif = async (nt: any) => {
    const p = nt.payload || {};
    let fromEmail = p.from_email || p.fromEmail || '';
    let fromName = p.from_name || p.fromName || '';
    let fromCity = p.from_city || p.fromCity || '';
    let roomId = '';

    // تعیین room_id بر اساس نوع اعلان
    if (nt.type === 'hawala_taken' && p.taskId) roomId = 'hw_' + p.taskId;
    else if (nt.type === 'fx_taken' && p.offerId) roomId = 'fx_' + p.offerId;
    else if (nt.type === 'direct_hawala' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'direct_accepted' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'direct_delivered' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'fx_new' && p.offerId) roomId = 'fx_' + p.offerId;
    else if (nt.type === 'hawala_new' && p.hawalaId) roomId = 'hw_' + p.hawalaId;
    else roomId = 'nt_' + (nt.id || Date.now());

    // اگر from_email نداریم، از دیتابیس بخون (برای اعلان‌های قدیمی)
    if (!fromEmail && p.hawalaId) {
      try {
        const m = await import('./lib.network');
        const sb = (m as any)._sb || (m as any).getSB;
        if (typeof sb === 'function') {
          const client = await sb();
          if (client) {
            const { data } = await client.from('net_direct_hawalas').select('*').eq('id', p.hawalaId).single();
            if (data) {
              fromEmail = data.from_email || '';
              fromName = data.from_name || '';
              fromCity = data.from_city || '';
            }
          }
        } else if (sb && sb.from) {
          const { data } = await sb.from('net_direct_hawalas').select('*').eq('id', p.hawalaId).single();
          if (data) {
            fromEmail = data.from_email || '';
            fromName = data.from_name || '';
            fromCity = data.from_city || '';
          }
        }
      } catch (e) { console.log('lookup error:', e); }
    }

    if (!fromEmail) {
      showToast?.('⚠️ اطلاعات فرستنده پیدا نشد — اعلان قدیمی است', true);
      return;
    }

    if (!fromName) fromName = fromEmail.split('@')[0] || 'کسی';

    setNotifModal(false);
    setTimeout(() => {
      openChatWith(roomId, fromEmail, fromName, fromCity);
    }, 250);
  };`;
    
    s = s.substring(0, fnIdx) + newFnBody + s.substring(end);
    console.log('✅ openChatFromNotif با fallback بازنویسی شد');
  } else {
    console.log('ℹ️ fallback از قبل هست');
  }
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('⚠️ تغییری اعمال نشد');
}

// ═══════════════════════════════════════════
// بخش ۳: بهبود openChatFromNotif در ExchangeScreen
// ═══════════════════════════════════════════
console.log('\n═══ ۳. ExchangeScreen.tsx ═══');
let e = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const eOrig = e;

const oldFne = `  const openChatFromNotif = (nt: any) => {`;
if (e.includes(oldFne)) {
  e = e.replace(oldFne, `  const openChatFromNotif = async (nt: any) => {`);
  console.log('✅ openChatFromNotif → async شد');
  
  const fnIdxe = e.indexOf('const openChatFromNotif = async');
  if (fnIdxe > 0) {
    let depth = 0;
    let end = fnIdxe;
    let started = false;
    for (let i = fnIdxe; i < e.length; i++) {
      if (e[i] === '{') { depth++; started = true; }
      else if (e[i] === '}') {
        depth--;
        if (started && depth === 0) {
          end = i + 1;
          if (e[end] === ';') end++;
          break;
        }
      }
    }
    
    const newFnBodyE = `
  const openChatFromNotif = async (nt: any) => {
    const p = nt.payload || {};
    let fromEmail = p.from_email || p.fromEmail || '';
    let fromName = p.from_name || p.fromName || '';
    let fromCity = p.from_city || p.fromCity || '';
    let roomId = '';

    if (nt.type === 'hawala_taken' && p.taskId) roomId = 'hw_' + p.taskId;
    else if (nt.type === 'fx_taken' && p.offerId) roomId = 'fx_' + p.offerId;
    else if (nt.type === 'direct_hawala' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'direct_accepted' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'direct_delivered' && p.hawalaId) roomId = 'dh_' + p.hawalaId;
    else if (nt.type === 'fx_new' && p.offerId) roomId = 'fx_' + p.offerId;
    else if (nt.type === 'hawala_new' && p.hawalaId) roomId = 'hw_' + p.hawalaId;
    else roomId = 'nt_' + (nt.id || Date.now());

    if (!fromEmail && p.hawalaId) {
      try {
        const m = await import('./lib.network');
        const sb = (m as any)._sb;
        if (sb && sb.from) {
          const { data } = await sb.from('net_direct_hawalas').select('*').eq('id', p.hawalaId).single();
          if (data) {
            fromEmail = data.from_email || '';
            fromName = data.from_name || '';
            fromCity = data.from_city || '';
          }
        }
      } catch (err) { console.log('lookup err:', err); }
    }

    if (!fromEmail) {
      showToast?.('⚠️ اطلاعات فرستنده پیدا نشد', true);
      return;
    }

    if (!fromName) fromName = fromEmail.split('@')[0] || 'کسی';

    setExchBellModal(false);
    setExchChatRoom({ id: roomId });
    setExchChatPeer({ email: fromEmail, name: fromName, city: fromCity });
    setExchChatInput('');
    setExchChatMsgs([]);
    setTimeout(() => setExchChatModal(true), 250);
  };`;
    
    e = e.substring(0, fnIdxe) + newFnBodyE + e.substring(end);
    console.log('✅ openChatFromNotif در ExchangeScreen بازنویسی شد');
  }
} else {
  console.log('⚠️ openChatFromNotif در ExchangeScreen پیدا نشد');
}

if (e !== eOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', e, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

console.log('\n✅ تمام');