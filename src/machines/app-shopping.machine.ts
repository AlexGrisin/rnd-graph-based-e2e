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
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqDKALA9uglgHZQB0uAtmAMQBCASgPIDqGAogPoDCAggCqsBxBnQCaAbQAMAXUShUOWPgAu+HIVkgAHogBMADh0kAbABYJpgMwBWEwEYLJk0YA0IAJ66LhgJy-vRvQkHfQkAdiMAXwjXNExcAmIyHEoqNm46TgAJdgBFAFVWUUkZJBB5RRU1DW0EfUNTcxNrOwcnVw8Ee1sSP289Wz1AnVC9bxMomPRsPFQiUgpqIXYAMW4ANWEASX4MYo1y5VV1Upq64zNLG3tHF3dECweev1CrHSCjIwlbceiQWOmEvNkosGFx0rw9qUDpVjqBTgZzo1mtc2ncEKEdN1vFYLBI9CYDB9RlYJn8pvFZolYGBkAAnADGWCoS0yDAAsqxIXIFIcqid7tiSLYJN4LLZMaEvASLO1EP0SCZeqLhf4ArZSf8KXMSNS6YyqAwAAqsABy7ENABFDVyyjyYdVEEZQqEhSKLN5MRIJFYrNjZQhRiQrHoHrYPWLFU6dBryTNtfTkEowFAcLS3MzQayOTboUcHQh3VZXcqJVKQ-6BoZFb5TI5sd5hZFfpq44kE0mU2mDcazZbrdJ9na8-yEE6XSr3Z7vb6rBXvBIgyGdH0LIELBjQjG4q3SKgIKgM+ws5yB1Ch3y4XLbC6guKTKF3uL3f6rN6SDpq9ecSYrEZo83Y0BEg9wPbgLQtdheFBHg6AhU9uQqYdL06CQCR6cwdB0D5fU+H9-VxPQSGdB4RgJH9AicLcAUpXd9yoMCIKglZ1i2HYc3PWEtEQUJHGMPQePnPodF9XwXx9Ijq0xWww2E68qK1RIADNkAAN1TZQ4G4CAIEgQ9Vg2OhtlYXZ4NtRCLy42oEQaS4WhufD8QVPwLCdKwXjGTcAO3IDlLU2kNNgAAZfBYCUQ9j3Y8zOJqQtizFUsP3LNF9AsJzfFCWwjAGbwHx-eSdxIXz1KTIKQrCo1TXNK1It5aLHWdOKPWFac-TRB4jDSnLXneT5vnyoCACNkCgLSdIgQ8YLgkoENq-NrhdfoPyMUNRmFUJ8LFTqrkGOom0mbyaJIBNaTCpYslYTgAGkGDyKbByiubfyLO8Vx-D5l1nNrVwk3wbBGNyCJ+X5CBwHT4FKFtAXu2aRwAWluDp4f6w6Fmh+0R2knwAjXfxGkCda0X8YwxiaJw7HCfFPP26jtV1BksDRpDLJsEwehxPFVtCPpvX9ecSDxB5l0lBs9B9ZH40TZNUw6Gb0eQnFvHOYMRRMYSrAGPQ526AXlxDNcN3FxIQMZiyan8Vn5z-LCcq53CNqxPxtoMQlDdIIr-JK0bIBNuqEFV-DRX5pdesCAIXldwrVOKuBgtCn38xxHx8QeOxyJMDaOt6F43hc3qfmphTSCGkbtO9s8HoxzFCLIwWMuFD9Po6UMnl+uwdpdryabbOklHjjGCW6F6-3cz4Rg2xWP1b-7JTxfOyQO+MsDAekAGscAAV178uYeQ687CDUVJXckYMoJpv1xb3HxRGfFHCiKIgA */
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
