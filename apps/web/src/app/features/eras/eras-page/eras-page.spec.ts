import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { FiltersStore } from '../../../core/filters.store';
import { LibraryStore } from '../../../core/library.store';
import { byText, pageText, textOf } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { ErasPage } from './eras-page';

describe('ErasPage', () => {
  let store: LibraryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])], deferBlockBehavior: DeferBlockBehavior.Manual });
    store = TestBed.inject(LibraryStore);
  });

  async function render() {
    const f = TestBed.createComponent(ErasPage);
    await f.whenStable();
    return f;
  }

  it('counts undetermined and unmatched titles and groups production years by decade', async () => {
    await store.loadExport(
      exportFile([
        exportItem(1, { rating: 8, year: 1995 }),
        exportItem(2, { rating: 6, year: 2003 }),
        exportItem(3, { rating: 7, year: 2008 }),
      ]),
      'import',
      [enrichment(1, { setInPeriod: [{ key: 'antiquity', source: 'wikidata' }] }), enrichment(2)],
    );
    const f = await render();
    expect(pageText(f)).toContain('Nieustalona: 1 · bez dopasowania: 1');

    const card = byText(f, 'ks-chart-card', 'Rok produkcji');
    card?.querySelector('button')?.click();
    await f.whenStable();
    const rows = Array.from(card?.querySelectorAll('tbody tr') ?? []).map(textOf);
    expect(rows).toEqual(['1990s 1 8', '2000s 2 6.5']);
  });

  it('toggles "certain eras only" in the shared filters', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    const f = await render();
    const fs = TestBed.inject(FiltersStore);
    expect(fs.filters().erasCertainOnly).toBe(false);
    const box = byText<HTMLLabelElement>(f, 'label', 'Pokaż tylko epoki z pewnych źródeł')?.querySelector('input');
    box?.dispatchEvent(new Event('change'));
    await f.whenStable();
    expect(fs.filters().erasCertainOnly).toBe(true);
  });

  it('explains an empty activity heatmap without rating dates', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    expect(pageText(await render())).toContain('Wczytane pliki nie zawierają dat ocen');
  });
});
