import { describe, expect, it } from 'vitest';
import {
  EnrichRequestSchema,
  eraFromLabel,
  eraFromYear,
  mapGenres,
  mergeEras,
  parseExportFile,
} from './index';

const validFile = {
  schemaVersion: 1,
  exportedAt: '2026-11-18T10:00:00.000Z',
  source: 'filmweb',
  user: { id: 1, name: 'anon' },
  items: [
    { filmwebId: 1089, kind: 'film', list: 'rated', rating: 9, ratedAt: '2020-01-02T10:00:00.000Z' },
    { filmwebId: 430668, kind: 'serial', list: 'want2see' },
  ],
};

describe('parseExportFile', () => {
  it('accepts a valid file', () => {
    const r = parseExportFile(JSON.stringify(validFile));
    expect(r.ok).toBe(true);
  });

  it('reports invalid JSON', () => {
    expect(parseExportFile('{nope')).toMatchObject({ ok: false, reason: 'json' });
  });

  it('reports an unsupported schema version', () => {
    const r = parseExportFile(JSON.stringify({ ...validFile, schemaVersion: 7 }));
    expect(r).toMatchObject({ ok: false, reason: 'version', schemaVersion: 7 });
  });

  it('rejects out-of-range ratings', () => {
    const bad = { ...validFile, items: [{ ...validFile.items[0], rating: 11 }] };
    expect(parseExportFile(JSON.stringify(bad))).toMatchObject({ ok: false, reason: 'schema' });
  });
});

describe('EnrichRequestSchema', () => {
  it('never accepts ratings', () => {
    const r = EnrichRequestSchema.safeParse({ items: [{ filmwebId: 1, kind: 'film', rating: 8 }] });
    expect(r.success).toBe(false);
  });
});

describe('eras', () => {
  it.each([
    ['1940s', '1940s'],
    ['World War II', 'ww2'],
    ['19th century', '19c'],
    ['16th century', 'renaissance'],
    ['1880s', '19c'],
    ['2010s', 'contemporary'],
    ['medieval', 'middle-ages'],
    ['ancient rome', 'antiquity'],
    ['5th century BC', 'antiquity'],
    ['dystopia', 'future'],
  ])('maps label %s → %s', (label, era) => {
    expect(eraFromLabel(label)).toBe(era);
  });

  it('returns undefined for unrelated labels', () => {
    expect(eraFromLabel('based on novel or book')).toBeUndefined();
  });

  it('buckets years', () => {
    expect(eraFromYear(1975)).toBe('1970s');
    expect(eraFromYear(-200)).toBe('antiquity');
    expect(eraFromYear(2024)).toBe('contemporary');
  });

  it('merges eras keeping the most certain source, chronologically', () => {
    const merged = mergeEras(
      [{ key: 'future', source: 'ai' }],
      [
        { key: '1940s', source: 'keywords' },
        { key: 'future', source: 'wikidata' },
      ],
    );
    expect(merged).toEqual([
      { key: '1940s', source: 'keywords' },
      { key: 'future', source: 'wikidata' },
    ]);
  });
});

describe('genres', () => {
  it('maps TMDB and Wikidata names to Polish', () => {
    expect(mapGenres(['Drama', 'Science Fiction', 'drama film'], 'film')).toEqual([
      'Dramat',
      'Sci-Fi',
    ]);
    expect(mapGenres(['Sci-Fi & Fantasy'], 'serial')).toEqual(['Sci-Fi', 'Fantasy']);
    expect(mapGenres(['Role-playing (RPG)', 'Indie'], 'game')).toEqual(['RPG', 'Niezależna']);
  });
});
