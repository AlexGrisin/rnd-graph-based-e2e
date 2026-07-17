import type { Page } from '@playwright/test';

/** Dismiss OneTrust, push prompts, and Exponea modals that block interactions. */
export async function dismissAppOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('onetrust-accept-btn-handler')?.click();
    document.querySelector('#onetrust-consent-sdk')?.remove();
    document.querySelector('.onetrust-pc-dark-filter')?.remove();
    (
      document.querySelector(
        '.requestPushNotifications__rejectButton',
      ) as HTMLElement | null
    )?.click();
    document.querySelector('.requestPushNotifications')?.remove();
    document
      .querySelectorAll(
        '.exponea-subscription-dialog-overlay, .exponea-entrance-modal, [class*="exponea-subscription"]',
      )
      .forEach((el) => el.remove());
  });
}
