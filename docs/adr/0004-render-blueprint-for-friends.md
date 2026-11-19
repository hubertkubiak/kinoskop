# ADR 0004: Blueprint Render dla instancji dla znajomych

- Status: przyjęta
- Data: 2026-11-19

## Kontekst

SPEC §12 zakładał, że v1 działa tylko lokalnie, a deploy jest osobną, późniejszą fazą (Faza 8, checklista §14.6).
Autor chce udostępnić aplikację znajomym na Render. Wybrał (2026-11-19): wszystkie funkcje jak lokalnie, razem
z importem skryptem, oraz publiczne repozytorium.

Ograniczenia techniczne:
- Produkcyjny CSP (`index.prod.html`) ma `connect-src 'self'`, a front i API to na Render dwa różne originy.
- Dokumentacja Render nie opisuje wsparcia dla pnpm ani tego, czy przepisanie (rewrite) na zewnętrzny URL
  przepuszcza żądania POST (render.com/docs/node-version, render.com/docs/redirects-rewrites, sprawdzone 2026-11-19).

## Decyzja

1. **`render.yaml`** z dwiema usługami: `kinoskop-api` (Docker z `apps/api/Dockerfile`, plan free, Frankfurt,
   health check `/api/health`) i `kinoskop` (Static Site z rewrite SPA).
2. **Adres API wstrzykiwany po buildzie.** Konfiguracja `render` kompiluje placeholder `__KS_API_BASE_URL__`;
   `tools/render/inject-api-url.mjs` zamienia go na `KS_API_BASE_URL` i dopisuje origin API do CSP `connect-src`.
   Bez proxy przez rewrite, bo jego zachowanie dla POST nie jest udokumentowane.
3. **pnpm przez `npx pnpm@<wersja z packageManager>`** w buildzie frontu; API buduje się w obrazie Dockera
   (corepack), więc nie zależy od wykrywania menedżera pakietów przez Render.
4. **`TRUST_PROXY`** (domyślnie `false`, na Render `true`): rate limit liczy IP klienta z `X-Forwarded-For`.
5. Import skryptem włączony (`KS_PUBLIC_IMPORT_ENABLED=true`) – świadoma decyzja autora; ostrzeżenie o regulaminie
   przed skopiowaniem skryptu zostaje bez zmian.
6. Wdraża wyłącznie autor, w swoim koncie Render. Nic nie jest wdrażane automatycznie.

## Konsekwencje

- Checklista §14.6 nie jest spełniona (brak polityki prywatności, zgody serwisu z ocenami i `THIRD_PARTY_LICENSES`);
  instancja jest przeznaczona dla znajomych, nie do publicznego startu.
- Po zmianie adresu API trzeba ponownie zbudować front.
- Obraz API nie był budowany lokalnie przy tej zmianie (Docker Desktop nie był uruchomiony) – pierwszy deploy na
  Render jest jednocześnie testem Dockerfile'a.
