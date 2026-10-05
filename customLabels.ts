// customLabels.ts — سیستم ویرایش برچسب‌ها
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mizan_custom_labels';
let CUSTOM: Record<string, string> = {};
let listeners: Array<() => void> = [];

export function cl(text: string): string {
  if (!text) return text;
  return CUSTOM[String(text).trim()] || text;
}

export async function loadCustomLabels() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    CUSTOM = raw ? JSON.parse(raw) : {};
  } catch { CUSTOM = {}; }
}

export async function setCustomLabel(original: string, newText: string) {
  CUSTOM[String(original).trim()] = newText;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(CUSTOM)); } catch {}
  listeners.forEach(fn => fn());
}

export async function resetCustomLabel(original: string) {
  delete CUSTOM[String(original).trim()];
  try { await AsyncStorage.setItem(KEY, JSON.stringify(CUSTOM)); } catch {}
  listeners.forEach(fn => fn());
}

export async function getAllCustom(): Promise<Record<string, string>> {
  return { ...CUSTOM };
}

export async function resetAllCustom() {
  CUSTOM = {};
  try { await AsyncStorage.removeItem(KEY); } catch {}
  listeners.forEach(fn => fn());
}

export function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(f => f !== fn); };
}
