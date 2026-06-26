import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';

export function createStubActions(): ActionMap {
  return {
    GO_LOGIN: async ({ log }) => {
      log('GO_LOGIN → navigate to login');
    },
    SUBMIT: async ({ log }) => {
      log('SUBMIT → submit login form');
    },
    FAIL: async ({ log }) => {
      log('FAIL → simulate login failure');
    },
    LOGOUT: async ({ log }) => {
      log('LOGOUT → sign out');
    },
  };
}

export function createLoggingContext(
  page: import('@playwright/test').Page,
): MbtContext {
  return {
    page,
    log: (message: string) => {
      console.log(`[mbt] ${message}`);
    },
  };
}
