import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';
import type { PageFixtures } from '../pages/page-fixtures.js';

/** Approved search data for the POC. */
const CITY = 'London';
const POSTCODE = 'SW6 1HS';
/** Brand with no London store — combined with CITY it yields the no-results state. */
const NO_MATCH_BRAND = 'Jacob & Co.';

export function createAppStoreLookupActions(pages: PageFixtures): ActionMap {
  return {
    OPEN_STORE_LOCATOR: async (ctx: MbtContext) => {
      await pages.homePage.openStoreLocator();
    },
    SUBMIT_EMPTY_STORE_SEARCH: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.submitEmpty();
    },
    SEARCH_STORES_BY_CITY: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.search(CITY);
    },
    SEARCH_STORES_BY_POSTCODE: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.search(POSTCODE);
    },
    SEARCH_STORES_NO_MATCH: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.search(CITY, NO_MATCH_BRAND);
    },
    SHOW_ALL_STORE_RESULTS: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.showAllResults();
    },
    BROWSE_STORE_REGION: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.browseRegion();
    },
    SELECT_STORE_ON_MAP: async (ctx: MbtContext) => {
      await pages.storeLocatorPage.selectStoreOnMap();
    },
    // One handler per source situation: the card lives on a different page object.
    OPEN_STORE_DETAILS: async (ctx: MbtContext) => {
      const onRegionPage = /\/stores\/region\//.test(ctx.page.url());
      if (onRegionPage) {
        await pages.storeRegionPage.openStoreDetails();
      } else {
        await pages.storeLocatorPage.openStoreDetails();
      }
    },
    BACK_TO_STORE_RESULTS: async (ctx: MbtContext) => {
      await pages.storeDetailsPage.goBack();
    },
    BACK_TO_STORE_REGION: async (ctx: MbtContext) => {
      await pages.storeDetailsPage.goBack();
    },
    BACK_TO_STORE_LOCATOR: async (ctx: MbtContext) => {
      await pages.storeDetailsPage.goBack();
    },
    BACK_TO_STORE_FINDER: async (ctx: MbtContext) => {
      await pages.storeRegionPage.backToStoreFinder();
    },
  };
}
