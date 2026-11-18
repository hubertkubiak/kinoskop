import { z } from 'zod';
import { EraSchema } from './eras';
import { KindSchema } from './kinds';

const Iso2 = z.string().regex(/^[A-Z]{2}$/);

export const PersonSchema = z.object({
  name: z.string(),
  tmdbId: z.number().int().optional(),
  wikidataId: z.string().regex(/^Q\d+$/).optional(),
  profileUrl: z.url().optional(),
  // ISO alpha-2 from Wikidata P27. Gender is never collected (SPEC §1.2).
  nationalities: z.array(Iso2),
});
export type Person = z.infer<typeof PersonSchema>;

export const ProviderSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  logoUrl: z.url().optional(),
});
export type Provider = z.infer<typeof ProviderSchema>;

export const MatchMethodSchema = z.enum(['wikidata', 'tmdb-search', 'igdb-search', 'manual']);
export type MatchMethod = z.infer<typeof MatchMethodSchema>;

export const MatchSchema = z.object({
  wikidataId: z.string().optional(),
  tmdbId: z.number().int().optional(),
  imdbId: z.string().optional(),
  igdbId: z.number().int().optional(),
  method: MatchMethodSchema,
  confidence: z.number().min(0).max(1),
});
export type Match = z.infer<typeof MatchSchema>;

export const TitleAwardSchema = z.object({
  awardKey: z.string(),
  year: z.number().int(),
  won: z.boolean(),
  category: z.string(),
});
export type TitleAward = z.infer<typeof TitleAwardSchema>;

/**
 * Public metadata for a title returned by the backend. Never contains user ratings.
 * Fields beyond SPEC §4 (runtimeMinutes, publicRating, overview) are required by
 * §7.1 (screen time), §7.3 (TMDB vote_average) and §7.11 (AI input).
 */
export const EnrichmentSchema = z.object({
  filmwebId: z.number().int(),
  kind: KindSchema,
  match: MatchSchema,
  title: z.string().optional(),
  originalTitle: z.string().optional(),
  year: z.number().int().optional(),
  posterUrl: z.url().optional(),
  genres: z.array(z.string()),
  countries: z.array(Iso2),
  directors: z.array(PersonSchema),
  cast: z.array(PersonSchema),
  setInPeriod: z.array(EraSchema),
  narrativeLocations: z.array(z.string()),
  keywords: z.array(z.string()),
  runtimeMinutes: z.number().int().positive().optional(),
  overview: z.string().optional(),
  publicRating: z
    .object({ tmdb: z.number().min(0).max(10).optional(), tmdbVotes: z.number().int().optional() })
    .optional(),
  providersPL: z
    .object({
      flatrate: z.array(ProviderSchema),
      rent: z.array(ProviderSchema),
      buy: z.array(ProviderSchema),
      link: z.url().optional(),
    })
    .optional(),
  critics: z
    .object({
      imdb: z.number().optional(),
      rottenTomatoes: z.number().optional(),
      metacritic: z.number().optional(),
    })
    .optional(),
  awards: z.array(TitleAwardSchema),
});
export type Enrichment = z.infer<typeof EnrichmentSchema>;

/** Empty enrichment skeleton used by the backend and by manual overrides. */
export function emptyEnrichment(
  filmwebId: number,
  kind: z.infer<typeof KindSchema>,
  match: Match,
): Enrichment {
  return {
    filmwebId,
    kind,
    match,
    genres: [],
    countries: [],
    directors: [],
    cast: [],
    setInPeriod: [],
    narrativeLocations: [],
    keywords: [],
    awards: [],
  };
}
