import { describe, expect, it } from 'vitest';
import { collaboratorsOf, directorActorDuos, tasteAffinities } from './affinity';
import { personKey } from './model';
import { LIBRARY, P } from './testing/fixture';

describe('tasteAffinities', () => {
  // overall = 58 / 8 = 7.25; lift = (n·avg + 3·overall) / (n + 3) − overall
  it('ranks features that go with higher and lower ratings, shrunk towards the overall mean', () => {
    const a = tasteAffinities(LIBRARY, 2);
    expect(a.overall).toBe(7.25);
    // PL: 10, 6, 9 → lift 0.54; Bale: 9, 8 → lift 0.5
    expect(a.boosts.map((b) => [b.label, b.n, b.lift])).toEqual([
      ['PL', 3, 0.54],
      ['Christian Bale', 2, 0.5],
    ]);
    // US: 9, 8, 4, 7, 5 → lift −0.41
    expect(a.drags[0]).toMatchObject({ kind: 'country', key: 'US', n: 5, avg: 6.6, lift: -0.41 });
    // Nolan: 9, 8, 4 → lift −0.125, too small to show
    expect([...a.boosts, ...a.drags].some((x) => x.label === 'Christopher Nolan')).toBe(false);
  });

  it('skips features below the minimum number of titles', () => {
    expect(tasteAffinities(LIBRARY, 4).boosts).toEqual([]);
  });
});

describe('directorActorDuos', () => {
  it('pairs directors with actors from shared watched titles', () => {
    const d = directorActorDuos(LIBRARY, 2);
    expect(d.map((x) => [x.director.name, x.actor.name, x.titles.length, x.avg])).toEqual([
      ['Christopher Nolan', 'Michael Caine', 3, 7],
      ['Christopher Nolan', 'Christian Bale', 2, 8.5],
    ]);
  });
});

describe('collaboratorsOf', () => {
  it('lists people sharing at least two titles with the creator', () => {
    const c = collaboratorsOf(LIBRARY, personKey(P.nolan));
    expect(c.person?.name).toBe('Christopher Nolan');
    expect(c.collaborators.map((x) => [x.person.name, x.titles.length])).toEqual([
      ['Michael Caine', 3],
      ['Christian Bale', 2],
    ]);
    expect(collaboratorsOf(LIBRARY, 'tmdb:0')).toEqual({ person: undefined, collaborators: [] });
  });
});
