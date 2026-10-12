const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-nodup-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const wasCRLF = n.includes('\r\n');
if (wasCRLF) n = n.replace(/\r\n/g, '\n');

// پیدا کردن بلوک پاک کردن قدیمی
const oldClean = `    // حذف اعلان‌های نخوانده قبلی همون حواله (جلوگیری از تکرار)
    try {
      if (_hawalaId) {
        await _sb.from('net_notifications')
          .delete()
          .eq('to_email', toEmail)
          .eq('is_read', false)
          .in('type', ['direct_hawala', 'hawala_new', 'new_message', 'direct_accepted']);
      }
    } catch (e) { console.log('del old notif err:', e); }

    // حذف دقیق بر اساس hawalaId در payload
    try {
      if (_hawalaId) {
        const { data: existingList } = await _sb.from('net_notifications')
          .select('id, payload, type')
          .eq('to_email', toEmail)
          .eq('is_read', false);
        const toDelete = (existingList || []).filter((x: any) => {
          const pl = x.payload || {};
          return pl.hawalaId === _hawalaId || pl.room_id === roomId;
        });
        for (const item of toDelete) {
          try { await _sb.from('net_notifications').delete().eq('id', item.id); } catch {}
        }
      }
    } catch (e) { console.log('clean old notif err:', e); }`;

const newClean = `    // 🧹 پاک کردن همه اعلان‌های همین حواله (خوانده یا نخوانده)
    try {
      if (_hawalaId || roomId) {
        const { data: allList } = await _sb.from('net_notifications')
          .select('id, payload')
          .eq('to_email', toEmail);
        const toDelete = (allList || []).filter((x: any) => {
          const pl = x.payload || {};
          return pl.hawalaId === _hawalaId || pl.room_id === roomId;
        });
        for (const item of toDelete) {
          try { await _sb.from('net_notifications').delete().eq('id', item.id); } catch {}
        }
        console.log('🧹 ' + toDelete.length + ' اعلان قدیمی حذف شد برای hawala:', _hawalaId);
      }
    } catch (e) { console.log('clean old notif err:', e); }`;

if (n.includes(oldClean)) {
  n = n.replace(oldClean, newClean);
  console.log('✅ بلوک پاک کردن آپدیت شد');
} else {
  console.log('⚠️ الگوی قدیمی پیدا نشد');
  const idx = n.indexOf('// حذف اعلان‌های نخوانده قبلی');
  if (idx > 0) console.log('نمونه:\n' + n.substring(idx, idx + 300));
}

if (wasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');