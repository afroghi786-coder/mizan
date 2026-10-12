const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ امن (با timestamp)
// ═══════════════════════════════════════════
const backupDir = 'backup-before-badges-' + Date.now();
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(backupDir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ در: ' + backupDir);
console.log('   بازگردانی: copy "' + backupDir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ═══════════════════════════════════════════
// ۱. state برای شمارش پیام‌های نخوانده هر room
// ═══════════════════════════════════════════
if (!s.includes('const [notifUnread')) {
  const anchors = [
    "const [prefs, setPrefs] = useState<any>({});",
    "const [notifModal, setNotifModal] = useState(false);",
    "const [notifList, setNotifList] = useState<any[]>([]);"
  ];
  let added = false;
  for (const a of anchors) {
    if (s.includes(a)) {
      s = s.replace(a, a + "\n  const [notifUnread, setNotifUnread] = useState<any>({});");
      console.log('✅ state notifUnread اضافه شد');
      added = true;
      break;
    }
  }
  if (!added) console.log('⚠️ anchor state پیدا نشد');
} else {
  console.log('ℹ️ state notifUnread از قبل هست');
}

// ═══════════════════════════════════════════
// ۲. useEffect برای گرفتن پیام‌های نخوانده از net_messages
// ═══════════════════════════════════════════
if (!s.includes('setNotifUnread(')) {
  const anchor = "useEffect(() => { refresh(); return () => stopAllListeners(); }, [refresh]);";
  if (s.includes(anchor)) {
    const effect = `

  // 🔢 شمارش پیام‌های نخوانده هر طرف (از net_messages)
  useEffect(() => {
    if (!notifList || !notifList.length) return;
    let alive = true;
    const tick = async () => {
      try {
        const m = await import('./lib.network');
        const sb = (m as any)._sb;
        const myE = net.email;
        if (!sb || !myE) return;
        const { data } = await sb.from('net_messages')
          .select('room_id')
          .eq('to_email', myE)
          .eq('is_read', false);
        const map: any = {};
        for (const row of (data || [])) {
          const rId = row.room_id;
          if (rId) map[rId] = (map[rId] || 0) + 1;
        }
        if (alive) setNotifUnread(map);
      } catch (e) {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [notifList, net.email]);`;
    s = s.replace(anchor, anchor + effect);
    console.log('✅ useEffect شمارش اضافه شد');
  } else {
    console.log('⚠️ anchor useEffect پیدا نشد');
  }
} else {
  console.log('ℹ️ useEffect از قبل هست');
}

// ═══════════════════════════════════════════
// ۳. badge روی آیکون 🔔
// ═══════════════════════════════════════════
if (!s.includes('__bellBadgeAdded__')) {
  let bellIdx = -1;
  let foundVia = '';
  const patterns = ['setNotifModal(true)', 'setNotifModal(!notifModal)', 'onPress={() => setNotifModal'];
  for (const p of patterns) {
    const idx = s.indexOf(p);
    if (idx > 0) { bellIdx = idx; foundVia = p; break; }
  }
  if (bellIdx < 0) {
    const idx = s.indexOf('🔔');
    if (idx > 0) { bellIdx = idx; foundVia = '🔔 emoji'; }
  }

  if (bellIdx > 0) {
    console.log('🔍 bell پیدا شد با: ' + foundVia);
    const btnStart = s.lastIndexOf('<TouchableOpacity', bellIdx);
    if (btnStart > 0) {
      let depth = 0;
      let i = btnStart;
      let btnEnd = -1;
      while (i < s.length) {
        const nextOpen = s.indexOf('<TouchableOpacity', i + 1);
        const nextClose = s.indexOf('</TouchableOpacity>', i + 1);
        if (nextClose < 0) break;
        if (nextOpen > 0 && nextOpen < nextClose) {
          depth++; i = nextOpen + 1;
        } else {
          if (depth === 0) { btnEnd = nextClose + '</TouchableOpacity>'.length; break; }
          depth--; i = nextClose + 1;
        }
      }
      if (btnEnd > 0) {
        const before = s.substring(0, btnEnd - '</TouchableOpacity>'.length);
        const after = s.substring(btnEnd - '</TouchableOpacity>'.length);
        const badge = `{(() => { const c = (notifList || []).filter((x: any) => !x.is_read).length; return c > 0 ? (
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, zIndex: 9999, elevation: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{c > 99 ? '۹۹+' : c}</Text>
                  </View>
                ) : null; })()}{/* __bellBadgeAdded__ */}`;
        s = before + badge + after;
        console.log('✅ badge روی 🔔 اضافه شد');
      } else {
        console.log('⚠️ بسته شدن TouchableOpacity bell پیدا نشد');
      }
    } else {
      console.log('⚠️ TouchableOpacity قبل از bell پیدا نشد');
    }
  } else {
    console.log('⚠️ bell پیدا نشد — احتمالا اسمش فرق داره');
  }
}

// ═══════════════════════════════════════════
// ۴. badge روی 💬 پیام در نوتیفیکیشن
// ═══════════════════════════════════════════
if (!s.includes('__chatBadgeAdded__')) {
  const chatIdx = s.indexOf('onPress={() => openChatFromNotif(n)}');
  if (chatIdx > 0) {
    const btnStart = s.lastIndexOf('<TouchableOpacity', chatIdx);
    const btnEnd = s.indexOf('</TouchableOpacity>', chatIdx) + '</TouchableOpacity>'.length;
    const oldBtn = s.substring(btnStart, btnEnd);

    const chatTextMatch = oldBtn.match(/<Text[^>]*>💬 پیام<\/Text>/);
    if (chatTextMatch) {
      const badgeCode = `{(() => {
                          const p = (n && n.payload) || {};
                          const t = String((n && n.type) || '');
                          let rId = '';
                          if (t === 'direct_hawala' || t === 'direct_accepted') rId = 'dh_' + p.hawalaId;
                          else if (t === 'hawala_taken' || t === 'hawala_new') rId = 'hw_' + (p.taskId || p.hawalaId);
                          else if (t === 'fx_new' || t === 'fx_taken') rId = 'fx_' + p.offerId;
                          const cnt = notifUnread[rId] || 0;
                          return cnt > 0 ? (
                            <View style={{ backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{cnt > 9 ? '۹+' : cnt}</Text>
                            </View>
                          ) : null;
                        })()}{/* __chatBadgeAdded__ */}`;

      const newBtn = oldBtn.replace(chatTextMatch[0], chatTextMatch[0] + badgeCode);
      s = s.substring(0, btnStart) + newBtn + s.substring(btnEnd);
      console.log('✅ badge روی 💬 پیام اضافه شد');
    } else {
      console.log('⚠️ Text 💬 پیام پیدا نشد — محتوای دکمه:');
      console.log(oldBtn.substring(0, 300));
    }
  } else {
    console.log('⚠️ onPress={() => openChatFromNotif(n)} پیدا نشد');
  }
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی در صورت خرابی:');
console.log('   copy "' + backupDir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');