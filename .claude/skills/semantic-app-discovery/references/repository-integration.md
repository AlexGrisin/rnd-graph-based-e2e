# Repository Integration

Read this reference in `integrated` mode after the XState change is defined.

## Required wiring

For each new or changed machine event:

1. Add a semantic page-object method under `tests/support/pages/` when browser behavior is new.
2. Add a matching handler in the journey action factory under `tests/support/actions/`.
3. Add a matching log-only handler in `tests/support/actions/stub-actions.ts`.

For each new or distinct machine state:

1. Add or extend the owning page object's `should*` assertion.
2. Register the state key in `tests/support/pages/state-verifier.ts`.
3. Add a fixture and `PageFixtures` entry only when a new page-object class is needed.

For a new journey, add a thin `tests/mbt/<journey>-graph-driven.spec.ts` following the [graph-driven spec pattern](../../../../docs/PATTERNS/test-spec.md), include it in the `stub` and `app` Playwright project matching, and merge the journey action map in `tests/fixtures.ts`.

## Ownership boundaries

- `src/machines/`: typed states, events, transitions, and small domain context only.
- `tests/support/pages/`: selectors, browser actions, and `should*` assertions.
- `tests/support/actions/`: event-to-page-method adapters and runtime config lookup.
- `tests/support/pages/state-verifier.ts`: state-to-assertion mapping.
- `tests/support/actions/stub-actions.ts`: log-only parity for every event.
- `tests/mbt/`: generated-path orchestration only; never add selectors or page-object calls.

Follow the existing [page-object](../../../../docs/PATTERNS/page-object.md) and [action-map](../../../../docs/PATTERNS/action-map.md) patterns. Use only observed, stable locators and approved data sources. Do not read or persist local credentials.

## Completion checks

An integrated change is complete only when:

- every graph event has a live and stub action handler;
- every reachable state has a verifier assertion;
- the new journey has a graph-driven spec when applicable;
- `npm test -- --project=stub` passes for the affected journey; and
- formatting and the targeted typecheck show no new diagnostics in changed files.

If live behavior cannot be safely exercised, retain the model proposal, report the missing adapter evidence, and do not claim integrated completion.
