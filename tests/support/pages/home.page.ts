import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

export class HomePage {
  private readonly loginLink: Locator;
  private readonly logoutLink: Locator;

  constructor(private readonly page: Page) {
    const headerToolbar = page.getByRole('toolbar', { name: 'Header actions' });
    this.loginLink = headerToolbar.getByRole('link', { name: 'login' });
    this.logoutLink = page.getByRole('link', { name: /log out/i });
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/en_nl\/?(\?.*)?$/);
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await dismissAppOverlays(this.page);
    await this.page.waitForURL(/\/en_nl\/?(\?.*)?$/);
  }

  async openLogin(): Promise<void> {
    await dismissAppOverlays(this.page);

    const pathname = new URL(this.page.url()).pathname;
    const onAccountDashboard = /\/account$/.test(pathname);
    const onLoginPage = pathname.endsWith('/account/create');

    if (onAccountDashboard) {
      await this.logoutLink.click();
      await this.page.waitForURL(/\/en_nl\/?(\?.*)?$/);
      await dismissAppOverlays(this.page);
    }

    if (!onLoginPage || onAccountDashboard) {
      if (!/\/en_nl\/?$/.test(pathname) || onAccountDashboard) {
        await this.goto();
      }

      await this.loginLink.click();
      await this.page.waitForURL(/\/account\/create/);
    }

    await dismissAppOverlays(this.page);
  }
}
