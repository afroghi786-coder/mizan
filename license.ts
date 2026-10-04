// license.ts — چک لایسنس، جدا از حالت داده
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib';

const LICENSE_TS = '@mizan_last_license_check';
const LICENSE_DATA = '@mizan_license_data';
const OFFLINE_MAX_DAYS = 7;

export interface LicenseInfo {
  status: 'active' | 'expired' | 'suspended' | 'unknown';
  plan?: string;
  expiresAt?: string;
  lastCheck: number;
  daysSinceCheck: number;
  isLocked: boolean;
  reason?: string;
}

// چک سرور (وقتی اینترنت هست)
async function fetchLicenseFromServer(): Promise<any> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;
    const { data } = await supabase
      .from('licenses')
      .select('*')
      .eq('user_id', session.user.id)
      .limit(1);
    return data && data[0] ? data[0] : null;
  } catch { return null; }
}

// تابع اصلی چک لایسنس
export async function checkLicense(): Promise<LicenseInfo> {
  const now = Date.now();
  const lastCheckStr = await AsyncStorage.getItem(LICENSE_TS);
  const lastCheck = lastCheckStr ? parseInt(lastCheckStr) : 0;
  const daysSince = Math.floor((now - lastCheck) / (24 * 3600 * 1000));

  // تلاش برای چک آنلاین
  const online = await fetchLicenseFromServer();

  if (online) {
    // آنلاین بود — آپدیت کن
    await AsyncStorage.setItem(LICENSE_TS, String(now));
    await AsyncStorage.setItem(LICENSE_DATA, JSON.stringify(online));

    const expiresAt = online.expires_at ? new Date(online.expires_at).getTime() : 0;
    const isExpired = expiresAt < now;
    const isSuspended = online.status === 'suspended';

    return {
      status: isSuspended ? 'suspended' : isExpired ? 'expired' : 'active',
      plan: online.plan,
      expiresAt: online.expires_at,
      lastCheck: now,
      daysSinceCheck: 0,
      isLocked: isSuspended || isExpired,
      reason: isSuspended ? 'حساب شما معلق است' : isExpired ? 'اشتراک شما منقضی شده' : undefined,
    };
  }

  // آنلاین نبود — از کش بخون
  const cachedStr = await AsyncStorage.getItem(LICENSE_DATA);
  const cached = cachedStr ? JSON.parse(cachedStr) : null;

  // اگه ۷ روز گذشته و چک نشده → قفل
  if (daysSince >= OFFLINE_MAX_DAYS) {
    return {
      status: cached?.status || 'unknown',
      plan: cached?.plan,
      expiresAt: cached?.expires_at,
      lastCheck,
      daysSinceCheck: daysSince,
      isLocked: true,
      reason: `${daysSince} روزه به سرور وصل نشدی — یک بار اینترنت وصل کن`,
    };
  }

  // کمتر از ۷ روز → از کش استفاده کن
  if (cached) {
    const expiresAt = cached.expires_at ? new Date(cached.expires_at).getTime() : 0;
    const isExpired = expiresAt < now;
    const isSuspended = cached.status === 'suspended';
    return {
      status: isSuspended ? 'suspended' : isExpired ? 'expired' : 'active',
      plan: cached.plan,
      expiresAt: cached.expires_at,
      lastCheck,
      daysSinceCheck: daysSince,
      isLocked: isSuspended || isExpired,
      reason: isSuspended ? 'حساب معلق' : isExpired ? 'اشتراک منقضی' : undefined,
    };
  }

  // هیچ داده‌ای نیست — اولین بار
  return {
    status: 'unknown', lastCheck: 0, daysSinceCheck: daysSince,
    isLocked: true, reason: 'اولین بار — لطفاً به اینترنت وصل شو',
  };
}

// چک سریع — فقط می‌گه قفله یا نه
export async function isLicenseValid(): Promise<boolean> {
  const info = await checkLicense();
  return !info.isLocked;
}

// بعد از پرداخت — لایسنس رو فعال کن (local + server)
export async function refreshLicenseAfterPayment() {
  const fresh = await fetchLicenseFromServer();
  if (fresh) {
    await AsyncStorage.setItem(LICENSE_DATA, JSON.stringify(fresh));
    await AsyncStorage.setItem(LICENSE_TS, String(Date.now()));
  }
}
