import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from './lib.storage';

export default function DeviceNameTopBar() {
  const [deviceName, setDeviceName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { const id = await AsyncStorage.getItem('@mizan_device_id'); if (id) setDeviceId(String(id)); } catch {}
      try { const lb = await AsyncStorage.getItem('@mizan_device_label'); if (lb) setDeviceName(String(lb)); } catch {}
      try {
        const ow = await AsyncStorage.getItem('@mizan_owner_name');
        const ow2 = await AsyncStorage.getItem('@mizan_device_owner');
        if (ow) setOwnerName(String(ow));
        else if (ow2) setOwnerName(String(ow2));
      } catch {}
    })();
  }, []);

  const save = async () => {
    const dn = deviceName.trim();
    const on = ownerName.trim();
    if (!dn) { Alert.alert('نام دستگاه', 'نام دستگاه را وارد کنید.'); return; }
    setSaving(true);
    try {
      await AsyncStorage.setItem('@mizan_device_label', dn);
      await AsyncStorage.setItem('@mizan_owner_name', on);
      await AsyncStorage.setItem('@mizan_device_owner', on);

      // به‌روزرسانی tombstoneهای قبلی همین دستگاه
      try {
        const raw = await AsyncStorage.getItem('@mizan_tombstones');
        let arr: any[] = [];
        try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
        if (Array.isArray(arr)) {
          let changed = 0;
          const next = arr.map((t: any) => {
            if (!t) return t;
            const sameDevice = !t.device_id || (deviceId && t.device_id === deviceId);
            if (sameDevice && !t.device_label) { t.device_label = dn; changed++; }
            return t;
          });
          if (changed > 0) await AsyncStorage.setItem('@mizan_tombstones', JSON.stringify(next));
        }
      } catch {}

      Alert.alert('ذخیره شد', 'نام دستگاه و صاحب دستگاه ذخیره شد.');
    } catch (e: any) {
      Alert.alert('خطا', e?.message || 'ذخیره نشد');
    } finally { setSaving(false); }
  };

  return (
    <View style={st.wrap}>
      <View style={st.row}>
        <TextInput
          value={deviceName}
          onChangeText={setDeviceName}
          style={[st.input, { flex: 1 }]}
          placeholder="نام دستگاه"
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          value={ownerName}
          onChangeText={setOwnerName}
          style={[st.input, { flex: 1, marginLeft: 6 }]}
          placeholder="نام صاحب دستگاه"
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity style={[st.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          <Text style={st.btnTxt}>{saving ? '...' : '💾'}</Text>
        </TouchableOpacity>
      </View>
      {deviceId ? <Text style={st.hint}>شناسه: {String(deviceId).slice(-6)}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, marginHorizontal: 6 },
  row: { flexDirection: 'row-reverse', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#1f3a5f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, textAlign: 'right', backgroundColor: '#0a2038', color: '#fff' },
  btn: { marginLeft: 6, backgroundColor: '#0891b2', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  hint: { color: '#64748b', fontSize: 9, textAlign: 'right', marginTop: 2 },
});
