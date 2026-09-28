import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';
import { getAppCredentials } from '../config/app-credentials.js';
import type { PageFixtures } from '../pages/page-fixtures.js';

export function createAppAuthActions(pages: PageFixtures): ActionMap {
  return {
    GO_LOGIN: async (ctx: MbtContext) => {
      await pages.homePage.openLogin();
    },
    SUBMIT: async (ctx: MbtContext) => {
      const credentials = getAppCredentials();
      await pages.loginPage.submit(credentials.email, credentials.password);
    },
    SUBMIT_WITHOUT_CREDENTIALS: async (ctx: MbtContext) => {
      await pages.loginPage.submitWithoutCredentials();
    },
    FAIL: async (ctx: MbtContext) => {
      await pages.loginPage.failLogin();
    },
    GO_MY_ACCOUNT: async (ctx: MbtContext) => {
      await pages.homePage.openMyAccount();
    },
    LOGOUT: async (ctx: MbtContext) => {
      await pages.myAccountPage.logout();
    },
  };
}
