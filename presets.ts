// presets.ts — سیستم Preset + واژه‌های قابل تنظیم
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRESET_KEY = '@mizan_preset';
const TERMS_KEY = '@mizan_terms';
const TABS_KEY = '@mizan_enabled_tabs';

export type PresetKey = 'store' | 'pharmacy' | 'clothing' | 'restaurant' | 'academy' | 'auto' | 'exchange' | 'custom';

export interface Preset {
  key: PresetKey;
  name: string;
  icon: string;
  tabs: string[];
  terms: Record<string, string>;
}

// ═══════════════════════════════════════════
//  واژه‌های پیش‌فرض (کلید انگلیسی → متن)
// ═══════════════════════════════════════════
export const TERM_KEYS = [
  'product',    // کالا
  'customer',   // مشتری
  'sale',       // فروش
  'purchase',   // خرید
  'inventory',  // انبار
  'supplier',   // تأمین‌کننده
  'profit',     // سود
  'order',      // سفارش
];

export const TERM_LABELS: Record<string, string> = {
  product: 'کالا / محصول',
  customer: 'مشتری',
  sale: 'فروش',
  purchase: 'خرید',
  inventory: 'انبار',
  supplier: 'تأمین‌کننده',
  profit: 'سود',
  order: 'سفارش',
};

// ═══════════════════════════════════════════
//  Presetهای آماده
// ═══════════════════════════════════════════
export const PRESETS: Record<PresetKey, Preset> = {
  store: {
    key: 'store', name: 'فروشگاه عمومی', icon: '🏪',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'کالا', customer: 'مشتری', sale: 'فروش', purchase: 'خرید',
      inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
    },
  },
  pharmacy: {
    key: 'pharmacy', name: 'داروخانه', icon: '💊',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'دارو', customer: 'بیمار', sale: 'فروش دارو', purchase: 'خرید دارو',
      inventory: 'قفسه دارو', supplier: 'پخش دارو', profit: 'سود', order: 'نسخه',
    },
  },
  clothing: {
    key: 'clothing', name: 'پوشاک / کفش', icon: '👟',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'مدل', customer: 'مشتری', sale: 'فروش', purchase: 'خرید',
      inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
    },
  },
  restaurant: {
    key: 'restaurant', name: 'رستوران / فست‌فود', icon: '🍔',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'غذا', customer: 'مشتری', sale: 'فروش', purchase: 'خرید مواد',
      inventory: 'انبار مواد', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
    },
  },
  academy: {
    key: 'academy', name: 'آموزشگاه', icon: '🎓',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'دوره', customer: 'شاگرد', sale: 'ثبت‌نام', purchase: 'خرید تجهیزات',
      inventory: 'کلاس', supplier: 'تأمین‌کننده', profit: 'درآمد', order: 'ثبت‌نام',
    },
  },
  auto: {
    key: 'auto', name: 'لوازم یدکی', icon: '🔧',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'قطعه', customer: 'مشتری', sale: 'فروش', purchase: 'خرید',
      inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
    },
  },
  exchange: {
    key: 'exchange', name: 'صرافی', icon: '💱',
    tabs: ['exchange'],
    terms: {
      product: 'ارز', customer: 'مشتری', sale: 'فروش ارز', purchase: 'خرید ارز',
      inventory: 'پوزیشن', supplier: 'شریک', profit: 'سود', order: 'معامله',
    },
  },
  custom: {
    key: 'custom', name: 'سفارشی', icon: '⚙️',
    tabs: ['order', 'purchase', 'print', 'mgr', 'profit', 'inventory', 'exchange', 'expenses', 'employees'],
    terms: {
      product: 'کالا', customer: 'مشتری', sale: 'فروش', purchase: 'خرید',
      inventory: 'انبار', supplier: 'تأمین‌کننده', profit: 'سود', order: 'سفارش',
    },
  },
};

// ═══════════════════════════════════════════
//  State
// ═══════════════════════════════════════════
let CURRENT_PRESET: PresetKey = 'store';
let CURRENT_TERMS: Record<string, string> = { ...PRESETS.store.terms };
let CURRENT_TABS: string[] = [...PRESETS.store.tabs];

export function getPreset(): PresetKey { return CURRENT_PRESET; }
export function getTerms(): Record<string, string> { return CURRENT_TERMS; }
export function getTabs(): string[] { return CURRENT_TABS; }
export function term(key: string): string { return CURRENT_TERMS[key] || TERM_LABELS[key] || key; }

export async function loadPreset() {
  try {
    const p = await AsyncStorage.getItem(PRESET_KEY);
    const t = await AsyncStorage.getItem(TERMS_KEY);
    const tb = await AsyncStorage.getItem(TABS_KEY);
    if (p && PRESETS[p as PresetKey]) CURRENT_PRESET = p as PresetKey;
    if (t) CURRENT_TERMS = { ...PRESETS[CURRENT_PRESET].terms, ...JSON.parse(t) };
    else CURRENT_TERMS = { ...PRESETS[CURRENT_PRESET].terms };
    if (tb) CURRENT_TABS = JSON.parse(tb);
    else CURRENT_TABS = [...PRESETS[CURRENT_PRESET].tabs];
  } catch {}
}

export async function setPreset(p: PresetKey) {
  CURRENT_PRESET = p;
  CURRENT_TERMS = { ...PRESETS[p].terms };
  CURRENT_TABS = [...PRESETS[p].tabs];
  try {
    await AsyncStorage.setItem(PRESET_KEY, p);
    await AsyncStorage.setItem(TERMS_KEY, JSON.stringify(CURRENT_TERMS));
    await AsyncStorage.setItem(TABS_KEY, JSON.stringify(CURRENT_TABS));
  } catch {}
}

export async function setTerm(key: string, value: string) {
  CURRENT_TERMS[key] = value;
  try { await AsyncStorage.setItem(TERMS_KEY, JSON.stringify(CURRENT_TERMS)); } catch {}
}

export async function setTabs(tabs: string[]) {
  CURRENT_TABS = [...tabs];
  try { await AsyncStorage.setItem(TABS_KEY, JSON.stringify(CURRENT_TABS)); } catch {}
}

export async function resetToPreset(p: PresetKey) {
  await setPreset(p);
}
