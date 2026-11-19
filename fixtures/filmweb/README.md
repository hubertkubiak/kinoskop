# Fixture'y Filmwebu

| Katalog | Zawartość | W repo? |
|---|---|---|
| `synthetic/` | **Ręcznie napisane** próbki o *założonym* kształcie odpowiedzi (Faza 0 jeszcze nie przeprowadzona). Służą tylko do testów defensywnych mapperów. | tak |
| `probe/` | Zanonimizowane wycinki z pliku sondy (`kinoskop-sonda-*.json`) po Fazie 0. | tak, po anonimizacji |
| `private/` | Pełne, prawdziwe odpowiedzi z konta autora. | **nie** (`.gitignore`) |

Sondę buduje `pnpm nx build import-script` (`dist/libs/import-script/kinoskop-sonda.js`); uruchamia się ją
w konsoli na zalogowanym koncie, a ona pobiera plik z odpowiedziami (nazwa i ID użytkownika maskowane).
Pełny plik trafia do `private/`, zanonimizowane wycinki do `probe/`.
