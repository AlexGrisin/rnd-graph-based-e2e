# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Proof of concept for **model-based testing (MBT)**: application behavior is an XState v5 state machine, and Playwright tests are **generated from the graph at runtime** — there are no per-journey test cases. The auth spec (`tests/mbt/auth-graph-driven.spec.ts`) reads the machine, asks `@xstate/graph` for one shortest path per reachable state, and registers one Playwright test per path. Adding a state/transition to the machine makes new tests appear automatically.

## Commands

```bash
npm install
npx playwright install chromium     # required before the `app` project can run

npm test                            # both MBT projects (stub + app)
npm test -- --project=stub          # fast graph/wiring smoke — mock page, no browser, log-only actions
npm test -- --project=app           # live E2E against BASE_URL (Chromium) — needs APP_EMAIL/APP_PASSWORD
npm run test:mbt                    # specs under tests/mbt only
npm run test:ui                     # Playwright UI mode
npm run format                      # prettier --write
npm run format:check                # prettier --check (CI gate)

npm test -- --project=exploration       # browser-free exploration core + guardrail + trace parser (no browser)
# /explore <target>                     # Claude Code slash command — agent-driven live run via Playwright MCP
```

Run a **single** generated test by `--grep` on its auto-generated title (format: `→ <targetState>: <EVENT> → <EVENT>`):

```bash
npm test -- --project=stub --grep "→ myAccount"
npm test -- --project=app  --grep "→ error: GO_LOGIN → FAIL"
```

There is no lint or typecheck script. Type errors surface through Playwright's TS compilation at test run. `npx tsc --noEmit` works for an explicit check.

## Architecture

Data flow: **machine → path generator → spec → action map → page objects → state verifier**.

```
src/machines/      Pure XState machines — NO Playwright/browser imports allowed here
src/mbt/graph/     Path generation + path execution engine
tests/mbt/         Auth and shopping graph-driven specs
tests/support/     Adapters: actions/ (event→page), pages/ (POMs + verifier), app/ (overlays), config/
tests/fixtures.ts  Playwright fixtures; selects stub vs live wiring by project name
```

### How a test runs

1. `auth-graph-driven.spec.ts` calls `getAllShortestPaths(appAuthMachine)` at module load and loops over paths.
2. For each path it calls `testPath()` (`src/mbt/graph/test-model-factory.ts`), which walks each step, looks up `actions[event.type]`, runs the handler, then calls `verifyState(expectedStateName)`.
3. Action handlers call page-object methods; the state verifier calls each page's `should*` assertion.

### Shared fixture wiring

The generated specs share `tests/fixtures.ts`, which swaps the wiring by `testInfo.project.name`:

| Fixture         | `stub`                       | `app`                                |
| --------------- | ---------------------------- | ------------------------------------ |
| `page`          | in-memory mock (no browser)  | real Chromium with `baseURL`         |
| `actions`       | `createStubActions()` (logs) | `createAppAuthActions({ ...pages })` |
| `stateVerifier` | `noopStateVerifier`          | `createStateVerifier({ ...pages })`  |

So `stub` validates that the graph, action keys, and verifier keys are wired up without launching a browser; `app` exercises the real site.

## The contract that makes generation work

These string keys must line up exactly, or tests throw at runtime:

- **Action map keys === machine event `type` strings.** A path step with an unhandled event throws `No action handler registered for event "X"`.
- **State verifier keys === machine state names.** An unmapped state throws `No page assertion for state "X"`.
- **Imports use `.js` extensions** even for `.ts` files (ESM + `NodeNext` module resolution). Omitting `.js` breaks resolution.

## Adding behavior (the 5 glue points)

To add a state — e.g. `checkout` after `myAccount`:

1. `src/machines/app-auth.machine.ts` — add the state, events, transitions (and to the `AppAuthEvent` union / `AppAuthStateValue` type).
2. `tests/support/pages/checkout.page.ts` — new `CheckoutPage` with `should*` assertion methods.
3. `tests/fixtures.ts` — add a `checkoutPage` fixture and pass it into the `actions`/`stateVerifier` factories.
4. `tests/support/actions/app-auth.actions.ts` — add a handler per new event (key matches event `type`).
5. `tests/support/pages/state-verifier.ts` — map the new state name to its page assertion.

Then run the matching browser-free project to confirm new paths generate. No edit to `auth-graph-driven.spec.ts` is needed.

## Conventions

- **Page objects** (`tests/support/pages/*.page.ts`): class `<PageName>Page`; all `Locator`s defined as `private readonly` in the constructor (no shared `locators.ts`); assertion methods prefixed `should` (`shouldBeOnPage`, `shouldShowError`); action methods named for user intent. Call `dismissAppOverlays(page)` before interacting on live runs (the site has OneTrust + push-notification overlays that block clicks). Page objects are exposed only as Playwright fixtures and are **never imported from `src/`**.
- **Specs** contain no selectors/browser logic — only path iteration and fixture injection.
- Prettier uses `singleQuote: true` (`.prettierrc.json`).

## Design constraints

- `workers: 1`, `fullyParallel: false` — MBT paths are stateful and run sequentially.
- `src/machines/` stays pure (no Playwright imports) so the model is testable/serializable independent of the browser.
- Coverage model is `getShortestPaths` — one minimal path per reachable state. For non-shortest or named journeys, use `getPathsFromEvents` (resolves an explicit event list into a path, validated by the graph) — see README "Specific journeys when needed". For exhaustive coverage, extend `src/mbt/graph/path-generator.ts` (e.g. `getSimplePaths`).

## Autonomous exploration (second, independent subsystem)

A separate subsystem from the MBT engine — they share no runtime code. Given only a **semantic target** (e.g. `pdp`, `cart`, `guest checkout`, never a URL), an agent explores the live storefront (`BASE_URL`), records a state/transition graph + telemetry, and emits a report. Entry, budget, safety policy, and stop conditions are internal defaults; the input is the target plus an optional `:: <scope & risks>` note.

The agent-driven run **drives Microsoft's Playwright MCP directly** (the in-session Claude is the LLM); a **post-hoc parser** turns the recorded trace into the artifacts. An earlier engine (Node `coordinator` loop, `PlaywrightHost`, `Heuristic`/`AgentDecider`, file channel, self-driving autonomous mode) was **removed** in favor of this — see `docs/ai-exploratory-architecture.md` → "Key decisions".

Where it lives:

- `src/exploration/` — pure, browser-independent core. **Must stay Playwright-free** (like `src/machines/`); import extensions are `.js` (ESM/NodeNext). `recorder.ts`/`graph.ts`/`issues.ts`/`hash.ts` are telemetry + state identity; `report.ts` writes artifacts; `consequence-policy.ts` holds the shared consequence patterns (`CONSEQUENCE_PATTERNS`); `signal-origin.ts` classifies first/third-party. Every run starts from `BASE_URL` (home) and the agent navigates to the target on-page (guided by `config/app-context.md`); it never deep-links past the routing. The coordinator-era `intent-map`/`app-profile`/`sitemap` helpers were pruned.
- `tests/support/exploration/` — `guardrails.ts` (generates the page-side guardrail init-script) + `trace-parser.ts` (post-hoc trace → artifacts; the only component that reads a real trace; reads the raw uncompressed `.trace` directly, `unzip` only for a legacy `.zip`).
- `tests/exploration/` (browser-free `exploration` project): `recorder.spec.ts`, `guardrails.spec.ts`, `trace-parser.spec.ts`, and `parse-run.spec.ts` (a runner, skipped unless `EXPLORE_TRACE` is set).
- `.mcp.json` registers the `@playwright/mcp` server (isolated Chromium, `--caps=devtools` for tracing, `--init-script` guardrail). `.claude/commands/explore.md` — the `/explore <target>` command. `.claude/commands/onboard-site.md` — recons a new target. `config/app-context.md` — authored per-site profile that grounds the agent; `config/guardrails/<site>.json` — per-site guardrail data (+ generated `.init.js`). (There is currently **no cross-run learning store** — the former `config/app-context.learned.md` read/append was dropped; a replacement mechanism is TBD, so each run is self-contained.)

One run mode: **agent-driven** via `/explore`, driving Playwright MCP. No AI SDK or API key (the LLM is the session).

Safety is a **page-side guardrail**, not a code-enforced tool gate: the guardrail init-script neutralizes consequential controls (matched against `CONSEQUENCE_PATTERNS` — e.g. order, payment, purchase, personal-data, destructive, send, publish; login/sign-up/register are intentionally NOT blocked) and dismisses the consent overlay on every page; the parser also records consequential actions as skipped boundaries. The budget is prompt-enforced by the skill — 10 acting steps / 15 states (POC), declared once in the skill and mirrored by the parser's `STEP_BUDGET`/`STATE_BUDGET` (which only label completion `budgetExhausted` vs `targetCovered`). This is weaker than the retired in-code gate — a deliberate trade (see `docs/ai-exploratory-architecture.md` → "Key decisions"). Run artifacts land in `artifacts/exploration/<run-id>/` (gitignored). New dep: `@playwright/mcp` (via `npx`); the parser reads the raw `.trace` directly, using the system `unzip` only as a fallback for a bundled `.zip`.

## Environment

`.env` (copy from `.env.example`): `BASE_URL` (default `https://www.g-star.com/en_nl`), `APP_EMAIL`, `APP_PASSWORD` (the latter two required for the `app` project). Loaded via `dotenv` in `playwright.config.ts`. `BB_EMAIL`/`BB_PASSWORD` are test-account credentials the `/explore` skill uses for real login / authenticated scenarios (optional — without them exploration does negative auth probes only). Treat them as secrets: never echo them into reports/debriefs or commit a trace (traces capture typed values and are git-ignored).

## Note on docs

`README.md` and `docs/` are the most detailed reference and are kept current with the code (current states: `home → login → myAccount → error`, with `error` a `final` state; assertions are `shouldBeOnPage`/`shouldShowError`; page objects are wired as per-page Playwright fixtures, not a registry). `agents/IMPLEMENTATION.md` and `docs/PATTERNS/CHANGES.md` are append-only changelogs — they describe past refactors (e.g. an old `dashboard` state, `assertOnPage`, `PageRegistry`) and are historically accurate, so don't "correct" them to match current naming. When prose and source ever disagree, trust the source files in `src/` and `tests/`.
