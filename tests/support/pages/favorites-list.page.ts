import { expect, type Locator, type Page } from '@playwright/test';

/** The saved-items list at /favourites — distinct from the PDP's in-place favorited toggle. */
export class FavoritesListPage {
  private readonly heading: Locator;
  private readonly savedItem: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'My Favourites' });
    // Product PDPs are always at <sku>/<slug>/p.
    this.savedItem = page.locator('a[href$="/p"]');
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/favourites/);
    await expect(this.heading).toBeVisible();
  }
}
