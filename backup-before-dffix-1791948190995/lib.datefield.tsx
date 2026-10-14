// lib.datefield.tsx — کامپوننت DateField (جدا شده برای حل circular dependency)
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LanguageModal from './LanguageModal';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,

export function DateField({ value, onChange, compact, defaultToToday }: any) {
  const [type, setType] = useState<CalType>(getCalType());
  const [g, setG] = useState<Date | null>(value ? parseDateAny(value) : (defaultToToday ? new Date() : null));
  const [fields, setFields] = useState({ y: '', m: '', d: '', h: '00', n: '00', s: '00' });

  useEffect(() => {
    if (!g) { setFields({ y: '', m: '', d: '', h: '00', n: '00', s: '00' }); return; }
    let y = 0, mo = 0, d = 0;
    if (type === 'jalali') { [y, mo, d] = g2j(g.getFullYear(), g.getMonth() + 1, g.getDate()); }
    else if (type === 'hijri') { const h = g2h(g); y = h.y; mo = h.m; d = h.d; }
    else { y = g.getFullYear(); mo = g.getMonth() + 1; d = g.getDate(); }
    setFields({ y: String(y), m: pad2(mo), d: pad2(d), h: pad2(g.getHours()), n: pad2(g.getMinutes()), s: pad2(g.getSeconds()) });
  }, [g, type]);

  const apply = (f: any) => {
    setFields(f);
    const y = parseInt(f.y, 10), m = parseInt(f.m, 10), d = parseInt(f.d, 10);
    if (!y || !m || !d) { setG(null); onChange(''); return; }
    const h = parseInt(f.h, 10) || 0, n = parseInt(f.n, 10) || 0, sec = parseInt(f.s, 10) || 0;
    let gg: Date;
    if (type === 'jalali') { const r = j2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else if (type === 'hijri') { const r = h2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else { gg = new Date(y, m - 1, d, h, n, sec); }
    setG(gg); onChange(toStorageDateFull(gg));
  };                                             

  const F = ({ v, k, w, ph }: any) => (
    <TextInput style={[s.dateInp, { width: w || 44, color: C.text }, compact && { fontSize: 11 }]} value={v} onChangeText={(t) => apply({ ...fields, [k]: t.replace(/\D/g, '').slice(0, k === 'y' ? 4 : 2) })} keyboardType="numeric" placeholder={ph} placeholderTextColor={C.textMut} />
  );

  return (
    <View style={[s.dateBox, { backgroundColor: C.input, borderColor: C.border }, compact && { paddingVertical: 3 }]}>
      <F v={fields.y} k="y" w={compact ? 52 : 60} ph="YYYY" />
      <Text style={[s.dateSep, { color: C.textMut }]}>/</Text><F v={fields.m} k="m" ph="MM" />
      <Text style={[s.dateSep, { color: C.textMut }]}>/</Text><F v={fields.d} k="d" ph="DD" />
      <Text style={[s.dateSep, { width: 8, color: C.textMut }]}> </Text>
      <F v={fields.h} k="h" ph="HH" />
      <Text style={[s.dateSep, { color: C.textMut }]}>:</Text><F v={fields.n} k="n" ph="MM" />
      <Text style={[s.dateSep, { color: C.textMut }]}>:</Text><F v={fields.s} k="s" ph="SS" />
      <TouchableOpacity style={[s.typeBtn, { backgroundColor: C.border }]} onPress={() => { const next = type === 'jalali' ? 'gregorian' : type === 'gregorian' ? 'hijri' : 'jalali'; setType(next); }}>
        <Text style={[s.typeBtnTxt, { color: C.text }]}>{type === 'jalali' ? 'شمسی' : type === 'gregorian' ? 'میلادی' : 'قمری'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default DateField;
