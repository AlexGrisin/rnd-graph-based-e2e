Business/domain context for `rnd-graph-based-e2e`.
Purpose: help agents understand why the project exists and which user journeys matter.
Content: stakeholder intent, scope, target outcomes, and domain terms only; keep technical design in `docs/ARCHITECTURE.md`.
Style: concise, factual, grep-friendly, no implementation changelog.

## Purpose

- Validate whether model-based E2E testing can reduce hand-written browser journeys while preserving readable coverage over real user flows.
- Prove the approach on a lightweight POC before committing to a broader testing framework.
- Keep journey behavior as the source of truth so tests can be generated, labeled, and reviewed as paths through user states.
- Explore a second, independent approach: given only a semantic target, autonomously drive the live storefront to surface potential issues without a pre-authored model or script.

## Domain Scope

- The POC covers two live storefront journeys:
  - Auth: visitor starts on the home page, opens login, reaches account on success, or reaches an error state on failure.
  - Purchase: visitor starts on the home page, opens a product detail page, adds to cart, and reaches checkout shipping as a guest.
- The POC evaluates both deterministic shortest-path coverage and exploration-loop coverage over those journeys.
- Payment completion, catalog discovery, search behavior, account lifecycle, and post-checkout fulfillment are outside the current MBT POC scope.
- A browser-free smoke mode exists so graph wiring can be checked without depending on the live storefront.
- A separate autonomous-exploration POC takes a single semantic target (e.g. `pdp`, `cart`, `guest checkout`) and explores the live storefront directly — no model, journey, or action sequence is authored. It covers both happy paths and deliberate negative probes (e.g. add-to-bag with no size) to surface potential issues, splitting findings into first-party (site) and third-party (external vendor) signals.
- Exploration observes safety boundaries: it never places orders, pays, creates accounts, submits personal data, or performs destructive/publish/communication-send actions — these are skipped and recorded, never executed, and the run never pauses for input.

## Target Outcomes

- Developers should add or change journeys by describing user-visible states and events, then providing browser behavior for those events.
- Generated paths should make coverage gaps visible without requiring each path to be hand-authored.
- The POC should stay small enough to compare static shortest paths with exploration-loop coverage generation.
- Live storefront validation is fail-fast: a single observed storefront failure fails the active `app` test run.
- Autonomous exploration should reach and exercise the target area from the single-target input alone, produce a readable report with a correlated potential-issue list, and stop cleanly within its internal budget.

## Terms

- MBT: model-based testing; tests are derived from a behavior model instead of written as independent scripts.
- Journey: a user-visible flow represented as states and allowed events.
- Shortest path: the minimum event sequence needed to reach a reachable journey state.
- Coverage loop: iterative generation of paths for uncovered states or transitions until a target or budget is reached.
- Exploration target: the single semantic input to an autonomous run (an intent such as `pdp` or `guest checkout`), not a URL; everything else is an internal default.
- Decider: the pluggable "decide" step that chooses the next action — heuristic (deterministic ranking, self-driving) or agent (LLM-driven, in-session via a file channel).
- Consequence policy: site-agnostic rules that flag order/payment/account/destructive/personal-data actions so the run skips and records them instead of executing.
- First-/third-party signal: a telemetry signal classified by whether it originated on the site's own domain (first-party) or an external vendor (third-party).
- appContext: an app profile (auto-derived structure + authored notes) handed to the decider so it can navigate to the target efficiently and honor known prerequisites.
