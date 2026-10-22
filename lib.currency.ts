// lib.currency.ts — سیستم واحد پول سراسری (آفلاین/آنلاین)
import AsyncStorage from './lib.storage';

const CACHE_KEY = '@mizan_currency_cache';

export type Currency = {
  code: string;
  label: string;
  symbol: string;
  decimals: number;
  custom: boolean;
};

export const COMMON_CURRENCIES: Currency[] = [
  { code: 'AFN', label: 'افغانی', symbol: '؋', decimals: 0, custom: false },
  { code: 'USD', label: 'دالر امریکایی', symbol: '$', decimals: 2, custom: false },
  { code: 'EUR', label: 'یورو', symbol: '€', decimals: 2, custom: false },
  { code: 'IRR', label: 'ریال ایران', symbol: '﷼', decimals: 0, custom: false },
  { code: 'IQD', label: 'دینار عراق', symbol: 'د.ع', decimals: 0, custom: false },
  { code: 'PKR', label: 'کلدار پاکستان', symbol: '₨', decimals: 0, custom: false },
  { code: 'TRY', label: 'لیر ترکیه', symbol: '₺', decimals: 2, custom: false },
  { code: 'AED', label: 'درهم امارات', symbol: 'د.إ', decimals: 2, custom: false },
  { code: 'GBP', label: 'پوند انگلیس', symbol: '£', decimals: 2, custom: false },
  { code: 'SAR', label: 'ریال سعودی', symbol: 'ر.س', decimals: 2, custom: false },
];

const DEFAULT_CURRENCY: Currency = {
  code: 'AFN',
  label: 'افغانی',
  symbol: '؋',
  decimals: 0,
  custom: false,
};

let _cache: Currency = { ...DEFAULT_CURRENCY };

// بارگذاری اولیه از AsyncStorage (سریع، بدون شبکه)
(async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.label) _cache = { ...DEFAULT_CURRENCY, ...parsed };
    }
  } catch (e) { console.log('[currency] cache load err:', e); }
})();

export function getCurrencySync(): Currency {
  return _cache;
}

export async function hydrateFromSettings(settings: any) {
  try {
    if (!settings) return _cache;
    if (!settings.currency_code) return _cache;
    _cache = {
      code: String(settings.currency_code || 'AFN'),
      label: String(settings.currency_label || 'افغانی'),
      symbol: String(settings.currency_symbol || ''),
      decimals: typeof settings.currency_decimals === 'number' ? settings.currency_decimals : 0,
      custom: !!settings.currency_custom,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
  } catch (e) { console.log('[currency] hydrate err:', e); }
  return _cache;
}

export async function setCurrency(cur: Currency) {
  _cache = { ...cur };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
  } catch (e) { console.log('[currency] cache write err:', e); }
  return _cache;
}

export function formatMoney(n: any, opts?: { currency?: Currency; noLabel?: boolean; noSymbol?: boolean }): string {
  const cur = opts?.currency || _cache;
  const num = Number(n) || 0;
  const dec = typeof cur.decimals === 'number' ? cur.decimals : 0;
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (opts?.noLabel) return formatted;
  if (opts?.noSymbol) return formatted + ' ' + (cur.label || '');
  const label = cur.label || '';
  return formatted + (label ? ' ' + label : '');
}

export function currencyLabelByCode(code: string): string {
  if (!code) return _cache.label;
  const c = String(code).toUpperCase();
  const found = COMMON_CURRENCIES.find(function(x) { return x.code === c; });
  return found ? found.label : (code || _cache.label);
}

export function currencyFromCode(code: string): Currency {
  const c = String(code || '').toUpperCase();
  const found = COMMON_CURRENCIES.find(function(x) { return x.code === c; });
  if (found) return { ...found };
  return { ...DEFAULT_CURRENCY, code: c || 'AFN', label: c || 'افغانی' };
}