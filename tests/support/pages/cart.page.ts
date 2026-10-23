import { expect, type Locator, type Page } from '@playwright/test';

export class CartPage {
  private readonly proceedToCheckout: Locator;
  private readonly cartEntryName: Locator;
  private readonly guestEmail: Locator;

  constructor(private readonly page: Page) {
    this.proceedToCheckout = page.getByTestId('cart-summary-cta');
    this.cartEntryName = page.getByTestId('cart-entry-name');
    this.guestEmail = page.locator('#deliverySignInEmail');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout\/cart/);
    await expect(this.page.getByText(/basket is currently empty/i)).toHaveCount(
      0,
    );
    await expect(this.cartEntryName.first()).toBeVisible();
    await expect(this.proceedToCheckout).toBeVisible();
  }

  /** Opens the login/guest checkout gate (no payment). */
  async proceedToCheckoutGate(): Promise<void> {
    await this.proceedToCheckout.click();
    await this.page.waitForURL(/\/checkout\/delivery/, { timeout: 30_000 });
    await expect(this.guestEmail).toBeVisible({ timeout: 30_000 });
  }
}
