const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — فیکس claimHawala با regex ساده
// ═══════════════════════════════════════════
console.log('═══ ۱. lib.network.ts ═══');
let n = fs.readFileSync('lib.network.ts', 'utf8');
let nChanged = false;

// پیدا کردن خطوطی که 'hawala_taken' دارن
const lines = n.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("'hawala_taken'") && !lines[i].includes('from_email')) {
    const oldLine = lines[i];
    lines[i] = lines[i].replace(
      /await notify\(([^,]+),\s*'hawala_taken',\s*\{\s*taskId,\s*from_name:\s*_myName,\s*amount:\s*cur\.amount,\s*currency:\s*cur\.currency\s*\}\);/,
      "await notify($1, 'hawala_taken', { taskId, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: cur.amount, currency: cur.currency });"
    );
    if (lines[i] !== oldLine) {
      console.log('✅ claimHawala fix شد');
      nChanged = true;
    }
  }
}
if (nChanged) {
  fs.writeFileSync('lib.network.ts', lines.join('\n'), 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
} else {
  console.log('⚠️ خط hawala_taken بدون from_email پیدا نشد');
  // چاپ خطوط مربوطه
  lines.forEach((l, i) => {
    if (l.includes('hawala_taken')) console.log('خط ' + (i+1) + ':', l.trim());
  });
}

// ═══════════════════════════════════════════
// ۲. ExchangeScreen.tsx — fallback lookup
// ═══════════════════════════════════════════
console.log('\n═══ ۲. ExchangeScreen.tsx ═══');
let e = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const eOrig = e;

// پیدا کردن openChatFromNotif
const idx = e.indexOf('const openChatFromNotif');
if (idx < 0) {
  console.log('❌ openChatFromNotif پیدا نشد — دنبال تابع مشابه...');
  // چک کن چطور چت باز می‌شه
  const chatFnIdx = e.indexOf('openChatWith');
  console.log('openChatWith:', chatFnIdx > 0 ? 'خط ' + e.substring(0, chatFnIdx).split('\n').length : 'نیست');
} else {
  console.log('✅ openChatFromNotif در خط', e.substring(0, idx).split('\n').length);
  
  // پیدا کردن انتهای تابع
  let depth = 0;
  let end = idx;
  let started = false;
  for (let i = idx; i < e.length; i++) {
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
  
  const newFn = `const openChatFromNotif = async (nt: any) => {
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
  
  e = e.substring(0, idx) + newFn + e.substring(end);
  console.log('✅ openChatFromNotif در ExchangeScreen بازنویسی شد');
  
  fs.writeFileSync('ExchangeScreen.tsx', e, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}