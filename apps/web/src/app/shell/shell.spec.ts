import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../core/api.client';
import { DataResetService } from '../core/data-reset.service';
import { LibraryStore } from '../core/library.store';
import { click, pageText } from '../testing/dom';
import { enrichment, exportFile, exportItem } from '../testing/fixtures';
import { NAV_ITEMS } from './nav';
import { Shell } from './shell';

describe('Shell', () => {
  let reset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reset = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DataResetService, useValue: { confirmAndReset: reset } },
        {
          provide: ApiClient,
          useValue: {
            config: signal({ criticsEnabled: false, gamesEnabled: false, tmdbEnabled: true }),
            awards: vi.fn(async () => ({ generatedAt: '', source: 'wikidata', awards: [], entries: [] })),
            warmUp: vi.fn(async () => undefined),
          },
        },
      ],
    });
  });

  async function render() {
    const f = TestBed.createComponent(Shell);
    await f.whenStable();
    return f;
  }

  const sidebarLinks = (f: Awaited<ReturnType<typeof render>>) =>
    Array.from(f.nativeElement.querySelectorAll('nav[aria-label="Główna nawigacja"] a') as NodeListOf<HTMLElement>).map((a) =>
      a.getAttribute('href'),
    );

  it('links every view in the sidebar', async () => {
    const f = await render();
    expect(sidebarLinks(f)).toEqual(NAV_ITEMS.map((n) => n.path));
    expect(pageText(f)).toContain('Przejdź do treści');
  });

  it('counts titles to verify: unmatched or matched with low confidence', async () => {
    const low = enrichment(2);
    await TestBed.inject(LibraryStore).loadExport(exportFile([exportItem(1), exportItem(2), exportItem(3)]), 'import', [
      { ...low, match: { ...low.match, confidence: 0.5 } },
      enrichment(3),
    ]);
    const f = await render();
    expect(f.nativeElement.querySelector('[aria-label="2 do sprawdzenia"]')?.textContent?.trim()).toBe('2');
  });

  it('asks before deleting the data', async () => {
    const f = await render();
    await click(f, 'Usuń moje dane');
    expect(reset).toHaveBeenCalledOnce();
  });

  it('opens the "Więcej" menu of the mobile navigation', async () => {
    const f = await render();
    const mobile = f.nativeElement.querySelector('nav[aria-label="Nawigacja"]') as HTMLElement;
    const more = mobile.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(mobile.textContent).not.toContain('Weryfikacja');
    more.click();
    await f.whenStable();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(mobile.textContent).toContain('Weryfikacja');
  });
});
