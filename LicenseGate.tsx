// LicenseGate.tsx
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { checkLicense, LicenseInfo } from './license';
import LicenseRequest from './LicenseRequest';
import { displayDateOnly } from './lib-date';

export default function LicenseGate({ children, showToast }: any) {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  // 🛡️ برای جلوگیری از عقب بردن ساعت در حین اجرای برنامه
  const maxTimeRef = useRef(Date.now());

  const check = async () => {
    try {
      const r = await checkLicense();
      setInfo(r);
    } catch (e) {
      console.log('License Check Error:', e);
      setInfo({ status: 'unknown', lastCheck: Date.now(), daysSinceCheck: 0, isLocked: true, reason: 'خطا در بررسی لایسنس. لطفاً اتصال اینترنت خود را بررسی کنید.' } as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
    // بررسی دوره‌ای لایسنس هر ۳۰ ثانیه
    const iv = setInterval(() => {
      check();
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // ⏱️ تایمر زنده (هر ۱ ثانیه)
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      
      // 🛡️ محافظت زنده از عقب بردن ساعت در حین اجرا (با تلورانس ۱۰ ثانیه)
      if (current > maxTimeRef.current) {
        maxTimeRef.current = current;
      } else if (current < maxTimeRef.current - 10000) {
        setInfo(prev => ({ ...prev, isLocked: true, reason: '⚠️ ساعت دستگاه شما تغییر کرده است. لطفاً ساعت را درست کنید.' } as any));
        return;
      }
      
      setNow(current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 🛑 اگر زمان تمام شد، فوراً قفل شود
  useEffect(() => {
    if (info?.expiresAt && info.status === 'active' && !info.isLocked) {
      const exp = new Date(info.expiresAt).getTime();
      if (!isNaN(exp) && now >= exp) {
        check(); // زمان تمام شد، سیستم را قفل کن
      }
    }
  }, [now, info]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={s.loadingTxt}>در حال بررسی...</Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════
  // حالت قفل شده (License Locked)
  // ═══════════════════════════════════════════
  if (!info || info.isLocked) {
    return (
      <ScrollView contentContainerStyle={s.center}>
        <View style={s.card}>
          <Text style={s.icon}>🔒</Text>
          <Text style={s.title}>دسترسی محدود</Text>
          <Text style={s.reason}>{info?.reason || 'اشتراک شما معتبر نیست'}</Text>

          {info?.expiresAt ? (
            <Text style={s.date}>📅 تاریخ انقضا: {displayDateOnly(info.expiresAt)}</Text>
          ) : null}

          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={check}>
            <Text style={s.btnTxt}>🔄 تلاش مجدد</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', marginTop: 10 }]} onPress={() => setShowRequest(true)}>
            <Text style={s.btnTxt}>📩 درخواست لایسنس</Text>
          </TouchableOpacity>
        </View>

        {showRequest && (
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <LicenseRequest onClose={() => setShowRequest(false)} showToast={showToast} />
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // ═══════════════════════════════════════════
  // محاسبه شمارش معکوس (اگر فعال است)
  // ═══════════════════════════════════════════
  let _warningText = '';
  let _warningColor = '';
  let timeParts = { d: 0, h: 0, m: 0, s: 0 };
  let showCountdown = false;

  if (info?.expiresAt && info.status === 'active') {
    const _exp = new Date(info.expiresAt).getTime();
    const _ms = _exp - now;

    if (!isNaN(_exp) && _ms > 0 && _ms <= 7 * 86400000) { // اگر کمتر از ۷ روز مانده باشد
      showCountdown = true;
      timeParts = {
        d: Math.floor(_ms / 86400000),
        h: Math.floor((_ms % 86400000) / 3600000),
        m: Math.floor((_ms % 3600000) / 60000),
        s: Math.floor((_ms % 60000) / 1000),
      };

      const totalHours = Math.floor(_ms / 3600000);
      if (totalHours <= 24) {
        _warningColor = '#dc2626'; // قرمز برای کمتر از ۲۴ ساعت
        _warningText = '⛔ زمان باقی‌مانده تا پایان لایسنس:';
      } else if (totalHours <= 72) {
        _warningColor = '#ea580c'; // نارنجی برای کمتر از ۳ روز
        _warningText = '⚠️ زمان باقی‌مانده تا پایان لایسنس:';
      } else {
        _warningColor = '#d97706'; // زرد/کهربایی برای کمتر از ۷ روز
        _warningText = '🔔 زمان باقی‌مانده تا پایان لایسنس:';
      }
    }
  }

  // ═══════════════════════════════════════════
  // نمایش برنامه با هشدار و شمارش معکوس
  // ═══════════════════════════════════════════
  return (
    <View style={{ flex: 1 }}>
      {_warningText ? (
        <View style={{ backgroundColor: _warningColor, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>
            {_warningText}
          </Text>
          
          {/* ⏱️ شمارش معکوس (تایمر دیجیتال) */}
          {showCountdown && (
            <View style={s.timerRow}>
              {timeParts.d > 0 && (
                <>
                  <View style={s.timeBox}><Text style={s.timeNum}>{timeParts.d}</Text><Text style={s.timeLbl}>روز</Text></View>
                  <Text style={s.timeSep}>:</Text>
                </>
              )}
              <View style={s.timeBox}><Text style={s.timeNum}>{String(timeParts.h).padStart(2, '0')}</Text><Text style={s.timeLbl}>ساعت</Text></View>
              <Text style={s.timeSep}>:</Text>
              <View style={s.timeBox}><Text style={s.timeNum}>{String(timeParts.m).padStart(2, '0')}</Text><Text style={s.timeLbl}>دقیقه</Text></View>
              <Text style={s.timeSep}>:</Text>
              <View style={s.timeBox}><Text style={s.timeNum}>{String(timeParts.s).padStart(2, '0')}</Text><Text style={s.timeLbl}>ثانیه</Text></View>
            </View>
          )}
        </View>
      ) : null}

      {children}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingTxt: { color: '#fff', marginTop: 12, fontSize: 14 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  icon: { fontSize: 50, marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  reason: { color: '#f87171', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  date: { color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  btn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  
  // استایل‌های مربوط به تایمر دیجیتال
  timerRow: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  timeBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 44, alignItems: 'center' },
  timeNum: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' },
  timeLbl: { color: '#cbd5e1', fontSize: 9, marginTop: 2 },
  timeSep: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginHorizontal: 4, marginBottom: 12 },
});