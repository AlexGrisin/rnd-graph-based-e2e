import type { StateVerifier } from '../../../src/mbt/types.js';
import type { PageFixtures } from './page-fixtures.js';

export function createStateVerifier(pages: PageFixtures): StateVerifier {
  const assertions: Record<string, () => Promise<void>> = {
    home: () => pages.homePage.shouldBeOnPage(),
    login: () => pages.loginPage.shouldBeOnPage(),
    homeAuth: () => pages.homePage.shouldBeSignedIn(),
    myAccount: () => pages.myAccountPage.shouldBeOnPage(),
    error: () => pages.loginPage.shouldShowError(),
    pdp: () => pages.pdpPage.shouldBeOnPage(),
    cart: () => pages.cartPage.shouldBeOnPage(),
    checkout: () => pages.checkoutPage.shouldBeOnPage(),
  };

  return async (expectedState) => {
    const assert = assertions[expectedState];
    if (!assert) {
      throw new Error(
        `No page assertion for state "${expectedState}" — add a page object fixture and register it in state-verifier.ts`,
      );
    }
    await assert();
  };
}

export const noopStateVerifier: StateVerifier = async () => undefined;
