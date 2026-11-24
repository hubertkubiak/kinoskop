import { EXPORT_SCHEMA_VERSION, type ExportFile, type ExportItem } from './export-file';
import { itemKey, type Kind, type ListKind } from './kinds';
import { classifyVotesFileName, looksLikeVotesJson, parseVotesJson } from './votes-import';

/**
 * Import of CSV files produced by other tools. Two families:
 * - Letterboxd import format (e.g. Filmweb2Letterboxd `Title,Year,WatchedDate,Rating10`) or the
 *   Letterboxd export (`Date,Name,Year,Letterboxd URI,Rating`): no Filmweb ID, so each title gets
 *   a local key and is matched by title and year.
 * - Filmweb2Letterboxd archive tables (`Filmweb2Letterboxd_wstepny_….csv` without titles,
 *   `Filmweb2Letterboxd_pelny_….csv` with titles): one row per list entry with `List`, `Kind` and
 *   `FilmwebID`, so items keep their Filmweb ID and are matched through Wikidata exactly like
 *   the console script's export; titles, when present, are used for the rest.
 * - Votes files from a personal data request to the rating site (`…_films.json`, see votes-import.ts):
 *   titles, years and ratings only, matched by title and year like the Letterboxd format.
 * Only the user's own data is taken: rating, dates, favourites, lists, and title/year for matching.
 */

export interface CsvSource {
  name: string;
  text: string;
}

export interface CsvFileSummary {
  name: string;
  /** From the file name; absent for archive tables, whose rows carry their own kind and list. */
  kind?: Kind;
  list?: ListKind;
  rows: number;
  skipped: number;
}

export interface CsvImportSummary {
  files: CsvFileSummary[];
  /** Files recognised but deliberately not imported, with the reason shown in the preview. */
  ignoredFiles: { name: string; reason: string }[];
  counts: Record<Kind, { rated: number; want2see: number }>;
  unrated: number;
  duplicates: number;
  /** Items with a Filmweb ID (archive tables), matched through Wikidata first. */
  withFilmwebId: number;
  /** Items with a Filmweb ID but no title: only those known to Wikidata can be matched. */
  withoutTitle: number;
  /**
   * Data the files do not contain, so the matching statistics stay empty (shown in the preview):
   * rating dates (charts over time), favourites, the "want to see" list.
   */
  missing: ('dates' | 'favorites' | 'want2see')[];
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

const headerLine = (text: string): string => {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return body.split(/\r?\n/, 1)[0]?.toLowerCase() ?? '';
};
const hasColumn = (header: string, name: string) => new RegExp(`(^|,)"?${name}"?(,|$)`).test(header);

/** True when the text looks like a CSV with a title column (used for format detection). */
export function looksLikeTitleCsv(text: string): boolean {
  const first = headerLine(text);
  return hasColumn(first, 'title') || hasColumn(first, 'name');
}

/** True for a Filmweb2Letterboxd archive table (`List,Kind,FilmwebID,…`). */
export function looksLikeIdCsv(text: string): boolean {
  const first = headerLine(text);
  return hasColumn(first, 'filmwebid') && hasColumn(first, 'list') && hasColumn(first, 'kind');
}

/** Filmweb2Letterboxd error report (`Filmweb2Letterboxd_bledy.csv`): recognised, never imported. */
function isErrorReport(name: string, text: string): boolean {
  const first = headerLine(text);
  return /filmweb2letterboxd_bledy/i.test(name) || (hasColumn(first, 'error') && hasColumn(first, 'id') && !looksLikeTitleCsv(text));
}

/** Letterboxd-format files written by Filmweb2Letterboxd next to its archive tables. */
const isFw2lLetterboxdFile = (name: string) => /^filmweb2letterboxd_(watched|watchlist)_/i.test(name);

/** True when importCsvFiles can handle the file (used for format detection in the app). */
export function looksLikeImportCsv(name: string, text: string): boolean {
  return looksLikeVotesJson(text) || looksLikeTitleCsv(text) || looksLikeIdCsv(text) || isErrorReport(name, text);
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

/** ISO timestamp column (Filmweb2Letterboxd `Timestamp` = when the rating was given). */
function parseIsoTimestamp(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return undefined;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

/** Archive `Kind` / `List` values → Kinoskop kinds (TV shows count as series, like the script). */
const ARCHIVE_KIND: Record<string, Kind> = { film: 'film', serial: 'serial', tvshow: 'serial', videogame: 'game' };
const ARCHIVE_LIST: Record<string, ListKind> = { watched: 'rated', watchlist: 'want2see' };

/**
 * One archive row → item with its Filmweb ID; `null` = invalid row, `'not-interested'` =
 * watchlist level 0 ("nie interesuje mnie"), which is not a "want to see" entry.
 */
function archiveRowToItem(row: Record<string, string>): ExportItem | null | 'not-interested' {
  const kind = ARCHIVE_KIND[row['kind']?.trim().toLowerCase() ?? ''];
  const list = ARCHIVE_LIST[row['list']?.trim().toLowerCase() ?? ''];
  const id = Number(row['filmwebid']?.trim());
  if (!kind || !list || !Number.isInteger(id) || id <= 0) return null;
  if (list === 'want2see' && row['watchlistlevel']?.trim() === '0') return 'not-interested';
  const item: ExportItem = { filmwebId: id, kind, list };
  if (list === 'rated') {
    const rating = parseRating(row);
    // Same meaning as the console script: the time the rating was given, else the viewing date.
    const ratedAt = parseIsoTimestamp(row['timestamp']) ?? parseDate(row);
    if (rating !== undefined) item.rating = rating;
    if (ratedAt) item.ratedAt = ratedAt;
    if (row['favorite']?.trim() === '1') item.favorite = true;
  }
  const title = row['title']?.trim();
  const original = row['originaltitle']?.trim();
  const year = parseYear(row['year']);
  if (title && title.length <= 500) item.title = title;
  if (original && original.length <= 500 && original !== title) item.originalTitle = original;
  if (year !== undefined) item.year = year;
  return item;
}

/** Keeps the rated entry of a duplicate and fills in title fields the kept one lacks. */
function mergeDuplicate(prev: ExportItem, next: ExportItem): ExportItem {
  const [keep, other] = prev.list === 'want2see' && next.list === 'rated' ? [next, prev] : [prev, next];
  return {
    ...keep,
    ...(keep.title || !other.title ? {} : { title: other.title }),
    ...(keep.originalTitle || !other.originalTitle ? {} : { originalTitle: other.originalTitle }),
    ...(keep.year !== undefined || other.year === undefined ? {} : { year: other.year }),
  };
}

/**
 * Converts one or more CSV files into an in-memory ExportFile. Duplicates (same kind and Filmweb
 * ID, or same kind, title and year) are merged; a title both rated and on the watchlist stays rated.
 */
export function importCsvFiles(sources: CsvSource[], now = new Date()): CsvImportResult {
  if (!sources.length) return { ok: false, message: 'Nie wybrano plików.' };
  const byKey = new Map<string, ExportItem>();
  const byId = new Map<string, ExportItem>();
  const files: CsvFileSummary[] = [];
  const ignoredFiles: CsvImportSummary['ignoredFiles'] = [];
  let duplicates = 0;
  let archiveWithoutTitles = false;

  // With an archive table in the batch, Filmweb2Letterboxd's own Letterboxd files hold the same
  // entries without IDs – importing both would duplicate every title.
  const hasArchive = sources.some((s) => looksLikeIdCsv(s.text));

  /** Adds a title-only entry (no title ID); returns false for an invalid title. */
  const addTitleRow = (kind: Kind, list: ListKind, rawTitle: string | undefined, year: number | undefined, rating?: number, ratedAt?: string) => {
    const title = rawTitle?.trim();
    if (!title || title.length > 500) return false;
    const dedupe = `${kind}|${normTitle(title)}|${year ?? ''}`;
    const item: ExportItem = { filmwebId: 0, kind, list, title, ...(year !== undefined ? { year } : {}) };
    if (list === 'rated') {
      if (rating !== undefined) item.rating = rating;
      if (ratedAt) item.ratedAt = ratedAt;
    }
    const prev = byKey.get(dedupe);
    if (prev) {
      duplicates++;
      // Prefer the rated entry; otherwise keep the first one.
      if (prev.list === 'want2see' && item.list === 'rated') byKey.set(dedupe, item);
      return true;
    }
    byKey.set(dedupe, item);
    return true;
  };

  for (const src of sources) {
    const votes = looksLikeVotesJson(src.text) ? parseVotesJson(src.text) : null;
    if (votes) {
      const kind = classifyVotesFileName(src.name);
      if (kind === 'episode') {
        ignoredFiles.push({ name: src.name, reason: 'oceny odcinków – Kinoskop liczy seriale w całości (są w pliku z serialami)' });
        continue;
      }
      const summary: CsvFileSummary = { name: src.name, kind, list: 'rated', rows: votes.rows.length + votes.skipped, skipped: votes.skipped };
      for (const v of votes.rows) if (!addTitleRow(kind, 'rated', v.title, v.year, v.rating)) summary.skipped++;
      files.push(summary);
      continue;
    }
    if (isErrorReport(src.name, src.text)) {
      ignoredFiles.push({ name: src.name, reason: 'raport błędów, nie zawiera ocen' });
      continue;
    }
    if (hasArchive && isFw2lLetterboxdFile(src.name) && !looksLikeIdCsv(src.text)) {
      ignoredFiles.push({ name: src.name, reason: 'te same pozycje są w tabeli z identyfikatorami tytułów' });
      continue;
    }
    const rows = parseCsv(src.text);
    const header = rows.shift()?.map((h) => h.trim().toLowerCase());

    if (header && looksLikeIdCsv(src.text)) {
      if (!header.includes('title')) archiveWithoutTitles = true;
      const summary: CsvFileSummary = { name: src.name, rows: rows.length, skipped: 0 };
      for (const cells of rows) {
        const item = archiveRowToItem(Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
        if (item === null || item === 'not-interested') {
          summary.skipped++;
          continue;
        }
        const key = itemKey(item);
        const prev = byId.get(key);
        if (prev) duplicates++;
        byId.set(key, prev ? mergeDuplicate(prev, item) : item);
      }
      files.push(summary);
      continue;
    }

    const titleCol = header?.findIndex((h) => h === 'title' || h === 'name') ?? -1;
    if (!header || titleCol < 0) {
      return { ok: false, message: `Plik „${src.name}” nie ma kolumny Title ani Name.` };
    }
    const { kind, list } = classifyCsvFileName(src.name);
    const summary: CsvFileSummary = { name: src.name, kind, list, rows: rows.length, skipped: 0 };
    for (const cells of rows) {
      const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
      if (!addTitleRow(kind, list, cells[titleCol], parseYear(row['year']), parseRating(row), parseDate(row))) summary.skipped++;
    }
    files.push(summary);
  }

  // Items with a Filmweb ID keep it; the rest get local ids (hash collisions resolved with a salt).
  const used = new Set<string>(byId.keys());
  const items: ExportItem[] = [...byId.values()];
  for (const it of byKey.values()) {
    const title = it.title ?? '';
    let salt = 0;
    let id = localItemId(it.kind, title, it.year);
    while (used.has(itemKey({ kind: it.kind, filmwebId: id }))) id = localItemId(it.kind, title, it.year, ++salt);
    used.add(itemKey({ kind: it.kind, filmwebId: id }));
    items.push({ ...it, filmwebId: id });
  }
  if (!items.length) {
    return {
      ok: false,
      message: ignoredFiles.length
        ? `Wybrane pliki nie zawierają ocen do wczytania (pominięte: ${ignoredFiles.map((f) => f.name).join(', ')}).`
        : 'Pliki nie zawierają żadnych tytułów.',
    };
  }
  if (items.length > 50_000) return { ok: false, message: 'Za dużo pozycji (limit 50 000).' };

  const counts: CsvImportSummary['counts'] = {
    film: { rated: 0, want2see: 0 },
    serial: { rated: 0, want2see: 0 },
    game: { rated: 0, want2see: 0 },
  };
  let unrated = 0;
  let withoutTitle = 0;
  let dated = 0;
  let favorites = 0;
  for (const it of items) {
    counts[it.kind][it.list]++;
    if (it.list === 'rated' && it.rating === undefined) unrated++;
    if (it.filmwebId > 0 && !it.title && !it.originalTitle) withoutTitle++;
    if (it.ratedAt) dated++;
    if (it.favorite) favorites++;
  }
  const rated = items.filter((i) => i.list === 'rated').length;
  const missing: CsvImportSummary['missing'] = [];
  if (rated && !dated) missing.push('dates');
  if (rated && !favorites) missing.push('favorites');
  if (!items.some((i) => i.list === 'want2see')) missing.push('want2see');

  const file: ExportFile = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: 'csv',
    // An archive table without titles is part 1 of a two-part import: the later table with
    // titles (`…_pelny_…`) is merged into it like the script's part 2 (docs/adr/0003).
    ...(archiveWithoutTitles && withoutTitle > 0 ? { part: 'base' as const } : {}),
    user: { id: 0, name: '' },
    items,
  };
  return {
    ok: true,
    file,
    summary: { files, ignoredFiles, counts, unrated, duplicates, withFilmwebId: byId.size, withoutTitle, missing },
  };
}
