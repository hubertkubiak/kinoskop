import { type Era, eraFromLabel, eraFromYear } from '@kinoskop/shared';
import { chunks, qidOf, SPARQL_BATCH, sparqlString, type WikidataClient } from './client';
import { P, Q } from './ids';

/** Public facts about a title found through its Filmweb ID in Wikidata. */
export interface WikidataTitle {
  qid: string;
  filmwebId: number;
  tmdbMovieId?: number;
  tmdbTvId?: number;
  imdbId?: string;
  igdbId?: number;
  label?: string;
  year?: number;
  countries: string[];
  directors: { qid: string; name: string; tmdbId?: number; nationalities: string[] }[];
  eras: Era[];
  narrativeLocations: string[];
  genresEn: string[];
  runtimeMinutes?: number;
}

const num = (v?: string) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);

function blank(qid: string, filmwebId: number): WikidataTitle {
  return { qid, filmwebId, countries: [], directors: [], eras: [], narrativeLocations: [], genresEn: [] };
}

/**
 * Batch lookup by Filmweb ID: P5032 (numeric) plus the legacy slug P3995 ("…-ID") for games.
 * Several small queries instead of one big join avoid cartesian explosions and timeouts.
 */
export async function lookupByFilmwebIds(wd: WikidataClient, ids: number[]): Promise<Map<number, WikidataTitle>> {
  const out = new Map<number, WikidataTitle>();
  for (const batch of chunks([...new Set(ids)], SPARQL_BATCH)) {
    const values = batch.map((id) => sparqlString(String(id))).join(' ');
    const base = await wd.query(`SELECT ?item ?fw ?tmdb ?tmdbtv ?imdb ?igdb ?label ?date ?dur WHERE {
      VALUES ?fw { ${values} } ?item wdt:${P.filmwebFilm} ?fw .
      OPTIONAL { ?item wdt:${P.tmdbMovie} ?tmdb } OPTIONAL { ?item wdt:${P.tmdbTv} ?tmdbtv }
      OPTIONAL { ?item wdt:${P.imdb} ?imdb }
      OPTIONAL { ?item p:${P.igdbSlug}/pq:${P.igdbNumeric} ?igdb }
      OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "pl") }
      OPTIONAL { ?item wdt:${P.publicationDate} ?date }
      OPTIONAL { ?item p:${P.duration}/psv:${P.duration} [ wikibase:quantityAmount ?dur; wikibase:quantityUnit wd:${Q.minute} ] }
    }`);
    for (const b of base) {
      const fw = num(b['fw']?.value);
      const qid = qidOf(b['item']?.value);
      if (!fw || !qid) continue;
      const t = out.get(fw) ?? blank(qid, fw);
      t.tmdbMovieId ??= num(b['tmdb']?.value);
      t.tmdbTvId ??= num(b['tmdbtv']?.value);
      t.imdbId ??= b['imdb']?.value;
      t.igdbId ??= num(b['igdb']?.value);
      t.label ??= b['label']?.value;
      const y = b['date'] ? new Date(b['date'].value).getUTCFullYear() : undefined;
      if (y && (!t.year || y < t.year)) t.year = y;
      if (b['dur'] && !t.runtimeMinutes) t.runtimeMinutes = Math.round(Number(b['dur'].value));
      out.set(fw, t);
    }
  }
  await addDetails(wd, out);
  return out;
}

async function addDetails(wd: WikidataClient, titles: Map<number, WikidataTitle>): Promise<void> {
  const byQid = new Map([...titles.values()].map((t) => [t.qid, t]));
  for (const batch of chunks([...byQid.keys()], SPARQL_BATCH)) {
    const values = batch.map((q) => `wd:${q}`).join(' ');
    const run = (body: string) => wd.query(`SELECT * WHERE { VALUES ?item { ${values} } ${body} }`);

    for (const b of await run(`?item wdt:${P.countryOfOrigin}/wdt:${P.iso2} ?iso .`)) {
      const t = byQid.get(qidOf(b['item']?.value) ?? '');
      if (t && b['iso'] && !t.countries.includes(b['iso'].value)) t.countries.push(b['iso'].value);
    }
    for (const b of await run(`?item wdt:${P.director} ?d . ?d rdfs:label ?name FILTER(lang(?name) = "en")
        OPTIONAL { ?d wdt:${P.tmdbPerson} ?tmdbp } OPTIONAL { ?d wdt:${P.citizenship}/wdt:${P.iso2} ?iso }`)) {
      const t = byQid.get(qidOf(b['item']?.value) ?? '');
      const dq = qidOf(b['d']?.value);
      if (!t || !dq) continue;
      let d = t.directors.find((x) => x.qid === dq);
      if (!d) t.directors.push((d = { qid: dq, name: b['name']?.value ?? dq, tmdbId: num(b['tmdbp']?.value), nationalities: [] }));
      if (b['iso'] && !d.nationalities.includes(b['iso'].value)) d.nationalities.push(b['iso'].value);
    }
    for (const b of await run(`?item wdt:${P.setInPeriod} ?p . ?p rdfs:label ?pl FILTER(lang(?pl) = "en")
        OPTIONAL { ?p wdt:${P.startTime} ?start } OPTIONAL { ?p wdt:${P.pointInTime} ?pit }`)) {
      const t = byQid.get(qidOf(b['item']?.value) ?? '');
      if (!t || !b['pl']) continue;
      const when = b['start']?.value ?? b['pit']?.value;
      const key = eraFromLabel(b['pl'].value) ?? (when ? eraFromYear(new Date(when).getUTCFullYear()) : undefined);
      if (key && !t.eras.some((e) => e.key === key)) t.eras.push({ key, source: 'wikidata' });
    }
    for (const b of await run(`?item wdt:${P.narrativeLocation} ?l . ?l rdfs:label ?ll FILTER(lang(?ll) = "pl")`)) {
      const t = byQid.get(qidOf(b['item']?.value) ?? '');
      if (t && b['ll'] && t.narrativeLocations.length < 8) t.narrativeLocations.push(b['ll'].value);
    }
    for (const b of await run(`?item wdt:${P.genre} ?g . ?g rdfs:label ?gl FILTER(lang(?gl) = "en")`)) {
      const t = byQid.get(qidOf(b['item']?.value) ?? '');
      if (t && b['gl']) t.genresEn.push(b['gl'].value);
    }
  }
}

/** TMDB person id → ISO alpha-2 citizenships (P4985 → P27 → P297). */
export async function nationalitiesByTmdbPerson(
  wd: WikidataClient,
  tmdbIds: number[],
): Promise<Map<number, { qid: string; nationalities: string[] }>> {
  const out = new Map<number, { qid: string; nationalities: string[] }>();
  for (const batch of chunks([...new Set(tmdbIds)], SPARQL_BATCH)) {
    const values = batch.map((id) => sparqlString(String(id))).join(' ');
    const rows = await wd.query(`SELECT ?p ?tmdb ?iso WHERE { VALUES ?tmdb { ${values} } ?p wdt:${P.tmdbPerson} ?tmdb .
      OPTIONAL { ?p wdt:${P.citizenship}/wdt:${P.iso2} ?iso } }`);
    for (const b of rows) {
      const id = num(b['tmdb']?.value);
      const qid = qidOf(b['p']?.value);
      if (!id || !qid) continue;
      const entry = out.get(id) ?? { qid, nationalities: [] };
      if (b['iso'] && !entry.nationalities.includes(b['iso'].value)) entry.nationalities.push(b['iso'].value);
      out.set(id, entry);
    }
  }
  return out;
}
