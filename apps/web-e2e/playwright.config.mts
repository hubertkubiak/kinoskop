import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { getReadyUrl, workspaceRoot } from '@nx/devkit';

const isCI = !!process.env['CI'];
const baseURL = process.env['BASE_URL'] || getReadyUrl('http://localhost:4200');

/**
 * E2E tests run against the dev server. The Kinoskop API and AI providers are mocked per test
 * with `page.route`, so no keys or network access are needed.
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: isCI ? 'pnpm exec nx run web:serve-static' : 'pnpm exec nx run web:serve',
    url: getReadyUrl('http://localhost:4200'),
    reuseExistingServer: true,
    cwd: workspaceRoot,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
