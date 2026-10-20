import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import { byGroup, NavItem } from '../nav.registry';

export default function PlusMenu({ visible, onClose, onPick, lang = 'fa' }: {
  visible: boolean; onClose: () => void; onPick: (n: NavItem) => void; lang?: 'fa' | 'ps';
}) {
  const [q, setQ] = useState('');
  const groups = [
    { title: 'ایجاد', items: byGroup('plusCreate') },
  ];
  const filtered = useMemo(() => groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => !q || i.label[lang].includes(q) || i.aliases.some((a) => a.includes(q))),
  })), [q, lang]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>چه کاری انجام دهیم؟</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="جستجو…" placeholderTextColor="#64748b" style={s.search} />
        <ScrollView>
          {filtered.map((g) => g.items.length ? (
            <View key={g.title} style={{ marginTop: 12 }}>
              <Text style={s.group}>{g.title}</Text>
              <View style={s.grid}>
                {g.items.map((i) => (
                  <TouchableOpacity key={i.key + i.label.fa} style={s.card} onPress={() => onPick(i)}>
                    <Text style={s.icon}>{i.icon}</Text>
                    <Text style={s.label}>{i.label[lang]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null)}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0008' },
  sheet: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '75%' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#475569', marginBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'right', marginBottom: 10 },
  search: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 44, textAlign: 'right' },
  group: { color: '#94a3b8', textAlign: 'right', marginBottom: 8, fontWeight: '600' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  card: { width: '31%', backgroundColor: '#1e293b', borderRadius: 14, padding: 12, alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 22, marginBottom: 6 },
  label: { color: '#e2e8f0', fontSize: 12, textAlign: 'center' },
});
