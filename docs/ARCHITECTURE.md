Technical architecture for `rnd-graph-based-e2e`.
Purpose: orient agents to modules, runtime contracts, and test execution boundaries.
Content: implementation structure only; business intent belongs in `docs/CONTEXT.md`.
Style: concise, factual, and complementary to `docs/CODEMAP.md`; use CODEMAP for the file inventory.

## Workspace

- Single-package TypeScript/ESM Node project using npm and `package-lock.json`.
- CODEMAP is the built-in structural index; no external graph or LSP backend is configured for this workspace.
- Root TypeScript scope is 47 source/config files: 46 files under `src/` and `tests/`, plus `playwright.config.ts`.
- See `docs/CODEMAP.md` for path-by-path navigation and `docs/TECHSTACK.md` for dependency versions.

## Runtime Stack

- TypeScript strict mode, `module`/`moduleResolution` set to `NodeNext`, `noEmit` typechecking.
- Playwright Test provides browser automation, fixtures, project selection, and reporting.
- XState v5 and `xstate/graph` provide state machines, shortest paths, adjacency maps, and event-sequence paths.
- `dotenv` loads local runtime configuration for Playwright; configuration values are documented generically and not stored in docs.
- No CI system or repository quality gate is selected for the current POC.

## Layers

```text
src/machines/         -> pure XState journey machines
src/mbt/graph/        -> graph traversal, path labels, coverage tracking, path execution
tests/support/        -> Playwright page objects, action maps, app helpers, runtime config loaders
tests/mbt/            -> generated-path Playwright specs
```

## Journey Models

- `app-auth.machine.ts`: auth journey states `home`, `login`, `credentialsRequired`, `homeAuth`, `myAccount`, `error`; includes successful login, empty-credential validation, invalid login, account navigation, and logout; `error` is final.
- `app-shopping.machine.ts`: shopping journey states `home`, `search`, `category`, `pdp`, `favoritesAdded`, `favoritesList`, `bagAdded`, `cart`, `checkout`; models discovery, product selection, favorites, cart, home-return cycles, and guest checkout; `checkout` is final.
- `app-store-lookup.machine.ts`: store-finder states cover validation, results, no-results, region, map selection, and store details; guarded return transitions preserve the detail page's origin.
- Journey machines must not import Playwright, page objects, or environment configuration.

## MBT Engine

- The optional app-only LLM evaluator records verified steps with their expected XState context and labeled masked screenshots, then produces advisory gateway verdicts without changing deterministic test status. `LLM_JUDGE_SCOPE=route` (the default) judges the capped route evidence after execution; `step` judges each verified transition inline; `both` does both. A final observation judge synthesizes all available route and step assessments into an attached Markdown report with evidence-backed successes, concerns, errors, and coverage gaps. Every `not_met` step criterion is also preserved deterministically as a medium-severity potential issue, even if the final observation LLM omits it. A custom Playwright reporter combines those per-test reports into `artifacts/llm-observations/llm-judge-suite-observations.md`, outside Playwright's regenerated HTML report directory. Route and step policies are self-contained rubric files, while the generic client applies their criteria, weights, and thresholds. Step mode logs each bounded criterion explanation; non-passing route criteria include explanations and screenshot indexes.
- `path-generator.ts` re-exports XState graph helpers and adds helpers for all shortest paths, transition counts, and reachable state values.
- `test-model-factory.ts` executes a graph path by dispatching non-internal events through an action map, then optionally verifies the reached state.
- `coverage-tracker.ts` tracks known states/edges from adjacency, visit counts, weighted gaps, and percentage reports.
- `exploration-loop.ts` selects uncovered edge gaps, builds minimal paths to exercise them, applies persona/event compatibility, and stops on coverage completion or budget exhaustion.
- The POC keeps both shortest-path traversal and exploration-loop traversal available as supported execution modes.

## Playwright Boundary

- Page objects live under `tests/support/pages/` and own selectors plus state assertions.
- Action maps live under `tests/support/actions/` and translate machine events into page-object calls or stub log entries.
- `tests/fixtures.ts` merges auth, shopping, and store-lookup live action maps for the `app` project and uses log-only stub actions for the `stub` project.
- Runtime config loaders under `tests/support/config/` centralize environment-backed inputs and fail fast for required values.

## Test Suites

- `auth-graph-driven.spec.ts`: one Playwright test per auth shortest path.
- `shopping-graph-driven.spec.ts`: one Playwright test per generated cyclic shopping path.
- `store-lookup-graph-driven.spec.ts`: one Playwright test per generated store-lookup transition path.
- `coverage-loop.spec.ts`: stub-only coverage-loop scenarios for default coverage, personas, weights, state priority, and budget exhaustion.
- `llm-path-evaluator.spec.ts`: stub-only evaluator and reporting scenarios.
- Playwright config uses one worker with `fullyParallel: true`, retains traces on failures, and defines `stub` and `app` projects.
- Live `app` runs report browser-test failures normally; local runs use no retries and CI runs retry once.

## Contributor Patterns

- Use `docs/PATTERNS/INDEX.md` before changing page objects, graph-driven specs, journey machines, action maps, or runtime config loaders.
- Keep reusable conventions in pattern docs; keep historical implementation notes in `agents/IMPLEMENTATION.md`.
