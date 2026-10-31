import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, TextInput, Linking, Modal, ScrollView } from 'react-native';
import AsyncStorage from './lib.storage';
import { clearAuditEvents } from './lib.offline';
import {
  getPrivateConnection, startPrivateOAuth, syncPrivateTables, disconnectPrivate,
  getSyncDestination, setSyncDestination, SyncDestination, pullPrivateTables,
  getBridgeConfig, setBridgeConfig, bridgePing, bridgePull, bridgeSaveTest, bridgeSaveTable, bridgeSaveAll, pullBridgeTables, syncBridgeTables, getConflicts, clearConflicts, applyConflictSheet, keepLocalConflict, getAuditEvents, clearAuditInSheet
} from './lib.sheets';

const SHOW_PRIVATE_STORAGE = true;

const BRIDGE_CODE = "const TABLES = [\n  'sales','purchases','expenses','employees','salary_payments','employee_loans',\n  'attendance','employee_leaves','payroll_batches','parties','partners',\n  'partner_transactions','partner_bank_accounts','products','settings','banks',\n  'shippings','stock_adjustments','_deleted','_audit'\n];\n\nfunction doPost(e) {\n  const lock = LockService.getScriptLock();\n  try {\n    lock.waitLock(15000);\n    const raw = (e && e.postData && e.postData.contents) || '{}';\n    let body = {};\n    try { body = JSON.parse(raw); } catch { body = {}; }\n    const expectedKey = PropertiesService.getScriptProperties().getProperty('BRIDGE_KEY') || '';\n    if (!expectedKey) return json({ ok: false, error: 'BRIDGE_KEY تنظیم نشده است' });\n    if (String(body.key || '') !== expectedKey) return json({ ok: false, error: 'کلید امن نامعتبر است' });\n    const action = String(body.action || '').trim();\n    const ss = SpreadsheetApp.getActiveSpreadsheet();\n    ensureTabs(ss);\n    if (action === 'ping') return json({ ok: true, action: 'ping', tabs: TABLES.length });\n    if (action === 'pull') {\n      const tables = {};\n      for (const name of TABLES) tables[name] = readTab(ss, name);\n      return json({ ok: true, tables: tables });\n    }\n    if (action === 'save') {\n      const table = String(body.table || '').trim();\n      if (!TABLES.includes(table)) return json({ ok: false, error: 'نام تب نامعتبر است' });\n      const rows = Array.isArray(body.rows) ? body.rows : [];\n      writeTab(ss, table, rows);\n      return json({ ok: true, table: table, rows: rows.length });\n    }\n    if (action === 'upsert') {\n      const table = String(body.table || '').trim();\n      if (!TABLES.includes(table)) return json({ ok: false, error: 'نام تب نامعتبر است' });\n      const rows = Array.isArray(body.rows) ? body.rows : [];\n      const r = upsertRows(ss, table, rows);\n      return json({ ok: true, table: table, added: r.added, updated: r.updated });\n    }\n    return json({ ok: false, error: 'action نامعتبر است' });\n  } catch (err) {\n    return json({ ok: false, error: String(err && err.message ? err.message : err) });\n  } finally {\n    try { lock.releaseLock(); } catch {}\n  }\n}\n\nfunction ensureTabs(ss) {\n  const existing = {};\n  ss.getSheets().forEach(function(sh) { existing[sh.getName()] = true; });\n  TABLES.forEach(function(name) { if (!existing[name]) ss.insertSheet(name); });\n}\n\nfunction readTab(ss, name) {\n  const sh = ss.getSheetByName(name);\n  if (!sh) return [];\n  const values = sh.getDataRange().getValues();\n  if (values.length < 2) return [];\n  const headers = values[0];\n  const out = [];\n  for (let i = 1; i < values.length; i++) {\n    const row = {};\n    for (let j = 0; j < headers.length; j++) row[String(headers[j])] = values[i][j];\n    out.push(row);\n  }\n  return out;\n}\n\nfunction writeTab(ss, name, rows) {\n  const sh = ss.getSheetByName(name) || ss.insertSheet(name);\n  sh.clearContents();\n  if (!rows.length) return;\n  const headers = [];\n  rows.forEach(function(r) {\n    Object.keys(r || {}).forEach(function(k) { if (headers.indexOf(k) < 0) headers.push(k); });\n  });\n  const values = [headers];\n  rows.forEach(function(r) {\n    values.push(headers.map(function(h) {\n      const v = (r || {})[h];\n      if (v === null || v === undefined) return '';\n      if (typeof v === 'object') return JSON.stringify(v);\n      return v;\n    }));\n  });\n  sh.getRange(1, 1, values.length, headers.length).setValues(values);\n}\n\nconst KEY_FIELDS = ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id'];\n\nfunction rowKeyOf(obj) {\n  for (const f of KEY_FIELDS) {\n    const v = obj[f];\n    if (v !== undefined && v !== null && v !== '') return String(v);\n  }\n  return '';\n}\n\nfunction upsertRows(ss, name, rows) {\n  const sh = ss.getSheetByName(name) || ss.insertSheet(name);\n  if (!rows.length) return { added: 0, updated: 0 };\n\n  const allValues = sh.getDataRange().getValues();\n  let headers = allValues.length ? allValues[0].map(String) : [];\n\n  const incomingKeys = new Set();\n  rows.forEach(function(r) { Object.keys(r || {}).forEach(function(k) { incomingKeys.add(k); }); });\n  let headersChanged = false;\n  incomingKeys.forEach(function(k) { if (headers.indexOf(k) < 0) { headers.push(k); headersChanged = true; } });\n\n  if (headersChanged || allValues.length === 0) {\n    sh.getRange(1, 1, 1, headers.length).setValues([headers]);\n  }\n\n  const dataValues = allValues.length > 1 ? allValues.slice(1) : [];\n  const existing = {};\n  for (let i = 0; i < dataValues.length; i++) {\n    const obj = {};\n    for (let j = 0; j < headers.length; j++) obj[headers[j]] = dataValues[i][j];\n    const k = rowKeyOf(obj);\n    if (k) existing[k] = { rowIndex: i + 2, obj: obj };\n  }\n\n  let added = 0, updated = 0;\n  const appends = [];\n  rows.forEach(function(r) {\n    const k = rowKeyOf(r);\n    if (!k) return;\n    if (existing[k]) {\n      const rowIndex = existing[k].rowIndex;\n      const rowValues = headers.map(function(h) {\n        const v = (r[h] !== undefined) ? r[h] : existing[k].obj[h];\n        if (v === null || v === undefined) return '';\n        if (typeof v === 'object') return JSON.stringify(v);\n        return v;\n      });\n      sh.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);\n      updated++;\n    } else {\n      appends.push(headers.map(function(h) {\n        const v = r[h];\n        if (v === null || v === undefined) return '';\n        if (typeof v === 'object') return JSON.stringify(v);\n        return v;\n      }));\n      added++;\n    }\n  });\n\n  if (appends.length) {\n    const startRow = sh.getLastRow() + 1;\n    sh.getRange(startRow, 1, appends.length, headers.length).setValues(appends);\n  }\n  return { added: added, updated: updated };\n}\n\nfunction json(obj) {\n  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);\n}";
const BRIDGE_TEMPLATE_URL = 'لینک_گوگل_داک_را_اینجا_بگذار';

export default function SettingsSheets({ showToast }: any) {
  if (!SHOW_PRIVATE_STORAGE) return null;
  if (Platform.OS !== 'web') return null;

  const [conn, setConn] = useState<any>(null);
  const [dest, setDest] = useState<SyncDestination>('server');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState('');
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [bridgeKey, setBridgeKey] = useState('');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditModal, setAuditModal] = useState(false);
  const [conflictModal, setConflictModal] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeSuggestedKey, setBridgeSuggestedKey] = useState('');
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeTesting, setBridgeTesting] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('');
  const [bridgePullBusy, setBridgePullBusy] = useState(false);
  const [bridgePullStatus, setBridgePullStatus] = useState('');
  const [bridgeSaveBusy, setBridgeSaveBusy] = useState(false);
  const [bridgeSaveStatus, setBridgeSaveStatus] = useState('');
  const [bridgePartiesBusy, setBridgePartiesBusy] = useState(false);
  const [bridgePartiesStatus, setBridgePartiesStatus] = useState('');
  const [bridgeAllBusy, setBridgeAllBusy] = useState(false);
  const [bridgeAllStatus, setBridgeAllStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setConn(await getPrivateConnection());
      setDest(await getSyncDestination());
      try { setConflicts(await getConflicts()); } catch {}
      try { setAuditEvents(await getAuditEvents()); } catch {}
      let k = await AsyncStorage.getItem('@mizan_bridge_key_suggest');
      if (!k) {
        k = genBridgeKey();
        await AsyncStorage.setItem('@mizan_bridge_key_suggest', k);
      }
      setBridgeSuggestedKey(k);
      const b = await getBridgeConfig();
      setBridgeUrl(b.url || '');
      setBridgeKey(b.key || '');
      setBridgeReady(!!(b.url && b.key));
    } catch (e: any) { showToast?.(e.message, true); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const chooseDest = async (v: SyncDestination) => {
    setDest(v);
    await setSyncDestination(v);
    showToast?.('مقصد ذخیره تغییر کرد');
  };

  const connect = async () => {
    setBusy(true);
    try {
      await startPrivateOAuth();
      showToast?.('پس از تأیید، دوباره این صفحه را باز کنید');
    } catch (e: any) { showToast?.(e.message, true); }
    finally { setBusy(false); }
  };

  const sync = async () => {
    setBusy(true); setProgress('در حال آماده‌سازی...');
    try {
      if (bridgeReady) {
        await syncBridgeTables((d, t, tab) => setProgress('ذخیره ' + tab + ' (' + d + '/' + t + ')'));
      } else {
        await syncPrivateTables((d, t, tab) => setProgress('ذخیره ' + tab + ' (' + d + '/' + t + ')'));
      }
      showToast?.('✅ ذخیره در فضای اختصاصی انجام شد');
      await load();
    } catch (e: any) { showToast?.(e.message, true); }
    finally { setBusy(false); setProgress(''); }
  };;

  const pull = async () => {
    setPulling(true); setProgress('در حال دریافت...');
    try {
      const r = bridgeReady
        ? await pullBridgeTables((d, t, tab) => setProgress('دریافت ' + tab + ' (' + d + '/' + t + ')'))
        : await pullPrivateTables((d, t, tab) => setProgress('دریافت ' + tab + ' (' + d + '/' + t + ')'));
      showToast?.('✅ ' + r.added + ' رکورد جدید از فضای اختصاصی دریافت شد');
      await load();
    } catch (e: any) { showToast?.(e.message, true); }
    finally { setPulling(false); setProgress(''); }
  };;

  const disconnect = async () => {
    setBusy(true);
    try {
      if (bridgeReady) {
        await setBridgeConfig('', '');
        setBridgeUrl('');
        setBridgeKey('');
        setBridgeReady(false);
        showToast?.('اتصال واسط امن قطع شد');
      } else {
        await disconnectPrivate();
        setConn(null);
        showToast?.('اتصال فضای اختصاصی قطع شد');
      }
    } catch (e: any) { showToast?.(e.message, true); }
    finally { setBusy(false); }
  };;

  const saveBridge = async () => {
    setBridgeBusy(true);
    try {
      await setBridgeConfig(bridgeUrl.trim(), bridgeKey.trim());
      showToast?.('✅ تنظیمات واسط امن ذخیره شد');
    } catch (e: any) { showToast?.(e.message, true); }
    finally { setBridgeBusy(false); }
  };

  const testBridge = async () => {
    setBridgeTesting(true);
    setBridgeStatus('');
    try {
      await setBridgeConfig(bridgeUrl.trim(), bridgeKey.trim());
      await bridgePing();
      setBridgeStatus('✅ اتصال به واسط امن برقرار است');
      showToast?.('✅ اتصال به واسط امن برقرار است');
    } catch (e: any) {
      setBridgeStatus('❌ ' + (e?.message || 'خطا در اتصال'));
      showToast?.(e?.message || 'خطا در اتصال', true);
    } finally { setBridgeTesting(false); }
  };

  const testBridgePull = async () => {
    setBridgePullBusy(true);
    setBridgePullStatus('');
    try {
      await setBridgeConfig(bridgeUrl.trim(), bridgeKey.trim());
      const r = await bridgePull();
      const tables = r?.tables || {};
      let total = 0;
      const names = Object.keys(tables);
      for (const n of names) total += Array.isArray(tables[n]) ? tables[n].length : 0;
      setBridgePullStatus('✅ ' + names.length + ' تب — ' + total + ' ردیف خوانده شد');
      showToast?.('✅ دریافت از واسط انجام شد');
    } catch (e: any) {
      setBridgePullStatus('❌ ' + (e?.message || 'خطا در دریافت'));
      showToast?.(e?.message || 'خطا در دریافت', true);
    } finally { setBridgePullBusy(false); }
  };

  const testBridgeSave = async () => {
    setBridgeSaveBusy(true);
    setBridgeSaveStatus('');
    try {
      await setBridgeConfig(bridgeUrl.trim(), bridgeKey.trim());
      const r = await bridgeSaveTest();
      const pr = await bridgePull();
      const rows = (pr?.tables && pr.tables._bridge_test) || [];
      setBridgeSaveStatus('✅ ذخیره شد — ' + rows.length + ' ردیف در تب تست');
      showToast?.('✅ تست ذخیره در واسط انجام شد');
    } catch (e: any) {
      setBridgeSaveStatus('❌ ' + (e?.message || 'خطا در ذخیره'));
      showToast?.(e?.message || 'خطا در ذخیره', true);
    } finally { setBridgeSaveBusy(false); }
  };

  const testBridgeParties = async () => {
    setBridgePartiesBusy(true);
    setBridgePartiesStatus('');
    try {
      await setBridgeConfig(bridgeUrl.trim(), bridgeKey.trim());
      const raw = await (await import('./lib.storage')).default.getItem('@mizan_local_parties');
      let rows: any[] = [];
      try { rows = raw ? JSON.parse(raw) : []; } catch { rows = []; }
      if (!Array.isArray(rows)) rows = [];
      await bridgeSaveTable('parties', rows);
      const pr = await bridgePull();
      const back = (pr?.tables && pr.tables.parties) || [];
      setBridgePartiesStatus('✅ ' + rows.length + ' طرف‌حساب ذخیره شد — ' + back.length + ' ردیف برگشت');
      showToast?.('✅ تست طرف‌حساب‌ها انجام شد');
    } catch (e: any) {
      setBridgePartiesStatus('❌ ' + (e?.message || 'خطا در تست'));
      showToast?.(e?.message || 'خطا در تست', true);
    } finally { setBridgePartiesBusy(false); }
  };

  const testBridgeAll = async () => {
    setBridgeAllBusy(true);
    setBridgeAllStatus('');
    try {
      await setBridgeConfig(bridgeUrl.trim(), bridgeKey.trim());
      const saveRes = await bridgeSaveAll();
      const pr = await bridgePull();
      const tables = pr?.tables || {};
      let totalSaved = 0;
      for (const it of (saveRes?.summary || [])) totalSaved += Number(it.rows) || 0;
      let totalBack = 0;
      const names = Object.keys(tables);
      for (const n of names) totalBack += Array.isArray(tables[n]) ? tables[n].length : 0;
      setBridgeAllStatus('✅ ' + (saveRes?.summary?.length || 0) + ' تب ذخیره شد — ' + totalSaved + ' ردیف ارسال — ' + totalBack + ' ردیف برگشت');
      showToast?.('✅ تست همه جدول‌ها انجام شد');
    } catch (e: any) {
      setBridgeAllStatus('❌ ' + (e?.message || 'خطا در تست همه'));
      showToast?.(e?.message || 'خطا در تست همه', true);
    } finally { setBridgeAllBusy(false); }
  };

  const openBridgeTemplate = async () => {
    if (!BRIDGE_TEMPLATE_URL) {
      showToast?.('لینک قالب هنوز تنظیم نشده است');
      return;
    }
    try {
      if (Platform.OS === 'web') window.open(BRIDGE_TEMPLATE_URL, '_blank');
      else await Linking.openURL(BRIDGE_TEMPLATE_URL);
    } catch (e: any) { showToast?.(e?.message || 'خطا در باز کردن قالب', true); }
  };

  const copyText = async (txt: string, okMsg: string) => {
    try {
      if (Platform.OS === 'web') await navigator.clipboard.writeText(txt);
      showToast?.(okMsg);
    } catch { showToast?.('خطا در کپی', true); }
  };
  const copyBridgeCode = () => copyText(BRIDGE_CODE, '✅ کد واسط کپی شد');
  const copyBridgeKey = () => copyText(bridgeSuggestedKey, '✅ کلید تصادفی کپی شد');
  const openNewSheet = () => {
    if (Platform.OS !== 'web') return;
    const already = !!(bridgeUrl || bridgeKey);
    if (already) {
      const ok = window.confirm(
        'شما از قبل به یک شیت وصل هستید.\n' +
        'اگر شیت جدید بسازید، میزان به شیت جدید وصل می‌شود و شیت قبلی استفاده نمی‌شود.\n\n' +
        'آیا مطمئن هستید؟'
      );
      if (!ok) return;
    }
    window.open('https://sheets.new', '_blank');
  };
  const openAppsScript = () => { if (Platform.OS === 'web') window.open('https://script.google.com/home', '_blank'); };

  const genBridgeKey = () => {
    try {
      if (Platform.OS === 'web' && typeof crypto !== 'undefined' && crypto.randomUUID) {
        return 'mizan_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
      }
    } catch {}
    return 'mizan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  };

  const makeBridgeKey = async () => {
    const k = genBridgeKey();
    setBridgeSuggestedKey(k);
    await AsyncStorage.setItem('@mizan_bridge_key_suggest', k);
    showToast?.('✅ کلید تصادفی ساخته شد');
  };

  const copyKeyAndOpenScript = async () => {
    try {
      if (Platform.OS === 'web') {
        if (bridgeSuggestedKey) await navigator.clipboard.writeText(bridgeSuggestedKey);
        window.open('https://script.google.com/home', '_blank');
      }
      showToast?.('کلید کپی شد — در Script Properties با نام BRIDGE_KEY بگذارید');
    } catch { showToast?.('خطا در کپی یا باز کردن Apps Script', true); }
  };

  const doClearConflicts = async () => {
    try {
      await clearConflicts();
      setConflicts([]);
      showToast?.('✅ گزارش تضاد پاک شد');
    } catch (e: any) { showToast?.(e?.message || 'خطا در پاک کردن', true); }
  };

  const onApplyConflict = async (i: number) => {
    try {
      const ok = await applyConflictSheet(i);
      if (!ok) { showToast?.('اعمال نسخه شیت ممکن نشد', true); return; }
      setConflicts(await getConflicts());
      showToast?.('✅ نسخه شیت اعمال شد');
    } catch (e: any) { showToast?.(e?.message || 'خطا در اعمال', true); }
  };

  const onKeepLocal = async (i: number) => {
    try {
      const ok = await keepLocalConflict(i);
      if (!ok) { showToast?.('نگه داشتن نسخه محلی ممکن نشد', true); return; }
      setConflicts(await getConflicts());
      showToast?.('✅ نسخه محلی نگه داشته شد');
    } catch (e: any) { showToast?.(e?.message || 'خطا', true); }
  };

  const doClearAudit = async () => {
    try {
      await clearAuditEvents();
      setAuditEvents([]);
      showToast?.('✅ تاریخچه تعدیلات پاک شد');
    } catch (e: any) { showToast?.(e?.message || 'خطا در پاک کردن', true); }
  };

  const openAuditModal = async () => {
    try { setAuditEvents(await getAuditEvents()); } catch {}
    setAuditModal(true);
  };

  const openConflictModal = async () => {
    try { setConflicts(await getConflicts()); } catch {}
    setConflictModal(true);
  };

  return (
    <View style={{ marginTop: 16, marginBottom: 16, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' }}>
      <Text style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>☁️ فضای اختصاصی</Text>
      <Text style={{ fontSize: 11, color: '#475569', textAlign: 'right', marginBottom: 10 }}>
        داده‌های شما در فضای امن اختصاصی خودتان ذخیره می‌شود. هیچ داده‌ای در سرور مرکزی نگه‌داری نمی‌شود.
      </Text>

      <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>مقصد ذخیره هنگام سینک</Text>
      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { k: 'server', l: 'سرور مرکزی' },
          { k: 'private', l: 'فضای اختصاصی' },
          { k: 'both', l: 'هر دو' },
        ].map((x: any) => (
          <TouchableOpacity key={x.k} onPress={() => chooseDest(x.k)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: dest === x.k ? '#7c3aed' : '#e2e8f0' }}>
            <Text style={{ color: dest === x.k ? '#fff' : '#475569', fontSize: 11, fontWeight: 'bold' }}>{x.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (conn || bridgeReady) ? (
        <>
          <Text style={{ fontSize: 12, color: '#059669', textAlign: 'right', marginBottom: 6 }}>
            {bridgeReady ? '✅ واسط امن متصل' : '✅ متصل' + (conn?.email ? ' — ' + conn.email : '')}
          </Text>
          <TouchableOpacity disabled={busy} onPress={sync} style={{ backgroundColor: busy ? '#94a3b8' : '#059669', padding: 10, borderRadius: 6, marginBottom: 8 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
              {busy ? '⏳ در حال ذخیره...' : '📥 ذخیره الآن در فضای اختصاصی'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={pulling} onPress={pull} style={{ backgroundColor: pulling ? '#94a3b8' : '#0ea5e9', padding: 10, borderRadius: 6, marginBottom: 8 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
              {pulling ? '⏳ در حال دریافت...' : '📤 دریافت از فضای اختصاصی'}
            </Text>
          </TouchableOpacity>
          {progress ? <Text style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 8 }}>{progress}</Text> : null}
          <TouchableOpacity disabled={busy} onPress={disconnect} style={{ backgroundColor: '#64748b', padding: 8, borderRadius: 6 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{bridgeReady ? 'قطع واسط امن' : 'قطع اتصال فضای اختصاصی'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={{ fontSize: 11, color: '#92400e', textAlign: 'right', marginBottom: 6 }}>
          برای اتصال، از ویزارد راه‌اندازی واسط امن در پایین استفاده کنید.
        </Text>
      )}

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>🔐 واسط امن</Text>
        <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 8 }}>
          این بخش اختیاری است. اگر واسط امن را راه‌اندازی کرده‌اید، آدرس و کلید را اینجا وارد کنید.
        </Text>
        <TextInput
          value={bridgeUrl}
          onChangeText={setBridgeUrl}
          placeholder="آدرس واسط"
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 6, textAlign: 'left', backgroundColor: '#fff' }}
        />
        <TextInput
          value={bridgeKey}
          onChangeText={setBridgeKey}
          placeholder="کلید امن"
          autoCapitalize="none"
          secureTextEntry
          style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, marginBottom: 8, textAlign: 'left', backgroundColor: '#fff' }}
        />
        <TouchableOpacity disabled={bridgeBusy} onPress={saveBridge} style={{ backgroundColor: bridgeBusy ? '#94a3b8' : '#0891b2', padding: 8, borderRadius: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
            {bridgeBusy ? '⏳...' : 'ذخیره تنظیمات واسط امن'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={bridgeTesting} onPress={testBridge} style={{ backgroundColor: bridgeTesting ? '#94a3b8' : '#7c3aed', padding: 8, borderRadius: 6, marginTop: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
            {bridgeTesting ? '⏳ در حال تست...' : '🔌 تست اتصال واسط'}
          </Text>
        </TouchableOpacity>
        
        
        
        
        
        
        
        
        {bridgeStatus ? <Text style={{ fontSize: 11, color: bridgeStatus.startsWith('✅') ? '#059669' : '#dc2626', textAlign: 'center', marginTop: 6 }}>{bridgeStatus}</Text> : null}
      </View>

        <TouchableOpacity onPress={openBridgeTemplate} style={{ backgroundColor: '#f59e0b', padding: 8, borderRadius: 6, marginTop: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🚀 راه‌اندازی واسط امن</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 4 }}>
          این دکمه شما را به قالب آماده هدایت می‌کند. یک بار کپی و Deploy کافی است.
        </Text>

      <View style={{ marginTop: 10, padding: 8, backgroundColor: '#fffbeb', borderRadius: 6, borderWidth: 1, borderColor: '#fcd34d' }}>
        <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>🚀 ویزارد راه‌اندازی</Text>
        <Text style={{ fontSize: 10, color: '#92400e', textAlign: 'right', marginBottom: 8 }}>
          ۱) شیت جدید بساز ۲) در همان شیت Extensions → Apps Script را بزن ۳) کد را پیست کن ۴) کلید را در Script Properties بگذار ۵) Deploy کن ۶) آدرس /exec را اینجا وارد کن.
        </Text>
        <TouchableOpacity onPress={openNewSheet} style={{ backgroundColor: '#059669', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🆕 ساخت شیت جدید</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={copyBridgeCode} style={{ backgroundColor: '#7c3aed', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📋 کپی کد واسط</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={makeBridgeKey} style={{ backgroundColor: '#475569', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🎲 ساخت کلید تصادفی</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginBottom: 6 }}>{bridgeSuggestedKey || 'کلیدی ساخته نشده'}</Text>
        <TouchableOpacity onPress={copyBridgeKey} style={{ backgroundColor: '#0891b2', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📋 کپی کلید تصادفی</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 10, color: '#92400e', textAlign: 'right', marginTop: 4, marginBottom: 4 }}>
          مرحله ۴: در Apps Script → Project Settings → Script Properties، یک مورد با نام BRIDGE_KEY بسازید و کلید کپی‌شده را در Value بگذارید.
        </Text>
        <TouchableOpacity onPress={copyKeyAndOpenScript} style={{ backgroundColor: '#be123c', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>📋 کپی کلید و باز کردن Apps Script</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openAppsScript} style={{ backgroundColor: '#f59e0b', padding: 8, borderRadius: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🧩 باز کردن Apps Script</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>🚨 گزارش تضاد</Text>
        <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 8 }}>
          اگر چند دستگاه یک رکورد را هم‌زمان ویرایش کنند، نسخه بازنده اینجا نگه داشته می‌شود.
        </Text>
        <Text style={{ fontSize: 12, color: conflicts.length ? '#dc2626' : '#059669', textAlign: 'right', marginBottom: 8 }}>
          {conflicts.length ? conflicts.length + ' تضاد ثبت‌شده' : 'هیچ تضادی ثبت نشده'}
        </Text>
        <TouchableOpacity onPress={openConflictModal} style={{ backgroundColor: '#7c3aed', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>👁️ مشاهده گزارش تضاد</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={doClearConflicts} disabled={!conflicts.length} style={{ backgroundColor: conflicts.length ? '#dc2626' : '#94a3b8', padding: 8, borderRadius: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🗑️ پاک کردن گزارش</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={conflictModal} transparent animationType="slide" onRequestClose={() => setConflictModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 }}>🚨 گزارش تضاد</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {conflicts.length === 0 && (
                <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>هیچ تضادی ثبت نشده</Text>
              )}
              {conflicts.map((c: any, i: number) => (
                <View key={i} style={{ padding: 10, marginBottom: 6, borderRadius: 8, backgroundColor: c.resolved ? '#ecfdf5' : '#fef3c7', borderWidth: 1, borderColor: c.resolved ? '#10b981' : '#f59e0b' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#0f2438' }}>{c.table} — {c.key}</Text>
                  <Text style={{ fontSize: 10, textAlign: 'right', color: '#64748b', marginTop: 2 }}>{c.at}</Text>
                  <Text style={{ fontSize: 10, textAlign: 'right', color: '#334155', marginTop: 4 }}>
                    نسخه محلی: {c.local ? (c.local.updated_at || c.local.updatedAt || '—') : '—'}
                  </Text>
                  <Text style={{ fontSize: 10, textAlign: 'right', color: '#334155' }}>
                    نسخه شیت: {c.sheet ? (c.sheet.updated_at || c.sheet.updatedAt || '—') : '—'}
                  </Text>
                  {c.resolved ? (
                    <Text style={{ fontSize: 10, textAlign: 'right', color: '#059669', marginTop: 6 }}>✅ حل شد</Text>
                  ) : (
                    <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
                      <TouchableOpacity onPress={() => onKeepLocal(i)} style={{ flex: 1, backgroundColor: '#64748b', paddingVertical: 8, borderRadius: 6 }}>
                        <Text style={{ color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>📌 نگه داشتن محلی</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onApplyConflict(i)} style={{ flex: 1, backgroundColor: '#059669', paddingVertical: 8, borderRadius: 6 }}>
                        <Text style={{ color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>✅ اعمال نسخه شیت</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setConflictModal(false)} style={{ backgroundColor: '#64748b', padding: 10, borderRadius: 8, marginTop: 10 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>📜 تاریخچه تعدیلات</Text>
        <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginBottom: 8 }}>
          هر ویرایش فاکتور فروش و خرید با خلاصه تغییرات اینجا ثبت می‌شود.
        </Text>
        <Text style={{ fontSize: 12, color: auditEvents.length ? '#0ea5e9' : '#64748b', textAlign: 'right', marginBottom: 8 }}>
          {auditEvents.length ? auditEvents.length + ' رویداد ثبت‌شده' : 'هیچ رویدادی ثبت نشده'}
        </Text>
        <TouchableOpacity onPress={openAuditModal} style={{ backgroundColor: '#0ea5e9', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>👁️ مشاهده تاریخچه</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={doClearAudit} disabled={!auditEvents.length} style={{ backgroundColor: auditEvents.length ? '#dc2626' : '#94a3b8', padding: 8, borderRadius: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>🗑️ پاک کردن تاریخچه</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={auditModal} transparent animationType="slide" onRequestClose={() => setAuditModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 }}>📜 تاریخچه تعدیلات</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {auditEvents.length === 0 && (
                <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>هیچ رویدادی ثبت نشده</Text>
              )}
              {auditEvents.slice().reverse().map((ev: any, i: number) => (
                <View key={i} style={{ padding: 10, marginBottom: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#0f2438' }}>
                    {ev.table === 'sales' ? 'فروش' : ev.table === 'purchases' ? 'خرید' : ev.table} — {ev.key}
                  </Text>
                  <Text style={{ fontSize: 10, textAlign: 'right', color: '#64748b', marginTop: 2 }}>{ev.at}</Text>
                  <Text style={{ fontSize: 10, textAlign: 'right', color: '#334155', marginTop: 4 }}>{ev.summary}</Text>
                  {ev.diff ? (
                    <Text style={{ fontSize: 10, textAlign: 'right', color: '#475569', marginTop: 2 }}>
                      +{ev.diff.added?.length || 0} / -{ev.diff.removed?.length || 0} / ±{ev.diff.changed?.length || 0}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 9, textAlign: 'right', color: '#94a3b8', marginTop: 2 }}>دستگاه: {ev.device_id || '—'}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setAuditModal(false)} style={{ backgroundColor: '#64748b', padding: 10, borderRadius: 8, marginTop: 10 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
