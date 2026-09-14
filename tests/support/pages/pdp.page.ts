import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';
import { getAppProduct } from '../config/app-product.js';

export class PdpPage {
  private readonly productName: Locator;
  private readonly addToCartButton: Locator;
  private readonly sizeDropdown: Locator;
  private readonly addToFavoritesButton: Locator;
  private readonly bagLink: Locator;

  constructor(private readonly page: Page) {
    this.productName = page.getByTestId('product-name');
    this.addToCartButton = page.getByTestId('add-to-bag-button-main');
    this.sizeDropdown = page
      .getByTestId('swatch-list-wrapper')
      .getByTestId('ring-size-dropdown');
    this.addToFavoritesButton = page.getByTestId('add-favourites-button');
    this.bagLink = page.locator('header a[href="/checkout/cart"]');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/p$/);
    await expect(this.productName).toBeVisible();
  }

  async openProduct(): Promise<void> {
    const { productPath } = getAppProduct();
    await this.page.goto(productPath);
    await dismissAppOverlays(this.page);
    await expect(this.addToCartButton).toBeVisible({ timeout: 30_000 });
  }

  async addToFavorites(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.addToFavoritesButton.click();
  }

  async addToCartAndGoToBag(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.selectSizeIfPresent();

    await dismissAppOverlays(this.page);
    await this.addToCartButton.click();

    // Header bag badge updates once the line item is in the session cart.
    await expect(this.bagLink.first()).toContainText(/[1-9]/, {
      timeout: 20_000,
    });
    await this.bagLink.first().click();
    await dismissAppOverlays(this.page);
    await this.page.waitForURL(/\/checkout\/cart/);
    await expect(this.page.getByText(/basket is currently empty/i)).toHaveCount(
      0,
      { timeout: 15_000 },
    );
  }

  /** Products with variants (e.g. ring size) show a swatch dropdown; others don't. */
  private async selectSizeIfPresent(): Promise<void> {
    if (!(await this.sizeDropdown.isVisible().catch(() => false))) {
      return;
    }

    await this.sizeDropdown.scrollIntoViewIfNeeded();
    await this.sizeDropdown.click();
    const firstOption = this.page.getByRole('option').first();
    await firstOption.waitFor({ state: 'visible', timeout: 10_000 });
    await firstOption.click();
  }
}
