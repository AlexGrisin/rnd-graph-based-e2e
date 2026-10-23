import { expect, type Locator, type Page } from '@playwright/test';

export class PdpPage {
  private readonly productName: Locator;
  private readonly addToCartButton: Locator;
  private readonly sizeDropdown: Locator;
  private readonly addToFavoritesButton: Locator;
  private readonly miniCartCheckoutButton: Locator;
  private readonly headerCartLink: Locator;

  constructor(private readonly page: Page) {
    this.productName = page.getByTestId('product-name');
    this.addToCartButton = page.getByTestId('add-to-bag-button-main');
    this.sizeDropdown = page
      .getByTestId('swatch-list-wrapper')
      .getByTestId('ring-size-dropdown');
    this.addToFavoritesButton = page.getByTestId('add-favourites-button');
    // "Add to bag" auto-opens this mini-cart drawer; its own CTA navigates to the bag.
    this.miniCartCheckoutButton = page.getByTestId('mini-cart-checkout-button');
    // The header cart icon (present on every page) opens the same drawer when it isn't already open.
    this.headerCartLink = page
      .locator('header a[href="/checkout/cart"]')
      .first();
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/p$/);
    await expect(this.productName).toBeVisible();
  }

  /** Clicking "Add to Favourites" toggles the button in place — stays on the PDP, no navigation. */
  async addToFavorites(): Promise<void> {
    await this.addToFavoritesButton.click();
  }

  async shouldBeFavorited(): Promise<void> {
    await expect(this.page).toHaveURL(/\/p$/);
    await expect(this.addToFavoritesButton).toHaveText(/Added to Favourites/i);
  }

  async addToCart(): Promise<void> {
    await this.selectSizeIfPresent();
    await this.addToCartButton.click();
  }

  /** "Add to bag" auto-opens a mini-cart drawer in place — stays on the PDP, no navigation. */
  async shouldHaveItemInBag(): Promise<void> {
    await expect(this.page).toHaveURL(/\/p$/);
    await expect(this.miniCartCheckoutButton).toBeVisible();
  }

  /**
   * The mini-cart drawer is global (same on every page), but only auto-opens
   * right after "Add to bag". Open it via the header icon when it isn't
   * already showing, so this works whether GO_CART fires from the PDP
   * (bagAdded, drawer already open) or elsewhere (e.g. home).
   */
  async goToCart(): Promise<void> {
    if (!(await this.miniCartCheckoutButton.isVisible().catch(() => false))) {
      await this.headerCartLink.click();
      await this.miniCartCheckoutButton.waitFor({
        state: 'visible',
        timeout: 10_000,
      });
    }

    await this.miniCartCheckoutButton.click({ timeout: 20_000 });
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
