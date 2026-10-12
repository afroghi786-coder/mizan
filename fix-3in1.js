const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-3in1-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['LiveMarketScreen.tsx', 'ExchangeScreen.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// SECTION 1: LiveMarketScreen — locallyAccepted + event + offline
// ═══════════════════════════════════════════════════════
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ─── 1.1 اضافه state locallyAccepted ───
const anchorState = "const [groupedNotifs, setGroupedNotifs] = useState<any[]>([]);";
if (!s.includes('locallyAccepted')) {
  if (s.includes(anchorState)) {
    s = s.replace(anchorState, anchorState + "\n  const [locallyAccepted, setLocallyAccepted] = useState<any>({});");
    console.log('✅ state locallyAccepted اضافه شد');
  } else {
    console.log('⚠️ anchor state پیدا نشد');
  }
} else {
  console.log('ℹ️ locallyAccepted از قبل هست');
}

// ─── 1.2 اضافه event dispatch بعد از fx.createHawala (دو جا در submit) ───
let eventAdded = 0;
s = s.replace(
  /console\.log\('✅ fx_hawalas برای فرستنده ساخته شد'\);/g,
  "console.log('✅ fx_hawalas برای فرستنده ساخته شد');\n          if (typeof window !== 'undefined') window.dispatchEvent(new Event('mizan-hawala-updated'));"
);
eventAdded += (s.match(/mizan-hawala-updated/g) || []).length;

s = s.replace(
  /console\.log\('✅ fx_hawalas برای فرستنده عمومی ساخته شد'\);/g,
  "console.log('✅ fx_hawalas برای فرستنده عمومی ساخته شد');\n          if (typeof window !== 'undefined') window.dispatchEvent(new Event('mizan-hawala-updated'));"
);
eventAdded += (s.match(/mizan-hawala-updated/g) || []).length;

console.log('✅ event dispatch اضافه شد (' + (s.match(/mizan-hawala-updated/g) || []).length + ' جا)');

// ─── 1.3 doAcceptD — set locallyAccepted + event ───
const oldDoAccept = `  const doAcceptD = async (id: string) => {
    try {
      const _r = await acceptDirectHawala(id);`;
const newDoAccept = `  const doAcceptD = async (id: string) => {
    try {
      const _r = await acceptDirectHawala(id);
      setLocallyAccepted((prev: any) => ({ ...prev, [id]: true }));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('mizan-hawala-updated'));`;
if (s.includes(oldDoAccept)) {
  s = s.replace(oldDoAccept, newDoAccept);
  console.log('✅ doAcceptD آپدیت شد (locallyAccepted + event)');
} else {
  console.log('⚠️ doAcceptD الگو پیدا نشد');
}

// ─── 1.4 دکمه قبول در اعلان‌ها — set locallyAccepted ───
const oldNotifAccept = `                                      } catch (e: any) { console.log('fx_hawalas receiver notif:', e?.message); }
                                      showToast?.('✅ قبول شد');
                                      refresh();`;
const newNotifAccept = `                                      } catch (e: any) { console.log('fx_hawalas receiver notif:', e?.message); }
                                      if (p.hawalaId) setLocallyAccepted((prev: any) => ({ ...prev, [p.hawalaId]: true }));
                                      if (typeof window !== 'undefined') window.dispatchEvent(new Event('mizan-hawala-updated'));
                                      showToast?.('✅ قبول شد');
                                      refresh();`;
if (s.includes(oldNotifAccept)) {
  s = s.replace(oldNotifAccept, newNotifAccept);
  console.log('✅ دکمه قبول اعلان آپدیت شد (locallyAccepted)');
} else {
  console.log('⚠️ دکمه قبول اعلان — الگو پیدا نشد');
}

// ─── 1.5 isAccepted logic ───
const oldIsAcc = `const isAccepted = t.includes('taken') || t.includes('accepted');`;
const newIsAcc = `const isAccepted = t.includes('taken') || t.includes('accepted') || (p.hawalaId && locallyAccepted[p.hawalaId]);`;
if (s.includes(oldIsAcc)) {
  s = s.replace(oldIsAcc, newIsAcc);
  console.log('✅ isAccepted آپدیت شد');
} else {
  console.log('⚠️ isAccepted الگو پیدا نشد');
}

// ─── 1.6 Offline support در submitDirect و submitHawala ───
// تبدیل guard به حالت soft
const guardOld = `if (!net.connected) return showToast?.('❌ Firebase وصل نیست — VPN روشن کن', true);`;
const guardNew = `const _isOffline = !net.connected; if (_isOffline) showToast?.('⏳ آفلاین — محلی ذخیره می‌شود');`;
let guardCount = 0;
while (s.includes(guardOld) && guardCount < 5) {
  s = s.replace(guardOld, guardNew);
  guardCount++;
}
console.log('✅ ' + guardCount + ' جا guard آفلاین اصلاح شد');

// ─── 1.7 wrap send در try/catch ───
const oldSendDirect = `      const _res = await sendDirectHawala({`;
const newSendDirect = `      let _res: any = { code: '' };
      try {
        _res = await sendDirectHawala({`;
if (s.includes(oldSendDirect)) {
  // پیدا کردن انتهای فراخوانی
  const start = s.indexOf(oldSendDirect);
  const endMarker = `        note: directForm.note,
      });`;
  const endIdx = s.indexOf(endMarker, start);
  if (endIdx > 0) {
    const endPos = endIdx + endMarker.length;
    const before = s.substring(0, start);
    const middle = s.substring(start, endPos);
    const after = s.substring(endPos);
    // تبدیل middle
    const newMiddle = middle.replace(
      `      const _res = await sendDirectHawala({`,
      `      let _res: any = { code: '' };
      try {
        _res = await sendDirectHawala({`
    );
    const finalMiddle = newMiddle + `
      } catch (_sendErr: any) {
        console.log('⚠️ sendDirectHawala ناموفق (آفلاین؟):', _sendErr?.message);
        showToast?.('⏳ آفلاین — بعداً ارسال می‌شود');
      }`;
    s = before + finalMiddle + after;
    console.log('✅ submitDirect try/catch آفلاین اضافه شد');
  }
} else {
  console.log('⚠️ submitDirect send — الگو پیدا نشد');
}

const oldSendBH = `      const _res = await sendBroadcastHawala({`;
if (s.includes(oldSendBH)) {
  const start = s.indexOf(oldSendBH);
  const endMarker = `        note: hawalaForm.note,
      });`;
  const endIdx = s.indexOf(endMarker, start);
  if (endIdx > 0) {
    const endPos = endIdx + endMarker.length;
    const before = s.substring(0, start);
    const middle = s.substring(start, endPos);
    const after = s.substring(endPos);
    const newMiddle = middle.replace(
      `      const _res = await sendBroadcastHawala({`,
      `      let _res: any = { code: '' };
      try {
        _res = await sendBroadcastHawala({`
    );
    const finalMiddle = newMiddle + `
      } catch (_sendErr: any) {
        console.log('⚠️ sendBroadcastHawala ناموفق (آفلاین؟):', _sendErr?.message);
        showToast?.('⏳ آفلاین — بعداً ارسال می‌شود');
      }`;
    s = before + finalMiddle + after;
    console.log('✅ submitHawala try/catch آفلاین اضافه شد');
  }
} else {
  console.log('⚠️ submitHawala send — الگو پیدا نشد');
}

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

// ═══════════════════════════════════════════════════════
// SECTION 2: ExchangeScreen — listener برای رویداد
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ ExchangeScreen.tsx ═══');
let ex = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const exOrig = ex;
const exWasCRLF = ex.includes('\r\n');
if (exWasCRLF) ex = ex.replace(/\r\n/g, '\n');

if (!ex.includes('mizan-hawala-updated')) {
  // پیدا کردن اولین useEffect داخل تابع ExchangeScreen
  const funcStart = ex.indexOf('function ExchangeScreen(');
  if (funcStart > 0) {
    const useEffectIdx = ex.indexOf('useEffect(', funcStart);
    if (useEffectIdx > 0) {
      // پیدا کردن پایان useEffect — اولین "}, [" یا "});"
      const endMatch = ex.substring(useEffectIdx).match(/\}, \[[^\]]*\]\);/);
      if (endMatch) {
        const insertPos = useEffectIdx + endMatch.index + endMatch[0].length;
        const listenerCode = `

  // 🔄 گوش دادن به رویداد حواله (بعد از P2P)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const _handler = () => { try { reload(); } catch {} };
    window.addEventListener('mizan-hawala-updated', _handler);
    return () => window.removeEventListener('mizan-hawala-updated', _handler);
  }, [reload]);`;
        ex = ex.substring(0, insertPos) + listenerCode + ex.substring(insertPos);
        console.log('✅ listener به ExchangeScreen اضافه شد');
      } else {
        console.log('⚠️ انتهای useEffect پیدا نشد');
      }
    } else {
      console.log('⚠️ useEffect داخل ExchangeScreen پیدا نشد');
    }
  } else {
    console.log('⚠️ function ExchangeScreen پیدا نشد');
  }
} else {
  console.log('ℹ️ listener از قبل هست');
}

if (exWasCRLF) ex = ex.replace(/\n/g, '\r\n');
if (ex !== exOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', ex, 'utf8');
  console.log('💾 ExchangeScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');
console.log('   copy /Y "' + bdir + '\\ExchangeScreen.tsx" ExchangeScreen.tsx');