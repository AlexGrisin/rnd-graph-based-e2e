import type { Page } from '@playwright/test';

/** Dismiss the Cookiebot consent dialog that blocks interactions. */
export async function dismissAppOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      document.getElementById(
        'CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      ) as HTMLElement | null
    )?.click();
    document.getElementById('CybotCookiebotDialog')?.remove();
    document.getElementById('CybotCookiebotDialogBodyUnderlay')?.remove();
  });
}
