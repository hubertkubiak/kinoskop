import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportFile, exportItem } from '../testing/fixtures';
import { FiltersStore } from './filters.store';
import { LibraryStore } from './library.store';

describe('FiltersStore', () => {
  let filters: FiltersStore;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    router = TestBed.inject(Router);
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([exportItem(1), exportItem(2, { kind: 'serial' }), exportItem(3, { list: 'want2see', rating: undefined })]),
      'import',
    );
    filters = TestBed.inject(FiltersStore);
    await router.navigateByUrl('/przeglad');
  });

  it('starts without filters', () => {
    expect(filters.activeCount()).toBe(0);
    expect(filters.filtered()).toHaveLength(3);
    expect(filters.total()).toBe(3);
  });

  it('stores filters in the URL and filters the library', async () => {
    filters.update({ kinds: ['serial'] });
    await vi.waitFor(() => expect(filters.activeCount()).toBe(1));
    expect(router.url).toContain('?');
    expect(router.url.startsWith('/przeglad')).toBe(true);
    expect(filters.filtered().map((i) => i.key)).toEqual(['serial:2']);
  });

  it('reads filters from a shared link', async () => {
    filters.update({ lists: ['want2see'] });
    await vi.waitFor(() => expect(filters.activeCount()).toBe(1));
    const link = router.url;
    await router.navigateByUrl('/przeglad');
    expect(filters.activeCount()).toBe(0);
    await router.navigateByUrl(link);
    expect(filters.filtered().map((i) => i.key)).toEqual(['film:3']);
  });

  it('toggles list values and resets', async () => {
    filters.toggle('kinds', 'film');
    await vi.waitFor(() => expect(filters.filters().kinds).toEqual(['film']));
    filters.toggle('kinds', 'serial');
    await vi.waitFor(() => expect(filters.filters().kinds).toEqual(['film', 'serial']));
    filters.toggle('kinds', 'film');
    await vi.waitFor(() => expect(filters.filters().kinds).toEqual(['serial']));
    filters.reset();
    await vi.waitFor(() => expect(filters.activeCount()).toBe(0));
  });
});
