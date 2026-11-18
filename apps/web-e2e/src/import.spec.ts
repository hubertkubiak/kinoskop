import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { mockApi } from './support';

const SAMPLE = join(__dirname, '../../../fixtures/export/sample-export.json');

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
