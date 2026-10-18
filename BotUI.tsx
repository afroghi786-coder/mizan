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
              onSubmitEditing={() => { handleUserText(input); setInput(''); }}
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
    marginBottom: 90,
  },
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
    marginBottom: 90,
  },
  micMini: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#7c3aed',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
});
