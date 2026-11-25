import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryStore } from '../../../core/library.store';
import { click, pageText } from '../../../testing/dom';
import { enrichment, exportFile, exportItem, person } from '../../../testing/fixtures';
import { TastePage } from './taste-page';

describe('TastePage', () => {
  const director = person('Reżyser Duetu', 1);
  const actor = person('Aktorka Duetu', 2);

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    await TestBed.inject(LibraryStore).loadExport(
      exportFile(ids.map((id) => exportItem(id, { rating: id <= 5 ? 9 : 3 }))),
      'import',
      ids.map((id) =>
        enrichment(id, {
          title: `Tytuł ${id}`,
          genres: [id <= 5 ? 'Komedia' : 'Horror'],
          ...(id <= 3 ? { directors: [director], cast: [actor] } : {}),
        }),
      ),
    );
  });

  async function render(siec?: string) {
    const f = TestBed.createComponent(TastePage);
    if (siec) f.componentRef.setInput('siec', siec);
    await f.whenStable();
    return f;
  }

  it('lists what raises and lowers the ratings', async () => {
    const text = pageText(await render());
    expect(text).toContain('Twoja średnia: 6,0');
    expect(text).toMatch(/Podnosi Twoje oceny Gatunki Komedia 5× \+/);
    expect(text).toMatch(/Obniża Twoje oceny Gatunki Horror 5× −/);
    expect(text).toContain('Nic wyraźnego.');
  });

  it('shows director–actor duos with their titles', async () => {
    const text = pageText(await render());
    expect(text).toMatch(/Reżyser Duetu × Aktorka Duetu Tytuł 1 \(9\), Tytuł 2 \(9\), Tytuł 3 \(9\) 3×/);
  });

  it('shows the collaborators of a creator and opens the next network', async () => {
    const f = await render('tmdb:1');
    expect(pageText(f)).toContain('Współpracownicy: Reżyser Duetu');
    expect(pageText(f)).toContain('3 wspólnych tytułów · Twoja śr. 9,0');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await click(f, 'Aktorka Duetu');
    expect(navigate).toHaveBeenCalledWith(['/gust'], { queryParams: { siec: 'tmdb:2' }, queryParamsHandling: 'merge' });
  });

  it('explains an unknown creator without collaborators', async () => {
    const text = pageText(await render('tmdb:404'));
    expect(text).toContain('Współpracownicy: twórca');
    expect(text).toContain('Brak osób z co najmniej 2 wspólnymi tytułami.');
  });
});
