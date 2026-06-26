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

### Application model (`app-auth.machine.ts`)

States: `home → login → myAccount → error` (`error` is a `final` state). Events: `GO_LOGIN`, `SUBMIT`, `FAIL`, `LOGOUT`.

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

Playwright fixtures expose `mbtRunner`, action maps, and one fixture per page object (`homePage`, `loginPage`, `myAccountPage`). Specs remain thin orchestration layers.

## Non-functional

- Headless by default, trace on first retry
- Single worker (MBT paths are sequential)
- `baseURL` configurable via env
