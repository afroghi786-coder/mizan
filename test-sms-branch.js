const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۱. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-branch-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('App.tsx', path.join(bdir, 'App.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۲. App.tsx — حذف فقط UI (native می‌مونه)
// ═══════════════════════════════════════════
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;
const crlf = app.includes('\r\n');
if (crlf) app = app.replace(/\r\n/g, '\n');

// حذف import
app = app.replace(/\nimport SmsMatchScreen from '\.\/SmsMatchScreen';/g, '');
console.log('🗑 import SmsMatchScreen حذف شد');

// تغییر render به یه View ساده
app = app.replace(
  /\{tab === 'bankMatch' && <SmsMatchScreen showToast=\{showToast\} \/>\}/g,
  "{tab === 'bankMatch' && <View style={{flex:1, backgroundColor:'#0a1628', justifyContent:'center', alignItems:'center'}}><Text style={{color:'#fff', fontSize:20}}>🧪 تست SMS</Text></View>}"
);
console.log('✅ render SMS تغییر کرد به View ساده');

if (crlf) app = app.replace(/\n/g, '\r\n');
if (app !== appOrig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

// ═══════════════════════════════════════════
// ۳. workflow جدید با نام مشخص
// ═══════════════════════════════════════════
const workflowPath = '.github/workflows/build-android-sms-test.yml';
const newWorkflow = `name: Build APK - SMS Test

on:
  push:
    branches: [test-sms]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
        with:
          packages: 'platforms;android-36 build-tools;36.0.0 ndk;27.1.12297006'

      - name: Install dependencies
        run: npm install

      - name: Revert gradle URL to official
        run: |
          sed -i 's|mirrors.cloud.tencent.com/gradle/|services.gradle.org/distributions/|g' android/gradle/wrapper/gradle-wrapper.properties
          sed -i 's|-all.zip|-bin.zip|g' android/gradle/wrapper/gradle-wrapper.properties

      - name: Build APK
        working-directory: android
        run: |
          chmod +x gradlew
          ./gradlew assembleRelease --no-daemon

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: mizan-sms-test-apk
          path: android/app/build/outputs/apk/release/app-release.apk
          retention-days: 30
`;
fs.writeFileSync(workflowPath, newWorkflow, 'utf8');
console.log('✅ workflow جدید ساخته شد: ' + workflowPath);

// ═══════════════════════════════════════════
// ۴. دستورات git
// ═══════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام — حالا این دستورات رو به ترتیب بزن:');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('۱. ساخت branch جدید:');
console.log('   git checkout -b test-sms');
console.log('');
console.log('۲. اضافه کردن تغییرات:');
console.log('   git add .');
console.log('');
console.log('۳. commit:');
console.log('   git commit -m "test: SMS native only (no UI)"');
console.log('');
console.log('۴. push به branch جدید:');
console.log('   git push -u origin test-sms');
console.log('');
console.log('۵. برگشت به main:');
console.log('   git checkout main');
console.log('');
console.log('═══════════════════════════════════════════');