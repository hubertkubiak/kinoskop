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

export interface RatingBias {
  /** Titles compared (rated, TMDB average with enough votes). */
  n: number;
  myAvg: number;
  publicAvg: number;
  /** Mean of mine − public: > 0 means the user rates more generously than the public. */
  meanDiff: number;
  /** Share of titles rated at least 1 point above / below the public average. */
  higherShare: number;
  lowerShare: number;
  correlation?: number;
}

/** Plain-language summary of "me vs the public"; undefined without data. */
export function ratingBias(points: RatingPoint[]): RatingBias | undefined {
  if (!points.length) return undefined;
  const n = points.length;
  const sum = (f: (p: RatingPoint) => number) => points.reduce((s, p) => s + f(p), 0);
  return {
    n,
    myAvg: sum((p) => p.mine) / n,
    publicAvg: sum((p) => p.public) / n,
    meanDiff: sum((p) => p.mine - p.public) / n,
    higherShare: points.filter((p) => p.mine - p.public >= 1).length / n,
    lowerShare: points.filter((p) => p.public - p.mine >= 1).length / n,
    correlation: pearson(points.map((p) => p.mine), points.map((p) => p.public)),
  };
}

/** Verbal strength of a correlation coefficient (for non-statisticians). */
export function agreementLabel(r: number | undefined): string | undefined {
  if (r === undefined) return undefined;
  if (r >= 0.7) return 'bardzo zgodny';
  if (r >= 0.5) return 'raczej zgodny';
  if (r >= 0.3) return 'słabo zgodny';
  if (r > -0.3) return 'niezależny';
  return 'odwrotny';
}

export interface ByMyRatingRow {
  rating: number;
  n: number;
  /** Mean public average of the titles the user gave this rating. */
  publicAvg?: number;
}

/** For every rating 1–10 the user gave: how the public rated the same titles on average. */
export function publicByMyRating(points: RatingPoint[]): ByMyRatingRow[] {
  return Array.from({ length: 10 }, (_, i) => {
    const same = points.filter((p) => p.mine === i + 1);
    return {
      rating: i + 1,
      n: same.length,
      publicAvg: same.length ? Math.round((same.reduce((s, p) => s + p.public, 0) / same.length) * 10) / 10 : undefined,
    };
  });
}

export interface HarshnessRow {
  year: number;
  /** Ratings given in that year. */
  n: number;
  avg: number;
  /** Of those, titles with a public average (≥ MIN_PUBLIC_VOTES votes). */
  nPublic: number;
  /** Mean of mine − public in that year; corrects for watching better or worse titles. */
  diff?: number;
}

/**
 * "Surowość w czasie": per calendar year of rating (ratedAt), the user's mean rating and the mean
 * difference to the public average. Years with fewer than `minN` ratings are skipped as noise.
 */
export function harshnessByYear(items: LibraryItem[], minN = 10): HarshnessRow[] {
  const byYear = new Map<number, { ratings: number[]; diffs: number[] }>();
  for (const it of items) {
    if (!isRated(it) || !it.ratedAt) continue;
    const year = new Date(it.ratedAt).getUTCFullYear();
    if (!Number.isFinite(year)) continue;
    const row = byYear.get(year) ?? { ratings: [], diffs: [] };
    row.ratings.push(it.rating);
    const pr = it.enrichment?.publicRating;
    if (pr?.tmdb !== undefined && (pr.tmdbVotes ?? 0) >= MIN_PUBLIC_VOTES) row.diffs.push(it.rating - pr.tmdb);
    byYear.set(year, row);
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return [...byYear.entries()]
    .filter(([, r]) => r.ratings.length >= minN)
    .sort((a, b) => a[0] - b[0])
    .map(([year, r]) => ({
      year,
      n: r.ratings.length,
      avg: r2(r.ratings.reduce((s, x) => s + x, 0) / r.ratings.length),
      nPublic: r.diffs.length,
      diff: r.diffs.length >= minN ? r2(r.diffs.reduce((s, x) => s + x, 0) / r.diffs.length) : undefined,
    }));
}

/** Linear trend (slope per year) of a series; undefined below 3 points. */
export function trendPerYear(rows: { year: number; value?: number }[]): number | undefined {
  const pts = rows.filter((r): r is { year: number; value: number } => r.value !== undefined);
  if (pts.length < 3) return undefined;
  const mx = pts.reduce((s, p) => s + p.year, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.value, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.year - mx) * (p.value - my);
    den += (p.year - mx) ** 2;
  }
  return den === 0 ? undefined : num / den;
}
