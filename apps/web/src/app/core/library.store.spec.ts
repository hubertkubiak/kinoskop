import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { enrichment, exportFile, exportItem } from '../testing/fixtures';
import { LibraryStore } from './library.store';

// jsdom has no IndexedDB, so the store runs in its in-memory fallback (SPEC §6).
describe('LibraryStore', () => {
  let store: LibraryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(LibraryStore);
  });

  it('falls back to memory when IndexedDB is unavailable and still becomes ready', async () => {
    await store.init();
    expect(store.ready()).toBe(true);
    expect(store.persistent()).toBe(false);
    expect(store.hasData()).toBe(false);
  });

  it('loads an export with item keys and meta', async () => {
    await store.loadExport(exportFile([exportItem(1), exportItem(2, { kind: 'serial' })], { part: 'base' }), 'import');
    expect(store.items().map((i) => i.key)).toEqual(['film:1', 'serial:2']);
    expect(store.meta()).toMatchObject({ mode: 'import', userId: 42, userName: 'Widz Testowy', part: 'base' });
    expect(store.isDemo()).toBe(false);
  });

  it('marks the demo mode and stores bundled enrichments', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'demo', [enrichment(1)]);
    expect(store.isDemo()).toBe(true);
    expect(store.meta()?.part).toBe('full');
    expect(store.library()[0].enrichment?.title).toBe('Film 1');
  });

  it('joins items with the override before the backend enrichment and merges AI eras', async () => {
    await store.loadExport(exportFile([exportItem(1), exportItem(2)]), 'import');
    await store.addEnrichments([enrichment(1), enrichment(2, { setInPeriod: [{ key: 'antiquity', source: 'wikidata' }] })]);
    await store.setOverride('film:1', enrichment(1, { title: 'Ręcznie' }));
    await store.setAiEras([{ key: 'film:2', eras: [{ key: 'middle-ages', source: 'ai' }] }]);

    const [a, b] = store.library();
    expect(a.enrichment?.title).toBe('Ręcznie');
    expect(b.enrichment?.setInPeriod.map((e) => e.key).sort()).toEqual(['antiquity', 'middle-ages']);
    expect(store.aiEras().get('film:2')?.attempted).toBe(true);
  });

  it('replaces all data on loadExport', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    await store.addEnrichments([enrichment(1)]);
    await store.loadExport(exportFile([exportItem(3)], { user: { id: 7, name: 'Ktoś' } }), 'import');
    expect(store.items().map((i) => i.key)).toEqual(['film:3']);
    expect(store.enrichments().size).toBe(0);
  });

  describe('isSameUser', () => {
    it('is false without an import and for the demo', async () => {
      expect(store.isSameUser(exportFile([]))).toBe(false);
      await store.loadExport(exportFile([]), 'demo');
      expect(store.isSameUser(exportFile([]))).toBe(false);
    });

    it('compares the user id of script exports', async () => {
      await store.loadExport(exportFile([exportItem(1)]), 'import');
      expect(store.isSameUser(exportFile([]))).toBe(true);
      expect(store.isSameUser(exportFile([], { user: { id: 43, name: 'Inny' } }))).toBe(false);
    });

    it('merges CSV only into an archive table without titles (part base, user 0)', async () => {
      const csv = (part?: 'base' | 'full') => exportFile([], { source: 'csv', user: { id: 0, name: '' }, part });
      await store.loadExport(csv('base'), 'import');
      expect(store.isSameUser(csv('full'))).toBe(true);
      await store.loadExport(csv('full'), 'import');
      expect(store.isSameUser(csv('full'))).toBe(false);
    });
  });

  it('mergeExport keeps matches of remaining items and drops those of removed ones', async () => {
    await store.loadExport(exportFile([exportItem(1), exportItem(2)], { part: 'base' }), 'import');
    await store.addEnrichments([enrichment(1), enrichment(2)]);
    await store.setOverride('film:2', enrichment(2, { title: 'Ręcznie' }));
    await store.setAiEras([{ key: 'film:2', eras: [] }]);

    await store.mergeExport(exportFile([exportItem(1, { title: 'Tytuł' }), exportItem(3)], { user: { id: 42, name: '' } }));

    expect(store.items().map((i) => i.key)).toEqual(['film:1', 'film:3']);
    expect(store.items()[0].title).toBe('Tytuł');
    expect([...store.enrichments().keys()]).toEqual(['film:1']);
    expect(store.overrides().size).toBe(0);
    expect(store.aiEras().size).toBe(0);
    // An empty user name in the later file keeps the earlier one.
    expect(store.meta()).toMatchObject({ part: 'full', userName: 'Widz Testowy' });
  });

  it('knows whether ratings have dates (charts over time)', async () => {
    expect(store.hasRatingDates()).toBe(true);
    await store.loadExport(exportFile([exportItem(1), exportItem(2, { list: 'want2see', rating: undefined })]), 'import');
    expect(store.hasRatingDates()).toBe(false);
    await store.loadExport(exportFile([exportItem(1, { ratedAt: '2024-01-01T00:00:00.000Z' }), exportItem(2)]), 'import');
    expect(store.hasRatingDates()).toBe(true);
  });

  it('clear wipes everything', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    await store.addEnrichments([enrichment(1)]);
    await store.clear();
    expect(store.meta()).toBeNull();
    expect(store.hasData()).toBe(false);
    expect(store.enrichments().size).toBe(0);
  });

  it('key-value storage is a no-op without IndexedDB', async () => {
    await store.setKv('x', 1);
    expect(await store.getKv('x')).toBeUndefined();
  });
});
