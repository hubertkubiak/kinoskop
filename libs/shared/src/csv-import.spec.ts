import { describe, expect, it } from 'vitest';
import {
  classifyCsvFileName,
  importCsvFiles,
  localItemId,
  looksLikeTitleCsv,
  parseCsv,
} from './csv-import';
import { ExportFileSchema } from './export-file';

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, CRLF, BOM and blank lines', () => {
    const text = String.fromCharCode(0xfeff) + 'Title,Year\r\n"Paris, Texas",1984\r\n"Say ""hi""",2001\r\n\r\nPlain,1999';
    expect(parseCsv(text)).toEqual([
      ['Title', 'Year'],
      ['Paris, Texas', '1984'],
      ['Say "hi"', '2001'],
      ['Plain', '1999'],
    ]);
  });
});

describe('classifyCsvFileName', () => {
  it.each([
    ['Filmweb2Letterboxd_watched_film_0.csv', 'film', 'rated'],
    ['Filmweb2Letterboxd_watched_serial_0.csv', 'serial', 'rated'],
    ['Filmweb2Letterboxd_watched_tvshow_0.csv', 'serial', 'rated'],
    ['Filmweb2Letterboxd_watched_videogame_0.csv', 'game', 'rated'],
    ['Filmweb2Letterboxd_watchlist_film_0.csv', 'film', 'want2see'],
    ['ratings.csv', 'film', 'rated'],
    ['watchlist.csv', 'film', 'want2see'],
  ])('%s → %s/%s', (name, kind, list) => {
    expect(classifyCsvFileName(name)).toEqual({ kind, list });
  });
});

describe('looksLikeTitleCsv', () => {
  it('detects Title or Name header', () => {
    expect(looksLikeTitleCsv('Title,Year,WatchedDate,Rating10\nX,1,,')).toBe(true);
    expect(looksLikeTitleCsv('Date,Name,Year,Letterboxd URI,Rating')).toBe(true);
    expect(looksLikeTitleCsv('{"schemaVersion":1}')).toBe(false);
  });
});

describe('localItemId', () => {
  it('is negative, deterministic and normalises whitespace/case', () => {
    const a = localItemId('film', 'Paris, Texas', 1984);
    expect(a).toBeLessThan(0);
    expect(localItemId('film', '  paris,  TEXAS ', 1984)).toBe(a);
    expect(localItemId('serial', 'Paris, Texas', 1984)).not.toBe(a);
  });
});

describe('importCsvFiles', () => {
  const now = new Date('2026-11-18T12:00:00Z');

  it('converts Filmweb2Letterboxd files into a valid ExportFile', () => {
    const res = importCsvFiles(
      [
        { name: 'X_watched_film_0.csv', text: 'Title,Year,WatchedDate,Rating10\n"Paris, Texas",1984,2023-12-25,8\nAnother Earth,2011,2016-05-24,\n' },
        { name: 'X_watched_film_1.csv', text: 'Title,Year,WatchedDate,Rating10\nJFK,1991,2016-10-31,7\n' },
        { name: 'X_watched_tvshow_0.csv', text: 'Title,Year,WatchedDate,Rating10\nShow,2019,2019-12-06,7\nShow,2019,2019-12-06,7\n' },
        { name: 'X_watched_videogame_0.csv', text: 'Title,Year,WatchedDate,Rating10\nThe Quarry,2022,2025-08-04,5\n' },
        { name: 'X_watchlist_film_0.csv', text: 'Title,Year\nMr. Turner,2014\nJFK,1991\n' },
      ],
      now,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(ExportFileSchema.safeParse(res.file).success).toBe(true);
    expect(res.file.source).toBe('csv');
    expect(res.summary.counts).toEqual({
      film: { rated: 3, want2see: 1 },
      serial: { rated: 1, want2see: 0 },
      game: { rated: 1, want2see: 0 },
    });
    expect(res.summary.duplicates).toBe(2);
    expect(res.summary.unrated).toBe(1);
    const paris = res.file.items.find((i) => i.title === 'Paris, Texas');
    expect(paris).toMatchObject({ kind: 'film', list: 'rated', rating: 8, year: 1984, ratedAt: '2023-12-25T00:00:00.000Z' });
    expect(paris!.filmwebId).toBeLessThan(0);
    // JFK is both rated and on the watchlist → stays rated.
    expect(res.file.items.filter((i) => i.title === 'JFK')).toEqual([expect.objectContaining({ list: 'rated', rating: 7 })]);
    // Only the user's own data: no metadata fields beyond title/year.
    expect(Object.keys(paris!).sort()).toEqual(['filmwebId', 'kind', 'list', 'ratedAt', 'rating', 'title', 'year']);
  });

  it('reads the Letterboxd export format (Name, 0.5–5 stars)', () => {
    const res = importCsvFiles([
      { name: 'ratings.csv', text: 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Heat,1995,https://boxd.it/x,4.5\n' },
    ]);
    expect(res.ok && res.file.items[0]).toMatchObject({ title: 'Heat', rating: 9, ratedAt: '2024-01-02T00:00:00.000Z' });
  });

  it('rejects files without a title column and empty input', () => {
    expect(importCsvFiles([{ name: 'a.csv', text: 'foo,bar\n1,2' }]).ok).toBe(false);
    expect(importCsvFiles([{ name: 'a.csv', text: 'Title,Year\n' }]).ok).toBe(false);
    expect(importCsvFiles([]).ok).toBe(false);
  });

  it('skips rows without title and ignores out-of-range values', () => {
    const res = importCsvFiles([{ name: 'f.csv', text: 'Title,Year,WatchedDate,Rating10\n,2000,,5\nX,99999,bad,11\n' }]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary.files[0].skipped).toBe(1);
    expect(res.file.items[0]).toEqual({ filmwebId: expect.any(Number), kind: 'film', list: 'rated', title: 'X' });
  });
});
