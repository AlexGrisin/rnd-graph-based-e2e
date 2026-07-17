Technical architecture for the Playwright + XState MBT POC.

## Stack

- TypeScript, Node.js 20+
- Playwright Test (`@playwright/test`)
- XState v5 with `xstate/graph` utilities

## Layering

```
src/machines/     → Pure XState (no Playwright imports)
src/mbt/          → Path generation, test model, MBT runner
tests/support/    → Page objects and event→action adapters
tests/mbt/        → Playwright spec files
```

## Key components

### Auth model (`app-auth.machine.ts`)

States: `home → login → myAccount → error` (`error` is a `final` state). Events: `GO_LOGIN`, `SUBMIT`, `FAIL`, `LOGOUT`.

### Purchase model (`app-purchase.machine.ts`)

States: `home → pdp → cart → checkout` (`checkout` is a `final` state). Events: `OPEN_PDP`, `ADD_TO_CART`, `GO_CHECKOUT`. MVP opens a fixed PDP via `PRODUCT_PATH` (no search/catalog UI).

### Graph layer (`src/mbt/graph/`)

- `getShortestPaths` — one minimal path per reachable state
- `getAdjacencyMap` — full transition graph
- `testPath` — executes a path using injected action map

### Walk strategy (`walk-strategy.machine.ts`)

Orchestrates sequential path execution; tracks `pathIndex` and `visitedStates`.

### MBT runner (`mbt-runner.ts`)

- `runShortestPaths()` — direct path execution
- `runWithStrategy()` — strategy machine-driven execution

## Testing architecture

Playwright fixtures expose action maps (auth + purchase merged), and one fixture per page object (`homePage`, `loginPage`, `myAccountPage`, `pdpPage`, `cartPage`, `checkoutPage`). Specs remain thin orchestration layers:

- `graph-driven.spec.ts` — auth machine paths
- `purchase-graph-driven.spec.ts` — purchase machine paths

## Non-functional

- Headless by default, trace on first retry
- Single worker (MBT paths are sequential)
- `baseURL` configurable via env; `PRODUCT_PATH` for purchase PDP
