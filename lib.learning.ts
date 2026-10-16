// lib.learning.ts — یادگیری و آموزش ربات
import AsyncStorage from './lib.storage';
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
