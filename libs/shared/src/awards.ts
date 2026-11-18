import { z } from 'zod';
import { KindSchema } from './kinds';

export const AwardDefinitionSchema = z.object({
  key: z.string(),
  namePl: z.string(),
  shortPl: z.string(),
  kind: KindSchema,
  /** Wikidata item of the award category, verified by query (see awards.config.ts). */
  qid: z.string().regex(/^Q\d+$/),
  /** Personal awards (e.g. best director) are stored on people with P1686 "for work". */
  personal: z.boolean(),
});
export type AwardDefinition = z.infer<typeof AwardDefinitionSchema>;

export const AwardWorkSchema = z.object({
  wikidataId: z.string(),
  title: z.string(),
  titlePl: z.string().optional(),
  year: z.number().int().optional(),
  filmwebId: z.number().int().optional(),
  tmdbId: z.number().int().optional(),
  imdbId: z.string().optional(),
  igdbId: z.number().int().optional(),
  /** Polish genre names (from Wikidata P136), used to rank recommendations. */
  genres: z.array(z.string()).optional(),
});
export type AwardWork = z.infer<typeof AwardWorkSchema>;

export const AwardEntrySchema = z.object({
  awardKey: z.string(),
  /** Ceremony year (P585 qualifier), falls back to the work's publication year + 1. */
  year: z.number().int(),
  won: z.boolean(),
  work: AwardWorkSchema,
});
export type AwardEntry = z.infer<typeof AwardEntrySchema>;

export const AwardCatalogSchema = z.object({
  generatedAt: z.string(),
  source: z.literal('wikidata'),
  awards: z.array(AwardDefinitionSchema),
  entries: z.array(AwardEntrySchema),
});
export type AwardCatalog = z.infer<typeof AwardCatalogSchema>;
