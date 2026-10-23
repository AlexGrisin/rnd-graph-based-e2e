Code map for `rnd-graph-based-e2e`.

## Core project inventory (76 tracked docs, source, and config files) - Playwright and XState MBT POC

This inventory excludes editor-specific contributor skills under `.claude/` and `.cursor/` and the installed Rosetta framework under `.agents/`.

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

### src/ (9 files) - MBT engine and state machines

#### src/machines/ (3 files) - XState journey models

- `app-auth.machine.ts`
- `app-shopping.machine.ts`
- `app-store-lookup.machine.ts`

#### src/mbt/ (6 files) - Graph traversal logic

- `types.ts`

##### src/mbt/graph/ (5 files) - Path generation and execution helpers

- `coverage-tracker.ts`
- `exploration-loop.ts`
- `path-generator.ts`
- `path-label.ts`
- `test-model-factory.ts`

### tests/ (37 files) - Playwright MBT specs and support layer

#### tests/mbt/ (5 files) - Graph-driven and evaluator specs

- `coverage-loop.spec.ts`
- `auth-graph-driven.spec.ts`
- `shopping-graph-driven.spec.ts`
- `store-lookup-graph-driven.spec.ts`
- `llm-path-evaluator.spec.ts`

#### tests/support/ (31 files) - Page objects, adapters, configuration, evaluation, and reporting

##### tests/support/actions/ (4 files) - Event-to-action bindings

- `app-auth.actions.ts`
- `app-shopping.actions.ts`
- `app-store-lookup.actions.ts`
- `stub-actions.ts`

##### tests/support/app/ (1 file) - App-specific helpers

- `overlays.ts`

##### tests/support/config/ (2 files) - Runtime test config loaders

- `app-credentials.ts`
- `llm-judge.ts`

##### tests/support/evaluation/ (10 files) - Advisory judgment, evidence, and rubrics

- `judge-client.ts`
- `observation-judge-client.ts`
- `report-formatters.ts`
- `rubric-engine.ts`
- `step-evaluation-issues.ts`
- `test-attachments.ts`
- `test-evaluator.ts`
- `rubrics/exploratory-observation.rubric.ts`
- `rubrics/path-evidence.rubric.ts`
- `rubrics/step-evidence.rubric.ts`

##### tests/support/pages/ (13 files) - Page objects and state assertions

- `cart.page.ts`
- `checkout.page.ts`
- `favorites-list.page.ts`
- `home.page.ts`
- `listing.page.ts`
- `login.page.ts`
- `my-account.page.ts`
- `page-fixtures.ts`
- `pdp.page.ts`
- `state-verifier.ts`
- `store-details.page.ts`
- `store-locator.page.ts`
- `store-region.page.ts`

##### tests/support/reporting/ (1 file) - Suite-level advisory reports

- `llm-observation-reporter.ts`

#### tests/ (1 file) - Shared Playwright fixtures

- `fixtures.ts`

### docs/ (16 files) - Current project documentation

- `ARCHITECTURE.md`
- `ASSUMPTIONS.md`
- `CODEMAP.md`
- `CONTEXT.md`
- `DEPENDENCIES.md`
- `INITIATIVE-TARGET-STATE.md`
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
