Code map for rnd-graph-based-e2e (3 levels).

## src/

Application model and MBT engine — no Playwright imports.

### src/machines/

- `app-auth.machine.ts` — app auth state model
- `app-purchase.machine.ts` — purchase happy-path model
- `walk-strategy.machine.ts` — path orchestration model

### src/mbt/

- `types.ts` — ActionMap, MbtContext, StateVerifier contracts
- `graph/path-generator.ts` — getShortestPaths / getAdjacencyMap wrappers
- `graph/test-model-factory.ts` — testPath execution engine
- `graph/path-label.ts` — describePath (human-readable test titles)
- `runner/mbt-runner.ts` — high-level MBT runner (alternate programmatic API)

## tests/

Playwright infrastructure and graph-driven specs.

### tests/support/pages/

- `home.page.ts`, `login.page.ts`, `my-account.page.ts` — auth page objects
- `pdp.page.ts`, `cart.page.ts`, `checkout.page.ts` — purchase page objects
- `page-fixtures.ts` — shared `PageFixtures` type
- `state-verifier.ts` — state name → `should*` assertion registry

### tests/support/actions/

- `stub-actions.ts` — log-only actions + `createLoggingContext`
- `app-auth.actions.ts` — auth event→POM wiring
- `app-purchase.actions.ts` — purchase event→POM wiring

### tests/support/ (other)

- `app/overlays.ts` — `dismissAppOverlays` (OneTrust / push / Exponea)
- `config/app-credentials.ts` — `APP_EMAIL` / `APP_PASSWORD` loader
- `config/app-product.ts` — `PRODUCT_PATH` loader

### tests/mbt/

- `graph-driven.spec.ts` — auth shortest paths
- `purchase-graph-driven.spec.ts` — purchase shortest paths
- `coverage-loop.spec.ts` — coverage-loop experiments (stub)

### tests/

- `fixtures.ts` — Playwright custom fixtures (stub vs app wiring)

## Root configs

- `package.json`, `tsconfig.json`, `playwright.config.ts`, `README.md`, `.prettierrc.json`
