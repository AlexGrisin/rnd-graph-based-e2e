Index of reusable coding patterns for `rnd-graph-based-e2e`.

## Patterns

## MBT Page Object - browser adapter per machine state
File: [page-object.md](./page-object.md)
Use when adding or updating a Playwright page object, its fixture, or state assertion wiring.
Coverage: `tests/support/pages/*.page.ts`, `tests/support/pages/state-verifier.ts`, `tests/fixtures.ts`

## Graph-Driven MBT Spec - one test per generated shortest path
File: [test-spec.md](./test-spec.md)
Use when creating a shortest-path Playwright suite backed by a machine and shared fixtures.
Coverage: `tests/mbt/graph-driven.spec.ts`, `tests/mbt/shopping-graph-driven.spec.ts`

## XState Journey Machine - typed linear journey model
File: [machine-model.md](./machine-model.md)
Use when adding a new application journey under `src/machines/`.
Coverage: `src/machines/app-auth.machine.ts`, `src/machines/app-shopping.machine.ts`

## MBT Action Map - event to page-action adapter factory
File: [action-map.md](./action-map.md)
Use when mapping machine events onto Playwright page-object operations for a live project or stub project.
Coverage: `tests/support/actions/app-auth.actions.ts`, `tests/support/actions/app-purchase.actions.ts`, `tests/support/actions/stub-actions.ts`

## Env Config Loader - fail-fast test runtime config reader
File: [config-loader.md](./config-loader.md)
Use when a test support module needs environment-backed runtime input with a default or explicit validation.
Coverage: `tests/support/config/app-credentials.ts`, `tests/support/config/app-product.ts`

## Explicit Skips

## `src/mbt/graph/` - skip
Reason: the traversal helpers share utility fragments, but the exported behaviors are algorithm-specific (`testPath`, shortest-path execution, coverage loop) rather than a stable contributor-facing template.
Evidence: `src/mbt/graph/test-model-factory.ts`, `src/mbt/graph/exploration-loop.ts`

## `tests/support/app/overlays.ts` - skip
Reason: overlay dismissal is a single app-specific helper reused by many pages, but there is only one implementation and no alternative pattern to extract.
Evidence: `tests/support/app/overlays.ts`, `tests/support/pages/home.page.ts`, `tests/support/pages/login.page.ts`

## Changelog

See [CHANGES.md](./CHANGES.md).
