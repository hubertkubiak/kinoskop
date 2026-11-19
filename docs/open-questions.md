# Otwarte kwestie i rozbieżności ze SPEC (do decyzji autora)

Zgodnie z CLAUDE.md: gdy kod i SPEC się rozjeżdżają, decyzję podejmuje autor, a potem aktualizujemy SPEC.
Poniżej lista z wstępnej implementacji (2026-11-18). SPEC.md zmieniany tylko po decyzji autora (sekcja „Zatwierdzone”).

## Wymaga działania autora

1. **Faza 0 – sonda Filmwebu: zrobione 2026-11-19** (`docs/filmweb-api.md`). Otwarte tylko: czy pole `favorite`
   w ocenach obejmuje wszystkie ulubione.
2. **Klucze API** (`.env`): bez `TMDB_API_TOKEN` wzbogacanie działa tylko z Wikidata (brak plakatów, ocen ogółu,
   obsady, „gdzie obejrzeć”, wyszukiwania ręcznego). Bez `TWITCH_*` gry nie są dopasowywane.
3. **Złote Lwy (Gdynia)** – nie znalazłem elementu nagrody w Wikidata; nie zgaduję Q-ID
   (`apps/api/src/awards/awards.config.ts`, TODO). Orły (`Q930627`) mają w Wikidata 0 laureatów z P166.
4. **CORS OpenRouter i Gemini** – dokumentacja nie potwierdza wywołań z przeglądarki; sprawdzić z prawdziwym kluczem.
   Identyfikatory darmowych modeli (`ai-models.config.ts`) zmieniają się często.
5. **Zrzuty ekranu** instrukcji importu (`docs/import/`) i README (`docs/screenshots/`) – placeholdery.

## Rozbieżności do zatwierdzenia (potem aktualizacja SPEC)

| # | SPEC | Implementacja | Powód |
|---|---|---|---|
| 1 | §4 `Enrichment` | dodane pola `runtimeMinutes`, `overview`, `publicRating`, `providersPL.link`, `Person.profileUrl` | wymagane przez §7.1 (czas przed ekranem), §7.3 (TMDB vote_average), §7.11 (opis dla AI), §7.6 (zdjęcie) |
| 2 | §4 `ExportFile` | opcjonalne `scriptVersion` | wersja skryptu w pliku (§5.3) |
| 3 | §3.1 IGDB ID | `P5794` (slug) + kwalifikator `P9043` (numeryczny) | zweryfikowane zapytaniem |
| 4 | §3.1 Filmweb ID | `P5032` (filmy/seriale, ~60 tys.) + `P3995` (slug, jedyny z grami – ok. 32 gry) | gry dopasowujemy wyszukiwaniem IGDB, po pomiarze na prawdziwym profilu (47% pokrycia) skrypt pobiera info tytułu dla gier i tytułów nieznanych Wikidata (`TITLE_INFO_MODE='missing'`) |
| 5 | §7.11 `temperature: 0` | nie wysyłane do Anthropic | obecne modele Claude odrzucają parametry samplingu (400); OpenRouter/Gemini dostają `temperature: 0` |
| 6 | §7.11 model | domyślnie `claude-opus-5-5` z `effort: low`, do wyboru Sonnet 5.5 / Haiku 5.5; włączone `fallbacks: "default"` | wytyczne SDK; Haiku 5.5 to najtańsza opcja – autor może zmienić domyślny |
| 7 | §7.8 ELK.js, wirtualizacja | układ radialny w `libs/stats`, wirtualizacja wyłączona | ADR 0001 |
| 8 | §2.2 CDK DragDrop dla strefy importu | natywne zdarzenia drag & drop | CDK DragDrop nie obsługuje upuszczania plików z systemu |
| 9 | §2.2 MSW w testach | `page.route` w Playwright | ten sam efekt bez dodatkowej zależności w aplikacji |
| 10 | §14.3 demo „wybrane z TMDB/IGDB” | demo z Wikidata (CC0), bez plakatów i ocen ogółu | brak klucza TMDB przy generowaniu; `tools/demo-data/generate.mjs` można rozszerzyć o TMDB |
| 11 | §7.6 karta twórcy | brak listy „nieobejrzane najwyżej oceniane tytuły twórcy (TMDB)” | wymaga nowego endpointu API (np. `/api/person/:id`), nie zaimplementowano |
| 12 | §7.7 laureaci | nominacje bywają niekompletne; „Daniels” jako laureat reżyserii (duet, nie człowiek w Wikidata) | jakość danych Wikidata |
| 13 | `apps/web/src/assets/demo` | `apps/web/public/assets/demo` | konwencja Angular 22 (`public/`) |

## Zatwierdzone przez autora (SPEC zaktualizowany)

- 2026-11-18: import plików CSV z innych narzędzi (format Letterboxd, np. Filmweb2Letterboxd) jako druga ścieżka
  obok skryptu – SPEC §4, §5.1, §5.4, §14.1. Demo zostaje pod przyciskiem „Zobacz demo”, wyłącznie jako pokaz
  możliwości. Filmatyk nieobsługiwany (projekt martwy od 2020, plik zawiera sesję logowania).

## Znane ograniczenia wstępnej wersji

- Import CSV: tytuły dopasowywane wyłącznie po nazwie i roku (brak Filmweb ID), więc bez klucza TMDB/IGDB nic się
  nie dopasuje. Nagrody łączą się z nimi tylko przez TMDB ID lub Q-ID (nie przez Filmweb ID).
  `WatchedDate` w plikach Filmweb2Letterboxd to raczej data oceny na Filmwebie niż data obejrzenia.

- Krawędzie Mapy gustu są słabo widoczne przy dużym oddaleniu.
- Weryfikacja kryterium Fazy 3 („≥ 90% dopasowań z confidence ≥ 0.8”) wymaga prawdziwego eksportu i klucza TMDB.
- `render.yaml` nie powstał (Faza 8, poza v1).
