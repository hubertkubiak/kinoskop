# ADR 0002: „Twój gust” jako listy zamiast grafu ngDiagram

- Status: przyjęta (zastępuje ADR 0001)
- Data: 2026-11-19

## Kontekst

Po imporcie prawdziwego profilu (ok. 4300 pozycji) autor ocenił „Mapę gustu” (graf Ty → gatunki → twórcy → tytuły)
jako nieczytelną i bez praktycznego zastosowania. Graf pokazywał głównie liczebność (co oglądam najczęściej),
co inne widoki pokazują lepiej, a nie odpowiadał na pytanie „co sprawia, że oceniam wyżej lub niżej”.

## Decyzja

1. Widok `/gust` („Twój gust”) z rankingami zamiast grafu:
   - cechy (gatunek, kraj, reżyser, aktor), przy których użytkownik ocenia wyżej / niżej niż zwykle; średnia
     „ściągnięta” do średniej użytkownika (k = 3), minimum 5 tytułów, próg ±0,3 pkt,
   - duety reżyser × aktor (≥ 3 wspólne tytuły),
   - współpracownicy twórcy (`?siec=`, ≥ 2 wspólne tytuły) – zamiast ego-grafu „Sieć twórcy”.
2. Logika w `libs/stats/src/affinity.ts` (czyste funkcje, testy Vitest); `graph.ts` usunięty.
3. Zależność `ng-diagram` usunięta (mniejszy bundle, brak osobnego arkusza stylów).
4. `/mapa-gustu` przekierowuje na `/gust`, żeby stare linki działały.

## Konsekwencje

- SPEC §7.8 i Faza 5 opisują nowy widok; ADR 0001 jest nieaktualny.
- Jeśli kiedyś wróci potrzeba grafu, fallbackiem pozostaje wykres `graph` z ECharts (już w projekcie).
