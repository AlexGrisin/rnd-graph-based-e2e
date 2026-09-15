import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';
import type { PageFixtures } from '../pages/page-fixtures.js';

/** Search term for the POC — matches a real category (redirects to /jewellery/necklaces). */
const SEARCH_QUERY_TERM = 'necklace';

export function createAppShoppingActions(pages: PageFixtures): ActionMap {
  return {
    BROWSE_CATEGORY: async (ctx: MbtContext) => {
      ctx.log('BROWSE_CATEGORY');
      await pages.homePage.browseCategory();
    },
    SEARCH_QUERY: async (ctx: MbtContext) => {
      ctx.log('SEARCH_QUERY');
      await pages.homePage.search(SEARCH_QUERY_TERM);
    },
    GO_HOME: async (ctx: MbtContext) => {
      ctx.log('GO_HOME');
      await pages.homePage.goHome();
    },
    GO_FAVORITES: async (ctx: MbtContext) => {
      ctx.log('GO_FAVORITES');
      await pages.homePage.goFavorites();
    },
    OPEN_PDP: async (ctx: MbtContext) => {
      ctx.log('OPEN_PDP');
      await pages.listingPage.openFirstProduct();
    },
    ADD_TO_CART: async (ctx: MbtContext) => {
      ctx.log('ADD_TO_CART');
      await pages.pdpPage.addToCart();
    },
    GO_CART: async (ctx: MbtContext) => {
      ctx.log('GO_CART');
      await pages.pdpPage.goToCart();
    },
    ADD_TO_FAVORITES: async (ctx: MbtContext) => {
      ctx.log('ADD_TO_FAVORITES');
      await pages.pdpPage.addToFavorites();
    },
    GO_CHECKOUT: async (ctx: MbtContext) => {
      ctx.log('GO_CHECKOUT');
      await pages.cartPage.proceedToCheckoutGate();
      await pages.checkoutPage.continueAsGuestIfNeeded();
    },
  };
}
