import type { StateVerifier } from '../../../src/mbt/types.js';
import type { PageFixtures } from './page-fixtures.js';

export function createStateVerifier(pages: PageFixtures): StateVerifier {
  const assertions: Record<string, () => Promise<void>> = {
    home: () => pages.homePage.shouldBeOnPage(),
    login: () => pages.loginPage.shouldBeOnPage(),
    credentialsRequired: () => pages.loginPage.shouldRequireCredentials(),
    homeAuth: () => pages.homePage.shouldBeSignedIn(),
    myAccount: () => pages.myAccountPage.shouldBeOnPage(),
    error: () => pages.loginPage.shouldShowError(),
    pdp: () => pages.pdpPage.shouldBeOnPage(),
    category: () => pages.listingPage.shouldBeOnPage(),
    search: () => pages.listingPage.shouldBeOnPage(),
    favoritesAdded: () => pages.pdpPage.shouldBeFavorited(),
    favoritesList: () => pages.favoritesListPage.shouldBeOnPage(),
    bagAdded: () => pages.pdpPage.shouldHaveItemInBag(),
    cart: () => pages.cartPage.shouldBeOnPage(),
    checkout: () => pages.checkoutPage.shouldBeOnPage(),
    storeLocator: () => pages.storeLocatorPage.shouldBeOnPage(),
    storeSearchInvalid: () =>
      pages.storeLocatorPage.shouldShowValidationError(),
    storeResults: () => pages.storeLocatorPage.shouldShowResults(),
    storeNoResults: () => pages.storeLocatorPage.shouldShowNoResults(),
    storeMapSelection: () => pages.storeLocatorPage.shouldShowMapSelection(),
    storeRegion: () => pages.storeRegionPage.shouldBeOnPage(),
    storeDetails: () => pages.storeDetailsPage.shouldBeOnPage(),
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
