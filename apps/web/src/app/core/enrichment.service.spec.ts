import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EnrichRequestItem, EnrichResponse } from '@kinoskop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichment, exportFile, exportItem } from '../testing/fixtures';
import { ApiClient } from './api.client';
import { EnrichmentService } from './enrichment.service';
import { LibraryStore } from './library.store';

/** Fake API: matches by id the ids in `knownIds`, by title every item that has a title. */
function fakeApi(knownIds: number[]) {
  const calls: EnrichRequestItem[][] = [];
  const api = {
    awake: signal<boolean | null>(true),
    warmUp: vi.fn(async () => undefined),
    enrich: vi.fn(async (items: EnrichRequestItem[]): Promise<EnrichResponse> => {
      calls.push(items);
      const hit = (i: EnrichRequestItem) => knownIds.includes(i.filmwebId) || !!i.title;
      return {
        results: items.filter(hit).map((i) => enrichment(i.filmwebId, { kind: i.kind })),
        errors: items
          .filter((i) => !hit(i))
          .map((i) => ({ filmwebId: i.filmwebId, kind: i.kind, code: 'unmatched' as const, message: '' })),
        cacheHits: 0,
      };
    }),
  };
  return { api, calls };
}

describe('EnrichmentService', () => {
  let store: LibraryStore;

  function setup(api: ReturnType<typeof fakeApi>['api']) {
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    store = TestBed.inject(LibraryStore);
    return TestBed.inject(EnrichmentService);
  }

  afterEach(() => vi.useRealTimers());

  describe('with a working API', () => {
    let service: EnrichmentService;
    let calls: EnrichRequestItem[][];

    beforeEach(() => {
      const f = fakeApi([1]);
      calls = f.calls;
      service = setup(f.api);
    });

    it('sends only ids in stage 1 and title data only for unmatched items in stage 2', async () => {
      await store.loadExport(
        exportFile([
          exportItem(1, { title: 'Jeden', rating: 9 }),
          exportItem(2, { title: 'Dwa', year: 2001 }),
          exportItem(3),
        ]),
        'import',
      );
      await service.start();

      expect(calls[0]).toEqual([
        { filmwebId: 1, kind: 'film' },
        { filmwebId: 2, kind: 'film' },
        { filmwebId: 3, kind: 'film' },
      ]);
      expect(calls[1]).toEqual([{ filmwebId: 2, kind: 'film', title: 'Dwa', year: 2001 }]);
      // Ratings never leave the browser.
      expect(JSON.stringify(calls)).not.toContain('rating');
      expect(service.phase()).toBe('done');
      expect(service.unmatched()).toBe(1);
      expect(service.done()).toBe(3);
      expect([...store.enrichments().keys()].sort()).toEqual(['film:1', 'film:2']);
    });

    it('sends local (CSV) ids straight to the title search', async () => {
      await store.loadExport(exportFile([exportItem(-5, { title: 'Lokalny' })], { source: 'csv' }), 'import');
      await service.start();
      expect(calls).toEqual([[{ filmwebId: -5, kind: 'film', title: 'Lokalny' }]]);
    });

    it('splits large libraries into batches of 100 and enriches only items without a match', async () => {
      await store.loadExport(exportFile(Array.from({ length: 250 }, (_, i) => exportItem(i + 1))), 'import');
      await store.addEnrichments([enrichment(1)]);
      await service.start();
      expect(calls.map((c) => c.length).sort((a, b) => b - a)).toEqual([100, 100, 49]);
      expect(calls.flat().some((i) => i.filmwebId === 1)).toBe(false);
    });

    it('does nothing for the demo or when everything is matched', async () => {
      await store.loadExport(exportFile([exportItem(1)]), 'demo');
      await service.start();
      await store.loadExport(exportFile([exportItem(1)]), 'import', [enrichment(1)]);
      await service.start();
      expect(calls).toEqual([]);
      expect(service.phase()).toBe('idle');
    });

    it('runs again when started while running (part 2 imported mid-way)', async () => {
      await store.loadExport(exportFile([exportItem(1)]), 'import');
      const first = service.start();
      await store.loadExport(exportFile([exportItem(1), exportItem(9, { title: 'Nowy' })]), 'import');
      await service.start();
      await first;
      expect(store.enrichments().has('film:9')).toBe(true);
    });
  });

  it('retries a failed batch with back-off', async () => {
    vi.useFakeTimers();
    const f = fakeApi([1]);
    f.api.enrich.mockRejectedValueOnce(new Error('429'));
    const service = setup(f.api);
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    const run = service.start();
    await vi.advanceTimersByTimeAsync(2000);
    await run;
    expect(f.api.enrich).toHaveBeenCalledTimes(2);
    expect(service.phase()).toBe('done');
  });

  it('reports an error when the API does not wake up', async () => {
    vi.useFakeTimers();
    const f = fakeApi([]);
    f.api.awake.set(false);
    const service = setup(f.api);
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    const run = service.start();
    expect(service.phase()).toBe('warming');
    expect(service.active()).toBe(true);
    await vi.runAllTimersAsync();
    await run;
    expect(service.phase()).toBe('error');
    expect(service.label()).toContain('Nie udało się połączyć');
    expect(f.api.warmUp).toHaveBeenCalledTimes(12);
    expect(f.api.enrich).not.toHaveBeenCalled();
  });
});
