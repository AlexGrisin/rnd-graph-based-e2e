import { expect, type Locator, type Page } from '@playwright/test';

/** Beaverbrooks home is the bare origin — may render with or without a trailing slash. */
export const isHomeUrl = (url: URL): boolean =>
  url.pathname === '/' || url.pathname === '';

export class HomePage {
  private readonly loginLink: Locator;
  private readonly myAccountLink: Locator;

  constructor(private readonly page: Page) {
    const header = page.locator('header');
    this.loginLink = header.getByRole('link', { name: 'Sign in' }).first();
    // Best-effort: not verified against a real signed-in session (no working
    // test account was available). Adjust once a valid APP_EMAIL/APP_PASSWORD
    // is confirmed to authenticate.
    this.myAccountLink = header
      .getByRole('link', { name: /my account/i })
      .first();
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(isHomeUrl);
  }

  /** Post-login home state: signed in, "My account" nav available. Unverified — see constructor note. */
  async shouldBeSignedIn(): Promise<void> {
    await expect(this.page).toHaveURL(isHomeUrl);
    await expect(this.loginLink).toHaveCount(0);
    await expect(this.myAccountLink).toBeVisible();
  }

  async openMyAccount(): Promise<void> {
    await this.myAccountLink.hover();
    await this.myAccountLink.click();
    await this.page.waitForURL(/\/my-account/, { timeout: 30_000 });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForURL(isHomeUrl);
  }

  async openLogin(): Promise<void> {
    if (!isHomeUrl(new URL(this.page.url()))) {
      await this.goto();
    }

    await this.loginLink.click();
    await this.page.waitForURL(/\/login/);
  }
}
