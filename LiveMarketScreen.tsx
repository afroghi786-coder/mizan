// LiveMarketScreen.tsx — بازار زنده صرافی
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import {
  initNetwork, loadNetSettings, saveNetSettings, getMyNetInfo, isNetReady,
  sendBroadcastHawala, claimHawala, sendFXOffer, claimFXOffer,
  listenOpenHawalas, listenFXOffers, listenMyHawalas, stopAllListeners,
  NET_CITIES,
} from './lib.network';

const fmt = (n: any, d = 0) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const CUR_FLAG: Record<string, string> = { AFN: '🇦🇫', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', PKR: '🇵🇰', AED: '🇦🇪', SAR: '🇸🇦', TRY: '🇹🇷', IRR: '🇮🇷', TOM: '🇮🇷' };

export default function LiveMarketScreen({ showToast }: any) {
  const [net, setNet] = useState<any>({ connected: false, code: '', name: '', city: '' });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hawalas, setHawalas] = useState<any[]>([]);
  const [fxOffers, setFxOffers] = useState<any[]>([]);
  const [myHawalas, setMyHawalas] = useState<any[]>([]);
  const [settingsModal, setSettingsModal] = useState(false);
  const [hawalaModal, setHawalaModal] = useState(false);
  const [fxModal, setFxModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ code: '', name: '', city: 'KBL', phone: '' });
  const [hawalaForm, setHawalaForm] = useState<any>({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
  const [fxForm, setFxForm] = useState<any>({ currency: 'USD', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadNetSettings();
    const ok = await initNetwork();
    setReady(ok);
    setNet(getMyNetInfo());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); return () => { stopAllListeners(); }; }, [refresh]);

  useEffect(() => {
    if (!net.connected || !net.city) return;
    listenOpenHawalas(net.city, setHawalas);
    listenFXOffers(setFxOffers);
    listenMyHawalas(setMyHawalas);
    return () => { stopAllListeners(); };
  }, [net.connected, net.city, net.code]);

  const saveSettings = async () => {
    if (!settingsForm.code || !settingsForm.name) return showToast?.('کد و نام الزامی', true);
    if (!/^[A-Z]{2}-[A-Z]{3}-\d{3}$/.test(settingsForm.code.toUpperCase())) {
      return showToast?.('کد باید AF-KBL-001 باشد', true);
    }
    setSaving(true);
    await saveNetSettings(settingsForm.code.toUpperCase(), settingsForm.name, settingsForm.city, settingsForm.phone);
    await refresh();
    setSaving(false);
    setSettingsModal(false);
    showToast?.('✅ تنظیمات ذخیره شد');
  };

  const submitHawala = async () => {
    if (!hawalaForm.amount || !hawalaForm.beneficiaryName) return showToast?.('مبلغ و نام ذی‌نفع الزامی', true);
    setSaving(true);
    try {
      const id = 'TASK-H-' + Date.now().toString(36).toUpperCase();
      await sendBroadcastHawala({
        id, targetCity: hawalaForm.targetCity,
        currency: hawalaForm.currency, amount: Number(hawalaForm.amount),
        beneficiaryName: hawalaForm.beneficiaryName,
        beneficiaryPhone: hawalaForm.beneficiaryPhone,
        maxFee: Number(hawalaForm.maxFee) || 2,
        expiresAt: Date.now() + (Number(hawalaForm.expires) || 15) * 60000,
        note: hawalaForm.note,
      });
      setHawalaModal(false);
      showToast?.('✅ حواله به شبکه ارسال شد');
      setHawalaForm({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const submitFX = async () => {
    if (!fxForm.amount) return showToast?.('مقدار الزامی', true);
    if (fxForm.rateType === 'fixed' && !fxForm.rate) return showToast?.('نرخ الزامی', true);
    setSaving(true);
    try {
      const id = 'FX-' + Date.now().toString(36).toUpperCase();
      await sendFXOffer({
        id, currency: fxForm.currency, amount: Number(fxForm.amount),
        rateType: fxForm.rateType, rate: Number(fxForm.rate) || 0,
        expiresAt: Date.now() + (Number(fxForm.expires) || 10) * 60000,
        note: fxForm.note,
      });
      setFxModal(false);
      showToast?.('✅ پیشنهاد فروش ثبت شد');
      setFxForm({ currency: 'USD', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const doClaimHawala = async (id: string) => {
    const r = await claimHawala(id);
    if (r.success) showToast?.('✅ گرفتی'); else showToast?.('⚠️ ' + r.message, true);
  };

  const doClaimFX = async (id: string) => {
    const r = await claimFXOffer(id);
    if (r.success) showToast?.('✅ گرفتی'); else showToast?.('⚠️ ' + r.message, true);
  };

  if (loading) return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#d4af37" /></View>;

  return (
    <View>
      {/* وضعیت شبکه */}
      <View style={[s.statusBox, net.connected ? s.statusOn : s.statusOff]}>
        <View style={s.statusDot} />
        <View style={{ flex: 1 }}>
          <Text style={s.statusTitle}>
            {net.connected ? `🟢 متصل به شبکه — ${net.name}` : '🔴 به شبکه متصل نیستید'}
          </Text>
          <Text style={s.statusSub}>
            {net.code ? `کد شما: ${net.code} | شهر: ${NET_CITIES[net.city] || net.city || '—'}` : 'برای شروع، تنظیمات شبکه را وارد کنید'}
          </Text>
        </View>
        <TouchableOpacity style={s.smBtn} onPress={() => { setSettingsForm({ code: net.code || '', name: net.name || '', city: net.city || 'KBL', phone: net.phone || '' }); setSettingsModal(true); }}>
          <Text style={s.smBtnTxt}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* دکمه‌های عملیات */}
      {net.connected && (
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#f59e0b' }]} onPress={() => setHawalaModal(true)}>
            <Text style={s.actBtnTxt}>📤 حواله جدید</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#7c3aed' }]} onPress={() => setFxModal(true)}>
            <Text style={s.actBtnTxt}>💱 فروش ارز</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* حوالات باز برای من */}
      <Text style={s.secT}>📥 حوالات باز برای من ({hawalas.filter((h: any) => h.status === 'open').length})</Text>
      {hawalas.filter((h: any) => h.status === 'open').length === 0 ? (
        <Text style={s.empty}>{net.connected ? 'حواله بازی نیست' : 'ابتدا در شبکه ثبت‌نام کنید'}</Text>
      ) : hawalas.filter((h: any) => h.status === 'open').map((h: any) => {
        const mine = h.fromCode === net.code;
        return (
          <View key={h.id} style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>📤 {h.fromName}</Text>
              <Text style={s.cardCode}>{h.id}</Text>
            </View>
            <Text style={s.cardAmt}>{CUR_FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
            <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📞 {h.beneficiaryPhone || '—'}</Text>
            <Text style={s.cardRow}>📍 {NET_CITIES[h.fromCity] || h.fromCity} → {NET_CITIES[h.targetCity] || h.targetCity}</Text>
            <Text style={s.cardRow}>💰 کارمزد: {h.maxFee || 0}% | ⏱ {Math.max(0, Math.floor(((h.expiresAt || 0) - Date.now()) / 60000))} دقیقه</Text>
            {!mine ? (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doClaimHawala(h.id)}>
                <Text style={s.btnTxt}>⚡ قبول سریع</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[s.cardRow, { color: '#f59e0b' }]}>⏳ ارسال شده — منتظر قبول</Text>
            )}
          </View>
        );
      })}

      {/* فروش ارز در بازار */}
      <Text style={s.secT}>💱 فروش ارز در بازار ({fxOffers.length})</Text>
      {fxOffers.length === 0 ? (
        <Text style={s.empty}>{net.connected ? 'پیشنهادی نیست' : 'ابتدا در شبکه ثبت‌نام کنید'}</Text>
      ) : fxOffers.map((f: any) => (
        <View key={f.id} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>💱 {f.sellerName}</Text>
            <Text style={s.cardCode}>{f.id}</Text>
          </View>
          <Text style={s.cardAmt}>{CUR_FLAG[f.currency] || '💱'} {fmt(f.amount)} {f.currency}</Text>
          <Text style={s.cardRow}>💹 نرخ: {fmt(f.rate, 4)} {f.rateType === 'auction' ? '(حراج)' : ''}</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doClaimFX(f.id)}>
            <Text style={s.btnTxt}>💰 قبول و خرید</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* حوالات من */}
      <Text style={s.secT}>📋 حوالات من ({myHawalas.length})</Text>
      {myHawalas.length === 0 ? (
        <Text style={s.empty}>حواله‌ای ثبت نکرده‌اید</Text>
      ) : myHawalas.map((h: any) => (
        <View key={h.id} style={[s.card, { backgroundColor: '#0a1628' }]}>
          <Text style={s.cardRow}>🆔 {h.id}</Text>
          <Text style={s.cardRow}>📍 {NET_CITIES[h.targetCity] || h.targetCity} | {fmt(h.amount)} {h.currency}</Text>
          <Text style={s.cardRow}>👤 {h.beneficiaryName}</Text>
          <Text style={[s.cardRow, { color: h.status === 'open' ? '#f59e0b' : h.status === 'locked' ? '#059669' : '#94a3b8' }]}>
            {h.status === 'open' ? '⏳ در انتظار' : h.status === 'locked' ? '✅ قبول شد توسط ' + (h.claimedByName || '—') : h.status}
          </Text>
        </View>
      ))}

      {/* مودال تنظیمات */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={s.mHead}><Text style={s.mTitle}>⚙️ تنظیمات شبکه</Text>
            <TouchableOpacity onPress={() => setSettingsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>کد صراف (الگو: AF-KBL-001) *</Text>
            <TextInput style={s.inp} value={settingsForm.code} onChangeText={v => setSettingsForm({ ...settingsForm, code: v.toUpperCase() })} placeholder="AF-KBL-001" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
            <Text style={s.lbl}>نام صرافی *</Text>
            <TextInput style={s.inp} value={settingsForm.name} onChangeText={v => setSettingsForm({ ...settingsForm, name: v })} placeholder="نام صرافی" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>شهر</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setSettingsForm({ ...settingsForm, city: k })} style={[s.chip, settingsForm.city === k && s.chipAct]}>
                  <Text style={[s.chipTxt, settingsForm.city === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>تلفن</Text>
            <TextInput style={s.inp} value={settingsForm.phone} onChangeText={v => setSettingsForm({ ...settingsForm, phone: v })} keyboardType="phone-pad" placeholder="09..." placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setSettingsModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#059669', flex: 2 }]} onPress={saveSettings} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💾 ذخیره</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال حواله جدید */}
      <Modal visible={hawalaModal} transparent animationType="slide" onRequestClose={() => setHawalaModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#f59e0b' }]}><Text style={s.mTitle}>📤 حواله به شبکه</Text>
            <TouchableOpacity onPress={() => setHawalaModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>شهر مقصد *</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(NET_CITIES).map(k => (
                <TouchableOpacity key={k} onPress={() => setHawalaForm({ ...hawalaForm, targetCity: k })} style={[s.chip, hawalaForm.targetCity === k && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}>
                  <Text style={[s.chipTxt, hawalaForm.targetCity === k && { color: '#fff' }]}>{NET_CITIES[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>ارز</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'AFN', 'EUR', 'PKR', 'AED'].map(c => (
                <TouchableOpacity key={c} onPress={() => setHawalaForm({ ...hawalaForm, currency: c })} style={[s.chip, hawalaForm.currency === c && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}>
                  <Text style={[s.chipTxt, hawalaForm.currency === c && { color: '#fff' }]}>{CUR_FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={hawalaForm.amount} onChangeText={v => setHawalaForm({ ...hawalaForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="1000" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نام ذی‌نفع *</Text>
            <TextInput style={s.inp} value={hawalaForm.beneficiaryName} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiaryName: v })} placeholder="نام گیرنده" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>تلفن ذی‌نفع</Text>
            <TextInput style={s.inp} value={hawalaForm.beneficiaryPhone} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiaryPhone: v.replace(/[^\d]/g, '') })} keyboardType="phone-pad" placeholder="07..." placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>حداکثر کارمزد %</Text>
                <TextInput style={s.inp} value={hawalaForm.maxFee} onChangeText={v => setHawalaForm({ ...hawalaForm, maxFee: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholder="2" placeholderTextColor="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lbl}>مهلت (دقیقه)</Text>
                <TextInput style={s.inp} value={hawalaForm.expires} onChangeText={v => setHawalaForm({ ...hawalaForm, expires: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="15" placeholderTextColor="#94a3b8" />
              </View>
            </View>
            <Text style={s.lbl}>توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={hawalaForm.note} onChangeText={v => setHawalaForm({ ...hawalaForm, note: v })} multiline placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setHawalaModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#f59e0b', flex: 2 }]} onPress={submitHawala} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>📤 ارسال</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>

      {/* مودال فروش ارز */}
      <Modal visible={fxModal} transparent animationType="slide" onRequestClose={() => setFxModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#7c3aed' }]}><Text style={s.mTitle}>💱 فروش ارز</Text>
            <TouchableOpacity onPress={() => setFxModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>ارز</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'EUR', 'PKR', 'AED', 'AFN'].map(c => (
                <TouchableOpacity key={c} onPress={() => setFxForm({ ...fxForm, currency: c })} style={[s.chip, fxForm.currency === c && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}>
                  <Text style={[s.chipTxt, fxForm.currency === c && { color: '#fff' }]}>{CUR_FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={fxForm.amount} onChangeText={v => setFxForm({ ...fxForm, amount: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="100" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نوع قیمت</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
              <TouchableOpacity style={[s.chip, fxForm.rateType === 'fixed' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]} onPress={() => setFxForm({ ...fxForm, rateType: 'fixed' })}>
                <Text style={[s.chipTxt, fxForm.rateType === 'fixed' && { color: '#fff' }]}>💰 نرخ ثابت</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, fxForm.rateType === 'auction' && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]} onPress={() => setFxForm({ ...fxForm, rateType: 'auction' })}>
                <Text style={[s.chipTxt, fxForm.rateType === 'auction' && { color: '#fff' }]}>📊 حراج</Text>
              </TouchableOpacity>
            </View>
            {fxForm.rateType === 'fixed' && (
              <>
                <Text style={s.lbl}>نرخ (هر واحد به افغانی) *</Text>
                <TextInput style={s.inp} value={fxForm.rate} onChangeText={v => setFxForm({ ...fxForm, rate: v.replace(/[^\d.]/g, '') })} keyboardType="numeric" placeholder="70500" placeholderTextColor="#94a3b8" />
              </>
            )}
            <Text style={s.lbl}>مهلت (دقیقه)</Text>
            <TextInput style={s.inp} value={fxForm.expires} onChangeText={v => setFxForm({ ...fxForm, expires: v.replace(/[^\d]/g, '') })} keyboardType="numeric" placeholder="10" placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setFxModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed', flex: 2 }]} onPress={submitFX} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>💱 ثبت</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  statusBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1 },
  statusOn: { backgroundColor: '#065f46', borderColor: '#10b981' },
  statusOff: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  statusTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  statusSub: { color: '#e2e8f0', fontSize: 11, marginTop: 2, textAlign: 'right' },
  smBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6 },
  smBtnTxt: { color: '#fff', fontSize: 14 },
  actBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  secT: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  cardCode: { color: '#7c3aed', fontSize: 10, fontFamily: 'monospace' },
  cardAmt: { color: '#00ff88', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6, fontFamily: 'monospace' },
  cardRow: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 3 },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 12 },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 14 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%', overflow: 'hidden' },
  mHead: { backgroundColor: '#1e3a8a', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, textAlign: 'right' },
  x: { color: '#fff', fontSize: 24 },
  lbl: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 4, textAlign: 'right' },
  inp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1a2332', marginLeft: 4, marginTop: 4 },
  chipAct: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  rowBtns: { flexDirection: 'row-reverse', gap: 8, marginTop: 16 },
});
