---
description: Run an agent-driven autonomous exploration against BASE_URL for a semantic target (e.g. pdp, cart, guest checkout). You make each decision live via the file channel.
argument-hint: <target>  e.g. pdp | cart | search | guest checkout
---

You are driving an **agent-driven website exploration**. A Node/Playwright loop
opens the real browser, observes each page, and asks YOU which visible action to
take next through a file channel. You reason over each observation and choose;
the loop executes, records telemetry, and produces artifacts. Safety (skipping
order/payment/account/etc. actions) is enforced by the tool — you cannot bypass
it, so choose freely for coverage.

**Target:** `$ARGUMENTS` (if empty, use `pdp`).

## Mission

Reach and exercise the **target area**, discovering meaningful user-visible
behavior. Don't wander into unrelated navigation. One action per request.

**Use `appContext`** (included in every request): it profiles the site — page
types, URL shapes, key flows, prerequisites (e.g. "size required before add"),
and known third-party vendors. Let it guide you straight to the target and avoid
re-discovering the structure. Authored notes live in `config/app-context.md`.

Routing hints (choose actions whose `name`/`href` move toward the target):

- **pdp**: home → a category listing (e.g. `/rings/engagement-rings`,
  `/watches/...`) → an individual **product tile** (its `href` is a numeric id +
  name ending in `/p`, e.g. `/0149753/...-Engagement-Ring/p`) → the PDP. Then
  exercise PDP actions (option / ring-size selection, add to bag).
- **cart**: reach a PDP, select any required option, add to the bag, then open
  `/bag`.

### Cover BOTH happy paths and edge cases

Exploration is most valuable when it does both — do not only click things in the
"correct" order.

- **Happy path** — complete the flow correctly and confirm it worked. E.g. on a
  PDP select any required option (e.g. a **ring size**), then `add to bag`; the
  bag counter should increment to 1. This proves the flow works.
- **Negative / adversarial probes** — deliberately misuse a step to expose
  validation and error handling: `add to bag` with **no size**, submit an empty
  or invalid form, apply a bad promo code. These surface exploratory issues a
  happy path never would.

**Read the outcome of every action** via the request's `lastAction`
(`changedState`, `signals`) plus the candidates (e.g. the bag counter). After an
`add to bag`/submit:

- `changedState: false` or a lingering `Items in shopping bag: 0` → the step was
  a no-op or blocked; a prerequisite (size/variant) is unmet.
- an `errorShown`/`obstructed`/`httpError` signal → the site surfaced an error.

When you ran a negative probe, note what the site did (that's the finding), then
satisfy the prerequisite and complete the happy path too. Don't blindly repeat a
failing click — either fix the precondition or move on.

- **guest checkout**: reach the bag, then the checkout entry (guest path). The
  tool auto-skips `Place order`/`Pay` — that's expected.
- **search**: use the site search control; sample a query; explore results.
- **unknown/free text**: bias toward candidates whose name matches the words.

On pages with 100+ candidates, the first ones are usually main content; product
tiles carry product-code hrefs. Prefer unvisited, on-target links. **Stop** when
the target is reached and exercised, or budget is nearly spent.

**Form fields** appear as candidates with `kind: "fill"` or `"select"`. Choosing
one types a **safe synthetic value** (e.g. email → a test address, search → a
query) or picks an option — you don't supply the value. Sensitive fields
(password, card, CVV) are flagged consequential and auto-skipped. So to get past
a form gate (e.g. guest checkout's email step), pick the `fill` field(s) then the
submit/continue button. Field-level validation prompts (`invalid field: …`,
`please enter …`) are recorded as informational, **not** issues — they're the
site reacting to the tool's own input, not a bug.

## Procedure

### 1. Preconditions (once)

```bash
npx playwright install chromium >/dev/null 2>&1 || true
grep -q '^BASE_URL=' .env 2>/dev/null || cp .env.example .env
```

### 2. Launch the run in the background (headed so the user can watch)

```bash
rm -rf artifacts/exploration/_channel && mkdir -p artifacts/exploration/_channel
EXPLORE_HEADED=1 EXPLORE_TARGET="$ARGUMENTS" \
  npx playwright test --project=exploration-live \
  tests/exploration-live/agent.live.spec.ts --reporter=line \
  > artifacts/exploration/_channel/run.log 2>&1
```

Run this with `run_in_background: true`. (Drop `EXPLORE_HEADED=1` for headless.)

### 3. Drive the loop — repeat until the run finishes

Each iteration, block until the next decision request appears (or the run ends),
then read it:

```bash
D=artifacts/exploration/_channel; LAST=${LAST:-0}
for i in $(seq 1 90); do
  if grep -q '\[agent\]' "$D/run.log" 2>/dev/null; then echo "RUN_DONE"; break; fi
  if [ -f "$D/request.json" ]; then
    s=$(grep -m1 '"step"' "$D/request.json" | grep -o '[0-9]*')
    if [ "$s" != "$LAST" ]; then cat "$D/request.json"; break; fi
  fi
  sleep 2
done
```

`request.json` shape:

```json
{ "step": 1, "target": "...", "currentUrl": "...",
  "budgetRemaining": { "steps": N, "states": N },
  "candidates": [ { "id": "e0", "name": "...", "kind": "navigate|click|...", "href": "..." } ] }
```

Pick the single best `id` for the mission, then reply by writing
`response.json` (this consumes the request; then loop back to step 3 with
`LAST` set to the step you just answered):

```bash
cat > artifacts/exploration/_channel/response.json <<'EOF'
{"actionId":"e3","rationale":"one short line on why this moves toward the target"}
EOF
```

To end the run yourself (target covered, or nothing useful left):

```bash
cat > artifacts/exploration/_channel/response.json <<'EOF'
{"stop":true,"reason":"targetCovered","rationale":"reached and exercised the target"}
EOF
```

`reason` is one of `targetCovered | noUsefulAction | budgetExhausted`.

If a candidate list is huge, inspect it with a quick `python3 -c` filter rather
than eyeballing 120 rows (e.g. grep candidates whose `href` matches a product
code, or whose `name` contains the target word).

### 4. Finish

When the wait prints `RUN_DONE` (or `run.log` shows `passed`/`failed`), stop
driving and summarize:

```bash
ls artifacts/exploration/agent-* -d | tail -1   # the run dir
```

Read that dir's `report.md` and give the user: states discovered, the decision
trail, potential issues (site vs third-party), and the artifacts path. Report
honestly — if a click timed out or the target wasn't fully reached, say so.

## Notes

- Only input is the target; entry, budget, safety policy, and stop conditions
  are internal defaults.
- Bounded by design (~20 steps / ~15 states / time budget) so it stays a quick,
  polite run against the live site.
- Artifacts land in `artifacts/exploration/agent-<timestamp>/` (git-ignored).
