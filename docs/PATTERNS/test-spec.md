Reusable Playwright spec pattern for graph-driven MBT tests in this workspace.

## Name

Graph-Driven MBT Spec

## Description

A thin Playwright spec that generates one test per shortest path from an XState machine. Specs live in `tests/mbt/` and contain **no locators, selectors, or browser logic** — only path iteration and fixture injection.

Use when:

- Adding coverage for a new or updated application machine
- Running all shortest paths against stub or live browser projects

Do **not** write per-journey test cases. The graph is the source of truth; specs only orchestrate `testPath()`.

## Conventions

| Rule                                          | Rationale                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Import custom `test` from `tests/fixtures.ts` | Provides `mbtContext`, `actions`, `stateVerifier`, project-aware `page` |
| Generate paths at module load                 | `getAllShortestPaths(machine)` runs once; tests register synchronously  |
| `test.describe` groups related coverage       | Shared `beforeEach` for project-specific setup                          |
| `describePath(path)` names each test          | Human-readable label: target state + event sequence                     |
| Delegate to `testPath()`                      | Engine walks steps, dispatches actions, verifies states                 |
| `beforeEach` only for cross-cutting setup     | e.g. `page.goto('/')` for live `app` project                            |
| No direct page object imports in spec         | Actions and verifier own browser glue                                   |

## Template

```typescript
// tests/mbt/<feature>-driven.spec.ts
import { appAuthMachine } from '../../src/machines/app-auth.machine.js';
import { describePath } from '../../src/mbt/graph/path-label.js';
import { getAllShortestPaths } from '../../src/mbt/graph/path-generator.js';
import { testPath } from '../../src/mbt/graph/test-model-factory.js';
import { test } from '../fixtures.js';

const paths = getAllShortestPaths(appAuthMachine);

test.describe('Auth graph-driven MBT', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Project-specific bootstrap only — keep minimal
    if (testInfo.project.name === 'app') {
      await page.goto('/');
    }
  });

  for (const path of paths) {
    test(describePath(path), async ({ mbtContext, actions, stateVerifier }) => {
      await testPath(path, mbtContext, {
        actions,
        verifyState: stateVerifier,
      });
    });
  }
});
```

## Fixture contract

Specs rely on fixtures defined in `tests/fixtures.ts`:

| Fixture                    | Stub project                     | Live (`app`) project                               |
| -------------------------- | -------------------------------- | -------------------------------------------------- |
| `page`                     | Mock page (no browser)           | Chromium with `baseURL`                            |
| `homePage`, `loginPage`, … | Not used directly in specs       | One fixture per `<PageName>Page` class             |
| `actions`                  | `createStubActions()` (log only) | `createAppAuthActions({ homePage, loginPage, … })` |
| `stateVerifier`            | `noopStateVerifier`              | `createStateVerifier({ homePage, loginPage, … })`  |
| `mbtContext`               | `createLoggingContext(page)`     | Same                                               |

Run stub smoke: `npm test -- --project=stub`  
Run live E2E: `npm test -- --project=app`

## Adding a new machine

1. Define the machine in `src/machines/<name>.machine.ts` (no Playwright imports).
2. Implement `<PageName>Page` classes, add Playwright fixtures, register `should*` methods in `state-verifier.ts`.
3. Map events in `tests/support/actions/<name>.actions.ts` using page fixtures.
4. Create a new spec (or swap the machine import in an existing spec).
5. Paths and test names appear automatically — no manual test enumeration.

## What stays out of specs

- Locators and selectors → page object constructors (`<PageName>Page`)
- Overlay dismissal → `tests/support/app/overlays.ts`
- Credentials → `tests/support/config/`
- Event handlers → `tests/support/actions/`
- State assertions → `should*` methods on page objects + `state-verifier.ts`

## Reference implementation

- `tests/mbt/auth-graph-driven.spec.ts` — canonical graph-driven spec for `appAuthMachine`
