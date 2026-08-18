Technical architecture for `rnd-graph-based-e2e`.
Purpose: orient agents to modules, runtime contracts, and test execution boundaries.
Content: implementation structure only; business intent belongs in `docs/CONTEXT.md`.
Style: concise, factual, and complementary to `docs/CODEMAP.md`; use CODEMAP for the file inventory.

## Workspace

- Single-package TypeScript/ESM Node project using npm and `package-lock.json`.
- CODEMAP is the built-in structural index; no external graph or LSP backend is configured for this workspace.
- Root TypeScript scope is 53 source/config files: 52 files under `src/` and `tests/`, plus `playwright.config.ts`.
- Two independent subsystems coexist: the MBT engine (machines → generated Playwright tests) and the autonomous exploration engine (`src/exploration/`). They share no runtime code.
- See `docs/CODEMAP.md` for path-by-path navigation and `docs/TECHSTACK.md` for dependency versions.

## Runtime Stack

- TypeScript strict mode, `module`/`moduleResolution` set to `NodeNext`, `noEmit` typechecking.
- Playwright Test provides browser automation, fixtures, project selection, and reporting.
- XState v5 and `xstate/graph` provide state machines, shortest paths, adjacency maps, and event-sequence paths.
- `dotenv` loads local runtime configuration for Playwright; configuration values are documented generically and not stored in docs.
- No CI system or repository quality gate is selected for the current POC.

## Layers

```text
src/machines/         -> pure XState journey and walk-strategy machines
src/mbt/graph/        -> graph traversal, path labels, coverage tracking, path execution
src/mbt/runner/       -> high-level MBT runner API
src/exploration/      -> browser-independent autonomous-exploration core (no Playwright imports)
tests/support/        -> Playwright page objects, action maps, app helpers, runtime config loaders
tests/support/exploration/ -> live PlaywrightHost + file-channel decider
tests/mbt/            -> generated-path Playwright specs
tests/exploration/    -> browser-free exploration specs
tests/exploration-live/ -> live exploration specs (real Chromium against BASE_URL)
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

## Autonomous Exploration

- A second, independent subsystem: given only a **semantic target** (e.g. `pdp`, `cart`, `guest checkout`), an agent explores the live storefront, records a state/transition graph plus telemetry, and emits a report. It does not reuse the MBT engine — the two coexist and share no runtime code.
- `coordinator.ts` (`explore()`) runs the loop: resolve intent → open entry → observe → decide → consequence/scope gate → act or skip → record → continue/backtrack → stop with an explicit reason. It owns internal defaults (budget, entry, stop conditions); the single required input is the target.
- **Decider seam** (`decider.ts`): the coordinator delegates action _choice_ to a `Decider`. `HeuristicDecider` is a deterministic baseline (ranks candidates via `action-ranker.ts`); `AgentDecider` fulfils each choice from an LLM via a `chooseFn`. No AI SDK or API key is used — in agent mode the in-session Claude Code loop supplies decisions through a file channel.
- **Host boundary** (`host.ts`): `ExplorationHost` is an MCP-shaped `open`/`act` (+ optional `screenshot`/`close`) interface — the only browser seam. Tests drive an in-memory `FixtureHost`; live runs drive `tests/support/exploration/playwright-host.ts` (`PlaywrightHost`), the only component that touches a real site (navigation, ARIA snapshot, action extraction, visible-error detection, console/network/page signal capture, overlay dismissal, overlay-aware clicking, differentiated settle waits, screenshot evidence).
- **Recorder/telemetry** (`recorder.ts`, `graph.ts`, `issues.ts`): `SessionRecorder` owns step counting, state identity (SHA-256 of normalized ARIA in `hash.ts`), dedup, signal correlation, and the run manifest. `IssueLog` keeps a raw event stream (→ `errors.json`) and message-level deduped issues (→ `issues.json`) with total `count` and distinct-`transitions` tallies, promoting bug-worthy kinds.
- **Signals**: passive (`pageError`, `consoleError`, `requestFailed`, `httpError`) and active (`errorShown` visible-error UI). Each is classified first-party vs third-party (`signal-origin.ts`); reports separate site issues from external-vendor noise, and consent/overlay vendor noise is filtered out entirely.
- **Safety is enforced in code, not delegated to the LLM**: `consequence-policy.ts` flags order/payment/account/destructive/personal-data/communication-send/content-publish actions, and off-origin navigations are scope exits. The coordinator gates every chosen action through this policy regardless of what the decider picked, so an agent cannot bypass a boundary. Consequential actions are recorded as skipped boundaries, never executed; the run never pauses for input.
- **App context** (`app-profile.ts`): `deriveAppProfile` builds a structural profile from the homepage links + sitemap; `buildAppContext` merges it with authored notes from `config/app-context.md`, passed to the decider as `appContext`.
- **Coverage hints** (`sitemap.ts`): a bounded robots/sitemap loader seeds the entry page only. Hints are advisory and never gate navigation.
- **Run modes**: autonomous (heuristic, self-driving) via `explore.live.spec.ts`; agent-driven via `agent.live.spec.ts` + the file channel, invoked by the `/explore <target>` Claude Code slash command (`.claude/commands/explore.md`).
- **Artifacts** per run under `artifacts/exploration/<run-id>/` (gitignored): `manifest.json`, `routes.json`, `graph.json`, `errors.json`, `issues.json`, `report.md`, and `evidence/` screenshots.
- `src/exploration/` stays pure (no Playwright/browser imports), like `src/machines/`, so the whole telemetry core is unit-testable without a browser. No new npm dependencies — uses `node:crypto`, deliberately no runtime schema library.

## Test Suites

- `graph-driven.spec.ts`: one Playwright test per auth shortest path.
- `purchase-graph-driven.spec.ts`: one Playwright test per purchase shortest path.
- `coverage-loop.spec.ts`: stub-only coverage-loop scenarios for default coverage, personas, weights, state priority, and budget exhaustion.
- `tests/exploration/` (`exploration` project): browser-free `recorder.spec.ts` + `coordinator.spec.ts` exercising the exploration core against an in-memory fixture site.
- `tests/exploration-live/` (`exploration-live` project): live runs against `BASE_URL` in real Chromium — `explore.live.spec.ts` (autonomous heuristic) and `agent.live.spec.ts` (agent-driven via file channel). Run explicitly.
- Playwright config uses one worker, disables full parallelism, traces on first retry, and defines `stub`, `app`, `exploration`, and `exploration-live` projects.
- Live `app` runs are fail-fast at the test-result level: an observed storefront failure fails that run immediately.

## Contributor Patterns

- Use `docs/PATTERNS/INDEX.md` before changing page objects, graph-driven specs, journey machines, action maps, or runtime config loaders.
- Keep reusable conventions in pattern docs; keep historical implementation notes in `agents/IMPLEMENTATION.md`.
