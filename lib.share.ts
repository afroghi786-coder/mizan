import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { captureRef } from 'react-native-view-shot';
import { currencyLabelByCode, getCurrencySync } from './lib.currency';

export function mizanStandardCss() {
  return [
    '@page{size:A4;margin:10mm}',
    'body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#0f2438;font-size:11px;margin:0;padding:0}',
    '.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #d4af37;padding-bottom:8px;margin-bottom:10px}',
    '.brand-title{font-size:20px;font-weight:bold;color:#0f2438}',
    '.brand-slogan{font-size:9px;color:#64748b}',
    '.meta{font-size:9px;color:#64748b;text-align:left}',
    'h2{text-align:center;font-size:15px;margin:8px 0}',
    '.info{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;margin:8px 0}',
    'table{width:100%;border-collapse:collapse;font-size:10px;margin-top:6px}',
    'th{background:#0f2438;color:#fff;padding:5px;border:1px solid #334155}',
    'td{border:1px solid #cbd5e1;padding:4px 5px;text-align:center}',
    'tr:nth-child(even) td{background:#f8fafc}',
    '.total{font-weight:bold;background:#fffbeb}',
    '.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px;font-size:9px}','.sign-box{border-top:1px dashed #94a3b8;padding-top:3px;text-align:center;min-height:40px}','.net-words{background:#f0fdf4;border:1px dashed #059669;font-size:10px;text-align:center;padding:5px;margin-top:6px;font-weight:bold}','.computer-note{text-align:center;font-size:7.5px;color:#94a3b8;margin-top:6px;font-style:italic}','.footer{margin-top:10px;font-size:8px;color:#94a3b8;text-align:center}'
  ].join('');
}

export function mizanBrandHeaderHtml(subtitle) {
  return '<div class="brand"><div><div class="brand-title">⚖️ میزان</div><div class="brand-slogan">حساب‌ها دقیق، معاملات امن، ذهن آسوده.</div></div><div class="meta">' + (subtitle || '') + '</div></div>';
}

export function buildStandardHtml(title, body, subtitle) {
  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>' + mizanStandardCss() + '</style></head><body>' + mizanBrandHeaderHtml(subtitle) + '<h2>' + title + '</h2>' + body + '<div class="footer">میزان — گزارش خودکار</div></body></html>';
}

export async function printHtml(html) {
  try {
    if (Platform.OS === 'web') {
      try {
        console.log('[print] html len:', html ? html.length : 0);
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
        iframe.src = url;
        document.body.appendChild(iframe);
        var printed = false;
        var doPrint = function() {
          if (printed) return;
          try {
            console.log('[print] calling print');
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            printed = true;
            setTimeout(function() { try { URL.revokeObjectURL(url); } catch(e){} }, 60000);
          } catch(err) { console.error('[print] err:', err); }
        };
        iframe.onload = function() { console.log('[print] onload'); setTimeout(doPrint, 500); };
        setTimeout(doPrint, 2000);
        setTimeout(function() { try { document.body.removeChild(iframe); } catch(e) {} }, 120000);
        return { ok: true, message: 'پنجره چاپ باز شد' };
      } catch (e) {
        console.error('[print] outer:', e);
        return { ok: false, message: 'خطا: ' + (e.message || '') };
      }
    }
    await Print.printAsync({ html });
    return { ok: true, message: 'چاپ ارسال شد' };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : 'خطا در چاپ' };
  }
}

async function _doShare(uri, mime) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime || 'application/pdf', dialogTitle: 'اشتراک‌گذاری' });
    return { ok: true, message: 'ارسال شد' };
  }
  return { ok: false, message: 'اشتراک پشتیبانی نمی‌شود' };
}

export async function shareHtmlAsPdf(html, filename) {
  try {
    if (Platform.OS === 'web') {
      try {
        console.log('[pdf] html len:', html ? html.length : 0);
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
        iframe.src = url;
        document.body.appendChild(iframe);
        var printed = false;
        var doPrint = function() {
          if (printed) return;
          try {
            console.log('[pdf] calling print');
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            printed = true;
            setTimeout(function() { try { URL.revokeObjectURL(url); } catch(e){} }, 60000);
          } catch(err) { console.error('[pdf] err:', err); }
        };
        iframe.onload = function() { console.log('[pdf] onload'); setTimeout(doPrint, 500); };
        setTimeout(doPrint, 2000);
        setTimeout(function() { try { document.body.removeChild(iframe); } catch(e) {} }, 120000);
        return { ok: true, message: 'پنجره چاپ باز شد' };
      } catch (e) {
        console.error('[pdf] outer:', e);
        return { ok: false, message: 'خطا: ' + (e.message || '') };
      }
    }
    const res = await Print.printToFileAsync({ html });
    const dir = (FileSystem && (FileSystem.cacheDirectory || FileSystem.documentDirectory)) || '';
    const target = dir + filename;
    try { await FileSystem.copyAsync({ from: res.uri, to: target }); return await _doShare(target, 'application/pdf'); }
    catch (e) { return await _doShare(res.uri, 'application/pdf'); }
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : 'خطا در PDF' };
  }
}

export async function shareViewAsImage(ref, filename, mode) {
  try {
    const uri = await captureRef(ref, { format: 'jpg', quality: 0.95 });
    if (mode === 'print') { await Print.printAsync({ uri }); return { ok: true, message: 'چاپ شد' }; }
    return await _doShare(uri, 'image/jpeg');
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : 'خطا در تصویر' };
  }
}

export async function exportExcel(sheets, filename) {
  try {
    const wb = XLSX.utils.book_new();
    for (let i = 0; i < sheets.length; i++) {
      const ws = XLSX.utils.json_to_sheet(sheets[i].data || []);
      XLSX.utils.book_append_sheet(wb, ws, sheets[i].name || ('Sheet' + (i + 1)));
    }
    if (Platform.OS === 'web') {
      XLSX.writeFile(wb, filename);
      return { ok: true, message: 'دانلود شد' };
    }
    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const dir = (FileSystem && (FileSystem.cacheDirectory || FileSystem.documentDirectory)) || '';
    const path = dir + filename;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
    return await _doShare(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : 'خطا در اکسل' };
  }
}
export function numToWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'صفر';
  var ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  var teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  var tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  var hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  var scales = ['', ' هزار', ' میلیون', ' میلیارد', ' هزار میلیارد'];
  function threeDigit(num) {
    var parts = [];
    var h = Math.floor(num / 100);
    var rem = num % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rem >= 10 && rem < 20) parts.push(teens[rem - 10]);
    else { var t = Math.floor(rem / 10); var o = rem % 10; if (t > 0) parts.push(tens[t]); if (o > 0) parts.push(ones[o]); }
    return parts.join(' و ');
  }
  var result = [];
  var scaleIdx = 0;
  while (n > 0) {
    var chunk = n % 1000;
    if (chunk > 0) result.unshift(threeDigit(chunk) + scales[scaleIdx]);
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return result.join(' و ');
}

export function currencyLabel(cur) {
  if (!cur) return getCurrencySync().label || 'افغانی';
  return currencyLabelByCode(String(cur));
}

export function mizanSignaturesHtml(labels) {
  var l = labels || ['امضای صاحب حساب', 'امضای مدیر مالی', 'مهر شرکت'];
  return '<div class="sign">' + l.map(function(x) { return '<div class="sign-box">' + x + '</div>'; }).join('') + '</div>';
}

export function mizanComputerNoteHtml() {
  return '<div class="computer-note">⚖️ این سند به‌صورت خودکار توسط سیستم میزان تولید شده و بدون نیاز به امضا معتبر است.</div>';
}