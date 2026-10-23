import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

/** Store listing for one region (/stores/region/<region>). */
export class StoreRegionPage {
  private readonly heading: Locator;
  private readonly storeDetailsLink: Locator;
  private readonly backToFinderLink: Locator;

  constructor(private readonly page: Page) {
    const main = page.locator('main');
    this.heading = main.getByRole('heading', {
      level: 1,
      name: /^Beaverbrooks In /,
    });
    this.storeDetailsLink = main
      .getByRole('link', { name: 'View Full Store Details' })
      .first();
    this.backToFinderLink = main.getByRole('link', {
      name: 'Back To Store Finder',
    });
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores\/region\//);
    await expect(this.heading).toBeVisible();
    await expect(this.storeDetailsLink).toBeVisible();
    await expect(this.backToFinderLink).toBeVisible();
  }

  async openStoreDetails(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.storeDetailsLink.click();
    await this.page.waitForURL(/\/stores\/(?!region\/)[^/?]+$/, {
      timeout: 30_000,
    });
  }

  async backToStoreFinder(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.backToFinderLink.click();
    await this.page.waitForURL(/\/stores$/, { timeout: 30_000 });
  }
}
