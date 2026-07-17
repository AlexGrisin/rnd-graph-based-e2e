---
name: mbt-exploratory-flow
description: >-
  Explores a live user journey, proposes an XState graph, and wires Playwright
  page objects through the MBT 5 glue points (machine → paths → actions → POMs →
  verifier). Use whenever the user wants to add or extend a graph-driven E2E
  flow, explore a storefront/app journey for MBT, create or update page objects
  for new machine states, model a critical path as an XState machine, or turn a
  manual journey into graph-generated Playwright tests — even if they do not say
  "MBT" or "skill". Always apply when combining browser exploration with machine
  and page-object work in this repo.
---

# MBT exploratory flow

Turn a real user journey into a graph-driven MBT slice: explore the live app,
lock intent + assertions with HITL, then implement machine + page objects + glue.

**Do not write production code until HITL Gate A and Gate B are approved.**

## When this applies

- New journey (e.g. purchase, search, account settings)
- Extend an existing machine with new states/events
- Replace brittle hand-written journeys with `getShortestPaths` coverage

## Hard constraints (this repo)

- Machines in `src/machines/` — **no** Playwright imports
- Page objects in `tests/support/pages/` — fixtures only; never imported from `src/`
- Action map keys === event `type` strings
- State verifier keys === machine state names
- Imports use `.js` extensions (ESM / NodeNext)
- Prefer a **separate machine** per journey unless the user explicitly wants one combined graph
- MVP: prefer reliable navigation (fixed URL / first enabled control) over brittle menu/search unless requested

## Tooling: explore vs prove

Use **both** — different jobs. Prefer Playwright MCP over Chrome DevTools for exploration in this repo.

| Phase                         | Tool                                                                                                     | Why                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Steps 0–2, Gate A             | Docs + code (no browser)                                                                                 | Intent/inventory                                               |
| Step 3 probe + selector debug | **Playwright MCP** (or optional agent [`playwright-cli`](https://playwright.dev/agent-cli/introduction)) | Discover URLs, overlays, controls                              |
| Steps 5–6, Gate C             | **Playwright Test** via `npm test` (`@playwright/test`)                                                  | Real stub/app fixtures, action map, verifier — CI-shaped proof |
| Post-implement flake          | MCP/`playwright-cli` to reproduce → fix POM → re-run **`npm test`**                                      | Don’t treat explore-only success as done                       |

**Naming:** “Playwright CLI” in older notes meant `npx playwright test` / `npm test`. That is **not** the agent package `@playwright/cli` (`playwright-cli`). Step 6 never uses `playwright-cli`.

**Do not** ship on MCP/`playwright-cli` exploration alone. **Do not** use `npm test` alone while still discovering the journey (slow/noisy).

---

## Workflow checklist

Copy and track:

```
- [ ] 0. Load docs + code context (CONTEXT / ARCHITECTURE / IMPLEMENTATION first)
- [ ] 1. HITL Gate A — intent (journey, scope, machine strategy)
- [ ] 2. Inventory existing glue (states, events, POMs, actions, verifier)
- [ ] 3. Probe live app (only after Gate A) — URLs, overlays, controls, guest/auth
- [ ] 4. HITL Gate B — proposed graph + per-state assertions + selectors
- [ ] 5. Implement 5 glue points + stub handlers + spec
- [ ] 6. Validate stub, then one live happy-path grep
- [ ] 7. HITL Gate C — accept delivery (stub + live evidence)
- [ ] 8. Write back docs (CONTEXT / ARCHITECTURE / IMPLEMENTATION / ASSUMPTIONS)
```

Docs are **read at the start** (ground intent and architecture) and **updated at the end** (reflect what shipped). Do not leave docs only as a post-hoc afterthought without having loaded them in Step 0.

---

## Step 0 — Context (docs first)

**Read before Gate A** (full files unless huge; then full CONTEXT + ARCHITECTURE, and `^#{1,3}` headers of IMPLEMENTATION):

| File                       | Why                                              |
| -------------------------- | ------------------------------------------------ |
| `docs/CONTEXT.md`          | Business scope / target journeys already claimed |
| `docs/ARCHITECTURE.md`     | Machines, layers, testing architecture           |
| `agents/IMPLEMENTATION.md` | What already shipped (avoid duplicate work)      |
| `docs/ASSUMPTIONS.md`      | Known unknowns / prior decisions                 |
| `CLAUDE.md`                | 5 glue points, stub vs app contract              |

Then skim code:

- Current machines under `src/machines/`
- `tests/fixtures.ts`, `tests/support/pages/state-verifier.ts`, existing `*.actions.ts`

Identify whether the journey should be a **new machine** or an **extension**, and call out any conflict with CONTEXT/ARCHITECTURE before asking Gate A questions.

---

## Step 1 — HITL Gate A (intent)

**Stop and ask.** Do not open a browser / MCP / playwright-cli until Gate A is approved.
Do not write production code until Gate A **and** Gate B are approved. Confirm:

1. **Journey** — ordered screens (e.g. home → pdp → cart → checkout)
2. **In / out of scope** — payment? login? search vs direct URL?
3. **Machine strategy** — new machine vs extend existing (default: **new**)
4. **MVP reliability** — direct URL / first available size vs full UI browse
5. **Success** — which state is `final`, and what “done” means for live proof

Present options with a **safe default**. Wait for explicit approval  
(`Yes, I approve` / `Yes, I reviewed the plan` or clear equivalent).

Read [hitl-gates.md](hitl-gates.md) before asking; use its question bank and approval phrases.

---

## Step 2 — Inventory

Produce a short inventory table:

| Layer                         | Current | Gap for this journey |
| ----------------------------- | ------- | -------------------- |
| Machine states/events         | …       | …                    |
| Page objects                  | …       | …                    |
| Action handlers (live + stub) | …       | …                    |
| Verifier keys                 | …       | …                    |
| Spec / `testMatch`            | …       | …                    |

---

## Step 3 — Live exploration

Use **Playwright MCP** against `BASE_URL` (do **not** print secrets from `.env`). Record findings for Gate B; this is discovery, not acceptance.

Probe and record:

1. Stable URL patterns per screen
2. Overlays that block clicks (extend `dismissAppOverlays` if needed)
3. Required controls before a transition (e.g. waist + length before add-to-bag)
4. Whether guest checkout / auth is forced
5. Prefer `getByRole` / `getByTestId` over CSS class hashes

If a critical assumption fails (e.g. checkout requires login and that was out of scope), **HITL escalate** — do not silently change the journey.

---

## Step 4 — HITL Gate B (graph + assertions)

Read [hitl-gates.md](hitl-gates.md) Gate B before presenting. Present for approval **before implementation**:

### Proposed machine

```text
states: …
events: …
transitions: …
final: …
```

### Per-state assertions (must be measurable)

| State | `should*` assertion | Evidence (URL / visible chrome) |
| ----- | ------------------- | ------------------------------- |
| …     | `shouldBeOnPage`    | …                               |

### Per-event actions

| Event | User intent / POM method | Notes (overlays, waits) |
| ----- | ------------------------ | ----------------------- |
| …     | …                        | …                       |

### Config

Env knobs (e.g. `PRODUCT_PATH`) with defaults from the probe.

Wait for explicit approval of **assertions and graph shape**.

---

## Step 5 — Implement (5 glue points + stub / spec / config)

In order:

1. **Machine** — `src/machines/<name>.machine.ts` + event/state types
2. **Stub actions** — every new event type in `stub-actions.ts`
3. **Page objects** — create/update `*.page.ts` (`should*` + intent methods; `dismissAppOverlays`)
4. **Fixtures** — `page-fixtures.ts` + `tests/fixtures.ts` (extend stub mock page APIs if constructors call new Playwright methods)
5. **Live actions** — `tests/support/actions/<name>.actions.ts`; merge into `actions` fixture without event-name collisions
6. **Verifier** — map each new state name
7. **Spec** — `tests/mbt/<name>-graph-driven.spec.ts` + `playwright.config.ts` `testMatch`
8. **Config** — e.g. `tests/support/config/…` + `.env.example` (never commit secrets)

Auth credentials: lazy-load inside handlers that need them so purchase-only runs do not require `APP_EMAIL` / `APP_PASSWORD`.

Follow [docs/PATTERNS/page-object.md](../../../docs/PATTERNS/page-object.md) for POM shape.

---

## Step 6 — Validate

Use **Playwright Test** (`npm test` / `@playwright/test`) for Gate C evidence. MCP and agent `playwright-cli` do **not** count as pass:

1. `npm test -- --project=stub` — new paths register; no missing action keys
2. Live: `npm test -- --project=app --grep "→ <finalState>"` (or journey-specific title)
3. If live fails: optional MCP/`playwright-cli` repro, then fix POM/waits on **observable** signals (badge count, guest form, URL) — not blind long sleeps as the only strategy; re-run `npm test`

---

## Step 7 — HITL Gate C (delivery)

Read [hitl-gates.md](hitl-gates.md) Gate C before presenting. Show:

- Stub result
- Live happy-path result
- Final state/event list vs Gate B

Ask for explicit acceptance. On acceptance only → Step 8. On reject → iterate; do not update CONTEXT/ARCHITECTURE yet.

---

## Step 8 — Write back docs

After Gate C approval, update briefly to match **what actually shipped** (not the draft intent):

- `docs/CONTEXT.md` — journey now in scope
- `docs/ARCHITECTURE.md` — machine states/events, fixtures/specs
- `agents/IMPLEMENTATION.md` — changelog entry
- `docs/ASSUMPTIONS.md` — MVP choices / unknowns resolved or still open
- `docs/CODEMAP.md` — new files if the map is maintained

If Step 0 found docs already accurate for a small additive change, still append IMPLEMENTATION; skip redundant CONTEXT rewrites.

---

## Anti-patterns

- Coding before Gate A / Gate B approval
- Skipping Step 0 docs load and discovering scope conflicts only after implementation
- Mixing unrelated journeys into one machine “for convenience”
- Asserting only “page loaded” with no URL/chrome check
- Hardcoding hashed CSS class names from the probe
- Putting selectors in `src/machines/`
- Skipping stub mock updates when POMs call `getByTestId` / `locator` / etc.
- Claiming Gate C done from MCP/`playwright-cli` exploration without `npm test` stub + app evidence
- Updating CONTEXT/ARCHITECTURE only from memory without having read them at Step 0

## Additional resources

- [hitl-gates.md](hitl-gates.md) — question banks and approval phrases
- [examples.md](examples.md) — purchase-flow worked example from this repo
