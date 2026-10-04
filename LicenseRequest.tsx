// LicenseRequest.tsx — درخواست لایسنس
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from './lib';

export default function LicenseRequest({ visible, onClose, showToast, userEmail }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!name || name.length < 2) return showToast('نام را وارد کن', true);
    if (!/^09\d{9}$/.test(phone)) return showToast('شماره موبایل معتبر وارد کن', true);

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('ابتدا وارد شوید');

      const { error } = await supabase.from('license_requests').insert({
        user_id: session.user.id,
        email: userEmail || session.user.email,
        full_name: name,
        phone,
        message,
        status: 'pending',
      });
      if (error) throw error;

      setSent(true);
      showToast('✅ درخواست ثبت شد');
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    setSent(false);
    setName('');
    setPhone('');
    setMessage('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.bg}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <View style={s.box}>
            {sent ? (
              <>
                <Text style={s.icon}>🎉</Text>
                <Text style={s.title}>درخواست شما ثبت شد</Text>
                <Text style={s.desc}>
                  تیم پشتیبانی درخواست شما را بررسی می‌کند.{'\n'}
                  به‌زودی با شما تماس می‌گیریم.{'\n\n'}
                  💡 پس از تأیید، یک بار اینترنت وصل کنید تا لایسنس فعال شود.
                </Text>
                <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={close}>
                  <Text style={s.btnTxt}>✅ باشه</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.icon}>📩</Text>
                <Text style={s.title}>درخواست لایسنس</Text>
                <Text style={s.desc}>
                  ۷ روز تریال شما به پایان رسیده.{'\n'}
                  برای ادامه، لطفاً فرم زیر را پر کنید:
                </Text>

                <Text style={s.lbl}>نام و نام خانوادگی *</Text>
                <TextInput style={s.inp} value={name} onChangeText={setName} placeholder="مثلاً: علی احمدی" placeholderTextColor="#94a3b8" />

                <Text style={s.lbl}>شماره موبایل *</Text>
                <TextInput style={s.inp} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} placeholder="09121234567" placeholderTextColor="#94a3b8" />

                <Text style={s.lbl}>توضیحات (اختیاری)</Text>
                <TextInput style={[s.inp, { height: 80, textAlignVertical: 'top' }]} value={message} onChangeText={setMessage} multiline placeholder="هر توضیحی که لازم می‌دانید..." placeholderTextColor="#94a3b8" />

                <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={close}>
                    <Text style={s.btnTxt}>انصراف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={submit} disabled={sending}>
                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>📤 ارسال درخواست</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  box: { backgroundColor: '#fff', borderRadius: 18, padding: 24, maxWidth: 450, alignSelf: 'center', width: '100%' },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#0f2438', textAlign: 'center', marginBottom: 12 },
  desc: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, color: '#0f2438', textAlign: 'right', backgroundColor: '#f8fafc' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
