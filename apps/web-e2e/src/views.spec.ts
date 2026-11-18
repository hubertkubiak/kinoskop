import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, openDemo } from './support';

const VIEWS = ['przeglad', 'gatunki', 'oceny', 'swiat', 'epoki', 'tworcy', 'nagrody', 'mapa-gustu', 'chce-zobaczyc', 'weryfikacja'];

test('demo opens every view without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockApi(page);
  await openDemo(page);
  for (const v of VIEWS) {
    await page.goto(`/${v}`);
    await expect(page.locator('main h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('global filters live in the query string and survive navigation', async ({ page }) => {
  await mockApi(page);
  await openDemo(page);
  await page.goto('/gatunki?typ=serial');
  await expect(page.getByRole('list', { name: 'Aktywne filtry' })).toContainText('Seriale');
  await page.getByRole('link', { name: 'Przegląd' }).first().click();
  await expect(page).toHaveURL(/typ=serial/);
});

test('charts offer a table view', async ({ page }) => {
  await mockApi(page);
  await openDemo(page);
  await page.getByRole('button', { name: 'Pokaż jako tabelę' }).first().click();
  await expect(page.locator('table').first()).toBeVisible();
});

for (const v of ['start', 'przeglad', 'gatunki', 'epoki', 'o-aplikacji']) {
  test(`axe: no serious accessibility violations on /${v}`, async ({ page }) => {
    await mockApi(page);
    if (v !== 'start') await openDemo(page);
    await page.goto(`/${v}`);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).exclude('canvas').analyze();
    const serious = results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical');
    expect(serious.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}
