const fs = require('fs');

console.log('🔧 Fix line 449\n');

let app = fs.readFileSync('App.tsx', 'utf8');
const orig = app;
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// جایگزینی useEffect مشکل‌دار
const oldCode = `  // Unlock audio در اولین کلیک
  useEffect(() => {
    if (_isWebView || typeof window === 'undefined') return;
    const unlock = () => { try { unlockAudio(); } catch {} };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      try {
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
      } catch {}
    };
  }, []);`;

const newCode = `  // Unlock audio در اولین کلیک (ایمن شده)
  useEffect(() => {
    try {
      if (_isWebView) return;
      if (typeof window === 'undefined') return;
      if (!window || typeof window.addEventListener !== 'function') return;
      const unlock = () => { try { if (typeof unlockAudio === 'function') unlockAudio(); } catch {} };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
      return () => {
        try {
          if (window && typeof window.removeEventListener === 'function') {
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
          }
        } catch {}
      };
    } catch (e) {
      console.log('audio unlock err:', e);
      return;
    }
  }, []);`;

if (app.includes(oldCode)) {
  app = app.replace(oldCode, newCode);
  console.log('✅ useEffect آپدیت شد (ایمن)');
} else {
  console.log('⚠️ الگو پیدا نشد — جستجوی خطی');
  
  // روش خطی
  const lines = app.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("window.addEventListener('click', unlock")) {
      // این خط ۴۴۹ هست
      // خطوط ۴۴۵ تا ۴۵۷ رو عوض کن
      const startIdx = i - 4; // useEffect start
      const endIdx = i + 8;   // useEffect end
      
      console.log('خط ' + (i + 1) + ' پیدا شد → عوض می‌کنم');
      
      // خطای احتمالی: window.addEventListener undefined
      lines[i] = "      if (window && typeof window.addEventListener === 'function') {";
      lines[i + 1] = "        " + lines[i + 1].trim();
      lines[i + 2] = "        " + lines[i + 2].trim();
      lines[i + 3] = "      }";
      
      app = lines.join('\n');
      console.log('✅ خطی fix شد');
      break;
    }
  }
}

if (crlf) app = app.replace(/\n/g, '\r\n');
if (app !== orig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('\nالان بزن:');
console.log('  npx expo start --clear');