Code map for `rnd-graph-based-e2e`.

## Root (83 tracked docs, source, and config files) - Playwright and XState MBT POC + autonomous exploration

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

### src/ (27 files) - MBT engine, state machines, and exploration core

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

#### src/exploration/ (17 files) - Autonomous exploration core (browser-independent, no Playwright imports)

- `types.ts` — pure domain types (Observation, VisibleAction, Signal, GraphNode/Edge, Issue, Manifest, ...)
- `assert.ts` — lightweight artifact-boundary assertion helper (no schema lib)
- `hash.ts` — ARIA normalization + SHA-256 state identity + issue fingerprints
- `intent-map.ts` — semantic target → entry strategy + keywords (only target-specific logic)
- `signal-origin.ts` — first-party vs third-party signal classification
- `app-profile.ts` — auto structural app profile + authored-context merge
- `consequence-policy.ts` — site-agnostic rules flagging consequential actions to skip
- `action-ranker.ts` — heuristic action scoring, canonical URL, off-origin check
- `decider.ts` — `Decider` seam: `HeuristicDecider` + `AgentDecider`
- `host.ts` — `ExplorationHost` browser boundary (MCP-shaped)
- `graph.ts` — `ObservedGraph`: hash-deduped nodes/edges + visited/expanded tracking
- `issues.ts` — `IssueLog`: signal correlation + message-level dedup
- `sitemap.ts` — bounded robots/sitemap coverage-hint loader (advisory)
- `recorder.ts` — `SessionRecorder`: orchestrator core (steps, dedup, correlation, manifest)
- `report.ts` — `renderReport` (report.md) + `writeArtifacts` (full artifact set)
- `coordinator.ts` — `explore()`: the exploration loop
- `index.ts` — public API barrel

### tests/ (25 files) - Playwright specs and support layer

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

##### tests/support/exploration/ (2 files) - Live exploration adapters

- `playwright-host.ts` — the live `PlaywrightHost` (real Chromium; only component that touches the site)
- `file-channel-decider.ts` — keyless "LLM in the loop" via request/response JSON files

#### tests/exploration/ (3 files) - Browser-free exploration suite (`exploration` project)

- `fixture-site.ts` — controlled in-memory site + `FixtureHost`
- `recorder.spec.ts`
- `coordinator.spec.ts`

#### tests/exploration-live/ (2 files) - Live exploration suite (`exploration-live` project)

- `explore.live.spec.ts` — autonomous heuristic run against `BASE_URL`
- `agent.live.spec.ts` — agent-driven run via the file channel

#### tests/ (1 file) - Shared Playwright fixtures

- `fixtures.ts`

### config/ (1 file) - Authored per-app profile for exploration

- `app-context.md` — page-type URL shapes, key flows, prerequisites, known third-party vendors; loaded by live specs as `appContext`

### .claude/commands/ (2 files) - Claude Code slash commands

- `explore.md` — `/explore <target>` agent-driven exploration command
- `onboard-site.md` — `/onboard-site <base-url>` recon + settle harness context for a new site

### docs/ (16 files) - Current project documentation

- `ARCHITECTURE.md`
- `ASSUMPTIONS.md`
- `CODEMAP.md`
- `CONTEXT.md`
- `DEPENDENCIES.md`
- `TECHSTACK.md`
- `TODO.md`
- `autonomous-agent-exploration-poc-plan.md`
- `exploration-loop-investigation.md`

#### docs/PATTERNS/ (7 files) - Reusable patterns

- `CHANGES.md`
- `INDEX.md`
- `action-map.md`
- `config-loader.md`
- `machine-model.md`
- `page-object.md`
- `test-spec.md`

### agents/ (2 files) - Rosetta memory and implementation log

- `IMPLEMENTATION.md`
- `MEMORY.md`
