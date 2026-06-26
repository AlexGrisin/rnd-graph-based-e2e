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
  /** @xstate-layout N4IgpgJg5mDOIC5RgB4EMC2AHANmAgllgHQAWA9hmAMQDiA8gPoAy9tAkgHIDaADALqJQWcrACWAFzHkAdkJApEARgAsS4ryUBWAGwAmLQA5DAZiW89ATh0AaEAE9Ex4jtc6lAdl4qtW3r8sAX0C7VExcAiJiHHIoMRlqAGUAVQAhAFl2ABU+QSQQEXEpWXlFBBMvYnNLE0MtDy0TSxUdLTtHBCUTPWIPFUtLet5rS1NVYND0bDxCEhi4hIAxfHZmXPlCyWk5fLKK3irh2vrG5tb2px69fsGTFW93D08J8CmI2eIINFhSACNyNAAJwg1FYDGSOQEG1EWxKu0Q+0ONTqDSaLTaDkQeisxG6hl4hhqKkMPl4-mCIRAMnIEDg8jC00iWGhRW2pUQAFpbJiEFyXgz3lEKFQWbCdqAyio9BcEJYPMRrgMjHoPK0PKZDPy3jMovN4qLiuKFFjDOolJ4lJZeB49KYiTLCVU3CqRhYTGYteEdSQvj9-kCIAa2fCEP0tMRRiomv47ko9NoZUp3MRDDaTPodNbMzofJ7GR8wIDAeRAUG4RLEGGIyTo401PGMR1TcQ-GSCd41KnfBTAkA */
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
