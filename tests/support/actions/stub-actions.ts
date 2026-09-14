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
    GO_MY_ACCOUNT: async ({ log }) => {
      log('GO_MY_ACCOUNT → open my account');
    },
    LOGOUT: async ({ log }) => {
      log('LOGOUT → sign out');
    },
    BROWSE_CATEGORY: async ({ log }) => {
      log('BROWSE_CATEGORY → browse product category');
    },
    SEARCH_QUERY: async ({ log }) => {
      log('SEARCH_QUERY → search for query');
    },
    OPEN_PDP: async ({ log }) => {
      log('OPEN_PDP → open product detail page');
    },
    GO_HOME: async ({ log }) => {
      log('GO_HOME → go home');
    },
    GO_TO_PAGE: async ({ log }) => {
      log('GO_TO_PAGE → go to page');
    },
    ADD_TO_FAVORITES: async ({ log }) => {
      log('ADD_TO_FAVORITES → add to favorites');
    },
    ADD_TO_CART: async ({ log }) => {
      log('ADD_TO_CART → select size and add to bag');
    },
    GO_CHECKOUT: async ({ log }) => {
      log('GO_CHECKOUT → proceed to checkout (no payment)');
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
