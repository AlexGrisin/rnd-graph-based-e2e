Implementation changelog for rnd-graph-based-e2e.

## 2025-06-25 — Initial scaffold

- Project initialized with TypeScript, Playwright, XState v5
- Example app machine (`home → login → dashboard → error`)
- Walk strategy machine for path orchestration
- MBT graph utilities (`getShortestPaths`, `testPath`)
- MBT runner with `runShortestPaths` and `runWithStrategy`
- Playwright fixtures, stub actions, page object stubs
- Two MBT specs: shortest paths + strategy walk
- Rosetta docs: CONTEXT, ARCHITECTURE, TECHSTACK, CODEMAP, DEPENDENCIES, ASSUMPTIONS

## 2025-06-25 — myAccount post-login state

- `SUBMIT` now transitions to `myAccount` instead of `dashboard`
- Added `MyAccountPage`; removed `DashboardPage`
- Updated page registry, actions, and shortest-paths spec

## 2025-06-26 — Graph-driven test suite

- Replaced per-journey specs with single `graph-driven.spec.ts` — one Playwright test per `getShortestPaths()` result
- State assertions moved to page objects (`assertOnPage`) + `state-verifier.ts` registry
- Unified fixtures (stub vs gstar selected by Playwright project)
- Removed error-path filter from `runShortestPaths`
- Deleted `gstar-journeys`, `shortest-paths`, `strategy-walk` specs

## 2025-06-26 — Prettier

- Added `prettier` devDependency with `singleQuote: true` (`.prettierrc.json`)
- Added `format` / `format:check` npm scripts and `.prettierignore`

## 2025-06-26 — PATTERNS docs

- Created `docs/PATTERNS/page-object.md` — MBT page object conventions and template
- Created `docs/PATTERNS/test-spec.md` — graph-driven spec conventions and template
- Added `docs/PATTERNS/INDEX.md` and `docs/PATTERNS/CHANGES.md`
- Revised page-object pattern: `<PageName>Page`, selectors in constructor, `should*` assertions, Playwright fixtures (no `PageRegistry`)

## 2025-06-26 — Page object refactor

- Refactored `HomePage`, `LoginPage`, `MyAccountPage` per `docs/PATTERNS/page-object.md`
- Selectors moved from `locators.ts` into page object constructors
- `assertOnPage` → `shouldBeOnPage`, `assertErrorPage` → `shouldShowError`
- Added `homePage`, `loginPage`, `myAccountPage` Playwright fixtures
- Removed `base.page.ts`, `pages/index.ts` (`PageRegistry`), `gstar/locators.ts`
- Added `page-fixtures.ts` shared type for actions and state verifier

## 2025-06-26 — Rename example-app → gstar-auth

- `example-app.machine.ts` → `gstar-auth.machine.ts` (`gstarAuthMachine`, `GstarAuthEvent`, …)
- `example-app.actions.ts` → `gstar-auth.actions.ts` (`createGstarAuthActions`)
- Updated fixtures, specs, walk-strategy, and docs

## 2025-06-26 — Rename gstar → app

- `gstar-auth.machine.ts` → `app-auth.machine.ts` (`appAuthMachine`, `AppAuthEvent`, …)
- `gstar-auth.actions.ts` → `app-auth.actions.ts` (`createAppAuthActions`)
- Playwright project `gstar` → `app`; `test:gstar` → `test:app`
- `tests/support/gstar/` → `tests/support/app/` (`dismissAppOverlays`)
- `gstar-credentials.ts` → `app-credentials.ts`; `GSTAR_*` env → `APP_*`
