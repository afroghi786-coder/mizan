import { g2j, j2g, g2h, h2g } from './lib-jalali';

// ═══════════════════════════════════════════
// انواع تاریخ
// ═══════════════════════════════════════════
export type CalType = 'jalali' | 'gregorian' | 'hijri';

// ═══════════════════════════════════════════
// پارس هر فرمت تاریخ
// ═══════════════════════════════════════════
export function parseDateAny(v: any): Date | null {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;

  // میلادی: 2024/12/25
  const gm = s.match(/^(20\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (gm) {
    return new Date(+gm[1], +gm[2] - 1, +gm[3], +(gm[4] || 0), +(gm[5] || 0), +(gm[6] || 0));
  }

  // شمسی: 1403/10/05
  const jm = s.match(/^(1[34]\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (jm) {
    const g = j2g(+jm[1], +jm[2], +jm[3]);
    return new Date(g.y, g.m - 1, g.d, +(jm[4] || 0), +(jm[5] || 0), +(jm[6] || 0));
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════
// ذخیره به صورت میلادی (YYYY/MM/DD)
// ═══════════════════════════════════════════
export function toStorageDate(d: any): string {
  const dt = d instanceof Date ? d : parseDateAny(d);
  if (!dt || isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}/${pad(dt.getMonth() + 1)}/${pad(dt.getDate())}`;
}

export function toStorageDateFull(d: any): string {
  const dt = d instanceof Date ? d : parseDateAny(d);
  if (!dt || isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toStorageDate(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

// ═══════════════════════════════════════════
// نمایش به فرمت انتخاب‌شده
// ═══════════════════════════════════════════
export function formatDateForType(d: any, type: CalType = 'jalali', withTime = true): string {
  const dt = d instanceof Date ? d : parseDateAny(d);
  if (!dt || isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');

  let datePart = '';
  if (type === 'jalali') {
    const j = g2j(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    datePart = `${j[0]}/${pad(j[1])}/${pad(j[2])}`;
  } else if (type === 'hijri') {
    const h = g2h(dt);
    datePart = `${h.y}/${pad(h.m)}/${pad(h.d)}`;
  } else {
    datePart = `${dt.getFullYear()}/${pad(dt.getMonth() + 1)}/${pad(dt.getDate())}`;
  }

  if (!withTime) return datePart;
  return `${datePart} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

export function displayDate(v: any, type: CalType = 'jalali'): string {
  return formatDateForType(v, type, false);
}

export function displayDateTime(v: any, type: CalType = 'jalali'): string {
  return formatDateForType(v, type, true);
}

// ═══════════════════════════════════════════
// تاریخ امروز (به شمسی)
// ═══════════════════════════════════════════
export function todayJalali(): [number, number, number] {
  const now = new Date();
  return g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// ═══════════════════════════════════════════
// بررسی معتبر بودن
// ═══════════════════════════════════════════
export function isValidDate(y: number, m: number, d: number, type: CalType = 'jalali'): boolean {
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  if (y < 1300 || y > 2200) return false;
  return true;
}

// ═══════════════════════════════════════════
// تبدیل فیلدهای سال/ماه/روز به Date
// ═══════════════════════════════════════════
export function fieldsToDate(
  y: number, m: number, d: number,
  h: number = 0, n: number = 0, s: number = 0,
  type: CalType = 'jalali'
): Date | null {
  if (!isValidDate(y, m, d, type)) return null;
  if (type === 'jalali') {
    const g = j2g(y, m, d);
    return new Date(g.y, g.m - 1, g.d, h, n, s);
  } else if (type === 'hijri') {
    const g = h2g(y, m, d);
    return new Date(g.y, g.m - 1, g.d, h, n, s);
  } else {
    return new Date(y, m - 1, d, h, n, s);
  }
}

// ═══════════════════════════════════════════
// تبدیل Date به فیلدهای سال/ماه/روز
// ═══════════════════════════════════════════
export function dateToFields(
  d: Date | null,
  type: CalType = 'jalali'
): { y: number; m: number; d: number; h: number; n: number; s: number } {
  if (!d || isNaN(d.getTime())) {
    return { y: 0, m: 0, d: 0, h: 0, n: 0, s: 0 };
  }
  if (type === 'jalali') {
    const j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { y: j[0], m: j[1], d: j[2], h: d.getHours(), n: d.getMinutes(), s: d.getSeconds() };
  } else if (type === 'hijri') {
    const h = g2h(d);
    return { y: h.y, m: h.m, d: h.d, h: d.getHours(), n: d.getMinutes(), s: d.getSeconds() };
  } else {
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), n: d.getMinutes(), s: d.getSeconds() };
  }
}

// ═══════════════════════════════════════════
// ماه جاری
// ═══════════════════════════════════════════
export function currentMonthPrefix(): string {
  const now = new Date();
  return now.getFullYear() + '/' + String(now.getMonth() + 1).padStart(2, '0');
}

export function extractMonth(v: any): string {
  const dt = parseDateAny(v);
  if (!dt) return '';
  return dt.getFullYear() + '/' + String(dt.getMonth() + 1).padStart(2, '0');
}