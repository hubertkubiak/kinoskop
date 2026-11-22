import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnrichmentService } from '../../core/enrichment.service';
import { LibraryStore } from '../../core/library.store';
import { click, pageText } from '../../testing/dom';
import { exportFile, exportItem } from '../../testing/fixtures';
import { StatusBanners } from './status-banners';

describe('StatusBanners', () => {
  let store: LibraryStore;
  let enrich: EnrichmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(LibraryStore);
    enrich = TestBed.inject(EnrichmentService);
  });

  async function render() {
    const f = TestBed.createComponent(StatusBanners);
    await f.whenStable();
    return f;
  }

  it('shows nothing for a matched import', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    expect(pageText(await render())).toBe('');
  });

  it('marks the demo and links to the import', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'demo');
    const f = await render();
    expect(pageText(f)).toContain('Oglądasz przykładowe dane.');
    expect(f.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/start');
  });

  it('warns when data is only in memory', async () => {
    store.persistent.set(false);
    expect(pageText(await render())).toContain('Dane znikną po odświeżeniu strony.');
  });

  it('shows enrichment progress while matching', async () => {
    enrich.phase.set('ids');
    enrich.done.set(40);
    enrich.total.set(120);
    expect(pageText(await render())).toContain('Dopasowuję tytuły… 40/120');
  });

  it('offers a retry after a connection error', async () => {
    enrich.phase.set('error');
    const f = await render();
    expect(pageText(f)).toContain('Nie udało się połączyć z serwerem.');
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    await click(f, 'Spróbuj ponownie');
    // start() ran and moved on from the error state (it is waking the API now).
    expect(enrich.phase()).not.toBe('error');
  });

  it('explains part 1 of a two-part import', async () => {
    await store.loadExport(exportFile([exportItem(1)], { part: 'base' }), 'import');
    expect(pageText(await render())).toContain('To część 1 importu');
  });

  it('links unmatched titles to the verification page', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    enrich.phase.set('done');
    enrich.unmatched.set(7);
    const f = await render();
    expect(pageText(f)).toContain('Nie udało się automatycznie dopasować 7 tytułów.');
    expect(f.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/weryfikacja');
  });
});
