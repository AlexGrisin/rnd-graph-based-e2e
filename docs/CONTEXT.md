Business context for a lightweight POC exploring model-based E2E testing with Playwright and XState graph traversal.

## Purpose

Validate whether XState state machines plus `@xstate/graph` path utilities can drive Playwright E2E tests as an MBT framework without a heavyweight custom walker.

## Target state

- Developers define application behavior as XState machines.
- Graph utilities generate traversal paths.
- Playwright page objects implement transition actions.
- Walk strategy is orchestrated by a dedicated XState machine.

## Scope

POC targeting two separate journeys against live `g-star.com` (NL):

- **Auth** — `home → login → myAccount | error`
- **Purchase** — `home → pdp → cart → checkout` (guest, no payment)

Stub project for graph smoke; live `app` project for browser E2E.
