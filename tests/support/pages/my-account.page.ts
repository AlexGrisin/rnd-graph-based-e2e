import { expect, type Locator, type Page } from '@playwright/test';
import { isHomeUrl } from './home.page.js';

export class MyAccountPage {
  private readonly logoutLink: Locator;

  constructor(private readonly page: Page) {
    this.logoutLink = page.getByRole('button', { name: /sign out|log out/i });
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/my-account/);
  }

  async logout(): Promise<void> {
    await this.logoutLink.click();
    await this.page.waitForURL(isHomeUrl);
  }
}
