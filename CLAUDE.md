# CLAUDE.md

Źródło prawdy o produkcie: **SPEC.md**. Przeczytaj go w całości przed pierwszą zmianą. Gdy kod i SPEC się rozjeżdżają, zapytaj autora, a po decyzji zaktualizuj SPEC.

## Sposób pracy
- Realizuj fazy z SPEC §11 po kolei. Przed każdą fazą przedstaw krótki plan; po fazie sprawdź jej kryteria akceptacji i podsumuj, co zostało zrobione.
- **Faza 0 wymaga autora:** przygotuj skrypt-sondę i poproś o fixture'y z Filmwebu. Nie zgaduj kształtu odpowiedzi.
- **Nie zgaduj identyfikatorów Wikidata (P-ID, Q-ID)** ani endpointów zewnętrznych API. Weryfikuj zapytaniem lub dokumentacją, zapisuj źródło w komentarzu.
- Decyzje architektoniczne (np. rezygnacja z ngDiagram) zapisuj jako krótkie ADR w `docs/adr/NNNN-tytul.md`.

## Konwencje
- Angular 22: standalone components, zoneless, signals (`signal`, `computed`, `input()`, `output()`), nowy control flow (`@if`, `@for`), `ChangeDetectionStrategy.OnPush`, lazy routes i `@defer` dla ciężkich widoków. Bez NgModules.
- Każdy komponent we własnym folderze `nazwa/` z plikami `nazwa.ts`, `nazwa.html` i `nazwa.scss` (ten ostatni tylko gdy ma treść – bez pustych plików SCSS) (`templateUrl`, `styleUrl`; bez szablonów i stylów inline). Wyjątki: `app.ts` w `src/app` i `shell/shell.ts`, których folder ma już ich nazwę.
- Logika statystyk i filtrów wyłącznie w `libs/stats` (czyste funkcje, bez Angulara), pokryta testami Vitest.
- Schematy danych wyłącznie w `libs/shared` (Zod), typy przez `z.infer`.
- Kolory, odstępy i typografia tylko przez tokeny z SPEC §9.3; żadnych zahardkodowanych kolorów w komponentach.
- UI po polsku; kod, identyfikatory i commity po angielsku (Conventional Commits). Komentarze w `libs/import-script` po polsku.
- **Nigdy** nie zbieraj ani nie pokazuj płci twórców (SPEC §1.2).
- Nie loguj body żądań `/api/enrich`; nie zapisuj na serwerze żadnych danych użytkownika.
- Klucze LLM użytkownika: tylko w pamięci lub `sessionStorage`, wywołania wyłącznie z przeglądarki do dostawcy; **nigdy** do `/api/*`. Backend nie ma żadnego klucza LLM w v1.
- Skrypt importu pobiera **wyłącznie dane własne użytkownika** (oceny, daty, ulubione, listy), sekwencyjnie i z przerwami; nigdy metadanych bazy Filmwebu (SPEC §14.1). Backend nigdy nie łączy się z Filmwebem.
- v1 działa **tylko lokalnie** (SPEC §12). Nie wdrażaj niczego i nie twórz publicznych zasobów. Architekturę utrzymuj gotową na późniejszy Render (SPEC §8.4).
- Nie commituj `.env` ani prawdziwych, niezanonimizowanych odpowiedzi z Filmwebu (SPEC §12.2).

## Polecenia
```bash
pnpm install
pnpm nx serve api | pnpm nx serve web
pnpm nx run-many -t lint test build
pnpm nx e2e web-e2e
pnpm nx build import-script
```
