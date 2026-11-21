import { type Enrichment, emptyEnrichment, type ExportFile, type ExportItem, type Kind } from '@kinoskop/shared';

/** Test data builders shared by the service specs (fictional titles and users only). */

export function exportItem(filmwebId: number, patch: Partial<ExportItem> = {}): ExportItem {
  return { filmwebId, kind: 'film', list: 'rated', rating: 7, ...patch };
}

export function exportFile(items: ExportItem[], patch: Partial<ExportFile> = {}): ExportFile {
  return {
    schemaVersion: 1,
    exportedAt: '2026-11-01T12:00:00.000Z',
    source: 'filmweb',
    user: { id: 42, name: 'Widz Testowy' },
    items,
    ...patch,
  };
}

export function enrichment(filmwebId: number, patch: Partial<Enrichment> & { kind?: Kind } = {}): Enrichment {
  return {
    ...emptyEnrichment(filmwebId, patch.kind ?? 'film', { method: 'wikidata', confidence: 1 }),
    title: `Film ${filmwebId}`,
    ...patch,
  };
}

/** Minimal File stand-in: the services only read `name`, `size` and `text()`. */
export function textFile(name: string, text: string): File {
  return { name, size: text.length, text: async () => text } as unknown as File;
}
