# Kopia danych z serwisu z ocenami (fikcyjna)

Fikcyjne pliki w kształcie odpowiedzi serwisu na prośbę o kopię danych (RODO art. 15):
`<użytkownik>_films.json`, `<użytkownik>_serials.json`, `<użytkownik>_episodes.json`, każdy
`{ "votes": [{ "title": "Tytuł (rok)", "rate": 1–10, "comment": "…" }] }`. Kształt odtworzony z
plików autora (2026-11-24); same pliki autora nie trafiają do repo (`fixtures/filmweb/extracted_by_filmweb/`
jest w `.gitignore`). Używane przez `libs/shared` (votes-import) i e2e `import.spec.ts`.
