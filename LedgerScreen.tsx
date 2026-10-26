// LedgerScreen.tsx — ترازنامه یکپارچه با مودال جامع (۱۹ ستون)
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Share, Modal, TextInput } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { getLedgerData, getInvoiceDetail } from './lib.offline';
import { getCurrencySync } from './lib.currency';
import { buildStandardHtml, shareHtmlAsPdf, printHtml, exportExcel, numToWords, mizanSignaturesHtml, mizanComputerNoteHtml } from './lib.share';
import { displayDate } from './lib-date';
import { toFaNum } from './lib';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US');
const TYPE_LABEL = {
  sale: 'فروش', purchase: 'خرید',
  payment_received: 'دریافت وجه', payment_sent: 'پرداخت',
  triangular_received: 'دریافت مثلثی',
  partner_deposit: 'واریز شریک', partner_withdraw: 'برداشت شریک',
  partner_transfer_in: 'انتقال به شریک', partner_transfer_out: 'انتقال از شریک',
  transfer_in: 'انتقال ورودی', transfer_out: 'انتقال خروجی',
  salary: 'حقوق', salary_payment: 'پرداخت حقوق',
  expense: 'هزینه', expense_payment: 'پرداخت هزینه',
  loan: 'وام', loan_payment: 'بازپرداخت وام',
  deposit: 'واریز', withdraw: 'برداشت',
};
const TYPE_COLOR = {
  sale: '#1e40af', purchase: '#dc2626',
  payment_received: '#059669', payment_sent: '#0891b2',
  triangular_received: '#7c3aed',
  partner_deposit: '#059669', partner_withdraw: '#dc2626',
  partner_transfer_in: '#7c3aed', partner_transfer_out: '#7c3aed',
  transfer_in: '#7c3aed', transfer_out: '#7c3aed',
  salary: '#f59e0b', salary_payment: '#059669',
  expense: '#dc2626', expense_payment: '#059669',
  loan: '#dc2626', loan_payment: '#059669',
  deposit: '#059669', withdraw: '#dc2626',
};

const CP_LABEL: Record<string, string> = {
  expense: 'هزینه', employee: 'کارمند',
  customer: 'مشتری', supplier: 'تأمین‌کننده',
  partner: 'شریک', box: 'صندوق', bank: 'بانک',
  none: '—', '': '—',
};
function cpLabel(t: any) {
  const k = String(t?.counterpartType || '').trim();
  if (k && k !== 'none') return CP_LABEL[k] || '—';
  const st = String(t?.sourceType || t?.source_type || '').trim().toLowerCase();
  const ty = String(t?.type || '').trim().toLowerCase();
  const infer: Record<string,string> = {
    expense: 'هزینه', salary: 'کارمند', sale: 'مشتری', purchase: 'تأمین‌کننده',
    loan: 'کارمند', transfer: 'انتقال',
  };
  if (infer[st]) return infer[st];
  if (ty.includes('expense')) return 'هزینه';
  if (ty.includes('salary') || ty.includes('loan')) return 'کارمند';
  if (ty.includes('sale')) return 'مشتری';
  if (ty.includes('purchase')) return 'تأمین‌کننده';
  if (ty.includes('transfer')) return 'انتقال';
  return '—';
}
function cleanDesc(t: any) {
  let s = String(t?.description || '');
  s = s.replace(/طرف:\s*none(\s*\([^)]*\))?/gi, '')
       .replace(/طرف:\s*(customer|supplier|partner|employee|expense|box|bank)[^|]*/gi, '')
       .replace(/\|\s*(customer|supplier|partner|employee|expense|box|bank)\s*\([^)]*\)/gi, '')
       .replace(/\b(customer|supplier|partner|employee|expense|box|bank)\s*\([^)]*\)/gi, '')
       .replace(/\s*\|\s*$/g, '')
       .replace(/\s*\|\s*\|/g, ' | ')
       .trim();
  if (!s) s = TYPE_LABEL[t?.type] || t?.type || '—';
  return s;
}

export default function LedgerScreen({ onBack, showToast }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'parties' | 'partners' | 'employees' | 'expenses'>('parties');
  const [selectedParty, setSelectedParty] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [partyFilter, setPartyFilter] = useState('all');
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [partyViewMode, setPartyViewMode] = useState<'all' | 'in' | 'out'>('all');
  const [invoiceList, setInvoiceList] = useState<any[] | null>(null);
  const [invoiceDetailRows, setInvoiceDetailRows] = useState<any[] | null>(null);
  const [invoiceDetailMeta, setInvoiceDetailMeta] = useState<any>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const invoiceModalRef = useRef(null);
  const invoiceRef = useRef(null);
  const [treeMode, setTreeMode] = useState<'flat'|'groups'|'group'|'counterparty'>('flat');
  const [activeGroup, setActiveGroup] = useState('');
  const [activeCounterparty, setActiveCounterparty] = useState('');
  const ref = useRef(null);
  const modalRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getLedgerData();
      setData(result);
    } catch (e) { if (showToast) showToast('خطا در بارگذاری', true); console.log(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const curLabel = (typeof getCurrencySync === 'function' ? (getCurrencySync().label || '') : 'افغانی');

  function buildInvoices(p: any) {
    const map: any = {};
    (p?.transactions || []).forEach((t: any) => {
      const inv = String(t.invoice || '').trim();
      if (!inv) return;
      const ty = String(t.type || '');
      const isSale = ty === 'sale';
      const isPurchase = ty === 'purchase';
      const isPay = ty === 'payment_received' || ty === 'payment_sent' || ty === 'triangular_received';
      if (isSale || isPurchase) {
        if (!map[inv]) map[inv] = { invoice: inv, type: isPurchase ? 'purchase' : 'sales', date: t.date, total: 0, paid: 0, balance: 0 };
        map[inv].total += Number(t.lineTotal) || Number(t.credit) || Number(t.debit) || 0;
      } else if (isPay) {
        if (!map[inv]) map[inv] = { invoice: inv, type: 'sales', date: t.date, total: 0, paid: 0, balance: 0 };
        map[inv].paid += Number(t.credit) || Number(t.debit) || Number(t.lineTotal) || 0;
      }
    });
    return Object.values(map).map((x: any) => ({ ...x, balance: x.total - x.paid })).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  }

  const openInvoiceDetail = async (inv: any) => {
    setInvoiceLoading(true);
    try {
      const rows = await getInvoiceDetail(inv.invoice, inv.type === 'purchase' ? 'purchase' : 'sales');
      setInvoiceDetailRows(rows || []);
      setInvoiceDetailMeta(inv);
    } catch (e: any) { if (showToast) showToast(e.message, true); }
    finally { setInvoiceLoading(false); }
  };

  function buildInvoicesList(p: any) {
    const map: any = {};
    (p?.transactions || []).forEach((t: any) => {
      const inv = String(t.invoice || '').trim();
      if (!inv) return;
      const ty = String(t.type || '');
      const isSale = ty === 'sale';
      const isPurchase = ty === 'purchase';
      const isPay = ty === 'payment_received' || ty === 'payment_sent' || ty === 'triangular_received';
      if (isSale || isPurchase) {
        if (!map[inv]) map[inv] = { invoice: inv, type: isPurchase ? 'purchase' : 'sales', date: t.date, total: 0, paid: 0, balance: 0, count: 0 };
        map[inv].total += Number(t.lineTotal) || 0;
        map[inv].count += 1;
      } else if (isPay) {
        if (!map[inv]) map[inv] = { invoice: inv, type: 'sales', date: t.date, total: 0, paid: 0, balance: 0, count: 0 };
        map[inv].paid += Number(t.lineTotal) || 0;
      }
    });
    return Object.values(map).map((x: any) => ({ ...x, balance: x.total - x.paid })).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
  }

  function buildPartyTransactions(p: any) {
    let run = 0;
    return (p?.transactions || []).map((t: any) => {
      const d = Number(t.debit) || 0;
      const c = Number(t.credit) || 0;
      run += c - d;
      return { ...t, _running: run };
    });
  }
  function buildPaymentsList(p: any) {
    return (p?.transactions || [])
      .filter((t: any) => t.type === 'payment_received' || t.type === 'payment_sent' || t.type === 'triangular_received')
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  const openParty = (p: any) => {
    if (activeTab === 'parties') {
      setSelectedParty(p);
      setInvoiceList(buildInvoicesList(p));
      setInvoiceDetailRows([]);
      setInvoiceDetailMeta(null);
      setPartyViewMode('all');
      setInvoiceModalVisible(true);
      return;
    }
    setSelectedParty(p);
    setPartyFilter('all');
    setTreeMode('flat');
    setActiveGroup('');
    setActiveCounterparty('');
    setModalVisible(true);
  };
  const partyDetails = selectedParty ? selectedParty.transactions : [];
  const filteredPartyDetails = (partyDetails || []).filter((t: any) => {
    if (partyFilter === 'all') return true;
    if (partyFilter === 'in') return (Number(t.credit) || 0) > 0;
    if (partyFilter === 'out') return (Number(t.debit) || 0) > 0;
    if (partyFilter === 'transfer') return String(t.type || '').includes('transfer');
    if (partyFilter === 'salary') return String(t.type || '') === 'salary';
    if (partyFilter === 'salary_payment') return String(t.type || '') === 'salary_payment';
    if (partyFilter === 'expense') return String(t.type || '') === 'expense';
    if (partyFilter === 'expense_payment') return String(t.type || '') === 'expense_payment';
    return String(t.accountType || 'current') === partyFilter;
  });

  const filteredData = data.filter((r) => {
    const q = searchQuery.trim();
    if (!q) return true;
    if ((r.name || '').includes(q)) return true;
    if ((r.phone || '').includes(q)) return true;
    if ((r.allCodes || []).some((c) => String(c).includes(q))) return true;
    return false;
  });

  const getDisplayData = () => {
    if (activeTab === 'parties') {
      return filteredData.filter((r: any) => r.type !== 'شریک' && r.type !== 'کارمند' && r.type !== 'هزینه‌گیرنده');
    }
    if (activeTab === 'partners') {
      return filteredData.filter((r: any) => r.type === 'شریک');
    }
    if (activeTab === 'employees') {
      return filteredData.filter((r: any) => r.type === 'کارمند');
    }
    return filteredData.filter((r: any) => r.type === 'هزینه‌گیرنده');
  };

  function treeGroupOf(t: any) {
    const cp = String(t?.counterpartType || '').toLowerCase();
    const st = String(t?.sourceType || '').toLowerCase();
    const ty = String(t?.type || '').toLowerCase();
    if (cp === 'expense' || st === 'expense' || ty.includes('expense')) return '🧾 هزینه‌ها';
    if (cp === 'employee' || st === 'salary' || st === 'loan' || ty.includes('salary') || ty.includes('loan')) return '👷 کارمندان';
    if (cp === 'customer' || st === 'sale' || ty.includes('sale')) return '👥 مشتریان';
    if (cp === 'supplier' || st === 'purchase' || ty.includes('purchase')) return '🏭 تأمین‌کنندگان';
    if (cp === 'partner' || ty.includes('partner')) return '🤝 شرکا';
    if (cp === 'box' || cp === 'bank') return '🏦 صندوق و بانک';
    if (ty.includes('transfer')) return '🔁 انتقالات';
    return '📦 سایر';
  }
  function treeKeyOf(t: any) {
    const g = treeGroupOf(t);
    if (g === '🧾 هزینه‌ها') {
      const s = cleanDesc(t);
      const m = s.match(/هزینه\s*:?\s*([^\-|]+)/);
      if (m && m[1]) return m[1].trim();
      const cp = cpLabel(t);
      return cp !== '—' ? cp : 'متفرقه';
    }
    const cp = cpLabel(t);
    if (cp !== '—') {
      const code = String(t?.counterpartCode || t?.sourceId || '');
      return cp + (code ? ' (' + code + ')' : '');
    }
    return (cleanDesc(t).split('|')[0] || 'متفرقه').trim();
  }
  function getTreeGroups() {
    const map: Record<string, any> = {};
    (filteredPartyDetails || []).forEach((t: any) => {
      const g = treeGroupOf(t);
      if (!map[g]) map[g] = { name: g, count: 0, debit: 0, credit: 0 };
      map[g].count++;
      map[g].debit += Number(t.debit) || 0;
      map[g].credit += Number(t.credit) || 0;
    });
    return Object.values(map).map((x: any) => ({ ...x, balance: x.credit - x.debit }));
  }
  function getTreeCounterparties(group: string) {
    const map: Record<string, any> = {};
    (filteredPartyDetails || []).forEach((t: any) => {
      if (treeGroupOf(t) !== group) return;
      const k = treeKeyOf(t);
      if (!map[k]) map[k] = { name: k, count: 0, debit: 0, credit: 0 };
      map[k].count++;
      map[k].debit += Number(t.debit) || 0;
      map[k].credit += Number(t.credit) || 0;
    });
    return Object.values(map).map((x: any) => ({ ...x, balance: x.credit - x.debit }));
  }
  function getTreeTxns() {
    return (filteredPartyDetails || []).filter((t: any) => treeKeyOf(t) === activeCounterparty);
  }
  const treeTxns = getTreeTxns();
  const treeTxnsDebit = treeTxns.reduce((a: number, t: any) => a + (Number(t.debit) || 0), 0);
  const treeTxnsCredit = treeTxns.reduce((a: number, t: any) => a + (Number(t.credit) || 0), 0);
  const pTotal = partyDetails.reduce((a, t) => ({
    qty: a.qty + (t.qty || 0), debit: a.debit + (t.debit || 0), credit: a.credit + (t.credit || 0),
  }), { qty: 0, debit: 0, credit: 0 });

  // PDF builder
  const _buildHtml = (forParty) => {
    var _p = [];
    _p.push('<div class="info"><b>📅 تاریخ:</b> ' + displayDate(new Date()) + ' &nbsp;|&nbsp; <b>💱 واحد:</b> ' + curLabel + '</div>');
    if (!forParty) {
      _p.push('<div class="title">📊 ترازنامه (کلی)</div>');
      _p.push('<table style="width:100%; table-layout:fixed; border-collapse:collapse;">');
      _p.push('<thead><tr style="background:#0f2438; color:#fff;">');
      _p.push('<th style="width:4%">#</th><th style="width:14%">نوع</th><th style="width:20%">نام</th>');
      _p.push('<th style="width:14%">کدها</th><th style="width:12%">تلفن</th>');
      _p.push('<th style="width:10%">بدهکار</th><th style="width:10%">بستانکار</th>');
      _p.push('<th style="width:10%">مانده</th><th style="width:10%">وضعیت</th>');
      _p.push('</tr></thead><tbody>');
      var tdSum = 0, tcSum = 0;
      var rows = data.map(function(r, i) {
        var st = r.balance > 0 ? 'طرف بدهکار' : r.balance < 0 ? 'ما بدهکار' : 'تسویه';
        var col = r.balance > 0 ? '#dc2626' : r.balance < 0 ? '#059669' : '#64748b';
        if (r.balance > 0) tdSum += r.balance;
        if (r.balance < 0) tcSum += Math.abs(r.balance);
        var typeColor = r.type === 'مشتری' ? '#059669' : r.type === 'تأمین‌کننده' ? '#ea580c' : '#7c3aed';
        return '<tr>' +
          '<td style="text-align:center">' + (i+1) + '</td>' +
          '<td style="text-align:center; font-weight:bold; color:' + typeColor + '">' + (r.type || '—') + '</td>' +
          '<td style="text-align:right">' + r.name + '</td>' +
          '<td style="text-align:center">' + (r.allCodes||[]).join(', ') + '</td>' +
          '<td style="text-align:center">' + r.phone + '</td>' +
          '<td style="text-align:center">' + fmt(r.totalDebit) + '</td>' +
          '<td style="text-align:center">' + fmt(r.totalCredit) + '</td>' +
          '<td style="text-align:center; font-weight:bold">' + fmt(Math.abs(r.balance)) + '</td>' +
          '<td style="text-align:center; color:' + col + '; font-weight:bold">' + st + '</td>' +
        '</tr>';
      }).join('');
      _p.push(rows);
      _p.push('<tr style="background:#f1f5f9; font-weight:bold;">');
      _p.push('<td colspan="5" style="text-align:left; padding:8px">جمع کل:</td>');
      _p.push('<td style="text-align:center">' + fmt(data.reduce((a, r) => a + r.totalDebit, 0)) + '</td>');
      _p.push('<td style="text-align:center">' + fmt(data.reduce((a, r) => a + r.totalCredit, 0)) + '</td>');
      _p.push('<td style="text-align:center">' + fmt(tdSum + tcSum) + '</td>');
      _p.push('<td style="text-align:center">طرف بدهکار: ' + fmt(tdSum) + '<br>ما بدهکار: ' + fmt(tcSum) + '</td>');
      _p.push('</tr></tbody></table>');
    } else {
      _p.push('<div class="title">📋 کارت حساب: ' + (selectedParty?.name || '—') + '</div>');
      _p.push('<div class="info"><b>کدها:</b> ' + (selectedParty?.allCodes||[]).join(', ') + ' &nbsp;|&nbsp; <b>تلفن:</b> ' + (selectedParty?.allPhones||[]).join(', ') + ' &nbsp;|&nbsp; <b>نوع:</b> ' + (selectedParty?.type || '—') + '</div>');
      var _stBal = Number(selectedParty?.balance || 0);
      var _stTxt = '', _stCol = '#64748b', _stBg = '#f1f5f9';
      if (_stBal > 0) { _stTxt = 'ما بستانکاریم — طرف‌حساب بدهکار است'; _stCol = '#dc2626'; _stBg = '#fef2f2'; }
      else if (_stBal < 0) { _stTxt = 'ما بدهکاریم — طرف‌حساب بستانکار است'; _stCol = '#059669'; _stBg = '#ecfdf5'; }
      else { _stTxt = 'تسویه'; _stCol = '#64748b'; _stBg = '#f1f5f9'; }
      _p.push('<div id="status-top" style="margin:8px 0;padding:10px;background:' + _stBg + ';border:1px solid ' + _stCol + ';border-radius:6px;text-align:right">');
      _p.push('<div style="font-size:12px;font-weight:bold;color:#0f2438">💵 مانده نهایی: ' + fmt(Math.abs(_stBal)) + ' ' + curLabel + '</div>');
      _p.push('<div style="font-size:11px;color:#475569;margin-top:4px">🔤 به حروف: ' + numToWords(Math.abs(_stBal)) + ' ' + curLabel + '</div>');
      _p.push('<div style="font-size:12px;font-weight:bold;color:' + _stCol + ';margin-top:4px">📌 وضعیت: ' + _stTxt + '</div>');
      _p.push('</div>');

      var txns = (filteredPartyDetails || []).filter(function(t: any) {
        if (partyViewMode === 'in') return t.type === 'sale' || t.type === 'purchase';
        if (partyViewMode === 'out') return t.type === 'payment_received' || t.type === 'payment_sent' || t.type === 'triangular_received';
        return true;
      });

      _p.push('<table style="font-size:8px"><tr><th>#</th><th>تاریخ</th><th>نوع</th><th>فاکتور</th><th>فاکتور دستی</th><th>کد مدل</th><th>نام مدل</th><th>تعداد</th><th>قیمت</th><th>جمع ردیف</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>بانک</th><th>صاحب حساب</th><th>کد صاحب</th><th>تاریخ واریز</th><th>باربری</th><th>شرح</th></tr>');
      var tQty = 0, tDebit = 0, tCredit = 0;
      txns.forEach(function(t: any, i: number) {
        tQty += Number(t.qty) || 0;
        tDebit += Number(t.debit) || 0;
        tCredit += Number(t.credit) || 0;
        _p.push('<tr><td>' + (i+1) + '</td><td>' + displayDate(t.date) + '</td><td>' + (TYPE_LABEL[t.type]||t.type) + '</td><td>' + (t.invoice||'—') + '</td><td>' + (t.manualInvoice||'—') + '</td><td>' + (t.modelCode||'—') + '</td><td style="text-align:right">' + (t.modelName||'—') + '</td><td>' + (t.qty?toFaNum(t.qty):'—') + '</td><td>' + (t.priceUnit?fmt(t.priceUnit):'—') + '</td><td>' + (t.lineTotal?fmt(t.lineTotal):'—') + '</td><td style="color:#1e40af;font-weight:bold">' + (t.debit?fmt(t.debit):'—') + '</td><td style="color:#059669;font-weight:bold">' + (t.credit?fmt(t.credit):'—') + '</td><td style="font-weight:bold">' + fmt(Math.abs(t.runningBalance||0)) + '</td><td>' + (t.bank||'—') + '</td><td>' + (t.holder||'—') + '</td><td>' + (t.holderCode||'—') + '</td><td>' + (t.depositDate?displayDate(t.depositDate):'—') + '</td><td>' + (t.shipping||'—') + '</td><td style="text-align:right">' + (cleanDesc(t)||'—') + '</td></tr>');
      });
      _p.push('<tr class="total"><td colspan="7" style="text-align:left;font-weight:bold">جمع:</td><td style="font-weight:bold">' + toFaNum(tQty) + '</td><td></td><td></td><td style="color:#1e40af;font-weight:bold">' + fmt(tDebit) + '</td><td style="color:#059669;font-weight:bold">' + fmt(tCredit) + '</td><td style="font-weight:bold">' + fmt(Math.abs(tCredit - tDebit)) + '</td><td colspan="6"></td></tr>');
      _p.push('</table>');
      _p.push('<div class="net-words">💵 مانده به حروف: ' + numToWords(Math.abs(tCredit - tDebit)) + ' ' + curLabel + '</div>');
    }
    _p.push(mizanSignaturesHtml(['مدیر مالی', 'حسابدار', 'مهر شرکت']));
    _p.push(mizanComputerNoteHtml());
    var html = buildStandardHtml('گزارش', _p.join(''), '📊 گزارش');
    html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
    return html;
  };

  const pdfAll = async () => { try { var r = await shareHtmlAsPdf(_buildHtml(false), 'ledger-' + Date.now() + '.pdf'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const printAll = async () => { try { var r = await printHtml(_buildHtml(false)); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const imgAll = async () => { try { if (!ref.current) return; var uri = await captureRef(ref, { format: 'jpg', quality: 0.95 }); if (Platform.OS === 'web') { await Share.share({ message: 'ترازنامه', url: uri }); } else if (await require('expo-sharing').isAvailableAsync()) { await require('expo-sharing').shareAsync(uri); } } catch (e) { if (showToast) showToast(e.message, true); } };
  const xlsAll = async () => { try { var rows = data.map((r, i) => ({ '#': i+1, 'نام': r.name, 'کدها': (r.allCodes||[]).join(', '), 'تلفن': r.phone, 'طرف بدهکار': r.totalDebit, 'ما بدهکار': r.totalCredit, 'مانده': Math.abs(r.balance), 'وضعیت': r.balance > 0 ? 'ما بستانکاریم' : r.balance < 0 ? 'ما بدهکاریم' : 'تسویه' })); var r2 = await exportExcel([{ name: 'ترازنامه', data: rows }], 'ledger-' + Date.now() + '.xlsx'); if (showToast) showToast(r2.ok ? '✅ ' + r2.message : '❌ ' + r2.message, !r2.ok); } catch (e) { if (showToast) showToast(e.message, true); } };

  const pdfParty = async () => { try { var r = await shareHtmlAsPdf(_buildHtml(true), 'statement-' + selectedParty.code + '.pdf'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const printParty = async () => { try { var r = await printHtml(_buildHtml(true)); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e) { if (showToast) showToast(e.message, true); } };
  const imgParty = async () => { try { if (!modalRef.current) return; var uri = await captureRef(modalRef, { format: 'jpg', quality: 0.95 }); if (Platform.OS === 'web') { await Share.share({ message: 'کارت حساب', url: uri }); } else if (await require('expo-sharing').isAvailableAsync()) { await require('expo-sharing').shareAsync(uri); } } catch (e) { if (showToast) showToast(e.message, true); } };

  const xlsParty = async () => {
    try {
      let sheets: any[] = [];
      if (treeMode === 'groups') {
        sheets = [{ name: 'گروه‌ها', data: getTreeGroups().map((g: any, i: number) => ({ '#': i+1, 'گروه': g.name, 'تعداد': g.count, 'بدهکار': g.debit, 'بستانکار': g.credit, 'مانده': Math.abs(g.balance) })) }];
      } else if (treeMode === 'group') {
        sheets = [{ name: (activeGroup || 'گروه').slice(0, 28), data: getTreeCounterparties(activeGroup).map((c: any, i: number) => ({ '#': i+1, 'طرف / دسته': c.name, 'تعداد': c.count, 'بدهکار': c.debit, 'بستانکار': c.credit, 'مانده': Math.abs(c.balance) })) }];
      } else if (treeMode === 'counterparty') {
        sheets = [{ name: (activeCounterparty || 'طرف').slice(0, 28), data: treeTxns.map((t: any, i: number) => ({ '#': i+1, 'تاریخ': displayDate(t.date), 'نوع': TYPE_LABEL[t.type] || t.type, 'سند': t.sourceInfo?.invoice || t.invoice || t.sourceId || '', 'شرح': cleanDesc(t), 'جمع سند': t.sourceInfo?.total || 0, 'پرداخت سند': t.sourceInfo?.paid || 0, 'مانده سند': t.sourceInfo?.balance || 0, 'بدهکار': t.debit || 0, 'بستانکار': t.credit || 0, 'مانده': Math.abs(t.runningBalance || 0) })) }];
      } else {
        sheets = [{ name: 'ریز', data: filteredPartyDetails.map((t: any, i: number) => ({ '#': i+1, 'تاریخ': displayDate(t.date), 'نوع': TYPE_LABEL[t.type] || t.type, 'حساب': t.accountType === 'capital' ? 'سرمایه' : t.accountType === 'drawings' ? 'برداشت' : t.accountType === 'current' ? 'جاری' : '—', 'طرف': cpLabel(t), 'سند': t.invoice || t.sourceId || '', 'شرح': cleanDesc(t), 'بدهکار': t.debit || 0, 'بستانکار': t.credit || 0, 'مانده': Math.abs(t.runningBalance || 0) })) }];
      }
      const r = await exportExcel(sheets, 'statement-' + (selectedParty?.code || 'party') + '-' + Date.now() + '.xlsx');
      if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { if (showToast) showToast(e.message, true); }
  };

  
  const _buildInvoiceHtml = () => {
    var _p = [];
    _p.push('<div class="info"><b>📅 تاریخ:</b> ' + displayDate(new Date()) + ' &nbsp;|&nbsp; <b>💱 واحد:</b> ' + curLabel + '</div>');
    _p.push('<div class="title">📄 فاکتور: ' + (invoiceDetailMeta?.invoice || '') + '</div>');
    _p.push('<div class="info"><b>طرف:</b> ' + (selectedParty?.name || '—') + ' &nbsp;|&nbsp; <b>نوع:</b> ' + (invoiceDetailMeta?.type === 'purchase' ? 'خرید' : 'فروش') + '</div>');
    _p.push('<table style="width:100%;border-collapse:collapse;font-size:8px">');
    _p.push('<tr><th>#</th><th>کد مدل</th><th>نام مدل</th><th>قفسه</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>پرداخت</th><th>بانک</th><th>تاریخ واریز</th></tr>');
    var tot = 0, pay = 0;
    (invoiceDetailRows || []).forEach(function(r, i) {
      var line = (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
      tot += line; pay += Number(r.payment) || 0;
      _p.push('<tr><td>' + (i+1) + '</td><td>' + (r.model_code || r.modelCode || '—') + '</td><td style="text-align:right">' + (r.model_name || r.modelName || '—') + '</td><td>' + (r.shelf || '—') + '</td><td>' + toFaNum(Number(r.quantity)||0) + '</td><td>' + fmt(Number(r.price_unit)||0) + '</td><td style="font-weight:bold">' + fmt(line) + '</td><td>' + fmt(Number(r.payment)||0) + '</td><td>' + (r.bank_name || r.receiver_bank || '—') + '</td><td>' + (r.deposit_date ? displayDate(r.deposit_date) : '—') + '</td></tr>');
    });
    _p.push('<tr style="background:#f1f5f9;font-weight:bold"><td colspan="6" style="text-align:left">جمع:</td><td>' + fmt(tot) + '</td><td>' + fmt(pay) + '</td><td colspan="2"></td></tr>');
    _p.push('</table>');
    _p.push(mizanSignaturesHtml(['مدیر مالی', 'حسابدار', 'مهر شرکت']));
    _p.push(mizanComputerNoteHtml());
    var html = buildStandardHtml('فاکتور', _p.join(''), '📄 فاکتور');
    html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
    return html;
  };

  const _buildInvoiceListHtml = () => {
    var _p = [];
    var title = '';
    if (partyViewMode === 'all') title = '📋 همه حرکات ' + (selectedParty?.name || '');
    else if (partyViewMode === 'in') title = '📥 ورودی‌های ' + (selectedParty?.name || '');
    else title = '📤 خروجی‌های ' + (selectedParty?.name || '');
    _p.push('<div class="title">' + title + '</div>');
    _p.push('<div class="info"><b>کدها:</b> ' + (selectedParty?.allCodes||[]).join(', ') + ' &nbsp;|&nbsp; <b>تلفن:</b> ' + (selectedParty?.allPhones||[]).join(', ') + '</div>');
    _p.push('<table style="width:100%;border-collapse:collapse;font-size:9px">');
    if (partyViewMode === 'all') {
      _p.push('<tr><th>#</th><th>تاریخ</th><th>نوع</th><th>سند</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr>');
      (buildPartyTransactions(selectedParty) || []).forEach(function(t: any, i: number) {
        _p.push('<tr><td>' + (i+1) + '</td><td>' + displayDate(t.date) + '</td><td>' + (TYPE_LABEL[t.type]||t.type) + '</td><td>' + (t.invoice||t.sourceId||'—') + '</td><td style="text-align:right">' + (cleanDesc(t)||'—') + '</td><td style="color:#1e40af;font-weight:bold">' + (t.debit?fmt(t.debit):'—') + '</td><td style="color:#059669;font-weight:bold">' + (t.credit?fmt(t.credit):'—') + '</td><td style="font-weight:bold">' + fmt(Math.abs(t._running||0)) + '</td></tr>');
      });
    } else if ((selectedParty?.type === 'مشتری' ? partyViewMode === 'out' : partyViewMode === 'in')) {
      _p.push('<tr><th>#</th><th>تاریخ</th><th>نوع</th><th>شماره فاکتور</th><th>تعداد</th><th>مبلغ کل</th><th>پرداخت</th><th>مانده</th></tr>');
      var tot = 0, paid = 0;
      (invoiceList || []).forEach(function(inv: any, i: number) {
        tot += Number(inv.total) || 0; paid += Number(inv.paid) || 0;
        _p.push('<tr><td>' + (i+1) + '</td><td>' + displayDate(inv.date) + '</td><td>' + (inv.type === 'purchase' ? 'خرید' : 'فروش') + '</td><td>' + inv.invoice + '</td><td>' + toFaNum(inv.count || 0) + '</td><td>' + fmt(inv.total) + '</td><td>' + fmt(inv.paid) + '</td><td>' + fmt(Math.abs(inv.balance)) + '</td></tr>');
      });
      _p.push('<tr style="background:#f1f5f9;font-weight:bold"><td colspan="4" style="text-align:left">جمع:</td><td></td><td>' + fmt(tot) + '</td><td>' + fmt(paid) + '</td><td>' + fmt(Math.abs(tot-paid)) + '</td></tr>');
    } else {
      _p.push('<tr><th>#</th><th>تاریخ</th><th>سند</th><th>شرح</th><th>مبلغ پرداخت</th><th>بانک</th><th>صاحب حساب</th></tr>');
      var totP = 0;
      (buildPaymentsList(selectedParty) || []).forEach(function(t: any, i: number) {
        var amt = Number(t.lineTotal) || Number(t.debit) || Number(t.credit) || 0;
        totP += amt;
        _p.push('<tr><td>' + (i+1) + '</td><td>' + displayDate(t.date) + '</td><td>' + (t.invoice||'—') + '</td><td style="text-align:right">' + (cleanDesc(t)||'—') + '</td><td style="font-weight:bold">' + fmt(amt) + '</td><td>' + (t.bank||'—') + '</td><td>' + (t.holder||'—') + '</td></tr>');
      });
      _p.push('<tr style="background:#f1f5f9;font-weight:bold"><td colspan="4" style="text-align:left">جمع:</td><td>' + fmt(totP) + '</td><td colspan="2"></td></tr>');
    }
    _p.push('</table>');
    var _bal = Number(selectedParty?.balance || 0);
    if (_bal !== 0) { _p.push('<div class="net-words">💵 مانده به حروف: ' + numToWords(Math.abs(_bal)) + ' ' + curLabel + '</div>'); }
    _p.push(mizanSignaturesHtml(['مدیر مالی', 'حسابدار', 'مهر شرکت']));
    _p.push(mizanComputerNoteHtml());
    var html = buildStandardHtml('گزارش', _p.join(''), '📋 گزارش');
    html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
    return html;
  };
  const _buildInvoiceDetailHtml = () => {
    var _p = [];
    _p.push('<div class="title">📄 فاکتور ' + (invoiceDetailMeta?.invoice || '') + '</div>');
    _p.push('<div class="info"><b>طرف:</b> ' + (selectedParty?.name || '') + ' &nbsp;|&nbsp; <b>نوع:</b> ' + (invoiceDetailMeta?.type === 'purchase' ? 'خرید' : 'فروش') + ' &nbsp;|&nbsp; <b>تاریخ:</b> ' + displayDate(invoiceDetailMeta?.date || '') + '</div>');
    _p.push('<table style="width:100%;border-collapse:collapse;font-size:8px">');
    _p.push('<tr><th>#</th><th>کد مدل</th><th>نام مدل</th><th>قفسه</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>پرداخت</th><th>بانک</th><th>تاریخ واریز</th><th>باربری</th></tr>');
    var tot = 0, paid = 0;
    (invoiceDetailRows || []).forEach(function(r: any, i: number) {
      var line = (Number(r.quantity) || 0) * (Number(r.price_unit) || 0);
      tot += line; paid += Number(r.payment) || 0;
      _p.push('<tr><td>' + (i+1) + '</td><td>' + (r.model_code || '—') + '</td><td style="text-align:right">' + (r.model_name || '—') + '</td><td>' + (r.shelf || '—') + '</td><td>' + toFaNum(Number(r.quantity) || 0) + '</td><td>' + fmt(Number(r.price_unit) || 0) + '</td><td style="font-weight:bold">' + fmt(line) + '</td><td>' + fmt(Number(r.payment) || 0) + '</td><td>' + (r.bank_name || r.receiver_bank || '—') + '</td><td>' + (r.deposit_date ? displayDate(r.deposit_date) : '—') + '</td><td>' + (r.shipping || '—') + '</td></tr>');
    });
    _p.push('<tr style="background:#f1f5f9;font-weight:bold"><td colspan="6" style="text-align:left">جمع:</td><td>' + fmt(tot) + '</td><td>' + fmt(paid) + '</td><td colspan="3"></td></tr>');
    _p.push('</table>');
    var _balD = (Number(td) || 0) - (Number(tc) || 0);
    if (_balD !== 0) { _p.push('<div class="net-words">💵 مانده به حروف: ' + numToWords(Math.abs(_balD)) + ' ' + curLabel + '</div>'); }
    _p.push(mizanSignaturesHtml(['مدیر مالی', 'حسابدار', 'مهر شرکت']));
    _p.push(mizanComputerNoteHtml());
    var _h = buildStandardHtml('فاکتور', _p.join(''), '📄 فاکتور');
    _h = _h.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
    return _h;
  };
  const pdfInvoiceList = async () => { try { var html = partyViewMode === 'all' ? _buildHtml(true) : _buildInvoiceListHtml(); var r = await shareHtmlAsPdf(html, 'statement-' + (selectedParty?.code || 'party') + '.pdf'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { if (showToast) showToast(e.message, true); } };;;
  const printInvoiceList = async () => { try { var html = partyViewMode === 'all' ? _buildHtml(true) : _buildInvoiceListHtml(); var r = await printHtml(html); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { if (showToast) showToast(e.message, true); } };;;
  const imgInvoiceList = async () => { try { if (!invoiceModalRef.current) return; const uri = await captureRef(invoiceModalRef, { format: 'jpg', quality: 0.95 }); if (Platform.OS === 'web') { await Share.share({ message: 'فاکتورها', url: uri }); } else if (await require('expo-sharing').isAvailableAsync()) { await require('expo-sharing').shareAsync(uri); } } catch (e: any) { if (showToast) showToast(e.message, true); } };

  const xlsInvoiceList = async () => {
    try {
      let rows: any[] = [];
      let name = 'گزارش';
      if (partyViewMode === 'all') {
        name = 'همه';
        rows = (buildPartyTransactions(selectedParty) || []).map((t: any, i: number) => ({ '#': i+1, 'تاریخ': displayDate(t.date), 'نوع': TYPE_LABEL[t.type] || t.type, 'سند': t.invoice || t.sourceId || '', 'شرح': cleanDesc(t), 'بدهکار': t.debit || 0, 'بستانکار': t.credit || 0, 'مانده': Math.abs(t._running || 0) }));
      } else if (partyViewMode === 'in') {
        name = 'ورودی‌ها';
        rows = (invoiceList || []).map((inv: any, i: number) => ({ '#': i+1, 'تاریخ': displayDate(inv.date), 'نوع': inv.type === 'purchase' ? 'خرید' : 'فروش', 'شماره فاکتور': inv.invoice, 'تعداد': inv.count || 0, 'مبلغ کل': inv.total, 'پرداخت': inv.paid, 'مانده': Math.abs(inv.balance) }));
      } else {
        name = 'خروجی‌ها';
        rows = (buildPaymentsList(selectedParty) || []).map((t: any, i: number) => ({ '#': i+1, 'تاریخ': displayDate(t.date), 'سند': t.invoice || '', 'شرح': cleanDesc(t), 'مبلغ پرداخت': Number(t.lineTotal) || Number(t.debit) || Number(t.credit) || 0, 'بانک': t.bank || '', 'صاحب حساب': t.holder || '' }));
      }
      const r = await exportExcel([{ name, data: rows }], 'party-' + (selectedParty?.code || 'p') + '-' + Date.now() + '.xlsx');
      if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok);
    } catch (e: any) { if (showToast) showToast(e.message, true); }
  };
  function _buildInvoiceHTMLInline(meta: any, rows: any[]) {
    var isP = meta && meta.type === 'purchase';
    var _p = [];
    _p.push('<div class="title">📄 فاکتور ' + (meta?.invoice || '') + '</div>');
    _p.push('<div class="info"><b>طرف:</b> ' + (selectedParty?.name || '—') + ' &nbsp;|&nbsp; <b>نوع:</b> ' + (isP ? 'خرید' : 'فروش') + ' &nbsp;|&nbsp; <b>تاریخ:</b> ' + displayDate(meta?.date || '') + '</div>');
    _p.push('<table style="width:100%;border-collapse:collapse;font-size:7px">');
    _p.push('<tr><th>#</th><th>تاریخ</th><th>نوع</th><th>فاکتور</th><th>فاکتور دستی</th><th>کد مدل</th><th>نام مدل</th><th>تعداد</th><th>قیمت</th><th>جمع ردیف</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>بانک</th><th>صاحب حساب</th><th>کد صاحب</th><th>تاریخ واریز</th><th>باربری</th><th>شرح</th></tr>');
    var td = 0, tc = 0, run = 0, idx = 0;
    (rows || []).forEach(function(r) {
      var qty = Number(r.quantity) || 0, pr = Number(r.price_unit) || 0, line = qty * pr;
      var d = isP ? 0 : line, c = isP ? line : 0;
      td += d; tc += c; run += c - d; idx++;
      _p.push('<tr><td>' + idx + '</td><td>' + displayDate(r.date_reg || r.date_factor || '') + '</td><td>' + (isP ? 'خرید' : 'فروش') + '</td><td>' + (r.invoice_number || '—') + '</td><td>' + (r.manual_invoice || '—') + '</td><td>' + (r.model_code || '—') + '</td><td style="text-align:right">' + (r.model_name || '—') + '</td><td>' + toFaNum(qty) + '</td><td>' + fmt(pr) + '</td><td>' + fmt(line) + '</td><td style="color:#1e40af;font-weight:bold">' + (d ? fmt(d) : '—') + '</td><td style="color:#059669;font-weight:bold">' + (c ? fmt(c) : '—') + '</td><td style="font-weight:bold">' + fmt(Math.abs(run)) + '</td><td>' + (r.bank_name || r.receiver_bank || '—') + '</td><td>' + (r.account_holder || '—') + '</td><td>' + (r.account_holder_code || '—') + '</td><td>' + (r.deposit_date ? displayDate(r.deposit_date) : '—') + '</td><td>' + (r.shipping || '—') + '</td><td style="text-align:right">' + (r.description || '—') + '</td></tr>');
    });
    _p.push('<tr style="background:#f1f5f9;font-weight:bold"><td colspan="10" style="text-align:left">جمع:</td><td style="color:#1e40af">' + fmt(td) + '</td><td style="color:#059669">' + fmt(tc) + '</td><td>' + fmt(Math.abs(td - tc)) + '</td><td colspan="6"></td></tr>');
    _p.push('</table>');
    var bal = td - tc;
    var stTxt = bal > 0 ? 'ما بستانکاریم' : bal < 0 ? 'ما بدهکاریم' : 'تسویه';
    var stCol = bal > 0 ? '#dc2626' : bal < 0 ? '#059669' : '#64748b';
    _p.push('<div style="margin-top:8px;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;text-align:right"><div style="font-size:11px;font-weight:bold">💵 مانده: ' + fmt(Math.abs(bal)) + ' ' + curLabel + '</div><div style="font-size:10px;color:#475569">🔤 به حروف: ' + numToWords(Math.abs(bal)) + ' ' + curLabel + '</div><div style="font-size:11px;font-weight:bold;color:' + stCol + '">📌 وضعیت: ' + stTxt + '</div></div>');
    _p.push(mizanSignaturesHtml(['مدیر مالی', 'حسابدار', 'مهر شرکت']));
    _p.push(mizanComputerNoteHtml());
    var html = buildStandardHtml('فاکتور', _p.join(''), '📄 فاکتور');
    html = html.replace('</head>', '<style>@page{size:A4 landscape;margin:8mm}</style></head>');
    return html;
  }

  const pdfInvoice = async () => { try { var html = _buildInvoiceHTMLInline(invoiceDetailMeta, invoiceDetailRows); var r = await shareHtmlAsPdf(html, 'invoice-' + (invoiceDetailMeta?.invoice || '') + '.pdf'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { console.error('[pdfInvoice] error:', e); if (showToast) showToast(e.message || String(e), true); } };;;
  const printInvoice = async () => { try { var html = _buildInvoiceHTMLInline(invoiceDetailMeta, invoiceDetailRows); var r = await printHtml(html); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { console.error('[printInvoice] error:', e); if (showToast) showToast(e.message || String(e), true); } };;;
  const imgInvoice = async () => { try { if (!invoiceRef.current) return; const uri = await captureRef(invoiceRef, { format: 'jpg', quality: 0.95 }); if (Platform.OS === 'web') { await Share.share({ message: 'فاکتور', url: uri }); } else if (await require('expo-sharing').isAvailableAsync()) { await require('expo-sharing').shareAsync(uri); } } catch (e: any) { if (showToast) showToast(e.message, true); } };
  const xlsInvoice = async () => { try { const rows = (invoiceDetailRows || []).map((r: any, i: number) => ({ '#': i+1, 'کد مدل': r.model_code || r.modelCode || '', 'نام مدل': r.model_name || r.modelName || '', 'قفسه': r.shelf || '', 'تعداد': Number(r.quantity) || 0, 'قیمت': Number(r.price_unit) || 0, 'جمع': (Number(r.quantity)||0)*(Number(r.price_unit)||0), 'پرداخت': Number(r.payment) || 0, 'بانک': r.bank_name || r.receiver_bank || '', 'تاریخ واریز': r.deposit_date || '' })); const r = await exportExcel([{ name: 'فاکتور', data: rows }], 'invoice-' + (invoiceDetailMeta?.invoice || '') + '-' + Date.now() + '.xlsx'); if (showToast) showToast(r.ok ? '✅ ' + r.message : '❌ ' + r.message, !r.ok); } catch (e: any) { if (showToast) showToast(e.message, true); } };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f2438' }}>📊 ترازنامه (دفتر معین)</Text>
        <TouchableOpacity onPress={onBack} style={{ padding: 8, backgroundColor: '#e2e8f0', borderRadius: 8 }}>
          <Text style={{ fontWeight: 'bold' }}>← بازگشت</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setActiveTab('parties')} style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: activeTab === 'parties' ? '#7c3aed' : '#e2e8f0' }}>
          <Text style={{ color: activeTab === 'parties' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 13 }}>👥 طرف‌حساب‌ها</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('partners')} style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: activeTab === 'partners' ? '#7c3aed' : '#e2e8f0' }}>
          <Text style={{ color: activeTab === 'partners' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 13 }}>🤝 تراز شرکا</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('employees')} style={{ flex: 1, minWidth: 100, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: activeTab === 'employees' ? '#7c3aed' : '#e2e8f0' }}>
          <Text style={{ color: activeTab === 'employees' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 12 }}>👷 کارمندان</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('expenses')} style={{ flex: 1, minWidth: 100, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: activeTab === 'expenses' ? '#7c3aed' : '#e2e8f0' }}>
          <Text style={{ color: activeTab === 'expenses' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 12 }}>🧾 هزینه‌ها</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row-reverse', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 16, color: '#64748b', marginRight: 8 }}>🔍</Text>
        <TextInput style={{ flex: 1, paddingVertical: 10, textAlign: 'right', fontSize: 13, color: '#0f2438' }} placeholder="جستجو (نام، کد، تلفن)..." placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}><Text style={{ color: '#dc2626', fontWeight: 'bold' }}>✕</Text></TouchableOpacity>)}
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <TouchableOpacity onPress={pdfAll} style={[s.btn, { backgroundColor: '#8e44ad' }]}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
        <TouchableOpacity onPress={printAll} style={[s.btn, { backgroundColor: '#0ea5e9' }]}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
        <TouchableOpacity onPress={imgAll} style={[s.btn, { backgroundColor: '#f59e0b' }]}><Text style={s.btnTxt}>📤 تصویر</Text></TouchableOpacity>
        <TouchableOpacity onPress={xlsAll} style={[s.btn, { backgroundColor: '#059669' }]}><Text style={s.btnTxt}>📊 اکسل</Text></TouchableOpacity>
      </View>

      <View ref={ref} collapsable={false} style={{ backgroundColor: '#fff', padding: 8, borderRadius: 8, alignSelf: 'stretch', width: '100%' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1, minWidth: '100%' }}>
          <View style={{ flex: 1, minWidth: '100%' }}>
            {activeTab === 'parties' ? (
              <>
                <View style={s.thead}>
                  <Text style={[s.th, { width: 40, flex: 0.5 }]}>#</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>نوع</Text>
                  <Text style={[s.th, { flex: 3, textAlign: 'right', paddingRight: 8 }]}>نام طرف حساب</Text>
                  <Text style={[s.th, { flex: 2 }]}>کدها</Text>
                  <Text style={[s.th, { flex: 2 }]}>تلفن</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>جمع بدهکار</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>جمع بستانکار</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>مانده</Text>
                  <Text style={[s.th, { flex: 1.2 }]}>وضعیت</Text>
                </View>
                {getDisplayData().map((r: any, i: number) => (
                  <TouchableOpacity key={i} onPress={() => openParty(r)} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                    <Text style={[s.td, { width: 40, flex: 0.5 }]}>{i + 1}</Text>
                    <Text style={[s.td, { flex: 1.5, fontSize: 10, fontWeight: 'bold', color: r.type === 'مشتری' ? '#059669' : r.type === 'تأمین‌کننده' ? '#ea580c' : '#7c3aed' }]}>{r.type || '—'}</Text>
                    <Text style={[s.td, { flex: 3, textAlign: 'right', paddingRight: 8, color: '#2563eb', textDecorationLine: 'underline', fontWeight: 'bold' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.td, { flex: 2, fontSize: 9 }]} numberOfLines={1}>{(r.allCodes || []).join(', ')}</Text>
                    <Text style={[s.td, { flex: 2, fontSize: 10 }]} numberOfLines={1}>{r.phone}</Text>
                    <Text style={[s.td, { flex: 1.5, color: '#1e40af', fontWeight: 'bold' }]}>{fmt(r.totalDebit)}</Text>
                    <Text style={[s.td, { flex: 1.5, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.totalCredit)}</Text>
                    <Text style={[s.td, { flex: 1.5, fontWeight: 'bold' }]}>{fmt(Math.abs(r.balance))}</Text>
                    <Text style={[s.td, { flex: 1.2, fontWeight: 'bold', color: r.balance > 0 ? '#dc2626' : r.balance < 0 ? '#059669' : '#64748b' }]}>{r.balance > 0 ? 'ما بستانکاریم' : r.balance < 0 ? 'ما بدهکاریم' : 'تسویه'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : activeTab === 'partners' ? (
              <>
                <View style={s.thead}>
                  <Text style={[s.th, { width: 40, flex: 0.5 }]}>#</Text>
                  <Text style={[s.th, { flex: 2.5, textAlign: 'right', paddingRight: 8 }]}>نام شریک</Text>
                  <Text style={[s.th, { flex: 1.2 }]}>کد</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>تلفن</Text>
                  <Text style={[s.th, { flex: 1.3 }]}>سرمایه</Text>
                  <Text style={[s.th, { flex: 1.3 }]}>جاری</Text>
                  <Text style={[s.th, { flex: 1.3 }]}>برداشت</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>مانده کل</Text>
                  <Text style={[s.th, { flex: 1.8 }]}>وضعیت</Text>
                </View>
                {getDisplayData().map((r: any, i: number) => (
                  <TouchableOpacity key={i} onPress={() => openParty(r)} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                    <Text style={[s.td, { width: 40, flex: 0.5 }]}>{i + 1}</Text>
                    <Text style={[s.td, { flex: 2.5, textAlign: 'right', paddingRight: 8, color: '#2563eb', textDecorationLine: 'underline', fontWeight: 'bold' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.td, { flex: 1.2, fontSize: 9, color: '#7c3aed' }]}>{r.code}</Text>
                    <Text style={[s.td, { flex: 1.5, fontSize: 10 }]}>{r.phone}</Text>
                    <Text style={[s.td, { flex: 1.3, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.capital || 0)}</Text>
                    <Text style={[s.td, { flex: 1.3, color: (r.current || 0) >= 0 ? '#059669' : '#dc2626', fontWeight: 'bold' }]}>{fmt(r.current || 0)}</Text>
                    <Text style={[s.td, { flex: 1.3, color: '#dc2626', fontWeight: 'bold' }]}>{fmt(r.drawings || 0)}</Text>
                    <Text style={[s.td, { flex: 1.5, fontWeight: 'bold' }]}>{fmt(Math.abs(r.balance || 0))}</Text>
                    <Text style={[s.td, { flex: 1.8, fontWeight: 'bold', color: r.balance > 0 ? '#dc2626' : r.balance < 0 ? '#059669' : '#64748b' }]}>{r.balance > 0 ? 'شرکت بدهکار به شریک' : r.balance < 0 ? 'شریک بدهکار به شرکت' : 'تسویه'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : activeTab === 'employees' ? (
              <>
                <View style={s.thead}>
                  <Text style={[s.th, { width: 40, flex: 0.5 }]}>#</Text>
                  <Text style={[s.th, { flex: 3, textAlign: 'right', paddingRight: 8 }]}>نام کارمند</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>کد</Text>
                  <Text style={[s.th, { flex: 1.8 }]}>جمع حقوق</Text>
                  <Text style={[s.th, { flex: 1.8 }]}>جمع پرداخت</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>مانده</Text>
                  <Text style={[s.th, { flex: 2 }]}>وضعیت</Text>
                </View>
                {getDisplayData().map((r: any, i: number) => (
                  <TouchableOpacity key={i} onPress={() => openParty(r)} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                    <Text style={[s.td, { width: 40, flex: 0.5 }]}>{i + 1}</Text>
                    <Text style={[s.td, { flex: 3, textAlign: 'right', paddingRight: 8, color: '#2563eb', textDecorationLine: 'underline', fontWeight: 'bold' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.td, { flex: 1.5, fontSize: 10, color: '#7c3aed' }]}>{r.code}</Text>
                    <Text style={[s.td, { flex: 1.8, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.totalCredit || 0)}</Text>
                    <Text style={[s.td, { flex: 1.8, color: '#1e40af', fontWeight: 'bold' }]}>{fmt(r.totalDebit || 0)}</Text>
                    <Text style={[s.td, { flex: 1.5, fontWeight: 'bold' }]}>{fmt(Math.abs(r.balance || 0))}</Text>
                    <Text style={[s.td, { flex: 2, fontWeight: 'bold', color: r.balance < 0 ? '#dc2626' : r.balance > 0 ? '#059669' : '#64748b' }]}>{r.balance < 0 ? 'شرکت بدهکار به کارمند' : r.balance > 0 ? 'کارمند بدهکار به شرکت' : 'تسویه'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <View style={s.thead}>
                  <Text style={[s.th, { width: 40, flex: 0.5 }]}>#</Text>
                  <Text style={[s.th, { flex: 3, textAlign: 'right', paddingRight: 8 }]}>نام هزینه‌گیرنده</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>کد</Text>
                  <Text style={[s.th, { flex: 1.8 }]}>جمع هزینه</Text>
                  <Text style={[s.th, { flex: 1.8 }]}>جمع پرداخت</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>مانده</Text>
                  <Text style={[s.th, { flex: 2 }]}>وضعیت</Text>
                </View>
                {getDisplayData().map((r: any, i: number) => (
                  <TouchableOpacity key={i} onPress={() => openParty(r)} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                    <Text style={[s.td, { width: 40, flex: 0.5 }]}>{i + 1}</Text>
                    <Text style={[s.td, { flex: 3, textAlign: 'right', paddingRight: 8, color: '#2563eb', textDecorationLine: 'underline', fontWeight: 'bold' }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.td, { flex: 1.5, fontSize: 10, color: '#7c3aed' }]}>{r.code}</Text>
                    <Text style={[s.td, { flex: 1.8, color: '#059669', fontWeight: 'bold' }]}>{fmt(r.totalCredit || 0)}</Text>
                    <Text style={[s.td, { flex: 1.8, color: '#1e40af', fontWeight: 'bold' }]}>{fmt(r.totalDebit || 0)}</Text>
                    <Text style={[s.td, { flex: 1.5, fontWeight: 'bold' }]}>{fmt(Math.abs(r.balance || 0))}</Text>
                    <Text style={[s.td, { flex: 2, fontWeight: 'bold', color: r.balance > 0 ? '#dc2626' : r.balance < 0 ? '#059669' : '#64748b' }]}>{r.balance > 0 ? 'ما بدهکاریم' : r.balance < 0 ? 'ما بستانکاریم' : 'تسویه'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {getDisplayData().length === 0 && (<View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>موردی یافت نشد</Text></View>)}
          </View>
        </ScrollView>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>📋 کارت حساب: {selectedParty?.name}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, padding: 8, flexWrap: 'wrap', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <TouchableOpacity onPress={pdfParty} style={[s.btn, { backgroundColor: '#8e44ad' }]}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
              <TouchableOpacity onPress={printParty} style={[s.btn, { backgroundColor: '#0ea5e9' }]}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
              <TouchableOpacity onPress={imgParty} style={[s.btn, { backgroundColor: '#f59e0b' }]}><Text style={s.btnTxt}>📤 تصویر</Text></TouchableOpacity>
              <TouchableOpacity onPress={xlsParty} style={[s.btn, { backgroundColor: '#059669' }]}><Text style={s.btnTxt}>📥 اکسل</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 8 }} ref={modalRef} collapsable={false}>
              <View style={s.modalInfo}>
                <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold' }}>کدها: </Text>{(selectedParty?.allCodes || []).join(', ')}</Text>
                <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold' }}>تلفن‌ها: </Text>{(selectedParty?.allPhones || []).join(', ')}</Text>
                <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold' }}>نوع: </Text>{selectedParty?.type || '—'}</Text>

                {selectedParty?.type === 'شریک' && (
                  <>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: '#059669' }}>سرمایه: </Text>{fmt(selectedParty?.capital || 0)} {curLabel}</Text>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: (selectedParty?.current || 0) >= 0 ? '#059669' : '#dc2626' }}>جاری: </Text>{fmt(selectedParty?.current || 0)} {curLabel}</Text>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: '#dc2626' }}>برداشت: </Text>{fmt(selectedParty?.drawings || 0)} {curLabel}</Text>
                  </>
                )}

                {selectedParty?.type === 'کارمند' && (
                  <>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: '#059669' }}>جمع حقوق: </Text>{fmt(selectedParty?.totalCredit || 0)} {curLabel}</Text>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: '#1e40af' }}>جمع پرداخت: </Text>{fmt(selectedParty?.totalDebit || 0)} {curLabel}</Text>
                  </>
                )}

                {selectedParty?.type === 'هزینه‌گیرنده' && (
                  <>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: '#059669' }}>جمع هزینه: </Text>{fmt(selectedParty?.totalCredit || 0)} {curLabel}</Text>
                    <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold', color: '#1e40af' }}>جمع پرداخت: </Text>{fmt(selectedParty?.totalDebit || 0)} {curLabel}</Text>
                  </>
                )}

                <Text style={s.infoTxt}><Text style={{ fontWeight: 'bold' }}>مانده نهایی: </Text>{fmt(Math.abs(selectedParty?.balance || 0))} {curLabel}</Text>
                <Text style={s.infoTxt}>
                  <Text style={{ fontWeight: 'bold' }}>وضعیت: </Text>
                  <Text style={{ color: selectedParty?.balance > 0 ? '#dc2626' : selectedParty?.balance < 0 ? '#059669' : '#64748b', fontWeight: 'bold' }}>
                    {selectedParty?.type === 'شریک'
                      ? (selectedParty?.balance > 0 ? 'شرکت بدهکار به شریک' : selectedParty?.balance < 0 ? 'شریک بدهکار به شرکت' : 'تسویه')
                      : selectedParty?.type === 'کارمند'
                      ? (selectedParty?.balance < 0 ? 'شرکت بدهکار به کارمند' : selectedParty?.balance > 0 ? 'کارمند بدهکار به شرکت' : 'تسویه')
                      : selectedParty?.type === 'هزینه‌گیرنده'
                      ? (selectedParty?.balance > 0 ? 'ما بدهکاریم' : selectedParty?.balance < 0 ? 'ما بستانکاریم' : 'تسویه')
                      : (selectedParty?.balance > 0 ? 'ما بستانکاریم' : selectedParty?.balance < 0 ? 'ما بدهکاریم' : 'تسویه')}
                  </Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
                {(selectedParty?.type === 'شریک'
                  ? [
                      { k: 'all', l: 'همه' }, { k: 'capital', l: 'سرمایه' }, { k: 'current', l: 'جاری' },
                      { k: 'drawings', l: 'برداشت' }, { k: 'in', l: 'ورودی‌ها' }, { k: 'out', l: 'خروجی‌ها' },
                      { k: 'transfer', l: 'انتقالات' },
                    ]
                  : selectedParty?.type === 'کارمند'
                  ? [
                      { k: 'all', l: 'همه' }, { k: 'salary', l: 'حقوق' }, { k: 'salary_payment', l: 'پرداخت حقوق' },
                      { k: 'in', l: 'ورودی‌ها' }, { k: 'out', l: 'خروجی‌ها' },
                    ]
                  : selectedParty?.type === 'هزینه‌گیرنده'
                  ? [
                      { k: 'all', l: 'همه' }, { k: 'expense', l: 'هزینه' }, { k: 'expense_payment', l: 'پرداخت هزینه' },
                      { k: 'in', l: 'ورودی‌ها' }, { k: 'out', l: 'خروجی‌ها' },
                    ]
                  : [
                      { k: 'all', l: 'همه' }, { k: 'in', l: 'ورودی‌ها' }, { k: 'out', l: 'خروجی‌ها' },
                    ]
                ).map((f: any) => (
                  <TouchableOpacity key={f.k} onPress={() => setPartyFilter(f.k)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: partyFilter === f.k ? '#7c3aed' : '#e2e8f0' }}>
                    <Text style={{ color: partyFilter === f.k ? '#fff' : '#475569', fontSize: 11, fontWeight: 'bold' }}>{f.l}</Text>
                  </TouchableOpacity>
                ))}
                    <View style={[s.trow, { backgroundColor: '#e2e8f0', borderTopWidth: 2, borderTopColor: '#0f2438' }]}>
                      <Text style={[s.td, { width: 30 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                      <Text style={[s.td, { width: 75 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 85 }]}></Text>
                      <Text style={[s.td, { width: 60 }]}></Text>
                      <Text style={[s.td, { width: 120 }]}></Text>
                      <Text style={[s.td, { width: 45, fontWeight: 'bold', fontSize: 10 }]}>{toFaNum((buildPartyTransactions(selectedParty) || []).reduce((a: number, t: any) => a + (Number(t.qty) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 65 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>{fmt((buildPartyTransactions(selectedParty) || []).reduce((a: number, t: any) => a + (Number(t.lineTotal) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10, color: '#1e40af' }]}>{fmt((buildPartyTransactions(selectedParty) || []).reduce((a: number, t: any) => a + (Number(t.debit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10, color: '#059669' }]}>{fmt((buildPartyTransactions(selectedParty) || []).reduce((a: number, t: any) => a + (Number(t.credit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs((buildPartyTransactions(selectedParty) || []).reduce((a: number, t: any) => a + (Number(t.credit) || 0) - (Number(t.debit) || 0), 0)))}</Text>
                      <Text style={[s.td, { width: 80 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 65 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 85 }]}></Text>
                      <Text style={[s.td, { width: 120 }]}></Text>
                      <Text style={[s.td, { width: 70 }]}></Text>
                    </View>
              </View>

              <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginVertical: 8 }}>ریز تراکنش‌ها ({toFaNum(filteredPartyDetails.length)})</Text>

              <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {treeMode === 'flat' ? (
                  <TouchableOpacity onPress={() => setTreeMode('groups')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#0f2438' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>🗂 نمایش گروهی</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => {
                    if (treeMode === 'counterparty') { setTreeMode('group'); setActiveCounterparty(''); }
                    else if (treeMode === 'group') { setTreeMode('groups'); setActiveGroup(''); }
                    else { setTreeMode('flat'); }
                  }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#64748b' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>← بازگشت</Text>
                  </TouchableOpacity>
                )}
                {treeMode !== 'flat' && (
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f2438' }}>
                    {treeMode === 'groups' ? 'گروه‌ها' : treeMode === 'group' ? activeGroup : activeCounterparty}
                  </Text>
                )}
              </View>

              {treeMode === 'flat' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 30 }]}>#</Text>
                      <Text style={[s.th, { width: 80 }]}>تاریخ</Text>
                      <Text style={[s.th, { width: 90 }]}>نوع</Text>
                      <Text style={[s.th, { width: 70 }]}>حساب</Text>
                      <Text style={[s.th, { width: 80 }]}>طرف</Text>
                      <Text style={[s.th, { width: 90 }]}>سند</Text>
                      <Text style={[s.th, { width: 180 }]}>شرح</Text>
                      <Text style={[s.th, { width: 85 }]}>بدهکار</Text>
                      <Text style={[s.th, { width: 85 }]}>بستانکار</Text>
                      <Text style={[s.th, { width: 85 }]}>مانده</Text>
                    </View>
                    {filteredPartyDetails.map((t: any, i: number) => (
                      <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9 }]}>{displayDate(t.date)}</Text>
                        <Text style={[s.td, { width: 90, color: TYPE_COLOR[t.type] || '#0f2438', fontWeight: 'bold', fontSize: 9 }]}>{TYPE_LABEL[t.type] || t.type}</Text>
                        <Text style={[s.td, { width: 70, fontSize: 9, color: '#7c3aed' }]}>{t.accountType === 'capital' ? 'سرمایه' : t.accountType === 'drawings' ? 'برداشت' : t.accountType === 'current' ? 'جاری' : '—'}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9, color: '#0891b2' }]}>{cpLabel(t)}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9, color: '#7c3aed' }]} numberOfLines={1}>{t.invoice || t.sourceId || '—'}</Text>
                        <Text style={[s.td, { width: 180, fontSize: 9, textAlign: 'right' }]} numberOfLines={2}>{cleanDesc(t) || '—'}</Text>
                        <Text style={[s.td, { width: 85, fontSize: 9, color: t.debit ? '#1e40af' : '#475569', fontWeight: 'bold' }]}>{t.debit ? fmt(t.debit) : '—'}</Text>
                        <Text style={[s.td, { width: 85, fontSize: 9, color: t.credit ? '#059669' : '#475569', fontWeight: 'bold' }]}>{t.credit ? fmt(t.credit) : '—'}</Text>
                        <Text style={[s.td, { width: 85, fontSize: 9, fontWeight: 'bold' }]}>{fmt(Math.abs(t.runningBalance || 0))}
                    </Text>
                      </View>
                    ))}
                    <View style={[s.trow, { backgroundColor: '#f1f5f9', borderTopWidth: 1, borderTopColor: '#cbd5e1' }]}>
                      <Text style={[s.td, { width: 30 }]}></Text>
                      <Text style={[s.td, { width: 80, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 70 }]}></Text>
                      <Text style={[s.td, { width: 80 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 180 }]}></Text>
                      <Text style={[s.td, { width: 85, color: '#1e40af', fontWeight: 'bold', fontSize: 10 }]}>{fmt(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.debit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 85, color: '#059669', fontWeight: 'bold', fontSize: 10 }]}>{fmt(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.credit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 85, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.credit) || 0) - (Number(t.debit) || 0), 0)))}</Text>
                    </View>
                  </View>
                </ScrollView>
              ) : treeMode === 'groups' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 40 }]}>#</Text>
                      <Text style={[s.th, { width: 180, textAlign: 'right' }]}>گروه</Text>
                      <Text style={[s.th, { width: 80 }]}>تعداد</Text>
                      <Text style={[s.th, { width: 100 }]}>بدهکار</Text>
                      <Text style={[s.th, { width: 100 }]}>بستانکار</Text>
                      <Text style={[s.th, { width: 100 }]}>مانده</Text>
                    </View>
                    {getTreeGroups().map((g: any, i: number) => (
                      <TouchableOpacity key={g.name} onPress={() => { setActiveGroup(g.name); setTreeMode('group'); }} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 40 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 180, textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }]}>{g.name}</Text>
                        <Text style={[s.td, { width: 80 }]}>{toFaNum(g.count)}</Text>
                        <Text style={[s.td, { width: 100, color: '#1e40af', fontWeight: 'bold' }]}>{fmt(g.debit)}</Text>
                        <Text style={[s.td, { width: 100, color: '#059669', fontWeight: 'bold' }]}>{fmt(g.credit)}</Text>
                        <Text style={[s.td, { width: 100, fontWeight: 'bold' }]}>{fmt(Math.abs(g.balance))}</Text>
                      </TouchableOpacity>
                    ))}
                    <View style={[s.trow, { backgroundColor: '#e2e8f0', borderTopWidth: 2, borderTopColor: '#0f2438' }]}>
                      <Text style={[s.td, { width: 30 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                      <Text style={[s.td, { width: 75 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 85 }]}></Text>
                      <Text style={[s.td, { width: 60 }]}></Text>
                      <Text style={[s.td, { width: 120 }]}></Text>
                      <Text style={[s.td, { width: 45, fontWeight: 'bold', fontSize: 10 }]}>{toFaNum(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.qty) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 65 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>{fmt(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.lineTotal) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10, color: '#1e40af' }]}>{fmt(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.debit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10, color: '#059669' }]}>{fmt(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.credit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs(filteredPartyDetails.reduce((a: number, t: any) => a + (Number(t.credit) || 0) - (Number(t.debit) || 0), 0)))}</Text>
                      <Text style={[s.td, { width: 80 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 65 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 85 }]}></Text>
                      <Text style={[s.td, { width: 120 }]}></Text>
                      <Text style={[s.td, { width: 70 }]}></Text>
                    </View>
                  </View>
                </ScrollView>
              ) : treeMode === 'group' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 40 }]}>#</Text>
                      <Text style={[s.th, { width: 240, textAlign: 'right' }]}>طرف / دسته</Text>
                      <Text style={[s.th, { width: 80 }]}>تعداد</Text>
                      <Text style={[s.th, { width: 100 }]}>بدهکار</Text>
                      <Text style={[s.th, { width: 100 }]}>بستانکار</Text>
                      <Text style={[s.th, { width: 100 }]}>مانده</Text>
                    </View>
                    {getTreeCounterparties(activeGroup).map((c: any, i: number) => (
                      <TouchableOpacity key={c.name} onPress={() => { setActiveCounterparty(c.name); setTreeMode('counterparty'); }} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 40 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 240, textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }]}>{c.name}</Text>
                        <Text style={[s.td, { width: 80 }]}>{toFaNum(c.count)}</Text>
                        <Text style={[s.td, { width: 100, color: '#1e40af', fontWeight: 'bold' }]}>{fmt(c.debit)}</Text>
                        <Text style={[s.td, { width: 100, color: '#059669', fontWeight: 'bold' }]}>{fmt(c.credit)}</Text>
                        <Text style={[s.td, { width: 100, fontWeight: 'bold' }]}>{fmt(Math.abs(c.balance))}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 30 }]}>#</Text>
                      <Text style={[s.th, { width: 75 }]}>تاریخ</Text>
                      <Text style={[s.th, { width: 80 }]}>نوع</Text>
                      <Text style={[s.th, { width: 95 }]}>سند</Text>
                      <Text style={[s.th, { width: 170 }]}>شرح</Text>
                      <Text style={[s.th, { width: 90 }]}>جمع سند</Text>
                      <Text style={[s.th, { width: 90 }]}>پرداخت سند</Text>
                      <Text style={[s.th, { width: 90 }]}>مانده سند</Text>
                      <Text style={[s.th, { width: 80 }]}>بدهکار</Text>
                      <Text style={[s.th, { width: 80 }]}>بستانکار</Text>
                      <Text style={[s.th, { width: 80 }]}>مانده</Text>
                    </View>
                    {treeTxns.map((t: any, i: number) => (
                      <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 75, fontSize: 9 }]}>{displayDate(t.date)}</Text>
                        <Text style={[s.td, { width: 80, color: TYPE_COLOR[t.type] || '#0f2438', fontWeight: 'bold', fontSize: 9 }]}>{TYPE_LABEL[t.type] || t.type}</Text>
                        <Text style={[s.td, { width: 95, fontSize: 9, color: '#7c3aed' }]} numberOfLines={1}>{t.sourceInfo?.invoice || t.invoice || t.sourceId || '—'}</Text>
                        <Text style={[s.td, { width: 170, fontSize: 9, textAlign: 'right' }]} numberOfLines={2}>{cleanDesc(t) || '—'}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9, color: '#1e40af', fontWeight: 'bold' }]}>{t.sourceInfo?.total ? fmt(t.sourceInfo.total) : '—'}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9, color: '#059669', fontWeight: 'bold' }]}>{t.sourceInfo?.paid ? fmt(t.sourceInfo.paid) : '—'}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9, fontWeight: 'bold' }]}>{t.sourceInfo?.balance !== undefined ? fmt(Math.abs(t.sourceInfo.balance)) : '—'}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9, color: t.debit ? '#1e40af' : '#475569', fontWeight: 'bold' }]}>{t.debit ? fmt(t.debit) : '—'}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9, color: t.credit ? '#059669' : '#475569', fontWeight: 'bold' }]}>{t.credit ? fmt(t.credit) : '—'}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9, fontWeight: 'bold' }]}>{fmt(Math.abs(t.runningBalance || 0))}</Text>
                      </View>
                    ))}
                    <View style={[s.trow, { backgroundColor: '#f1f5f9', borderTopWidth: 1, borderTopColor: '#cbd5e1' }]}>
                      <Text style={[s.td, { width: 30 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                      <Text style={[s.td, { width: 80 }]}></Text>
                      <Text style={[s.td, { width: 95 }]}></Text>
                      <Text style={[s.td, { width: 170 }]}></Text>
                      <Text style={[s.td, { width: 90, color: '#1e40af', fontWeight: 'bold', fontSize: 10 }]}>{fmt(treeTxns.reduce((a: number, t: any) => a + (Number(t.sourceInfo?.total) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 90, color: '#059669', fontWeight: 'bold', fontSize: 10 }]}>{fmt(treeTxns.reduce((a: number, t: any) => a + (Number(t.sourceInfo?.paid) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 90, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs(treeTxns.reduce((a: number, t: any) => a + (Number(t.sourceInfo?.balance) || 0), 0)))}</Text>
                      <Text style={[s.td, { width: 80, color: '#1e40af', fontWeight: 'bold', fontSize: 10 }]}>{fmt(treeTxnsDebit)}</Text>
                      <Text style={[s.td, { width: 80, color: '#059669', fontWeight: 'bold', fontSize: 10 }]}>{fmt(treeTxnsCredit)}</Text>
                      <Text style={[s.td, { width: 80, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs(treeTxnsCredit - treeTxnsDebit))}</Text>
                    </View>
                  </View>
                </ScrollView>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={invoiceModalVisible} transparent animationType="slide" onRequestClose={() => setInvoiceModalVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{invoiceDetailMeta ? '📄 فاکتور: ' + invoiceDetailMeta.invoice : '📋 ' + (selectedParty?.name || '')}</Text>
              <TouchableOpacity onPress={() => setInvoiceModalVisible(false)}><Text style={{ color: '#fff', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>

            {invoiceDetailMeta ? (
              <View style={{ flexDirection: 'row', gap: 6, padding: 8, flexWrap: 'wrap', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                <TouchableOpacity onPress={pdfInvoice} style={[s.btn, { backgroundColor: '#8e44ad' }]}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
                <TouchableOpacity onPress={printInvoice} style={[s.btn, { backgroundColor: '#0ea5e9' }]}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
                <TouchableOpacity onPress={imgInvoice} style={[s.btn, { backgroundColor: '#f59e0b' }]}><Text style={s.btnTxt}>📤 تصویر</Text></TouchableOpacity>
                <TouchableOpacity onPress={xlsInvoice} style={[s.btn, { backgroundColor: '#059669' }]}><Text style={s.btnTxt}>📥 اکسل</Text></TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row-reverse', gap: 6, padding: 8, backgroundColor: '#f8fafc' }}>
                  <TouchableOpacity onPress={() => setPartyViewMode('all')} style={{ flex: 1, padding: 8, borderRadius: 6, alignItems: 'center', backgroundColor: partyViewMode === 'all' ? '#7c3aed' : '#e2e8f0' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12, color: partyViewMode === 'all' ? '#fff' : '#475569' }}>همه</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPartyViewMode('in')} style={{ flex: 1, padding: 8, borderRadius: 6, alignItems: 'center', backgroundColor: partyViewMode === 'in' ? '#7c3aed' : '#e2e8f0' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12, color: partyViewMode === 'in' ? '#fff' : '#475569' }}>ورودی‌ها</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPartyViewMode('out')} style={{ flex: 1, padding: 8, borderRadius: 6, alignItems: 'center', backgroundColor: partyViewMode === 'out' ? '#7c3aed' : '#e2e8f0' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12, color: partyViewMode === 'out' ? '#fff' : '#475569' }}>خروجی‌ها</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, padding: 8, flexWrap: 'wrap', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                  <TouchableOpacity onPress={pdfInvoiceList} style={[s.btn, { backgroundColor: '#8e44ad' }]}><Text style={s.btnTxt}>📄 PDF</Text></TouchableOpacity>
                  <TouchableOpacity onPress={printInvoiceList} style={[s.btn, { backgroundColor: '#0ea5e9' }]}><Text style={s.btnTxt}>🖨️ پرینت</Text></TouchableOpacity>
                  <TouchableOpacity onPress={imgInvoiceList} style={[s.btn, { backgroundColor: '#f59e0b' }]}><Text style={s.btnTxt}>📤 تصویر</Text></TouchableOpacity>
                <TouchableOpacity onPress={xlsInvoiceList} style={[s.btn, { backgroundColor: '#059669' }]}><Text style={s.btnTxt}>📥 اکسل</Text></TouchableOpacity>
                </View>
              </>
            )}

            <ScrollView ref={invoiceModalRef} style={{ padding: 8 }}>
              {invoiceDetailMeta ? (
                <>
                  <TouchableOpacity onPress={() => { setInvoiceDetailMeta(null); setInvoiceDetailRows([]); }} style={{ alignSelf: 'flex-end', padding: 6, backgroundColor: '#e2e8f0', borderRadius: 6, marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 11 }}>← بازگشت</Text>
                  </TouchableOpacity>
                  {invoiceLoading ? <ActivityIndicator /> : (
                    <ScrollView horizontal>
                      <View>
                        <View style={[s.thead, { backgroundColor: '#334155' }]}>
                          <Text style={[s.th, { width: 30 }]}>#</Text>
                          <Text style={[s.th, { width: 80 }]}>کد مدل</Text>
                          <Text style={[s.th, { width: 130, textAlign: 'right' }]}>نام مدل</Text>
                          <Text style={[s.th, { width: 60 }]}>قفسه</Text>
                          <Text style={[s.th, { width: 60 }]}>تعداد</Text>
                          <Text style={[s.th, { width: 80 }]}>قیمت</Text>
                          <Text style={[s.th, { width: 90 }]}>جمع</Text>
                          <Text style={[s.th, { width: 90 }]}>پرداخت</Text>
                          <Text style={[s.th, { width: 100 }]}>بانک</Text>
                          <Text style={[s.th, { width: 90 }]}>تاریخ واریز</Text>
                          <Text style={[s.th, { width: 100 }]}>باربری</Text>
                        </View>
                        {(invoiceDetailRows || []).map((r: any, i: number) => (
                          <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                            <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                            <Text style={[s.td, { width: 80, fontSize: 9 }]}>{r.model_code || '—'}</Text>
                            <Text style={[s.td, { width: 130, fontSize: 9, textAlign: 'right' }]}>{r.model_name || '—'}</Text>
                            <Text style={[s.td, { width: 60, fontSize: 9 }]}>{r.shelf || '—'}</Text>
                            <Text style={[s.td, { width: 60, fontSize: 9 }]}>{toFaNum(Number(r.quantity) || 0)}</Text>
                            <Text style={[s.td, { width: 80, fontSize: 9 }]}>{fmt(Number(r.price_unit) || 0)}</Text>
                            <Text style={[s.td, { width: 90, fontSize: 9, fontWeight: 'bold' }]}>{fmt((Number(r.quantity) || 0) * (Number(r.price_unit) || 0))}</Text>
                            <Text style={[s.td, { width: 90, fontSize: 9 }]}>{fmt(Number(r.payment) || 0)}</Text>
                            <Text style={[s.td, { width: 100, fontSize: 9 }]}>{r.bank_name || r.receiver_bank || '—'}</Text>
                            <Text style={[s.td, { width: 90, fontSize: 9 }]}>{r.deposit_date ? displayDate(r.deposit_date) : '—'}</Text>
                            <Text style={[s.td, { width: 100, fontSize: 9 }]}>{r.shipping || '—'}</Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </>
              ) : partyViewMode === 'all' ? (
                <ScrollView horizontal>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 30 }]}>#</Text>
                      <Text style={[s.th, { width: 75 }]}>تاریخ</Text>
                      <Text style={[s.th, { width: 75 }]}>نوع</Text>
                      <Text style={[s.th, { width: 90 }]}>فاکتور</Text>
                      <Text style={[s.th, { width: 85 }]}>فاکتور دستی</Text>
                      <Text style={[s.th, { width: 60 }]}>کد مدل</Text>
                      <Text style={[s.th, { width: 120, textAlign: 'right' }]}>نام مدل</Text>
                      <Text style={[s.th, { width: 45 }]}>تعداد</Text>
                      <Text style={[s.th, { width: 65 }]}>قیمت</Text>
                      <Text style={[s.th, { width: 75 }]}>جمع ردیف</Text>
                      <Text style={[s.th, { width: 75 }]}>بدهکار</Text>
                      <Text style={[s.th, { width: 75 }]}>بستانکار</Text>
                      <Text style={[s.th, { width: 75 }]}>مانده</Text>
                      <Text style={[s.th, { width: 80 }]}>بانک</Text>
                      <Text style={[s.th, { width: 90 }]}>صاحب حساب</Text>
                      <Text style={[s.th, { width: 65 }]}>کد صاحب</Text>
                      <Text style={[s.th, { width: 90 }]}>تاریخ واریز</Text>
                      <Text style={[s.th, { width: 85 }]}>باربری</Text>
                      <Text style={[s.th, { width: 120, textAlign: 'right' }]}>شرح</Text>
                      <Text style={[s.th, { width: 70 }]}>عملیات</Text>
                    </View>
                    {filteredPartyDetails.map((t: any, i: number) => (
                      <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 75, fontSize: 9 }]}>{displayDate(t.date)}</Text>
                        <Text style={[s.td, { width: 75, color: TYPE_COLOR[t.type] || '#0f2438', fontWeight: 'bold', fontSize: 9 }]}>{TYPE_LABEL[t.type] || t.type}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9, color: '#7c3aed' }]}>{t.invoice || '—'}</Text>
                        <Text style={[s.td, { width: 85, fontSize: 9 }]}>{t.manualInvoice || '—'}</Text>
                        <Text style={[s.td, { width: 60, fontSize: 9 }]}>{t.modelCode || '—'}</Text>
                        <Text style={[s.td, { width: 120, fontSize: 9, textAlign: 'right' }]} numberOfLines={1}>{t.modelName || '—'}</Text>
                        <Text style={[s.td, { width: 45, fontSize: 9 }]}>{t.qty ? toFaNum(t.qty) : '—'}</Text>
                        <Text style={[s.td, { width: 65, fontSize: 9 }]}>{t.priceUnit ? fmt(t.priceUnit) : '—'}</Text>
                        <Text style={[s.td, { width: 75, fontSize: 9, fontWeight: 'bold' }]}>{t.lineTotal ? fmt(t.lineTotal) : '—'}</Text>
                        <Text style={[s.td, { width: 75, fontSize: 9, color: t.debit ? '#1e40af' : '#475569', fontWeight: 'bold' }]}>{t.debit ? fmt(t.debit) : '—'}</Text>
                        <Text style={[s.td, { width: 75, fontSize: 9, color: t.credit ? '#059669' : '#475569', fontWeight: 'bold' }]}>{t.credit ? fmt(t.credit) : '—'}</Text>
                        <Text style={[s.td, { width: 75, fontSize: 9, fontWeight: 'bold' }]}>{fmt(Math.abs(t.runningBalance || 0))}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9 }]}>{t.bank || '—'}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9 }]}>{t.holder || '—'}</Text>
                        <Text style={[s.td, { width: 65, fontSize: 9 }]}>{t.holderCode || '—'}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9 }]}>{t.depositDate ? displayDate(t.depositDate) : '—'}</Text>
                        <Text style={[s.td, { width: 85, fontSize: 9 }]}>{t.shipping || '—'}</Text>
                        <Text style={[s.td, { width: 120, fontSize: 9, textAlign: 'right' }]} numberOfLines={2}>{cleanDesc(t) || '—'}</Text>
                        <View style={{ width: 70, alignItems: 'center', justifyContent: 'center' }}>
                          {t.invoice && (t.type === 'sale' || t.type === 'purchase' || t.type === 'payment_received' || t.type === 'payment_sent' || t.type === 'triangular_received') ? (
                            <TouchableOpacity onPress={() => openInvoiceDetail({ invoice: t.invoice, type: (t.type === 'purchase' || t.type === 'payment_sent') ? 'purchase' : 'sales' })}>
                              <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 13 }}>👁️</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={{ color: '#94a3b8', fontSize: 10 }}>—</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  
                    <View style={[s.trow, { backgroundColor: '#e2e8f0', borderTopWidth: 2, borderTopColor: '#0f2438' }]}>
                      <Text style={[s.td, { width: 30 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                      <Text style={[s.td, { width: 75 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 85 }]}></Text>
                      <Text style={[s.td, { width: 60 }]}></Text>
                      <Text style={[s.td, { width: 120 }]}></Text>
                      <Text style={[s.td, { width: 45, fontWeight: 'bold', fontSize: 10 }]}>{toFaNum((filteredPartyDetails || []).reduce((a: number, t: any) => a + (Number(t.qty) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 65 }]}></Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>{fmt((filteredPartyDetails || []).reduce((a: number, t: any) => a + (Number(t.lineTotal) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10, color: '#1e40af' }]}>{fmt((filteredPartyDetails || []).reduce((a: number, t: any) => a + (Number(t.debit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10, color: '#059669' }]}>{fmt((filteredPartyDetails || []).reduce((a: number, t: any) => a + (Number(t.credit) || 0), 0))}</Text>
                      <Text style={[s.td, { width: 75, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs((filteredPartyDetails || []).reduce((a: number, t: any) => a + (Number(t.credit) || 0) - (Number(t.debit) || 0), 0)))}</Text>
                      <Text style={[s.td, { width: 80 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 65 }]}></Text>
                      <Text style={[s.td, { width: 90 }]}></Text>
                      <Text style={[s.td, { width: 85 }]}></Text>
                      <Text style={[s.td, { width: 120 }]}></Text>
                      <Text style={[s.td, { width: 70 }]}></Text>
                    </View></View>
                </ScrollView>
              ) : (selectedParty?.type === 'مشتری' ? partyViewMode === 'out' : partyViewMode === 'in') ? (
                <ScrollView horizontal>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 30 }]}>#</Text>
                      <Text style={[s.th, { width: 90 }]}>تاریخ</Text>
                      <Text style={[s.th, { width: 80 }]}>نوع</Text>
                      <Text style={[s.th, { width: 110 }]}>شماره فاکتور</Text>
                      <Text style={[s.th, { width: 80 }]}>تعداد</Text>
                      <Text style={[s.th, { width: 100 }]}>جمع</Text>
                      <Text style={[s.th, { width: 100 }]}>پرداخت</Text>
                      <Text style={[s.th, { width: 100 }]}>مانده</Text>
                      <Text style={[s.th, { width: 70 }]}>عملیات</Text>
                    </View>
                    {(invoiceList || []).map((inv: any, i: number) => (
                      <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9 }]}>{displayDate(inv.date)}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9, color: inv.type === 'purchase' ? '#ea580c' : '#059669', fontWeight: 'bold' }]}>{inv.type === 'purchase' ? 'خرید' : 'فروش'}</Text>
                        <Text style={[s.td, { width: 110, fontSize: 9, color: '#7c3aed' }]}>{inv.invoice}</Text>
                        <Text style={[s.td, { width: 80, fontSize: 9 }]}>{toFaNum(inv.count || 0)}</Text>
                        <Text style={[s.td, { width: 100, fontSize: 9, fontWeight: 'bold' }]}>{fmt(inv.total)}</Text>
                        <Text style={[s.td, { width: 100, fontSize: 9, color: '#059669' }]}>{fmt(inv.paid)}</Text>
                        <Text style={[s.td, { width: 100, fontSize: 9, fontWeight: 'bold' }]}>{fmt(Math.abs(inv.balance))}
                      </Text>
                        <TouchableOpacity onPress={() => openInvoiceDetail(inv)} style={{ width: 70, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 13 }}>👁️</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                      <View style={[s.trow, { backgroundColor: '#e2e8f0', borderTopWidth: 2, borderTopColor: '#0f2438' }]}>
                        <Text style={[s.td, { width: 30 }]}></Text>
                        <Text style={[s.td, { width: 90, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                        <Text style={[s.td, { width: 80 }]}></Text>
                        <Text style={[s.td, { width: 110 }]}></Text>
                        <Text style={[s.td, { width: 80, fontWeight: 'bold', fontSize: 10 }]}>{toFaNum((invoiceList || []).reduce((a: number, x: any) => a + (Number(x.count) || 0), 0))}</Text>
                        <Text style={[s.td, { width: 100, fontWeight: 'bold', fontSize: 10 }]}>{fmt((invoiceList || []).reduce((a: number, x: any) => a + (Number(x.total) || 0), 0))}</Text>
                        <Text style={[s.td, { width: 100, fontWeight: 'bold', fontSize: 10, color: '#059669' }]}>{fmt((invoiceList || []).reduce((a: number, x: any) => a + (Number(x.paid) || 0), 0))}</Text>
                        <Text style={[s.td, { width: 100, fontWeight: 'bold', fontSize: 10 }]}>{fmt(Math.abs((invoiceList || []).reduce((a: number, x: any) => a + (Number(x.balance) || 0), 0)))}</Text>
                        <Text style={[s.td, { width: 70 }]}></Text>
                      </View>
                  </View>
                </ScrollView>
              ) : (
                <ScrollView horizontal>
                  <View>
                    <View style={[s.thead, { backgroundColor: '#334155' }]}>
                      <Text style={[s.th, { width: 30 }]}>#</Text>
                      <Text style={[s.th, { width: 90 }]}>تاریخ</Text>
                      <Text style={[s.th, { width: 110 }]}>سند</Text>
                      <Text style={[s.th, { width: 180 }]}>شرح</Text>
                      <Text style={[s.th, { width: 110 }]}>مبلغ پرداخت</Text>
                      <Text style={[s.th, { width: 100 }]}>بانک</Text>
                      <Text style={[s.th, { width: 130 }]}>صاحب حساب</Text>
                      <Text style={[s.th, { width: 70 }]}>عملیات</Text>
                    </View>
                    {(buildPaymentsList(selectedParty) || []).map((t: any, i: number) => (
                      <View key={i} style={[s.trow, i % 2 === 0 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[s.td, { width: 30 }]}>{i + 1}</Text>
                        <Text style={[s.td, { width: 90, fontSize: 9 }]}>{displayDate(t.date)}</Text>
                        <Text style={[s.td, { width: 110, fontSize: 9, color: '#7c3aed' }]}>{t.invoice || '—'}</Text>
                        <Text style={[s.td, { width: 180, fontSize: 9, textAlign: 'right' }]} numberOfLines={2}>{cleanDesc(t) || '—'}</Text>
                        <Text style={[s.td, { width: 110, fontSize: 9, fontWeight: 'bold', color: '#059669' }]}>{fmt(Number(t.lineTotal) || Number(t.debit) || Number(t.credit) || 0)}</Text>
                        <Text style={[s.td, { width: 100, fontSize: 9 }]}>{t.bank || '—'}</Text>
                        <Text style={[s.td, { width: 130, fontSize: 9 }]} numberOfLines={1}>{t.holder || '—'}</Text>
                        <View style={{ width: 70, alignItems: 'center', justifyContent: 'center' }}>
                          {t.invoice ? (
                            <TouchableOpacity onPress={() => openInvoiceDetail({ invoice: t.invoice, type: (t.type === 'payment_sent' || t.type === 'purchase') ? 'purchase' : 'sales' })}>
                              <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 13 }}>👁️</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={{ color: '#94a3b8', fontSize: 10 }}>—</Text>
                          )}
                        </View>
                      </View>
                    ))}
                      <View style={[s.trow, { backgroundColor: '#e2e8f0', borderTopWidth: 2, borderTopColor: '#0f2438' }]}>
                        <Text style={[s.td, { width: 30 }]}></Text>
                        <Text style={[s.td, { width: 90, fontWeight: 'bold', fontSize: 10 }]}>جمع</Text>
                        <Text style={[s.td, { width: 110 }]}></Text>
                        <Text style={[s.td, { width: 180 }]}></Text>
                        <Text style={[s.td, { width: 110, fontWeight: 'bold', fontSize: 10, color: '#059669' }]}>{fmt((buildPaymentsList(selectedParty) || []).reduce((a: number, t: any) => a + (Number(t.lineTotal) || Number(t.debit) || Number(t.credit) || 0), 0))}</Text>
                        <Text style={[s.td, { width: 100 }]}></Text>
                        <Text style={[s.td, { width: 130 }]}></Text>
                        <Text style={[s.td, { width: 70 }]}></Text>
                      </View>
                      
                  </View>
                </ScrollView>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  thead: { flexDirection: 'row-reverse', backgroundColor: '#0f2438', paddingVertical: 8, width: '100%' },
  th: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 3 },
  trow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8, alignItems: 'center', width: '100%' },
  td: { fontSize: 10, color: '#0f2438', textAlign: 'center', paddingHorizontal: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 6 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '95%', width: '98%', alignSelf: 'center', overflow: 'hidden' },
  modalHead: { backgroundColor: '#0f2438', padding: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#d4af37', fontWeight: 'bold', fontSize: 14 },
  modalInfo: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  infoTxt: { fontSize: 11, color: '#1e3a5f', textAlign: 'right', marginVertical: 2 },
});
