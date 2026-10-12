// fix-init.js — اضافه کردن initNetwork به PublicMarketScreen
const fs = require('fs');
let s = fs.readFileSync('PublicMarketScreen.tsx', 'utf8');
const orig = s;
let n = 0;

// ۱. اضافه کردن initNetwork به load
const oldLoad = `  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await import('./lib.network');
      const fn = (m as any).fetchPublicAds;`;

const newLoad = `  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await import('./lib.network');
      // ⚡ مهم: initNetwork رو صدا بزن تا _sb آماده بشه
      await (m as any).loadNetSettings?.();
      await (m as any).initNetwork?.();
      const fn = (m as any).fetchPublicAds;`;

if (s.includes(oldLoad)) {
  s = s.replace(oldLoad, newLoad);
  console.log('✅ initNetwork اضافه شد به load');
  n++;
} else {
  console.log('⚠️ load پیدا نشد');
  // چاپ محدوده load
  const idx = s.indexOf('const load = useCallback');
  if (idx > 0) {
    console.log(s.substring(idx, idx + 500));
  }
}

// ۲. اضافه کردن initNetwork به submit
const oldSubmit = `  const submit = async () => {
    if (!form.title || form.title.trim().length < 3) return showToast?.('عنوان حداقل ۳ کاراکتر', true);`;

const newSubmit = `  const submit = async () => {
    if (!form.title || form.title.trim().length < 3) return showToast?.('عنوان حداقل ۳ کاراکتر', true);
    // ⚡ اطمینان از اتصال
    try {
      const m = await import('./lib.network');
      await (m as any).loadNetSettings?.();
      await (m as any).initNetwork?.();
    } catch (e) { console.log('init err:', e); }`;

if (s.includes(oldSubmit)) {
  s = s.replace(oldSubmit, newSubmit);
  console.log('✅ initNetwork اضافه شد به submit');
  n++;
}

// ۳. اضافه کردن initNetwork به polling
const oldPoll = `  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        const list = await (m as any).fetchMyUnreadMessages?.();`;

const newPoll = `  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const m = await import('./lib.network');
        await (m as any).initNetwork?.();
        const list = await (m as any).fetchMyUnreadMessages?.();`;

if (s.includes(oldPoll)) {
  s = s.replace(oldPoll, newPoll);
  console.log('✅ initNetwork اضافه شد به polling');
  n++;
}

if (s !== orig) {
  fs.writeFileSync('PublicMarketScreen.tsx', s, 'utf8');
  console.log('\\n💾 ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ هیچ تغییری اعمال نشد');
}