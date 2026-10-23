import { assign, setup } from 'xstate';

export type StoreDetailsOrigin = 'results' | 'region' | 'map' | null;

export type AppStoreLookupContext = {
  /** Where the store details page was opened from — decides where its back link leads. */
  detailsOrigin: StoreDetailsOrigin;
};

export type AppStoreLookupEvent =
  | { type: 'OPEN_STORE_LOCATOR' }
  | { type: 'SUBMIT_EMPTY_STORE_SEARCH' }
  | { type: 'SEARCH_STORES_BY_CITY' }
  | { type: 'SEARCH_STORES_BY_POSTCODE' }
  | { type: 'SEARCH_STORES_NO_MATCH' }
  | { type: 'SHOW_ALL_STORE_RESULTS' }
  | { type: 'BROWSE_STORE_REGION' }
  | { type: 'SELECT_STORE_ON_MAP' }
  | { type: 'OPEN_STORE_DETAILS' }
  | { type: 'BACK_TO_STORE_RESULTS' }
  | { type: 'BACK_TO_STORE_REGION' }
  | { type: 'BACK_TO_STORE_LOCATOR' }
  | { type: 'BACK_TO_STORE_FINDER' };

export const appStoreLookupMachine = setup({
  types: {
    context: {} as AppStoreLookupContext,
    events: {} as AppStoreLookupEvent,
  },
  guards: {
    openedFromResults: ({ context }) => context.detailsOrigin === 'results',
    openedFromRegion: ({ context }) => context.detailsOrigin === 'region',
    openedFromMap: ({ context }) => context.detailsOrigin === 'map',
  },
  actions: {
    markOpenedFromResults: assign({ detailsOrigin: 'results' }),
    markOpenedFromRegion: assign({ detailsOrigin: 'region' }),
    markOpenedFromMap: assign({ detailsOrigin: 'map' }),
    clearDetailsOrigin: assign({ detailsOrigin: null }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEMAOqDKAXA9gJzABkccBrAV1QDoALHAWzAGIB5ABQFEA5AfQwBUWAJQ49CLAMIBBQUIDaABgC6iUKhywAllk04AdqpAAPRAEYAzADYqlgOymAHPdMBWBe5eXTAGhABPRFt7KgAWBQAmcwBOL0solydTAF8k3zRMXAJiMkoqWEyiHABjZEymDABVACEAWQBJfh4OGrZ+AE0+WVEMDikhCQAJRRUkEHUtHX1DEwQXWwdQqPDwz1MomIUHEN8AhHMQlyoo20tLc3CokP2Hc3NbFLT0bHxCnOp8l+ISsp6+wc7hBwMDwqh0JA02sNDONtLoDKMZnMFiElisvOtLJttv5EMtDstTq4FOZTGF4i4HiB0s8siQKO8Cl9Svhyr1+gMASJgVwWDwajJBlDRjDJvDQIj5os8eiNlsdogQuFrK51nMoqZ5iEHA5KdTGXTch9ad8WVUhCwAOo9TmiEQAcTqLC4QrUGlhUwRiCRUrRa1l2N2liuVCs5gUJwU6ws4d1T31bzy+pNeFZhA4EkaAkBPCdfKkbBdYzdoumXslKOlfsxcpxCHmtiom2OSyWa1cOtSVLjnwNDJeGDAyDwRRodT0ADdkAAbTQQVl-DlZrkgjpsFgCCQsAAiHELIrhpYQpnD5hsWss4TCLhcSzm8r2ByOJzOFyuWtu907ep7CaNYCEcDkFOWCwPO7I2sCoI8GuG7bruyjQsWB6ekedwLMSUS3B4YZuAGuLxCGSouPsERBvMCghLGGQ-vSiYvABsBASB5QDJaPBSIQhA2jwXIVIQ-AYHuSEeuKZjRIcx6OJYngXBq5guPel4hFQDhKiiqkRFh5hUTSry0X+DFMaB7DcNxO78FIdSEIJCHCsJYrGGYliqaEYbEpibgagcilWKEDgKBqpxuO4dzaV+3a0r+BRcDghnAaBvzgUuQIrjw4LtEJEzIaJR7hgsQYOBeV43istj3oqyo3vEtjqpq2o6fG+kFABUBwqwnC8MlPDmZZ1mZe6DkzMekoFUVCjXreZW1iEJw2DehUYaSLiOJR4XUZFTX0WArX6EwVRSBIADSPCCNxABidRcDu8i2a6WUiY5CBnIcCSYisyxRNqpL3iVKlnHJF7XuEQQNTRhoFDUaADlOYBFKK7WmV1PVWTZIx3QNh5LdYmFBP540XvE4T3icymmBYyy2FYXmXKDG3gy8W5gFgyCaFOoH7UdJ28l1vH8ajiH3YNTkuVcIUeQFtjebWtzhEctz7PJlxaiEyRrbp2SbQQjPM6z7MHcdp08xwDpOv1JYoaYcTKcRlzSacz52PeF4KCGhXLeN5gODEVy03p9Na0zLNs3t+tc9x4jSLIZvZY9lsEbcZzOS4kQUZY94OKYVDBcSrg3nH5wpJ2eg4BAcCGN+dOoALGMoQAtGnta14c6wt63rc1b7Gu5HQjDV+bOWKsTwRRJpMRxwkn6POtft9sazJ4H3MczHc1ghAc5xuGqYTmEPmcj5EY9xBPne9nRBADkOI5jpOM4QIvD0zNqpPxCr8Sqcckv3vsq8nJ4F7OeEMmJ8opbUYvFe+QsjwHAbHEF+uESTyS-m4FSRE4gODcIDSmwDNZgBinFECEDDxe1PCcb2IQ7bSROOVJUc1PrqkvKVIMlhsH+3-NtGO+4H6IBHocAqcx5hzBklEJ2nsqDA0+sSGaxIBEsNnmASGmAwAwzhhw+ymNowhisOEE8Sp1R4TrE4LOXsaoXEAeqOYsiz5gG1kHeAdlBaHkAaSMRGdYEj1FrYBS01PqhDVFJaIBxSSFySEAA */
  id: 'appStoreLookup',
  initial: 'home',
  context: { detailsOrigin: null },
  states: {
    home: {
      on: {
        OPEN_STORE_LOCATOR: 'storeLocator',
      },
    },
    storeLocator: {
      on: {
        SUBMIT_EMPTY_STORE_SEARCH: 'storeSearchInvalid',
        SEARCH_STORES_BY_CITY: 'storeResults',
        SEARCH_STORES_NO_MATCH: 'storeNoResults',
        BROWSE_STORE_REGION: 'storeRegion',
        SELECT_STORE_ON_MAP: 'storeMapSelection',
      },
    },
    storeSearchInvalid: {
      on: {
        SEARCH_STORES_BY_POSTCODE: 'storeResults',
      },
    },
    storeResults: {
      on: {
        SEARCH_STORES_BY_POSTCODE: 'storeResults',
        SHOW_ALL_STORE_RESULTS: 'storeResults',
        OPEN_STORE_DETAILS: {
          target: 'storeDetails',
          actions: 'markOpenedFromResults',
        },
      },
    },
    storeNoResults: {
      on: {
        SEARCH_STORES_BY_CITY: 'storeResults',
      },
    },
    storeRegion: {
      on: {
        OPEN_STORE_DETAILS: {
          target: 'storeDetails',
          actions: 'markOpenedFromRegion',
        },
        BACK_TO_STORE_FINDER: 'storeLocator',
      },
    },
    storeMapSelection: {
      on: {
        OPEN_STORE_DETAILS: {
          target: 'storeDetails',
          actions: 'markOpenedFromMap',
        },
      },
    },
    storeDetails: {
      on: {
        BACK_TO_STORE_RESULTS: {
          target: 'storeResults',
          guard: 'openedFromResults',
          actions: 'clearDetailsOrigin',
        },
        BACK_TO_STORE_REGION: {
          target: 'storeRegion',
          guard: 'openedFromRegion',
          actions: 'clearDetailsOrigin',
        },
        BACK_TO_STORE_LOCATOR: {
          target: 'storeLocator',
          guard: 'openedFromMap',
          actions: 'clearDetailsOrigin',
        },
      },
    },
  },
});

export type AppStoreLookupStateValue =
  | 'home'
  | 'storeLocator'
  | 'storeSearchInvalid'
  | 'storeResults'
  | 'storeNoResults'
  | 'storeRegion'
  | 'storeMapSelection'
  | 'storeDetails';

export function getStoreLookupStateValue(
  state: unknown,
): AppStoreLookupStateValue {
  return (state as { value: AppStoreLookupStateValue }).value;
}
