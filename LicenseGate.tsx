// LicenseGate.tsx - Secure Version with Fingerprint & Anti-Tamper
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { checkLicense, LicenseInfo } from './license';
import LicenseRequest from './LicenseRequest';
import { displayDateOnly } from './lib-date';

// 🛡️ تولید اثر انگشت (Checksum) برای لایسنس
const generateFingerprint = (data: any) => {
  try {
    if (!data) return '';
    const str = String(data.user_id || '') + '|' + String(data.expires_at || '') + '|' + String(data.status || '') + '|mizan-secret-2026';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return String(Math.abs(hash));
  } catch { return ''; }
};

export default function LicenseGate({ children, showToast }: any) {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [clockWarnings, setClockWarnings] = useState(0);
  const [tampered, setTampered] = useState(false);
  
  const maxTimeRef = useRef(Date.now());

  // 🚨 سیستم خودتخریبی (Poison Pill)
  const triggerPoisonPill = async (reason: string) => {
    try {
      setTampered(true);
      setInfo({ status: 'suspended', lastCheck: Date.now(), daysSinceCheck: 0, isLocked: true, reason: `🚨 نقض امنیتی تشخیص داده شد.\n${reason}\nتمام داده‌های محلی پاک شد.` } as any);
      
      try {
        const storage = require('./lib.storage').default;
        await storage.clear();
      } catch {}
      
      try {
        const { supabase } = require('./lib');
        await supabase.auth.signOut();
      } catch {}
      
      if (typeof window !== 'undefined') {
        setTimeout(() => { try { window.location.reload(); } catch {} }, 5000);
      }
    } catch (e) { console.log('PoisonPill err:', e); }
  };

  // 🔍 بررسی اصالت لایسنس با اثر انگشت
  const verifyIntegrity = async (): Promise<boolean> => {
    try {
      const storage = require('./lib.storage').default;
      const raw = await storage.getItem('@mizan_license_data');
      if (!raw) return true;
      
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || !parsed.status) return false;
      
      // اگر امضا وجود نداشت یعنی نسخه قدیمی است (رد نمی‌کنیم)
      if (!parsed._sig) return true;
      
      // محاسبه مجدد امضا و مقایسه با امضای ذخیره شده
      const expectedSig = generateFingerprint(parsed);
      if (parsed._sig !== expectedSig) {
        console.log('Signature mismatch! Expected:', expectedSig, 'Got:', parsed._sig);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  };

  const check = async () => {
    try {
      const valid = await verifyIntegrity();
      if (!valid) {
        triggerPoisonPill('دستکاری در داده لایسنس تشخیص داده شد.');
        return;
      }
      
      const r = await checkLicense();
      setInfo(r);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes('JSON') || msg.includes('undefined')) {
        triggerPoisonPill('خطای غیرعادی در بررسی لایسنس.');
      } else {
        setInfo({ status: 'unknown', lastCheck: Date.now(), daysSinceCheck: 0, isLocked: true, reason: 'خطا در بررسی لایسنس. لطفاً اتصال اینترنت را بررسی کنید.' } as any);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
    const iv = setInterval(() => { if (!tampered) check(); }, 30000);
    return () => clearInterval(iv);
  }, [tampered]);

  // ⏱️ تایمر زنده + هشدار نرم ساعت (بدون انفجار فوری)
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      
      if (current > maxTimeRef.current) {
        maxTimeRef.current = current;
      } else if (current < maxTimeRef.current - 10 * 60 * 1000) {
        // اگر بیش از ۱۰ دقیقه ساعت عقب رفت: هشدار نرم
        setClockWarnings(w => {
          const newCount = w + 1;
          if (newCount >= 3) {
            triggerPoisonPill('ساعت دستگاه بارها تغییر کرده است.');
          } else {
            if (showToast) {
              showToast(`⚠️ ساعت دستگاه شما تغییر کرده (اخطار ${newCount}/۳). لطفاً ساعت را درست کنید وگرنه داده‌ها حذف می‌شود.`, true);
            }
          }
          return newCount;
        });
        maxTimeRef.current = current;
        return;
      }
      
      setNow(current);
    }, 1000);
    return () => clearInterval(timer);
  }, [tampered, showToast]);

  useEffect(() => {
    if (info?.expiresAt && info.status === 'active' && !info.isLocked) {
      const exp = new Date(info.expiresAt).getTime();
      if (!isNaN(exp) && now >= exp) check();
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

  if (!info || info.isLocked) {
    return (
      <ScrollView contentContainerStyle={s.center}>
        <View style={s.card}>
          <Text style={s.icon}>{tampered ? '🚨' : '🔒'}</Text>
          <Text style={s.title}>{tampered ? 'نقض امنیتی' : 'دسترسی محدود'}</Text>
          <Text style={s.reason}>{info?.reason || 'اشتراک شما معتبر نیست'}</Text>
          {info?.expiresAt && !tampered ? (
            <Text style={s.date}>📅 تاریخ انقضا: {displayDateOnly(info.expiresAt)}</Text>
          ) : null}
          {!tampered && (
            <>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={check}>
                <Text style={s.btnTxt}>🔄 تلاش مجدد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', marginTop: 10 }]} onPress={() => setShowRequest(true)}>
                <Text style={s.btnTxt}>📩 درخواست لایسنس</Text>
              </TouchableOpacity>
            </>
          )}
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

  let _warningText = '';
  let _warningColor = '';
  let timeParts = { d: 0, h: 0, m: 0, s: 0 };
  let showCountdown = false;

  if (info?.expiresAt && info.status === 'active') {
    const _exp = new Date(info.expiresAt).getTime();
    const _ms = _exp - now;
    if (!isNaN(_exp) && _ms > 0 && _ms <= 7 * 86400000) {
      showCountdown = true;
      timeParts = {
        d: Math.floor(_ms / 86400000),
        h: Math.floor((_ms % 86400000) / 3600000),
        m: Math.floor((_ms % 3600000) / 60000),
        s: Math.floor((_ms % 60000) / 1000),
      };
      const totalHours = Math.floor(_ms / 3600000);
      if (totalHours <= 24) { _warningColor = '#dc2626'; _warningText = '⛔ زمان باقی‌مانده تا پایان لایسنس:'; }
      else if (totalHours <= 72) { _warningColor = '#ea580c'; _warningText = '⚠️ زمان باقی‌مانده تا پایان لایسنس:'; }
      else { _warningColor = '#d97706'; _warningText = '🔔 زمان باقی‌مانده تا پایان لایسنس:'; }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      {_warningText ? (
        <View style={{ backgroundColor: _warningColor, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>
            {_warningText}
          </Text>
          {showCountdown && (
            <View style={s.timerRow}>
              {timeParts.d > 0 && (<><View style={s.timeBox}><Text style={s.timeNum}>{timeParts.d}</Text><Text style={s.timeLbl}>روز</Text></View><Text style={s.timeSep}>:</Text></>)}
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
  reason: { color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  date: { color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  btn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  timerRow: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  timeBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 44, alignItems: 'center' },
  timeNum: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' },
  timeLbl: { color: '#cbd5e1', fontSize: 9, marginTop: 2 },
  timeSep: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginHorizontal: 4, marginBottom: 12 },
});