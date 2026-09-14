Code map for `rnd-graph-based-e2e`.

## Root (55 tracked docs, source, and config files) - Playwright and XState MBT POC

- `.env.example`
- `.gitignore`
- `.prettierignore`
- `.prettierrc.json`
- `CLAUDE.md`
- `README.md`
- `gain.json`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `tsconfig.json`

### src/ (8 files) - MBT engine and state machines

#### src/machines/ (2 files) - XState journey models

- `app-auth.machine.ts`
- `app-shopping.machine.ts`

#### src/mbt/ (6 files) - Graph traversal logic

- `types.ts`

##### src/mbt/graph/ (5 files) - Path generation and execution helpers

- `coverage-tracker.ts`
- `exploration-loop.ts`
- `path-generator.ts`
- `path-label.ts`
- `test-model-factory.ts`

### tests/ (18 files) - Playwright MBT specs and support layer

#### tests/mbt/ (3 files) - Graph-driven specs

- `coverage-loop.spec.ts`
- `auth-graph-driven.spec.ts`
- `shopping-graph-driven.spec.ts`

#### tests/support/ (12 files) - Page objects, adapters, and config

##### tests/support/actions/ (3 files) - Event-to-action bindings

- `app-auth.actions.ts`
- `app-purchase.actions.ts`
- `stub-actions.ts`

##### tests/support/app/ (1 file) - App-specific helpers

- `overlays.ts`

##### tests/support/config/ (2 files) - Runtime test config loaders

- `app-credentials.ts`
- `app-product.ts`

##### tests/support/pages/ (8 files) - Page objects and state assertions

- `cart.page.ts`
- `checkout.page.ts`
- `home.page.ts`
- `login.page.ts`
- `my-account.page.ts`
- `page-fixtures.ts`
- `pdp.page.ts`
- `state-verifier.ts`

#### tests/ (1 file) - Shared Playwright fixtures

- `fixtures.ts`

### docs/ (15 files) - Current project documentation

- `ARCHITECTURE.md`
- `ASSUMPTIONS.md`
- `CODEMAP.md`
- `CONTEXT.md`
- `DEPENDENCIES.md`
- `TECHSTACK.md`
- `TODO.md`
- `exploration-loop-investigation.md`

#### docs/PATTERNS/ (7 files) - Reusable patterns

- `CHANGES.md`
- `INDEX.md`
- `action-map.md`
- `config-loader.md`
- `machine-model.md`
- `page-object.md`
- `test-spec.md`

### agents/ (3 files) - Rosetta memory and implementation log

- `IMPLEMENTATION.md`
- `MEMORY.md`
- `init-workspace-flow-state.md`
