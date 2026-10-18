// SuperAssistant.tsx — همه چیز داخل خودش
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, NativeModules, Platform, DeviceEventEmitter
} from 'react-native';
import { parseMulti } from './lib.app.parser';
import { startWizard, answerCurrent, getCurrentQuestion, WizardState } from './lib.app.wizard';
import { handleCommand, executeApproved } from './lib.app.manager';
import { Panel, buildWelcomePanel, buildBoxPanel, buildCustomerPanel, buildInvoiceCardPanel } from './lib.app.panels';
import PanelRenderer from './PanelRenderer';
import { subscribe, getRecentEvents, AppEvent } from './lib.app.events';
import { getRegisteredScreens, getScreen, findScreen, findField, findAction, getScreenSummary, listAllScreens } from './lib.app.registry';
import { isSTTAvailable, startSTT, stopSTT, speakText, isWeb } from './lib.voice';

const voiceAvailable = isSTTAvailable();

export default function SuperAssistant({ showToast, onExit, onNavigate }: any) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pending, setPending] = useState<any>(null);
  const [voiceReply, setVoiceReply] = useState(true);
  const [sidebar, setSidebar] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const scrollRef = useRef<any>(null);
  const sttRef = useRef<any>(null);

  useEffect(() => { setPanel(buildWelcomePanel()); }, []);

  useEffect(() => {
    const unsub = subscribe((evt) => {
      setEvents(prev => [evt, ...prev].slice(0, 50));
    });
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      try { setEvents(await getRecentEvents(20)); } catch {}
    })();
  }, []);

  const startVoice = async () => {
    if (!voiceAvailable) { showToast?.('🎤 روی این دستگاه نیست', true); return; }
    if (listening) {
      // اگه روشنه، خاموش کن
      stopContinuous();
      setListening(false);
      return;
    }
    setPartial('');
    setListening(true);
    startContinuous(
      (finalTxt) => {
        if (finalTxt && finalTxt.trim()) {
          run(finalTxt);
        }
      },
      (p) => setPartial(p),
      (err) => {
        // خطا رو نشون بده ولی continuous بمونه
        console.log('🎤 err:', err);
      }
    );
  };

  const stopVoice = async () => {
    stopContinuous();
    setListening(false);
    setPartial('');
  };

  const speak = (t: string) => { if (!voiceReply) return; speakText(t, 'fa-IR'); };

  const run = async (input?: string) => {
    const q = (input || text).trim();
    if (!q || loading) return;
    setText('');
    setLoading(true);

    try {
      // ═══ اگه wizard فعاله، جواب بده ═══
      if (wizard && wizard.status === 'active') {
        const r = await answerCurrent(wizard, q);
        setWizard(r.w);
        speak(r.reply);
        showToast?.(r.reply.split('\n')[0]);
        if (r.done) {
          setTimeout(() => setWizard(null), 2000);
        }
        setLoading(false);
        return;
      }

      // ═══ اگه wizard در حالت تأیید ═══
      if (wizard && wizard.status === 'confirming') {
        const r = await answerCurrent(wizard, q);
        setWizard(r.w);
        speak(r.reply);
        showToast?.(r.reply);
        if (r.done) {
          setTimeout(() => setWizard(null), 2000);
        }
        setLoading(false);
        return;
      }

      // ═══ تأیید pending ═══
      if (pending) {
        if (/تایید|تأیید|بله|آره|اوکی|ok|انجام/i.test(q)) {
          const r = await executeApproved(pending);
          if (r.panel) setPanel(r.panel);
          speak(r.message);
          showToast?.(r.message);
          setPending(null);
          setLoading(false);
          return;
        }
        if (/لغو|نه|cancel|بیخیال|نکن/i.test(q)) {
          setPending(null);
          showToast?.('❌ لغو شد');
          speak('لغو شد');
          setLoading(false);
          return;
        }
      }


      // ═══ دستورات ربات — صفحه‌ها ═══
      const t2 = q.toLowerCase();
      
      // «چی می‌بینی؟» یا «کجایی؟»
      if (/چی می.?بینی|کجایی|کجا هستم|چی میبینی|الان کجا/.test(t2)) {
        const active = getRegisteredScreens().filter(s => s.fields && s.fields.length > 0);
        if (active.length > 0) {
          const summary = getScreenSummary(active[0]);
          speak(summary);
          showToast?.(summary);
          setLoading(false);
          return;
        }
        showToast?.('👁️ هیچ صفحه فعالی نمی‌بینم');
        setLoading(false);
        return;
      }
      
      // «چه صفحه‌هایی؟»
      if (/چه صفحه|لیست صفحه|صفحه‌های فعال/.test(t2)) {
        const list = listAllScreens();
        speak(list);
        showToast?.(list);
        setLoading(false);
        return;
      }
      
      // «حالت شب» / «تاریک» / «میلادی» / «شمسی» — بدون نیاز به صفحه
      if (/حالت شب|دارک|dark|شب کن/.test(t2)) {
        try {
          const { setThemeMode } = await import('./App');
          setThemeMode('dark');
          speak('حالت شب فعال شد');
          showToast?.('✅ حالت شب فعال شد');
        } catch (e) {
          showToast?.('❌ خطا');
        }
        setLoading(false);
        return;
      }
      
      if (/حالت روز|روشن کن|لایت|light/.test(t2)) {
        try {
          const { setThemeMode } = await import('./App');
          setThemeMode('light');
          speak('حالت روز فعال شد');
          showToast?.('✅ حالت روز فعال شد');
        } catch (e) {
          showToast?.('❌ خطا');
        }
        setLoading(false);
        return;
      }
      
      // تاریخ شمسی/میلادی
      if (/تاریخ.*میلادی|میلادی کن|گرگوری/.test(t2)) {
        try {
          const lib = await import('./lib');
          (lib as any).setCalType('gregorian');
          (lib as any).saveCalType?.('gregorian');
          speak('تقویم میلادی فعال شد');
          showToast?.('✅ تقویم میلادی');
        } catch (e) { showToast?.('❌ خطا'); }
        setLoading(false);
        return;
      }
      
      if (/تاریخ.*شمسی|شمسی کن|جلالی/.test(t2)) {
        try {
          const lib = await import('./lib');
          (lib as any).setCalType('jalali');
          (lib as any).saveCalType?.('jalali');
          speak('تقویم شمسی فعال شد');
          showToast?.('✅ تقویم شمسی');
        } catch (e) { showToast?.('❌ خطا'); }
        setLoading(false);
        return;
      }

      
      // ═══ Navigation — برو به صفحه ═══
      const navTargets = [
        // ─── صرافی + زیرتب‌ها
        { keys: ['صرافی'], tab: 'exchange', sub: 'list', reply: 'میرم صرافی' },
        { keys: ['صندوق‌ها', 'صندوق ها', 'کارتکس', 'کاردکس', 'صندوق‌ها را باز'], tab: 'exchange', sub: 'boxes', reply: 'میرم صندوق‌ها' },
        { keys: ['حواله‌جات', 'حواله جات', 'حواله‌ها'], tab: 'exchange', sub: 'hawalas', reply: 'میرم حواله‌جات' },
        { keys: ['چک‌ها', 'چک ها', 'چک'], tab: 'exchange', sub: 'checks', reply: 'میرم چک‌ها' },
        { keys: ['مشتریان', 'مشتری ها', 'مشتری'], tab: 'exchange', sub: 'customers', reply: 'میرم مشتریان' },
        { keys: ['شریکان', 'شرکا', 'شریک'], tab: 'exchange', sub: 'partners', reply: 'میرم شرکا' },
        { keys: ['معاملات'], tab: 'exchange', sub: 'list', reply: 'میرم معاملات' },
        { keys: ['معامله جدید'], tab: 'exchange', sub: 'form', reply: 'میرم فرم معامله' },
        { keys: ['کاردکس', 'دفتر کل'], tab: 'exchange', sub: 'ledger', reply: 'میرم کاردکس' },
        { keys: ['پرینت حساب', 'صورتحساب'], tab: 'exchange', sub: 'statement', reply: 'میرم پرینت حساب' },
        { keys: ['بازار زنده'], tab: 'exchange', sub: 'liveMarket', reply: 'میرم بازار زنده' },
        { keys: ['شبکه', 'شبکه‌های من', 'گروه‌ها'], tab: 'exchange', sub: 'myGroups', reply: 'میرم شبکه‌ها' },

        // ─── تب‌های اصلی
        { keys: ['بازار عمومی', 'بازار'], tab: 'publicMarket', reply: 'میرم بازار عمومی' },
        { keys: ['داشبورد', 'خانه'], tab: 'order', reply: 'میرم سفارش' },
        { keys: ['فروش', 'فاکتور فروش'], tab: 'order', reply: 'میرم فروش' },
        { keys: ['خرید', 'فاکتور خرید'], tab: 'purchase', reply: 'میرم خرید' },
        { keys: ['انبار', 'موجودی'], tab: 'inventory', reply: 'میرم انبار' },
        { keys: ['هزینه', 'هزینه‌ها'], tab: 'expenses', reply: 'میرم هزینه‌ها' },
        { keys: ['کارمند', 'کارمندان'], tab: 'employees', reply: 'میرم کارمندان' },
        { keys: ['سود', 'درآمد'], tab: 'profit', reply: 'میرم سود' },
        { keys: ['بانک', 'اس ام اس', 'sms'], tab: 'bankMatch', reply: 'میرم بانک' },
        { keys: ['آموزش', 'یادگیری'], tab: 'botLearning', reply: 'میرم آموزش' },
        { keys: ['تنظیمات'], tab: 'settings', reply: 'میرم تنظیمات' },
      ];
      
      for (const nt of navTargets) {
        let matched = false;
        for (const k of nt.keys) {
          if (t2.includes(k)) { matched = true; break; }
        }
        if (matched) {
          try {
            // برو به تب اصلی
            if ((nt as any).sub) {
              // صرافی + زیرتب → همه چیز داخل ربات
              if (onNavigate) onNavigate('exchange');
              try {
                const nav = (globalThis as any).__nav;
                if (nav && nav.setTab) nav.setTab('exchange');
              } catch {}
              setTimeout(() => {
                try { (globalThis as any).__exchangeSetSub?.((nt as any).sub); } catch {}
              }, 200);
              speak(nt.reply);
              showToast?.(nt.reply);
            } else if (nt.tab === 'exchange' || nt.tab === 'publicMarket' || nt.tab === 'bankMatch') {
              // تب‌های داخل ربات
              if (onNavigate) onNavigate(nt.tab);
              speak(nt.reply);
              showToast?.(nt.reply);
            } else {
              // تب‌های خارج ربات
              const nav = (globalThis as any).__nav;
              if (nav && nav.setTab) {
                nav.setTab(nt.tab);
                speak(nt.reply);
                showToast?.(nt.reply);
                onExit?.();
              }
            }
          } catch (e) { showToast?.('❌ خطا'); }
          setLoading(false);
          return;
        }
      }

            // ═══ تشخیص فرم ═══
      const t = q.toLowerCase();
      let formKey: string | null = null;
      
      if (/فاکتور|فاکتر/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) formKey = 'invoice';
      else if (/فاکتور\s*فروش/.test(t) && !/لیست|ببین|نشون/.test(t)) formKey = 'invoice';
      else if (/صندوق/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) formKey = 'box';
      else if (/مشتری/.test(t) && /جدید|بزن|بساز|ثبت|اضافه/.test(t)) formKey = 'customer';
      else if (/حواله/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) formKey = 'hawala';
      else if (/نرخ/.test(t) && /جدید|بزن|بساز|ثبت|اضافه/.test(t)) formKey = 'rate';
      else if (/چک/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) formKey = 'check';
      
      if (formKey) {
        const w = startWizard(formKey);
        if (w) {
          setWizard(w);
          const q1 = getCurrentQuestion(w);
          speak(q1);
          showToast?.('📝 فرم ' + formKey + ' شروع شد');
          setLoading(false);
          return;
        }
      }

      // ═══ تشخیص لغو ═══
      if (/لغو|بیخیال|کنسل/.test(t) && wizard) {
        setWizard(null);
        showToast?.('❌ لغو شد');
        setLoading(false);
        return;
      }

      // ═══ ادامه معمولی (Panel) ═══
      const cmds = parseMulti(q);
      let lastResult: any = null;

      for (const cmd of cmds) {
        const r = await handleCommand(cmd, q);
        lastResult = r;
        if ((r as any)._wizard) {
          const w = startWizard((r as any)._wizard);
          if (w) {
            setWizard(w);
            const q1 = getCurrentQuestion(w);
            speak(q1);
            showToast?.('📝 فرم شروع شد');
            setLoading(false);
            return;
          }
        }
        if (r.panel) setPanel(r.panel);
        if (r.needConfirm && r.pendingAction) {
          setPending(r.pendingAction);
          showToast?.(r.message);
          speak(r.message);
          setLoading(false);
          return;
        }
      }

      if (lastResult?.message) {
        showToast?.(lastResult.message);
        speak(lastResult.message);
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setLoading(false);
  };

  const quickExamples = [
    { icon: '📦', text: 'صندوق‌ها' },
    { icon: '👥', text: 'مشتریان' },
    { icon: '📄', text: 'فاکتور فروش' },
    { icon: '💸', text: 'حواله‌جات' },
    { icon: '🧾', text: 'چک‌ها' },
    { icon: '📈', text: 'نرخ‌ها' },
    { icon: '📊', text: 'سود امروز' },
    { icon: '❓', text: 'راهنما' },
  ];

  const handleItemClick = async (item: any) => {
    try {
      if (item.type === 'box') {
        const card = await buildBoxPanel(item.name);
        if (card) setPanel(card);
      } else if (item.type === 'customer') {
        const card = await buildCustomerPanel(item.name);
        if (card) setPanel(card);
      } else if (item.type === 'invoice') {
        const card = await buildInvoiceCardPanel(item.invoice);
        if (card) setPanel(card);
      }
    } catch (e) { console.log('itemClick err:', e); }
  };

  const handlePanelAction = async (action: any) => {
    if (action.action === 'ask_deposit') {
      setText('اضافه کردن ');
      speak('چقدر اضافه کنم؟');
    } else if (action.action === 'ask_withdraw') {
      setText('کم کردن ');
      speak('چقدر کم کنم؟');
    } else {
      showToast?.('این کار به‌زودی');
    }
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onExit?.()} style={s.iconBtn}>
          <Text style={s.iconTxt}>×</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🤖 دستیار</Text>
          <Text style={s.subtitle}>{voiceAvailable ? (isWeb ? '🌐 وب' : '📱 گوشی') : '⌨️ متن'}</Text>
        </View>
        <TouchableOpacity onPress={() => setVoiceReply(v => !v)} style={s.iconBtn}>
          <Text style={s.iconTxt}>{voiceReply ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSidebar(true)} style={s.iconBtn}>
          <Text style={s.iconTxt}>☰</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        {pending && (
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>⚠️ تأیید</Text>
            <Text style={s.confirmTxt}>
              {pending.type === 'deposit' ? 'واریز' : 'برداشت'} {pending.amount?.toLocaleString?.() || pending.amount} {pending.currency} {pending.type === 'deposit' ? 'به' : 'از'} {pending.person}
            </Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10 }}>
              <TouchableOpacity accessibilityLabel="تأیید" style={[s.smallBtn, { backgroundColor: '#059669' }]} onPress={() => run('تأیید')}>
                <Text style={s.smallBtnTxt}>✅ تأیید</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="لغو" style={[s.smallBtn, { backgroundColor: '#dc2626' }]} onPress={() => run('لغو')}>
                <Text style={s.smallBtnTxt}>❌ لغو</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {panel && (
          <PanelRenderer
            panel={panel}
            onAction={handlePanelAction}
            onItemClick={handleItemClick}
            onClose={() => setPanel(buildWelcomePanel())}
          />
        )}

        {loading && (
          <View style={{ alignItems: 'center', padding: 14 }}>
            <ActivityIndicator color="#7c3aed" size="large" />
          </View>
        )}

        {panel?.type === 'welcome' && (
          <>
            <Text style={s.sectionT}>💡 سریع بزن:</Text>
            <View style={s.grid}>
              {quickExamples.map((ex, i) => (
                <TouchableOpacity key={i} style={s.quickBtn} onPress={() => run(ex.text)}>
                  <Text style={s.quickIcon}>{ex.icon}</Text>
                  <Text style={s.quickTxt}>{ex.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ═══ Wizard Form ═══ */}
      {wizard && (
        <View style={s.wizardBox}>
          <View style={s.wizardHead}>
            <Text style={s.wizardIcon}>📝</Text>
            <Text style={s.wizardTitle}>
              {wizard.formKey === 'invoice' ? 'فاکتور فروش' :
               wizard.formKey === 'box' ? 'صندوق جدید' :
               wizard.formKey === 'customer' ? 'مشتری جدید' :
               wizard.formKey === 'hawala' ? 'حواله جدید' :
               wizard.formKey === 'rate' ? 'نرخ جدید' :
               wizard.formKey === 'check' ? 'چک جدید' : 'فرم'}
            </Text>
            <TouchableOpacity onPress={() => setWizard(null)}>
              <Text style={s.wizardX}>×</Text>
            </TouchableOpacity>
          </View>
          
          <View style={s.wizardProgress}>
            <Text style={s.wizardProgressTxt}>
              {wizard.status === 'confirming' ? 'تأیید نهایی' : 'فیلد ' + (wizard.currentIndex + 1) + ' از ' + wizard.fields.length}
            </Text>
          </View>
          
          {wizard.status === 'confirming' ? (
            <View style={s.wizardConfirmBox}>
              <Text style={s.wizardConfirmTxt}>✅ همه چیز آماده — ذخیره کنم؟</Text>
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10 }}>
                <TouchableOpacity accessibilityLabel="بله، ذخیره" style={[s.wizardBtn, { backgroundColor: '#059669' }]} onPress={() => run('بله')}>
                  <Text style={s.wizardBtnTxt}>✅ بله، ذخیره</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="نه، لغو" style={[s.wizardBtn, { backgroundColor: '#dc2626' }]} onPress={() => run('نه')}>
                  <Text style={s.wizardBtnTxt}>❌ نه، لغو</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.wizardQ}>{wizard.fields[wizard.currentIndex]?.label}</Text>
              {wizard.fields[wizard.currentIndex]?.hint ? (
                <Text style={s.wizardHint}>💡 {wizard.fields[wizard.currentIndex]?.hint}</Text>
              ) : null}
              
              {wizard.fields[wizard.currentIndex]?.choices ? (
                <View style={s.wizardChoices}>
                  {(wizard.fields[wizard.currentIndex].choices || []).map((c: string, i: number) => (
                    <TouchableOpacity key={i} style={s.wizardChoice} onPress={() => run(c)}>
                      <Text style={s.wizardChoiceTxt}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              
              <View style={s.wizardNav}>
                <TouchableOpacity accessibilityLabel="لغو" style={s.wizardNavBtn} onPress={() => setWizard(null)}>
                  <Text style={s.wizardNavTxt}>❌ لغو</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="بگو" style={[s.wizardNavBtn, { backgroundColor: '#7c3aed' }]} onPress={startVoice}>
                  <Text style={s.wizardNavTxt}>🎤 بگو</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      <View style={s.bottomBar}>
        {listening && (
          <View style={s.listenBox}>
            <Text style={s.listenTxt}>🎤 {partial || 'گوش می‌دم...'}</Text>
          </View>
        )}
        <View style={s.inputRow}>
          <TextInput accessibilityLabel="مثلاً: صندوق احمد"
            style={s.inp}
            value={text}
            onChangeText={setText}
            placeholder="مثلاً: صندوق احمد"
            placeholderTextColor="#64748b"
            onSubmitEditing={() => run()}
          />
          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => run()} disabled={loading || !text.trim()}>
            <Text style={s.btnTxt}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: listening ? '#dc2626' : '#0891b2' }]}
            onPress={listening ? stopVoice : startVoice}
            disabled={!voiceAvailable}
          >
            <Text style={s.btnTxt}>{listening ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={sidebar} transparent animationType="slide" onRequestClose={() => setSidebar(false)}>
        <TouchableOpacity accessibilityLabel="رویدادهای اخیر" style={s.sbBg} activeOpacity={1} onPress={() => setSidebar(false)}>
          <View style={s.sidebar}>
            <View style={s.sbHead}>
              <Text style={s.sbTitle}>📊 رویدادهای اخیر</Text>
              <TouchableOpacity onPress={() => setSidebar(false)}><Text style={s.sbX}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 10 }}>
              {events.length === 0 ? (
                <Text style={s.empty}>هنوز رویدادی نیست</Text>
              ) : (
                events.slice(0, 30).map((e, i) => (
                  <View key={e.id || i} style={s.eventItem}>
                    <Text style={s.eventTxt}>{e.userMessage}</Text>
                    <Text style={s.eventTime}>{fmtTime(e.timestamp)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
                
      {/* 🎤 دکمه شناور میکروفون */}
      {voiceAvailable && !wizard && (
        <TouchableOpacity
          style={s.floatingMic}
          onPress={listening ? stopVoice : startVoice}
          activeOpacity={0.7}
        >
          <Text style={s.floatingMicTxt}>{listening ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
      )}
      </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 2, textAlign: 'right' },
  iconBtn: { padding: 8 }, iconTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  confirmBox: { backgroundColor: '#1a2332', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 10, padding: 12, marginTop: 8 },
  confirmTitle: { color: '#f59e0b', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  confirmTxt: { color: '#fff', fontSize: 14, marginTop: 6, textAlign: 'right' },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  sectionT: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 8 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  quickBtn: { backgroundColor: '#1a2332', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  quickIcon: { fontSize: 16 },
  quickTxt: { color: '#cbd5e1', fontSize: 12 },
  bottomBar: { padding: 10, paddingBottom: 60, backgroundColor: '#0f2438', borderTopWidth: 1, borderTopColor: '#334155', marginBottom: 30 },
  inputRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  inp: { flex: 1, backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, fontSize: 15, textAlign: 'right', minHeight: 54 },
  btn: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  listenBox: { backgroundColor: '#7c3aed', padding: 8, borderRadius: 8, marginBottom: 6 },
  listenTxt: { color: '#fff', fontSize: 13, textAlign: 'center' },
  sbBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'flex-end' },
  sidebar: { width: '80%', height: '100%', backgroundColor: '#0f2438', borderLeftWidth: 1, borderColor: '#334155' },
  sbHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sbTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  sbX: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  eventItem: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  eventTxt: { color: '#fff', fontSize: 13, textAlign: 'right' },
  eventTime: { color: '#64748b', fontSize: 10, marginTop: 4, textAlign: 'left' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20 },
  wizardBox: { backgroundColor: '#0f2438', borderTopWidth: 3, borderTopColor: '#f59e0b', padding: 14, maxHeight: '60%' },
  wizardHead: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 8 },
  wizardIcon: { fontSize: 20, marginLeft: 6 },
  wizardTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  wizardX: { color: '#dc2626', fontSize: 26, fontWeight: 'bold', paddingHorizontal: 8 },
  wizardProgress: { alignItems: 'center', marginBottom: 10 },
  wizardProgressTxt: { color: '#f59e0b', fontSize: 11, fontWeight: 'bold' },
  wizardQ: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', lineHeight: 26, marginBottom: 6 },
  wizardHint: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginBottom: 8 },
  wizardChoices: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  wizardChoice: { backgroundColor: '#1a2332', borderWidth: 1, borderColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  wizardChoiceTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  wizardNav: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  wizardNavBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  wizardNavTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  wizardConfirmBox: { backgroundColor: '#1a2332', padding: 14, borderRadius: 10, borderWidth: 2, borderColor: '#059669' },
  wizardConfirmTxt: { color: '#10b981', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  wizardBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  wizardBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  floatingMic: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f59e0b',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  floatingMicTxt: { color: '#fff', fontSize: 30 },
});
