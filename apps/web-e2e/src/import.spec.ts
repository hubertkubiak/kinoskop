import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockApi } from './support';

const SAMPLE = join(__dirname, '../../../fixtures/export/sample-export.json');
const CSV_DIR = join(__dirname, '../../../fixtures/export/csv');
const CSV_FILES = readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv')).map((f) => join(CSV_DIR, f));
const VOTES_DIR = join(__dirname, '../../../fixtures/export/data-request');
const VOTES_FILES = readdirSync(VOTES_DIR).filter((f) => f.endsWith('.json')).map((f) => join(VOTES_DIR, f));

test('imports an export file end-to-end and enriches it', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/start$/);
  await page.getByTestId('file-input').setInputFiles(SAMPLE);
  await page.waitForURL('**/przeglad');
  await expect(page.getByText('Pasuje:')).toContainText('40 z 40');
  // Ratings never leave the browser: enrich requests carry only ids and kinds.
  await expect.poll(() => api.requests.filter((r) => r.url().includes('/api/enrich')).length).toBeGreaterThan(0);
  for (const r of api.requests.filter((x) => x.method() === 'POST')) {
    expect(r.postData()).not.toMatch(/"rating"|"ratedAt"|"favorite"|ANON_USER/);
  }
});

test('merges part 2 of a two-part import without losing matched titles', async ({ page }) => {
  const api = await mockApi(page);
  const sample = JSON.parse(readFileSync(SAMPLE, 'utf8')) as { items: { filmwebId: number; title?: string }[] };
  const UNKNOWN = sample.items[1].filmwebId;
  // Wikidata-like mock that does not know UNKNOWN by id – only a title search finds it.
  await page.route('**/api/enrich', async (route) => {
    api.requests.push(route.request());
    const body = route.request().postDataJSON() as { items: { filmwebId: number; kind: string; title?: string }[] };
    const found = body.items.filter((i) => i.filmwebId !== UNKNOWN || i.title);
    const base = { match: { method: 'wikidata', confidence: 1 }, year: 2001, genres: ['Dramat'], countries: ['PL'] };
    const empty = { directors: [], cast: [], setInPeriod: [], narrativeLocations: [], keywords: [], awards: [] };
    await route.fulfill({
      json: {
        cacheHits: 0,
        errors: body.items.filter((i) => !found.includes(i)).map((i) => ({ filmwebId: i.filmwebId, kind: i.kind, code: 'unmatched', message: 'x' })),
        results: found.map((i) => ({ filmwebId: i.filmwebId, kind: i.kind, title: i.title ?? `Tytuł ${i.filmwebId}`, ...base, ...empty })),
      },
    });
  });
  const file = (part: 'base' | 'full', items: unknown[]) => ({
    name: `kinoskop-eksport-${part}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...sample, part, items })),
  });

  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles(file('base', sample.items));
  await page.waitForURL('**/przeglad');
  // Part 1: the banner explains that titles are still coming instead of reporting failed matches.
  await expect(page.getByText('To część 1 importu')).toBeVisible();
  await expect(page.getByText('Nie udało się automatycznie dopasować')).toHaveCount(0);

  const before = api.requests.length;
  const withTitle = sample.items.map((i) => (i.filmwebId === UNKNOWN ? { ...i, title: 'Ręka' } : i));
  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles(file('full', withTitle));
  await page.waitForURL('**/przeglad');
  await expect(page.getByText('To część 1 importu')).toHaveCount(0);
  await expect.poll(() => api.requests.slice(before).some((r) => r.url().includes('/api/enrich'))).toBe(true);
  await expect(page.getByText('Nie udało się automatycznie dopasować')).toHaveCount(0);
  // Only the previously unmatched item is sent again; the 39 matched ones are kept.
  const later = api.requests.slice(before).filter((r) => r.method() === 'POST' && r.url().includes('/api/enrich'));
  const sent = later.flatMap((r) => (r.postDataJSON() as { items: { filmwebId: number }[] }).items.map((i) => i.filmwebId));
  expect([...new Set(sent)]).toEqual([UNKNOWN]);
});

test('imports several Letterboxd-format CSV files after a preview', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles(CSV_FILES);
  const preview = page.getByTestId('csv-preview');
  await expect(preview).toContainText('Filmy: 6 ocenionych, 1 do obejrzenia');
  await expect(preview).toContainText('Seriale: 1 ocenionych');
  await expect(preview).toContainText('Gry: 1 ocenionych');
  await expect(preview).toContainText('Pominięte duplikaty: 2');
  await expect(preview).toContainText('Bez oceny: 1');
  // The e2e mock reports no TMDB key → the preview warns that titles cannot be matched.
  await expect(page.getByTestId('csv-no-tmdb')).toBeVisible();
  await page.getByTestId('csv-confirm').click();
  await page.waitForURL('**/przeglad');
  await expect(page.getByText('Pasuje:')).toContainText('9 z 9');
  // CSV items have no Filmweb ID: they go straight to the title stage, still without ratings.
  const posts = api.requests.filter((r) => r.method() === 'POST' && r.url().includes('/api/enrich'));
  expect(posts.length).toBeGreaterThan(0);
  for (const r of posts) {
    const body = r.postDataJSON() as { items: { filmwebId: number; title?: string }[] };
    expect(body.items.every((i) => i.filmwebId < 0 && !!i.title)).toBe(true);
    expect(r.postData()).not.toMatch(/"rating"|"ratedAt"|"favorite"/);
  }
});

test('imports votes files from a data request and explains the missing data', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles(VOTES_FILES);
  const preview = page.getByTestId('csv-preview');
  await expect(preview).toContainText('Filmy: 5 ocenionych, 0 do obejrzenia');
  await expect(preview).toContainText('Seriale: 2 ocenionych');
  await expect(page.getByTestId('csv-missing')).toContainText('daty ocen');
  await preview.getByText('Szczegóły plików').click();
  await expect(preview).toContainText('widz_episodes.json → pominięty');
  await page.getByTestId('csv-confirm').click();
  await page.waitForURL('**/przeglad');
  await expect(page.getByText('Pasuje:')).toContainText('7 z 7');
  await expect(page.getByText('Wczytane pliki nie zawierają dat ocen').first()).toBeVisible();
  const posts = api.requests.filter((r) => r.method() === 'POST' && r.url().includes('/api/enrich'));
  expect(posts.length).toBeGreaterThan(0);
  for (const r of posts) {
    expect(r.postData()).not.toMatch(/"rating"|"comment"|prywatna notatka/);
  }
});

test('rejects a file in an unknown format', async ({ page }) => {
  await mockApi(page);
  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles({ name: 'dane.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') });
  await expect(page.getByRole('alert')).toContainText('Nie rozpoznaję formatu pliku „dane.csv”');
});

test('rejects an invalid file with a readable message', async ({ page }) => {
  await mockApi(page);
  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles({ name: 'zly.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion": 9}') });
  await expect(page.getByRole('alert')).toContainText('wersja schematu: 9');
});

test('data survives a reload but is wiped after the browser is closed', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockApi(page);
  await page.goto('/start');
  await page.getByTestId('file-input').setInputFiles(SAMPLE);
  await page.waitForURL('**/przeglad');
  await page.reload();
  await expect(page.getByText('Pasuje:')).toContainText('z 40');

  // Simulate closing the browser: keep IndexedDB and persistent cookies, drop session cookies.
  const state = await context.storageState({ indexedDB: true });
  await context.close();
  const reopened = await browser.newContext({
    storageState: { ...state, cookies: state.cookies.filter((c) => c.expires !== -1) },
  });
  const page2 = await reopened.newPage();
  await mockApi(page2);
  await page2.goto('/przeglad');
  await expect(page2).toHaveURL(/\/start$/);
  await reopened.close();
});
