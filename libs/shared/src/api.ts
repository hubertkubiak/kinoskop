import { z } from 'zod';
import { EnrichmentSchema } from './enrichment';
import { KindSchema } from './kinds';

export const ENRICH_MAX_ITEMS = 200;

/**
 * POST /api/enrich. Stage 1 sends only ids; stage 2 (unmatched only) adds title and year.
 * Ratings are never part of this schema (SPEC §14.4); `.strict()` rejects extra fields.
 */
export const EnrichRequestItemSchema = z
  .object({
    filmwebId: z.number().int().positive(),
    kind: KindSchema,
    title: z.string().min(1).max(500).optional(),
    originalTitle: z.string().min(1).max(500).optional(),
    year: z.number().int().min(1870).max(2100).optional(),
  })
  .strict();
export type EnrichRequestItem = z.infer<typeof EnrichRequestItemSchema>;

export const EnrichRequestSchema = z
  .object({ items: z.array(EnrichRequestItemSchema).min(1).max(ENRICH_MAX_ITEMS) })
  .strict();
export type EnrichRequest = z.infer<typeof EnrichRequestSchema>;

export const EnrichErrorSchema = z.object({
  filmwebId: z.number().int(),
  kind: KindSchema,
  code: z.enum(['unmatched', 'source-error', 'invalid']),
  message: z.string(),
});
export type EnrichError = z.infer<typeof EnrichErrorSchema>;

export const EnrichResponseSchema = z.object({
  results: z.array(EnrichmentSchema),
  errors: z.array(EnrichErrorSchema),
  cacheHits: z.number().int(),
});
export type EnrichResponse = z.infer<typeof EnrichResponseSchema>;

/** GET /api/search */
export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  kind: KindSchema,
  year: z.coerce.number().int().min(1870).max(2100).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchCandidateSchema = z.object({
  kind: KindSchema,
  tmdbId: z.number().int().optional(),
  igdbId: z.number().int().optional(),
  title: z.string(),
  originalTitle: z.string().optional(),
  year: z.number().int().optional(),
  posterUrl: z.url().optional(),
  overview: z.string().optional(),
});
export type SearchCandidate = z.infer<typeof SearchCandidateSchema>;

export const SearchResponseSchema = z.object({ candidates: z.array(SearchCandidateSchema) });
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/** POST /api/enrich/manual — resolve a user-picked candidate into a full enrichment. */
export const ManualMatchRequestSchema = z
  .object({
    filmwebId: z.number().int().positive(),
    kind: KindSchema,
    tmdbId: z.number().int().optional(),
    igdbId: z.number().int().optional(),
  })
  .strict();
export type ManualMatchRequest = z.infer<typeof ManualMatchRequestSchema>;

/** GET /api/config */
export const ConfigResponseSchema = z.object({
  criticsEnabled: z.boolean(),
  gamesEnabled: z.boolean(),
  tmdbEnabled: z.boolean(),
});
export type ConfigResponse = z.infer<typeof ConfigResponseSchema>;

/** GET /api/health */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  awardsCatalog: z.object({ generatedAt: z.string().nullable(), ageHours: z.number().nullable() }),
  integrations: z.object({
    wikidata: z.boolean(),
    tmdb: z.boolean(),
    igdb: z.boolean(),
    omdb: z.boolean(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
