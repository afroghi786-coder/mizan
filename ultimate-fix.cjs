const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════');
console.log('🔧 Fix نهایی — SDK 34 + بدون Native');
console.log('═══════════════════════════════════════════\n');

const bdir = 'backup-before-ultimate-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });

// ═══════════════════════════════════════════
// ۱. workflow — SDK 36 → 34
// ═══════════════════════════════════════════
const wf = '.github/workflows/build-android.yml';
if (fs.existsSync(wf)) {
  fs.copyFileSync(wf, path.join(bdir, 'build-android.yml'));
  let s = fs.readFileSync(wf, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  
  s = s.replace(/platforms;android-36/g, 'platforms;android-34');
  s = s.replace(/build-tools;36\.0\.0/g, 'build-tools;34.0.0');
  s = s.replace(/ndk;27\.1\.12297006/g, 'ndk;25.2.9519653');
  
  if (crlf) s = s.replace(/\n/g, '\r\n');
  fs.writeFileSync(wf, s, 'utf8');
  console.log('✅ workflow — SDK 34');
} else {
  console.log('❌ workflow پیدا نشد');
}

// ═══════════════════════════════════════════
// ۲. build.gradle files — compileSdk 34
// ═══════════════════════════════════════════
const gradleFiles = [
  'android/build.gradle',
  'android/app/build.gradle',
];
gradleFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  fs.copyFileSync(f, path.join(bdir, path.basename(f) + '.' + Date.now()));
  let g = fs.readFileSync(f, 'utf8');
  const crlf = g.includes('\r\n');
  if (crlf) g = g.replace(/\r\n/g, '\n');
  
  g = g.replace(/compileSdkVersion\s*=?\s*android-?\d+/g, 'compileSdkVersion = 34');
  g = g.replace(/targetSdkVersion\s*=?\s*android-?\d+/g, 'targetSdkVersion = 34');
  g = g.replace(/compileSdkVersion\s+android-?\d+/g, 'compileSdkVersion 34');
  g = g.replace(/targetSdkVersion\s+android-?\d+/g, 'targetSdkVersion 34');
  g = g.replace(/compileSdkVersion\s+\d+/g, 'compileSdkVersion 34');
  g = g.replace(/targetSdkVersion\s+\d+/g, 'targetSdkVersion 34');
  g = g.replace(/compileSdk\s*=\s*\d+/g, 'compileSdk = 34');
  g = g.replace(/targetSdk\s*=\s*\d+/g, 'targetSdk = 34');
  
  if (crlf) g = g.replace(/\n/g, '\r\n');
  fs.writeFileSync(f, g, 'utf8');
  console.log('✅ ' + f);
});

// ═══════════════════════════════════════════
// ۳. gradle.properties
// ═══════════════════════════════════════════
const props = 'android/gradle.properties';
if (fs.existsSync(props)) {
  fs.copyFileSync(props, path.join(bdir, 'gradle.properties'));
  let p = fs.readFileSync(props, 'utf8');
  const crlf = p.includes('\r\n');
  if (crlf) p = p.replace(/\r\n/g, '\n');
  
  // اگه خطی برای SDK هست، عوض کن
  p = p.replace(/android\.compileSdkVersion\s*=\s*\d+/g, 'android.compileSdkVersion=34');
  p = p.replace(/android\.targetSdkVersion\s*=\s*\d+/g, 'android.targetSdkVersion=34');
  
  if (crlf) p = p.replace(/\n/g, '\r\n');
  fs.writeFileSync(props, p, 'utf8');
  console.log('✅ gradle.properties');
}

// ═══════════════════════════════════════════
// ۴. MainApplication.kt — غیرفعال کردن همه Native Modules
// ═══════════════════════════════════════════
const mainApp = 'android/app/src/main/java/com/mezan786/mizan/MainApplication.kt';
if (fs.existsSync(mainApp)) {
  fs.copyFileSync(mainApp, path.join(bdir, 'MainApplication.kt'));
  let m = fs.readFileSync(mainApp, 'utf8');
  const crlf = m.includes('\r\n');
  if (crlf) m = m.replace(/\r\n/g, '\n');
  
  // کامنت کردن add(SpeechPackage()) و add(SmsReaderPackage())
  m = m.replace(/(\s*)add\(SpeechPackage\(\)\)/g, '$1// add(SpeechPackage()) // غیرفعال');
  m = m.replace(/(\s*)add\(SmsReaderPackage\(\)\)/g, '$1// add(SmsReaderPackage()) // غیرفعال');
  
  if (crlf) m = m.replace(/\n/g, '\r\n');
  fs.writeFileSync(mainApp, m, 'utf8');
  console.log('✅ MainApplication.kt — Native غیرفعال');
}

// ═══════════════════════════════════════════
// ۵. حذف Java files (کاملاً پاک شه)
// ═══════════════════════════════════════════
const javaDirs = [
  'android/app/src/main/java/com/mezan786/mizan/speech',
  'android/app/src/main/java/com/mezan786/mizan/sms',
];
javaDirs.forEach(d => {
  if (fs.existsSync(d)) {
    fs.rmSync(d, { recursive: true, force: true });
    console.log('🗑 حذف شد: ' + d);
  }
});

// ═══════════════════════════════════════════
// ۶. AndroidManifest — حذف مجوزهای بی‌استفاده
// ═══════════════════════════════════════════
const manifest = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(manifest)) {
  fs.copyFileSync(manifest, path.join(bdir, 'AndroidManifest.xml'));
  let man = fs.readFileSync(manifest, 'utf8');
  const crlf = man.includes('\r\n');
  if (crlf) man = man.replace(/\r\n/g, '\n');
  
  // حذف مجوزهای SMS و Audio (چون Native غیرفعال شد)
  man = man.replace(/\s*<uses-permission android:name="android\.permission\.READ_SMS"\s*\/>/g, '');
  man = man.replace(/\s*<uses-permission android:name="android\.permission\.RECEIVE_SMS"\s*\/>/g, '');
  // RECORD_AUDIO رو نگه می‌داریم چون ممکنه بعداً لازم بشه
  
  if (crlf) man = man.replace(/\n/g, '\r\n');
  fs.writeFileSync(manifest, man, 'utf8');
  console.log('✅ AndroidManifest');
}

// ═══════════════════════════════════════════
// ۷. lib.voice.ts — تشخیص خودکار بدون Native
// ═══════════════════════════════════════════
const voiceFile = 'lib.voice.ts';
if (fs.existsSync(voiceFile)) {
  fs.copyFileSync(voiceFile, path.join(bdir, 'lib.voice.ts'));
  let v = fs.readFileSync(voiceFile, 'utf8');
  const crlf = v.includes('\r\n');
  if (crlf) v = v.replace(/\r\n/g, '\n');
  
  // hasNativeSpeech همیشه false (چون Native غیرفعال شد)
  v = v.replace(/export const hasNativeSpeech = [^;]+;/, 'export const hasNativeSpeech = false; // غیرفعال شد');
  
  if (crlf) v = v.replace(/\n/g, '\r\n');
  fs.writeFileSync(voiceFile, v, 'utf8');
  console.log('✅ lib.voice.ts — Native غیرفعال');
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام تغییرات اعمال شد');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('🛡 بکاپ در: ' + bdir);
console.log('');
console.log('═'.repeat(50));
console.log('الان این ۳ دستور رو به ترتیب بزن:');
console.log('═'.repeat(50));
console.log('');
console.log('۱.  git add .');
console.log('');
console.log('۲.  git commit -m "fix: SDK 34 + disable all native modules"');
console.log('');
console.log('۳.  git push');
console.log('');
console.log('═'.repeat(50));