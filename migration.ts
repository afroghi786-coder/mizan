// ═══════════════════════════════════════════════════════════
//  🔄 migration.ts — انتقال داده‌های قدیمی از AsyncStorage
//  یک بار در اولین اجرا، داده‌های قدیمی را منتقل می‌کند
// ═══════════════════════════════════════════════════════════

import AsyncStorage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const MIGRATION_KEY = '@mizan_migration_v1_done';

export async function runMigrationOnce(): Promise<void> {
  try {
    // چک کن قبلاً انجام شده
    const done = await AsyncStorage.getItem(MIGRATION_KEY);
    if (done === 'true') {
      console.log('✅ Migration قبلاً انجام شده');
      return;
    }

    // در وب، AsyncStorage قدیمی وجود ندارد
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    console.log('🔄 شروع Migration از AsyncStorage قدیمی...');

    // چک کن @react-native-async-storage موجود است
    let OldAsyncStorage: any = null;
    try {
      // @ts-ignore
      OldAsyncStorage = require('@react-native-async-storage/async-storage').default;
    } catch (e) {
      console.log('ℹ️ AsyncStorage قدیمی نصب نیست — نیازی به migration نیست');
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    if (!OldAsyncStorage) {
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    // لیست کلیدهای مهم
    const keysToMigrate = [
      '@mizan_queue',
      '@mizan_local_all_sales_full',
      '@mizan_local_sales_grouped',
      '@mizan_local_purchases_grouped',
      '@mizan_customers_v2',
      '@mizan_settings',
      '@mizan_offline_data',
    ];

    // تلاش برای خواندن همه کلیدها
    try {
      const allKeys = await OldAsyncStorage.getAllKeys();
      console.log('📦 ' + allKeys.length + ' کلید در AsyncStorage قدیمی');
      
      // اضافه کردن کلیدها به لیست
      for (const k of allKeys) {
        if (!keysToMigrate.includes(k)) keysToMigrate.push(k);
      }
    } catch (e) {
      console.log('⚠️ نتوانستم همه کلیدها را بخوانم، فقط کلیدهای مهم:');
    }

    // انتقال هر کلید
    let migrated = 0;
    for (const key of keysToMigrate) {
      try {
        const value = await OldAsyncStorage.getItem(key);
        if (value !== null) {
          await AsyncStorage.setItem(key, value);
          migrated++;
        }
      } catch (e) {
        console.log('⚠️ خطا در انتقال ' + key + ':', e);
      }
    }

    console.log('✅ ' + migrated + ' کلید منتقل شد');

    // علامت بزن
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    console.log('🎉 Migration تمام شد');
  } catch (e) {
    console.log('❌ خطا در Migration:', e);
  }
}
