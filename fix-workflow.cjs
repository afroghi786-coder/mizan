const fs = require('fs');
const path = require('path');

const wf = '.github/workflows/build-android.yml';

if (!fs.existsSync(wf)) {
  console.log('❌ فایل پیدا نشد: ' + wf);
  process.exit(1);
}

const bdir = 'backup-before-wffix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync(wf, path.join(bdir, 'build-android.yml'));

let s = fs.readFileSync(wf, 'utf8');
const orig = s;
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

// عوض کردن branches
s = s.replace(
  /branches:\s*\[[^\]]*\]/g,
  "branches: ['**']"
);

// اگه branches نبود، اضافه کن
if (!s.includes('branches:')) {
  s = s.replace(
    /on:\s*\n\s*push:\s*\n/,
    "on:\n  push:\n    branches: ['**']\n"
  );
}

if (crlf) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync(wf, s, 'utf8');
  console.log('✅ workflow آپدیت شد — همه branch ها');
} else {
  console.log('⚠️ تغییری نکرد');
}

console.log('');
console.log('الان:');
console.log('  git add .');
console.log('  git commit -m "ci: run workflow on all branches"');
console.log('  git push origin HEAD:refs/heads/test-nopm --force');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\build-android.yml" ' + wf);