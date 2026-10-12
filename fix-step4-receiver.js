const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-step4recv-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. doAcceptD — تابع قدیمی
// ═══════════════════════════════════════════
const oldDoAcceptD = `  const doAcceptD = async (id: string) => {
    try {
      await acceptDirectHawala(id);
      showToast?.('✅ قبول شد');
      setTimeout(() => refresh(), 300);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };`;

const newDoAcceptD = `  const doAcceptD = async (id: string) => {
    try {
      const _r = await acceptDirectHawala(id);
      // 🪞 کپی توی fx_hawalas (تب حواله‌جات گیرنده)
      try {
        const _d = (_r as any)?.data;
        if (_d) {
          const fx = await import('./lib.fx');
          const _exists = (await fx.getHawalas()).find((h: any) => h._p2p_id === id);
          if (!_exists) {
            await fx.createHawala({
              code: _d.code || '',
              direction: 'receive',
              partner_code: _d.from_email || '',
              partner_name: _d.from_name || _d.from_email || '',
              beneficiary_name: _d.beneficiary_name || '',
              beneficiary_phone: _d.beneficiary_phone || '',
              beneficiary_city: _d.beneficiary_city || '',
              amount: Number(_d.amount) || 0,
              currency: _d.currency || 'USD',
              commission: Number(_d.commission) || 0,
              total: Number(_d.amount) || 0,
              status: 'pending',
              date: new Date().toISOString(),
              note: _d.note || '',
              _p2p_id: id,
              _p2p_type: 'direct',
              _p2p_source: 'P2P صرافی خصوصی — دریافتی',
            });
            console.log('✅ fx_hawalas برای گیرنده (doAcceptD) ساخته شد');
          }
        }
      } catch (e: any) { console.log('fx_hawalas receiver doAcceptD:', e?.message); }
      showToast?.('✅ قبول شد');
      setTimeout(() => refresh(), 300);
    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
  };`;

if (s.includes(oldDoAcceptD)) {
  s = s.replace(oldDoAcceptD, newDoAcceptD);
  console.log('✅ doAcceptD آپدیت شد');
} else {
  console.log('⚠️ doAcceptD الگو پیدا نشد (line ending یا فاصله)');
}

// ═══════════════════════════════════════════
// ۲. دکمه قبول داخل اعلان‌ها
// ═══════════════════════════════════════════
const oldNotifAccept = `onPress={async () => {
                                    try {
                                      const m = await import('./lib.network');
                                      if (t.includes('direct') && p.hawalaId) await (m as any).acceptDirectHawala?.(p.hawalaId);
                                      else if (t.includes('hawala') && (p.hawalaId || p.taskId)) await (m as any).claimHawala?.(p.hawalaId || p.taskId);
                                      else if (t.includes('fx') && p.offerId) await (m as any).claimFXOffer?.(p.offerId);
                                      showToast?.('✅ قبول شد');
                                      refresh();
                                    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
                                  }}`;

const newNotifAccept = `onPress={async () => {
                                    try {
                                      const m = await import('./lib.network');
                                      let _accData: any = null;
                                      if (t.includes('direct') && p.hawalaId) _accData = (await (m as any).acceptDirectHawala?.(p.hawalaId))?.data;
                                      else if (t.includes('hawala') && (p.hawalaId || p.taskId)) await (m as any).claimHawala?.(p.hawalaId || p.taskId);
                                      else if (t.includes('fx') && p.offerId) await (m as any).claimFXOffer?.(p.offerId);
                                      // 🪞 کپی توی fx_hawalas (گیرنده از اعلان)
                                      try {
                                        if (_accData && p.hawalaId) {
                                          const fx = await import('./lib.fx');
                                          const _exists = (await fx.getHawalas()).find((h: any) => h._p2p_id === p.hawalaId);
                                          if (!_exists) {
                                            await fx.createHawala({
                                              code: _accData.code || p.code || '',
                                              direction: 'receive',
                                              partner_code: _accData.from_email || p.from_email || '',
                                              partner_name: _accData.from_name || p.from_name || '',
                                              beneficiary_name: _accData.beneficiary_name || '',
                                              beneficiary_phone: _accData.beneficiary_phone || '',
                                              beneficiary_city: _accData.beneficiary_city || '',
                                              amount: Number(_accData.amount) || 0,
                                              currency: _accData.currency || p.currency || 'USD',
                                              commission: Number(_accData.commission) || 0,
                                              total: Number(_accData.amount) || 0,
                                              status: 'pending',
                                              date: new Date().toISOString(),
                                              note: _accData.note || '',
                                              _p2p_id: p.hawalaId,
                                              _p2p_type: 'direct',
                                              _p2p_source: 'P2P صرافی خصوصی — دریافتی (اعلان)',
                                            });
                                            console.log('✅ fx_hawalas برای گیرنده (اعلان) ساخته شد');
                                          }
                                        }
                                      } catch (e: any) { console.log('fx_hawalas receiver notif:', e?.message); }
                                      showToast?.('✅ قبول شد');
                                      refresh();
                                    } catch (e: any) { showToast?.('❌ ' + (e?.message || 'خطا'), true); }
                                  }}`;

if (s.includes(oldNotifAccept)) {
  s = s.replace(oldNotifAccept, newNotifAccept);
  console.log('✅ دکمه قبول در اعلان‌ها آپدیت شد');
} else {
  console.log('⚠️ دکمه قبول اعلان — الگو پیدا نشد');
  // چاپ متن برای دیباگ
  const idx = s.indexOf("t.includes('direct') && p.hawalaId) await (m as any).acceptDirectHawala");
  if (idx > 0) {
    console.log('🔍 متن پیدا شد در موقعیت ' + idx + ' — نمونه:');
    console.log(s.substring(idx - 200, idx + 400));
  }
}

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');