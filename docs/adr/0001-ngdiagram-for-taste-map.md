# ADR 0001: ngDiagram dla Mapy gustu i Sieci twórcy

- Status: zastąpiona przez ADR 0002 (2026-11-19)
- Data: 2026-11-18

## Kontekst

SPEC §7.8 zakłada ngDiagram (`ng-diagram`) dla dwóch widoków grafowych, z fallbackiem do
wykresu `graph` z ECharts, jeśli biblioteka okaże się nieprzydatna.

## Decyzja

1. **Używamy ngDiagram 1.4.0.** Peer deps: `@angular/core >= 18`, działa z Angular 22.2
   (sprawdzone buildem i w przeglądarce, 70–150 węzłów bez zauważalnych przycięć).
2. **Węzły jako komponenty Angulara** (`TasteNode`): gatunek, osoba (zdjęcie TMDB), tytuł (plakat, ocena).
   Rozmiar kropki = liczba tytułów, kolor = średnia ocena ze skali sekwencyjnej tokenów.
3. **Układ: deterministyczny układ radialny w `libs/stats` (`tasteGraph`, `creatorNetwork`) zamiast ELK.js.**
   Struktura grafu jest stałym drzewem (Ty → gatunki → twórcy → tytuły), więc układ promienisty
   daje czytelny wynik bez dodatkowej zależności (~1 MB) i jest testowalny jako czysta funkcja.
   Do ELK wracamy, jeśli pojawią się widoki o dowolnej topologii.
4. **Tylko do odczytu:** węzły `draggable: false` + middleware `read-only` anulujący akcje modyfikujące model.
5. **Wirtualizacja wyłączona.** ngDiagram wyłącza `zoomToFit` przy włączonej wirtualizacji; przy limicie
   150 węzłów (`MAX_GRAPH_NODES`) wirtualizacja nie jest potrzebna, a dopasowanie widoku przy starcie jest ważniejsze.
6. **Style:** globalny arkusz ngDiagram budowany jako osobny bundle (`inject: false`) i dołączany dopiero
   przy wejściu na widok; zmienne `--ngd-*` przypięte do tokenów Kinoskopu w klasie `.ks-diagram`.
7. Model jest tworzony od nowa przy zmianie filtrów lub rozwinięciu węzła (`initializeModel` w `untracked`,
   bo funkcja dotyka wewnętrznych sygnałów biblioteki i inaczej powodowała pętlę przeliczeń).

## Konsekwencje

- Bundle widoku: ~72 kB gzip, ładowany leniwie (nie wpływa na budżet pierwszego ładowania).
- Do weryfikacji przez autora: płynność pan/zoom na prawdziwym, dużym profilu i czytelność krawędzi
  przy małym przybliżeniu (obecnie cienkie linie w kolorze `--ks-neutral`).
