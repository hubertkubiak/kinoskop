import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA_VERSION, ExportItemSchema } from '@kinoskop/shared';
import { SCHEMA_VERSION } from './config';
import {
  dedupe,
  extractList,
  mapLoggedInfo,
  mapTitleInfo,
  mapVote,
  mapWant2see,
  ShapeError,
  toIsoDate,
} from './mappers';

// NOTE: synthetic fixtures – assumed shapes until Phase 0 confirms the real API.
const fx = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(__dirname, '../../../fixtures/filmweb/synthetic', name), 'utf8'),
  );

describe('import-script mappers (synthetic fixtures)', () => {
  it('keeps schema version in sync with libs/shared', () => {
    expect(SCHEMA_VERSION).toBe(EXPORT_SCHEMA_VERSION);
  });

  it('maps logged info', () => {
    expect(mapLoggedInfo(fx('logged-info.json'))).toEqual({ id: 1, name: 'ANON_USER' });
  });

  it('maps film votes and skips rating 0', () => {
    const items = extractList(fx('votes-film-1.json')).map((r) => mapVote(r, 'film'));
    expect(items[0]).toEqual({
      filmwebId: 1089,
      kind: 'film',
      list: 'rated',
      rating: 9,
      favorite: true,
      ratedAt: '2020-01-15T10:20:00.000Z',
    });
    expect(items[1].rating).toBeUndefined();
    expect(items[1].ratedAt).toBe('2020-09-13T12:26:40.000Z');
    expect(items[2].ratedAt).toBe('2019-03-12T00:00:00.000Z');
    for (const it of items) expect(ExportItemSchema.safeParse(it).success).toBe(true);
  });

  it('accepts wrapped lists and nested entity ids', () => {
    const [game] = extractList(fx('votes-game-1.json')).map((r) => mapVote(r, 'game'));
    expect(game).toMatchObject({ filmwebId: 612930, kind: 'game', rating: 8 });
  });

  it('maps want2see and title info', () => {
    const w = extractList(fx('want2see-film-1.json')).map((r) => mapWant2see(r, 'film'));
    expect(w.map((x) => x.filmwebId)).toEqual([1089, 555555]);
    expect(mapTitleInfo(fx('title-info.json'))).toEqual({
      title: 'Ojciec chrzestny',
      originalTitle: 'The Godfather',
      year: 1972,
    });
  });

  it('fails loudly on unknown shapes', () => {
    expect(() => extractList(fx('unknown-shape.json'))).toThrow(ShapeError);
    expect(() => mapVote({ foo: 1 }, 'film')).toThrow(/pola: foo/);
  });

  it('dedupes preferring the rated entry', () => {
    const out = dedupe([
      { filmwebId: 1, kind: 'film', list: 'want2see' },
      { filmwebId: 1, kind: 'film', list: 'rated', rating: 5 },
      { filmwebId: 1, kind: 'serial', list: 'want2see' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((i) => i.kind === 'film')?.list).toBe('rated');
  });

  it('parses dates defensively', () => {
    expect(toIsoDate('nope')).toBeUndefined();
    expect(toIsoDate(0)).toBeUndefined();
  });
});
