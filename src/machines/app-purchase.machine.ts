import { setup } from 'xstate';

export type AppPurchaseContext = Record<string, never>;

export type AppPurchaseEvent =
  | { type: 'OPEN_PDP' }
  | { type: 'ADD_TO_CART' }
  | { type: 'GO_CHECKOUT' };

export const appPurchaseMachine = setup({
  types: {
    context: {} as AppPurchaseContext,
    events: {} as AppPurchaseEvent,
  },
}).createMachine({
  id: 'appPurchase',
  initial: 'home',
  context: {},
  states: {
    home: {
      on: {
        OPEN_PDP: 'pdp',
      },
    },
    pdp: {
      on: {
        ADD_TO_CART: 'cart',
      },
    },
    cart: {
      on: {
        GO_CHECKOUT: 'checkout',
      },
    },
    checkout: {
      type: 'final',
    },
  },
});

export type AppPurchaseStateValue = 'home' | 'pdp' | 'cart' | 'checkout';

export function getPurchaseStateValue(state: unknown): AppPurchaseStateValue {
  const value = (state as { value: AppPurchaseStateValue }).value;
  return value;
}
