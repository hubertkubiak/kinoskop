import type { Kind } from './kinds';

/**
 * Ratings sent by the rating site on a personal data request (copy of the user's data, GDPR
 * art. 15): one JSON file per kind, e.g. `<user>_films.json`, `<user>_serials.json`,
 * `<user>_episodes.json`, each `{ "votes": [{ "title": "Tytuł (1975)", "rate": 6, "comment": "" }] }`.
 * Shape taken from the author's own files (2026-11-24): `title` always ends with the year or a
 * year range ("(2018 - 2018)", "(2022 - )"), `rate` 1–10 is missing for entries without a rating,
 * episodes add "Sezon N odcinek M" after the year. There are no title IDs, rating dates,
 * favourites or watchlists, and titles are the Polish display titles.
 * Only titles, years and ratings are read; comments (the user's own text) are never imported.
 */

export interface VoteRow {
  title: string;
  year?: number;
  rating?: number;
}

export type VotesFileKind = Kind | 'episode';

/** True for a data-request votes file: a JSON object with a `votes` array of `{ title }`. */
export function looksLikeVotesJson(text: string): boolean {
  const head = text.trimStart();
  if (!head.startsWith('{') || !/"votes"\s*:/.test(head.slice(0, 200))) return false;
  return parseVotesJson(text) !== null;
}

/** Kind from the file name; episodes are recognised so that they can be skipped. */
export function classifyVotesFileName(name: string): VotesFileKind {
  const n = name.toLowerCase();
  if (/episode|odcink/.test(n)) return 'episode';
  if (/serial|series|tv ?show/.test(n)) return 'serial';
  if (/game|gry/.test(n)) return 'game';
  return 'film';
}

/** "Tytuł (1975)", "Tytuł (2018 - 2018)", "Tytuł (2022 - )" → title and first year. */
export function parseVoteTitle(raw: string): { title: string; year?: number } {
  const s = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  const m = /^(.*\S)\s*\((\d{4})(?:\s*-\s*(?:\d{4})?)?\)(.*)$/.exec(s);
  if (!m) return { title: s };
  const year = Number(m[2]);
  return { title: m[1], ...(year >= 1870 && year <= 2100 ? { year } : {}) };
}

/** Parses a votes file; `null` when the text is not one. Invalid entries are counted as skipped. */
export function parseVotesJson(text: string): { rows: VoteRow[]; skipped: number } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const votes = (raw as { votes?: unknown } | null)?.votes;
  if (!Array.isArray(votes)) return null;
  if (votes.length && !votes.some((v) => typeof (v as { title?: unknown } | null)?.title === 'string')) return null;
  const rows: VoteRow[] = [];
  let skipped = 0;
  for (const v of votes as { title?: unknown; rate?: unknown }[]) {
    const t = typeof v?.title === 'string' ? parseVoteTitle(v.title) : null;
    if (!t?.title || t.title.length > 500) {
      skipped++;
      continue;
    }
    const rate = typeof v.rate === 'number' && Number.isInteger(v.rate) && v.rate >= 1 && v.rate <= 10 ? v.rate : undefined;
    rows.push({ ...t, ...(rate !== undefined ? { rating: rate } : {}) });
  }
  return { rows, skipped };
}
