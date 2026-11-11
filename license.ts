// license.ts — چک لایسنس (نسخه ساده و ضدضربه)
import AsyncStorage from './lib.storage';
import { supabase } from './lib';

const LICENSE_TS = '@mizan_last_license_check';
const LICENSE_DATA = '@mizan_license_data';

export interface LicenseInfo {
  status: 'active' | 'expired' | 'suspended' | 'unknown';
  plan?: string;
  expiresAt?: string;
  lastCheck: number;
  daysSinceCheck: number;
  isLocked: boolean;
  reason?: string;
}

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

export async function checkLicense(): Promise<LicenseInfo> {
  const now = Date.now();

  // PHASE3_CLOCK_TAMPER — جلوگیری از عقب بردن تاریخ گوشی
  try {
    const _lastRaw = await AsyncStorage.getItem(LICENSE_TS);
    const _last = Number(_lastRaw || 0);
    if (_last > 0 && now + 2 * 60 * 1000 < _last) {
      return {
        status: 'unknown',
        lastCheck: now,
        daysSinceCheck: 0,
        isLocked: true,
        reason: 'تاریخ دستگاه عقب برده شده است. لطفاً تاریخ و ساعت گوشی را درست کنید و دوباره تلاش کنید.',
      };
    }
  } catch {}
  
  // ۱. مشخص کردن کاربر فعلی
  let currentUserId = '';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    currentUserId = session?.user?.id || '';
  } catch {}

  // ۲. خواندن اطلاعات محلی
  let localData: any = null;
  const localRaw = await AsyncStorage.getItem(LICENSE_DATA);
  if (localRaw) {
    try {
      localData = JSON.parse(localRaw);
      // اگر داده محلی مربوط به کاربر دیگری است، پاکش کن
      if (currentUserId && localData.user_id && localData.user_id !== currentUserId) {
        await AsyncStorage.removeItem(LICENSE_DATA);
        localData = null;
      }
    } catch {}
  }

  // ۳. تلاش برای چک آنلاین
  const online = await fetchLicenseFromServer();

  if (online) {
    // آنلاین بود — آپدیت کن
    await AsyncStorage.setItem(LICENSE_TS, String(now));
    await AsyncStorage.setItem(LICENSE_DATA, JSON.stringify(online));
    
    let expiresAt = online.expires_at ? new Date(online.expires_at).getTime() : 0;
    if (isNaN(expiresAt)) expiresAt = 0; // جلوگیری از خرابی تاریخ
    // اگر تاریخ وجود نداشت یا صفر بود، یعنی منقضی شده (به جای اینکه معتبر باشد)
    const isExpired = !online.expires_at || expiresAt === 0 || expiresAt < now;
    const isSuspended = online.status === 'suspended';

    return {
      status: isSuspended ? 'suspended' : isExpired ? 'expired' : 'active',
      plan: online.plan,
      expiresAt: online.expires_at,
      lastCheck: now,
      daysSinceCheck: 0,
      isLocked: isSuspended || isExpired,
      reason: isSuspended ? 'حساب شما معلق است' : isExpired ? 'اشتراک شما به پایان رسیده' : undefined,
    };
  }

  // ۴. آفلاین — از داده محلی استفاده کن
  if (localData) {
    let expiresAt = localData.expires_at ? new Date(localData.expires_at).getTime() : 0;
    if (isNaN(expiresAt)) expiresAt = 0;
    const isExpired = !localData.expires_at || expiresAt === 0 || expiresAt < now;
    const isSuspended = localData.status === 'suspended';

    const diffSec = Math.floor((expiresAt - now) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffSec / 3600);
    
    let reason = undefined;
    if (isExpired) reason = '⏰ اشتراک شما به پایان رسیده';
    else if (diffSec > 0 && diffSec < 3600) reason = `⏳ ${diffMin} دقیقه تا پایان trial`;
    else if (diffSec > 0 && diffSec < 86400) reason = `⏳ ${diffHours} ساعت تا پایان trial`;

    await AsyncStorage.setItem(LICENSE_TS, String(now));
    return {
      status: isSuspended ? 'suspended' : isExpired ? 'expired' : 'active',
      plan: localData.plan,
      expiresAt: localData.expires_at,
      lastCheck: now,
      daysSinceCheck: 0,
      isLocked: isSuspended || isExpired,
      reason: isSuspended ? 'حساب معلق' : reason,
    };
  }

  // ۵. نه آنلاین، نه محلی — قفل امن (فاز ۲)
  return {
    status: 'unknown',
    lastCheck: now,
    daysSinceCheck: 0,
    isLocked: true,
    reason: 'لایسنس معتبر یافت نشد. لطفاً با اینترنت وصل شوید یا از دکمه «درخواست لایسنس» استفاده کنید.',
  };
}

export async function isLicenseValid(): Promise<boolean> {
  const info = await checkLicense();
  return !info.isLocked;
}

// برای خروج (Logout)
export async function clearLicenseCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LICENSE_DATA);
    await AsyncStorage.removeItem(LICENSE_TS);
  } catch {}
}
