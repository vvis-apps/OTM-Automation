import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['allure-playwright', {
      detail:       true,
      outputFolder: 'allure-results',
      suiteTitle:   false,
    }],
  ],

  use: {
    baseURL: process.env.OTM_URL,
    headless: !!(process.env.RENDER || process.env.HEADLESS),
    viewport: { width: 1440, height: 900 },
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    actionTimeout: 30000,
    navigationTimeout: 60000,
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
  ],
});
