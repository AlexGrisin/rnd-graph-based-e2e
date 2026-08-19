---
description: Agent-driven autonomous exploration of BASE_URL for a semantic target, optionally scoped with ':: scope & risks'. You drive Playwright MCP directly; a post-hoc parser turns the trace into a graph + issue report.
argument-hint: "<target> [:: scope & risks]   e.g. pdp | guest checkout :: risks: double-submit, promo validation"
---

You explore the live storefront (`BASE_URL`) for a **semantic target**, driving the
**`playwright` MCP server** directly: you observe each page, choose one useful
action, act, and repeat — then a post-hoc parser turns the recorded trace into the
exploration artifacts (`graph.json`, `issues.json`, `report.md`).

**Input:** `$ARGUMENTS` is a **target**, optionally followed by `:: <scope & risks>`.
Everything before `::` is the target (default `pdp`); everything after is an optional
**scope & risks** note you factor in (see Mission). Examples:
`pdp` · `guest checkout` · `checkout :: risks: double-submit charges, promo validation;
known issue: mini-bag count lags; in scope: bag + checkout only`.

## Safety is enforced in the page, not by you

What counts as consequential is defined **once** in
`src/exploration/consequence-policy.ts` (`CONSEQUENCE_PATTERNS`) — the single source of
truth. A guardrail init-script (generated from it, loaded via the MCP `--init-script`)
runs on every page and **neutralizes** those controls (`disabled` + a `data-explore-blocked`
marker) and dismisses the cookie/consent overlay. This is a page-side defense, not an
un-bypassable gate.

Your rule is simple — you don't need a per-flow allow/block list:

- **Not neutralized → in scope.** Explore any live control freely, including auth (login,
  sign up, register). For a **real successful login**, use the test-account credentials
  `BB_EMAIL` / `BB_PASSWORD` from `.env` (see **Authenticated scenarios** below). For every
  other field — registration, personal details, checkout — use **synthetic** data. Never
  enter real personal data beyond those dedicated test credentials.
- **Neutralized (`data-explore-blocked` / disabled) → a boundary.** Record it and move on;
  don't try to force it.

To change what's allowed, edit `consequence-policy.ts` and regenerate the guardrail — never
by adding policy to this prompt.

## Mission

Reach and exercise the **target area**, discovering meaningful user-visible behavior.
Don't wander into unrelated navigation. **One action per step.** Keep the run polite
and bounded by a hard, countable budget (below) — stop the moment you hit it.

### Budget (hard gate)

Two hard caps — stop the instant you hit **either** (the numbers appear only here; refer
to them elsewhere as "the cap"):

- **Acting steps — 10 max** (POC budget). One acting step = one `browser_click`,
  `browser_type`, `browser_select_option`, `browser_navigate`, or `browser_navigate_back`.
- **Distinct page states — 15 max.**

There is no code limit — the count is yours to keep, so:

- **Read-only calls are free** and don't count toward the acting-step cap:
  `browser_snapshot`, `browser_console_messages`, `browser_network_requests`.
- **Announce your running step count on each acting step** (e.g. `step 3`). On reaching
  either cap, **stop immediately** and move on to producing artifacts — even mid-flow.
- **Stop early** if the run is thrashing (repeated timeouts, an overlay you can't clear) —
  a wasted attempt still counts. (Time can't be self-measured reliably; the step count is
  the gate.)

**Always start from the homepage** (`BASE_URL`) on every run and **navigate to the
target on-page** — clicking through nav / categories / tiles. Do **not** deep-link
straight to the target: the routing between pages is itself part of what we explore and
record, so teleporting past it defeats the purpose.

**Use `config/app-context.md`** (the per-site profile) to navigate efficiently from home
to the target: it lists page types, URL shapes, key flows, and prerequisites (e.g. "ring
size required before add to bag"). Read it first.

### Scope & risks (optional, from the input)

If the input included a `:: <scope & risks>` note (parsed as `$SCOPE` in step 1), treat it
as the human's steering for this session:

- **Scope** — focus on the named features/components; treat clearly-unrelated areas as out
  of scope (record them as _not explored_ rather than wandering in).
- **Risks / known problem areas** — aim your heuristics and negative probes at these
  **first**; that's where a bug is most expected.
- **Report against them** — in the debrief, state which listed risks you investigated (and
  the verdict) and which remain unverified.

No note → explore the target with the general heuristics as usual.

### Authenticated scenarios (real login)

For login / sign-in / "my account" targets — or whenever reaching an authenticated area
would deepen coverage — sign in for real with the test account in `.env`:

- Read `BB_EMAIL` / `BB_PASSWORD` from `.env` and type them into the sign-in form to reach
  a **genuinely authenticated** state, then explore signed-in-only areas (account
  dashboard, saved details, order history, wishlist).
- Still do the **negative** auth probes first with synthetic input (empty submit,
  invalid-credentials) — those expose validation; then the real login for the happy path.
- If `BB_EMAIL` / `BB_PASSWORD` are unset, skip the real login (do the negative probes only)
  and record "no authenticated coverage — credentials absent" as a gap.
- **Credential hygiene:** treat the values as secrets — do **not** echo them into chat, the
  report, or the debrief. (They will pass through the `browser_type` call and the local,
  git-ignored trace; that's expected. Never commit a trace.)

Routing hints (choose actions whose name/href move toward the target):

- **pdp**: home → a category listing (e.g. `/rings/engagement-rings`) → an individual
  **product tile** (numeric id + name ending in `/p`) → the PDP. Then exercise PDP
  actions (option/ring-size selection, add to bag).
- **cart**: reach a PDP, select any required option, add to bag, then open `/bag`.
- **guest checkout**: reach `/bag` → checkout entry (guest path). `Place order`/`Pay`
  are neutralized by the guardrail — that's expected; stop there.
- **search**: use the site search control; sample a query; explore results.
- **login / sign in / my account**: home → header "Sign in" → `/login`. Do the negative
  probes (empty submit, invalid credentials) first, then a **real** login with
  `BB_EMAIL` / `BB_PASSWORD` (see **Authenticated scenarios**) and explore the signed-in
  account area.
- **unknown/free text**: bias toward candidates whose name matches the target words.

### Cover BOTH happy paths and edge cases

Exploration is most valuable when it does both:

- **Happy path** — complete the flow correctly and confirm it worked (e.g. select a
  ring size, then add to bag; the bag counter should increment to 1).
- **Negative / adversarial probes** — deliberately misuse a step to expose validation:
  add to bag with **no size**, submit an empty/invalid form, apply a bad promo code.
  Note what the site did (that's the finding), then satisfy the prerequisite and
  complete the happy path too. Don't blindly repeat a failing action.

Field-level validation prompts (`please enter…`, `invalid…`) are the site reacting to
incomplete input — informational, **not** bugs.

### General heuristics (apply to every target)

These are site- and flow-agnostic — work through the applicable ones at each meaningful
state, whatever the target. Don't just click forward:

- **Boundaries / invalid input** — empty required fields, invalid email/postcode, a bad
  promo code, over-long text.
- **State transitions** — after an action, go **back** (`browser_navigate_back`) and
  **refresh** (re-`browser_navigate` the same URL), then continue: did state survive?
  Revisit an earlier page mid-flow and return.
- **Duplicate / rapid submit** — click a submit/continue control twice.
- **Repeat / idempotency** — repeat the same add/navigation; does the result stay
  consistent (e.g. the bag counter)?
- **Network failures** (offline / forced 5xx / timeout) — **not enabled yet**: the
  offline/route tools need `--caps=network` on the MCP server, which `.mcp.json` does not
  set. Skip them and say so when you report coverage.

Pick the heuristics that fit the state you're on; you won't have budget for all of them
every run. Prefer the ones most likely to expose a real issue for the current target.

## Procedure

### 1. Preconditions & parse input (once)

```bash
grep -q '^BASE_URL=' .env 2>/dev/null || cp .env.example .env
mkdir -p artifacts/exploration/mcp

# Split the target from an optional ':: scope & risks' note.
RAW="${ARGUMENTS:-pdp}"
TARGET="$(printf '%s' "${RAW%%::*}" | xargs)"                     # before '::', trimmed
case "$RAW" in *"::"*) SCOPE="$(printf '%s' "${RAW#*::}" | xargs)";; *) SCOPE="";; esac
echo "target=$TARGET"; echo "scope/risks=${SCOPE:-<none>}"
```

The `playwright` MCP server is registered in `.mcp.json` (isolated Chromium,
`--caps=devtools` for tracing, guardrail `--init-script`). If its tools are not
available, tell the user to reload so the MCP server starts, and stop.

### 2. Start recording and open the homepage

1. Call **`browser_start_tracing`** (from the `playwright` MCP server).
2. Get the homepage URL — **always start here, every run**:
   ```bash
   grep '^BASE_URL=' .env | cut -d= -f2
   ```
3. **`browser_navigate`** to that `BASE_URL`. From here, reach the target by navigating
   on-page (nav menus, category listings, product tiles) — **never deep-link past the
   routing**. `config/app-context.md` tells you which links lead where.

### 3. Explore loop — repeat until done (within the budget)

Each step:

1. **`browser_snapshot`** — read the accessibility tree (URLs, roles, names, refs).
2. Reason: pick the single best on-target action. Prefer unvisited, on-target links;
   for PDPs, product tiles carry product-code hrefs. Watch for `data-explore-blocked`
   controls (neutralized — skip them).
3. Act with **one** of: `browser_click` (ref), `browser_type` (ref + a safe synthetic
   value — or the `BB_EMAIL`/`BB_PASSWORD` test credentials for the sign-in form; never
   real personal/card data otherwise), `browser_select_option` (ref + option).
4. Read the result in the next `browser_snapshot`: did state change? Did the bag
   counter move? Any visible error banner? Use `browser_console_messages` /
   `browser_network_requests` if you suspect a failure.

Stop when the target is reached and exercised (happy + at least one negative probe),
or you hit either cap (see **Budget** above).

### 4. Stop tracing and produce artifacts

1. Call **`browser_stop_tracing`** — it writes the trace under
   `artifacts/exploration/mcp/traces/`. **Prefer the path it reports.** Otherwise pick
   the **newest raw `.trace`** — that's your session's trace. Do **not** use `trace.zip`:
   it's a separate bundle that can be stale (left over from an earlier run), so parsing it
   silently reports the wrong session.
   ```bash
   # Newest uncompressed trace = the run you just finished (no unzip needed).
   TRACE=$(ls -t artifacts/exploration/mcp/traces/*.trace 2>/dev/null | head -1); echo "$TRACE"
   ```
2. Parse the trace into artifacts (browser-free runner):
   ```bash
   RUN="agent-$(date +%s)"
   TARGET="$(printf '%s' "${ARGUMENTS:-pdp}" | sed 's/::.*//' | xargs)"   # target only, not the scope note
   EXPLORE_TRACE="$TRACE" EXPLORE_TARGET="$TARGET" \
     EXPLORE_OUT="artifacts/exploration/$RUN" EXPLORE_RUN_ID="$RUN" \
     npx playwright test --project=exploration parse-run --reporter=line
   ```

### 5. Close the browser

Call **`browser_close`** to close the page/tab now that tracing has been parsed. Do
this even if a later step (parsing) fails — the browser shouldn't be left open once
exploration is over.

### 6. Debrief & follow-ups

Read `artifacts/exploration/<run>/report.md` (the parser's evidence: potential issues,
skipped boundaries, decision trail). Then **append a session debrief** to it — the parser
owns the top (evidence); you add judgment at the bottom. Use `$RUN` from step 4, and fill
every section from what actually happened (write `_none_` rather than inventing):

```bash
cat >> "artifacts/exploration/$RUN/report.md" <<'EOF'

## Session debrief

### Coverage

Explored — what you actually exercised (one ticked item per flow / heuristic):
- [x] <flow or heuristic exercised>
- [x] <another>

Not explored (gaps) — what you didn't reach, each with the reason:
- [ ] <gap> — <budget spent / blocked by overlay-or-error / out of scope / network heuristics off>
- [ ] <gap> — <reason>

### Pages the run reached

Each page you reached, with the steps you took on it, in order. Describe each step
plainly (what a person did) — not raw selectors or `aria-ref` ids:
- <page url>
  - step 1: <e.g. clicked "Sign in" in the header>
  - step 2: <e.g. submitted the login form empty → both-field validation shown>

### Findings & learning
- <key observations; reference the issues listed above>

### Open questions
- <ambiguities a human / requirements owner should resolve>

### Risks
- **Investigated** (from the input's scope & risks, if any): <each listed risk → verdict>
- **Remaining / unverified**: <listed risks you couldn't reach + new plausible problem areas>

### Follow-ups
- **Explore next:** <targets/areas worth another run>
- **Defects to file:** <confirmed, reproducible bugs>
- **Regression / automation candidates:** <stable, repeatable journeys worth locking in —
  the graph paths that could seed an XState model / generated Playwright spec>
EOF
```

Then give the user the same debrief in chat plus the artifacts path. **Report honestly** —
if a click timed out, an overlay blocked you, or the target wasn't fully reached, say so
and list it under coverage gaps. (Re-running the parser regenerates `report.md` and drops
the appended debrief; it's a per-run session note, not parser output.)

## Notes

- Inputs are the target and an optional `:: scope & risks` note; entry, budget, safety, and
  stop conditions are internal.
- Safety is a **page-side guardrail** (init-script), not a code-enforced tool gate — the
  policy lives in `consequence-policy.ts`; stay within the mission and treat any neutralized
  (`data-explore-blocked`) control as a boundary.
- Bounded by design so it stays a quick, polite run against the live site.
- Trace filename from `browser_stop_tracing` is discovered at runtime (step 4);
  artifacts land in `artifacts/exploration/agent-<ts>/` (git-ignored).
- The browser is closed at the end of every run (step 5) — it isn't left open across
  invocations.
