import Bottleneck from 'bottleneck';
import { fetchJson } from '../http/fetch-json';

export interface SparqlBinding {
  [variable: string]: { type: string; value: string } | undefined;
}

export const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

/** Max ~200 IDs per VALUES clause (SPEC §3). */
export const SPARQL_BATCH = 200;

/** SPARQL client: max 2 parallel queries, descriptive User-Agent with contact (SPEC §8.2). */
export class WikidataClient {
  private readonly limiter = new Bottleneck({ maxConcurrent: 2, minTime: 100 });
  private readonly userAgent: string;

  constructor(contact: string) {
    this.userAgent = `Kinoskop/1.0 (kontakt: ${contact})`;
  }

  query(sparql: string): Promise<SparqlBinding[]> {
    return this.limiter.schedule(async () => {
      const body = new URLSearchParams({ query: sparql });
      const res = await fetchJson<{ results: { bindings: SparqlBinding[] } }>(
        'wikidata',
        SPARQL_ENDPOINT,
        {
          method: 'POST',
          body,
          headers: {
            Accept: 'application/sparql-results+json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
          },
        },
        { timeoutMs: 60_000, attempts: 4 },
      );
      return res?.results.bindings ?? [];
    });
  }
}

export const qidOf = (uri: string | undefined): string | undefined =>
  uri ? uri.slice(uri.lastIndexOf('/') + 1) : undefined;

export function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Escapes a string for use inside a SPARQL double-quoted literal. */
export const sparqlString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
