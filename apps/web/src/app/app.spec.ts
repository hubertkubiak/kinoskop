import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { appRoutes } from './app.routes';
import { ApiClient } from './core/api.client';
import { LibraryStore } from './core/library.store';
import { exportFile, exportItem } from './testing/fixtures';

describe('App routes', () => {
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        {
          provide: ApiClient,
          useValue: {
            config: signal({ criticsEnabled: false, gamesEnabled: false, tmdbEnabled: true }),
            awards: vi.fn(async () => ({ generatedAt: '', source: 'wikidata', awards: [], entries: [] })),
            warmUp: vi.fn(async () => undefined),
          },
        },
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    router = TestBed.inject(Router);
    const f = TestBed.createComponent(App);
    await f.whenStable();
  });

  const go = async (url: string) => {
    await router.navigateByUrl(url);
    return router.url;
  };

  const withData = () => TestBed.inject(LibraryStore).loadExport(exportFile([exportItem(1)]), 'import');

  it('sends a visitor without data to the import wizard', async () => {
    expect(await go('/')).toBe('/start');
    expect(await go('/oceny')).toBe('/start');
    expect(TestBed.inject(Title).getTitle()).toBe('Kinoskop – import');
  });

  it('keeps the about pages open without data', async () => {
    expect(await go('/prywatnosc')).toBe('/prywatnosc');
    expect(TestBed.inject(Title).getTitle()).toBe('Prywatność – Kinoskop');
  });

  it('opens the overview with data and redirects old and unknown links', async () => {
    await withData();
    expect(await go('/')).toBe('/przeglad');
    expect(TestBed.inject(Title).getTitle()).toBe('Przegląd – Kinoskop');
    expect(await go('/mapa-gustu')).toBe('/gust');
    expect(await go('/nie-ma-takiej')).toBe('/przeglad');
  });
});
