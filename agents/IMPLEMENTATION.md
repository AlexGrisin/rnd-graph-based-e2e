# Rosetta Implementation Summary

This file is the concise implementation baseline and the only durable implementation changelog.
For business context use `docs/CONTEXT.md`; for technical architecture use `docs/ARCHITECTURE.md`.
Keep entries brief, factual, and grep-friendly.

## Baseline - 2026-07-22

- Plugin-mode Rosetta workspace upgrade is in progress for a root-only repository.
- Project is an XState + Playwright model-based E2E testing POC.
- Root TypeScript source/config scope is 29 files: 28 under `src/` and `tests/`, plus `playwright.config.ts`.
- Built-in CODEMAP is the selected code map; no external graph or LSP backend is configured.
- Core implementation includes auth and purchase journey machines, graph/path helpers, coverage loop, MBT runner, Playwright fixtures, page objects, live action maps, and stub actions.

## Change Log

### 2025-06-25 - Initial scaffold

- Project initialized with TypeScript, Playwright, XState v5.
- Example app machine (`home -> login -> dashboard -> error`).
- Walk strategy machine for path orchestration.
- MBT graph utilities (`getShortestPaths`, `testPath`).
- MBT runner with `runShortestPaths` and `runWithStrategy`.
- Playwright fixtures, stub actions, page object stubs.
- Two MBT specs: shortest paths and strategy walk.
- Rosetta docs: CONTEXT, ARCHITECTURE, TECHSTACK, CODEMAP, DEPENDENCIES, ASSUMPTIONS.

### 2025-06-25 - myAccount post-login state

- `SUBMIT` now transitions to `myAccount` instead of `dashboard`.
- Added `MyAccountPage`; removed `DashboardPage`.
- Updated page registry, actions, and shortest-paths spec.

### 2025-06-26 - Graph-driven test suite

- Replaced per-journey specs with single `graph-driven.spec.ts`: one Playwright test per `getShortestPaths()` result.
- State assertions moved to page objects (`assertOnPage`) plus `state-verifier.ts` registry.
- Unified fixtures: stub vs app selected by Playwright project.
- Removed error-path filter from `runShortestPaths`.
- Deleted the legacy site-journey, shortest-path, and strategy-walk specs.

### 2025-06-26 - Prettier

- Added `prettier` devDependency with `singleQuote: true` (`.prettierrc.json`).
- Added `format` and `format:check` npm scripts and `.prettierignore`.

### 2025-06-26 - PATTERNS docs

- Created `docs/PATTERNS/page-object.md` and `docs/PATTERNS/test-spec.md`.
- Added `docs/PATTERNS/INDEX.md` and `docs/PATTERNS/CHANGES.md`.
- Revised page-object pattern: `<PageName>Page`, selectors in constructor, `should*` assertions, Playwright fixtures, no `PageRegistry`.

### 2025-06-26 - Page object refactor

- Refactored `HomePage`, `LoginPage`, `MyAccountPage` per `docs/PATTERNS/page-object.md`.
- Selectors moved from `locators.ts` into page object constructors.
- `assertOnPage` -> `shouldBeOnPage`; `assertErrorPage` -> `shouldShowError`.
- Added `homePage`, `loginPage`, `myAccountPage` Playwright fixtures.
- Removed `base.page.ts`, `pages/index.ts` (`PageRegistry`), and the legacy site locator module.
- Added `page-fixtures.ts` shared type for actions and state verifier.

### 2025-06-26 - Introduce site-specific auth naming

- Renamed the example auth machine and action adapter to site-specific names.
- Updated fixtures, specs, walk strategy, and docs.

### 2025-06-26 - Generalize site naming to app

- Renamed the site-specific auth machine and action adapter to generic `app-*` names.
- Renamed the Playwright project and test script to `app`.
- Moved site-specific support helpers under `tests/support/app/`.
- Renamed credentials configuration and environment variables to generic `APP_*` names.

### 2026-07-17 - Purchase journey MBT POC

- Added `app-purchase.machine.ts` (`home -> pdp -> cart -> checkout`, final at checkout).
- Events: `OPEN_PDP`, `ADD_TO_CART`, `GO_CHECKOUT`; live PDP via product path configuration.
- Page objects: `PdpPage`, `CartPage`, `CheckoutPage`; guest checkout to shipping, no payment.
- Spec: `purchase-graph-driven.spec.ts`; stub and app `testMatch` updated.
- Merged auth and purchase action maps; lazy-load auth credentials in `SUBMIT`.
- `dismissAppOverlays` also removes Exponea subscription modals.

### 2026-07-22 - Rosetta plugin-mode documentation baseline

- Reframed root docs for Phase 7 documentation separation: business context, technical architecture, assumptions, TODOs, implementation baseline, and agent memory.
- Retained root-only plugin-mode facts: 29 TypeScript source/config files and built-in CODEMAP-only discovery.

### 2026-07-22 - Phase 8 decision integration

- Recorded confirmed POC policy: no CI system or repository quality gate yet.
- Recorded supported traversal modes: shortest-path and exploration-loop.
- Recorded live storefront execution policy: fail on the first observed `app` test failure.
- Kept unresolved SDLC-system metadata as placeholders in `gain.json`.

### 2026-09-14 - Remove unused MBT strategy layer

- Removed the unreferenced walk-strategy machine and `MbtRunner` wrapper after graph-driven specs standardized on direct `testPath()` execution.
- Removed the unused `mbtRunner` Playwright fixture and refreshed architecture, pattern, TODO, and CODEMAP references.

### 2026-09-14 - Rename purchase model to shopping

- Renamed `app-purchase.machine.ts` to `app-shopping.machine.ts`, including its exported types, helper, machine symbol, and machine ID.
- Renamed the generated purchase spec to `shopping-graph-driven.spec.ts` and updated Playwright matching plus current documentation.
- Kept `app-purchase.actions.ts` scoped to its existing PDP-to-checkout browser actions.

### 2026-09-14 - Rename auth graph-driven spec

- Renamed `graph-driven.spec.ts` to `auth-graph-driven.spec.ts` and its suite title to `Auth graph-driven MBT`.
- Updated Playwright matching and current contributor documentation to distinguish auth and shopping generated suites.

### 2026-09-14 - Make target site configuration-driven

- Removed hardcoded site fallbacks from Playwright and trace parsing; live flows now consume `BASE_URL` from `.env`.
- Made `PRODUCT_PATH` required for the live shopping flow and aligned `.env.example` with the configured site profile.
- Replaced legacy site references in source, tests, and documentation with neutral or configuration-driven wording.

### 2026-09-14 - Remove autonomous exploration subsystem

- Removed agent-driven Playwright MCP commands/configuration, site profiles/guardrails, exploration core, trace parser, and browser-free exploration suite.
- Removed the exploration Playwright project and exploration-only environment and current-documentation references.
- Retained deterministic MBT coverage-loop implementation/investigation and ignored legacy local trace/artifact paths for credential safety.

### 2026-09-23 - Model empty-credential authentication validation

- Added `SUBMIT_WITHOUT_CREDENTIALS` from `login` to `credentialsRequired` in the auth machine.
- Wired the generated path through the live and stub action maps and a page-level assertion for both required-field messages.

### 2026-09-23 - Add advisory LLM path evaluation MVP

- Added an optional post-verification MBT callback and an app-only evaluator that attaches routes, masked screenshots, and advisory verdicts to Playwright results.
- Added a configurable LLM Gateway Responses API adapter for gpt-4o-mini; it is disabled by default and preserves deterministic Playwright status on provider failures.

### 2026-09-28 - Extract rubric-driven judge policy

- Separated the generic LLM judge client from a self-contained path-evidence rubric.
- Moved instructions, weighted criteria, and verdict thresholds into the rubric file.
- Kept final scoring and threshold application deterministic in the client.
- Replaced redundant console findings with score, confidence, criterion coverage, deterministic decision reason, and problematic criterion IDs.
- Added explicit route-node and final-state criteria, screenshot label mapping, and final-screenshot retention within the evidence cap.
- Added expected XState context to verified route steps and judge evidence so screenshots can be checked against both node and context.
- Added concise expected-versus-observed criterion explanations and screenshot indexes, logged only for non-passing criteria.
- Added centralized XState transition logging through `MbtContext.log` with the executed event/action and expected target state.

### 2026-10-02 - Add advisory inline step evaluation

- Added `LLM_JUDGE_SCOPE` with `route` as the default plus `step` and `both` modes.
- Added a dedicated step-evidence rubric; each inline call receives one already-verified transition, its expected XState context, and its masked screenshot.
- Preserved the route screenshot cap and deterministic Playwright status; inline verdicts are attached and logged as advisory evidence only.
- Logged each step criterion's concise LLM explanation alongside its inline verdict.
- Added a final LLM-assisted exploratory-observation report that consolidates route and completed-step verdicts into evidence-backed successes, concerns, errors, and coverage gaps.
- Added a Playwright reporter that rolls all per-test observation reports into `artifacts/llm-observations/llm-judge-suite-observations.md` after a suite run.
