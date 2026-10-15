// lib.app.events.ts — سیستم آگاهی لحظه‌ای
// ربات از هر اتفاقی توی اپ باخبر می‌شه

import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════
// Event Types
// ═══════════════════════════════════════════
export type AppEventType =
  | 'invoice_created'      // فاکتور ثبت شد
  | 'invoice_paid'         // فاکتور پرداخت شد
  | 'invoice_deleted'      // فاکتور حذف شد
  | 'purchase_created'     // خرید ثبت شد
  | 'box_created'          // صندوق ساخته شد
  | 'box_updated'          // صندوق ویرایش شد
  | 'box_deposit'          // واریز به صندوق
  | 'box_withdraw'         // برداشت از صندوق
  | 'box_transfer'         // انتقال بین صندوق
  | 'hawala_created'       // حواله ثبت شد
  | 'hawala_accepted'      // حواله قبول شد
  | 'hawala_delivered'     // حواله تحویل شد
  | 'hawala_cancelled'     // حواله لغو شد
  | 'check_created'        // چک ثبت
  | 'check_cleared'        // چک پاس شد
  | 'customer_added'       // مشتری جدید
  | 'customer_updated'     // مشتری ویرایش
  | 'partner_added'        // شریک جدید
  | 'rate_added'           // نرخ اضافه شد
  | 'rate_updated'         // نرخ آپدیت
  | 'fx_offer_created'     // آگهی ارز
  | 'group_created'        // گروه ساخته شد
  | 'page_changed'         // صفحه عوض شد
  | 'tab_changed'          // تب عوض شد
  | 'form_opened'          // فرم باز شد
  | 'form_submitted'       // فرم ذخیره شد
  | 'form_closed'          // فرم بسته شد
  | 'search_performed'     // جستجو انجام شد
  | 'assistant_command'    // دستور به ربات
  | 'error_occurred';      // خطا

export interface AppEvent {
  id: string;
  type: AppEventType;
  data: any;
  timestamp: number;
  userMessage?: string;     // برای نمایش
}

// ═══════════════════════════════════════════
// Event Emitter (سراسری)
// ═══════════════════════════════════════════
type Listener = (event: AppEvent) => void;

const _listeners: Set<Listener> = new Set();
let _eventCounter = 0;

export function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

export function emit(type: AppEventType, data: any = {}, userMessage?: string): AppEvent {
  _eventCounter++;
  const event: AppEvent = {
    id: 'e_' + Date.now() + '_' + _eventCounter,
    type,
    data,
    timestamp: Date.now(),
    userMessage: userMessage || getEventMessage(type, data),
  };
  
  // فرستادن به همه listener ها
  _listeners.forEach(fn => {
    try { fn(event); } catch (e) { console.log('event listener err:', e); }
  });
  
  // ذخیره در حافظه
  saveToMemory(event);
  
  console.log('📢 event:', type, event.userMessage);
  return event;
}

// ═══════════════════════════════════════════
// پیام خوانا برای هر رویداد
// ═══════════════════════════════════════════
function getEventMessage(type: AppEventType, d: any): string {
  switch (type) {
    case 'invoice_created': return `🧾 فاکتور ${d.invoice || d.code || ''} ثبت شد (${(d.amount || 0).toLocaleString?.() || d.amount} افغانی)`;
    case 'invoice_paid': return `💰 فاکتور ${d.invoice || ''} پرداخت شد`;
    case 'invoice_deleted': return `🗑 فاکتور ${d.invoice || ''} حذف شد`;
    case 'purchase_created': return `🛍️ خرید ثبت شد`;
    case 'box_created': return `📦 صندوق ${d.name || ''} ساخته شد`;
    case 'box_updated': return `✏️ صندوق ${d.name || ''} ویرایش شد`;
    case 'box_deposit': return `➕ واریز ${(d.amount || 0).toLocaleString?.() || d.amount} به ${d.box_name || 'صندوق'}`;
    case 'box_withdraw': return `➖ برداشت ${(d.amount || 0).toLocaleString?.() || d.amount} از ${d.box_name || 'صندوق'}`;
    case 'box_transfer': return `🔄 انتقال ${(d.amount || 0).toLocaleString?.() || d.amount} از ${d.from || ''} به ${d.to || ''}`;
    case 'hawala_created': return `💸 حواله ${d.code || ''} ثبت شد`;
    case 'hawala_accepted': return `✅ حواله ${d.code || ''} قبول شد`;
    case 'hawala_delivered': return `📦 حواله ${d.code || ''} تحویل داده شد`;
    case 'hawala_cancelled': return `❌ حواله ${d.code || ''} لغو شد`;
    case 'check_created': return `📄 چک ${d.number || ''} ثبت شد`;
    case 'check_cleared': return `✅ چک ${d.number || ''} پاس شد`;
    case 'customer_added': return `👤 مشتری ${d.name || ''} اضافه شد`;
    case 'customer_updated': return `✏️ مشتری ${d.name || ''} ویرایش شد`;
    case 'partner_added': return `🤝 شریک ${d.name || ''} اضافه شد`;
    case 'rate_added': return `📈 نرخ ${d.currency || ''} اضافه شد: ${d.rate || ''}`;
    case 'rate_updated': return `📊 نرخ ${d.currency || ''} آپدیت شد`;
    case 'fx_offer_created': return `💱 آگهی فروش ارز ثبت شد`;
    case 'group_created': return `🌐 گروه ${d.name || ''} ساخته شد`;
    case 'page_changed': return `📍 رفت به ${d.label || d.tab || ''}`;
    case 'tab_changed': return `📍 تب ${d.label || d.tab || ''}`;
    case 'form_opened': return `📝 فرم ${d.label || ''} باز شد`;
    case 'form_submitted': return `✅ فرم ${d.label || ''} ذخیره شد`;
    case 'form_closed': return `✕ فرم ${d.label || ''} بسته شد`;
    case 'search_performed': return `🔍 جستجو: ${d.query || ''}`;
    case 'assistant_command': return `🤖 دستور: ${d.text || ''}`;
    case 'error_occurred': return `❌ خطا: ${d.message || ''}`;
    default: return '📢 رویداد';
  }
}

// ═══════════════════════════════════════════
// حافظه رویدادها (آخرین ۲۰۰ تا)
// ═══════════════════════════════════════════
const MEMORY_KEY = '@mizan_events_memory_v1';
const MEMORY_LIMIT = 200;

let _memory: AppEvent[] = [];
let _memoryLoaded = false;

async function loadMemory(): Promise<void> {
  if (_memoryLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(MEMORY_KEY);
    _memory = raw ? JSON.parse(raw) : [];
    _memoryLoaded = true;
  } catch { _memory = []; _memoryLoaded = true; }
}

function saveToMemory(event: AppEvent): void {
  _memory.unshift(event);
  if (_memory.length > MEMORY_LIMIT) _memory = _memory.slice(0, MEMORY_LIMIT);
  // async save
  AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(_memory)).catch(() => {});
}

export async function getRecentEvents(limit: number = 20): Promise<AppEvent[]> {
  await loadMemory();
  return _memory.slice(0, limit);
}

export async function getEventsByType(type: AppEventType, limit: number = 20): Promise<AppEvent[]> {
  await loadMemory();
  return _memory.filter(e => e.type === type).slice(0, limit);
}

export async function getTodayEvents(): Promise<AppEvent[]> {
  await loadMemory();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return _memory.filter(e => e.timestamp >= today.getTime());
}

export async function clearMemory(): Promise<void> {
  _memory = [];
  await AsyncStorage.removeItem(MEMORY_KEY);
}

// ═══════════════════════════════════════════
// خلاصه برای نمایش
// ═══════════════════════════════════════════
export async function getTodaySummary(): Promise<string> {
  const events = await getTodayEvents();
  if (!events.length) return '📭 امروز هیچ رویدادی نداری';
  
  const counts: Record<string, number> = {};
  events.forEach(e => {
    counts[e.type] = (counts[e.type] || 0) + 1;
  });
  
  const lines: string[] = ['📊 خلاصه امروز:'];
  if (counts['invoice_created']) lines.push(`  🧾 ${counts['invoice_created']} فاکتور ثبت شد`);
  if (counts['box_deposit']) lines.push(`  ➕ ${counts['box_deposit']} واریز`);
  if (counts['box_withdraw']) lines.push(`  ➖ ${counts['box_withdraw']} برداشت`);
  if (counts['hawala_created']) lines.push(`  💸 ${counts['hawala_created']} حواله جدید`);
  if (counts['hawala_delivered']) lines.push(`  ✅ ${counts['hawala_delivered']} حواله تحویل شد`);
  if (counts['customer_added']) lines.push(`  👤 ${counts['customer_added']} مشتری جدید`);
  if (counts['rate_updated']) lines.push(`  📊 ${counts['rate_updated']} نرخ آپدیت شد`);
  
  if (lines.length === 1) lines.push('  (فقط رویدادهای عادی)');
  return lines.join('\n');
}

// ═══════════════════════════════════════════
// ثبت فعالیت اخیر (برای آگاهی)
// ═══════════════════════════════════════════
export interface UserActivity {
  lastTab?: string;
  lastSub?: string;
  lastModal?: string;
  lastSearch?: string;
  lastEvent?: AppEvent;
}

let _activity: UserActivity = {};

export function updateActivity(patch: Partial<UserActivity>): void {
  _activity = { ..._activity, ...patch };
}

export function getActivity(): UserActivity {
  return _activity;
}

// ═══════════════════════════════════════════
// آمار
// ═══════════════════════════════════════════
export async function getEventStats() {
  await loadMemory();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEvents = _memory.filter(e => e.timestamp >= today.getTime());
  return {
    total: _memory.length,
    today: todayEvents.length,
    listeners: _listeners.size,
  };
}
