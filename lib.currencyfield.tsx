// lib.currencyfield.tsx — انتخاب واحد پول (کشو + دستی)
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COMMON_CURRENCIES, Currency, getCurrencySync, setCurrency } from './lib.currency';

const getTheme = () => (globalThis as any).__getThemeMode?.() || 'light';
const C = {
  get text() { return getTheme() === 'dark' ? '#ffffff' : '#1a2332'; },
  get textMut() { return getTheme() === 'dark' ? '#94a3b8' : '#64748b'; },
  get border() { return getTheme() === 'dark' ? '#334155' : '#e2e8f0'; },
  get input() { return getTheme() === 'dark' ? '#1a2332' : '#ffffff'; },
  get card() { return getTheme() === 'dark' ? '#0f2438' : '#f8fafc'; },
};

const s = StyleSheet.create({
  trigger: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  triggerTxt: { fontSize: 13, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  triggerArrow: { fontSize: 12 },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, maxHeight: '85%' },
  title: { fontSize: 14, fontWeight: 'bold', textAlign: 'right', color: '#0f2438', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  rowActive: { backgroundColor: 'rgba(124,58,237,0.10)' },
  rowTxt: { fontSize: 13, textAlign: 'right', color: '#0f2438' },
  rowTxtActive: { fontWeight: 'bold', color: '#7c3aed' },
  rowSub: { fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 },
  inp: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right', marginBottom: 8 },
  lbl: { fontSize: 11, color: '#64748b', textAlign: 'right', marginBottom: 4, fontWeight: 'bold' },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});

export default function CurrencyField(props: { value?: string; onChange?: (code: string, cur: Currency) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customDecimals, setCustomDecimals] = useState('0');
  const current = getCurrencySync();

  const pick = function(cur: Currency) {
    setCurrency(cur);
    if (props.onChange) props.onChange(cur.code, cur);
    setOpen(false);
    setCustomMode(false);
  };

  const saveCustom = function() {
    if (!customCode.trim() || !customLabel.trim()) return;
    var cur: Currency = {
      code: customCode.trim().toUpperCase(),
      label: customLabel.trim(),
      symbol: customSymbol.trim(),
      decimals: parseInt(customDecimals, 10) || 0,
      custom: true,
    };
    pick(cur);
  };

  return (
    <>
      <TouchableOpacity
        onPress={function() { setOpen(true); }}
        style={[s.trigger, { backgroundColor: C.input, borderColor: C.border }]}
      >
        <Text style={[s.triggerTxt, { color: C.text }]}>{current.symbol} {current.label}</Text>
        <Text style={[s.triggerArrow, { color: C.textMut }]}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={function() { setOpen(false); }}>
        <View style={s.bg}>
          <View style={s.box}>
            <Text style={s.title}>💱 انتخاب واحد پول</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {!customMode ? (
                <>
                  {COMMON_CURRENCIES.map(function(c) {
                    var active = c.code === current.code;
                    return (
                      <TouchableOpacity key={c.code} onPress={function() { pick(c); }} style={[s.row, active && s.rowActive]}>
                        <Text style={[s.rowTxt, active && s.rowTxtActive]}>{active ? '✓ ' : ''}{c.symbol} {c.label}</Text>
                        <Text style={s.rowSub}>{c.code} — {c.decimals} رقم اعشار</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity onPress={function() { setCustomMode(true); setCustomCode(current.custom ? current.code : ''); setCustomLabel(current.custom ? current.label : ''); setCustomSymbol(current.custom ? current.symbol : ''); setCustomDecimals(String(current.custom ? current.decimals : 0)); }} style={[s.row, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                    <Text style={[s.rowTxt, { color: '#92400e', fontWeight: 'bold' }]}>➕ واحد پول سفارشی (دستی)</Text>
                    <Text style={s.rowSub}>کد، نام، نماد و اعشار را خودت وارد کن</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={function() { setOpen(false); }} style={[s.btn, { backgroundColor: '#64748b', marginTop: 10 }]}>
                    <Text style={s.btnTxt}>بستن</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.lbl}>کد (مثلاً AFN، USD، IQD)</Text>
                  <TextInput style={s.inp} value={customCode} onChangeText={setCustomCode} placeholder="AFN" autoCapitalize="characters" />
                  <Text style={s.lbl}>نام نمایشی</Text>
                  <TextInput style={s.inp} value={customLabel} onChangeText={setCustomLabel} placeholder="مثلاً دینار عراق" />
                  <Text style={s.lbl}>نماد (اختیاری)</Text>
                  <TextInput style={s.inp} value={customSymbol} onChangeText={setCustomSymbol} placeholder="د.ع" />
                  <Text style={s.lbl}>تعداد اعشار (0 یا 2)</Text>
                  <TextInput style={s.inp} value={customDecimals} onChangeText={function(v) { setCustomDecimals(v.replace(/[^0-9]/g, '')); }} keyboardType="numeric" placeholder="0" />
                  <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={function() { setCustomMode(false); }} style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]}>
                      <Text style={s.btnTxt}>← برگشت</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={saveCustom} style={[s.btn, { backgroundColor: '#059669', flex: 2 }]}>
                      <Text style={s.btnTxt}>💾 ذخیره سفارشی</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}