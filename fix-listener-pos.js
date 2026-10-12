const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-listenerpos-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('ExchangeScreen.tsx', path.join(bdir, 'ExchangeScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. حذف listener خراب (هر دو نسخه)
// ═══════════════════════════════════════════
const brokenListener = `  // 🔄 گوش دادن به رویداد حواله (بعد از P2P)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const _handler = () => { try { reload(); } catch {} };
    window.addEventListener('mizan-hawala-updated', _handler);
    return () => window.removeEventListener('mizan-hawala-updated', _handler);
  }, [reload]);`;

if (s.includes(brokenListener)) {
  s = s.replace(brokenListener, '');
  console.log('✅ listener خراب حذف شد');
} else {
  // اگه whitespace فرق داشت، با regex
  const regex = /\s*\/\/ 🔄 گوش دادن به رویداد حواله[\s\S]*?\}, \[reload\]\);/;
  if (regex.test(s)) {
    s = s.replace(regex, '');
    console.log('✅ listener خراب (regex) حذف شد');
  } else {
    console.log('⚠️ listener خراب پیدا نشد');
  }
}

// ═══════════════════════════════════════════
// ۲. پیدا کردن انتهای reload definition
// ═══════════════════════════════════════════
const reloadStart = s.indexOf('const reload = useCallback(');
if (reloadStart < 0) {
  console.log('❌ reload پیدا نشد');
  process.exit(1);
}

// پیدا کردن انتهای useCallback — الگو: `}, [دependencies]);` در خط بعد
const reloadArea = s.substring(reloadStart, reloadStart + 3000);
const reloadEndMatch = reloadArea.match(/\}, \[[^\]]*\]\);/);

if (!reloadEndMatch) {
  console.log('❌ انتهای useCallback پیدا نشد');
  process.exit(1);
}

const reloadEndPos = reloadStart + reloadEndMatch.index + reloadEndMatch[0].length;
console.log('✅ reload از ' + reloadStart + ' تا ' + reloadEndPos);

// ═══════════════════════════════════════════
// ۳. اضافه listener جدید بعد از reload
// ═══════════════════════════════════════════
const newListener = `

  // 🔄 listener برای رویداد حواله — cross-platform
  useEffect(() => {
    const _handler = () => { try { reload(); } catch (e) { console.log('reload err:', e); } };
    const _unsub = onHawalaUpdate(_handler);
    return () => { try { _unsub(); } catch {} };
  }, [reload]);`;

s = s.substring(0, reloadEndPos) + newListener + s.substring(reloadEndPos);
console.log('✅ listener جدید بعد از reload اضافه شد');

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\ExchangeScreen.tsx" ExchangeScreen.tsx');