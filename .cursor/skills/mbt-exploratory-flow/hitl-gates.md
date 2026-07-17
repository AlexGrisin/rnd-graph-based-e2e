# HITL gates for MBT exploratory flow

Mandatory human checkpoints. Do not treat a clarifying chat reply as approval unless it clearly accepts the artifact.

## Accepted approval phrases

- `Yes, I approve`
- `Yes, I reviewed the plan`
- `Approve, the plan and specs were reviewed`
- Clear equivalent that names the artifact (intent / assertions / delivery)

Anything else (edits, questions, “looks ok?”) = **review feedback**, not approval.

---

## Gate A — Intent

Ask 5–8 MECE questions (batch). Prioritize scope > auth/privacy > UX > technical.

Suggested set:

1. What is the ordered journey (screens)?
2. What is explicitly out of scope (payment, login, search, negative paths)?
3. New machine vs extend existing? (default: new)
4. How should we reach the key entity — direct URL, catalog, or search? (default: easiest/reliable)
5. Guest vs authenticated where the site forces a choice?
6. Which state is terminal / `final`?
7. Stub-only first, or stub + one live happy path required for “done”?
8. Any fixed test data (product path, locale) already known?

Output a one-screen **intent summary** (user-provided vs inferred) and wait.

---

## Gate B — Graph + assertions

After live probe, present:

1. State diagram or bullet transitions
2. Table of **state → assertion** (URL regex and/or visible chrome)
3. Table of **event → action** (POM method + critical waits)
4. Risks / flakiness notes (overlays, size selection, login walls)
5. Config defaults discovered on the site

Require approval of assertions specifically — wrong assertions ship false confidence.

If the probe contradicts Gate A (e.g. login required), stop and re-open Gate A.

---

## Gate C — Delivery

Present evidence only:

- Stub command + pass count
- Live grep command + pass/fail
- Diff vs Gate B (any assertion changes made during stabilization — call them out)

Ask whether to accept, or iterate on selectors/assertions.

On reject or “iterate”: do not run Step 8 docs write-back; fix POMs/assertions;
if graph shape or assertions change, re-open Gate B before claiming C again.

---

## Escalation triggers (immediate HITL)

- Cannot bet on the proposed selectors
- Site requires auth/payment outside approved scope
- Journey would exceed ~15 files / multi-area without prior scope agreement
- User says UNDO or shows mismatch twice — stop changes and clarify
