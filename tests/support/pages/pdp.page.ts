import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';
import { getAppProduct } from '../config/app-product.js';

export class PdpPage {
  private readonly addToCartButton: Locator;
  private readonly widthSizes: Locator;
  private readonly lengthSizes: Locator;
  private readonly bagLink: Locator;

  constructor(private readonly page: Page) {
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.widthSizes = page.getByTestId('width-size');
    this.lengthSizes = page.getByTestId('length-size');
    this.bagLink = page.locator('a[href*="/checkout/shopping-bag"]');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/shop\//);
    await expect(this.addToCartButton).toBeVisible();
  }

  async openProduct(): Promise<void> {
    const { productPath } = getAppProduct();
    await this.page.goto(productPath);
    await dismissAppOverlays(this.page);
    await expect(this.addToCartButton).toBeVisible({ timeout: 30_000 });
  }

  async addToCartAndGoToBag(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.clickFirstEnabled(this.widthSizes);
    await this.page.waitForTimeout(300);
    if ((await this.lengthSizes.count()) > 0) {
      await this.clickFirstEnabled(this.lengthSizes);
      await this.page.waitForTimeout(300);
    }

    await dismissAppOverlays(this.page);
    await this.addToCartButton.click();

    // Header bag badge updates once the line item is in the session cart.
    await expect(this.bagLink.first()).toContainText(/[1-9]/, {
      timeout: 20_000,
    });
    await this.bagLink.first().click();
    await dismissAppOverlays(this.page);
    await this.page.waitForURL(/\/checkout\/shopping-bag/);
    await expect(
      this.page.getByText(/Your shopping bag is empty/i),
    ).toHaveCount(0, { timeout: 15_000 });
  }

  private async clickFirstEnabled(sizes: Locator): Promise<void> {
    const count = await sizes.count();
    for (let i = 0; i < count; i++) {
      const size = sizes.nth(i);
      if (await size.isEnabled()) {
        await size.click();
        return;
      }
    }
    throw new Error('No enabled size option found on PDP');
  }
}
