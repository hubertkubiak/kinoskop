import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ExportItem } from '@kinoskop/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from '../../../core/api.client';
import { LibraryStore } from '../../../core/library.store';
import { pageText } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { RatingsPage } from './ratings-page';

describe('RatingsPage', () => {
  const config = signal({ criticsEnabled: false, gamesEnabled: false, tmdbEnabled: true });
  let store: LibraryStore;

  beforeEach(() => {
    config.set({ criticsEnabled: false, gamesEnabled: false, tmdbEnabled: true });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ApiClient, useValue: { config } }],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    store = TestBed.inject(LibraryStore);
  });

  async function render() {
    const f = TestBed.createComponent(RatingsPage);
    await f.whenStable();
    return f;
  }

  const publicRating = (tmdb: number) => ({ tmdb, tmdbVotes: 500 });

  it('compares the ratings with the TMDB average and lists the biggest differences', async () => {
    await store.loadExport(
      exportFile([exportItem(1, { rating: 9 }), exportItem(2, { rating: 8 }), exportItem(3, { rating: 4 })]),
      'import',
      [
        enrichment(1, { title: 'Ukochany', publicRating: publicRating(6) }),
        enrichment(2, { title: 'Zgodny', publicRating: publicRating(8) }),
        enrichment(3, { title: 'Rozczarowanie', publicRating: publicRating(7) }),
      ],
    );
    const text = pageText(await render());
    expect(text).toContain('Oceniasz praktycznie tak samo hojnie jak ogół widzów.');
    expect(text).toContain('Twoja średnia 7,0');
    expect(text).toContain('Porównano 3 ocenionych tytułów');
    expect(text).toMatch(/Podobało mi się bardziej niż innym .*Ukochany TMDB 6,0 \+3,0/);
    expect(text).toMatch(/Podobało mi się mniej niż innym .*Rozczarowanie TMDB 7,0 −3,0/);
  });

  it('says how much more generous the user is and ignores titles with few public votes', async () => {
    await store.loadExport(
      exportFile([exportItem(1, { rating: 9 }), exportItem(2, { rating: 8 }), exportItem(3, { rating: 1 })]),
      'import',
      [
        enrichment(1, { publicRating: publicRating(7) }),
        enrichment(2, { publicRating: publicRating(6) }),
        enrichment(3, { publicRating: { tmdb: 9, tmdbVotes: 3 } }),
      ],
    );
    const text = pageText(await render());
    expect(text).toContain('Oceniasz średnio o 2,0 pkt łagodniej niż ogół widzów.');
    expect(text).toContain('Porównano 2 ocenionych tytułów');
  });

  it('explains the missing comparison without TMDB data and the missing dates', async () => {
    await store.loadExport(exportFile([exportItem(1), exportItem(2)]), 'import');
    const text = pageText(await render());
    expect(text).toContain('Porównanie z ogółem widzów wymaga średnich ocen z TMDB.');
    expect(text).toContain('Wczytane pliki nie zawierają dat ocen');
    expect(text).toContain('Brak danych.');
  });

  it('describes the harshness trend from yearly averages', async () => {
    const items: ExportItem[] = [];
    let id = 1;
    for (const [year, rating] of [[2022, 5], [2023, 6], [2024, 8]] as const) {
      for (let i = 0; i < 10; i++) items.push(exportItem(id++, { rating, ratedAt: `${year}-03-01T12:00:00.000Z` }));
    }
    await store.loadExport(exportFile(items), 'import');
    const text = pageText(await render());
    expect(text).toContain('Łagodniejesz: od 2022 oceniasz średnio o ok. 3,0 pkt wyżej niż na początku.');
    expect(text).not.toContain('Za mało ocen z datą');
  });

  it('asks for more dated ratings when there are dates but too few per year', async () => {
    await store.loadExport(exportFile([exportItem(1, { ratedAt: '2024-01-01T00:00:00.000Z' })]), 'import');
    expect(pageText(await render())).toContain('Za mało ocen z datą, żeby pokazać zmianę w czasie.');
  });

  it('shows the critics section only when OMDb is enabled', async () => {
    await store.loadExport(exportFile([exportItem(1, { rating: 8 })]), 'import', [
      enrichment(1, { critics: { imdb: 7.5 } }),
    ]);
    expect(pageText(await render())).not.toContain('Ty vs krytycy');
    config.set({ criticsEnabled: true, gamesEnabled: false, tmdbEnabled: true });
    const text = pageText(await render());
    expect(text).toContain('Ty vs krytycy');
    expect(text).toContain('IMDb 1 za mało danych');
    expect(text).toContain('Rotten Tomatoes 0 za mało danych');
  });
});
