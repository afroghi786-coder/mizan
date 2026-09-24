// lib-date.ts
import { g2j, j2g, g2h, h2g } from './lib-jalali';

export type CalType = 'jalali' | 'gregorian' | 'hijri';

export interface DateFields {
  y: number; m: number; d: number;
  h: number; n: number; s: number;
}

// ─── تبدیل Date به فیلدها بر اساس نوع تقویم ───
export function dateToFields(date: Date, type: CalType): DateFields {
  const h = date.getHours();
  const n = date.getMinutes();
  const s = date.getSeconds();
  if (type === 'jalali') {
    const [jy, jm, jd] = g2j(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return { y: jy, m: jm, d: jd, h, n, s };
  }
  if (type === 'hijri') {
    const r = g2h(date);
    return { y: r.y, m: r.m, d: r.d, h, n, s };
  }
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), h, n, s };
}

// ─── تبدیل فیلدها به Date ───
export function fieldsToDate(
  y: number, m: number, d: number,
  h: number, n: number, s: number,
  type: CalType
): Date | null {
  try {
    if (type === 'jalali') {
      const g = j2g(y, m, d);
      return new Date(g.y, g.m - 1, g.d, h, n, s);
    }
    if (type === 'hijri') {
      const g = h2g(y, m, d);
      return new Date(g.y, g.m - 1, g.d, h, n, s);
    }
    return new Date(y, m - 1, d, h, n, s);
  } catch {
    return null;
  }
}

// ─── اعتبارسنجی ───
export function isValidDate(y: number, m: number, d: number, type: CalType): boolean {
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12) return false;
  if (type === 'gregorian') {
    if (y < 1900 || y > 2200) return false;
    return d >= 1 && d <= 31;
  }
  if (type === 'jalali') {
    if (y < 1300 || y > 1500) return false;
    if (m <= 6) return d >= 1 && d <= 31;
    if (m <= 11) return d >= 1 && d <= 30;
    return d >= 1 && d <= 30; // اسفند (سال کبیسه پیچیده)
  }
  // hijri
  if (y < 1400 || y > 1600) return false;
  return d >= 1 && d <= 30;
}

// ─── ذخیره‌سازی (همیشه میلادی) ───
export function toStorageDateFull(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

export function toStorageDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())}`;
}

// ─── نمایش بر اساس تقویم کاربر ───
export function displayDate(
  input: string | Date | null,
  type: CalType = 'jalali'
): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  let datePart = '';
  if (type === 'jalali') {
    const [jy, jm, jd] = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    datePart = `${jy}/${p(jm)}/${p(jd)}`;
  } else if (type === 'hijri') {
    const r = g2h(d);
    datePart = `${r.y}/${p(r.m)}/${p(r.d)}`;
  } else {
    datePart = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  }
  return `${datePart} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function parseDateAny(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  // میلادی
  const gm = s.match(/^(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (gm) {
    return new Date(+gm[1], +gm[2] - 1, +gm[3], +(gm[4] || 0), +(gm[5] || 0), +(gm[6] || 0));
  }
  // شمسی
  const jm = s.match(/^(1[34]\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (jm) {
    const g = j2g(+jm[1], +jm[2], +jm[3]);
    return new Date(g.y, g.m - 1, g.d, +(jm[4] || 0), +(jm[5] || 0), +(jm[6] || 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
