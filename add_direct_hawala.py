import re

# ═══════════════════════════════════════════════
# ۱. lib.network.ts — توابع حواله مستقیم
# ═══════════════════════════════════════════════
c = open('lib.network.ts').read()
orig = c

if 'sendDirectHawala' not in c:
    add = '''

// ═══ حواله مستقیم (خصوصی) به یک صراف ═══
export async function sendDirectHawala(h: any): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  if (!h.toAgent) throw new Error('صراف مقصد انتخاب نشده');
  const ref = _db.ref('direct_hawalas/' + h.toAgent + '/' + h.id);
  await ref.set({
    type: 'hawala_direct',
    fromCode: _myCode, fromName: _myName, fromCity: _myCity,
    toAgent: h.toAgent,
    currency: h.currency, amount: h.amount,
    beneficiaryName: h.beneficiaryName, beneficiaryPhone: h.beneficiaryPhone || '',
    commission: h.commission || 0,
    note: h.note || '',
    status: 'pending',
    acceptedBy: null, acceptedByName: null, acceptedAt: null,
    deliveredAt: null,
    createdAt: _fb.database.ServerValue.TIMESTAMP,
  });
  notifyAgent(h.toAgent, {
    type: 'direct_hawala', hawalaId: h.id,
    fromCode: _myCode, fromName: _myName,
    amount: h.amount, currency: h.currency,
    timestamp: Date.now(),
  });
  return { success: true, id: h.id };
}

export async function acceptDirectHawala(hawalaId: string, fromCode: string): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  const ref = _db.ref('direct_hawalas/' + _myCode + '/' + hawalaId);
  const snap = await ref.once('value');
  const v = snap.val();
  if (!v) throw new Error('حواله پیدا نشد');
  if (v.status !== 'pending') throw new Error('قبلاً قبول شده');
  await ref.update({
    status: 'accepted',
    acceptedBy: _myCode, acceptedByName: _myName, acceptedAt: Date.now(),
  });
  // اطلاع به فرستنده
  notifyAgent(v.fromCode, {
    type: 'direct_hawala_accepted', hawalaId,
    acceptedBy: _myCode, acceptedByName: _myName, timestamp: Date.now(),
  });
  return { success: true };
}

export async function deliverDirectHawala(hawalaId: string, toAgent: string): Promise<any> {
  if (!_db || !_myCode) throw new Error('شبکه متصل نیست');
  const ref = _db.ref('direct_hawalas/' + toAgent + '/' + hawalaId);
  await ref.update({
    status: 'delivered',
    deliveredAt: Date.now(),
  });
  const snap = await ref.once('value');
  const v = snap.val();
  if (v) {
    notifyAgent(v.fromCode, {
      type: 'direct_hawala_delivered', hawalaId, timestamp: Date.now(),
    });
  }
  return { success: true };
}

export function listenDirectInbox(cb: (list: any[]) => void): void {
  if (!_db || !_myCode) return;
  stopListener('directInbox');
  const ref = _db.ref('direct_hawalas/' + _myCode);
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((child: any) => {
      const v = child.val();
      if (v) list.push({ id: child.key, ...v });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.directInbox = { ref, event: 'value', cb: cbFn };
}

export function listenDirectOutbox(cb: (list: any[]) => void): void {
  if (!_db || !_myCode) return;
  stopListener('directOutbox');
  const ref = _db.ref('direct_hawalas').orderByChild('fromCode').equalTo(_myCode);
  const cbFn = ref.on('value', (snap: any) => {
    const list: any[] = [];
    snap.forEach((agentChild: any) => {
      agentChild.forEach((hChild: any) => {
        const v = hChild.val();
        if (v && v.fromCode === _myCode) list.push({ id: hChild.key, ...v });
      });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
  _listeners.directOutbox = { ref, event: 'value', cb: cbFn };
}
'''
    c = c + add
    open('lib.network.ts', 'w').write(c)
    print("✅ lib.network.ts: حواله مستقیم اضافه شد")
else:
    print("ℹ️ از قبل هست")

# ═══════════════════════════════════════════════
# ۲. LiveMarketScreen.tsx — UI حواله مستقیم
# ═══════════════════════════════════════════════
c = open('LiveMarketScreen.tsx').read()
orig = c

# ۲.۱ import
if 'sendDirectHawala' not in c:
    c = c.replace(
        "  sendBroadcastHawala, claimHawala, sendFXOffer, claimFXOffer,",
        "  sendBroadcastHawala, claimHawala, sendFXOffer, claimFXOffer,\n  sendDirectHawala, acceptDirectHawala, deliverDirectHawala, listenDirectInbox, listenDirectOutbox, getAgents,",
        1)
    print("✅ import")

# ۲.۲ state
if 'directInbox' not in c:
    c = c.replace(
        "  const [fxForm, setFxForm] = useState<any>({ currency: 'USD', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });",
        "  const [fxForm, setFxForm] = useState<any>({ currency: 'USD', amount: '', rateType: 'fixed', rate: '', expires: '10', note: '' });\n  const [directInbox, setDirectInbox] = useState<any[]>([]);\n  const [directOutbox, setDirectOutbox] = useState<any[]>([]);\n  const [agents, setAgents] = useState<any[]>([]);\n  const [directModal, setDirectModal] = useState(false);\n  const [directForm, setDirectForm] = useState<any>({ toAgent: '', toAgentName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });",
        1)
    print("✅ states")

# ۲.۳ listeners
if 'listenDirectInbox' not in c.split('useEffect')[2] if c.count('useEffect') > 2 else True:
    old_eff = """  useEffect(() => {
    if (!net.connected || !net.city) return;
    listenOpenHawalas(net.city, setHawalas);
    listenFXOffers(setFxOffers);
    listenMyHawalas(setMyHawalas);
    return () => { stopAllListeners(); };
  }, [net.connected, net.city, net.code]);"""
    new_eff = """  useEffect(() => {
    if (!net.connected) return;
    listenDirectInbox(setDirectInbox);
    listenDirectOutbox(setDirectOutbox);
    (async () => { const list = await getAgents(); setAgents(list); })();
    return () => { stopAllListeners(); };
  }, [net.connected, net.code]);

  useEffect(() => {
    if (!net.connected || !net.city) return;
    listenOpenHawalas(net.city, setHawalas);
    listenFXOffers(setFxOffers);
    listenMyHawalas(setMyHawalas);
    return () => {};
  }, [net.connected, net.city, net.code]);"""
    if old_eff in c:
        c = c.replace(old_eff, new_eff, 1)
        print("✅ listeners")

# ۲.۴ تابع submit
if 'submitDirect' not in c:
    old_sub = "  const doClaimHawala = async (id: string) => {"
    new_sub = """  const submitDirect = async () => {
    if (!directForm.toAgent) return showToast?.('صراف مقصد را انتخاب کن', true);
    if (!directForm.amount || !directForm.beneficiaryName) return showToast?.('مبلغ و نام ذی‌نفع الزامی', true);
    setSaving(true);
    try {
      const id = 'DH-' + Date.now().toString(36).toUpperCase();
      await sendDirectHawala({
        id, toAgent: directForm.toAgent,
        currency: directForm.currency, amount: Number(directForm.amount),
        beneficiaryName: directForm.beneficiaryName,
        beneficiaryPhone: directForm.beneficiaryPhone,
        commission: Number(directForm.commission) || 0,
        note: directForm.note,
      });
      setDirectModal(false);
      showToast?.('✅ حواله خصوصی ارسال شد');
      setDirectForm({ toAgent: '', toAgentName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
    setSaving(false);
  };

  const doAcceptDirect = async (id: string, from: string) => {
    try {
      await acceptDirectHawala(id, from);
      showToast?.('✅ قبول شد');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doDeliverDirect = async (id: string, toAgent: string) => {
    try {
      await deliverDirectHawala(id, toAgent);
      showToast?.('✅ تحویل شد');
    } catch (e: any) { showToast?.('❌ ' + e.message, true); }
  };

  const doClaimHawala = async (id: string) => {"""
    if old_sub in c:
        c = c.replace(old_sub, new_sub, 1)
        print("✅ submitDirect + accept + deliver")

# ۲.۵ دکمه جدید
if 'حواله خصوصی' not in c:
    old_btn = """<TouchableOpacity style={[s.actBtn, { backgroundColor: '#7c3aed' }]} onPress={() => setFxModal(true)}>
            <Text style={s.actBtnTxt}>💱 فروش ارز</Text>
          </TouchableOpacity>"""
    new_btn = old_btn + """
          <TouchableOpacity style={[s.actBtn, { backgroundColor: '#0891b2' }]} onPress={() => { (async () => { const l = await getAgents(); setAgents(l); })(); setDirectModal(true); }}>
            <Text style={s.actBtnTxt}>🔒 حواله خصوصی</Text>
          </TouchableOpacity>"""
    if old_btn in c:
        c = c.replace(old_btn, new_btn, 1)
        print("✅ دکمه حواله خصوصی")

# ۲.۶ بخش UI حواله مستقیم
if 'directInbox.map' not in c:
    old_sec = "{/* حوالات من */}\n      <Text style={s.secT}>📋 حوالات من ({myHawalas.length})</Text>"
    new_sec = """{/* ═══ حواله‌های خصوصی (Inbox) ═══ */}
      <Text style={s.secT}>🔒 حواله‌های خصوصی دریافتی ({directInbox.filter((h: any) => h.status === 'pending').length})</Text>
      {directInbox.filter((h: any) => h.status === 'pending').length === 0 ? (
        <Text style={s.empty}>حواله خصوصی جدیدی نیست</Text>
      ) : directInbox.filter((h: any) => h.status === 'pending').map((h: any) => (
        <View key={h.id} style={[s.card, { borderColor: '#0891b2' }]}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>🔒 {h.fromName}</Text>
            <Text style={s.cardCode}>{h.id}</Text>
          </View>
          <Text style={s.cardAmt}>{CUR_FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
          <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📞 {h.beneficiaryPhone || '—'}</Text>
          <Text style={s.cardRow}>💰 کارمزد: {fmt(h.commission, 0)} | 📍 {NET_CITIES[h.fromCity] || h.fromCity}</Text>
          {h.note ? <Text style={s.cardRow}>📝 {h.note}</Text> : null}
          <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => doAcceptDirect(h.id, h.fromCode)}>
            <Text style={s.btnTxt}>✅ قبول حواله</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* حواله‌های خصوصی در حال انجام */}
      {directInbox.filter((h: any) => h.status === 'accepted').map((h: any) => (
        <View key={h.id} style={[s.card, { borderColor: '#f59e0b' }]}>
          <Text style={s.cardTitle}>🔄 در حال انجام — {h.fromName}</Text>
          <Text style={s.cardAmt}>{CUR_FLAG[h.currency] || '💱'} {fmt(h.amount)} {h.currency}</Text>
          <Text style={s.cardRow}>👤 {h.beneficiaryName} | 📞 {h.beneficiaryPhone || '—'}</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => doDeliverDirect(h.id, net.code)}>
            <Text style={s.btnTxt}>📦 تحویل دادم</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* ═══ حوالات عمومی من ═══ */}
      <Text style={s.secT}>📋 حوالات من ({myHawalas.length})</Text>"""
    if old_sec in c:
        c = c.replace(old_sec, new_sec, 1)
        print("✅ UI حواله خصوصی")

# ۲.۷ مودال حواله خصوصی
if 'directModal' in c and 'مودال حواله خصوصی' not in c:
    # قبل از آخرین </View> از return اصلی
    last = c.rfind('    </View>\n  );\n}')
    if last > 0:
        modal = """
      {/* مودال حواله خصوصی */}
      <Modal visible={directModal} transparent animationType="slide" onRequestClose={() => setDirectModal(false)}>
        <View style={s.mBg}><View style={s.mBox}>
          <View style={[s.mHead, { backgroundColor: '#0891b2' }]}><Text style={s.mTitle}>🔒 حواله خصوصی</Text>
            <TouchableOpacity onPress={() => setDirectModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 14 }}>
            <Text style={s.lbl}>صراف مقصد * ({agents.length} نفر آنلاین)</Text>
            {agents.length === 0 ? (
              <Text style={s.empty}>صراف دیگری در شبکه نیست</Text>
            ) : (
              <ScrollView style={{ maxHeight: 200, marginBottom: 8 }}>
                {agents.map((a: any) => (
                  <TouchableOpacity key={a.code} onPress={() => setDirectForm({ ...directForm, toAgent: a.code, toAgentName: a.name })} style={[s.agentRow, directForm.toAgent === a.code && { backgroundColor: '#0891b2' }]}>
                    <Text style={[s.agentName, directForm.toAgent === a.code && { color: '#fff' }]}>{a.name}</Text>
                    <Text style={[s.agentCity, directForm.toAgent === a.code && { color: '#fff' }]}>{NET_CITIES[a.city] || a.city}</Text>
                    <Text style={[s.agentCode, directForm.toAgent === a.code && { color: '#a7f3d0' }]}>{a.code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={s.lbl}>ارز</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
              {['USD', 'AFN', 'EUR', 'PKR', 'AED'].map(c => (
                <TouchableOpacity key={c} onPress={() => setDirectForm({ ...directForm, currency: c })} style={[s.chip, directForm.currency === c && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}>
                  <Text style={[s.chipTxt, directForm.currency === c && { color: '#fff' }]}>{CUR_FLAG[c]} {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>مقدار *</Text>
            <TextInput style={s.inp} value={directForm.amount} onChangeText={v => setDirectForm({ ...directForm, amount: v.replace(/[^\\d]/g, '') })} keyboardType="numeric" placeholder="1000" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>نام ذی‌نفع *</Text>
            <TextInput style={s.inp} value={directForm.beneficiaryName} onChangeText={v => setDirectForm({ ...directForm, beneficiaryName: v })} placeholder="نام گیرنده" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>تلفن ذی‌نفع</Text>
            <TextInput style={s.inp} value={directForm.beneficiaryPhone} onChangeText={v => setDirectForm({ ...directForm, beneficiaryPhone: v.replace(/[^\\d]/g, '') })} keyboardType="phone-pad" placeholder="07..." placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>کارمزد</Text>
            <TextInput style={s.inp} value={directForm.commission} onChangeText={v => setDirectForm({ ...directForm, commission: v.replace(/[^\\d]/g, '') })} keyboardType="numeric" placeholder="200" placeholderTextColor="#94a3b8" />
            <Text style={s.lbl}>توضیحات</Text>
            <TextInput style={[s.inp, { minHeight: 50 }]} value={directForm.note} onChangeText={v => setDirectForm({ ...directForm, note: v })} multiline placeholderTextColor="#94a3b8" />
            <View style={s.rowBtns}>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setDirectModal(false)}>
                <Text style={s.btnTxt}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#0891b2', flex: 2 }]} onPress={submitDirect} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔒 ارسال</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View></View>
      </Modal>
"""
        c = c[:last] + modal + "\n" + c[last:]
        print("✅ Modal حواله خصوصی")

open('LiveMarketScreen.tsx', 'w').write(c)
print("changed:", c != orig)

# ═══════════════════════════════════════════════
# ۳. اضافه کردن styles جدید
# ═══════════════════════════════════════════════
c = open('LiveMarketScreen.tsx').read()
if 'agentRow:' not in c:
    c = c.replace(
        "const s = StyleSheet.create({",
        "const s = StyleSheet.create({\n  agentRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: '#1a2332', marginBottom: 4, borderWidth: 1, borderColor: '#334155' },\n  agentName: { color: '#fff', fontWeight: 'bold', fontSize: 12, flex: 1, textAlign: 'right' },\n  agentCity: { color: '#cbd5e1', fontSize: 11, marginLeft: 8 },\n  agentCode: { color: '#7c3aed', fontSize: 10, fontFamily: 'monospace', marginLeft: 8 },",
        1)
    open('LiveMarketScreen.tsx', 'w').write(c)
    print("✅ styles")
