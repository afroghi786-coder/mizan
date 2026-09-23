import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { CalType, dateToFields, fieldsToDate, isValidDate, toStorageDateFull } from '../lib-date';

interface Props {
  value?: string | null;
  onChange?: (storageValue: string, dateObj: Date | null) => void;
  defaultToToday?: boolean;
  compact?: boolean;
  initialType?: CalType;
}

export default function DateField({ value, onChange, defaultToToday, compact, initialType }: Props) {
  const [calType, setCalType] = useState<CalType>(initialType || 'jalali');
  const [y, setY] = useState('');
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const [hh, setHh] = useState('');
  const [mm, setMm] = useState('');
  const [ss, setSs] = useState('');
  const [showType, setShowType] = useState(false);

  // مقدار اولیه
  useEffect(() => {
    let initialDate: Date | null = null;
    if (value) {
      initialDate = typeof value === 'string' ? new Date(value) : value;
    } else if (defaultToToday) {
      initialDate = new Date();
    }
    if (initialDate && !isNaN(initialDate.getTime())) {
      fillFields(initialDate);
    }
  }, []);

  function fillFields(date: Date) {
    const f = dateToFields(date, calType);
    setY(String(f.y));
    setM(String(f.m).padStart(2, '0'));
    setD(String(f.d).padStart(2, '0'));
    setHh(String(f.h).padStart(2, '0'));
    setMm(String(f.n).padStart(2, '0'));
    setSs(String(f.s).padStart(2, '0'));
  }

  function commit(newType?: CalType) {
    const type = newType || calType;
    const yi = parseInt(y) || 0;
    const mi = parseInt(m) || 0;
    const di = parseInt(d) || 0;
    const hi = parseInt(hh) || 0;
    const ni = parseInt(mm) || 0;
    const si = parseInt(ss) || 0;
    if (!isValidDate(yi, mi, di, type)) {
      if (onChange) onChange('', null);
      return;
    }
    const date = fieldsToDate(yi, mi, di, hi, ni, si, type);
    if (!date) {
      if (onChange) onChange('', null);
      return;
    }
    const storage = toStorageDateFull(date);
    if (onChange) onChange(storage, date);
  }

  function changeType(newType: CalType) {
    // تبدیل مقدار فعلی به نوع جدید
    const yi = parseInt(y) || 0;
    const mi = parseInt(m) || 0;
    const di = parseInt(d) || 0;
    if (isValidDate(yi, mi, di, calType)) {
      const date = fieldsToDate(yi, mi, di, parseInt(hh) || 0, parseInt(mm) || 0, parseInt(ss) || 0, calType);
      setCalType(newType);
      if (date) {
        setTimeout(() => fillFieldsWithType(date, newType), 0);
      }
    } else {
      setCalType(newType);
    }
    setShowType(false);
  }

  function fillFieldsWithType(date: Date, type: CalType) {
    const f = dateToFields(date, type);
    setY(String(f.y));
    setM(String(f.m).padStart(2, '0'));
    setD(String(f.d).padStart(2, '0'));
    setHh(String(f.h).padStart(2, '0'));
    setMm(String(f.n).padStart(2, '0'));
    setSs(String(f.s).padStart(2, '0'));
    commit(type);
  }

  function onFieldChange(setter: any, val: string, max: number) {
    const v = val.replace(/[^\d]/g, '').slice(0, max);
    setter(v);
    commit();
  }

  const ph = compact ? { y: 'YYYY', m: 'MM', d: 'DD', h: 'HH', n: 'MM', s: 'SS' } : { y: 'سال', m: 'ماه', d: 'روز', h: 'ساعت', n: 'دقیقه', s: 'ثانیه' };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        <TextInput style={[styles.inp, styles.inpY, compact && styles.inpCompact]} value={y}
          onChangeText={(v) => onFieldChange(setY, v, 4)} keyboardType="numeric"
          placeholder={ph.y} placeholderTextColor="#64748b" />
        <Text style={styles.sep}>/</Text>
        <TextInput style={[styles.inp, compact && styles.inpCompact]} value={m}
          onChangeText={(v) => onFieldChange(setM, v, 2)} keyboardType="numeric"
          placeholder={ph.m} placeholderTextColor="#64748b" />
        <Text style={styles.sep}>/</Text>
        <TextInput style={[styles.inp, compact && styles.inpCompact]} value={d}
          onChangeText={(v) => onFieldChange(setD, v, 2)} keyboardType="numeric"
          placeholder={ph.d} placeholderTextColor="#64748b" />
        <View style={{ width: 6 }} />
        <TextInput style={[styles.inp, compact && styles.inpCompact]} value={hh}
          onChangeText={(v) => onFieldChange(setHh, v, 2)} keyboardType="numeric"
          placeholder={ph.h} placeholderTextColor="#64748b" />
        <Text style={styles.sep}>:</Text>
        <TextInput style={[styles.inp, compact && styles.inpCompact]} value={mm}
          onChangeText={(v) => onFieldChange(setMm, v, 2)} keyboardType="numeric"
          placeholder={ph.n} placeholderTextColor="#64748b" />
        <Text style={styles.sep}>:</Text>
        <TextInput style={[styles.inp, compact && styles.inpCompact]} value={ss}
          onChangeText={(v) => onFieldChange(setSs, v, 2)} keyboardType="numeric"
          placeholder={ph.s} placeholderTextColor="#64748b" />
      </View>

      <TouchableOpacity style={styles.typeBtn} onPress={() => setShowType(!showType)}>
        <Text style={styles.typeText}>
          {calType === 'jalali' ? 'شمسی' : calType === 'hijri' ? 'قمری' : 'میلادی'} ▼
        </Text>
      </TouchableOpacity>

      {showType && (
        <View style={styles.typeMenu}>
          <TouchableOpacity style={styles.typeItem} onPress={() => changeType('jalali')}>
            <Text style={styles.typeItemText}>🌙 شمسی</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.typeItem} onPress={() => changeType('gregorian')}>
            <Text style={styles.typeItemText}>🌍 میلادی</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.typeItem} onPress={() => changeType('hijri')}>
            <Text style={styles.typeItemText}>🕋 قمری</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, padding: 6, marginTop: 4,
  },
  wrapCompact: { padding: 4 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  inp: {
    flex: 1, backgroundColor: '#0f2438', borderRadius: 4,
    padding: 6, color: '#fff', textAlign: 'center', fontSize: 12,
    borderWidth: 1, borderColor: '#1e3a5f', minWidth: 40,
  },
  inpCompact: { padding: 3, fontSize: 10 },
  inpY: { flex: 1.3 },
  sep: { color: '#64748b', fontSize: 14, paddingHorizontal: 2, fontWeight: 'bold' },
  typeBtn: {
    alignSelf: 'flex-end', marginTop: 4, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#0f2438', borderRadius: 4, borderWidth: 1, borderColor: '#1e3a5f',
  },
  typeText: { color: '#d4af37', fontSize: 10, fontWeight: 'bold' },
  typeMenu: {
    position: 'absolute', top: '100%', right: 0, zIndex: 100,
    backgroundColor: '#1e293b', borderRadius: 8, padding: 4,
    borderWidth: 1, borderColor: '#334155', minWidth: 100,
  },
  typeItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  typeItemText: { color: '#fff', fontSize: 12 },
});