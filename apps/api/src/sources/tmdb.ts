import Bottleneck from 'bottleneck';
import { z } from 'zod';
import { fetchJson } from '../http/fetch-json';

/**
 * TMDB v3 client. Endpoints verified in the TMDB OpenAPI spec (developer.themoviedb.org):
 *  GET /3/movie/{id}, /3/tv/{id} with append_to_response=credits,keywords,watch/providers,translations,images
 *  and include_image_language=pl,null (Polish posters first; checked against the live API 2026-11-19)
 *  GET /3/search/movie (query, primary_release_year), GET /3/search/tv (query, first_air_date_year)
 * Movie keywords come as `keywords.keywords[]`, TV keywords as `keywords.results[]`.
 * Watch providers: `results.PL.{link, flatrate, rent, buy}[]` (data by JustWatch – attribution required).
 */
const BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMG = 'https://image.tmdb.org/t/p';

const Named = z.object({ id: z.number(), name: z.string() });
const ProviderRow = z.object({ provider_id: z.number(), provider_name: z.string(), logo_path: z.string().nullish() });
const CreditPerson = z.object({
  id: z.number(),
  name: z.string(),
  job: z.string().optional(),
  order: z.number().optional(),
  profile_path: z.string().nullish(),
});

export const TmdbDetailsSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  runtime: z.number().nullish(),
  overview: z.string().nullish(),
  poster_path: z.string().nullish(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
  imdb_id: z.string().nullish(),
  genres: z.array(Named).default([]),
  production_countries: z.array(z.object({ iso_3166_1: z.string() })).default([]),
  origin_country: z.array(z.string()).default([]),
  created_by: z.array(z.object({ id: z.number(), name: z.string(), profile_path: z.string().nullish() })).default([]),
  credits: z.object({ cast: z.array(CreditPerson).default([]), crew: z.array(CreditPerson).default([]) }).optional(),
  keywords: z.object({ keywords: z.array(Named).optional(), results: z.array(Named).optional() }).optional(),
  'watch/providers': z
    .object({
      results: z.record(
        z.string(),
        z.object({
          link: z.string().optional(),
          flatrate: z.array(ProviderRow).optional(),
          rent: z.array(ProviderRow).optional(),
          buy: z.array(ProviderRow).optional(),
        }),
      ),
    })
    .optional(),
  images: z.object({ posters: z.array(z.object({ iso_639_1: z.string().nullish(), file_path: z.string() })).default([]) }).optional(),
  translations: z
    .object({
      translations: z.array(
        z.object({
          iso_639_1: z.string(),
          data: z.object({ title: z.string().optional(), name: z.string().optional(), overview: z.string().optional() }),
        }),
      ),
    })
    .optional(),
});
export type TmdbDetails = z.infer<typeof TmdbDetailsSchema>;

const SearchResult = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullish(),
  overview: z.string().nullish(),
  popularity: z.number().optional(),
});
export type TmdbSearchResult = z.infer<typeof SearchResult>;

export type TmdbKind = 'movie' | 'tv';

export class TmdbClient {
  // TMDB documents "somewhere in the 40 requests per second range" and asks to respect 429
  // (developer.themoviedb.org/docs/rate-limiting, checked 2026-11-19; the old 40 / 10 s limit was
  // disabled in 2019). We stay at half of that; fetchJson backs off on 429 using Retry-After.
  private readonly limiter = new Bottleneck({
    reservoir: 20,
    reservoirRefreshAmount: 20,
    reservoirRefreshInterval: 1_000,
    maxConcurrent: 12,
  });

  constructor(private readonly token: string) {}

  get enabled(): boolean {
    return this.token.length > 0;
  }

  private get<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
    return this.limiter.schedule(async () => {
      const raw = await fetchJson<unknown>('tmdb', `${BASE}${path}`, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
      });
      return raw === null ? null : schema.parse(raw);
    });
  }

  details(kind: TmdbKind, id: number): Promise<TmdbDetails | null> {
    const append = 'credits,keywords,watch/providers,translations,images';
    return this.get(
      `/${kind}/${id}?language=en-US&include_image_language=pl,null&append_to_response=${append}`,
      TmdbDetailsSchema,
    );
  }

  async search(kind: TmdbKind, query: string, year?: number): Promise<TmdbSearchResult[]> {
    const p = new URLSearchParams({ query, include_adult: 'false', language: 'pl-PL' });
    if (year) p.set(kind === 'movie' ? 'primary_release_year' : 'first_air_date_year', String(year));
    const res = await this.get(`/search/${kind}?${p}`, z.object({ results: z.array(SearchResult) }));
    return res?.results ?? [];
  }
}

export const posterUrl = (path: string | null | undefined, size = 'w342') =>
  path ? `${TMDB_IMG}/${size}${path}` : undefined;
