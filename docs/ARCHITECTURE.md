Technical architecture for `rnd-graph-based-e2e`.
Purpose: orient agents to modules, runtime contracts, and test execution boundaries.
Content: implementation structure only; business intent belongs in `docs/CONTEXT.md`.
Style: concise, factual, and complementary to `docs/CODEMAP.md`; use CODEMAP for the file inventory.

## Workspace

- Single-package TypeScript/ESM Node project using npm and `package-lock.json`.
- CODEMAP is the built-in structural index; no external graph or LSP backend is configured for this workspace.
- Root TypeScript scope is 29 source/config files: 28 files under `src/` and `tests/`, plus `playwright.config.ts`.
- See `docs/CODEMAP.md` for path-by-path navigation and `docs/TECHSTACK.md` for dependency versions.

## Runtime Stack

- TypeScript strict mode, `module`/`moduleResolution` set to `NodeNext`, `noEmit` typechecking.
- Playwright Test provides browser automation, fixtures, project selection, and reporting.
- XState v5 and `xstate/graph` provide state machines, shortest paths, adjacency maps, and event-sequence paths.
- `dotenv` loads local runtime configuration for Playwright; configuration values are documented generically and not stored in docs.
- No CI system or repository quality gate is selected for the current POC.

## Layers

```text
src/machines/     -> pure XState journey and walk-strategy machines
src/mbt/graph/    -> graph traversal, path labels, coverage tracking, path execution
src/mbt/runner/   -> high-level MBT runner API
tests/support/    -> Playwright page objects, action maps, app helpers, runtime config loaders
tests/mbt/        -> generated-path Playwright specs
```

## Journey Models

- `app-auth.machine.ts`: auth journey states `home`, `login`, `myAccount`, `error`; events `GO_LOGIN`, `SUBMIT`, `FAIL`, `LOGOUT`; `error` is final.
- `app-purchase.machine.ts`: purchase journey states `home`, `pdp`, `cart`, `checkout`; events `OPEN_PDP`, `ADD_TO_CART`, `GO_CHECKOUT`; `checkout` is final.
- `walk-strategy.machine.ts`: execution strategy state machine with `idle`, `walking`, `done`, and `failed`; tracks path index, visited states, and last error.
- Journey machines must not import Playwright, page objects, or environment configuration.

## MBT Engine

- `path-generator.ts` re-exports XState graph helpers and adds helpers for all shortest paths, transition counts, and reachable state values.
- `test-model-factory.ts` executes a graph path by dispatching non-internal events through an action map, then optionally verifies the reached state.
- `coverage-tracker.ts` tracks known states/edges from adjacency, visit counts, weighted gaps, and percentage reports.
- `exploration-loop.ts` selects uncovered edge gaps, builds minimal paths to exercise them, applies persona/event compatibility, and stops on coverage completion or budget exhaustion.
- `mbt-runner.ts` runs all shortest paths directly or through the walk-strategy machine.
- The POC keeps both shortest-path traversal and exploration-loop traversal available as supported execution modes.

## Playwright Boundary

- Page objects live under `tests/support/pages/` and own selectors plus state assertions.
- Action maps live under `tests/support/actions/` and translate machine events into page-object calls or stub log entries.
- `tests/fixtures.ts` merges auth and purchase live action maps for the `app` project and uses log-only stub actions for the `stub` project.
- Runtime config loaders under `tests/support/config/` centralize environment-backed inputs and fail fast for required values.

## Test Suites

- `graph-driven.spec.ts`: one Playwright test per auth shortest path.
- `purchase-graph-driven.spec.ts`: one Playwright test per purchase shortest path.
- `coverage-loop.spec.ts`: stub-only coverage-loop scenarios for default coverage, personas, weights, state priority, and budget exhaustion.
- Playwright config uses one worker, disables full parallelism, traces on first retry, and defines `stub` and `app` projects.
- Live `app` runs are fail-fast at the test-result level: an observed storefront failure fails that run immediately.

## Contributor Patterns

- Use `docs/PATTERNS/INDEX.md` before changing page objects, graph-driven specs, journey machines, action maps, or runtime config loaders.
- Keep reusable conventions in pattern docs; keep historical implementation notes in `agents/IMPLEMENTATION.md`.
