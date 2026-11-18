# Fixture'y Filmwebu

| Katalog | Zawartość | W repo? |
|---|---|---|
| `synthetic/` | **Ręcznie napisane** próbki o *założonym* kształcie odpowiedzi (Faza 0 jeszcze nie przeprowadzona). Służą tylko do testów defensywnych mapperów. | tak |
| `probe/` | Zanonimizowane wycinki z pliku sondy (`kinoskop-sonda-*.json`) po Fazie 0. | tak, po anonimizacji |
| `private/` | Pełne, prawdziwe odpowiedzi z konta autora. | **nie** (`.gitignore`) |

Gdy autor dostarczy plik sondy (patrz `docs/filmweb-api.md`), mappery w
`libs/import-script/src/mappers.ts` trzeba dopasować do prawdziwego kształtu, a testy
przełączyć z `synthetic/` na `probe/`.
