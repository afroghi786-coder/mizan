const TABLES = [
  'sales','purchases','sales_returns','purchase_returns','expenses','employees','salary_payments','employee_loans',
  'attendance','employee_leaves','payroll_batches','parties','partners',
  'partner_transactions','partner_bank_accounts','products','settings','banks',
  'shippings','stock_adjustments','fx_hawalas','fx_boxes','fx_transfers','fx_checks','fx_customers','fx_partners','_deleted','_audit','audit_lock'
];

const TEXT_HEADERS = [
  'local_id','id','code','invoice','invoice_number','manual_invoice','batch_number',
  'employee_code','partner_code','source_id','phone','customer_phone','supplier_phone',
  'party_phone','payer_code','holder_code','account_holder_code','account_holder',
  'account_number','card_number','iban','receiver_code','receiver_account','receiver_acc'
,
  'holderCode','payerCode','accountHolderCode','receiverCode','customerCode','supplierCode','shipping','shipping_name'];

function isTextHeader(h) {
  return TEXT_HEADERS.indexOf(String(h || '').trim()) >= 0;
}

function applyTextFormats(sh, headers, startRow, numRows) {
  if (!numRows || numRows < 1) return;
  for (var j = 0; j < headers.length; j++) {
    if (isTextHeader(headers[j])) {
      sh.getRange(startRow, j + 1, numRows, 1).setNumberFormat('@');
    }
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const raw = (e && e.postData && e.postData.contents) || '{}';
    let body = {};
    try { body = JSON.parse(raw); } catch { body = {}; }
    const expectedKey = PropertiesService.getScriptProperties().getProperty('BRIDGE_KEY') || '';
    if (!expectedKey) return json({ ok: false, error: 'BRIDGE_KEY تنظیم نشده است' });
    if (String(body.key || '') !== expectedKey) return json({ ok: false, error: 'کلید امن نامعتبر است' });
    const action = String(body.action || '').trim();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureTabs(ss);
    if (action === 'ping') return json({ ok: true, action: 'ping', tabs: TABLES.length });
    if (action === 'pull') {
      const tables = {};
      for (const name of TABLES) {
        tables[name] = readTab(ss, name);
        if (name === 'parties') {
          const byPhone = {};
          const noPhone = [];
          for (const r of tables[name]) {
            const p = normPhone(r.phone);
            if (p) { if (!byPhone[p]) byPhone[p] = r; }
            else { noPhone.push(r); }
          }
          tables[name] = Object.values(byPhone).concat(noPhone);
        }
      }
      return json({ ok: true, tables: tables });
    }
    if (action === 'next-number') {
      const kind = String(body.kind || '').trim();
      if (kind !== 'sale' && kind !== 'purchase' && kind !== 'customer') return json({ ok: false, error: 'kind نامعتبر است' });
      const props = PropertiesService.getScriptProperties();
      const key = 'COUNTER_' + kind;
      const last = Number(props.getProperty(key) || '1000');
      const requested = Number(body.min || 1000);
      const base = Math.max(last, requested);
      const next = base + 1;
      props.setProperty(key, String(next));
      return json({ ok: true, kind: kind, next: next });
    }
    if (action === 'save') {
      const table = String(body.table || '').trim();
      if (!TABLES.includes(table)) return json({ ok: false, error: 'نام تب نامعتبر است' });
      const rows = Array.isArray(body.rows) ? body.rows : [];
      writeTab(ss, table, rows);
      return json({ ok: true, table: table, rows: rows.length });
    }
    if (action === 'dedup') {
      const table = String(body.table || '').trim();
      if (!TABLES.includes(table)) return json({ ok: false, error: 'table معتبر نیست' });
      const r = dedupSheet(ss, table);
      return json({ ok: true, table: table, removed: r.removed });
    }
    if (action === 'upsert') {
      const table = String(body.table || '').trim();
      if (!TABLES.includes(table)) return json({ ok: false, error: 'نام تب نامعتبر است' });
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const r = upsertRows(ss, table, rows);
      return json({ ok: true, table: table, added: r.added, updated: r.updated });
    }
    if (action === 'delete') {
      const table = String(body.table || '').trim();
      if (!TABLES.includes(table)) return json({ ok: false, error: 'نام تب نامعتبر است' });
      const keys = Array.isArray(body.keys) ? body.keys.map(String) : [];
      const r = deleteRowsByKeys(ss, table, keys);
      return json({ ok: true, table: table, deleted: r.deleted });
    }
    return json({ ok: false, error: 'action نامعتبر است' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch {}
  }
}

function ensureTabs(ss) {
  const existing = {};
  ss.getSheets().forEach(function(sh) { existing[sh.getName()] = true; });
  TABLES.forEach(function(name) { if (!existing[name]) ss.insertSheet(name); });
}

function readTab(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) row[String(headers[j])] = values[i][j];
    out.push(row);
  }
  return out;
}

function writeTab(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (!rows.length) return;
  const headers = [];
  rows.forEach(function(r) {
    Object.keys(r || {}).forEach(function(k) { if (headers.indexOf(k) < 0) headers.push(k); });
  });
  const values = [headers];
  rows.forEach(function(r) {
    values.push(headers.map(function(h) {
      const v = (r || {})[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    }));
  });
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  applyTextFormats(sh, headers, 2, Math.max(1, values.length - 1));
  sh.getRange(1, 1, values.length, headers.length).setValues(values);
}

const KEY_FIELDS = ['local_id','id','code','invoice','invoice_number','batch_number','employee_code','partner_code','source_id'];

function normPhone(ph) {
  let s = String(ph || '').replace(/[^0-9]/g, '');
  if (s.length === 10 && s[0] !== '0') s = '0' + s;
  return s;
}

function rowKeyOf(obj) {
  for (const f of KEY_FIELDS) {
    const v = obj[f];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
}


function getRowKey(name, obj) {
  return rowKeyOf(obj);
}

function upsertRows(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (!rows.length) return { added: 0, updated: 0 };

  const allValues = sh.getDataRange().getValues();
  let headers = allValues.length ? allValues[0].map(String) : [];

  const incomingKeys = new Set();
  rows.forEach(function(r) { Object.keys(r || {}).forEach(function(k) { incomingKeys.add(k); }); });
  let headersChanged = false;
  incomingKeys.forEach(function(k) { if (headers.indexOf(k) < 0) { headers.push(k); headersChanged = true; } });

  if (headersChanged || allValues.length === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  applyTextFormats(sh, headers, 2, Math.max(1, sh.getLastRow()));

  const dataValues = allValues.length > 1 ? allValues.slice(1) : [];
  const existing = {};
  for (let i = 0; i < dataValues.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = dataValues[i][j];
    const k = getRowKey(name, obj);
    if (k) existing[k] = { rowIndex: i + 2, obj: obj };
  }

  let phoneMap = {};
  if (name === 'parties') {
    for (const kk in existing) {
      const pp = normPhone(existing[kk].obj.phone);
      if (pp) phoneMap[pp] = kk;
    }
  }

  let added = 0, updated = 0;
  const appends = [];
  rows.forEach(function(r) {
    let k = getRowKey(name, r);
    if (!k) return;
    if (name === 'parties' && !existing[k]) {
      const pp = normPhone(r.phone);
      if (pp && phoneMap[pp]) k = phoneMap[pp];
    }
    if (existing[k]) {
      const rowIndex = existing[k].rowIndex;
      const rowValues = headers.map(function(h) {
        if (name === 'parties' && h === 'code' && existing[k].obj[h]) {
          return existing[k].obj[h];
        }
        const v = (r[h] !== undefined) ? r[h] : existing[k].obj[h];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      });
      applyTextFormats(sh, headers, rowIndex, 1);
      sh.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
      updated++;
    } else {
      appends.push(headers.map(function(h) {
        const v = r[h];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      }));
      added++;
      if (name === 'parties') {
        const pp = normPhone(r.phone);
        if (pp) phoneMap[pp] = k;
      }
    }
  });

  if (appends.length) {
    const startRow = sh.getLastRow() + 1;
    applyTextFormats(sh, headers, startRow, appends.length);
    sh.getRange(startRow, 1, appends.length, headers.length).setValues(appends);
  }
  return { added: added, updated: updated };
}

function deleteRowsByKeys(ss, name, keys) {
  const sh = ss.getSheetByName(name);
  if (!sh) return { deleted: 0 };
  const keySet = {};
  for (const k of keys) { const s = String(k || '').trim(); if (s) keySet[s] = true; }
  if (!Object.keys(keySet).length) return { deleted: 0 };
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { deleted: 0 };
  const headers = values[0].map(String);
  const fieldIdx = {};
  for (const f of KEY_FIELDS) {
    const idx = headers.indexOf(f);
    if (idx >= 0) fieldIdx[f] = idx;
  }
  const rowsToDelete = [];
  for (let i = 1; i < values.length; i++) {
    for (const f of Object.keys(fieldIdx)) {
      const v = String(values[i][fieldIdx[f]] || '').trim();
      if (v && keySet[v]) { rowsToDelete.push(i + 1); break; }
    }
  }
  let deleted = 0;
  for (let j = rowsToDelete.length - 1; j >= 0; j--) {
    sh.deleteRow(rowsToDelete[j]);
    deleted++;
  }
  return { deleted: deleted };
}

function dedupSheet(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return { removed: 0 };
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { removed: 0 };
  const headers = values[0].map(String);
  const phoneIdx = headers.indexOf('phone');
  const idIdx = headers.indexOf('local_id');
  if (phoneIdx === -1 || idIdx === -1) return { removed: 0 };

  const seen = {};
  const keepRows = [values[0]];
  let removed = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const key = normPhone(row[phoneIdx]) || ('id:' + row[idIdx]);
    if (!key) { keepRows.push(row); continue; }
    if (seen[key]) { removed++; continue; }
    seen[key] = true;
    keepRows.push(row);
  }
  if (removed > 0) {
    sh.clearContents();
    sh.getRange(1, 1, keepRows.length, headers.length).setValues(keepRows);
    applyTextFormats(sh, headers, 2, Math.max(1, keepRows.length - 1));
  }
  return { removed: removed };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}