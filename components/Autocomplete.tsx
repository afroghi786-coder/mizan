import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onPick?: (item: any) => void;
  suggestions: any[];
  placeholder?: string;
  labelKey?: string;
  subLabelKey?: string;
  maxSuggestions?: number;
}

export default function Autocomplete({
  value, onChangeText, onPick, suggestions, placeholder,
  labelKey = 'name', subLabelKey = 'price', maxSuggestions = 6,
}: Props) {
  const [show, setShow] = useState(false);

  const filtered = value.length >= 1
    ? suggestions
        .filter(s => String(s[labelKey] || '').indexOf(value) !== -1)
        .slice(0, maxSuggestions)
    : [];

  function pick(item: any) {
    setShow(false);
    if (onPick) onPick(item);
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setShow(true)}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
      />
      {show && filtered.length > 0 && (
        <View style={styles.suggestBox}>
          {filtered.map((item, i) => (
            <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => pick(item)}>
              <Text style={styles.suggestName}>{String(item[labelKey] || '—')}</Text>
              {subLabelKey && item[subLabelKey] !== undefined && (
                <Text style={styles.suggestSub}>
                  {typeof item[subLabelKey] === 'number'
                    ? item[subLabelKey].toLocaleString()
                    : String(item[subLabelKey])}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  input: {
    backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, padding: 12, fontSize: 14, color: '#fff', textAlign: 'right',
  },
  suggestBox: {
    backgroundColor: '#1e293b', borderRadius: 8, marginTop: 4,
    borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
  },
  suggestItem: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  suggestName: { color: '#fff', fontSize: 13, textAlign: 'right', flex: 1 },
  suggestSub: { color: '#d4af37', fontSize: 11, fontFamily: 'monospace' },
});