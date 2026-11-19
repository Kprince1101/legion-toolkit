import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['ACCEPTANCE_PORT'] ?? '3100');
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: process.env['ACCEPTANCE_DIR'] ?? './acceptance',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next build && npx next start --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
