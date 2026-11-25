import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AwardCatalog, AwardDefinition, AwardEntry } from '@kinoskop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../core/api.client';
import { LibraryStore } from '../../../core/library.store';
import { click, pageText } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { AwardLabels } from '../award-labels';
import { AwardsPage } from './awards-page';

const award = (key: string, shortPl: string, qid: string): AwardDefinition => ({
  key,
  namePl: shortPl,
  shortPl,
  kind: 'film',
  qid,
  personal: false,
});

const won = (awardKey: string, filmwebId: number, year: number, patch: Partial<AwardEntry['work']> = {}): AwardEntry => ({
  awardKey,
  year,
  won: true,
  work: { wikidataId: `Q${1000 + filmwebId}`, title: `Work ${filmwebId}`, filmwebId, ...patch },
});

// Fictional catalogue: the user loves the winners of "Złoty Kadr" and dislikes those of "Srebrna Taśma".
const CATALOG: AwardCatalog = {
  generatedAt: '2026-11-01T00:00:00.000Z',
  source: 'wikidata',
  awards: [award('kadr', 'Złoty Kadr', 'Q1'), award('tasma', 'Srebrna Taśma', 'Q2')],
  entries: [
    won('kadr', 1, 2001),
    won('kadr', 2, 2002),
    won('kadr', 3, 2003),
    won('kadr', 99, 2004, { titlePl: 'Laureat Nieobejrzany', genres: ['Dramat'] }),
    won('tasma', 4, 2001),
    won('tasma', 5, 2002),
    won('tasma', 6, 2003),
  ],
};

describe('AwardsPage', () => {
  let labels: { catalog: ReturnType<typeof signal<AwardCatalog | null>>; error: ReturnType<typeof signal<boolean>> };
  let enrich: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    labels = { catalog: signal<AwardCatalog | null>(CATALOG), error: signal(false) };
    enrich = vi.fn(async () => ({
      results: [enrichment(99, { providersPL: { flatrate: [{ id: 8, name: 'Serwis A' }], rent: [], buy: [] } })],
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AwardLabels, useValue: { ...labels, load: async () => undefined, short: (k: string) => k } },
        { provide: ApiClient, useValue: { enrich } },
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([1, 2, 3, 4, 5, 6].map((id) => exportItem(id, { rating: id <= 3 ? 9 : 3 }))),
      'import',
    );
  });

  async function render() {
    const f = TestBed.createComponent(AwardsPage);
    await f.whenStable();
    return f;
  }

  it('measures how each award matches the taste', async () => {
    const text = pageText(await render());
    expect(text).toMatch(/Złoty Kadr 3\/4 3 9,0 \+1\.13 100%/);
    expect(text).toMatch(/Srebrna Taśma 3\/3 3 3,0 -1\.12 0%/);
  });

  it('recommends unwatched winners of the best matching award with where to watch', async () => {
    const f = await render();
    expect(pageText(f)).toContain('Laureat Nieobejrzany');
    expect(pageText(f)).toContain('Złoty Kadr 2004 · Dramat');
    expect(enrich).toHaveBeenCalledWith([{ filmwebId: 99, kind: 'film' }]);
    await vi.waitFor(() => expect(pageText(f)).toContain('Abonament: Serwis A'));
  });

  it('shows empty states for a type without awards', async () => {
    const f = await render();
    await click(f, 'Seriale');
    expect(pageText(f)).toContain('Za mało ocenionych laureatów');
    expect(pageText(f)).toContain('Brak rekomendacji');
  });

  it('shows the loading and error states of the catalogue', async () => {
    labels.catalog.set(null);
    const f = await render();
    expect(pageText(f)).toContain('Ładuję katalog nagród…');
    labels.error.set(true);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role=alert]')?.textContent).toContain('Katalog nagród jest niedostępny');
  });
});
