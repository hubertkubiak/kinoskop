# API Filmwebu – rozpoznanie (Faza 0)

> **Status: NIEPOTWIERDZONE.** Faza 0 wymaga autora. Do czasu uruchomienia sondy
> ścieżki i kształty odpowiedzi poniżej są hipotezą, a mappery działają defensywnie
> (akceptują kilka wariantów nazw pól i głośno zgłaszają nieznany kształt).

## Jak uruchomić sondę

1. `pnpm nx build import-script` → plik `dist/libs/import-script/kinoskop-sonda.js`.
2. Zaloguj się na https://www.filmweb.pl, otwórz konsolę (`Ctrl+Shift+J`), w razie potrzeby wpisz `allow pasting`.
3. Wklej zawartość `kinoskop-sonda.js`, Enter. Sonda wykona ok. 20 zapytań GET (po jednym naraz, z przerwami) i pobierze plik `kinoskop-sonda-RRRR-MM-DD.json`.
4. Sprawdź plik: nazwa i ID użytkownika są maskowane automatycznie, ale przejrzyj go przed udostępnieniem.
5. Pełny plik zapisz w `fixtures/filmweb/private/` (ignorowane przez git), a wycięte, małe próbki w `fixtures/filmweb/probe/`.

## Endpointy

| Cel | Ścieżka | Status | Uwagi |
|---|---|---|---|
| zalogowany użytkownik | `GET /api/v1/logged/info` | potwierdzony przez społeczność | 401/403 gdy niezalogowany |
| oceny | `GET /api/v1/logged/vote/title/{film\|serial\|game}?page=N` | **do potwierdzenia** | czy jest stronicowane? rozmiar strony? |
| chcę zobaczyć | `GET /api/v1/logged/want2see/{film\|serial\|game}?page=N` | **do potwierdzenia** | czy parametr `page` działa? |
| info tytułu | `GET /api/v1/title/{id}/info` | **do potwierdzenia** | czy zawiera tylko tytuł/rok, czy więcej (nie pobieramy reszty) |

## Pytania do rozstrzygnięcia sondą

- [ ] Nazwy pól w pozycji oceny: ID tytułu (`entity`?), ocena (`rate`?), ulubione (`favorite`?), data (`timestamp` w ms? `viewDate` RRRRMMDD?).
- [ ] Czy ocena 0 oznacza „widziane bez oceny”?
- [ ] Czy listy zawierają tytuł i rok? Jeśli tak: `TITLE_INFO_MODE = 'none'` i brak zapytań o info tytułu.
- [ ] Jak kończy się paginacja (pusta tablica? 404?).
- [ ] Czy `logged/info` zwraca `id` i `name`.

## Decyzja tymczasowa: `TITLE_INFO_MODE = 'games'`

Mapowanie Filmweb → TMDB odbywa się przez Wikidata (P5032, ~60 tys. tytułów, sprawdzone
zapytaniem 2026-11-18). Dla gier Wikidata ma ID Filmwebu tylko w ~32 przypadkach (P3995),
więc gry dopasowujemy wyszukiwaniem IGDB po tytule – stąd skrypt dociąga info tytułu
**tylko dla gier**. Po Fazie 0 decyzję trzeba potwierdzić lub zmienić w
`libs/import-script/src/config.ts`.
