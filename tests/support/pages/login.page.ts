import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

export class LoginPage {
  private readonly emailField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.emailField = page.getByRole('textbox', { name: /Email/i });
    this.passwordField = page.getByRole('textbox', { name: /Password/i });
    this.loginButton = page.getByRole('button', { name: 'log in' });
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/account\/create/);
  }

  async shouldShowError(): Promise<void> {
    await expect(this.page).toHaveURL(/\/account\/create\?error=true/);
  }

  async submit(username: string, password: string): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.emailField.fill(username);
    await this.passwordField.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL((url) => /\/account$/.test(url.pathname), {
      timeout: 30_000,
    });
  }

  async failLogin(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.emailField.fill('invalid@example.com');
    await this.passwordField.fill('wrong-password');
    await this.loginButton.click();
    await this.page.waitForURL(/\/account\/create\?error=true/, {
      timeout: 30_000,
    });
  }
}
