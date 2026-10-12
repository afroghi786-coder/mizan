const fs = require('fs');
let s = fs.readFileSync('ExchangeBell.tsx', 'utf8');
const orig = s;

// پیدا کردن getActions و جایگزینی
const re = /const getActions = \(nt: any\) => \{[\s\S]*?return actions;\s*\};/;

const newFn = `const getActions = (nt: any) => {
    const p = nt.payload || {};
    const roomId = roomIdFor(nt);
    const unreadCount = unreadByRoom[roomId] || 0;
    const actions: Array<{ k: string; l: string; c: string; fn: () => void }> = [];

    // 💬 پیام — اگر roomId داره
    if (roomId) {
      actions.push({
        k: 'msg',
        l: unreadCount > 0 ? \`💬 پیام (\${unreadCount})\` : '💬 پیام',
        c: '#0891b2',
        fn: () => openChatFromNotif(nt),
      });
    }

    // چک کن آیا این اعلان به یک معامله وصله
    const hasDeal = !!(p.hawalaId || p.offerId || p.taskId);
    if (!hasDeal) return actions;

    // انواع اعلان‌های "دریافتی" (من دریافت‌کننده‌ام — می‌تونم قبول کنم)
    const incomingTypes = ['direct_hawala', 'hawala_new', 'fx_new', 'group_hawala', 'private_hawala', 'public_hawala'];

    // انواع "بعد از قبول" (طرف مقابل قبول کرده — من باید تحویل بدم)
    const acceptedTypes = ['hawala_taken', 'direct_accepted', 'fx_taken', 'group_taken'];

    // انواع نهایی (کاری لازم نیست)
    const doneTypes = ['direct_delivered', 'hawala_delivered', 'fx_delivered', 'group_join', 'group_invite'];

    // ✅ قبول — برای دریافتی‌ها یا ناشناخته
    if (incomingTypes.includes(nt.type) || (!acceptedTypes.includes(nt.type) && !doneTypes.includes(nt.type))) {
      actions.push({ k: 'acc', l: '✅ قبول', c: '#059669', fn: () => doAccept(nt) });
    }

    // 📦 تحویل — بعد از قبول
    if (acceptedTypes.includes(nt.type)) {
      actions.push({ k: 'del', l: '📦 تحویل', c: '#7c3aed', fn: () => doDeliver(nt) });
    }

    // ❌ لغو — همه معاملات در جریان
    if (!doneTypes.includes(nt.type)) {
      actions.push({ k: 'can', l: '❌ لغو', c: '#dc2626', fn: () => doCancel(nt) });
    }

    return actions;
  };`;

if (re.test(s)) {
  s = s.replace(re, newFn);
  console.log('✅ getActions جایگزین شد');
} else {
  console.log('❌ getActions پیدا نشد');
}

if (s !== orig) {
  fs.writeFileSync('ExchangeBell.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ تغییری اعمال نشد');
}