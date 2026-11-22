import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../core/api.client';
import { LibraryStore } from '../../core/library.store';
import { click, pageText } from '../../testing/dom';
import { exportFile, exportItem } from '../../testing/fixtures';
import { FilterBar } from './filter-bar';

describe('FilterBar', () => {
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        // Award labels are not needed here; the API would otherwise be called.
        { provide: ApiClient, useValue: { awards: vi.fn(async () => ({ generatedAt: null, awards: [] })) } },
      ],
    });
    router = TestBed.inject(Router);
    await TestBed.inject(LibraryStore).loadExport(
      exportFile([exportItem(1), exportItem(2, { kind: 'serial' }), exportItem(3, { favorite: true })]),
      'import',
    );
    await router.navigateByUrl('/przeglad');
  });

  async function render() {
    const f = TestBed.createComponent(FilterBar);
    await f.whenStable();
    return f;
  }

  const chips = (f: Awaited<ReturnType<typeof render>>) =>
    Array.from(f.nativeElement.querySelectorAll('li.ks-chip') as NodeListOf<HTMLElement>).map((li) => li.textContent?.trim());

  it('shows the match counter without chips', async () => {
    const f = await render();
    expect(pageText(f)).toContain('Pasuje: 3 z 3');
    expect(chips(f)).toEqual([]);
  });

  it('shows a chip per active filter and the filtered count', async () => {
    const f = await render();
    f.componentInstance.fs.update({ kinds: ['film'], favorite: true, rating: [7, 10] });
    await vi.waitFor(() => expect(chips(f)).toHaveLength(3));
    await f.whenStable();
    expect(chips(f).join(' | ')).toMatch(/Filmy.*Ocena 7–10.*Ulubione/);
    expect(pageText(f)).toContain('Pasuje: 1 z 3');
    expect(pageText(f)).toContain('Filtry (3)');
  });

  it('removes a single chip and clears all', async () => {
    const f = await render();
    f.componentInstance.fs.update({ kinds: ['film', 'serial'] });
    await vi.waitFor(() => expect(chips(f)).toHaveLength(2));
    (f.nativeElement.querySelector('li.ks-chip button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(chips(f)).toHaveLength(1));

    f.componentInstance.fs.update({ favorite: true });
    await vi.waitFor(() => expect(chips(f)).toHaveLength(2));
    await click(f, 'Wyczyść');
    await vi.waitFor(() => expect(chips(f)).toHaveLength(0));
  });

  it('toggles the filter panel', async () => {
    const f = await render();
    const toggle = f.nativeElement.querySelector('button[aria-controls="ks-filter-panel"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await f.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(f.nativeElement.querySelector('ks-filter-panel')).not.toBeNull();
  });
});
