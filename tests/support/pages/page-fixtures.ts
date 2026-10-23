import type { HomePage } from './home.page.js';
import type { LoginPage } from './login.page.js';
import type { MyAccountPage } from './my-account.page.js';
import type { PdpPage } from './pdp.page.js';
import type { ListingPage } from './listing.page.js';
import type { FavoritesListPage } from './favorites-list.page.js';
import type { CartPage } from './cart.page.js';
import type { CheckoutPage } from './checkout.page.js';
import type { StoreLocatorPage } from './store-locator.page.js';
import type { StoreRegionPage } from './store-region.page.js';
import type { StoreDetailsPage } from './store-details.page.js';

export type PageFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  myAccountPage: MyAccountPage;
  pdpPage: PdpPage;
  listingPage: ListingPage;
  favoritesListPage: FavoritesListPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  storeLocatorPage: StoreLocatorPage;
  storeRegionPage: StoreRegionPage;
  storeDetailsPage: StoreDetailsPage;
};
