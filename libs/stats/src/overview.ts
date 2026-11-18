import { KINDS, type Kind } from '@kinoskop/shared';
import { genreCounts } from './genres';
import { bucketize, byCountDesc, isRated, type LibraryItem, mean, round1, yearOf } from './model';

export interface Kpis {
  ratedByKind: Record<Kind, number>;
  want2see: number;
  averageRating?: number;
  /** Sum of film runtimes in minutes (series are skipped, see SPEC §7.1). */
  screenTimeMinutes: number;
  filmsWithRuntime: number;
  topGenreByKind: Partial<Record<Kind, string>>;
  favouriteDecade?: number;
}

export function kpis(items: LibraryItem[]): Kpis {
  const rated = items.filter(isRated);
  const ratedByKind = Object.fromEntries(
    KINDS.map((k) => [k, rated.filter((i) => i.kind === k).length]),
  ) as Record<Kind, number>;
  const films = rated.filter((i) => i.kind === 'film' && i.enrichment?.runtimeMinutes);
  const topGenreByKind: Partial<Record<Kind, string>> = {};
  for (const k of KINDS) {
    const top = genreCounts(items.filter((i) => i.kind === k && i.list === 'rated'))[0];
    if (top) topGenreByKind[k] = top.key;
  }
  return {
    ratedByKind,
    want2see: items.filter((i) => i.list === 'want2see').length,
    averageRating: round1(mean(rated.map((i) => i.rating))),
    screenTimeMinutes: films.reduce((s, i) => s + (i.enrichment?.runtimeMinutes ?? 0), 0),
    filmsWithRuntime: films.length,
    topGenreByKind,
    favouriteDecade: favouriteDecade(rated),
  };
}

/** Decade with the highest mean rating among decades with at least 5 rated titles (fallback: most titles). */
function favouriteDecade(rated: LibraryItem[]): number | undefined {
  const buckets = decadeBuckets(rated);
  const solid = buckets.filter((b) => b.rated >= 5);
  const pool = solid.length ? solid : buckets;
  return [...pool].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || b.count - a.count)[0]?.key;
}

export const decadeBuckets = (items: LibraryItem[]) =>
  bucketize(items, (it) => {
    const y = yearOf(it);
    return y === undefined ? [] : [Math.floor(y / 10) * 10];
  }).sort((a, b) => a.key - b.key);

/** Counts of ratings 1–10 (index 0 = rating 1). */
export function ratingDistribution(items: LibraryItem[]): number[] {
  const out = Array.from({ length: 10 }, () => 0);
  for (const it of items) if (isRated(it)) out[it.rating - 1]++;
  return out;
}

/** Ratings per month (`YYYY-MM`) with mean rating; months without ratings are filled with 0. */
export function ratingsOverTime(items: LibraryItem[]): { month: string; count: number; avg?: number }[] {
  const rated = items.filter((i) => isRated(i) && i.ratedAt);
  if (!rated.length) return [];
  const buckets = bucketize(rated, (i) => [i.ratedAt!.slice(0, 7)]);
  const map = new Map(buckets.map((b) => [b.key, b]));
  const months = [...map.keys()].sort();
  const out: { month: string; count: number; avg?: number }[] = [];
  let [y, m] = months[0].split('-').map(Number);
  const [ey, em] = months[months.length - 1].split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const b = map.get(key);
    out.push({ month: key, count: b?.count ?? 0, avg: b?.avg });
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Top-N helper used by several views. */
export const topN = <T extends { count: number; key: unknown }>(rows: T[], n: number): T[] =>
  [...rows].sort(byCountDesc).slice(0, n);
