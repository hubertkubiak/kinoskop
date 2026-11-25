import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryStore } from '../../../core/library.store';
import { click, pageText, textOf } from '../../../testing/dom';
import { enrichment, exportFile, exportItem, person } from '../../../testing/fixtures';
import { CreatorPanel } from '../creator-panel/creator-panel';
import { CreatorsPage } from './creators-page';

describe('CreatorsPage', () => {
  const often = person('Reżyser Częsty', 1, ['PL']);
  const once = person('Reżyserka Jednorazowa', 2);

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([1, 2, 3, 4].map((id) => exportItem(id, { rating: id === 4 ? 10 : 6 }))),
      'import',
      [
        enrichment(1, { directors: [often] }),
        enrichment(2, { directors: [often] }),
        enrichment(3, { directors: [often] }),
        enrichment(4, { directors: [once] }),
      ],
    );
  });

  async function render() {
    const f = TestBed.createComponent(CreatorsPage);
    await f.whenStable();
    return f;
  }

  const rows = (f: Awaited<ReturnType<typeof render>>) =>
    Array.from(f.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>).map(textOf);

  async function change(f: Awaited<ReturnType<typeof render>>, selector: string, value: string) {
    const el = f.nativeElement.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
    el.value = value;
    el.dispatchEvent(new Event('change'));
    await f.whenStable();
  }

  it('ranks directors with at least 3 titles', async () => {
    expect(rows(await render())).toEqual(['1 Reżyser Częsty Polska 3 6,0']);
  });

  it('lowers the minimum and sorts by average rating', async () => {
    const f = await render();
    await change(f, 'input[type=number]', '1');
    expect(rows(f)).toEqual(['1 Reżyser Częsty Polska 3 6,0', '2 Reżyserka Jednorazowa – 1 10,0']);
    await change(f, 'select', 'avg');
    expect(rows(f)[0]).toBe('1 Reżyserka Jednorazowa – 1 10,0');
  });

  it('opens the creator panel and shows an empty state for actors', async () => {
    const f = await render();
    const open = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({} as never);
    await click(f, 'Reżyser Częsty');
    expect(open).toHaveBeenCalledWith(CreatorPanel, expect.objectContaining({ data: expect.objectContaining({ count: 3 }) }));

    await click(f, 'Aktorzy');
    expect(pageText(f)).toContain('Brak twórców spełniających kryteria.');
  });
});
