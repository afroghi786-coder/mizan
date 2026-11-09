import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from './lib.storage';

export default function DeviceNameEditor() {
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { const id = await AsyncStorage.getItem('@mizan_device_id'); if (id) setDeviceId(String(id)); } catch {}
      try { const lb = await AsyncStorage.getItem('@mizan_device_label'); if (lb) setName(String(lb)); } catch {}
    })();
  }, []);

  const save = async () => {
    const v = name.trim();
    if (!v) { Alert.alert('نام دستگاه', 'لطفاً نام دستگاه را وارد کنید.'); return; }
    setSaving(true);
    try {
      await AsyncStorage.setItem('@mizan_device_label', v);

      // به‌روزرسانی tombstoneهای قبلی همین دستگاه که نام نداشتند
      try {
        const raw = await AsyncStorage.getItem('@mizan_tombstones');
        let arr: any[] = [];
        try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
        if (Array.isArray(arr)) {
          let changed = 0;
          const next = arr.map((t: any) => {
            if (!t) return t;
            const sameDevice = !t.device_id || (deviceId && t.device_id === deviceId);
            if (sameDevice && !t.device_label) { t.device_label = v; changed++; }
            return t;
          });
          if (changed > 0) await AsyncStorage.setItem('@mizan_tombstones', JSON.stringify(next));
        }
      } catch {}

      Alert.alert('ذخیره شد', 'نام دستگاه با موفقیت ذخیره شد.');
    } catch (e: any) {
      Alert.alert('خطا', e?.message || 'ذخیره نشد');
    } finally { setSaving(false); }
  };

  return (
    <View style={st.card}>
      <Text style={st.title}>📱 نام این دستگاه</Text>
      <Text style={st.hint}>
        {deviceId ? 'شناسه: ' + String(deviceId).slice(-6) : 'شناسه دستگاه پیدا نشد'}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={st.input}
        placeholder="مثلاً گوشی جواد"
        placeholderTextColor="#94a3b8"
      />
      <TouchableOpacity style={[st.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        <Text style={st.btnTxt}>{saving ? 'در حال ذخیره...' : '💾 ذخیره نام دستگاه'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginHorizontal: 10, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 14, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginBottom: 4 },
  hint: { fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right', backgroundColor: '#f8fafc', marginBottom: 8 },
  btn: { backgroundColor: '#0891b2', padding: 11, borderRadius: 8, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
