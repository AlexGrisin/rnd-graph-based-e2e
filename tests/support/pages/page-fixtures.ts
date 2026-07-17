import type { HomePage } from './home.page.js';
import type { LoginPage } from './login.page.js';
import type { MyAccountPage } from './my-account.page.js';
import type { PdpPage } from './pdp.page.js';
import type { CartPage } from './cart.page.js';
import type { CheckoutPage } from './checkout.page.js';

export type PageFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  myAccountPage: MyAccountPage;
  pdpPage: PdpPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
};
