Business/domain context for `rnd-graph-based-e2e`.
Purpose: help agents understand why the project exists and which user journeys matter.
Content: stakeholder intent, scope, target outcomes, and domain terms only; keep technical design in `docs/ARCHITECTURE.md`.
Style: concise, factual, grep-friendly, no implementation changelog.

## Purpose

- Validate whether model-based E2E testing can reduce hand-written browser journeys while preserving readable coverage over real user flows.
- Prove the approach on a lightweight POC before committing to a broader testing framework.
- Keep journey behavior as the source of truth so tests can be generated, labeled, and reviewed as paths through user states.

## Domain Scope

- The POC covers two live storefront journeys:
  - Auth: visitor starts on the home page, opens login, reaches account on success, or reaches an error state on failure.
  - Purchase: visitor starts on the home page, opens a product detail page, adds to cart, and reaches checkout shipping as a guest.
- The POC evaluates both deterministic shortest-path coverage and exploration-loop coverage over those journeys.
- Payment completion, catalog discovery, search behavior, account lifecycle, and post-checkout fulfillment are outside the current POC scope.
- A browser-free smoke mode exists so graph wiring can be checked without depending on the live storefront.

## Target Outcomes

- Developers should add or change journeys by describing user-visible states and events, then providing browser behavior for those events.
- Generated paths should make coverage gaps visible without requiring each path to be hand-authored.
- The POC should stay small enough to compare static shortest paths with exploration-loop coverage generation.
- Live storefront validation is fail-fast: a single observed storefront failure fails the active `app` test run.

## Terms

- MBT: model-based testing; tests are derived from a behavior model instead of written as independent scripts.
- Journey: a user-visible flow represented as states and allowed events.
- Shortest path: the minimum event sequence needed to reach a reachable journey state.
- Coverage loop: iterative generation of paths for uncovered states or transitions until a target or budget is reached.
