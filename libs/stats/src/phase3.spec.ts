import { describe, expect, it } from 'vitest';
import {
  activityHeatmap,
  countryStats,
  eraStats,
  nationalityStats,
  peopleRanking,
  tasteProfile,
  tasteScore,
  titlesOfPerson,
  withoutEra,
} from './index';
import { personKey } from './model';
import { LIBRARY, P } from './testing/fixture';

const rated = LIBRARY.filter((i) => i.list === 'rated');

describe('world', () => {
  it('counts production countries (multi-country titles count for each)', () => {
    expect(countryStats(rated).map((b) => [b.key, b.count])).toEqual([
      ['US', 5],
      ['PL', 3],
      ['GB', 2],
      ['FR', 1],
    ]);
  });

  it('counts director nationalities with unknown bucket', () => {
    const rows = Object.fromEntries(nationalityStats(rated, 'director').map((b) => [b.key, b.count]));
    // Nolan (GB+US) directs 3 films → GB 3, US 3; Kieślowski → PL 1; 4 titles without directors → unknown
    expect(rows).toEqual({ GB: 3, US: 3, PL: 1, unknown: 4 });
  });
});

describe('time & eras', () => {
  it('reports eras chronologically and undetermined titles honestly', () => {
    const s = eraStats(LIBRARY);
    expect(s.eras.map((e) => e.key)).toEqual(['1990s', 'contemporary', 'future']);
    expect(s.undetermined).toBe(6);
    expect(s.notEnriched).toBe(1);
    expect(eraStats(LIBRARY, true).eras.map((e) => e.key)).toEqual(['1990s', 'contemporary']);
    expect(withoutEra(LIBRARY)).toHaveLength(6);
  });

  it('builds the year × month heatmap', () => {
    const h = activityHeatmap(LIBRARY);
    expect(h.years).toEqual([2020, 2021, 2022]);
    expect(h.cells.find((c) => c[0] === 0 && c[1] === 0)?.[2]).toBe(2);
  });
});

describe('people', () => {
  it('ranks directors with min count', () => {
    const rows = peopleRanking(rated, 'director', 2);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ person: { name: 'Christopher Nolan' }, count: 3, avg: 7 });
    expect(peopleRanking(rated, 'cast', 1)[0]).toMatchObject({ person: { name: 'Michael Caine' }, count: 3 });
    expect(titlesOfPerson(LIBRARY, personKey(P.binoche))).toHaveLength(1);
  });
});

describe('taste score', () => {
  it('scores want-to-see titles from genre/country averages', () => {
    const profile = tasteProfile(LIBRARY);
    const want = LIBRARY.find((i) => i.filmwebId === 30)!;
    const score = tasteScore(want, profile)!;
    expect(score).toBeGreaterThan(6);
    expect(score).toBeLessThan(8);
    expect(tasteScore(LIBRARY.find((i) => i.filmwebId === 31)!, profile)).toBeUndefined();
  });
});
