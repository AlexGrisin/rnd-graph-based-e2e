import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

/** Guest checkout email for the POC — not a real account credential. */
const GUEST_CHECKOUT_EMAIL = 'mbt-poc@example.com';

export class CheckoutPage {
  private readonly guestEmail: Locator;
  private readonly secureCheckoutHeading: Locator;

  constructor(private readonly page: Page) {
    this.guestEmail = page.locator('#guestform\\.email');
    this.secureCheckoutHeading = page.getByRole('heading', {
      name: /Secure checkout|Delivery address/i,
    });
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout\/shipping/);
    await expect(this.secureCheckoutHeading.first()).toBeVisible();
  }

  /**
   * Completes guest gate (email + Proceed) when shown, then lands on shipping.
   * No payment step.
   */
  async continueAsGuestIfNeeded(): Promise<void> {
    await dismissAppOverlays(this.page);

    if (await this.guestEmail.isVisible().catch(() => false)) {
      await this.guestEmail.fill(GUEST_CHECKOUT_EMAIL);
      await Promise.all([
        this.page.waitForURL(/\/checkout\/shipping/, { timeout: 30_000 }),
        this.guestEmail.evaluate((el) => {
          el.closest('form')
            ?.querySelector<HTMLButtonElement>('button[type=submit]')
            ?.click();
        }),
      ]);
    }

    await this.page.waitForURL(/\/checkout\/shipping/, { timeout: 30_000 });
    await dismissAppOverlays(this.page);
  }
}
