import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryStore } from '../../../core/library.store';
import { byText, pageText } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { Want2seePage } from './want2see-page';

describe('Want2seePage', () => {
  const want = (id: number) => exportItem(id, { list: 'want2see', rating: undefined });

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    await TestBed.inject(LibraryStore).loadExport(exportFile([exportItem(1, { rating: 9 }), want(11), want(12)]), 'import', [
      enrichment(1, { genres: ['Komedia'] }),
      enrichment(11, {
        title: 'Krótki',
        year: 2001,
        genres: ['Komedia'],
        runtimeMinutes: 80,
        publicRating: { tmdb: 6 },
        providersPL: { flatrate: [{ id: 1, name: 'Serwis A' }], rent: [], buy: [] },
      }),
      enrichment(12, { title: 'Długi', year: 2010, genres: ['Horror'], runtimeMinutes: 150, publicRating: { tmdb: 8 } }),
    ]);
  });

  async function render() {
    const f = TestBed.createComponent(Want2seePage);
    await f.whenStable();
    return f;
  }

  const titles = (f: Awaited<ReturnType<typeof render>>) => f.componentInstance.rows().map((r) => r.title);

  it('lists only want-to-see titles, best taste match first', async () => {
    const f = await render();
    expect(pageText(f)).toContain('2 tytułów');
    expect(titles(f)).toEqual(['Krótki', 'Długi']);
    expect(f.componentInstance.rows()[0].providers).toEqual([{ type: 'Abonament', list: [{ id: 1, name: 'Serwis A' }] }]);
  });

  it('sorts by the public rating, year and runtime', async () => {
    const f = await render();
    const select = f.nativeElement.querySelector('select') as HTMLSelectElement;
    for (const [sort, expected] of [
      ['public', ['Długi', 'Krótki']],
      ['year', ['Długi', 'Krótki']],
      ['runtime', ['Krótki', 'Długi']],
    ] as const) {
      select.value = sort;
      select.dispatchEvent(new Event('change'));
      await f.whenStable();
      expect(titles(f)).toEqual(expected);
    }
  });

  it('filters by the services the user picked', async () => {
    const f = await render();
    const onlyMine = byText(f, 'label', 'Dostępne na moich serwisach')?.querySelector('input') as HTMLInputElement;
    expect(onlyMine.disabled).toBe(true);
    expect(pageText(f)).toContain('Moje serwisy (0)');

    byText(f, 'label', 'Serwis A')?.querySelector('input')?.dispatchEvent(new Event('change'));
    await f.whenStable();
    expect(pageText(f)).toContain('Moje serwisy (1)');
    expect(onlyMine.disabled).toBe(false);

    onlyMine.dispatchEvent(new Event('change'));
    await f.whenStable();
    expect(titles(f)).toEqual(['Krótki']);
    expect(pageText(f)).toContain('1 tytułów');
  });
});
