# API Filmwebu – rozpoznanie (Faza 0)

> **Status: POTWIERDZONE 2026-11-19** zapytaniami GET na koncie autora (przeglądarka zalogowana na
> www.filmweb.pl). API jest nieudokumentowane i może się zmienić bez ostrzeżenia. Pełny import:
> 4287 pozycji, 237 zapytań, ok. 3 min, 0 błędów. Kształty w `fixtures/filmweb/probe/` (wartości syntetyczne).

## Jak uruchomić sondę

1. `pnpm nx build import-script` → plik `dist/libs/import-script/kinoskop-sonda.js`.
2. Zaloguj się na https://www.filmweb.pl, otwórz konsolę (`Ctrl+Shift+J`), w razie potrzeby wpisz `allow pasting`.
3. Wklej zawartość `kinoskop-sonda.js`, Enter. Sonda wykona ok. 20 zapytań GET (po jednym naraz, z przerwami) i pobierze plik `kinoskop-sonda-RRRR-MM-DD.json`.
4. Sprawdź plik: nazwa i ID użytkownika są maskowane automatycznie, ale przejrzyj go przed udostępnieniem.
5. Pełny plik zapisz w `fixtures/filmweb/private/` (ignorowane przez git), a wycięte, małe próbki w `fixtures/filmweb/probe/`.

## Endpointy

| Cel | Ścieżka | Odpowiedź |
|---|---|---|
| zalogowany użytkownik | `GET /api/v1/logged/info` | `{ id, uuid, name, email, … }` – bierzemy tylko `id` i `name`; 401 gdy brak sesji |
| oceny | `GET /api/v1/logged/vote/title/{film\|serial\|tvshow\|videogame}?page=N` | tablica po ~100: `{ entity, rate (1–10), timestamp (ms), viewDate (RRRRMMDD), seenInCinema, likesCount }`, czasem `favorite` |
| chcę zobaczyć | `GET /api/v1/logged/want2see/{…}?page=N` | tablica `{ entity, timestamp, level, followMask }` |
| info tytułu | `GET /api/v1/title/{id}/info` | `{ id, title, originalTitle, year, type, posterPath }` – bierzemy tylko tytuł i rok |

## Ustalenia

- Rodzaj **`game` zwraca 400** – gry to `videogame`. Istnieje też `tvshow` (programy TV), który mapujemy na `serial`.
- Paginacja: strony mają zwykle 100 pozycji, ale bywa mniej w środku listy (np. 97) – **koniec to pusta tablica**,
  nie krótsza strona. Strony daleko za końcem zwracają 500.
- Daty: `timestamp` to czas oceny w ms (używamy jako `ratedAt`), `viewDate` to data obejrzenia RRRRMMDD.
- Listy nie zawierają tytułu ani roku, więc `TITLE_INFO_MODE = 'games'` zostaje (filmy i seriale łączymy przez
  Wikidata P5032).
- Sesja: token logowania jest w ciasteczku HttpOnly i odświeża się przy wczytaniu strony HTML. Raz zaobserwowano 401
  w trakcie importu na karcie, która długo nie wczytywała strony; skrypt przy 401/403 raz pobiera `/` i ponawia zapytanie.
- Strona główna potrafi się sama przeładować (zaobserwowane), co przerywa skrypt i czyści konsolę. Zalecamy
  uruchamianie na `https://www.filmweb.pl/robots.txt`; skrypt pokazuje też panel postępu na stronie i ostrzega przed
  opuszczeniem karty.
- Otwarte: czy `favorite` w ocenach to pełna lista ulubionych (u autora 18 pozycji).

## Decyzja: `TITLE_INFO_MODE = 'games'`

Mapowanie Filmweb → TMDB odbywa się przez Wikidata (P5032, ~60 tys. tytułów, sprawdzone
zapytaniem 2026-11-18). Dla gier Wikidata ma ID Filmwebu tylko w ~32 przypadkach (P3995),
więc gry dopasowujemy wyszukiwaniem IGDB po tytule – stąd skrypt dociąga info tytułu
**tylko dla gier**. Po Fazie 0 decyzję trzeba potwierdzić lub zmienić w
`libs/import-script/src/config.ts`.
