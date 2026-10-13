const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. lib.learning.ts — سیستم یادگیری
// ═══════════════════════════════════════════
const learning = `// lib.learning.ts — یادگیری و آموزش ربات
import AsyncStorage from '@react-native-async-storage/async-storage';
import { norm } from './lib.local.nlu';

const LESSONS_KEY = '@mizan_bot_lessons_v1';
const ALIAS_KEY = '@mizan_bot_aliases_v1';
const FAILS_KEY = '@mizan_bot_fails_v1';

// ═══════════════════════════════════════════
// درس‌ها: کاربر به ربات یاد می‌ده
// ═══════════════════════════════════════════
export interface Lesson {
  id: string;
  phrase: string;      // «احمد صندوق»
  intent: string;      // 'open_box'
  params: any;         // { name: 'احمد' }
  usage: number;
  createdAt: number;
}

export async function getLessons(): Promise<Lesson[]> {
  try {
    const r = await AsyncStorage.getItem(LESSONS_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export async function addLesson(l: Lesson): Promise<void> {
  const list = await getLessons();
  const idx = list.findIndex(x => norm(x.phrase) === norm(l.phrase));
  if (idx >= 0) list[idx] = l;
  else list.push(l);
  await AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(list.slice(-200)));
}

export async function removeLesson(id: string): Promise<void> {
  const list = await getLessons();
  await AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(list.filter(x => x.id !== id)));
}

export async function clearLessons(): Promise<void> {
  await AsyncStorage.removeItem(LESSONS_KEY);
}

// ─── تطبیق درس (fuzzy)
export async function matchLesson(text: string): Promise<Lesson | null> {
  const list = await getLessons();
  const t = norm(text);
  let best: Lesson | null = null;
  let bestScore = 0;
  
  for (const l of list) {
    const p = norm(l.phrase);
    if (p === t) return l;
    if (t.includes(p) || p.includes(t)) {
      const s = Math.min(p.length, t.length) / Math.max(p.length, t.length);
      if (s > bestScore) { bestScore = s; best = l; }
    }
  }
  
  return bestScore > 0.6 ? best : null;
}

// ═══════════════════════════════════════════
// مترادف‌ها: کلمات جایگزین
// ═══════════════════════════════════════════
export interface Alias {
  id: string;
  from: string;   // «کاردکس»
  to: string;     // «صندوق»
  createdAt: number;
}

export async function getAliases(): Promise<Alias[]> {
  try {
    const r = await AsyncStorage.getItem(ALIAS_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export async function addAlias(from: string, to: string): Promise<void> {
  const list = await getAliases();
  const idx = list.findIndex(x => norm(x.from) === norm(from));
  if (idx >= 0) list[idx] = { ...list[idx], to };
  else list.push({ id: 'a_' + Date.now(), from, to, createdAt: Date.now() });
  await AsyncStorage.setItem(ALIAS_KEY, JSON.stringify(list));
}

export async function removeAlias(id: string): Promise<void> {
  const list = await getAliases();
  await AsyncStorage.setItem(ALIAS_KEY, JSON.stringify(list.filter(x => x.id !== id)));
}

// ─── اعمال مترادف‌ها
export async function applyAliases(text: string): Promise<string> {
  const aliases = await getAliases();
  let result = text;
  for (const a of aliases) {
    const re = new RegExp(a.from, 'g');
    result = result.replace(re, a.to);
  }
  return result;
}

// ═══════════════════════════════════════════
// لاگ شکست‌ها: چیزی که نفهمید
// ═══════════════════════════════════════════
export interface FailLog {
  id: string;
  text: string;
  count: number;
  lastAt: number;
  taught?: boolean;
}

export async function getFails(): Promise<FailLog[]> {
  try {
    const r = await AsyncStorage.getItem(FAILS_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export async function logFail(text: string): Promise<void> {
  const list = await getFails();
  const t = norm(text);
  const idx = list.findIndex(x => norm(x.text) === t);
  if (idx >= 0) {
    list[idx].count++;
    list[idx].lastAt = Date.now();
  } else {
    list.push({ id: 'f_' + Date.now(), text, count: 1, lastAt: Date.now() });
  }
  await AsyncStorage.setItem(FAILS_KEY, JSON.stringify(list.slice(-100)));
}

export async function clearFails(): Promise<void> {
  await AsyncStorage.removeItem(FAILS_KEY);
}

export async function markFailTaught(id: string): Promise<void> {
  const list = await getFails();
  const idx = list.findIndex(x => x.id === id);
  if (idx >= 0) list[idx].taught = true;
  await AsyncStorage.setItem(FAILS_KEY, JSON.stringify(list));
}

// ═══════════════════════════════════════════
// آمار
// ═══════════════════════════════════════════
export async function getStats() {
  const [lessons, aliases, fails] = await Promise.all([
    getLessons(), getAliases(), getFails(),
  ]);
  return {
    lessons: lessons.length,
    aliases: aliases.length,
    fails: fails.length,
    untaught: fails.filter(f => !f.taught).length,
  };
}
`;

fs.writeFileSync('lib.learning.ts', learning, 'utf8');
console.log('✅ lib.learning.ts');

// ═══════════════════════════════════════════
// ۲. لیست intent های ممکن برای آموزش
// ═══════════════════════════════════════════
const intentsList = `// lib.learning.intents.ts — لیست intent های قابل آموزش
export const LEARNABLE_INTENTS = [
  { id: 'open_box', label: '📦 باز کردن صندوق', example: 'صندوق احمد' },
  { id: 'list_boxes', label: '📋 لیست صندوق‌ها', example: 'همه صندوق‌ها' },
  { id: 'deposit', label: '➕ واریز به صندوق', example: '۵۰۰ به احمد اضافه' },
  { id: 'withdraw', label: '➖ برداشت از صندوق', example: '۱۰۰ از احمد کم' },
  { id: 'balance', label: '💰 مانده مشتری', example: 'مانده رضا' },
  { id: 'open_customer', label: '👤 باز کردن مشتری', example: 'مشتری رضا' },
  { id: 'list_customers', label: '👥 لیست مشتریان', example: 'همه مشتری‌ها' },
  { id: 'open_invoice', label: '📄 باز کردن فاکتور', example: 'فاکتور ۱۲۳۴' },
  { id: 'today_profit', label: '📊 سود و گزارش', example: 'سود امروز' },
  { id: 'help', label: '❓ راهنما', example: 'راهنما' },
];
`;

fs.writeFileSync('lib.learning.intents.ts', intentsList, 'utf8');
console.log('✅ lib.learning.intents.ts');

// ═══════════════════════════════════════════
// ۳. LearningScreen.tsx
// ═══════════════════════════════════════════
const learnScreen = `// LearningScreen.tsx — آموزش ربات
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Modal, ActivityIndicator, Alert
} from 'react-native';
import {
  getLessons, addLesson, removeLesson, clearLessons,
  getAliases, addAlias, removeAlias,
  getFails, clearFails, markFailTaught,
  getStats, Lesson, Alias, FailLog,
} from './lib.learning';
import { LEARNABLE_INTENTS } from './lib.learning.intents';

export default function LearningScreen({ showToast }: any) {
  const [tab, setTab] = useState<'lessons' | 'aliases' | 'fails' | 'stats'>('lessons');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [fails, setFails] = useState<FailLog[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Modal
  const [newLessonModal, setNewLessonModal] = useState(false);
  const [newAliasModal, setNewAliasModal] = useState(false);
  const [lessonPhrase, setLessonPhrase] = useState('');
  const [lessonIntent, setLessonIntent] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [aliasFrom, setAliasFrom] = useState('');
  const [aliasTo, setAliasTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [l, a, f, s] = await Promise.all([getLessons(), getAliases(), getFails(), getStats()]);
      setLessons(l); setAliases(a); setFails(f); setStats(s);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveLesson = async () => {
    if (!lessonPhrase.trim() || !lessonIntent.trim()) {
      showToast?.('عبارت و intent لازمه', true);
      return;
    }
    await addLesson({
      id: 'l_' + Date.now(),
      phrase: lessonPhrase.trim(),
      intent: lessonIntent,
      params: lessonName ? { name: lessonName.trim() } : {},
      usage: 0,
      createdAt: Date.now(),
    });
    setLessonPhrase(''); setLessonIntent(''); setLessonName('');
    setNewLessonModal(false);
    await load();
    showToast?.('✅ یاد گرفت');
  };

  const saveAlias = async () => {
    if (!aliasFrom.trim() || !aliasTo.trim()) {
      showToast?.('هر دو فیلد لازمه', true);
      return;
    }
    await addAlias(aliasFrom.trim(), aliasTo.trim());
    setAliasFrom(''); setAliasTo('');
    setNewAliasModal(false);
    await load();
    showToast?.('✅ مترادف اضافه شد');
  };

  const teachFromFail = async (f: FailLog) => {
    setLessonPhrase(f.text);
    setNewLessonModal(true);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🎓 آموزش ربات</Text>
      </View>

      {/* Tab Bar */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'lessons' && s.tabActive]} onPress={() => setTab('lessons')}>
          <Text style={[s.tabTxt, tab === 'lessons' && s.tabTxtActive]}>📚 درس‌ها ({lessons.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'aliases' && s.tabActive]} onPress={() => setTab('aliases')}>
          <Text style={[s.tabTxt, tab === 'aliases' && s.tabTxtActive]}>🔤 مترادف‌ها ({aliases.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'fails' && s.tabActive]} onPress={() => setTab('fails')}>
          <Text style={[s.tabTxt, tab === 'fails' && s.tabTxtActive]}>❓ نفهمید ({fails.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'stats' && s.tabActive]} onPress={() => setTab('stats')}>
          <Text style={[s.tabTxt, tab === 'stats' && s.tabTxtActive]}>📊 آمار</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 12 }} keyboardShouldPersistTaps="handled">

        {/* ═══ LESSONS ═══ */}
        {tab === 'lessons' && (
          <>
            <Text style={s.hint}>📚 به ربات یاد بده «این عبارت یعنی این کار»</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setNewLessonModal(true)}>
              <Text style={s.addBtnTxt}>➕ افزودن درس جدید</Text>
            </TouchableOpacity>
            {lessons.length === 0 ? (
              <Text style={s.empty}>هنوز درسی نیست</Text>
            ) : (
              lessons.map((l) => (
                <View key={l.id} style={s.card}>
                  <Text style={s.cardTitle}>💬 «{l.phrase}»</Text>
                  <Text style={s.cardSub}>🎯 {LEARNABLE_INTENTS.find(x => x.id === l.intent)?.label || l.intent}</Text>
                  {l.params?.name ? <Text style={s.cardSub}>👤 {l.params.name}</Text> : null}
                  <TouchableOpacity style={s.delBtn} onPress={async () => { await removeLesson(l.id); await load(); }}>
                    <Text style={s.delTxt}>🗑 حذف</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {lessons.length > 0 && (
              <TouchableOpacity style={[s.addBtn, { backgroundColor: '#dc2626', marginTop: 12 }]} onPress={async () => {
                Alert.alert('پاک کردن همه؟', '', [
                  { text: 'لغو', style: 'cancel' },
                  { text: 'بله', onPress: async () => { await clearLessons(); await load(); } },
                ]);
              }}>
                <Text style={s.addBtnTxt}>🗑 پاک کردن همه</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ═══ ALIASES ═══ */}
        {tab === 'aliases' && (
          <>
            <Text style={s.hint}>🔤 کلمات جایگزین: «این» یعنی «اون»</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setNewAliasModal(true)}>
              <Text style={s.addBtnTxt}>➕ افزودن مترادف</Text>
            </TouchableOpacity>
            {aliases.length === 0 ? (
              <Text style={s.empty}>هنوز مترادفی نیست</Text>
            ) : (
              aliases.map((a) => (
                <View key={a.id} style={s.card}>
                  <Text style={s.cardTitle}>«{a.from}» → «{a.to}»</Text>
                  <TouchableOpacity style={s.delBtn} onPress={async () => { await removeAlias(a.id); await load(); }}>
                    <Text style={s.delTxt}>🗑 حذف</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {/* ═══ FAILS ═══ */}
        {tab === 'fails' && (
          <>
            <Text style={s.hint}>❓ دستوراتی که ربات نفهمید — روی هرکدوم بزن و بهش یاد بده</Text>
            {fails.length === 0 ? (
              <Text style={s.empty}>عالی! هیچ چیزی نفهمیده نشده</Text>
            ) : (
              fails.sort((a, b) => b.count - a.count).map((f) => (
                <TouchableOpacity key={f.id} style={[s.card, f.taught && { opacity: 0.5 }]} onPress={() => teachFromFail(f)}>
                  <Text style={s.cardTitle}>💬 «{f.text}»</Text>
                  <Text style={s.cardSub}>🔴 {f.count} بار تکرار</Text>
                  {f.taught ? <Text style={[s.cardSub, { color: '#10b981' }]}>✅ آموزش داده شد</Text> : <Text style={[s.cardSub, { color: '#f59e0b' }]}>⚠️ آموزش بده</Text>}
                </TouchableOpacity>
              ))
            )}
            {fails.length > 0 && (
              <TouchableOpacity style={[s.addBtn, { backgroundColor: '#dc2626', marginTop: 12 }]} onPress={async () => {
                Alert.alert('پاک کردن همه؟', '', [
                  { text: 'لغو', style: 'cancel' },
                  { text: 'بله', onPress: async () => { await clearFails(); await load(); } },
                ]);
              }}>
                <Text style={s.addBtnTxt}>🗑 پاک کردن</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ═══ STATS ═══ */}
        {tab === 'stats' && (
          <>
            <View style={s.statBox}>
              <Text style={s.statLbl}>📚 درس‌های یادگرفته</Text>
              <Text style={s.statNum}>{stats.lessons || 0}</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLbl}>🔤 مترادف‌ها</Text>
              <Text style={s.statNum}>{stats.aliases || 0}</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLbl}>❓ دستورات نفهمیده</Text>
              <Text style={s.statNum}>{stats.fails || 0}</Text>
            </View>
            <View style={[s.statBox, { borderColor: '#f59e0b' }]}>
              <Text style={s.statLbl}>⚠️ نفهمیده‌های آموزش‌نداده</Text>
              <Text style={[s.statNum, { color: '#f59e0b' }]}>{stats.untaught || 0}</Text>
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* New Lesson Modal */}
      <Modal visible={newLessonModal} transparent animationType="slide" onRequestClose={() => setNewLessonModal(false)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>📚 درس جدید</Text>
              <TouchableOpacity onPress={() => setNewLessonModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14 }}>
              <Text style={s.mLbl}>💬 عبارت کاربر:</Text>
              <TextInput style={s.mInp} value={lessonPhrase} onChangeText={setLessonPhrase} placeholder="مثلاً: احمد صندوق" placeholderTextColor="#64748b" />
              
              <Text style={[s.mLbl, { marginTop: 12 }]}>🎯 این عبارت یعنی:</Text>
              {LEARNABLE_INTENTS.map((it) => (
                <TouchableOpacity
                  key={it.id}
                  style={[s.intentBtn, lessonIntent === it.id && s.intentBtnActive]}
                  onPress={() => setLessonIntent(it.id)}
                >
                  <Text style={[s.intentTxt, lessonIntent === it.id && s.intentTxtActive]}>{it.label}</Text>
                  <Text style={s.intentEx}>{it.example}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[s.mLbl, { marginTop: 12 }]}>👤 اسم (اگه لازمه):</Text>
              <TextInput style={s.mInp} value={lessonName} onChangeText={setLessonName} placeholder="احمد" placeholderTextColor="#64748b" />

              <TouchableOpacity style={[s.addBtn, { backgroundColor: '#059669', marginTop: 16 }]} onPress={saveLesson}>
                <Text style={s.addBtnTxt}>💾 ذخیره درس</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* New Alias Modal */}
      <Modal visible={newAliasModal} transparent animationType="slide" onRequestClose={() => setNewAliasModal(false)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>🔤 مترادف جدید</Text>
              <TouchableOpacity onPress={() => setNewAliasModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 14 }}>
              <Text style={s.mLbl}>«این کلمه»...</Text>
              <TextInput style={s.mInp} value={aliasFrom} onChangeText={setAliasFrom} placeholder="کاردکس" placeholderTextColor="#64748b" />
              
              <Text style={[s.mLbl, { marginTop: 12 }]}>...یعنی «این کلمه»:</Text>
              <TextInput style={s.mInp} value={aliasTo} onChangeText={setAliasTo} placeholder="صندوق" placeholderTextColor="#64748b" />

              <TouchableOpacity style={[s.addBtn, { backgroundColor: '#059669', marginTop: 16 }]} onPress={saveAlias}>
                <Text style={s.addBtnTxt}>💾 ذخیره</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  center: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  tabs: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', padding: 6, gap: 4 },
  tab: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#1a2332' },
  tabActive: { backgroundColor: '#7c3aed' },
  tabTxt: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  tabTxtActive: { color: '#fff' },
  hint: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginBottom: 10 },
  addBtn: { backgroundColor: '#0891b2', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  addBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  empty: { color: '#64748b', textAlign: 'center', padding: 30, fontSize: 13 },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  cardSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'right' },
  delBtn: { marginTop: 8, padding: 6, backgroundColor: '#dc2626', borderRadius: 6, alignSelf: 'flex-start' },
  delTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  statBox: { backgroundColor: '#0f2438', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: '#334155', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  statLbl: { color: '#cbd5e1', fontSize: 14 },
  statNum: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '90%' },
  mHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  x: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  mLbl: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  mInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'right', marginTop: 6 },
  intentBtn: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  intentBtnActive: { borderColor: '#7c3aed', backgroundColor: '#2a1a4a' },
  intentTxt: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  intentTxtActive: { color: '#fff' },
  intentEx: { color: '#64748b', fontSize: 11, marginTop: 2, textAlign: 'right' },
});
`;

fs.writeFileSync('LearningScreen.tsx', learnScreen, 'utf8');
console.log('✅ LearningScreen.tsx');

// ═══════════════════════════════════════════
// ۴. آپدیت LocalBotScreen — افزودن دکمه یادگیری + voice روی وب
// ═══════════════════════════════════════════
let bot = fs.readFileSync('LocalBotScreen.tsx', 'utf8');
const botOrig = bot;
const botCRLF = bot.includes('\r\n');
if (botCRLF) bot = bot.replace(/\r\n/g, '\n');

// اضافه import های learning
if (!bot.includes('lib.learning')) {
  bot = bot.replace(
    "import { execute, ExecResult, getLastEntity, clearLastEntity } from './lib.local.exec';",
    "import { execute, ExecResult, getLastEntity, clearLastEntity } from './lib.local.exec';\nimport { matchLesson, applyAliases, logFail } from './lib.learning';"
  );
  console.log('✅ import learning');
}

// اضافه دکمه یادگیری در header
if (!bot.includes('🎓')) {
  bot = bot.replace(
    `<TouchableOpacity onPress={() => setVoiceReply(v => !v)} style={s.iconBtn}>
          <Text style={s.iconTxt}>{voiceReply ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>`,
    `<TouchableOpacity onPress={() => setVoiceReply(v => !v)} style={s.iconBtn}>
          <Text style={s.iconTxt}>{voiceReply ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOpenLearning?.()} style={s.iconBtn}>
          <Text style={s.iconTxt}>🎓</Text>
        </TouchableOpacity>`
  );
  console.log('✅ دکمه یادگیری');
}

// آپدیت run برای: applyAliases + matchLesson + logFail
const oldRun = `    try {
      const cmds = parseMulti(q);
      if (cmds.length === 0) {
        push('bot', '🤔 نفهمیدم');
        setLoading(false);
        return;
      }`;

const newRun = `    try {
      // ۱. اعمال مترادف‌ها
      const aliased = await applyAliases(q);
      
      // ۲. چک درس‌های یادگرفته
      const lesson = await matchLesson(aliased);
      if (lesson) {
        // از درس استفاده کن
        const fakeCmd: any = { intent: lesson.intent, params: lesson.params || {}, raw: aliased };
        const r = await execute(fakeCmd);
        if (r.message) push('bot', r.message);
        if (r.panel) setPanel(r.panel);
        if (lesson.params?.name && !['list_boxes','list_customers','today_profit','help'].includes(lesson.intent)) {
          // اضافه کردن نام از درس اگه نبود
        }
        speak(r.message);
        setLoading(false);
        return;
      }
      
      const cmds = parseMulti(aliased);
      if (cmds.length === 0) {
        push('bot', '🤔 نفهمیدم');
        await logFail(q);
        setLoading(false);
        return;
      }`;

if (bot.includes(oldRun)) {
  bot = bot.replace(oldRun, newRun);
  console.log('✅ run آپدیت شد');
}

// اضافه logFail بعد از آخرین unknown
const oldUnknown = `        if (!r.ok) break;
      }`;
const newUnknown = `        if (!r.ok) {
          // اگه unknown بود، لاگ کن
          if (c.intent === 'unknown') await logFail(q);
          break;
        }
      }`;

if (bot.includes(oldUnknown)) {
  bot = bot.replace(oldUnknown, newUnknown);
  console.log('✅ logFail اضافه شد');
}

// اضافه onOpenLearning به props
if (!bot.includes('onOpenLearning')) {
  bot = bot.replace(
    'export default function LocalBotScreen({ showToast, onExit }: any)',
    'export default function LocalBotScreen({ showToast, onExit, onOpenLearning }: any)'
  );
}

if (botCRLF) bot = bot.replace(/\n/g, '\r\n');
if (bot !== botOrig) {
  fs.writeFileSync('LocalBotScreen.tsx', bot, 'utf8');
  console.log('💾 LocalBotScreen.tsx');
}

// ═══════════════════════════════════════════
// ۵. اتصال LearningScreen به App.tsx
// ═══════════════════════════════════════════
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;
const appCRLF = app.includes('\r\n');
if (appCRLF) app = app.replace(/\r\n/g, '\n');

// import
if (!app.includes("from './LearningScreen'")) {
  const lines = app.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import LearningScreen from './LearningScreen';");
    app = lines.join('\n');
    console.log('✅ import LearningScreen');
  }
}

// تب learning
if (!app.includes("'botLearning'")) {
  const m = app.match(/(\{\s*key:\s*'aiAssistant'[^}]*\},)/);
  if (m) {
    app = app.replace(m[0], m[0] + "\n    { key: 'botLearning', icon: '🎓', label: 'آموزش', color: '#f59e0b' },");
    console.log('✅ tab آموزش');
  }
}

// render learning
if (!app.includes('<LearningScreen')) {
  const pat = "{tab === 'aiAssistant' && <LocalBotScreen showToast={showToast} onExit={() => setTab('dashboard')} />}";
  if (app.includes(pat)) {
    app = app.replace(pat, pat + "\n      {tab === 'botLearning' && <LearningScreen showToast={showToast} />}");
    console.log('✅ render LearningScreen');
  }
}

// آپدیت LocalBotScreen برای دکمه یادگیری
app = app.replace(
  "{tab === 'aiAssistant' && <LocalBotScreen showToast={showToast} onExit={() => setTab('dashboard')} />}",
  "{tab === 'aiAssistant' && <LocalBotScreen showToast={showToast} onExit={() => setTab('dashboard')} onOpenLearning={() => setTab('botLearning')} />}"
);

if (appCRLF) app = app.replace(/\n/g, '\r\n');
if (app !== appOrig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');