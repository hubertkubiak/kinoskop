import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mockApi } from './support';

const SAMPLE = join(__dirname, '../../../fixtures/export/sample-export.json');
const CSV_DIR = join(__dirname, '../../../fixtures/export/csv');
const CSV_FILES = readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv')).map((f) => join(CSV_DIR, f));

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
