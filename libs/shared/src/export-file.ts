import { z } from 'zod';
import { KindSchema, ListSchema } from './kinds';

/** Format version produced by libs/import-script. Bump on breaking change. */
export const EXPORT_SCHEMA_VERSION = 1 as const;

export const ExportItemSchema = z.object({
  filmwebId: z.number().int().positive(),
  kind: KindSchema,
  list: ListSchema,
  rating: z.number().int().min(1).max(10).optional(),
  favorite: z.boolean().optional(),
  ratedAt: z.iso.datetime({ offset: true }).optional(),
  // Used only for matching in TMDB / IGDB / Wikidata, never shown as Filmweb metadata.
  title: z.string().min(1).max(500).optional(),
  originalTitle: z.string().min(1).max(500).optional(),
  year: z.number().int().min(1870).max(2100).optional(),
});
export type ExportItem = z.infer<typeof ExportItemSchema>;

export const ExportFileSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.iso.datetime({ offset: true }),
  source: z.literal('filmweb'),
  scriptVersion: z.string().max(20).optional(),
  user: z.object({ id: z.number().int(), name: z.string() }),
  items: z.array(ExportItemSchema).max(50_000),
});
export type ExportFile = z.infer<typeof ExportFileSchema>;

export type ExportParseResult =
  | { ok: true; file: ExportFile }
  | { ok: false; reason: 'json' | 'version' | 'schema'; message: string; schemaVersion?: unknown };

/** Parses and validates a user-supplied export file (script output, demo or fixture). */
export function parseExportFile(text: string): ExportParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json', message: 'Plik nie jest poprawnym JSON-em.' };
  }
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version !== EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'version',
      schemaVersion: version,
      message: `Nieobsługiwana wersja schematu: ${String(version)} (oczekiwana ${EXPORT_SCHEMA_VERSION}).`,
    };
  }
  const parsed = ExportFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: 'schema',
      message: `Niepoprawna zawartość pliku (${issue?.path.join('.') || 'root'}: ${issue?.message}).`,
    };
  }
  return { ok: true, file: parsed.data };
}
