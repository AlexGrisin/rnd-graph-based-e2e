import { setup } from 'xstate';

export type AppShoppingContext = { page: number };

export type AppShoppingEvent =
  | { type: 'SEARCH_QUERY' }
  | { type: 'BROWSE_CATEGORY' }
  | { type: 'OPEN_PDP' }
  | { type: 'GO_HOME' }
  | { type: 'ADD_TO_CART' }
  | { type: 'GO_CHECKOUT' }
  | { type: 'ADD_TO_FAVORITES' }
  | { type: 'GO_TO_PAGE'; value: number };

export const appShoppingMachine = setup({
  types: {
    context: {} as AppShoppingContext,
    events: {} as AppShoppingEvent,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqAKBXATgYwAtlYwA6AgewFswBiAIQCUB5AdQGUBRAfQGEBBACqcA4s0YBNANoAGALqJQqCrACWAF1UUAdopAAPRAEYAbEdImA7EYAclgEwmArPYCcNo64A0IAJ6IAZksA0icZcJkAgJtw11cAFgBfRJ80TFxCYjJKGloufkZeAAluAEUAVU5JWQUkEGU1TR09QwRTcytbB2c3D28-RHjLeNJ4uNcotwD7GXinZNT0bHwiElISZBXaMW4i5gBZThq9Bo0tXTrW+3iZUJlLDxM4yydXSxN7H38EePsQ8dcJhsURMzk8AQWIDSy0yaw2W2YGE4ADluBgACIYY51U5NC6gVpjSyhP5DJ5vZxRL6DaakGTA+xOIFAmTOeYpKFLDKrMh4ZDqMBQCg4XzbZi7A5HeQnFRnZqXRDXW5hB6mZ6vd6fAYIab2UgAuLxD4zUyQ6HcrKkPkCoUi2iIlFozHYpSyvEtQZvEkBMnPSkBak6gLmelRe5DX52GxmrkrS2oCCoMUSw4u+pu84ehBhcw2V43aw2Nyuew2QMzPXXcYvSKM+yWGPpONrBNJ-jo9HcQTigSMQRp3GZhUIYIhUlBSwJB5BIzlpw2Ubz4N-JwBFxJDnm5tkVu0dud7vcABi-AAauIAJLCdgDjPygmIUekceWSdDYHWcv3fVLoYBQFvEYUSNjCPKkAAZsgABuwoaHAyZ7Km0o4ne+IGIgMROKEli1sG8Q2IC8SBh4dwRC4NhGjcRhGCBFprHyODqMmxScLwADSzDlP2yGuo0Q4Pm0rLmPYjjrvE1E3Ncc4LnMwJGCua7XMkHLaBQEBwHoW6wmAMp8fe6EIAAtCYgbGXSEQWZZ9y0du5DUDpKF6WhhJat8uqkNMRiRsGPrRpusbaesYCbIQulys5gRFnSjgyK8Hjgh8TiBvEtJLm485uOJrIbosTaBdagrCt8vHhVmQQLtEpb1nFVgmPERHalE5hLj6dVriY0yAjZgWtmF7rDnVrikMEKXuAEkT-q4s7avYXmkHYYT0iJ40dXM3VgZBME4HB8COaVw4JCE9Wrl5jgTDhrmIK4tyhsGzgpWEYT2OtloMeofX8QZrjznSeYlt9timA40k-kWo4lkYDzDC99EEGAeAANYUFg717f1AnyUEFjfSJXkUSWZYzU4xI4WDbL-rY33KYkQA */
  id: 'appShopping',
  initial: 'home',
  context: { page: 0 },
  states: {
    home: {
      on: {
        BROWSE_CATEGORY: 'category',
        SEARCH_QUERY: 'search',
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
        ADD_TO_CART: 'cart',
        ADD_TO_FAVORITES: 'favorites', // stay in pdp
      },
    },
    favorites: {
      on: {
        GO_HOME: 'home',
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

export type AppShoppingStateValue = 'home' | 'pdp' | 'cart' | 'checkout';

export function getShoppingStateValue(state: unknown): AppShoppingStateValue {
  const value = (state as { value: AppShoppingStateValue }).value;
  return value;
}
