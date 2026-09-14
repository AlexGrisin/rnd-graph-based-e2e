Technical architecture for `rnd-graph-based-e2e`.
Purpose: orient agents to modules, runtime contracts, and test execution boundaries.
Content: implementation structure only; business intent belongs in `docs/CONTEXT.md`.
Style: concise, factual, and complementary to `docs/CODEMAP.md`; use CODEMAP for the file inventory.

## Workspace

- Single-package TypeScript/ESM Node project using npm and `package-lock.json`.
- CODEMAP is the built-in structural index; no external graph or LSP backend is configured for this workspace.
- Root TypeScript scope is 43 source/config files: 42 files under `src/` and `tests/`, plus `playwright.config.ts`.
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
src/machines/         -> pure XState journey machines
src/mbt/graph/        -> graph traversal, path labels, coverage tracking, path execution
src/exploration/      -> browser-independent autonomous-exploration core (no Playwright imports)
tests/support/        -> Playwright page objects, action maps, app helpers, runtime config loaders
tests/support/exploration/ -> guardrail-script generator + post-hoc trace parser
tests/mbt/            -> generated-path Playwright specs
tests/exploration/    -> browser-free exploration specs (core, guardrail, trace parser) + parse-run runner
```

## Journey Models

- `app-auth.machine.ts`: auth journey states `home`, `login`, `myAccount`, `error`; events `GO_LOGIN`, `SUBMIT`, `FAIL`, `LOGOUT`; `error` is final.
- `app-shopping.machine.ts`: shopping journey states `home`, `search`, `category`, `pdp`, `favorites`, `cart`, `checkout`; models discovery, product selection, favorites, cart, home-return cycles, and guest checkout; `checkout` is final.
- Journey machines must not import Playwright, page objects, or environment configuration.

## MBT Engine

- `path-generator.ts` re-exports XState graph helpers and adds helpers for all shortest paths, transition counts, and reachable state values.
- `test-model-factory.ts` executes a graph path by dispatching non-internal events through an action map, then optionally verifies the reached state.
- `coverage-tracker.ts` tracks known states/edges from adjacency, visit counts, weighted gaps, and percentage reports.
- `exploration-loop.ts` selects uncovered edge gaps, builds minimal paths to exercise them, applies persona/event compatibility, and stops on coverage completion or budget exhaustion.
- The POC keeps both shortest-path traversal and exploration-loop traversal available as supported execution modes.

## Playwright Boundary

- Page objects live under `tests/support/pages/` and own selectors plus state assertions.
- Action maps live under `tests/support/actions/` and translate machine events into page-object calls or stub log entries.
- `tests/fixtures.ts` merges auth and shopping live action maps for the `app` project and uses log-only stub actions for the `stub` project.
- Runtime config loaders under `tests/support/config/` centralize environment-backed inputs and fail fast for required values.

## Autonomous Exploration

- A second, independent subsystem: given only a **semantic target** (e.g. `pdp`, `cart`, `guest checkout`), an agent explores the live storefront, records a state/transition graph plus telemetry, and emits a report. It does not reuse the MBT engine — the two coexist and share no runtime code.
- **Driving**: the in-session agent (Claude) drives **Microsoft's Playwright MCP** (`@playwright/mcp`, registered in `.mcp.json`) directly: `browser_navigate` → `browser_snapshot` → reason → `browser_click`/`type`/`select`, with tracing on. The agent owns the loop (no Node coordinator); the budget (10 acting steps / 15 states, POC) is prompt-enforced by the `/explore` skill. There is no AI SDK or API key — the LLM is the session.
- **Recording** (post-hoc): `tests/support/exploration/trace-parser.ts` is the only component that reads a real trace. It reads the raw, uncompressed `trace-<ts>.trace` the MCP writes (the skill picks the newest one, never the possibly-stale `trace.zip`; `unzip` is a fallback only for a bundled `.zip`), parses the line-ordered stream, and feeds the pure core (`SessionRecorder`/`report.ts`) to emit the artifacts. Layer split: `extractTrace` (path → `TraceModel`) and `traceModelToArtifacts` (pure transform), so the transform is unit-testable without a browser. Invoked via `tests/exploration/parse-run.spec.ts`.
- **Recorder/telemetry** (`recorder.ts`, `graph.ts`, `issues.ts`): `SessionRecorder` owns step counting, state identity (SHA-256 of a normalized snapshot in `hash.ts`), dedup, signal correlation, and the run manifest. `IssueLog` keeps a raw event stream (→ `errors.json`) and message-level deduped issues (→ `issues.json`) with total `count` and distinct-`transitions` tallies, promoting bug-worthy kinds.
- **Signals**: derived from the trace's console stream — `consoleError`, plus `httpError`/`requestFailed` (network 4xx/failures mirror into console) and `pageError`. Each is classified first-party vs third-party (`signal-origin.ts`); reports separate site issues from external-vendor noise.
- **Safety is a page-side guardrail**, not a code-enforced tool gate (the agent calls `browser_click` directly, so it cannot be wrapped): `tests/support/exploration/guardrails.ts` generates an init-script (loaded via the MCP `--init-script`) that neutralizes the consequential controls in `consequence-policy.ts`'s shared patterns (e.g. order, payment, purchase, personal-data, destructive, send, publish; login/sign-up/register are deliberately not blocked) — and dismisses the consent overlay. The parser also marks consequential actions as skipped boundaries in the report. This is weaker than the retired in-code gate; a deliberate trade (see `ai-exploratory-architecture.md` → "Key decisions").
- **App context**: the exploring agent is grounded by the authored `config/app-context.md` (page types, URL shapes, key flows, prerequisites). (The earlier auto-derive/merge helper `app-profile.ts` and the `intent-map.ts` resolver were pruned — coordinator-era code unused by the MCP flow.)
- **Site data as context, not code** (`config/guardrails/<site>.json`): overlay selectors + extra consequential names parameterize the guardrail generator; adding a site is authoring data, not code.
- **Entry**: every run starts from `BASE_URL` (the homepage) and the agent navigates to the target **on-page** (nav / categories / tiles), so the routing between pages is exercised and recorded — it never deep-links past it. `config/app-context.md` guides the route. (The earlier structured robots/sitemap loader, `sitemap.ts`, was pruned.)
- **Run mode**: one — agent-driven via the `/explore <target>` Claude Code slash command (`.claude/commands/explore.md`), driving Playwright MCP. (The earlier self-driving heuristic mode, `PlaywrightHost`, decider seam, and file channel were removed — see `docs/ai-exploratory-architecture.md` → "Key decisions".)
- **Artifacts** per run under `artifacts/exploration/<run-id>/` (gitignored): `manifest.json`, `graph.json`, `errors.json`, `issues.json`, `report.md`, and `evidence/`.
- `src/exploration/` stays pure (no Playwright/browser imports), like `src/machines/`, so the telemetry core is unit-testable without a browser. The migration adds `@playwright/mcp` (via `npx`); the system `unzip` is used only as a fallback for a bundled `trace.zip` (the normal path reads the raw `.trace`). No runtime schema library.

## Test Suites

- `auth-graph-driven.spec.ts`: one Playwright test per auth shortest path.
- `shopping-graph-driven.spec.ts`: one Playwright test per generated shopping path.
- `coverage-loop.spec.ts`: stub-only coverage-loop scenarios for default coverage, personas, weights, state priority, and budget exhaustion.
- `tests/exploration/` (`exploration` project): browser-free specs exercising the exploration core, the guardrail generator, and the trace parser — `recorder.spec.ts`, `guardrails.spec.ts`, `trace-parser.spec.ts` — plus `parse-run.spec.ts` (a runner, skipped unless `EXPLORE_TRACE` is set). Live exploration is the `/explore` slash command (Playwright MCP), not a Playwright project.
- Playwright config uses one worker, disables full parallelism, traces on first retry, and defines `stub`, `app`, and `exploration` projects.
- Live `app` runs are fail-fast at the test-result level: an observed storefront failure fails that run immediately.

## Contributor Patterns

- Use `docs/PATTERNS/INDEX.md` before changing page objects, graph-driven specs, journey machines, action maps, or runtime config loaders.
- Keep reusable conventions in pattern docs; keep historical implementation notes in `agents/IMPLEMENTATION.md`.
