import type { Enrichment, ExportItem, Person } from '@kinoskop/shared';

/** An exported item joined with its (optional) public metadata. */
export interface LibraryItem extends ExportItem {
  key: string;
  enrichment?: Enrichment;
}

export const yearOf = (it: LibraryItem): number | undefined => it.year ?? it.enrichment?.year;

export const genresOf = (it: LibraryItem): string[] => it.enrichment?.genres ?? [];

export const isRated = (it: LibraryItem): it is LibraryItem & { rating: number } =>
  it.list === 'rated' && typeof it.rating === 'number';

/** Stable identity of a person across titles. */
export const personKey = (p: Person): string =>
  p.tmdbId !== undefined
    ? `tmdb:${p.tmdbId}`
    : p.wikidataId
      ? `wd:${p.wikidataId}`
      : `name:${p.name.toLowerCase()}`;

export const displayTitle = (it: LibraryItem): string =>
  it.enrichment?.title ?? it.title ?? it.originalTitle ?? it.enrichment?.originalTitle ?? `#${it.filmwebId}`;

export function mean(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export const round1 = (n: number | undefined): number | undefined =>
  n === undefined ? undefined : Math.round(n * 10) / 10;

/** Aggregated bucket: count of titles and mean of the user's ratings in it. */
export interface Bucket<K = string> {
  key: K;
  count: number;
  rated: number;
  avg?: number;
}

/** Groups items into buckets; an item may fall into several buckets (e.g. multiple genres). */
export function bucketize<K>(items: LibraryItem[], keysOf: (it: LibraryItem) => K[]): Bucket<K>[] {
  const map = new Map<K, { count: number; ratings: number[] }>();
  for (const it of items) {
    for (const k of new Set(keysOf(it))) {
      let b = map.get(k);
      if (!b) map.set(k, (b = { count: 0, ratings: [] }));
      b.count++;
      if (isRated(it)) b.ratings.push(it.rating);
    }
  }
  return [...map.entries()].map(([key, b]) => ({
    key,
    count: b.count,
    rated: b.ratings.length,
    avg: round1(mean(b.ratings)),
  }));
}

export const byCountDesc = <T extends { count: number; key: unknown }>(a: T, b: T): number =>
  b.count - a.count || String(a.key).localeCompare(String(b.key), 'pl');
