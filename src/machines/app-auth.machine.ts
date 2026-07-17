import { assign, setup } from 'xstate';

export type AppAuthContext = {
  username: string;
};

export type AppAuthEvent =
  | { type: 'GO_LOGIN' }
  | { type: 'SUBMIT' }
  | { type: 'FAIL' }
  | { type: 'LOGOUT' };

export const appAuthMachine = setup({
  types: {
    context: {} as AppAuthContext,
    events: {} as AppAuthEvent,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqCCBXALgCwDo8B7AWzAGIBxAeQH0AZGqgSQDkBtABgF1FRUxWAEscw4gDt+IAB6IAtAEYAzFwIAWAGzaArJoAcWzQCYAnOuUAaEAE9Ei42sP79yxQcWe9AX2-W0mLiEADbEUMISFADKAKoAQgCyLAAq3HxIIIIiYpLScgjyOvoEpvrGxvqKhtpmFurWdgjlAOwapsrKJu2eij5+IAHY+ASh4ZEAYhgsDGnSWaLiUhn5ys2tXJrqOt06Hc1cOvW2iKumBJrNqjpcFj19-uhDhKQ2GADGb8RYEjgUTLQxVK8OZCBa5ZaIMw6AjKHTNPSKUxcPYHI6NDpqLjNdpcG5uLyaXz9CTECBwaSDIIg7KLPIKRTNYpGTR6apdCwNE7KGHqFxuDwE3wPQLDEjkalgpagfI6RQaBzGdTmZGrA7aTkIKrFbSmRTqdRVO6E-qU4ajCISnJS2QnTQELi69qaJEovSaDXqcoENb6WW6yqCk2PIIEF7vT7fHCW2kQhBKgiVLY7V3q44IZTqdZcTzw26B4VPAhgABOxeIxej4OliHjie2bl2qrdHsqBGuOcO+N6xt8QA */
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
          target: 'myAccount',
          actions: assign({ username: 'demo-user' }),
        },
        FAIL: 'error',
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

export type AppAuthStateValue = 'home' | 'login' | 'myAccount' | 'error';

export function getStateValue(state: unknown): AppAuthStateValue {
  const value = (state as { value: AppAuthStateValue }).value;
  return value;
}
