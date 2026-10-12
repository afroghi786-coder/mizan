package com.mezan786.mizan.sms;

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
