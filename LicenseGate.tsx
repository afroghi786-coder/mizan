import { displayDate, displayDateOnly } from './lib-date';
// LicenseGate.tsx
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { checkLicense, LicenseInfo } from './license';
import LicenseRequest from './LicenseRequest';

export default function LicenseGate({ children, showToast }: any) {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);

  const check = async () => {
    try {
      const r = await checkLicense();
      setInfo(r);
    } catch (e) {
      console.log(e);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    check();
    // ⏰ چک دوره‌ای هر ۳۰ ثانیه
    const iv = setInterval(() => {
      check();
    }, 30000);
    return () => clearInterval(iv);
  }, []);

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
              📅 تاریخ انقضا: {displayDateOnly(info.expiresAt)}
            </Text>
          ) : null}

          <TouchableOpacity accessibilityLabel="تلاش مجدد" style={[s.btn, { backgroundColor: '#059669' }]} onPress={check}>
            <Text style={s.btnTxt}>🔄 تلاش مجدد</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityLabel="درخواست لایسنس" style={[s.btn, { backgroundColor: '#7c3aed', marginTop: 10 }]} onPress={() => setShowRequest(true)}>
            <Text style={s.btnTxt}>📩 درخواست لایسنس</Text>
          </TouchableOpacity>
        </View>

        <LicenseRequest visible={showRequest} onClose={() => setShowRequest(false)} showToast={showToast} />
      </ScrollView>
    );
  }

  return children;
}

const s = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0f2438' },
  card: { backgroundColor: '#1a2332', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#334155' },
  icon: { fontSize: 50, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 10 },
  reason: { fontSize: 14, color: '#cbd5e1', textAlign: 'center', marginBottom: 20 },
  date: { fontSize: 13, color: '#d4af37', textAlign: 'center', marginBottom: 20 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  loadingTxt: { color: '#cbd5e1', marginTop: 10, fontSize: 14 },
});
