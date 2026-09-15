import { assign, setup } from 'xstate';

export type AppShoppingContext = {
  hasFavorite: boolean;
  hasItemInCart: boolean;
};

export type AppShoppingEvent =
  | { type: 'SEARCH_QUERY' }
  | { type: 'BROWSE_CATEGORY' }
  | { type: 'OPEN_PDP' }
  | { type: 'GO_HOME' }
  | { type: 'GO_FAVORITES' }
  | { type: 'ADD_TO_CART' }
  | { type: 'GO_CART' }
  | { type: 'GO_CHECKOUT' }
  | { type: 'ADD_TO_FAVORITES' };

export const appShoppingMachine = setup({
  types: {
    context: {} as AppShoppingContext,
    events: {} as AppShoppingEvent,
  },
  guards: {
    hasFavoritedItem: ({ context }) => context.hasFavorite,
    hasItemInCart: ({ context }) => context.hasItemInCart,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqDKALA9uglgHZQB0uAtmAMQBCASgPIDqGAogPoDCAggCqsBxBnQCaAbQAMAXUShUOWPgAu+HIVkgAHogDsADgDMJPQE49AFgBMZnRIBsEgKyOANCACeiAxZKOAvn5uaJi4BMRkOJRUbNx0nAAS7ACKAKqsopIySCDyiipqGtoI+kamFtZ6tg7Obp4IAIx6lr4BQejYeKhEpBTUQuwAYtwAasIAkvwYmRq5yqrq2UUlxmZWNvZOrh6IloYtgSDBHWGksGDIAE4AxlhU-fEMALKs09mz+QugRXp2zToG5gMdn+VU2tUQ9QMllah3aoS64TOlxuVAYAAVWAA5dhogAiaNecgUcwKi0QekcehIBlWFVBNW2CD09X2bRCnW6JCuyCUYCgOAu7juDHYD2ehJyxI+hXJvxI-0BwIM9K2dQMAJhR3hnO5vP5gtRGOxeIJ0hmUvmMqZlOptPW1VViDsQN8jgMjh09SsFM95k1cI54VQEFQwtFTxeZreFtJXwh5gkvnBCAB5ld7t9uw9Xr9By1gdIwdD3FxuPYvBFPDovAl70tZIaCaTjPMnvllgklm8EhMji7zIM-vZJxIRaoJbLFcGI3Gk1rMc+WnjicdCEsXeMEgzXqzmaHxwRpAAZsgAG4C5RwbgQCCQMNiyNZIl5etxhCOep2akfxy-Vfr0ot2zb1gOhPMAxHE9zwuS9YAAGXwWAlHvCN5xfWMlyZOUFSBEENgZOou0HcDh0PEgACNkCga9bwgFDxSjZ8SUXIoPy-d16l-SxV3MOxHGpIDMx9HN921cJKOom8736Ksa0YyV0JYxA2O-Ti-2TH9N23EDfVEgsuUuZCZPiVhOAAaQYFI5KfBTmKtZYyjWSp8NXTS9EEndhNzA5CBwW94GyfMTnNRSrQAWjsZMIr0kdehCuyGzsOw03XPj1MZLt+PqfRQK8sC2QPTkkWuLB4ulBt6gkSqSAcExcOVFzkxMZpKn8EjCvCXU+QFOomPKt9Kuq2r6pVZMAX45U2oKsTCxDMrX0wqwxvMfinG03cRPamaSCgi9eVgGjIHmjCindRNPR7Sbk3XNMDA8nSdxisjdpg-aEKQ46lIaKrE2GpVRoy8wWUpdVQbB9V6iezkJMOiBPqtZUjG4-RsspX5nWTVtmnXTtu17ftIShzrDPhxK7BMYx6kscwTDsRo3U7HQNM-AT1q8onSBuMArgAaxwABXJRSYGn6asu-7GsZTS1ty4CAgCIA */
  id: 'appShopping',
  initial: 'home',
  context: { hasFavorite: false, hasItemInCart: false },
  states: {
    home: {
      on: {
        BROWSE_CATEGORY: 'category',
        SEARCH_QUERY: 'search',
        GO_FAVORITES: 'favoritesList',
        GO_CART: {
          target: 'cart',
          guard: 'hasItemInCart',
        },
      },
    },
    search: {
      on: {
        GO_HOME: 'home',
        OPEN_PDP: 'pdp',
      },
    },
    category: {
      on: {
        GO_HOME: 'home',
        OPEN_PDP: 'pdp',
      },
    },
    pdp: {
      on: {
        GO_HOME: 'home',
        ADD_TO_CART: {
          target: 'bagAdded',
          actions: assign({ hasItemInCart: true }),
        },
        ADD_TO_FAVORITES: {
          target: 'favoritesAdded',
          actions: assign({ hasFavorite: true }),
        },
      },
    },
    favoritesAdded: {
      on: {
        GO_FAVORITES: 'favoritesList',
      },
    },
    favoritesList: {
      on: {
        GO_HOME: 'home',
        OPEN_PDP: {
          target: 'pdp',
          guard: 'hasFavoritedItem',
        },
      },
    },
    bagAdded: {
      on: {
        GO_CART: 'cart',
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

export type AppShoppingStateValue =
  | 'home'
  | 'category'
  | 'search'
  | 'pdp'
  | 'favoritesAdded'
  | 'favoritesList'
  | 'bagAdded'
  | 'cart'
  | 'checkout';

export function getShoppingStateValue(state: unknown): AppShoppingStateValue {
  const value = (state as { value: AppShoppingStateValue }).value;
  return value;
}
