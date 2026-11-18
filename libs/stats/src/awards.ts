import type { AwardCatalog, AwardDefinition, AwardEntry } from '@kinoskop/shared';
import { genreCounts } from './genres';
import { isRated, type LibraryItem, mean, round1 } from './model';

/** Shrinkage strength towards the user's overall mean (SPEC §7.7). */
export const AFFINITY_K = 5;
export const AFFINITY_MIN_N = 3;

/** Finds the library item for a catalogue work: Filmweb id, then Wikidata QID, then TMDB id. */
export function indexLibrary(items: LibraryItem[]) {
  const byFw = new Map<string, LibraryItem>();
  const byQid = new Map<string, LibraryItem>();
  const byTmdb = new Map<string, LibraryItem>();
  for (const it of items) {
    byFw.set(`${it.kind}:${it.filmwebId}`, it);
    const m = it.enrichment?.match;
    if (m?.wikidataId) byQid.set(m.wikidataId, it);
    if (m?.tmdbId !== undefined) byTmdb.set(`${it.kind}:${m.tmdbId}`, it);
  }
  return (e: AwardEntry, def: AwardDefinition): LibraryItem | undefined =>
    (e.work.filmwebId !== undefined ? byFw.get(`${def.kind}:${e.work.filmwebId}`) : undefined) ??
    byQid.get(e.work.wikidataId) ??
    (e.work.tmdbId !== undefined ? byTmdb.get(`${def.kind}:${e.work.tmdbId}`) : undefined);
}

export interface AwardAffinityRow {
  award: AwardDefinition;
  winners: number;
  watched: number;
  /** Rated winners. */
  n: number;
  coverage: number;
  avg?: number;
  score?: number;
  delta?: number;
  /** Share of rated winners rated ≥ 8. */
  hitRate?: number;
  insufficient: boolean;
}

/**
 * "Which awards match your taste": coverage, mean rating of winners shrunk towards the overall
 * mean `(n·avg + k·overall) / (n + k)`, delta vs overall, hit rate. Sorted by delta.
 */
export function awardAffinity(items: LibraryItem[], catalog: AwardCatalog, k = AFFINITY_K): AwardAffinityRow[] {
  const find = indexLibrary(items);
  const overall = mean(items.filter(isRated).map((i) => i.rating)) ?? 0;
  const rows = catalog.awards.map((award) => {
    const winners = catalog.entries.filter((e) => e.awardKey === award.key && e.won);
    const matched = winners.map((w) => find(w, award)).filter((i): i is LibraryItem => !!i && i.list === 'rated');
    const ratings = matched.filter(isRated).map((i) => i.rating);
    const n = ratings.length;
    const avg = mean(ratings);
    const insufficient = n < AFFINITY_MIN_N;
    const score = avg === undefined ? undefined : (n * avg + k * overall) / (n + k);
    return {
      award,
      winners: winners.length,
      watched: matched.length,
      n,
      coverage: winners.length ? matched.length / winners.length : 0,
      avg: round1(avg),
      score: insufficient ? undefined : round1(score),
      delta: insufficient || score === undefined ? undefined : Math.round((score - overall) * 100) / 100,
      hitRate: n ? ratings.filter((r) => r >= 8).length / n : undefined,
      insufficient,
    };
  });
  return rows.sort((a, b) => (b.delta ?? -99) - (a.delta ?? -99) || b.n - a.n);
}

export interface Recommendation {
  entry: AwardEntry;
  award: AwardDefinition;
  score: number;
  inWant2see?: LibraryItem;
}

/**
 * Unwatched winners of the 3 most compatible awards, ranked by award compatibility ×
 * match with the user's top genres (SPEC §7.7 p.3).
 */
export function recommendations(items: LibraryItem[], catalog: AwardCatalog, affinity: AwardAffinityRow[], limit = 30): Recommendation[] {
  const find = indexLibrary(items);
  const top = affinity.filter((a) => a.delta !== undefined && a.delta > 0).slice(0, 3);
  const topGenres = genreCounts(items.filter(isRated))
    .slice(0, 5)
    .map((g) => g.key);
  const out: Recommendation[] = [];
  for (const row of top) {
    for (const e of catalog.entries) {
      if (e.awardKey !== row.award.key || !e.won) continue;
      const mine = find(e, row.award);
      if (mine && mine.list === 'rated') continue;
      const genres = e.work.genres ?? [];
      const genreMatch = genres.length ? genres.filter((g) => topGenres.includes(g)).length / genres.length : 0;
      out.push({
        entry: e,
        award: row.award,
        score: Math.round((row.delta ?? 0) * (1 + genreMatch) * 100) / 100,
        inWant2see: mine?.list === 'want2see' ? mine : undefined,
      });
    }
  }
  // Same work may win several top awards: keep its best score.
  const best = new Map<string, Recommendation>();
  for (const r of out) {
    const prev = best.get(r.entry.work.wikidataId);
    if (!prev || r.score > prev.score) best.set(r.entry.work.wikidataId, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || b.entry.year - a.entry.year).slice(0, limit);
}

export type TimelineStatus = 'watched' | 'want2see' | 'unwatched';

export interface TimelinePoint {
  entry: AwardEntry;
  award: AwardDefinition;
  status: TimelineStatus;
  rating?: number;
}

/** Points for the award timeline: one per winner (and nominee if requested). */
export function awardTimeline(items: LibraryItem[], catalog: AwardCatalog, withNominations = false): TimelinePoint[] {
  const find = indexLibrary(items);
  const defs = new Map(catalog.awards.map((a) => [a.key, a]));
  return catalog.entries
    .filter((e) => e.won || withNominations)
    .map((entry) => {
      const award = defs.get(entry.awardKey)!;
      const mine = find(entry, award);
      const status: TimelineStatus = !mine ? 'unwatched' : mine.list === 'want2see' ? 'want2see' : 'watched';
      return { entry, award, status, rating: mine?.rating };
    });
}
