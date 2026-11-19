import { computed, inject, Injectable, signal } from '@angular/core';
import { ENRICH_MAX_ITEMS, type EnrichRequestItem, isLocalId } from '@kinoskop/shared';
import { ApiClient } from './api.client';
import type { ItemRow } from './db';
import { LibraryStore } from './library.store';

export type EnrichPhase = 'idle' | 'warming' | 'ids' | 'titles' | 'done' | 'error';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Smaller batches than the API maximum give smoother progress; several run at once. */
const BATCH_SIZE = Math.min(100, ENRICH_MAX_ITEMS);
const PARALLEL_BATCHES = 3;

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
      // Stage 1 (ids only) makes sense only for real Filmweb IDs; local ids (CSV) go straight to stage 2.
      const withId = todo.filter((i) => !isLocalId(i.filmwebId));
      const local = todo.filter((i) => isLocalId(i.filmwebId));
      this.phase.set('ids');
      const unmatched = [
        ...(withId.length ? await this.runStage(withId, (i) => ({ filmwebId: i.filmwebId, kind: i.kind })) : []),
        ...local,
      ];
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
    const batches: ItemRow[][] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));
    // A few batches in flight keep the API's per-source limiters busy; the API still enforces the rate limits.
    let next = 0;
    const worker = async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        const res = await this.withRetry(() => this.api.enrich(batch.map(toRequest)));
        await this.store.addEnrichments(res.results);
        const missing = new Set(res.errors.map((e) => `${e.kind}:${e.filmwebId}`));
        unmatched.push(...batch.filter((b) => missing.has(b.key)));
        this.done.update((d) => d + batch.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_BATCHES, batches.length) }, worker));
    return unmatched;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        // Up to ~30 s of back-off: covers a busy upstream and the API's own rate limit (429).
        if (attempt >= 5) throw e;
        await sleep(2000 * attempt);
      }
    }
  }
}
