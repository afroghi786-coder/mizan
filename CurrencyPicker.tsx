// CurrencyPicker.tsx — انتخاب ارز با نام فارسی و پرچم
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet } from 'react-native';

export const CUR_INFO: Record<string, { name: string; flag: string; symbol: string; dec: number }> = {
  AFN: { name: 'افغانی',            flag: '🇦🇫', symbol: '؋',      dec: 0 },
  USD: { name: 'دالر امریکایی',     flag: '🇺🇸', symbol: '$',      dec: 2 },
  EUR: { name: 'یورو',              flag: '🇪🇺', symbol: '€',      dec: 2 },
  GBP: { name: 'پوند انگلیس',       flag: '🇬🇧', symbol: '£',      dec: 2 },
  PKR: { name: 'کلدار پاکستان',     flag: '🇵🇰', symbol: '₨',      dec: 0 },
  IRR: { name: 'ریال ایران',        flag: '🇮🇷', symbol: '﷼',      dec: 0 },
  TOM: { name: 'تومان ایران',       flag: '🇮🇷', symbol: 'تومان',   dec: 0 },
  AED: { name: 'درهم امارات',       flag: '🇦🇪', symbol: 'د.إ',    dec: 2 },
  SAR: { name: 'ریال سعودی',        flag: '🇸🇦', symbol: 'ر.س',    dec: 2 },
  TRY: { name: 'لیر ترکیه',         flag: '🇹🇷', symbol: '₺',      dec: 2 },
  CNY: { name: 'یوان چین',          flag: '🇨🇳', symbol: '¥',      dec: 2 },
  INR: { name: 'روپیه هند',         flag: '🇮🇳', symbol: '₹',      dec: 0 },
  JPY: { name: 'ین ژاپن',           flag: '🇯🇵', symbol: '¥',      dec: 0 },
  CHF: { name: 'فرانک سوئیس',       flag: '🇨🇭', symbol: 'Fr',     dec: 2 },
  CAD: { name: 'دالر کانادا',       flag: '🇨🇦', symbol: 'C$',     dec: 2 },
  AUD: { name: 'دالر استرالیا',     flag: '🇦🇺', symbol: 'A$',     dec: 2 },
  KWD: { name: 'دینار کویت',        flag: '🇰🇼', symbol: 'د.ك',    dec: 3 },
  QAR: { name: 'ریال قطر',          flag: '🇶🇦', symbol: 'ر.ق',    dec: 2 },
  OMR: { name: 'ریال عمان',         flag: '🇴🇲', symbol: 'ر.ع',    dec: 3 },
  BHD: { name: 'دینار بحرین',       flag: '🇧🇭', symbol: 'د.ب',    dec: 3 },
  JOD: { name: 'دینار اردن',        flag: '🇯🇴', symbol: 'د.أ',    dec: 3 },
  IQD: { name: 'دینار عراق',        flag: '🇮🇶', symbol: 'ع.د',    dec: 0 },
  MYR: { name: 'رینگیت مالزی',      flag: '🇲🇾', symbol: 'RM',     dec: 2 },
  RUB: { name: 'روبل روسیه',        flag: '🇷🇺', symbol: '₽',      dec: 2 },
  TJS: { name: 'سامانی تاجیکستان',  flag: '🇹🇯', symbol: 'SM',     dec: 2 },
  UZS: { name: 'سوم ازبکستان',      flag: '🇺🇿', symbol: 'сўм',    dec: 0 },
  TMT: { name: 'منات ترکمنستان',    flag: '🇹🇲', symbol: 'm',      dec: 2 },
  KGS: { name: 'سوم قرقیزستان',     flag: '🇰🇬', symbol: 'с',      dec: 2 },
  KZT: { name: 'تنگه قزاقستان',     flag: '🇰🇿', symbol: '₸',      dec: 2 },
  AZN: { name: 'منات آذربایجان',    flag: '🇦🇿', symbol: '₼',      dec: 2 },
  HKD: { name: 'دالر هنگ‌کنگ',      flag: '🇭🇰', symbol: 'HK$',    dec: 2 },
  SGD: { name: 'دالر سنگاپور',      flag: '🇸🇬', symbol: 'S$',     dec: 2 },
  THB: { name: 'بات تایلند',        flag: '🇹🇭', symbol: '฿',      dec: 2 },
  EGP: { name: 'جنيه مصر',          flag: '🇪🇬', symbol: 'ج.م',    dec: 2 },
  LYD: { name: 'دینار لیبی',        flag: '🇱🇾', symbol: 'ل.د',    dec: 3 },
  SYP: { name: 'لیره سوریه',        flag: '🇸🇾', symbol: 'ل.س',    dec: 0 },
  LBP: { name: 'لیره لبنان',        flag: '🇱🇧', symbol: 'ل.ل',    dec: 0 },
  YER: { name: 'ریال یمن',          flag: '🇾🇪', symbol: 'ر.ي',    dec: 0 },
  ETB: { name: 'بیر اتیوپی',        flag: '🇪🇹', symbol: 'Br',     dec: 2 },
  NOK: { name: 'کرون نروژ',         flag: '🇳🇴', symbol: 'kr',     dec: 2 },
  SEK: { name: 'کرون سوئد',         flag: '🇸🇪', symbol: 'kr',     dec: 2 },
  DKK: { name: 'کرون دانمارک',      flag: '🇩🇰', symbol: 'kr',     dec: 2 },
  NZD: { name: 'دالر نیوزیلند',     flag: '🇳🇿', symbol: 'NZ$',    dec: 2 },
  ZAR: { name: 'رند افریقای جنوبی', flag: '🇿🇦', symbol: 'R',      dec: 2 },
};

export const ALL_CURS = Object.keys(CUR_INFO);

export function curLabel(code: string): string {
  const c = CUR_INFO[code];
  return c ? `${c.name} (${code})` : code;
}

export function curFlag(code: string): string {
  return CUR_INFO[code]?.flag || '💱';
}

export default function CurrencyPicker({ visible, current, onSelect, onClose, title }: any) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return ALL_CURS;
    return ALL_CURS.filter(k => k.toLowerCase().includes(s) || (CUR_INFO[k]?.name || '').includes(s));
  }, [q]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.bg}>
        <View style={st.box}>
          <View style={st.head}>
            <Text style={st.title}>{title || 'انتخاب ارز'} ({ALL_CURS.length})</Text>
            <TouchableOpacity onPress={onClose}><Text style={st.x}>×</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 10 }}>
            <TextInput
              style={st.search}
              value={q}
              onChangeText={setQ}
              placeholder="🔍 جستجو: USD یا دالر یا افغانی..."
              placeholderTextColor="#94a3b8"
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>یافت نشد</Text>
            ) : filtered.map(code => {
              const c = CUR_INFO[code];
              const sel = code === current;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => { onSelect(code); onClose(); }}
                  style={[st.row, sel && st.rowActive]}
                >
                  <Text style={st.flag}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.name, sel && { color: '#fff' }]}>{c.name}</Text>
                    <Text style={[st.code, sel && { color: '#a7f3d0' }]}>{code} • {c.symbol}</Text>
                  </View>
                  {sel ? <Text style={{ color: '#fff', fontSize: 18 }}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 14 },
  box: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  head: { backgroundColor: '#1e3a8a', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  x: { color: '#fff', fontSize: 24 },
  search: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', backgroundColor: '#0f2438' },
  rowActive: { backgroundColor: '#1e3a8a' },
  flag: { fontSize: 22, marginLeft: 10 },
  name: { color: '#e2e8f0', fontSize: 13, textAlign: 'right', fontWeight: 'bold' },
  code: { color: '#94a3b8', fontSize: 10, fontFamily: 'monospace', textAlign: 'right', marginTop: 2 },
});
