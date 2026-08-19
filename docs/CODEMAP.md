Code map for `rnd-graph-based-e2e`.

## Root (81 tracked docs, source, and config files) - Playwright and XState MBT POC + autonomous exploration

- `.env.example`
- `.gitignore`
- `.mcp.json` — registers the `@playwright/mcp` server (isolated Chromium, tracing, guardrail `--init-script`) used by `/explore`
- `.prettierignore`
- `.prettierrc.json`
- `CLAUDE.md`
- `README.md`
- `gain.json`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `tsconfig.json`

### src/ (20 files) - MBT engine, state machines, and exploration core

#### src/machines/ (3 files) - XState journey models

- `app-auth.machine.ts`
- `app-purchase.machine.ts`
- `walk-strategy.machine.ts`

#### src/mbt/ (7 files) - Graph traversal and runner logic

- `types.ts`

##### src/mbt/graph/ (5 files) - Path generation and execution helpers

- `coverage-tracker.ts`
- `exploration-loop.ts`
- `path-generator.ts`
- `path-label.ts`
- `test-model-factory.ts`

##### src/mbt/runner/ (1 file) - High-level runner API

- `mbt-runner.ts`

#### src/exploration/ (10 files) - Autonomous exploration core (browser-independent, no Playwright imports)

- `types.ts` — pure domain types (Observation, VisibleAction, Signal, GraphNode/Edge, Issue, Manifest, ...)
- `assert.ts` — lightweight artifact-boundary assertion helper (no schema lib)
- `hash.ts` — normalized-state SHA-256 identity + issue fingerprints
- `signal-origin.ts` — first-party vs third-party signal classification
- `consequence-policy.ts` — site-agnostic consequence rules; exports `CONSEQUENCE_PATTERNS` (serializable) consumed by the guardrail generator + trace parser
- `graph.ts` — `ObservedGraph`: hash-deduped nodes/edges + visited/expanded tracking
- `issues.ts` — `IssueLog`: signal correlation + message-level dedup
- `recorder.ts` — `SessionRecorder`: recording core (steps, dedup, correlation, manifest)
- `report.ts` — `renderReport` (report.md) + `writeArtifacts` (full artifact set)
- `index.ts` — public API barrel

### tests/ (24 files) - Playwright specs and support layer

#### tests/mbt/ (3 files) - Graph-driven specs

- `coverage-loop.spec.ts`
- `graph-driven.spec.ts`
- `purchase-graph-driven.spec.ts`

#### tests/support/ (14 files) - Page objects, adapters, and config

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

##### tests/support/exploration/ (2 files) - MCP exploration support (guardrail + parser)

- `guardrails.ts` — generates the page-side guardrail init-script (overlay dismissal + consequential-control neutralization) from per-site data + `CONSEQUENCE_PATTERNS`
- `trace-parser.ts` — post-hoc trace → artifacts (`extractTrace` reads the raw `.trace` directly, `unzip` only for a legacy `.zip`, + pure `traceModelToArtifacts`); the only component that reads a real trace

#### tests/exploration/ (4 files) - Browser-free exploration suite (`exploration` project)

- `recorder.spec.ts` — recording core against synthesized observations
- `guardrails.spec.ts` — guardrail generator + freshness of the committed init script
- `trace-parser.spec.ts` — parser layers (hand-authored `TraceModel` + raw `trace.trace`)
- `parse-run.spec.ts` — runner: `EXPLORE_TRACE` → parse → `writeArtifacts` (skipped unless the env var is set)

#### tests/ (1 file) - Shared Playwright fixtures

- `fixtures.ts`

### config/ (3 files) - Authored per-site profile + guardrail data for exploration

- `app-context.md` — page-type URL shapes, key flows, prerequisites, known third-party vendors; grounds the exploration agent
- `guardrails/beaverbrooks.json` — per-site guardrail data (consent-overlay selectors, extra consequential names) — context, not code
- `guardrails/beaverbrooks.init.js` — generated guardrail init-script, loaded via `.mcp.json` `--init-script` (regenerate with `UPDATE_GUARDRAILS=1`)

### .claude/commands/ (2 files) - Claude Code slash commands

- `explore.md` — `/explore <target>` agent-driven exploration; drives Playwright MCP directly, then parses the trace into artifacts
- `onboard-site.md` — `/onboard-site <base-url>` recon + settle harness context for a new site

### docs/ (16 files) - Current project documentation

- `ARCHITECTURE.md`
- `ASSUMPTIONS.md`
- `CODEMAP.md`
- `CONTEXT.md`
- `DEPENDENCIES.md`
- `TECHSTACK.md`
- `TODO.md`
- `ai-exploratory-architecture.md` — AI exploratory subsystem: architecture + runtime flow + key decisions (as-built)
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
