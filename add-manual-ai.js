const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-manualai-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['App.tsx'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.manual.ts — پارسر هوشمند + یادگیری
// ═══════════════════════════════════════════════════════
const libCode = `// lib.manual.ts — دستیار هوشمند ورود دستی (آفلاین)
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEARNED_KEY = '@mizan_manual_learned_v1';
const HISTORY_KEY = '@mizan_manual_history_v1';

// ─── تایپ‌ها
export interface Person {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  type: 'customer' | 'supplier' | 'partner' | 'unknown';
  balance: number;
}

export interface ParsedResult {
  ok: boolean;
  confidence: number;   // 0-100
  amount?: number;
  currency?: string;
  type?: 'sale' | 'purchase' | 'exchange' | 'transfer' | 'adjust' | 'deposit' | 'withdraw';
  from?: Person;
  to?: Person;
  person?: Person;
  adjustment?: number;
  note?: string;
  raw: string;
  candidates?: Person[];
  warnings?: string[];
}

export interface LearnedPattern {
  id: string;
  regex: string;
  action: 'purchase' | 'sale' | 'transfer' | 'adjust' | 'exchange';
  description: string;
  examples: string[];
  createdAt: number;
  usageCount: number;
}

// ─── نرمال‌سازی اعداد فارسی/عربی
export function normDigits(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/,/g, '')
    .replace(/\\s+/g, ' ')
    .trim();
}

// ─── تبدیل کلمات عددی فارسی به عدد
const NUM_WORDS: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5,
  'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15,
  'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20,
  'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
  'هشتاد': 80, 'نود': 90, 'صد': 100, 'دویست': 200, 'سیصد': 300,
  'چهارصد': 400, 'پانصد': 500, 'ششصد': 600, 'هفتصد': 700,
  'هشتصد': 800, 'نهصد': 900, 'هزار': 1000, 'میلیون': 1000000,
  'میلیارد': 1000000000,
};

export function wordsToNumber(text: string): number | null {
  const norm = normDigits(text);
  // اگه عدد رقمیه، همون رو برگردون
  const numMatch = norm.match(/\\d+(?:\\.\\d+)?/);
  if (numMatch) return parseFloat(numMatch[0]);
  
  // کلمات عددی
  const tokens = norm.split(/\\s+/);
  let total = 0;
  let current = 0;
  let found = false;
  
  for (const t of tokens) {
    if (NUM_WORDS[t] !== undefined) {
      found = true;
      const v = NUM_WORDS[t];
      if (v >= 1000) {
        current = (current || 1) * v;
        total += current;
        current = 0;
      } else {
        current += v;
      }
    }
  }
  if (current > 0) total += current;
  return found ? total : null;
}

// ─── ذخیره و بازیابی الگوهای یادگرفته
export async function getLearned(): Promise<LearnedPattern[]> {
  try {
    const raw = await AsyncStorage.getItem(LEARNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addLearned(p: LearnedPattern): Promise<void> {
  const list = await getLearned();
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  await AsyncStorage.setItem(LEARNED_KEY, JSON.stringify(list.slice(-100)));
}

export async function removeLearned(id: string): Promise<void> {
  const list = await getLearned();
  await AsyncStorage.setItem(LEARNED_KEY, JSON.stringify(list.filter(x => x.id !== id)));
}

export async function clearLearned(): Promise<void> {
  await AsyncStorage.removeItem(LEARNED_KEY);
}

// ─── تاریخچه
export interface HistoryItem {
  id: string;
  raw: string;
  parsed: ParsedResult;
  timestamp: number;
  saved: boolean;
}

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addHistory(h: HistoryItem): Promise<void> {
  const list = await getHistory();
  list.unshift(h);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
}

// ─── تطبیق نام (Fuzzy)
function findPerson(query: string, pool: any[]): { person?: any; candidates: any[]; score: number } {
  if (!query || !pool?.length) return { candidates: [], score: 0 };
  const q = normDigits(query).toLowerCase().replace(/\\s+/g, ' ').trim();
  if (!q) return { candidates: [], score: 0 };
  
  const results: Array<{ p: any; score: number }> = [];
  
  for (const p of pool) {
    const name = String(p.name || '').toLowerCase();
    const code = String(p.code || p.local_id || '').toLowerCase();
    const phone = String(p.phone || '').toLowerCase();
    let score = 0;
    
    // تطبیق دقیق
    if (name === q) score = 100;
    else if (code === q) score = 95;
    else if (phone === q) score = 95;
    // شروع با
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 70;
    else if (code.includes(q)) score = 60;
    else if (phone.includes(q)) score = 60;
    // فازی (Levenshtein ساده)
    else {
      const dist = levenshtein(name, q);
      const ratio = 1 - dist / Math.max(name.length, q.length);
      if (ratio > 0.6) score = Math.round(ratio * 60);
    }
    
    if (score > 20) results.push({ p, score });
  }
  
  results.sort((a, b) => b.score - a.score);
  return {
    person: results[0]?.p,
    candidates: results.slice(0, 5).map(r => r.p),
    score: results[0]?.score || 0,
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// ─── استخراج مبلغ
function extractAmount(text: string): { amount: number | null; rest: string } {
  const norm = normDigits(text);
  
  // ۱. عدد + واحد (هزار، میلیون)
  const unitMatch = norm.match(/(\\d+(?:\\.\\d+)?)\\s*(هزار|میلیون|میلیارد|k|K|m|M)/);
  if (unitMatch) {
    let v = parseFloat(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase();
    if (unit === 'هزار' || unit === 'k') v *= 1000;
    else if (unit === 'میلیون' || unit === 'm') v *= 1000000;
    else if (unit === 'میلیارد') v *= 1000000000;
    const rest = norm.replace(unitMatch[0], '').trim();
    return { amount: v, rest };
  }
  
  // ۲. عدد ساده
  const numMatch = norm.match(/\\d+(?:\\.\\d+)?/);
  if (numMatch) {
    const amount = parseFloat(numMatch[0]);
    const rest = norm.replace(numMatch[0], '').trim();
    return { amount, rest };
  }
  
  // ۳. کلمات عددی
  const wordsAmount = wordsToNumber(text);
  if (wordsAmount) {
    return { amount: wordsAmount, rest: norm };
  }
  
  return { amount: null, rest: norm };
}

// ─── تشخیص نوع صریح
function detectType(text: string): 'sale' | 'purchase' | 'exchange' | 'transfer' | 'adjust' | null {
  const t = text.toLowerCase();
  if (/خرید|بخرم|خریدم/.test(t)) return 'purchase';
  if (/فروش|بفروشم|فروختم/.test(t)) return 'sale';
  if (/صرافی|تبدیل|ارز|دالر|دلار/.test(t)) return 'exchange';
  if (/انتقال|بین/.test(t)) return 'transfer';
  if (/باقی|مانده|تسویه|حساب/.test(t)) return 'adjust';
  return null;
}

// ─── پارسر اصلی
export interface ParseContext {
  customers: any[];   // مشتریان (مشتری‌های ما)
  suppliers: any[];   // تامین‌کنندگان
  partners: any[];    // شرکا
}

export async function parseCommand(text: string, ctx: ParseContext): Promise<ParsedResult> {
  const warnings: string[] = [];
  const raw = text;
  const norm = normDigits(text);
  const t = norm.toLowerCase();
  
  if (!norm || norm.length < 2) {
    return { ok: false, confidence: 0, raw, warnings: ['متن خیلی کوتاه است'] };
  }
  
  // ۱. یادگرفته‌ها رو چک کن
  const learned = await getLearned();
  for (const lp of learned) {
    try {
      const re = new RegExp(lp.regex, 'i');
      const m = norm.match(re);
      if (m) {
        // آپدیت usage
        lp.usageCount = (lp.usageCount || 0) + 1;
        await addLearned(lp);
        // ادامه با پارسر عادی
        break;
      }
    } catch {}
  }
  
  // ۲. مبلغ
  const { amount } = extractAmount(norm);
  if (!amount) {
    return { ok: false, confidence: 0, raw, warnings: ['مبلغ پیدا نشد'] };
  }
  
  // ۳. انواع تراکنش بر اساس regex
  const patterns: Array<{
    name: string;
    regex: RegExp;
    handler: (m: RegExpMatchArray) => ParsedResult | null;
  }> = [
    // «از X [مبلغ] به Y» یا «از X به Y [مبلغ]»
    {
      name: 'transfer',
      regex: /از\\s+([\\u0600-\\u06FF\\w]+)\\s+(?:مبلغ\\s+)?(\\d+(?:\\.\\d+)?)\\s+به\\s+([\\u0600-\\u06FF\\w]+)/i,
      handler: (m) => {
        const fromName = m[1];
        const amt = parseFloat(m[2]);
        const toName = m[3];
        const fromRes = findPerson(fromName, [...ctx.customers, ...ctx.partners]);
        const toRes = findPerson(toName, [...ctx.suppliers, ...ctx.partners]);
        let conf = 30;
        if (fromRes.person) conf += 25;
        if (toRes.person) conf += 25;
        if (amt > 0) conf += 20;
        return {
          ok: !!(fromRes.person && toRes.person),
          confidence: conf,
          amount: amt,
          type: 'transfer',
          from: fromRes.person,
          to: toRes.person,
          candidates: [...fromRes.candidates, ...toRes.candidates],
          raw,
          warnings: [
            ...(fromRes.person ? [] : ['فرستنده پیدا نشد']),
            ...(toRes.person ? [] : ['گیرنده پیدا نشد']),
          ],
        };
      },
    },
    // «[مبلغ] به X»
    {
      name: 'purchase',
      regex: /(?:مبلغ\\s+)?(\\d+(?:\\.\\d+)?)\\s+به\\s+([\\u0600-\\u06FF\\w]+)/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const toName = m[2];
        const toRes = findPerson(toName, [...ctx.suppliers, ...ctx.partners, ...ctx.customers]);
        const type = detectType(norm) || 'purchase';
        let conf = 40;
        if (toRes.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!toRes.person,
          confidence: conf,
          amount: amt,
          type: type as any,
          to: toRes.person,
          candidates: toRes.candidates,
          raw,
          warnings: toRes.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «[مبلغ] از X»
    {
      name: 'sale',
      regex: /(?:مبلغ\\s+)?(\\d+(?:\\.\\d+)?)\\s+از\\s+([\\u0600-\\u06FF\\w]+)/i,
      handler: (m) => {
        const amt = parseFloat(m[1]);
        const fromName = m[2];
        const fromRes = findPerson(fromName, [...ctx.customers, ...ctx.partners, ...ctx.suppliers]);
        const type = detectType(norm) || 'sale';
        let conf = 40;
        if (fromRes.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!fromRes.person,
          confidence: conf,
          amount: amt,
          type: type as any,
          from: fromRes.person,
          candidates: fromRes.candidates,
          raw,
          warnings: fromRes.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X [مبلغ] باقی» یا «X [مبلغ] مانده»
    {
      name: 'adjust',
      regex: /([\\u0600-\\u06FF\\w]+)\\s+(?:مبلغ\\s+)?(\\d+(?:\\.\\d+)?)\\s+(?:باقی|مانده)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.customers, ...ctx.suppliers, ...ctx.partners]);
        let conf = 40;
        if (res.person) conf += 40;
        if (amt > 0) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: amt,
          type: 'adjust',
          person: res.person,
          adjustment: amt,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «X [+/-][مبلغ]»
    {
      name: 'adjust2',
      regex: /([\\u0600-\\u06FF\\w]+)\\s+([+-]\\d+(?:\\.\\d+)?)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.customers, ...ctx.suppliers, ...ctx.partners]);
        let conf = 40;
        if (res.person) conf += 40;
        if (!isNaN(amt)) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: Math.abs(amt),
          type: 'adjust',
          person: res.person,
          adjustment: amt,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
    // «به X [مبلغ]» یا «به X -[مبلغ]»
    {
      name: 'payWithSign',
      regex: /به\\s+([\\u0600-\\u06FF\\w]+)\\s+(-?\\d+(?:\\.\\d+)?)/i,
      handler: (m) => {
        const name = m[1];
        const amt = parseFloat(m[2]);
        const res = findPerson(name, [...ctx.suppliers, ...ctx.partners, ...ctx.customers]);
        let conf = 40;
        if (res.person) conf += 40;
        if (!isNaN(amt)) conf += 20;
        return {
          ok: !!res.person,
          confidence: conf,
          amount: Math.abs(amt),
          type: 'adjust',
          person: res.person,
          adjustment: amt,
          candidates: res.candidates,
          raw,
          warnings: res.person ? [] : ['طرف پیدا نشد'],
        };
      },
    },
  ];
  
  // اجرای الگوها
  for (const p of patterns) {
    const m = norm.match(p.regex);
    if (m) {
      const r = p.handler(m);
      if (r) {
        r.raw = raw;
        return r;
      }
    }
  }
  
  // ۴. اگه هیچی مطابقت نکرد
  return {
    ok: false,
    confidence: 5,
    amount,
    raw,
    warnings: [
      'نمی‌توانم الگو را تشخیص دهم',
      'نمونه‌ها: «۵۰۰۰ به احمد» یا «از محمود ۵۰۰۰ به احمد»',
    ],
  };
}

// ─── ذخیره نتیجه
export interface SaveResult {
  ok: boolean;
  message: string;
  invoiceCode?: string;
}

export async function saveManual(r: ParsedResult, deps: {
  createSale: (p: any) => Promise<any>;
  createPurchase: (p: any) => Promise<any>;
  createHawala: (p: any) => Promise<any>;
  updateBalance: (personId: string, delta: number) => Promise<void>;
}): Promise<SaveResult> {
  try {
    const now = new Date();
    const dateStr = now.toISOString();
    
    if (r.type === 'transfer' && r.from && r.to && r.amount) {
      // فروش از مشتری
      await deps.createSale({
        customer_id: r.from.id,
        customer_name: r.from.name,
        amount: r.amount,
        type: 'transfer',
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + Date.now(),
      });
      // خرید از تامین‌کننده
      await deps.createPurchase({
        supplier_id: r.to.id,
        supplier_name: r.to.name,
        amount: r.amount,
        type: 'transfer',
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + (Date.now() + 1),
      });
      await deps.updateBalance(r.from.id, +r.amount);
      await deps.updateBalance(r.to.id, -r.amount);
      return { ok: true, message: '✅ انتقال ثبت شد (فروش + خرید)', invoiceCode: 'TR-' + Date.now().toString(36).toUpperCase() };
    }
    
    if (r.type === 'purchase' && r.to && r.amount) {
      await deps.createPurchase({
        supplier_id: r.to.id,
        supplier_name: r.to.name,
        amount: r.amount,
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + Date.now(),
      });
      await deps.updateBalance(r.to.id, -r.amount);
      return { ok: true, message: '✅ خرید ثبت شد', invoiceCode: 'P-' + Date.now().toString(36).toUpperCase() };
    }
    
    if (r.type === 'sale' && r.from && r.amount) {
      await deps.createSale({
        customer_id: r.from.id,
        customer_name: r.from.name,
        amount: r.amount,
        note: r.raw,
        date: dateStr,
        local_id: 'm_' + Date.now(),
      });
      await deps.updateBalance(r.from.id, +r.amount);
      return { ok: true, message: '✅ فروش ثبت شد', invoiceCode: 'S-' + Date.now().toString(36).toUpperCase() };
    }
    
    if (r.type === 'adjust' && r.person && r.adjustment !== undefined) {
      await deps.updateBalance(r.person.id, r.adjustment);
      return { ok: true, message: '✅ مانده تنظیم شد' };
    }
    
    return { ok: false, message: '❌ نوع تراکنش پشتیبانی نمی‌شود' };
  } catch (e: any) {
    return { ok: false, message: '❌ ' + (e?.message || 'خطا') };
  }
}

// ─── آمار یادگیری
export async function getLearningStats(): Promise<{ learned: number; history: number }> {
  const [l, h] = await Promise.all([getLearned(), getHistory()]);
  return { learned: l.length, history: h.length };
}
`;

fs.writeFileSync('lib.manual.ts', libCode, 'utf8');
console.log('✅ lib.manual.ts ساخته شد (' + libCode.split('\\n').length + ' خط)');

// ═══════════════════════════════════════════════════════
// ۲. ManualEntryScreen.tsx — UI
// ═══════════════════════════════════════════════════════
const screenCode = `// ManualEntryScreen.tsx — دستیار هوشمند ورود دستی
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Switch
} from 'react-native';
import {
  parseCommand, saveManual, getHistory, addHistory,
  getLearned, addLearned, clearLearned, ParseContext,
  ParsedResult, Person, LearnedPattern
} from './lib.manual';
import {
  getFxCustomers, createFxCustomer,
} from './lib.fx.cust';
import {
  getHawalas, createHawala,
} from './lib.fx';
import { getSalesGrouped, createSale } from './lib';
import { getPurchasesGrouped, createPurchase } from './lib.db';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BALANCE_KEY = '@mizan_manual_balances_v1';

export default function ManualEntryScreen({ showToast }: any) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [learnedModal, setLearnedModal] = useState(false);
  const [learned, setLearned] = useState<LearnedPattern[]>([]);
  const [editingPerson, setEditingPerson] = useState<'from' | 'to' | 'person' | null>(null);

  const load = useCallback(async () => {
    try {
      const [cust, sales, purch, hist, bals, lrn] = await Promise.all([
        getFxCustomers().catch(() => []),
        getSalesGrouped().catch(() => []),
        getPurchasesGrouped().catch(() => []),
        getHistory(),
        AsyncStorage.getItem(BALANCE_KEY),
        getLearned(),
      ]);
      setCustomers(cust || []);
      setSuppliers((purch || []).map((x: any) => ({ id: x.supplier_code || x.id, name: x.supplier_name, phone: x.supplier_phone, type: 'supplier' })));
      setPartners([]);
      setHistory(hist);
      setBalances(bals ? JSON.parse(bals) : {});
      setLearned(lrn);
    } catch (e: any) { console.log('load err:', e?.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const analyze = async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    try {
      const ctx: ParseContext = {
        customers: customers.map((c: any) => ({ id: c.id || c.local_id, name: c.name, phone: c.phone, type: 'customer' })),
        suppliers: suppliers.map((s: any) => ({ id: s.id, name: s.name, phone: s.phone, type: 'supplier' })),
        partners,
      };
      const r = await parseCommand(text, ctx);
      // پر کردن مانده‌ها
      if (r.from) r.from.balance = balances[r.from.id] || 0;
      if (r.to) r.to.balance = balances[r.to.id] || 0;
      if (r.person) r.person.balance = balances[r.person.id] || 0;
      setResult(r);
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setAnalyzing(false);
  };

  const confirm = async () => {
    if (!result?.ok) return;
    setSaving(true);
    try {
      const r = await saveManual(result, {
        createSale: async (p) => {
          try { await createSale({ ...p, amount: p.amount }); } catch {}
        },
        createPurchase: async (p) => {
          try { await createPurchase({ ...p, amount: p.amount }); } catch {}
        },
        createHawala: async (p) => { try { await createHawala(p); } catch {} },
        updateBalance: async (id, delta) => {
          const cur = balances[id] || 0;
          const next = { ...balances, [id]: cur + delta };
          setBalances(next);
          await AsyncStorage.setItem(BALANCE_KEY, JSON.stringify(next));
        },
      });
      
      if (r.ok) {
        await addHistory({
          id: 'h_' + Date.now(),
          raw: text,
          parsed: result,
          timestamp: Date.now(),
          saved: true,
        });
        setHistory(await getHistory());
        showToast?.(r.message);
        setText('');
        setResult(null);
      } else {
        showToast?.(r.message, true);
      }
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setSaving(false);
  };

  const teach = async () => {
    if (!result || !text) return;
    const id = 'learned_' + Date.now();
    const lp: LearnedPattern = {
      id,
      regex: text.replace(/[0-9]+/g, '\\\\d+').replace(/[ا-ی]+/g, '[\\\\u0600-\\\\u06FF]+'),
      action: (result.type as any) || 'purchase',
      description: 'آموخته از: ' + text,
      examples: [text],
      createdAt: Date.now(),
      usageCount: 0,
    };
    await addLearned(lp);
    setLearned(await getLearned());
    showToast?.('🧠 یاد گرفته شد');
  };

  const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US');
  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };
  const balanceLabel = (b: number) => {
    if (b > 0) return { text: 'ما از او طلبکاریم: +' + fmt(b), color: '#10b981' };
    if (b < 0) return { text: 'ما به او بدهکاریم: ' + fmt(b), color: '#ef4444' };
    return { text: 'تسویه', color: '#94a3b8' };
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🤖 دستیار هوشمند</Text>
        <TouchableOpacity onPress={() => setLearnedModal(true)}>
          <Text style={s.badge}>🧠 {learned.length}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 12 }}>
        <Text style={s.lbl}>✏️ بنویسید (طبیعی):</Text>
        <TextInput
          style={s.bigInp}
          value={text}
          onChangeText={setText}
          placeholder="مثلاً: از محمود ۵۰۰۰ به احمد"
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={3}
        />

        <View style={s.row}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#0891b2' }]}
            onPress={analyze}
            disabled={analyzing || !text.trim()}
          >
            {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🔍 تحلیل</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#64748b' }]}
            onPress={() => { setText(''); setResult(null); }}
          >
            <Text style={s.btnTxt}>🗑 پاک</Text>
          </TouchableOpacity>
        </View>

        {/* نتیجه */}
        {result && (
          <View style={[s.card, { borderColor: result.ok ? '#059669' : '#dc2626' }]}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{result.ok ? '✅ تشخیص داده شد' : '⚠️ ناقص'}</Text>
              <Text style={s.conf}>اطمینان: {result.confidence}%</Text>
            </View>

            {result.amount !== undefined && (
              <Text style={s.row}>💰 مبلغ: <Text style={s.bold}>{fmt(result.amount)}</Text></Text>
            )}
            {result.type && (
              <Text style={s.row}>📊 نوع: <Text style={s.bold}>{
                result.type === 'sale' ? '💸 فروش' :
                result.type === 'purchase' ? '🛒 خرید' :
                result.type === 'transfer' ? '🔄 انتقال' :
                result.type === 'adjust' ? '⚖️ تنظیم مانده' :
                result.type === 'exchange' ? '💱 صرافی' : result.type
              }</Text></Text>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {result.warnings.map((w, i) => (
                  <Text key={i} style={s.warn}>⚠️ {w}</Text>
                ))}
              </View>
            )}

            {/* طرفین */}
            {(result.from || result.to || result.person) && (
              <View style={{ marginTop: 10 }}>
                <Text style={s.lbl}>👥 طرفین:</Text>
                {[result.from, result.to, result.person].filter(Boolean).map((p: any, i: number) => {
                  const bal = balances[p.id] || 0;
                  const bl = balanceLabel(bal);
                  return (
                    <View key={i} style={s.personBox}>
                      <Text style={s.personName}>👤 {p.name}</Text>
                      {p.phone ? <Text style={s.personPhone}>📞 {p.phone}</Text> : null}
                      <Text style={[s.personBal, { color: bl.color }]}>💰 {bl.text}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* دکمه‌ها */}
            <View style={[s.row, { marginTop: 12 }]}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: result.ok ? '#059669' : '#475569', flex: 2 }]}
                onPress={confirm}
                disabled={!result.ok || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>✅ تأیید و ثبت</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#7c3aed' }]}
                onPress={teach}
              >
                <Text style={s.btnTxt}>🧠 یاد بگیر</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* تاریخچه */}
        {history.length > 0 && (
          <>
            <Text style={[s.lbl, { marginTop: 16 }]}>📋 تاریخچه امروز ({history.length})</Text>
            {history.slice(0, 10).map((h: any, i: number) => (
              <View key={i} style={[s.card, { borderColor: '#334155', marginBottom: 6 }]}>
                <Text style={s.histRaw}>«{h.raw}»</Text>
                <Text style={s.histDate}>{fmtDate(h.timestamp)}</Text>
                {h.parsed?.amount !== undefined && (
                  <Text style={s.histAmt}>💰 {fmt(h.parsed.amount)}</Text>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Learned Modal */}
      <Modal visible={learnedModal} transparent animationType="slide" onRequestClose={() => setLearnedModal(false)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>🧠 الگوهای یادگرفته ({learned.length})</Text>
              <TouchableOpacity onPress={() => setLearnedModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              {learned.length === 0 ? (
                <Text style={s.empty}>هنوز چیزی یاد نگرفته‌ام</Text>
              ) : (
                learned.map((lp, i) => (
                  <View key={i} style={s.learnedItem}>
                    <Text style={s.learnedDesc}>{lp.description}</Text>
                    <Text style={s.learnedEx}>مثال: {lp.examples?.[0] || '—'}</Text>
                    <Text style={s.learnedUse}>استفاده: {lp.usageCount} بار</Text>
                  </View>
                ))
              )}
              {learned.length > 0 && (
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: '#dc2626', marginTop: 12 }]}
                  onPress={async () => { await clearLearned(); setLearned([]); showToast?.('🗑 پاک شد'); }}
                >
                  <Text style={s.btnTxt}>🗑 پاک کردن همه</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0f2438', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  badge: { color: '#7c3aed', fontSize: 13, fontWeight: 'bold', backgroundColor: '#1a2332', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  lbl: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', marginTop: 10, marginBottom: 6, textAlign: 'right' },
  bigInp: { backgroundColor: '#1a2332', color: '#fff', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 15, textAlign: 'right', minHeight: 70 },
  row: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  card: { backgroundColor: '#0f2438', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 2, borderColor: '#334155' },
  cardHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  conf: { color: '#94a3b8', fontSize: 11 },
  bold: { fontWeight: 'bold', color: '#fff' },
  warn: { color: '#f59e0b', fontSize: 12, marginTop: 4, textAlign: 'right' },
  personBox: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#334155' },
  personName: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  personPhone: { color: '#94a3b8', fontSize: 12, marginTop: 2, textAlign: 'right' },
  personBal: { fontSize: 12, marginTop: 4, fontWeight: 'bold', textAlign: 'right' },
  histRaw: { color: '#cbd5e1', fontSize: 13, textAlign: 'right' },
  histDate: { color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'right' },
  histAmt: { color: '#10b981', fontSize: 12, marginTop: 2, textAlign: 'right' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 13 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '85%', overflow: 'hidden' },
  mHead: { backgroundColor: '#7c3aed', padding: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  mTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  x: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  learnedItem: { backgroundColor: '#1a2332', padding: 10, borderRadius: 8, marginBottom: 8 },
  learnedDesc: { color: '#fff', fontSize: 13, textAlign: 'right' },
  learnedEx: { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' },
  learnedUse: { color: '#7c3aed', fontSize: 11, marginTop: 2, textAlign: 'right' },
});
`;

fs.writeFileSync('ManualEntryScreen.tsx', screenCode, 'utf8');
console.log('✅ ManualEntryScreen.tsx ساخته شد (' + screenCode.split('\\n').length + ' خط)');

// ═══════════════════════════════════════════════════════
// ۳. اتصال به App.tsx
// ═══════════════════════════════════════════════════════
console.log('');
console.log('═══ App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');
const appOrig = app;
const appCRLF = app.includes('\\r\\n');
if (appCRLF) app = app.replace(/\\r\\n/g, '\\n');

// import
if (!app.includes("from './ManualEntryScreen'")) {
  const lines = app.split('\\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const L = lines[i].trim();
    if (L.startsWith('import ') && L.endsWith(';')) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import ManualEntryScreen from './ManualEntryScreen';");
    app = lines.join('\\n');
    console.log('✅ import اضافه شد');
  }
}

// render
if (!app.includes('<ManualEntryScreen')) {
  const pat = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}";
  if (app.includes(pat)) {
    app = app.replace(pat, pat + "\\n      {tab === 'manualEntry' && <ManualEntryScreen showToast={showToast} />}");
    console.log('✅ render اضافه شد');
  }
}

// tab
if (!app.includes("'manualEntry'")) {
  const pat2 = "{ key: 'publicMarket', icon: '🏛️', label: 'بازار', color: '#0891b2' },";
  if (app.includes(pat2)) {
    app = app.replace(pat2, pat2 + "\\n    { key: 'manualEntry', icon: '🤖', label: 'دستیار', color: '#7c3aed' },");
    console.log('✅ tab اضافه شد');
  } else {
    // تلاش دوم
    const pat3 = /\\{\\s*key:\\s*'publicMarket'[^}]*\\},/;
    const m = app.match(pat3);
    if (m) {
      app = app.replace(m[0], m[0] + "\\n    { key: 'manualEntry', icon: '🤖', label: 'دستیار', color: '#7c3aed' },");
      console.log('✅ tab اضافه شد (regex)');
    }
  }
}

if (appCRLF) app = app.replace(/\\n/g, '\\r\\n');
if (app !== appOrig) {
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('💾 App.tsx ذخیره شد');
}

console.log('');
console.log('═══════════════════════════════════════════');
console.log('✅ تمام');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('چک نهایی:');
console.log((fs.existsSync('lib.manual.ts') ? '✅' : '❌') + ' lib.manual.ts');
console.log((fs.existsSync('ManualEntryScreen.tsx') ? '✅' : '❌') + ' ManualEntryScreen.tsx');
const finalApp = fs.readFileSync('App.tsx', 'utf8');
console.log('App.tsx — import: ' + (finalApp.includes('ManualEntryScreen') ? '✅' : '❌'));
console.log('App.tsx — render: ' + (finalApp.includes('<ManualEntryScreen') ? '✅' : '❌'));
console.log('App.tsx — tab: ' + (finalApp.includes("'manualEntry'") ? '✅' : '❌'));
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\\\App.tsx" App.tsx');
console.log('');
console.log('بعدش:');
console.log('  npx expo start --web --clear');
console.log('  git add .');
console.log('  git commit -m "feat: smart manual entry AI"');
console.log('  git push');