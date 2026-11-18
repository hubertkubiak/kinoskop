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

/** Stable key of a title across the whole app. */
export const itemKey = (item: { kind: Kind; filmwebId: number }): string =>
  `${item.kind}:${item.filmwebId}`;
