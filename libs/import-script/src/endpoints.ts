// Wszystkie ścieżki API Filmwebu w jednym miejscu.
// API jest nieudokumentowane. Ścieżki i kształt odpowiedzi potwierdzone zapytaniami GET
// na koncie autora 2026-11-19 (docs/filmweb-api.md). Mogą się zmienić bez ostrzeżenia.

/** Rodzaj pozycji w pliku eksportu Kinoskopu. */
export type FwKind = 'film' | 'serial' | 'game';

/** Rodzaj w ścieżce API Filmwebu. `game` zwraca 400 – gry to `videogame`, programy TV to `tvshow`. */
export type FwPathKind = 'film' | 'serial' | 'tvshow' | 'videogame';

/** Listy do pobrania i ich rodzaj w eksporcie (programy TV traktujemy jak seriale). */
export const FW_LISTS: readonly { path: FwPathKind; kind: FwKind }[] = [
  { path: 'film', kind: 'film' },
  { path: 'serial', kind: 'serial' },
  { path: 'tvshow', kind: 'serial' },
  { path: 'videogame', kind: 'game' },
];

export const ENDPOINTS = {
  /** Zalogowany użytkownik: { id, name, … }. 401/403 gdy niezalogowany. */
  loggedInfo: () => '/api/v1/logged/info',
  /**
   * Oceny, po 100 na stronę: [{ entity, rate, timestamp (ms), viewDate (RRRRMMDD), … }].
   * Koniec listy = pusta tablica; strony daleko za końcem zwracają 500.
   */
  votes: (kind: FwPathKind, page: number) => `/api/v1/logged/vote/title/${kind}?page=${page}`,
  /** „Chcę zobaczyć”: [{ entity, timestamp, level, … }]; koniec = pusta tablica. */
  want2see: (kind: FwPathKind, page: number) => `/api/v1/logged/want2see/${kind}?page=${page}`,
  /** Info tytułu: { id, title, originalTitle, year, … } – bierzemy tylko tytuł i rok. */
  titleInfo: (id: number) => `/api/v1/title/${id}/info`,
} as const;
