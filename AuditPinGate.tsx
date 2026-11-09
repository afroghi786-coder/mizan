import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import AsyncStorage from './lib.storage';
import { pushPinToSheet, pullPinFromSheet, deletePinFromSheet, SheetPin } from './lib.auditSync';

const STATE_KEY = '@mizan_audit_pin_state';
const CONFIG_KEY = '@mizan_audit_pin_config';
const CONFIG_VERSION = 2;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

type PinConfig = {
  salt: string;
  hash: string;
  setAt: string;
  v: number;
  isOwner: boolean;
};

type PinState = {
  unlockUntil: number;
  failedAttempts: number;
  lockedUntil: number;
};

function simpleHash(str: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) >>> 0;
    h2 = ((h2 << 5) + h2 + (c ^ 0x5f)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function randomSalt(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function readConfig(): Promise<PinConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.salt || !obj.hash) return null;
    if (Number(obj.v) !== CONFIG_VERSION) return null;
    return {
      salt: String(obj.salt),
      hash: String(obj.hash),
      setAt: String(obj.setAt || ''),
      v: CONFIG_VERSION,
      isOwner: obj.isOwner !== false,
    };
  } catch { return null; }
}

async function readState(): Promise<PinState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return { unlockUntil: 0, failedAttempts: 0, lockedUntil: 0 };
    const obj = JSON.parse(raw);
    return {
      unlockUntil: Number(obj?.unlockUntil || 0),
      failedAttempts: Number(obj?.failedAttempts || 0),
      lockedUntil: Number(obj?.lockedUntil || 0),
    };
  } catch { return { unlockUntil: 0, failedAttempts: 0, lockedUntil: 0 }; }
}

async function writeState(s: PinState): Promise<void> {
  try { await AsyncStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch {}
}

async function saveConfig(cfg: PinConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

async function clearLocalPin(): Promise<void> {
  try { await AsyncStorage.removeItem(CONFIG_KEY); } catch {}
  try { await AsyncStorage.removeItem(STATE_KEY); } catch {}
}

async function createLocalPin(pin: string, isOwner: boolean): Promise<PinConfig | null> {
  const p = String(pin || '').trim();
  if (!/^\d{6}$/.test(p)) return null;
  const salt = randomSalt();
  const hash = simpleHash(salt + ':' + p);
  if (!hash) return null;
  const cfg: PinConfig = {
    salt, hash,
    setAt: new Date().toISOString(),
    v: CONFIG_VERSION,
    isOwner,
  };
  await saveConfig(cfg);
  await writeState({ unlockUntil: 0, failedAttempts: 0, lockedUntil: 0 });
  return cfg;
}

async function adoptSheetPin(sheet: SheetPin): Promise<void> {
  const cfg: PinConfig = {
    salt: sheet.salt,
    hash: sheet.hash,
    setAt: sheet.setAt || new Date().toISOString(),
    v: CONFIG_VERSION,
    isOwner: false,
  };
  await saveConfig(cfg);
  await writeState({ unlockUntil: 0, failedAttempts: 0, lockedUntil: 0 });
}

async function verifyPin(pin: string): Promise<{ ok: boolean; error?: string; lockedUntil?: number }> {
  const cfg = await readConfig();
  if (!cfg) return { ok: false, error: 'رمز تنظیم نشده' };
  const st = await readState();
  const now = Date.now();
  if (st.lockedUntil > now) return { ok: false, error: 'قفل موقت', lockedUntil: st.lockedUntil };
  const p = String(pin || '').trim();
  if (!/^\d{6}$/.test(p)) return { ok: false, error: 'رمز باید ۶ رقم باشد' };
  const hash = simpleHash(cfg.salt + ':' + p);
  if (hash === cfg.hash) {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    await writeState({ unlockUntil: endOfDay.getTime(), failedAttempts: 0, lockedUntil: 0 });
    return { ok: true };
  }
  const fa = st.failedAttempts + 1;
  if (fa >= MAX_FAILED) {
    const lu = now + LOCK_MS;
    await writeState({ unlockUntil: 0, failedAttempts: 0, lockedUntil: lu });
    return { ok: false, error: 'تلاش‌های ناموفق زیاد. ۱۵ دقیقه قفل شد.', lockedUntil: lu };
  }
  await writeState({ unlockUntil: 0, failedAttempts: fa, lockedUntil: 0 });
  return { ok: false, error: 'رمز اشتباه. ' + (MAX_FAILED - fa) + ' تلاش باقی' };
}

type Mode = 'loading' | 'setup' | 'locked' | 'unlocked';

export default function AuditPinGate({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('loading');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [isOwner, setIsOwner] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [sOld, setSOld] = useState('');
  const [sNew, setSNew] = useState('');
  const [sConfirm, setSConfirm] = useState('');
  const [sError, setSError] = useState('');
  const [sBusy, setSBusy] = useState(false);

  const refresh = async () => {
    try {
      let local = await readConfig();
      const sheetRaw = await pullPinFromSheet();
      const sheet = sheetRaw as SheetPin | null | undefined;

      if (!local) {
        if (sheet && sheet.hash) {
          await adoptSheetPin(sheet);
          local = await readConfig();
        } else {
          setIsOwner(false);
          setMode('setup');
          return;
        }
      } else if (local.isOwner) {
        if (sheet === undefined) {
          // offline - keep local
        } else if (sheet === null) {
          await pushPinToSheet({ salt: local.salt, hash: local.hash, setAt: local.setAt, v: local.v, isOwner: true });
        } else if (sheet.hash && sheet.hash !== local.hash) {
          await adoptSheetPin(sheet);
          local = await readConfig();
        }
      } else {
        if (sheet === undefined) {
          // offline - keep local
        } else if (sheet === null) {
          await clearLocalPin();
          setIsOwner(false);
          setMode('setup');
          return;
        } else if (sheet.hash !== local.hash) {
          await adoptSheetPin(sheet);
          local = await readConfig();
        }
      }

      const cfg = await readConfig();
      setIsOwner(!!cfg?.isOwner);

      const st = await readState();
      const now = Date.now();
      if (st.lockedUntil > now) { setLockedUntil(st.lockedUntil); setMode('locked'); return; }
      if (st.unlockUntil > now) { setMode('unlocked'); return; }
      setMode('locked');
    } catch (e) {
      console.log('[auditPin] refresh error:', e);
      setMode('setup');
    }
  };

  useEffect(() => {
    refresh();
    try { (globalThis as any).__auditPinOpenSettings = () => setShowSettings(true); } catch {}
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const iv = setInterval(() => {
      const r = lockedUntil - Date.now();
      if (r <= 0) { setLockedUntil(0); setRemaining(0); setError(''); refresh(); return; }
      setRemaining(Math.ceil(r / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  const onSetup = async () => {
    setError('');
    if (!/^\d{6}$/.test(pin)) { setError('رمز باید ۶ رقم باشد'); return; }
    if (pin !== confirm) { setError('تکرار رمز یکی نیست'); return; }
    setBusy(true);
    try {
      const sheetRaw = await pullPinFromSheet();
      if (sheetRaw === undefined) {
        setError('برای تنظیم اولیه باید آنلاین باشید');
        return;
      }
      const sheet = sheetRaw as SheetPin | null;
      if (sheet && sheet.hash) {
        await adoptSheetPin(sheet);
        const v = await verifyPin(pin);
        if (v.ok) {
          Alert.alert('✅ ورود موفق', 'این دستگاه توسط مدیر اصلی تنظیم شده. رمز شما درست بود.');
          setPin(''); setConfirm('');
          await refresh();
        } else {
          setError('این دستگاه توسط مدیر اصلی رمزگذاری شده. رمز او را وارد کنید.');
        }
        return;
      }
      const cfg = await createLocalPin(pin, true);
      if (!cfg) { setError('خطا در ذخیره'); return; }
      const pushed = await pushPinToSheet({ salt: cfg.salt, hash: cfg.hash, setAt: cfg.setAt, v: cfg.v, isOwner: true });
      const v = await verifyPin(pin);
      if (v.ok) {
        Alert.alert(
          '✅ رمز ثبت شد',
          pushed
            ? 'شما دستگاه اصلی هستید. رمز به شیت منتقل شد.'
            : 'رمز روی دستگاه ذخیره شد. با اولین سینک به شیت منتقل می‌شود.'
        );
        setPin(''); setConfirm('');
        await refresh();
      } else {
        setError('ثبت شد ولی تأیید نشد');
      }
    } catch (e: any) {
      setError(e?.message || 'خطای غیرمنتظره');
    } finally {
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    setError('');
    if (!/^\d{6}$/.test(pin)) { setError('رمز باید ۶ رقم باشد'); return; }
    setBusy(true);
    try {
      const local = await readConfig();
      if (local && !local.isOwner) {
        const sheetRaw = await pullPinFromSheet();
        const sheet = sheetRaw as SheetPin | null | undefined;
        if (sheet && sheet.hash && sheet.hash !== local.hash) {
          await adoptSheetPin(sheet);
          setBusy(false);
          setError('رمز توسط دستگاه اصلی تغییر کرده. لطفاً رمز جدید را وارد کنید.');
          setPin('');
          return;
        }
      }
      const r = await verifyPin(pin);
      if (r.ok) { setPin(''); setMode('unlocked'); }
      else {
        setError(r.error || 'خطا');
        if (r.lockedUntil) setLockedUntil(r.lockedUntil);
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  const onChangePinSubmit = async () => {
    setSError('');
    if (!isOwner) { setSError('فقط دستگاه اصلی می‌تواند رمز را عوض کند'); return; }
    if (!/^\d{6}$/.test(sOld)) { setSError('رمز فعلی باید ۶ رقم باشد'); return; }
    if (!/^\d{6}$/.test(sNew)) { setSError('رمز جدید باید ۶ رقم باشد'); return; }
    if (sNew !== sConfirm) { setSError('تکرار رمز جدید یکی نیست'); return; }
    setSBusy(true);
    try {
      const local = await readConfig();
      if (!local) { setSError('رمز تنظیم نشده'); return; }
      const oldHash = simpleHash(local.salt + ':' + sOld.trim());
      if (oldHash !== local.hash) { setSError('رمز فعلی اشتباه'); return; }
      const cfg = await createLocalPin(sNew, local.isOwner);
      if (!cfg) { setSError('خطا در ذخیره'); return; }
      const pushed = await pushPinToSheet({ salt: cfg.salt, hash: cfg.hash, setAt: cfg.setAt, v: cfg.v, isOwner: cfg.isOwner });
      Alert.alert(
        '✅ موفق',
        pushed
          ? 'رمز تغییر کرد و به شیت منتقل شد. دستگاه‌های دیگر با اولین همگام‌سازی، رمز جدید را می‌گیرند.'
          : 'رمز تغییر کرد. با اولین سینک به شیت منتقل می‌شود.'
      );
      setShowSettings(false);
      setSOld(''); setSNew(''); setSConfirm('');
    } catch (e: any) {
      setSError(e?.message || 'خطای غیرمنتظره');
    } finally {
      setSBusy(false);
    }
  };

  const onResetPin = () => {
    if (!isOwner) { setSError('فقط دستگاه اصلی می‌تواند رمز را حذف کند'); return; }
    Alert.alert(
      '⚠️ حذف رمز',
      'رمز از این دستگاه و شیت حذف می‌شود. سایر دستگاه‌ها هم باید دوباره رمز تعیین کنند. مطمئنید؟',
      [
        { text: 'لغو', style: 'cancel' },
        { text: 'حذف رمز', style: 'destructive', onPress: async () => {
          await clearLocalPin();
          await deletePinFromSheet();
          setShowSettings(false);
          setSOld(''); setSNew(''); setSConfirm(''); setSError('');
          setPin(''); setConfirm(''); setError('');
          await refresh();
        }},
      ]
    );
  };

  if (mode === 'unlocked') {
    return (
      <>
        {children}
        <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
          <View style={st.modalBackdrop}>
            <View style={st.modalCard}>
              <Text style={st.modalTitle}>⚙️ تنظیمات رمز قفل</Text>
              {isOwner ? (
                <>
                  <Text style={st.modalSub}>رمز فعلی را وارد کنید و رمز جدید بگذارید</Text>

                  <Text style={st.modalLbl}>رمز فعلی</Text>
                  <TextInput value={sOld} onChangeText={(v) => setSOld(v.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="۶ رقم" placeholderTextColor="#64748b" keyboardType="number-pad" secureTextEntry maxLength={6} style={st.modalInp} editable={!sBusy} />

                  <Text style={st.modalLbl}>رمز جدید</Text>
                  <TextInput value={sNew} onChangeText={(v) => setSNew(v.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="۶ رقم" placeholderTextColor="#64748b" keyboardType="number-pad" secureTextEntry maxLength={6} style={st.modalInp} editable={!sBusy} />

                  <Text style={st.modalLbl}>تکرار رمز جدید</Text>
                  <TextInput value={sConfirm} onChangeText={(v) => setSConfirm(v.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="۶ رقم" placeholderTextColor="#64748b" keyboardType="number-pad" secureTextEntry maxLength={6} style={st.modalInp} editable={!sBusy} />

                  {sError ? <Text style={st.err}>{sError}</Text> : null}

                  <TouchableOpacity style={[st.btn, sBusy && { opacity: 0.5 }]} disabled={sBusy} onPress={onChangePinSubmit}>
                    <Text style={st.btnTxt}>{sBusy ? 'صبر...' : '💾 تغییر رمز'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[st.btnDanger]} onPress={onResetPin}>
                    <Text style={st.btnTxt}>🗑️ حذف رمز</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={st.modalSub}>🔒 این دستگاه توسط دستگاه اصلی مدیریت می‌شود</Text>
                  <View style={st.infoBox}>
                    <Text style={st.infoTxt}>رمز قفل توسط دستگاه اصلی تنظیم شده است.</Text>
                    <Text style={st.infoTxt}>برای تغییر یا حذف رمز، از دستگاه اصلی استفاده کنید.</Text>
                    <Text style={st.infoTxt}>در صورت تغییر رمز توسط دستگاه اصلی، رمز جدید به‌طور خودکار در این دستگاه اعمال می‌شود.</Text>
                  </View>
                </>
              )}

              <TouchableOpacity style={st.linkBtn} onPress={() => { setShowSettings(false); setSOld(''); setSNew(''); setSConfirm(''); setSError(''); }}>
                <Text style={st.linkTxt}>بستن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  if (mode === 'loading') return <View style={st.loadingWrap}><ActivityIndicator color="#0891b2" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.container}>
      <View style={st.card}>
        <Text style={st.icon}>{mode === 'setup' ? '🔐' : '🔒'}</Text>
        <Text style={st.title}>{mode === 'setup' ? 'تعیین رمز قفل' : 'ورود به بخش محافظت‌شده'}</Text>
        <Text style={st.sub}>
          {mode === 'setup'
            ? 'رمز ۶ رقمی انتخاب کنید. اگر دستگاه دیگری از قبل رمز تعیین کرده، همان رمز او را وارد کنید.'
            : 'برای مشاهده این بخش رمز ۶ رقمی را وارد کنید'}
        </Text>

        {lockedUntil > 0 && remaining > 0 ? (
          <View style={st.lockBox}>
            <Text style={st.lockTxt}>🔒 قفل موقت — {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} باقی مانده</Text>
          </View>
        ) : null}

        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="رمز ۶ رقمی"
          placeholderTextColor="#64748b"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          style={st.input}
          editable={!busy && !(lockedUntil > 0)}
        />

        {mode === 'setup' ? (
          <TextInput
            value={confirm}
            onChangeText={(v) => setConfirm(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="تکرار رمز"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={st.input}
            editable={!busy}
          />
        ) : null}

        {error ? <Text style={st.err}>{error}</Text> : null}

        <TouchableOpacity
          style={[st.btn, (busy || (lockedUntil > 0)) && { opacity: 0.5 }]}
          disabled={busy || (lockedUntil > 0)}
          onPress={mode === 'setup' ? onSetup : onUnlock}
        >
          <Text style={st.btnTxt}>{busy ? 'لطفاً صبر کنید...' : (mode === 'setup' ? 'ثبت رمز' : 'ورود')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a1628' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a1628', padding: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#0f172a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1e3a5f' },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  sub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, textAlign: 'center', backgroundColor: '#020617', color: '#fff', letterSpacing: 8, marginBottom: 10 },
  err: { color: '#f87171', fontSize: 12, textAlign: 'center', marginVertical: 6 },
  btn: { backgroundColor: '#0891b2', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnDanger: { backgroundColor: '#7f1d1d', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  lockBox: { backgroundColor: '#7f1d1d', padding: 10, borderRadius: 8, marginBottom: 10 },
  lockTxt: { color: '#fecaca', fontSize: 12, textAlign: 'center', fontWeight: 'bold' },
  linkBtn: { marginTop: 12, alignItems: 'center' },
  linkTxt: { color: '#64748b', fontSize: 11, textDecorationLine: 'underline' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1e3a5f' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  modalSub: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginBottom: 12 },
  modalLbl: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 4, marginTop: 6 },
  modalInp: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, textAlign: 'center', backgroundColor: '#020617', color: '#fff', letterSpacing: 6 },
  infoBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10, marginVertical: 8 },
  infoTxt: { color: '#cbd5e1', fontSize: 12, textAlign: 'right', marginBottom: 6, lineHeight: 18 },
});
