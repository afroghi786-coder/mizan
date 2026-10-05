import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { LANGS, setLang, markLangSet, Lang } from './i18n';

export default function LanguageModal({ visible, current, onClose, onSelect, firstTime }: any) {
  const pick = async (code: Lang) => {
    await setLang(code);
    if (firstTime) await markLangSet();
    onSelect(code);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={firstTime ? undefined : onClose}>
      <View style={s.bg}>
        <View style={s.box}>
          <View style={s.head}>
            <Text style={s.title}>🌍 {firstTime ? 'زبان خود را انتخاب کنید' : 'انتخاب زبان'}</Text>
            {!firstTime && <TouchableOpacity onPress={onClose}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></TouchableOpacity>}
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {LANGS.map(l => (
              <TouchableOpacity key={l.code} onPress={() => pick(l.code)} style={[s.row, current === l.code && s.rowActive]}>
                <Text style={s.flag}>{l.flag}</Text>
                <Text style={[s.name, current === l.code && s.nameActive]}>{l.name}</Text>
                <Text style={s.code}>{l.code.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {firstTime && <Text style={s.hint}>💡 می‌توانید بعداً از تنظیمات تغییر دهید</Text>}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.9)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  head: { backgroundColor: '#0f2438', padding: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowActive: { backgroundColor: '#eff6ff' },
  flag: { fontSize: 26, marginLeft: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#0f2438', textAlign: 'right' },
  nameActive: { color: '#1e3a8a' },
  code: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' },
  hint: { padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 11, backgroundColor: '#f8fafc' },
});
