import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({
  path: resolve(fileURLToPath(new URL('.', import.meta.url)), '.env'),
});

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./tests/support/reporting/llm-observation-reporter.ts'],
  ],
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    headless: true,
  },
  projects: [
    {
      name: 'stub',
      testMatch:
        /\/(auth-graph-driven|shopping-graph-driven|llm-path-evaluator)\.spec\.ts/,
    },
    {
      name: 'app',
      testMatch: /\/(auth-graph-driven|shopping-graph-driven)\.spec\.ts/,
    },
  ],
  tsconfig: './tsconfig.json',
});
