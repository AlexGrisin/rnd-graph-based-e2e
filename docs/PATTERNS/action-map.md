Reusable action-map pattern for MBT browser adapters in this workspace.

## Name

MBT Action Map

## Description

Maps machine event ids onto asynchronous handlers that drive page objects or stub logging. Action maps live in `tests/support/actions/` and are the only place where MBT events are translated into browser-side behavior.

Use when:

- Wiring a machine event to a Playwright page-object method
- Adding live-project actions for a new journey
- Adding or extending the stub project so graph traversal can run without a browser

Do not import page objects into `src/`; keep event execution adapters in `tests/support/actions/`.

## Conventions

- Export a `create*Actions(...): ActionMap` factory.
- Return an object keyed by exact machine event names.
- Keep each handler async, log the event first, then delegate to page fixtures or stub behavior.
- Accept `PageFixtures` for live actions and no fixtures for pure stub actions.
- Pull runtime config inside the handler that needs it, not at module load.
- Merge journey-specific action maps in `tests/fixtures.ts`.

## Template

```typescript
import type { ActionMap, MbtContext } from '../../../src/mbt/types.js';
import type { PageFixtures } from '../pages/page-fixtures.js';

export function createExampleActions(pages: PageFixtures): ActionMap {
  return {
    OPEN_DETAIL: async (ctx: MbtContext) => {
      ctx.log('OPEN_DETAIL');
      await pages.homePage.openDetail();
    },
    CONFIRM: async (ctx: MbtContext) => {
      ctx.log('CONFIRM');
      await pages.detailPage.confirm();
    },
  };
}
```

## Stub variant

For non-browser runs, keep the same event keys and log-only semantics:

```typescript
export function createStubActions(): ActionMap {
  return {
    OPEN_DETAIL: async ({ log }) => {
      log('OPEN_DETAIL -> navigate to detail');
    },
    CONFIRM: async ({ log }) => {
      log('CONFIRM -> complete the journey');
    },
  };
}
```

## Reference implementations

- `tests/support/actions/app-auth.actions.ts` - event handlers for auth states with credentials lookup inside `SUBMIT`
- `tests/support/actions/app-purchase.actions.ts` - purchase flow handlers delegated to `pdpPage`, `cartPage`, and `checkoutPage`
- `tests/support/actions/stub-actions.ts` - browser-free log-only implementation with the same event-key contract
- `tests/fixtures.ts` - merges `createAppAuthActions(...)` and `createAppPurchaseActions(...)` for live runs
