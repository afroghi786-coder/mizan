// LearningScreen.tsx — آموزش ربات
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
        <TouchableOpacity accessibilityLabel="درس‌ها" style={[s.tab, tab === 'lessons' && s.tabActive]} onPress={() => setTab('lessons')}>
          <Text style={[s.tabTxt, tab === 'lessons' && s.tabTxtActive]}>📚 درس‌ها ({lessons.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="مترادف‌ها" style={[s.tab, tab === 'aliases' && s.tabActive]} onPress={() => setTab('aliases')}>
          <Text style={[s.tabTxt, tab === 'aliases' && s.tabTxtActive]}>🔤 مترادف‌ها ({aliases.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="نفهمید" style={[s.tab, tab === 'fails' && s.tabActive]} onPress={() => setTab('fails')}>
          <Text style={[s.tabTxt, tab === 'fails' && s.tabTxtActive]}>❓ نفهمید ({fails.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="آمار" style={[s.tab, tab === 'stats' && s.tabActive]} onPress={() => setTab('stats')}>
          <Text style={[s.tabTxt, tab === 'stats' && s.tabTxtActive]}>📊 آمار</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 12 }} keyboardShouldPersistTaps="handled">

        {/* ═══ LESSONS ═══ */}
        {tab === 'lessons' && (
          <>
            <Text style={s.hint}>📚 به ربات یاد بده «این عبارت یعنی این کار»</Text>
            <TouchableOpacity accessibilityLabel="افزودن درس جدید" style={s.addBtn} onPress={() => setNewLessonModal(true)}>
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
                  <TouchableOpacity accessibilityLabel="حذف" style={s.delBtn} onPress={async () => { await removeLesson(l.id); await load(); }}>
                    <Text style={s.delTxt}>🗑 حذف</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {lessons.length > 0 && (
              <TouchableOpacity accessibilityLabel="پاک کردن همه" style={[s.addBtn, { backgroundColor: '#dc2626', marginTop: 12 }]} onPress={async () => {
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
            <TouchableOpacity accessibilityLabel="افزودن مترادف" style={s.addBtn} onPress={() => setNewAliasModal(true)}>
              <Text style={s.addBtnTxt}>➕ افزودن مترادف</Text>
            </TouchableOpacity>
            {aliases.length === 0 ? (
              <Text style={s.empty}>هنوز مترادفی نیست</Text>
            ) : (
              aliases.map((a) => (
                <View key={a.id} style={s.card}>
                  <Text style={s.cardTitle}>«{a.from}» → «{a.to}»</Text>
                  <TouchableOpacity accessibilityLabel="حذف" style={s.delBtn} onPress={async () => { await removeAlias(a.id); await load(); }}>
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
                <TouchableOpacity accessibilityLabel="بار تکرار" key={f.id} style={[s.card, f.taught && { opacity: 0.5 }]} onPress={() => teachFromFail(f)}>
                  <Text style={s.cardTitle}>💬 «{f.text}»</Text>
                  <Text style={s.cardSub}>🔴 {f.count} بار تکرار</Text>
                  {f.taught ? <Text style={[s.cardSub, { color: '#10b981' }]}>✅ آموزش داده شد</Text> : <Text style={[s.cardSub, { color: '#f59e0b' }]}>⚠️ آموزش بده</Text>}
                </TouchableOpacity>
              ))
            )}
            {fails.length > 0 && (
              <TouchableOpacity accessibilityLabel="پاک کردن" style={[s.addBtn, { backgroundColor: '#dc2626', marginTop: 12 }]} onPress={async () => {
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
              <TextInput accessibilityLabel="مثلاً: احمد صندوق" style={s.mInp} value={lessonPhrase} onChangeText={setLessonPhrase} placeholder="مثلاً: احمد صندوق" placeholderTextColor="#64748b" />
              
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
              <TextInput accessibilityLabel="احمد" style={s.mInp} value={lessonName} onChangeText={setLessonName} placeholder="احمد" placeholderTextColor="#64748b" />

              <TouchableOpacity accessibilityLabel="ذخیره درس" style={[s.addBtn, { backgroundColor: '#059669', marginTop: 16 }]} onPress={saveLesson}>
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
              <TextInput accessibilityLabel="کاردکس" style={s.mInp} value={aliasFrom} onChangeText={setAliasFrom} placeholder="کاردکس" placeholderTextColor="#64748b" />
              
              <Text style={[s.mLbl, { marginTop: 12 }]}>...یعنی «این کلمه»:</Text>
              <TextInput accessibilityLabel="صندوق" style={s.mInp} value={aliasTo} onChangeText={setAliasTo} placeholder="صندوق" placeholderTextColor="#64748b" />

              <TouchableOpacity accessibilityLabel="ذخیره" style={[s.addBtn, { backgroundColor: '#059669', marginTop: 16 }]} onPress={saveAlias}>
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
