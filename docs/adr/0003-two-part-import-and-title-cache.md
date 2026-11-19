# ADR 0003: Import w dwóch plikach i pamięć tytułów skryptu

- Status: przyjęta
- Data: 2026-11-19

## Kontekst

Od wersji 0.3.0 skrypt pobiera tytuł i rok dla pozycji, których Wikidata nie zna po Filmweb ID. U autora było to
ok. 2300 zapytań. Na widocznej karcie to ok. 0,75 s na zapytanie (~30 min). Na karcie w tle Chrome sprawdza timery
raz na sekundę, a po 5 minutach raz na minutę (developer.chrome.com/blog/timer-throttling-in-chrome-88), więc
szacunek rósł do 79 min i więcej. Do tego jedna partia odrzucona przez Wikidata (429) przełączała skrypt na
pobieranie info dla wszystkich ~4300 pozycji.

## Decyzja

1. **Dwa pliki.** Gdy do pobrania jest ≥ 100 tytułów, skrypt zaraz po listach zapisuje część 1 (`part: 'base'`),
   a na końcu pełny plik (`part: 'full'`). Aplikacja liczy statystyki z części 1 od razu.
2. **Scalanie zamiast zastępowania.** Plik tego samego użytkownika Filmwebu (`user.id`) wczytany na import ze
   skryptu jest scalany (`LibraryStore.mergeExport`): pozycje są zastępowane, a wzbogacenia, ręczne dopasowania
   i epoki AI pozycji, które nadal istnieją, zostają. Wzbogacanie obejmuje tylko brakujące. Dotyczy też zwykłego
   ponownego importu.
3. **Pamięć tytułów** w `localStorage` filmweb.pl (`kinoskop-titles-v1`): tytuł, tytuł oryginalny, rok i ID znane
   Wikidata. Dane zostają wyłącznie w przeglądarce użytkownika i nigdzie nie są wysyłane. Kolejny import pobiera info
   tylko dla nowych pozycji.
4. **Wikidata częściowo.** Partia nieudana po 6 próbach (z Retry-After) trafia do pobrania info; reszta wyniku
   zostaje.
5. **Karta w tle.** Zmienia się tytuł karty i panel, a szacunek czasu liczony jest tylko z zapytań przy widocznej
   karcie.
6. **Bez skracania przerw** między zapytaniami (400–900 ms, jedno naraz) – SPEC §5.3 i §14.1 bez zmian w tym punkcie.

## Konsekwencje

- Przeglądarka może zapytać o zgodę na pobieranie wielu plików; skrypt o tym informuje.
- Pełny plik nadal wystarcza sam (np. na innym komputerze).
- Ponowny import nie odświeża już wzbogaceń pozycji, które je mają. Pełne odświeżenie: „Usuń moje dane” i import.
