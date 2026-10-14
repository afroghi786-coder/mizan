// lib.app.test-screen.ts — صفحه تست برای ربات
import { registerScreen } from './lib.app.registry';
import { getCalType, setCalType, saveCalType, loadCalType } from './lib';
import { getThemeMode, setThemeMode } from './App';
import AsyncStorage from '@react-native-async-storage/async-storage';

// این تابع از App.tsx صدا زده می‌شه و صفحه تنظیمات رو ثبت می‌کنه
export function registerSettingsScreen(ctx: {
  getCalendarType: () => string;
  setCalendarType: (t: any) => void;
  getTheme: () => string;
  setTheme: (t: any) => void;
  settings: any;
  updateSettings: (patch: any) => void;
}): () => void {
  return registerScreen({
    key: 'settings',
    label: 'تنظیمات',
    icon: '⚙️',
    aliases: ['تنظیم', 'تنظیمات', 'پیندی', 'setting', 'settings'],
    fields: [
      {
        key: 'calendar',
        label: 'تقویم',
        type: 'choice',
        aliases: ['تقویم', 'تاریخ', 'سال', 'میلادی', 'شمسی', 'هجری'],
        choices: ['شمسی', 'میلادی', 'هجری'],
        get value() { return ctx.getCalendarType(); },
        setter: (v: any) => {
          const map: any = { 'شمسی': 'jalali', 'میلادی': 'gregorian', 'هجری': 'hijri' };
          const val = map[v] || v;
          ctx.setCalendarType(val);
          try { saveCalType(val); } catch {}
        },
      },
      {
        key: 'theme',
        label: 'تم',
        type: 'choice',
        aliases: ['تم', 'حالت', 'شب', 'روز', 'روشن', 'تاریک'],
        choices: ['روشن', 'تاریک', 'ساده'],
        get value() { return ctx.getTheme() === 'dark' ? 'تاریک' : ctx.getTheme() === 'light' ? 'روشن' : 'ساده'; },
        setter: (v: any) => {
          const map: any = { 'تاریک': 'dark', 'روشن': 'light', 'ساده': 'simple', 'dark': 'dark', 'light': 'light' };
          const val = map[v] || v;
          ctx.setTheme(val);
        },
      },
      {
        key: 'name',
        label: 'نام صراف',
        type: 'text',
        aliases: ['نام', 'اسم'],
        get value() { return ctx.settings?.name || ''; },
        setter: (v: any) => { ctx.updateSettings({ name: v }); },
      },
      {
        key: 'city',
        label: 'شهر',
        type: 'text',
        aliases: ['شهر', 'ولایت'],
        get value() { return ctx.settings?.city || ''; },
        setter: (v: any) => { ctx.updateSettings({ city: v }); },
      },
    ],
    actions: [
      {
        key: 'toggle_dark',
        label: 'فعال کردن حالت شب',
        aliases: ['حالت شب', 'شب', 'تاریک', 'دارک', 'dark'],
        run: () => {
          ctx.setTheme('dark');
          return '✅ حالت شب فعال شد';
        },
      },
      {
        key: 'toggle_light',
        label: 'فعال کردن حالت روز',
        aliases: ['حالت روز', 'روشن', 'لایت', 'light'],
        run: () => {
          ctx.setTheme('light');
          return '✅ حالت روز فعال شد';
        },
      },
      {
        key: 'cal_jalali',
        label: 'تقویم شمسی',
        aliases: ['شمسی', 'جلالی', 'فارسی'],
        run: () => {
          ctx.setCalendarType('jalali');
          try { saveCalType('jalali'); } catch {}
          return '✅ تقویم شمسی فعال شد';
        },
      },
      {
        key: 'cal_gregorian',
        label: 'تقویم میلادی',
        aliases: ['میلادی', 'گرگوری', 'انگلیسی', 'gregorian'],
        run: () => {
          ctx.setCalendarType('gregorian');
          try { saveCalType('gregorian'); } catch {}
          return '✅ تقویم میلادی فعال شد';
        },
      },
      {
        key: 'cal_hijri',
        label: 'تقویم هجری',
        aliases: ['هجری', 'قمری', 'hijri'],
        run: () => {
          ctx.setCalendarType('hijri');
          try { saveCalType('hijri'); } catch {}
          return '✅ تقویم هجری فعال شد';
        },
      },
    ],
    getSummary: () => {
      return '📅 تقویم: ' + ctx.getCalendarType() +
        ' | 🎨 تم: ' + ctx.getTheme() +
        ' | 👤 نام: ' + (ctx.settings?.name || '—');
    },
  });
}
