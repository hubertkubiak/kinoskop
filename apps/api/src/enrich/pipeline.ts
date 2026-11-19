import {
  type EnrichError,
  type EnrichRequestItem,
  type EnrichResponse,
  type Enrichment,
  emptyEnrichment,
  type Era,
  eraFromLabel,
  isLocalId,
  type Kind,
  type Match,
  mapGenres,
  mergeEras,
  type Person,
  type Provider,
  type TitleAward,
} from '@kinoskop/shared';
import { type CacheStore, DAY } from '../cache/cache-store';
import { type IgdbClient, igdbCover, type IgdbGame, igdbYear } from '../sources/igdb';
import type { OmdbClient } from '../sources/omdb';
import { posterUrl, type TmdbClient, type TmdbDetails, type TmdbKind, TMDB_IMG } from '../sources/tmdb';
import type { WikidataClient } from '../wikidata/client';
import { lookupByFilmwebIds, nationalitiesByTmdbPerson, type WikidataTitle } from '../wikidata/titles';
import { bestMatch, MIN_ACCEPTED_CONFIDENCE } from './matching';

const TTL_ENRICHMENT = 30 * DAY;
const TTL_PERSON = 90 * DAY;
const TTL_MISS = 7 * DAY;
const CAST_SIZE = 10;
/** Bump when the shape or sources of a built enrichment change (v2: Polish posters). */
const NS_ENRICHMENT = 'enrichment-v2';

export interface Sources {
  wikidata: WikidataClient;
  tmdb: TmdbClient;
  igdb: IgdbClient;
  omdb: OmdbClient;
}

/** Awards of a work, looked up in the award catalogue (by Wikidata QID or TMDB id). */
export type AwardLookup = (ids: { wikidataId?: string; tmdbId?: number }) => TitleAward[];

const tmdbKind = (k: Kind): TmdbKind => (k === 'serial' ? 'tv' : 'movie');
const yearOf = (d?: string) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : undefined);

/**
 * Enrichment pipeline (SPEC §8.2): cache → Wikidata → search fallback → TMDB/IGDB details →
 * nationalities → OMDb → eras → awards → cache. Partial results instead of failing the batch.
 */
export class EnrichmentPipeline {
  constructor(
    private readonly sources: Sources,
    private readonly cache: CacheStore,
    private readonly awards: AwardLookup = () => [],
  ) {}

  async enrich(items: EnrichRequestItem[]): Promise<EnrichResponse> {
    const results: Enrichment[] = [];
    const errors: EnrichError[] = [];
    let cacheHits = 0;
    const misses: EnrichRequestItem[] = [];

    for (const it of items) {
      const hit = this.cache.get<Enrichment>(NS_ENRICHMENT, `${it.kind}:${it.filmwebId}`);
      if (hit) {
        results.push(hit);
        cacheHits++;
      } else misses.push(it);
    }

    // Wikidata lookup only for ids not known to be absent there.
    // Local ids (CSV imports, negative) have no Filmweb ID, so there is nothing to look up in Wikidata.
    const needWd = misses.filter((it) => !isLocalId(it.filmwebId) && !this.cache.get<boolean>('wd-miss', String(it.filmwebId)));
    let wd = new Map<number, WikidataTitle>();
    if (needWd.length) {
      try {
        wd = await lookupByFilmwebIds(this.sources.wikidata, needWd.map((i) => i.filmwebId));
        for (const it of needWd) if (!wd.has(it.filmwebId)) this.cache.set('wd-miss', String(it.filmwebId), true, TTL_MISS);
      } catch {
        // Wikidata down: continue with search fallback where possible.
      }
    }
    cacheHits += misses.filter((it) => !isLocalId(it.filmwebId)).length - needWd.length;

    const built = await Promise.all(
      misses.map(async (it) => {
        try {
          return await this.enrichOne(it, wd.get(it.filmwebId));
        } catch (e) {
          return { error: { filmwebId: it.filmwebId, kind: it.kind, code: 'source-error', message: (e as Error).message } as EnrichError };
        }
      }),
    );
    const fresh: Enrichment[] = [];
    for (const b of built) {
      if ('error' in b) errors.push(b.error);
      else fresh.push(b.enrichment);
    }
    await this.addNationalities(fresh);
    for (const e of fresh) {
      this.cache.set(NS_ENRICHMENT, `${e.kind}:${e.filmwebId}`, e, TTL_ENRICHMENT);
      results.push(e);
    }
    return { results, errors, cacheHits };
  }

  /** Builds an enrichment for a user-picked TMDB/IGDB candidate (verification view). */
  async manual(filmwebId: number, kind: Kind, ids: { tmdbId?: number; igdbId?: number }): Promise<Enrichment | null> {
    const match: Match = { method: 'manual', confidence: 1, tmdbId: ids.tmdbId, igdbId: ids.igdbId };
    const e = await this.build(filmwebId, kind, match, undefined);
    if (e) await this.addNationalities([e]);
    return e;
  }

  private async enrichOne(
    it: EnrichRequestItem,
    wd: WikidataTitle | undefined,
  ): Promise<{ enrichment: Enrichment } | { error: EnrichError }> {
    let match: Match | null = null;
    if (wd) {
      match = {
        method: 'wikidata',
        confidence: 1,
        wikidataId: wd.qid,
        imdbId: wd.imdbId,
        tmdbId: it.kind === 'serial' ? wd.tmdbTvId : wd.tmdbMovieId,
        igdbId: wd.igdbId,
      };
    } else if (it.title || it.originalTitle) {
      if (this.cache.get<boolean>('search-miss', `${it.kind}:${it.filmwebId}`)) {
        return { error: { filmwebId: it.filmwebId, kind: it.kind, code: 'unmatched', message: 'Brak dopasowania' } };
      }
      match = await this.search(it);
      if (!match) {
        this.cache.set('search-miss', `${it.kind}:${it.filmwebId}`, true, TTL_MISS);
      }
    }
    if (!match) {
      return { error: { filmwebId: it.filmwebId, kind: it.kind, code: 'unmatched', message: 'Brak dopasowania w Wikidata' } };
    }
    const e = await this.build(it.filmwebId, it.kind, match, wd);
    if (!e) return { error: { filmwebId: it.filmwebId, kind: it.kind, code: 'unmatched', message: 'Brak danych źródłowych' } };
    return { enrichment: e };
  }

  private async search(it: EnrichRequestItem): Promise<Match | null> {
    const titles = [it.originalTitle, it.title].filter((t): t is string => !!t);
    if (it.kind === 'game') {
      if (!this.sources.igdb.enabled) return null;
      const games = (await Promise.all(titles.map((t) => this.sources.igdb.search(t)))).flat();
      const best = bestMatch({ titles, year: it.year }, games.map((g) => ({ g, titles: [g.name], year: igdbYear(g) })));
      return best && best.confidence >= MIN_ACCEPTED_CONFIDENCE
        ? { method: 'igdb-search', confidence: best.confidence, igdbId: best.candidate.g.id }
        : null;
    }
    if (!this.sources.tmdb.enabled) return null;
    const kind = tmdbKind(it.kind);
    // Original title first, then Polish; year ±1 handled by the scoring.
    const found = (await Promise.all(titles.map((t) => this.sources.tmdb.search(kind, t)))).flat();
    const best = bestMatch(
      { titles, year: it.year },
      found.map((r) => ({
        r,
        titles: [r.title, r.name, r.original_title, r.original_name].filter((x): x is string => !!x),
        year: yearOf(r.release_date ?? r.first_air_date),
      })),
    );
    return best && best.confidence >= MIN_ACCEPTED_CONFIDENCE
      ? { method: 'tmdb-search', confidence: best.confidence, tmdbId: best.candidate.r.id }
      : null;
  }

  private async build(filmwebId: number, kind: Kind, match: Match, wd: WikidataTitle | undefined): Promise<Enrichment | null> {
    const e = emptyEnrichment(filmwebId, kind, match);
    if (wd) this.applyWikidata(e, wd);

    if (kind === 'game') {
      if (match.igdbId && this.sources.igdb.enabled) {
        const g = await this.cached('igdb', String(match.igdbId), () => this.sources.igdb.byId(match.igdbId!));
        if (g) this.applyIgdb(e, g);
      }
    } else if (match.tmdbId && this.sources.tmdb.enabled) {
      const k = tmdbKind(kind);
      // "-v2": details now include Polish posters (images); older cache entries lack them.
      const d = await this.cached(`tmdb2-${k}`, String(match.tmdbId), () => this.sources.tmdb.details(k, match.tmdbId!));
      if (d) this.applyTmdb(e, d);
    }
    if (!wd && !e.title && !e.originalTitle) return null;

    if (e.match.imdbId && this.sources.omdb.enabled) {
      try {
        e.critics = await this.cached('omdb', e.match.imdbId, () => this.sources.omdb.byImdbId(e.match.imdbId!));
      } catch {
        /* optional source */
      }
    }
    e.awards = this.awards({ wikidataId: e.match.wikidataId, tmdbId: e.match.tmdbId });
    return e;
  }

  private async cached<T>(ns: string, key: string, load: () => Promise<T | null | undefined>): Promise<T | undefined> {
    const hit = this.cache.get<T>(ns, key);
    if (hit) return hit;
    const v = await load();
    if (v) this.cache.set(ns, key, v, TTL_ENRICHMENT);
    return v ?? undefined;
  }

  private applyWikidata(e: Enrichment, wd: WikidataTitle): void {
    e.title = wd.label;
    e.year = wd.year;
    e.countries = [...wd.countries].sort();
    e.directors = wd.directors.map((d) => ({ name: d.name, wikidataId: d.qid, tmdbId: d.tmdbId, nationalities: [...d.nationalities].sort() }));
    e.setInPeriod = wd.eras;
    e.narrativeLocations = wd.narrativeLocations;
    e.genres = mapGenres(wd.genresEn, e.kind);
    if (e.kind === 'film' && wd.runtimeMinutes && wd.runtimeMinutes > 20 && wd.runtimeMinutes < 400) e.runtimeMinutes = wd.runtimeMinutes;
  }

  private applyTmdb(e: Enrichment, d: TmdbDetails): void {
    const pl = d.translations?.translations.find((t) => t.iso_639_1 === 'pl')?.data;
    e.title = pl?.title || pl?.name || e.title || d.title || d.name;
    e.originalTitle = d.original_title ?? d.original_name;
    e.year = yearOf(d.release_date ?? d.first_air_date) ?? e.year;
    // Polish poster when TMDB has one, otherwise the default (usually English) one.
    e.posterUrl = posterUrl(d.images?.posters.find((p) => p.iso_639_1 === 'pl')?.file_path ?? d.poster_path);
    e.overview = pl?.overview || d.overview || undefined;
    if (d.genres.length) e.genres = mapGenres(d.genres.map((g) => g.name), e.kind);
    const countries = d.production_countries.map((c) => c.iso_3166_1);
    if (!countries.length) countries.push(...d.origin_country);
    if (countries.length) e.countries = [...new Set(countries)].sort();
    if (d.runtime && e.kind === 'film') e.runtimeMinutes = d.runtime;
    if (d.imdb_id) e.match.imdbId = d.imdb_id;
    if (d.vote_average !== undefined) e.publicRating = { tmdb: d.vote_average, tmdbVotes: d.vote_count };

    const toPerson = (p: { id: number; name: string; profile_path?: string | null }): Person => ({
      name: p.name,
      tmdbId: p.id,
      profileUrl: p.profile_path ? `${TMDB_IMG}/w185${p.profile_path}` : undefined,
      nationalities: e.directors.find((x) => x.tmdbId === p.id)?.nationalities ?? [],
    });
    const directors = e.kind === 'serial' ? d.created_by : (d.credits?.crew ?? []).filter((c) => c.job === 'Director');
    if (directors.length) e.directors = directors.map(toPerson);
    e.cast = [...(d.credits?.cast ?? [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, CAST_SIZE)
      .map(toPerson);

    const keywords = (d.keywords?.keywords ?? d.keywords?.results ?? []).map((k) => k.name);
    e.keywords = keywords;
    const kwEras: Era[] = keywords
      .map((k) => eraFromLabel(k))
      .filter((k): k is NonNullable<typeof k> => !!k)
      .map((key) => ({ key, source: 'keywords' as const }));
    e.setInPeriod = mergeEras(e.setInPeriod, kwEras);

    const pl2 = d['watch/providers']?.results['PL'];
    if (pl2) {
      const conv = (rows?: { provider_id: number; provider_name: string; logo_path?: string | null }[]): Provider[] =>
        (rows ?? []).map((r) => ({ id: r.provider_id, name: r.provider_name, logoUrl: r.logo_path ? `${TMDB_IMG}/w92${r.logo_path}` : undefined }));
      e.providersPL = { flatrate: conv(pl2.flatrate), rent: conv(pl2.rent), buy: conv(pl2.buy), link: pl2.link };
    }
  }

  private applyIgdb(e: Enrichment, g: IgdbGame): void {
    e.title ??= g.name;
    e.originalTitle = g.name !== e.title ? g.name : undefined;
    e.year = igdbYear(g) ?? e.year;
    e.posterUrl = igdbCover(g);
    e.overview = g.summary;
    e.genres = mapGenres((g.genres ?? []).map((x) => x.name), 'game');
    e.keywords = (g.themes ?? []).map((t) => t.name);
    const kwEras: Era[] = e.keywords
      .map((k) => eraFromLabel(k))
      .filter((k): k is NonNullable<typeof k> => !!k)
      .map((key) => ({ key, source: 'keywords' as const }));
    if ((g.themes ?? []).some((t) => t.name.toLowerCase() === 'science fiction')) kwEras.push({ key: 'future', source: 'keywords' });
    if ((g.themes ?? []).some((t) => t.name.toLowerCase() === 'fantasy')) kwEras.push({ key: 'fictional', source: 'keywords' });
    e.setInPeriod = mergeEras(e.setInPeriod, kwEras);
  }

  /** Fills nationalities of people (TMDB person id → Wikidata P27), cached for 90 days. */
  private async addNationalities(list: Enrichment[]): Promise<void> {
    const people = list.flatMap((e) => [...e.directors, ...e.cast]).filter((p) => p.tmdbId !== undefined && !p.nationalities.length);
    const need: number[] = [];
    for (const p of people) {
      const hit = this.cache.get<{ qid: string; nationalities: string[] } | null>('person', String(p.tmdbId));
      if (hit !== undefined) {
        if (hit) Object.assign(p, { wikidataId: hit.qid, nationalities: hit.nationalities });
      } else need.push(p.tmdbId!);
    }
    if (!need.length) return;
    try {
      const found = await nationalitiesByTmdbPerson(this.sources.wikidata, need);
      for (const id of new Set(need)) this.cache.set('person', String(id), found.get(id) ?? null, TTL_PERSON);
      for (const p of people) {
        const f = p.tmdbId !== undefined ? found.get(p.tmdbId) : undefined;
        if (f) Object.assign(p, { wikidataId: f.qid, nationalities: [...f.nationalities].sort() });
      }
    } catch {
      /* nationalities are best-effort */
    }
  }
}
