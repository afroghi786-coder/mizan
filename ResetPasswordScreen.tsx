// ResetPasswordScreen.tsx — صفحه مستقل بازیابی رمز
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './lib';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    setError('');
    if (password.length < 6) return setError('رمز باید حداقل ۶ کاراکتر باشد');
    if (password !== confirm) return setError('رمزها یکسان نیستند');
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error('لینک منقضی شده. لطفاً دوباره درخواست بدهید.');
      }
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      setSuccess(true);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', ((window as any)?.location?.pathname || ''));
          window.location.reload();
        }
      }, 2500);
    } catch (e: any) {
      setError(e?.message || 'خطا در تغییر رمز');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={s.waitTxt}>در حال آماده‌سازی...</Text>
      </View>
    );
  }

  if (success) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.icon}>✅</Text>
          <Text style={s.title}>رمز با موفقیت تغییر کرد</Text>
          <Text style={s.sub}>در حال انتقال به صفحه ورود...</Text>
          <ActivityIndicator color="#7c3aed" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.center}>
      <View style={s.card}>
        <Text style={s.icon}>🔐</Text>
        <Text style={s.title}>بازیابی رمز عبور</Text>
        <Text style={s.sub}>رمز جدید خود را وارد کنید</Text>

        <Text style={s.lbl}>🔒 رمز جدید:</Text>
        <TextInput
          style={s.inp}
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
          placeholder="حداقل ۶ کاراکتر"
          placeholderTextColor="#64748b"
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={s.lbl}>🔒 تکرار رمز جدید:</Text>
        <TextInput
          style={s.inp}
          value={confirm}
          onChangeText={(t) => { setConfirm(t); setError(''); }}
          placeholder="رمز را دوباره وارد کنید"
          placeholderTextColor="#64748b"
          secureTextEntry
          autoCapitalize="none"
        />

        {error ? <Text style={s.error}>❌ {error}</Text> : null}

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={[s.btn, loading && { opacity: 0.6 }]}
        >
          <Text style={s.btnTxt}>{loading ? 'در حال ذخیره...' : '💾 تغییر رمز'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#0f2438', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', alignSelf: 'center', borderWidth: 1, borderColor: '#334155' },
  icon: { fontSize: 50, textAlign: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  sub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  lbl: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', marginBottom: 6, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12, textAlign: 'left' },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  btn: { backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  waitTxt: { color: '#94a3b8', marginTop: 12, fontSize: 14, textAlign: 'center' },
});
