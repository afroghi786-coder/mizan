const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-nodup2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const wasCRLF = n.includes('\r\n');
if (wasCRLF) n = n.replace(/\r\n/g, '\n');

// پیدا کردن از "// حذف اعلان‌های نخوانده" تا "ساخت اعلان جدید"
const startMarker = '// حذف اعلان‌های نخوانده';
const endMarker = '// ساخت اعلان جدید با کانتکست';

const startIdx = n.indexOf(startMarker);
const endIdx = n.indexOf(endMarker, startIdx);

if (startIdx < 0 || endIdx < 0) {
  console.log('❌ markers پیدا نشد');
  console.log('startIdx: ' + startIdx);
  console.log('endIdx: ' + endIdx);
  process.exit(1);
}

console.log('✅ markers پیدا شد: ' + startIdx + ' → ' + endIdx);

const newBlock = `// 🧹 پاک کردن همه اعلان‌های همین حواله (خوانده یا نخوانده)
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
    } catch (e) { console.log('clean old notif err:', e); }

    `;

n = n.substring(0, startIdx) + newBlock + n.substring(endIdx);

if (wasCRLF) n = n.replace(/\n/g, '\r\n');
if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');