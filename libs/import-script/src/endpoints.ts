// Wszystkie ścieżki API w jednym miejscu.
// API jest nieudokumentowane. Ścieżki i kształt odpowiedzi potwierdzone zapytaniami GET
// na koncie autora 2026-11-19 (próbki pól: fixtures/filmweb/probe/). Mogą się zmienić bez ostrzeżenia.
//
// Ustalenia (2026-11-19):
// - Paginacja: zwykle 100 pozycji na stronę, czasem mniej w środku listy – koniec to PUSTA tablica,
//   nie krótsza strona; strony daleko za końcem zwracają 500.
// - Daty: `timestamp` = czas oceny w ms (→ ratedAt), `viewDate` = data obejrzenia RRRRMMDD.
// - Listy nie mają tytułu ani roku; filmy i seriale łączymy przez Wikidata P5032, a info tytułu
//   pobieramy tylko dla nieznanych Wikidata i gier (TITLE_INFO_MODE, config.ts).
// - Brak endpointu zbiorczego: strona własnych ocen sama pobiera dane po jednym tytule
//   (np. /api/v1/film/{id}/preview) – sprawdzone podglądem ruchu sieciowego. Zbiorczych nie zgadujemy.
// - Sesja: krótko ważne ciasteczko HttpOnly odświeżane wczytaniem strony HTML (patrz http.ts).
// - Strona główna potrafi się sama przeładować – zalecamy uruchamianie na /robots.txt.
// - Otwarte: czy `favorite` w ocenach obejmuje wszystkie ulubione.

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
