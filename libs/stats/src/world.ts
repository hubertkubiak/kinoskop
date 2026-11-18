import { bucketize, type Bucket, byCountDesc, type LibraryItem } from './model';

export const UNKNOWN = 'unknown';

/** Titles and mean rating per production country (ISO alpha-2). */
export function countryStats(items: LibraryItem[]): Bucket[] {
  return bucketize(items.filter((i) => i.enrichment), (i) => i.enrichment!.countries).sort(byCountDesc);
}

/**
 * Nationalities of directors or of the top-10 cast (SPEC §7.4). Multiple citizenships count for
 * every country; a title whose people have no known citizenship falls into "unknown".
 */
export function nationalityStats(items: LibraryItem[], role: 'director' | 'cast'): Bucket[] {
  return bucketize(
    items.filter((i) => i.enrichment),
    (i) => {
      const people = role === 'director' ? i.enrichment!.directors : i.enrichment!.cast;
      const codes = people.flatMap((p) => p.nationalities);
      return codes.length ? codes : [UNKNOWN];
    },
  ).sort(byCountDesc);
}
