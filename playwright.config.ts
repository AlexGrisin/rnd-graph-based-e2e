import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({
  path: resolve(fileURLToPath(new URL('.', import.meta.url)), '.env'),
});

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.g-star.com/en_nl',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'stub',
      testMatch: /\/(shopping-graph-driven)\.spec\.ts/,
    },
    {
      name: 'app',
      testMatch: /\/(graph-driven|shopping-graph-driven)\.spec\.ts/,
    },
    {
      // Browser-free: exercises the exploration telemetry core (src/exploration)
      // + the guardrail generator and post-hoc trace parser. The agent-driven
      // live run is /explore (Playwright MCP), not a Playwright project.
      name: 'exploration',
      testMatch: /\/exploration\/.*\.spec\.ts/,
    },
  ],
  tsconfig: './tsconfig.json',
});
