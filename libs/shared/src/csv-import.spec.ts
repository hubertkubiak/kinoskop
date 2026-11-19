import { describe, expect, it } from 'vitest';
import {
  classifyCsvFileName,
  importCsvFiles,
  localItemId,
  looksLikeIdCsv,
  looksLikeImportCsv,
  looksLikeTitleCsv,
  parseCsv,
} from './csv-import';
import { ExportFileSchema } from './export-file';

// Filmweb2Letterboxd archive tables (synthetic values, column layout as written by the tool).
const BASE_HEADER = 'List,Kind,FilmwebID,Rating10,WatchedDate,Timestamp,Favorite,SeenInCinema,WatchlistLevel';
const WSTEPNY = [
  BASE_HEADER,
  'watched,film,1089,8,2026-11-18,2026-11-18T10:00:00.000Z,1,,',
  'watched,film,4833,,,2019-03-12T00:00:00.000Z,,1,',
  'watched,tvshow,7001,6,,,,,',
  'watched,videogame,612930,9,2020-01-01,,,,',
  'watchlist,film,521206,,,2023-11-14T22:13:20.000Z,,,5',
  'watchlist,film,521207,,,2023-11-14T22:13:20.000Z,,,0',
  'watchlist,film,1089,,,,,,3',
  'watched,film,abc,5,,,,,',
].join('\n');
const PELNY = [
  'List,Kind,FilmwebID,Title,OriginalTitle,Year,Rating10,WatchedDate,Timestamp,Favorite,SeenInCinema,WatchlistLevel',
  'watched,film,1089,Pulp Fiction,Pulp Fiction,1994,8,2026-11-18,2026-11-18T10:00:00.000Z,1,,',
  'watched,film,4833,"Paryż, Teksas","Paris, Texas",1984,,,2019-03-12T00:00:00.000Z,,1,',
  'watched,tvshow,7001,Program,,2019,6,,,,,',
  'watched,videogame,612930,Portal 2,Portal 2,2011,9,2020-01-01,,,,',
  'watchlist,film,521206,Film,,2010,,,2023-11-14T22:13:20.000Z,,,5',
].join('\n');

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

describe('Filmweb2Letterboxd archive tables', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  it('detects archive tables and error reports', () => {
    expect(looksLikeIdCsv(WSTEPNY)).toBe(true);
    expect(looksLikeIdCsv('Title,Year\nX,1')).toBe(false);
    expect(looksLikeImportCsv('Filmweb2Letterboxd_wstepny_2026-11-19.csv', WSTEPNY)).toBe(true);
    expect(looksLikeImportCsv('Filmweb2Letterboxd_bledy.csv', 'id,error\n1,HTTP 404')).toBe(true);
    expect(looksLikeImportCsv('a.csv', 'foo,bar\n1,2')).toBe(false);
  });

  it('imports the table without titles as part 1 with Filmweb IDs', () => {
    const res = importCsvFiles([{ name: 'Filmweb2Letterboxd_wstepny_2026-11-19.csv', text: WSTEPNY }], now);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(ExportFileSchema.safeParse(res.file).success).toBe(true);
    expect(res.file.part).toBe('base');
    // 1089 rated + on the watchlist → one rated item; level 0 and the bad id are skipped.
    expect(res.file.items.map((i) => `${i.kind}:${i.filmwebId}:${i.list}`).sort()).toEqual([
      'film:1089:rated',
      'film:4833:rated',
      'film:521206:want2see',
      'game:612930:rated',
      'serial:7001:rated',
    ]);
    expect(res.file.items.find((i) => i.filmwebId === 1089)).toEqual({
      filmwebId: 1089,
      kind: 'film',
      list: 'rated',
      rating: 8,
      ratedAt: '2026-11-18T10:00:00.000Z',
      favorite: true,
    });
    // No Timestamp → viewing date.
    expect(res.file.items.find((i) => i.filmwebId === 612930)?.ratedAt).toBe('2020-01-01T00:00:00.000Z');
    expect(res.summary).toMatchObject({ withFilmwebId: 5, withoutTitle: 5, unrated: 1, duplicates: 1 });
    expect(res.summary.files[0]).toEqual({ name: 'Filmweb2Letterboxd_wstepny_2026-11-19.csv', rows: 8, skipped: 2 });
  });

  it('imports the table with titles as a full file', () => {
    const res = importCsvFiles([{ name: 'Filmweb2Letterboxd_pelny_2026-11-19.csv', text: PELNY }], now);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.file.part).toBeUndefined();
    expect(res.summary.withoutTitle).toBe(0);
    const paris = res.file.items.find((i) => i.filmwebId === 4833);
    expect(paris).toMatchObject({ title: 'Paryż, Teksas', originalTitle: 'Paris, Texas', year: 1984 });
    // Same original title is not repeated.
    expect(res.file.items.find((i) => i.filmwebId === 1089)).not.toHaveProperty('originalTitle');
  });

  it('skips error reports and the tool’s own Letterboxd files when an archive table is present', () => {
    const res = importCsvFiles(
      [
        { name: 'Filmweb2Letterboxd_wstepny_2026-11-19.csv', text: WSTEPNY },
        { name: 'Filmweb2Letterboxd_pelny_2026-11-19.csv', text: PELNY },
        { name: 'Filmweb2Letterboxd_watched_film_0.csv', text: 'Title,Year,Rating10,WatchedDate\nPulp Fiction,1994,8,2026-11-18\n' },
        { name: 'Filmweb2Letterboxd_bledy.csv', text: 'id,error\n77,HTTP 404\n' },
        { name: 'ratings.csv', text: 'Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,Heat,1995,https://boxd.it/x,4.5\n' },
      ],
      now,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary.ignoredFiles.map((f) => f.name)).toEqual([
      'Filmweb2Letterboxd_watched_film_0.csv',
      'Filmweb2Letterboxd_bledy.csv',
    ]);
    // Titles from the full table fill the entries from the base table; other tools' files stay.
    expect(res.file.items).toHaveLength(6);
    expect(res.file.items.filter((i) => i.filmwebId > 0).every((i) => i.title)).toBe(true);
    expect(res.file.items.find((i) => i.title === 'Heat')!.filmwebId).toBeLessThan(0);
    expect(res.file.part).toBeUndefined();
  });

  it('keeps importing Filmweb2Letterboxd Letterboxd files on their own', () => {
    const res = importCsvFiles([
      { name: 'Filmweb2Letterboxd_watched_film_0.csv', text: 'Title,Year,Rating10,WatchedDate\nPulp Fiction,1994,8,\n' },
      { name: 'Filmweb2Letterboxd_bledy.csv', text: 'id,error\n77,HTTP 404\n' },
    ]);
    expect(res.ok && res.file.items).toEqual([expect.objectContaining({ title: 'Pulp Fiction', rating: 8 })]);
  });

  it('explains when only ignored files were chosen', () => {
    const res = importCsvFiles([{ name: 'Filmweb2Letterboxd_bledy.csv', text: 'id,error\n77,HTTP 404\n' }]);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toContain('Filmweb2Letterboxd_bledy.csv');
  });
});
