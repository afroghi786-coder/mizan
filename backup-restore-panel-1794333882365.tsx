import DeviceNameTopBar from './DeviceNameTopBar';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator, RefreshControl, Platform, Modal } from 'react-native';
import AuditPinGate from './AuditPinGate';
import { getDeletedItems, restoreItem, permanentlyDeleteItem, restoreMany, permanentlyDeleteMany, enrichMissingSnapshots, setDeviceName, TABLE_LABELS, DeletedItem , cleanupAllLocalTombstones , fetchSnapshotsFromSheetForAll } from './lib.recovery';
import { clearSnapshotCache } from './lib.snapshot';
import AsyncStorage from './lib.storage';
import { displayDate } from './lib.offline';
import { getCalType } from './lib';

const ALL_TABLES = Object.keys(TABLE_LABELS);

type Col = { k: string; l: string; w?: number; money?: boolean };

const COLS: Record<string, Col[]> = {
  sales: [
    { k: 'invoice_number', l: 'فاکتور', w: 100 },
    { k: 'customer_name', l: 'مشتری', w: 100 },
    { k: 'customer_phone', l: 'تلفن', w: 95 },
    { k: 'total', l: 'مبلغ کل', w: 90, money: true },
    { k: 'payment', l: 'پرداخت', w: 80, money: true },
    { k: 'bank_name', l: 'بانک', w: 90 },
    { k: 'shipping', l: 'باربری', w: 80 },
    { k: 'date_factor', l: 'تاریخ', w: 90 },
  ],
  purchases: [
    { k: 'invoice_number', l: 'فاکتور', w: 100 },
    { k: 'manual_invoice', l: 'دستی', w: 60 },
    { k: 'supplier_name', l: 'تأمین‌کننده', w: 100 },
    { k: 'supplier_phone', l: 'تلفن', w: 95 },
    { k: 'total', l: 'مبلغ کل', w: 90, money: true },
    { k: 'payment', l: 'پرداخت', w: 80, money: true },
    { k: 'bank_name', l: 'بانک', w: 90 },
    { k: 'date_factor', l: 'تاریخ', w: 90 },
  ],
  partners: [
    { k: 'code', l: 'کد', w: 70 },
    { k: 'name', l: 'نام', w: 160 },
    { k: 'phone', l: 'تلفن', w: 110 },
    { k: 'share_percent', l: 'سهم%', w: 70 },
    { k: 'status', l: 'وضعیت', w: 70 },
  ],
  parties: [
    { k: 'code', l: 'کد', w: 70 },
    { k: 'name', l: 'نام', w: 160 },
    { k: 'phone', l: 'تلفن', w: 110 },
    { k: 'type', l: 'نوع', w: 70 },
    { k: 'status', l: 'وضعیت', w: 70 },
  ],
  products: [
    { k: 'code', l: 'کد', w: 70 },
    { k: 'name', l: 'نام', w: 180 },
    { k: 'price', l: 'قیمت', w: 90, money: true },
    { k: 'shelf', l: 'قفسه', w: 80 },
  ],
  banks: [
    { k: 'code', l: 'کد', w: 70 },
    { k: 'name', l: 'نام بانک', w: 200 },
    { k: 'note', l: 'یادداشت', w: 150 },
  ],
  shippings: [
    { k: 'name', l: 'نام', w: 200 },
    { k: 'phone', l: 'تلفن', w: 120 },
    { k: 'note', l: 'یادداشت', w: 150 },
  ],
  expenses: [
    { k: 'title', l: 'عنوان', w: 160 },
    { k: 'amount', l: 'مبلغ', w: 100, money: true },
    { k: 'date', l: 'تاریخ', w: 100 },
    { k: 'description', l: 'توضیح', w: 150 },
  ],
  employees: [
    { k: 'code', l: 'کد', w: 70 },
    { k: 'name', l: 'نام', w: 160 },
    { k: 'phone', l: 'تلفن', w: 110 },
    { k: 'address', l: 'آدرس', w: 150 },
  ],
  salary_payments: [
    { k: 'employee_name', l: 'کارمند', w: 160 },
    { k: 'amount', l: 'مبلغ', w: 100, money: true },
    { k: 'date', l: 'تاریخ', w: 100 },
  ],
  employee_loans: [
    { k: 'employee_name', l: 'کارمند', w: 160 },
    { k: 'amount', l: 'مبلغ', w: 100, money: true },
    { k: 'date', l: 'تاریخ', w: 100 },
  ],
  attendance: [
    { k: 'employee_name', l: 'کارمند', w: 160 },
    { k: 'date', l: 'تاریخ', w: 110 },
  ],
  employee_leaves: [
    { k: 'employee_name', l: 'کارمند', w: 160 },
    { k: 'date', l: 'تاریخ', w: 110 },
  ],
  payroll_batches: [
    { k: 'batch_number', l: 'شماره دسته', w: 120 },
    { k: 'total', l: 'مبلغ کل', w: 120, money: true },
    { k: 'date', l: 'تاریخ', w: 100 },
  ],
  stock_adjustments: [
    { k: 'product_name', l: 'محصول', w: 160 },
    { k: 'product_code', l: 'کد', w: 70 },
    { k: 'quantity', l: 'مقدار', w: 80 },
    { k: 'date', l: 'تاریخ', w: 100 },
    { k: 'description', l: 'دلیل', w: 130 },
  ],
  partner_transactions: [
    { k: 'partner_name', l: 'شریک', w: 140 },
    { k: 'amount', l: 'مبلغ', w: 100, money: true },
    { k: 'transaction_date', l: 'تاریخ', w: 100 },
    { k: 'description', l: 'توضیح', w: 150 },
  ],
  partner_bank_accounts: [
    { k: 'partner_name', l: 'شریک', w: 130 },
    { k: 'bank_name', l: 'بانک', w: 120 },
    { k: 'account_number', l: 'شماره حساب', w: 140 },
    { k: 'card_number', l: 'کارت', w: 140 },
  ],
  sales_returns: [
    { k: 'invoice_number', l: 'فاکتور', w: 100 },
    { k: 'customer_name', l: 'مشتری', w: 130 },
    { k: 'total', l: 'مبلغ', w: 100, money: true },
    { k: 'date', l: 'تاریخ', w: 100 },
  ],
  purchase_returns: [
    { k: 'invoice_number', l: 'فاکتور', w: 100 },
    { k: 'supplier_name', l: 'تأمین‌کننده', w: 130 },
    { k: 'total', l: 'مبلغ', w: 100, money: true },
    { k: 'date', l: 'تاریخ', w: 100 },
  ],
};

const FIELD_LABELS_FA: Record<string, string> = {
  invoice_number: 'شماره فاکتور',
  invoice: 'شماره فاکتور',
  manual_invoice: 'شماره دستی',
  customer_code: 'کد مشتری',
  customer_name: 'نام مشتری',
  customer_phone: 'تلفن مشتری',
  supplier_code: 'کد تأمین‌کننده',
  supplier_name: 'نام تأمین‌کننده',
  supplier_phone: 'تلفن تأمین‌کننده',
  account_holder: 'صاحب حساب',
  account_holder_code: 'کد صاحب حساب',
  bank_name: 'بانک',
  bank: 'بانک',
  model_code: 'کد کالا',
  model_name: 'نام کالا',
  quantity: 'مقدار',
  price_unit: 'قیمت واحد',
  payment: 'پرداخت',
  total: 'مبلغ کل',
  paid: 'پرداخت‌شده',
  deposit_date: 'تاریخ واریز',
  shipping: 'باربری',
  shipping_name: 'باربری',
  date_factor: 'تاریخ فاکتور',
  date_reg: 'تاریخ ثبت',
  date: 'تاریخ',
  description: 'توضیح',
  note: 'یادداشت',
  code: 'کد',
  name: 'نام',
  phone: 'تلفن',
  address: 'آدرس',
  type: 'نوع',
  status: 'وضعیت',
  share_percent: 'سهم درصدی',
  amount: 'مبلغ',
  title: 'عنوان',
  employee_name: 'نام کارمند',
  employee_code: 'کد کارمند',
  product_name: 'نام محصول',
  product_code: 'کد محصول',
  partner_name: 'نام شریک',
  partner_code: 'کد شریک',
  account_number: 'شماره حساب',
  card_number: 'شماره کارت',
  iban: 'شماره شبا',
  batch_number: 'شماره دسته',
  transaction_date: 'تاریخ تراکنش',
  reason: 'دلیل',
  payerName: 'پرداخت‌کننده',
  payerCode: 'کد پرداخت‌کننده',
  accountHolder: 'صاحب حساب',
  accountHolderCode: 'کد صاحب حساب',
  holderCode: 'کد صاحب حساب',
  source_id: 'شناسه منبع',
  items: 'اقلام',
  shelf: 'قفسه',
  price: 'قیمت',
};

const HIDE_FIELDS = new Set<string>([
  '_pending','_deleted','_sync','_localId','local_id','id','user_id',
  'device_id','created_at','updated_at','deleted_at','raw','snapshot','sync_status',
]);

const FLAT_ITEM_KEYS = new Set<string>([
  'model_code','model_name','product_code','product_name',
  'quantity','qty','price_unit','price','shelf',
]);

const TOTAL_KEYS_SET = new Set<string>([
  'total','amount','paid','payment','grand_total',
]);

function getRaw(item: any): any {
  return item?.snapshot?.raw || null;
}

function val(raw: any, k: string, money?: boolean): string {
  if (!raw) return '';
  let v = raw[k];
  if (v === undefined || v === null || v === '') {
    const alt: Record<string, string[]> = {
      invoice_number: ['invoice'],
      customer_name: ['name'],
      supplier_name: ['name'],
      customer_phone: ['phone'],
      supplier_phone: ['phone'],
      bank_name: ['bank'],
      total: ['amount'],
      payment: ['paid'],
      date_factor: ['date'],
      transaction_date: ['date'],
      product_name: ['name'],
      product_code: ['code'],
    };
    for (const a of (alt[k] || [])) {
      if (raw[a] !== undefined && raw[a] !== null && raw[a] !== '') { v = raw[a]; break; }
    }
  }
  if (v === undefined || v === null || v === '') return '';
  if (money) {
    const n = Number(v);
    if (!isNaN(n) && n !== 0) return n.toLocaleString('fa-IR');
  }
  const s = String(v);
  if (s.includes('T') && s.length > 12) return s.slice(0, 10);
  return s.length > 22 ? s.slice(0, 22) + '…' : s;
}

function timeAgo(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const d = Date.now() - t;
    if (d < 60000) return 'همین حالا';
    if (d < 3600000) return Math.floor(d / 60000) + ' دقیقه';
    if (d < 86400000) return Math.floor(d / 3600000) + ' ساعت';
    if (d < 604800000) return Math.floor(d / 86400000) + ' روز';
    return new Date(iso).toLocaleDateString('fa-IR');
  } catch { return ''; }
}

function _tryDisplayDate(val: any): string {
  try {
    let s = String(displayDate(val as any) || '');
    if (!s || s === 'Invalid Date' || s === 'NaN/NaN/NaN') return '';
    if (s.indexOf('NaN') >= 0) return '';
    return s;
  } catch { return ''; }
}

function formatFullDate(iso: string): string {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '').trim();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timePart = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    const gregDate = d.getFullYear() + '/' + pad(d.getMonth()+1) + '/' + pad(d.getDate());
    const gregFull = gregDate + ' ' + timePart;
    let conv = '';
    try { conv = _tryDisplayDate(gregFull); } catch {}
    if (!conv) { try { conv = _tryDisplayDate(gregDate); } catch {} }
    if (!conv) { try { conv = _tryDisplayDate(d); } catch {} }
    conv = String(conv || '').replace(/\s+\d{1,2}:\d{2}(:\d{2})?.*$/, '').trim();
    if (!conv || conv === 'Invalid Date' || conv.indexOf('NaN') >= 0) conv = gregDate;
    return conv + ' ' + timePart;
  } catch { return String(iso || '').trim(); }
}

const DATE_FIELD_NAMES = new Set<string>([
  'date','date_factor','date_reg','deposit_date','transaction_date',
  'return_date','created_at','updated_at','deleted_at','due_date','expiry_date',
]);

function isDateField(k: string): boolean {
  if (DATE_FIELD_NAMES.has(k)) return true;
  if (k.endsWith('_date')) return true;
  if (k.startsWith('date_')) return true;
  return false;
}

function formatValueForField(k: string, v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (isDateField(k)) {
    const f = formatFullDate(String(v));
    return f || String(v);
  }
  if (typeof v === 'number') return v.toLocaleString('fa-IR');
  return String(v);
}

function currentCalLabel(): string {
  try {
    const c = getCalType();
    if (c === 'gregorian') return 'میلادی';
    if (c === 'hijri') return 'قمری';
    return 'شمسی';
  } catch { return ''; }
}

function shortId(id: string): string {
  if (!id) return '—';
  return id.length <= 16 ? id : '…' + id.slice(-10);
}

function confirmAsync(title: string, msg: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try { return Promise.resolve(!!(window as any).confirm(title + '\n\n' + msg)); }
    catch { return Promise.resolve(false); }
  }
  const { Alert } = require('react-native');
  return new Promise((resolve) => {
    Alert.alert(title, msg,
      [{ text: 'لغو', style: 'cancel', onPress: () => resolve(false) },
       { text: 'تأیید', style: 'destructive', onPress: () => resolve(true) }],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export default function RecoveryPanel({ showToast, onBack }: any) {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [recoveryTab, setRecoveryTab] = useState<'deleted' | 'edited'>('deleted');
  const visibleItems = recoveryTab === 'deleted' ? items : [];
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTable, setFilterTable] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string>('');
  const [deviceLabelInput, setDeviceLabelInput] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<DeletedItem | null>(null);
  const [myDeviceId, setMyDeviceId] = useState('');
  const [myDeviceLabel, setMyDeviceLabel] = useState('');
  useEffect(() => {
    (async () => {
      try { const id = await AsyncStorage.getItem('@mizan_device_id'); if (id) setMyDeviceId(String(id)); } catch {}
      try { const lb = await AsyncStorage.getItem('@mizan_device_label'); if (lb) setMyDeviceLabel(String(lb)); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@mizan_audit_events');
        let arr: any[] = [];
        try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        const edits = arr.filter((e: any) => e && (e.action === 'update' || e.action === 'create' || e.action === 'delete'));
        setAuditEvents(edits.slice(-60).reverse());
      } catch {}
    })();
  }, []);

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [namingId, setNamingId] = useState('');
  const [namingText, setNamingText] = useState('');
  const [tombstoneStats, setTombstoneStats] = useState<any>({ total: 0, oldest: '', newest: '', byTable: {} });
  const [mainTab, setMainTab] = useState<'deleted'|'edited'|'settings'>('deleted');
  const [editDetailItem, setEditDetailItem] = useState<any>(null);
  const [editSearch, setEditSearch] = useState('');
  const [enrichStatus, setEnrichStatus] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [enrichMsg, setEnrichMsg] = useState('');

  const handleCleanupAll = async () => {
    const msg = 'همه حذف‌شده‌های محلی (tombstone + ردیف‌ها) پاک شوند؟\n\nشیت و Supabase دست نمی‌خورند.';
    const ok = Platform.OS === 'web'
      ? (typeof window !== 'undefined' && window.confirm ? window.confirm(msg) : true)
      : true;
    if (!ok) return;
    try {
      const r = await cleanupAllLocalTombstones();
      if (r.ok) {
        if (showToast) showToast('🧹 ' + r.tombstones + ' tombstone و ' + r.rowsRemoved + ' ردیف پاک شد', false);
        await load();
      } else if (showToast) showToast(r.error || 'خطا', true);
    } catch (e: any) {
      if (showToast) showToast(e?.message || 'خطا', true);
    }
  };

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      clearSnapshotCache();
      try { await enrichMissingSnapshots(); } catch {}
      const list = await getDeletedItems();
      setItems(list);
      setSelected(new Set());
      try { const st = await getTombstoneStats(); setTombstoneStats(st); } catch {}
    } catch (e: any) { console.log('[RP] load:', e?.message); }
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // AUTO_ENRICH_FROM_SHEET — یک بار در هر نشست، در پس‌زمینه
  useEffect(() => {
    let alive = true;
    (async () => {
      // ۲.۵ ثانیه صبر تا UI اول باز شود
      await new Promise(r => setTimeout(r, 2500));
      if (!alive) return;
      setEnrichStatus('loading');
      setEnrichMsg('در حال دریافت جزئیات از شیت...');
      const r = await fetchSnapshotsFromSheetForAll();
      if (!alive) return;
      if (r.ok) {
        setEnrichStatus('ok');
        setEnrichMsg('✅ ' + r.filled + ' مورد از شیت پر شد (کل: ' + r.total + ')');
        if (r.filled > 0) {
          try { const fresh = await getDeletedItems(); if (alive) setItems(fresh); } catch {}
        }
      } else {
        setEnrichStatus('error');
        setEnrichMsg('⚠️ ' + (r.error || 'خطا در دریافت از شیت'));
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try { const v = await AsyncStorage.getItem('@mizan_device_label'); if (v) setDeviceLabelInput(String(v)); } catch {}
    })();
  }, []);

  const handleCleanupTombstones = async () => {
    let hoursStr = '0';
    if (Platform.OS === 'web') {
      hoursStr = window.prompt('پاک‌سازی tombstoneها — چند ساعت اخیر نگه داشته شود؟\n\n0 = همه پاک شوند\n1 = فقط 1 ساعت اخیر\n24 = فقط 24 ساعت اخیر\n168 = فقط یک هفته اخیر', '0');
    }
    if (hoursStr === null || hoursStr === '') return;
    const hours = Number(hoursStr);
    if (isNaN(hours) || hours < 0) return;
    const r = await cleanupTombstonesByHours(hours);
    if (r.ok) {
      if (showToast) showToast('🧹 ' + r.removed + ' مورد پاک شد — ' + r.remaining + ' باقی ماند', false);
      await load();
    } else if (showToast) showToast(r.error || 'خطا', true);
  };

  const saveDeviceLabel = async (txt: string) => {
    setDeviceLabelInput(txt);
    try { await AsyncStorage.setItem('@mizan_device_label', txt); } catch {}
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of items) m[x.table] = (m[x.table] || 0) + 1;
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterTable !== 'all') list = list.filter((x) => x.table === filterTable);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((x) => {
        const raw = getRaw(x) || {};
        const hay = [x.key, x.tableLabel, x.device_id, x.device_label,
          ...Object.values(raw).map((v: any) => (typeof v === 'string' || typeof v === 'number') ? String(v) : '')
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [items, filterTable, search]);

  const allSelected = filtered.length > 0 && filtered.every(x => selected.has(x.table + '|' + x.key));
  const toggleOne = (k: string) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else {
      const n = new Set<string>();
      for (const x of filtered) n.add(x.table + '|' + x.key);
      setSelected(n);
    }
  };

  const doRestore = async (item: DeletedItem) => {
    if (!(await confirmAsync('♻️ بازیابی', 'این مورد به برنامه برگردد؟'))) return;
    setBusyKey(item.table + '|' + item.key);
    const r = await restoreItem(item.table, item.key);
    setBusyKey('');
    if (r.ok) { if (showToast) showToast('✅ بازیابی شد', false); await load(); }
    else if (showToast) showToast(r.error || 'خطا', true);
  };

  const doDelete = async (item: DeletedItem) => {
    if (!(await confirmAsync('⚠️ حذف نهایی', 'این مورد برای همیشه از شیت و حافظه پاک می‌شود. مطمئنی؟'))) return;
    setBusyKey(item.table + '|' + item.key);
    const r = await permanentlyDeleteItem(item.table, item.key);
    setBusyKey('');
    if (r.ok) { if (showToast) showToast('🗑️ حذف نهایی شد', false); await load(); }
    else if (showToast) showToast(r.error || 'خطا', true);
  };

  const doRestoreSelected = async () => {
    if (selected.size === 0) return;
    if (!(await confirmAsync('♻️ بازیابی', selected.size + ' مورد به برنامه برگردند؟'))) return;
    const arr = Array.from(selected).map(k => { const i = k.indexOf('|'); return { table: k.slice(0, i), key: k.slice(i + 1) }; });
    const r = await restoreMany(arr);
    if (r.ok) { if (showToast) showToast('✅ ' + r.restored + ' مورد بازیابی شد', false); await load(); }
    else if (showToast) showToast(r.error || 'خطا', true);
  };

  const doDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!(await confirmAsync('⚠️ حذف نهایی', selected.size + ' مورد پاک شوند؟'))) return;
    const arr = Array.from(selected).map(k => { const i = k.indexOf('|'); return { table: k.slice(0, i), key: k.slice(i + 1) }; });
    const r = await permanentlyDeleteMany(arr);
    if (r.ok || r.deleted > 0) { if (showToast) showToast('🗑️ ' + r.deleted + ' حذف شد', false); await load(); }
    else if (showToast) showToast(r.error || 'خطا', true);
  };


  const doDeleteAudit = async (ev: any) => {
    if (!(await confirmAsync('حذف اطلاع ویرایش', 'آیا از حذف این اطلاع مطمئن هستید؟ (داده اصلی فاکتور دست‌نخورده می‌ماند)'))) return;
    try {
      const key = '@mizan_audit_events';
      const raw = await AsyncStorage.getItem(key);
      let events = raw ? JSON.parse(raw) : [];
      
      // پیدا کردن و حذف دقیق همان رویداد
      events = events.filter((e: any) => {
        const isSame = (e.key === ev.key && e.table === ev.table && e.at === ev.at && e.action === ev.action);
        return !isSame;
      });
      
      await AsyncStorage.setItem(key, JSON.stringify(events));
      
      // تلاش برای پوش کردن تغییرات به شیت (اگر تابع سینک سراسری وجود داشته باشد)
      try {
        if (typeof (globalThis as any).__mizan_sync === 'function') {
          await (globalThis as any).__mizan_sync();
        }
      } catch (err) {}
      
      if (showToast) showToast('🗑️ اطلاع ویرایش از حافظه و شیت حذف شد', false);
      await load(); 
    } catch (e) {
      if (showToast) showToast('خطا در حذف اطلاع', true);
    }
  };

  const currentCols = filterTable !== 'all' ? (COLS[filterTable] || []) : [];
  const isSingleTable = filterTable !== 'all' && currentCols.length > 0;
  const editedItems = auditEvents.filter((e: any) => e.action === 'update' && !((e.before?.items?.length || 0) > (e.after?.items?.length || 0)));
  const filteredEdits = (filterTable === 'all' ? editedItems : editedItems.filter((e: any) => e.table === filterTable || (filterTable === 'purchases' && e.table === 'purchases_grouped')))
    .filter((e: any) => {
      if (!editSearch) return true;
      const q = editSearch.toLowerCase();
      if (e.key && String(e.key).toLowerCase().includes(q)) return true;
      if (JSON.stringify(e.before || {}).toLowerCase().includes(q)) return true;
      if (JSON.stringify(e.after || {}).toLowerCase().includes(q)) return true;
      return false;
    });
  const unknownDevices = useMemo(() => Array.from(new Set(items.map(x => x.device_id).filter(Boolean))), [items]);

  return (
    <AuditPinGate>
      <View style={st.page}>
        <View style={st.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={st.backBtn}>
              <Text style={st.backBtnTxt}>←</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={st.title}>♻️ بازیابی</Text>
            <Text style={st.sub}>{items.length} مورد حذف‌شده</Text>
          </View>
          <TouchableOpacity style={st.iconBtn} onPress={() => load(true)}><Text style={st.iconTxt}>🔄</Text></TouchableOpacity>
          

        </View>

                {/* ================= تب‌های اصلی ================= */}
        <View style={{ flexDirection: 'row-reverse', marginHorizontal: 10, marginTop: 10, backgroundColor: '#0f172a', borderRadius: 12, padding: 6, borderWidth: 1, borderColor: '#1f3a5f' }}>
          <TouchableOpacity onPress={() => setMainTab('deleted')} style={{ flex: 1, paddingVertical: 12, backgroundColor: mainTab === 'deleted' ? '#dc2626' : 'transparent', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: mainTab === 'deleted' ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 'bold' }}>🗑️ حذف شده‌ها</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMainTab('edited')} style={{ flex: 1, paddingVertical: 12, backgroundColor: mainTab === 'edited' ? '#2563eb' : 'transparent', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: mainTab === 'edited' ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 'bold' }}>✏️ ویرایش شده‌ها</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMainTab('settings')} style={{ flex: 1, paddingVertical: 12, backgroundColor: mainTab === 'settings' ? '#0891b2' : 'transparent', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: mainTab === 'settings' ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 'bold' }}>⚙️ تنظیمات</Text>
          </TouchableOpacity>
        </View>

        {/* ================= تب ۱: حذف شده‌ها ================= */}
        {mainTab === 'deleted' && (
          <View style={{ flex: 1 }}>
            
            {enrichStatus !== 'idle' ? (
              <View style={{
                marginHorizontal: 10, marginTop: 6, padding: 8, borderRadius: 8, borderWidth: 1,
                backgroundColor: enrichStatus === 'error' ? '#7f1d1d' : enrichStatus === 'ok' ? '#14532d' : '#1e3a5f',
                borderColor: enrichStatus === 'error' ? '#dc2626' : enrichStatus === 'ok' ? '#059669' : '#0891b2',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, textAlign: 'right', fontWeight: 'bold' }}>
                  {enrichStatus === 'loading' ? '⏳ ' : ''}{enrichMsg}
                </Text>
              </View>
            ) : null}

            

            <View style={st.searchWrap}>
              <TextInput value={search} onChangeText={setSearch} placeholder="جستجو در همه فیلدها..." placeholderTextColor="#64748b" style={st.searchInp} />
            </View>

            {/* زیرتب‌ها (فیلترها) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterScroll} contentContainerStyle={st.filterRow}>
              <TouchableOpacity onPress={() => setFilterTable('all')} style={[st.chip, filterTable === 'all' && st.chipActive, items.length > 0 && { backgroundColor: '#7f1d1d', borderColor: '#dc2626' }]}>
                <Text style={[st.chipTxt, filterTable === 'all' && st.chipTxtActive, items.length > 0 && { color: '#fca5a5' }]}>همه ({items.length})</Text>
              </TouchableOpacity>
              {Object.keys(COLS).map(k => {
                const count = items.filter((x: any) => x.table === k).length;
                const isDanger = count > 0;
                return (
                  <TouchableOpacity key={k} onPress={() => setFilterTable(k)} style={[st.chip, filterTable === k && st.chipActive, isDanger && { backgroundColor: '#7f1d1d', borderColor: '#dc2626' }]}>
                    <Text style={[st.chipTxt, filterTable === k && st.chipTxtActive, isDanger && { color: '#fca5a5' }]}>
                      {TABLE_LABELS[k] || k} {isDanger ? `(${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filtered.length > 0 ? (
              <View style={st.selectAllBar}>
                <TouchableOpacity onPress={toggleAll} style={st.selectAllBtn}>
                  <View style={[st.checkbox, allSelected && st.checkboxOn]}>{allSelected ? <Text style={st.checkTxt}>✓</Text> : null}</View>
                  <Text style={st.selectAllTxt}>انتخاب همه ({filtered.length})</Text>
                </TouchableOpacity>
                {selected.size > 0 ? (
                  <TouchableOpacity onPress={() => setSelected(new Set())} style={st.clearSelBtn}><Text style={st.clearSelTxt}>✕ {selected.size}</Text></TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <ScrollView style={st.list} contentContainerStyle={{ padding: 6, paddingBottom: 100 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#0891b2" />}>
              {loading ? <ActivityIndicator color="#0891b2" style={{ marginTop: 30 }} /> : null}
              {!loading && filtered.length === 0 ? (
                <View style={st.emptyWrap}>
                  <Text style={st.emptyIcon}>📭</Text>
                  <Text style={st.emptyTxt}>{items.length === 0 ? 'هیچ موردی حذف نشده' : 'موردی پیدا نشد'}</Text>
                </View>
              ) : null}

              {!loading && filtered.length > 0 ? (
                isSingleTable ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <View style={st.thead}>
                        <View style={st.tcellChk} />
                        <View style={[st.tcell, { width: 50 }]}><Text style={st.thTxt}>#</Text></View>
                        {currentCols.map(c => (
                          <View key={c.k} style={[st.tcell, { width: c.w || 100 }]}>
                            <Text style={st.thTxt} numberOfLines={1}>{c.l}</Text>
                          </View>
                        ))}
                        <View style={[st.tcell, { width: 130 }]}><Text style={st.thTxt}>تاریخ حذف</Text></View>
                        <View style={[st.tcell, { width: 170 }]}><Text style={st.thTxt}>عملیات</Text></View>
                      </View>
                      {filtered.map((item, idx) => {
                        const k = item.table + '|' + item.key;
                        const raw = getRaw(item);
                        const isSel = selected.has(k);
                        const isBusy = busyKey === k;
                        const devLabel = item.device_label || (item.device_id ? 'دستگاه ' + shortId(item.device_id) : 'نامشخص');
                        return (
                          <View key={k}>
                            <TouchableOpacity onPress={() => setDetailItem(item)} style={[st.trow, isSel && st.trowSel, idx % 2 === 1 && st.trowAlt]}>
                              <TouchableOpacity onPress={() => toggleOne(k)} style={st.tcellChk}>
                                <View style={[st.checkboxSm, isSel && st.checkboxOn]}>{isSel ? <Text style={st.checkTxt}>✓</Text> : null}</View>
                              </TouchableOpacity>
                              <View style={[st.tcell, { width: 50 }]}>
                                <Text style={st.tdTxt} numberOfLines={1}>{idx + 1}</Text>
                              </View>
                              {currentCols.map(c => (
                                <View key={c.k} style={[st.tcell, { width: c.w || 100 }]}>
                                  <Text style={[st.tdTxt, c.money && st.tdMoney]} numberOfLines={1}>
                                    {val(raw, c.k, c.money) || '—'}
                                  </Text>
                                </View>
                              ))}
                              <View style={[st.tcell, { width: 140, alignItems: 'flex-end' }]}>
                                <Text style={[st.tdTxt, { fontSize: 9 }]} numberOfLines={1}>{formatFullDate(item.deleted_at)}</Text>
                                <Text style={[st.tdTxt, { fontSize: 8, color: '#64748b' }]} numberOfLines={1}>{timeAgo(item.deleted_at)}</Text>
                              </View>
                              <View style={[st.tcell, { width: 170, flexDirection: 'row-reverse', gap: 4 }]}>
                                <TouchableOpacity onPress={() => doRestore(item)} disabled={isBusy} style={[st.btnMini, { backgroundColor: '#166534' }]}><Text style={st.btnMiniTxt}>♻️</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => doDelete(item)} disabled={isBusy} style={[st.btnMini, { backgroundColor: '#7f1d1d' }]}><Text style={st.btnMiniTxt}>🗑️</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setDetailItem(item)} style={[st.btnMini, { backgroundColor: '#334155' }]}><Text style={st.btnMiniTxt}>👁️</Text></TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                            <View style={st.devRow}>
                              <Text style={st.devRowTxt} numberOfLines={1}>🗑️ {devLabel} {item.device_id && item.device_label ? '• ' + shortId(item.device_id) : ''}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                ) : (
                  filtered.map((item) => {
                    const k = item.table + '|' + item.key;
                    const raw = getRaw(item);
                    const isSel = selected.has(k);
                    const isBusy = busyKey === k;
                    const devLabel = item.device_label || (item.device_id ? 'دستگاه ' + shortId(item.device_id) : 'نامشخص');
                    return (
                      <TouchableOpacity key={k} onPress={() => setDetailItem(item)} style={[st.mixedRow, isSel && st.trowSel]}>
                        <TouchableOpacity onPress={() => toggleOne(k)} style={st.tcellChk}>
                          <View style={[st.checkboxSm, isSel && st.checkboxOn]}>{isSel ? <Text style={st.checkTxt}>✓</Text> : null}</View>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 2 }}>
                            <View style={st.badge}><Text style={st.badgeTxt}>{item.tableLabel}</Text></View>
                            <Text style={st.agoTxt}>{formatFullDate(item.deleted_at)}</Text>
                          </View>
                          <Text style={st.mixedTitle} numberOfLines={1}>
                            {raw ? (raw.invoice_number || raw.invoice || raw.name || raw.code || item.key) : item.key}
                          </Text>
                          <Text style={st.mixedSub} numberOfLines={1}>
                            {raw ? [raw.customer_name || raw.supplier_name || raw.name, raw.total || raw.amount, raw.date_factor || raw.date].filter(Boolean).join(' • ') : '—'}
                          </Text>
                          <Text style={st.mixedDev} numberOfLines={1}>🗑️ {devLabel}</Text>
                        </View>
                        <View style={{ flexDirection: 'row-reverse', gap: 4, marginRight: 4 }}>
                          <TouchableOpacity onPress={() => doRestore(item)} disabled={isBusy} style={[st.btnMini, { backgroundColor: '#166534' }]}><Text style={st.btnMiniTxt}>♻️</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => doDelete(item)} disabled={isBusy} style={[st.btnMini, { backgroundColor: '#7f1d1d' }]}><Text style={st.btnMiniTxt}>🗑️</Text></TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )
              ) : null}
            </ScrollView>

            {selected.size > 0 ? (
              <View style={st.batchBar}>
                <Text style={st.batchTxt}>{selected.size} انتخاب</Text>
                <TouchableOpacity style={st.batchBtnRestore} onPress={doRestoreSelected}><Text style={st.batchBtnTxt}>♻️ بازیابی</Text></TouchableOpacity>
                <TouchableOpacity style={st.batchBtnDelete} onPress={doDeleteSelected}><Text style={st.batchBtnTxt}>🗑️ حذف</Text></TouchableOpacity>
                <TouchableOpacity style={st.batchBtnCancel} onPress={() => setSelected(new Set())}><Text style={st.batchBtnTxt}>✕</Text></TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {/* ================= تب ۲: ویرایش شده‌ها ================= */}
        {mainTab === 'edited' && (
          <View style={{ flex: 1 }}>
            
            <View style={st.searchWrap}>
              <TextInput value={editSearch} onChangeText={setEditSearch} placeholder="جستجو در ویرایش‌ها (اسم، شماره، ...)" placeholderTextColor="#64748b" style={st.searchInp} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterScroll} contentContainerStyle={st.filterRow}>
              <TouchableOpacity onPress={() => setFilterTable('all')} style={[st.chip, filterTable === 'all' && st.chipActive, editedItems.length > 0 && { backgroundColor: '#7f1d1d', borderColor: '#dc2626' }]}>
                <Text style={[st.chipTxt, filterTable === 'all' && st.chipTxtActive, editedItems.length > 0 && { color: '#fca5a5' }]}>همه ({editedItems.length})</Text>
              </TouchableOpacity>
              {Object.keys(COLS).map(k => {
                const count = editedItems.filter((x: any) => x.table === k || (k === 'purchases' && x.table === 'purchases_grouped')).length;
                const isDanger = count > 0;
                return (
                  <TouchableOpacity key={k} onPress={() => setFilterTable(k)} style={[st.chip, filterTable === k && st.chipActive, isDanger && { backgroundColor: '#7f1d1d', borderColor: '#dc2626' }]}>
                    <Text style={[st.chipTxt, filterTable === k && st.chipTxtActive, isDanger && { color: '#fca5a5' }]}>
                      {TABLE_LABELS[k] || k} {isDanger ? `(${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
              {filteredEdits.length === 0 ? (
                <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 20, fontSize: 13 }}>موردی یافت نشد.</Text>
              ) : filteredEdits.map((ev: any, i: number) => {
                let before = ev.before || {};
                if (typeof before === 'string') { try { before = JSON.parse(before); } catch {} }
                let after = ev.after || {};
                if (typeof after === 'string') { try { after = JSON.parse(after); } catch {} }
                
                const name = before.name || before.product_name || before.customer_name || before.title || before.invoice_number ||
                             after.name || after.product_name || after.customer_name || after.title || after.invoice_number || '';
                const model = before.model || before.model_name || after.model || after.model_name || '';
                const displayName = [name, model].filter(Boolean).join(' - ') || ev.key;

                return (
                  <View key={i} style={{ backgroundColor: '#0f172a', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditDetailItem(ev)}>
                      <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: 'bold', textAlign: 'right' }}>✏️ ویرایش در {TABLE_LABELS[ev.table] || ev.table}</Text>
                      <Text style={{ color: '#fff', fontSize: 14, textAlign: 'right', marginTop: 4 }}>{displayName}</Text>
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <Text style={{ color: '#64748b', fontSize: 10, textAlign: 'right' }}>تاریخ: {formatFullDate(ev.at || ev.timestamp || '')}</Text>
                        <Text style={{ color: '#93c5fd', fontSize: 10, textAlign: 'right', fontWeight: 'bold' }}>
                          📱 {ev.device_label || (ev.device_id ? 'دستگاه ' + shortId(ev.device_id) : 'نامشخص')}
                          {ev.user_name ? ` | 👤 ${ev.user_name}` : (ev.user ? ` | 👤 ${ev.user}` : '')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => doDeleteAudit(ev)} style={{ backgroundColor: '#7f1d1d', padding: 10, borderRadius: 8, marginLeft: 10 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓ تایید و حذف اطلاع</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ================= تب ۳: تنظیمات ================= */}
        {mainTab === 'settings' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
            <View style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15 }}>
              <Text style={{ color: '#67e8f9', fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 }}>⚙️ تنظیمات بازیابی</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'right', lineHeight: 20 }}>
                مدیریت دستگاه‌ها، رمز عبور و پاک‌سازی حافظه محلی.
              </Text>
            </View>

            {/* باکس آمار */}
            <View style={{ marginBottom: 15, padding: 12, backgroundColor: '#0c1729', borderRadius: 8, borderWidth: 1, borderColor: '#1f3a5f' }}>
              <Text style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>📊 وضعیت حافظه محلی</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 4 }}>تعداد کل: {tombstoneStats.total}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 4 }}>قدیمی‌ترین: {tombstoneStats.oldest ? formatFullDate(tombstoneStats.oldest) : '—'}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'right' }}>جدیدترین: {tombstoneStats.newest ? formatFullDate(tombstoneStats.newest) : '—'}</Text>
            </View>

            <View style={{ marginBottom: 15 }}>
              <DeviceNameTopBar />
            </View>

            <TouchableOpacity onPress={() => setShowDeviceModal(true)} style={{ backgroundColor: '#334155', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>📱 مدیریت دستگاه‌ها</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { try { (globalThis as any).__auditPinOpenSettings?.(); } catch {} }} style={{ backgroundColor: '#334155', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🔐 تنظیمات رمز عبور بازیابی</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCleanupAll} style={{ backgroundColor: '#7f1d1d', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🧹 پاک‌سازی کامل حافظه محلی</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCleanupTombstones} style={{ backgroundColor: '#7f1d1d', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🧹 حذف Tombstone ها</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={async () => {
                const msg = 'همه tombstone‌های قدیمی‌تر از ۳۰ روز از حافظه محلی پاک شوند؟ شیت دست نمی‌خورد.';
                const ok = Platform.OS === 'web' ? (typeof window !== 'undefined' && window.confirm ? window.confirm(msg) : true) : true;
                if (!ok) return;
                const r = await cleanupOldTombstones(30);
                if (r.ok) {
                  if (showToast) showToast('🗑️ ' + r.removed + ' مورد قدیمی پاک شد — ' + r.remaining + ' باقی ماند', false);
                  await load();
                } else if (showToast) showToast(r.error || 'خطا', true);
              }} style={{ backgroundColor: '#7f1d1d', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🧹 پاک‌سازی موارد قدیمی‌تر از ۳۰ روز</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

<Modal visible={!!editDetailItem} transparent animationType="slide" onRequestClose={() => setEditDetailItem(null)}>
          <View style={st.modalBackdrop}>
            <View style={st.modalCard}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={st.modalTitle}>✏️ جزئیات ویرایش ({TABLE_LABELS[editDetailItem?.table] || editDetailItem?.table})</Text>
                <TouchableOpacity onPress={() => setEditDetailItem(null)}><Text style={{ color: '#f87171', fontSize: 22, fontWeight: 'bold', paddingHorizontal: 8 }}>✕</Text></TouchableOpacity>
              </View>
              
              {editDetailItem ? (
                <ScrollView style={{ maxHeight: 480 }}>
                  <View style={st.devBox}>
                    {(() => {
                      let before = editDetailItem.before || {};
                      let after = editDetailItem.after || {};
                      if (typeof before === 'string') { try { before = JSON.parse(before); } catch {} }
                      if (typeof after === 'string') { try { after = JSON.parse(after); } catch {} }
                      const name = before.name || before.product_name || before.customer_name || before.title || before.invoice_number || after.name || after.product_name || after.customer_name || after.title || after.invoice_number || '';
                      const model = before.model || before.model_name || before.modelName || after.model || after.model_name || after.modelName || '';
                      const displayName = [name, model].filter(Boolean).join(' - ');
                      return <Text style={st.devBoxTxt}>🔑 {displayName ? `${displayName} (${editDetailItem.key})` : editDetailItem.key}</Text>
                    })()}
                    <Text style={[st.devBoxId, { color: '#fecaca', fontWeight: 'bold', marginTop: 4 }]}>📅 تاریخ: {formatFullDate(editDetailItem.at || editDetailItem.timestamp || '')}</Text>
                    <Text style={[st.devBoxId, { color: '#93c5fd', fontWeight: 'bold', marginTop: 4 }]}>📱 دستگاه: {editDetailItem.device_label || (editDetailItem.device_id ? 'دستگاه ' + shortId(editDetailItem.device_id) : 'نامشخص')}</Text>
                  </View>
                  
                  {(() => {
                    let fields = editDetailItem.fields || [];
                    if (typeof fields === 'string') { try { fields = JSON.parse(fields); } catch { fields = []; } }
                    let before = editDetailItem.before || {};
                    if (typeof before === 'string') { try { before = JSON.parse(before); } catch { before = {}; } }
                    let after = editDetailItem.after || {};
                    if (typeof after === 'string') { try { after = JSON.parse(after); } catch { after = {}; } }

                    if (fields.length === 0) {
                      fields = Object.keys(after).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
                    }

                    const isDateField = (key: string) => key.endsWith('_at') || key.includes('date') || key.includes('تاریخ') || MODAL_DATE_KEYS.has(key);

                    return fields.map((f: string) => {
                      const oldV = before[f];
                      const newV = after[f];
                      let label = FA_EXTRA[f] || FIELD_LABELS_FA[f];
                      if (!label) {
                        if (f === 'updated_at') label = 'تاریخ بروزرسانی';
                        else if (f === 'created_at') label = 'تاریخ ایجاد';
                        else if (f === 'items') label = 'اقلام / لیست';
                        else label = f;
                      }
                      
                      return (
                        <View key={f} style={{ backgroundColor: '#0a2038', borderRadius: 6, padding: 10, borderWidth: 1, borderColor: '#1f3a5f', marginBottom: 8 }}>
                          <Text style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{label}</Text>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1, backgroundColor: '#7f1d1d', padding: 6, borderRadius: 4, marginLeft: 4 }}>
                              <Text style={{ color: '#fca5a5', fontSize: 9, textAlign: 'right' }}>قبلی:</Text>
                              <Text style={{ color: '#fff', fontSize: 11, textAlign: 'right' }}>{isDateField(f) ? formatFullDate(String(oldV || '')) : formatValueForField(f, oldV)}</Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: '#14532d', padding: 6, borderRadius: 4, marginRight: 4 }}>
                              <Text style={{ color: '#86efac', fontSize: 9, textAlign: 'right' }}>جدید:</Text>
                              <Text style={{ color: '#fff', fontSize: 11, textAlign: 'right' }}>{isDateField(f) ? formatFullDate(String(newV || '')) : formatValueForField(f, newV)}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    });
                  })()}
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}>
  <View style={st.modalBackdrop}>
    <View style={st.modalCard}>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={st.modalTitle}>{detailItem?.tableLabel || ''}</Text>
        <TouchableOpacity onPress={() => setDetailItem(null)}>
          <Text style={{ color: '#f87171', fontSize: 22, fontWeight: 'bold', paddingHorizontal: 8 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {detailItem ? (
        <ScrollView style={{ maxHeight: 480 }}>
          <View style={st.devBox}>
            <Text style={st.devBoxTxt}>
              🗑️ حذف‌شده توسط: {
                detailItem.device_label ||
                (detailItem.device_id && detailItem.device_id === myDeviceId ? (myDeviceLabel || 'این دستگاه') : '') ||
                (detailItem.device_id ? 'دستگاه ' + String(detailItem.device_id).slice(-6) : 'نامشخص')
              }
            </Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginTop: 4 }}>
              {detailItem.device_id ? <Text style={[st.devBoxId, { marginLeft: 12 }]}>📱 {String(detailItem.device_id).slice(-6)}</Text> : null}
              {(() => {
                        const raw = getRaw(detailItem) || {};
                        const name = raw.name || raw.product_name || raw.customer_name || raw.title || raw.invoice_number;
                        return <Text style={[st.devBoxId, { marginLeft: 12 }]}>🔑 {name ? `${name} (${detailItem.key})` : detailItem.key}</Text>;
                      })()}
              <Text style={[st.devBoxId, { marginLeft: 12, color: '#fecaca', fontWeight: 'bold' }]}>📅 {formatFullDate(detailItem.deleted_at)} ({timeAgo(detailItem.deleted_at)})</Text>
            </View>
          </View>

          {(() => {
            const _raw = getRaw(detailItem) || {};
            const _itemKeys = new Set([
              'model_code','model_name','modelName','product_code','product_name','productName',
              'quantity','qty','price_unit','priceUnit','price','shelf','اقلام','items','rows','products','lines','اقلام','items','rows','products','lines'
            ]);
            const _totalKeys = new Set(['total','amount','paid','payment','grand_total']);

            const _headerFields = Object.keys(_raw).filter(k =>
              !HIDE_FIELDS.has(k) && !k.startsWith('_') &&
              !_itemKeys.has(k) && !_totalKeys.has(k) &&
              _raw[k] !== '' && _raw[k] !== null &&
              typeof _raw[k] !== 'object' && !Array.isArray(_raw[k])
            );

            let _itemsRaw: any = _raw.items ?? _raw['اقلام'] ?? _raw.rows ?? _raw.products ?? _raw.lines;
            let _items: any[] = [];

            if (Array.isArray(_itemsRaw)) {
              _items = _itemsRaw;
            } else if (typeof _itemsRaw === 'string') {
              try {
                const parsed = JSON.parse(_itemsRaw);
                if (Array.isArray(parsed)) _items = parsed;
              } catch {}
            }

            if (!_items.length && (_raw.model_name || _raw.modelName || _raw.product_name || _raw.productName || _raw.model_code || _raw.product_code)) {
              _items = [{
                modelName: _raw.model_name || _raw.modelName || _raw.product_name || _raw.productName,
                modelCode: _raw.model_code || _raw.modelCode || _raw.product_code || _raw.productCode,
                quantity: _raw.quantity || _raw.qty,
                priceUnit: _raw.price_unit || _raw.priceUnit || _raw.price,
                payment: _raw.payment || _raw.item_payment,
              }];
            }

            const _total = Number(_raw.total || _raw.amount || 0) || 0;
            const _paid = Number(_raw.paid || _raw.payment || 0) || 0;
            const _remain = _total - _paid;

            return (
              <View>
                {_headerFields.length > 0 ? (
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginBottom: 10 }}>
                    {_headerFields.map((k) => (
                      <View key={k} style={{ backgroundColor: '#0a2038', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: '#1f3a5f', marginLeft: 6, marginBottom: 6, minWidth: 85, maxWidth: 180 }}>
                        <Text style={{ color: '#7dd3fc', fontSize: 9, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 }}>{FA_EXTRA[k] || FIELD_LABELS_FA[k] || EXTRA_LABELS[k] || k}</Text>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'right' }} numberOfLines={2}>{MODAL_DATE_KEYS.has(k) ? formatFullDate(String(_raw[k])) : formatValueForField(k, _raw[k])}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {_items.length > 0 ? (
                  <View style={{ backgroundColor: '#020617', borderRadius: 8, borderWidth: 1, borderColor: '#1f3a5f', overflow: 'hidden', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#1f3a5f' }}>
                      <Text style={{ width: 26, color: '#7dd3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>#</Text>
                      <Text style={{ flex: 1, color: '#7dd3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>کالا</Text>
                      <Text style={{ width: 45, color: '#7dd3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>تعداد</Text>
                      <Text style={{ width: 70, color: '#7dd3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>قیمت</Text>
                      <Text style={{ width: 70, color: '#7dd3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' }}>پرداخت</Text>
                    </View>
                    {_items.map((it: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row-reverse', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center' }}>
                        <Text style={{ width: 26, color: '#64748b', fontSize: 11, textAlign: 'right' }}>{i + 1}</Text>
                        <Text style={{ flex: 1, color: '#e2e8f0', fontSize: 11, textAlign: 'right' }} numberOfLines={1}>
                          {it.modelName || it.model_name || it.name || it.product_name || it.productName || '—'}
                        </Text>
                        <Text style={{ width: 45, color: '#e2e8f0', fontSize: 11, textAlign: 'right' }}>{it.quantity || it.qty || 0}</Text>
                        <Text style={{ width: 70, color: '#fbbf24', fontSize: 11, textAlign: 'right' }}>
                          {Number(it.priceUnit || it.price_unit || it.price || 0).toLocaleString('en-US')}
                        </Text>
                        <Text style={{ width: 70, color: '#34d399', fontSize: 11, textAlign: 'right' }}>
                          {Number(it.payment || it.item_payment || 0).toLocaleString('en-US')}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right', padding: 10 }}>
                    اطلاعات اقلام در snapshot ذخیره نشده است. یک بار از شیت دریافت کن.
                  </Text>
                )}

                {(_total > 0 || _paid > 0) ? (
                  <View style={{ flexDirection: 'row-reverse', padding: 8, backgroundColor: '#0a2038', borderRadius: 8, borderWidth: 1, borderColor: '#1f3a5f', marginBottom: 8 }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 10 }}>مبلغ کل</Text>
                      <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}>{_total.toLocaleString('en-US')}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 10 }}>پرداخت</Text>
                      <Text style={{ color: '#34d399', fontSize: 12, fontWeight: 'bold' }}>{_paid.toLocaleString('en-US')}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 10 }}>باقیمانده</Text>
                      <Text style={{ color: _remain > 0 ? '#f87171' : '#34d399', fontSize: 12, fontWeight: 'bold' }}>{_remain.toLocaleString('en-US')}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })()}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10 }}>
        <TouchableOpacity onPress={() => detailItem && doRestore(detailItem)} style={{ flex: 1, backgroundColor: '#166534', padding: 10, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>♻️ بازیابی</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => detailItem && doDelete(detailItem)} style={{ flex: 1, backgroundColor: '#7f1d1d', padding: 10, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>🗑️ حذف نهایی</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

        <Modal visible={showDeviceModal} transparent animationType="slide" onRequestClose={() => setShowDeviceModal(false)}>
          <View style={st.modalBackdrop}>
            <View style={st.modalCard}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={st.modalTitle}>📱 دستگاه‌های شناسایی‌شده</Text>
                <TouchableOpacity onPress={() => setShowDeviceModal(false)}><Text style={{ color: '#f87171', fontSize: 20, fontWeight: 'bold' }}>✕</Text></TouchableOpacity>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginBottom: 8 }}>روی هر دستگاه بزن تا نامش را تنظیم کنی</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {unknownDevices.length === 0 ? <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>دستگاهی ثبت نشده</Text> : null}
                {unknownDevices.map((did) => {
                  const lab = items.find(x => x.device_id === did)?.device_label || '';
                  return (
                    <TouchableOpacity key={did} onPress={() => { setNamingId(did); setNamingText(lab); }} style={{ padding: 8, backgroundColor: '#1e293b', borderRadius: 8, marginBottom: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 12, textAlign: 'right' }}>{lab || 'بدون نام'}</Text>
                      <Text style={{ color: '#64748b', fontSize: 9, textAlign: 'right', marginTop: 2 }}>{did}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {namingId ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'right', marginBottom: 4 }}>نام جدید:</Text>
                  <TextInput value={namingText} onChangeText={setNamingText} placeholder="مثلاً: جواد فروغی - گوشی" placeholderTextColor="#64748b" style={st.searchInp} />
                  <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={async () => { await setDeviceName(namingId, namingText); setNamingId(''); setNamingText(''); await load(); }} style={{ flex: 1, backgroundColor: '#059669', padding: 10, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>💾 ذخیره</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setNamingId(''); setNamingText(''); }} style={{ flex: 1, backgroundColor: '#334155', padding: 10, borderRadius: 8, alignItems: 'center' }}><Text style={{ color: '#fff' }}>لغو</Text></TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </AuditPinGate>
  );
}


const EXTRA_LABELS: Record<string, string> = {
  father_name: 'نام پدر',
  national_id: 'کد ملی',
  emergency_phone: 'تلفن اضطراری',
  department: 'دپارتمان / بخش',
  role: 'نقش / سمت',
  contract_type: 'نوع قرارداد',
  start_date: 'تاریخ شروع',
  hire_date: 'تاریخ استخدام',
  marital_status: 'وضعیت تاهل',
  dependents: 'تعداد افراد تحت تکفل',
  base_salary: 'حقوق پایه',
  housing_allowance: 'حق مسکن',
  food_allowance: 'حق غذا',
  transport_allowance: 'حق ایاب و ذهاب',
  other_allowance: 'سایر مزایا',
  overtime_rate: 'نرخ اضافه کاری',
  bank_name: 'نام بانک',
  account_number: 'شماره حساب',
  education: 'تحصیلات',
  insurance_number: 'شماره بیمه',
  status: 'وضعیت',
  note: 'یادداشت'
};

const FA_EXTRA: Record<string, string> = {
  customerCode: 'کد مشتری',
  supplierCode: 'کد تأمین‌کننده',
  holder: 'صاحب حساب',
  holderCode: 'کد صاحب حساب',
  account_holder: 'صاحب حساب',
  account_holder_code: 'کد صاحب حساب',
  depositDate: 'تاریخ واریز',
  date_reg: 'تاریخ ثبت',
  date_factor: 'تاریخ فاکتور',
  modelCode: 'کد کالا',
  modelName: 'نام کالا',
  priceUnit: 'قیمت واحد',
  productCode: 'کد کالا',
  productName: 'نام کالا',
  manual: 'شماره دستی',
  manual_invoice: 'شماره دستی',
  bank_name: 'نام بانک',
  customer_name: 'نام مشتری',
  customer_phone: 'تلفن مشتری',
  supplier_name: 'نام تأمین‌کننده',
  supplier_phone: 'تلفن تأمین‌کننده',
  shipping_name: 'باربری',
  description: 'توضیحات',
  note: 'یادداشت',
  payerCode: 'کد پرداخت‌کننده',
  payerName: 'نام پرداخت‌کننده',
  'اقلام': 'اقلام',
  items: 'اقلام',
};

const MODAL_DATE_KEYS = new Set<string>([
  'date','date_factor','date_reg','depositDate','deposit_date',
  'created_at','updated_at','deleted_at','at',
]);


function classifyAuditEntry(ev: any): 'deleted' | 'edited' | null {
  if (!ev) return null;
  const action = String(ev.action || '');
  if (action === 'delete') return 'deleted';
  if (action === 'create') return null;
  if (action !== 'update') return null;
  try {
    const b = Array.isArray(ev.before?.items) ? ev.before.items.length : 0;
    const a = Array.isArray(ev.after?.items) ? ev.after.items.length : 0;
    if (a < b) return 'deleted';
  } catch {}
  return 'edited';
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0a1628' },
  header: { padding: 10, backgroundColor: '#0f2438', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  title: { color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  sub: { color: '#a5f3fc', fontSize: 10, textAlign: 'right', marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 16 },
  searchWrap: { paddingHorizontal: 10, paddingTop: 6 },
  searchInp: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, textAlign: 'right', backgroundColor: '#0f172a', color: '#fff' },
  filterScroll: { maxHeight: 44, marginTop: 4 },
  filterRow: { flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', marginLeft: 4 },
  chipActive: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  chipEmpty: { opacity: 0.4 },
  chipTxt: { fontSize: 10, color: '#cbd5e1' },
  chipTxtActive: { color: '#fff', fontWeight: 'bold' },
  chipTxtEmpty: { color: '#64748b' },
  selectAllBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0f172a', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1e3a5f', marginTop: 4 },
  selectAllBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  selectAllTxt: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
  clearSelBtn: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#7f1d1d', borderRadius: 6 },
  clearSelTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  checkboxSm: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#475569', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  checkboxOn: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  checkTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  list: { flex: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyTxt: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  thead: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', paddingVertical: 6, borderRadius: 6, marginBottom: 4 },
  trow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1e293b', backgroundColor: '#0f172a' },
  trowAlt: { backgroundColor: '#0c1729' },
  trowSel: { backgroundColor: '#0c2942' },
  tcell: { paddingHorizontal: 4, justifyContent: 'center', alignItems: 'flex-end' },
  tcellChk: { width: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  thTxt: { color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right' },
  tdTxt: { color: '#e2e8f0', fontSize: 10, textAlign: 'right' },
  tdMoney: { color: '#fbbf24', fontWeight: 'bold' },
  btnMini: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  btnMiniTxt: { color: '#fff', fontSize: 12 },
  devRow: { backgroundColor: '#0a1320', paddingVertical: 2, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  devRowTxt: { color: '#94a3b8', fontSize: 9, textAlign: 'right' },
  mixedRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 8, padding: 8, marginBottom: 6, borderWidth: 1, borderColor: '#1e3a5f' },
  badge: { backgroundColor: '#1e3a5f', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTxt: { color: '#a5f3fc', fontSize: 9, fontWeight: 'bold' },
  agoTxt: { color: '#64748b', fontSize: 9 },
  mixedTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginTop: 4 },
  mixedSub: { color: '#cbd5e1', fontSize: 10, textAlign: 'right', marginTop: 2 },
  mixedDev: { color: '#94a3b8', fontSize: 9, textAlign: 'right', marginTop: 2 },
  batchBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#0f2438', borderTopWidth: 2, borderTopColor: '#0891b2', position: 'absolute', bottom: 0, left: 0, right: 0 },
  batchTxt: { color: '#a5f3fc', fontSize: 11, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  batchBtnRestore: { backgroundColor: '#166534', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  batchBtnDelete: { backgroundColor: '#7f1d1d', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  batchBtnCancel: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  batchBtnTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 12, zIndex: 999 },
  modalCard: { backgroundColor: '#0f172a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e3a5f', maxHeight: '90%', width: '100%', maxWidth: 720 },
  modalTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', flex: 1 },
  devBox: { backgroundColor: '#7f1d1d', borderRadius: 8, padding: 8, marginBottom: 8 },
  devBoxTxt: { color: '#fecaca', fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  devBoxId: { color: '#fca5a5', fontSize: 9, textAlign: 'right', marginTop: 2 },
  detailRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#0a2038', borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: '#1f3a5f' },
  detailLbl: { color: '#7dd3fc', fontSize: 11, fontWeight: 'bold', width: 130, textAlign: 'right', paddingRight: 6 },
  detailVal: { flex: 1, color: '#e2e8f0', fontSize: 12, textAlign: 'right', fontWeight: '600' },
  itemsBox: { marginTop: 8, padding: 6, backgroundColor: '#0c1e35', borderRadius: 6 },
  itemsTitle: { color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  itemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  itemName: { flex: 1, color: '#e2e8f0', fontSize: 10, textAlign: 'right' },
  itemQty: { color: '#94a3b8', fontSize: 10, width: 40, textAlign: 'center' },
  itemPrice: { color: '#fbbf24', fontSize: 10, width: 70, textAlign: 'left' },
  gridCell: { width: '48%', marginBottom: 6, backgroundColor: '#0a2038', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: '#1f3a5f' },
  gridCellLbl: { color: '#94a3b8', fontSize: 9, textAlign: 'right', marginBottom: 2 },
  gridCellVal: { color: '#e2e8f0', fontSize: 11, textAlign: 'right', fontWeight: '600' },
  modalCardFull: { backgroundColor: '#0f172a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e3a5f', width: '100%', maxWidth: 950, height: '94%', flexDirection: 'column' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e3a5f' },
  devStrip: { flexDirection: 'row-reverse', flexWrap: 'wrap', backgroundColor: '#7f1d1d', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, marginBottom: 10 },
  devStripTxt: { color: '#fecaca', fontSize: 10, fontWeight: 'bold', marginLeft: 10 },
  fieldGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  fieldCell: { width: '48.5%', flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#0a2038', borderRadius: 6, marginBottom: 5, borderWidth: 1, borderColor: '#1f3a5f' },
  fieldCellLbl: { color: '#7dd3fc', fontSize: 9, fontWeight: 'bold', textAlign: 'right', marginLeft: 6, minWidth: 60 },
  fieldCellVal: { flex: 1, color: '#e2e8f0', fontSize: 11, fontWeight: '600', textAlign: 'right' },
  modalFooter: { flexDirection: 'row-reverse', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1e3a5f' },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modalBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  invTd: { color: '#e2e8f0', fontSize: 11, textAlign: 'right', paddingHorizontal: 3 },
  invRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  invTh: { color: '#a5f3fc', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 3 },
  invHead: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', paddingVertical: 8, borderRadius: 6, marginBottom: 2 },
  hChipVal: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'right' },
  hChipLbl: { color: '#7dd3fc', fontSize: 9, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 },
  hChip: { backgroundColor: '#0a2038', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#1f3a5f', minWidth: 85 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  backBtnTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: -3 },
});
