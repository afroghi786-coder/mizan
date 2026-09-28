import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://paslxvwlbojdzflbmyoh.supabase.co';
const SUPABASE_ANON = 'sb_publishable_YR1dct7WS_i6-8nqqw5dWQ_qaxFBlQN';

let supabase: any = null;
let initError = '';

try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch (e: any) {
  initError = 'خطا در ساخت Supabase: ' + (e?.message || String(e));
}

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const [email, setEmail] = useState('test@test.com');
  const [pass, setPass] = useState('123456');
  const [busy, setBusy] = useState(false);

  const addLog = (m: string) => {
    console.log('[MIZAN]', m);
    setLog((prev) => [...prev.slice(-8), m]);
  };

  useEffect(() => {
    addLog('اپ اجرا شد');
    addLog('URL: ' + SUPABASE_URL);
    if (initError) {
      addLog('❌ ' + initError);
    } else {
      addLog('✅ Supabase ساخته شد');
      // تست اتصال
      supabase.auth.getSession()
        .then((r: any) => {
          addLog('✅ getSession پاسخ داد');
          if (r?.data?.session) addLog('👤 سشن فعال: ' + r.data.session.user.email);
          else addLog('👤 سشن خالی (کاربر وارد نشده)');
        })
        .catch((e: any) => {
          addLog('❌ getSession خطا: ' + (e?.message || String(e)));
        });
    }
  }, []);

  const login = async () => {
    setBusy(true);
    addLog('⏳ شروع ورود...');
    try {
      const r1 = await supabase.auth.signInWithPassword({ email, password: pass });
      if (r1.error) {
        addLog('⚠️ ورود نشد: ' + r1.error.message);
        addLog('⏳ تلاش ثبت‌نام...');
        const r2 = await supabase.auth.signUp({ email, password: pass });
        if (r2.error) {
          addLog('❌ ثبت‌نام نشد: ' + r2.error.message);
        } else {
          addLog('✅ ثبت‌نام شد، ورود مجدد...');
          const r3 = await supabase.auth.signInWithPassword({ email, password: pass });
          if (r3.error) addLog('❌ ورود مجدد خطا: ' + r3.error.message);
          else addLog('✅ وارد شد!');
        }
      } else {
        addLog('✅ وارد شد!');
      }
    } catch (e: any) {
      addLog('❌ خطا: ' + (e?.message || String(e)));
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.title}>⚖️ میزان</Text>
        <Text style={s.sub}>نسخه تشخیصی — {initError ? '❌ خطا' : '✅ فعال'}</Text>

        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="ایمیل"
          placeholderTextColor="#888"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          value={pass}
          onChangeText={setPass}
          placeholder="رمز"
          placeholderTextColor="#888"
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={login} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>ورود / ثبت‌نام</Text>}
        </TouchableOpacity>

        <Text style={s.logTitle}>📋 گزارش:</Text>
        <View style={s.logBox}>
          {log.map((l, i) => (
            <Text key={i} style={s.logLine}>{l}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f2438' },
  wrap: { padding: 20 },
  title: { color: '#d4af37', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  sub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#1a2332', color: '#fff', padding: 14, borderRadius: 8, marginBottom: 10, fontSize: 14, textAlign: 'right' },
  btn: { backgroundColor: '#1e3a8a', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  logTitle: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginTop: 24, marginBottom: 8, textAlign: 'right' },
  logBox: { backgroundColor: '#000', borderRadius: 8, padding: 12, minHeight: 200 },
  logLine: { color: '#0f0', fontSize: 11, fontFamily: 'monospace', marginBottom: 4, textAlign: 'left' },
});
