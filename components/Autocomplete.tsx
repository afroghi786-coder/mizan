// components/Autocomplete.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  options: string[];
  placeholder?: string;
  label?: string;
}

export default function Autocomplete({ value, onChange, onSelect, options, placeholder, label }: Props) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query
    ? options.filter(o => String(o).toLowerCase().includes(query.toLowerCase()))
    : options;

  function pick(v: string) {
    setQuery(v);
    onChange(v);
    onSelect?.(v);
    setShow(false);
  }

  return (
    <View>
      {label ? <Text style={s.lbl}>{label}</Text> : null}
      <TextInput
        style={s.inp}
        value={query}
        onChangeText={(v) => { setQuery(v); onChange(v); }}
        onFocus={() => setShow(true)}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
      />
      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <TouchableOpacity style={s.bg} activeOpacity={1} onPress={() => setShow(false)}>
          <View style={s.modal}>
            <View style={s.hdr}>
              <Text style={s.hdrTxt}>
                {query ? `🔍 ${filtered.length} از ${options.length}` : `📋 ${options.length} مورد`}
              </Text>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={s.close}>×</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.item} onPress={() => pick(item)}>
                  <Text style={s.itemTxt}>{String(item)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.empty}>😕 موردی یافت نشد</Text>}
              style={{ maxHeight: 350 }}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  lbl: { color: '#94a3b8', fontSize: 11, marginBottom: 4, marginTop: 8, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, color: '#fff', textAlign: 'right' },
  bg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.75)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#1e293b', borderRadius: 14, maxHeight: 450, overflow: 'hidden' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  hdrTxt: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },
  close: { color: '#fff', fontSize: 26, lineHeight: 26, paddingHorizontal: 4 },
  item: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#334155' },
  itemTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 24, fontSize: 13 },
});
