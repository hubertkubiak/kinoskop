import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../core/api.client';
import { FiltersStore } from '../../core/filters.store';
import { LibraryStore } from '../../core/library.store';
import { byText, click, pageText } from '../../testing/dom';
import { enrichment, exportFile, exportItem, person } from '../../testing/fixtures';
import { FilterPanel } from './filter-panel';

describe('FilterPanel', () => {
  let fs: FiltersStore;
  let store: LibraryStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: ApiClient, useValue: { awards: vi.fn(async () => ({ generatedAt: '', source: 'wikidata', awards: [], entries: [] })) } },
      ],
    });
    store = TestBed.inject(LibraryStore);
    fs = TestBed.inject(FiltersStore);
    await TestBed.inject(Router).navigateByUrl('/przeglad');
  });

  async function render() {
    const f = TestBed.createComponent(FilterPanel);
    await f.whenStable();
    return f;
  }

  it('toggles the type and list chips', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    const f = await render();
    await click(f, 'Seriale');
    await vi.waitFor(() => expect(fs.filters().kinds).toEqual(['serial']));
    await f.whenStable();
    expect(byText(f, 'button', 'Seriale')?.getAttribute('aria-pressed')).toBe('true');
    await click(f, 'Chcę zobaczyć');
    await vi.waitFor(() => expect(fs.filters().lists).toEqual(['want2see']));
  });

  it('sets the rating range and clears it when it covers the full scale', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    const f = await render();
    const from = f.nativeElement.querySelector('#ks-r-from') as HTMLInputElement;
    from.value = '7';
    from.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(fs.filters().rating).toEqual([7, 10]));
    from.value = '1';
    from.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(fs.filters().rating).toBeNull());
  });

  it('suggests creators from two letters and adds the picked one', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import', [
      enrichment(1, { directors: [person('Reżyser Częsty', 1)], cast: [person('Aktor Inny', 2)] }),
    ]);
    const f = await render();
    const search = f.nativeElement.querySelector('#ks-person') as HTMLInputElement;
    search.value = 'częs';
    search.dispatchEvent(new Event('input'));
    await f.whenStable();
    expect(search.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(f.nativeElement.querySelectorAll('[role=option]') as NodeListOf<HTMLElement>).map((o) => o.textContent?.trim())).toEqual([
      'Reżyser Częsty (1)',
    ]);
    await click(f, 'Reżyser Częsty');
    await vi.waitFor(() => expect(fs.filters().people).toEqual(['tmdb:1']));
    expect(f.componentInstance.personQuery()).toBe('');
  });

  it('explains empty genres and awards before matching', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import');
    const text = pageText(await render());
    expect(text).toContain('Gatunki pojawią się po dopasowaniu tytułów.');
    expect(text).toContain('Brak nagrodzonych tytułów w bibliotece.');
  });

  it('shows the first 16 genres and expands to all', async () => {
    const genres = Array.from({ length: 20 }, (_, i) => `Gatunek ${String(i + 1).padStart(2, '0')}`);
    await store.loadExport(exportFile([exportItem(1)]), 'import', [enrichment(1, { genres })]);
    const f = await render();
    const chips = () => Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLElement>).filter((b) => b.textContent?.includes('Gatunek '));
    expect(chips()).toHaveLength(16);
    await click(f, 'Pokaż wszystkie');
    expect(chips()).toHaveLength(20);
    expect(pageText(f)).toContain('Pokaż mniej');
  });

  it('emits closed', async () => {
    const f = await render();
    const closed = vi.fn();
    f.componentInstance.closed.subscribe(closed);
    await click(f, 'Zamknij');
    expect(closed).toHaveBeenCalledOnce();
  });
});
