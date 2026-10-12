const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-smsnative-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });

const filesToBackup = [
  'android/app/src/main/java/com/mezan786/mizan/MainApplication.kt',
  'android/app/src/main/AndroidManifest.xml',
];
filesToBackup.forEach(f => {
  if (fs.existsSync(f)) {
    const dest = path.join(bdir, path.basename(f));
    fs.copyFileSync(f, dest);
  }
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// ۱. ساخت پوشه
// ═══════════════════════════════════════════
const smsDir = 'android/app/src/main/java/com/mezan786/mizan/sms';
if (!fs.existsSync(smsDir)) {
  fs.mkdirSync(smsDir, { recursive: true });
  console.log('✅ پوشه ساخته شد: ' + smsDir);
}
// پاک کردن پوشه اشتباه
const wrongDir = 'android/app/src/main/java/com/mizan';
if (fs.existsSync(wrongDir)) {
  fs.rmSync(wrongDir, { recursive: true, force: true });
  console.log('🗑 پوشه اشتباه حذف شد: ' + wrongDir);
}

// ═══════════════════════════════════════════
// ۲. ساخت SmsReaderModule.java
// ═══════════════════════════════════════════
const moduleCode = `package com.mezan786.mizan.sms;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class SmsReaderModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public SmsReaderModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "SmsReader";
    }

    @ReactMethod
    public void readInbox(int limit, Promise promise) {
        try {
            Uri uri = Uri.parse("content://sms/inbox");
            ContentResolver cr = reactContext.getContentResolver();
            Cursor cursor = cr.query(uri, null, null, null, "date DESC LIMIT " + limit);
            WritableArray result = Arguments.createArray();
            if (cursor != null) {
                int idxId = cursor.getColumnIndex("_id");
                int idxAddr = cursor.getColumnIndex("address");
                int idxBody = cursor.getColumnIndex("body");
                int idxDate = cursor.getColumnIndex("date");
                while (cursor.moveToNext()) {
                    WritableMap map = Arguments.createMap();
                    map.putString("id", idxId >= 0 ? cursor.getString(idxId) : "");
                    map.putString("address", idxAddr >= 0 ? cursor.getString(idxAddr) : "");
                    map.putString("body", idxBody >= 0 ? cursor.getString(idxBody) : "");
                    map.putDouble("date", idxDate >= 0 ? (double) cursor.getLong(idxDate) : 0);
                    result.pushMap(map);
                }
                cursor.close();
            }
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("SMS_READ_ERROR", e);
        }
    }
}
`;
fs.writeFileSync(smsDir + '/SmsReaderModule.java', moduleCode, 'utf8');
console.log('✅ SmsReaderModule.java ساخته شد');

// ═══════════════════════════════════════════
// ۳. ساخت SmsReaderPackage.java
// ═══════════════════════════════════════════
const packageCode = `package com.mezan786.mizan.sms;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SmsReaderPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new SmsReaderModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;
fs.writeFileSync(smsDir + '/SmsReaderPackage.java', packageCode, 'utf8');
console.log('✅ SmsReaderPackage.java ساخته شد');

// ═══════════════════════════════════════════
// ۴. آپدیت MainApplication.kt
// ═══════════════════════════════════════════
const mainAppPath = 'android/app/src/main/java/com/mezan786/mizan/MainApplication.kt';
let mainApp = fs.readFileSync(mainAppPath, 'utf8');
const mainAppOrig = mainApp;
const mainWasCRLF = mainApp.includes('\r\n');
if (mainWasCRLF) mainApp = mainApp.replace(/\r\n/g, '\n');

// اضافه import
if (!mainApp.includes('import com.mezan786.mizan.sms.SmsReaderPackage')) {
  mainApp = mainApp.replace(
    "import expo.modules.ExpoReactHostFactory",
    "import expo.modules.ExpoReactHostFactory\nimport com.mezan786.mizan.sms.SmsReaderPackage"
  );
  console.log('✅ import اضافه شد به MainApplication.kt');
}

// اضافه add(SmsReaderPackage())
if (!mainApp.includes('add(SmsReaderPackage())')) {
  mainApp = mainApp.replace(
    "// add(MyReactNativePackage())",
    "// add(MyReactNativePackage())\n          add(SmsReaderPackage())"
  );
  console.log('✅ add(SmsReaderPackage()) اضافه شد');
}

if (mainWasCRLF) mainApp = mainApp.replace(/\n/g, '\r\n');
if (mainApp !== mainAppOrig) {
  fs.writeFileSync(mainAppPath, mainApp, 'utf8');
  console.log('💾 MainApplication.kt ذخیره شد');
}

// ═══════════════════════════════════════════
// ۵. آپدیت AndroidManifest.xml
// ═══════════════════════════════════════════
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = fs.readFileSync(manifestPath, 'utf8');
const manifestOrig = manifest;
const manifestWasCRLF = manifest.includes('\r\n');
if (manifestWasCRLF) manifest = manifest.replace(/\r\n/g, '\n');

if (!manifest.includes('android.permission.READ_SMS')) {
  manifest = manifest.replace(
    '  <queries>',
    '  <uses-permission android:name="android.permission.READ_SMS"/>\n  <uses-permission android:name="android.permission.RECEIVE_SMS"/>\n  <queries>'
  );
  console.log('✅ مجوزهای SMS اضافه شد به Manifest');
} else {
  console.log('ℹ️ مجوزها از قبل هستن');
}

if (manifestWasCRLF) manifest = manifest.replace(/\n/g, '\r\n');
if (manifest !== manifestOrig) {
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('💾 AndroidManifest.xml ذخیره شد');
}

// ═══════════════════════════════════════════
// چک نهایی
// ═══════════════════════════════════════════
console.log('');
console.log('═══ چک نهایی ═══');
const files = [
  smsDir + '/SmsReaderModule.java',
  smsDir + '/SmsReaderPackage.java',
  mainAppPath,
  manifestPath,
];
files.forEach(f => {
  const exists = fs.existsSync(f);
  console.log((exists ? '✅' : '❌') + ' ' + f);
});

const mainCheck = fs.readFileSync(mainAppPath, 'utf8');
console.log('');
console.log('MainApplication.kt:');
console.log('   add(SmsReaderPackage()): ' + (mainCheck.includes('add(SmsReaderPackage())') ? '✅' : '❌'));
console.log('   import package: ' + (mainCheck.includes('import com.mezan786.mizan.sms.SmsReaderPackage') ? '✅' : '❌'));

const manCheck = fs.readFileSync(manifestPath, 'utf8');
console.log('AndroidManifest.xml:');
console.log('   READ_SMS: ' + (manCheck.includes('READ_SMS') ? '✅' : '❌'));
console.log('   RECEIVE_SMS: ' + (manCheck.includes('RECEIVE_SMS') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی در صورت خرابی:');
console.log('   copy /Y "' + bdir + '\\MainApplication.kt" android\\app\\src\\main\\java\\com\\mezan786\\mizan\\MainApplication.kt');
console.log('   copy /Y "' + bdir + '\\AndroidManifest.xml" android\\app\\src\\main\\AndroidManifest.xml');