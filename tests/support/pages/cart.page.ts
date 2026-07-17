import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

export class CartPage {
  private readonly proceedToCheckout: Locator;
  private readonly shoppingBagHeading: Locator;
  private readonly guestEmail: Locator;

  constructor(private readonly page: Page) {
    this.proceedToCheckout = page.getByRole('link', {
      name: /Proceed to checkout/i,
    });
    this.shoppingBagHeading = page.getByRole('heading', {
      name: 'Shopping Bag',
      exact: true,
    });
    this.guestEmail = page.locator('#guestform\\.email');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout\/shopping-bag/);
    await expect(this.shoppingBagHeading).toBeVisible();
    await expect(
      this.page.getByText(/Your shopping bag is empty/i),
    ).toHaveCount(0);
    await expect(this.proceedToCheckout.first()).toBeVisible();
  }

  /** Opens the login/guest checkout gate (no payment). */
  async proceedToCheckoutGate(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.proceedToCheckout.first().click();

    const guestReady = await this.guestEmail
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!guestReady && !/\/checkout\/shipping/.test(this.page.url())) {
      await this.page.goto('/checkout/shipping');
      await dismissAppOverlays(this.page);
    }

    await expect(
      this.guestEmail.or(
        this.page.getByRole('heading', { name: /Secure checkout/i }),
      ),
    ).toBeVisible({ timeout: 30_000 });
  }
}
