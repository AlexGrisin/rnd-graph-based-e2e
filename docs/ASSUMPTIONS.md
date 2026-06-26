Assumptions and unknowns for the MBT POC scaffold.

## Assumptions

- TypeScript + ESM is acceptable for the team.
- Stub actions are sufficient until a target app is chosen.
- Shortest-path traversal is the default walk strategy.
- npm is the package manager.

## Unknowns

- Target application URL and selectors (deferred).
- CI integration requirements (deferred).
- Whether random/BFS strategies will be needed beyond shortest paths.

## Decisions made

- Page objects live under `tests/support/pages/`, not `src/`.
- Walk strategy encoded as separate XState machine.
- XState machines must not import Playwright.
