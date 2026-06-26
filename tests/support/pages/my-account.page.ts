import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

export class MyAccountPage {
  private readonly logoutLink: Locator;

  constructor(private readonly page: Page) {
    this.logoutLink = page.getByRole('link', { name: /log out/i });
  }

  async shouldBeOnPage(): Promise<void> {
    const pathname = new URL(this.page.url()).pathname;
    expect(pathname).toMatch(/\/account$/);
    await expect(this.logoutLink).toBeVisible();
  }

  async logout(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.logoutLink.click();
    await this.page.waitForURL(/\/en_nl\/?(\?.*)?$/);
    await dismissAppOverlays(this.page);
  }
}
