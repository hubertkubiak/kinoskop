import type { Page, Request } from '@playwright/test';

export interface ApiLog {
  requests: Request[];
}

/** Mocks the Kinoskop API: config, health, awards (empty) and enrich (Wikidata-like answers). */
export async function mockApi(page: Page): Promise<ApiLog> {
  const log: ApiLog = { requests: [] };
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    log.requests.push(req);
    const url = new URL(req.url());
    if (url.pathname === '/api/config') {
      return route.fulfill({ json: { criticsEnabled: false, gamesEnabled: false, tmdbEnabled: false } });
    }
    if (url.pathname === '/api/awards') {
      return route.fulfill({ json: { generatedAt: '2026-11-18T00:00:00.000Z', source: 'wikidata', awards: [], entries: [] } });
    }
    if (url.pathname === '/api/enrich') {
      const body = req.postDataJSON() as { items: { filmwebId: number; kind: 'film' | 'serial' | 'game' }[] };
      return route.fulfill({
        json: {
          cacheHits: 0,
          errors: [],
          results: body.items.map((i) => ({
            filmwebId: i.filmwebId,
            kind: i.kind,
            match: { method: 'wikidata', confidence: 1 },
            title: `Tytuł ${i.filmwebId}`,
            year: 2001,
            genres: ['Dramat'],
            countries: ['PL'],
            directors: [],
            cast: [],
            setInPeriod: [],
            narrativeLocations: [],
            keywords: [],
            awards: [],
          })),
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return log;
}

export async function openDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('demo').click();
  await page.waitForURL('**/przeglad');
}
