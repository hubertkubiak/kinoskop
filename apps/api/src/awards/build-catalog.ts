import { type AwardCatalog, type AwardDefinition, type AwardEntry, mapGenres } from '@kinoskop/shared';
import { chunks, qidOf, type SparqlBinding, type WikidataClient } from '../wikidata/client';
import { P, Q } from '../wikidata/ids';

const num = (v?: string) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
const yearOf = (v?: string) => (v ? new Date(v).getUTCFullYear() : undefined);

/** Winners (P166) or nominees (P1411) of one award, on works or – for personal awards – via P1686. */
function awardQuery(a: AwardDefinition, prop: string): string {
  const pattern = a.personal
    ? `?person p:${prop} ?st . ?st ps:${prop} wd:${a.qid} ; pq:${P.forWork} ?work . FILTER NOT EXISTS { ?work wdt:${P.instanceOf} wd:${Q.human} }`
    : // People (producers, directors) also carry P166 for work awards – keep only works.
      `?work p:${prop} ?st . ?st ps:${prop} wd:${a.qid} . FILTER NOT EXISTS { ?work wdt:${P.instanceOf} wd:${Q.human} }`;
  // Many items keep their default label in the multilingual "mul" language instead of "en".
  return `SELECT ?work ?time ?pub ?en ?mul ?pl WHERE { ${pattern}
    OPTIONAL { ?st pq:${P.pointInTime} ?time }
    OPTIONAL { ?work wdt:${P.publicationDate} ?pub }
    OPTIONAL { ?work rdfs:label ?en FILTER(lang(?en) = "en") }
    OPTIONAL { ?work rdfs:label ?mul FILTER(lang(?mul) = "mul") }
    OPTIONAL { ?work rdfs:label ?pl FILTER(lang(?pl) = "pl") } }`;
}

interface RawEntry {
  awardKey: string;
  qid: string;
  year: number;
  won: boolean;
  en?: string;
  pl?: string;
  pubYear?: number;
}

function collect(a: AwardDefinition, rows: SparqlBinding[], won: boolean): RawEntry[] {
  const best = new Map<string, RawEntry>();
  for (const r of rows) {
    const qid = qidOf(r['work']?.value);
    if (!qid) continue;
    const pubYear = yearOf(r['pub']?.value);
    const year = yearOf(r['time']?.value) ?? (pubYear !== undefined ? pubYear + 1 : undefined);
    if (year === undefined) continue;
    const prev = best.get(qid) ?? { awardKey: a.key, qid, year, won };
    // Rows repeat per label / date combination: merge labels, keep the earliest publication year.
    prev.en ??= r['en']?.value ?? r['mul']?.value;
    prev.pl ??= r['pl']?.value;
    if (pubYear !== undefined && (prev.pubYear === undefined || pubYear < prev.pubYear)) prev.pubYear = pubYear;
    best.set(qid, prev);
  }
  return [...best.values()];
}

/**
 * Builds the award catalogue from Wikidata (SPEC §7.7). Nominations are marked as less complete
 * in the UI; a work that won is not listed again as a nominee of the same award.
 */
export async function buildAwardCatalog(wd: WikidataClient, awards: AwardDefinition[]): Promise<AwardCatalog> {
  const raw: RawEntry[] = [];
  for (const a of awards) {
    const winners = collect(a, await wd.query(awardQuery(a, P.awardReceived)), true);
    const nominees = collect(a, await wd.query(awardQuery(a, P.nominatedFor)), false).filter(
      (n) => !winners.some((w) => w.qid === n.qid),
    );
    raw.push(...winners, ...nominees);
    console.log(`  ${a.key}: ${winners.length} winners, ${nominees.length} nominees`);
  }

  // External ids and genres for every work, in batches.
  const ids = new Map<string, { fw?: number; tmdb?: number; tmdbTv?: number; imdb?: string; igdb?: number; genres: string[] }>();
  for (const batch of chunks([...new Set(raw.map((r) => r.qid))], 150)) {
    const values = batch.map((q) => `wd:${q}`).join(' ');
    const rows = await wd.query(`SELECT ?item ?fw ?tmdb ?tmdbtv ?imdb ?igdb WHERE { VALUES ?item { ${values} }
      OPTIONAL { ?item wdt:${P.filmwebFilm} ?fw } OPTIONAL { ?item wdt:${P.tmdbMovie} ?tmdb }
      OPTIONAL { ?item wdt:${P.tmdbTv} ?tmdbtv } OPTIONAL { ?item wdt:${P.imdb} ?imdb }
      OPTIONAL { ?item p:${P.igdbSlug}/pq:${P.igdbNumeric} ?igdb } }`);
    for (const r of rows) {
      const q = qidOf(r['item']?.value)!;
      const e = ids.get(q) ?? { genres: [] };
      e.fw ??= num(r['fw']?.value);
      e.tmdb ??= num(r['tmdb']?.value);
      e.tmdbTv ??= num(r['tmdbtv']?.value);
      e.imdb ??= r['imdb']?.value;
      e.igdb ??= num(r['igdb']?.value);
      ids.set(q, e);
    }
    const genres = await wd.query(`SELECT ?item ?gl WHERE { VALUES ?item { ${values} } ?item wdt:${P.genre} ?g . ?g rdfs:label ?gl FILTER(lang(?gl) = "en") }`);
    for (const r of genres) {
      const e = ids.get(qidOf(r['item']?.value)!) ?? { genres: [] };
      if (r['gl']) e.genres.push(r['gl'].value);
      ids.set(qidOf(r['item']?.value)!, e);
    }
  }

  const kindOf = new Map(awards.map((a) => [a.key, a.kind]));
  const entries: AwardEntry[] = raw
    .map((r) => {
      const x = ids.get(r.qid) ?? { genres: [] };
      const kind = kindOf.get(r.awardKey) ?? 'film';
      return {
        awardKey: r.awardKey,
        year: r.year,
        won: r.won,
        work: {
          wikidataId: r.qid,
          title: r.en ?? r.pl ?? r.qid,
          ...(r.pl && r.pl !== r.en ? { titlePl: r.pl } : {}),
          ...(r.pubYear ? { year: r.pubYear } : {}),
          ...(x.fw ? { filmwebId: x.fw } : {}),
          ...((kind === 'serial' ? x.tmdbTv : x.tmdb) ? { tmdbId: kind === 'serial' ? x.tmdbTv : x.tmdb } : {}),
          ...(x.imdb ? { imdbId: x.imdb } : {}),
          ...(x.igdb ? { igdbId: x.igdb } : {}),
          genres: mapGenres(x.genres, kind),
        },
      };
    })
    .sort((a, b) => a.awardKey.localeCompare(b.awardKey) || a.year - b.year || Number(b.won) - Number(a.won));

  return { generatedAt: new Date().toISOString(), source: 'wikidata', awards, entries };
}
