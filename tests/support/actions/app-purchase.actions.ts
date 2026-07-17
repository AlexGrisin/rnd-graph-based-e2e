import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';
import type { PageFixtures } from '../pages/page-fixtures.js';

export function createAppPurchaseActions(pages: PageFixtures): ActionMap {
  return {
    OPEN_PDP: async (ctx: MbtContext) => {
      ctx.log('OPEN_PDP');
      await pages.pdpPage.openProduct();
    },
    ADD_TO_CART: async (ctx: MbtContext) => {
      ctx.log('ADD_TO_CART');
      await pages.pdpPage.addToCartAndGoToBag();
    },
    GO_CHECKOUT: async (ctx: MbtContext) => {
      ctx.log('GO_CHECKOUT');
      await pages.cartPage.proceedToCheckoutGate();
      await pages.checkoutPage.continueAsGuestIfNeeded();
    },
  };
}
