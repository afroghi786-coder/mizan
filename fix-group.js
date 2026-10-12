const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-group-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — اضافه getUnreadDetails
// ═══════════════════════════════════════════
let n = fs.readFileSync('lib.network.ts', 'utf8');
if (!n.includes('getUnreadDetails')) {
  n += '\n\n' + [
    '// 📋 جزئیات پیام‌های نخوانده (برای اعلان پیام)',
    'export async function getUnreadDetails(): Promise<Record<string, any>> {',
    '  const map: Record<string, any> = {};',
    '  try {',
    '    if (!_sb || !_myEmail) return map;',
    '    const { data } = await _sb.from(\'net_messages\')',
    '      .select(\'room_id, from_email, text, created_at\')',
    '      .eq(\'to_email\', _myEmail)',
    '      .eq(\'is_read\', false)',
    '      .order(\'created_at\', { ascending: false });',
    '    for (const row of (data || [])) {',
    '      const rId = (row as any).room_id;',
    '      if (!rId) continue;',
    '      if (!map[rId]) map[rId] = { count: 0, from: (row as any).from_email || \'\', lastText: (row as any).text || \'\', lastAt: (row as any).created_at || \'\' };',
    '      map[rId].count++;',
    '    }',
    '  } catch (e) {}',
    '  return map;',
    '}'
  ].join('\n');
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('✅ getUnreadDetails اضافه شد');
} else {
  console.log('ℹ️ getUnreadDetails از قبل هست');
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen.tsx
// ═══════════════════════════════════════════
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// ۲.۱ state جدید
if (!s.includes('unreadDetails')) {
  const anchor = 'const [notifUnread, setNotifUnread] = useState<any>({});';
  if (s.includes(anchor)) {
    s = s.replace(anchor, anchor + '\n  const [unreadDetails, setUnreadDetails] = useState<any>({});\n  const [groupedNotifs, setGroupedNotifs] = useState<any[]>([]);');
    console.log('✅ state unreadDetails + groupedNotifs اضافه شد');
  } else {
    console.log('❌ anchor notifUnread پیدا نشد');
    process.exit(1);
  }
}

// ۲.۲ جایگزینی useEffect قدیمی
const effectRegex = /\/\/ 🔢 شمارش پیام‌های نخوانده هر طرف \(از net_messages\)[\s\S]*?\}, \[\]\);/;
const newEffect = `// 🔢 شمارش + جزئیات پیام‌های نخوانده
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const m = await import('./lib.network');
        if (typeof (m as any).getUnreadByRoom === 'function') {
          const map = await (m as any).getUnreadByRoom();
          if (alive) setNotifUnread(map);
        }
        if (typeof (m as any).getUnreadDetails === 'function') {
          const det = await (m as any).getUnreadDetails();
          if (alive) setUnreadDetails(det);
        }
      } catch (e) {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // 📋 گروه‌بندی اعلان‌ها (حذف تکرار + اضافه اعلان پیام)
  useEffect(() => {
    const list = [...(notifList || [])];
    for (const rId of Object.keys(unreadDetails || {})) {
      const det = unreadDetails[rId];
      if (!det || !det.count || det.count <= 0) continue;
      const hasReal = list.some((nn: any) => {
        const p = nn.payload || {};
        const t = String(nn.type || '');
        let key = '';
        if (t === 'direct_hawala' || t === 'direct_accepted') key = 'dh_' + p.hawalaId;
        else if (t === 'hawala_taken' || t === 'hawala_new') key = 'hw_' + (p.taskId || p.hawalaId);
        else if (t === 'fx_new' || t === 'fx_taken') key = 'fx_' + p.offerId;
        return key === rId;
      });
      if (!hasReal) {
        list.push({
          id: 'v_' + rId,
          type: 'virtual_message',
          payload: { room_id: rId, count: det.count, from: det.from, lastText: det.lastText },
          created_at: det.lastAt,
          is_read: false,
          _virtual: true,
        });
      }
    }
    const groups: any = {};
    const order: string[] = [];
    for (const nn of list) {
      const p = nn.payload || {};
      const t = String(nn.type || '');
      let key = '';
      if (t === 'direct_hawala' || t === 'direct_accepted') key = 'dh_' + p.hawalaId;
      else if (t === 'hawala_taken' || t === 'hawala_new') key = 'hw_' + (p.taskId || p.hawalaId);
      else if (t === 'fx_new' || t === 'fx_taken') key = 'fx_' + p.offerId;
      else if (t === 'virtual_message') key = p.room_id || ('v_' + nn.id);
      else key = 'id_' + nn.id;
      if (!groups[key]) { groups[key] = nn; order.push(key); }
      else {
        const cur = groups[key];
        const curId = typeof cur.id === 'number' ? cur.id : 0;
        const newId = typeof nn.id === 'number' ? nn.id : 0;
        if (newId > curId) groups[key] = nn;
      }
    }
    setGroupedNotifs(order.map(k => groups[k]));
  }, [notifList, unreadDetails]);`;

if (effectRegex.test(s)) {
  s = s.replace(effectRegex, newEffect);
  console.log('✅ useEffect به‌روز شد');
} else {
  console.log('⚠️ useEffect قدیمی پیدا نشد');
}

// ۲.۳ notifList.map → groupedNotifs.map
if (s.includes(') : notifList.map((n: any, i: number) => {')) {
  s = s.replace(') : notifList.map((n: any, i: number) => {', ') : groupedNotifs.map((n: any, i: number) => {');
  console.log('✅ notifList.map → groupedNotifs.map');
} else {
  console.log('⚠️ الگوی notifList.map پیدا نشد');
}

// ۲.۴ notifList.length → groupedNotifs.length
if (s.includes('notifList.length === 0 ? (')) {
  s = s.replace(/notifList\.length === 0 \? \(/, 'groupedNotifs.length === 0 ? (');
  console.log('✅ notifList.length → groupedNotifs.length');
}

// ۲.۵ اضافه virtual_message به texts
const textsAnchor = 'hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency}`,';
if (s.includes(textsAnchor) && !s.includes('virtual_message:')) {
  s = s.replace(textsAnchor, textsAnchor + '\n                virtual_message: `💬 پیام جدید از ${p.from || "کاربر"}`,');
  console.log('✅ virtual_message به texts اضافه شد');
}

// ۲.۶ اضافه virtual_message به badge code
const chatBadgeIdx = s.indexOf('__chatBadgeAdded__');
if (chatBadgeIdx > 0) {
  const fxAnchor = "else if (t === 'fx_new' || t === 'fx_taken') rId = 'fx_' + p.offerId;";
  const beforeBadge = s.substring(0, chatBadgeIdx);
  const fxIdx = beforeBadge.lastIndexOf(fxAnchor);
  if (fxIdx > 0) {
    const insertAt = fxIdx + fxAnchor.length;
    const checkRange = s.substring(insertAt, insertAt + 200);
    if (!checkRange.includes("virtual_message")) {
      s = s.substring(0, insertAt) + "\n                          else if (t === 'virtual_message') rId = p.room_id;" + s.substring(insertAt);
      console.log('✅ virtual_message به badge اضافه شد');
    }
  }
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy "' + bdir + '\\lib.network.ts" lib.network.ts');
console.log('   copy "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');