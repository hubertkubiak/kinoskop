import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { MemoryCacheStore } from './cache/cache-store';
import { bestMatch, matchConfidence, normalizeTitle, titleSimilarity } from './enrich/matching';
import { parseOmdb } from './sources/omdb';
import type { Sources } from './enrich/pipeline';
import type { Env } from './env';

const env: Env = {
  TMDB_API_TOKEN: '',
  TWITCH_CLIENT_ID: '',
  TWITCH_CLIENT_SECRET: '',
  OMDB_API_KEY: 'secret-omdb-key',
  WIKIDATA_CONTACT: 'test@example.org',
  WEB_ORIGIN: 'http://localhost:4200',
  PORT: 0,
  HOST: 'localhost',
  CACHE_DB_PATH: ':memory:',
  NODE_ENV: 'test',
};

/** Fake Wikidata: knows Filmweb id 1089 → Q47703 (The Godfather). */
function fakeSources() {
  const query = vi.fn(async (sparql: string) => {
    if (sparql.includes('VALUES ?fw')) {
      return sparql.includes('"1089"')
        ? [
            {
              item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q47703' },
              fw: { type: 'literal', value: '1089' },
              tmdb: { type: 'literal', value: '238' },
              label: { type: 'literal', value: 'Ojciec chrzestny' },
              date: { type: 'literal', value: '1972-03-15T00:00:00Z' },
            },
          ]
        : [];
    }
    if (sparql.includes('wdt:P495')) {
      return [{ item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q47703' }, iso: { type: 'literal', value: 'US' } }];
    }
    return [];
  });
  const sources = {
    wikidata: { query },
    tmdb: { enabled: false },
    igdb: { enabled: false },
    omdb: { enabled: false },
  } as unknown as Sources;
  return { sources, query };
}

async function app() {
  const { sources, query } = fakeSources();
  const a = await buildApp({
    env,
    cache: new MemoryCacheStore(),
    sources,
    logger: false,
    catalog: {
      catalog: { generatedAt: '2026-11-01T00:00:00.000Z', source: 'wikidata', awards: [], entries: [] },
      json: '{}',
      etag: '"x"',
      lookup: ({ wikidataId }) =>
        wikidataId === 'Q47703' ? [{ awardKey: 'oscar-picture', year: 1973, won: true, category: 'Oscar' }] : [],
    },
  });
  return { a, query };
}

describe('matching', () => {
  it('normalises diacritics and articles', () => {
    expect(normalizeTitle('The Łódź Story: Część II')).toBe('lodz story czesc ii');
    expect(titleSimilarity('Incepcja', 'Incepcja')).toBe(1);
    expect(titleSimilarity('Matrix', 'Matrix Reloaded')).toBeLessThan(0.8);
  });

  it('scores title and year', () => {
    expect(matchConfidence({ titles: ['The Godfather'], year: 1972 }, { titles: ['Godfather'], year: 1972 })).toBe(1);
    expect(matchConfidence({ titles: ['Dune'], year: 2021 }, { titles: ['Dune'], year: 1984 })).toBe(0.75);
    const best = bestMatch({ titles: ['Dune'], year: 2021 }, [
      { titles: ['Dune'], year: 1984 },
      { titles: ['Dune'], year: 2021 },
    ]);
    expect(best?.candidate.year).toBe(2021);
  });
});

describe('omdb parser', () => {
  it('extracts scores', () => {
    expect(
      parseOmdb({
        Response: 'True',
        imdbRating: '9.2',
        Metascore: '100',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '97%' }],
      }),
    ).toEqual({ imdb: 9.2, rottenTomatoes: 97, metacritic: 100 });
    expect(parseOmdb({ Response: 'False' })).toBeUndefined();
  });
});

describe('API', () => {
  it('reports integrations without exposing key values', async () => {
    const { a } = await app();
    const res = await a.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().integrations).toEqual({ wikidata: true, tmdb: false, igdb: false, omdb: true });
    expect(res.body).not.toContain('secret-omdb-key');
    expect((await a.inject({ method: 'GET', url: '/api/config' })).json()).toEqual({
      criticsEnabled: true,
      gamesEnabled: false,
      tmdbEnabled: false,
    });
  });

  it('rejects requests containing ratings', async () => {
    const { a } = await app();
    const res = await a.inject({ method: 'POST', url: '/api/enrich', payload: { items: [{ filmwebId: 1, kind: 'film', rating: 9 }] } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects batches over 200 items', async () => {
    const { a } = await app();
    const items = Array.from({ length: 201 }, (_, i) => ({ filmwebId: i + 1, kind: 'film' }));
    expect((await a.inject({ method: 'POST', url: '/api/enrich', payload: { items } })).statusCode).toBe(400);
  });

  it('enriches via Wikidata, reports unmatched and serves the second run fully from cache', async () => {
    const { a, query } = await app();
    const payload = { items: [{ filmwebId: 1089, kind: 'film' }, { filmwebId: 42, kind: 'film' }] };
    const first = (await a.inject({ method: 'POST', url: '/api/enrich', payload })).json();
    expect(first.results).toHaveLength(1);
    expect(first.results[0]).toMatchObject({
      filmwebId: 1089,
      title: 'Ojciec chrzestny',
      year: 1972,
      countries: ['US'],
      match: { method: 'wikidata', wikidataId: 'Q47703', tmdbId: 238, confidence: 1 },
      awards: [{ awardKey: 'oscar-picture', won: true }],
    });
    expect(first.errors).toEqual([expect.objectContaining({ filmwebId: 42, code: 'unmatched' })]);

    const calls = query.mock.calls.length;
    const second = (await a.inject({ method: 'POST', url: '/api/enrich', payload })).json();
    expect(second.cacheHits).toBe(2);
    expect(query.mock.calls.length).toBe(calls);
  });

  it('never looks up local (CSV) ids in Wikidata and rejects id 0', async () => {
    const { a, query } = await app();
    const payload = { items: [{ filmwebId: -12345, kind: 'film', title: 'Paris, Texas', year: 1984 }] };
    const res = (await a.inject({ method: 'POST', url: '/api/enrich', payload })).json();
    expect(res.errors).toEqual([expect.objectContaining({ filmwebId: -12345, code: 'unmatched' })]);
    expect(query.mock.calls.some(([q]) => String(q).includes('VALUES ?fw'))).toBe(false);
    const zero = await a.inject({ method: 'POST', url: '/api/enrich', payload: { items: [{ filmwebId: 0, kind: 'film' }] } });
    expect(zero.statusCode).toBe(400);
  });

  it('serves the awards catalogue with an ETag', async () => {
    const { a } = await app();
    const res = await a.inject({ method: 'GET', url: '/api/awards' });
    expect(res.headers['etag']).toBe('"x"');
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect((await a.inject({ method: 'GET', url: '/api/awards', headers: { 'if-none-match': '"x"' } })).statusCode).toBe(304);
  });
});
