import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { byGroup, NavItem } from '../nav.registry';
import LedgerScreen from '../LedgerScreen';

export default function DashboardScreen({
  onOpen,
  lang = 'fa'
}: {
  onOpen: (n: NavItem) => void; lang?: 'fa' | 'ps';
}) {
  const [showLedger, setShowLedger] = React.useState(false);
  if (showLedger) return <LedgerScreen onBack={() => setShowLedger(false)} />;

  const items = byGroup('dashboard');
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.h1}>داشبورد</Text>
      <View style={s.grid}>
      <TouchableOpacity onPress={() => setShowLedger(true)} style={{ backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', padding: 20, borderRadius: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#d4af37', fontWeight: 'bold', textAlign: 'center', fontSize: 14 }}>📊 ترازنامه و دفتر معین</Text>
      </TouchableOpacity>

        {items.map((i) => (
          <TouchableOpacity key={i.key + i.label.fa} style={s.card} onPress={() => onOpen(i)}>
            <Text style={s.icon}>{i.icon}</Text>
            <Text style={s.label}>{i.label[lang]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'right', marginBottom: 16 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', backgroundColor: '#1e293b', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 10 },
  icon: { fontSize: 28, marginBottom: 8 },
  label: { color: '#e2e8f0', fontWeight: '600' },
});
