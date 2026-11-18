import { emptyEnrichment, type Enrichment, type ExportItem, itemKey, type Person } from '@kinoskop/shared';
import type { LibraryItem } from '../model';

const person = (name: string, tmdbId: number, nationalities: string[] = []): Person => ({
  name,
  tmdbId,
  nationalities,
});

export const P = {
  nolan: person('Christopher Nolan', 525, ['GB', 'US']),
  kieslowski: person('Krzysztof Kieślowski', 1126, ['PL']),
  bale: person('Christian Bale', 3894, ['GB']),
  caine: person('Michael Caine', 3895, ['GB']),
  binoche: person('Juliette Binoche', 1137, ['FR']),
};

function item(
  base: Omit<ExportItem, 'list'> & { list?: ExportItem['list'] },
  e?: Partial<Enrichment>,
): LibraryItem {
  const it = { list: 'rated' as const, ...base };
  return {
    ...it,
    key: itemKey(it),
    enrichment: e
      ? { ...emptyEnrichment(it.filmwebId, it.kind, { method: 'wikidata', confidence: 1 }), ...e }
      : undefined,
  };
}

/**
 * Hand-checked test library. Expected values used in tests (counted by hand):
 * rated films: 5 (ids 1–5), rated series: 2, rated games: 1, want2see: 2.
 * Genre counts over rated items: Dramat 5, Thriller 3, Sci-Fi 2, Kryminał 2, Komedia 1, RPG 1.
 */
export const LIBRARY: LibraryItem[] = [
  item(
    { filmwebId: 1, kind: 'film', rating: 9, favorite: true, ratedAt: '2020-01-10T10:00:00.000Z', year: 2010 },
    {
      genres: ['Sci-Fi', 'Thriller'],
      countries: ['US', 'GB'],
      directors: [P.nolan],
      cast: [P.bale, P.caine],
      runtimeMinutes: 148,
      setInPeriod: [{ key: 'contemporary', source: 'wikidata' }],
      publicRating: { tmdb: 8.4, tmdbVotes: 30000 },
      awards: [{ awardKey: 'oscar-picture', year: 2011, won: false, category: 'Najlepszy film' }],
    },
  ),
  item(
    { filmwebId: 2, kind: 'film', rating: 8, ratedAt: '2020-01-20T10:00:00.000Z', year: 2008 },
    {
      genres: ['Dramat', 'Kryminał', 'Thriller'],
      countries: ['US'],
      directors: [P.nolan],
      cast: [P.bale, P.caine],
      runtimeMinutes: 152,
      publicRating: { tmdb: 8.5, tmdbVotes: 30000 },
    },
  ),
  item(
    { filmwebId: 3, kind: 'film', rating: 10, ratedAt: '2020-03-05T10:00:00.000Z', year: 1993 },
    {
      genres: ['Dramat'],
      countries: ['FR', 'PL'],
      directors: [P.kieslowski],
      cast: [P.binoche],
      runtimeMinutes: 98,
      setInPeriod: [{ key: '1990s', source: 'keywords' }],
      publicRating: { tmdb: 7.7, tmdbVotes: 1200 },
    },
  ),
  item(
    { filmwebId: 4, kind: 'film', rating: 4, ratedAt: '2021-06-01T10:00:00.000Z', year: 2014 },
    {
      genres: ['Sci-Fi', 'Dramat'],
      countries: ['US', 'GB'],
      directors: [P.nolan],
      cast: [P.caine],
      runtimeMinutes: 169,
      setInPeriod: [{ key: 'future', source: 'ai' }],
      publicRating: { tmdb: 8.4, tmdbVotes: 35000 },
    },
  ),
  item(
    { filmwebId: 5, kind: 'film', rating: 6, ratedAt: '2021-06-02T10:00:00.000Z', year: 1999 },
    { genres: ['Komedia'], countries: ['PL'], publicRating: { tmdb: 6.1, tmdbVotes: 20 } },
  ),
  item(
    { filmwebId: 10, kind: 'serial', rating: 7, ratedAt: '2021-07-01T10:00:00.000Z', year: 2008 },
    { genres: ['Dramat', 'Kryminał'], countries: ['US'] },
  ),
  item(
    { filmwebId: 11, kind: 'serial', rating: 5, ratedAt: '2021-07-15T10:00:00.000Z', year: 2016 },
    { genres: ['Dramat', 'Thriller'], countries: ['US'] },
  ),
  item({ filmwebId: 20, kind: 'game', rating: 9, ratedAt: '2022-01-01T10:00:00.000Z' }, { genres: ['RPG'], countries: ['PL'] }),
  item({ filmwebId: 30, kind: 'film', list: 'want2see', year: 2023 }, { genres: ['Dramat'], countries: ['US'] }),
  item({ filmwebId: 31, kind: 'film', list: 'want2see' }),
];
