import { displayDate, displayDateOnly } from './lib-date';
// lib.sms.ts — خواندن پیامک بانکی + تطبیق با فاکتورها
import AsyncStorage from './lib.storage';
import { NativeModules, Platform } from 'react-native';

const { SmsReader } = NativeModules;
const SETTINGS_KEY = '@mizan_sms_settings';
const PROCESSED_KEY = '@mizan_sms_processed';
const TX_KEY = '@mizan_sms_transactions';

export const DEFAULT_SETTINGS = {
  enabled: false,
  pollInterval: 30000,
  timeTolerance: 3,
  amountTolerance: 1,
  autoMatch: true,
  filterAds: true,
  keywords: ['برداشت', 'واریز', 'خرید', 'انتقال', 'debit', 'credit', 'withdraw', 'deposit'],
};

export async function getSettings(): Promise<any> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export async function saveSettings(s: any): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function getProcessedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function markProcessed(id: string): Promise<void> {
  const list = await getProcessedIds();
  if (!list.includes(id)) {
    list.push(id);
    const trimmed = list.slice(-500);
    await AsyncStorage.setItem(PROCESSED_KEY, JSON.stringify(trimmed));
  }
}

export async function getTransactions(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveTransactions(list: any[]): Promise<void> {
  await AsyncStorage.setItem(TX_KEY, JSON.stringify(list.slice(0, 500)));
}

export async function addTransaction(tx: any): Promise<void> {
  const list = await getTransactions();
  list.unshift(tx);
  await saveTransactions(list);
}

export async function updateTransaction(id: string, patch: any): Promise<void> {
  const list = await getTransactions();
  const idx = list.findIndex((x: any) => x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    await saveTransactions(list);
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const list = await getTransactions();
  await saveTransactions(list.filter((x: any) => x.id !== id));
}

// ─── تبدیل اعداد فارسی/عربی به انگلیسی
export function normalizeDigits(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// ─── استخراج مبلغ از متن
export function extractAmount(text: string): number {
  const norm = normalizeDigits(text);
  const matches = norm.match(/[\d,]+(?:\.\d+)?/g) || [];
  let best = 0;
  for (const m of matches) {
    const n = Number(m.replace(/,/g, ''));
    if (!isNaN(n) && n > best && n < 1e12) best = n;
  }
  return best;
}

// ─── تشخیص نوع (واریز/برداشت)
export function detectType(text: string): 'deposit' | 'withdraw' | 'unknown' {
  const t = text.toLowerCase();
  const deposit = ['واریز', 'بستانکار', 'افزایش', 'credit', 'deposit', 'received'];
  const withdraw = ['برداشت', 'بدهکار', 'کسر', 'خرید', 'پرداخت', 'debit', 'withdraw', 'purchase'];
  for (const k of deposit) if (t.includes(k)) return 'deposit';
  for (const k of withdraw) if (t.includes(k)) return 'withdraw';
  return 'unknown';
}

// ─── تشخیص تبلیغات/OTP
export function isAdvertisementOrOtp(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(otp|رمز|کد\s*تایید|code)\b/i.test(t)) return true;
  if (/\b(تبلیغ|تخفیف|جشنواره|قرعه|جایزه|کد\s*تخفیف)\b/i.test(t)) return true;
  if (t.length < 20) return true;
  return false;
}

// ─── خواندن پیامک‌ها از گوشی
export async function readSmsInbox(limit: number = 100): Promise<any[]> {
  if (Platform.OS !== 'android') return [];
  if (!SmsReader) throw new Error('SmsReader native module not found');
  try {
    const result = await SmsReader.readInbox(limit);
    return result || [];
  } catch (e: any) {
    console.log('readSmsInbox error:', e);
    return [];
  }
}

// ─── پردازش پیامک‌های جدید
export async function processNewSms(): Promise<{ new: number; total: number; errors: number }> {
  const settings = await getSettings();
  if (!settings.enabled) return { new: 0, total: 0, errors: 0 };

  const inbox = await readSmsInbox(150);
  const processed = await getProcessedIds();
  const processedSet = new Set(processed);
  let newCount = 0;
  let errCount = 0;

  for (const sms of inbox) {
    const id = String(sms.id || '');
    if (!id || processedSet.has(id)) continue;

    try {
      const body = String(sms.body || '');
      if (settings.filterAds && isAdvertisementOrOtp(body)) {
        await markProcessed(id);
        continue;
      }

      const hasKeyword = settings.keywords.some((k: string) => body.includes(k) || body.toLowerCase().includes(k.toLowerCase()));
      if (!hasKeyword) {
        await markProcessed(id);
        continue;
      }

      const amount = extractAmount(body);
      if (amount <= 0) {
        await markProcessed(id);
        continue;
      }

      const type = detectType(body);
      if (type === 'unknown') {
        await markProcessed(id);
        continue;
      }

      const tx = {
        id: 'SMS_' + id,
        smsId: id,
        amount,
        type,
        date: sms.date || Date.now(),
        from: sms.address || '',
        body: body.slice(0, 300),
        status: 'pending',
        createdAt: Date.now(),
      };

      await addTransaction(tx);
      await markProcessed(id);
      newCount++;
    } catch (e) {
      errCount++;
      console.log('sms process err:', e);
    }
  }

  return { new: newCount, total: inbox.length, errors: errCount };
}

// ─── تطبیق تراکنش‌ها با فاکتورها
export async function matchTransactions(settings?: any): Promise<void> {
  const s = settings || await getSettings();
  const txs = await getTransactions();
  const salesRaw = await AsyncStorage.getItem('@mizan_local_all_sales_full');
  const purchasesRaw = await AsyncStorage.getItem('@mizan_local_all_purchases_full');
  const sales = salesRaw ? JSON.parse(salesRaw) : [];
  const purchases = purchasesRaw ? JSON.parse(purchasesRaw) : [];

  const tol = (Number(s.amountTolerance) || 1) / 100;
  const timeTolDays = Number(s.timeTolerance) || 3;
  const timeTolMs = timeTolDays * 24 * 60 * 60 * 1000;

  let changed = false;
  for (const tx of txs) {
    if (tx.status === 'matched' || tx.status === 'rejected') continue;
    const pool = tx.type === 'deposit' ? sales : purchases;
    if (!pool || !pool.length) continue;

    const candidates: any[] = [];
    for (const inv of pool) {
      const invAmount = Number(inv.total || inv.total_amount || inv.amount || 0);
      if (!invAmount) continue;
      const diff = Math.abs(invAmount - tx.amount);
      const pct = diff / invAmount;
      if (pct > tol) continue;

      const invDate = new Date(inv.date_reg || inv.date || inv.created_at || 0).getTime();
      if (!invDate) continue;
      const timeDiff = Math.abs(invDate - tx.date);
      candidates.push({ inv, invAmount, invDate, timeDiff });
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => a.timeDiff - b.timeDiff);
    const best = candidates[0];

    if (s.autoMatch && best.timeDiff <= timeTolMs) {
      tx.status = 'matched';
      tx.matchedInvoice = {
        invoice: best.inv.invoice || best.inv.invoice_number || best.inv.code,
        name: best.inv.customer_name || best.inv.supplier_name || '',
        amount: best.invAmount,
        date: best.invDate,
        diffDays: Math.round(best.timeDiff / (24 * 60 * 60 * 1000)),
      };
      tx.autoMatched = true;
      changed = true;
    } else {
      tx.status = 'pending_confirm';
      tx.candidates = candidates.slice(0, 5).map(c => ({
        invoice: c.inv.invoice || c.inv.invoice_number || c.inv.code,
        name: c.inv.customer_name || c.inv.supplier_name || '',
        amount: c.invAmount,
        date: c.invDate,
        diffDays: Math.round(c.timeDiff / (24 * 60 * 60 * 1000)),
      }));
      changed = true;
    }
  }

  if (changed) await saveTransactions(txs);
}

export async function confirmMatch(txId: string, candidate: any): Promise<void> {
  await updateTransaction(txId, {
    status: 'matched',
    matchedInvoice: candidate,
    confirmedAt: Date.now(),
  });
}

export async function rejectMatch(txId: string): Promise<void> {
  await updateTransaction(txId, { status: 'rejected' });
}

export function getStats(txs: any[]) {
  const matched = txs.filter(t => t.status === 'matched').length;
  const pending = txs.filter(t => t.status === 'pending_confirm').length;
  const unmatched = txs.filter(t => t.status === 'pending' && !t.candidates).length;
  return { total: txs.length, matched, pending, unmatched };
}
