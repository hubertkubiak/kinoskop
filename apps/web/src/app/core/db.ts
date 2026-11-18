import Dexie, { type Table } from 'dexie';
import type { Enrichment, Era, ExportItem } from '@kinoskop/shared';

export interface MetaRow {
  id: 'export';
  mode: 'import' | 'demo';
  exportedAt: string;
  importedAt: string;
  userName: string;
}

export interface ItemRow extends ExportItem {
  key: string;
}

export interface EnrichmentRow {
  key: string;
  value: Enrichment;
}

export interface AiErasRow {
  key: string;
  eras: Era[];
  /** true when the model answered "unknown" – not retried on resume. */
  attempted: boolean;
}

export interface KvRow {
  key: string;
  value: unknown;
}

/** IndexedDB database `kinoskop` (SPEC §6). Bump the version when changing stores. */
export class KinoskopDb extends Dexie {
  meta!: Table<MetaRow, string>;
  items!: Table<ItemRow, string>;
  enrichments!: Table<EnrichmentRow, string>;
  overrides!: Table<EnrichmentRow, string>;
  aiEras!: Table<AiErasRow, string>;
  kv!: Table<KvRow, string>;

  constructor() {
    super('kinoskop');
    this.version(1).stores({
      meta: 'id',
      items: 'key',
      enrichments: 'key',
      overrides: 'key',
      aiEras: 'key',
      kv: 'key',
    });
  }
}
