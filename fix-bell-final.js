const fs = require('fs');
let s = fs.readFileSync('ExchangeBell.tsx', 'utf8');
const orig = s;

// ═══════════════════════════════════════════
// ۱. ساده‌سازی getActions — بر اساس نوع اعلان
// ═══════════════════════════════════════════
const oldGetActions = `  const getActions = (nt: any) => {
    const p = nt.payload || {};
    const { id, kind } = dealIdFor(nt);
    const status = dealStatus[id] || '';
    const roomId = roomIdFor(nt);
    const unreadCount = unreadByRoom[roomId] || 0;
    const me = myEmail();

    const actions: Array<{ k: string; l: string; c: string; fn: () => void }> = [];

    // 💬 پیام — همیشه
    if (roomId) {
      actions.push({
        k: 'msg',
        l: \`💬 پیام\${unreadCount > 0 ? \` (\${unreadCount})\` : ''}\`,
        c: '#0891b2',
        fn: () => openChatFromNotif(nt),
      });
    }

    // ✅ قبول — فقط برای direct_hawala در وضعیت pending
    if (nt.type === 'direct_hawala' && (!status || status === 'pending')) {
      actions.push({ k: 'acc', l: '✅ قبول', c: '#059669', fn: () => doAccept(nt) });
    }

    // 📦 تحویل — برای accepted
    if (status === 'accepted') {
      // فقط sender یا claimer می‌تونن تحویل بدن
      // ساده: هر دو می‌بینن
      if (nt.type === 'direct_accepted' || nt.type === 'hawala_taken' || nt.type === 'direct_hawala') {
        actions.push({ k: 'del', l: '📦 تحویل', c: '#7c3aed', fn: () => doDeliver(nt) });
      }
    }

    // ❌ لغو — قبل از تحویل
    if (status !== 'delivered' && status !== 'cancelled' && nt.type !== 'fx_new' && nt.type !== 'hawala_new') {
      actions.push({ k: 'can', l: '❌ لغو', c: '#dc2626', fn: () => doCancel(nt) });
    }

    return actions;
  };`;

const newGetActions = `  const getActions = (nt: any) => {
    const p = nt.payload || {};
    const roomId = roomIdFor(nt);
    const unreadCount = unreadByRoom[roomId] || 0;

    const actions: Array<{ k: string; l: string; c: string; fn: () => void }> = [];

    // 💬 پیام — همیشه (با شماره پیام نخوانده)
    if (roomId) {
      actions.push({
        k: 'msg',
        l: unreadCount > 0 ? \`💬 پیام (\${unreadCount})\` : '💬 پیام',
        c: '#0891b2',
        fn: () => openChatFromNotif(nt),
      });
    }

    // ✅ قبول — بر اساس نوع اعلان
    // direct_hawala (حواله خصوصی جدید) — کاربر باید قبول کنه
    // hawala_new (حواله عمومی جدید در شهر)
    // fx_new (آگهی ارز جدید)
    if (nt.type === 'direct_hawala' || nt.type === 'hawala_new' || nt.type === 'fx_new') {
      actions.push({ k: 'acc', l: '✅ قبول', c: '#059669', fn: () => doAccept(nt) });
    }

    // 📦 تحویل — برای accepted
    if (nt.type === 'direct_accepted' || nt.type === 'hawala_taken' || nt.type === 'fx_taken') {
      actions.push({ k: 'del', l: '📦 تحویل', c: '#7c3aed', fn: () => doDeliver(nt) });
    }

    // ❌ لغو — برای همه معاملات در جریان (به جز اعلان‌های اطلاعی)
    if (nt.type === 'direct_hawala' || nt.type === 'direct_accepted' || nt.type === 'hawala_taken' || nt.type === 'hawala_new' || nt.type === 'fx_new' || nt.type === 'fx_taken') {
      actions.push({ k: 'can', l: '❌ لغو', c: '#dc2626', fn: () => doCancel(nt) });
    }

    return actions;
  };`;

if (s.includes(oldGetActions)) {
  s = s.replace(oldGetActions, newGetActions);
  console.log('✅ getActions ساده شد — بر اساس نوع اعلان');
} else {
  console.log('⚠️ getActions پیدا نشد — با regex');
  // regex برای پیدا کردن getActions
  const re = /const getActions = \(nt: any\) => \{[\s\S]*?return actions;\s*\};/;
  if (re.test(s)) {
    s = s.replace(re, newGetActions);
    console.log('✅ getActions جایگزین شد (regex)');
  } else {
    console.log('❌ getActions پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ۲. بهبود load — واکشی تعداد پیام نخوانده
// ═══════════════════════════════════════════
const oldLoadPart = `        // تعداد پیام‌های نخوانده در این اتاق
        const roomId = roomIdFor(nt);
        if (roomId) {
          try {
            const { count } = await sb.from('net_messages')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', roomId)
              .eq('to_email', me)
              .eq('is_read', false);
            unreadMap[roomId] = count || 0;
          } catch {}
        }`;

const newLoadPart = `        // تعداد پیام‌های نخوانده در این اتاق
        const roomId = roomIdFor(nt);
        if (roomId && !unreadMap[roomId]) {
          try {
            // واکشی همه پیام‌های این اتاق که به من رسیده و نخوانده
            const { data } = await sb.from('net_messages')
              .select('id,is_read')
              .eq('room_id', roomId)
              .eq('to_email', me);
            if (data) {
              unreadMap[roomId] = data.filter((m: any) => !m.is_read).length;
            }
          } catch (err) { console.log('unread count err:', err); }
        }`;

if (s.includes(oldLoadPart)) {
  s = s.replace(oldLoadPart, newLoadPart);
  console.log('✅ load بهبود یافت');
} else {
  console.log('⚠️ loadPart پیدا نشد');
}

// ═══════════════════════════════════════════
// ۳. بهبود دکمه‌ها در مودال — نمایش بهتر
// ═══════════════════════════════════════════
const oldButtons = `                    {actions.length > 0 ? (
                      <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {actions.map(a => (
                          <TouchableOpacity
                            key={a.k}
                            disabled={!!busy}
                            onPress={a.fn}
                            style={{ backgroundColor: a.c, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, opacity: busy ? 0.5 : 1 }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{a.l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}`;

const newButtons = `                    {actions.length > 0 ? (
                      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        {actions.map(a => (
                          <TouchableOpacity
                            key={a.k}
                            disabled={!!busy}
                            onPress={a.fn}
                            activeOpacity={0.8}
                            style={{ backgroundColor: a.c, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, opacity: busy ? 0.5 : 1, minWidth: 80, alignItems: 'center' }}
                          >
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{a.l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}`;

if (s.includes(oldButtons)) {
  s = s.replace(oldButtons, newButtons);
  console.log('✅ دکمه‌ها بهبود یافت');
} else {
  console.log('⚠️ دکمه‌ها پیدا نشد');
}

// ═══════════════════════════════════════════
// ۴. ذخیره
// ═══════════════════════════════════════════
if (s !== orig) {
  fs.writeFileSync('ExchangeBell.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ تغییری اعمال نشد');
}