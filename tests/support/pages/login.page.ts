import { expect, type Locator, type Page } from '@playwright/test';
import { isHomeUrl } from './home.page.js';

export class LoginPage {
  private readonly emailField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;
  private readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.emailField = page.locator('#signInEmail');
    this.passwordField = page.locator('#signInPassword');
    this.loginButton = page.getByTestId('signInSubmit');
    this.errorMessage = page.getByText(
      /Your username and\/or password was incorrect/i,
    );
  }

  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
  }

  async shouldShowError(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.errorMessage).toBeVisible();
  }

  /** Beaverbrooks redirects to home (signed in) after login, not straight to /my-account. */
  async submit(username: string, password: string): Promise<void> {
    await this.emailField.fill(username);
    await this.passwordField.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL(isHomeUrl, { timeout: 30_000 });
  }

  async failLogin(): Promise<void> {
    await this.emailField.fill('mbt-poc-invalid@example.com');
    await this.passwordField.fill('definitely-wrong-password');
    await this.loginButton.click();
    await expect(this.errorMessage).toBeVisible({ timeout: 30_000 });
  }
}
