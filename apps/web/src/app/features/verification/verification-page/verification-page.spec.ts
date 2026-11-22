import { TestBed } from '@angular/core/testing';
import type { SearchCandidate } from '@kinoskop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../core/api.client';
import { LibraryStore } from '../../../core/library.store';
import { byText, click, pageText } from '../../../testing/dom';
import { enrichment, exportFile, exportItem } from '../../../testing/fixtures';
import { VerificationPage } from './verification-page';

describe('VerificationPage', () => {
  let store: LibraryStore;
  const api = { search: vi.fn(), manualMatch: vi.fn() };

  beforeEach(async () => {
    api.search.mockReset();
    api.manualMatch.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    store = TestBed.inject(LibraryStore);
    await store.loadExport(
      exportFile([
        exportItem(1, { title: 'Pewny' }),
        exportItem(2, { title: 'Wątpliwy', originalTitle: 'Doubtful', year: 1999 }),
        exportItem(3, { title: 'Nieznany' }),
      ]),
      'import',
      [
        enrichment(1),
        enrichment(2, { title: 'Doubtful Movie', match: { method: 'tmdb-search', confidence: 0.6 } }),
      ],
    );
  });

  async function render() {
    const f = TestBed.createComponent(VerificationPage);
    await f.whenStable();
    return f;
  }

  const cards = (f: Awaited<ReturnType<typeof render>>) =>
    Array.from(f.nativeElement.querySelectorAll(':scope > ul > li') as NodeListOf<HTMLElement>);

  it('lists unmatched titles first, then low-confidence ones; confident matches are hidden', async () => {
    const f = await render();
    const list = cards(f);
    expect(list).toHaveLength(2);
    expect(list[0].textContent).toContain('Nieznany');
    expect(list[0].textContent).toContain('Brak dopasowania.');
    expect(list[1].textContent).toContain('Propozycja · pewność 60%');
    expect(pageText(f)).not.toContain('Pewny');
  });

  it('accepts a proposal as a manual match with full confidence', async () => {
    const f = await render();
    await click(f, 'To jest poprawne');
    expect(store.overrides().get('film:2')?.match).toEqual({ method: 'manual', confidence: 1 });
    expect(cards(f)).toHaveLength(1);
  });

  it('searches by the original title and year, then stores the chosen candidate', async () => {
    const candidate: SearchCandidate = { kind: 'film', tmdbId: 77, title: 'Doubtful', year: 1999 };
    api.search.mockResolvedValue({ candidates: [candidate] });
    api.manualMatch.mockResolvedValue(enrichment(2, { title: 'Doubtful', match: { method: 'manual', tmdbId: 77, confidence: 1 } }));
    const f = await render();

    (cards(f)[1].querySelector('button:last-of-type') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(byText(f, 'li button', 'Doubtful 1999')).toBeDefined());
    await f.whenStable();
    expect(api.search).toHaveBeenCalledWith({ q: 'Doubtful', kind: 'film', year: 1999 });
    expect((f.nativeElement.querySelector('input') as HTMLInputElement).value).toBe('Doubtful');

    byText<HTMLButtonElement>(f, 'li button', 'Doubtful 1999')?.click();
    await vi.waitFor(() => expect(store.overrides().has('film:2')).toBe(true));
    await f.whenStable();
    expect(api.manualMatch).toHaveBeenCalledWith({ filmwebId: 2, kind: 'film', tmdbId: 77, igdbId: undefined });
    expect(f.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows "no results" and an error message when the search fails', async () => {
    api.search.mockResolvedValueOnce({ candidates: [] }).mockRejectedValueOnce(new Error('down'));
    const f = await render();
    await click(f, 'Szukaj ręcznie');
    await vi.waitFor(() => expect(pageText(f)).toContain('Brak wyników.'));

    const form = f.nativeElement.querySelector('form') as HTMLFormElement;
    (form.querySelector('input') as HTMLInputElement).value = 'Inny tytuł';
    form.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(pageText(f)).toContain('Wyszukiwarka niedostępna'));
    expect(api.search).toHaveBeenLastCalledWith({ q: 'Inny tytuł', kind: 'film', year: undefined });
  });

  it('says when everything is matched', async () => {
    await store.loadExport(exportFile([exportItem(1)]), 'import', [enrichment(1)]);
    const f = await render();
    expect(pageText(f)).toContain('Wszystkie tytuły są dopasowane.');
  });
});
