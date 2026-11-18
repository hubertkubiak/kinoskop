// Wszystkie ścieżki API Filmwebu w jednym miejscu.
// UWAGA: API jest nieudokumentowane. Ścieżki oznaczone „DO WERYFIKACJI” pochodzą
// z narzędzi społeczności i muszą zostać potwierdzone sondą w Fazie 0 (docs/filmweb-api.md).

export type FwKind = 'film' | 'serial' | 'game';

export const ENDPOINTS = {
  /** Zalogowany użytkownik. Potwierdzony w narzędziach open source. */
  loggedInfo: () => '/api/v1/logged/info',
  /** Oceny danego typu, stronicowane. DO WERYFIKACJI. */
  votes: (kind: FwKind, page: number) => `/api/v1/logged/vote/title/${kind}?page=${page}`,
  /** Lista „chcę zobaczyć”. DO WERYFIKACJI (czy jest stronicowana). */
  want2see: (kind: FwKind, page: number) => `/api/v1/logged/want2see/${kind}?page=${page}`,
  /** Podstawowe info tytułu, tylko do dopasowania. DO WERYFIKACJI. */
  titleInfo: (id: number) => `/api/v1/title/${id}/info`,
} as const;
