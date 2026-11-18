import { EXPORT_SCHEMA_VERSION, type ExportFile, type ExportItem } from './export-file';
import { itemKey, type Kind, type ListKind } from './kinds';

/**
 * Import of CSV files produced by other tools, in the Letterboxd import format
 * (e.g. Filmweb2Letterboxd: `Title,Year,WatchedDate,Rating10`) or the Letterboxd export
 * (`Date,Name,Year,Letterboxd URI,Rating`). Only the user's own data is taken: title and year
 * (for matching), rating and date. Files carry no Filmweb ID, so each title gets a local key.
 */

export interface CsvSource {
  name: string;
  text: string;
}

export interface CsvFileSummary {
  name: string;
  kind: Kind;
  list: ListKind;
  rows: number;
  skipped: number;
}

export interface CsvImportSummary {
  files: CsvFileSummary[];
  counts: Record<Kind, { rated: number; want2see: number }>;
  unrated: number;
  duplicates: number;
}

export type CsvImportResult =
  | { ok: true; file: ExportFile; summary: CsvImportSummary }
  | { ok: false; message: string };

/** RFC 4180 parser: quoted fields, doubled quotes, CRLF/LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Kind and list from the file name, e.g. `Filmweb2Letterboxd_watchlist_serial_0.csv`. */
export function classifyCsvFileName(name: string): { kind: Kind; list: ListKind } {
  const n = name.toLowerCase();
  const kind: Kind = /video ?game|\bgames?\b|_games?_|gry/.test(n)
    ? 'game'
    : /serial|tv ?show|series|seriale/.test(n)
      ? 'serial'
      : 'film';
  const list: ListKind = /watchlist|want|chce|do-obejrzenia/.test(n) ? 'want2see' : 'rated';
  return { kind, list };
}

/** True when the text looks like a CSV with a title column (used for format detection). */
export function looksLikeTitleCsv(text: string): boolean {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const first = body.split(/\r?\n/, 1)[0]?.toLowerCase() ?? '';
  return /(^|,)"?(title|name)"?(,|$)/.test(first);
}

const normTitle = (t: string) => t.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

/** FNV-1a; deterministic so a re-import keeps keys (and cached enrichments) stable. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Local (negative) id of a title without Filmweb ID. */
export function localItemId(kind: Kind, title: string, year: number | undefined, salt = 0): number {
  const h = fnv1a(`${kind}|${normTitle(title)}|${year ?? ''}|${salt}`) & 0x7fffffff;
  return -(h + 1);
}

function parseRating(row: Record<string, string>): number | undefined {
  const r10 = row['rating10']?.trim();
  if (r10) {
    const n = Number(r10.replace(',', '.'));
    if (Number.isFinite(n) && n >= 1 && n <= 10) return Math.round(n);
  }
  const r5 = row['rating']?.trim();
  if (r5) {
    const n = Number(r5.replace(',', '.'));
    // Letterboxd: 0.5–5 stars, half-star steps → 1–10.
    if (Number.isFinite(n) && n >= 0.5 && n <= 5) return Math.round(n * 2);
  }
  return undefined;
}

function parseDate(row: Record<string, string>): string | undefined {
  const raw = (row['watcheddate'] || row['watched date'] || row['date'] || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

function parseYear(raw: string | undefined): number | undefined {
  const n = Number(raw?.trim());
  return Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : undefined;
}

/**
 * Converts one or more CSV files into an in-memory ExportFile. Duplicates (same kind, title and
 * year) are merged; a title both rated and on the watchlist stays rated.
 */
export function importCsvFiles(sources: CsvSource[], now = new Date()): CsvImportResult {
  if (!sources.length) return { ok: false, message: 'Nie wybrano plików.' };
  const byKey = new Map<string, ExportItem>();
  const files: CsvFileSummary[] = [];
  let duplicates = 0;

  for (const src of sources) {
    const rows = parseCsv(src.text);
    const header = rows.shift()?.map((h) => h.trim().toLowerCase());
    const titleCol = header?.findIndex((h) => h === 'title' || h === 'name') ?? -1;
    if (!header || titleCol < 0) {
      return { ok: false, message: `Plik „${src.name}” nie ma kolumny Title ani Name.` };
    }
    const { kind, list } = classifyCsvFileName(src.name);
    const summary: CsvFileSummary = { name: src.name, kind, list, rows: rows.length, skipped: 0 };
    for (const cells of rows) {
      const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
      const title = cells[titleCol]?.trim();
      if (!title || title.length > 500) {
        summary.skipped++;
        continue;
      }
      const year = parseYear(row['year']);
      const dedupe = `${kind}|${normTitle(title)}|${year ?? ''}`;
      const item: ExportItem = {
        filmwebId: 0,
        kind,
        list,
        title,
        ...(year !== undefined ? { year } : {}),
      };
      if (list === 'rated') {
        const rating = parseRating(row);
        const ratedAt = parseDate(row);
        if (rating !== undefined) item.rating = rating;
        if (ratedAt) item.ratedAt = ratedAt;
      }
      const prev = byKey.get(dedupe);
      if (prev) {
        duplicates++;
        // Prefer the rated entry; otherwise keep the first one.
        if (prev.list === 'want2see' && item.list === 'rated') byKey.set(dedupe, item);
        continue;
      }
      byKey.set(dedupe, item);
    }
    files.push(summary);
  }

  // Assign local ids; resolve (unlikely) hash collisions with a salt.
  const used = new Set<string>();
  const items: ExportItem[] = [];
  for (const it of byKey.values()) {
    const title = it.title ?? '';
    let salt = 0;
    let id = localItemId(it.kind, title, it.year);
    while (used.has(itemKey({ kind: it.kind, filmwebId: id }))) id = localItemId(it.kind, title, it.year, ++salt);
    used.add(itemKey({ kind: it.kind, filmwebId: id }));
    items.push({ ...it, filmwebId: id });
  }
  if (!items.length) return { ok: false, message: 'Pliki nie zawierają żadnych tytułów.' };
  if (items.length > 50_000) return { ok: false, message: 'Za dużo pozycji (limit 50 000).' };

  const counts: CsvImportSummary['counts'] = {
    film: { rated: 0, want2see: 0 },
    serial: { rated: 0, want2see: 0 },
    game: { rated: 0, want2see: 0 },
  };
  let unrated = 0;
  for (const it of items) {
    counts[it.kind][it.list]++;
    if (it.list === 'rated' && it.rating === undefined) unrated++;
  }

  const file: ExportFile = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: 'csv',
    user: { id: 0, name: '' },
    items,
  };
  return { ok: true, file, summary: { files, counts, unrated, duplicates } };
}
