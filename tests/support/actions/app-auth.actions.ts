import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';
import { getAppCredentials } from '../config/app-credentials.js';
import type { PageFixtures } from '../pages/page-fixtures.js';

export function createAppAuthActions(pages: PageFixtures): ActionMap {
  return {
    GO_LOGIN: async (ctx: MbtContext) => {
      ctx.log('GO_LOGIN');
      await pages.homePage.openLogin();
    },
    SUBMIT: async (ctx: MbtContext) => {
      ctx.log('SUBMIT');
      const credentials = getAppCredentials();
      await pages.loginPage.submit(credentials.email, credentials.password);
    },
    FAIL: async (ctx: MbtContext) => {
      ctx.log('FAIL');
      await pages.loginPage.failLogin();
    },
    LOGOUT: async (ctx: MbtContext) => {
      ctx.log('LOGOUT');
      await pages.myAccountPage.logout();
    },
  };
}
