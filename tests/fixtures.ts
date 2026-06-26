import type { Locator, Page } from '@playwright/test';
import { test as base, expect, chromium } from '@playwright/test';
import type { ActionMap } from '../src/mbt/types.js';
import { appAuthMachine } from '../src/machines/app-auth.machine.js';
import { MbtRunner } from '../src/mbt/runner/mbt-runner.js';
import { createAppAuthActions } from './support/actions/app-auth.actions.js';
import { createStubActions } from './support/actions/stub-actions.js';
import { createLoggingContext } from './support/actions/stub-actions.js';
import { HomePage } from './support/pages/home.page.js';
import { LoginPage } from './support/pages/login.page.js';
import { MyAccountPage } from './support/pages/my-account.page.js';
import type { PageFixtures } from './support/pages/page-fixtures.js';
import {
  createStateVerifier,
  noopStateVerifier,
} from './support/pages/state-verifier.js';

type MbtFixtures = PageFixtures & {
  mbtRunner: MbtRunner;
  mbtContext: ReturnType<typeof createLoggingContext>;
  actions: ActionMap;
  stateVerifier: ReturnType<typeof createStateVerifier>;
};

function createMockLocator(): Locator {
  return {
    click: async () => undefined,
    fill: async () => undefined,
    getByRole: () => createMockLocator(),
  } as unknown as Locator;
}

function createMockPage(): Page {
  return {
    goto: async () => undefined,
    url: () => 'about:blank',
    getByRole: () => createMockLocator(),
    waitForURL: async () => undefined,
  } as unknown as Page;
}

export const test = base.extend<MbtFixtures>({
  page: async ({ baseURL }, use, testInfo) => {
    if (testInfo.project.name === 'stub') {
      await use(createMockPage());
      return;
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await use(page);
    await context.close();
    await browser.close();
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  myAccountPage: async ({ page }, use) => {
    await use(new MyAccountPage(page));
  },
  mbtRunner: async ({}, use) => {
    await use(new MbtRunner(appAuthMachine));
  },
  mbtContext: async ({ page }, use) => {
    await use(createLoggingContext(page));
  },
  actions: async ({ homePage, loginPage, myAccountPage }, use, testInfo) => {
    if (testInfo.project.name === 'stub') {
      await use(createStubActions());
      return;
    }
    await use(createAppAuthActions({ homePage, loginPage, myAccountPage }));
  },
  stateVerifier: async (
    { homePage, loginPage, myAccountPage },
    use,
    testInfo,
  ) => {
    if (testInfo.project.name === 'stub') {
      await use(noopStateVerifier);
      return;
    }
    await use(createStateVerifier({ homePage, loginPage, myAccountPage }));
  },
});

export { expect };
