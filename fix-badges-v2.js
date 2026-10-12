const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ امن
// ═══════════════════════════════════════════
const backupDir = 'backup-before-badges-v2-' + Date.now();
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(backupDir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(backupDir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ در: ' + backupDir);
console.log('');

// ═══════════════════════════════════════════
// ۱. lib.network.ts — اضافه تابع getUnreadByRoom
// ═══════════════════════════════════════════
console.log('═══ lib.network.ts ═══');
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;

if (!n.includes('getUnreadByRoom')) {
  // اضافه در انتهای فایل
  const func = `

// 🔢 شمارش پیام‌های نخوانده به تفکیک room_id (برای badge روی 💬 پیام)
export async function getUnreadByRoom(): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  try {
    if (!_sb || !_myEmail) return map;
    const { data } = await _sb.from('net_messages')
      .select('room_id')
      .eq('to_email', _myEmail)
      .eq('is_read', false);
    for (const row of (data || [])) {
      const rId = (row as any).room_id;
      if (rId) map[rId] = (map[rId] || 0) + 1;
    }
  } catch (e) {}
  return map;
}
`;
  n = n + func;
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('✅ تابع getUnreadByRoom اضافه شد');
} else {
  console.log('ℹ️ تابع از قبل هست');
}

// ═══════════════════════════════════════════
// ۲. LiveMarketScreen — تصحیح useEffect
// ═══════════════════════════════════════════
console.log('');
console.log('═══ LiveMarketScreen.tsx ═══');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;

// حذف useEffect قدیمی که از _sb استفاده می‌کرد
const oldEffectRe = /\n\s*\/\/ 🔢 شمارش پیام‌های نخوانده هر طرف \(از net_messages\)[\s\S]*?\}, \[notifList, net\.email\]\);/;
if (oldEffectRe.test(s)) {
  s = s.replace(oldEffectRe, '');
  console.log('✅ useEffect قدیمی حذف شد');
}

// اضافه useEffect جدید که از getUnreadByRoom استفاده می‌کنه
if (!s.includes('getUnreadByRoom')) {
  const anchor = "useEffect(() => { refresh(); return () => stopAllListeners(); }, [refresh]);";
  if (s.includes(anchor)) {
    const effect = `

  // 🔢 شمارش پیام‌های نخوانده هر طرف (از net_messages)
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const m = await import('./lib.network');
        if (typeof (m as any).getUnreadByRoom === 'function') {
          const map = await (m as any).getUnreadByRoom();
          if (alive) setNotifUnread(map);
        }
      } catch (e) {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, []);`;
    s = s.replace(anchor, anchor + effect);
    console.log('✅ useEffect جدید اضافه شد');
  } else {
    console.log('⚠️ anchor useEffect پیدا نشد');
  }
} else {
  console.log('ℹ️ useEffect از قبل هست');
}

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy "' + backupDir + '\\lib.network.ts" lib.network.ts');
console.log('   copy "' + backupDir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');