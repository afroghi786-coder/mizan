// AdminPanel.tsx — پنل ادمین کامل با ۳ تب
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';;
import { supabaseAdmin as supabase } from './lib.supabase.admin';

const DURATIONS = [
  { k: '1h', l: '🕐 ۱ ساعت', interval: '1 hour', days: 1/24, hours: 1 },
  { k: '6h', l: '🕕 ۶ ساعت', interval: '6 hours', days: 6/24, hours: 6 },
  { k: '12h', l: '🕛 ۱۲ ساعت', interval: '12 hours', days: 12/24, hours: 12 },
  { k: '1d', l: '📅 ۱ روز', interval: '1 day', days: 1, hours: 24 },
  { k: '10d', l: '📅 ۱۰ روز', interval: '10 days', days: 10, hours: 240 },
  { k: '1m', l: '📅 ۱ ماه', interval: '30 days', days: 30, hours: 720 },
  { k: '3m', l: '📅 ۳ ماه', interval: '90 days', days: 90, hours: 2160 },
  { k: '6m', l: '📅 ۶ ماه', interval: '180 days', days: 180, hours: 4320 },
  { k: '1y', l: '📅 ۱ سال', interval: '365 days', days: 365, hours: 8760 },
];

export default function AdminPanel({ showToast }: any) {
  const [email, setEmail] = useState('');

  // __adminAuthV1__ — Auth State
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [trialHours, setTrialHours] = useState(168);
  const [trialHoursInput, setTrialHoursInput] = useState('168');
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialMsg, setTrialMsg] = useState('');
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminLoading, setNewAdminLoading] = useState(false);
  const [newAdminError, setNewAdminError] = useState('');
  const [myOldPass, setMyOldPass] = useState('');
  const [myNewPass, setMyNewPass] = useState('');
  const [myPassLoading, setMyPassLoading] = useState(false);
  const [myPassMsg, setMyPassMsg] = useState('');

  useEffect(() => {
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      if (!sb) { setAuthReady(true); return; }

      const checkAdmin = async (email: string) => {
        if (!email) { setIsAdmin(false); return; }
        try {
          const { data } = await sb.from('admin_users').select('email').eq('email', email).maybeSingle();
          setIsAdmin(!!data);
        } catch { setIsAdmin(false); }
      };

      sb.auth.getSession().then(async ({ data }: any) => {
        setSession(data?.session || null);
        await checkAdmin(data?.session?.user?.email || '');
        setAuthReady(true);
      });
      const { data: sub } = sb.auth.onAuthStateChange(async (_e: any, sess: any) => {
        setSession(sess);
        await checkAdmin(sess?.user?.email || '');
      });
      return () => { try { sub?.subscription?.unsubscribe?.(); } catch {} };
    } catch (e) {
      console.log('auth effect err:', e);
      setAuthReady(true);
    }
  }, []);

  const doLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError('ایمیل و رمز را وارد کن');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { error } = await sb.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
    } catch (e: any) {
      setLoginError(e?.message || 'خطا در ورود');
    } finally {
      setLoginLoading(false);
    }
  };

  const loadTrialHours = async () => {
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { data, error } = await sb.rpc('admin_get_trial_hours');
      if (error) throw error;
      const h = Number(data) || 168;
      setTrialHours(h);
      setTrialHoursInput(String(h));
    } catch (e) { console.log('loadTrialHours err:', e); }
  };

  const saveTrialHours = async () => {
    const h = parseInt(trialHoursInput, 10);
    if (!h || h < 1 || h > 8760) {
      setTrialMsg('❌ عدد باید بین ۱ تا ۸۷۶۰ ساعت باشد');
      return;
    }
    setTrialLoading(true);
    setTrialMsg('');
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { error } = await sb.rpc('admin_set_trial_hours', { p_hours: h });
      if (error) throw error;
      setTrialHours(h);
      setTrialMsg('✅ ذخیره شد — از این به بعد کاربران جدید ' + h + ' ساعت trial می‌گیرند');
    } catch (e: any) {
      setTrialMsg('❌ ' + (e?.message || 'خطا'));
    } finally {
      setTrialLoading(false);
    }
  };

  const presetTrial = (h: number) => {
    setTrialHoursInput(String(h));
    setTrialMsg('');
  };

  const doChangePassword = async () => {
    if (!passInput || passInput.length < 6) {
      setPassError('رمز باید حداقل ۶ کاراکتر باشد');
      return;
    }
    setPassLoading(true);
    setPassError('');
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { error } = await sb.rpc('admin_set_user_password', {
        p_email: passEmail,
        p_new_password: passInput,
      });
      if (error) throw error;
      setPassSuccess(true);
      setTimeout(() => {
        setPassModal(false);
        setPassSuccess(false);
        setPassInput('');
      }, 2000);
    } catch (e: any) {
      setPassError(e?.message || 'خطا');
    } finally {
      setPassLoading(false);
    }
  };

  const openPassModal = (email: string) => {
    setPassEmail(email);
    setPassInput('');
    setPassError('');
    setPassSuccess(false);
    setPassModal(true);
  };

  const loadAdmins = async () => {
    setAdminsLoading(true);
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { data } = await sb.from('admin_users').select('*').order('created_at', { ascending: false });
      setAdmins(data || []);
    } catch (e) { console.log(e); }
    finally { setAdminsLoading(false); }
  };

  const doAddAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword) {
      setNewAdminError('ایمیل و رمز را وارد کنید');
      return;
    }
    if (newAdminPassword.length < 6) {
      setNewAdminError('رمز باید حداقل ۶ کاراکتر باشد');
      return;
    }
    setNewAdminLoading(true);
    setNewAdminError('');
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { data: { session: savedSession } } = await sb.auth.getSession();

      const { data: existing } = await sb.from('admin_users').select('email').eq('email', newAdminEmail).maybeSingle();
      if (existing) {
        setNewAdminError('این ایمیل از قبل ادمین است');
        setNewAdminLoading(false);
        return;
      }

      const { error: signErr } = await sb.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
        options: { data: { full_name: newAdminName || newAdminEmail.split('@')[0] } }
      });
      if (signErr) {
        setNewAdminError('خطا در ایجاد کاربر: ' + signErr.message);
        setNewAdminLoading(false);
        return;
      }

      if (savedSession) {
        try {
          await sb.auth.setSession({ access_token: savedSession.access_token, refresh_token: savedSession.refresh_token });
        } catch {}
      }

      const { error: insErr } = await sb.from('admin_users').insert({
        email: newAdminEmail,
        full_name: newAdminName || newAdminEmail.split('@')[0]
      });
      if (insErr) {
        setNewAdminError('خطا در افزودن: ' + insErr.message);
        setNewAdminLoading(false);
        return;
      }

      setNewAdminEmail(''); setNewAdminPassword(''); setNewAdminName('');
      await loadAdmins();
      if (typeof window !== 'undefined') {
        window.alert('✅ ادمین جدید اضافه شد!\n\nایمیل: ' + newAdminEmail + '\n\n⚠️ اگر تأیید ایمیل فعال است، کاربر باید اول ایمیلش را تأیید کند.');
      }
    } catch (e: any) {
      setNewAdminError(e?.message || 'خطا');
    } finally {
      setNewAdminLoading(false);
    }
  };

  const doRemoveAdmin = async (email: string) => {
    if (email === userEmail) {
      alert('نمی‌توانید خودتان را حذف کنید');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('حذف ادمین: ' + email + '؟')) return;
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { error } = await sb.from('admin_users').delete().eq('email', email);
      if (error) { alert('خطا: ' + error.message); return; }
      await loadAdmins();
    } catch (e: any) { alert('خطا: ' + (e?.message || '')); }
  };

  const doChangeMyPassword = async () => {
    if (!myOldPass || !myNewPass) {
      setMyPassMsg('هر دو فیلد را پر کنید');
      return;
    }
    if (myNewPass.length < 6) {
      setMyPassMsg('رمز جدید حداقل ۶ کاراکتر');
      return;
    }
    setMyPassLoading(true);
    setMyPassMsg('');
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      const { error: verifyErr } = await sb.auth.signInWithPassword({ email: userEmail, password: myOldPass });
      if (verifyErr) { setMyPassMsg('❌ رمز قدیمی اشتباه است'); setMyPassLoading(false); return; }

      const { error: updErr } = await sb.auth.updateUser({ password: myNewPass });
      if (updErr) { setMyPassMsg('❌ ' + updErr.message); setMyPassLoading(false); return; }

      setMyPassMsg('✅ رمز عبور با موفقیت تغییر کرد');
      setMyOldPass(''); setMyNewPass('');
    } catch (e: any) {
      setMyPassMsg('❌ ' + (e?.message || 'خطا'));
    } finally {
      setMyPassLoading(false);
    }
  };

  const doLogout = async () => {
    try {
      const sb = (require('./lib.supabase.admin') as any).supabaseAdmin;
      await sb.auth.signOut();
      setSession(null);
    } catch (e) {
      console.log('logout err:', e);
    }
  };

  const [duration, setDuration] = useState('1m');
  const [extend, setExtend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [tab, setTab] = useState<'issue' | 'requests' | 'list' | 'admins'>('issue');
  const [listSearch, setListSearch] = useState('');
  const [passModal, setPassModal] = useState(false);
  const [passEmail, setPassEmail] = useState('');
  const [passInput, setPassInput] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');

  // ═══ بارگذاری درخواست‌ها ═══
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data } = await supabase
        .from('license_requests')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);
      setRequests(data || []);
    } catch (e) { console.log(e); }
    finally { setRequestsLoading(false); }
  };

  // ═══ بارگذاری لیست لایسنس‌ها ═══
  const loadList = async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_licenses_full');
      if (error) {
        console.log('RPC error:', error);
        // fallback
        const { data: fallback } = await supabase
          .from('licenses')
          .select('user_id, plan, status, expires_at, last_payment_at')
          .order('last_payment_at', { ascending: false })
          .limit(50);
        setList(fallback || []);
      } else {
        setList(data || []);
      }
    } catch (e) { console.log(e); }
    finally { setListLoading(false); }
  };

  useEffect(() => {
    // 📊 هر وقت session تغییر کرد، داده‌ها رو دوباره لود کن
    if (session) {
      loadList();
      loadRequests();
      loadAdmins();
      loadTrialHours();
    }
  }, [session]);

  // ═══ صدور لایسنس ═══
  const saveLicense = async (userId: string, dur: string, ext: boolean) => {
    const info = DURATIONS.find(d => d.k === dur);
    if (!info) throw new Error('مدت نامعتبر');

    const { data: existing } = await supabase
      .from('licenses')
      .select('user_id, expires_at')
      .eq('user_id', userId)
      .limit(1);

    const hours = (info as any).hours || (info.days * 24);

    if (existing && existing[0]) {
      // تمدید با RPC ساعت‌ها
      const { error } = await supabase.rpc('extend_license_hours', {
        p_user_id: userId,
        p_hours: hours,
        p_from_now: !ext,
      });
      if (error) {
        console.log('extend_license_hours error:', error);
        throw error;
      }
    } else {
      // ایجاد لایسنس جدید
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { error: insErr } = await supabase.from('licenses').insert({
        user_id: userId,
        plan: info.k,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
        last_payment_at: new Date().toISOString(),
      });
      if (insErr) {
        console.log('insert license error:', insErr);
        throw insErr;
      }
    }
  };

  // ═══ صدور دستی ═══
  const issue = async () => {
    if (!email.trim() || !email.includes('@')) return showToast('ایمیل معتبر وارد کن', true);
    setLoading(true);
    try {
      const { data: uid, error } = await supabase.rpc('get_user_id_by_email', {
        user_email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      if (!uid) throw new Error('کاربر با این ایمیل پیدا نشد');
      await saveLicense(uid, duration, extend);
      showToast('✅ لایسنس صادر شد');
      setEmail('');
      loadList();
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    } finally { setLoading(false); }
  };

  // ═══ تأیید درخواست ═══
  const approveRequest = async (req: any) => {
    try {
      await saveLicense(req.user_id, '1m', false);
      await supabase.from('licenses').update({
        notification_pending: true,
        notification_message: 'درخواست شما تأیید شد — ۱ ماه اشتراک فعال گردید',
        notification_plan: '1m',
        notification_at: new Date().toISOString(),
      }).eq('user_id', req.user_id);
      await supabase.from('license_requests')
        .update({ status: 'approved', handled_at: new Date().toISOString() })
        .eq('id', req.id);
      showToast('✅ لایسنس ۱ ماه صادر شد');
      loadRequests();
      loadList();
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    }
  };

  // ═══ رد درخواست ═══
  const rejectRequest = async (req: any) => {
    try {
      await supabase.from('license_requests')
        .update({ status: 'rejected', handled_at: new Date().toISOString() })
        .eq('id', req.id);
      showToast('❌ رد شد');
      loadRequests();
    } catch (e: any) {
      showToast(e?.message || 'خطا', true);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  // __adminOnlyEmails__ — Admin check
  const userEmail = session?.user?.email || '';

  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={{ color: '#fff', fontSize: 14, marginTop: 12 }}>در حال بررسی...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: '#0a1628', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#0f2438', borderRadius: 16, padding: 24, maxWidth: 400, alignSelf: 'center', width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>👑 پنل ادمین</Text>
          <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>برای دسترسی، وارد شوید</Text>

          <Text style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 6, textAlign: 'right' }}>📧 ایمیل:</Text>
          <TextInput
            style={{ backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 14 }}
            value={loginEmail}
            onChangeText={(t) => { setLoginEmail(t); setLoginError(''); }}
            placeholder="admin@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 6, textAlign: 'right' }}>🔑 رمز عبور:</Text>
          <TextInput
            style={{ backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 14 }}
            value={loginPassword}
            onChangeText={(t) => { setLoginPassword(t); setLoginError(''); }}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
          />

          {loginError ? (
            <Text style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>❌ {loginError}</Text>
          ) : null}

          <TouchableOpacity
            onPress={doLogin}
            disabled={loginLoading}
            style={{ backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
              {loginLoading ? 'در حال ورود...' : '🔓 ورود'}
            </Text>
          </TouchableOpacity>

          <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
            فقط ادمین‌های مجاز می‌توانند وارد شوند
          </Text>
        </View>
      </ScrollView>
    );
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#0f2438', borderRadius: 16, padding: 24, maxWidth: 400, alignSelf: 'center', width: '100%' }}>
          <Text style={{ color: '#ef4444', fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🚫</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>دسترسی ندارید</Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>این پنل فقط برای ادمین‌های مجاز است</Text>
          <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>ایمیل شما: {userEmail}</Text>
          <TouchableOpacity
            onPress={doLogout}
            style={{ backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>🚪 خروج</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  
  // ─── Filtered lists (live search) ───
  const norm = (t: any) => String(t || '').toLowerCase().trim();
  const _q1 = norm(listSearch);
  const filteredList = !_q1 ? list : list.filter((x: any) => 
    norm(x.full_name).includes(_q1) ||
    norm(x.email).includes(_q1) ||
    norm(x.phone).includes(_q1) ||
    norm(x.plan).includes(_q1)
  );
  const _q2 = norm(requestSearch);
  const filteredRequests = !_q2 ? requests : requests.filter((x: any) =>
    norm(x.full_name).includes(_q2) ||
    norm(x.email).includes(_q2) ||
    norm(x.phone).includes(_q2) ||
    norm(x.message).includes(_q2)
  );

  // __mainReturn__ — پنل اصلی
  
  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* __adminLogoutAdded__ — Logout Button */}
      <TouchableOpacity
        onPress={doLogout}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: '#dc2626',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 10,
          zIndex: 99999,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          elevation: 8,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 16 }}>🚪</Text>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>خروج</Text>
      </TouchableOpacity>
      <View style={{ height: 10 }} />

      <Text style={s.title}>🔐 پنل ادمین</Text>
      <Text style={s.sub}>مدیریت لایسنس‌ها و درخواست‌ها</Text>

      {/* تب‌ها */}
      <View style={s.tabsRow}>
        <TouchableOpacity accessibilityLabel="صدور" onPress={() => setTab('issue')} style={[s.tab, tab === 'issue' && s.tabActive]}>
          <Text style={[s.tabTxt, tab === 'issue' && s.tabTxtActive]}>✅ صدور</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="درخواست‌ها" onPress={() => setTab('requests')} style={[s.tab, tab === 'requests' && s.tabActive]}>
          <Text style={[s.tabTxt, tab === 'requests' && s.tabTxtActive]}>
            📩 درخواست‌ها{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="لیست" onPress={() => setTab('list')} style={[s.tab, tab === 'list' && s.tabActive]}>
          <Text style={[s.tabTxt, tab === 'list' && s.tabTxtActive]}>📋 لیست</Text>
        </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="ادمین‌ها" onPress={() => setTab('admins')} style={[s.tab, tab === 'admins' && s.tabActive]}>
            <Text style={[s.tabTxt, tab === 'admins' && s.tabTxtActive]}>👥 ادمین‌ها</Text>
          </TouchableOpacity>
      </View>

      {/* ═══ تب صدور ═══ */}
      {tab === 'issue' && (
        <View style={s.card}>
          <Text style={s.lbl}>📧 ایمیل کاربر</Text>
          <TextInput accessibilityLabel="user@example.com"
            style={s.inp}
            value={email}
            onChangeText={setEmail}
            placeholder="user@example.com"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={s.lbl}>⏱️ مدت لایسنس</Text>
          <View style={s.chipsWrap}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d.k} onPress={() => setDuration(d.k)} style={[s.chip, duration === d.k && s.chipActive]}>
                <Text style={[s.chipTxt, duration === d.k && s.chipTxtActive]}>{d.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity accessibilityLabel="مدت جدید به انقضای فعلی اضافه شود" style={s.checkboxRow} onPress={() => setExtend(!extend)}>
            <Text style={s.checkbox}>{extend ? '☑️' : '⬜'}</Text>
            <Text style={s.checkboxLbl}>مدت جدید به انقضای فعلی اضافه شود (تمدید)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={issue} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ صدور لایسنس</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ تب درخواست‌ها ═══ */}
      {tab === 'requests' && (
        <View>
          <TouchableOpacity accessibilityLabel="بروزرسانی" style={[s.btn, { backgroundColor: '#334155', marginBottom: 12 }]} onPress={loadRequests}>
            <Text style={s.btnTxt}>🔄 بروزرسانی</Text>
          </TouchableOpacity>
          {/* Search */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#cbd5e1' }}>
            <Text style={{ color: '#64748b', fontSize: 16, marginLeft: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, color: '#0f2438', fontSize: 14, paddingVertical: 10, textAlign: 'right' }}
              value={requestSearch}
              onChangeText={setRequestSearch}
              placeholder="جستجو: نام، ایمیل، شماره..."
              placeholderTextColor="#94a3b8"
            />
            {requestSearch ? (
              <TouchableOpacity onPress={() => setRequestSearch('')} style={{ padding: 6 }}>
                <Text style={{ color: '#ef4444', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {requestsLoading ? <ActivityIndicator color="#d4af37" /> : filteredRequests.length === 0 ? (
            <Text style={s.empty}>{requestSearch ? '🔍 نتیجه‌ای پیدا نشد' : '📭 درخواستی وجود ندارد'}</Text>
          ) : filteredRequests.map((r, i) => {
            const isPending = r.status === 'pending';
            const isApproved = r.status === 'approved';
            return (
              <View key={i} style={[s.reqCard, isPending && { borderColor: '#f59e0b', borderWidth: 2 }]}>
                <View style={s.reqHeader}>
                  <Text style={[s.reqBadge,
                    isPending && { backgroundColor: '#fef3c7', color: '#78350f' },
                    isApproved && { backgroundColor: '#d1fae5', color: '#065f46' },
                    !isPending && !isApproved && { backgroundColor: '#fee2e2', color: '#991b1b' }
                  ]}>
                    {isPending ? '⏳ در انتظار' : isApproved ? '✅ تأیید شده' : '❌ رد شده'}
                  </Text>
                  <Text style={s.reqDate}>
                    {r.requested_at ? new Date(r.requested_at).toLocaleDateString('fa-IR') : ''}
                  </Text>
                </View>

                <Text style={s.reqRow}>📧 <Text style={s.reqBold}>{r.email}</Text></Text>
                <Text style={s.reqRow}>👤 {r.full_name}</Text>
                <Text style={s.reqRow}>📞 {r.phone}</Text>
                {r.message ? <Text style={s.reqRow}>💬 {r.message}</Text> : null}

                {isPending && (
                  <View style={s.reqActions}>
                    <TouchableOpacity accessibilityLabel="رد" style={[s.reqBtn, { backgroundColor: '#dc2626' }]} onPress={() => rejectRequest(r)}>
                      <Text style={s.reqBtnTxt}>❌ رد</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="تأیید" style={[s.reqBtn, { backgroundColor: '#059669', flex: 2 }]} onPress={() => approveRequest(r)}>
                      <Text style={s.reqBtnTxt}>✅ تأیید + صدور ۱ ماه</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ═══ تب لیست ═══ */}
      {tab === 'list' && (
        <View>
          <TouchableOpacity accessibilityLabel="بروزرسانی" style={[s.btn, { backgroundColor: '#334155', marginBottom: 12 }]} onPress={loadList}>
            <Text style={s.btnTxt}>🔄 بروزرسانی</Text>
          </TouchableOpacity>

          {/* Search */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#cbd5e1' }}>
            <Text style={{ color: '#64748b', fontSize: 16, marginLeft: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, color: '#0f2438', fontSize: 14, paddingVertical: 10, textAlign: 'right' }}
              value={listSearch}
              onChangeText={setListSearch}
              placeholder="جستجو: نام، ایمیل، شماره، طرح..."
              placeholderTextColor="#94a3b8"
            />
            {listSearch ? (
              <TouchableOpacity onPress={() => setListSearch('')} style={{ padding: 6 }}>
                <Text style={{ color: '#ef4444', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {listLoading ? <ActivityIndicator color="#d4af37" /> : filteredList.length === 0 ? (
            <Text style={s.empty}>{listSearch ? '🔍 نتیجه‌ای پیدا نشد' : '📭 هیچ لایسنس‌ای نیست'}</Text>
          ) : (
            <View>
              {/* Header Row */}
              <View style={{ flexDirection: 'row-reverse', backgroundColor: '#e0e7ff', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#c7d2fe' }}>
                <Text style={{ flex: 2, color: '#3730a3', fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>👤 نام</Text>
                <Text style={{ flex: 2, color: '#3730a3', fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>📧 ایمیل</Text>
                <Text style={{ flex: 1.5, color: '#3730a3', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>📞 شماره</Text>
                <Text style={{ flex: 1, color: '#3730a3', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>وضعیت</Text>
              </View>

              {filteredList.map((l: any, i: number) => {
                const exp = l.expires_at ? new Date(l.expires_at) : null;
                const diffMs = exp ? exp.getTime() - Date.now() : 0;
                const hoursLeft = Math.floor(diffMs / (3600 * 1000));
                const daysLeft = Math.floor(hoursLeft / 24);
                const active = hoursLeft > 0 && l.status === 'active';
                return (
                  <View key={i} style={{ flexDirection: 'row-reverse', backgroundColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: active ? '#a7f3d0' : '#fecaca', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                    <Text style={{ flex: 2, color: '#0f2438', fontSize: 12, fontWeight: '600', textAlign: 'right' }} numberOfLines={1}>
                      {l.full_name || '—'}
                    </Text>
                    <Text style={{ flex: 2, color: '#475569', fontSize: 11, textAlign: 'right' }} numberOfLines={1}>
                      {l.email || '—'}
                    </Text>
                    <Text style={{ flex: 1.5, color: '#475569', fontSize: 11, textAlign: 'center' }} numberOfLines={1}>
                      {l.phone || '—'}
                    </Text>
                    
                    {/* دکمه بازیابی رمز */}
                    <TouchableOpacity onPress={() => openPassModal(l.email)} style={{ padding: 6, marginLeft: 4 }}>
                      <Text style={{ fontSize: 16 }}>🔑</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: active ? '#059669' : '#dc2626', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>
                        {active ? (hoursLeft >= 24 ? `✅ ${daysLeft} روز` : `✅ ${hoursLeft} ساعت`) : '❌ منقضی'}
                      </Text>
                      <Text style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center', marginTop: 2 }}>
                        {l.plan || '—'}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                نمایش {filteredList.length} از {list.length} کاربر
              </Text>
            </View>
          )}
        </View>
      )}
    
      {tab === 'admins' && (
        <View>
          {/* لیست ادمین‌ها */}
          <Text style={{ color: '#0f2438', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'right' }}>👥 ادمین‌های فعلی</Text>

          {adminsLoading ? <ActivityIndicator color="#d4af37" /> : admins.length === 0 ? (
            <Text style={s.empty}>ادمینی نیست</Text>
          ) : (
            admins.map((a: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#0f2438', fontSize: 13, fontWeight: 'bold', textAlign: 'right' }}>{a.full_name || '—'}</Text>
                  <Text style={{ color: '#475569', fontSize: 11, textAlign: 'right', marginTop: 2 }}>{a.email}</Text>
                </View>
                {a.email === userEmail ? (
                  <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold' }}>👑 شما</Text>
                ) : (
                  <TouchableOpacity onPress={() => doRemoveAdmin(a.email)} style={{ backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>🗑 حذف</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          <TouchableOpacity onPress={loadAdmins} style={{ backgroundColor: '#334155', padding: 10, borderRadius: 8, marginTop: 8, marginBottom: 20 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>🔄 بروزرسانی لیست</Text>
          </TouchableOpacity>

          {/* اضافه ادمین جدید */}
          <View style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}>
            <Text style={{ color: '#0f2438', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'right' }}>➕ افزودن ادمین جدید</Text>

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 4, textAlign: 'right' }}>📧 ایمیل:</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, textAlign: 'left' }}
              value={newAdminEmail}
              onChangeText={setNewAdminEmail}
              placeholder="admin@example.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 4, textAlign: 'right' }}>👤 نام (اختیاری):</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, textAlign: 'right' }}
              value={newAdminName}
              onChangeText={setNewAdminName}
              placeholder="مثلاً: احمد رضایی"
              placeholderTextColor="#94a3b8"
            />

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 4, textAlign: 'right' }}>🔑 رمز عبور (حداقل ۶ کاراکتر):</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, textAlign: 'left' }}
              value={newAdminPassword}
              onChangeText={setNewAdminPassword}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />

            {newAdminError ? <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{newAdminError}</Text> : null}

            <TouchableOpacity onPress={doAddAdmin} disabled={newAdminLoading} style={{ backgroundColor: '#7c3aed', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
                {newAdminLoading ? 'در حال ایجاد...' : '➕ افزودن ادمین'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ═══ تنظیم Trial برای کاربران جدید ═══ */}
          <View style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 10, borderWidth: 2, borderColor: '#7c3aed', marginBottom: 16 }}>
            <Text style={{ color: '#0f2438', fontSize: 15, fontWeight: 'bold', marginBottom: 6, textAlign: 'right' }}>🎁 مدت Trial کاربران جدید</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 12, textAlign: 'right' }}>
              الان: <Text style={{ color: '#7c3aed', fontWeight: 'bold' }}>{trialHours} ساعت</Text>
              {' '}({Math.round(trialHours / 24 * 10) / 10} روز)
            </Text>

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 6, textAlign: 'right' }}>⚡ انتخاب سریع:</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[
                { h: 1, l: '۱ ساعت' },
                { h: 6, l: '۶ ساعت' },
                { h: 12, l: '۱۲ ساعت' },
                { h: 24, l: '۱ روز' },
                { h: 48, l: '۲ روز' },
                { h: 72, l: '۳ روز' },
                { h: 168, l: '۷ روز' },
                { h: 336, l: '۱۴ روز' },
                { h: 720, l: '۳۰ روز' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.h}
                  onPress={() => presetTrial(p.h)}
                  style={{
                    backgroundColor: parseInt(trialHoursInput) === p.h ? '#7c3aed' : '#e2e8f0',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{
                    color: parseInt(trialHoursInput) === p.h ? '#fff' : '#0f2438',
                    fontSize: 12,
                    fontWeight: 'bold',
                  }}>{p.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 6, textAlign: 'right' }}>🕐 یا ساعت دلخواه (۱ تا ۸۷۶۰):</Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: '#f8fafc', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'center' }}
                value={trialHoursInput}
                onChangeText={(t) => { setTrialHoursInput(t.replace(/[^0-9]/g, '')); setTrialMsg(''); }}
                placeholder="مثلاً 168"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
              />
              <Text style={{ color: '#475569', fontSize: 14 }}>ساعت</Text>
            </View>

            {trialMsg ? (
              <Text style={{ color: trialMsg.includes('✅') ? '#059669' : '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{trialMsg}</Text>
            ) : null}

            <TouchableOpacity
              onPress={saveTrialHours}
              disabled={trialLoading}
              style={{ backgroundColor: '#7c3aed', padding: 12, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
                {trialLoading ? 'در حال ذخیره...' : '💾 ذخیره Trial'}
              </Text>
            </TouchableOpacity>

            <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 8, textAlign: 'center' }}>
              ⚠️ فقط کاربران جدید — کاربران فعلی تغییری نمی‌کنند
            </Text>
          </View>

          {/* تغییر رمز خودم */}
          <View style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#0f2438', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'right' }}>🔐 تغییر رمز خودم</Text>

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 4, textAlign: 'right' }}>رمز فعلی:</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, textAlign: 'left' }}
              value={myOldPass}
              onChangeText={setMyOldPass}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />

            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 4, textAlign: 'right' }}>رمز جدید:</Text>
            <TextInput
              style={{ backgroundColor: '#f8fafc', color: '#0f2438', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, textAlign: 'left' }}
              value={myNewPass}
              onChangeText={setMyNewPass}
              placeholder="حداقل ۶ کاراکتر"
              placeholderTextColor="#94a3b8"
              secureTextEntry
            />

            {myPassMsg ? <Text style={{ color: myPassMsg.includes('✅') ? '#059669' : '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{myPassMsg}</Text> : null}

            <TouchableOpacity onPress={doChangeMyPassword} disabled={myPassLoading} style={{ backgroundColor: '#059669', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
                {myPassLoading ? 'در حال تغییر...' : '🔐 تغییر رمز'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* 🔑 مودال تغییر رمز توسط ادمین */}
      <Modal visible={passModal} transparent animationType="slide" onRequestClose={() => setPassModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#0f2438', borderRadius: 16, padding: 24, maxWidth: 400, alignSelf: 'center', width: '100%' }}>
            {passSuccess ? (
              <>
                <Text style={{ fontSize: 50, textAlign: 'center', marginBottom: 16 }}>✅</Text>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>رمز با موفقیت تغییر کرد</Text>
                <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>حالا کاربر می‌تواند با رمز جدید وارد شود</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🔑</Text>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>تغییر رمز کاربر</Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>ایمیل: {passEmail}</Text>

                <TextInput
                  style={{ backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 14, textAlign: 'left' }}
                  value={passInput}
                  onChangeText={(t) => { setPassInput(t); setPassError(''); }}
                  placeholder="رمز جدید (حداقل ۶ کاراکتر)"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />

                {passError ? (
                  <Text style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>{passError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={doChangePassword}
                  disabled={passLoading}
                  style={{ backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                    {passLoading ? 'در حال ذخیره...' : '💾 تغییر رمز'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPassModal(false)}
                  style={{ paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>بستن</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
</ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fa' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f2438', textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  lbl: { fontSize: 12, fontWeight: 'bold', color: '#0f2438', textAlign: 'right', marginTop: 12, marginBottom: 6 },
  inp: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f2438', textAlign: 'right', backgroundColor: '#f8fafc' },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipTxt: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  chipTxtActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 8 },
  checkbox: { fontSize: 20 },
  checkboxLbl: { flex: 1, fontSize: 12, color: '#475569', textAlign: 'right' },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  tabsRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  tabActive: { backgroundColor: '#0f2438', borderColor: '#0f2438' },
  tabTxt: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  tabTxtActive: { color: '#fff' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 },
  reqCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  reqHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  reqBadge: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  reqDate: { fontSize: 10, color: '#94a3b8' },
  reqRow: { fontSize: 12, color: '#475569', textAlign: 'right', marginBottom: 4, lineHeight: 20 },
  reqBold: { fontWeight: 'bold', color: '#0f2438' },
  reqActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  reqBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  reqBtnTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  listItem: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  listItemId: { fontSize: 11, color: '#7c3aed', fontWeight: 'bold', textAlign: 'right' },
  listItemPlan: { fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 2 },
  badge: { fontSize: 16, paddingHorizontal: 8 },
  badgeOk: { color: '#059669' },
  badgeBad: { color: '#dc2626' },
});
