import { type AwardCatalog, AwardCatalogSchema, type TitleAward } from '@kinoskop/shared';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AwardLookup } from '../enrich/pipeline';

/** Candidate locations of awards.json: built assets (dist) and sources (dev with tsx). */
export function awardsJsonPath(): string {
  const candidates = [
    join(__dirname, 'assets/awards.json'),
    join(__dirname, '../assets/awards.json'),
    join(process.cwd(), 'apps/api/src/assets/awards.json'),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[candidates.length - 1];
}

export interface LoadedCatalog {
  catalog: AwardCatalog;
  json: string;
  etag: string;
  lookup: AwardLookup;
}

/** Loads the pre-built catalogue (generated weekly / by `pnpm awards:refresh`, SPEC §8.4 p.3). */
export function loadCatalog(path = awardsJsonPath()): LoadedCatalog {
  let catalog: AwardCatalog;
  try {
    catalog = AwardCatalogSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    catalog = { generatedAt: new Date(0).toISOString(), source: 'wikidata', awards: [], entries: [] };
  }
  const json = JSON.stringify(catalog);
  const etag = `"${createHash('sha1').update(json).digest('hex').slice(0, 16)}"`;

  const names = new Map(catalog.awards.map((a) => [a.key, a.namePl]));
  const byQid = new Map<string, TitleAward[]>();
  const byTmdb = new Map<number, TitleAward[]>();
  for (const e of catalog.entries) {
    const award: TitleAward = { awardKey: e.awardKey, year: e.year, won: e.won, category: names.get(e.awardKey) ?? e.awardKey };
    const push = <K>(m: Map<K, TitleAward[]>, k: K) => m.set(k, [...(m.get(k) ?? []), award]);
    push(byQid, e.work.wikidataId);
    if (e.work.tmdbId) push(byTmdb, e.work.tmdbId);
  }
  const lookup: AwardLookup = ({ wikidataId, tmdbId }) =>
    (wikidataId && byQid.get(wikidataId)) || (tmdbId !== undefined && byTmdb.get(tmdbId)) || [];
  return { catalog, json, etag, lookup };
}
