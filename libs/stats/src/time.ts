import { CERTAIN_ERA_SOURCES, ERA_KEYS, type EraKey } from '@kinoskop/shared';
import { bucketize, type Bucket, isRated, type LibraryItem } from './model';

export interface EraStats {
  /** Chronological, only eras present in the data. */
  eras: Bucket<EraKey>[];
  /** Titles with enrichment but no determined era ("nieustalona (N)"). */
  undetermined: number;
  /** Titles without enrichment at all. */
  notEnriched: number;
}

export function eraStats(items: LibraryItem[], certainOnly = false): EraStats {
  const keysOf = (i: LibraryItem) =>
    (i.enrichment?.setInPeriod ?? [])
      .filter((e) => !certainOnly || CERTAIN_ERA_SOURCES.includes(e.source))
      .map((e) => e.key);
  const enriched = items.filter((i) => i.enrichment);
  const buckets = bucketize(enriched, keysOf);
  return {
    eras: ERA_KEYS.map((k) => buckets.find((b) => b.key === k)).filter((b): b is Bucket<EraKey> => !!b),
    undetermined: enriched.filter((i) => keysOf(i).length === 0).length,
    notEnriched: items.length - enriched.length,
  };
}

/** Items whose era is unknown from every source – candidates for AI classification. */
export const withoutEra = (items: LibraryItem[]) =>
  items.filter((i) => i.enrichment && i.enrichment.setInPeriod.length === 0);

/** Rating activity heatmap: [year, month (0–11), count]. */
export function activityHeatmap(items: LibraryItem[]): { years: number[]; cells: [number, number, number][] } {
  const counts = new Map<string, number>();
  const years = new Set<number>();
  for (const it of items) {
    if (!isRated(it) || !it.ratedAt) continue;
    const d = new Date(it.ratedAt);
    const y = d.getUTCFullYear();
    years.add(y);
    const k = `${y}-${d.getUTCMonth()}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...years].sort((a, b) => a - b);
  const cells: [number, number, number][] = [];
  sorted.forEach((y, yi) => {
    for (let m = 0; m < 12; m++) cells.push([m, yi, counts.get(`${y}-${m}`) ?? 0]);
  });
  return { years: sorted, cells };
}
