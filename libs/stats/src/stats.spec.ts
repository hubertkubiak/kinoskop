import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  divergences,
  EMPTY_FILTERS,
  filtersToParams,
  genreCounts,
  genreShareByYear,
  kpis,
  paramsToFilters,
  pearson,
  ratingDistribution,
  ratingsOverTime,
  ratingVsPublic,
  type Filters,
} from './index';
import { LIBRARY, P } from './testing/fixture';
import { personKey } from './model';

const rated = LIBRARY.filter((i) => i.list === 'rated');
const f = (patch: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...patch });

describe('genreCounts (hand-counted)', () => {
  it('matches manually counted values', () => {
    const rows = genreCounts(rated).map((r) => [r.key, r.count]);
    expect(rows).toEqual([
      ['Dramat', 5],
      ['Thriller', 3],
      ['Kryminał', 2],
      ['Sci-Fi', 2],
      ['Komedia', 1],
      ['RPG', 1],
    ]);
  });

  it('computes averages and reliability', () => {
    const drama = genreCounts(rated).find((r) => r.key === 'Dramat')!;
    // ratings 8, 10, 4, 7, 5 → 34 / 5 = 6.8
    expect(drama.avg).toBe(6.8);
    expect(drama.reliable).toBe(true);
    expect(genreCounts(rated).find((r) => r.key === 'RPG')!.reliable).toBe(false);
  });

  it('per kind', () => {
    expect(genreCounts(rated.filter((i) => i.kind === 'serial')).map((r) => r.key)).toEqual([
      'Dramat',
      'Kryminał',
      'Thriller',
    ]);
  });
});

describe('kpis', () => {
  it('summarises the library', () => {
    const k = kpis(LIBRARY);
    expect(k.ratedByKind).toEqual({ film: 5, serial: 2, game: 1 });
    expect(k.want2see).toBe(2);
    // (9+8+10+4+6+7+5+9) / 8 = 58 / 8 = 7.25 → 7.3
    expect(k.averageRating).toBe(7.3);
    expect(k.screenTimeMinutes).toBe(148 + 152 + 98 + 169);
    expect(k.topGenreByKind).toEqual({ film: 'Dramat', serial: 'Dramat', game: 'RPG' });
  });
});

describe('distributions', () => {
  it('rating distribution', () => {
    expect(ratingDistribution(LIBRARY)).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 2, 1]);
  });

  it('ratings over time fills empty months', () => {
    const t = ratingsOverTime(LIBRARY);
    expect(t[0]).toEqual({ month: '2020-01', count: 2, avg: 8.5 });
    expect(t[1]).toEqual({ month: '2020-02', count: 0, avg: undefined });
    expect(t.at(-1)?.month).toBe('2022-01');
  });

  it('genre share by year sums to ~100', () => {
    const s = genreShareByYear(LIBRARY);
    expect(s.years).toEqual([2020, 2021, 2022]);
    for (let i = 0; i < s.years.length; i++) {
      const total = s.series.reduce((sum, x) => sum + x.shares[i], 0);
      expect(Math.round(total)).toBe(100);
    }
  });
});

describe('filters', () => {
  it('filters by kind and list', () => {
    expect(applyFilters(LIBRARY, f({ kinds: ['serial'] }))).toHaveLength(2);
    expect(applyFilters(LIBRARY, f({ lists: ['want2see'] }))).toHaveLength(2);
  });

  it('genres any / all', () => {
    expect(applyFilters(LIBRARY, f({ genres: ['Sci-Fi', 'Komedia'] }))).toHaveLength(3);
    expect(applyFilters(LIBRARY, f({ genres: ['Dramat', 'Thriller'], genreMode: 'all' }))).toHaveLength(2);
  });

  it('combines rating, year, director nationality and people', () => {
    expect(applyFilters(LIBRARY, f({ rating: [8, 10], year: [2000, 2020] })).map((i) => i.filmwebId)).toEqual([1, 2]);
    expect(applyFilters(LIBRARY, f({ directorNationalities: ['PL'] })).map((i) => i.filmwebId)).toEqual([3]);
    expect(applyFilters(LIBRARY, f({ people: [personKey(P.nolan), personKey(P.bale)] }))).toHaveLength(2);
  });

  it('eras with certain-only switch', () => {
    expect(applyFilters(LIBRARY, f({ eras: ['future'] }))).toHaveLength(1);
    expect(applyFilters(LIBRARY, f({ eras: ['future'], erasCertainOnly: true }))).toHaveLength(0);
  });

  it('awards, favourites and rating date', () => {
    expect(applyFilters(LIBRARY, f({ awards: ['oscar-picture'] }))).toHaveLength(1);
    expect(applyFilters(LIBRARY, f({ awards: ['oscar-picture'], awardMode: 'won' }))).toHaveLength(0);
    expect(applyFilters(LIBRARY, f({ favorite: true }))).toHaveLength(1);
    expect(applyFilters(LIBRARY, f({ ratedAt: ['2021-01-01', '2021-06-30'] }))).toHaveLength(2);
  });

  it('round-trips through query params', () => {
    const filters = f({
      kinds: ['film', 'game'],
      rating: [6, 9],
      ratedAt: ['2020-01-01', '2020-12-31'],
      genres: ['Dramat'],
      genreMode: 'all',
      eras: ['ww2'],
      favorite: true,
    });
    expect(paramsToFilters(filtersToParams(filters))).toEqual(filters);
    expect(paramsToFilters({ typ: 'film,hacker', ocena: '9..3', epoka: 'nope' })).toEqual(
      f({ kinds: ['film'] }),
    );
  });

  it('filters 3000 items in under 50 ms', () => {
    const big = Array.from({ length: 300 }, (_, n) =>
      LIBRARY.map((i) => ({ ...i, key: `${i.key}-${n}` })),
    ).flat();
    const filters = f({ genres: ['Dramat'], countries: ['US'], rating: [5, 10], people: [personKey(P.caine)] });
    const t0 = performance.now();
    applyFilters(big, filters);
    genreCounts(big);
    kpis(big);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});

describe('ratings vs public', () => {
  it('skips titles under the vote threshold', () => {
    expect(ratingVsPublic(LIBRARY).map((p) => p.key)).toEqual(['film:1', 'film:2', 'film:3', 'film:4']);
  });

  it('divergences and correlation', () => {
    const pts = ratingVsPublic(LIBRARY);
    const d = divergences(pts);
    expect(d.likedMore[0]).toMatchObject({ key: 'film:3', diff: 2.3 });
    expect(d.likedLess[0]).toMatchObject({ key: 'film:4', diff: -4.4 });
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeUndefined();
  });
});
