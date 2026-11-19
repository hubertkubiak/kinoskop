import { emptyEnrichment, itemKey } from '@kinoskop/shared';
import { describe, expect, it } from 'vitest';
import {
  agreementLabel,
  harshnessByYear,
  publicByMyRating,
  ratingBias,
  type RatingPoint,
  trendPerYear,
} from './ratings';
import type { LibraryItem } from './model';

let id = 0;
function rated(rating: number, ratedAt: string, tmdb?: number, votes = 100): LibraryItem {
  const base = { filmwebId: ++id, kind: 'film' as const, list: 'rated' as const, rating, ratedAt };
  const enrichment = emptyEnrichment(base.filmwebId, 'film', { method: 'wikidata', confidence: 1 });
  if (tmdb !== undefined) enrichment.publicRating = { tmdb, tmdbVotes: votes };
  return { ...base, key: itemKey(base), enrichment };
}

describe('harshnessByYear', () => {
  it('groups by year of rating, skips small years and averages the difference to TMDB', () => {
    const items = [
      // 2015: 3 ratings, avg 8, diffs +1, +1, (no tmdb)
      rated(8, '2015-03-01T00:00:00Z', 7),
      rated(9, '2015-06-01T00:00:00Z', 8),
      rated(7, '2015-12-31T23:00:00Z'),
      // 2020: 3 ratings, avg 6, diffs −1, −2, −1.5 (one under the vote threshold is ignored)
      rated(6, '2020-01-01T00:00:00Z', 7),
      rated(5, '2020-02-01T00:00:00Z', 7),
      rated(7, '2020-03-01T00:00:00Z', 8.5),
      rated(7, '2020-03-02T00:00:00Z', 1, 10),
      // 2021: a single rating → skipped
      rated(10, '2021-01-01T00:00:00Z', 5),
    ];
    expect(harshnessByYear(items, 2)).toEqual([
      { year: 2015, n: 3, avg: 8, nPublic: 2, diff: 1 },
      { year: 2020, n: 4, avg: 6.25, nPublic: 3, diff: -1.5 },
    ]);
  });

  it('ignores want2see items and ratings without a date', () => {
    const w = { ...rated(9, '2019-01-01T00:00:00Z', 5), list: 'want2see' as const };
    const noDate = { ...rated(9, '2019-01-01T00:00:00Z', 5), ratedAt: undefined };
    expect(harshnessByYear([w, noDate], 1)).toEqual([]);
  });
});

describe('trendPerYear', () => {
  it('returns the least-squares slope', () => {
    expect(trendPerYear([{ year: 2000, value: 8 }, { year: 2001, value: 7.5 }, { year: 2002, value: 7 }])).toBeCloseTo(-0.5);
    expect(trendPerYear([{ year: 2000, value: 8 }, { year: 2001 }])).toBeUndefined();
  });
});

const pt = (mine: number, pub: number): RatingPoint => ({ key: `${mine}-${pub}`, title: 't', mine, public: pub });

describe('ratingBias & publicByMyRating', () => {
  it('summarises how generous the user is compared to the public', () => {
    const b = ratingBias([pt(8, 7), pt(6, 7), pt(9, 7.5), pt(4, 6)])!;
    expect(b.n).toBe(4);
    expect(b.myAvg).toBe(6.75);
    expect(b.publicAvg).toBeCloseTo(6.875);
    expect(b.meanDiff).toBeCloseTo(-0.125);
    expect(b.higherShare).toBe(0.5); // 8 vs 7, 9 vs 7.5
    expect(b.lowerShare).toBe(0.5); // 6 vs 7, 4 vs 6
    expect(ratingBias([])).toBeUndefined();
  });

  it('averages the public rating per rating the user gave', () => {
    const rows = publicByMyRating([pt(8, 7), pt(8, 7.4), pt(3, 5)]);
    expect(rows).toHaveLength(10);
    expect(rows[7]).toEqual({ rating: 8, n: 2, publicAvg: 7.2 });
    expect(rows[2]).toEqual({ rating: 3, n: 1, publicAvg: 5 });
    expect(rows[0]).toEqual({ rating: 1, n: 0, publicAvg: undefined });
  });

  it('describes correlation in words', () => {
    expect(agreementLabel(0.75)).toBe('bardzo zgodny');
    expect(agreementLabel(0.55)).toBe('raczej zgodny');
    expect(agreementLabel(0.1)).toBe('niezależny');
    expect(agreementLabel(undefined)).toBeUndefined();
  });
});
