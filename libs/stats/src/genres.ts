import { bucketize, type Bucket, byCountDesc, genresOf, isRated, type LibraryItem } from './model';

/** Minimum number of titles for a genre average to be considered reliable (SPEC §7.2). */
export const MIN_GENRE_TITLES = 3;

export interface GenreRow extends Bucket {
  reliable: boolean;
}

/** Titles per genre, sorted by count (desc). A title with several genres counts in each. */
export function genreCounts(items: LibraryItem[]): GenreRow[] {
  return bucketize(items, genresOf)
    .sort(byCountDesc)
    .map((b) => ({ ...b, reliable: b.count >= MIN_GENRE_TITLES }));
}

export interface GenreShareSeries {
  years: number[];
  /** genre → share (0–100) of ratings in each year, aligned with `years`. */
  series: { genre: string; shares: number[] }[];
}

/**
 * Share of genres among ratings, year by year (by rating date), normalised to 100%.
 * Only the top `maxGenres` genres are kept; the rest is grouped as "Inne".
 */
export function genreShareByYear(items: LibraryItem[], maxGenres = 8): GenreShareSeries {
  const rated = items.filter((i) => isRated(i) && i.ratedAt && genresOf(i).length);
  const top = genreCounts(rated)
    .slice(0, maxGenres)
    .map((g) => g.key);
  const years = [...new Set(rated.map((i) => Number(i.ratedAt!.slice(0, 4))))].sort((a, b) => a - b);
  const names = [...top, 'Inne'];
  const counts = new Map(names.map((g) => [g, years.map(() => 0)]));
  for (const it of rated) {
    const yi = years.indexOf(Number(it.ratedAt!.slice(0, 4)));
    for (const g of new Set(genresOf(it).map((g) => (top.includes(g) ? g : 'Inne')))) {
      counts.get(g)![yi]++;
    }
  }
  const totals = years.map((_, yi) => names.reduce((s, g) => s + counts.get(g)![yi], 0));
  return {
    years,
    series: names
      .map((genre) => ({
        genre,
        shares: counts.get(genre)!.map((c, yi) => (totals[yi] ? Math.round((c / totals[yi]) * 1000) / 10 : 0)),
      }))
      .filter((s) => s.shares.some((v) => v > 0)),
  };
}
