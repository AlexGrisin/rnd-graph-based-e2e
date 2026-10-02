import type { Locator, Page } from '@playwright/test';
import { test as base, expect, chromium } from '@playwright/test';
import type { ActionMap } from '../src/mbt/types.js';
import { createAppAuthActions } from './support/actions/app-auth.actions.js';
import { createAppShoppingActions } from './support/actions/app-shopping.actions.js';
import { createStubActions } from './support/actions/stub-actions.js';
import { createLoggingContext } from './support/actions/stub-actions.js';
import { HomePage } from './support/pages/home.page.js';
import { LoginPage } from './support/pages/login.page.js';
import { MyAccountPage } from './support/pages/my-account.page.js';
import { PdpPage } from './support/pages/pdp.page.js';
import { ListingPage } from './support/pages/listing.page.js';
import { FavoritesListPage } from './support/pages/favorites-list.page.js';
import { CartPage } from './support/pages/cart.page.js';
import { CheckoutPage } from './support/pages/checkout.page.js';
import type { PageFixtures } from './support/pages/page-fixtures.js';
import {
  createStateVerifier,
  noopStateVerifier,
} from './support/pages/state-verifier.js';
import { getLlmJudgeConfig } from './support/config/llm-judge.js';
import {
  createNoopPathEvaluator,
  createPathEvaluator,
  type PathEvaluator,
} from './support/evaluation/test-evaluator.js';
import { createLlmGatewayJudge } from './support/evaluation/judge-client.js';
import { pathEvidenceRubric } from './support/evaluation/rubrics/path-evidence.rubric.js';
import { stepEvidenceRubric } from './support/evaluation/rubrics/step-evidence.rubric.js';

type MbtFixtures = PageFixtures & {
  mbtContext: ReturnType<typeof createLoggingContext>;
  actions: ActionMap;
  stateVerifier: ReturnType<typeof createStateVerifier>;
  pathEvaluator: PathEvaluator;
};

function createMockLocator(): Locator {
  return {
    click: async () => undefined,
    fill: async () => undefined,
    first: () => createMockLocator(),
    nth: () => createMockLocator(),
    filter: () => createMockLocator(),
    count: async () => 0,
    isEnabled: async () => false,
    isVisible: async () => false,
    evaluate: async () => undefined,
    getByRole: () => createMockLocator(),
    getByTestId: () => createMockLocator(),
    getByText: () => createMockLocator(),
    locator: () => createMockLocator(),
  } as unknown as Locator;
}

function createMockPage(): Page {
  return {
    goto: async () => undefined,
    url: () => 'about:blank',
    getByRole: () => createMockLocator(),
    getByTestId: () => createMockLocator(),
    getByText: () => createMockLocator(),
    locator: () => createMockLocator(),
    waitForURL: async () => undefined,
  } as unknown as Page;
}

export const test = base.extend<MbtFixtures>({
  page: async ({ baseURL }, use, testInfo) => {
    if (testInfo.project.name === 'stub') {
      await use(createMockPage());
      return;
    }

    if (!baseURL) {
      throw new Error(
        'Missing BASE_URL. Set it in .env (see .env.example) before running live tests.',
      );
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
  pdpPage: async ({ page }, use) => {
    await use(new PdpPage(page));
  },
  listingPage: async ({ page }, use) => {
    await use(new ListingPage(page));
  },
  favoritesListPage: async ({ page }, use) => {
    await use(new FavoritesListPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  mbtContext: async ({ page }, use) => {
    await use(createLoggingContext(page));
  },
  pathEvaluator: async ({ page }, use, testInfo) => {
    if (testInfo.project.name === 'stub') {
      await use(createNoopPathEvaluator());
      return;
    }

    const config = getLlmJudgeConfig();
    if (!config) {
      await use(createNoopPathEvaluator());
      return;
    }

    await use(
      createPathEvaluator({
        page,
        testInfo,
        routeJudge:
          config.scope === 'route' || config.scope === 'both'
            ? createLlmGatewayJudge(config, pathEvidenceRubric)
            : undefined,
        stepJudge:
          config.scope === 'step' || config.scope === 'both'
            ? createLlmGatewayJudge(config, stepEvidenceRubric)
            : undefined,
      }),
    );
  },
  actions: async (
    {
      homePage,
      loginPage,
      myAccountPage,
      pdpPage,
      listingPage,
      favoritesListPage,
      cartPage,
      checkoutPage,
    },
    use,
    testInfo,
  ) => {
    if (testInfo.project.name === 'stub') {
      await use(createStubActions());
      return;
    }
    const pages = {
      homePage,
      loginPage,
      myAccountPage,
      pdpPage,
      listingPage,
      favoritesListPage,
      cartPage,
      checkoutPage,
    };
    await use({
      ...createAppAuthActions(pages),
      ...createAppShoppingActions(pages),
    });
  },
  stateVerifier: async (
    {
      homePage,
      loginPage,
      myAccountPage,
      pdpPage,
      listingPage,
      favoritesListPage,
      cartPage,
      checkoutPage,
    },
    use,
    testInfo,
  ) => {
    if (testInfo.project.name === 'stub') {
      await use(noopStateVerifier);
      return;
    }
    await use(
      createStateVerifier({
        homePage,
        loginPage,
        myAccountPage,
        pdpPage,
        listingPage,
        favoritesListPage,
        cartPage,
        checkoutPage,
      }),
    );
  },
});

export { expect };
