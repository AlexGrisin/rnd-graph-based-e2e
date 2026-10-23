import { assign, setup } from 'xstate';

export type AppAuthContext = {
  username: string;
};

export type AppAuthEvent =
  | { type: 'GO_LOGIN' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_WITHOUT_CREDENTIALS' }
  | { type: 'FAIL' }
  | { type: 'GO_MY_ACCOUNT' }
  | { type: 'LOGOUT' };

export const appAuthMachine = setup({
  types: {
    context: {} as AppAuthContext,
    events: {} as AppAuthEvent,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqCCBXALgCwDo8B7AWzAGIBxAeQH0AZGqgSQDkBtABgF1FRUxWAEscw4gDt+IAB6IAjABZ5BAGwB2eQA51AVgA0IAJ6IATAGYV5gJznTp+bvPrTL+eYC+Hw2ky5CADbEUMISFADKAKoAQgCyLAAq3HxIIIIiYpLScgjmqtYE6qq6qqYGxmZcpgRlXj7o2PgEQSFhAGIYLAzJ0umi4lKpOXkFRSVlhiYIptZaNVyWXNbqyg5LinUgvo2EJOQ71PSxAJp0GADC5zSRbEm8vUL9WUOIpVyF2nqTZqaKBMvFXSKHRcVRcIHqTbbfwEUhGDAAYwRxCwEhwFCYtEidxSAkemUGoBy+T+C3kpi04PkenUWnk3wQdIIui83hAEmIEDg0mh+AeGQG2UQAFpVAzRVCGjC9mB+U9CbJEIpTAydMytOZNVrtZrJX4mi1QnKCULppSatZVDpylMLCotLZ7I5nK4HJ42bzdmQwDtjYKXghFNZ3rNFM4bT9dARFGMgSCwRC9TtYfCkSi0X7nkTEFpTO9dLTHLpdNSC3SGcGCFwNTra0mYWAAE6N4iNzMKnJBkNaMNfCrTZbRpzrYG-BzWVkeIA */
  id: 'appAuth',
  initial: 'home',
  context: {
    username: '',
  },
  states: {
    home: {
      on: {
        GO_LOGIN: 'login',
      },
    },
    login: {
      on: {
        SUBMIT: {
          target: 'homeAuth',
          actions: assign({ username: 'demo-user' }),
        },
        SUBMIT_WITHOUT_CREDENTIALS: 'credentialsRequired',
        FAIL: 'error',
      },
    },
    credentialsRequired: {},
    // Beaverbrooks redirects to home (signed in) after login; "My account" nav opens myAccount.
    homeAuth: {
      on: {
        GO_MY_ACCOUNT: 'myAccount',
      },
    },
    myAccount: {
      on: {
        LOGOUT: 'home',
      },
    },
    error: {
      type: 'final',
    },
  },
});

export type AppAuthStateValue =
  | 'home'
  | 'login'
  | 'credentialsRequired'
  | 'homeAuth'
  | 'myAccount'
  | 'error';

export function getStateValue(state: unknown): AppAuthStateValue {
  const value = (state as { value: AppAuthStateValue }).value;
  return value;
}
