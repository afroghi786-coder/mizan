// lib.datefield.tsx — DateField با کشوی تقویم، دکمه ▲▼ برای هر ۶ فیلد، پرش خودکار و انتخاب متن
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal } from 'react-native';
import { parseDateAny, toStorageDateFull, getCalType, pad2, g2j, g2h, j2g, h2g } from './lib';

export type CalType = 'jalali' | 'gregorian' | 'hijri';

const getTheme = () => (globalThis as any).__getThemeMode?.() || 'light';
const C = {
  get text() { return getTheme() === 'dark' ? '#ffffff' : '#1a2332'; },
  get textMut() { return getTheme() === 'dark' ? '#94a3b8' : '#64748b'; },
  get border() { return getTheme() === 'dark' ? '#334155' : '#e2e8f0'; },
  get input() { return getTheme() === 'dark' ? '#1a2332' : '#ffffff'; },
  get card() { return getTheme() === 'dark' ? '#0f2438' : '#f8fafc'; },
};

const CAL_LABELS: Record<CalType, string> = { jalali: 'شمسی', gregorian: 'میلادی', hijri: 'قمری' };

const s = StyleSheet.create({
  dateBox: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2, gap: 0 },
  fieldWrap: { alignItems: 'center' },
  dateInp: { textAlign: 'center', fontSize: 13, paddingVertical: 0, paddingHorizontal: 0 },
  dateSep: { fontSize: 13, textAlign: 'center', marginHorizontal: 0 },
  arrowBtn: { paddingHorizontal: 6, paddingVertical: 0, height: 14, justifyContent: 'center', alignItems: 'center' },
  arrowTxt: { fontSize: 8, fontWeight: 'bold', lineHeight: 10 },
  typeBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginLeft: 'auto' },
  typeBtnTxt: { fontSize: 11, fontWeight: 'bold' },
});

export function DateField({ value, onChange, compact, defaultToToday }: any) {
  const [type, setType] = useState<CalType>(getCalType());
  const [fields, setFields] = useState({ y: '', m: '', d: '', h: '00', n: '00', s: '00' });
  const [showPicker, setShowPicker] = useState(false);
  const refs = useRef<Record<string, any>>({});
  const skipExternal = useRef(false);

  const populateFromValue = () => {
    const g = value ? parseDateAny(value) : (defaultToToday ? new Date() : null);
    if (!g) { setFields({ y: '', m: '', d: '', h: '00', n: '00', s: '00' }); return; }
    let y = 0, mo = 0, d = 0;
    if (type === 'jalali') { [y, mo, d] = g2j(g.getFullYear(), g.getMonth() + 1, g.getDate()); }
    else if (type === 'hijri') { const h = g2h(g); y = h.y; mo = h.m; d = h.d; }
    else { y = g.getFullYear(); mo = g.getMonth() + 1; d = g.getDate(); }
    setFields({ y: String(y), m: pad2(mo), d: pad2(d), h: pad2(g.getHours()), n: pad2(g.getMinutes()), s: pad2(g.getSeconds()) });
  };

  useEffect(() => {
    if (skipExternal.current) { skipExternal.current = false; return; }
    populateFromValue();
  }, [value]);

  useEffect(() => { populateFromValue(); }, [type]);

  const apply = (f: any) => {
    setFields(f);
    const y = parseInt(f.y, 10), m = parseInt(f.m, 10), d = parseInt(f.d, 10);
    if (!y || !m || !d) return;
    const h = parseInt(f.h, 10) || 0, n = parseInt(f.n, 10) || 0, sec = parseInt(f.s, 10) || 0;
    let gg: Date;
    if (type === 'jalali') { const r = j2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else if (type === 'hijri') { const r = h2g(y, m, d); gg = new Date(r.y, r.m - 1, r.d, h, n, sec); }
    else { gg = new Date(y, m - 1, d, h, n, sec); }
    skipExternal.current = true;
    onChange?.(toStorageDateFull(gg));
  };

  const goNext = (k: string) => {
    const order = ['y', 'm', 'd', 'h', 'n', 's'];
    const idx = order.indexOf(k);
    if (idx < 0 || idx >= order.length - 1) return;
    const nextK = order[idx + 1];
    const ref = refs.current[nextK];
    if (ref && ref.focus) {
      setTimeout(() => {
        try {
          ref.focus();
          const val = String((fields as any)[nextK] || '');
          setTimeout(() => {
            try { ref.setNativeProps({ selection: { start: 0, end: val.length } }); } catch {}
          }, 50);
        } catch {}
      }, 80);
    }
  };

  const inc = (k: string) => {
    const cur = parseInt((fields as any)[k], 10) || 0;
    const max = k === 'y' ? 9999 : (k === 'm' ? 12 : (k === 'd' ? 31 : (k === 'h' ? 23 : 59)));
    const nv = Math.min(cur + 1, max);
    apply({ ...fields, [k]: k === 'y' ? String(nv) : pad2(nv) });
  };

  const dec = (k: string) => {
    const cur = parseInt((fields as any)[k], 10) || 0;
    const nv = Math.max(cur - 1, 0);
    apply({ ...fields, [k]: k === 'y' ? String(nv) : pad2(nv) });
  };

  const renderField = (k: 'y'|'m'|'d'|'h'|'n'|'s', w: number, ph: string, maxLen: number) => {
    const val = String((fields as any)[k] || '');
    return (
      <View style={s.fieldWrap}>
        <TouchableOpacity onPress={() => inc(k)} style={s.arrowBtn}><Text style={[s.arrowTxt, { color: C.textMut }]}>▲</Text></TouchableOpacity>
        <TextInput
          ref={(ref: any) => { refs.current[k] = ref; }}
          accessibilityLabel={'date_' + k}
          style={[s.dateInp, { width: w, color: C.text }, compact && { fontSize: 11 }]}
          value={val}
          onChangeText={(t) => {
            let cleaned = t.replace(/\D/g, '');
            if (cleaned.length > maxLen) cleaned = cleaned.slice(-maxLen);
            apply({ ...fields, [k]: cleaned });
            if (cleaned.length >= maxLen) setTimeout(() => goNext(k), 80);
          }}
          selectTextOnFocus
          keyboardType="numeric"
          placeholder={ph}
          placeholderTextColor={C.textMut}
        />
        <TouchableOpacity onPress={() => dec(k)} style={s.arrowBtn}><Text style={[s.arrowTxt, { color: C.textMut }]}>▼</Text></TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <View style={[s.dateBox, { backgroundColor: C.input, borderColor: C.border }, compact && { paddingVertical: 1 }]}>
        {renderField('y', compact ? 44 : 52, 'YYYY', 4)}
        <Text style={[s.dateSep, { color: C.textMut }]}>/</Text>
        {renderField('m', 28, 'MM', 2)}
        <Text style={[s.dateSep, { color: C.textMut }]}>/</Text>
        {renderField('d', 28, 'DD', 2)}
        <Text style={[s.dateSep, { width: 4, color: C.textMut }]}> </Text>
        {renderField('h', 28, 'HH', 2)}
        <Text style={[s.dateSep, { color: C.textMut }]}>:</Text>
        {renderField('n', 28, 'MM', 2)}
        <Text style={[s.dateSep, { color: C.textMut }]}>:</Text>
        {renderField('s', 28, 'SS', 2)}
        <TouchableOpacity accessibilityLabel="تغییر تقویم" style={[s.typeBtn, { backgroundColor: C.border }]} onPress={() => setShowPicker(true)}>
          <Text style={[s.typeBtnTxt, { color: C.text }]}>{CAL_LABELS[type]} ▼</Text>
        </TouchableOpacity>
      </View>

      <Modal transparent visible={showPicker} onRequestClose={() => setShowPicker(false)} animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={{ backgroundColor: C.card, borderRadius: 14, width: 260, padding: 6, borderWidth: 2, borderColor: '#d4af37' }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold', textAlign: 'right', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>انتخاب تقویم</Text>
            {(['jalali', 'gregorian', 'hijri'] as const).map((opt) => (
              <TouchableOpacity key={opt} onPress={() => { setType(opt); setShowPicker(false); }} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: type === opt ? 'rgba(124,58,237,0.15)' : 'transparent' }}>
                <Text style={{ color: type === opt ? '#7c3aed' : C.text, fontSize: 15, textAlign: 'right', fontWeight: type === opt ? 'bold' : 'normal' }}>
                  {type === opt ? '✓ ' : ''}{CAL_LABELS[opt]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default DateField;
