import type { AwardCatalog } from '@kinoskop/shared';
import { describe, expect, it } from 'vitest';
import { awardAffinity, awardTimeline, recommendations } from './awards';
import { LIBRARY } from './testing/fixture';

const def = (key: string) => ({ key, namePl: key, shortPl: key, kind: 'film' as const, qid: 'Q1', personal: false });
const work = (wikidataId: string, filmwebId?: number, genres: string[] = []) => ({ wikidataId, title: wikidataId, filmwebId, genres });

// Library ratings (films): 1→9, 2→8, 3→10, 4→4, 5→6; overall mean of all ratings = 7.25.
const CATALOG: AwardCatalog = {
  generatedAt: '2026-11-18T00:00:00.000Z',
  source: 'wikidata',
  awards: [def('loved'), def('hated'), def('thin')],
  entries: [
    { awardKey: 'loved', year: 2011, won: true, work: work('Qa', 1) },
    { awardKey: 'loved', year: 2009, won: true, work: work('Qb', 2) },
    { awardKey: 'loved', year: 1994, won: true, work: work('Qc', 3) },
    { awardKey: 'loved', year: 2020, won: true, work: work('Qnew', undefined, ['Dramat']) },
    { awardKey: 'loved', year: 2024, won: true, work: work('Qwant', 30, ['Dramat']) },
    { awardKey: 'hated', year: 2015, won: true, work: work('Qd', 4) },
    { awardKey: 'hated', year: 2000, won: true, work: work('Qe', 5) },
    { awardKey: 'hated', year: 2001, won: true, work: work('Qf', 2) },
    { awardKey: 'thin', year: 2001, won: true, work: work('Qg', 1) },
    { awardKey: 'thin', year: 2002, won: false, work: work('Qh', 3) },
  ],
};

describe('award affinity', () => {
  const rows = awardAffinity(LIBRARY, CATALOG);
  const by = (k: string) => rows.find((r) => r.award.key === k)!;

  it('computes coverage, shrunk score and delta', () => {
    const loved = by('loved');
    expect(loved).toMatchObject({ winners: 5, watched: 3, n: 3, avg: 9, insufficient: false });
    // (3·9 + 5·7.25) / 8 = 7.906 → delta 0.66
    expect(loved.score).toBe(7.9);
    expect(loved.delta).toBe(0.66);
    expect(loved.hitRate).toBe(1);
    expect(loved.coverage).toBeCloseTo(0.6);
    // (3·6 + 5·7.25) / 8 = 6.78 → delta −0.47
    expect(by('hated').delta).toBe(-0.47);
  });

  it('marks awards with n < 3 as insufficient and ranks by delta', () => {
    expect(by('thin')).toMatchObject({ n: 1, insufficient: true, score: undefined, delta: undefined });
    expect(rows.map((r) => r.award.key)).toEqual(['loved', 'hated', 'thin']);
  });
});

describe('recommendations and timeline', () => {
  it('recommends unwatched winners of compatible awards, flagging want-to-see', () => {
    const recs = recommendations(LIBRARY, CATALOG, awardAffinity(LIBRARY, CATALOG));
    expect(recs.map((r) => r.entry.work.wikidataId)).toEqual(['Qwant', 'Qnew']);
    expect(recs[0].inWant2see?.filmwebId).toBe(30);
  });

  it('labels timeline points', () => {
    const t = awardTimeline(LIBRARY, CATALOG);
    expect(t).toHaveLength(9);
    expect(t.find((p) => p.entry.work.wikidataId === 'Qa')).toMatchObject({ status: 'watched', rating: 9 });
    expect(t.find((p) => p.entry.work.wikidataId === 'Qwant')?.status).toBe('want2see');
    expect(awardTimeline(LIBRARY, CATALOG, true)).toHaveLength(10);
  });
});
