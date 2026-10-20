// ═══════════════════════════════════════════════════════════
//  👁 BotUI — قاب بصری ربات (Screen Portal + Chat + Mic)
// ═══════════════════════════════════════════════════════════
import { startSTT, stopSTT } from './lib.voice';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { parseIntent, FlowEngine, FLOWS, APP_KNOWLEDGE, unknownReply, helpText } from './BotBrain';

// کامپوننت‌های واقعی اپ — اینجا import می‌شوند تا داخل قاب نمایش داده شوند
import ExchangeScreen from './ExchangeScreen';
import PublicMarketScreen from './PublicMarketScreen';
import { parseMulti } from './lib.local.nlu';
import { execute } from './lib.local.exec';

// اگر این‌ها را نداری، این دو خط را کامنت کن:
// import SalesScreen from './SalesScreen';
// import PurchaseScreen from './PurchaseScreen';

type Msg = { from: 'bot' | 'me'; text: string; time: number };

export default function BotUI({ showToast, onExit, onOpenLearning }: any) {
  // ─── حالت‌ها
  const [messages, setMessages] = useState<Msg[]>([
    { from: 'bot', text: 'سلام! من دستیار تو هستم. بگو چیکار کنم؟', time: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [screen, setScreen] = useState<string>('bot'); // bot | exchange | publicMarket | salesInvoice | ...
  const [sub, setSub] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const toggleBigMic = async () => {
    if (listening) {
      try { stopContinuous(); } catch {}
      setListening(false);
      showToast?.('میکروفون خاموش شد');
      return;
    }
    setListening(true);
    showToast?.('🎤 در حال گوش دادن...');
    await startContinuous(
      (text) => {
        console.warn('BOT_INPUT', text);
        speakText('شنیدم ' + text);
      },
      () => {},
      (err) => {
        console.warn('BIG_MIC_ERR', err);
        setListening(false);
        showToast?.('⚠️ ' + err);
      }
    );
  };

  const flowRef = useRef(new FlowEngine());
  const scrollRef = useRef<ScrollView>(null);

  // ─── اسکرول خودکار
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ─── افزودن پیام
  const push = (from: 'bot' | 'me', text: string) => {
    setMessages(prev => [...prev, { from, text, time: Date.now() }]);
  };

  // ─── پاسخ ربات
  const botSay = (text: string) => {
    push('bot', text);
    // TTS: فعلاً غیرفعال (روی APK فعال می‌شود)
  };

  // ─── پردازش پیام کاربر
  const handleUserText = (raw: string) => {
    // COMPLETE_NAV_MAP_V2
    const _t = String(text || input || '').trim();
    const navTargets = [
      // ─── تب‌های اصلی
      { keys: ['مدیریت', 'مدیر'], tab: 'mgr' },
      { keys: ['فروش', 'سفارش', 'داشبورد', 'خانه'], tab: 'order' },
      { keys: ['خرید', 'فاکتور خرید'], tab: 'purchase' },
      { keys: ['صرافی'], tab: 'exchange' },
      { keys: ['بازار عمومی', 'بازار'], tab: 'publicMarket' },
      { keys: ['انبار', 'موجودی'], tab: 'inventory' },
      { keys: ['هزینه', 'هزینه‌ها'], tab: 'expenses' },
      { keys: ['کارمند', 'کارمندان'], tab: 'employees' },
      { keys: ['سود', 'درآمد'], tab: 'profit' },
      { keys: ['بانک', 'پیامک'], tab: 'bankMatch' },
      { keys: ['تنظیمات'], tab: 'settings' },
      
      // ─── زیرتب‌های صرافی
      { keys: ['صندوق', 'صندوق‌ها', 'کارتکس', 'کاردکس'], tab: 'exchange', sub: 'boxes' },
      { keys: ['حواله', 'حواله‌جات'], tab: 'exchange', sub: 'hawalas' },
      { keys: ['چک', 'چک‌ها'], tab: 'exchange', sub: 'checks' },
      { keys: ['مشتری', 'مشتریان', 'اشخاص'], tab: 'exchange', sub: 'customers' },
      { keys: ['شریک', 'شرکا', 'خریداران'], tab: 'exchange', sub: 'partners' },
      { keys: ['معاملات', 'لیست معاملات'], tab: 'exchange', sub: 'list' },
      { keys: ['بازار زنده'], tab: 'exchange', sub: 'liveMarket' },
      { keys: ['گروه', 'شبکه', 'شبکه‌های من'], tab: 'exchange', sub: 'myGroups' },
    ];

    for (const nt of navTargets) {
      let matched = false;
      for (const k of nt.keys) {
        if (_t.includes(k)) { matched = true; break; }
      }
      if (matched) {
        try {
          const nav = (globalThis as any).__nav;
          if (nav && typeof nav.setTab === 'function') {
            nav.setTab(nt.tab);
            if (nt.sub) {
              setTimeout(() => {
                try { (globalThis as any).__exchangeSetSub?.(nt.sub); } catch (e) {}
              }, 200);
            }
            try { botSay('باشه، می‌رم ' + nt.keys[0]); } catch (e) {}
            // onExit removed
            return;
          }
        } catch (e) {}
      }
    }

    const text = raw.trim();
    if (!text) return;
    push('me', text);

    const flow = flowRef.current;

    // اگر flow فعال است، ابتدا ببین پاسخ است یا دستور؟
    if (flow.isActive()) {
      const intent = parseIntent(text);

      if (intent.type === 'cancel') {
        flow.cancel();
        botSay('لغو شد. برگشتیم به حالت عادی.');
        return;
      }
      if (intent.type === 'back') {
        const q = flow.back();
        botSay('باشه، برگشتیم عقب. ' + q);
        return;
      }
      if (intent.type === 'goto' || intent.type === 'open_flow') {
        // کاربر وسط کار تصمیم عوض کرد
        botSay('باشه، کار قبلی را لغو می‌کنم.');
        flow.cancel();
        // ادامه می‌دهد به پردازش عادی
      } else {
        // پاسخ فیلد
        const result = flow.answer(text);
        if (result.done) {
          const flowDef = FLOWS[flow.flowKey!];
          botSay('✅ ' + flowDef.name + ' ثبت شد. (عملکرد: ' + flowDef.onComplete + ')');
          flow.cancel();
          // اینجا واقعاً submit می‌کنیم — بعداً
        } else {
          botSay(result.question!);
        }
        return;
      }
    }

    // ─── پردازش عادی
    const intent = parseIntent(text);

    switch (intent.type) {
      case 'goto': {
        const tab = intent.tab || '';
        if (tab === 'exchange' || tab === 'publicMarket') {
          setScreen(tab);
          setSub(intent.sub || null);
          const label = APP_KNOWLEDGE.tabs[tab]?.label || tab;
          const subLabel = intent.sub
            ? (APP_KNOWLEDGE.tabs[tab].subs.find((s: any) => s.key === intent.sub)?.label || '')
            : '';
          botSay('باشه، ' + label + (subLabel ? ' → ' + subLabel : '') + ' باز شد.');
        } else {
          // تب‌های دیگر اپ
          try {
            const nav = (globalThis as any).__nav;
            if (nav?.setTab) {
              nav.setTab(tab);
              botSay('باشه، رفتم ' + (APP_KNOWLEDGE.tabs[tab]?.label || tab));
            }
          } catch {}
        }
        break;
      }
      case 'open_flow': {
        const flowDef = FLOWS[intent.flow];
        if (!flowDef) { botSay('این کار را نمی‌شناسم.'); break; }
        setScreen(flowDef.screen);
        const intro = flowRef.current.start(intent.flow);
        botSay(intro);
        const firstQ = flowRef.current.currentStep()?.question;
        if (firstQ) botSay(firstQ);
        break;
      }
      case 'back': {
        setScreen('bot');
        setSub(null);
        botSay('برگشتیم به اتاق ربات.');
        break;
      }
      case 'cancel': {
        botSay('باشه، چیزی برای لغو نبود.');
        break;
      }
      case 'confirm_yes':
      case 'confirm_no': {
        botSay('باشه.');
        break;
      }
      case 'unknown':
      case 'answer':
      default: {
        if (text.includes('کمک') || text.includes('چیکار')) {
          botSay(helpText());
        } else {
          botSay(unknownReply());
        }
      }
    }
  };

  // ─── رندر صفحه واقعی داخل قاب
  const renderScreen = () => {
    switch (screen) {
      case 'exchange':
        return <ExchangeScreen showToast={showToast} />;
      case 'publicMarket':
        return <PublicMarketScreen showToast={showToast} />;
      // case 'salesInvoice': return <SalesScreen showToast={showToast} />;
      // case 'purchaseInvoice': return <PurchaseScreen showToast={showToast} />;
      default:
        return (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              صفحه «{screen}» اینجا باز می‌شود.
              {'\n\n'}
              (برای فعال‌سازی، کامپوننت واقعی را در BotUI.tsx import کن)
            </Text>
          </View>
        );
    }
  };

  // ─── UI
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {screen === 'bot' ? (
        // ─── حالت چت
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.chatArea}
            contentContainerStyle={{ padding: 12 }}
          >
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.from === 'bot' ? styles.botBubble : styles.meBubble,
                ]}
              >
                <Text style={m.from === 'bot' ? styles.botText : styles.meText}>
                  {m.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.inputBar}>
            <TouchableOpacity
              onPress={async () => {
        if (listening) {
          setListening(false);
          showToast?.('میکروفون خاموش شد');
        } else {
          setListening(true);
          showToast?.('🎤 در حال گوش دادن...');
          try {
            await startSTT(
              (partial) => {},
              (finalText) => {
                setListening(false);
                showToast?.('📝 شنیدم: ' + finalText);
                // اینجا متن به ربات ارسال می‌شود
                if (typeof onSend === 'function') onSend(finalText);
              },
              (err) => {
                setListening(false);
                showToast?.('❌ خطا: ' + err);
              }
            );
          } catch(e) {
            setListening(false);
          }
        }
      }}
              style={[styles.micBtn, listening && styles.micOn]}
            >
              <Text style={styles.micIcon}>{listening ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
            <TextInput accessibilityLabel="بگو یا بنویس..."
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="بگو یا بنویس..."
              placeholderTextColor="#64748b"
              onSubmitEditing={() => {
                const _t = input.trim();
                if (!_t) return;
                const _map: Record<string, string> = { 
                  'مدیریت': 'mgr', 'مدیر': 'mgr',
                  'فروش': 'order', 'سفارش': 'order', 'داشبورد': 'order', 
                  'خرید': 'purchase', 'صرافی': 'exchange', 
                  'بازار': 'publicMarket', 'انبار': 'inventory', 
                  'هزینه': 'expenses', 'کارمند': 'employees', 
                  'سود': 'profit', 'بانک': 'bankMatch', 'تنظیمات': 'settings'
                };
                let _matched = false;
                for (const [_k, _v] of Object.entries(_map)) {
                  if (_t.includes(_k)) {
                    try { (globalThis as any).__nav?.setTab(_v); } catch(e){}
                    _matched = true;
                    break;
                  }
                }
                if (!_matched) {
                  try { handleUserText(input); } catch(e){}
                }
                setInput('');
              }}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={() => { handleUserText(input); setInput(''); }}
              style={styles.sendBtn}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        // ─── حالت نمایش صفحه
        <>
          <View style={styles.screenHeader}>
            <TouchableOpacity accessibilityLabel="ربات"
              onPress={() => { setScreen('bot'); setSub(null); botSay('برگشتیم.'); }}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>← ربات</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>
              {APP_KNOWLEDGE.tabs[screen]?.label || screen}
              {sub ? ' › ' + (APP_KNOWLEDGE.tabs[screen]?.subs.find((s: any) => s.key === sub)?.label || sub) : ''}
            </Text>
          </View>

          <View style={{ flex: 1 }}>{renderScreen()}</View>

          {/* نوار ورودی پایین در حالت صفحه */}
          <View style={styles.inputBarMini}>
            <TouchableOpacity
              onPress={() => { setScreen('bot'); setSub(null); }}
              style={styles.micMini}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>💬</Text>
            </TouchableOpacity>
            <Text style={{ color: '#94a3b8', flex: 1, fontSize: 12, textAlign: 'right' }}>
              برای گفتگو با ربات، «← ربات» را بزن
            </Text>
          
      {/* toggleBigMicBtn — میکروفون بزرگ شناور */}
      <TouchableOpacity
        onPress={toggleBigMic}
        style={{
          position: 'absolute',
          bottom: 160,
          right: 14,
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: listening ? '#dc2626' : '#7c3aed',
          borderWidth: 2,
          borderColor: '#d4af37',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          elevation: 10,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 32 }}>{listening ? '⏹' : '🎤'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleBigMic}
        style={{ position: 'absolute', bottom: 160, right: 14, width: 72, height: 72, borderRadius: 36, backgroundColor: listening ? '#dc2626' : '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}
      >
        <Text style={{ color: '#fff', fontSize: 32 }}>{listening ? '⏹' : '🎤'}</Text>
      </TouchableOpacity>
</View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628' },
  chatArea: { flex: 1 },
  bubble: {
    maxWidth: '85%', borderRadius: 14, padding: 10, marginVertical: 4,
  },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#1e293b' },
  meBubble:  { alignSelf: 'flex-end',   backgroundColor: '#7c3aed' },
  botText: { color: '#e2e8f0', fontSize: 14, lineHeight: 22 },
  meText:  { color: '#fff', fontSize: 14, lineHeight: 22 },
  inputBar: { 
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#0f2438',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginBottom: 90 },
  input: {
    flex: 1, color: '#fff', fontSize: 14,
    backgroundColor: '#1e293b', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 6,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  micOn: { backgroundColor: '#dc2626' },
  micIcon: { fontSize: 20 },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7c3aed',
    justifyContent: 'center', alignItems: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18 },
  screenHeader: {
    flexDirection: 'row-reverse', alignItems: 'center',
    padding: 10, backgroundColor: '#0f2438',
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  backBtn: {
    backgroundColor: '#7c3aed', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8,
  },
  backText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  screenTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  placeholderText: { color: '#94a3b8', textAlign: 'center', fontSize: 13, lineHeight: 22 },
  inputBarMini: { 
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#0f2438',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginBottom: 90 },
  micMini: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#7c3aed',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
});
