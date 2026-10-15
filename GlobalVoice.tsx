// ═══════════════════════════════════════════════════════════
//  🤖 GlobalVoice — دو-حالته (وب + موبایل)
// ═══════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Platform, KeyboardAvoidingView, Animated,
  PanResponder,
} from 'react-native';

// ─── کتابخانه‌های صدا (import استاتیک)
import * as Speech from 'expo-speech';

const isWeb = Platform.OS === 'web';


let recognition: any = null;

// ═══════════════════════════════════════════════════════════
//  ابزار DOM (فقط وب)
// ═══════════════════════════════════════════════════════════
function norm(s: string): string {
  return (s || '').toString().trim().replace(/[\u200c\u200f]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
}
function scanAll(): any[] {
  if (!isWeb || typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll('[aria-label]')) as any[];
}
function isVisible(el: any): boolean {
  if (!el) return false;
  try { const r = el.getBoundingClientRect?.(); if (!r) return true; return r.width > 0 || r.height > 0; } catch { return true; }
}
function isInput(el: any): boolean { const t = (el?.tagName || '').toLowerCase(); return t === 'input' || t === 'textarea'; }
function visibleLabels(): { label: string; el: any; isInput: boolean }[] {
  const out: any[] = []; const seen = new Set<string>();
  for (const el of scanAll()) {
    if (!isVisible(el)) continue;
    const lbl = (el.getAttribute?.('aria-label') || '').trim();
    if (!lbl || seen.has(lbl)) continue;
    seen.add(lbl); out.push({ label: lbl, el, isInput: isInput(el) });
  }
  return out;
}
function clickEl(el: any): boolean {
  if (!el) return false;
  try {
    el.scrollIntoView?.({ block: 'center' });
    const r = el.getBoundingClientRect?.();
    const cx = r ? r.left + r.width / 2 : 0;
    const cy = r ? r.top + r.height / 2 : 0;
    ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(tp => {
      try {
        const ev = tp.startsWith('pointer')
          ? new PointerEvent(tp,{bubbles:true,cancelable:true,clientX:cx,clientY:cy,pointerType:'mouse'})
          : new MouseEvent(tp,{bubbles:true,cancelable:true,clientX:cx,clientY:cy});
        el.dispatchEvent(ev);
      } catch {}
    });
    try { el.click(); } catch {}
    return true;
  } catch { return false; }
}
function fillEl(el: any, value: string): boolean {
  if (!el) return false;
  try {
    el.focus?.();
    const proto = el.tagName === 'TEXTAREA'
      ? (window as any).HTMLTextAreaElement?.prototype
      : (window as any).HTMLInputElement?.prototype;
    const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent?.(new Event('input', { bubbles: true }));
    el.dispatchEvent?.(new Event('change', { bubbles: true }));
    return true;
  } catch { return false; }
}
function findBestButton(needle: string): { el: any; label: string } | null {
  const n = norm(needle);
  if (!n || n.length < 2) return null;
  const all = visibleLabels().filter(x => !x.isInput);
  for (const x of all) if (norm(x.label) === n) return { el: x.el, label: x.label };
  for (const x of all) if (norm(x.label).includes(n)) return { el: x.el, label: x.label };
  for (const x of all) { const l = norm(x.label); if (l.length >= 3 && n.includes(l)) return { el: x.el, label: x.label }; }
  const nWords = n.split(' ').filter(w => w.length >= 2);
  let best: any = null, bestScore = 0;
  for (const x of all) {
    const l = norm(x.label); const lWords = l.split(' ').filter(w => w.length >= 2);
    let score = 0;
    for (const w of nWords) for (const lw of lWords) {
      if (w === lw) score += 3;
      else if (w.length >= 3 && (w.includes(lw) || lw.includes(w))) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = { el: x.el, label: x.label }; }
  }
  if (bestScore >= 2) return best;
  return null;
}
function findBestInput(): any {
  const all = visibleLabels();
  for (const x of all) if (x.isInput && !(x.el as any).value) return x.el;
  for (const x of all) if (x.isInput) return x.el;
  return null;
}

// ═══════════════════════════════════════════════════════════
//  دانش
// ═══════════════════════════════════════════════════════════
const TABS: Record<string, string[]> = {
  exchange:     ['صرافی', 'صراف'],
  publicMarket: ['بازار عمومی', 'بازار'],
  order:        ['سفارش', 'فروش', 'خانه'],
  purchase:     ['خرید'],
  inventory:    ['انبار', 'موجودی'],
  expenses:     ['هزینه‌ها', 'هزینه', 'خرج'],
  employees:    ['کارمندان', 'کارمند'],
  profit:       ['سود', 'درآمد'],
  bankMatch:    ['بانک', 'پیامک', 'اس ام اس'],
  botLearning:  ['آموزش'],
  manualEntry:  ['دستیار'],
  mgr:          ['مدیریت'],
  print:        ['پرینت'],
};

const SUBS: Record<string, string[]> = {
  list:       ['معاملات', 'لیست معاملات'],
  form:       ['معامله جدید', 'فرم معامله'],
  boxes:      ['صندوق‌ها', 'صندوق ها', 'صندوقها', 'صندوق'],
  hawalas:    ['حواله‌جات', 'حواله جات', 'حوالهجات', 'حواله'],
  checks:     ['چک‌ها', 'چک ها', 'چکها', 'چک'],
  customers:  ['مشتریان', 'مشتری ها', 'مشتریها', 'مشتری'],
  partners:   ['شریکان', 'شرکا', 'شریک ها', 'شریک'],
  ledger:     ['کاردکس', 'دفتر کل'],
  statement:  ['پرینت حساب', 'صورتحساب', 'صورت حساب'],
  liveMarket: ['بازار زنده'],
  myGroups:   ['شبکه‌ها', 'شبکه ها', 'شبکه', 'گروه'],
};

const FLOWS: { words: string[]; steps: any[] }[] = [
  { words: ['فاکتور فروش', 'فروش جدید'], steps: [{t:'tab',v:'order'}, {t:'click',m:['فاکتور جدید','فاکتور فروش','فروش جدید','جدید','+']}] },
  { words: ['فاکتور خرید', 'خرید جدید'], steps: [{t:'tab',v:'purchase'}, {t:'click',m:['فاکتور جدید','فاکتور خرید','خرید جدید','جدید','+']}] },
  { words: ['معامله جدید'], steps: [{t:'sub',v:'form'}] },
  { words: ['حواله جدید', 'ثبت حواله'], steps: [{t:'sub',v:'hawalas'}, {t:'click',m:['حواله جدید','ثبت حواله','افزودن','جدید','+']}] },
  { words: ['صندوق جدید', 'افزودن صندوق'], steps: [{t:'sub',v:'boxes'}, {t:'click',m:['افزودن','صندوق جدید','جدید','+']}] },
  { words: ['مشتری جدید', 'ثبت مشتری'], steps: [{t:'sub',v:'customers'}, {t:'click',m:['افزودن','مشتری جدید','جدید','+']}] },
  { words: ['شریک جدید'], steps: [{t:'sub',v:'partners'}, {t:'click',m:['افزودن','شریک جدید','جدید','+']}] },
  { words: ['چک جدید', 'ثبت چک'], steps: [{t:'sub',v:'checks'}, {t:'click',m:['چک جدید','افزودن','جدید','+']}] },
  { words: ['گزارش سود', 'سود و زیان'], steps: [{t:'tab',v:'profit'}] },
  { words: ['گزارش انبار', 'موجودی انبار'], steps: [{t:'tab',v:'inventory'}] },
];

function goTab(key: string) {
  const nav = (globalThis as any).__nav;
  if (nav?.setTab) { try { nav.setTab(key); return true; } catch { return false; } }
  return false;
}

async function goSub(key: string) {
  goTab('exchange');
  await new Promise(r => setTimeout(r, 200));
  try {
    const setSub = (globalThis as any).__exchangeSetSub;
    if (setSub) { setSub(key); await new Promise(r => setTimeout(r, 150)); return true; }
  } catch {}
  const words = SUBS[key] || [];
  for (const w of words) {
    const hit = findBestButton(w);
    if (hit) { clickEl(hit.el); return true; }
  }
  return false;
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
//  🔊 TTS — دو-حالته
// ═══════════════════════════════════════════════════════════
function speak(text: string) {
  if (!text) return;
  if (isWeb) {
    try {
      const synth = (window as any).speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const voices = synth.getVoices() || [];
      const fa = voices.find((v: any) => (v.lang || '').toLowerCase().startsWith('fa'));
      const u = new SpeechSynthesisUtterance(text);
      if (fa) { u.voice = fa; u.lang = 'fa-IR'; } else { u.lang = 'fa-IR'; }
      u.rate = 1.05;
      synth.speak(u);
    } catch {}
  } else {
    // APK نیتیو
    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'fa-IR',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });
      console.log('🔊 TTS:', text.slice(0, 40));
    } catch (e) { console.log('❌ TTS err:', e); }
  }
}

// ═══════════════════════════════════════════════════════════
export default function GlobalVoice({ showToast }: any) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>([
    { from: 'bot', text: 'سلام! بگو «فاکتور فروش» یا «صندوق‌ها».' },
  ]);
  const [liveCount, setLiveCount] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const keepAlive = useRef(false);
  const lastReplyTime = useRef(0);

  const pan = useRef(new Animated.ValueXY({ x: 16, y: 400 })).current;
  const isDragging = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => { isDragging.current = false; },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) {
          isDragging.current = true;
          pan.setValue({ x: Math.max(0, g.moveX - 25), y: Math.max(0, g.moveY - 25) });
        }
      },
      onPanResponderRelease: () => { setTimeout(() => { isDragging.current = false; }, 100); },
    })
  ).current;

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages, open]);

  useEffect(() => {
    if (!isWeb) return;
    const tick = () => { try { setLiveCount(visibleLabels().length); } catch {} };
    tick();
    const iv = setInterval(tick, 800);
    return () => clearInterval(iv);
  }, [open]);

  useEffect(() => {
    if (!isWeb || !open || !listening) return;
    const iv = setInterval(() => { if (keepAlive.current && recognition) try { recognition.stop(); } catch {} }, 15000);
    return () => clearInterval(iv);
  }, [open, listening]);

  // ─── Voice setup (نیتیو)
  useEffect(() => {
    if (isWeb || !Voice) return;
    Voice.onSpeechStart = () => { setListening(true); setStatus('🎤 آماده'); };
    Voice.onSpeechEnd = () => { setListening(false); setStatus(''); };
    Voice.onSpeechResults = (e: any) => {
      const text = e.value?.[0] || '';
      if (text) {
        setMessages((prev) => [...prev, { from: 'me', text: '🎤 ' + text }]);
        setTimeout(() => runCommand(text), 20);
      }
    };
    Voice.onSpeechError = (e: any) => {
      console.log('Voice error', e);
      setListening(false);
      setStatus('');
    };
    return () => {
      try { Voice.destroy().then(Voice.removeAllListeners); } catch {}
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  STT
  // ═══════════════════════════════════════════════════════════
  const startRecognition = async () => {
    if (isWeb) startRecognitionWeb();
    else await startRecognitionNative();
  };

  const startRecognitionWeb = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus('❌ STT نداره'); return; }
    if (keepAlive.current && recognition) return;
    keepAlive.current = true;

    const build = () => {
      try {
        const r = new SR();
        r.lang = 'fa-IR';
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;
        r.onstart = () => { setStatus('🎤 آماده'); setListening(true); };
        r.onresult = (e: any) => {
          let final = '', interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t; else interim += t;
          }
          if (interim) setTranscript(interim);
          if (final && final.trim()) {
            setTranscript('');
            const text = final.trim();
            setMessages((prev) => [...prev, { from: 'me', text: '🎤 ' + text }]);
            setTimeout(() => runCommand(text), 20);
          }
        };
        r.onerror = (e: any) => {
          if (e.error === 'not-allowed') { keepAlive.current = false; setListening(false); setStatus('❌ میکروفون'); }
          else if (e.error === 'no-speech') setStatus('🎤 آماده');
        };
        r.onend = () => {
          if (keepAlive.current) {
            setTimeout(() => { if (!keepAlive.current) return; try { r.start(); } catch { build(); } }, 200);
          } else { setListening(false); setStatus(''); }
        };
        r.start();
        recognition = r;
      } catch (e: any) { setStatus('⚠️ ' + e.message); if (keepAlive.current) setTimeout(build, 600); }
    };
    build();
  };

  const startRecognitionNative = async () => {
    setStatus('🎤 میکروفون فعلاً غیرفعال است');
  };

  const stopRecognition = async () => {
    if (isWeb) {
      keepAlive.current = false;
      try { recognition?.stop(); recognition?.abort?.(); } catch {}
      recognition = null;
    } else {
      try { await Voice?.stop(); await Voice?.cancel(); } catch {}
    }
    setListening(false);
    setStatus('');
  };

  const reply = (text: string) => {
    lastReplyTime.current = Date.now();
    setMessages((prev) => [...prev, { from: 'bot', text }]);
    speak(text);
  };

  const autoHideAfterAction = () => {
    if (!open) return;
    setTimeout(() => {
      if (Date.now() - lastReplyTime.current >= 400) {
        setOpen(false);
        setTimeout(() => { if (keepAlive.current && !listening) startRecognition(); }, 300);
      }
    }, 1200);
  };

  // ═══════════════════════════════════════════════════════════
  //  مغز
  // ═══════════════════════════════════════════════════════════
  const runCommand = async (text: string) => {
    const t = (text || '').trim();
    if (!t) return;
    const low = norm(t);

    if (low.includes('کمک') || low.includes('چیکار')) {
      reply('بگو: فاکتور فروش، صندوق‌ها، مشتریان، حواله جدید، برو انبار.');
      return;
    }
    if (low.includes('چی می بینی') || low.includes('چی میبینی') || low.includes('کجایم')) {
      const labels = visibleLabels().map(x => x.label);
      reply('(' + labels.length + '): ' + (labels.slice(0, 12).join('، ') || 'خالی'));
      return;
    }
    if (low === 'لغو' || low === 'کنسل' || low.includes('لغو کن')) {
      const b = findBestButton('لغو') || findBestButton('انصراف') || findBestButton('بستن');
      if (b) { clickEl(b.el); reply('لغو شد.'); } else reply('لغوی نبود.');
      return;
    }
    if (low === 'برگرد' || low === 'بازگشت' || low === 'عقب') {
      const b = findBestButton('برگشت') || findBestButton('بازگشت');
      if (b) { clickEl(b.el); reply('برگشتم.'); } else reply('دکمه برگشت نبود.');
      return;
    }
    if (low === 'ثبت' || low === 'ثبت کن' || low === 'تایید' || low === 'ذخیره' || low === 'بله') {
      const b = findBestButton('ثبت') || findBestButton('تایید') || findBestButton('ذخیره') || findBestButton('بله');
      if (b) { clickEl(b.el); reply('ثبت شد.'); return; }
      reply('دکمه ثبت نبود.');
      return;
    }

    let found = findBestButton(t);
    if (found) { clickEl(found.el); reply('زدم روی: ' + found.label); autoHideAfterAction(); return; }

    for (const flow of FLOWS) {
      for (const w of flow.words) {
        if (low === norm(w) || low.includes(norm(w))) {
          reply('باشه، ' + w + ' ...');
          for (const step of flow.steps) {
            if (step.t === 'tab') { goTab(step.v); await wait(180); }
            else if (step.t === 'sub') { await goSub(step.v); await wait(200); }
            else if (step.t === 'click') {
              let hit = null;
              for (const m of step.m) { hit = findBestButton(m); if (hit) break; }
              if (hit) { clickEl(hit.el); await wait(120); }
            }
          }
          reply('✅ ' + w + ' آماده شد.');
          autoHideAfterAction();
          return;
        }
      }
    }

    for (const key of Object.keys(TABS)) {
      for (const w of TABS[key]) {
        if (low === norm(w) || low === 'برو ' + norm(w) || low.includes('برو ' + norm(w))) {
          goTab(key); reply('رفتم ' + w); autoHideAfterAction(); return;
        }
      }
    }

    for (const key of Object.keys(SUBS)) {
      for (const w of SUBS[key]) {
        if (low === norm(w) || low.includes(norm(w))) {
          await goSub(key); reply('رفتم ' + w); autoHideAfterAction(); return;
        }
      }
    }

    const words = t.split(/\s+/).filter(w => w.length >= 3).sort((a, b) => b.length - a.length);
    for (const w of words) {
      const f = findBestButton(w);
      if (f) { clickEl(f.el); reply('زدم روی: ' + f.label); autoHideAfterAction(); return; }
    }

    const inp = findBestInput();
    if (inp) { fillEl(inp, t); reply('نوشتم: ' + t); return; }

    reply('«' + t + '» رو نفهمیدم.');
  };

  const handleUserInput = (t: string) => {
    const x = t.trim();
    if (!x) return;
    setMessages((prev) => [...prev, { from: 'me', text: x }]);
    runCommand(x);
  };

  const onMicPress = () => {
    if (!open) {
      setOpen(true);
      if (!listening) startRecognition();
    } else {
      if (!listening) startRecognition();
    }
  };

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.floatBtn, { left: pan.x, top: pan.y }]}
      >
        <TouchableOpacity
          onPress={() => { if (!isDragging.current) onMicPress(); }}
          style={styles.floatBtnInner}
          activeOpacity={0.85}
        >
          <Text style={styles.floatIcon}>{listening ? '🔴' : (open ? '🔽' : '🎤')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {open && (
        <View style={styles.panelWrap} pointerEvents="box-none">
          <KeyboardAvoidingView style={styles.panel} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>🔽</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => listening ? stopRecognition() : startRecognition()}
                style={[styles.toggleBtn, listening && styles.toggleOn]}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                  {listening ? '⏹' : '🎤'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.title}>🤖 {liveCount} دکمه</Text>
            </View>

            {status ? (
              <View style={styles.statusBar}><Text style={styles.statusText}>{status}</Text></View>
            ) : null}

            <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={{ padding: 4 }}>
              {messages.slice(-10).map((m: any, i: number) => (
                <View key={i} style={[styles.bubble, m.from === 'bot' ? styles.botB : styles.meB]}>
                  <Text style={styles.txt}>{m.text}</Text>
                </View>
              ))}
              {transcript ? (
                <View style={[styles.bubble, styles.meB, { opacity: 0.6 }]}>
                  <Text style={styles.txt}>🎤 {transcript}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.bar}>
              <TextInput
                style={styles.inp}
                value={input}
                onChangeText={setInput}
                placeholder="بنویس..."
                placeholderTextColor="#64748b"
                onSubmitEditing={() => { handleUserInput(input); setInput(''); }}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={() => { handleUserInput(input); setInput(''); }} style={styles.send}>
                <Text style={{ color: '#fff', fontSize: 14 }}>➤</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floatBtn: {
    position: 'absolute',
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#7c3aed',
    zIndex: 9999, elevation: 20,
    borderWidth: 2, borderColor: '#d4af37',
    justifyContent: 'center', alignItems: 'center',
  },
  floatBtnInner: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    width: '100%', height: '100%',
  },
  floatIcon: { fontSize: 22 },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', zIndex: 9998 },
  panel: {
    flex: 1, backgroundColor: 'rgba(10,22,40,0.96)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 2, borderColor: '#7c3aed', overflow: 'hidden',
  },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#0f2438',
  },
  title: { color: '#fff', fontSize: 12, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  closeBtn: { padding: 4 },
  closeText: { color: '#94a3b8', fontSize: 14 },
  toggleBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#334155', marginLeft: 4 },
  toggleOn: { backgroundColor: '#dc2626' },
  statusBar: { backgroundColor: '#0f2438', paddingHorizontal: 10, paddingVertical: 2 },
  statusText: { color: '#94a3b8', fontSize: 9 },
  chat: { flex: 1 },
  bubble: { maxWidth: '88%', borderRadius: 10, padding: 6, marginVertical: 2 },
  botB: { alignSelf: 'flex-start', backgroundColor: '#1e293b' },
  meB: { alignSelf: 'flex-end', backgroundColor: '#7c3aed' },
  txt: { color: '#e2e8f0', fontSize: 12, lineHeight: 18 },
  bar: {
    flexDirection: 'row-reverse', alignItems: 'center',
    padding: 4, borderTopWidth: 1, borderTopColor: '#334155',
  },
  inp: { flex: 1, color: '#fff', backgroundColor: '#1e293b', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: 5, fontSize: 12 },
  send: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
});
