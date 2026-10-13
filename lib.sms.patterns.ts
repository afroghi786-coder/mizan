// lib.sms.patterns.ts — الگوهای پیامک بانکی + پارسر هوشمند
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mizan_sms_patterns_v2';

export interface SmsPattern {
  id: string;
  name: string;
  bank: string;
  enabled: boolean;
  isBuiltIn: boolean;
  depositKeywords: string[];
  withdrawKeywords: string[];
  amountRegex?: string;
  senderMatch?: string;
}

export const BUILTIN_PATTERNS: SmsPattern[] = [
  // 🇦🇫 افغانستان
  { id: 'bi_af_melli', name: '🇦🇫 بانک ملی افغانستان', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار', 'credit', 'deposit', 'received', 'credited'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار', 'debit', 'withdraw', 'purchase', 'خرید'] },
  { id: 'bi_af_azizi', name: '🇦🇫 بانک عزیزی', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'credited', 'deposited', 'بستانکار'],
    withdrawKeywords: ['برداشت', 'کسر', 'debited', 'withdrawn', 'بدهکار'] },
  { id: 'bi_af_aib', name: '🇦🇫 آی‌بی‌آی (AIB)', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['credit', 'deposit', 'credited', 'received', 'واریز'],
    withdrawKeywords: ['debit', 'withdraw', 'debited', 'purchase', 'برداشت', 'خرید'] },
  { id: 'bi_af_maiwand', name: '🇦🇫 میوند بانک', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_af_ghazanfar', name: '🇦🇫 غضنفر بانک', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_af_noon', name: '🇦🇫 بانک نور', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  // 🇮🇷 ایران
  { id: 'bi_ir_melli', name: '🇮🇷 بانک ملی ایران', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار', 'خرید'] },
  { id: 'bi_ir_saderat', name: '🇮🇷 بانک صادرات', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار'] },
  { id: 'bi_ir_tejarat', name: '🇮🇷 بانک تجارت', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_mellat', name: '🇮🇷 بانک ملت', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_parsian', name: '🇮🇷 بانک پارسیان', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_sepah', name: '🇮🇷 بانک سپه', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_refah', name: '🇮🇷 بانک رفاه', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  // 🌍 عمومی
  { id: 'bi_generic', name: '🌍 تشخیص خودکار (عمومی)', bank: 'GEN', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار', 'credit', 'deposit', 'received', 'credited', 'added'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار', 'debit', 'withdraw', 'purchase', 'خرید', 'debited', 'paid'] },
];

export async function getPatterns(): Promise<SmsPattern[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [...BUILTIN_PATTERNS];
    const custom: SmsPattern[] = JSON.parse(raw);
    const biMap = new Map(BUILTIN_PATTERNS.map(p => [p.id, p]));
    const merged: SmsPattern[] = [];
    const seen = new Set<string>();
    // اول built-in ها (با override)
    for (const bi of BUILTIN_PATTERNS) {
      const ov = custom.find(c => c.id === bi.id);
      merged.push(ov ? { ...bi, ...ov } : bi);
      seen.add(bi.id);
    }
    // بعد custom های جدید
    for (const c of custom) {
      if (!seen.has(c.id)) merged.push(c);
    }
    return merged;
  } catch { return [...BUILTIN_PATTERNS]; }
}

export async function savePattern(p: SmsPattern): Promise<void> {
  const all = await getPatterns();
  const idx = all.findIndex(x => x.id === p.id);
  if (idx >= 0) all[idx] = p;
  else all.push(p);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function deletePattern(id: string): Promise<void> {
  const all = await getPatterns();
  const filtered = all.filter(x => x.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
}

export async function resetPatterns(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// ─── ابزار: تبدیل اعداد فارسی/عربی
export function normalizeDigits(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// ─── استخراج همه اعداد
export function extractAllNumbers(text: string): number[] {
  const norm = normalizeDigits(text);
  const matches = norm.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return matches
    .map(m => Number(m.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0 && n < 1e15);
}

// ─── استخراج مبلغ هوشمند (نه شماره حساب)
export function smartExtractAmount(text: string): number | null {
  const norm = normalizeDigits(text);
  // الگوهای رایج مبلغ
  const amountPatterns = [
    /مبلغ[\s:]+([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:افغانی|درهم|ریال|تومان|روپیه|دالر|USD|AFN|IRR|PKR)/i,
    /(?:AFN|USD|IRR|PKR|افغانی|ریال|تومان|دالر)[\s:]+([\d,]+(?:\.\d+)?)/i,
    /(?:credit|debit|deposit|withdraw|واریز|برداشت)[\s:]+([\d,]+(?:\.\d+)?)/i,
  ];
  for (const re of amountPatterns) {
    const m = norm.match(re);
    if (m && m[1]) {
      const n = Number(m[1].replace(/,/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  // fallback: بزرگترین عدد
  const all = extractAllNumbers(text);
  if (all.length === 0) return null;
  // حذف اعدادی که شبیه شماره کارت/حساب هستن (13+ رقم)
  const filtered = all.filter(n => String(n).length < 13);
  if (filtered.length === 0) return Math.max(...all);
  return Math.max(...filtered);
}

// ─── تشخیص نوع هوشمند
export function smartDetectType(text: string): 'deposit' | 'withdraw' | 'unknown' {
  const t = normalizeDigits(text).toLowerCase();
  const depWords = ['واریز', 'افزایش', 'بستانکار', 'credit', 'deposit', 'received', 'credited', 'added', 'دریافت'];
  const witWords = ['برداشت', 'کسر', 'بدهکار', 'debit', 'withdraw', 'purchase', 'خرید', 'debited', 'paid', 'پرداخت'];
  for (const k of witWords) if (t.includes(k)) return 'withdraw';
  for (const k of depWords) if (t.includes(k)) return 'deposit';
  return 'unknown';
}

// ─── تست پیامک با الگو
export interface ParseResult {
  matched: boolean;
  patternId?: string;
  patternName?: string;
  amount?: number;
  type?: 'deposit' | 'withdraw';
  confidence: number;
}

export async function parseSmsWithPatterns(text: string): Promise<ParseResult> {
  const patterns = (await getPatterns()).filter(p => p.enabled);
  const norm = normalizeDigits(text);
  const lower = norm.toLowerCase();

  let best: ParseResult | null = null;
  let bestScore = 0;

  for (const pat of patterns) {
    let score = 0;

    // ۱. کلمات کلیدی
    const depFound = pat.depositKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));
    const witFound = pat.withdrawKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));

    if (!depFound && !witFound) continue;

    const type: 'deposit' | 'withdraw' = depFound ? 'deposit' : 'withdraw';
    score += 10;

    // ۲. regex دقیق
    let amount: number | null = null;
    if (pat.amountRegex) {
      try {
        const m = norm.match(new RegExp(pat.amountRegex));
        if (m && m[1]) {
          amount = Number(m[1].replace(/,/g, ''));
          if (!isNaN(amount)) score += 30;
        }
      } catch {}
    }

    // ۳. heuristic مبلغ
    if (!amount) {
      amount = smartExtractAmount(text);
      if (amount) score += 15;
    }

    // ۴. طول پیام
    if (norm.length > 25) score += 5;

    // ۵. نام بانک در متن
    if (pat.bank !== 'GEN') {
      const bankTokens = pat.name.split(' ').filter(w => w.length > 3);
      for (const bt of bankTokens) {
        if (norm.includes(bt)) { score += 10; break; }
      }
    }

    if (amount && score > bestScore) {
      bestScore = score;
      best = {
        matched: true,
        patternId: pat.id,
        patternName: pat.name,
        amount,
        type,
        confidence: score,
      };
    }
  }

  // fallback
  if (!best) {
    const amount = smartExtractAmount(text);
    const type = smartDetectType(text);
    if (amount && type !== 'unknown') {
      return {
        matched: true,
        patternId: 'fallback',
        patternName: '🎯 تشخیص خودکار',
        amount,
        type,
        confidence: 5,
      };
    }
    return { matched: false, confidence: 0 };
  }

  return best;
}

// ─── تست سریع الگو (برای UI)
export function testPattern(pat: SmsPattern, sampleText: string): { ok: boolean; amount?: number; type?: string; reason?: string } {
  const norm = normalizeDigits(sampleText);
  const lower = norm.toLowerCase();
  const depFound = pat.depositKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));
  const witFound = pat.withdrawKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));
  if (!depFound && !witFound) return { ok: false, reason: 'هیچ کلمه کلیدی پیدا نشد' };
  const amount = smartExtractAmount(sampleText);
  if (!amount) return { ok: false, reason: 'مبلغ پیدا نشد' };
  return { ok: true, amount, type: depFound ? 'deposit' : 'withdraw' };
}
