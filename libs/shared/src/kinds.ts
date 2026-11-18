import { z } from 'zod';

export const KindSchema = z.enum(['film', 'serial', 'game']);
export type Kind = z.infer<typeof KindSchema>;
export const KINDS: readonly Kind[] = KindSchema.options;

export const ListSchema = z.enum(['rated', 'want2see']);
export type ListKind = z.infer<typeof ListSchema>;

export const KIND_LABELS: Record<Kind, { one: string; many: string }> = {
  film: { one: 'Film', many: 'Filmy' },
  serial: { one: 'Serial', many: 'Seriale' },
  game: { one: 'Gra', many: 'Gry' },
};

/**
 * Item id: a positive number is the Filmweb ID (console script); a negative number is a local,
 * deterministic key for titles imported from files without Filmweb IDs (e.g. Letterboxd CSV).
 */
export const ItemIdSchema = z
  .number()
  .int()
  .refine((n) => n !== 0, 'id nie może być 0');

/** True when the id is a local key, not a Filmweb ID (no Wikidata P5032 lookup possible). */
export const isLocalId = (id: number): boolean => id < 0;

/** Stable key of a title across the whole app. */
export const itemKey = (item: { kind: Kind; filmwebId: number }): string =>
  `${item.kind}:${item.filmwebId}`;
