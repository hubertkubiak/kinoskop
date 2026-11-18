import { displayTitle, isRated, type LibraryItem } from './model';

/** Minimum TMDB vote count for the public average to be meaningful (SPEC §7.3). */
export const MIN_PUBLIC_VOTES = 50;

export interface RatingPoint {
  key: string;
  title: string;
  mine: number;
  public: number;
  posterUrl?: string;
}

/** Points "my rating vs TMDB average" for titles with enough public votes. */
export function ratingVsPublic(items: LibraryItem[]): RatingPoint[] {
  const out: RatingPoint[] = [];
  for (const it of items) {
    const pr = it.enrichment?.publicRating;
    if (!isRated(it) || pr?.tmdb === undefined || (pr.tmdbVotes ?? 0) < MIN_PUBLIC_VOTES) continue;
    out.push({
      key: it.key,
      title: displayTitle(it),
      mine: it.rating,
      public: Math.round(pr.tmdb * 10) / 10,
      posterUrl: it.enrichment?.posterUrl,
    });
  }
  return out;
}

/** Histogram (1–10) of public averages rounded to the nearest integer. */
export function publicRatingDistribution(points: RatingPoint[]): number[] {
  const out = Array.from({ length: 10 }, () => 0);
  for (const p of points) out[Math.min(10, Math.max(1, Math.round(p.public))) - 1]++;
  return out;
}

export interface Divergences {
  likedMore: (RatingPoint & { diff: number })[];
  likedLess: (RatingPoint & { diff: number })[];
}

/** "Rozjazdy": the biggest positive and negative differences mine − public. */
export function divergences(points: RatingPoint[], n = 20): Divergences {
  const withDiff = points.map((p) => ({ ...p, diff: Math.round((p.mine - p.public) * 10) / 10 }));
  return {
    likedMore: withDiff
      .filter((p) => p.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, n),
    likedLess: withDiff
      .filter((p) => p.diff < 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, n),
  };
}

/** Pearson correlation coefficient; undefined for fewer than 3 pairs or zero variance. */
export function pearson(xs: number[], ys: number[]): number | undefined {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return undefined;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return undefined;
  return num / Math.sqrt(dx * dy);
}
