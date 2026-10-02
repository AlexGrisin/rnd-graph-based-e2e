import type { TestInfo } from '@playwright/test';

export async function safelyAttachImage(
  testInfo: TestInfo,
  name: string,
  image: Buffer,
) {
  try {
    await testInfo.attach(name, {
      body: image,
      contentType: 'image/png',
    });
  } catch {
    // Attachments supplement, rather than determine, test outcomes.
  }
}

export async function safelyAttachText(
  testInfo: TestInfo,
  name: string,
  body: string,
) {
  try {
    await testInfo.attach(name, {
      body,
      contentType: 'text/markdown',
    });
  } catch {
    // Attachments supplement, rather than determine, test outcomes.
  }
}

export async function safelyAttachJson(
  testInfo: TestInfo,
  name: string,
  value: unknown,
) {
  try {
    const body = JSON.stringify(value);
    if (!body) {
      return;
    }

    await testInfo.attach(name, {
      body,
      contentType: 'application/json',
    });
  } catch {
    // Attachments supplement, rather than determine, test outcomes.
  }
}
