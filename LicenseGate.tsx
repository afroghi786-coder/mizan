// LicenseGate.tsx — نمایش قفل لایسنس
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { checkLicense, LicenseInfo } from './license';

export default function LicenseGate({ children, showToast }: any) {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    try {
      const r = await checkLicense();
      setInfo(r);
    } catch (e) {
      console.log(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { check(); }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={s.loadingTxt}>در حال بررسی...</Text>
      </View>
    );
  }

  if (info?.isLocked) {
    return (
      <ScrollView contentContainerStyle={s.center}>
        <View style={s.card}>
          <Text style={s.icon}>🔒</Text>
          <Text style={s.title}>دسترسی محدود</Text>
          <Text style={s.reason}>{info.reason || 'اشتراک شما معتبر نیست'}</Text>

          {info.expiresAt ? (
            <Text style={s.date}>
              📅 تاریخ انقضا: {new Date(info.expiresAt).toLocaleDateString('fa-IR')}
            </Text>
          ) : null}

          {info.daysSinceCheck > 0 ? (
            <Text style={s.small}>
              آخرین اتصال به سرور: {info.daysSinceCheck} روز پیش
            </Text>
          ) : null}

          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={check}>
            <Text style={s.btnTxt}>🔄 تلاش مجدد</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: '#1e3a8a', marginTop: 8 }]}>
            <Text style={s.btnTxt}>💳 تمدید اشتراک</Text>
          </TouchableOpacity>

          <Text style={s.hint}>
            اگه قبلاً پرداخت کردی، یک بار اینترنت رو وصل کن و دوباره تلاش کن
          </Text>
        </View>
      </ScrollView>
    );
  }

  return children;
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f7fa' },
  loadingTxt: { marginTop: 12, color: '#64748b', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
  icon: { fontSize: 54, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f2438', marginBottom: 12 },
  reason: { fontSize: 13, color: '#dc2626', textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  date: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  small: { fontSize: 11, color: '#94a3b8', marginBottom: 20 },
  btn: { width: '100%', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  hint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
