import { computed, inject, Injectable, signal } from '@angular/core';
import { ENRICH_MAX_ITEMS, type EnrichRequestItem } from '@kinoskop/shared';
import { ApiClient } from './api.client';
import type { ItemRow } from './db';
import { LibraryStore } from './library.store';

export type EnrichPhase = 'idle' | 'warming' | 'ids' | 'titles' | 'done' | 'error';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Two-stage enrichment (SPEC §14.4): stage 1 sends only {filmwebId, kind}; stage 2 sends title and
 * year only for items Wikidata could not map. Ratings never leave the browser.
 */
@Injectable({ providedIn: 'root' })
export class EnrichmentService {
  private readonly api = inject(ApiClient);
  private readonly store = inject(LibraryStore);
  private running = false;

  readonly phase = signal<EnrichPhase>('idle');
  readonly done = signal(0);
  readonly total = signal(0);
  readonly unmatched = signal(0);
  readonly active = computed(() => ['warming', 'ids', 'titles'].includes(this.phase()));

  readonly label = computed(() => {
    switch (this.phase()) {
      case 'warming':
        return 'Rozgrzewam projektor…';
      case 'ids':
        return 'Dopasowuję tytuły…';
      case 'titles':
        return 'Szukam pozostałych tytułów…';
      case 'error':
        return 'Nie udało się połączyć z serwerem. Statystyki bez wzbogacenia są dostępne.';
      default:
        return '';
    }
  });

  /** Enriches every item that has no enrichment yet. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.running || this.store.isDemo()) return;
    const known = this.store.enrichments();
    const todo = this.store.items().filter((i) => !known.has(i.key));
    if (!todo.length) return;
    this.running = true;
    this.done.set(0);
    this.total.set(todo.length);
    this.unmatched.set(0);
    try {
      if (!(await this.waitForApi())) {
        this.phase.set('error');
        return;
      }
      this.phase.set('ids');
      const unmatched = await this.runStage(todo, (i) => ({ filmwebId: i.filmwebId, kind: i.kind }));
      const withTitles = unmatched.filter((i) => i.title || i.originalTitle);
      if (withTitles.length) {
        this.phase.set('titles');
        this.done.set(todo.length - withTitles.length);
        const still = await this.runStage(withTitles, (i) => ({
          filmwebId: i.filmwebId,
          kind: i.kind,
          ...(i.title ? { title: i.title } : {}),
          ...(i.originalTitle ? { originalTitle: i.originalTitle } : {}),
          ...(i.year ? { year: i.year } : {}),
        }));
        this.unmatched.set(still.length + (unmatched.length - withTitles.length));
      } else {
        this.unmatched.set(unmatched.length);
      }
      this.done.set(todo.length);
      this.phase.set('done');
    } catch {
      this.phase.set('error');
    } finally {
      this.running = false;
    }
  }

  /** Free hosts put the API to sleep; retry for up to ~2 minutes while showing a loader. */
  private async waitForApi(): Promise<boolean> {
    for (let attempt = 0; attempt < 12; attempt++) {
      if (this.api.awake()) return true;
      this.phase.set('warming');
      await this.api.warmUp();
      if (this.api.awake()) return true;
      await sleep(Math.min(15_000, 2_000 * (attempt + 1)));
    }
    return false;
  }

  private async runStage(items: ItemRow[], toRequest: (i: ItemRow) => EnrichRequestItem): Promise<ItemRow[]> {
    const unmatched: ItemRow[] = [];
    for (let i = 0; i < items.length; i += ENRICH_MAX_ITEMS) {
      const batch = items.slice(i, i + ENRICH_MAX_ITEMS);
      const res = await this.withRetry(() => this.api.enrich(batch.map(toRequest)));
      await this.store.addEnrichments(res.results);
      const missing = new Set(res.errors.map((e) => `${e.kind}:${e.filmwebId}`));
      unmatched.push(...batch.filter((b) => missing.has(b.key)));
      this.done.update((d) => d + batch.length);
    }
    return unmatched;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= 3) throw e;
        await sleep(1500 * attempt);
      }
    }
  }
}
