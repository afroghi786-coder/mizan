// LicenseNotification.tsx — نمایش اعلان تمدید
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './lib';
import { displayDateOnly } from './lib';

export default function LicenseNotification({ showToast }: any) {
  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) { setLoading(false); return; }

        const { data } = await supabase
          .from('licenses')
          .select('notification_pending, notification_message, notification_plan, notification_at, expires_at')
          .eq('user_id', session.user.id)
          .limit(1);

        if (data && data[0] && data[0].notification_pending) {
          setNotification(data[0]);
        }
      } catch (e) { console.log(e); }
      finally { setLoading(false); }
    };
    check();
  }, []);

  const dismiss = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('licenses')
          .update({ notification_pending: false })
          .eq('user_id', session.user.id);
      }
      setNotification(null);
    } catch (e) {
      setNotification(null);
    }
  };

  if (loading || !notification) return null;

  const expiresAt = notification.expires_at ? new Date(notification.expires_at) : null;
  const planLabel = (p: string) => {
    if (!p) return '';
    if (p === '10d') return '۱۰ روز';
    if (p === '1m') return '۱ ماه';
    if (p === '3m') return '۳ ماه';
    if (p === '6m') return '۶ ماه';
    if (p === '1y') return '۱ سال';
    if (p === 'trial') return 'تریال';
    return p;
  };

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={s.bg}>
        <View style={s.box}>
          <View style={s.header}>
            <Text style={s.icon}>🎉</Text>
          </View>

          <Text style={s.title}>تبریک!</Text>
          <Text style={s.subtitle}>
            {notification.notification_message || 'اشتراک شما با موفقیت تمدید شد'}
          </Text>

          <View style={s.infoBox}>
            <View style={s.infoRow}>
              <Text style={s.infoVal}>{planLabel(notification.notification_plan)}</Text>
              <Text style={s.infoLbl}>📋 مدت اشتراک</Text>
            </View>

            <View style={s.divider} />

            <View style={s.infoRow}>
              <Text style={[s.infoVal, { color: '#059669', fontWeight: 'bold' }]}>
                {expiresAt ? displayDateOnly(expiresAt) : '—'}
              </Text>
              <Text style={s.infoLbl}>⏰ اعتبار تا</Text>
            </View>
          </View>

          <Text style={s.thanks}>از اعتماد شما سپاسگزاریم 🙏</Text>

          <TouchableOpacity style={s.btn} onPress={dismiss}>
            <Text style={s.btnTxt}>✅ متوجه شدم</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
  header: { marginBottom: 8 },
  icon: { fontSize: 64 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f2438', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  infoBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, width: '100%', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  infoRow: { alignItems: 'center', paddingVertical: 6 },
  infoLbl: { fontSize: 11, color: '#64748b', marginTop: 4 },
  infoVal: { fontSize: 16, color: '#0f2438', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  thanks: { fontSize: 12, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  btn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
