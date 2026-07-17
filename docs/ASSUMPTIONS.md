Assumptions and unknowns for the MBT POC scaffold.

## Assumptions

- TypeScript + ESM is acceptable for the team.
- Stub actions are sufficient for graph/wiring smoke.
- Shortest-path traversal is the default walk strategy.
- npm is the package manager.
- Purchase MVP uses a fixed `PRODUCT_PATH` PDP (no search/catalog UI).
- Guest checkout reaches `/checkout/shipping` without payment; email `mbt-poc@example.com` is throwaway.

## Unknowns

- CI integration requirements (deferred).
- Whether random/BFS strategies will be needed beyond shortest paths.
- Catalog/search entry stability on live storefront (deferred beyond MVP).

## Decisions made

- Page objects live under `tests/support/pages/`, not `src/`.
- Walk strategy encoded as separate XState machine.
- XState machines must not import Playwright.
- Auth and purchase are separate machines / graph suites.
