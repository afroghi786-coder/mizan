import AsyncStorage from '@react-native-async-storage/async-storage';

const PRESET_KEY = '@mizan_preset';
const TERMS_KEY = '@mizan_terms';

export type PresetKey = 'store' | 'pharmacy' | 'clothing' | 'restaurant' | 'academy' | 'auto' | 'custom';

export interface Preset {
  key: PresetKey;
  name: string;
  icon: string;
  terms: Record<string, string>;
}

export const TERM_KEYS = ['product', 'customer', 'sale', 'purchase', 'inventory', 'supplier', 'profit', 'order'];

export const TERM_LABELS: Record<string, string> = {
  product: 'کالا / محصول', customer: 'مشتری', sale: 'فروش', purchase: 'خرید',
  inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
};

const DEFAULT_TERMS: Record<string, string> = {
  product: 'کالا', customer: 'مشتری', sale: 'فروش', purchase: 'خرید',
  inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
};

export const PRESETS: Record<PresetKey, Preset> = {
  store: { key: 'store', name: 'فروشگاه عمومی', icon: '🏪', terms: { ...DEFAULT_TERMS } },
  pharmacy: {
    key: 'pharmacy', name: 'داروخانه', icon: '💊',
    terms: { product: 'دارو', customer: 'بیمار', sale: 'فروش دارو', purchase: 'خرید دارو', inventory: 'قفسه دارو', supplier: 'پخش دارو', profit: 'سود', order: 'نسخه' },
  },
  clothing: {
    key: 'clothing', name: 'پوشاک / کفش', icon: '👟',
    terms: { product: 'مدل', customer: 'مشتری', sale: 'فروش', purchase: 'خرید', inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش' },
  },
  restaurant: {
    key: 'restaurant', name: 'رستوران / فست‌فود', icon: '🍔',
    terms: { product: 'غذا', customer: 'مشتری', sale: 'فروش', purchase: 'خرید مواد', inventory: 'انبار مواد', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش' },
  },
  academy: {
    key: 'academy', name: 'آموزشگاه', icon: '🎓',
    terms: { product: 'دوره', customer: 'شاگرد', sale: 'ثبت‌نام', purchase: 'خرید تجهیزات', inventory: 'کلاس', supplier: 'تأمین‌کننده', profit: 'درآمد', order: 'ثبت‌نام' },
  },
  auto: {
    key: 'auto', name: 'لوازم یدکی', icon: '🔧',
    terms: { product: 'قطعه', customer: 'مشتری', sale: 'فروش', purchase: 'خرید', inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش' },
  },
  custom: { key: 'custom', name: 'سفارشی', icon: '⚙️', terms: { ...DEFAULT_TERMS } },
};

let CURRENT_PRESET: PresetKey = 'store';
let CURRENT_TERMS: Record<string, string> = { ...DEFAULT_TERMS };

export function getPreset(): PresetKey { return CURRENT_PRESET; }
export function getTerms(): Record<string, string> { return CURRENT_TERMS; }
export function term(key: string): string { return CURRENT_TERMS[key] || DEFAULT_TERMS[key] || key; }
export function getTabs(): string[] { return ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees']; }

export async function loadPreset(): Promise<PresetKey> {
  try {
    const p = await AsyncStorage.getItem(PRESET_KEY);
    const t = await AsyncStorage.getItem(TERMS_KEY);
    if (p && PRESETS[p as PresetKey]) CURRENT_PRESET = p as PresetKey;
    if (t) CURRENT_TERMS = { ...PRESETS[CURRENT_PRESET].terms, ...JSON.parse(t) };
    else CURRENT_TERMS = { ...PRESETS[CURRENT_PRESET].terms };
  } catch {}
  return CURRENT_PRESET;
}

export async function setPreset(p: PresetKey) {
  CURRENT_PRESET = p;
  CURRENT_TERMS = { ...PRESETS[p].terms };
  try {
    await AsyncStorage.setItem(PRESET_KEY, p);
    await AsyncStorage.setItem(TERMS_KEY, JSON.stringify(CURRENT_TERMS));
  } catch {}
}

export async function setTerm(key: string, value: string) {
  CURRENT_TERMS[key] = value;
  try { await AsyncStorage.setItem(TERMS_KEY, JSON.stringify(CURRENT_TERMS)); } catch {}
}

export async function setTabs(tabs: string[]) {
  try { await AsyncStorage.setItem('@mizan_tabs', JSON.stringify(tabs)); } catch {}
}

export async function resetToPreset(p: PresetKey) { await setPreset(p); }
