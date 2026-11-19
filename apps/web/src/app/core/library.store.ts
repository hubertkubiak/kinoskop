import { computed, Injectable, signal } from '@angular/core';
import {
  type Enrichment,
  type Era,
  type ExportFile,
  itemKey,
  mergeEras,
} from '@kinoskop/shared';
import type { LibraryItem } from '@kinoskop/stats';
import Dexie from 'dexie';
import { type AiErasRow, KinoskopDb, type ItemRow, type MetaRow } from './db';
import { hasSessionCookie, setSessionCookie } from './session';

/**
 * Session data of the user: export, enrichments, manual overrides and AI eras.
 * Persisted in IndexedDB; falls back to memory when IndexedDB is unavailable (SPEC §6).
 */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private db: KinoskopDb | null = null;

  readonly ready = signal(false);
  readonly persistent = signal(true);
  readonly meta = signal<MetaRow | null>(null);
  readonly items = signal<ItemRow[]>([]);
  readonly enrichments = signal<ReadonlyMap<string, Enrichment>>(new Map());
  readonly overrides = signal<ReadonlyMap<string, Enrichment>>(new Map());
  readonly aiEras = signal<ReadonlyMap<string, AiErasRow>>(new Map());

  readonly hasData = computed(() => this.items().length > 0);
  readonly isDemo = computed(() => this.meta()?.mode === 'demo');

  /** Export items joined with their effective enrichment (override > backend) and AI eras. */
  readonly library = computed<LibraryItem[]>(() => {
    const enr = this.enrichments();
    const ovr = this.overrides();
    const ai = this.aiEras();
    return this.items().map((it) => {
      const base = ovr.get(it.key) ?? enr.get(it.key);
      const aiRow = ai.get(it.key);
      const enrichment =
        base && aiRow?.eras.length
          ? { ...base, setInPeriod: mergeEras(base.setInPeriod, aiRow.eras) }
          : base;
      return { ...it, enrichment };
    });
  });

  async init(): Promise<void> {
    const freshSession = !hasSessionCookie();
    try {
      if (freshSession) await Dexie.delete('kinoskop');
      this.db = new KinoskopDb();
      await this.db.open();
      await this.reload();
    } catch {
      this.db = null;
      this.persistent.set(false);
    }
    if (freshSession) setSessionCookie();
    this.ready.set(true);
  }

  private async reload(): Promise<void> {
    if (!this.db) return;
    const [meta, items, enr, ovr, ai] = await Promise.all([
      this.db.meta.get('export'),
      this.db.items.toArray(),
      this.db.enrichments.toArray(),
      this.db.overrides.toArray(),
      this.db.aiEras.toArray(),
    ]);
    this.meta.set(meta ?? null);
    this.items.set(items);
    this.enrichments.set(new Map(enr.map((r) => [r.key, r.value])));
    this.overrides.set(new Map(ovr.map((r) => [r.key, r.value])));
    this.aiEras.set(new Map(ai.map((r) => [r.key, r])));
  }

  /** Replaces all data with a new export (import or demo). */
  async loadExport(file: ExportFile, mode: MetaRow['mode'], enrichments: Enrichment[] = []): Promise<void> {
    await this.clear();
    const meta: MetaRow = {
      id: 'export',
      mode,
      exportedAt: file.exportedAt,
      importedAt: new Date().toISOString(),
      userName: file.user.name,
      userId: file.user.id,
      part: file.part ?? 'full',
    };
    const items: ItemRow[] = file.items.map((i) => ({ ...i, key: itemKey(i) }));
    this.meta.set(meta);
    this.items.set(items);
    if (this.db) {
      await this.db.transaction('rw', this.db.meta, this.db.items, async () => {
        await this.db!.meta.put(meta);
        await this.db!.items.bulkPut(items);
      });
    }
    if (enrichments.length) await this.addEnrichments(enrichments);
  }

  /** Whether `file` is a later export of the user whose import is loaded (merge instead of replace). */
  isSameUser(file: ExportFile): boolean {
    const m = this.meta();
    return m?.mode === 'import' && file.source === 'filmweb' && m.userId !== undefined && m.userId === file.user.id;
  }

  /**
   * Merges a later export of the same user (part 2 of a two-part import or a fresh re-import):
   * items are replaced, while enrichments, manual matches and AI eras of items that are still
   * present are kept, so only new or still unmatched items need enriching (docs/adr/0003).
   */
  async mergeExport(file: ExportFile): Promise<void> {
    const prev = this.meta();
    const meta: MetaRow = {
      id: 'export',
      mode: 'import',
      exportedAt: file.exportedAt,
      importedAt: new Date().toISOString(),
      userName: file.user.name || prev?.userName || '',
      userId: file.user.id,
      part: file.part ?? 'full',
    };
    const items: ItemRow[] = file.items.map((i) => ({ ...i, key: itemKey(i) }));
    const keep = new Set(items.map((i) => i.key));
    const gone = this.items().filter((i) => !keep.has(i.key)).map((i) => i.key);
    const drop = <T>(m: ReadonlyMap<string, T>) => new Map([...m].filter(([k]) => keep.has(k)));
    this.meta.set(meta);
    this.items.set(items);
    this.enrichments.set(drop(this.enrichments()));
    this.overrides.set(drop(this.overrides()));
    this.aiEras.set(drop(this.aiEras()));
    if (this.db) {
      const db = this.db;
      await db.transaction('rw', [db.meta, db.items, db.enrichments, db.overrides, db.aiEras], async () => {
        await db.meta.put(meta);
        await db.items.clear();
        await db.items.bulkPut(items);
        if (gone.length) {
          await db.enrichments.bulkDelete(gone);
          await db.overrides.bulkDelete(gone);
          await db.aiEras.bulkDelete(gone);
        }
      });
    }
  }

  async addEnrichments(list: Enrichment[]): Promise<void> {
    if (!list.length) return;
    const next = new Map(this.enrichments());
    const rows = list.map((value) => ({ key: itemKey(value), value }));
    for (const r of rows) next.set(r.key, r.value);
    this.enrichments.set(next);
    await this.db?.enrichments.bulkPut(rows);
  }

  async setOverride(key: string, value: Enrichment): Promise<void> {
    const next = new Map(this.overrides());
    next.set(key, value);
    this.overrides.set(next);
    await this.db?.overrides.put({ key, value });
  }

  async setAiEras(rows: { key: string; eras: Era[] }[]): Promise<void> {
    const next = new Map(this.aiEras());
    const full = rows.map((r) => ({ ...r, attempted: true }));
    for (const r of full) next.set(r.key, r);
    this.aiEras.set(next);
    await this.db?.aiEras.bulkPut(full);
  }

  async getKv<T>(key: string): Promise<T | undefined> {
    return (await this.db?.kv.get(key))?.value as T | undefined;
  }

  async setKv(key: string, value: unknown): Promise<void> {
    await this.db?.kv.put({ key, value });
  }

  /** "Usuń moje dane": wipes every table and in-memory state. */
  async clear(): Promise<void> {
    this.meta.set(null);
    this.items.set([]);
    this.enrichments.set(new Map());
    this.overrides.set(new Map());
    this.aiEras.set(new Map());
    if (this.db) {
      await Promise.all(this.db.tables.map((t) => t.clear()));
    }
  }
}
