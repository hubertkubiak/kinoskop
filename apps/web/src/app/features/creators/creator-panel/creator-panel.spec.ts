import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { PersonRow } from '@kinoskop/stats';
import { describe, expect, it, vi } from 'vitest';
import { click, pageText } from '../../../testing/dom';
import { CreatorPanel } from './creator-panel';

const row: PersonRow = {
  key: 'tmdb:1',
  person: { name: 'Reżyserka Testowa', nationalities: ['PL', 'FR'] },
  count: 3,
  rated: 2,
  avg: 7.5,
  titles: [
    { key: 'film:1', title: 'Słabszy', rating: 6, year: 2001 },
    { key: 'film:2', title: 'Najlepszy', rating: 9, year: 2005 },
    { key: 'film:3', title: 'Nieoceniony', year: 2010 },
  ],
};

describe('CreatorPanel', () => {
  async function render(data: PersonRow = row) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DIALOG_DATA, useValue: data }, { provide: DialogRef, useValue: { close } }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(CreatorPanel);
    await f.whenStable();
    return { f, close, navigate };
  }

  it('shows the person, nationalities (never gender) and titles sorted by rating', async () => {
    const { f } = await render();
    const text = pageText(f);
    expect(text).toContain('Reżyserka Testowa');
    expect(text).toMatch(/3 tytułów · śr\. 7,5/);
    expect(text).not.toMatch(/płeć|kobieta|mężczyzna/i);
    const titles = Array.from(f.nativeElement.querySelectorAll('li span.flex-1') as NodeListOf<HTMLElement>).map((s) => s.textContent);
    expect(titles).toEqual(['Najlepszy', 'Słabszy', 'Nieoceniony']);
  });

  it('says when the nationality is unknown', async () => {
    const { f } = await render({ ...row, person: { name: 'X', nationalities: [] } });
    expect(pageText(f)).toContain('narodowość nieznana');
  });

  it('closes, and opens the collaborators view keeping other query params', async () => {
    const { f, close, navigate } = await render();
    await click(f, 'Pokaż współpracowników');
    expect(close).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/gust'], { queryParams: { siec: 'tmdb:1' }, queryParamsHandling: 'merge' });

    (f.nativeElement.querySelector('button[aria-label="Zamknij"]') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
