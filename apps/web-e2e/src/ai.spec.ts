import { expect, test, type Route } from '@playwright/test';
import { mockApi, openDemo } from './support';

const KEY = 'sk-test-SECRET-key-123456';

/** Mock Anthropic Messages API: answers every title in the batch with a valid era. */
async function mockAnthropic(route: Route, mode: 'valid' | 'garbage') {
  const body = route.request().postDataJSON() as { messages: { content: string }[] };
  const items = JSON.parse(body.messages[0].content) as { filmwebId: number }[];
  const text =
    mode === 'valid'
      ? JSON.stringify(items.map((i) => ({ filmwebId: i.filmwebId, eras: ['ww2'], confidence: 0.9 })))
      : 'Przepraszam, nie mogę pomóc. {"broken": [';
  await route.fulfill({
    json: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    },
  });
}

async function configureAi(page: import('@playwright/test').Page) {
  await page.goto('/epoki');
  await page.getByRole('button', { name: 'Ustawienia AI' }).click();
  await page.getByTestId('ai-key').fill(KEY);
  await page.getByTestId('ai-key').blur();
}

test('AI classification fills eras and the key never reaches /api/*', async ({ page }) => {
  const api = await mockApi(page);
  const toAnthropic: string[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const headers = await route.request().allHeaders();
    if (route.request().method() !== 'POST') return route.fulfill({ status: 204 });
    // Depending on the SDK version the key travels as `x-api-key` or `authorization: Bearer`.
    toAnthropic.push(headers['x-api-key'] ?? headers['authorization']?.replace(/^Bearer /, '') ?? 'missing');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    return mockAnthropic(route, 'valid');
  });
  await openDemo(page);
  await configureAi(page);
  await page.getByTestId('ai-run').click();
  await expect(page.getByRole('status').filter({ hasText: 'Ustalono epokę' })).toBeVisible({ timeout: 30_000 });
  expect(toAnthropic.length).toBeGreaterThanOrEqual(5); // ≥ 100 titles in batches of 20
  expect([...new Set(toAnthropic)]).toEqual([KEY]);

  // Exploration after classification still triggers /api calls (awards etc.) – none may carry the key.
  await page.goto('/nagrody');
  for (const r of api.requests) {
    expect(r.url()).not.toContain(KEY);
    expect(r.postData() ?? '').not.toContain(KEY);
    expect(JSON.stringify(await r.allHeaders())).not.toContain(KEY);
  }
});

test('an invalid model answer does not break statistics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockApi(page);
  await page.route('https://api.anthropic.com/**', (route) => mockAnthropic(route, 'garbage'));
  await openDemo(page);
  await configureAi(page);
  await page.getByTestId('ai-run').click();
  await expect(page.getByRole('status').filter({ hasText: 'Ustalono epokę dla 0' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Epoka akcji' })).toBeVisible();
  expect(errors).toEqual([]);
});
