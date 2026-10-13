const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-disablesms-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
const mainAppPath = 'android/app/src/main/java/com/mezan786/mizan/MainApplication.kt';
fs.copyFileSync(mainAppPath, path.join(bdir, 'MainApplication.kt'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let mainApp = fs.readFileSync(mainAppPath, 'utf8');
const orig = mainApp;
const crlf = mainApp.includes('\r\n');
if (crlf) mainApp = mainApp.replace(/\r\n/g, '\n');

// حذف import
mainApp = mainApp.replace(/\nimport com\.mezan786\.mizan\.sms\.SmsReaderPackage/g, '');

// حذف add(SmsReaderPackage())
mainApp = mainApp.replace(/\n\s*add\(SmsReaderPackage\(\)\)/g, '');

if (crlf) mainApp = mainApp.replace(/\n/g, '\r\n');
if (mainApp !== orig) {
  fs.writeFileSync(mainAppPath, mainApp, 'utf8');
  console.log('✅ MainApplication.kt — SMS Package حذف شد');
} else {
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ حالا push کن:');
console.log('git add .');
console.log('git commit -m "test: disable SMS package (find crash)"');
console.log('git push');