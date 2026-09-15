import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared assertion for both category (/jewellery/engagement-rings) and search
 * results (search redirects to a matching /jewellery/<category> listing) —
 * Beaverbrooks renders both through the same listing template.
 */
export class ListingPage {
  private readonly productTiles: Locator;

  constructor(private readonly page: Page) {
    // Product PDPs are always at <sku>/<slug>/p.
    this.productTiles = page.getByTestId('product-card-link');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/jewellery\//);
  }

  /** Opens the first product tile on the listing — deterministic, so generated test names stay stable. */
  async openFirstProduct(): Promise<void> {
    await this.productTiles.first().click();
    await this.page.waitForURL(/\/p$/, { timeout: 30_000 });
  }
}
