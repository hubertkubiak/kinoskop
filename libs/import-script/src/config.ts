// Konfiguracja skryptu importu Kinoskopu. Wartości wpisywane na stałe w zbudowany plik.

/** Wersja skryptu (podnoś przy każdej zmianie zachowania). */
export const SCRIPT_VERSION = '0.2.0';

/** Wersja formatu pliku eksportu; musi być równa EXPORT_SCHEMA_VERSION z libs/shared. */
export const SCHEMA_VERSION = 1;

/** Jedyna strona, na której skrypt może działać. */
export const ALLOWED_HOST = 'www.filmweb.pl';

/** Przerwa między zapytaniami: losowo z tego zakresu (ms), jak przy ręcznym przeglądaniu. */
export const DELAY_MS = { min: 400, max: 900 } as const;

/** Maksymalna liczba prób jednego zapytania (przy 5xx). */
export const MAX_ATTEMPTS = 3;

/** Bezpiecznik: maksymalna liczba stron jednej listy. */
export const MAX_PAGES = 400;

/** Klucz postępu w sessionStorage karty Filmwebu (wznawianie po przerwaniu). */
export const PROGRESS_KEY = 'kinoskop-progress-v1';

/**
 * Kiedy pobierać podstawowe info tytułu (tytuł, rok) do dopasowania:
 * - 'none'  – nigdy (wystarczy Filmweb ID + Wikidata),
 * - 'games' – tylko gry (Wikidata prawie nie ma ID Filmwebu dla gier),
 * - 'all'   – zawsze, gdy lista nie zawiera tytułu.
 * Do potwierdzenia w Fazie 0 (docs/filmweb-api.md).
 */
export const TITLE_INFO_MODE: 'none' | 'games' | 'all' = 'games';
