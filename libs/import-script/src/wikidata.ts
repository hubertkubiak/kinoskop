// Sprawdzenie w Wikidata, które filmy i seriale da się dopasować po samym Filmweb ID.
// Tylko dla pozostałych skrypt pobiera z Filmwebu tytuł i rok (patrz TITLE_INFO_MODE = 'missing').
// Do Wikidata trafiają wyłącznie numery ID z Filmwebu – te same, które i tak wysyła potem aplikacja.

/** Publiczny endpoint SPARQL Wikidata (https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service). */
export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

/**
 * P5032 = „Filmweb.pl film ID” – ten sam identyfikator, którego używa API Kinoskopu
 * (apps/api/src/wikidata/ids.ts, sprawdzony zapytaniem 2026-11-18).
 */
const P_FILMWEB_FILM = 'P5032';

/** Ok. 200 ID na zapytanie, jak w API (SPEC §3). */
export const WIKIDATA_BATCH = 200;

/** Próby jednej partii. Wikidata przy serii zapytań odpowiada czasem 429 – wtedy czekamy (Retry-After). */
const ATTEMPTS = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function sparqlKnownIds(ids: number[]): string {
  const values = ids.map((id) => `"${id}"`).join(' ');
  return `SELECT DISTINCT ?fw WHERE { VALUES ?fw { ${values} } ?item <http://www.wikidata.org/prop/direct/${P_FILMWEB_FILM}> ?fw . }`;
}

export interface WikidataCheck {
  /** ID, które Wikidata zna. */
  known: Set<number>;
  /** ID z partii, których mimo ponowień nie udało się sprawdzić – dla nich skrypt pobierze info. */
  failed: number[];
}

/**
 * Sprawdza ID partiami, po kolei, z przerwą. Nieudana partia nie przekreśla pozostałych:
 * jej ID trafiają do `failed`, a reszta wyniku zostaje.
 */
export async function knownInWikidata(ids: number[], onBatch?: (done: number, total: number) => void): Promise<WikidataCheck> {
  const known = new Set<number>();
  const failed: number[] = [];
  for (let i = 0; i < ids.length; i += WIKIDATA_BATCH) {
    const batch = ids.slice(i, i + WIKIDATA_BATCH);
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(WIKIDATA_SPARQL, {
        method: 'POST',
        body: new URLSearchParams({ query: sparqlKnownIds(batch) }),
        headers: { Accept: 'application/sparql-results+json' },
        credentials: 'omit',
        signal: AbortSignal.timeout(60_000),
      }).catch(() => null);
      if (res?.ok) {
        const body = (await res.json()) as { results: { bindings: { fw?: { value: string } }[] } };
        for (const b of body.results.bindings) if (b.fw) known.add(Number(b.fw.value));
        break;
      }
      if (attempt >= ATTEMPTS) {
        console.warn(`Kinoskop: Wikidata nie odpowiada (${res?.status ?? 'brak sieci'}) – ${batch.length} pozycji sprawdzę na Filmwebie.`);
        failed.push(...batch);
        break;
      }
      const retryAfter = Number(res?.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30_000, 2000 * 2 ** attempt));
    }
    onBatch?.(Math.min(i + WIKIDATA_BATCH, ids.length), ids.length);
    await sleep(1000);
  }
  return { known, failed };
}
