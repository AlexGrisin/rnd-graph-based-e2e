import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';

export function createStubActions(): ActionMap {
  return {
    GO_LOGIN: async ({ log }) => {
      log('GO_LOGIN → navigate to login');
    },
    SUBMIT: async ({ log }) => {
      log('SUBMIT → submit login form');
    },
    SUBMIT_WITHOUT_CREDENTIALS: async ({ log }) => {
      log('SUBMIT_WITHOUT_CREDENTIALS → submit empty login form');
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
    GO_FAVORITES: async ({ log }) => {
      log('GO_FAVORITES → open favorites list');
    },
    ADD_TO_FAVORITES: async ({ log }) => {
      log('ADD_TO_FAVORITES → add to favorites');
    },
    ADD_TO_CART: async ({ log }) => {
      log('ADD_TO_CART → select size and add to bag');
    },
    GO_CART: async ({ log }) => {
      log('GO_CART → view bag');
    },
    GO_CHECKOUT: async ({ log }) => {
      log('GO_CHECKOUT → proceed to checkout (no payment)');
    },
    OPEN_STORE_LOCATOR: async ({ log }) => {
      log('OPEN_STORE_LOCATOR → open store locator from header');
    },
    SUBMIT_EMPTY_STORE_SEARCH: async ({ log }) => {
      log('SUBMIT_EMPTY_STORE_SEARCH → submit store search with empty field');
    },
    SEARCH_STORES_BY_CITY: async ({ log }) => {
      log('SEARCH_STORES_BY_CITY → search stores by city');
    },
    SEARCH_STORES_BY_POSTCODE: async ({ log }) => {
      log('SEARCH_STORES_BY_POSTCODE → search stores by postcode');
    },
    SEARCH_STORES_NO_MATCH: async ({ log }) => {
      log(
        'SEARCH_STORES_NO_MATCH → search city with a brand that has no store',
      );
    },
    SHOW_ALL_STORE_RESULTS: async ({ log }) => {
      log('SHOW_ALL_STORE_RESULTS → expand store results list');
    },
    BROWSE_STORE_REGION: async ({ log }) => {
      log('BROWSE_STORE_REGION → browse stores by region');
    },
    SELECT_STORE_ON_MAP: async ({ log }) => {
      log('SELECT_STORE_ON_MAP → select a store marker on the map');
    },
    OPEN_STORE_DETAILS: async ({ log }) => {
      log('OPEN_STORE_DETAILS → open full store details');
    },
    BACK_TO_STORE_RESULTS: async ({ log }) => {
      log('BACK_TO_STORE_RESULTS → back to search results');
    },
    BACK_TO_STORE_REGION: async ({ log }) => {
      log('BACK_TO_STORE_REGION → back to region store list');
    },
    BACK_TO_STORE_LOCATOR: async ({ log }) => {
      log('BACK_TO_STORE_LOCATOR → back to store locator');
    },
    BACK_TO_STORE_FINDER: async ({ log }) => {
      log('BACK_TO_STORE_FINDER → back to store finder from region page');
    },
  };
}

export function createLoggingContext(
  page: import('@playwright/test').Page,
): MbtContext {
  return {
    page,
    log: (message: string) => {
      console.log(message);
    },
  };
}
