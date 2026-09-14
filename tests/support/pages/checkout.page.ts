import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

/** Guest checkout email for the POC — not a real account credential. */
const GUEST_CHECKOUT_EMAIL = 'mbt-poc@example.com';

export class CheckoutPage {
  private readonly guestEmail: Locator;
  private readonly guestContinueButton: Locator;
  private readonly checkoutHeading: Locator;

  constructor(private readonly page: Page) {
    this.guestEmail = page.locator('#deliverySignInEmail');
    this.guestContinueButton = page.getByTestId('delivery-login-continue-cta');
    this.checkoutHeading = page.getByTestId('generic-title');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout\/delivery/);
    await expect(this.checkoutHeading.first()).toBeVisible();
  }

  /**
   * Completes the guest email gate (no account required), which reveals the
   * delivery/collection step on the same /checkout/delivery page. No payment step.
   */
  async continueAsGuestIfNeeded(): Promise<void> {
    await dismissAppOverlays(this.page);

    if (await this.guestEmail.isVisible().catch(() => false)) {
      await this.guestEmail.fill(GUEST_CHECKOUT_EMAIL);
      await this.guestContinueButton.click();
    }

    await this.page.waitForURL(/\/checkout\/delivery/, { timeout: 30_000 });
    await dismissAppOverlays(this.page);
  }
}
