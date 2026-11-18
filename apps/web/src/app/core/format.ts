const regionNames = new Intl.DisplayNames(['pl'], { type: 'region' });
const numberFmt = new Intl.NumberFormat('pl-PL');
const decimalFmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Polish country name for an ISO 3166-1 alpha-2 code. */
export function countryName(code: string): string {
  if (code === 'unknown') return 'nieznana';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const fmtInt = (n: number | undefined) => (n === undefined ? '–' : numberFmt.format(n));
export const fmtAvg = (n: number | undefined) => (n === undefined ? '–' : decimalFmt.format(n));

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const d = Math.floor(h / 24);
  return d >= 2 ? `${fmtInt(d)} dni ${h % 24} h` : `${fmtInt(h)} h ${minutes % 60} min`;
}

/** Plural form for Polish nouns: plural(5, 'tytuł', 'tytuły', 'tytułów'). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

/** Downloads rows as CSV (used by "Pokaż jako tabelę" exports). */
export function downloadCsv(filename: string, columns: string[], rows: (string | number | undefined)[][]): void {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
