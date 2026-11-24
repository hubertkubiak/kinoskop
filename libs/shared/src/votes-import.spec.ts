import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importCsvFiles, looksLikeImportCsv } from './csv-import';
import { ExportFileSchema } from './export-file';
import { classifyVotesFileName, looksLikeVotesJson, parseVoteTitle, parseVotesJson } from './votes-import';

const DIR = join(__dirname, '../../../fixtures/export/data-request');
const fixtures = () =>
  readdirSync(DIR)
    .filter((n) => n.endsWith('.json'))
    .map((name) => ({ name, text: readFileSync(join(DIR, name), 'utf8') }));

describe('parseVoteTitle', () => {
  it('splits the title from the year or year range', () => {
    expect(parseVoteTitle('Rejs (1970)')).toEqual({ title: 'Rejs', year: 1970 });
    expect(parseVoteTitle('Ranczo (2006 - 2016)')).toEqual({ title: 'Ranczo', year: 2006 });
    expect(parseVoteTitle('Stamtąd (2022 - )')).toEqual({ title: 'Stamtąd', year: 2022 });
    expect(parseVoteTitle('Nosferatu - symfonia grozy (1922)')).toEqual({ title: 'Nosferatu - symfonia grozy', year: 1922 });
    expect(parseVoteTitle('Film (wersja reżyserska) (2001)')).toEqual({ title: 'Film (wersja reżyserska)', year: 2001 });
    expect(parseVoteTitle('Ranczo (2006 - 2016) Sezon 2 odcinek 1')).toEqual({ title: 'Ranczo', year: 2006 });
    expect(parseVoteTitle('  Bez   roku ')).toEqual({ title: 'Bez roku' });
    expect(parseVoteTitle('Dziwny (1066)')).toEqual({ title: 'Dziwny' });
  });
});

describe('votes files', () => {
  it('are recognised by content, also by the generic table detection', () => {
    expect(looksLikeVotesJson('{ "votes": [{ "title": "Rejs (1970)", "rate": 9 }] }')).toBe(true);
    expect(looksLikeVotesJson('{ "votes": [] }')).toBe(true);
    expect(looksLikeVotesJson('{ "votes": [{ "name": "x" }] }')).toBe(false);
    expect(looksLikeVotesJson('{ "schemaVersion": 1, "items": [] }')).toBe(false);
    expect(looksLikeVotesJson('Title,Year\nX,2001')).toBe(false);
    expect(looksLikeImportCsv('x_films.json', '{"votes":[{"title":"Rejs (1970)"}]}')).toBe(true);
  });

  it('get their kind from the file name', () => {
    expect(classifyVotesFileName('widz_films.json')).toBe('film');
    expect(classifyVotesFileName('widz_serials.json')).toBe('serial');
    expect(classifyVotesFileName('widz_episodes.json')).toBe('episode');
    expect(classifyVotesFileName('widz_games.json')).toBe('game');
  });

  it('keep only title, year and a valid rating; comments are never read', () => {
    const r = parseVotesJson(
      JSON.stringify({ votes: [{ title: 'A (2001)', rate: 7, comment: 'tajne' }, { title: 'B (2002)', rate: 0 }, { title: 5 }, {}] }),
    );
    expect(r).toEqual({ rows: [{ title: 'A', year: 2001, rating: 7 }, { title: 'B', year: 2002 }], skipped: 2 });
    expect(JSON.stringify(r)).not.toContain('tajne');
  });

  it('import films and series, skip episodes and report the missing data', () => {
    const res = importCsvFiles(fixtures(), new Date('2026-11-24T12:00:00Z'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(ExportFileSchema.safeParse(res.file).success).toBe(true);
    expect(res.file.source).toBe('csv');
    expect(res.file.part).toBeUndefined();
    expect(res.summary.counts).toEqual({
      film: { rated: 5, want2see: 0 },
      serial: { rated: 2, want2see: 0 },
      game: { rated: 0, want2see: 0 },
    });
    expect(res.summary.unrated).toBe(1);
    expect(res.summary.ignoredFiles).toEqual([{ name: 'widz_episodes.json', reason: expect.stringContaining('odcinków') }]);
    expect(res.summary.missing).toEqual(['dates', 'favorites', 'want2see']);

    const rejs = res.file.items.find((i) => i.title === 'Rejs');
    expect(rejs).toMatchObject({ kind: 'film', list: 'rated', rating: 9, year: 1970 });
    expect(rejs?.filmwebId).toBeLessThan(0);
    expect(res.file.items.find((i) => i.title === 'Ranczo')).toMatchObject({ kind: 'serial', year: 2006, rating: 6 });
    // Only the user's own data for matching: no comments, no dates.
    expect(JSON.stringify(res.file)).not.toContain('prywatna notatka');
    for (const it of res.file.items) expect(Object.keys(it).every((k) => ['filmwebId', 'kind', 'list', 'rating', 'title', 'year'].includes(k))).toBe(true);
  });

  it('can be mixed with CSV files, and a re-import keeps the same local ids', () => {
    const csv = { name: 'X_watchlist_film_0.csv', text: 'Title,Year\nMr. Turner,2014\n' };
    const a = importCsvFiles([...fixtures(), csv]);
    const b = importCsvFiles([...fixtures(), csv]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.summary.counts.film.want2see).toBe(1);
    expect(a.summary.missing).toEqual(['dates', 'favorites']);
    expect(a.file.items.map((i) => i.filmwebId)).toEqual(b.file.items.map((i) => i.filmwebId));
  });

  it('explains when only the episodes file was chosen', () => {
    const res = importCsvFiles(fixtures().filter((f) => f.name.includes('episodes')));
    expect(res).toEqual({ ok: false, message: expect.stringContaining('widz_episodes.json') });
  });
});
