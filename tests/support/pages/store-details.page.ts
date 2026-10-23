import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

/** Shared by every store instance (high-street store, boutique) at /stores/<slug>. */
export class StoreDetailsPage {
  private readonly storeName: Locator;
  private readonly openingHoursHeading: Locator;
  private readonly phoneLink: Locator;
  private readonly emailLink: Locator;
  private readonly backLink: Locator;

  constructor(private readonly page: Page) {
    const main = page.locator('main');
    this.storeName = main.getByRole('heading', { level: 1 });
    this.openingHoursHeading = main.getByRole('heading', {
      name: 'Opening hours',
    });
    this.phoneLink = main.locator('a[href^="tel:"]').first();
    this.emailLink = main.locator('a[href^="mailto:"]').first();
    this.backLink = main.getByRole('link', { name: 'Back to search results' });
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores\/(?!region\/)[^/?]+$/);
    await expect(this.storeName).toBeVisible();
    await expect(this.openingHoursHeading).toBeVisible();
    await expect(this.phoneLink).toBeVisible();
    await expect(this.emailLink).toBeVisible();
    await expect(this.backLink).toBeVisible();
  }

  /** The back link leads to results, the region page or the bare locator depending on where details was opened. */
  async goBack(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.backLink.click();
    await this.page.waitForURL(
      (url) =>
        url.pathname === '/stores' ||
        url.pathname.startsWith('/stores/region/'),
      { timeout: 30_000 },
    );
  }
}
