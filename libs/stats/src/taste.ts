import { bucketize, isRated, type LibraryItem, personKey } from './model';

/** User's mean rating per feature (genre / director / country) with its support. */
export interface TasteProfile {
  overall: number;
  genres: Map<string, { avg: number; n: number }>;
  directors: Map<string, { avg: number; n: number }>;
  countries: Map<string, { avg: number; n: number }>;
}

function toMap(b: { key: string; rated: number; avg?: number }[]) {
  return new Map(b.filter((x) => x.avg !== undefined && x.rated > 0).map((x) => [x.key, { avg: x.avg!, n: x.rated }]));
}

export function tasteProfile(items: LibraryItem[]): TasteProfile {
  const rated = items.filter(isRated);
  const overall = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : 0;
  return {
    overall,
    genres: toMap(bucketize(rated, (i) => i.enrichment?.genres ?? [])),
    directors: toMap(bucketize(rated, (i) => (i.enrichment?.directors ?? []).map(personKey))),
    countries: toMap(bucketize(rated, (i) => i.enrichment?.countries ?? [])),
  };
}

/**
 * "Best match for your taste" (SPEC §7.9): mean of the user's averages for the title's genres,
 * directors and countries, each weighted by how many ratings support it (shrunk towards the
 * overall mean with k = 3). Returns undefined when nothing is known about the title.
 */
export function tasteScore(it: LibraryItem, p: TasteProfile, k = 3): number | undefined {
  const e = it.enrichment;
  if (!e) return undefined;
  const parts: { avg: number; n: number }[] = [
    ...e.genres.map((g) => p.genres.get(g)),
    ...e.directors.map((d) => p.directors.get(personKey(d))),
    ...e.countries.map((c) => p.countries.get(c)),
  ].filter((x): x is { avg: number; n: number } => !!x);
  if (!parts.length) return undefined;
  let num = 0;
  let den = 0;
  for (const x of parts) {
    const shrunk = (x.n * x.avg + k * p.overall) / (x.n + k);
    num += shrunk * x.n;
    den += x.n;
  }
  return Math.round((num / den) * 100) / 100;
}
